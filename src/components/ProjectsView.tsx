import React, { useState } from "react";
import {
  Check,
  Download,
  Edit3,
  FolderOpen,
  Image as ImageIcon,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";
import type {
  CampaignType,
  ProjectSummary,
  StoredProjectFull,
} from "../types/studio";

interface ProjectsViewProps {
  projects: ProjectSummary[];
  onRefreshProjects: () => void;
  onReopenProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newName: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onFetchProjectDetail: (projectId: string) => Promise<StoredProjectFull | null>;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  onReopenProject,
  onRenameProject,
  onDeleteProject,
  onFetchProjectDetail,
}) => {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | CampaignType>("all");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [inspecting, setInspecting] = useState<StoredProjectFull | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = projects.filter((p) => {
    const matchesType = filterType === "all" || p.campaignType === filterType;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.clientOrBrandName.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const handleOpenInspect = async (id: string) => {
    const detail = await onFetchProjectDetail(id);
    if (detail) setInspecting(detail);
  };

  const commitRename = async (id: string) => {
    if (!draftName.trim()) {
      setRenamingId(null);
      return;
    }
    await onRenameProject(id, draftName.trim());
    setRenamingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            My Projects
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Reopen, rename, inspect assets, download individual files, or remove
            saved advertising campaigns.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="pl-8 pr-3 py-2 rounded-xl border border-slate-800 bg-[#121824] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) =>
              setFilterType(e.target.value as "all" | CampaignType)
            }
            className="rounded-xl border border-slate-800 bg-[#121824] px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
          >
            <option value="all">All Campaign Types</option>
            <option value="affiliate">Affiliate</option>
            <option value="own_brand">Own Brand</option>
            <option value="client_agency">Client Agency</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-[#121824] p-12 text-center space-y-2">
          <FolderOpen className="w-8 h-8 text-slate-600 mx-auto" />
          <div className="text-sm font-semibold text-slate-300">
            No matching projects found
          </div>
          <div className="text-xs text-slate-500">
            Save a project from Campaign Studio to manage and re-export its
            assets here.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((proj) => {
            const isRenaming = renamingId === proj.id;
            const isConfirmingDel = confirmDeleteId === proj.id;
            return (
              <article
                key={proj.id}
                className="rounded-2xl border border-slate-800 bg-[#121824] p-4 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-20 h-28 rounded-xl overflow-hidden border border-slate-800 bg-[#0B0F17] shrink-0 flex items-center justify-center">
                    {proj.thumbnailUrl ? (
                      <img
                        src={proj.thumbnailUrl}
                        alt={proj.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-mono text-rose-400">
                      {proj.campaignType.replace("_", " ")} · {proj.visualStyle}
                    </div>

                    {isRenaming ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="text"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void commitRename(proj.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="w-full rounded border border-rose-500 bg-[#0B0F17] px-2 py-1 text-xs text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => void commitRename(proj.id)}
                          className="p-1 text-emerald-400 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <h2 className="font-display text-base font-semibold text-white truncate">
                          {proj.name}
                        </h2>
                        <button
                          type="button"
                          title="Rename project"
                          onClick={() => {
                            setRenamingId(proj.id);
                            setDraftName(proj.name);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-200 cursor-pointer shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {proj.clientOrBrandName && (
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {proj.clientOrBrandName}
                      </div>
                    )}

                    <div className="text-xs font-mono tabular-nums text-slate-500 mt-2">
                      {proj.assetCount} images · {proj.videoCount} video ·{" "}
                      {proj.aspectRatio}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Updated {new Date(proj.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onReopenProject(proj.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Reopen
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenInspect(proj.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 bg-[#0B0F17] hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      Assets
                    </button>
                  </div>

                  {isConfirmingDel ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteProject(proj.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-2.5 py-1 rounded bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded text-slate-400 text-[11px] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      title="Delete project"
                      onClick={() => setConfirmDeleteId(proj.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Project Asset Inspector Modal */}
      {inspecting && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[86vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#121824] p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="text-xs font-mono text-rose-400">
                  {inspecting.campaignType.replace("_", " ")} ·{" "}
                  {inspecting.visualStyle}
                </div>
                <h2 className="font-display text-xl font-bold text-white mt-0.5">
                  {inspecting.name}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const id = inspecting.id;
                    setInspecting(null);
                    onReopenProject(id);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Open in Studio
                </button>
                <button
                  type="button"
                  onClick={() => setInspecting(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {inspecting.assets.map((asset) => (
                <div
                  key={asset.filename}
                  className="rounded-xl border border-slate-800 bg-[#0B0F17] p-2.5 flex flex-col justify-between gap-2"
                >
                  <div className="aspect-[9/16] rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
                    {asset.kind === "video" ? (
                      <video
                        src={asset.url}
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={asset.url}
                        alt={asset.label}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-200 truncate flex items-center gap-1">
                      {asset.kind === "video" ? (
                        <Video className="w-3 h-3 text-rose-400 shrink-0" />
                      ) : (
                        <ImageIcon className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                      {asset.label}
                    </span>
                    <a
                      href={`${asset.url}?download=1`}
                      download={asset.filename}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
