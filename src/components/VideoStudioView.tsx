import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clapperboard,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Wand2,
} from "lucide-react";
import type {
  AspectRatioOption,
  BackdropPreset,
  ContentLanguage,
  CutoutResult,
  GeneratedVideoResult,
  ImageConceptAsset,
  MotionPreset,
  ProductAnalysis,
  VideoAvailabilityStatus,
  VideoStylePreset,
  VoiceName,
  VoiceoverDeliveryStyle,
  VoiceoverLanguageMode,
  VoiceoverPace,
} from "../types/studio";
import { BACKDROP_THEMES } from "../utils/backgroundRemover";
import { TagalogVoiceoverPanel } from "./TagalogVoiceoverPanel";

export const MOTION_PRESETS: MotionPreset[] = [
  "Cinematic Product Reveal",
  "Slow Camera Push",
  "Floating Product Showcase",
  "Rotating Product Display",
  "Luxury Commercial",
  "Minimalist Product Presentation",
  "Dramatic Lighting Reveal",
  "TikTok Product Advertisement",
];

type ShowcasePreservationMode = "exact_product" | "ai_video";

interface VideoStudioViewProps {
  analysis: ProductAnalysis | null;
  cutout: CutoutResult | null;
  concepts: ImageConceptAsset[];
  approvedImageDataUrl: string | null;
  approvedImageLabel: string;
  motionPreset: MotionPreset;
  motionPrompt: string;
  aspectRatio: AspectRatioOption;
  durationSec: number;
  video: GeneratedVideoResult | null;
  localVideo: GeneratedVideoResult | null;
  flowVideo: GeneratedVideoResult | null;
  videoAvailability: VideoAvailabilityStatus | null;
  isCheckingVideoAccess: boolean;
  videoJobStatus: string | null;
  videoJobError: string | null;
  isAnalyzingForVideo: boolean;
  isGeneratingPrompt: boolean;
  isGeneratingVideo: boolean;
  isRenderingLocalVideo: boolean;
  localRenderProgress: number;
  localRenderError: string | null;
  showLayerOverlays: boolean;
  voiceoverScript: string;
  voiceName: VoiceName;
  voiceoverLangMode: VoiceoverLanguageMode;
  voiceoverStyle: VoiceoverDeliveryStyle;
  voiceoverPace: VoiceoverPace;
  voiceoverUrl: string | null;
  voiceoverError: string | null;
  isGeneratingVoiceScript: boolean;
  isSynthesizingVoiceover: boolean;
  backdrop: BackdropPreset;
  videoStyle: VideoStylePreset;
  language: ContentLanguage;
  onSelectApprovedImage: (dataUrl: string, label: string) => void;
  onUploadDirectImage: (file: Blob, label: string) => void;
  onAnalyzeStagedImage: () => void;
  onChangeMotionPreset: (preset: MotionPreset) => void;
  onChangeMotionPrompt: (prompt: string) => void;
  onChangeAspectRatio: (ratio: AspectRatioOption) => void;
  onChangeDurationSec: (sec: number) => void;
  onChangeShowLayerOverlays: (show: boolean) => void;
  onGenerateMotionPrompt: (customNotes?: string) => void;
  onCheckVideoAvailability: () => void;
  onSubmitOmniVideo: () => void;
  onExtendOmniVideo: () => void;
  onRenderLocalVideo: () => void;
  onUploadFlowVideo: (file: File) => void;
  onClearFlowVideo: () => void;
  onChangeBackdrop: (b: BackdropPreset) => void;
  onChangeVideoStyle: (s: VideoStylePreset) => void;
  onChangeVoiceoverScript: (next: string) => void;
  onChangeVoiceName: (v: VoiceName) => void;
  onChangeVoiceoverLangMode: (m: VoiceoverLanguageMode) => void;
  onChangeVoiceoverStyle: (s: VoiceoverDeliveryStyle) => void;
  onChangeVoiceoverPace: (p: VoiceoverPace) => void;
  onGenerateVoiceoverScript: () => void;
  onSynthesizeVoiceover: () => void;
  onUpdateGoogleFlowPrompt: (p: string) => void;
  onSendToCampaign: () => void;
}

