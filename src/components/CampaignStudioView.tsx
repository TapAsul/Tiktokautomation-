import React, { useState } from "react";
import {
  Briefcase,
  Check,
  Clapperboard,
  Copy,
  Download,
  ExternalLink,
  Hash,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";
import type {
  CampaignType,
  ContentLanguage,
  GeneratedVideoResult,
  ImageConceptAsset,
  MotionPreset,
  ProductAnalysis,
  StrategistTone,
  StudioSection,
  ViralHook,
  VoiceName,
  VoiceoverDeliveryStyle,
  VoiceoverLanguageMode,
  VoiceoverPace,
} from "../types/studio";
import type { CopyRegenScope } from "./CopywriterView";
import { TagalogVoiceoverPanel } from "./TagalogVoiceoverPanel";

interface CampaignStudioViewProps {
  projectId: string | null;
  campaignName: string;
  campaignType: CampaignType;
  clientOrBrandName: string;
  notes: string;
  pricePromo: string;
  verifiedDiscounts: string;
  targetAudience: string;
  campaignObjectives: string;
  language: ContentLanguage;
  tone: StrategistTone;
  analysis: ProductAnalysis | null;
  concepts: ImageConceptAsset[];
  video: GeneratedVideoResult | null;
  localVideo: GeneratedVideoResult | null;
  motionPreset: MotionPreset;
  motionPrompt: string;
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
  isSavingProject: boolean;
  saveStatusMsg: string | null;
  onChangeCampaignName: (val: string) => void;
  onChangeCampaignType: (val: CampaignType) => void;
  onChangeClientOrBrandName: (val: string) => void;
  onChangeNotes: (val: string) => void;
  onChangePricePromo: (val: string) => void;
  onChangeVerifiedDiscounts: (val: string) => void;
  onChangeTargetAudience: (val: string) => void;
  onChangeCampaignObjectives: (val: string) => void;
  onChangeVoiceName: (v: VoiceName) => void;
  onChangeVoiceoverLangMode: (m: VoiceoverLanguageMode) => void;
  onChangeVoiceoverStyle: (s: VoiceoverDeliveryStyle) => void;
  onChangeVoiceoverPace: (p: VoiceoverPace) => void;
  onUpdateAnalysis: (next: ProductAnalysis) => void;
  onSelectHook: (hook: ViralHook) => void;
  onRegenerateCopy: (customDirection?: string, scope?: CopyRegenScope) => void;
  onRegenerateConcept: (conceptIdx: number) => void;
  onGenerateVoiceoverScript: () => void;
  onSynthesizeVoiceover: () => void;
  onSaveProject: () => void;
  onNavigate: (section: StudioSection) => void;
}

const CAMPAIGN_TYPES: Array<{
  id: CampaignType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "affiliate", label: "Affiliate Product Campaign", icon: ShoppingBag },
  { id: "own_brand", label: "Own Brand Campaign", icon: Store },
  { id: "client_agency", label: "Client Advertising Campaign", icon: Briefcase },
];

