import React, { useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  Clapperboard,
  ClipboardPaste,
  Download,
  Eye,
  EyeOff,
  FileText,
  ImagePlus,
  Layers,
  Loader2,
  Paintbrush,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type {
  AspectRatioOption,
  ContentLanguage,
  CutoutResult,
  ImageConceptAsset,
  ImageGenerationMode,
  ImageHistoryEntry,
  PipelineStep,
  ProductAnalysis,
  StrategistTone,
  VisualStyle,
} from "../types/studio";

export interface SampleProduct {
  id: string;
  label: string;
  category: string;
  imagePath: string;
}

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    id: "tee",
    label: "Graphic Cotton Tee",
    category: "Apparel",
    imagePath: "/src/assets/images/sample_graphic_tee_1794655311660.jpg",
  },
  {
    id: "serum",
    label: "Vitamin C Serum",
    category: "Skincare",
    imagePath: "/src/assets/images/sample_vitamin_serum_1794587892747.jpg",
  },
  {
    id: "earbuds",
    label: "ANC Wireless Earbuds",
    category: "Tech Audio",
    imagePath: "/src/assets/images/sample_wireless_earbuds_1794587892956.jpg",
  },
  {
    id: "tumbler",
    label: "Sage Travel Tumbler",
    category: "Lifestyle",
    imagePath: "/src/assets/images/sample_ceramic_tumbler_1794587893428.jpg",
  },
];

const VISUAL_STYLE_OPTIONS: VisualStyle[] = [
  "Luxury",
  "Minimalist",
  "Cinematic",
  "Futuristic",
  "Editorial",
  "Organic",
  "Vibrant",
  "Warm Studio",
];

const ASPECT_RATIO_OPTIONS: Array<{
  id: AspectRatioOption;
  label: string;
  hint: string;
}> = [
  { id: "9:16", label: "9:16", hint: "TikTok Vertical (Default)" },
  { id: "1:1", label: "1:1", hint: "Square Feed" },
  { id: "3:4", label: "3:4", hint: "Portrait Shop" },
  { id: "16:9", label: "16:9", hint: "Widescreen" },
];

interface ImageStudioViewProps {
  sourceDataUrl: string | null;
  sourceLabel: string;
  detailsImageDataUrl: string | null;
  detailsImageLabel: string;
  pricePromo: string;
  productDetails: string;
  language: ContentLanguage;
  tone: StrategistTone;
  visualStyle: VisualStyle;
  aspectRatio: AspectRatioOption;
  generationMode: ImageGenerationMode;
  sensitivity: number;
  analysis: ProductAnalysis | null;
  cutout: CutoutResult | null;
  concepts: ImageConceptAsset[];
  imageHistory: ImageHistoryEntry[];
  step: PipelineStep;
  regeneratingConceptIdx: number | null;
  errorMsg: string | null;
  apiWarning: string | null;
  headlineOverlay: string;
  promoOverlay: string;
  onUploadProductFile: (file: Blob, label: string) => void;
  onUploadDetailsFile: (file: Blob, label: string) => void;
  onPasteDetails: () => void;
  onClearDetailsImage: () => void;
  onChangePricePromo: (val: string) => void;
  onChangeProductDetails: (val: string) => void;
  onChangeLanguage: (val: ContentLanguage) => void;
  onChangeTone: (val: StrategistTone) => void;
  onChangeVisualStyle: (val: VisualStyle) => void;
  onChangeAspectRatio: (val: AspectRatioOption) => void;
  onChangeGenerationMode: (val: ImageGenerationMode) => void;
  onChangeSensitivity: (val: number) => void;
  onChangeHeadlineOverlay: (val: string) => void;
  onChangePromoOverlay: (val: string) => void;
  onLoadSample: (sample: SampleProduct) => void;
  onRequestAnalyzeAndGenerate: () => void;
  onGenerateConceptsOnly: () => void;
  onRegenerateConcept: (conceptIdx: number) => void;
  onOpenMaskRefine: () => void;
  onSendConceptToVideo: (concept: ImageConceptAsset) => void;
  onSendToCampaign: () => void;
  onSetPasteTarget: (target: "product" | "details") => void;
}

