import type {
  AspectRatioOption,
  BackdropPreset,
  VisualStyle,
} from "../types/studio";
import {
  BACKDROP_THEMES,
  drawStudioBackdrop,
  loadImageElement,
} from "./backgroundRemover";

export function getDimensionsForAspectRatio(ratio: AspectRatioOption): {
  width: number;
  height: number;
} {
  switch (ratio) {
    case "1:1":
      return { width: 1080, height: 1080 };
    case "3:4":
      return { width: 1080, height: 1440 };
    case "16:9":
      return { width: 1920, height: 1080 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}

export async function compositeExactProductOverBackground(params: {
  cutoutDataUrl: string;
  backgroundDataUrl?: string;
  fallbackBackdrop?: BackdropPreset;
  aspectRatio: AspectRatioOption;
  accentHex?: string;
  visualStyle?: VisualStyle;
  headlineOverlay?: string;
  promoBadgeOverlay?: string;
}): Promise<string> {
  const { width, height } = getDimensionsForAspectRatio(params.aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable.");

  const cutoutImg = await loadImageElement(params.cutoutDataUrl);

  if (params.backgroundDataUrl) {
    const bgImg = await loadImageElement(params.backgroundDataUrl);
    // Cover fit generated background cleanly
    const scale = Math.max(width / bgImg.naturalWidth, height / bgImg.naturalHeight);
    const bw = bgImg.naturalWidth * scale;
    const bh = bgImg.naturalHeight * scale;
    const bx = (width - bw) / 2;
    const by = (height - bh) / 2;
    ctx.drawImage(bgImg, bx, by, bw, bh);

    // Subtle atmospheric vignette / lighting integration around edges (never touching center product)
    const vignette = ctx.createRadialGradient(
      width * 0.5,
      height * 0.52,
      Math.min(width, height) * 0.28,
      width * 0.5,
      height * 0.52,
      Math.max(width, height) * 0.72
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(8,12,20,0.28)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  } else {
    const theme =
      BACKDROP_THEMES[params.fallbackBackdrop || "travertine"] ||
      BACKDROP_THEMES.travertine;
    drawStudioBackdrop(ctx, width, height, theme, params.accentHex);
  }

  // Fit extracted original product cleanly into the center stage
  const maxProdW = width * (params.aspectRatio === "16:9" ? 0.42 : 0.68);
  const maxProdH = height * (params.aspectRatio === "16:9" ? 0.68 : 0.46);
  const fitScale = Math.min(
    maxProdW / cutoutImg.naturalWidth,
    maxProdH / cutoutImg.naturalHeight
  );
  const drawW = cutoutImg.naturalWidth * fitScale;
  const drawH = cutoutImg.naturalHeight * fitScale;
  const drawX = (width - drawW) / 2;
  const anchorY = params.backgroundDataUrl
    ? Math.round(height * 0.72)
    : Math.round(height * 0.705);
  const drawY = Math.max(Math.round(height * 0.14), anchorY - drawH);

  // Contact shadow grounding the untouched product onto the stage
  ctx.save();
  const shadowY = drawY + drawH + Math.max(6, height * 0.005);
  const contactShadow = ctx.createRadialGradient(
    width / 2,
    shadowY,
    12,
    width / 2,
    shadowY,
    drawW * 0.55
  );
  contactShadow.addColorStop(0, "rgba(5, 8, 15, 0.48)");
  contactShadow.addColorStop(0.55, "rgba(5, 8, 15, 0.18)");
  contactShadow.addColorStop(1, "rgba(5, 8, 15, 0)");
  ctx.fillStyle = contactShadow;
  ctx.beginPath();
  ctx.ellipse(width / 2, shadowY, drawW * 0.52, Math.max(22, height * 0.02), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Composite exact original product cutout with crisp drop shadow (zero repainting of pixels)
  ctx.save();
  ctx.shadowColor = "rgba(8, 12, 20, 0.34)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 14;
  ctx.drawImage(cutoutImg, drawX, drawY, drawW, drawH);
  ctx.restore();

  // Optional mobile-readable TikTok safe-zone headline / promotional overlay
  if (params.headlineOverlay?.trim()) {
    ctx.save();
    const safeTopY = params.aspectRatio === "9:16" ? height * 0.14 : height * 0.08;
    const text = params.headlineOverlay.trim().slice(0, 64);
    ctx.font = `700 ${Math.round(width * 0.044)}px "Bricolage Grotesque", "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const maxTextW = width * 0.78;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (ctx.measureText(candidate).width <= maxTextW) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
    const displayLines = lines.slice(0, 2);

    const lineH = Math.round(width * 0.056);
    const padX = Math.round(width * 0.045);
    const padY = Math.round(width * 0.025);
    const widest = Math.max(...displayLines.map((l) => ctx.measureText(l).width));
    const boxW = Math.min(width * 0.86, widest + padX * 2);
    const boxH = displayLines.length * lineH + padY * 2;
    const boxX = (width - boxW) / 2;

    ctx.fillStyle = "rgba(11, 15, 23, 0.78)";
    ctx.beginPath();
    ctx.roundRect(boxX, safeTopY, boxW, boxH, 16);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    displayLines.forEach((line, i) => {
      ctx.fillText(line, width / 2, safeTopY + padY + lineH * (i + 0.5));
    });
    ctx.restore();
  }

  if (params.promoBadgeOverlay?.trim()) {
    ctx.save();
    const badgeText = params.promoBadgeOverlay.trim().slice(0, 40);
    const safeBotY = params.aspectRatio === "9:16" ? height * 0.80 : height * 0.86;
    ctx.font = `700 ${Math.round(width * 0.032)}px "Plus Jakarta Sans", sans-serif`;
    const tw = ctx.measureText(badgeText).width;
    const bw = Math.min(width * 0.78, tw + 56);
    const bh = Math.round(width * 0.068);
    const bx = (width - bw) / 2;

    ctx.fillStyle =
      params.accentHex && /^#[0-9A-Fa-f]{6}$/.test(params.accentHex)
        ? params.accentHex
        : "#F43F5E";
    ctx.beginPath();
    ctx.roundRect(bx, safeBotY, bw, bh, 12);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, width / 2, safeBotY + bh / 2);
    ctx.restore();
  }

  return canvas.toDataURL("image/png");
}
