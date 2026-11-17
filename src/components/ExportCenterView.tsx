import React, { useState } from "react";
import {
  Check,
  Copy,
  Download,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Mic,
} from "lucide-react";
import type {
  CutoutResult,
  GeneratedVideoResult,
  ImageConceptAsset,
  ImageHistoryEntry,
  ProductAnalysis,
  StudioSection,
} from "../types/studio";

interface ExportCenterViewProps {
  analysis: ProductAnalysis | null;
  cutout: CutoutResult | null;
  concepts: ImageConceptAsset[];
  imageHistory: ImageHistoryEntry[];
  omniVideo: GeneratedVideoResult | null;
  localVideo: GeneratedVideoResult | null;
  flowVideo?: GeneratedVideoResult | null;
  voiceoverUrl: string | null;
  onNavigate: (section: StudioSection) => void;
}

export const ExportCenterView: React.FC<ExportCenterViewProps> = ({
  analysis,
  cutout,
  concepts,
  imageHistory,
  omniVideo,
  localVideo,
  flowVideo,
  voiceoverUrl,
  onNavigate,
}) => {
  const [filterKind, setFilterKind] = useState<
    "all" | "images" | "videos" | "audio"
  >("all");
  const [customPrefix, setCustomPrefix] = useState("");
  const [copiedCopyPack, setCopiedCopyPack] = useState(false);

  const baseSlug = (
    customPrefix.trim() ||
    analysis?.productName ||
    "tiktok-product-ad"
  )
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyCaptionBundle = async () => {
    if (!analysis) return;
    const tags = analysis.strategist.hashtags
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
    const full = `${analysis.strategist.caption}\n\n${tags}`;
    await navigator.clipboard.writeText(full).catch(() => {});
    setCopiedCopyPack(true);
    window.setTimeout(() => setCopiedCopyPack(false), 1800);
  };

  interface ExportItem {
    id: string;
    kind: "image" | "video" | "audio";
    title: string;
    subtitle: string;
    url: string;
    filename: string;
    formatLabel: string;
    isTikTokVertical: boolean;
  }

  const items: ExportItem[] = [];

  if (omniVideo) {
    items.push({
      id: "export_omni_video",
      kind: "video",
      title: "Gemini Omni AI Commercial Video",
      subtitle: `${omniVideo.resolution || "1080×1920"} · ${omniVideo.durationSec.toFixed(1)}s`,
      url: omniVideo.videoUrl,
      filename: `${baseSlug}-ai-video.${omniVideo.extension}`,
      formatLabel: omniVideo.extension.toUpperCase(),
      isTikTokVertical: true,
    });
  }

  if (localVideo) {
    items.push({
      id: "export_local_video",
      kind: "video",
      title: "Exact-Product Showcase Video",
      subtitle: `${localVideo.resolution || "720×1280"} · ${localVideo.durationSec.toFixed(1)}s · Animated Cutout`,
      url: localVideo.videoUrl,
      filename: `${baseSlug}-exact-showcase.${localVideo.extension}`,
      formatLabel: localVideo.extension.toUpperCase(),
      isTikTokVertical: !localVideo.resolution?.startsWith("1280"),
    });
  }

  if (flowVideo) {
    items.push({
      id: "export_flow_video",
      kind: "video",
      title: flowVideo.label || "Uploaded Google Flow Video",
      subtitle: "Manually Uploaded from Google Flow",
      url: flowVideo.videoUrl,
      filename: `${baseSlug}-google-flow.${flowVideo.extension}`,
      formatLabel: flowVideo.extension.toUpperCase(),
      isTikTokVertical: true,
    });
  }

  concepts.forEach((c) => {
    items.push({
      id: `export_concept_${c.id}`,
      kind: "image",
      title: `${c.title} (${c.visualStyle})`,
      subtitle: `${c.aspectRatio} · ${c.mode === "exact_product" ? "Exact Product" : "AI Creative"}`,
      url: c.finalImageDataUrl,
      filename: `${baseSlug}-concept-${c.conceptIndex + 1}-${c.aspectRatio.replace(":", "x")}.png`,
      formatLabel: "PNG",
      isTikTokVertical: c.aspectRatio === "9:16",
    });
  });

  if (cutout?.cutoutDataUrl) {
    items.push({
      id: "export_cutout",
      kind: "image",
      title: "Transparent Product Cutout",
      subtitle: `${cutout.cutoutWidth}×${cutout.cutoutHeight}px · Untouched Original Pixels`,
      url: cutout.cutoutDataUrl,
      filename: `${baseSlug}-cutout-transparent.png`,
      formatLabel: "PNG RGBA",
      isTikTokVertical: false,
    });
  }

  if (voiceoverUrl) {
    items.push({
      id: "export_voiceover",
      kind: "audio",
      title: "AI Voiceover Narration Track",
      subtitle: "Gemini TTS Commercial Voiceover",
      url: voiceoverUrl,
      filename: `${baseSlug}-voiceover.wav`,
      formatLabel: "WAV",
      isTikTokVertical: false,
    });
  }

  // Include unique historical concepts not already in active concepts
  const activeUrls = new Set(concepts.map((c) => c.finalImageDataUrl));
  imageHistory.forEach((batch) => {
    batch.concepts.forEach((c) => {
      if (!activeUrls.has(c.finalImageDataUrl)) {
        activeUrls.add(c.finalImageDataUrl);
        items.push({
          id: `hist_${batch.id}_${c.id}`,
          kind: "image",
          title: `${c.title} (History · ${c.visualStyle})`,
          subtitle: `${c.aspectRatio} · ${new Date(batch.createdAt).toLocaleTimeString()}`,
          url: c.finalImageDataUrl,
          filename: `${baseSlug}-history-${c.conceptIndex + 1}.png`,
          formatLabel: "PNG",
          isTikTokVertical: c.aspectRatio === "9:16",
        });
      }
    });
  });

  // Prioritize TikTok 9:16 vertical assets at top
  const sorted = [...items].sort(
    (a, b) => Number(b.isTikTokVertical) - Number(a.isTikTokVertical)
  );

  const visible = sorted.filter((it) => {
    if (filterKind === "all") return true;
    if (filterKind === "images") return it.kind === "image";
    if (filterKind === "videos") return it.kind === "video";
    return it.kind === "audio";
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Export Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Download TikTok-ready vertical 9:16 videos, product ad concepts,
            transparent cutouts, and copy bundles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {analysis && (
            <button
              type="button"
              onClick={() => void copyCaptionBundle()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap"
            >
              {copiedCopyPack ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied Caption &amp; Hashtags
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Caption &amp; Hashtags
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate("projects")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Saved Project Files
          </button>
        </div>
      </div>

      {/* Filter & Filename Prefix Bar */}
      <div className="rounded-2xl border border-slate-800 bg-[#121824] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B0F17] border border-slate-800">
          {(
            [
              { id: "all", label: `All Assets (${items.length})` },
              {
                id: "videos",
                label: `Videos (${items.filter((i) => i.kind === "video").length})`,
              },
              {
                id: "images",
                label: `Images (${items.filter((i) => i.kind === "image").length})`,
              },
              {
                id: "audio",
                label: `Audio (${items.filter((i) => i.kind === "audio").length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterKind(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                filterKind === tab.id
                  ? "bg-rose-600 text-white"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 whitespace-nowrap">
            Export Filename Prefix:
          </label>
          <input
            type="text"
            value={customPrefix}
            onChange={(e) => setCustomPrefix(e.target.value)}
            placeholder={baseSlug}
            className="w-52 rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-1.5 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-[#121824] p-12 text-center space-y-3">
          <Layers className="w-8 h-8 text-slate-600 mx-auto" />
          <div className="text-sm font-semibold text-slate-300">
            No generated assets ready to export yet
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create 9:16 image concepts in Image Studio or render an animated
            commercial video in Video Studio to export files here.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("image_studio")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Go to Image Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visible.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-800 bg-[#121824] overflow-hidden flex flex-col justify-between"
            >
              <div className="aspect-[9/16] bg-[#0B0F17] flex items-center justify-center overflow-hidden p-2">
                {item.kind === "video" ? (
                  <video
                    src={item.url}
                    controls
                    playsInline
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : item.kind === "audio" ? (
                  <div className="p-4 w-full text-center space-y-3">
                    <Mic className="w-8 h-8 text-rose-400 mx-auto" />
                    <audio src={item.url} controls className="w-full" />
                  </div>
                ) : (
                  <img
                    src={item.url}
                    alt={item.title}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="p-4 border-t border-slate-800 space-y-2.5">
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                    <span>{item.formatLabel}</span>
                    {item.isTikTokVertical && (
                      <span className="text-rose-400">TikTok 9:16 Ready</span>
                    )}
                  </div>
                  <h2 className="font-display text-sm font-semibold text-white truncate mt-0.5">
                    {item.title}
                  </h2>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {item.subtitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => triggerDownload(item.url, item.filename)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                >
                  {item.kind === "video" ? (
                    <Film className="w-3.5 h-3.5" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Download {item.formatLabel}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
