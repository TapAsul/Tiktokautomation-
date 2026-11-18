import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import {
  ASPECT_RATIOS,
  CAMPAIGN_TYPES,
  clampText,
  formatGeminiError,
  GENERATION_MODES,
  normalizeMotionPreset,
  sanitizeFilename,
  sanitizeId,
  validateImageInput,
  VISUAL_STYLES,
  type AspectRatioOption,
  type CampaignType,
  type ImageGenerationMode,
  type MotionPreset,
  type VisualStyle,
} from "../../server/validation";

interface KVNamespaceLike {
  get(key: string, type?: "text" | "json" | "arrayBuffer"): Promise<unknown>;
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView,
    options?: { expirationTtl?: number; metadata?: unknown }
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

interface PagesEnv {
  GEMINI_API_KEY?: string;
  GEMINI_ANALYSIS_MODEL?: string;
  GEMINI_ANALYSIS_FALLBACK_MODEL?: string;
  GEMINI_IMAGE_MODEL?: string;
  GEMINI_VIDEO_MODEL?: string;
  GEMINI_TTS_MODEL?: string;
  GEMINI_TTS_FALLBACK_MODEL?: string;
  STUDIO_KV?: KVNamespaceLike;
}

interface PagesContext {
  request: Request;
  env: PagesEnv;
  params: Record<string, string | string[]>;
}

interface ModelConfiguration {
  analysisModel: string;
  analysisFallbackModel: string;
  imageGenModel: string;
  videoGenModel: string;
  ttsModel: string;
  ttsFallbackModel: string;
  updatedAt: string;
}

type ModelCapabilityStatus =
  | "available"
  | "quota_limited"
  | "unavailable"
  | "untested";

interface ServiceCapabilityEntry {
  service: "analysis" | "image" | "video" | "tts";
  label: string;
  model: string;
  status: ModelCapabilityStatus;
  note: string;
  checkedAt: string | null;
}

type UsageOperationType =
  | "analysis"
  | "copy"
  | "image_gen"
  | "video_gen"
  | "tts";

interface UsageLogEntry {
  id: string;
  operation: UsageOperationType;
  model: string;
  status: "success" | "error";
  durationMs: number;
  note?: string;
  timestamp: string;
}

interface UsageStats {
  analysisCalls: number;
  copyCalls: number;
  imageGenCalls: number;
  videoGenCalls: number;
  ttsCalls: number;
  errors: number;
  lastUpdated: string;
  recentLogs: UsageLogEntry[];
}

interface SavedAssetRef {
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

interface StoredProject {
  id: string;
  name: string;
  campaignType: CampaignType;
  clientOrBrandName: string;
  language: "tagalog" | "english";
  targetTone: string;
  visualStyle: string;
  aspectRatio: string;
  generationMode: ImageGenerationMode;
  motionPreset: string;
  motionPrompt: string;
  notes: string;
  analysis: unknown;
  assets: SavedAssetRef[];
  createdAt: string;
  updatedAt: string;
}

interface SaveProjectAssetInput {
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

// Isolate-scoped fallback caches when STUDIO_KV is not bound
let memoryConfig: ModelConfiguration | null = null;
let primaryTimeoutUntil = 0;
const memoryUsage: UsageStats = {
  analysisCalls: 0,
  copyCalls: 0,
  imageGenCalls: 0,
  videoGenCalls: 0,
  ttsCalls: 0,
  errors: 0,
  lastUpdated: new Date().toISOString(),
  recentLogs: [],
};

const capabilityCache: Record<
  "analysis" | "image" | "video" | "tts",
  ServiceCapabilityEntry
> = {
  analysis: {
    service: "analysis",
    label: "Product Analysis & Ad Copywriting",
    model: "gemini-4-hydrogen",
    status: "untested",
    note: "Ready to verify on Cloudflare edge.",
    checkedAt: null,
  },
  image: {
    service: "image",
    label: "Generative Image Studio (Nano Banana)",
    model: "gemini-3.1-flash-lite-image",
    status: "untested",
    note: "Exact Product Mode works anytime via studio compositing; AI Creative & Nano Banana backdrops depend on environment quota.",
    checkedAt: null,
  },
  video: {
    service: "video",
    label: "AI Video Generation (Gemini Omni)",
    model: "gemini-omni-1.2-flash",
    status: "untested",
    note: "Gemini Omni MP4 requires active quota; Exact-Product Layer Video Compositor is always available.",
    checkedAt: null,
  },
  tts: {
    service: "tts",
    label: "AI Voiceover Speech (Gemini TTS)",
    model: "gemini-3.8-flash-lite-tts",
    status: "untested",
    note: "Synthesizes voiceover tracks with automatic fallback model.",
    checkedAt: null,
  },
};

function defaultModelConfig(env: PagesEnv): ModelConfiguration {
  return {
    analysisModel: env.GEMINI_ANALYSIS_MODEL || "gemini-4-hydrogen",
    analysisFallbackModel:
      env.GEMINI_ANALYSIS_FALLBACK_MODEL || "gemini-3.1-flash-lite",
    imageGenModel: env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite-image",
    videoGenModel: env.GEMINI_VIDEO_MODEL || "gemini-omni-1.2-flash",
    ttsModel: env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts",
    ttsFallbackModel:
      env.GEMINI_TTS_FALLBACK_MODEL || "gemini-3.8-flash-tts",
    updatedAt: new Date().toISOString(),
  };
}

async function getModelConfigEdge(env: PagesEnv): Promise<ModelConfiguration> {
  const defaults = defaultModelConfig(env);
  if (env.STUDIO_KV) {
    try {
      const saved = (await env.STUDIO_KV.get(
        "ps:model-config",
        "json"
      )) as Partial<ModelConfiguration> | null;
      if (saved) {
        return {
          analysisModel: saved.analysisModel || defaults.analysisModel,
          analysisFallbackModel:
            saved.analysisFallbackModel || defaults.analysisFallbackModel,
          imageGenModel: saved.imageGenModel || defaults.imageGenModel,
          videoGenModel: saved.videoGenModel || defaults.videoGenModel,
          ttsModel: saved.ttsModel || defaults.ttsModel,
          ttsFallbackModel: saved.ttsFallbackModel || defaults.ttsFallbackModel,
          updatedAt: saved.updatedAt || defaults.updatedAt,
        };
      }
    } catch {
      // fall through
    }
  }
  return memoryConfig || defaults;
}

async function updateModelConfigEdge(
  env: PagesEnv,
  patch: Partial<Omit<ModelConfiguration, "updatedAt">>
): Promise<ModelConfiguration> {
  const current = await getModelConfigEdge(env);
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
  memoryConfig = next;
  if (env.STUDIO_KV) {
    try {
      await env.STUDIO_KV.put("ps:model-config", JSON.stringify(next));
    } catch {
      // ignore KV write failure
    }
  }
  return next;
}

async function recordUsageEdge(
  env: PagesEnv,
  operation: UsageOperationType,
  model: string,
  status: "success" | "error",
  durationMs: number,
  note?: string
) {
  let stats = memoryUsage;
  if (env.STUDIO_KV) {
    try {
      const kvStats = (await env.STUDIO_KV.get(
        "ps:usage",
        "json"
      )) as Partial<UsageStats> | null;
      if (kvStats) {
        stats = {
          analysisCalls: kvStats.analysisCalls ?? 0,
          copyCalls: kvStats.copyCalls ?? 0,
          imageGenCalls: kvStats.imageGenCalls ?? 0,
          videoGenCalls: kvStats.videoGenCalls ?? 0,
          ttsCalls: kvStats.ttsCalls ?? 0,
          errors: kvStats.errors ?? 0,
          lastUpdated: kvStats.lastUpdated || new Date().toISOString(),
          recentLogs: Array.isArray(kvStats.recentLogs) ? kvStats.recentLogs : [],
        };
      }
    } catch {
      // fallback to memoryUsage
    }
  }

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

  Object.assign(memoryUsage, stats);
  if (env.STUDIO_KV) {
    try {
      await env.STUDIO_KV.put("ps:usage", JSON.stringify(stats));
    } catch {
      // ignore KV write error
    }
  }
}

async function getUsageEdge(env: PagesEnv): Promise<UsageStats> {
  if (env.STUDIO_KV) {
    try {
      const kvStats = (await env.STUDIO_KV.get(
        "ps:usage",
        "json"
      )) as UsageStats | null;
      if (kvStats) return kvStats;
    } catch {
      // fall through
    }
  }
  return memoryUsage;
}

function getApiKey(env: PagesEnv): string {
  const key =
    env.GEMINI_API_KEY ||
    (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined);
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not configured in Cloudflare Pages environment variables."
    );
  }
  return key;
}

function getGeminiClient(env: PagesEnv): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: getApiKey(env),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getGeminiBetaClient(env: PagesEnv): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: getApiKey(env),
    apiVersion: "v1beta",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function updateCapabilityState(
  service: "analysis" | "image" | "video" | "tts",
  model: string,
  status: ModelCapabilityStatus,
  note: string
) {
  capabilityCache[service] = {
    ...capabilityCache[service],
    model,
    status,
    note,
    checkedAt: new Date().toISOString(),
  };
}

function getLanguageInstruction(language?: string): string {
  if (language === "english") {
    return "Write all hooks, headlines, productDescription, caption, ctaSuggestions, video overlays, and voiceover script in natural, high-converting English.";
  }
  return "Write ALL consumer-facing marketing copy (shortTagline, keyBenefits, headlines, productDescription, hooks onScreenText & spokenLine, caption, hashtags, ctaSuggestions, and videoScript beat1Hook, beat2Benefit, beat3Offer, voiceoverText) in natural, conversational Filipino / Tagalog (authentic TikTok Shop PH creator Taglish style—punchy, relatable, persuasive). Keep productName accurate to the label.";
}

const STRATEGIST_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    competitiveAngle: { type: Type.STRING },
    hooks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          style: { type: Type.STRING },
          onScreenText: { type: Type.STRING },
          spokenLine: { type: Type.STRING },
        },
        required: ["id", "style", "onScreenText", "spokenLine"],
      },
    },
    headlines: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    productDescription: { type: Type.STRING },
    caption: { type: Type.STRING },
    hashtags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    ctaSuggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    videoScript: {
      type: Type.OBJECT,
      properties: {
        beat1Hook: { type: Type.STRING },
        beat2Benefit: { type: Type.STRING },
        beat3Offer: { type: Type.STRING },
        voiceoverText: { type: Type.STRING },
      },
      required: ["beat1Hook", "beat2Benefit", "beat3Offer", "voiceoverText"],
    },
    googleFlowPrompt: { type: Type.STRING },
    backgroundPrompt: { type: Type.STRING },
  },
  required: [
    "competitiveAngle",
    "hooks",
    "headlines",
    "productDescription",
    "caption",
    "hashtags",
    "ctaSuggestions",
    "videoScript",
    "googleFlowPrompt",
    "backgroundPrompt",
  ],
};