export const CampaignStudioView: React.FC<CampaignStudioViewProps> = ({
  projectId,
  campaignName,
  campaignType,
  clientOrBrandName,
  notes,
  pricePromo,
  verifiedDiscounts,
  targetAudience,
  campaignObjectives,
  analysis,
  concepts,
  video,
  localVideo,
  motionPreset,
  motionPrompt,
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
  isSavingProject,
  saveStatusMsg,
  onChangeCampaignName,
  onChangeCampaignType,
  onChangeClientOrBrandName,
  onChangeNotes,
  onChangePricePromo,
  onChangeVerifiedDiscounts,
  onChangeTargetAudience,
  onChangeCampaignObjectives,
  onChangeVoiceName,
  onChangeVoiceoverLangMode,
  onChangeVoiceoverStyle,
  onChangeVoiceoverPace,
  onUpdateAnalysis,
  onSelectHook,
  onRegenerateCopy,
  onRegenerateConcept,
  onGenerateVoiceoverScript,
  onSynthesizeVoiceover,
  onSaveProject,
  onNavigate,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customAngle, setCustomAngle] = useState("");

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const activeVideo = video || localVideo;

  if (!analysis) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#121824] p-8 text-center space-y-4">
        <Sparkles className="w-8 h-8 text-rose-400 mx-auto" />
        <h1 className="font-display text-2xl font-bold text-white">
          Campaign Studio
        </h1>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          Start in Image Studio or AI Ad Copywriter to prepare a product
          analysis, 3 image ads, video concept, and truthful campaign brief
          bundle.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate("image_studio")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            Go to Image Studio
          </button>
          <button
            type="button"
            onClick={() => onNavigate("copywriter")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 bg-[#0B0F17] hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-semibold cursor-pointer"
          >
            Open Copywriter
          </button>
        </div>
      </div>
    );
  }

  const { strategist } = analysis;
  const fullHashtags = strategist.hashtags
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const fullStorePost = `${strategist.caption}\n\n${fullHashtags}`;
  const slug = (campaignName || analysis.productName || "campaign")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Campaign Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Assemble your 3 image ads, video asset, verified brief, hooks,
            caption, hashtags, and CTA into one saved project.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => copyText("full_post", fullStorePost)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-[#121824] hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap"
          >
            {copiedKey === "full_post" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied Full Post
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
            disabled={isSavingProject}
            onClick={onSaveProject}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap"
          >
            {isSavingProject ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {projectId ? "Update Saved Project" : "Save Campaign Project"}
              </>
            )}
          </button>
        </div>
      </div>

      {saveStatusMsg && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300 flex items-center justify-between">
          <span>{saveStatusMsg}</span>
          <button
            type="button"
            onClick={() => onNavigate("projects")}
            className="font-semibold underline cursor-pointer"
          >
            Open My Projects
          </button>
        </div>
      )}

      {/* Campaign Brief Inputs + Connected Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-white">
            Campaign Brief &amp; Verified Inputs
          </h2>

          <div className="grid grid-cols-1 gap-2">
            {CAMPAIGN_TYPES.map((ct) => {
              const Icon = ct.icon;
              const active = campaignType === ct.id;
              return (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => onChangeCampaignType(ct.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-semibold text-left cursor-pointer ${
                    active
                      ? "border-rose-500 bg-rose-600 text-white"
                      : "border-slate-800 bg-[#0B0F17] text-slate-300 hover:border-slate-600"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {ct.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Campaign Name
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => onChangeCampaignName(e.target.value)}
                placeholder={analysis.productName}
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                {campaignType === "client_agency"
                  ? "Client Name"
                  : campaignType === "own_brand"
                    ? "Brand Name"
                    : "Affiliate Storefront"}
              </label>
              <input
                type="text"
                value={clientOrBrandName}
                onChange={(e) => onChangeClientOrBrandName(e.target.value)}
                placeholder="Optional brand or client..."
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Target Audience
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => onChangeTargetAudience(e.target.value)}
                placeholder={analysis.targetAudience || "e.g. Young adults 20-35"}
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Campaign Objectives
              </label>
              <input
                type="text"
                value={campaignObjectives}
                onChange={(e) => onChangeCampaignObjectives(e.target.value)}
                placeholder="e.g. Yellow basket purchases"
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Verified Price (Optional)
              </label>
              <input
                type="text"
                value={pricePromo}
                onChange={(e) => onChangePricePromo(e.target.value)}
                placeholder="Leave blank if unconfirmed"
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Verified Discounts (Optional)
              </label>
              <input
                type="text"
                value={verifiedDiscounts}
                onChange={(e) => onChangeVerifiedDiscounts(e.target.value)}
                placeholder="Confirmed voucher/bundle..."
                className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Key Product Benefits (One per line)
            </label>
            <textarea
              rows={2}
              value={analysis.keyBenefits.join("\n")}
              onChange={(e) =>
                onUpdateAnalysis({
                  ...analysis,
                  keyBenefits: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Production Brief Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => onChangeNotes(e.target.value)}
              placeholder="Client deliverables, creator schedule, posting cadence..."
              className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>
        </section>

        {/* Connected 3 Image Ads + 1 Video Asset */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Campaign Asset Bundle (3 Images + 1 Video Concept)
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => onNavigate("image_studio")}
                className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
              >
                Image Studio
              </button>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => onNavigate("video_studio")}
                className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
              >
                Video Studio
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2].map((idx) => {
              const concept = concepts[idx];
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-[#0B0F17] p-2 flex flex-col justify-between gap-2"
                >
                  <div className="aspect-[9/16] rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
                    {concept ? (
                      <img
                        src={concept.finalImageDataUrl}
                        alt={concept.title}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-[11px] text-slate-500 px-2 text-center">
                        Ad Image {idx + 1} pending
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-200 truncate">
                      {concept ? concept.title : `Ad Concept ${idx + 1}`}
                    </div>
                    {concept && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onRegenerateConcept(idx)}
                          className="flex-1 py-1 rounded border border-slate-700 hover:bg-slate-800 text-[10px] font-semibold text-slate-300 cursor-pointer"
                        >
                          Regen
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            triggerDownload(
                              concept.finalImageDataUrl,
                              `${slug}-ad-${idx + 1}.png`
                            )
                          }
                          className="px-2 py-1 rounded border border-slate-700 hover:bg-slate-800 text-[10px] text-slate-300 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-2 flex flex-col justify-between gap-2">
              <div className="aspect-[9/16] rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
                {activeVideo ? (
                  <video
                    src={activeVideo.videoUrl}
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-2 space-y-1.5">
                    <Clapperboard className="w-5 h-5 text-slate-500 mx-auto" />
                    <div className="text-[11px] text-slate-400">
                      {motionPreset}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-200 truncate">
                  {activeVideo ? "Rendered Video" : "Video Concept"}
                </div>
                {activeVideo ? (
                  <button
                    type="button"
                    onClick={() =>
                      triggerDownload(
                        activeVideo.videoUrl,
                        `${slug}-video.${activeVideo.extension}`
                      )
                    }
                    className="w-full py-1 rounded bg-rose-600 hover:bg-rose-700 text-[10px] font-semibold text-white cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    {activeVideo.extension.toUpperCase()}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate("video_studio")}
                    className="w-full py-1 rounded border border-slate-700 hover:bg-slate-800 text-[10px] font-semibold text-slate-200 cursor-pointer"
                  >
                    Open Video Studio
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-3 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">
              Video Direction ({motionPreset}):{" "}
            </span>
            {motionPrompt || analysis.strategist.googleFlowPrompt}
          </div>
        </section>
      </div>

      {/* Editable & Individually Regeneratable Copy Assets */}
      <section className="rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Campaign Copy Assets
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Regenerate your entire copy kit or refresh only hooks, headlines,
              or captions from the updated campaign brief above.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={customAngle}
              onChange={(e) => setCustomAngle(e.target.value)}
              placeholder="Optional direction note..."
              className="rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 w-52 focus:outline-none focus:border-rose-500"
            />
            <button
              type="button"
              disabled={isRegeneratingCopy}
              onClick={() => onRegenerateCopy(customAngle, "all")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-700 bg-[#0B0F17] hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRegeneratingCopy ? "animate-spin" : ""}`}
              />
              Refresh Copy From Brief
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono text-slate-400">
                3 Attention-Grabbing Hooks
              </h3>
              <button
                type="button"
                disabled={isRegeneratingCopy}
                onClick={() => onRegenerateCopy(customAngle, "hooks")}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer disabled:opacity-50"
              >
                Regenerate Hooks
              </button>
            </div>
            {strategist.hooks.map((hook) => {
              const active = selectedHookId === hook.id;
              return (
                <div
                  key={hook.id}
                  onClick={() => onSelectHook(hook)}
                  className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                    active
                      ? "border-rose-500 bg-rose-500/10"
                      : "border-slate-800 bg-[#0B0F17] hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold">
                      {hook.style} {active ? "· Selected Hook" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyText(`h_${hook.id}`, hook.onScreenText);
                      }}
                      className="text-slate-300 hover:text-white cursor-pointer"
                    >
                      {copiedKey === `h_${hook.id}` ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-white mt-1">
                    “{hook.onScreenText}”
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Spoken: {hook.spokenLine}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-mono text-slate-400">
                  3 Advertising Headlines
                </h3>
                <button
                  type="button"
                  disabled={isRegeneratingCopy}
                  onClick={() => onRegenerateCopy(customAngle, "headlines")}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer disabled:opacity-50"
                >
                  Regenerate Headlines
                </button>
              </div>
              <div className="space-y-2">
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
                      const nextHeadlines = [
                        ...(strategist.headlines || [
                          analysis.shortTagline,
                          analysis.productName,
                          strategist.videoScript.beat2Benefit,
                        ]),
                      ];
                      nextHeadlines[i] = e.target.value;
                      onUpdateAnalysis({
                        ...analysis,
                        strategist: {
                          ...strategist,
                          headlines: nextHeadlines,
                        },
                      });
                    }}
                    className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-mono text-slate-400 mb-2">
                CTA Suggestions
              </h3>
              <div className="space-y-2">
                {(
                  strategist.ctaSuggestions || [
                    strategist.videoScript.beat3Offer,
                    "Tap the yellow basket to check availability",
                    "View product specifications below",
                  ]
                ).map((cta, i) => (
                  <input
                    key={i}
                    type="text"
                    value={cta}
                    onChange={(e) => {
                      const nextCtas = [
                        ...(strategist.ctaSuggestions || [
                          strategist.videoScript.beat3Offer,
                          "Tap the yellow basket to check availability",
                          "View product specifications below",
                        ]),
                      ];
                      nextCtas[i] = e.target.value;
                      onUpdateAnalysis({
                        ...analysis,
                        strategist: {
                          ...strategist,
                          ctaSuggestions: nextCtas,
                        },
                      });
                    }}
                    className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Product Description
              </label>
              <textarea
                rows={3}
                value={
                  strategist.productDescription ?? analysis.shortTagline ?? ""
                }
                onChange={(e) =>
                  onUpdateAnalysis({
                    ...analysis,
                    strategist: {
                      ...strategist,
                      productDescription: e.target.value,
                    },
                  })
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
                  onUpdateAnalysis({
                    ...analysis,
                    strategist: {
                      ...strategist,
                      hashtags: e.target.value
                        .split(/\s+/)
                        .map((t) => t.trim())
                        .filter(Boolean),
                    },
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
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isRegeneratingCopy}
                  onClick={() => onRegenerateCopy(customAngle, "caption")}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer disabled:opacity-50"
                >
                  Regenerate Caption
                </button>
                <button
                  type="button"
                  onClick={() => copyText("cap", strategist.caption)}
                  className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  {copiedKey === "cap" ? "Copied Caption" : "Copy Caption"}
                </button>
              </div>
            </div>
            <textarea
              rows={6}
              value={strategist.caption}
              onChange={(e) =>
                onUpdateAnalysis({
                  ...analysis,
                  strategist: { ...strategist, caption: e.target.value },
                })
              }
              className="w-full rounded-xl border border-slate-800 bg-[#0B0F17] p-3 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
          <TagalogVoiceoverPanel
            compact
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
              onUpdateAnalysis({
                ...analysis,
                strategist: {
                  ...strategist,
                  videoScript: {
                    ...strategist.videoScript,
                    voiceoverText: next,
                  },
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

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-300">
                Google Flow Video Prompt
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
              rows={3}
              value={strategist.googleFlowPrompt}
              onChange={(e) =>
                onUpdateAnalysis({
                  ...analysis,
                  strategist: {
                    ...strategist,
                    googleFlowPrompt: e.target.value,
                  },
                })
              }
              className="w-full rounded-xl border border-slate-800 bg-[#0B0F17] p-3 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
