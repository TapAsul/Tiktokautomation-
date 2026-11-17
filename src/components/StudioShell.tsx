import React from "react";
import {
  Clapperboard,
  DownloadCloud,
  FileEdit,
  FolderKanban,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  Plus,
  Settings,
} from "lucide-react";
import type { StudioSection } from "../types/studio";

interface StudioShellProps {
  activeSection: StudioSection;
  onNavigate: (section: StudioSection) => void;
  activeProductName?: string;
  activeProjectName?: string;
  projectCount?: number;
  exportAssetCount?: number;
  onNewSession: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: StudioSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "image_studio", label: "Image Studio", icon: ImageIcon },
  { id: "video_studio", label: "Video Studio", icon: Clapperboard },
  { id: "copywriter", label: "AI Ad Copywriter", icon: FileEdit },
  { id: "campaign_studio", label: "Campaign Studio", icon: Layers },
  { id: "projects", label: "My Projects", icon: FolderKanban },
  { id: "export_center", label: "Export Center", icon: DownloadCloud },
  { id: "settings", label: "Settings", icon: Settings },
];

export const StudioShell: React.FC<StudioShellProps> = ({
  activeSection,
  onNavigate,
  activeProductName,
  activeProjectName,
  projectCount = 0,
  exportAssetCount = 0,
  onNewSession,
  children,
}) => {
  const activeItem =
    NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-[#0B0F17] text-slate-100">
      {/* Desktop Left Sidebar (240px) */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-800/90 bg-[#0D121C]">
        <div className="h-16 px-5 border-b border-slate-800/90 flex items-center">
          <button
            type="button"
            onClick={() => onNavigate("overview")}
            className="flex items-center gap-2.5 text-left cursor-pointer whitespace-nowrap shrink-0"
          >
            <span className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center font-display font-bold text-sm text-white shrink-0">
              PS
            </span>
            <span className="font-display text-base font-bold tracking-tight text-white">
              Product Studio AI
            </span>
          </button>
        </div>

        <nav
          aria-label="Studio workspace navigation"
          className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            const countHint =
              item.id === "projects" && projectCount > 0
                ? projectCount
                : item.id === "export_center" && exportAssetCount > 0
                  ? exportAssetCount
                  : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-rose-600 text-white"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {countHint !== null && (
                  <span
                    className={`font-mono tabular-nums text-[11px] ${
                      active ? "text-rose-100" : "text-slate-500"
                    }`}
                  >
                    {countHint}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {(activeProjectName || activeProductName) && (
          <div className="p-4 border-t border-slate-800/90 text-xs space-y-1">
            <div className="text-[11px] text-slate-500">Active Workspace</div>
            <div className="font-semibold text-slate-200 truncate">
              {activeProjectName || activeProductName}
            </div>
          </div>
        )}
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        {/* Top Context Header */}
        <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#0B0F17]/95 backdrop-blur-md">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => onNavigate("overview")}
                className="lg:hidden flex items-center gap-2 text-left cursor-pointer whitespace-nowrap shrink-0"
              >
                <span className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center font-display font-bold text-xs text-white">
                  PS
                </span>
                <span className="font-display text-sm font-bold text-white">
                  Product Studio AI
                </span>
              </button>

              <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 min-w-0">
                <span className="text-slate-500">Studio</span>
                <span aria-hidden="true">/</span>
                <span className="text-slate-100 font-semibold whitespace-nowrap">
                  {activeItem.label}
                </span>
                {(activeProjectName || activeProductName) && (
                  <>
                    <span aria-hidden="true">/</span>
                    <span className="text-slate-400 truncate max-w-[260px]">
                      {activeProjectName || activeProductName}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onNewSession}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                New Campaign
              </button>
            </div>
          </div>

          {/* Mobile/Tablet Navigation Strip */}
          <nav
            aria-label="Mobile studio navigation"
            className="lg:hidden border-t border-slate-800/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? "bg-rose-600 text-white"
                      : "text-slate-400 hover:text-slate-100 bg-[#121824]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        {/* Main Workspace Content */}
        <main className="flex-1 mx-auto w-full max-w-[1320px] px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
};