async function generateWithConfigurableModel(
  ai: GoogleGenAI,
  cfg: ModelConfiguration,
  contents: Parameters<GoogleGenAI["models"]["generateContent"]>[0]["contents"],
  config: Omit<
    NonNullable<
      Parameters<GoogleGenAI["models"]["generateContent"]>[0]["config"]
    >,
    "abortSignal" | "thinkingConfig"
  >
) {
  let primaryErr: unknown = null;
  const skipPrimary =
    Date.now() < primaryTimeoutUntil &&
    cfg.analysisFallbackModel !== cfg.analysisModel;

  if (!skipPrimary) {
    try {
      return {
        modelUsed: cfg.analysisModel,
        response: await ai.models.generateContent({
          model: cfg.analysisModel,
          contents,
          config: {
            ...config,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: AbortSignal.timeout(12000),
          },
        }),
      };
    } catch (err) {
      primaryErr = err;
      primaryTimeoutUntil = Date.now() + 3 * 60 * 1000;
    }
  }

  try {
    return {
      modelUsed: cfg.analysisFallbackModel,
      response: await ai.models.generateContent({
        model: cfg.analysisFallbackModel,
        contents,
        config: {
          ...config,
          abortSignal: AbortSignal.timeout(35000),
        },
      }),
    };
  } catch (fallbackErr) {
    const msg1 =
      primaryErr instanceof Error
        ? primaryErr.message
        : String(primaryErr || "skipped");
    const msg2 =
      fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
    throw new Error(`Gemini request failed (${msg1}; fallback: ${msg2})`);
  }
}

const STYLE_DIRECTIONS: Record<VisualStyle, string[]> = {
  Luxury: [
    "dark veined Nero Marquina marble pedestal with warm champagne rim light and architectural shadow",
    "brushed champagne brass vanity table inside an upscale penthouse suite with soft sunlit bokeh",
    "monolithic travertine plinth against smoked walnut paneling and moody spotlight falloff",
  ],
  Minimalist: [
    "seamless warm plaster cyclorama wall with a clean limestone display block and crisp softbox lighting",
    "matte alabaster tabletop in diffused north-facing daylight with gentle window blind shadows",
    "nordic off-white ceramic plinth with subtle sculptural curves and ultra-clean tonal balance",
  ],
  Cinematic: [
    "dramatic moody studio set with volumetric amber back-light beams, wet slate stone deck, and shallow bokeh",
    "golden-hour twilight terrace overlook with warm teal-and-amber cinematic color grade and soft haze",
    "high-contrast noir commercial pedestal lit by precision fresnel spotlight and subtle atmospheric mist",
  ],
  Futuristic: [
    "sleek brushed titanium pedestal surrounded by subtle glass prism refractions and cool slate studio light",
    "anodized aluminum architectural tech stage with recessed cyan rim illumination and smooth obsidian floor",
    "translucent frosted acrylic display block floating over dark metallic waves with crisp studio speculars",
  ],
  Editorial: [
    "high-fashion magazine set with warm sandstone archways, pleated linen drapery blur, and crisp sunlight",
    "contemporary art gallery plinth in cool gallery concrete with directional museum track lighting",
    "mid-century walnut credenza surface styled with glazed ceramic shadows and warm editorial daylight",
  ],
  Organic: [
    "sun-drenched travertine vanity ledge framed by out-of-focus olive leaves and soft morning dew sparkles",
    "raw river stone slab resting on pale linen cloth beside soft botanical leaf shadows and warm sunlight",
    "earthy terracotta plaster alcove bathed in golden afternoon sunbeams and tranquil spa bokeh",
  ],
  Vibrant: [
    "bold editorial color-block studio stage with sunlit satin gradient sweep and energetic rim highlights",
    "pop-commercial acrylic pedestal with sparkling prism caustics and bright daylight studio energy",
    "modern pop-up retail display cube surrounded by cheerful warm gradient walls and crisp shadows",
  ],
  "Warm Studio": [
    "creamy sunlit oak countertop with soft morning coffeehouse window glow and warm neutral bokeh",
    "warm beige Venetian plaster niche with a smooth limestone podium and inviting golden light",
    "cozy sandstone vanity corner lit by soft golden-hour reflection and tranquil depth of field",
  ],
};

const FALLBACK_BACKDROPS_BY_STYLE: Record<
  VisualStyle,
  Array<
    "travertine" | "obsidian" | "botanical" | "street_concrete" | "blush" | "pearl"
  >
> = {
  Luxury: ["obsidian", "travertine", "blush"],
  Minimalist: ["pearl", "travertine", "street_concrete"],
  Cinematic: ["obsidian", "street_concrete", "travertine"],
  Futuristic: ["obsidian", "street_concrete", "pearl"],
  Editorial: ["travertine", "blush", "street_concrete"],
  Organic: ["botanical", "travertine", "pearl"],
  Vibrant: ["blush", "pearl", "travertine"],
  "Warm Studio": ["travertine", "blush", "botanical"],
};

const CONCEPT_TITLES = [
  "Hero Studio Pedestal",
  "Atmospheric Context Set",
  "Editorial Contrast Stage",
];

const MOTION_PRESET_GUIDANCE: Record<MotionPreset, string> = {
  "Cinematic Product Reveal":
    "Dramatic hero reveal pulling out of soft shadow into warm commercial rim lighting, smooth glide across packaging edges and specular highlights.",
  "Slow Camera Push":
    "Smooth, deliberate architectural push-in toward the hero product with crisp rack focus pulling across textures and natural studio highlights.",
  "Floating Product Showcase":
    "Subtle weightless levitation with gentle micro-bobbing motion above a sculptural pedestal and soft ambient dust motes drifting in slow motion.",
  "Rotating Product Display":
    "Controlled 360-degree studio turntable rotation of the product, keeping silhouette rock-steady while specular light catches label details.",
  "Luxury Commercial":
    "High-fashion editorial commercial shot with golden-hour reflections, velvet bokeh shadows, and silky curved dolly movement around the hero bottle or item.",
  "Minimalist Product Presentation":
    "Clean architectural composition with ultra-steady subtle drift, crisp daylight diffusion, and refined neutral-stone studio atmosphere.",
  "Dramatic Lighting Reveal":
    "Locked-off camera while a warm key-light sweeps gradually across the product surface, shifting shadows from moody twilight into sharp studio contrast.",
  "TikTok Product Advertisement":
    "Dynamic 9:16 vertical social ad rhythm with crisp opening snap-in framing, bright natural daylight, and punchy commercial product clarity.",
};

function extractInlineImage(response: unknown): {
  data: string;
  mimeType: string;
} | null {
  const r = response as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
        }>;
      };
    }>;
  };
  const parts = r?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
  }
  return null;
}

async function verifyVideoModelAccessEdge(
  aiBeta: GoogleGenAI,
  cfg: ModelConfiguration
) {
  const model = cfg.videoGenModel;
  const endpoint = "/v1beta/interactions";
  try {
    await aiBeta.models.get({ model });
    return {
      available: true,
      status: "available" as const,
      model,
      apiVersion: "v1beta",
      endpoint,
      note: `${model} is registered on v1beta Interactions API.`,
    };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    const formatted = formatGeminiError(err, model);
    const isQuota =
      raw.includes("429") ||
      raw.includes("RESOURCE_EXHAUSTED") ||
      raw.toLowerCase().includes("quota");
    const isNotFound = raw.includes("404") || raw.includes("NOT_FOUND");
    const isPerm = raw.includes("403") || raw.includes("PERMISSION_DENIED");
    const note = isNotFound
      ? `${model} is not accessible on v1beta in this project (404). Exact Product Showcase and Google Flow Manual Editor remain fully available.`
      : isQuota
        ? `${formatted} Exact Product Showcase and Google Flow Manual Editor remain fully available.`
        : isPerm
          ? `This API key project does not have permission/billing access for ${model} on v1beta. Exact Product Showcase and Google Flow Manual Editor remain fully available.`
          : `${formatted} Exact Product Showcase remains available locally.`;
    return {
      available: false,
      status: isQuota ? ("quota_limited" as const) : ("unavailable" as const),
      model,
      apiVersion: "v1beta",
      endpoint,
      note,
    };
  }
}

interface EncodedEdgeVideoToken {
  interactionId: string;
  model: string;
  aspectRatio: AspectRatioOption;
  durationSec: number;
  resolution: "720p" | "1080p";
  createdAt: string;
}

function encodeEdgeVideoJobId(payload: EncodedEdgeVideoToken): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `cfv_${b64}`;
}

function decodeEdgeVideoJobId(id: string): EncodedEdgeVideoToken | null {
  if (!id.startsWith("cfv_")) return null;
  try {
    let b64 = id.slice(4).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as EncodedEdgeVideoToken;
    if (!parsed.interactionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractVideoFromInteraction(interaction: {
  output_video?: { data?: string; mime_type?: string } | null;
  outputs?: Array<{ type?: string; data?: string; mime_type?: string }>;
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; data?: string; mime_type?: string }>;
  }>;
}): string | undefined {
  if (interaction.output_video?.data) return interaction.output_video.data;
  const fromOutputs = interaction.outputs?.find(
    (o) => o.type === "video" && typeof o.data === "string"
  )?.data;
  if (fromOutputs) return fromOutputs;
  if (Array.isArray(interaction.steps)) {
    for (const step of interaction.steps) {
      if (step.type === "model_output") {
        const vidPart = step.content?.find(
          (c) => c.type === "video" && typeof c.data === "string"
        );
        if (vidPart?.data) return vidPart.data;
      }
    }
  }
  return undefined;
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("wav")) return "wav";
  return "jpg";
}