export const ImageStudioView: React.FC<ImageStudioViewProps> = ({
  sourceDataUrl,
  sourceLabel,
  detailsImageDataUrl,
  detailsImageLabel,
  pricePromo,
  productDetails,
  language,
  tone,
  visualStyle,
  aspectRatio,
  generationMode,
  sensitivity,
  analysis,
  cutout,
  concepts,
  imageHistory,
  step,
  regeneratingConceptIdx,
  errorMsg,
  apiWarning,
  headlineOverlay,
  promoOverlay,
  onUploadProductFile,
  onUploadDetailsFile,
  onPasteDetails,
  onClearDetailsImage,
  onChangePricePromo,
  onChangeProductDetails,
  onChangeLanguage,
  onChangeTone,
  onChangeVisualStyle,
  onChangeAspectRatio,
  onChangeGenerationMode,
  onChangeSensitivity,
  onChangeHeadlineOverlay,
  onChangePromoOverlay,
  onLoadSample,
  onRequestAnalyzeAndGenerate,
  onGenerateConceptsOnly,
  onRegenerateConcept,
  onOpenMaskRefine,
  onSendConceptToVideo,
  onSendToCampaign,
  onSetPasteTarget,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingDetails, setIsDraggingDetails] = useState(false);
  const [compareConceptIdx, setCompareConceptIdx] = useState<number | null>(
    null
  );
  const [compareSplit, setCompareSplit] = useState(50);
  const [showSafeZone, setShowSafeZone] = useState(false);

  const isBusy =
    step === "analyzing" ||
    step === "removing_bg" ||
    step === "generating_images";

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const slug = (analysis?.productName || "product-ad")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Image Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Upload a product photo, analyze its physical attributes, extract
            exact pixels or creatively style 3 commercial ad concepts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cutout && (
            <button
              type="button"
              onClick={onOpenMaskRefine}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap"
            >
              <Paintbrush className="w-3.5 h-3.5 text-rose-400" />
              Manual Mask Correction
            </button>
          )}
          {concepts.length > 0 && (
            <button
              type="button"
              onClick={onSendToCampaign}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5" />
              Send Kit to Campaign Studio
            </button>
          )}
        </div>
      </div>

      {/* Top Configuration & Upload Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Upload + Description Screenshot */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-white">
              1. Product Photo &amp; Details
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Max 12 MB · PNG/JPG/WebP
            </span>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onUploadProductFile(f, f.name);
            }}
            onMouseEnter={() => onSetPasteTarget("product")}
            className={`block rounded-xl border-2 border-dashed p-4 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-rose-500 bg-rose-500/10"
                : "border-slate-700 bg-[#0B0F17] hover:border-slate-500"
            }`}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadProductFile(f, f.name);
                e.target.value = "";
              }}
            />
            {sourceDataUrl ? (
              <div className="flex items-center gap-4 text-left">
                <div className="w-24 h-24 rounded-lg border border-slate-800 bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center">
                  <img
                    src={sourceDataUrl}
                    alt={sourceLabel || "Uploaded product"}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono text-emerald-400">
                    {analysis ? "Analyzed" : "Staged · Waiting Permission"}
                  </div>
                  <div className="text-sm font-semibold text-white truncate mt-0.5">
                    {sourceLabel || "Product screenshot"}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Click or drop another screenshot to replace
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-5 space-y-2">
                <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                <div className="text-sm font-semibold text-white">
                  Drop, click, or Ctrl+V paste product photo
                </div>
                <div className="text-xs text-slate-500">
                  Asks permission before running if no extra details are added
                </div>
              </div>
            )}
          </label>

          {/* Sample Product Quick Loaders */}
          <div>
            <div className="text-[11px] font-medium text-slate-400 mb-2">
              Quick Sample Products
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SAMPLE_PRODUCTS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onLoadSample(sample)}
                  className="rounded-lg border border-slate-800 bg-[#0B0F17] hover:border-slate-600 p-1.5 text-left cursor-pointer disabled:opacity-50"
                >
                  <div className="aspect-square rounded overflow-hidden bg-slate-900 mb-1">
                    <img
                      src={sample.imagePath}
                      alt={sample.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-[11px] font-medium text-slate-200 truncate">
                    {sample.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Description / Price Screenshot */}
          <div
            onMouseEnter={() => onSetPasteTarget("details")}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingDetails(true);
            }}
            onDragLeave={() => setIsDraggingDetails(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingDetails(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onUploadDetailsFile(f, f.name);
            }}
            className={`rounded-xl border p-3.5 space-y-2.5 ${
              isDraggingDetails
                ? "border-rose-500 bg-rose-500/10"
                : "border-slate-800 bg-[#0B0F17]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Attach Specs / Price Screenshot
              </span>
              <span className="text-[11px] text-slate-500">Optional</span>
            </div>

            {detailsImageDataUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-[#121824] p-2">
                <img
                  src={detailsImageDataUrl}
                  alt={detailsImageLabel}
                  className="w-11 h-11 rounded object-cover border border-slate-700"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-100 truncate">
                    {detailsImageLabel || "Details screenshot"}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Facts &amp; pricing extracted truthfully
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClearDetailsImage}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700 bg-[#121824] hover:border-slate-500 px-3 py-2 text-xs text-slate-300 cursor-pointer">
                  <ImagePlus className="w-3.5 h-3.5 text-slate-400" />
                  <span>Upload description / size chart</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadDetailsFile(f, f.name);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={onPasteDetails}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#121824] hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Paste
                </button>
              </div>
            )}

            <input
              type="text"
              value={pricePromo}
              onChange={(e) => onChangePricePromo(e.target.value)}
              placeholder="Verified price or offer (only if applicable — AI never invents prices)"
              className="w-full rounded-lg border border-slate-800 bg-[#121824] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
            />
            <textarea
              rows={2}
              value={productDetails}
              onChange={(e) => onChangeProductDetails(e.target.value)}
              placeholder="Extra factual specs, sizes, materials, or creator direction..."
              className="w-full rounded-lg border border-slate-800 bg-[#121824] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        </section>

        {/* Right: Mode Selection, Style, Aspect Ratio & Execute */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#121824] p-5 flex flex-col justify-between gap-5">
          <div className="space-y-5">
            <h2 className="font-display text-sm font-semibold text-white">
              2. Preservation Mode, Visual Style &amp; Format
            </h2>

            {/* Two Distinct Generation Modes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onChangeGenerationMode("exact_product")}
                className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer ${
                  generationMode === "exact_product"
                    ? "border-emerald-500/80 bg-emerald-500/10"
                    : "border-slate-800 bg-[#0B0F17] hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Exact Product Mode
                  </span>
                  <span className="text-[10px] font-mono uppercase text-emerald-400">
                    Default
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Extracts untouched original product pixels, generates separate
                  backgrounds, composites shadows &amp; lighting without
                  repainting the product. Includes manual mask correction.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChangeGenerationMode("ai_creative")}
                className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer ${
                  generationMode === "ai_creative"
                    ? "border-rose-500/80 bg-rose-500/10"
                    : "border-slate-800 bg-[#0B0F17] hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-rose-400" />
                    AI Creative Mode
                  </span>
                  <span className="text-[10px] font-mono uppercase text-slate-400">
                    Generative
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Uses uploaded image as reference with Nano Banana generative
                  editing. Attempts to preserve identity — exact pixel
                  preservation is not guaranteed.
                </p>
              </button>
            </div>

            {/* Visual Styles (All 8) */}
            <div>
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Visual Style
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VISUAL_STYLE_OPTIONS.map((style) => {
                  const active = visualStyle === style;
                  return (
                    <button
                      key={style}
                      type="button"
                      disabled={isBusy}
                      onClick={() => onChangeVisualStyle(style)}
                      className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? "border-rose-500 bg-rose-600 text-white"
                          : "border-slate-800 bg-[#0B0F17] text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      {style}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Aspect Ratio + Language + Tone */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-300 mb-1.5">
                  Aspect Ratio
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {ASPECT_RATIO_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isBusy}
                      title={opt.hint}
                      onClick={() => onChangeAspectRatio(opt.id)}
                      className={`py-2 rounded-lg border text-xs font-mono font-semibold cursor-pointer ${
                        aspectRatio === opt.id
                          ? "border-rose-500 bg-rose-600 text-white"
                          : "border-slate-800 bg-[#0B0F17] text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Copy Language
                </label>
                <select
                  value={language}
                  disabled={isBusy}
                  onChange={(e) =>
                    onChangeLanguage(e.target.value as ContentLanguage)
                  }
                  className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                >
                  <option value="tagalog">Tagalog (TikTok PH)</option>
                  <option value="english">English (Global)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Strategist Tone
                </label>
                <select
                  value={tone}
                  disabled={isBusy}
                  onChange={(e) => onChangeTone(e.target.value as StrategistTone)}
                  className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                >
                  <option value="viral_urgency">Viral Urgency</option>
                  <option value="problem_solution">Problem-Solution</option>
                  <option value="clean_aesthetic">Clean Aesthetic</option>
                </select>
              </div>
            </div>

            {/* Exact Product Edge Sensitivity & Optional TikTok Overlays */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">Cutout Sensitivity</span>
                  <span className="font-mono tabular-nums text-slate-200">
                    {sensitivity}
                  </span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={78}
                  value={sensitivity}
                  disabled={isBusy}
                  onChange={(e) => onChangeSensitivity(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Optional Headline Overlay
                </label>
                <input
                  type="text"
                  value={headlineOverlay}
                  onChange={(e) => onChangeHeadlineOverlay(e.target.value)}
                  placeholder="Optional safe-zone headline..."
                  className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Optional Promo Overlay
                </label>
                <input
                  type="text"
                  value={promoOverlay}
                  onChange={(e) => onChangePromoOverlay(e.target.value)}
                  placeholder="Optional promo CTA label..."
                  className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              {step === "analyzing" && "Analyzing product attributes & copy..."}
              {step === "removing_bg" &&
                "Extracting clean original product pixels..."}
              {step === "generating_images" &&
                "Generating 3 advertising image concepts..."}
              {step === "idle" &&
                "Ready — outputs 3 distinct 9:16 commercial concepts."}
              {step === "complete" &&
                "3 ad concepts ready for comparison, video, or export."}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {analysis && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={onGenerateConceptsOnly}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-700 bg-[#0B0F17] hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate 3 Concepts
                </button>
              )}

              <button
                type="button"
                disabled={!sourceDataUrl || isBusy}
                onClick={onRequestAnalyzeAndGenerate}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Working...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {analysis
                      ? "Re-Analyze & Generate 3 Ads"
                      : "Analyze Product & Generate 3 Ads"}
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Notices & Errors */}
      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {apiWarning && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{apiWarning}</span>
        </div>
      )}

      {/* Gemini Product Analysis Readout */}
      {analysis && (
        <section className="rounded-2xl border border-slate-800 bg-[#121824] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="text-xs font-mono text-rose-400">
                {analysis.category} · {analysis.wearType}
              </div>
              <h2 className="font-display text-xl font-bold text-white mt-0.5">
                {analysis.productName}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {analysis.shortTagline}
              </p>
            </div>

            {cutout && (
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg border border-slate-700 bg-checkerboard p-1 flex items-center justify-center">
                  <img
                    src={cutout.cutoutDataUrl}
                    alt="Extracted cutout"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Cutout Extracted
                  </div>
                  <div className="text-slate-400 font-mono tabular-nums">
                    {cutout.cutoutWidth}×{cutout.cutoutHeight}px
                  </div>
                  <button
                    type="button"
                    onClick={onOpenMaskRefine}
                    className="text-rose-400 hover:text-rose-300 font-semibold mt-0.5 cursor-pointer"
                  >
                    Touch up edges
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 text-xs">
            <div>
              <div className="text-slate-500 font-mono text-[11px]">
                Product Category
              </div>
              <div className="text-slate-200 mt-1">{analysis.category}</div>
            </div>
            <div>
              <div className="text-slate-500 font-mono text-[11px]">
                Product Appearance
              </div>
              <div className="text-slate-200 mt-1">
                {analysis.appearance || analysis.shortTagline}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-mono text-[11px]">
                Identified Colors
              </div>
              <div className="text-slate-200 mt-1">
                {analysis.colors?.length
                  ? analysis.colors.join(", ")
                  : analysis.accentHex}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-mono text-[11px]">
                Materials &amp; Finish
              </div>
              <div className="text-slate-200 mt-1">
                {analysis.material || "Commercial surface finish"}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-mono text-[11px]">
                Shape &amp; Proportions
              </div>
              <div className="text-slate-200 mt-1">
                {analysis.shape || "Detected product geometry"}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-mono text-[11px]">
                Logos &amp; Branding
              </div>
              <div className="text-slate-200 mt-1">
                {analysis.branding || "Authentic original label"}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-mono text-[11px]">
                Visible Labels &amp; Text
              </div>
              <div className="text-slate-200 mt-1">
                {analysis.visibleText || "Preserved verbatim on product"}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-mono text-[11px]">
                Distinguishing Details
              </div>
              <div className="text-slate-200 mt-1">
                {analysis.distinguishingDetails || "Original silhouette & finish"}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Generated 3 Advertising Concepts */}
      {concepts.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                3 Advertising Concepts ({visualStyle} · {aspectRatio})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {generationMode === "exact_product"
                  ? "Original product pixels preserved cleanly on generated studio environments."
                  : "AI Creative generative mode active — verify brand lettering before publishing."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSafeZone((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-medium text-slate-200 cursor-pointer"
            >
              {showSafeZone ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  Hide TikTok Safe Zones
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  Preview TikTok Safe Zones
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {concepts.map((concept) => {
              const isRegenThis = regeneratingConceptIdx === concept.conceptIndex;
              const isComparing = compareConceptIdx === concept.conceptIndex;
              return (
                <article
                  key={concept.id}
                  className="rounded-2xl border border-slate-800 bg-[#121824] overflow-hidden flex flex-col"
                >
                  {/* Visual Viewport */}
                  <div className="relative aspect-[9/16] bg-[#0B0F17] overflow-hidden flex items-center justify-center">
                    <img
                      src={concept.finalImageDataUrl}
                      alt={concept.title}
                      className="w-full h-full object-contain"
                    />

                    {/* Split Compare Overlay vs Original */}
                    {isComparing && sourceDataUrl && (
                      <div
                        className="absolute inset-0 bg-[#0B0F17] overflow-hidden"
                        style={{
                          clipPath: `inset(0 ${100 - compareSplit}% 0 0)`,
                        }}
                      >
                        <img
                          src={sourceDataUrl}
                          alt="Original product"
                          className="w-full h-full object-contain"
                        />
                        <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-slate-950/85 text-[10px] font-mono text-white border border-slate-700">
                          ORIGINAL
                        </span>
                      </div>
                    )}

                    {isComparing && sourceDataUrl && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none"
                        style={{ left: `${compareSplit}%` }}
                      />
                    )}

                    {showSafeZone && concept.aspectRatio === "9:16" && (
                      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
                        <div className="h-10 border border-dashed border-amber-400/80 bg-amber-500/10 rounded flex items-center justify-center text-[10px] font-mono text-amber-200">
                          Top Search Safe Zone
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <div className="flex-1 h-20 border border-dashed border-amber-400/80 bg-amber-500/10 rounded p-1.5 flex items-end text-[10px] font-mono text-amber-200">
                            Caption &amp; Basket Overlay
                          </div>
                          <div className="w-9 h-36 border border-dashed border-amber-400/80 bg-amber-500/10 rounded flex items-center justify-center text-[9px] font-mono text-amber-200">
                            UI
                          </div>
                        </div>
                      </div>
                    )}

                    {isRegenThis && (
                      <div className="absolute inset-0 bg-[#0B0F17]/85 flex flex-col items-center justify-center gap-2 text-xs text-slate-200">
                        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                        Regenerating Concept {concept.conceptIndex + 1}...
                      </div>
                    )}
                  </div>

                  {/* Split Comparison Slider when active */}
                  {isComparing && sourceDataUrl && (
                    <div className="px-4 py-2 bg-[#0B0F17] border-t border-slate-800 flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400">
                        Orig
                      </span>
                      <input
                        type="range"
                        min={5}
                        max={95}
                        value={compareSplit}
                        onChange={(e) =>
                          setCompareSplit(Number(e.target.value))
                        }
                        className="flex-1 accent-rose-500 cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-rose-400">
                        Ad
                      </span>
                    </div>
                  )}

                  {/* Metadata & Actions */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between border-t border-slate-800">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                        <span>Concept 0{concept.conceptIndex + 1}</span>
                        <span>
                          {concept.engine === "nano_banana"
                            ? "Nano Banana"
                            : "Studio Composite"}
                        </span>
                      </div>
                      <h3 className="font-display text-sm font-semibold text-white mt-0.5">
                        {concept.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {concept.direction}
                      </p>
                      {concept.apiNotice && (
                        <p className="text-[11px] text-amber-300/90 mt-1.5">
                          {concept.apiNotice}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800/70">
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setCompareConceptIdx(
                              isComparing ? null : concept.conceptIndex
                            )
                          }
                          className={`inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                            isComparing
                              ? "border-rose-500 bg-rose-600 text-white"
                              : "border-slate-700 bg-[#0B0F17] text-slate-200 hover:bg-slate-800"
                          }`}
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          Compare
                        </button>

                        <button
                          type="button"
                          disabled={isBusy || isRegenThis}
                          onClick={() =>
                            onRegenerateConcept(concept.conceptIndex)
                          }
                          className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-slate-700 bg-[#0B0F17] text-slate-200 hover:bg-slate-800 text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Regen
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            triggerDownload(
                              concept.finalImageDataUrl,
                              `${slug}-concept-${concept.conceptIndex + 1}.png`
                            )
                          }
                          className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg border border-slate-700 bg-[#0B0F17] text-slate-200 hover:bg-slate-800 text-[11px] font-semibold cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          PNG
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSendConceptToVideo(concept)}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Clapperboard className="w-3.5 h-3.5" />
                        Approve &amp; Animate in Video Studio
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Session Image History */}
      {imageHistory.length > 1 && (
        <section className="rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Image History
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Earlier concept batches generated in this session remain
                available for comparison and download.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {imageHistory.length} batches
            </span>
          </div>

          <div className="space-y-4">
            {imageHistory.slice(1, 5).map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-slate-800 bg-[#0B0F17] p-3.5 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">
                    {entry.productName} · {entry.visualStyle} ·{" "}
                    {entry.aspectRatio}
                  </span>
                  <span className="font-mono tabular-nums text-[11px]">
                    {new Date(entry.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {entry.concepts.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/70 p-1.5 space-y-1.5"
                    >
                      <div className="aspect-[9/16] rounded overflow-hidden bg-[#0B0F17]">
                        <img
                          src={c.finalImageDataUrl}
                          alt={c.title}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          triggerDownload(
                            c.finalImageDataUrl,
                            `${slug}-history-${c.conceptIndex + 1}.png`
                          )
                        }
                        className="w-full py-1 rounded border border-slate-700 hover:bg-slate-800 text-[10px] font-semibold text-slate-200 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Download className="w-2.5 h-2.5" />
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
