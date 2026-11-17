import React from "react";
import {
  AlertCircle,
  Download,
  Loader2,
  Mic,
  Sparkles,
  Volume2,
} from "lucide-react";
import type {
  VoiceName,
  VoiceoverDeliveryStyle,
  VoiceoverLanguageMode,
  VoiceoverPace,
} from "../types/studio";

export const TAGALOG_VOICE_CAST: Array<{
  id: VoiceName;
  label: string;
  gender: string;
  persona: string;
}> = [
  {
    id: "Kore",
    label: "Tala (Kore)",
    gender: "Female",
    persona: "Warm & Natural Tagalog Creator",
  },
  {
    id: "Zephyr",
    label: "Amihan (Zephyr)",
    gender: "Female",
    persona: "Crisp & Energetic TikTok Budol",
  },
  {
    id: "Puck",
    label: "Miko (Puck)",
    gender: "Male",
    persona: "Masaya & Relatable Reviewer",
  },
  {
    id: "Charon",
    label: "Marco (Charon)",
    gender: "Male",
    persona: "Deep & Trusted Commercial Host",
  },
  {
    id: "Fenrir",
    label: "Leo (Fenrir)",
    gender: "Male",
    persona: "Bold & High-Impact Promo Voice",
  },
];

export const TAGALOG_DELIVERY_STYLES: Array<{
  id: VoiceoverDeliveryStyle;
  label: string;
  hint: string;
}> = [
  {
    id: "budol_energy",
    label: "Masigla · Budol Energy",
    hint: "Upbeat, enthusiastic TikTok Shop creator vibe",
  },
  {
    id: "kwento",
    label: "Kwento · Conversational",
    hint: "Natural friend-to-friend storytelling tone",
  },
  {
    id: "sosyal",
    label: "Sosyal · Premium Ad",
    hint: "Polished, confident luxury narration",
  },
  {
    id: "promo_rush",
    label: "Urgent · Yellow Basket",
    hint: "Fast promo & checkout call-to-action delivery",
  },
  {
    id: "kalma_asmr",
    label: "Kalma · Soft Review",
    hint: "Gentle, honest close-up skincare/lifestyle review",
  },
];

export const VOICEOVER_LANGUAGE_MODES: Array<{
  id: VoiceoverLanguageMode;
  label: string;
}> = [
  { id: "full_tagalog", label: "Full Tagalog (Pure Filipino)" },
  { id: "taglish", label: "Taglish (TikTok PH Creator)" },
  { id: "english", label: "English" },
];

export const VOICEOVER_PACE_OPTIONS: Array<{
  id: VoiceoverPace;
  label: string;
}> = [
  { id: "natural", label: "Natural Pace" },
  { id: "mabilis", label: "Mabilis (Fast TikTok)" },
  { id: "mabagal", label: "Mabagal (Clear & Calm)" },
];

interface TagalogVoiceoverPanelProps {
  scriptText: string;
  voiceName: VoiceName;
  languageMode: VoiceoverLanguageMode;
  deliveryStyle: VoiceoverDeliveryStyle;
  pace: VoiceoverPace;
  voiceoverUrl: string | null;
  voiceoverError: string | null;
  isGeneratingScript: boolean;
  isSynthesizing: boolean;
  canGenerateScript: boolean;
  onChangeScript: (next: string) => void;
  onChangeVoiceName: (v: VoiceName) => void;
  onChangeLanguageMode: (m: VoiceoverLanguageMode) => void;
  onChangeDeliveryStyle: (s: VoiceoverDeliveryStyle) => void;
  onChangePace: (p: VoiceoverPace) => void;
  onGenerateScript: () => void;
  onSynthesize: () => void;
  compact?: boolean;
}

export const TagalogVoiceoverPanel: React.FC<TagalogVoiceoverPanelProps> = ({
  scriptText,
  voiceName,
  languageMode,
  deliveryStyle,
  pace,
  voiceoverUrl,
  voiceoverError,
  isGeneratingScript,
  isSynthesizing,
  canGenerateScript,
  onChangeScript,
  onChangeVoiceName,
  onChangeLanguageMode,
  onChangeDeliveryStyle,
  onChangePace,
  onGenerateScript,
  onSynthesize,
  compact = false,
}) => {
  return (
    <div
      className={`rounded-xl border border-slate-800 ${
        compact ? "bg-[#121824] p-3.5" : "bg-[#121824] p-5"
      } space-y-3`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Mic className="w-4 h-4 text-rose-400" />
          Tagalog Voiceover Options &amp; Audio
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canGenerateScript || isGeneratingScript}
            onClick={onGenerateScript}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-xs font-semibold text-rose-200 cursor-pointer whitespace-nowrap"
          >
            {isGeneratingScript ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            )}
            {languageMode === "full_tagalog"
              ? "Write Full Tagalog Script"
              : languageMode === "taglish"
                ? "Write Taglish Script"
                : "Write English Script"}
          </button>

          <button
            type="button"
            disabled={!scriptText.trim() || isSynthesizing}
            onClick={onSynthesize}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-white disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isSynthesizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Synthesizing...
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                Generate Voiceover
              </>
            )}
          </button>
        </div>
      </div>

      {/* Language Mode + Voice Cast + Delivery Style + Pace */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            Language / Dialect
          </label>
          <select
            value={languageMode}
            onChange={(e) =>
              onChangeLanguageMode(e.target.value as VoiceoverLanguageMode)
            }
            className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-2.5 py-1.5 text-xs text-slate-100"
          >
            {VOICEOVER_LANGUAGE_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            Voice Talent
          </label>
          <select
            value={voiceName}
            onChange={(e) => onChangeVoiceName(e.target.value as VoiceName)}
            className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-2.5 py-1.5 text-xs text-slate-100"
          >
            {TAGALOG_VOICE_CAST.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} · {v.gender}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            Tagalog Delivery Style
          </label>
          <select
            value={deliveryStyle}
            onChange={(e) =>
              onChangeDeliveryStyle(e.target.value as VoiceoverDeliveryStyle)
            }
            className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-2.5 py-1.5 text-xs text-slate-100"
          >
            {TAGALOG_DELIVERY_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            Speaking Pace
          </label>
          <select
            value={pace}
            onChange={(e) => onChangePace(e.target.value as VoiceoverPace)}
            className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] px-2.5 py-1.5 text-xs text-slate-100"
          >
            {VOICEOVER_PACE_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <textarea
        rows={compact ? 2 : 3}
        value={scriptText}
        onChange={(e) => onChangeScript(e.target.value)}
        placeholder={
          languageMode === "full_tagalog"
            ? "Ilagay o i-generate ang Full Tagalog voiceover script dito..."
            : "Enter or generate your voiceover script..."
        }
        className="w-full rounded-lg border border-slate-800 bg-[#0B0F17] p-2.5 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-rose-500"
      />

      {voiceoverUrl && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2">
          <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <audio src={voiceoverUrl} controls className="h-8 flex-1 min-w-[180px]" />
          <a
            href={voiceoverUrl}
            download="tagalog-voiceover.wav"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 bg-[#121824] hover:bg-slate-800 text-[11px] font-semibold text-slate-200 whitespace-nowrap"
          >
            <Download className="w-3 h-3" />
            WAV
          </a>
        </div>
      )}

      {voiceoverError && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{voiceoverError}</span>
        </div>
      )}
    </div>
  );
};