export const VideoStudioView: React.FC<VideoStudioViewProps> = ({
  analysis,
  cutout,
  concepts,
  approvedImageDataUrl,
  approvedImageLabel,
  motionPreset,
  motionPrompt,
  aspectRatio,
  durationSec,
  video,
  localVideo,
  flowVideo,
  videoAvailability,
  isCheckingVideoAccess,
  videoJobStatus,
  videoJobError,
  isAnalyzingForVideo,
  isGeneratingPrompt,
  isGeneratingVideo,
  isRenderingLocalVideo,
  localRenderProgress,
  localRenderError,
  showLayerOverlays,
  voiceoverScript,
  voiceName,
  voiceoverLangMode,
  voiceoverStyle,
  voiceoverPace,
  voiceoverUrl,
  voiceoverError,
  isGeneratingVoiceScript,
  isSynthesizingVoiceover,
  backdrop,
  videoStyle,
  onSelectApprovedImage,
  onUploadDirectImage,
  onAnalyzeStagedImage,
  onChangeMotionPreset,
  onChangeMotionPrompt,
  onChangeAspectRatio,
  onChangeDurationSec,
  onChangeShowLayerOverlays,
  onGenerateMotionPrompt,
  onCheckVideoAvailability,
  onSubmitOmniVideo,
  onExtendOmniVideo,
  onRenderLocalVideo,
  onUploadFlowVideo,
  onClearFlowVideo,
  onChangeBackdrop,
  onChangeVideoStyle,
  onChangeVoiceoverScript,
  onChangeVoiceName,
  onChangeVoiceoverLangMode,
  onChangeVoiceoverStyle,
  onChangeVoiceoverPace,
  onGenerateVoiceoverScript,
  onSynthesizeVoiceover,
  onUpdateGoogleFlowPrompt,
  onSendToCampaign,
}) => {
  const showcaseVideoRef = useRef<HTMLVideoElement | null>(null);
  const flowVideoRef = useRef<HTMLVideoElement | null>(null);

  const [showcaseMode, setShowcaseMode] =
    useState<ShowcasePreservationMode>("exact_product");
  const [customNotes, setCustomNotes] = useState("");
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [showOverlayPreview, setShowOverlayPreview] = useState(false);
  const [isShowcasePlaying, setIsShowcasePlaying] = useState(false);
  const [copiedFlow, setCopiedFlow] = useState(false);

  const displayedShowcaseVideo =
    showcaseMode === "ai_video"
      ? video || null
      : localVideo || null;

  useEffect(() => {
    setIsShowcasePlaying(false);
  }, [displayedShowcaseVideo?.videoUrl, showcaseMode]);

  const toggleShowcasePlay = async () => {
    const el = showcaseVideoRef.current;
    if (!el) return;
    if (el.paused || el.ended) {
      await el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const slug = (analysis?.productName || "product-showcase")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);

  const copyFlowPrompt = async () => {
    const text = analysis?.strategist.googleFlowPrompt || motionPrompt;
    if (!text) return;
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedFlow(true);
    window.setTimeout(() => setCopiedFlow(false), 1800);
  };

  const imageChoices: Array<{ id: string; label: string; url: string }> = [
    ...concepts.map((c) => ({
      id: c.id,
      label: `Concept ${c.conceptIndex + 1}: ${c.title}`,
      url: c.finalImageDataUrl,
    })),
    ...(cutout?.studioImageDataUrl
      ? [
          {
            id: "studio_default",
            label: "Studio Composite",
            url: cutout.studioImageDataUrl,
          },
        ]
      : []),
    ...(cutout?.cutoutDataUrl
      ? [
          {
            id: "cutout_png",
            label: "Transparent Cutout",
            url: cutout.cutoutDataUrl,
          },
        ]
      : []),
  ];

  const isVertical = aspectRatio !== "16:9";
  const aiModelAvailable = Boolean(videoAvailability?.available);

  return (
    <div className="space-y-8">
      {/* Studio Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Video Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Two independent production workflows: launch Google Flow manually in
            a new tab or create showcase videos directly inside this studio.
          </p>
        </div>

        <button
          type="button"
          onClick={onSendToCampaign}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <Layers className="w-3.5 h-3.5" />
          Connect to Campaign Studio
        </button>
      </div>

      {/* =================================================================== */}
      {/* SECTION 1: GOOGLE FLOW MANUAL EDITOR (COMPLETELY INDEPENDENT)       */}
      {/* =================================================================== */}
      <section className="rounded-2xl border border-slate-800 bg-[#121824] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1 max-w-2xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400">
              Section 1 · Independent Manual Workflow
            </div>
            <h2 className="font-display text-lg font-bold text-white">
              Google Flow Manual Editor
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Create and edit videos manually in your own Google Flow account.
              This tool does not automate Flow, never asks for Flow credentials,
              and does not automatically import Flow renders—download your
              finished clip from Flow and upload it below to organize or export
              it here.
            </p>
          </div>

          <a
            href="https://labs.google/fx/tools/flow"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Open Google Flow
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Manual Flow Prompt Helper & Manual Video Upload */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-white">
                  Manual Flow Prompt Helper (Optional)
                </div>
                <button
                  type="button"
                  disabled={!analysis?.strategist.googleFlowPrompt && !motionPrompt}
                  onClick={() => void copyFlowPrompt()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-[#121824] hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap"
                >
                  {copiedFlow ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied Prompt
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Prompt for Flow
                    </>
                  )}
                </button>
              </div>

              {analysis ? (
                <textarea
                  rows={3}
                  value={analysis.strategist.googleFlowPrompt}
                  onChange={(e) => onUpdateGoogleFlowPrompt(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-[#121824] p-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              ) : (
                <p className="text-xs text-slate-500">
                  Optional: Analyze a product in Section 2 or Copywriter first
                  to pre-draft a prompt you can copy and paste into Google Flow.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-dashed border-slate-700 bg-[#0B0F17] p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 max-w-md">
                <div className="text-xs font-semibold text-white">
                  Upload Finished Google Flow Video
                </div>
                <p className="text-xs text-slate-400">
                  After exporting a video from your Google Flow tab, upload the
                  MP4/WebM file manually here to preview, save into projects, or
                  package in Export Center.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-semibold text-slate-100 cursor-pointer whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5 text-rose-400" />
                  {flowVideo ? "Replace Flow Video" : "Upload Flow Video"}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadFlowVideo(file);
                      e.target.value = "";
                    }}
                  />
                </label>

                {flowVideo && (
                  <button
                    type="button"
                    onClick={onClearFlowVideo}
                    title="Remove uploaded Flow video"
                    className="p-2 rounded-xl border border-slate-800 bg-[#121824] hover:bg-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Uploaded Flow Video Preview */}
          <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#0B0F17] p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-rose-400" />
                Uploaded Flow Clip
              </span>
              {flowVideo && (
                <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">
                  {flowVideo.label || `flow.${flowVideo.extension}`}
                </span>
              )}
            </div>

            {flowVideo ? (
              <>
                <div className="aspect-video sm:aspect-[9/16] max-h-[240px] mx-auto w-full rounded-lg overflow-hidden bg-black flex items-center justify-center">
                  <video
                    ref={flowVideoRef}
                    key={flowVideo.videoUrl}
                    src={flowVideo.videoUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    triggerDownload(
                      flowVideo.videoUrl,
                      `${slug}-google-flow.${flowVideo.extension}`
                    )
                  }
                  className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Uploaded Flow Clip
                </button>
              </>
            ) : (
              <div className="py-10 text-center space-y-1.5">
                <Film className="w-7 h-7 text-slate-600 mx-auto" />
                <div className="text-xs font-medium text-slate-400">
                  No Google Flow video uploaded yet
                </div>
                <div className="text-[11px] text-slate-500">
                  Works independently even when internal AI video models are
                  unavailable.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* SECTION 2: PRODUCT VIDEO SHOWCASE                                   */}
      {/* =================================================================== */}
      <section className="rounded-2xl border border-slate-800 bg-[#121824] p-5 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
              Section 2 · In-App Showcase Studio
            </div>
            <h2 className="font-display text-lg font-bold text-white">
              Product Video Showcase
            </h2>
            <p className="text-xs text-slate-400">
              Upload a product image or choose an existing ad concept, prepare a
              motion prompt, and render using Exact Product Showcase or AI Video
              Showcase.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Controls */}
          <div className="lg:col-span-7 space-y-5">
            {/* Step 1: Select or Upload Product Image + Analyze */}
            <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-white">
                  1. Product Source Image
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {approvedImageDataUrl && (
                    <button
                      type="button"
                      disabled={isAnalyzingForVideo}
                      onClick={onAnalyzeStagedImage}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-200 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {isAnalyzingForVideo ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      {isAnalyzingForVideo
                        ? "Analyzing Product..."
                        : "Analyze & Prepare Prompt"}
                    </button>
                  )}

                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-medium text-slate-200 cursor-pointer whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" />
                    Upload Product Image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUploadDirectImage(f, f.name);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              {imageChoices.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {imageChoices.map((item) => {
                    const selected = approvedImageDataUrl === item.url;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectApprovedImage(item.url, item.label)}
                        className={`rounded-xl border p-2 text-left transition-colors cursor-pointer ${
                          selected
                            ? "border-rose-500 bg-rose-500/10"
                            : "border-slate-800 bg-[#121824] hover:border-slate-600"
                        }`}
                      >
                        <div className="aspect-[9/16] rounded-lg overflow-hidden bg-slate-900 mb-1.5">
                          <img
                            src={item.url}
                            alt={item.label}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="text-[11px] font-medium text-slate-200 truncate">
                          {item.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : approvedImageDataUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#121824] p-3">
                  <img
                    src={approvedImageDataUrl}
                    alt={approvedImageLabel}
                    className="w-14 h-20 rounded-lg object-contain border border-slate-700 bg-slate-900"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-emerald-400">
                      Product Image Staged
                    </div>
                    <div className="text-xs text-slate-300 truncate mt-0.5">
                      {approvedImageLabel}
                    </div>
                    {!analysis && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        Click &quot;Analyze &amp; Prepare Prompt&quot; above to
                        auto-extract the product layer and prepare a tailored
                        video prompt.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 bg-[#121824] p-5 text-xs text-slate-400 text-center">
                  Upload a product image above or generate ad concepts in Image
                  Studio first.
                </div>
              )}
            </div>

            {/* Step 2: 8 Motion Presets & Video Prompt */}
            <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-4 space-y-3.5">
              <h3 className="font-display text-sm font-semibold text-white">
                2. Motion Preset &amp; Showcase Prompt
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MOTION_PRESETS.map((preset, idx) => {
                  const active = motionPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onChangeMotionPreset(preset)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors cursor-pointer flex items-center gap-2 ${
                        active
                          ? "border-rose-500 bg-rose-600 text-white"
                          : "border-slate-800 bg-[#121824] text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <span
                        className={`text-[10px] font-mono ${
                          active ? "text-rose-100" : "text-slate-500"
                        }`}
                      >
                        0{idx + 1}
                      </span>
                      <span className="truncate">{preset}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Optional direction (e.g. warm backlit mist, marble counter)..."
                  className="flex-1 rounded-lg border border-slate-800 bg-[#121824] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="button"
                  disabled={isGeneratingPrompt}
                  onClick={() => onGenerateMotionPrompt(customNotes)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {isGeneratingPrompt ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  Prepare Video Prompt
                </button>
              </div>

              <textarea
                rows={3}
                value={motionPrompt}
                onChange={(e) => onChangeMotionPrompt(e.target.value)}
                placeholder="Click 'Prepare Video Prompt' or type motion & lighting directions..."
                className="w-full rounded-lg border border-slate-800 bg-[#121824] p-3 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Step 3: Preservation Mode (Exact Product Showcase vs AI Video Showcase) */}
            <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-white">
                  3. Product Preservation Mode
                </h3>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Output:</span>
                  <select
                    value={aspectRatio === "16:9" ? "16:9" : "9:16"}
                    onChange={(e) =>
                      onChangeAspectRatio(e.target.value as AspectRatioOption)
                    }
                    className="rounded-lg border border-slate-800 bg-[#121824] px-2.5 py-1.5 font-mono text-xs text-white"
                  >
                    <option value="9:16">9:16 Vertical (Default)</option>
                    <option value="16:9">16:9 Widescreen</option>
                  </select>
                </div>
              </div>

              {/* Mode Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowcaseMode("exact_product")}
                  className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer space-y-1.5 ${
                    showcaseMode === "exact_product"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-800 bg-[#121824] hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Exact Product Showcase
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Keeps your original product on a separate layer. Animates
                    background, lighting, camera framing, transitions, and text
                    around it without repainting the product.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setShowcaseMode("ai_video")}
                  className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer space-y-1.5 ${
                    showcaseMode === "ai_video"
                      ? "border-rose-500 bg-rose-500/10"
                      : "border-slate-800 bg-[#121824] hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Clapperboard className="w-4 h-4 text-rose-400" />
                      AI Video Showcase
                    </span>
                    <span
                      className={`text-[10px] font-mono ${
                        aiModelAvailable ? "text-emerald-300" : "text-amber-300"
                      }`}
                    >
                      {isCheckingVideoAccess
                        ? "Checking..."
                        : aiModelAvailable
                          ? "v1beta Ready"
                          : "Unavailable"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Uses Google&apos;s image-to-video model via the{" "}
                    <span className="font-mono">v1beta</span> Interactions API.
                    Generated AI video may alter fine product details.
                  </p>
                </button>
              </div>

              {/* Exact Product Showcase Controls */}
              {showcaseMode === "exact_product" ? (
                <div className="pt-3 border-t border-slate-800 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="text-[11px] font-medium text-slate-400 mb-1">
                        Background Theme
                      </div>
                      <select
                        value={backdrop}
                        onChange={(e) =>
                          onChangeBackdrop(e.target.value as BackdropPreset)
                        }
                        className="w-full rounded-lg border border-slate-800 bg-[#121824] px-3 py-2 text-xs text-slate-100"
                      >
                        {(Object.keys(BACKDROP_THEMES) as BackdropPreset[]).map(
                          (k) => (
                            <option key={k} value={k}>
                              {BACKDROP_THEMES[k].label}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-slate-400 mb-1">
                        Pacing Style
                      </div>
                      <select
                        value={videoStyle}
                        onChange={(e) =>
                          onChangeVideoStyle(e.target.value as VideoStylePreset)
                        }
                        className="w-full rounded-lg border border-slate-800 bg-[#121824] px-3 py-2 text-xs text-slate-100"
                      >
                        <option value="energetic">High-Energy Ad</option>
                        <option value="editorial">Editorial Reveal</option>
                        <option value="minimal">Minimal Clean</option>
                      </select>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-slate-400 mb-1">
                        Text &amp; CTA Beats
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onChangeShowLayerOverlays(!showLayerOverlays)
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer ${
                          showLayerOverlays
                            ? "border-emerald-500 bg-emerald-500/10 text-white"
                            : "border-slate-800 bg-[#121824] text-slate-400"
                        }`}
                      >
                        {showLayerOverlays
                          ? "Hooks & CTA Enabled"
                          : "Clean Layer Only"}
                      </button>
                    </div>
                  </div>

                  {/* Render Progress Bar */}
                  {(isRenderingLocalVideo || localRenderProgress > 0) && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                        <span>
                          {isRenderingLocalVideo
                            ? `Rendering Exact-Product Layer (${motionPreset})...`
                            : "Exact-Product Showcase Render Complete"}
                        </span>
                        <span className="tabular-nums">
                          {localRenderProgress}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-150"
                          style={{ width: `${localRenderProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {localRenderError && (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{localRenderError}</span>
                    </div>
                  )}

                  <TagalogVoiceoverPanel
                    compact
                    scriptText={voiceoverScript}
                    voiceName={voiceName}
                    languageMode={voiceoverLangMode}
                    deliveryStyle={voiceoverStyle}
                    pace={voiceoverPace}
                    voiceoverUrl={voiceoverUrl}
                    voiceoverError={voiceoverError}
                    isGeneratingScript={isGeneratingVoiceScript}
                    isSynthesizing={isSynthesizingVoiceover}
                    canGenerateScript={Boolean(analysis || approvedImageDataUrl)}
                    onChangeScript={onChangeVoiceoverScript}
                    onChangeVoiceName={onChangeVoiceName}
                    onChangeLanguageMode={onChangeVoiceoverLangMode}
                    onChangeDeliveryStyle={onChangeVoiceoverStyle}
                    onChangePace={onChangeVoiceoverPace}
                    onGenerateScript={onGenerateVoiceoverScript}
                    onSynthesize={onSynthesizeVoiceover}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">
                      Preserves exact product pixels while animating backdrop,
                      lighting, and framing.
                    </span>
                    <div className="flex items-center gap-2">
                      {localVideo && !isRenderingLocalVideo && (
                        <button
                          type="button"
                          onClick={onRenderLocalVideo}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Retry Render
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!approvedImageDataUrl || isRenderingLocalVideo}
                        onClick={onRenderLocalVideo}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs sm:text-sm font-semibold cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {isRenderingLocalVideo ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Rendering {localRenderProgress}%
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            Render Exact Product Showcase
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* AI Video Showcase Controls (v1beta Interactions API) */
                <div className="pt-3 border-t border-slate-800 space-y-4">
                  {/* Live v1beta Availability Banner */}
                  <div
                    className={`rounded-xl border p-3.5 space-y-2 ${
                      aiModelAvailable
                        ? "border-emerald-500/35 bg-emerald-500/10"
                        : "border-amber-500/40 bg-amber-500/10"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-white">
                        {aiModelAvailable ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                        )}
                        <span>
                          Model:{" "}
                          <span className="font-mono">
                            {videoAvailability?.model || "gemini-omni-1.2-flash"}
                          </span>{" "}
                          (v1beta Interactions API)
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={isCheckingVideoAccess}
                        onClick={onCheckVideoAvailability}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-700 bg-[#121824] hover:bg-slate-800 text-[11px] font-semibold text-slate-200 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${isCheckingVideoAccess ? "animate-spin" : ""}`}
                        />
                        {isCheckingVideoAccess
                          ? "Checking v1beta..."
                          : "Verify Access"}
                      </button>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {videoAvailability?.note ||
                        "Verifying v1beta Interactions API compatibility in the current Google AI Studio project..."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400">Clip Length:</span>
                      <select
                        value={durationSec}
                        onChange={(e) =>
                          onChangeDurationSec(Number(e.target.value))
                        }
                        className="rounded-lg border border-slate-800 bg-[#121824] px-2.5 py-1.5 font-mono text-xs text-white"
                      >
                        <option value={8}>8s MP4</option>
                        <option value={12}>12s MP4</option>
                        <option value={15}>15s MP4</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {video?.interactionId && video.engine === "gemini_omni" && (
                        <button
                          type="button"
                          disabled={isGeneratingVideo || !aiModelAvailable}
                          onClick={onExtendOmniVideo}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-40 whitespace-nowrap"
                        >
                          Extend +10s
                        </button>
                      )}

                      {videoJobError && aiModelAvailable && (
                        <button
                          type="button"
                          disabled={isGeneratingVideo}
                          onClick={onSubmitOmniVideo}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Retry
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={
                          !approvedImageDataUrl ||
                          isGeneratingVideo ||
                          !aiModelAvailable
                        }
                        onClick={onSubmitOmniVideo}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {isGeneratingVideo ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating AI Video...
                          </>
                        ) : (
                          <>
                            <Clapperboard className="w-4 h-4" />
                            Generate AI Video Showcase
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {videoJobStatus && (
                    <div className="text-xs font-mono text-slate-300 bg-[#121824] border border-slate-800 rounded-lg px-3 py-2">
                      {videoJobStatus}
                    </div>
                  )}

                  {videoJobError && (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{videoJobError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Showcase Video Preview Stage */}
          <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#0B0F17] p-4 sm:p-5 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-display text-sm font-semibold text-white">
                  Showcase Video Preview
                </h3>
                <p className="text-xs font-mono tabular-nums text-slate-400 mt-0.5">
                  {displayedShowcaseVideo
                    ? `${displayedShowcaseVideo.engine === "gemini_omni" ? "AI Video Showcase (MP4)" : `Exact Product Showcase (${motionPreset})`} · ${displayedShowcaseVideo.durationSec.toFixed(1)}s`
                    : isVertical
                      ? "9:16 Vertical · 30 FPS Target"
                      : "16:9 Widescreen · 30 FPS Target"}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div
                className={`relative w-full ${
                  isVertical ? "max-w-[320px] aspect-[9/16]" : "aspect-video"
                } rounded-2xl border border-slate-800 bg-[#121824] overflow-hidden flex items-center justify-center`}
              >
                {displayedShowcaseVideo ? (
                  <>
                    <video
                      ref={showcaseVideoRef}
                      key={displayedShowcaseVideo.videoUrl}
                      src={displayedShowcaseVideo.videoUrl}
                      poster={approvedImageDataUrl || undefined}
                      controls
                      playsInline
                      loop
                      onPlay={() => setIsShowcasePlaying(true)}
                      onPause={() => setIsShowcasePlaying(false)}
                      onEnded={() => setIsShowcasePlaying(false)}
                      className="w-full h-full object-cover"
                    />
                    {!isShowcasePlaying && (
                      <button
                        type="button"
                        onClick={() => void toggleShowcasePlay()}
                        className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/35 hover:bg-black/25 cursor-pointer"
                      >
                        <span className="w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center">
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        </span>
                      </button>
                    )}

                    {showOverlayPreview && analysis && (
                      <div className="pointer-events-none absolute inset-x-4 top-16 z-20 rounded-xl bg-slate-950/80 border border-white/15 px-3 py-2 text-center">
                        <div className="text-[11px] font-semibold text-white">
                          {analysis.strategist.videoScript.beat1Hook}
                        </div>
                      </div>
                    )}

                    {showSafeZone && isVertical && (
                      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3.5">
                        <div className="h-11 border border-dashed border-amber-400/75 bg-amber-500/10 rounded flex items-center justify-center text-[10px] font-mono text-amber-200">
                          TikTok Search / Nav Zone
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <div className="flex-1 h-22 border border-dashed border-amber-400/75 bg-amber-500/10 rounded p-1.5 flex items-end text-[10px] font-mono text-amber-200">
                            Caption &amp; Yellow Basket
                          </div>
                          <div className="w-10 h-40 border border-dashed border-amber-400/75 bg-amber-500/10 rounded flex items-center justify-center text-[9px] font-mono text-amber-200">
                            UI
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : isGeneratingVideo || isRenderingLocalVideo ? (
                  <div className="p-6 text-center space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin text-rose-500 mx-auto" />
                    <div className="font-display text-sm font-semibold text-white">
                      {isRenderingLocalVideo
                        ? `Rendering Exact Product Showcase (${localRenderProgress}%)`
                        : "Generating AI Video Showcase"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {isRenderingLocalVideo
                        ? "Compositing untouched product layer over animated studio backdrop..."
                        : "Polling v1beta Interactions API job status..."}
                    </div>
                  </div>
                ) : approvedImageDataUrl ? (
                  <div className="relative w-full h-full">
                    <img
                      src={approvedImageDataUrl}
                      alt={approvedImageLabel}
                      className="w-full h-full object-contain opacity-65"
                    />
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-6 text-center">
                      <Sparkles className="w-7 h-7 text-emerald-400 mb-2" />
                      <div className="text-sm font-semibold text-white">
                        Product Staged for Showcase
                      </div>
                      <div className="text-xs text-slate-300 mt-1">
                        {showcaseMode === "exact_product"
                          ? "Click 'Render Exact Product Showcase' to animate backdrop and lighting around your untouched product."
                          : aiModelAvailable
                            ? "Click 'Generate AI Video Showcase' to submit to v1beta Interactions API."
                            : "AI Video model unavailable in this project — switch to Exact Product Showcase or use Google Flow Manual Editor."}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500 space-y-2">
                    <Film className="w-8 h-8 mx-auto text-slate-600" />
                    <div className="text-sm font-medium text-slate-300">
                      Product Video Showcase Stage
                    </div>
                    <div className="text-xs">
                      Upload a product image or pick an ad concept to begin.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
                {isVertical && (
                  <button
                    type="button"
                    onClick={() => setShowSafeZone((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
                  >
                    {showSafeZone ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                        Hide Safe Zones
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        Preview Safe Zones
                      </>
                    )}
                  </button>
                )}

                {analysis && (
                  <button
                    type="button"
                    onClick={() => setShowOverlayPreview((v) => !v)}
                    className="text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showOverlayPreview
                      ? "Hide Headline Preview"
                      : "Preview Headline Overlay"}
                  </button>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <button
                type="button"
                disabled={!displayedShowcaseVideo}
                onClick={() =>
                  displayedShowcaseVideo &&
                  triggerDownload(
                    displayedShowcaseVideo.videoUrl,
                    `${slug}.${displayedShowcaseVideo.extension}`
                  )
                }
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs sm:text-sm font-semibold cursor-pointer disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Download Showcase Video (
                {displayedShowcaseVideo
                  ? displayedShowcaseVideo.extension.toUpperCase()
                  : "WEBM / MP4"}
                )
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
