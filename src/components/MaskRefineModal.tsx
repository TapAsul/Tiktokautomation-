import React, { useEffect, useRef, useState } from "react";
import { Check, Eraser, Paintbrush, RotateCcw, Undo2, X } from "lucide-react";
import type { ProductBox } from "../types/studio";
import { loadImageElement } from "../utils/backgroundRemover";

interface MaskRefineModalProps {
  isOpen: boolean;
  sourceDataUrl: string;
  cutoutDataUrl: string;
  productBox: ProductBox;
  onClose: () => void;
  onApplyCutout: (newCutoutDataUrl: string) => void;
}

export const MaskRefineModal: React.FC<MaskRefineModalProps> = ({
  isOpen,
  sourceDataUrl,
  cutoutDataUrl,
  productBox,
  onClose,
  onApplyCutout,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const origCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const [tool, setTool] = useState<"erase" | "restore">("erase");
  const [brushSize, setBrushSize] = useState(22);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setReady(false);

    const init = async () => {
      const [srcImg, cutImg] = await Promise.all([
        loadImageElement(sourceDataUrl),
        loadImageElement(cutoutDataUrl),
      ]);
      if (!active) return;

      // Match the crop region used during auto cutout extraction
      const pad = 8;
      const ymin = Math.max(0, (productBox.ymin - pad) / 1000);
      const xmin = Math.max(0, (productBox.xmin - pad) / 1000);
      const ymax = Math.min(1, (productBox.ymax + pad) / 1000);
      const xmax = Math.min(1, (productBox.xmax + pad) / 1000);

      const cropX = Math.floor(xmin * srcImg.naturalWidth);
      const cropY = Math.floor(ymin * srcImg.naturalHeight);
      const cropW = Math.max(32, Math.floor((xmax - xmin) * srcImg.naturalWidth));
      const cropH = Math.max(32, Math.floor((ymax - ymin) * srcImg.naturalHeight));

      const w = 640;
      const h = Math.max(320, Math.round((cropH / cropW) * w));

      const origCanvas = document.createElement("canvas");
      origCanvas.width = w;
      origCanvas.height = h;
      const oCtx = origCanvas.getContext("2d");
      if (oCtx) {
        oCtx.drawImage(srcImg, cropX, cropY, cropW, cropH, 0, 0, w, h);
      }
      origCanvasRef.current = origCanvas;

      const displayCanvas = canvasRef.current;
      if (!displayCanvas) return;
      displayCanvas.width = w;
      displayCanvas.height = h;

      const workCanvas = document.createElement("canvas");
      workCanvas.width = w;
      workCanvas.height = h;
      const wCtx = workCanvas.getContext("2d", { willReadFrequently: true });
      if (!wCtx) return;

      // Fit current cutout cleanly inside the cropped frame
      const scale = Math.min(
        (w * 0.92) / cutImg.naturalWidth,
        (h * 0.92) / cutImg.naturalHeight
      );
      const dw = cutImg.naturalWidth * scale;
      const dh = cutImg.naturalHeight * scale;
      wCtx.drawImage(cutImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
      maskCanvasRef.current = workCanvas;

      historyRef.current = [wCtx.getImageData(0, 0, w, h)];
      renderPreview();
      setReady(true);
    };

    void init();
    return () => {
      active = false;
    };
  }, [cutoutDataUrl, isOpen, productBox, sourceDataUrl]);

  const renderPreview = () => {
    const display = canvasRef.current;
    const orig = origCanvasRef.current;
    const work = maskCanvasRef.current;
    if (!display || !orig || !work) return;
    const dCtx = display.getContext("2d");
    if (!dCtx) return;
    dCtx.clearRect(0, 0, display.width, display.height);
    // Faint ghost of original photo behind cutout so restore brush is intuitive
    dCtx.save();
    dCtx.globalAlpha = 0.22;
    dCtx.drawImage(orig, 0, 0);
    dCtx.restore();
    dCtx.drawImage(work, 0, 0);
  };

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const strokeAt = (x1: number, y1: number, x2: number, y2: number) => {
    const work = maskCanvasRef.current;
    const orig = origCanvasRef.current;
    if (!work || !orig) return;
    const wCtx = work.getContext("2d");
    if (!wCtx) return;

    wCtx.save();
    if (tool === "erase") {
      wCtx.globalCompositeOperation = "destination-out";
      wCtx.strokeStyle = "rgba(0,0,0,1)";
      wCtx.lineWidth = brushSize;
      wCtx.lineCap = "round";
      wCtx.lineJoin = "round";
      wCtx.beginPath();
      wCtx.moveTo(x1, y1);
      wCtx.lineTo(x2, y2);
      wCtx.stroke();
    } else {
      // Restore original pixels cleanly using circular clip along brush stroke
      const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3));
      for (let i = 0; i <= steps; i++) {
        const px = x1 + ((x2 - x1) * i) / steps;
        const py = y1 + ((y2 - y1) * i) / steps;
        wCtx.save();
        wCtx.beginPath();
        wCtx.arc(px, py, brushSize / 2, 0, Math.PI * 2);
        wCtx.clip();
        wCtx.drawImage(orig, 0, 0);
        wCtx.restore();
      }
    }
    wCtx.restore();
    renderPreview();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    const work = maskCanvasRef.current;
    const wCtx = work?.getContext("2d", { willReadFrequently: true });
    if (work && wCtx) {
      historyRef.current = [
        ...historyRef.current.slice(-15),
        wCtx.getImageData(0, 0, work.width, work.height),
      ];
    }
    drawingRef.current = true;
    const pos = getCoords(e);
    lastPosRef.current = pos;
    strokeAt(pos.x, pos.y, pos.x, pos.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPosRef.current) return;
    const pos = getCoords(e);
    strokeAt(lastPosRef.current.x, lastPosRef.current.y, pos.x, pos.y);
    lastPosRef.current = pos;
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
    lastPosRef.current = null;
  };

  const handleUndo = () => {
    const work = maskCanvasRef.current;
    const wCtx = work?.getContext("2d");
    if (!work || !wCtx || historyRef.current.length === 0) return;
    const prev = historyRef.current.pop();
    if (prev) {
      wCtx.putImageData(prev, 0, 0);
      renderPreview();
    }
  };

  const handleReset = () => {
    const work = maskCanvasRef.current;
    const wCtx = work?.getContext("2d");
    if (!work || !wCtx || historyRef.current.length === 0) return;
    wCtx.putImageData(historyRef.current[0], 0, 0);
    renderPreview();
  };

  const handleApply = () => {
    const work = maskCanvasRef.current;
    if (!work) return;
    const wCtx = work.getContext("2d", { willReadFrequently: true });
    if (!wCtx) return;

    // Trim tightly around remaining opaque pixels
    const { width, height } = work;
    const data = wCtx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 20) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX <= minX || maxY <= minY) {
      onApplyCutout(work.toDataURL("image/png"));
      onClose();
      return;
    }

    const pad = 10;
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(width - sx, maxX - minX + pad * 2);
    const sh = Math.min(height - sy, maxY - minY + pad * 2);
    const trimmed = document.createElement("canvas");
    trimmed.width = sw;
    trimmed.height = sh;
    trimmed.getContext("2d")?.drawImage(work, sx, sy, sw, sh, 0, 0, sw, sh);
    onApplyCutout(trimmed.toDataURL("image/png"));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-display text-base font-bold text-white">
              Manual Segmentation Correction
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Paint over stray background artifacts to erase, or restore missing
              original product pixels cleanly.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTool("erase")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                tool === "erase"
                  ? "bg-rose-600 border-rose-500 text-white"
                  : "bg-[#0B0F17] border-slate-700 text-slate-300"
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              Erase Background
            </button>
            <button
              type="button"
              onClick={() => setTool("restore")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                tool === "restore"
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "bg-[#0B0F17] border-slate-700 text-slate-300"
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              Restore Product
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 font-mono tabular-nums">
              Brush {brushSize}px
            </label>
            <input
              type="range"
              min={6}
              max={64}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-28 accent-rose-500 cursor-pointer"
            />
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-[#0B0F17] text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-[#0B0F17] text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-checkerboard overflow-hidden flex items-center justify-center max-h-[58vh]">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="max-h-[56vh] w-auto object-contain touch-none cursor-crosshair"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Apply Cutout Changes
          </button>
        </div>
      </div>
    </div>
  );
};
