import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquareQuote,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type {
  GoogleFlowHookAngle,
  GoogleFlowPresenter,
  GoogleFlowPromptOption,
  GoogleFlowScene,
} from "../types/studio";

export const FLOW_PRESENTERS: Array<{
  id: GoogleFlowPresenter;
  label: string;
}> = [
  { id: "pinay_genz", label: "Pinay TikTok Creator (Gen-Z / Millennial)" },
  { id: "pinoy_reviewer", label: "Pinoy Male Reviewer (Relatable Casual)" },
  { id: "mom_home", label: "Filipino Home & Mom Host (Trustworthy)" },
  { id: "luxury_host", label: "Polished Commercial Host (Premium)" },
];

export const FLOW_HOOK_ANGLES: Array<{
  id: GoogleFlowHookAngle;
  label: string;
}> = [
  { id: "curiosity_stop", label: "Huwag Mag-Scroll · Curiosity Hook" },
  { id: "budol_discovery", label: "Grabe, Totoo Nga! · Budol Discovery" },
  { id: "problem_solution", label: "Bago Ka Bumili · Problem-Solution" },
  { id: "sulit_proof", label: "Sulit Ba Talaga? · Real Proof Hook" },
];

export const FLOW_SCENES: Array<{
  id: GoogleFlowScene;
  label: string;
}> = [
  { id: "bedroom_vanity", label: "Bright Bedroom / Vanity" },
  { id: "living_room", label: "Cozy Living Room" },
  { id: "studio_desk", label: "Clean Creator Desk / Studio" },
  { id: "outdoor_sunlit", label: "Sunlit Lifestyle / Cafe" },
];

interface GoogleFlowPromptPanelProps {
  activePrompt: string;
  productNameHint: string;
  presenter: GoogleFlowPresenter;
  hookAngle: GoogleFlowHookAngle;
  scene: GoogleFlowScene;
  options: GoogleFlowPromptOption[];
  isGenerating: boolean;
  errorMsg: string | null;
  onChangePrompt: (next: string) => void;
  onChangePresenter: (p: GoogleFlowPresenter) => void;
  onChangeHookAngle: (h: GoogleFlowHookAngle) => void;
  onChangeScene: (s: GoogleFlowScene) => void;
  onGenerateOptions: (productOverride?: string) => void;
  compact?: boolean;
}

export const GoogleFlowPromptPanel: React.FC<GoogleFlowPromptPanelProps> = ({
  activePrompt,
  productNameHint,
  presenter,
  hookAngle,
  scene,
  options,
  isGenerating,
  errorMsg,
  onChangePrompt,
  onChangePresenter,
  onChangeHookAngle,
  onChangeScene,
  onGenerateOptions,
  compact = false,
}) => {
  const [quickProduct, setQuickProduct] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const effectiveProduct = productNameHint.trim() || quickProduct.trim();

  const copyText = async (key: string, value: string) => {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div
      className={`rounded-xl border border-slate-800 ${
        compact ? "bg-[#121824] p-4" : "bg-[#0B0F17] p-4"
      } space-y-3.5`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
          <UserCheck className="w-4 h-4 text-rose-400" />
          Tagalog Creator Google Flow Prompt Options
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!effectiveProduct || isGenerating}
            onClick={() => onGenerateOptions(quickProduct.trim() || undefined)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-xs font-semibold text-rose-200 cursor-pointer whitespace-nowrap"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            )}
            {isGenerating
              ? "Generating Options..."
              : "Generate 3 Tagalog Flow Prompts"}
          </button>

          <button
            type="button"
            disabled={!activePrompt.trim()}
            onClick={() => void copyText("active", activePrompt)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-[#121824] hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap"
          >
            {copiedKey === "active" ? (
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

          {compact && (
            <a
              href="https://labs.google/fx/tools/flow"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-200 hover:text-white whitespace-nowrap"
            >
              Open Flow
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Product input fallback if no product analyzed yet */}
      {!productNameHint.trim() && (
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            Product to Showcase in Google Flow
          </label>
          <input
            type="text"
            value={quickProduct}
            onChange={(e) => setQuickProduct(e.target.value)}
            placeholder="e.g. Vitamin C Serum, Insulated Tumbler, Wireless Earbuds..."
            className={`w-full rounded-lg border border-slate-800 ${
              compact ? "bg-[#0B0F17]" : "bg-[#121824]"
            } px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500`}
          />
        </div>
      )}

      {/* Presenter + Hook Angle + Scene Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            Tagalog Creator On-Cam
          </label>
          <select
            value={presenter}
            onChange={(e) =>
              onChangePresenter(e.target.value as GoogleFlowPresenter)
            }
            className={`w-full rounded-lg border border-slate-800 ${
              compact ? "bg-[#0B0F17]" : "bg-[#121824]"
            } px-2.5 py-1.5 text-xs text-slate-100`}
          >
            {FLOW_PRESENTERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            Spoken Hook Angle
          </label>
          <select
            value={hookAngle}
            onChange={(e) =>
              onChangeHookAngle(e.target.value as GoogleFlowHookAngle)
            }
            className={`w-full rounded-lg border border-slate-800 ${
              compact ? "bg-[#0B0F17]" : "bg-[#121824]"
            } px-2.5 py-1.5 text-xs text-slate-100`}
          >
            {FLOW_HOOK_ANGLES.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            Filming Setting
          </label>
          <select
            value={scene}
            onChange={(e) => onChangeScene(e.target.value as GoogleFlowScene)}
            className={`w-full rounded-lg border border-slate-800 ${
              compact ? "bg-[#0B0F17]" : "bg-[#121824]"
            } px-2.5 py-1.5 text-xs text-slate-100`}
          >
            {FLOW_SCENES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3 Clickable Tagalog Creator Prompt Options */}
      {options.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Select a Tagalog Buyer-Hook Option
          </div>
          <div className="grid grid-cols-1 gap-2">
            {options.map((opt, idx) => {
              const isSelected = activePrompt.trim() === opt.fullPrompt.trim();
              return (
                <div
                  key={opt.id || idx}
                  onClick={() => onChangePrompt(opt.fullPrompt)}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors space-y-1.5 ${
                    isSelected
                      ? "border-rose-500 bg-rose-500/10"
                      : `border-slate-800 ${
                          compact ? "bg-[#0B0F17]" : "bg-[#121824]"
                        } hover:border-slate-600`
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-white">
                      Option {idx + 1}: {opt.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="text-[10px] font-mono text-emerald-400">
                          Active
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangePrompt(opt.fullPrompt);
                          void copyText(`opt_${idx}`, opt.fullPrompt);
                        }}
                        className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        {copiedKey === `opt_${idx}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="text-xs font-medium text-amber-200 flex items-start gap-1.5">
                    <MessageSquareQuote className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>“{opt.tagalogHookQuote}”</span>
                  </div>

                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    {opt.creatorAction}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Editable Final Google Flow Prompt */}
      <div>
        <label className="block text-[11px] text-slate-400 mb-1">
          Ready-to-Paste Google Flow Prompt
        </label>
        <textarea
          rows={compact ? 4 : 3}
          value={activePrompt}
          onChange={(e) => onChangePrompt(e.target.value)}
          placeholder="Click 'Generate 3 Tagalog Flow Prompts' above to craft Tagalog creator-on-camera prompts with buyer-hooking lines..."
          className={`w-full rounded-lg border border-slate-800 ${
            compact ? "bg-[#0B0F17]" : "bg-[#121824]"
          } p-2.5 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-rose-500`}
        />
      </div>
    </div>
  );
};
