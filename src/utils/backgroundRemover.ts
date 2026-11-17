import type { BackdropPreset, CutoutResult, ProductBox, WearType } from "../types/studio";

export interface BackdropTheme {
  id: BackdropPreset;
  label: string;
  topColor: string;
  midColor: string;
  floorColor: string;
  pedestalTop: string;
  pedestalSide: string;
  glowColor: string;
  textColor: string;
  isDark: boolean;
}

export const BACKDROP_THEMES: Record<BackdropPreset, BackdropTheme> = {
  travertine: {
    id: "travertine",
    label: "Sunlit Villa Stone",
    topColor: "#EFE6D8",
    midColor: "#E0D3BF",
    floorColor: "#CBBBA3",
    pedestalTop: "#EFE8DC",
    pedestalSide: "#C8B89E",
    glowColor: "rgba(255, 246, 226, 0.72)",
    textColor: "#1E1B18",
    isDark: false,
  },
  obsidian: {
    id: "obsidian",
    label: "Dark Tech Studio",
    topColor: "#0B0F17",
    midColor: "#161D2B",
    floorColor: "#090C12",
    pedestalTop: "#242D3F",
    pedestalSide: "#121722",
    glowColor: "rgba(148, 163, 184, 0.3)",
    textColor: "#F8FAFC",
    isDark: true,
  },
  botanical: {
    id: "botanical",
    label: "Sunlit Spa Marble",
    topColor: "#E8EDE6",
    midColor: "#DCE4D8",
    floorColor: "#CBD4C6",
    pedestalTop: "#F6F7F4",
    pedestalSide: "#D4DBD1",
    glowColor: "rgba(255, 253, 244, 0.78)",
    textColor: "#1C241E",
    isDark: false,
  },
  street_concrete: {
    id: "street_concrete",
    label: "Urban Loft Concrete",
    topColor: "#D6D8DC",
    midColor: "#C1C5CB",
    floorColor: "#A3A8B0",
    pedestalTop: "#CFD3D8",
    pedestalSide: "#9FA5AE",
    glowColor: "rgba(255, 255, 255, 0.65)",
    textColor: "#181A1E",
    isDark: false,
  },
  blush: {
    id: "blush",
    label: "Vanity Rose Arch",
    topColor: "#F6E7E5",
    midColor: "#ECD4D1",
    floorColor: "#DFBDBA",
    pedestalTop: "#F8EEEC",
    pedestalSide: "#D8B3B0",
    glowColor: "rgba(255, 245, 243, 0.8)",
    textColor: "#2D181A",
    isDark: false,
  },
  pearl: {
    id: "pearl",
    label: "Daylight Oak & Stone",
    topColor: "#F8FAFC",
    midColor: "#EAEFF5",
    floorColor: "#D8E0EA",
    pedestalTop: "#E7D6C1",
    pedestalSide: "#C6AE91",
    glowColor: "rgba(255, 255, 255, 0.88)",
    textColor: "#0F172A",
    isDark: false,
  },
};

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = src;
  });
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function colorDist(r1: number, g1: number, b1: number, c: RGB): number {
  const dr = r1 - c.r;
  const dg = g1 - c.g;
  const db = b1 - c.b;
  const rMean = (r1 + c.r) * 0.5;
  // Perceptual weighted Euclidean RGB distance
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr +
      4 * dg * dg +
      (2 + (255 - rMean) / 256) * db * db
  );
}

function samplePerimeterClusters(
  data: Uint8ClampedArray,
  width: number,
  height: number
): RGB[] {
  const samples: RGB[] = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
  const margin = Math.max(2, Math.floor(Math.min(width, height) * 0.015));

  const pushPixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    if (data[idx + 3] < 128) return;
    samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
  };

  for (let x = 0; x < width; x += step) {
    for (let m = 0; m < margin; m++) {
      pushPixel(x, m);
      pushPixel(x, height - 1 - m);
    }
  }
  for (let y = 0; y < height; y += step) {
    for (let m = 0; m < margin; m++) {
      pushPixel(m, y);
      pushPixel(width - 1 - m, y);
    }
  }

  if (samples.length === 0) {
    return [{ r: 255, g: 255, b: 255 }];
  }

  // Greedy clustering into up to 10 representative background swatches
  const clusters: { r: number; g: number; b: number; count: number }[] = [];
  const clusterRadius = 38;

  for (const s of samples) {
    let matched = false;
    for (const c of clusters) {
      if (colorDist(s.r, s.g, s.b, c) < clusterRadius) {
        c.r = (c.r * c.count + s.r) / (c.count + 1);
        c.g = (c.g * c.count + s.g) / (c.count + 1);
        c.b = (c.b * c.count + s.b) / (c.count + 1);
        c.count++;
        matched = true;
        break;
      }
    }
    if (!matched && clusters.length < 10) {
      clusters.push({ r: s.r, g: s.g, b: s.b, count: 1 });
    }
  }

  return clusters.map(({ r, g, b }) => ({ r, g, b }));
}

function computeSobelEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  const edges = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = rowOffset + x;
      const gx =
        -lum[i - width - 1] +
        lum[i - width + 1] -
        2 * lum[i - 1] +
        2 * lum[i + 1] -
        lum[i + width - 1] +
        lum[i + width + 1];
      const gy =
        -lum[i - width - 1] -
        2 * lum[i - width] -
        lum[i - width + 1] +
        lum[i + width - 1] +
        2 * lum[i + width] +
        lum[i + width + 1];
      edges[i] = Math.sqrt(gx * gx + gy * gy) * 0.25;
    }
  }
  return edges;
}

