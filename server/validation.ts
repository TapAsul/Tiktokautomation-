export const ALLOWED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB per uploaded image

export const VISUAL_STYLES = [
  "Luxury",
  "Minimalist",
  "Cinematic",
  "Futuristic",
  "Editorial",
  "Organic",
  "Vibrant",
  "Warm Studio",
] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number];

export const ASPECT_RATIOS = ["9:16", "1:1", "3:4", "16:9"] as const;
export type AspectRatioOption = (typeof ASPECT_RATIOS)[number];

export const GENERATION_MODES = ["exact_product", "ai_creative"] as const;
export type ImageGenerationMode = (typeof GENERATION_MODES)[number];

export const MOTION_PRESETS = [
  "Cinematic Product Reveal",
  "Slow Camera Push",
  "Floating Product Showcase",
  "Rotating Product Display",
  "Luxury Commercial",
  "Minimalist Product Presentation",
  "Dramatic Lighting Reveal",
  "TikTok Product Advertisement",
] as const;
export type MotionPreset = (typeof MOTION_PRESETS)[number];

export const CAMPAIGN_TYPES = [
  "affiliate",
  "own_brand",
  "client_agency",
] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export function normalizeMotionPreset(raw: unknown): MotionPreset {
  if (typeof raw !== "string") return "Cinematic Product Reveal";
  const lower = raw.toLowerCase();
  if (lower.includes("push") || lower.includes("zoom")) return "Slow Camera Push";
  if (lower.includes("floating")) return "Floating Product Showcase";
  if (lower.includes("rotat") || lower.includes("orbit"))
    return "Rotating Product Display";
  if (lower.includes("luxury")) return "Luxury Commercial";
  if (lower.includes("minimalist")) return "Minimalist Product Presentation";
  if (lower.includes("dramatic") || lower.includes("lighting"))
    return "Dramatic Lighting Reveal";
  if (lower.includes("tiktok") || lower.includes("lifestyle"))
    return "TikTok Product Advertisement";
  return "Cinematic Product Reveal";
}

export function formatGeminiError(err: unknown, modelName?: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  let extractedMsg = raw;
  try {
    const startBrace = raw.indexOf("{");
    if (startBrace !== -1) {
      const parsed = JSON.parse(raw.slice(startBrace)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error?.message) {
        extractedMsg = parsed.error.message.split("\n")[0].trim();
      }
    }
  } catch {
    // keep raw
  }

  const lower = raw.toLowerCase();
  const modelLabel = modelName ? ` for ${modelName}` : "";

  if (
    raw.includes("RESOURCE_EXHAUSTED") ||
    raw.includes("429") ||
    lower.includes("limit: 0") ||
    lower.includes("quota")
  ) {
    if (lower.includes("limit: 0") || lower.includes("free_tier")) {
      return `Quota limit is 0 on the active free-tier environment${modelLabel}. This model requires a billed/paid tier in the current Google AI Studio environment.`;
    }
    return `Rate limit / quota reached${modelLabel}: ${extractedMsg}`;
  }

  if (
    raw.includes("PERMISSION_DENIED") ||
    raw.includes("403") ||
    lower.includes("billing")
  ) {
    return `Permission denied${modelLabel}: ${extractedMsg}`;
  }

  if (raw.includes("NOT_FOUND") || raw.includes("404")) {
    return `Model not found or unavailable${modelLabel}: ${extractedMsg}`;
  }

  return extractedMsg.slice(0, 260);
}

export function sanitizeBase64Payload(raw: string): string {
  const commaIdx = raw.indexOf(",");
  if (raw.startsWith("data:") && commaIdx !== -1) {
    return raw.slice(commaIdx + 1).trim();
  }
  return raw.trim();
}

export function validateImageInput(
  imageBase64: unknown,
  mimeType: unknown,
  fieldName = "image"
): { ok: true; base64: string; mimeType: string } | { ok: false; error: string } {
  if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
    return { ok: false, error: `Missing ${fieldName} base64 payload.` };
  }
  if (typeof mimeType !== "string" || !ALLOWED_IMAGE_MIMES.has(mimeType.toLowerCase())) {
    return {
      ok: false,
      error: `Unsupported ${fieldName} MIME type. Allowed: PNG, JPEG, WebP.`,
    };
  }
  const clean = sanitizeBase64Payload(imageBase64);
  if (!/^[A-Za-z0-9+/=\s]+$/.test(clean)) {
    return { ok: false, error: `Invalid base64 encoding for ${fieldName}.` };
  }
  const estimatedBytes = Math.floor((clean.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `${fieldName} exceeds maximum allowed size (${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB).`,
    };
  }
  return {
    ok: true,
    base64: clean,
    mimeType: mimeType.toLowerCase() === "image/jpg" ? "image/jpeg" : mimeType.toLowerCase(),
  };
}

export function sanitizeId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeFilename(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed.includes("..") ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    !/^[a-zA-Z0-9._-]{1,120}$/.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

export function clampText(val: unknown, maxLen: number): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
}
