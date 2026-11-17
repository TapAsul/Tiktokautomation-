import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clapperboard,
  FolderOpen,
  Image as ImageIcon,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";
import type {
  CampaignType,
  ModelAvailabilitySnapshot,
  ProjectSummary,
  StudioSection,
  UsageStatsSnapshot,
} from "../types/studio";

interface DashboardViewProps {
  usage: UsageStatsSnapshot | null;
  availability: ModelAvailabilitySnapshot | null;
  projects: ProjectSummary[];
  onRefreshAvailability: () => void;
  isCheckingAvailability: boolean;
  onStartUseCase: (campaignType: CampaignType) => void;
  onNavigate: (section: StudioSection) => void;
  onOpenProject: (projectId: string) => void;
}

const USE_CASES: Array<{
  type: CampaignType;
  title: string;
  subtitle: string;
  deliverables: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    type: "affiliate",
    title: "TikTok Shop Affiliate Marketer",
    subtitle:
      "Turn product screenshots into 9:16 yellow-basket creatives with Tagalog or English scroll-stopper hooks and ready captions.",
    deliverables: "3 Ad Concepts · 9:16 Video · Hooks & Flow Prompt",
    icon: ShoppingBag,
  },
  {
    type: "own_brand",
    title: "Own Brand Showcase",
    subtitle:
      "Preserve exact packaging and label pixels using Exact Product compositing, animated backgrounds, and brand copy.",
    deliverables: "Exact Cutout · Layer Video · Brand Positioning",
    icon: Store,
  },
  {
    type: "client_agency",
    title: "Freelancer & Agency Client Ad",
    subtitle:
      "Produce client-ready multi-asset campaign kits with verified briefs, safe-zone previews, and organized project exports.",
    deliverables: "Client Brief Kit · Editable Assets · Export Center",
    icon: Briefcase,
  },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  usage,
  availability,
  projects,
  onRefreshAvailability,
  isCheckingAvailability,
  onStartUseCase,
  onNavigate,
  onOpenProject,
}) => {
  const totalGenerations =
    (usage?.imageGenCalls || 0) +
    (usage?.videoGenCalls || 0) +
    (usage?.analysisCalls || 0) +
    (usage?.ttsCalls || 0);

  return (
    <div className="space-y-8">
      {/* Studio Overview Hero */}
      <section className="rounded-2xl border border-slate-800 bg-[#121824] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="max-w-2xl space-y-2.5">
          <div className="text-xs font-mono text-rose-400">
            TikTok &amp; Social Product Advertising Studio
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
            Transform product photos into ready-to-publish vertical campaigns
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Analyze product details with Gemini, isolate exact pixels or build
            creative scenes in Image Studio, animate 9:16 motion clips in Video
            Studio, and export complete copywriter kits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate("image_studio")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <ImageIcon className="w-4 h-4" />
            Open Image Studio
          </button>
          <button
            type="button"
            onClick={() => onNavigate("video_studio")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-[#0B0F17] hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Clapperboard className="w-4 h-4 text-rose-400" />
            Open Video Studio
          </button>
        </div>
      </section>

      {/* Three Business Workflows */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-white">
            Production Workflows
          </h2>
          <span className="text-xs text-slate-400">
            Choose a campaign mode to configure defaults
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {USE_CASES.map((uc) => {
            const Icon = uc.icon;
            return (
              <button
                key={uc.type}
                type="button"
                onClick={() => onStartUseCase(uc.type)}
                className="group text-left rounded-2xl border border-slate-800 bg-[#121824] hover:border-rose-500/60 p-5 transition-colors flex flex-col justify-between gap-4 cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0B0F17] border border-slate-800 flex items-center justify-center text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold text-white">
                      {uc.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {uc.subtitle}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 font-mono truncate">
                    {uc.deliverables}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-400 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* AI Model Availability & Environment Diagnostics */}
      <section className="rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Google AI Model Status &amp; Capabilities
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live status of connected Google Gemini text, image, video, and
              voice models on this server.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isCheckingAvailability}
              onClick={onRefreshAvailability}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-[#0B0F17] hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isCheckingAvailability ? "animate-spin" : ""}`}
              />
              {isCheckingAvailability ? "Testing Models..." : "Check Live Models"}
            </button>
            <button
              type="button"
              onClick={() => onNavigate("settings")}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer whitespace-nowrap"
            >
              Configure Models
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(availability?.services || []).map((svc) => {
            const isOk = svc.status === "available";
            const isQuota = svc.status === "quota_limited";
            return (
              <div
                key={svc.service}
                className="rounded-xl border border-slate-800 bg-[#0B0F17] p-3.5 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-white truncate">
                    {svc.label}
                  </span>
                  {isOk ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isQuota ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  {svc.model}
                </div>
                <div
                  className={`text-[11px] font-semibold ${
                    isOk
                      ? "text-emerald-400"
                      : isQuota
                        ? "text-amber-300"
                        : svc.status === "unavailable"
                          ? "text-rose-400"
                          : "text-slate-400"
                  }`}
                >
                  {svc.status === "available" && "Active & Available"}
                  {svc.status === "quota_limited" &&
                    "Quota Limited on Active Key"}
                  {svc.status === "unavailable" && "Unavailable"}
                  {svc.status === "untested" && "Ready (Click Check Live Models)"}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                  {svc.note}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Usage Metrics + Recent Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Studio Usage Telemetry
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {totalGenerations} total calls
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-800/90 bg-[#0B0F17] p-3.5">
              <div className="text-xs text-slate-400">Product Analyses</div>
              <div className="font-display text-2xl font-bold text-white font-mono tabular-nums mt-1">
                {usage?.analysisCalls ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/90 bg-[#0B0F17] p-3.5">
              <div className="text-xs text-slate-400">Image Concepts</div>
              <div className="font-display text-2xl font-bold text-white font-mono tabular-nums mt-1">
                {usage?.imageGenCalls ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/90 bg-[#0B0F17] p-3.5">
              <div className="text-xs text-slate-400">AI Video Jobs</div>
              <div className="font-display text-2xl font-bold text-white font-mono tabular-nums mt-1">
                {usage?.videoGenCalls ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/90 bg-[#0B0F17] p-3.5">
              <div className="text-xs text-slate-400">Voiceovers &amp; Copy</div>
              <div className="font-display text-2xl font-bold text-white font-mono tabular-nums mt-1">
                {(usage?.ttsCalls ?? 0) + (usage?.copyCalls ?? 0)}
              </div>
            </div>
          </div>

          {usage && usage.recentLogs.length > 0 ? (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-[11px] font-mono text-slate-500">
                Recent Operations
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {usage.recentLogs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-800/60 last:border-b-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`font-mono text-[11px] ${
                          log.status === "success"
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {log.operation}
                      </span>
                      <span className="text-slate-400 truncate">
                        {log.note || log.model}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                      {log.durationMs}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800/80 bg-[#0B0F17] p-4 text-xs text-slate-500">
              No requests logged yet. Upload a product photo in Image Studio to
              begin.
            </div>
          )}
        </section>

        <section className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#121824] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Recent Projects
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("projects")}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
            >
              View all ({projects.length})
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-[#0B0F17] p-8 text-center space-y-2.5">
              <Sparkles className="w-7 h-7 text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-300">
                No saved campaigns yet
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Produce image concepts, write ad copy, render a 9:16 video, and
                save your project in Campaign Studio.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {projects.slice(0, 4).map((proj) => (
                <div
                  key={proj.id}
                  className="rounded-xl border border-slate-800 bg-[#0B0F17] p-3.5 flex items-center gap-3.5"
                >
                  <div className="w-16 h-20 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 shrink-0 flex items-center justify-center">
                    {proj.thumbnailUrl ? (
                      <img
                        src={proj.thumbnailUrl}
                        alt={proj.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FolderOpen className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-mono text-slate-400">
                      {proj.campaignType.replace("_", " ")} · {proj.aspectRatio}
                    </div>
                    <div className="text-sm font-semibold text-white truncate mt-0.5">
                      {proj.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                      {proj.assetCount} images · {proj.videoCount} video
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenProject(proj.id)}
                      className="mt-2 text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      Reopen project
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
