import fs from "node:fs";
import path from "node:path";

export interface ModelConfiguration {
  analysisModel: string;
  analysisFallbackModel: string;
  imageGenModel: string;
  videoGenModel: string;
  ttsModel: string;
  ttsFallbackModel: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), ".studio-data");
const CONFIG_FILE = path.join(DATA_DIR, "model-config.json");

const DEFAULT_CONFIG: ModelConfiguration = {
  analysisModel: process.env.GEMINI_ANALYSIS_MODEL || "gemini-4-hydrogen",
  analysisFallbackModel:
    process.env.GEMINI_ANALYSIS_FALLBACK_MODEL || "gemini-3.1-flash-lite",
  imageGenModel:
    process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite-image",
  videoGenModel: process.env.GEMINI_VIDEO_MODEL || "gemini-omni-1.2-flash",
  ttsModel: process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts",
  ttsFallbackModel:
    process.env.GEMINI_TTS_FALLBACK_MODEL || "gemini-3.8-flash-tts",
  updatedAt: new Date().toISOString(),
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getModelConfig(): ModelConfiguration {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<ModelConfiguration>;
    return {
      analysisModel: parsed.analysisModel || DEFAULT_CONFIG.analysisModel,
      analysisFallbackModel:
        parsed.analysisFallbackModel || DEFAULT_CONFIG.analysisFallbackModel,
      imageGenModel: parsed.imageGenModel || DEFAULT_CONFIG.imageGenModel,
      videoGenModel: parsed.videoGenModel || DEFAULT_CONFIG.videoGenModel,
      ttsModel: parsed.ttsModel || DEFAULT_CONFIG.ttsModel,
      ttsFallbackModel:
        parsed.ttsFallbackModel || DEFAULT_CONFIG.ttsFallbackModel,
      updatedAt: parsed.updatedAt || DEFAULT_CONFIG.updatedAt,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function updateModelConfig(
  patch: Partial<Omit<ModelConfiguration, "updatedAt">>
): ModelConfiguration {
  ensureDir();
  const current = getModelConfig();
  const cleanId = (val: unknown, fallback: string): string => {
    if (typeof val !== "string") return fallback;
    const trimmed = val.trim();
    if (!/^[a-zA-Z0-9._-]{3,80}$/.test(trimmed)) return fallback;
    return trimmed;
  };
  const next: ModelConfiguration = {
    analysisModel: cleanId(patch.analysisModel, current.analysisModel),
    analysisFallbackModel: cleanId(
      patch.analysisFallbackModel,
      current.analysisFallbackModel
    ),
    imageGenModel: cleanId(patch.imageGenModel, current.imageGenModel),
    videoGenModel: cleanId(patch.videoGenModel, current.videoGenModel),
    ttsModel: cleanId(patch.ttsModel, current.ttsModel),
    ttsFallbackModel: cleanId(patch.ttsFallbackModel, current.ttsFallbackModel),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}
