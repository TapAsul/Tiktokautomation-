import React, { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Hash,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type {
  CampaignType,
  ContentLanguage,
  ProductAnalysis,
  StrategistCopy,
  StrategistTone,
  StudioSection,
  ViralHook,
  VoiceName,
  VoiceoverDeliveryStyle,
  VoiceoverLanguageMode,
  VoiceoverPace,
} from "../types/studio";
import { TagalogVoiceoverPanel } from "./TagalogVoiceoverPanel";

export type CopyRegenScope = "all" | "hooks" | "headlines" | "caption";

interface CopywriterViewProps {
  analysis: ProductAnalysis | null;
  language: ContentLanguage;
  tone: StrategistTone;
  campaignType: CampaignType;
  pricePromo: string;
  verifiedDiscounts: string;
  targetAudience: string;
  campaignObjectives: string;
  productDetails: string;
  selectedHookId: string | null;
  voiceName: VoiceName;
  voiceoverLangMode: VoiceoverLanguageMode;
  voiceoverStyle: VoiceoverDeliveryStyle;
  voiceoverPace: VoiceoverPace;
  voiceoverUrl: string | null;
  voiceoverError: string | null;
  isGeneratingVoiceScript: boolean;
  isRegeneratingCopy: boolean;
  isSynthesizingVoiceover: boolean;
  onChangeLanguage: (val: ContentLanguage) => void;
  onChangeTone: (val: StrategistTone) => void;
  onChangePricePromo: (val: string) => void;
  onChangeVerifiedDiscounts: (val: string) => void;
  onChangeTargetAudience: (val: string) => void;
  onChangeCampaignObjectives: (val: string) => void;
  onChangeProductDetails: (val: string) => void;
  onChangeVoiceName: (v: VoiceName) => void;
  onChangeVoiceoverLangMode: (m: VoiceoverLanguageMode) => void;
  onChangeVoiceoverStyle: (s: VoiceoverDeliveryStyle) => void;
  onChangeVoiceoverPace: (p: VoiceoverPace) => void;
  onUpdateAnalysis: (next: ProductAnalysis) => void;
  onSelectHook: (hook: ViralHook) => void;
  onRegenerateCopy: (
    customDirection?: string,
    scope?: CopyRegenScope,
    standaloneBrief?: {
      productName: string;
      category: string;
      benefitsText: string;
    }
  ) => void;
  onGenerateVoiceoverScript: () => void;
  onSynthesizeVoiceover: () => void;
  onNavigate: (section: StudioSection) => void;
}

export const CopywriterView: React.FC<CopywriterViewProps> = ({
  analysis,
  language,
  tone,
  pricePromo,
  verifiedDiscounts,
  targetAudience,
  campaignObjectives,
  productDetails,
  selectedHookId,
  voiceName,
  voiceoverLangMode,
  voiceoverStyle,
  voiceoverPace,
  voiceoverUrl,
  voiceoverError,
  isGeneratingVoiceScript,
  isRegeneratingCopy,
  isSynthesizingVoiceover,
  onChangeLanguage,
  onChangeTone,
  onChangePricePromo,
  onChangeVerifiedDiscounts,
  onChangeTargetAudience,
  onChangeCampaignObjectives,
  onChangeProductDetails,
  onChangeVoiceName,
  onChangeVoiceoverLangMode,
  onChangeVoiceoverStyle,
  onChangeVoiceoverPace,
  onUpdateAnalysis,
  onSelectHook,
  onRegenerateCopy,
  onGenerateVoiceoverScript,
  onSynthesizeVoiceover,
  onNavigate,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customDirection, setCustomDirection] = useState("");
  const [standaloneName, setStandaloneName] = useState("");
  const [standaloneCategory, setStandaloneCategory] = useState("Skincare");
  const [standaloneBenefits, setStandaloneBenefits] = useState("");

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  if (!analysis) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              AI Ad Copywriter
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Generate conversion-focused hooks, headlines, TikTok captions,
              hashtags, CTAs, and voiceover scripts anchored strictly to factual
              inputs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("image_studio")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap"
          >
            <ImageIcon className="w-3.5 h-3.5 text-rose-400" />
            Analyze Photo in Image Studio
          </button>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-[#121824] p-6 space-y-5 max-w-3xl">
          <div className="flex items-start gap-3 pb-4 border-b border-slate-800">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Generate Copy Directly from Verified Product Brief
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                AI will never invent prices, discounts, customer testimonials, or
                unverified specifications. Leave price/discount blank if not
                applicable.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Product Name
              </label>
              <input
                type="text"
                value={standaloneName}
                onChange={(e) => setStandaloneName(e.target.value)}
                placeholder="e.g. Aurora Vitamin C Brightening Serum"
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Category
              </label>
              <input
                type="text"
                value={standaloneCategory}
                onChange={(e) => setStandaloneCategory(e.target.value)}
                placeholder="e.g. Skincare, Apparel, Tech Accessories"
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Language
              </label>
              <select
                value={language}
                onChange={(e) =>
                  onChangeLanguage(e.target.value as ContentLanguage)
                }
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white"
              >
                <option value="tagalog">Tagalog (TikTok PH)</option>
                <option value="english">English (Global)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Copy Tone
              </label>
              <select
                value={tone}
                onChange={(e) => onChangeTone(e.target.value as StrategistTone)}
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white"
              >
                <option value="viral_urgency">Viral Urgency</option>
                <option value="problem_solution">Problem-Solution</option>
                <option value="clean_aesthetic">Clean Aesthetic</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Verified Price (Optional)
              </label>
              <input
                type="text"
                value={pricePromo}
                onChange={(e) => onChangePricePromo(e.target.value)}
                placeholder="Leave blank if no confirmed price"
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Verified Discounts / Promos (Optional)
              </label>
              <input
                type="text"
                value={verifiedDiscounts}
                onChange={(e) => onChangeVerifiedDiscounts(e.target.value)}
                placeholder="e.g. Payday voucher if confirmed"
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Factual Product Benefits &amp; Details
            </label>
            <textarea
              rows={3}
              value={standaloneBenefits}
              onChange={(e) => setStandaloneBenefits(e.target.value)}
              placeholder="List genuine materials, ingredients, sizes, or verified product features..."
              className="w-full rounded-xl border border-slate-800 bg-[#0B0F17] p-3 text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!standaloneName.trim() || isRegeneratingCopy}
              onClick={() =>
                onRegenerateCopy(customDirection, "all", {
                  productName: standaloneName.trim(),
                  category: standaloneCategory.trim() || "Consumer Goods",
                  benefitsText: standaloneBenefits.trim(),
                })
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs sm:text-sm font-semibold cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isRegeneratingCopy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Ad Copy...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Truthful Ad Copy
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    );
  }

  const { strategist } = analysis;
  const fullHashtags = strategist.hashtags
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const fullPost = `${strategist.caption}\n\n${fullHashtags}`;

  const updateStrategist = (patch: Partial<StrategistCopy>) => {
    onUpdateAnalysis({
      ...analysis,
      strategist: { ...strategist, ...patch },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            AI Ad Copywriter
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Factual TikTok ad scripts, hooks, headlines, captions, hashtags,
            and voiceover for{" "}
            <span className="text-white font-semibold">
              {analysis.productName}
            </span>
            . Zero fabricated pricing or claims.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => copyText("full_post", fullPost)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap"
          >
            {copiedKey === "full_post" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied Caption &amp; Tags
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Caption Pack
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isRegeneratingCopy}
            onClick={() => onRegenerateCopy(customDirection, "all")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRegeneratingCopy ? "animate-spin" : ""}`}
            />
            Regenerate All Copy
          </button>
        </div>
      </div>

      {/* Truthfulness Guard & Grounded Inputs Bar */}
      <section className="rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Copy Language
            </label>
            <select
              value={language}
              onChange={(e) =>
                onChangeLanguage(e.target.value as ContentLanguage)
              }
              className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white"
            >
              <option value="tagalog">Tagalog (TikTok PH)</option>
              <option value="english">English (Global)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Advertising Tone
            </label>
            <select
              value={tone}
              onChange={(e) => onChangeTone(e.target.value as StrategistTone)}
              className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white"
            >
              <option value="viral_urgency">Viral Urgency</option>
              <option value="problem_solution">Problem-Solution</option>
              <option value="clean_aesthetic">Clean Aesthetic</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Verified Price (Optional)
            </label>
            <input
              type="text"
              value={pricePromo}
              onChange={(e) => onChangePricePromo(e.target.value)}
              placeholder="Never invented if blank"
              className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Verified Discounts (Optional)
            </label>
            <input
              type="text"
              value={verifiedDiscounts}
              onChange={(e) => onChangeVerifiedDiscounts(e.target.value)}
              placeholder="Only confirmed promos..."
              className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => onChangeTargetAudience(e.target.value)}
            placeholder={`Target audience (${analysis.targetAudience || "e.g. Skincare buyers"})`}
            className="rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
          />
          <input
            type="text"
            value={campaignObjectives}
            onChange={(e) => onChangeCampaignObjectives(e.target.value)}
            placeholder="Campaign objective (e.g. Yellow basket conversions)"
            className="rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
          />
          <input
            type="text"
            value={customDirection}
            onChange={(e) => setCustomDirection(e.target.value)}
            placeholder="Optional revision note (e.g. funnier opening hook)..."
            className="rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
          />
        </div>
      </section>

      {/* 3 Hooks & 3 Headlines + CTAs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <h2 className="font-display text-base font-semibold text-white">
              3 Attention-Grabbing Hooks
            </h2>
            <button
              type="button"
              disabled={isRegeneratingCopy}
              onClick={() => onRegenerateCopy(customDirection, "hooks")}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer disabled:opacity-50"
            >
              Regenerate Hooks
            </button>
          </div>

          <div className="space-y-3">
            {strategist.hooks.map((hook) => {
              const active = selectedHookId === hook.id;
              return (
                <div
                  key={hook.id}
                  onClick={() => onSelectHook(hook)}
                  className={`rounded-xl border p-3.5 cursor-pointer transition-colors ${
                    active
                      ? "border-rose-500 bg-rose-500/10"
                      : "border-slate-800 bg-[#0B0F17] hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold">
                      {hook.style} {active ? "· Active Video Hook" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyText(`hk_${hook.id}`, hook.onScreenText);
                      }}
                      className="text-slate-300 hover:text-white cursor-pointer"
                    >
                      {copiedKey === `hk_${hook.id}` ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-white mt-1">
                    “{hook.onScreenText}”
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Spoken: {hook.spokenLine}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <h2 className="font-display text-base font-semibold text-white">
              3 Advertising Headlines &amp; CTAs
            </h2>
            <button
              type="button"
              disabled={isRegeneratingCopy}
              onClick={() => onRegenerateCopy(customDirection, "headlines")}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer disabled:opacity-50"
            >
              Regenerate Headlines
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              Headlines
            </div>
            {(
              strategist.headlines || [
                analysis.shortTagline,
                analysis.productName,
                strategist.videoScript.beat2Benefit,
              ]
            ).map((hl, i) => (
              <input
                key={i}
                type="text"
                value={hl}
                onChange={(e) => {
                  const next = [
                    ...(strategist.headlines || [
                      analysis.shortTagline,
                      analysis.productName,
                      strategist.videoScript.beat2Benefit,
                    ]),
                  ];
                  next[i] = e.target.value;
                  updateStrategist({ headlines: next });
                }}
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="text-xs font-semibold text-slate-300">
              Calls to Action (CTAs)
            </div>
            {(
              strategist.ctaSuggestions || [
                strategist.videoScript.beat3Offer,
                "Check details in the yellow basket",
                "Tap below to see available options",
              ]
            ).map((cta, i) => (
              <input
                key={i}
                type="text"
                value={cta}
                onChange={(e) => {
                  const next = [
                    ...(strategist.ctaSuggestions || [
                      strategist.videoScript.beat3Offer,
                      "Check details in the yellow basket",
                      "Tap below to see available options",
                    ]),
                  ];
                  next[i] = e.target.value;
                  updateStrategist({ ctaSuggestions: next });
                }}
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            ))}
          </div>
        </section>
      </div>

      {/* Product Description + TikTok Caption + Hashtags */}
      <section className="rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <h2 className="font-display text-base font-semibold text-white">
            Product Description, TikTok Caption &amp; Hashtags
          </h2>
          <button
            type="button"
            disabled={isRegeneratingCopy}
            onClick={() => onRegenerateCopy(customDirection, "caption")}
            className="text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer disabled:opacity-50"
          >
            Regenerate Caption &amp; Tags
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Product Description
              </label>
              <textarea
                rows={4}
                value={
                  strategist.productDescription ?? analysis.shortTagline ?? ""
                }
                onChange={(e) =>
                  updateStrategist({ productDescription: e.target.value })
                }
                className="w-full rounded-xl border border-slate-800 bg-[#0B0F17] p-3 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  Relevant Hashtags
                </span>
                <button
                  type="button"
                  onClick={() => copyText("tags", fullHashtags)}
                  className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  {copiedKey === "tags" ? "Copied" : "Copy Tags"}
                </button>
              </div>
              <input
                type="text"
                value={fullHashtags}
                onChange={(e) =>
                  updateStrategist({
                    hashtags: e.target.value
                      .split(/\s+/)
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                TikTok Caption
              </label>
              <button
                type="button"
                onClick={() => copyText("cap", strategist.caption)}
                className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
              >
                {copiedKey === "cap" ? "Copied Caption" : "Copy Caption"}
              </button>
            </div>
            <textarea
              rows={7}
              value={strategist.caption}
              onChange={(e) => updateStrategist({ caption: e.target.value })}
              className="w-full rounded-xl border border-slate-800 bg-[#0B0F17] p-3 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>
      </section>

      {/* Tagalog Voiceover Options + Google Flow Prompt */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TagalogVoiceoverPanel
          scriptText={strategist.videoScript.voiceoverText}
          voiceName={voiceName}
          languageMode={voiceoverLangMode}
          deliveryStyle={voiceoverStyle}
          pace={voiceoverPace}
          voiceoverUrl={voiceoverUrl}
          voiceoverError={voiceoverError}
          isGeneratingScript={isGeneratingVoiceScript}
          isSynthesizing={isSynthesizingVoiceover}
          canGenerateScript={Boolean(analysis)}
          onChangeScript={(next) =>
            updateStrategist({
              videoScript: {
                ...strategist.videoScript,
                voiceoverText: next,
              },
            })
          }
          onChangeVoiceName={onChangeVoiceName}
          onChangeLanguageMode={onChangeVoiceoverLangMode}
          onChangeDeliveryStyle={onChangeVoiceoverStyle}
          onChangePace={onChangeVoiceoverPace}
          onGenerateScript={onGenerateVoiceoverScript}
          onSynthesize={onSynthesizeVoiceover}
        />

        <section className="rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              Google Flow Tagalog / Viral Hook Prompt
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  copyText("flow", strategist.googleFlowPrompt || "")
                }
                className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
              >
                {copiedKey === "flow" ? "Copied" : "Copy Prompt"}
              </button>
              <a
                href="https://labs.google/fx/tools/flow"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-200 hover:text-white"
              >
                Open Google Flow
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <textarea
            rows={4}
            value={strategist.googleFlowPrompt}
            onChange={(e) =>
              updateStrategist({ googleFlowPrompt: e.target.value })
            }
            className="w-full rounded-xl border border-slate-800 bg-[#0B0F17] p-3 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-rose-500"
          />

          <p className="text-[11px] text-slate-500">
            Note: Also update seller details ({productDetails ? "custom details active" : "no extra specs added"}) above before regenerating copy to inject exact specs.
          </p>
        </section>
      </div>
    </div>
  );
};