export async function removeBackgroundAndCompose(
  sourceDataUrl: string,
  productBox: ProductBox,
  backdropPreset: BackdropPreset,
  sensitivity = 44,
  accentHex?: string,
  wearType?: WearType
): Promise<CutoutResult> {
  const img = await loadImageElement(sourceDataUrl);

  // Normalize & tighten crop around the AI-detected product box (avoid expanding into nearby header text)
  const pad = 8;
  const ymin = Math.max(0, (productBox.ymin - pad) / 1000);
  const xmin = Math.max(0, (productBox.xmin - pad) / 1000);
  const ymax = Math.min(1, (productBox.ymax + pad) / 1000);
  const xmax = Math.min(1, (productBox.xmax + pad) / 1000);

  const cropX = Math.floor(xmin * img.naturalWidth);
  const cropY = Math.floor(ymin * img.naturalHeight);
  const cropW = Math.max(32, Math.floor((xmax - xmin) * img.naturalWidth));
  const cropH = Math.max(32, Math.floor((ymax - ymin) * img.naturalHeight));

  // Work at max 820px dimension for sharp output & sub-120ms execution
  const maxDim = 820;
  const scale = Math.min(1, maxDim / Math.max(cropW, cropH));
  const w = Math.max(32, Math.round(cropW * scale));
  const h = Math.max(32, Math.round(cropH * scale));

  const workCanvas = document.createElement("canvas");
  workCanvas.width = w;
  workCanvas.height = h;
  const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const clusters = samplePerimeterClusters(data, w, h);
  const edges = computeSobelEdges(data, w, h);

  // Dilate Sobel edges 3x3 so soft anti-aliased packaging contours form an unbroken flood barrier
  const totalPixels = w * h;
  const dilatedEdges = new Float32Array(totalPixels);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let maxE = edges[i];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ne = edges[(y + dy) * w + (x + dx)];
          if (ne > maxE) maxE = ne;
        }
      }
      dilatedEdges[i] = maxE;
    }
  }

  const distMap = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    if (data[idx + 3] < 32) {
      distMap[i] = 0;
      continue;
    }
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    let minD = Infinity;
    for (let c = 0; c < clusters.length; c++) {
      const d = colorDist(r, g, b, clusters[c]);
      if (d < minD) minD = d;
    }
    distMap[i] = minD;
  }

  // Edge-seeded flood fill using a pre-allocated Int32Array queue
  const bgMask = new Uint8Array(totalPixels); // 1 = background, 0 = foreground
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  // Map sensitivity (10..85) to perceptual color threshold & crisp dilated edge barrier
  const colorThreshold = sensitivity * 0.85;
  const strongEdgeBarrier = Math.max(9, 17 - sensitivity * 0.14);

  const trySeed = (x: number, y: number) => {
    const i = y * w + x;
    if (visited[i]) return;
    visited[i] = 1;
    if (distMap[i] <= colorThreshold && dilatedEdges[i] < strongEdgeBarrier) {
      bgMask[i] = 1;
      queue[tail++] = i;
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = (curr - cx) / w;

    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx < w - 1 ? curr + 1 : -1,
      cy > 0 ? curr - w : -1,
      cy < h - 1 ? curr + w : -1,
    ];

    for (let n = 0; n < 4; n++) {
      const ni = neighbors[n];
      if (ni < 0 || visited[ni]) continue;

      const d = distMap[ni];
      const e = dilatedEdges[ni];

      // Stop strictly at packaging/product contour edges
      if (d <= colorThreshold && e < strongEdgeBarrier) {
        visited[ni] = 1;
        bgMask[ni] = 1;
        queue[tail++] = ni;
      }
    }
  }

  // Only clear enclosed lens pockets specifically for eyewear frames (NEVER eat white labels/surfaces on solid products)
  if (wearType === "eyewear") {
    const pocketVisited = new Uint8Array(totalPixels);
    const pocketPixels: number[] = [];
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const start = y * w + x;
        if (
          pocketVisited[start] ||
          bgMask[start] === 1 ||
          distMap[start] > 14 ||
          dilatedEdges[start] >= 7
        ) {
          continue;
        }
        pocketPixels.length = 0;
        let pHead = 0;
        pocketVisited[start] = 1;
        pocketPixels.push(start);
        let touchesBorder = false;

        while (pHead < pocketPixels.length) {
          const curr = pocketPixels[pHead++];
          const cx = curr % w;
          const cy = (curr - cx) / w;
          if (cx <= 1 || cx >= w - 2 || cy <= 1 || cy >= h - 2) {
            touchesBorder = true;
          }
          const n4 = [
            cx > 0 ? curr - 1 : -1,
            cx < w - 1 ? curr + 1 : -1,
            cy > 0 ? curr - w : -1,
            cy < h - 1 ? curr + w : -1,
          ];
          for (let k = 0; k < 4; k++) {
            const ni = n4[k];
            if (
              ni >= 0 &&
              !pocketVisited[ni] &&
              bgMask[ni] === 0 &&
              distMap[ni] <= 14 &&
              dilatedEdges[ni] < 8
            ) {
              pocketVisited[ni] = 1;
              pocketPixels.push(ni);
            }
          }
        }

        if (!touchesBorder && pocketPixels.length >= 260) {
          for (let k = 0; k < pocketPixels.length; k++) {
            bgMask[pocketPixels[k]] = 1;
          }
        }
      }
    }
  } else {
    // 2D Enclosure Seal for solid products (bottles, labels, apparel, gadgets):
    // Any background-marked pixel enclosed BOTH vertically and horizontally by solid foreground is interior product.
    const rowMinFg = new Int32Array(h).fill(w);
    const rowMaxFg = new Int32Array(h).fill(-1);
    const colMinFg = new Int32Array(w).fill(h);
    const colMaxFg = new Int32Array(w).fill(-1);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (bgMask[i] === 0 && (distMap[i] > colorThreshold * 0.9 || dilatedEdges[i] >= strongEdgeBarrier)) {
          if (x < rowMinFg[y]) rowMinFg[y] = x;
          if (x > rowMaxFg[y]) rowMaxFg[y] = x;
          if (y < colMinFg[x]) colMinFg[x] = y;
          if (y > colMaxFg[x]) colMaxFg[x] = y;
        }
      }
    }

    for (let y = 1; y < h - 1; y++) {
      if (rowMaxFg[y] <= rowMinFg[y]) continue;
      for (let x = rowMinFg[y] + 1; x < rowMaxFg[y]; x++) {
        if (y > colMinFg[x] && y < colMaxFg[x]) {
          bgMask[y * w + x] = 0;
        }
      }
    }
  }

  // Fill tiny enclosed transparent pinholes (<= 60px) inside solid glossy frames/surfaces
  const holeVisited = new Uint8Array(totalPixels);
  const holePixels: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const start = y * w + x;
      if (holeVisited[start] || bgMask[start] === 0) continue;
      holePixels.length = 0;
      let hHead = 0;
      holeVisited[start] = 1;
      holePixels.push(start);
      let touchesBorder = false;

      while (hHead < holePixels.length) {
        const curr = holePixels[hHead++];
        const cx = curr % w;
        const cy = (curr - cx) / w;
        if (cx === 0 || cx === w - 1 || cy === 0 || cy === h - 1) {
          touchesBorder = true;
        }
        if (holePixels.length > 90 && touchesBorder) continue;
        const n4 = [
          cx > 0 ? curr - 1 : -1,
          cx < w - 1 ? curr + 1 : -1,
          cy > 0 ? curr - w : -1,
          cy < h - 1 ? curr + w : -1,
        ];
        for (let k = 0; k < 4; k++) {
          const ni = n4[k];
          if (ni >= 0 && !holeVisited[ni] && bgMask[ni] === 1) {
            holeVisited[ni] = 1;
            holePixels.push(ni);
          }
        }
      }

      if (!touchesBorder && holePixels.length <= 60) {
        for (let k = 0; k < holePixels.length; k++) {
          bgMask[holePixels[k]] = 0;
        }
      }
    }
  }

  // Connected-component island cleanup: remove floating letters, studio titles, badges & stray lines
  const fgVisited = new Uint8Array(totalPixels);
  const components: Array<{
    pixels: number[];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }> = [];
  let largestCompArea = 0;

  for (let i = 0; i < totalPixels; i++) {
    if (bgMask[i] === 1 || fgVisited[i]) continue;
    const compPixels: number[] = [i];
    fgVisited[i] = 1;
    let cHead = 0;
    let cMinX = i % w;
    let cMaxX = cMinX;
    let cMinY = (i - cMinX) / w;
    let cMaxY = cMinY;

    while (cHead < compPixels.length) {
      const curr = compPixels[cHead++];
      const cx = curr % w;
      const cy = (curr - cx) / w;
      if (cx < cMinX) cMinX = cx;
      if (cx > cMaxX) cMaxX = cx;
      if (cy < cMinY) cMinY = cy;
      if (cy > cMaxY) cMaxY = cy;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          if (nx < 0 || nx >= w) continue;
          const ni = ny * w + nx;
          if (bgMask[ni] === 0 && !fgVisited[ni]) {
            fgVisited[ni] = 1;
            compPixels.push(ni);
          }
        }
      }
    }

    if (compPixels.length > largestCompArea) {
      largestCompArea = compPixels.length;
    }
    components.push({
      pixels: compPixels,
      minX: cMinX,
      maxX: cMaxX,
      minY: cMinY,
      maxY: cMaxY,
    });
  }

  if (largestCompArea > 800) {
    const minKeepArea = Math.max(380, largestCompArea * 0.08);
    for (const comp of components) {
      const compH = comp.maxY - comp.minY + 1;
      const isTinyIsland = comp.pixels.length < minKeepArea;
      const isTextBannerStrip =
        compH < h * 0.075 && comp.pixels.length < largestCompArea * 0.25;
      if (isTinyIsland || isTextBannerStrip) {
        for (let k = 0; k < comp.pixels.length; k++) {
          bgMask[comp.pixels[k]] = 1;
        }
      }
    }
  }

  // Compute soft alpha feathering on the 2px boundary
  const alpha = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    alpha[i] = bgMask[i] === 1 ? 0 : 1;
  }

  const feathered = new Float32Array(alpha);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (bgMask[i] === 0) {
        let bgNeighbors = 0;
        if (bgMask[i - 1]) bgNeighbors++;
        if (bgMask[i + 1]) bgNeighbors++;
        if (bgMask[i - w]) bgNeighbors++;
        if (bgMask[i + w]) bgNeighbors++;

        if (bgNeighbors > 0) {
          const ratio = Math.min(
            1,
            Math.max(0.25, (distMap[i] - colorThreshold * 0.25) / (colorThreshold * 0.85))
          );
          feathered[i] = Math.min(1, ratio);
        }
      } else {
        let fgNeighbors = 0;
        if (!bgMask[i - 1]) fgNeighbors++;
        if (!bgMask[i + 1]) fgNeighbors++;
        if (!bgMask[i - w]) fgNeighbors++;
        if (!bgMask[i + w]) fgNeighbors++;
        if (fgNeighbors >= 3) {
          feathered[i] = 0.9;
        }
      }
    }
  }

  // Apply alpha & trim bounding box tightly around remaining foreground
  let minFgX = w;
  let minFgY = h;
  let maxFgX = 0;
  let maxFgY = 0;
  let fgPixelCount = 0;
  let fgLumSum = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const idx = i * 4;
      const a = Math.round(feathered[i] * 255);
      data[idx + 3] = a;
      if (a > 28) {
        fgPixelCount++;
        fgLumSum +=
          0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (x < minFgX) minFgX = x;
        if (y < minFgY) minFgY = y;
        if (x > maxFgX) maxFgX = x;
        if (y > maxFgY) maxFgY = y;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Safeguard: if aggressive removal wiped light/clear products (<3.5% foreground remaining),
  // restore original pixels and trim only pure flat studio corners.
  if (
    maxFgX <= minFgX ||
    maxFgY <= minFgY ||
    fgPixelCount < totalPixels * 0.035
  ) {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, w, h);
    const rawData = ctx.getImageData(0, 0, w, h);
    const rd = rawData.data;
    for (let i = 0; i < totalPixels; i++) {
      if (distMap[i] <= 10 && edges[i] < 8) {
        rd[i * 4 + 3] = 0;
      }
    }
    ctx.putImageData(rawData, 0, 0);
    minFgX = 0;
    minFgY = 0;
    maxFgX = w - 1;
    maxFgY = h - 1;
    fgLumSum = 180;
    fgPixelCount = 1;
  }

  const avgFgLum = fgLumSum / Math.max(1, fgPixelCount);

  // Export tightly cropped transparent PNG cutout
  const trimPad = 12;
  const tx = Math.max(0, minFgX - trimPad);
  const ty = Math.max(0, minFgY - trimPad);
  const tw = Math.min(w - tx, maxFgX - minFgX + trimPad * 2);
  const th = Math.min(h - ty, maxFgY - minFgY + trimPad * 2);

  const cutoutCanvas = document.createElement("canvas");
  cutoutCanvas.width = tw;
  cutoutCanvas.height = th;
  const cutoutCtx = cutoutCanvas.getContext("2d");
  if (!cutoutCtx) throw new Error("Cutout canvas unavailable.");
  cutoutCtx.drawImage(workCanvas, tx, ty, tw, th, 0, 0, tw, th);

  const cutoutDataUrl = cutoutCanvas.toDataURL("image/png");

  // Compose crisp 1080x1350 Studio Showcase Image (4:5 vertical retail photo)
  const studioCanvas = document.createElement("canvas");
  studioCanvas.width = 1080;
  studioCanvas.height = 1350;
  const sCtx = studioCanvas.getContext("2d");
  if (!sCtx) throw new Error("Studio canvas unavailable.");

  drawStudioBackdrop(sCtx, 1080, 1350, BACKDROP_THEMES[backdropPreset], accentHex);

  // Place product cleanly onto the 2.5D studio pedestal deck (horizon ~61%..75.5%)
  const prodMaxW = 760;
  const prodMaxH = 690;
  const fitScale = Math.min(prodMaxW / tw, prodMaxH / th);
  const drawW = tw * fitScale;
  const drawH = th * fitScale;
  const drawX = (1080 - drawW) / 2;
  const pedestalAnchorY = Math.round(1350 * 0.705);
  const drawY = Math.max(170, pedestalAnchorY - drawH);

  // Realistic contact shadow resting directly on top of the studio pedestal
  sCtx.save();
  const shadowGrad = sCtx.createRadialGradient(
    540,
    drawY + drawH + 8,
    18,
    540,
    drawY + drawH + 8,
    drawW * 0.56
  );
  shadowGrad.addColorStop(0, "rgba(15, 23, 42, 0.38)");
  shadowGrad.addColorStop(0.55, "rgba(15, 23, 42, 0.14)");
  shadowGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
  sCtx.fillStyle = shadowGrad;
  sCtx.beginPath();
  sCtx.ellipse(
    540,
    drawY + drawH + 8,
    drawW * 0.54,
    38,
    0,
    0,
    Math.PI * 2
  );
  sCtx.fill();
  sCtx.restore();

  // Draw cutout product with crisp studio shadow (stronger edge shadow for light/clear products)
  const isLightProduct = avgFgLum > 190;
  sCtx.save();
  sCtx.shadowColor = isLightProduct
    ? "rgba(15, 23, 42, 0.34)"
    : "rgba(15, 23, 42, 0.2)";
  sCtx.shadowBlur = isLightProduct ? 26 : 32;
  sCtx.shadowOffsetY = isLightProduct ? 12 : 16;
  sCtx.drawImage(cutoutCanvas, drawX, drawY, drawW, drawH);
  sCtx.restore();

  const studioImageDataUrl = studioCanvas.toDataURL("image/png");

  return {
    cutoutDataUrl,
    studioImageDataUrl,
    cutoutWidth: tw,
    cutoutHeight: th,
  };
}

