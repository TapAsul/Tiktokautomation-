import React, { useEffect, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  Layers,
  Pause,
  Play,
  RefreshCw,
  SlidersHorizontal,
  UserCheck,
} from "lucide-react";
import type {
  BackdropPreset,
  CutoutResult,
  GeneratedVideoResult,
  PipelineStep,
  PresentationMode,
  ProductAnalysis,
  VideoStylePreset,
} from "../types/studio";
import { BACKDROP_THEMES } from "../utils/backgroundRemover";

interface VideoPreviewStageProps {
  analysis: ProductAnalysis | null;
  cutout: CutoutResult | null;
  video: GeneratedVideoResult | null;
  step: PipelineStep;
  renderProgress: number;
  backdrop: BackdropPreset;
  videoStyle: VideoStylePreset;
  presentationMode: PresentationMode;
  sensitivity: number;
  onChangeBackdrop: (backdrop: BackdropPreset) => void;
  onChangeVideoStyle: (style: VideoStylePreset) => void;
  onChangePresentationMode: (mode: PresentationMode) => void;
  onChangeSensitivity: (val: number) => void;
  onReRenderVideo: () => void;
}

type StageTab = "video" | "ugc_image" | "studio" | "cutout";

export const VideoPreviewStage: React.FC<VideoPreviewStageProps> = ({
  analysis,
  cutout,
  video,
  step,
  renderProgress,
  backdrop,
  videoStyle,
  presentationMode,
  sensitivity,
  onChangeBackdrop,
  onChangeVideoStyle,
  onChangePresentationMode,
  onChangeSensitivity,
  onReRenderVideo,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pendingPlayRef = useRef(false);
  const [activeTab, setActiveTab] = useState<StageTab>("video");
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [cutout?.studioImageDataUrl, cutout?.cutoutDataUrl, activeTab]);

  useEffect(() => {
    if (video?.videoUrl) {
      setActiveTab("video");
      setIsPlaying(false);
    }
  }, [video?.videoUrl]);

  useEffect(() => {
    if (activeTab === "video" && pendingPlayRef.current && videoRef.current) {
      pendingPlayRef.current = false;
      void videoRef.current.play().catch(() => {});
    }
  }, [activeTab]);

  const togglePlay = async () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused || el.ended) {
      try {
        await el.play();
      } catch {
        // ignore autoplay restriction
      }
    } else {
      el.pause();
    }
  };

  const isBusy =
    step === "analyzing" ||
    step === "removing_bg" ||
    step === "voiceover" ||
    step === "rendering_video";

  const safeFileSlug = (analysis?.productName || "tiktok-shop-product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <section
      id="video-stage"
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 lg:h-full"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Showcase Media Stage
          </h2>
          <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
            {video
              ? `9:16 Vertical · ${video.durationSec.toFixed(1)}s · ${video.extension.toUpperCase()}`
              : "720×1280 · 30fps · TikTok Shop Ready"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab("video")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === "video"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Video
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ugc_image")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === "ugc_image"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Creator Look
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("studio")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === "studio"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cutout")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === "cutout"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Cutout
          </button>
        </div>
      </div>

      {/* Main 9:16 Media Viewport */}
      <div className="mt-4 flex flex-col items-center">
        <div className="relative w-full max-w-[330px] aspect-[9/16] rounded-xl overflow-hidden bg-slate-950 border border-slate-200 flex items-center justify-center">
          {activeTab === "video" && video && !isBusy && (
            <>
              <video
                ref={videoRef}
                key={video.videoUrl}
                src={video.videoUrl}
                poster={cutout?.ugcTryOnDataUrl || cutout?.studioImageDataUrl}
                controls
                playsInline
                loop
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-cover"
              />
              {!isPlaying && (
                <button
                  type="button"
                  aria-label="Play generated video"
                  onClick={() => void togglePlay()}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/35 hover:bg-slate-950/25 transition-colors cursor-pointer"
                >
                  <span className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105">
                    <Play className="w-7 h-7 fill-current ml-0.5" />
                  </span>
                  <span className="mt-2.5 px-3 py-1 rounded-md bg-slate-950/75 text-white text-xs font-semibold">
                    Play Video
                  </span>
                </button>
              )}
              {showSafeZone && (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
                  <div className="h-12 border border-dashed border-amber-400/80 bg-amber-500/10 rounded flex items-center justify-center">
                    <span className="text-[10px] font-mono text-amber-200">
                      TikTok Top Search / Following Zone
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex-1 h-24 border border-dashed border-amber-400/80 bg-amber-500/10 rounded p-2 flex items-end">
                      <span className="text-[10px] font-mono text-amber-200">
                        Caption & Yellow Basket Overlay
                      </span>
                    </div>
                    <div className="w-11 h-44 border border-dashed border-amber-400/80 bg-amber-500/10 rounded flex items-center justify-center">
                      <span className="text-[9px] font-mono text-amber-200 -rotate-90 whitespace-nowrap">
                        Like / Share
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "video" && !video && cutout && !isBusy && (
            <div className="p-6 text-center text-slate-300 flex flex-col items-center">
              <Film className="w-8 h-8 mb-2 text-slate-400" />
              <p className="text-sm font-semibold">Video ready to render</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Click below to encode your 9:16 TikTok Shop showcase video.
              </p>
              <button
                type="button"
                onClick={onReRenderVideo}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Render 9:16 Video
              </button>
            </div>
          )}

          {activeTab === "ugc_image" && cutout?.ugcTryOnDataUrl && !isBusy && (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
              {!imgError ? (
                <img
                  src={cutout.ugcTryOnDataUrl}
                  alt={analysis?.productName || "Creator wearing product"}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <UserCheck className="w-8 h-8 mb-2" />
                  <span className="text-xs font-medium">
                    Creator preview unavailable
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === "studio" && cutout && !isBusy && (
            <div className="w-full h-full bg-slate-100 flex items-center justify-center">
              {!imgError ? (
                <img
                  src={cutout.studioImageDataUrl}
                  alt={analysis?.productName || "Studio product showcase"}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
                  <ImageIcon className="w-8 h-8 mb-2" />
                  <span className="text-xs font-medium">
                    Studio preview unavailable
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === "cutout" && cutout && !isBusy && (
            <div className="w-full h-full bg-checkerboard flex items-center justify-center p-6">
              {!imgError ? (
                <img
                  src={cutout.cutoutDataUrl}
                  alt={analysis?.productName || "Background removed cutout"}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="max-w-full max-h-full object-contain drop-shadow-md"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
                  <Layers className="w-8 h-8 mb-2" />
                  <span className="text-xs font-medium">
                    Cutout preview unavailable
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Loading / Pipeline State */}
          {isBusy && (
            <div className="absolute inset-0 bg-slate-950/90 text-white flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-rose-500 animate-spin mb-4" />
              <p className="font-display text-base font-semibold">
                {step === "analyzing" && "Reading product & Tagalog hooks"}
                {step === "removing_bg" && "Removing background & fitting creator"}
                {step === "voiceover" && "Recording Tagalog creator voiceover"}
                {step === "rendering_video" && "Rendering 9:16 UGC creator video"}
              </p>
              <p className="text-xs text-slate-400 mt-1.5 font-mono tabular-nums">
                {step === "rendering_video"
                  ? `${renderProgress}% encoded`
                  : "Automated pipeline running"}
              </p>
            </div>
          )}

          {/* Empty State */}
          {!isBusy && !video && !cutout && (
            <div className="p-8 text-center text-slate-400">
              <Film className="w-9 h-9 mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-300">
                9:16 Product Video Stage
              </p>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Drop any product screenshot above and click Generate Showcase Kit
                to create a 9:16 video with studio background, captions, CTA,
                and voiceover.
              </p>
            </div>
          )}
        </div>

        {/* Safe Zone Toggle */}
        {activeTab === "video" && video && !isBusy && (
          <button
            type="button"
            onClick={() => setShowSafeZone((v) => !v)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            {showSafeZone ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Hide TikTok UI safe zones
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                Preview TikTok UI safe zones
              </>
            )}
          </button>
        )}
      </div>

      {/* Play & Download Actions */}
      <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
        {video && !isBusy && (
          <button
            type="button"
            onClick={() => {
              if (activeTab !== "video") {
                pendingPlayRef.current = true;
                setActiveTab("video");
              } else {
                void togglePlay();
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            {isPlaying && activeTab === "video" ? (
              <>
                <Pause className="w-4 h-4" />
                Pause Video Preview
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Play Video Preview
              </>
            )}
          </button>
        )}

        <button
          type="button"
          disabled={!video || isBusy}
          onClick={() =>
            video &&
            triggerDownload(
              video.videoUrl,
              `${safeFileSlug}-tiktok-shop.${video.extension}`
            )
          }
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          Download Edited Video ({video ? video.extension.toUpperCase() : "9:16"})
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!cutout?.ugcTryOnDataUrl || isBusy}
            onClick={() =>
              cutout?.ugcTryOnDataUrl &&
              triggerDownload(
                cutout.ugcTryOnDataUrl,
                `${safeFileSlug}-creator-look.jpg`
              )
            }
            className="flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Creator Look
          </button>
          <button
            type="button"
            disabled={!cutout || isBusy}
            onClick={() =>
              cutout &&
              triggerDownload(
                cutout.studioImageDataUrl,
                `${safeFileSlug}-studio.png`
              )
            }
            className="flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Studio
          </button>
          <button
            type="button"
            disabled={!cutout || isBusy}
            onClick={() =>
              cutout &&
              triggerDownload(cutout.cutoutDataUrl, `${safeFileSlug}-cutout.png`)
            }
            className="flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Cutout PNG
          </button>
        </div>

        <a
          href="https://flow.google"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
        >
          Open Google Flow
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Studio & Presenter Adjustments */}
      {analysis && (
        <div className="mt-5 pt-4 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              Video Format & Adjustments
            </span>
            <button
              type="button"
              disabled={isBusy || !cutout}
              onClick={onReRenderVideo}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3 h-3" />
              Re-render Video
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Studio Backdrop
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(BACKDROP_THEMES) as BackdropPreset[]).map(
                (key) => {
                  const theme = BACKDROP_THEMES[key];
                  const active = backdrop === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={isBusy}
                      onClick={() => onChangeBackdrop(key)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-sm border border-black/15 shrink-0"
                        style={{ backgroundColor: theme.midColor }}
                      />
                      <span className="truncate">{theme.label}</span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Camera Motion
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "minimal", label: "Minimal" },
                  { id: "energetic", label: "High-Energy" },
                  { id: "editorial", label: "Editorial" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onChangeVideoStyle(item.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    videoStyle === item.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-slate-500">
                Background Cutout Edge Sensitivity
              </span>
              <span className="font-mono tabular-nums text-slate-700">
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
              className="w-full accent-slate-900 cursor-pointer"
            />
          </div>
        </div>
      )}
    </section>
  );
};
