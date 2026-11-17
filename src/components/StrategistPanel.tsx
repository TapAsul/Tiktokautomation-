import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Hash,
  Mic,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Volume2,
} from "lucide-react";
import type {
  ContentLanguage,
  PipelineStep,
  ProductAnalysis,
  StrategistTone,
  ViralHook,
} from "../types/studio";

interface StrategistPanelProps {
  analysis: ProductAnalysis | null;
  selectedHookId: string | null;
  voiceoverUrl: string | null;
  voiceoverError: string | null;
  tone: StrategistTone;
  language: ContentLanguage;
  step: PipelineStep;
  isRegeneratingCopy: boolean;
  onSelectHook: (hook: ViralHook) => void;
  onUpdateCaption: (caption: string) => void;
  onUpdateVoiceoverText: (text: string) => void;
  onUpdateGoogleFlowPrompt: (prompt: string) => void;
  onUpdateBackgroundPrompt: (prompt: string) => void;
  onRegenerateVoiceoverAndVideo: () => void;
  onRegenerateCopy: (customPrompt?: string) => void;
}

export const StrategistPanel: React.FC<StrategistPanelProps> = ({
  analysis,
  selectedHookId,
  voiceoverUrl,
  voiceoverError,
  language,
  step,
  isRegeneratingCopy,
  onSelectHook,
  onUpdateCaption,
  onUpdateVoiceoverText,
  onUpdateGoogleFlowPrompt,
  onUpdateBackgroundPrompt,
  onRegenerateVoiceoverAndVideo,
  onRegenerateCopy,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customAngleNote, setCustomAngleNote] = useState("");

  const isBusy =
    step === "analyzing" ||
    step === "removing_bg" ||
    step === "voiceover" ||
    step === "rendering_video";

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  if (!analysis && step === "analyzing") {
    return (
      <section
        id="strategist-copy"
        className="rounded-xl border border-slate-200 bg-white p-6 space-y-5 lg:h-full"
      >
        <div className="h-6 w-56 bg-slate-100 rounded animate-pulse" />
        <div className="h-20 w-full bg-slate-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 gap-3">
          <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="h-36 w-full bg-slate-100 rounded-lg animate-pulse" />
      </section>
    );
  }

  if (!analysis) {
    return (
      <section
        id="strategist-copy"
        className="rounded-xl border border-slate-200 bg-white p-8 flex flex-col justify-center lg:h-full"
      >
        <div className="max-w-lg">
          <h2 className="font-display text-xl font-semibold text-slate-900">
            TikTok Shop Content Strategist
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Once you upload a product screenshot and generate your kit, this
            workspace produces ready-to-paste copy in{" "}
            <strong>
              {language === "tagalog" ? "Tagalog / Taglish" : "English"}
            </strong>{" "}
            engineered for TikTok Shop conversion:
          </p>
          <ul className="mt-5 space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-2.5">
              <TrendingUp className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <span>
                <strong>Competitive Market Angle</strong> — how to position this
                product against competing TikTok Shop listings.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Target className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <span>
                <strong>3 Viral 0–3s Hooks</strong> — switch between curiosity,
                problem-agitation, or social-proof video openers in one click.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Copy className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <span>
                <strong>Store-Ready Caption &amp; Hashtags</strong> — formatted for
                immediate copy-paste into your TikTok Shop post.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <span>
                <strong>Google Flow Prompt</strong> — auto-writes a ready-to-paste
                video prompt from your picture so you can run it straight in{" "}
                <a
                  href="https://flow.google"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-rose-600 hover:text-rose-700 underline underline-offset-2"
                >
                  Google Flow
                </a>
                .
              </span>
            </li>
          </ul>
          <div className="mt-6">
            <a
              href="https://flow.google"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Open Google Flow
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>
    );
  }

  const { strategist } = analysis;
  const fullHashtags = strategist.hashtags
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const fullStorePost = `${strategist.caption}\n\n${fullHashtags}`;

  return (
    <section
      id="strategist-copy"
      className="rounded-xl border border-slate-200 bg-white p-6 space-y-6 lg:h-full"
    >
      {/* Header & Product Summary */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{analysis.category}</span>
            <span aria-hidden="true">·</span>
            <span>{analysis.targetAudience}</span>
          </div>
          <h2 className="font-display text-xl font-semibold text-slate-900 mt-1">
            {analysis.productName}
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">{analysis.shortTagline}</p>
        </div>

        <button
          type="button"
          onClick={() => copyText("full_post", fullStorePost)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {copiedKey === "full_post" ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Copied Caption + Tags
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy Full Store Post
            </>
          )}
        </button>
      </div>

      {/* Google Flow Prompt + Direct Link */}
      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <Sparkles className="w-3.5 h-3.5 text-rose-600" />
              Google Flow Video Prompt (Auto-Generated from Picture)
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Copy this prompt, open Google Flow, and paste it with your product
              image.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                copyText("flow_prompt", strategist.googleFlowPrompt || "")
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedKey === "flow_prompt" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copied Prompt
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Prompt
                </>
              )}
            </button>
            <a
              href="https://flow.google"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Open Google Flow
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <textarea
          id="google-flow-prompt-editor"
          rows={3}
          value={strategist.googleFlowPrompt || ""}
          onChange={(e) => onUpdateGoogleFlowPrompt(e.target.value)}
          placeholder="Google Flow video prompt generated from your product image..."
          className="w-full rounded-lg border border-rose-200/80 bg-white p-2.5 text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
        />
      </div>

      {/* Commercial Set Designer Background Image Prompt */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <Sparkles className="w-3.5 h-3.5 text-slate-700" />
              Niche Background Image Prompt (No Product · Center Space)
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Photorealistic 8k bokeh background prompt tailored to your product
              vibe for foreground cutout blending.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              copyText("bg_prompt", strategist.backgroundPrompt || "")
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {copiedKey === "bg_prompt" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Copied Prompt
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Prompt
              </>
            )}
          </button>
        </div>

        <textarea
          id="background-prompt-editor"
          rows={3}
          value={strategist.backgroundPrompt || ""}
          onChange={(e) => onUpdateBackgroundPrompt(e.target.value)}
          placeholder="Photorealistic bokeh background prompt generated from your product niche..."
          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
        />
      </div>

      {/* Competitive Market Angle */}
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
          Competitive Positioning Angle
        </div>
        <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">
          {strategist.competitiveAngle}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {analysis.keyBenefits.map((benefit, idx) => (
            <span key={idx}>• {benefit}</span>
          ))}
        </div>
      </div>

      {/* 3 Viral Hooks Selector */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-semibold text-slate-900">
            0–3s Viral Video Hooks
          </h3>
          <span className="text-xs text-slate-500">
            Click a hook to apply to video overlay
          </span>
        </div>

        <div className="space-y-2">
          {strategist.hooks.map((hook) => {
            const isSelected = selectedHookId === hook.id;
            return (
              <div
                key={hook.id}
                onClick={() => onSelectHook(hook)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectHook(hook);
                  }
                }}
                className={`rounded-lg border p-3.5 transition-colors cursor-pointer ${
                  isSelected
                    ? "border-rose-600 bg-rose-50/40"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    {hook.style}
                    {isSelected && " · Active in Video"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyText(`hook_${hook.id}`, hook.spokenLine);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {copiedKey === `hook_${hook.id}` ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  “{hook.onScreenText}”
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Spoken: {hook.spokenLine}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editable Store Caption */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="tiktok-caption-editor"
            className="text-sm font-semibold text-slate-900"
          >
            TikTok Shop Caption (Ready to Paste)
          </label>
          <button
            type="button"
            onClick={() => copyText("caption_only", strategist.caption)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            {copiedKey === "caption_only" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Copied Caption
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Caption
              </>
            )}
          </button>
        </div>

        <textarea
          id="tiktok-caption-editor"
          rows={5}
          value={strategist.caption}
          onChange={(e) => onUpdateCaption(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
        />
      </div>

      {/* Hashtag Stack */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-slate-500" />
            Buyer-Intent Hashtags
          </span>
          <button
            type="button"
            onClick={() => copyText("hashtags_only", fullHashtags)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            {copiedKey === "hashtags_only" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Copied Tags
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Hashtags
              </>
            )}
          </button>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs font-mono text-slate-700 leading-relaxed">
          {fullHashtags}
        </div>
      </div>

      {/* AI Voiceover Script & Audio */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-slate-500" />
            Voiceover Script & Beat Overlays
          </span>
          <button
            type="button"
            disabled={isBusy}
            onClick={onRegenerateVoiceoverAndVideo}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3 h-3" />
            Re-voice & Render Video
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-slate-200 p-2.5">
            <div className="text-slate-400 font-mono">01 · Hook</div>
            <div className="font-semibold text-slate-800 mt-0.5">
              {strategist.videoScript.beat1Hook}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-2.5">
            <div className="text-slate-400 font-mono">02 · Benefit</div>
            <div className="font-semibold text-slate-800 mt-0.5">
              {strategist.videoScript.beat2Benefit}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-2.5">
            <div className="text-slate-400 font-mono">03 · Offer CTA</div>
            <div className="font-semibold text-slate-800 mt-0.5">
              {strategist.videoScript.beat3Offer}
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="voiceover-script-editor"
            className="block text-xs font-medium text-slate-500 mb-1"
          >
            Spoken Voiceover Script (Editable)
          </label>
          <textarea
            id="voiceover-script-editor"
            rows={2}
            value={strategist.videoScript.voiceoverText}
            onChange={(e) => onUpdateVoiceoverText(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
          />
        </div>

        {voiceoverUrl && (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <Volume2 className="w-4 h-4 text-slate-600 shrink-0" />
            <audio src={voiceoverUrl} controls className="h-8 w-full" />
          </div>
        )}

        {voiceoverError && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
            <span>Voiceover notice: {voiceoverError}</span>
          </div>
        )}
      </div>

      {/* Refresh Copy with Optional Market Note */}
      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={customAngleNote}
          onChange={(e) => setCustomAngleNote(e.target.value)}
          placeholder="Optional promo note (e.g. 50% off flash sale, free shipping PH)..."
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
        />
        <button
          type="button"
          disabled={isRegeneratingCopy}
          onClick={() => onRegenerateCopy(customAngleNote)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRegeneratingCopy ? "animate-spin" : ""}`}
          />
          {isRegeneratingCopy ? "Refreshing..." : "Refresh Strategy"}
        </button>
      </div>
    </section>
  );
};