let cachedGrainCanvas: HTMLCanvasElement | null = null;

function getMicroGrainCanvas(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (cachedGrainCanvas) return cachedGrainCanvas;
  const size = 144;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const gCtx = c.getContext("2d");
  if (!gCtx) return null;
  const img = gCtx.createImageData(size, size);
  const d = img.data;
  let seed = 1337;
  for (let i = 0; i < d.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = 112 + (seed % 32);
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 18;
  }
  gCtx.putImageData(img, 0, 0);
  cachedGrainCanvas = c;
  return c;
}

function hexToRgba(hex: string | undefined, alpha: number, fallback: string): string {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return fallback;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function drawStudioBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: BackdropTheme,
  accentHex?: string
) {
  const horizonY = Math.round(height * 0.61);
  const podiumFrontY = Math.round(height * 0.755);
  const plinthBottomY = Math.round(height * 0.805);

  // 1. Studio Back Wall
  const wallGrad = ctx.createLinearGradient(0, 0, width * 0.35, horizonY);
  wallGrad.addColorStop(0, theme.topColor);
  wallGrad.addColorStop(1, theme.midColor);
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, width, horizonY);

  // 2. Theme-Specific Architectural Lighting, Gobos & Materials
  if (theme.id === "travertine") {
    // Golden-hour slanted window sunlight beams + warm Venetian gobo shadows
    ctx.save();
    for (let i = -1; i < 4; i++) {
      const startX = width * (0.08 + i * 0.24);
      const beam = ctx.createLinearGradient(startX, 0, startX + width * 0.35, horizonY);
      beam.addColorStop(0, "rgba(255, 245, 220, 0.32)");
      beam.addColorStop(1, "rgba(255, 245, 220, 0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX + width * 0.14, 0);
      ctx.lineTo(startX + width * 0.44, horizonY);
      ctx.lineTo(startX + width * 0.28, horizonY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(110, 82, 54, 0.055)";
    ctx.beginPath();
    ctx.moveTo(0, height * 0.14);
    ctx.lineTo(width * 0.36, 0);
    ctx.lineTo(width * 0.46, 0);
    ctx.lineTo(0, height * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (theme.id === "botanical") {
    // Soft sunlit spa window glow + dappled botanical leaf shadow silhouettes
    ctx.save();
    const sunShaft = ctx.createLinearGradient(0, 0, width * 0.85, horizonY);
    sunShaft.addColorStop(0, "rgba(255, 253, 240, 0.42)");
    sunShaft.addColorStop(0.65, "rgba(255, 253, 240, 0.12)");
    sunShaft.addColorStop(1, "rgba(255, 253, 240, 0)");
    ctx.fillStyle = sunShaft;
    ctx.fillRect(0, 0, width, horizonY);

    ctx.fillStyle = "rgba(54, 78, 58, 0.065)";
    const leaves = [
      { cx: width * 0.14, cy: height * 0.16, rx: width * 0.19, ry: height * 0.036, rot: -0.45 },
      { cx: width * 0.22, cy: height * 0.26, rx: width * 0.21, ry: height * 0.038, rot: -0.22 },
      { cx: width * 0.12, cy: height * 0.37, rx: width * 0.17, ry: height * 0.032, rot: -0.08 },
      { cx: width * 0.86, cy: height * 0.18, rx: width * 0.18, ry: height * 0.034, rot: 0.48 },
      { cx: width * 0.82, cy: height * 0.30, rx: width * 0.16, ry: height * 0.03, rot: 0.25 },
    ];
    for (const leaf of leaves) {
      ctx.beginPath();
      ctx.ellipse(leaf.cx, leaf.cy, leaf.rx, leaf.ry, leaf.rot, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (theme.id === "obsidian") {
    // Vertical commercial softbox strip-lights + subtle product-color rim aura
    ctx.save();
    const leftStrip = ctx.createLinearGradient(0, 0, width * 0.22, 0);
    leftStrip.addColorStop(0, "rgba(226, 232, 240, 0.12)");
    leftStrip.addColorStop(0.5, "rgba(226, 232, 240, 0.04)");
    leftStrip.addColorStop(1, "rgba(226, 232, 240, 0)");
    ctx.fillStyle = leftStrip;
    ctx.fillRect(width * 0.04, height * 0.08, width * 0.18, horizonY - height * 0.12);

    const rightStrip = ctx.createLinearGradient(width, 0, width * 0.78, 0);
    rightStrip.addColorStop(0, "rgba(226, 232, 240, 0.12)");
    rightStrip.addColorStop(0.5, "rgba(226, 232, 240, 0.04)");
    rightStrip.addColorStop(1, "rgba(226, 232, 240, 0)");
    ctx.fillStyle = rightStrip;
    ctx.fillRect(width * 0.78, height * 0.08, width * 0.18, horizonY - height * 0.12);

    const rimAura = ctx.createRadialGradient(
      width * 0.5,
      height * 0.44,
      width * 0.03,
      width * 0.5,
      height * 0.44,
      width * 0.52
    );
    rimAura.addColorStop(0, hexToRgba(accentHex, 0.24, "rgba(148, 163, 184, 0.22)"));
    rimAura.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = rimAura;
    ctx.fillRect(0, 0, width, horizonY);
    ctx.restore();
  } else if (theme.id === "street_concrete") {
    // Brutalist concrete panel seams + dramatic skylight shaft
    ctx.save();
    ctx.strokeStyle = "rgba(15, 23, 42, 0.07)";
    ctx.lineWidth = Math.max(1.5, width * 0.002);
    ctx.beginPath();
    ctx.moveTo(width * 0.33, 0);
    ctx.lineTo(width * 0.33, horizonY);
    ctx.moveTo(width * 0.67, 0);
    ctx.lineTo(width * 0.67, horizonY);
    ctx.moveTo(0, height * 0.3);
    ctx.lineTo(width, height * 0.3);
    ctx.stroke();

    const skylight = ctx.createLinearGradient(width * 0.15, 0, width * 0.75, horizonY);
    skylight.addColorStop(0, "rgba(255, 255, 255, 0.28)");
    skylight.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = skylight;
    ctx.beginPath();
    ctx.moveTo(width * 0.18, 0);
    ctx.lineTo(width * 0.58, 0);
    ctx.lineTo(width * 0.85, horizonY);
    ctx.lineTo(width * 0.35, horizonY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (theme.id === "blush") {
    // Editorial sculpted arched niche behind product with warm backlit glow
    ctx.save();
    const archW = width * 0.66;
    const archX = (width - archW) / 2;
    const archTopY = height * 0.11;
    const archGrad = ctx.createLinearGradient(0, archTopY, 0, horizonY);
    archGrad.addColorStop(0, "rgba(255, 248, 246, 0.75)");
    archGrad.addColorStop(1, "rgba(224, 185, 181, 0.35)");
    ctx.fillStyle = archGrad;
    ctx.beginPath();
    ctx.moveTo(archX, horizonY);
    ctx.lineTo(archX, archTopY + archW * 0.5);
    ctx.arc(width / 2, archTopY + archW * 0.5, archW * 0.5, Math.PI, 0, false);
    ctx.lineTo(archX + archW, horizonY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(180, 128, 124, 0.18)";
    ctx.lineWidth = Math.max(2, width * 0.003);
    ctx.stroke();
    ctx.restore();
  } else {
    // Pearl: Bright daylight arch window bounce + subtle gallery trim
    ctx.save();
    const dayBounce = ctx.createLinearGradient(0, 0, width * 0.8, horizonY);
    dayBounce.addColorStop(0, "rgba(255, 255, 255, 0.75)");
    dayBounce.addColorStop(1, "rgba(226, 232, 240, 0)");
    ctx.fillStyle = dayBounce;
    ctx.fillRect(0, 0, width, horizonY);
    ctx.restore();
  }

  // 3. Lower Studio Floor Below Pedestal
  const floorGrad = ctx.createLinearGradient(0, plinthBottomY, 0, height);
  floorGrad.addColorStop(0, theme.floorColor);
  floorGrad.addColorStop(1, theme.midColor);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, horizonY, width, height - horizonY);

  // Subtle horizon wall-floor ambient shadow
  const wallShadow = ctx.createLinearGradient(0, horizonY - 12, 0, horizonY + 18);
  wallShadow.addColorStop(0, "rgba(0,0,0,0)");
  wallShadow.addColorStop(0.5, theme.isDark ? "rgba(0,0,0,0.45)" : "rgba(15,23,42,0.09)");
  wallShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = wallShadow;
  ctx.fillRect(0, horizonY - 12, width, 30);

  // 4. Realistic 2.5D Studio Display Pedestal / Countertop
  const pedTopGrad = ctx.createLinearGradient(0, horizonY, 0, podiumFrontY);
  pedTopGrad.addColorStop(0, theme.pedestalSide);
  pedTopGrad.addColorStop(0.35, theme.pedestalTop);
  pedTopGrad.addColorStop(1, theme.pedestalTop);
  ctx.fillStyle = pedTopGrad;
  ctx.fillRect(0, horizonY, width, podiumFrontY - horizonY);

  // Subtle marble / travertine / wood grain streaks on pedestal deck
  if (theme.id === "botanical" || theme.id === "travertine") {
    ctx.save();
    ctx.strokeStyle =
      theme.id === "botanical"
        ? "rgba(120, 134, 124, 0.14)"
        : "rgba(150, 125, 96, 0.13)";
    ctx.lineWidth = Math.max(1.2, width * 0.002);
    ctx.beginPath();
    ctx.moveTo(width * 0.08, horizonY + (podiumFrontY - horizonY) * 0.38);
    ctx.bezierCurveTo(
      width * 0.35,
      horizonY + (podiumFrontY - horizonY) * 0.25,
      width * 0.62,
      horizonY + (podiumFrontY - horizonY) * 0.68,
      width * 0.92,
      horizonY + (podiumFrontY - horizonY) * 0.52
    );
    ctx.stroke();
    ctx.restore();
  }

  // Front vertical bevel / plinth face
  const plinthGrad = ctx.createLinearGradient(0, podiumFrontY, 0, plinthBottomY);
  plinthGrad.addColorStop(0, theme.pedestalSide);
  plinthGrad.addColorStop(1, theme.floorColor);
  ctx.fillStyle = plinthGrad;
  ctx.fillRect(0, podiumFrontY, width, plinthBottomY - podiumFrontY);

  // Crisp bevel catchlight on pedestal front lip
  ctx.fillStyle = theme.isDark
    ? "rgba(255, 255, 255, 0.14)"
    : "rgba(255, 255, 255, 0.65)";
  ctx.fillRect(0, podiumFrontY, width, Math.max(2, Math.round(height * 0.002)));

  // Soft cast shadow under pedestal edge onto floor
  const underShadow = ctx.createLinearGradient(0, plinthBottomY, 0, plinthBottomY + height * 0.045);
  underShadow.addColorStop(
    0,
    theme.isDark ? "rgba(0, 0, 0, 0.55)" : "rgba(15, 23, 42, 0.14)"
  );
  underShadow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = underShadow;
  ctx.fillRect(0, plinthBottomY, width, height * 0.045);

  // 5. Studio Key-Light Spotlight Behind Product
  const glow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.44,
    width * 0.04,
    width * 0.5,
    height * 0.44,
    width * 0.65
  );
  glow.addColorStop(0, theme.glowColor);
  glow.addColorStop(
    0.55,
    theme.isDark
      ? hexToRgba(accentHex, 0.14, "rgba(255,255,255,0.04)")
      : "rgba(255,255,255,0.08)"
  );
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 6. Subtle natural surface micro-grain so gradients look photographic
  const grainCanvas = getMicroGrainCanvas();
  if (grainCanvas) {
    const pattern = ctx.createPattern(grainCanvas, "repeat");
    if (pattern) {
      ctx.save();
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }
}

export const DEFAULT_UGC_TRYON_IMAGE =
  "/src/assets/images/ugc_creator_tryon_1794655293391.jpg";
export const DEFAULT_UGC_POINTING_IMAGE =
  "/src/assets/images/ugc_creator_pointing_clean_1794655311788.jpg";

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  targetW: number,
  targetH: number
) {
  const scale = Math.max(
    targetW / img.naturalWidth,
    targetH / img.naturalHeight
  );
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const offsetX = (targetW - drawW) / 2;
  const offsetY = (targetH - drawH) * 0.25;
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

function extractDominantGarmentColor(
  prodCanvas: HTMLCanvasElement
): { r: number; g: number; b: number } {
  const ctx = prodCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { r: 30, g: 64, b: 175 };
  const w = prodCanvas.width;
  const h = prodCanvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  // Sample lower-torso / shoulder regions where base fabric is usually visible
  const samplesR: number[] = [];
  const samplesG: number[] = [];
  const samplesB: number[] = [];

  for (let y = Math.round(h * 0.62); y <= Math.round(h * 0.88); y += 3) {
    for (let x = Math.round(w * 0.30); x <= Math.round(w * 0.70); x += 3) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] > 200) {
        samplesR.push(data[idx]);
        samplesG.push(data[idx + 1]);
        samplesB.push(data[idx + 2]);
      }
    }
  }

  if (samplesR.length === 0) {
    for (let y = Math.round(h * 0.25); y <= Math.round(h * 0.75); y += 4) {
      for (let x = Math.round(w * 0.25); x <= Math.round(w * 0.75); x += 4) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] > 200) {
          samplesR.push(data[idx]);
          samplesG.push(data[idx + 1]);
          samplesB.push(data[idx + 2]);
        }
      }
    }
  }

  if (samplesR.length === 0) return { r: 35, g: 35, b: 40 };

  samplesR.sort((a, b) => a - b);
  samplesG.sort((a, b) => a - b);
  samplesB.sort((a, b) => a - b);
  const mid = Math.floor(samplesR.length / 2);

  return {
    r: samplesR[mid],
    g: samplesG[mid],
    b: samplesB[mid],
  };
}

function compositeApparelOntoCreator(
  baseCanvas: HTMLCanvasElement,
  productImg: HTMLImageElement
): string {
  const w = baseCanvas.width;
  const h = baseCanvas.height;
  const ctx = baseCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return baseCanvas.toDataURL("image/jpeg", 0.92);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const edges = computeSobelEdges(data, w, h);

  // Locate whitest low-saturation seed pixel in chest zone
  let seedX = Math.round(w * 0.49);
  let seedY = Math.round(h * 0.64);
  let bestScore = -1;

  for (let y = Math.round(h * 0.55); y <= Math.round(h * 0.70); y += 4) {
    for (let x = Math.round(w * 0.38); x <= Math.round(w * 0.62); x += 4) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const chroma = maxC - minC;
      const score = lum - chroma * 2.2 - Math.max(0, r - b) * 2.5;
      if (score > bestScore && lum > 140) {
        bestScore = score;
        seedX = x;
        seedY = y;
      }
    }
  }

  // Anatomical torso bounds to prevent background/curtain spillover
  const minBoundX = Math.round(w * 0.17);
  const maxBoundX = Math.round(w * 0.85);
  const minBoundY = Math.round(h * 0.46);
  const maxBoundY = Math.round(h * 0.96);

  const total = w * h;
  const shirtMask = new Uint8Array(total);
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  // Accept shaded off-white shirt creases (lum >= 88) while rejecting warm skin & dark hair/jeans
  const isWhiteFabric = (pixelIdx: number, strict = false) => {
    const idx = pixelIdx * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const chroma = maxC - minC;
    const warmth = r - b;
    const redExcess = r - g;

    // Exclude skin tones (warm peach/tan) and green plants
    if (warmth > 42 || (redExcess > 15 && warmth > 24)) return false;
    if (g > r + 8 && g > b + 8) return false;
    if (strict) {
      return lum > 110 && chroma < 46;
    }
    return lum > 88 && chroma < 54;
  };

  const seedIdx = seedY * w + seedX;
  if (isWhiteFabric(seedIdx, true)) {
    visited[seedIdx] = 1;
    shirtMask[seedIdx] = 1;
    queue[tail++] = seedIdx;
  }

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = (curr - cx) / w;

    // Tighter horizontal guard near upper shoulder/curtain boundary
    const rowMinX = cy < h * 0.57 ? Math.round(w * 0.23) : minBoundX;
    const rowMaxX = cy < h * 0.57 ? Math.round(w * 0.80) : maxBoundX;

    const neighbors = [
      cx > rowMinX ? curr - 1 : -1,
      cx < rowMaxX ? curr + 1 : -1,
      cy > minBoundY ? curr - w : -1,
      cy < maxBoundY ? curr + w : -1,
    ];

    for (let n = 0; n < 4; n++) {
      const ni = neighbors[n];
      if (ni < 0 || visited[ni]) continue;
      // Stop cleanly at garment boundary seam (prevents bleeding into bright window curtains)
      if (edges[ni] > 16) continue;
      if (isWhiteFabric(ni, false)) {
        visited[ni] = 1;
        shirtMask[ni] = 1;
        queue[tail++] = ni;
      }
    }
  }

  // Morphological close + interior horizontal gap fill to eliminate white wrinkle gaps
  const closedMask = new Uint8Array(shirtMask);
  for (let pass = 0; pass < 2; pass++) {
    const src = pass === 0 ? shirtMask : closedMask;
    const dst = new Uint8Array(src);
    for (let y = minBoundY + 1; y < maxBoundY - 1; y++) {
      for (let x = minBoundX + 1; x < maxBoundX - 1; x++) {
        const i = y * w + x;
        if (src[i] === 0 && isWhiteFabric(i, false)) {
          const nCount =
            src[i - 1] +
            src[i + 1] +
            src[i - w] +
            src[i + w] +
            src[i - w - 1] +
            src[i - w + 1] +
            src[i + w - 1] +
            src[i + w + 1];
          if (nCount >= 4) dst[i] = 1;
        }
      }
    }
    closedMask.set(dst);
  }

  // Find bounding box of detected shirt torso & sleeves
  let sMinX = w;
  let sMinY = h;
  let sMaxX = 0;
  let sMaxY = 0;
  let count = 0;

  for (let y = minBoundY; y <= maxBoundY; y++) {
    for (let x = minBoundX; x <= maxBoundX; x++) {
      const i = y * w + x;
      if (closedMask[i]) {
        count++;
        if (x < sMinX) sMinX = x;
        if (y < sMinY) sMinY = y;
        if (x > sMaxX) sMaxX = x;
        if (y > sMaxY) sMaxY = y;
      }
    }
  }

  if (count < 2500) {
    const boxW = w * 0.44;
    const scale = boxW / productImg.naturalWidth;
    const boxH = productImg.naturalHeight * scale;
    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.35)";
    ctx.shadowBlur = 24;
    ctx.drawImage(productImg, w * 0.52, h * 0.55, boxW, boxH);
    ctx.restore();
    return baseCanvas.toDataURL("image/jpeg", 0.92);
  }

  // Find core torso width (ignoring extended sleeves) using the lower chest row (y ~ 68%)
  const coreRowY = Math.round(sMinY + (sMaxY - sMinY) * 0.42);
  let coreMinX = sMaxX;
  let coreMaxX = sMinX;
  for (let x = sMinX; x <= sMaxX; x++) {
    if (closedMask[coreRowY * w + x]) {
      if (x < coreMinX) coreMinX = x;
      if (x > coreMaxX) coreMaxX = x;
    }
  }
  if (coreMaxX - coreMinX < 80) {
    coreMinX = Math.round(sMinX + (sMaxX - sMinX) * 0.16);
    coreMaxX = Math.round(sMaxX - (sMaxX - sMinX) * 0.16);
  }

  // Smooth 5x5 alpha feathering along shirt boundary
  const alphaMask = new Float32Array(total);
  for (let y = sMinY; y <= sMaxY; y++) {
    for (let x = sMinX; x <= sMaxX; x++) {
      const i = y * w + x;
      if (!closedMask[i]) continue;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = Math.min(h - 1, Math.max(0, y + dy));
          const nx = Math.min(w - 1, Math.max(0, x + dx));
          sum += closedMask[ny * w + nx];
        }
      }
      alphaMask[i] = sum / 9;
    }
  }

  // Prepare cropped garment torso-core canvas (excluding splayed flat-lay sleeves 0..22% & 78..100%)
  const prodFullCanvas = document.createElement("canvas");
  prodFullCanvas.width = productImg.naturalWidth;
  prodFullCanvas.height = productImg.naturalHeight;
  const pfCtx = prodFullCanvas.getContext("2d");
  if (!pfCtx) return baseCanvas.toDataURL("image/jpeg", 0.92);
  pfCtx.drawImage(productImg, 0, 0);

  const fabricColor = extractDominantGarmentColor(prodFullCanvas);

  // Map garment torso core (middle 56% width) onto creator's core torso width so chest graphic & collar align cleanly
  const srcTorsoX = Math.round(productImg.naturalWidth * 0.22);
  const srcTorsoY = Math.round(productImg.naturalHeight * 0.04);
  const srcTorsoW = Math.round(productImg.naturalWidth * 0.56);
  const srcTorsoH = Math.round(productImg.naturalHeight * 0.92);

  const torsoW = Math.max(60, coreMaxX - coreMinX);
  const torsoH = Math.max(80, sMaxY - sMinY);
  const fitScale = Math.max(torsoW / srcTorsoW, (torsoH * 1.02) / srcTorsoH);
  const drawW = srcTorsoW * fitScale;
  const drawH = srcTorsoH * fitScale;
  const drawX = (coreMinX + coreMaxX) / 2 - drawW / 2;
  const drawY = sMinY - drawH * 0.02;

  const shirtCanvas = document.createElement("canvas");
  shirtCanvas.width = w;
  shirtCanvas.height = h;
  const sCtx = shirtCanvas.getContext("2d", { willReadFrequently: true });
  if (!sCtx) return baseCanvas.toDataURL("image/jpeg", 0.92);

  // Fill entire shirt mask area with base fabric color first so sleeves match 100% seamlessly
  sCtx.fillStyle = `rgb(${fabricColor.r}, ${fabricColor.g}, ${fabricColor.b})`;
  sCtx.fillRect(sMinX, sMinY, sMaxX - sMinX + 1, sMaxY - sMinY + 1);

  // Draw torso-core graphic/texture centered on the chest
  sCtx.drawImage(
    prodFullCanvas,
    srcTorsoX,
    srcTorsoY,
    srcTorsoW,
    srcTorsoH,
    drawX,
    drawY,
    drawW,
    drawH
  );
  const shirtPixels = sCtx.getImageData(0, 0, w, h).data;

  // Blend garment onto creator with real fabric fold luminance shading
  for (let y = sMinY; y <= sMaxY; y++) {
    for (let x = sMinX; x <= sMaxX; x++) {
      const i = y * w + x;
      const maskA = alphaMask[i];
      if (maskA <= 0.02) continue;

      const idx = i * 4;
      const origR = data[idx];
      const origG = data[idx + 1];
      const origB = data[idx + 2];
      const origLum = 0.299 * origR + 0.587 * origG + 0.114 * origB;
      const shade = Math.min(1.06, Math.max(0.55, origLum / 215));

      const useGraphic = shirtPixels[idx + 3] > 180;
      const srcR = useGraphic ? shirtPixels[idx] : fabricColor.r;
      const srcG = useGraphic ? shirtPixels[idx + 1] : fabricColor.g;
      const srcB = useGraphic ? shirtPixels[idx + 2] : fabricColor.b;

      const targetR = srcR * shade;
      const targetG = srcG * shade;
      const targetB = srcB * shade;

      data[idx] = Math.round(origR * (1 - maskA) + targetR * maskA);
      data[idx + 1] = Math.round(origG * (1 - maskA) + targetG * maskA);
      data[idx + 2] = Math.round(origB * (1 - maskA) + targetB * maskA);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return baseCanvas.toDataURL("image/jpeg", 0.92);
}

function compositeHandheldOntoCreator(
  baseCanvas: HTMLCanvasElement,
  productImg: HTMLImageElement,
  isPointingFrame: boolean
): string {
  const w = baseCanvas.width;
  const h = baseCanvas.height;
  const ctx = baseCanvas.getContext("2d");
  if (!ctx) return baseCanvas.toDataURL("image/jpeg", 0.92);

  const maxProdW = isPointingFrame ? w * 0.42 : w * 0.48;
  const maxProdH = isPointingFrame ? h * 0.28 : h * 0.34;
  const scale = Math.min(
    maxProdW / productImg.naturalWidth,
    maxProdH / productImg.naturalHeight
  );
  const drawW = productImg.naturalWidth * scale;
  const drawH = productImg.naturalHeight * scale;

  const drawX = isPointingFrame ? (w - drawW) / 2 : w - drawW - 36;
  const drawY = isPointingFrame ? h * 0.67 : h * 0.54;

  // Balanced studio spotlight halo behind handheld product
  ctx.save();
  const glow = ctx.createRadialGradient(
    drawX + drawW / 2,
    drawY + drawH / 2,
    12,
    drawX + drawW / 2,
    drawY + drawH / 2,
    Math.max(drawW, drawH) * 0.72
  );
  glow.addColorStop(0, "rgba(255, 255, 255, 0.42)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(drawX - 60, drawY - 60, drawW + 120, drawH + 120);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.42)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  ctx.drawImage(productImg, drawX, drawY, drawW, drawH);
  ctx.restore();

  return baseCanvas.toDataURL("image/jpeg", 0.92);
}

export async function composeUgcCreatorAssets(
  cutoutDataUrl: string,
  wearType: WearType,
  customCreatorDataUrl?: string | null
): Promise<{ ugcTryOnDataUrl: string; ugcPointingDataUrl: string }> {
  const [productImg, tryOnImg, pointingImg] = await Promise.all([
    loadImageElement(cutoutDataUrl),
    loadImageElement(customCreatorDataUrl || DEFAULT_UGC_TRYON_IMAGE),
    loadImageElement(customCreatorDataUrl || DEFAULT_UGC_POINTING_IMAGE),
  ]);

  const w = 720;
  const h = 1280;

  const tryOnCanvas = document.createElement("canvas");
  tryOnCanvas.width = w;
  tryOnCanvas.height = h;
  const tCtx = tryOnCanvas.getContext("2d");
  if (!tCtx) throw new Error("UGC try-on canvas unavailable.");
  drawImageCover(tCtx, tryOnImg, w, h);

  const pointingCanvas = document.createElement("canvas");
  pointingCanvas.width = w;
  pointingCanvas.height = h;
  const pCtx = pointingCanvas.getContext("2d");
  if (!pCtx) throw new Error("UGC pointing canvas unavailable.");
  drawImageCover(pCtx, pointingImg, w, h);

  if (wearType === "apparel_top") {
    return {
      ugcTryOnDataUrl: compositeApparelOntoCreator(tryOnCanvas, productImg),
      ugcPointingDataUrl: compositeApparelOntoCreator(
        pointingCanvas,
        productImg
      ),
    };
  }

  return {
    ugcTryOnDataUrl: compositeHandheldOntoCreator(tryOnCanvas, productImg, false),
    ugcPointingDataUrl: compositeHandheldOntoCreator(
      pointingCanvas,
      productImg,
      true
    ),
  };
}