function base64ToUint8Array(base64: string): Uint8Array {
  const commaIdx = base64.indexOf(",");
  const clean =
    base64.startsWith("data:") && commaIdx !== -1
      ? base64.slice(commaIdx + 1)
      : base64;
  const bin = atob(clean.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function readJsonBody<T = Record<string, unknown>>(
  request: Request
): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  try {
    // Health
    if (path === "/api/health" && method === "GET") {
      const models = await getModelConfigEdge(env);
      return jsonResponse({
        ok: true,
        service: "Product Studio AI",
        runtime: "cloudflare-pages",
        kvConfigured: Boolean(env.STUDIO_KV),
        models,
      });
    }

    // Model Config
    if (path === "/api/config/models" && method === "GET") {
      return jsonResponse(await getModelConfigEdge(env));
    }

    if (path === "/api/config/models" && method === "PUT") {
      const body = await readJsonBody<Partial<Omit<ModelConfiguration, "updatedAt">>>(request);
      const updated = await updateModelConfigEdge(env, body);
      primaryTimeoutUntil = 0;
      capabilityCache.analysis.model = updated.analysisModel;
      capabilityCache.image.model = updated.imageGenModel;
      capabilityCache.video.model = updated.videoGenModel;
      capabilityCache.tts.model = updated.ttsModel;
      return jsonResponse(updated);
    }

    // Models Availability
    if (path === "/api/models/availability" && method === "GET") {
      const cfg = await getModelConfigEdge(env);
      const keyConfigured = Boolean(
        env.GEMINI_API_KEY ||
          (typeof process !== "undefined" && process.env?.GEMINI_API_KEY)
      );
      const shouldProbe = url.searchParams.get("probe") === "1";

      capabilityCache.analysis.model = cfg.analysisModel;
      capabilityCache.image.model = cfg.imageGenModel;
      capabilityCache.video.model = cfg.videoGenModel;
      capabilityCache.tts.model = cfg.ttsModel;

      if (!keyConfigured) {
        return jsonResponse({
          keyConfigured: false,
          config: cfg,
          services: (
            Object.keys(capabilityCache) as Array<keyof typeof capabilityCache>
          ).map((k) => ({
            ...capabilityCache[k],
            status: "unavailable" as ModelCapabilityStatus,
            note: "GEMINI_API_KEY is not configured in Cloudflare Pages Variables & Secrets.",
          })),
        });
      }

      if (shouldProbe) {
        const ai = getGeminiClient(env);
        try {
          await ai.models.generateContent({
            model: cfg.analysisModel,
            contents: "Reply with OK.",
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              abortSignal: AbortSignal.timeout(8000),
            },
          });
          primaryTimeoutUntil = 0;
          updateCapabilityState(
            "analysis",
            cfg.analysisModel,
            "available",
            `${cfg.analysisModel} responded normally.`
          );
        } catch (primaryProbeErr) {
          try {
            await ai.models.generateContent({
              model: cfg.analysisFallbackModel,
              contents: "Reply with OK.",
              config: { abortSignal: AbortSignal.timeout(10000) },
            });
            primaryTimeoutUntil = Date.now() + 3 * 60 * 1000;
            updateCapabilityState(
              "analysis",
              cfg.analysisFallbackModel,
              "available",
              `${cfg.analysisFallbackModel} active (automatic fallback from ${cfg.analysisModel}).`
            );
          } catch (fallbackProbeErr) {
            const formatted = formatGeminiError(
              fallbackProbeErr || primaryProbeErr,
              cfg.analysisModel
            );
            updateCapabilityState(
              "analysis",
              cfg.analysisModel,
              formatted.toLowerCase().includes("quota") ||
                formatted.includes("429")
                ? "quota_limited"
                : "unavailable",
              formatted
            );
          }
        }

        try {
          const imgResp = await ai.models.generateContent({
            model: cfg.imageGenModel,
            contents: "Solid neutral slate studio background, minimal, 1:1.",
            config: {
              responseModalities: ["IMAGE"],
              abortSignal: AbortSignal.timeout(15000),
            },
          });
          const hasPart = Boolean(
            imgResp.candidates?.[0]?.content?.parts?.some(
              (p) => p.inlineData?.data
            )
          );
          updateCapabilityState(
            "image",
            cfg.imageGenModel,
            hasPart ? "available" : "unavailable",
            hasPart
              ? `${cfg.imageGenModel} is active and generating images.`
              : "Model responded without image bytes."
          );
        } catch (err) {
          const formatted = formatGeminiError(err, cfg.imageGenModel);
          updateCapabilityState(
            "image",
            cfg.imageGenModel,
            formatted.toLowerCase().includes("quota") ||
              formatted.toLowerCase().includes("limit: 0")
              ? "quota_limited"
              : "unavailable",
            `${formatted} Exact Product Mode continues compositing untouched pixels locally.`
          );
        }

        const videoProbe = await verifyVideoModelAccessEdge(
          getGeminiBetaClient(env),
          cfg
        );
        updateCapabilityState(
          "video",
          videoProbe.model,
          videoProbe.status,
          videoProbe.note
        );
      }

      return jsonResponse({
        keyConfigured,
        config: cfg,
        services: [
          capabilityCache.analysis,
          capabilityCache.image,
          capabilityCache.video,
          capabilityCache.tts,
        ],
      });
    }

    // Video Studio Availability
    if (path === "/api/video-studio/availability" && method === "GET") {
      const cfg = await getModelConfigEdge(env);
      const hasKey = Boolean(
        env.GEMINI_API_KEY ||
          (typeof process !== "undefined" && process.env?.GEMINI_API_KEY)
      );
      if (!hasKey) {
        return jsonResponse({
          available: false,
          status: "unavailable",
          model: cfg.videoGenModel,
          apiVersion: "v1beta",
          endpoint: "/v1beta/interactions",
          note: "GEMINI_API_KEY is not configured in Cloudflare Pages Variables & Secrets.",
        });
      }
      const probe = await verifyVideoModelAccessEdge(
        getGeminiBetaClient(env),
        cfg
      );
      updateCapabilityState("video", probe.model, probe.status, probe.note);
      return jsonResponse(probe);
    }

    // Usage
    if (path === "/api/usage" && method === "GET") {
      return jsonResponse(await getUsageEdge(env));
    }

    // Analyze Product
    if (path === "/api/analyze-product" && method === "POST") {
      const start = Date.now();
      const cfg = await getModelConfigEdge(env);
      try {
        const body = await readJsonBody<{
          imageBase64?: string;
          mimeType?: string;
          targetTone?: string;
          language?: string;
          pricePromo?: string;
          productDetails?: string;
          detailsImageBase64?: string;
          detailsImageMimeType?: string;
          campaignType?: string;
        }>(request);

        const mainImg = validateImageInput(
          body.imageBase64,
          body.mimeType,
          "product image"
        );
        if (mainImg.ok === false) {
          return jsonResponse({ error: mainImg.error }, 400);
        }

        let validDetailsImg: { base64: string; mimeType: string } | null = null;
        if (body.detailsImageBase64 && body.detailsImageMimeType) {
          const dRes = validateImageInput(
            body.detailsImageBase64,
            body.detailsImageMimeType,
            "details image"
          );
          if (dRes.ok === false) {
            return jsonResponse({ error: dRes.error }, 400);
          }
          validDetailsImg = { base64: dRes.base64, mimeType: dRes.mimeType };
        }

        const ai = getGeminiClient(env);
        const toneGuidance =
          body.targetTone === "clean_aesthetic"
            ? "Minimalist, trust-building, aesthetic creator tone (calm confidence, sensory details, zero hype)."
            : body.targetTone === "problem_solution"
              ? "Pain-point first, relatable everyday problem-to-relief TikTok creator tone."
              : "High-converting TikTok Shop scroll-stopper tone with fast curiosity hooks and clear product positioning.";

        const campaignFraming =
          body.campaignType === "own_brand"
            ? "Campaign Type: Own Brand Campaign (authoritative brand positioning, quality craftsmanship, repeat buyer trust)."
            : body.campaignType === "client_agency"
              ? "Campaign Type: Client Advertising Campaign (agency-grade commercial clarity, conversion-focused ad deliverables)."
              : "Campaign Type: Affiliate Product Campaign (relatable personal discovery, honest feature showcase, yellow-basket CTA).";

        const langInstruction = getLanguageInstruction(body.language);
        const safePricePromo = clampText(body.pricePromo, 300);
        const safeProductDetails = clampText(body.productDetails, 1200);
        const sellerContextLines = [
          safePricePromo ? `- Seller Price / Promo Offer: ${safePricePromo}` : "",
          safeProductDetails
            ? `- Seller Product Details / Specs: ${safeProductDetails}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        const analyzeParts: Array<
          | { inlineData: { mimeType: string; data: string } }
          | { text: string }
        > = [
          {
            inlineData: {
              mimeType: mainImg.mimeType,
              data: mainImg.base64,
            },
          },
        ];

        if (validDetailsImg) {
          analyzeParts.push({
            inlineData: {
              mimeType: validDetailsImg.mimeType,
              data: validDetailsImg.base64,
            },
          });
        }

        analyzeParts.push({
          text: `Analyze ${validDetailsImg ? "these two images" : "this product photograph/screenshot"} for a commercial TikTok advertising production studio.
- Image 1 is the MAIN PRODUCT PHOTOGRAPH/SCREENSHOT.${validDetailsImg ? "\n- Image 2 is ONLY a supporting screenshot of the product's written description, specs, size chart, or promo details. Read ALL visible facts from Image 2 accurately." : ""}
${sellerContextLines ? `\nSELLER-SUPPLIED MARKETING DETAILS (use these factual details verbatim where helpful):\n${sellerContextLines}\n` : ""}
${campaignFraming}

CRITICAL TRUTHFULNESS RULE:
- NEVER invent prices, discounts, percentages off, free shipping claims, fake testimonials, guarantees, ratings, or technical specifications that are NOT explicitly visible in Image 1, Image 2, or Seller-Supplied Details above. If no price or discount is provided, keep beat3Offer, CTAs, and copy strictly benefit/action-focused without fabricating peso/dollar numbers.

1. Visual Product Identification (from Image 1 ONLY):
   - productName, category
   - appearance: concise visual summary of overall appearance, styling, finish, and form factor
   - colors: array of 2–4 visible product color names/hex hints (e.g. "Amber Glass (#B45309)")
   - shape: concise physical silhouette and proportions description
   - material: visible material/finish (e.g. "Acetate frame & tinted polycarbonate lenses", "Matte glass dropper bottle", "Heavyweight brushed cotton")
   - branding: visible logos and brand names on product or "Unbranded / Minimal label"
   - visibleText: exact text, numbers, volume, or printed labels visible on the product (or "None visible")
   - distinguishingDetails: unique structural or visual details to preserve (e.g. "Ribbed black dropper cap, silver neck collar, vertical serif typography")
   - productBox: tight normalized 0..1000 bounding box (ymin, xmin, ymax, xmax) hugging ONLY the physical object edges—STRICTLY EXCLUDE headers, UI chrome, text titles, watermarks, or badges outside the object.
   - wearType: 'apparel_top' | 'eyewear' | 'headwear' | 'handheld_showcase'
   - suggestedBackdrop: 'travertine' | 'obsidian' | 'botanical' | 'street_concrete' | 'blush' | 'pearl' (never use 'pearl' for white/silver/clear items)
   - accentHex: harmonious 6-digit hex accent color
2. AI Advertising Copywriter (${toneGuidance}):
   - LANGUAGE: ${langInstruction}
   - 3 distinct attention-grabbing 0–3s hooks (id, style, onScreenText max 7 words, spokenLine)
   - 3 advertising headlines (crisp mobile-readable ad headlines)
   - productDescription (2–3 truthful, persuasive sentences based ONLY on visible/provided facts)
   - caption (ready-to-paste TikTok caption with spacing & CTA)
   - hashtags (6–8 buyer-intent hashtags with #)
   - ctaSuggestions (3 concrete CTAs)
   - videoScript (beat1Hook, beat2Benefit, beat3Offer, 18–24 word voiceoverText)
   - googleFlowPrompt: 55–85 word Google Flow (labs.google/fx/tools/flow) prompt with ${body.language === "english" ? 'a funny relatable 0-3s hook in quotes' : 'a funny, relatable Tagalog/Taglish 0-3s hook in quotes'} + 9:16 UGC framing + ending yellow basket gesture.
   - backgroundPrompt: Expert commercial set designer 9:16 background prompt matching niche. Rules: (1) Never include the product itself. (2) Clean space in center for foreground cutout. (3) Include 'shallow depth of field, blurred bokeh background, photorealistic, 8k'. (4) Match lighting temperature to product vibe. Raw prompt text only.`,
        });

        const { response, modelUsed } = await generateWithConfigurableModel(
          ai,
          cfg,
          { parts: analyzeParts },
          {
            systemInstruction:
              "You are a senior e-commerce visual director and commercial advertising strategist. Always return valid JSON matching the schema. Never fabricate prices, discounts, testimonials, or unverified specs.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                productName: { type: Type.STRING },
                category: { type: Type.STRING },
                appearance: { type: Type.STRING },
                colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                shape: { type: Type.STRING },
                material: { type: Type.STRING },
                branding: { type: Type.STRING },
                visibleText: { type: Type.STRING },
                distinguishingDetails: { type: Type.STRING },
                wearType: {
                  type: Type.STRING,
                  enum: [
                    "apparel_top",
                    "eyewear",
                    "headwear",
                    "handheld_showcase",
                  ],
                },
                shortTagline: { type: Type.STRING },
                keyBenefits: { type: Type.ARRAY, items: { type: Type.STRING } },
                targetAudience: { type: Type.STRING },
                productBox: {
                  type: Type.OBJECT,
                  properties: {
                    ymin: { type: Type.INTEGER },
                    xmin: { type: Type.INTEGER },
                    ymax: { type: Type.INTEGER },
                    xmax: { type: Type.INTEGER },
                  },
                  required: ["ymin", "xmin", "ymax", "xmax"],
                },
                suggestedBackdrop: {
                  type: Type.STRING,
                  enum: [
                    "travertine",
                    "obsidian",
                    "botanical",
                    "street_concrete",
                    "blush",
                    "pearl",
                  ],
                },
                accentHex: { type: Type.STRING },
                strategist: STRATEGIST_SCHEMA,
              },
              required: [
                "productName",
                "category",
                "appearance",
                "colors",
                "shape",
                "material",
                "branding",
                "visibleText",
                "distinguishingDetails",
                "wearType",
                "shortTagline",
                "keyBenefits",
                "targetAudience",
                "productBox",
                "suggestedBackdrop",
                "accentHex",
                "strategist",
              ],
            },
          }
        );

        const rawText = (response.text ?? "").trim();
        if (!rawText) {
          await recordUsageEdge(
            env,
            "analysis",
            modelUsed,
            "error",
            Date.now() - start,
            "Empty JSON"
          );
          return jsonResponse(
            { error: "Empty response from Gemini analysis." },
            502
          );
        }

        const parsed = JSON.parse(rawText);
        updateCapabilityState(
          "analysis",
          modelUsed,
          "available",
          `${modelUsed} operational.`
        );
        await recordUsageEdge(
          env,
          "analysis",
          modelUsed,
          "success",
          Date.now() - start,
          parsed.productName
        );
        return jsonResponse(parsed);
      } catch (err) {
        const msg = formatGeminiError(err, cfg.analysisModel);
        updateCapabilityState(
          "analysis",
          cfg.analysisModel,
          msg.toLowerCase().includes("quota") ? "quota_limited" : "unavailable",
          msg
        );
        await recordUsageEdge(
          env,
          "analysis",
          cfg.analysisModel,
          "error",
          Date.now() - start,
          msg
        );
        return jsonResponse({ error: msg }, 500);
      }
    }

    // Regenerate Copy
    if (path === "/api/regenerate-copy" && method === "POST") {
      const start = Date.now();
      const cfg = await getModelConfigEdge(env);
      try {
        const body = await readJsonBody<{
          productName?: string;
          category?: string;
          keyBenefits?: string[];
          targetTone?: string;
          customPrompt?: string;
          language?: string;
          productDetails?: string;
          pricePromo?: string;
          detailsImageBase64?: string;
          detailsImageMimeType?: string;
          campaignType?: string;
          targetAudience?: string;
          verifiedDiscounts?: string;
          campaignObjectives?: string;
        }>(request);

        const cleanName = clampText(body.productName, 160);
        if (!cleanName) {
          return jsonResponse({ error: "productName is required." }, 400);
        }

        let validDetailsImg: { base64: string; mimeType: string } | null = null;
        if (body.detailsImageBase64 && body.detailsImageMimeType) {
          const dRes = validateImageInput(
            body.detailsImageBase64,
            body.detailsImageMimeType,
            "details image"
          );
          if (dRes.ok === false) {
            return jsonResponse({ error: dRes.error }, 400);
          }
          validDetailsImg = { base64: dRes.base64, mimeType: dRes.mimeType };
        }

        const ai = getGeminiClient(env);
        const toneGuidance =
          body.targetTone === "clean_aesthetic"
            ? "Minimalist, calm, aesthetic lifestyle creator tone."
            : body.targetTone === "problem_solution"
              ? "Problem-agitation-solution relatable TikTok Shop tone."
              : "High-converting TikTok Shop viral urgency & clarity tone.";

        const langInstruction = getLanguageInstruction(body.language);
        const copyPrompt = `Generate fresh commercial advertising copy for:
Product: ${cleanName}
Category: ${clampText(body.category, 80) || "Consumer Goods"}
Campaign Use Case: ${body.campaignType || "affiliate"}
${body.targetAudience?.trim() ? `Target Audience: ${clampText(body.targetAudience, 300)}` : ""}
${body.campaignObjectives?.trim() ? `Campaign Objectives: ${clampText(body.campaignObjectives, 400)}` : ""}
Known Benefits / Features: ${(Array.isArray(body.keyBenefits) ? body.keyBenefits : []).slice(0, 8).join(", ")}
${body.pricePromo?.trim() ? `Verified Price: ${clampText(body.pricePromo, 300)}` : ""}
${body.verifiedDiscounts?.trim() ? `Verified Discount / Offer: ${clampText(body.verifiedDiscounts, 300)}` : ""}
${body.productDetails?.trim() ? `Seller Details: ${clampText(body.productDetails, 1000)}` : ""}
${body.customPrompt?.trim() ? `Specific Revision Direction: ${clampText(body.customPrompt, 400)}` : ""}
${validDetailsImg ? "Attached Image: Use factual pricing, promos, sizes, and specs shown in this attached image." : ""}
Tone: ${toneGuidance}
Language: ${langInstruction}

STRICT TRUTHFULNESS: Never invent prices, discounts, percentages off, testimonials, ratings, or unverified technical specs not explicitly given above.
Include: competitiveAngle, 3 hooks, 3 headlines, productDescription, caption, 6–8 hashtags, 3 ctaSuggestions, videoScript, googleFlowPrompt (Tagalog funny hook if tagalog), and backgroundPrompt.`;

        const copyContents = validDetailsImg
          ? {
              parts: [
                {
                  inlineData: {
                    mimeType: validDetailsImg.mimeType,
                    data: validDetailsImg.base64,
                  },
                },
                { text: copyPrompt },
              ],
            }
          : copyPrompt;

        const { response, modelUsed } = await generateWithConfigurableModel(
          ai,
          cfg,
          copyContents,
          {
            systemInstruction:
              "You are an elite TikTok advertising copywriter. Never invent prices, discounts, testimonials, or unverified specs. Output valid JSON matching the schema.",
            responseMimeType: "application/json",
            responseSchema: STRATEGIST_SCHEMA,
          }
        );

        const parsed = JSON.parse((response.text ?? "").trim());
        updateCapabilityState(
          "analysis",
          modelUsed,
          "available",
          `${modelUsed} operational.`
        );
        await recordUsageEdge(
          env,
          "copy",
          modelUsed,
          "success",
          Date.now() - start,
          cleanName
        );
        return jsonResponse(parsed);
      } catch (err) {
        const msg = formatGeminiError(err, cfg.analysisModel);
        await recordUsageEdge(
          env,
          "copy",
          cfg.analysisModel,
          "error",
          Date.now() - start,
          msg
        );
        return jsonResponse({ error: msg }, 500);
      }
    }

    // Niche Background Prompt
    if (path === "/api/background-prompt" && method === "POST") {
      const start = Date.now();
      const cfg = await getModelConfigEdge(env);
      try {
        const body = await readJsonBody<{
          productName?: string;
          productDescription?: string;
        }>(request);
        const productName = clampText(body.productName, 160);
        const productDescription = clampText(body.productDescription, 800);
        if (!productName) {
          return jsonResponse({ error: "productName is required." }, 400);
        }

        const ai = getGeminiClient(env);
        const { response, modelUsed } = await generateWithConfigurableModel(
          ai,
          cfg,
          `Product Title: ${productName}\nProduct Description: ${productDescription || "Consumer e-commerce product"}`,
          {
            systemInstruction:
              "You are an expert TikTok Shop commercial set designer. Given a product title and description, generate a single image-generation prompt for a realistic, trendy background that matches the product's niche. Rules: (1) Never include the product itself in the background prompt—only the environment. (2) Always leave clean space in the center for a foreground video cutout. (3) Always include 'shallow depth of field, blurred bokeh background, photorealistic, 8k' so the foreground cutout blends naturally. (4) Match lighting temperature to the product vibe (warm/sunlit for beauty/home, cool/moody for tech/auto). Output ONLY the raw prompt text.",
          }
        );

        await recordUsageEdge(
          env,
          "copy",
          modelUsed,
          "success",
          Date.now() - start,
          "background-prompt"
        );
        return jsonResponse({ prompt: (response.text ?? "").trim() });
      } catch (err) {
        const msg = formatGeminiError(err, cfg.analysisModel);
        await recordUsageEdge(
          env,
          "copy",
          cfg.analysisModel,
          "error",
          Date.now() - start,
          msg
        );
        return jsonResponse({ error: msg }, 500);
      }
    }

    // Google Flow Tagalog Creator Prompt Options
    if (path === "/api/google-flow/prompts" && method === "POST") {
      const start = Date.now();
      const cfg = await getModelConfigEdge(env);
      try {
        const body = await readJsonBody<{
          productName?: string;
          category?: string;
          appearance?: string;
          keyBenefits?: string[];
          pricePromo?: string;
          verifiedDiscounts?: string;
          productDetails?: string;
          presenter?: string;
          hookAngle?: string;
          scene?: string;
        }>(request);

        const cleanName = clampText(body.productName, 160);
        if (!cleanName) {
          return jsonResponse(
            { error: "Product name or description is required." },
            400
          );
        }

        const presenterDesc =
          body.presenter === "pinoy_reviewer"
            ? "relatable Filipino male creator in his mid-20s wearing clean casual streetwear"
            : body.presenter === "mom_home"
              ? "warm, trustworthy Filipino mom/home creator in neat everyday homewear"
              : body.presenter === "luxury_host"
                ? "polished, confident Filipina commercial host in refined minimalist styling"
                : "expressive Filipina Gen-Z / Millennial TikTok creator in trendy casual outfit";

        const hookDesc =
          body.hookAngle === "budol_discovery"
            ? "Excited 'Grabe, totoo nga!' budol discovery hook that sparks instant FOMO and curiosity"
            : body.hookAngle === "problem_solution"
              ? "Relatable 'Bago ka bumili...' pain-point-to-relief hook solving a real daily frustration"
              : body.hookAngle === "sulit_proof"
                ? "Skeptic-turned-believer 'Sulit ba talaga?' proof hook showing why buyers don't regret checking out"
                : "Pattern-interrupt 'Huwag mag-scroll!' curiosity hook that makes buyers stop immediately in 0-3s";

        const sceneDesc =
          body.scene === "living_room"
            ? "cozy modern Manila apartment living room with soft afternoon window light"
            : body.scene === "studio_desk"
              ? "clean minimalist creator desk setup with soft key light and subtle rim light"
              : body.scene === "outdoor_sunlit"
                ? "sunlit lifestyle balcony/cafe background with natural shallow depth-of-field bokeh"
                : "bright modern bedroom vanity with warm natural daylight";

        const facts = [
          `Product: ${cleanName}`,
          body.category ? `Category: ${clampText(body.category, 80)}` : "",
          body.appearance
            ? `Visual Appearance: ${clampText(body.appearance, 240)}`
            : "",
          Array.isArray(body.keyBenefits) && body.keyBenefits.length > 0
            ? `Verified Benefits: ${body.keyBenefits.slice(0, 5).map((b) => clampText(b, 120)).join("; ")}`
            : "",
          body.pricePromo?.trim()
            ? `Verified Price: ${clampText(body.pricePromo, 200)}`
            : "",
          body.verifiedDiscounts?.trim()
            ? `Verified Promo/Discount: ${clampText(body.verifiedDiscounts, 200)}`
            : "",
          body.productDetails?.trim()
            ? `Seller Specs/Details: ${clampText(body.productDetails, 500)}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        const ai = getGeminiClient(env);
        const { response, modelUsed } = await generateWithConfigurableModel(
          ai,
          cfg,
          `${facts}

Creator Persona: ${presenterDesc}
Hook Style: ${hookDesc}
Scene Setting: ${sceneDesc}

Create 3 DISTINCT Google Flow (labs.google/fx/tools/flow) 9:16 vertical UGC video prompts.
CRITICAL RULES FOR EVERY OPTION:
1. A Filipino/Tagalog person MUST appear on camera actively holding, wearing, or demonstrating the exact product (${cleanName}) with natural hand gestures and eye contact.
2. Each prompt MUST include a punchy, natural spoken Tagalog opening hook line in quotes ("...") delivered in the first 0–3 seconds designed to hook potential Filipino buyers immediately, PLUS a follow-up spoken Tagalog benefit/CTA line in quotes ("...") pointing toward the TikTok yellow basket.
3. Describe realistic smartphone/UGC camera framing (9:16 vertical, handheld micro-movement, close-up product cut-in, warm lighting, natural facial expressions, no awkward robotic acting).
4. Vary the 3 options so the user gets genuinely different creative angles (e.g., Option 1: Relatable Problem-Interrupt Hook, Option 2: Close-Up Demo & Honest Reaction, Option 3: Best-Value / Checkout Urgency Hook).
5. TRUTHFULNESS RULE: NEVER invent prices, discounts, percentages off, free shipping, or unverified specs not explicitly provided above.`,
          {
            systemInstruction:
              "You are an expert Filipino TikTok Shop UGC director and Google Flow prompt engineer. Output valid JSON matching the schema.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      label: { type: Type.STRING },
                      tagalogHookQuote: { type: Type.STRING },
                      creatorAction: { type: Type.STRING },
                      fullPrompt: { type: Type.STRING },
                    },
                    required: [
                      "id",
                      "label",
                      "tagalogHookQuote",
                      "creatorAction",
                      "fullPrompt",
                    ],
                  },
                },
              },
              required: ["options"],
            },
          }
        );

        const parsed = JSON.parse((response.text ?? "{}").trim()) as {
          options?: Array<{
            id: string;
            label: string;
            tagalogHookQuote: string;
            creatorAction: string;
            fullPrompt: string;
          }>;
        };

        const options = Array.isArray(parsed.options)
          ? parsed.options.slice(0, 3)
          : [];
        if (options.length === 0) {
          return jsonResponse(
            { error: "No Google Flow prompt options returned." },
            502
          );
        }

        await recordUsageEdge(
          env,
          "copy",
          modelUsed,
          "success",
          Date.now() - start,
          `flow-prompts:${cleanName}`
        );
        return jsonResponse({ options });
      } catch (err) {
        const msg = formatGeminiError(err, cfg.analysisModel);
        await recordUsageEdge(
          env,
          "copy",
          cfg.analysisModel,
          "error",
          Date.now() - start,
          msg
        );
        return jsonResponse({ error: msg }, 500);
      }
    }

    // Voiceover Script
    if (path === "/api/voiceover/script" && method === "POST") {
      const start = Date.now();
      const cfg = await getModelConfigEdge(env);
      try {
        const body = await readJsonBody<{
          productName?: string;
          category?: string;
          keyBenefits?: string[];
          pricePromo?: string;
          verifiedDiscounts?: string;
          productDetails?: string;
          languageMode?: string;
          deliveryStyle?: string;
          pace?: string;
          existingScript?: string;
        }>(request);

        const cleanName = clampText(body.productName, 160) || "Produkto";
        const langMode =
          body.languageMode === "english" || body.languageMode === "taglish"
            ? body.languageMode
            : "full_tagalog";
        const styleKey =
          body.deliveryStyle === "kwento" ||
          body.deliveryStyle === "sosyal" ||
          body.deliveryStyle === "promo_rush" ||
          body.deliveryStyle === "kalma_asmr"
            ? body.deliveryStyle
            : "budol_energy";
        const paceKey =
          body.pace === "mabilis" || body.pace === "mabagal"
            ? body.pace
            : "natural";

        const langDirective =
          langMode === "full_tagalog"
            ? "Write 100% in pure, natural, everyday conversational Tagalog (Filipino). Avoid unnecessary English buzzwords or Taglish filler—translate benefits, hooks, and CTAs into natural Tagalog (keep only the official product/brand name if it is a proper noun)."
            : langMode === "taglish"
              ? "Write in natural, punchy Filipino TikTok PH creator Taglish."
              : "Write in crisp, high-converting commercial English.";

        const styleDirective =
          styleKey === "kwento"
            ? "Warm, friend-to-friend kwento storytelling vibe."
            : styleKey === "sosyal"
              ? "Polished, confident, premium commercial narration."
              : styleKey === "promo_rush"
                ? "Urgent yellow-basket checkout call-to-action energy."
                : styleKey === "kalma_asmr"
                  ? "Calm, soft, honest close-up review voiceover."
                  : "Upbeat, masigla TikTok Shop budol creator energy.";

        const paceDirective =
          paceKey === "mabilis"
            ? "Target 22-28 brisk spoken words for fast-paced pacing."
            : paceKey === "mabagal"
              ? "Target 15-20 clear, unhurried spoken words with natural pauses."
              : "Target 18-25 natural spoken words (~10-14 seconds spoken).";

        const facts = [
          `Product: ${cleanName}`,
          body.category ? `Category: ${clampText(body.category, 80)}` : "",
          Array.isArray(body.keyBenefits) && body.keyBenefits.length > 0
            ? `Verified Benefits: ${body.keyBenefits.slice(0, 6).map((b) => clampText(b, 120)).join("; ")}`
            : "",
          body.pricePromo?.trim()
            ? `Verified Price: ${clampText(body.pricePromo, 200)}`
            : "",
          body.verifiedDiscounts?.trim()
            ? `Verified Promo/Discount: ${clampText(body.verifiedDiscounts, 200)}`
            : "",
          body.productDetails?.trim()
            ? `Product Details: ${clampText(body.productDetails, 600)}`
            : "",
          body.existingScript?.trim()
            ? `Existing Draft (rewrite/adapt cleanly): ${clampText(body.existingScript, 400)}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        const ai = getGeminiClient(env);
        const { response, modelUsed } = await generateWithConfigurableModel(
          ai,
          cfg,
          `${facts}

Instructions:
- ${langDirective}
- Style: ${styleDirective}
- Pace: ${paceDirective}
- Output ONLY the spoken voiceover script text (no quotation marks, no stage directions, no timestamps, no emojis).
- TRUTHFULNESS RULE: Never invent prices, discounts, percentages off, free shipping claims, testimonials, or unverified specs not explicitly listed above.`,
          {
            systemInstruction:
              "You are a Filipino TikTok Shop commercial voiceover scriptwriter. Output ONLY the clean spoken voiceover text ready for text-to-speech.",
          }
        );

        const voiceoverText = (response.text ?? "")
          .trim()
          .replace(/^["“]|["”]$/g, "");
        if (!voiceoverText) {
          return jsonResponse(
            { error: "Empty voiceover script returned." },
            502
          );
        }

        await recordUsageEdge(
          env,
          "copy",
          modelUsed,
          "success",
          Date.now() - start,
          `vo-script:${langMode}`
        );
        return jsonResponse({ voiceoverText });
      } catch (err) {
        const msg = formatGeminiError(err, cfg.analysisModel);
        await recordUsageEdge(
          env,
          "copy",
          cfg.analysisModel,
          "error",
          Date.now() - start,
          msg
        );
        return jsonResponse({ error: msg }, 500);
      }
    }

    // AI Voiceover (TTS)
    if (path === "/api/voiceover" && method === "POST") {
      const start = Date.now();
      const cfg = await getModelConfigEdge(env);
      try {
        const body = await readJsonBody<{
          text?: string;
          voiceName?: string;
          languageMode?: string;
          language?: string;
          deliveryStyle?: string;
          pace?: string;
        }>(request);

        const text = clampText(body.text, 1200);
        if (!text) {
          return jsonResponse({ error: "Voiceover text is required." }, 400);
        }

        const languageMode =
          body.languageMode === "english" || body.languageMode === "taglish"
            ? body.languageMode
            : body.language === "english"
              ? "english"
              : "full_tagalog";

        const aiBeta = getGeminiBetaClient(env);
        const allowedVoices = ["Kore", "Puck", "Charon", "Fenrir", "Zephyr"];
        const chosenVoice =
          body.voiceName && allowedVoices.includes(body.voiceName)
            ? body.voiceName
            : "Kore";

        const langCue =
          languageMode === "english"
            ? "Natural commercial English"
            : languageMode === "taglish"
              ? "Natural Filipino Taglish TikTok PH creator pronunciation and cadence"
              : "Native Filipino Tagalog pronunciation, warm Manila conversational cadence";
        const styleCue =
          body.deliveryStyle === "kwento"
            ? "friendly conversational kwento storytelling"
            : body.deliveryStyle === "sosyal"
              ? "polished, confident luxury brand narration"
              : body.deliveryStyle === "promo_rush"
                ? "urgent, punchy TikTok Shop yellow-basket promo delivery"
                : body.deliveryStyle === "kalma_asmr"
                  ? "soft, calm, soothing close-up product review"
                  : "upbeat, energetic, enthusiastic TikTok budol creator";
        const paceCue =
          body.pace === "mabilis"
            ? "brisk fast-paced delivery"
            : body.pace === "mabagal"
              ? "clear, relaxed, slightly slower pace"
              : "natural conversational pace";
        const fullStyleCue = `${langCue}; ${styleCue}; ${paceCue}.`;
        const langCode = languageMode === "english" ? "en-US" : "fil-PH";

        let base64Audio: string | undefined;
        let mimeType = "audio/wav";
        let primaryErr: unknown = null;
        let usedTtsModel = cfg.ttsModel;

        for (const ttsModel of [cfg.ttsModel, cfg.ttsFallbackModel]) {
          usedTtsModel = ttsModel;
          try {
            const interaction = await (
              aiBeta.interactions as unknown as {
                create: (params: Record<string, unknown>) => Promise<{
                  output_audio?: { data?: string; mime_type?: string };
                }>;
              }
            ).create({
              model: ttsModel,
              input: [
                {
                  type: "text",
                  text,
                  annotations: [
                    { type: "speech_metadata", style: fullStyleCue },
                  ],
                },
              ],
              response_format: { type: "audio" },
              generation_config: {
                speech_config: [{ language: langCode, voice: chosenVoice }],
              },
            });
            if (interaction.output_audio?.data) {
              base64Audio = interaction.output_audio.data;
              mimeType = interaction.output_audio.mime_type || "audio/wav";
              break;
            }
          } catch (interErr) {
            primaryErr = interErr;
          }

          try {
            const response = await aiBeta.models.generateContent({
              model: ttsModel,
              contents: text,
              config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: chosenVoice },
                  },
                },
              },
            });
            const audioPart = response.candidates?.[0]?.content?.parts?.find(
              (p) => p.inlineData?.data
            );
            if (audioPart?.inlineData?.data) {
              base64Audio = audioPart.inlineData.data;
              mimeType = audioPart.inlineData.mimeType || "audio/wav";
              break;
            }
          } catch (err) {
            primaryErr = err;
          }
        }

        if (!base64Audio) {
          if (primaryErr) throw primaryErr;
          await recordUsageEdge(
            env,
            "tts",
            usedTtsModel,
            "error",
            Date.now() - start,
            "No audio"
          );
          return jsonResponse(
            { error: "No audio returned by TTS model." },
            502
          );
        }

        updateCapabilityState(
          "tts",
          usedTtsModel,
          "available",
          `${usedTtsModel} voice synthesis ready.`
        );
        await recordUsageEdge(
          env,
          "tts",
          usedTtsModel,
          "success",
          Date.now() - start,
          `${chosenVoice}:${languageMode}`
        );
        return jsonResponse({ audioBase64: base64Audio, mimeType });
      } catch (err) {
        const rawMessage =
          err instanceof Error ? err.message : "Voiceover generation failed.";
        const isQuota =
          rawMessage.includes("429") ||
          rawMessage.includes("RESOURCE_EXHAUSTED") ||
          rawMessage.includes("quota");
        const message = isQuota
          ? "Daily free-tier AI voiceover quota reached on this API key."
          : rawMessage;
        updateCapabilityState(
          "tts",
          cfg.ttsModel,
          isQuota ? "quota_limited" : "unavailable",
          message
        );
        await recordUsageEdge(
          env,
          "tts",
          cfg.ttsModel,
          "error",
          Date.now() - start,
          message
        );
        return jsonResponse({ error: message }, isQuota ? 429 : 500);
      }
    }

    // Image Studio Service
    if (path === "/api/image-studio/generate" && method === "POST") {
      const cfg = await getModelConfigEdge(env);
      try {
        const body = await readJsonBody<{
          productName?: string;
          category?: string;
          colors?: string[];
          material?: string;
          visualStyle?: string;
          aspectRatio?: string;
          mode?: string;
          imageBase64?: string;
          mimeType?: string;
          conceptIndex?: number;
        }>(request);

        const style: VisualStyle = VISUAL_STYLES.includes(
          body.visualStyle as VisualStyle
        )
          ? (body.visualStyle as VisualStyle)
          : "Luxury";
        const ratio: AspectRatioOption = ASPECT_RATIOS.includes(
          body.aspectRatio as AspectRatioOption
        )
          ? (body.aspectRatio as AspectRatioOption)
          : "9:16";
        const genMode: ImageGenerationMode = GENERATION_MODES.includes(
          body.mode as ImageGenerationMode
        )
          ? (body.mode as ImageGenerationMode)
          : "exact_product";

        let validRefImg: { base64: string; mimeType: string } | undefined;
        if (body.imageBase64 && body.mimeType) {
          const checked = validateImageInput(
            body.imageBase64,
            body.mimeType,
            "reference image"
          );
          if (checked.ok === false) {
            return jsonResponse({ error: checked.error }, 400);
          }
          validRefImg = { base64: checked.base64, mimeType: checked.mimeType };
        } else if (genMode === "ai_creative") {
          return jsonResponse(
            { error: "Reference product image is required for AI Creative Mode." },
            400
          );
        }

        const conceptIndices =
          typeof body.conceptIndex === "number" &&
          body.conceptIndex >= 0 &&
          body.conceptIndex <= 2
            ? [body.conceptIndex]
            : [0, 1, 2];

        const ai = getGeminiClient(env);
        const model = cfg.imageGenModel;
        const directions = STYLE_DIRECTIONS[style] || STYLE_DIRECTIONS.Luxury;
        const fallbackBackdrops =
          FALLBACK_BACKDROPS_BY_STYLE[style] || FALLBACK_BACKDROPS_BY_STYLE.Luxury;
        const cleanProductName =
          clampText(body.productName, 140) || "Commercial Product";
        const cleanCategory =
          clampText(body.category, 80) || "Retail Product";
        const cleanColors = Array.isArray(body.colors)
          ? body.colors
              .slice(0, 5)
              .map((c) => clampText(c, 50))
              .filter(Boolean)
          : [];
        const cleanMaterial = clampText(body.material, 120);

        let sharedApiWarning: string | undefined;

        const concepts = await Promise.all(
          conceptIndices.map(async (idx) => {
            const start = Date.now();
            const safeIdx = Math.max(0, Math.min(2, idx));
            const direction = directions[safeIdx] || directions[0];
            const title = CONCEPT_TITLES[safeIdx] || `Concept ${safeIdx + 1}`;
            const colorContext =
              cleanColors.length > 0
                ? `Complementing palette: ${cleanColors.slice(0, 3).join(", ")}.`
                : "";

            const promptText =
              genMode === "exact_product"
                ? `Empty commercial product photography studio background ONLY for ${cleanProductName} (${cleanCategory}, ${cleanMaterial || "commercial item"}). Scene: ${direction}. ${colorContext} CRITICAL RULES: (1) Leave a clean, unobstructed center stage / flat pedestal surface for compositing a foreground product cutout later. (2) DO NOT draw or render any product, bottle, eyewear, clothing, or object in the center—background environment ONLY. (3) Match visual style: ${style}. (4) Shallow depth of field, photorealistic commercial advertising photography, 8k bokeh background, no text, no watermarks.`
                : `High-converting commercial advertising photograph featuring the exact product from the reference image cleanly placed as the hero centerpiece. Product: ${cleanProductName} (${cleanCategory}). Visual style: ${style}. Set design: ${direction}. ${colorContext} Preserve the product silhouette, proportions, surface finish, and branding as closely as possible without distorting labels. Photorealistic commercial studio lighting, shallow depth of field, clean framing, no overlaid marketing text or watermarks.`;

            try {
              const contents =
                genMode === "ai_creative" && validRefImg
                  ? [
                      {
                        inlineData: {
                          mimeType: validRefImg.mimeType,
                          data: validRefImg.base64,
                        },
                      },
                      { text: promptText },
                    ]
                  : promptText;

              const response = await ai.models.generateContent({
                model,
                contents,
                config: {
                  imageConfig: { aspectRatio: ratio },
                  abortSignal: AbortSignal.timeout(65000),
                },
              });

              const inline = extractInlineImage(response);
              if (!inline) {
                throw new Error("Nano Banana returned no image data.");
              }

              await recordUsageEdge(
                env,
                "image_gen",
                model,
                "success",
                Date.now() - start,
                `${genMode} · ${style} · ${ratio}`
              );

              return {
                conceptIndex: safeIdx,
                title,
                direction,
                promptUsed: promptText,
                mode: genMode,
                aspectRatio: ratio,
                engine: "nano_banana" as const,
                imageBase64: inline.data,
                mimeType: inline.mimeType,
              };
            } catch (err) {
              const cleanMsg = formatGeminiError(err, model);
              await recordUsageEdge(
                env,
                "image_gen",
                model,
                "error",
                Date.now() - start,
                cleanMsg
              );
              if (!sharedApiWarning) sharedApiWarning = cleanMsg;
              return {
                conceptIndex: safeIdx,
                title,
                direction,
                promptUsed: promptText,
                mode: genMode,
                aspectRatio: ratio,
                engine: "studio_procedural" as const,
                fallbackBackdrop: fallbackBackdrops[safeIdx] || "travertine",
                apiNotice:
                  genMode === "exact_product"
                    ? `${cleanMsg} Exact Product Mode preserved your product over a procedural ${style} studio background.`
                    : cleanMsg,
              };
            }
          })
        );

        if (sharedApiWarning) {
          updateCapabilityState(
            "image",
            cfg.imageGenModel,
            sharedApiWarning.toLowerCase().includes("quota")
              ? "quota_limited"
              : "unavailable",
            sharedApiWarning
          );
        } else if (concepts.some((c) => c.engine === "nano_banana")) {
          updateCapabilityState(
            "image",
            cfg.imageGenModel,
            "available",
            `${cfg.imageGenModel} active.`
          );
        }

        return jsonResponse({
          concepts,
          modelUsed: model,
          apiWarning: sharedApiWarning,
        });
      } catch (err) {
        return jsonResponse(
          {
            error:
              err instanceof Error
                ? err.message
                : "Image Studio generation failed.",
          },
          500
        );
      }
    }

    // Video Studio: Motion Prompt
    if (path === "/api/video-studio/motion-prompt" && method === "POST") {
      const start = Date.now();
      const cfg = await getModelConfigEdge(env);
      try {
        const body = await readJsonBody<{
          productName?: string;
          category?: string;
          visualStyle?: string;
          customNotes?: string;
          motionPreset?: string;
        }>(request);

        const productName = clampText(body.productName, 140);
        if (!productName) {
          return jsonResponse({ error: "productName is required." }, 400);
        }

        const motionPreset = normalizeMotionPreset(body.motionPreset);
        const presetGuide =
          MOTION_PRESET_GUIDANCE[motionPreset] ||
          MOTION_PRESET_GUIDANCE["Cinematic Product Reveal"];

        const ai = getGeminiClient(env);
        const { response, modelUsed } = await generateWithConfigurableModel(
          ai,
          cfg,
          `Product: ${productName} (${clampText(body.category, 80) || "Commercial Item"})
Visual Style: ${clampText(body.visualStyle, 40) || "Editorial Studio"}
Selected Motion Preset: ${motionPreset}
Preset Guidance: ${presetGuide}
${body.customNotes?.trim() ? `Extra Creative Notes: ${clampText(body.customNotes, 500)}` : ""}

Write a single concise, production-ready 45–65 word image-to-video commercial motion prompt anchored strictly to the input image. Describe ONLY camera movement, subject motion, lighting transitions, and atmosphere so the original product identity remains consistent. No overlaid text, no captions, no fake claims.`,
          {
            systemInstruction:
              "You are a commercial director of photography writing image-to-video motion prompts for 9:16 social ads. Output ONLY raw prompt text.",
          }
        );

        const motionPrompt = (response.text ?? "").trim();
        if (!motionPrompt) {
          throw new Error("Empty motion prompt returned.");
        }
        await recordUsageEdge(
          env,
          "copy",
          modelUsed,
          "success",
          Date.now() - start,
          motionPreset
        );
        return jsonResponse({ motionPrompt, modelUsed });
      } catch (err) {
        const msg = formatGeminiError(err, cfg.analysisModel);
        await recordUsageEdge(
          env,
          "copy",
          cfg.analysisModel,
          "error",
          Date.now() - start,
          msg
        );
        return jsonResponse({ error: msg }, 500);
      }
    }

    // Video Studio: Generate
    if (path === "/api/video-studio/generate" && method === "POST") {
      const cfg = await getModelConfigEdge(env);
      const start = Date.now();
      try {
        const body = await readJsonBody<{
          imageBase64?: string;
          mimeType?: string;
          motionPrompt?: string;
          aspectRatio?: string;
          durationSec?: number;
          resolution?: "720p" | "1080p";
        }>(request);

        const checked = validateImageInput(
          body.imageBase64,
          body.mimeType,
          "approved product image"
        );
        if (checked.ok === false) {
          return jsonResponse({ error: checked.error }, 400);
        }

        const cleanPrompt = clampText(body.motionPrompt, 1200);
        if (!cleanPrompt) {
          return jsonResponse({ error: "motionPrompt is required." }, 400);
        }

        const ratio: AspectRatioOption = ASPECT_RATIOS.includes(
          body.aspectRatio as AspectRatioOption
        )
          ? (body.aspectRatio as AspectRatioOption)
          : "9:16";
        const clampedDuration = Math.min(
          15,
          Math.max(3, Math.round(typeof body.durationSec === "number" ? body.durationSec : 15))
        );
        const resolution = body.resolution === "720p" ? "720p" : "1080p";

        const aiBeta = getGeminiBetaClient(env);
        const access = await verifyVideoModelAccessEdge(aiBeta, cfg);
        updateCapabilityState("video", access.model, access.status, access.note);
        if (!access.available) {
          return jsonResponse(
            { error: access.note, availability: access },
            access.status === "quota_limited" ? 402 : 403
          );
        }

        const interaction = await aiBeta.interactions.create({
          model: cfg.videoGenModel,
          input: [
            {
              type: "image",
              data: checked.base64,
              mime_type: checked.mimeType,
            },
            {
              type: "text",
              text: `${cleanPrompt}\nKeep the exact product design, colors, proportions, and surface branding faithful to the input frame. Smooth 30fps commercial cinematography.`,
            },
          ],
          response_format: {
            type: "video",
            aspect_ratio: ratio,
            duration: `${clampedDuration}s`,
            resolution,
          },
          store: true,
          background: true,
        });

        const now = new Date().toISOString();
        const jobId = encodeEdgeVideoJobId({
          interactionId: interaction.id,
          model: cfg.videoGenModel,
          aspectRatio: ratio,
          durationSec: clampedDuration,
          resolution,
          createdAt: now,
        });

        if (interaction.status === "completed") {
          const base64Vid = extractVideoFromInteraction(interaction as never);
          if (!base64Vid) {
            return jsonResponse(
              {
                id: jobId,
                type: "video",
                status: "failed",
                model: cfg.videoGenModel,
                error: "Video interaction completed without MP4 output.",
                createdAt: now,
                updatedAt: now,
              },
              502
            );
          }
          await recordUsageEdge(
            env,
            "video_gen",
            cfg.videoGenModel,
            "success",
            Date.now() - start,
            `${ratio} · ${clampedDuration}s · ${resolution}`
          );
          return jsonResponse(
            {
              id: jobId,
              type: "video",
              status: "completed",
              model: cfg.videoGenModel,
              interactionId: interaction.id,
              aspectRatio: ratio,
              durationSec: clampedDuration,
              resolution,
              videoUrl: `data:video/mp4;base64,${base64Vid}`,
              createdAt: now,
              updatedAt: now,
            },
            202
          );
        }

        updateCapabilityState(
          "video",
          cfg.videoGenModel,
          "available",
          `${cfg.videoGenModel} job queued via v1beta Interactions API.`
        );
        return jsonResponse(
          {
            id: jobId,
            type: "video",
            status: "processing",
            model: cfg.videoGenModel,
            interactionId: interaction.id,
            aspectRatio: ratio,
            durationSec: clampedDuration,
            resolution,
            createdAt: now,
            updatedAt: now,
          },
          202
        );
      } catch (err) {
        const msg = formatGeminiError(err, cfg.videoGenModel);
        await recordUsageEdge(
          env,
          "video_gen",
          cfg.videoGenModel,
          "error",
          Date.now() - start,
          msg
        );
        updateCapabilityState(
          "video",
          cfg.videoGenModel,
          msg.toLowerCase().includes("quota") || msg.includes("429")
            ? "quota_limited"
            : "unavailable",
          msg
        );
        const isPaidOrQuota =
          msg.includes("403") ||
          msg.includes("429") ||
          msg.toLowerCase().includes("quota") ||
          msg.toLowerCase().includes("permission") ||
          msg.toLowerCase().includes("billing") ||
          msg.toLowerCase().includes("paid");
        return jsonResponse({ error: msg }, isPaidOrQuota ? 402 : 500);
      }
    }

    // Video Studio: Poll Status
    if (
      path.startsWith("/api/video-studio/status/") &&
      method === "GET"
    ) {
      const rawId = decodeURIComponent(
        path.slice("/api/video-studio/status/".length)
      );
      const token = decodeEdgeVideoJobId(rawId);
      if (!token) {
        return jsonResponse({ error: "Video generation job not found." }, 404);
      }
      try {
        const aiBeta = getGeminiBetaClient(env);
        const interaction = await aiBeta.interactions.get(token.interactionId);
        const now = new Date().toISOString();

        if (interaction.status === "completed") {
          const base64Vid = extractVideoFromInteraction(interaction as never);
          if (!base64Vid) {
            return jsonResponse({
              id: rawId,
              type: "video",
              status: "failed",
              model: token.model,
              interactionId: token.interactionId,
              error: "Video interaction completed without MP4 output.",
              createdAt: token.createdAt,
              updatedAt: now,
            });
          }
          await recordUsageEdge(
            env,
            "video_gen",
            token.model,
            "success",
            0,
            `${token.aspectRatio} · ${token.durationSec}s · ${token.resolution}`
          );
          return jsonResponse({
            id: rawId,
            type: "video",
            status: "completed",
            model: token.model,
            interactionId: token.interactionId,
            aspectRatio: token.aspectRatio,
            durationSec: token.durationSec,
            resolution: token.resolution,
            videoUrl: `data:video/mp4;base64,${base64Vid}`,
            createdAt: token.createdAt,
            updatedAt: now,
          });
        }

        if (
          interaction.status === "failed" ||
          interaction.status === "cancelled"
        ) {
          const errDetail =
            (interaction as { error?: { message?: string } }).error?.message ||
            `Video generation ${interaction.status}.`;
          const cleanErr = formatGeminiError(errDetail, token.model);
          await recordUsageEdge(env, "video_gen", token.model, "error", 0, cleanErr);
          return jsonResponse({
            id: rawId,
            type: "video",
            status: "failed",
            model: token.model,
            interactionId: token.interactionId,
            error: cleanErr,
            createdAt: token.createdAt,
            updatedAt: now,
          });
        }

        return jsonResponse({
          id: rawId,
          type: "video",
          status: "processing",
          model: token.model,
          interactionId: token.interactionId,
          aspectRatio: token.aspectRatio,
          durationSec: token.durationSec,
          resolution: token.resolution,
          createdAt: token.createdAt,
          updatedAt: now,
        });
      } catch (err) {
        return jsonResponse(
          {
            error:
              err instanceof Error
                ? err.message
                : "Failed to check video status.",
          },
          500
        );
      }
    }

    // Video Studio: Extend
    if (path === "/api/video-studio/extend" && method === "POST") {
      const cfg = await getModelConfigEdge(env);
      const start = Date.now();
      try {
        const body = await readJsonBody<{
          previousInteractionId?: string;
          continuationPrompt?: string;
          aspectRatio?: string;
          extraSeconds?: number;
        }>(request);

        const previousInteractionId = clampText(body.previousInteractionId, 160);
        if (!previousInteractionId) {
          return jsonResponse(
            { error: "previousInteractionId is required to extend video." },
            400
          );
        }

        const ratio: AspectRatioOption = ASPECT_RATIOS.includes(
          body.aspectRatio as AspectRatioOption
        )
          ? (body.aspectRatio as AspectRatioOption)
          : "9:16";
        const extra = Math.min(
          15,
          Math.max(
            5,
            Math.round(typeof body.extraSeconds === "number" ? body.extraSeconds : 10)
          )
        );
        const continuationPrompt =
          clampText(body.continuationPrompt, 800) ||
          "Continue the smooth commercial product shot seamlessly, gently transitioning lighting into a clean final showcase hold with steady framing.";

        const aiBeta = getGeminiBetaClient(env);
        const interaction = await aiBeta.interactions.create({
          model: cfg.videoGenModel,
          previous_interaction_id: previousInteractionId,
          input: continuationPrompt,
          response_format: {
            type: "video",
            aspect_ratio: ratio,
            duration: `${extra}s`,
            resolution: "1080p",
          },
          store: true,
          background: true,
        });

        const now = new Date().toISOString();
        const jobId = encodeEdgeVideoJobId({
          interactionId: interaction.id,
          model: cfg.videoGenModel,
          aspectRatio: ratio,
          durationSec: 15 + extra,
          resolution: "1080p",
          createdAt: now,
        });

        if (interaction.status === "completed") {
          const base64Vid = extractVideoFromInteraction(interaction as never);
          if (base64Vid) {
            return jsonResponse(
              {
                id: jobId,
                type: "video",
                status: "completed",
                model: cfg.videoGenModel,
                interactionId: interaction.id,
                aspectRatio: ratio,
                durationSec: 15 + extra,
                resolution: "1080p",
                videoUrl: `data:video/mp4;base64,${base64Vid}`,
                createdAt: now,
                updatedAt: now,
              },
              202
            );
          }
        }

        return jsonResponse(
          {
            id: jobId,
            type: "video",
            status: "processing",
            model: cfg.videoGenModel,
            interactionId: interaction.id,
            aspectRatio: ratio,
            durationSec: 15 + extra,
            resolution: "1080p",
            createdAt: now,
            updatedAt: now,
          },
          202
        );
      } catch (err) {
        const msg = formatGeminiError(err, cfg.videoGenModel);
        await recordUsageEdge(
          env,
          "video_gen",
          cfg.videoGenModel,
          "error",
          Date.now() - start,
          msg
        );
        return jsonResponse({ error: msg }, 500);
      }
    }

    // Projects CRUD (KV-backed if STUDIO_KV is bound, otherwise signals storage: "ephemeral" for browser localStorage fallback)
    if (path === "/api/projects" && method === "GET") {
      if (!env.STUDIO_KV) {
        return jsonResponse({ projects: [], storage: "ephemeral" });
      }
      const indexIds =
        ((await env.STUDIO_KV.get("ps:projects:index", "json")) as string[] | null) ||
        [];
      const summaries = [];
      for (const id of indexIds) {
        const proj = (await env.STUDIO_KV.get(
          `ps:project:${id}`,
          "json"
        )) as StoredProject | null;
        if (!proj) continue;
        const thumb =
          proj.assets.find((a) => a.kind === "concept") ||
          proj.assets.find((a) => a.kind === "source") ||
          proj.assets.find((a) => a.kind === "cutout");
        summaries.push({
          id: proj.id,
          name: proj.name,
          campaignType: proj.campaignType,
          clientOrBrandName: proj.clientOrBrandName,
          visualStyle: proj.visualStyle,
          aspectRatio: proj.aspectRatio,
          createdAt: proj.createdAt,
          updatedAt: proj.updatedAt,
          thumbnailUrl: thumb?.url,
          assetCount: proj.assets.filter(
            (a) => a.kind === "concept" || a.kind === "cutout"
          ).length,
          videoCount: proj.assets.filter((a) => a.kind === "video").length,
        });
      }
      summaries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      return jsonResponse({ projects: summaries, storage: "kv" });
    }

    if (path === "/api/projects" && method === "POST") {
      const body = await readJsonBody<{
        id?: string;
        name?: string;
        campaignType?: string;
        clientOrBrandName?: string;
        language?: string;
        targetTone?: string;
        visualStyle?: string;
        aspectRatio?: string;
        generationMode?: string;
        motionPreset?: string;
        motionPrompt?: string;
        notes?: string;
        analysis?: unknown;
        assetsToSave?: SaveProjectAssetInput[];
      }>(request);

      const safeExisting = body.id ? sanitizeId(body.id) : null;
      const id =
        safeExisting || `proj_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const now = new Date().toISOString();
      const campaignType: CampaignType = CAMPAIGN_TYPES.includes(
        body.campaignType as CampaignType
      )
        ? (body.campaignType as CampaignType)
        : "affiliate";

      if (!env.STUDIO_KV) {
        // Ephemeral edge mode: return normalized project structure & let browser persist cleanly in localStorage
        const assets: SavedAssetRef[] = (
          Array.isArray(body.assetsToSave) ? body.assetsToSave : []
        ).map((asset) => {
          const ext = extensionForMime(asset.mimeType || "image/png");
          const safeName =
            sanitizeFilename(`${asset.id}.${ext}`) || `asset.${ext}`;
          return {
            id: asset.id,
            label: asset.label,
            kind: asset.kind,
            filename: safeName,
            mimeType: asset.mimeType,
            url: asset.dataUrlOrBase64 || "",
            style: asset.style,
            mode: asset.mode,
            direction: asset.direction,
            aspectRatio: asset.aspectRatio,
            engine: asset.engine,
          };
        });
        const project: StoredProject & { storage: string } = {
          id,
          name: clampText(body.name, 120) || "Untitled Campaign",
          campaignType,
          clientOrBrandName: clampText(body.clientOrBrandName, 120),
          language: body.language === "english" ? "english" : "tagalog",
          targetTone: clampText(body.targetTone, 40) || "viral_urgency",
          visualStyle: clampText(body.visualStyle, 40) || "Luxury",
          aspectRatio: clampText(body.aspectRatio, 16) || "9:16",
          generationMode:
            body.generationMode === "ai_creative"
              ? "ai_creative"
              : "exact_product",
          motionPreset: normalizeMotionPreset(body.motionPreset),
          motionPrompt: clampText(body.motionPrompt, 1200),
          notes: clampText(body.notes, 2000),
          analysis: body.analysis ?? null,
          assets,
          createdAt: now,
          updatedAt: now,
          storage: "ephemeral",
        };
        return jsonResponse(project, 201);
      }

      const existing = (await env.STUDIO_KV.get(
        `ps:project:${id}`,
        "json"
      )) as StoredProject | null;
      const savedAssets: SavedAssetRef[] = [];
      for (const asset of Array.isArray(body.assetsToSave)
        ? body.assetsToSave
        : []) {
        if (!asset.dataUrlOrBase64) continue;
        const ext = extensionForMime(asset.mimeType || "image/png");
        const safeName =
          sanitizeFilename(`${asset.id}.${ext}`) || `asset_${Date.now()}.${ext}`;
        await env.STUDIO_KV.put(
          `ps:asset:${id}:${safeName}`,
          JSON.stringify({
            mimeType: asset.mimeType,
            data: asset.dataUrlOrBase64,
          })
        );
        savedAssets.push({
          id: asset.id,
          label: asset.label,
          kind: asset.kind,
          filename: safeName,
          mimeType: asset.mimeType,
          url: `/api/projects/${id}/assets/${safeName}`,
          style: asset.style,
          mode: asset.mode,
          direction: asset.direction,
          aspectRatio: asset.aspectRatio,
          engine: asset.engine,
        });
      }

      const project: StoredProject = {
        id,
        name: clampText(body.name, 120) || "Untitled Campaign",
        campaignType,
        clientOrBrandName: clampText(body.clientOrBrandName, 120),
        language: body.language === "english" ? "english" : "tagalog",
        targetTone: clampText(body.targetTone, 40) || "viral_urgency",
        visualStyle: clampText(body.visualStyle, 40) || "Luxury",
        aspectRatio: clampText(body.aspectRatio, 16) || "9:16",
        generationMode:
          body.generationMode === "ai_creative"
            ? "ai_creative"
            : "exact_product",
        motionPreset: normalizeMotionPreset(body.motionPreset),
        motionPrompt: clampText(body.motionPrompt, 1200),
        notes: clampText(body.notes, 2000),
        analysis: body.analysis ?? null,
        assets: savedAssets,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      await env.STUDIO_KV.put(`ps:project:${id}`, JSON.stringify(project));
      const indexIds =
        ((await env.STUDIO_KV.get("ps:projects:index", "json")) as string[] | null) ||
        [];
      if (!indexIds.includes(id)) {
        indexIds.unshift(id);
        await env.STUDIO_KV.put("ps:projects:index", JSON.stringify(indexIds));
      }
      return jsonResponse({ ...project, storage: "kv" }, 201);
    }

    // Single project asset: /api/projects/:id/assets/:filename
    const assetMatch = path.match(/^\/api\/projects\/([^/]+)\/assets\/([^/]+)$/);
    if (assetMatch && method === "GET") {
      if (!env.STUDIO_KV) {
        return jsonResponse({ error: "Asset not found." }, 404);
      }
      const safeId = sanitizeId(assetMatch[1]);
      const safeFile = sanitizeFilename(assetMatch[2]);
      if (!safeId || !safeFile) {
        return jsonResponse({ error: "Asset not found." }, 404);
      }
      const assetObj = (await env.STUDIO_KV.get(
        `ps:asset:${safeId}:${safeFile}`,
        "json"
      )) as { mimeType?: string; data?: string } | null;
      if (!assetObj?.data) {
        return jsonResponse({ error: "Asset not found." }, 404);
      }
      const bytes = base64ToUint8Array(assetObj.data);
      const headers: Record<string, string> = {
        "Content-Type": assetObj.mimeType || "application/octet-stream",
      };
      if (url.searchParams.get("download") === "1") {
        headers["Content-Disposition"] = `attachment; filename="${safeFile}"`;
      }
      return new Response(bytes.buffer as ArrayBuffer, { status: 200, headers });
    }

    // Single project GET / PATCH / DELETE
    const projMatch = path.match(/^\/api\/projects\/([^/]+)$/);
    if (projMatch) {
      const safeId = sanitizeId(projMatch[1]);
      if (!safeId || !env.STUDIO_KV) {
        return jsonResponse({ error: "Project not found." }, 404);
      }

      if (method === "GET") {
        const proj = await env.STUDIO_KV.get(`ps:project:${safeId}`, "json");
        if (!proj) return jsonResponse({ error: "Project not found." }, 404);
        return jsonResponse(proj);
      }

      if (method === "PATCH") {
        const proj = (await env.STUDIO_KV.get(
          `ps:project:${safeId}`,
          "json"
        )) as StoredProject | null;
        if (!proj) return jsonResponse({ error: "Project not found." }, 404);
        const patch = await readJsonBody<Partial<StoredProject>>(request);
        const updated: StoredProject = {
          ...proj,
          ...(typeof patch.name === "string" && patch.name.trim()
            ? { name: clampText(patch.name, 120) }
            : {}),
          ...(typeof patch.notes === "string"
            ? { notes: clampText(patch.notes, 2000) }
            : {}),
          ...(typeof patch.clientOrBrandName === "string"
            ? { clientOrBrandName: clampText(patch.clientOrBrandName, 120) }
            : {}),
          updatedAt: new Date().toISOString(),
        };
        await env.STUDIO_KV.put(
          `ps:project:${safeId}`,
          JSON.stringify(updated)
        );
        return jsonResponse(updated);
      }

      if (method === "DELETE") {
        const proj = (await env.STUDIO_KV.get(
          `ps:project:${safeId}`,
          "json"
        )) as StoredProject | null;
        if (!proj) return jsonResponse({ error: "Project not found." }, 404);
        for (const a of proj.assets || []) {
          await env.STUDIO_KV.delete(`ps:asset:${safeId}:${a.filename}`);
        }
        await env.STUDIO_KV.delete(`ps:project:${safeId}`);
        const indexIds =
          ((await env.STUDIO_KV.get(
            "ps:projects:index",
            "json"
          )) as string[] | null) || [];
        await env.STUDIO_KV.put(
          "ps:projects:index",
          JSON.stringify(indexIds.filter((x) => x !== safeId))
        );
        return jsonResponse({ deleted: true });
      }
    }

    return jsonResponse({ error: `API route not found: ${path}` }, 404);
  } catch (err) {
    return jsonResponse(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unexpected Cloudflare Pages Function error.",
      },
      500
    );
  }
}
