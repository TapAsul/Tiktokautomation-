import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { sanitizeFilename, sanitizeId } from "./validation.js";

const DATA_DIR = path.resolve(process.cwd(), ".studio-data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const JOBS_DIR = path.join(DATA_DIR, "jobs");
const USAGE_FILE = path.join(DATA_DIR, "usage.json");

function ensureDirs() {
  for (const dir of [DATA_DIR, PROJECTS_DIR, JOBS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export type UsageOperationType =
  | "analysis"
  | "copy"
  | "image_gen"
  | "video_gen"
  | "tts";

export interface UsageLogEntry {
  id: string;
  operation: UsageOperationType;
  model: string;
  status: "success" | "error";
  durationMs: number;
  note?: string;
  timestamp: string;
}

export interface UsageStats {
  analysisCalls: number;
  copyCalls: number;
  imageGenCalls: number;
  videoGenCalls: number;
  ttsCalls: number;
  errors: number;
  lastUpdated: string;
  recentLogs: UsageLogEntry[];
}

const DEFAULT_USAGE: UsageStats = {
  analysisCalls: 0,
  copyCalls: 0,
  imageGenCalls: 0,
  videoGenCalls: 0,
  ttsCalls: 0,
  errors: 0,
  lastUpdated: new Date().toISOString(),
  recentLogs: [],
};

export function getUsageStats(): UsageStats {
  ensureDirs();
  if (!fs.existsSync(USAGE_FILE)) {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(DEFAULT_USAGE, null, 2));
    return { ...DEFAULT_USAGE };
  }
  try {
    const raw = fs.readFileSync(USAGE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<UsageStats>;
    return {
      analysisCalls: parsed.analysisCalls ?? 0,
      copyCalls: parsed.copyCalls ?? 0,
      imageGenCalls: parsed.imageGenCalls ?? 0,
      videoGenCalls: parsed.videoGenCalls ?? 0,
      ttsCalls: parsed.ttsCalls ?? 0,
      errors: parsed.errors ?? 0,
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      recentLogs: Array.isArray(parsed.recentLogs) ? parsed.recentLogs : [],
    };
  } catch {
    return { ...DEFAULT_USAGE };
  }
}

export function recordUsage(
  operation: UsageOperationType,
  model: string,
  status: "success" | "error",
  durationMs: number,
  note?: string
) {
  ensureDirs();
  const stats = getUsageStats();
  if (status === "success") {
    if (operation === "analysis") stats.analysisCalls++;
    else if (operation === "copy") stats.copyCalls++;
    else if (operation === "image_gen") stats.imageGenCalls++;
    else if (operation === "video_gen") stats.videoGenCalls++;
    else if (operation === "tts") stats.ttsCalls++;
  } else {
    stats.errors++;
  }
  stats.lastUpdated = new Date().toISOString();
  stats.recentLogs.unshift({
    id: crypto.randomUUID().slice(0, 8),
    operation,
    model,
    status,
    durationMs: Math.round(durationMs),
    note: note?.slice(0, 140),
    timestamp: stats.lastUpdated,
  });
  stats.recentLogs = stats.recentLogs.slice(0, 30);
  fs.writeFileSync(USAGE_FILE, JSON.stringify(stats, null, 2));
}

export interface GenerationJob {
  id: string;
  type: "image" | "video" | "analysis";
  status: "queued" | "processing" | "completed" | "failed";
  model: string;
  interactionId?: string;
  aspectRatio?: string;
  durationSec?: number;
  resolution?: string;
  videoFile?: string;
  videoUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const jobMap = new Map<string, GenerationJob>();

export function createJob(
  job: Omit<GenerationJob, "id" | "createdAt" | "updatedAt">
): GenerationJob {
  ensureDirs();
  const id = `job_${crypto.randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const full: GenerationJob = {
    ...job,
    id,
    createdAt: now,
    updatedAt: now,
  };
  jobMap.set(id, full);
  return full;
}

export function getJob(id: string): GenerationJob | null {
  const safe = sanitizeId(id);
  if (!safe) return null;
  return jobMap.get(safe) || null;
}

export function updateJob(
  id: string,
  patch: Partial<Omit<GenerationJob, "id" | "createdAt">>
): GenerationJob | null {
  const existing = jobMap.get(id);
  if (!existing) return null;
  const updated: GenerationJob = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  jobMap.set(id, updated);
  return updated;
}

export function saveJobVideoBuffer(jobId: string, buffer: Buffer): string {
  ensureDirs();
  const safe = sanitizeId(jobId);
  if (!safe) throw new Error("Invalid job ID.");
  const filename = `${safe}.mp4`;
  const target = path.join(JOBS_DIR, filename);
  fs.writeFileSync(target, buffer);
  return filename;
}

export function getJobVideoPath(filename: string): string | null {
  ensureDirs();
  const safe = sanitizeFilename(filename);
  if (!safe || !safe.endsWith(".mp4")) return null;
  const full = path.join(JOBS_DIR, safe);
  if (!fs.existsSync(full)) return null;
  return full;
}

export interface SavedAssetRef {
  id: string;
  label: string;
  kind: "source" | "cutout" | "concept" | "video" | "audio";
  filename: string;
  mimeType: string;
  url: string;
  style?: string;
  mode?: string;
  direction?: string;
  aspectRatio?: string;
  engine?: string;
}

export interface StoredProject {
  id: string;
  name: string;
  campaignType: "affiliate" | "own_brand" | "client_agency";
  clientOrBrandName: string;
  language: "tagalog" | "english";
  targetTone: string;
  visualStyle: string;
  aspectRatio: string;
  generationMode: "exact_product" | "ai_creative";
  motionPreset: string;
  motionPrompt: string;
  notes: string;
  analysis: unknown;
  assets: SavedAssetRef[];
  createdAt: string;
  updatedAt: string;
}

export interface SaveProjectAssetInput {
  id: string;
  label: string;
  kind: SavedAssetRef["kind"];
  dataUrlOrBase64?: string;
  jobVideoFilename?: string;
  mimeType: string;
  style?: string;
  mode?: string;
  direction?: string;
  aspectRatio?: string;
  engine?: string;
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("wav")) return "wav";
  return "jpg";
}

function decodeDataUrlOrBase64(raw: string): Buffer {
  const commaIdx = raw.indexOf(",");
  const b64 = raw.startsWith("data:") && commaIdx !== -1 ? raw.slice(commaIdx + 1) : raw;
  return Buffer.from(b64, "base64");
}

export function listProjects(): Array<
  Pick<
    StoredProject,
    | "id"
    | "name"
    | "campaignType"
    | "clientOrBrandName"
    | "visualStyle"
    | "aspectRatio"
    | "createdAt"
    | "updatedAt"
  > & { thumbnailUrl?: string; assetCount: number; videoCount: number }
> {
  ensureDirs();
  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  const list: Array<
    Pick<
      StoredProject,
      | "id"
      | "name"
      | "campaignType"
      | "clientOrBrandName"
      | "visualStyle"
      | "aspectRatio"
      | "createdAt"
      | "updatedAt"
    > & { thumbnailUrl?: string; assetCount: number; videoCount: number }
  > = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const jsonPath = path.join(PROJECTS_DIR, entry.name, "project.json");
    if (!fs.existsSync(jsonPath)) continue;
    try {
      const p = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as StoredProject;
      const thumb =
        p.assets.find((a) => a.kind === "concept") ||
        p.assets.find((a) => a.kind === "source") ||
        p.assets.find((a) => a.kind === "cutout");
      list.push({
        id: p.id,
        name: p.name,
        campaignType: p.campaignType,
        clientOrBrandName: p.clientOrBrandName,
        visualStyle: p.visualStyle,
        aspectRatio: p.aspectRatio,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        thumbnailUrl: thumb?.url,
        assetCount: p.assets.filter((a) => a.kind === "concept" || a.kind === "cutout").length,
        videoCount: p.assets.filter((a) => a.kind === "video").length,
      });
    } catch {
      // skip corrupt folder
    }
  }

  list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return list;
}

export function getProject(id: string): StoredProject | null {
  ensureDirs();
  const safe = sanitizeId(id);
  if (!safe) return null;
  const jsonPath = path.join(PROJECTS_DIR, safe, "project.json");
  if (!fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8")) as StoredProject;
  } catch {
    return null;
  }
}

export function saveProject(input: {
  id?: string;
  name: string;
  campaignType: StoredProject["campaignType"];
  clientOrBrandName: string;
  language: StoredProject["language"];
  targetTone: string;
  visualStyle: string;
  aspectRatio: string;
  generationMode: StoredProject["generationMode"];
  motionPreset: string;
  motionPrompt: string;
  notes: string;
  analysis: unknown;
  assetsToSave?: SaveProjectAssetInput[];
  keepAssetFilenames?: string[];
}): StoredProject {
  ensureDirs();
  const safeExisting = input.id ? sanitizeId(input.id) : null;
  const id = safeExisting || `proj_${crypto.randomBytes(6).toString("hex")}`;
  const projDir = path.join(PROJECTS_DIR, id);
  const assetsDir = path.join(projDir, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  const existing = getProject(id);
  const now = new Date().toISOString();

  const savedAssets: SavedAssetRef[] = [];

  if (existing && Array.isArray(input.keepAssetFilenames)) {
    const keepSet = new Set(input.keepAssetFilenames);
    for (const old of existing.assets) {
      if (keepSet.has(old.filename)) {
        savedAssets.push(old);
      }
    }
  }

  if (Array.isArray(input.assetsToSave)) {
    for (let idx = 0; idx < input.assetsToSave.length; idx++) {
      const item = input.assetsToSave[idx];
      const ext = extensionForMime(item.mimeType || "image/png");
      const baseSlug = (item.id || `asset_${idx}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      const filename = `${baseSlug}.${ext}`;
      const targetPath = path.join(assetsDir, filename);

      if (item.jobVideoFilename) {
        const jobVideo = getJobVideoPath(item.jobVideoFilename);
        if (jobVideo) {
          fs.copyFileSync(jobVideo, targetPath);
        } else {
          continue;
        }
      } else if (item.dataUrlOrBase64) {
        const buf = decodeDataUrlOrBase64(item.dataUrlOrBase64);
        if (buf.length === 0 || buf.length > 65 * 1024 * 1024) continue;
        fs.writeFileSync(targetPath, buf);
      } else {
        continue;
      }

      const dedupeIdx = savedAssets.findIndex((a) => a.filename === filename);
      const ref: SavedAssetRef = {
        id: item.id,
        label: item.label,
        kind: item.kind,
        filename,
        mimeType: item.mimeType,
        url: `/api/projects/${id}/assets/${filename}`,
        style: item.style,
        mode: item.mode,
        direction: item.direction,
        aspectRatio: item.aspectRatio,
        engine: item.engine,
      };
      if (dedupeIdx >= 0) {
        savedAssets[dedupeIdx] = ref;
      } else {
        savedAssets.push(ref);
      }
    }
  }

  const project: StoredProject = {
    id,
    name: input.name.trim().slice(0, 120) || "Untitled Campaign",
    campaignType: input.campaignType,
    clientOrBrandName: input.clientOrBrandName.trim().slice(0, 120),
    language: input.language,
    targetTone: input.targetTone,
    visualStyle: input.visualStyle,
    aspectRatio: input.aspectRatio,
    generationMode: input.generationMode,
    motionPreset: input.motionPreset,
    motionPrompt: input.motionPrompt,
    notes: input.notes,
    analysis: input.analysis,
    assets: savedAssets,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  fs.writeFileSync(path.join(projDir, "project.json"), JSON.stringify(project, null, 2));
  return project;
}

export function renameOrPatchProject(
  id: string,
  patch: Partial<
    Pick<
      StoredProject,
      | "name"
      | "campaignType"
      | "clientOrBrandName"
      | "notes"
      | "analysis"
      | "motionPreset"
      | "motionPrompt"
      | "visualStyle"
      | "aspectRatio"
    >
  >
): StoredProject | null {
  const existing = getProject(id);
  if (!existing) return null;
  const updated: StoredProject = {
    ...existing,
    name:
      typeof patch.name === "string" && patch.name.trim()
        ? patch.name.trim().slice(0, 120)
        : existing.name,
    campaignType: patch.campaignType || existing.campaignType,
    clientOrBrandName:
      typeof patch.clientOrBrandName === "string"
        ? patch.clientOrBrandName.trim().slice(0, 120)
        : existing.clientOrBrandName,
    notes: typeof patch.notes === "string" ? patch.notes : existing.notes,
    analysis: patch.analysis !== undefined ? patch.analysis : existing.analysis,
    motionPreset: patch.motionPreset || existing.motionPreset,
    motionPrompt:
      typeof patch.motionPrompt === "string"
        ? patch.motionPrompt
        : existing.motionPrompt,
    visualStyle: patch.visualStyle || existing.visualStyle,
    aspectRatio: patch.aspectRatio || existing.aspectRatio,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(PROJECTS_DIR, existing.id, "project.json"),
    JSON.stringify(updated, null, 2)
  );
  return updated;
}

export function deleteProject(id: string): boolean {
  ensureDirs();
  const safe = sanitizeId(id);
  if (!safe) return false;
  const projDir = path.join(PROJECTS_DIR, safe);
  if (!fs.existsSync(projDir)) return false;
  fs.rmSync(projDir, { recursive: true, force: true });
  return true;
}

export function getProjectAssetPath(
  projectId: string,
  filename: string
): string | null {
  ensureDirs();
  const safeId = sanitizeId(projectId);
  const safeFile = sanitizeFilename(filename);
  if (!safeId || !safeFile) return null;
  const target = path.join(PROJECTS_DIR, safeId, "assets", safeFile);
  if (!fs.existsSync(target)) return null;
  return target;
}
