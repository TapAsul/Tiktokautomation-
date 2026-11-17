import { ThinkingLevel, type GoogleGenAI } from "@google/genai";
import { getModelConfig } from "./modelConfig.js";
import {
  createJob,
  getJob,
  recordUsage,
  saveJobVideoBuffer,
  updateJob,
  type GenerationJob,
} from "./studioStore.js";
import {
  formatGeminiError,
  normalizeMotionPreset,
  type AspectRatioOption,
  type MotionPreset,
} from "./validation.js";

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

export async function generateMotionPrompt(
  ai: GoogleGenAI,
  params: {
    productName: string;
    category: string;
    motionPreset: string;
    visualStyle?: string;
    customNotes?: string;
  }
): Promise<{ motionPrompt: string; modelUsed: string }> {
  const config = getModelConfig();
  const start = Date.now();
  const normalizedPreset = normalizeMotionPreset(params.motionPreset);
  const presetGuide =
    MOTION_PRESET_GUIDANCE[normalizedPreset] ||
    MOTION_PRESET_GUIDANCE["Cinematic Product Reveal"];

  const userPrompt = `Product: ${params.productName} (${params.category || "Commercial Item"})
Visual Style: ${params.visualStyle || "Editorial Studio"}
Selected Motion Preset: ${normalizedPreset}
Preset Guidance: ${presetGuide}
${params.customNotes?.trim() ? `Extra Creative Notes: ${params.customNotes.trim()}` : ""}

Write a single concise, production-ready 45–65 word image-to-video commercial motion prompt anchored strictly to the input image. Describe ONLY camera movement, subject motion, lighting transitions, and atmosphere so the original product identity remains consistent. No overlaid text, no captions, no fake claims.`;

  let primaryErr: unknown = null;
  for (const model of [config.analysisModel, config.analysisFallbackModel]) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction:
            "You are a commercial director of photography writing image-to-video motion prompts for 9:16 social ads. Output ONLY raw prompt text.",
          ...(model.includes("hydrogen")
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
          abortSignal: AbortSignal.timeout(model === config.analysisModel ? 10000 : 20000),
        },
      });
      const text = (response.text ?? "").trim();
      if (!text) throw new Error("Empty motion prompt returned.");
      recordUsage("copy", model, "success", Date.now() - start, normalizedPreset);
      return { motionPrompt: text, modelUsed: model };
    } catch (err) {
      primaryErr = err;
    }
  }

  const msg = formatGeminiError(primaryErr, config.analysisModel);
  recordUsage("copy", config.analysisModel, "error", Date.now() - start, msg);
  throw new Error(msg);
}

