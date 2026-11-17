import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type {
  ModelAvailabilitySnapshot,
  ModelConfigSnapshot,
} from "../types/studio";

interface SettingsViewProps {
  modelConfig: ModelConfigSnapshot | null;
  availability: ModelAvailabilitySnapshot | null;
  isCheckingAvailability: boolean;
  onRefreshAvailability: () => void;
  onUpdateModelConfig: (
    patch: Partial<Omit<ModelConfigSnapshot, "updatedAt">>
  ) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  modelConfig,
  availability,
  isCheckingAvailability,
  onRefreshAvailability,
  onUpdateModelConfig,
}) => {
  const [draft, setDraft] = useState({
    analysisModel: modelConfig?.analysisModel || "gemini-4-hydrogen",
    analysisFallbackModel:
      modelConfig?.analysisFallbackModel || "gemini-3.1-flash-lite",
    imageGenModel: modelConfig?.imageGenModel || "gemini-3.1-flash-lite-image",
    videoGenModel: modelConfig?.videoGenModel || "gemini-omni-1.2-flash",
    ttsModel: modelConfig?.ttsModel || "gemini-3.8-flash-lite-tts",
    ttsFallbackModel: modelConfig?.ttsFallbackModel || "gemini-3.8-flash-tts",
  });
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (modelConfig) {
      setDraft({
        analysisModel: modelConfig.analysisModel,
        analysisFallbackModel: modelConfig.analysisFallbackModel,
        imageGenModel: modelConfig.imageGenModel,
        videoGenModel: modelConfig.videoGenModel,
        ttsModel: modelConfig.ttsModel,
        ttsFallbackModel: modelConfig.ttsFallbackModel,
      });
    }
  }, [modelConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(null);
    try {
      await onUpdateModelConfig(draft);
      setSavedNotice("Model configuration saved on the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Settings &amp; Model Status
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Inspect active Google AI service capabilities and configure server
            model identifiers. Credentials stay strictly server-side.
          </p>
        </div>

        <button
          type="button"
          disabled={isCheckingAvailability}
          onClick={onRefreshAvailability}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-semibold text-slate-100 cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isCheckingAvailability ? "animate-spin" : ""}`}
          />
          {isCheckingAvailability ? "Running Live Probe..." : "Run Live Probe"}
        </button>
      </div>

      {/* Live Service Diagnostics */}
      <section className="rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="font-display text-base font-semibold text-white">
              Environment &amp; Capability Status
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {availability?.keyConfigured
              ? "Server Environment Key Active"
              : "Key Not Detected in Environment"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(availability?.services || []).map((svc) => {
            const isOk = svc.status === "available";
            const isQuota = svc.status === "quota_limited";
            return (
              <div
                key={svc.service}
                className="rounded-xl border border-slate-800 bg-[#0B0F17] p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {svc.label}
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-0.5">
                      {svc.model}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                    {isOk ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">Available</span>
                      </>
                    ) : isQuota ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-300">Quota Limited</span>
                      </>
                    ) : svc.status === "unavailable" ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span className="text-rose-400">Unavailable</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-400">Untested</span>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {svc.note}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Server Model Configuration Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4"
        >
          <div className="pb-3 border-b border-slate-800">
            <h2 className="font-display text-base font-semibold text-white">
              Active Google AI Model Identifiers
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Switch models server-side without modifying code. Supported
              Google AI Studio models only.
            </p>
          </div>

          {savedNotice && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
              {savedNotice}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Product Analysis &amp; Copy Model
              </label>
              <input
                type="text"
                value={draft.analysisModel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, analysisModel: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Analysis Fallback Model
              </label>
              <input
                type="text"
                value={draft.analysisFallbackModel}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    analysisFallbackModel: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Image Generation Model
              </label>
              <select
                value={draft.imageGenModel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, imageGenModel: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              >
                <option value="gemini-3.1-flash-lite-image">
                  gemini-3.1-flash-lite-image (Nano Banana Fast)
                </option>
                <option value="gemini-nano-banana-2.1">
                  gemini-nano-banana-2.1 (Nano Banana 2.1)
                </option>
                <option value="gemini-3-pro-image">
                  gemini-3-pro-image (Nano Banana Pro)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Video Generation Model
              </label>
              <input
                type="text"
                value={draft.videoGenModel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, videoGenModel: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                TTS Voiceover Model
              </label>
              <input
                type="text"
                value={draft.ttsModel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, ttsModel: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                TTS Fallback Model
              </label>
              <input
                type="text"
                value={draft.ttsFallbackModel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, ttsFallbackModel: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Model Configuration"}
            </button>
          </div>
        </form>

        {/* Studio Defaults & Upload Policy */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-white pb-3 border-b border-slate-800">
            Studio Defaults &amp; Security Policy
          </h2>
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/70">
              <dt className="text-slate-400">Default Output Aspect Ratio</dt>
              <dd className="font-mono text-white">9:16 (1080×1920)</dd>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/70">
              <dt className="text-slate-400">Default Preservation Mode</dt>
              <dd className="font-mono text-emerald-400">Exact Product Mode</dd>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/70">
              <dt className="text-slate-400">Accepted Image Formats</dt>
              <dd className="font-mono text-white">PNG, JPG, JPEG, WebP</dd>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/70">
              <dt className="text-slate-400">Max Upload Size</dt>
              <dd className="font-mono text-white tabular-nums">12 MB / image</dd>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <dt className="text-slate-400">Credential Handling</dt>
              <dd className="font-mono text-slate-200">Server-side Environment</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
};
