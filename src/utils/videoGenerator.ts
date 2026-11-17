import type {
  AspectRatioOption,
  BackdropPreset,
  ContentLanguage,
  GeneratedVideoResult,
  MotionPreset,
  PresentationMode,
  VideoScript,
  VideoStylePreset,
} from "../types/studio";
import {
  BACKDROP_THEMES,
  drawStudioBackdrop,
  loadImageElement,
} from "./backgroundRemover";

export interface VideoRenderParams {
  cutoutDataUrl: string;
  backgroundDataUrl?: string | null;
  ugcTryOnDataUrl?: string | null;
  ugcPointingDataUrl?: string | null;
  presentationMode?: PresentationMode;
  productName: string;
  tagline: string;
  script: VideoScript;
  backdropPreset: BackdropPreset;
  stylePreset: VideoStylePreset;
  motionPreset?: MotionPreset;
  aspectRatio?: AspectRatioOption;
  accentHex: string;
  language?: ContentLanguage;
  voiceoverBase64?: string | null;
  showOverlays?: boolean;
  onProgress?: (percent: number) => void;
}

let sharedAudioCtx: AudioContext | null = null;

export function unlockAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === "suspended") {
    void sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * Math.min(1, Math.max(0, t))) - 1) / 2;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function pickSupportedMimeType(hasAudio: boolean): {
  mimeType: string;
  extension: "mp4" | "webm";
} {
  const candidates: Array<{ mime: string; ext: "mp4" | "webm" }> = hasAudio
    ? [
        { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
        { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
        { mime: "video/mp4;codecs=avc1,mp4a.40.2", ext: "mp4" },
        { mime: "video/webm", ext: "webm" },
      ]
    : [
        { mime: "video/mp4;codecs=avc1,mp4a.40.2", ext: "mp4" },
        { mime: "video/mp4", ext: "mp4" },
        { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
        { mime: "video/webm", ext: "webm" },
      ];

  for (const c of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(c.mime)
    ) {
      return { mimeType: c.mime, extension: c.ext };
    }
  }
  return { mimeType: "video/webm", extension: "webm" };
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function renderShowcaseVideo(
  params: VideoRenderParams
): Promise<GeneratedVideoResult> {
  const {
    cutoutDataUrl,
    backgroundDataUrl,
    productName,
    script,
    backdropPreset,
    stylePreset,
    motionPreset = "Cinematic Product Reveal",
    aspectRatio = "9:16",
    accentHex,
    language = "tagalog",
    voiceoverBase64,
    showOverlays = true,
    onProgress,
  } = params;

  const isWide = aspectRatio === "16:9";
  const width = isWide ? 1280 : 720;
  const height = isWide ? 720 : 1280;
  const fps = 30;

  const [productImg, bgImg] = await Promise.all([
    loadImageElement(cutoutDataUrl),
    backgroundDataUrl
      ? loadImageElement(backgroundDataUrl).catch(() => null)
      : Promise.resolve(null),
  ]);

  const theme = BACKDROP_THEMES[backdropPreset];

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to initialize 2D video canvas.");

  const canvasStream = canvas.captureStream(fps);

  let audioCtx: AudioContext | null = null;
  let audioSource: AudioBufferSourceNode | null = null;
  let gainNode: GainNode | null = null;
  let durationSec = 9.0;
  const combinedStream = new MediaStream(canvasStream.getVideoTracks());
  let hasAudioTrack = false;

  if (voiceoverBase64) {
    audioCtx = unlockAudioContext() || new AudioContext();
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    const audioBuf = await audioCtx.decodeAudioData(
      base64ToArrayBuffer(voiceoverBase64)
    );
    durationSec = Math.max(8.5, Math.min(15.0, audioBuf.duration + 0.6));

    const dest = audioCtx.createMediaStreamDestination();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 1.0;

    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuf;
    audioSource.connect(gainNode);
    gainNode.connect(dest);

    for (const track of dest.stream.getAudioTracks()) {
      combinedStream.addTrack(track);
      hasAudioTrack = true;
    }
  }

  const { mimeType, extension } = pickSupportedMimeType(hasAudioTrack);
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 4_500_000,
    audioBitsPerSecond: 128_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const validAccent = /^#[0-9A-Fa-f]{6}$/.test(accentHex)
    ? accentHex
    : "#E11D48";

  const particles = Array.from({ length: 22 }, (_, i) => ({
    x: ((i * 137.5) % 100) / 100,
    y: ((i * 73.1) % 100) / 100,
    r: 1.5 + (i % 3) * 1.2,
    speed: 0.015 + (i % 4) * 0.009,
  }));

  const beat1End = durationSec * 0.31;
  const beat2End = durationSec * 0.65;

  const drawOverlayBeat = (
    headline: string,
    sublabel: string,
    beatProgress: number,
    yCenter: number,
    isCTA = false
  ) => {
    const alpha = easeOutCubic(Math.min(1, beatProgress * 3.5));
    const slideY = (1 - easeOutCubic(Math.min(1, beatProgress * 3))) * 24;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, slideY);

    ctx.font = `700 ${isCTA ? 34 : 38}px "Bricolage Grotesque", "Plus Jakarta Sans", sans-serif`;
    const lines = wrapTextLines(ctx, headline, width - 130).slice(0, 2);
    const lineHeight = isCTA ? 44 : 48;
    const boxHeight = lines.length * lineHeight + (sublabel ? 52 : 28);
    const maxLineW = Math.max(
      ...lines.map((l) => ctx.measureText(l).width),
      sublabel ? ctx.measureText(sublabel).width : 0
    );
    const boxW = Math.min(width - 84, Math.max(300, maxLineW + 64));
    const boxX = (width - boxW) / 2;
    const boxY = yCenter - boxHeight / 2;

    drawRoundedRect(ctx, boxX, boxY, boxW, boxHeight, 18);
    ctx.fillStyle = isCTA ? validAccent : "rgba(15, 23, 42, 0.86)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fill();
    ctx.shadowColor = "transparent";

    if (sublabel) {
      ctx.font = `600 17px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = isCTA
        ? "rgba(255, 255, 255, 0.92)"
        : "rgba(255, 255, 255, 0.74)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(sublabel, width / 2, boxY + 13);
    }

    ctx.font = `700 ${isCTA ? 34 : 38}px "Bricolage Grotesque", "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const textStartY = boxY + (sublabel ? 38 : 15);
    lines.forEach((line, idx) => {
      ctx.fillText(line, width / 2, textStartY + idx * lineHeight);
    });

    ctx.restore();
  };

  const drawFrame = (elapsedSec: number) => {
    const t = Math.min(1, elapsedSec / durationSec);

    // 1. Background Layer (separately animated behind untouched cutout!)
    if (bgImg) {
      const bgScale =
        motionPreset === "Slow Camera Push" || motionPreset === "Cinematic Product Reveal"
          ? 1.02 + 0.12 * easeInOutSine(t)
          : motionPreset === "Rotating Product Display" || motionPreset === "Luxury Commercial"
            ? 1.08
            : 1.02 + 0.08 * easeInOutSine(t);
      const bgPanX =
        motionPreset === "Rotating Product Display" || motionPreset === "Luxury Commercial"
          ? Math.sin(elapsedSec * 0.85) * 22
          : Math.sin(elapsedSec * 0.45) * 10;
      const bw = width * bgScale;
      const bh = height * bgScale;
      ctx.drawImage(bgImg, (width - bw) / 2 + bgPanX, (height - bh) / 2, bw, bh);
    } else {
      drawStudioBackdrop(ctx, width, height, theme, validAccent);
    }

    // Dynamic lighting sweep around background
    const sweepSpeed = motionPreset === "Dramatic Lighting Reveal" ? 2.2 : 4.2;
    const sweepProgress = easeInOutSine((elapsedSec % sweepSpeed) / sweepSpeed);
    const sweepX = -width * 0.4 + sweepProgress * width * 1.8;
    ctx.save();
    const beamGrad = ctx.createLinearGradient(
      sweepX - 190,
      0,
      sweepX + 190,
      height
    );
    beamGrad.addColorStop(0, "rgba(255,255,255,0)");
    beamGrad.addColorStop(
      0.5,
      motionPreset === "Dramatic Lighting Reveal"
        ? "rgba(255,255,255,0.2)"
        : motionPreset === "Luxury Commercial"
          ? "rgba(253,230,138,0.14)"
          : theme.isDark
            ? "rgba(255,255,255,0.07)"
            : "rgba(255,255,255,0.22)"
    );
    beamGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = beamGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Floating light dust / ambient particles
    ctx.save();
    for (const p of particles) {
      const py = ((p.y - elapsedSec * p.speed + 2) % 1) * height * 0.78;
      const px = p.x * width + Math.sin(elapsedSec * 1.4 + p.y * 10) * 14;
      ctx.fillStyle = theme.isDark
        ? "rgba(255,255,255,0.18)"
        : "rgba(255,255,255,0.42)";
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Foregound Untouched Product Layer Motion driven by MotionPreset
    const maxProdW = isWide ? 440 : 520;
    const maxProdH = isWide ? 430 : 510;
    const baseFit = Math.min(
      maxProdW / productImg.naturalWidth,
      maxProdH / productImg.naturalHeight
    );

    const enterP = easeOutCubic(elapsedSec / 0.85);
    let floatOffset = Math.sin(elapsedSec * 1.9) * 6;
    let panX = 0;
    let zoomFactor = 0.96 + 0.08 * easeOutCubic(t);
    let tiltAngle = Math.sin(elapsedSec * 1.1) * 0.012;

    if (motionPreset === "Cinematic Product Reveal") {
      zoomFactor = 0.88 + 0.18 * easeOutCubic(t);
      floatOffset = Math.sin(elapsedSec * 1.3) * 5;
      tiltAngle = Math.sin(elapsedSec * 0.9) * 0.016;
    } else if (motionPreset === "Slow Camera Push") {
      zoomFactor = 0.92 + 0.2 * easeInOutSine(t);
      floatOffset = Math.sin(elapsedSec * 1.1) * 3;
    } else if (motionPreset === "Floating Product Showcase") {
      floatOffset = Math.sin(elapsedSec * 2.5) * 18;
      tiltAngle = Math.sin(elapsedSec * 1.7) * 0.032;
      zoomFactor = 0.94 + 0.07 * Math.sin(t * Math.PI);
    } else if (motionPreset === "Rotating Product Display") {
      tiltAngle = Math.sin(elapsedSec * 1.45) * 0.055;
      panX = Math.sin(elapsedSec * 1.1) * 14;
      zoomFactor = 0.96 + 0.07 * easeInOutSine(t);
    } else if (motionPreset === "Luxury Commercial") {
      panX = Math.sin(elapsedSec * 1.05) * 20;
      tiltAngle = Math.cos(elapsedSec * 1.05) * 0.024;
      zoomFactor = 0.94 + 0.11 * easeInOutSine(t);
    } else if (motionPreset === "Minimalist Product Presentation") {
      floatOffset = Math.sin(elapsedSec * 1.1) * 3;
      tiltAngle = 0;
      zoomFactor = 0.97 + 0.05 * easeInOutSine(t);
    } else if (motionPreset === "Dramatic Lighting Reveal") {
      zoomFactor = 0.98 + 0.09 * easeOutCubic(t);
      tiltAngle = Math.sin(elapsedSec * 0.8) * 0.01;
    } else if (motionPreset === "TikTok Product Advertisement") {
      floatOffset = Math.sin(elapsedSec * 2.4) * 10;
      panX = Math.sin(elapsedSec * 1.4) * 10;
      zoomFactor = 0.94 + 0.13 * easeOutCubic(t);
    }

    if (stylePreset === "energetic") {
      floatOffset *= 1.18;
    }

    const prodW = productImg.naturalWidth * baseFit * zoomFactor;
    const prodH = productImg.naturalHeight * baseFit * zoomFactor;
    const centerX = width / 2 + panX;
    const pedestalSurfaceY = height * (isWide ? 0.78 : 0.695);
    const baseCenterY =
      pedestalSurfaceY - productImg.naturalHeight * baseFit * 0.5;
    const centerY = baseCenterY + (1 - enterP) * 85 + floatOffset;

    // Ground Contact Shadow anchored below product layer
    ctx.save();
    const shadowScale = Math.max(0.75, 1 - floatOffset * 0.007);
    const shadowY = pedestalSurfaceY + 8;
    const shadowGrad = ctx.createRadialGradient(
      centerX,
      shadowY,
      10,
      centerX,
      shadowY,
      prodW * 0.52 * shadowScale
    );
    shadowGrad.addColorStop(0, "rgba(15, 23, 42, 0.36)");
    shadowGrad.addColorStop(0.6, "rgba(15, 23, 42, 0.12)");
    shadowGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      shadowY,
      prodW * 0.5 * shadowScale,
      28 * shadowScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // Draw untouched original cutout image layer
    ctx.save();
    ctx.globalAlpha = enterP;
    ctx.translate(centerX, centerY);
    ctx.rotate(tiltAngle);
    ctx.shadowColor = "rgba(15, 23, 42, 0.22)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 16;
    ctx.drawImage(productImg, -prodW / 2, -prodH / 2, prodW, prodH);
    ctx.restore();

    // Optional Kinetic Hook & CTA Beat Overlays (TikTok Safe Zones)
    if (showOverlays) {
      const benefitLabel =
        language === "tagalog" ? "Bakit Sulit Ito" : "Key Highlight";
      const ctaLabel =
        language === "tagalog"
          ? "I-click ang Yellow Basket"
          : "Tap Yellow Basket Below";

      if (elapsedSec < beat1End) {
        drawOverlayBeat(
          script.beat1Hook,
          productName.slice(0, 34),
          elapsedSec / beat1End,
          195
        );
      } else if (elapsedSec < beat2End) {
        drawOverlayBeat(
          script.beat2Benefit,
          benefitLabel,
          (elapsedSec - beat1End) / (beat2End - beat1End),
          195
        );
      } else {
        drawOverlayBeat(
          script.beat3Offer,
          ctaLabel,
          (elapsedSec - beat2End) / (durationSec - beat2End),
          1020,
          true
        );
      }
    }

    // Subtle top progress hairline
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(36, 48, width - 72, 4);
    ctx.fillStyle = validAccent;
    ctx.fillRect(36, 48, (width - 72) * t, 4);
  };

  return new Promise<GeneratedVideoResult>((resolve, reject) => {
    recorder.onstop = () => {
      if (audioSource) {
        try {
          audioSource.stop();
          audioSource.disconnect();
        } catch {
          // ignore if already ended
        }
      }
      if (gainNode) {
        try {
          gainNode.disconnect();
        } catch {
          // ignore
        }
      }
      const blob = new Blob(chunks, { type: mimeType });
      const videoUrl = URL.createObjectURL(blob);
      onProgress?.(100);
      resolve({
        videoUrl,
        blob,
        mimeType,
        extension,
        durationSec,
        resolution: `${width}x${height}`,
        engine: "local_compositor",
      });
    };

    recorder.onerror = () => {
      reject(new Error("Video encoding failed in browser."));
    };

    drawFrame(0);
    recorder.start(200);
    if (audioSource) {
      audioSource.start(0);
    }

    const startTime = performance.now();
    const intervalMs = 1000 / fps;

    const timer = window.setInterval(() => {
      const elapsedSec = (performance.now() - startTime) / 1000;
      if (elapsedSec >= durationSec) {
        window.clearInterval(timer);
        drawFrame(durationSec);
        recorder.stop();
        return;
      }
      drawFrame(elapsedSec);
      onProgress?.(Math.min(98, Math.round((elapsedSec / durationSec) * 100)));
    }, intervalMs);
  });
}