export async function verifyVideoModelAccess(aiBeta: GoogleGenAI): Promise<{
  available: boolean;
  status: "available" | "quota_limited" | "unavailable";
  model: string;
  apiVersion: string;
  endpoint: string;
  note: string;
}> {
  const config = getModelConfig();
  const model = config.videoGenModel;
  const endpoint = "/v1beta/interactions";

  try {
    // Lightweight v1beta metadata check first (no generation cost)
    await aiBeta.models.get({ model });
    return {
      available: true,
      status: "available",
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
      ? `${model} is not accessible on v1beta in this Google AI Studio project (404). Exact Product Showcase and Google Flow Manual Editor remain fully available.`
      : isQuota
        ? `${formatted} Exact Product Showcase and Google Flow Manual Editor remain fully available.`
        : isPerm
          ? `This Google AI Studio project does not have permission/billing access for ${model} on v1beta. Exact Product Showcase and Google Flow Manual Editor remain fully available.`
          : `${formatted} Exact Product Showcase remains available locally.`;

    return {
      available: false,
      status: isQuota ? "quota_limited" : "unavailable",
      model,
      apiVersion: "v1beta",
      endpoint,
      note,
    };
  }
}

export async function startVideoGenerationJob(
  ai: GoogleGenAI,
  params: {
    imageBase64: string;
    mimeType: string;
    motionPrompt: string;
    aspectRatio: AspectRatioOption;
    durationSec: number;
    resolution?: "720p" | "1080p";
  }
): Promise<GenerationJob> {
  const config = getModelConfig();
  const model = config.videoGenModel;
  const clampedDuration = Math.min(15, Math.max(3, Math.round(params.durationSec)));
  const resolution = params.resolution || "1080p";

  const job = createJob({
    type: "video",
    status: "queued",
    model,
    aspectRatio: params.aspectRatio,
    durationSec: clampedDuration,
    resolution,
  });

  const start = Date.now();
  try {
    const interaction = await ai.interactions.create({
      model,
      input: [
        {
          type: "image",
          data: params.imageBase64,
          mime_type: params.mimeType,
        },
        {
          type: "text",
          text: `${params.motionPrompt}\nKeep the exact product design, colors, proportions, and surface branding faithful to the input frame. Smooth 30fps commercial cinematography.`,
        },
      ],
      response_format: {
        type: "video",
        aspect_ratio: params.aspectRatio,
        duration: `${clampedDuration}s`,
        resolution,
      },
      store: true,
      background: true,
    });

    const immediateStatus =
      interaction.status === "completed" ? "completed" : "processing";

    const updated = updateJob(job.id, {
      status: immediateStatus,
      interactionId: interaction.id,
    });

    if (interaction.status === "completed") {
      return await finalizeCompletedInteraction(ai, updated || job, interaction, start);
    }

    return updated || job;
  } catch (err: unknown) {
    const cleanMsg = formatGeminiError(err, model);
    recordUsage("video_gen", model, "error", Date.now() - start, cleanMsg);
    updateJob(job.id, { status: "failed", error: cleanMsg });
    throw new Error(cleanMsg);
  }
}

async function finalizeCompletedInteraction(
  _ai: GoogleGenAI,
  job: GenerationJob,
  interaction: {
    id: string;
    status?: string;
    error?: { message?: string } | string;
    output_video?: { data?: string; mime_type?: string } | null;
    outputs?: Array<{ type?: string; data?: string; mime_type?: string }>;
    steps?: Array<{
      type?: string;
      content?: Array<{ type?: string; data?: string; mime_type?: string }>;
    }>;
  },
  startMs?: number
): Promise<GenerationJob> {
  let base64Video: string | undefined = interaction.output_video?.data;
  if (!base64Video) {
    base64Video = interaction.outputs?.find(
      (o) => o.type === "video" && typeof o.data === "string"
    )?.data;
  }
  if (!base64Video && Array.isArray(interaction.steps)) {
    for (const step of interaction.steps) {
      if (step.type === "model_output") {
        const vidPart = step.content?.find(
          (c) => c.type === "video" && typeof c.data === "string"
        );
        if (vidPart?.data) {
          base64Video = vidPart.data;
        }
      }
    }
  }
  if (!base64Video) {
    const msg = "Video interaction completed but returned no MP4 output payload.";
    recordUsage("video_gen", job.model, "error", startMs ? Date.now() - startMs : 0, msg);
    return (
      updateJob(job.id, { status: "failed", error: msg }) || {
        ...job,
        status: "failed",
        error: msg,
      }
    );
  }

  const buffer = Buffer.from(base64Video, "base64");
  const filename = saveJobVideoBuffer(job.id, buffer);
  const videoUrl = `/api/video-studio/file/${filename}`;
  recordUsage(
    "video_gen",
    job.model,
    "success",
    startMs ? Date.now() - startMs : 0,
    `${job.aspectRatio} · ${job.durationSec}s · ${job.resolution}`
  );
  return (
    updateJob(job.id, {
      status: "completed",
      videoFile: filename,
      videoUrl,
    }) || {
      ...job,
      status: "completed",
      videoFile: filename,
      videoUrl,
    }
  );
}

export async function pollVideoJobStatus(
  ai: GoogleGenAI,
  jobId: string
): Promise<GenerationJob | null> {
  const job = getJob(jobId);
  if (!job) return null;
  if (job.status === "completed" || job.status === "failed") {
    return job;
  }
  if (!job.interactionId) {
    return job;
  }

  try {
    const interaction = await ai.interactions.get(job.interactionId);
    if (interaction.status === "completed") {
      return await finalizeCompletedInteraction(ai, job, interaction as never);
    }
    if (interaction.status === "failed" || interaction.status === "cancelled") {
      const errDetail =
        (interaction as { error?: { message?: string } }).error?.message ||
        `Video generation ${interaction.status}.`;
      const cleanErr = formatGeminiError(errDetail, job.model);
      recordUsage("video_gen", job.model, "error", 0, cleanErr);
      return updateJob(job.id, {
        status: "failed",
        error: cleanErr,
      });
    }
    return updateJob(job.id, { status: "processing" });
  } catch (err: unknown) {
    const cleanErr = formatGeminiError(err, job.model);
    recordUsage("video_gen", job.model, "error", 0, cleanErr);
    return updateJob(job.id, {
      status: "failed",
      error: cleanErr,
    });
  }
}

export async function extendVideoJob(
  ai: GoogleGenAI,
  params: {
    previousInteractionId: string;
    continuationPrompt: string;
    aspectRatio: AspectRatioOption;
    extraSeconds: number;
    resolution?: "720p" | "1080p";
  }
): Promise<GenerationJob> {
  const config = getModelConfig();
  const model = config.videoGenModel;
  const extra = Math.min(15, Math.max(5, Math.round(params.extraSeconds)));
  const resolution = params.resolution || "1080p";

  const job = createJob({
    type: "video",
    status: "queued",
    model,
    aspectRatio: params.aspectRatio,
    durationSec: 15 + extra,
    resolution,
  });

  const start = Date.now();
  try {
    const interaction = await ai.interactions.create({
      model,
      previous_interaction_id: params.previousInteractionId,
      input:
        params.continuationPrompt ||
        "Continue the smooth commercial product shot seamlessly, gently transitioning lighting into a clean final showcase hold with steady framing.",
      response_format: {
        type: "video",
        aspect_ratio: params.aspectRatio,
        duration: `${extra}s`,
        resolution,
      },
      store: true,
      background: true,
    });

    const updated = updateJob(job.id, {
      status: interaction.status === "completed" ? "completed" : "processing",
      interactionId: interaction.id,
    });

    if (interaction.status === "completed") {
      return await finalizeCompletedInteraction(ai, updated || job, interaction, start);
    }
    return updated || job;
  } catch (err: unknown) {
    const cleanMsg = formatGeminiError(err, model);
    recordUsage("video_gen", model, "error", Date.now() - start, cleanMsg);
    updateJob(job.id, { status: "failed", error: cleanMsg });
    throw new Error(cleanMsg);
  }
}
