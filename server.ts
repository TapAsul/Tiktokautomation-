import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { getModelConfig, updateModelConfig } from "./server/modelConfig.js";
import {
  ASPECT_RATIOS,
  CAMPAIGN_TYPES,
  clampText,
  formatGeminiError,
  GENERATION_MODES,
  normalizeMotionPreset,
  sanitizeId,
  validateImageInput,
  VISUAL_STYLES,
  type AspectRatioOption,
  type CampaignType,
  type ImageGenerationMode,
  type MotionPreset,
  type VisualStyle,
} from "./server/validation.js";
import {
  deleteProject,
  getJob,
  getJobVideoPath,
  getProject,
  getProjectAssetPath,
  getUsageStats,
  listProjects,
  recordUsage,
  renameOrPatchProject,
  saveProject,
  type SaveProjectAssetInput,
} from "./server/studioStore.js";
import { generateAdConcepts } from "./server/imageService.js";
import {
  extendVideoJob,
  generateMotionPrompt,
  pollVideoJobStatus,
  startVideoGenerationJob,
  verifyVideoModelAccess,
} from "./server/videoService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getGeminiBetaClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

type ModelCapabilityStatus = "available" | "quota_limited" | "unavailable" | "untested";

interface ServiceCapabilityEntry {
  service: "analysis" | "image" | "video" | "tts";
  label: string;
  model: string;
  status: ModelCapabilityStatus;
  note: string;
  checkedAt: string | null;
}

const capabilityCache: Record<"analysis" | "image" | "video" | "tts", ServiceCapabilityEntry> = {
  analysis: {
    service: "analysis",
    label: "Product Analysis & Ad Copywriting",
    model: getModelConfig().analysisModel,
    status: "untested",
    note: "Ready to verify on server.",
    checkedAt: null,
  },
  image: {
    service: "image",
    label: "Generative Image Studio (Nano Banana)",
    model: getModelConfig().imageGenModel,
    status: "untested",
    note: "Exact Product Mode works anytime via studio compositing; AI Creative & Nano Banana backdrops depend on environment quota.",
    checkedAt: null,
  },
  video: {
    service: "video",
    label: "AI Video Generation (Gemini Omni)",
    model: getModelConfig().videoGenModel,
    status: "untested",
    note: "Gemini Omni MP4 requires active quota; Exact-Product Layer Video Compositor is always available.",
    checkedAt: null,
  },
  tts: {
    service: "tts",
    label: "AI Voiceover Speech (Gemini TTS)",
    model: getModelConfig().ttsModel,
    status: "untested",
    note: "Synthesizes voiceover tracks with automatic fallback model.",
    checkedAt: null,
  },
};

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

let primaryTimeoutUntil = 0;

async function generateWithConfigurableModel(
  ai: GoogleGenAI,
  contents: Parameters<GoogleGenAI["models"]["generateContent"]>[0]["contents"],
  config: Omit<
    NonNullable<
      Parameters<GoogleGenAI["models"]["generateContent"]>[0]["config"]
    >,
    "abortSignal" | "thinkingConfig"
  >
) {
  const cfg = getModelConfig();
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
      console.warn(
        `Primary model ${cfg.analysisModel} failed/timed out, falling back to ${cfg.analysisFallbackModel}:`,
        err instanceof Error ? err.message : err
      );
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
      primaryErr instanceof Error ? primaryErr.message : String(primaryErr || "skipped");
    const msg2 =
      fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
    throw new Error(`Gemini request failed (${msg1}; fallback: ${msg2})`);
  }
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

async function createApp() {
  const app = express();
  app.use(express.json({ limit: "60mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "Product Studio AI",
      models: getModelConfig(),
    });
  });

  app.get("/api/config/models", (_req: Request, res: Response) => {
    res.json(getModelConfig());
  });

  app.put("/api/config/models", (req: Request, res: Response) => {
    const updated = updateModelConfig(req.body || {});
    primaryTimeoutUntil = 0;
    capabilityCache.analysis.model = updated.analysisModel;
    capabilityCache.image.model = updated.imageGenModel;
    capabilityCache.video.model = updated.videoGenModel;
    capabilityCache.tts.model = updated.ttsModel;
    res.json(updated);
  });

  app.get("/api/models/availability", async (req: Request, res: Response) => {
    const cfg = getModelConfig();
    const keyConfigured = Boolean(process.env.GEMINI_API_KEY);
    const shouldProbe = req.query.probe === "1";

    capabilityCache.analysis.model = cfg.analysisModel;
    capabilityCache.image.model = cfg.imageGenModel;
    capabilityCache.video.model = cfg.videoGenModel;
    capabilityCache.tts.model = cfg.ttsModel;

    if (!keyConfigured) {
      res.json({
        keyConfigured: false,
        config: cfg,
        services: (Object.keys(capabilityCache) as Array<keyof typeof capabilityCache>).map((k) => ({
          ...capabilityCache[k],
          status: "unavailable" as ModelCapabilityStatus,
          note: "Server-side Google AI environment key is not configured.",
        })),
      });
      return;
    }

    if (shouldProbe) {
      const ai = getGeminiClient();
      // 1. Lightweight analysis/text probe (with fallback verification)
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
            config: {
              abortSignal: AbortSignal.timeout(10000),
            },
          });
          primaryTimeoutUntil = Date.now() + 3 * 60 * 1000;
          updateCapabilityState(
            "analysis",
            cfg.analysisFallbackModel,
            "available",
            `${cfg.analysisFallbackModel} active (automatic fallback from ${cfg.analysisModel}).`
          );
        } catch (fallbackProbeErr) {
          const formatted = formatGeminiError(fallbackProbeErr || primaryProbeErr, cfg.analysisModel);
          updateCapabilityState(
            "analysis",
            cfg.analysisModel,
            formatted.toLowerCase().includes("quota") || formatted.includes("429")
              ? "quota_limited"
              : "unavailable",
            formatted
          );
        }
      }

      // 2. Lightweight image generation availability check
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
          imgResp.candidates?.[0]?.content?.parts?.some((p) => p.inlineData?.data)
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
          formatted.toLowerCase().includes("quota") || formatted.toLowerCase().includes("limit: 0")
            ? "quota_limited"
            : "unavailable",
          `${formatted} Exact Product Mode continues compositing untouched pixels locally.`
        );
      }
      // 3. Lightweight v1beta video model access & endpoint check
      const videoProbe = await verifyVideoModelAccess(getGeminiBetaClient());
      updateCapabilityState(
        "video",
        videoProbe.model,
        videoProbe.status,
        videoProbe.note
      );
    }

    res.json({
      keyConfigured,
      config: cfg,
      services: [
        capabilityCache.analysis,
        capabilityCache.image,
        capabilityCache.video,
        capabilityCache.tts,
      ],
    });
  });

  app.get("/api/video-studio/availability", async (_req: Request, res: Response) => {
    if (!process.env.GEMINI_API_KEY) {
      res.json({
        available: false,
        status: "unavailable",
        model: getModelConfig().videoGenModel,
        apiVersion: "v1beta",
        endpoint: "/v1beta/interactions",
        note: "Server-side Google AI environment key is not configured.",
      });
      return;
    }
    const probe = await verifyVideoModelAccess(getGeminiBetaClient());
    updateCapabilityState("video", probe.model, probe.status, probe.note);
    res.json(probe);
  });

  app.get("/api/usage", (_req: Request, res: Response) => {
    res.json(getUsageStats());
  });

  app.get("/api/jobs/:id", async (req: Request, res: Response) => {
    const safeId = sanitizeId(req.params.id);
    if (!safeId) {
      res.status(400).json({ error: "Invalid job id." });
      return;
    }
    const existing = getJob(safeId);
    if (!existing) {
      res.status(404).json({ error: "Generation job not found." });
      return;
    }
    if (
      existing.type === "video" &&
      (existing.status === "queued" || existing.status === "processing")
    ) {
      try {
        const aiBeta = getGeminiBetaClient();
        const polled = await pollVideoJobStatus(aiBeta, safeId);
        res.json(polled);
        return;
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : "Failed to poll job.",
        });
        return;
      }
    }
    res.json(existing);
  });

  // 1. Product Analysis + Full Copywriter Suite
  app.post("/api/analyze-product", async (req: Request, res: Response) => {
    const start = Date.now();
    const cfg = getModelConfig();
    try {
      const {
        imageBase64,
        mimeType,
        targetTone,
        language,
        pricePromo,
        productDetails,
        detailsImageBase64,
        detailsImageMimeType,
        campaignType,
      } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        targetTone?: string;
        language?: string;
        pricePromo?: string;
        productDetails?: string;
        detailsImageBase64?: string;
        detailsImageMimeType?: string;
        campaignType?: string;
      };

      const mainImg = validateImageInput(imageBase64, mimeType, "product image");
      if (mainImg.ok === false) {
        res.status(400).json({ error: mainImg.error });
        return;
      }

      let validDetailsImg: { base64: string; mimeType: string } | null = null;
      if (detailsImageBase64 && detailsImageMimeType) {
        const dRes = validateImageInput(
          detailsImageBase64,
          detailsImageMimeType,
          "details image"
        );
        if (dRes.ok === false) {
          res.status(400).json({ error: dRes.error });
          return;
        }
        validDetailsImg = { base64: dRes.base64, mimeType: dRes.mimeType };
      }

      const ai = getGeminiClient();

      const toneGuidance =
        targetTone === "clean_aesthetic"
          ? "Minimalist, trust-building, aesthetic creator tone (calm confidence, sensory details, zero hype)."
          : targetTone === "problem_solution"
            ? "Pain-point first, relatable everyday problem-to-relief TikTok creator tone."
            : "High-converting TikTok Shop scroll-stopper tone with fast curiosity hooks and clear product positioning.";

      const campaignFraming =
        campaignType === "own_brand"
          ? "Campaign Type: Own Brand Campaign (authoritative brand positioning, quality craftsmanship, repeat buyer trust)."
          : campaignType === "client_agency"
            ? "Campaign Type: Client Advertising Campaign (agency-grade commercial clarity, conversion-focused ad deliverables)."
            : "Campaign Type: Affiliate Product Campaign (relatable personal discovery, honest feature showcase, yellow-basket CTA).";

      const langInstruction = getLanguageInstruction(language);

      const safePricePromo = clampText(pricePromo, 300);
      const safeProductDetails = clampText(productDetails, 1200);

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
   - googleFlowPrompt: 55–85 word Google Flow (labs.google/fx/tools/flow) prompt with ${language === "english" ? 'a funny relatable 0-3s hook in quotes' : 'a funny, relatable Tagalog/Taglish 0-3s hook in quotes'} + 9:16 UGC framing + ending yellow basket gesture.
   - backgroundPrompt: Expert commercial set designer 9:16 background prompt matching niche. Rules: (1) Never include the product itself. (2) Clean space in center for foreground cutout. (3) Include 'shallow depth of field, blurred bokeh background, photorealistic, 8k'. (4) Match lighting temperature to product vibe. Raw prompt text only.`,
      });

      const { response, modelUsed } = await generateWithConfigurableModel(
        ai,
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
              colors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
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
              keyBenefits: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
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
        recordUsage("analysis", modelUsed, "error", Date.now() - start, "Empty JSON");
        res.status(502).json({ error: "Empty response from Gemini analysis." });
        return;
      }

      const parsed = JSON.parse(rawText);
      updateCapabilityState("analysis", modelUsed, "available", `${modelUsed} operational.`);
      recordUsage("analysis", modelUsed, "success", Date.now() - start, parsed.productName);
      res.json(parsed);
    } catch (error: unknown) {
      const message = formatGeminiError(error, cfg.analysisModel);
      updateCapabilityState(
        "analysis",
        cfg.analysisModel,
        message.toLowerCase().includes("quota") ? "quota_limited" : "unavailable",
        message
      );
      recordUsage("analysis", cfg.analysisModel, "error", Date.now() - start, message);
      console.error("Analyze product error:", error);
      res.status(500).json({ error: message });
    }
  });

  // 2. Regenerate Advertising Copy (supports Campaign brief fields)
  app.post("/api/regenerate-copy", async (req: Request, res: Response) => {
    const start = Date.now();
    const cfg = getModelConfig();
    try {
      const {
        productName,
        category,
        keyBenefits,
        targetTone,
        customPrompt,
        language,
        productDetails,
        pricePromo,
        detailsImageBase64,
        detailsImageMimeType,
        campaignType,
        targetAudience,
        verifiedDiscounts,
        campaignObjectives,
      } = req.body as {
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
      };

      const cleanName = clampText(productName, 160);
      if (!cleanName) {
        res.status(400).json({ error: "productName is required." });
        return;
      }

      let validDetailsImg: { base64: string; mimeType: string } | null = null;
      if (detailsImageBase64 && detailsImageMimeType) {
        const dRes = validateImageInput(
          detailsImageBase64,
          detailsImageMimeType,
          "details image"
        );
        if (dRes.ok === false) {
          res.status(400).json({ error: dRes.error });
          return;
        }
        validDetailsImg = { base64: dRes.base64, mimeType: dRes.mimeType };
      }

      const ai = getGeminiClient();
      const toneGuidance =
        targetTone === "clean_aesthetic"
          ? "Minimalist, calm, aesthetic lifestyle creator tone."
          : targetTone === "problem_solution"
            ? "Problem-agitation-solution relatable TikTok Shop tone."
            : "High-converting TikTok Shop viral urgency & clarity tone.";

      const langInstruction = getLanguageInstruction(language);

      const copyPrompt = `Generate fresh commercial advertising copy for:
Product: ${cleanName}
Category: ${clampText(category, 80) || "Consumer Goods"}
Campaign Use Case: ${campaignType || "affiliate"}
${targetAudience?.trim() ? `Target Audience: ${clampText(targetAudience, 300)}` : ""}
${campaignObjectives?.trim() ? `Campaign Objectives: ${clampText(campaignObjectives, 400)}` : ""}
Known Benefits / Features: ${(Array.isArray(keyBenefits) ? keyBenefits : []).slice(0, 8).join(", ")}
${pricePromo?.trim() ? `Verified Price: ${clampText(pricePromo, 300)}` : ""}
${verifiedDiscounts?.trim() ? `Verified Discount / Offer: ${clampText(verifiedDiscounts, 300)}` : ""}
${productDetails?.trim() ? `Seller Details: ${clampText(productDetails, 1000)}` : ""}
${customPrompt?.trim() ? `Specific Revision Direction: ${clampText(customPrompt, 400)}` : ""}
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
        copyContents,
        {
          systemInstruction:
            "You are an elite TikTok advertising copywriter. Never invent prices, discounts, testimonials, or unverified specs. Output valid JSON matching the schema.",
          responseMimeType: "application/json",
          responseSchema: STRATEGIST_SCHEMA,
        }
      );

      const rawText = (response.text ?? "").trim();
      const parsed = JSON.parse(rawText);
      updateCapabilityState("analysis", modelUsed, "available", `${modelUsed} operational.`);
      recordUsage("copy", modelUsed, "success", Date.now() - start, cleanName);
      res.json(parsed);
    } catch (error: unknown) {
      const message = formatGeminiError(error, cfg.analysisModel);
      recordUsage("copy", cfg.analysisModel, "error", Date.now() - start, message);
      console.error("Regenerate copy error:", error);
      res.status(500).json({ error: message });
    }
  });

  // 3. Niche Background Prompt
  app.post("/api/background-prompt", async (req: Request, res: Response) => {
    const start = Date.now();
    const cfg = getModelConfig();
    try {
      const productName = clampText(req.body?.productName, 160);
      const productDescription = clampText(req.body?.productDescription, 800);
      if (!productName) {
        res.status(400).json({ error: "productName is required." });
        return;
      }

      const ai = getGeminiClient();
      const { response, modelUsed } = await generateWithConfigurableModel(
        ai,
        `Product Title: ${productName}\nProduct Description: ${productDescription || "Consumer e-commerce product"}`,
        {
          systemInstruction:
            "You are an expert TikTok Shop commercial set designer. Given a product title and description, generate a single image-generation prompt for a realistic, trendy background that matches the product's niche. Rules: (1) Never include the product itself in the background prompt—only the environment. (2) Always leave clean space in the center for a foreground video cutout. (3) Always include 'shallow depth of field, blurred bokeh background, photorealistic, 8k' so the foreground cutout blends naturally. (4) Match lighting temperature to the product vibe (warm/sunlit for beauty/home, cool/moody for tech/auto). Output ONLY the raw prompt text.",
        }
      );

      recordUsage("copy", modelUsed, "success", Date.now() - start, "background-prompt");
      res.json({ prompt: (response.text ?? "").trim() });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Background prompt generation failed.";
      recordUsage("copy", cfg.analysisModel, "error", Date.now() - start, message);
      res.status(500).json({ error: message });
    }
  });

  // 4A. Generate / Rewrite Tagalog / Taglish / English Voiceover Script
  app.post("/api/voiceover/script", async (req: Request, res: Response) => {
    const start = Date.now();
    const cfg = getModelConfig();
    try {
      const {
        productName,
        category,
        keyBenefits,
        pricePromo,
        verifiedDiscounts,
        productDetails,
        languageMode,
        deliveryStyle,
        pace,
        existingScript,
      } = req.body as {
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
      };

      const cleanName = clampText(productName, 160) || "Produkto";
      const langMode =
        languageMode === "english" || languageMode === "taglish"
          ? languageMode
          : "full_tagalog";
      const styleKey =
        deliveryStyle === "kwento" ||
        deliveryStyle === "sosyal" ||
        deliveryStyle === "promo_rush" ||
        deliveryStyle === "kalma_asmr"
          ? deliveryStyle
          : "budol_energy";
      const paceKey =
        pace === "mabilis" || pace === "mabagal" ? pace : "natural";

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
        category ? `Category: ${clampText(category, 80)}` : "",
        Array.isArray(keyBenefits) && keyBenefits.length > 0
          ? `Verified Benefits: ${keyBenefits.slice(0, 6).map((b) => clampText(b, 120)).join("; ")}`
          : "",
        pricePromo?.trim() ? `Verified Price: ${clampText(pricePromo, 200)}` : "",
        verifiedDiscounts?.trim()
          ? `Verified Promo/Discount: ${clampText(verifiedDiscounts, 200)}`
          : "",
        productDetails?.trim()
          ? `Product Details: ${clampText(productDetails, 600)}`
          : "",
        existingScript?.trim()
          ? `Existing Draft (rewrite/adapt cleanly): ${clampText(existingScript, 400)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const ai = getGeminiClient();
      const { response, modelUsed } = await generateWithConfigurableModel(
        ai,
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
        res.status(502).json({ error: "Empty voiceover script returned." });
        return;
      }

      recordUsage("copy", modelUsed, "success", Date.now() - start, `vo-script:${langMode}`);
      res.json({ voiceoverText });
    } catch (error: unknown) {
      const message = formatGeminiError(error, cfg.analysisModel);
      recordUsage("copy", cfg.analysisModel, "error", Date.now() - start, message);
      res.status(500).json({ error: message });
    }
  });

  // 4. AI Voiceover (TTS)
  app.post("/api/voiceover", async (req: Request, res: Response) => {
    const start = Date.now();
    const cfg = getModelConfig();
    try {
      const text = clampText(req.body?.text, 1200);
      const voiceName = req.body?.voiceName as string | undefined;
      const languageMode =
        req.body?.languageMode === "english" || req.body?.languageMode === "taglish"
          ? (req.body.languageMode as "english" | "taglish")
          : req.body?.language === "english"
            ? "english"
            : "full_tagalog";
      const deliveryStyle = req.body?.deliveryStyle as string | undefined;
      const pace = req.body?.pace as string | undefined;

      if (!text) {
        res.status(400).json({ error: "Voiceover text is required." });
        return;
      }

      const aiBeta = getGeminiBetaClient();

      const allowedVoices = ["Kore", "Puck", "Charon", "Fenrir", "Zephyr"];
      const chosenVoice =
        voiceName && allowedVoices.includes(voiceName) ? voiceName : "Kore";

      const langCue =
        languageMode === "english"
          ? "Natural commercial English"
          : languageMode === "taglish"
            ? "Natural Filipino Taglish TikTok PH creator pronunciation and cadence"
            : "Native Filipino Tagalog pronunciation, warm Manila conversational cadence";
      const styleCue =
        deliveryStyle === "kwento"
          ? "friendly conversational kwento storytelling"
          : deliveryStyle === "sosyal"
            ? "polished, confident luxury brand narration"
            : deliveryStyle === "promo_rush"
              ? "urgent, punchy TikTok Shop yellow-basket promo delivery"
              : deliveryStyle === "kalma_asmr"
                ? "soft, calm, soothing close-up product review"
                : "upbeat, energetic, enthusiastic TikTok budol creator";
      const paceCue =
        pace === "mabilis"
          ? "brisk fast-paced delivery"
          : pace === "mabagal"
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
        // Try v1beta Interactions API first (supports speech_config.language + speech_metadata style)
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
                  {
                    type: "speech_metadata",
                    style: fullStyleCue,
                  },
                ],
              },
            ],
            response_format: { type: "audio" },
            generation_config: {
              speech_config: [
                {
                  language: langCode,
                  voice: chosenVoice,
                },
              ],
            },
          });
          if (interaction.output_audio?.data) {
            base64Audio = interaction.output_audio.data;
            mimeType = interaction.output_audio.mime_type || "audio/wav";
            break;
          }
        } catch (interErr) {
          primaryErr = interErr;
          console.warn(
            `TTS interactions.create failed on ${ttsModel}, trying generateContent fallback:`,
            interErr instanceof Error ? interErr.message : interErr
          );
        }

        // Fallback to v1beta models.generateContent AUDIO modality
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
          console.warn(
            `TTS model ${ttsModel} failed, trying fallback if available:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      if (!base64Audio) {
        if (primaryErr) throw primaryErr;
        recordUsage("tts", usedTtsModel, "error", Date.now() - start, "No audio");
        res.status(502).json({ error: "No audio returned by TTS model." });
        return;
      }

      updateCapabilityState(
        "tts",
        usedTtsModel,
        "available",
        `${usedTtsModel} voice synthesis ready.`
      );
      recordUsage(
        "tts",
        usedTtsModel,
        "success",
        Date.now() - start,
        `${chosenVoice}:${languageMode}`
      );
      res.json({
        audioBase64: base64Audio,
        mimeType,
      });
    } catch (error: unknown) {
      const rawMessage =
        error instanceof Error ? error.message : "Voiceover generation failed.";
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
      recordUsage("tts", cfg.ttsModel, "error", Date.now() - start, message);
      console.error("Voiceover error:", error);
      res.status(isQuota ? 429 : 500).json({ error: message });
    }
  });

  // 5. Image Studio Service (Separate from Video Studio)
  app.post("/api/image-studio/generate", async (req: Request, res: Response) => {
    try {
      const {
        productName,
        category,
        colors,
        material,
        visualStyle,
        aspectRatio,
        mode,
        imageBase64,
        mimeType,
        conceptIndex,
      } = req.body as {
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
      };

      const style: VisualStyle = VISUAL_STYLES.includes(visualStyle as VisualStyle)
        ? (visualStyle as VisualStyle)
        : "Luxury";
      const ratio: AspectRatioOption = ASPECT_RATIOS.includes(
        aspectRatio as AspectRatioOption
      )
        ? (aspectRatio as AspectRatioOption)
        : "9:16";
      const genMode: ImageGenerationMode = GENERATION_MODES.includes(
        mode as ImageGenerationMode
      )
        ? (mode as ImageGenerationMode)
        : "exact_product";

      let validRefImg: { base64: string; mimeType: string } | undefined;
      if (imageBase64 && mimeType) {
        const checked = validateImageInput(imageBase64, mimeType, "reference image");
        if (checked.ok === false) {
          res.status(400).json({ error: checked.error });
          return;
        }
        validRefImg = { base64: checked.base64, mimeType: checked.mimeType };
      } else if (genMode === "ai_creative") {
        res.status(400).json({
          error: "Reference product image is required for AI Creative Mode.",
        });
        return;
      }

      const conceptIndices =
        typeof conceptIndex === "number" && conceptIndex >= 0 && conceptIndex <= 2
          ? [conceptIndex]
          : [0, 1, 2];

      const ai = getGeminiClient();
      const result = await generateAdConcepts(ai, {
        productName: clampText(productName, 140) || "Commercial Product",
        category: clampText(category, 80) || "Retail Product",
        colors: Array.isArray(colors)
          ? colors.slice(0, 5).map((c) => clampText(c, 50)).filter(Boolean)
          : [],
        material: clampText(material, 120),
        visualStyle: style,
        aspectRatio: ratio,
        mode: genMode,
        productImageBase64: validRefImg?.base64,
        productImageMimeType: validRefImg?.mimeType,
        conceptIndices,
      });

      if (result.apiWarning) {
        updateCapabilityState(
          "image",
          getModelConfig().imageGenModel,
          result.apiWarning.toLowerCase().includes("quota") ? "quota_limited" : "unavailable",
          result.apiWarning
        );
      } else if (result.concepts?.some((c) => c.engine === "nano_banana")) {
        updateCapabilityState(
          "image",
          getModelConfig().imageGenModel,
          "available",
          `${getModelConfig().imageGenModel} active.`
        );
      }

      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Image Studio generation failed.";
      console.error("Image Studio error:", error);
      res.status(500).json({ error: message });
    }
  });

  // 6. Video Studio Service (Separate from Image Studio)
  app.post(
    "/api/video-studio/motion-prompt",
    async (req: Request, res: Response) => {
      try {
        const productName = clampText(req.body?.productName, 140);
        const category = clampText(req.body?.category, 80);
        const visualStyle = clampText(req.body?.visualStyle, 40);
        const customNotes = clampText(req.body?.customNotes, 500);
        const motionPreset: MotionPreset = normalizeMotionPreset(
          req.body?.motionPreset
        );

        if (!productName) {
          res.status(400).json({ error: "productName is required." });
          return;
        }

        const ai = getGeminiClient();
        const result = await generateMotionPrompt(ai, {
          productName,
          category,
          motionPreset,
          visualStyle,
          customNotes,
        });
        res.json(result);
      } catch (error: unknown) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Motion prompt generation failed.",
        });
      }
    }
  );

  app.post("/api/video-studio/generate", async (req: Request, res: Response) => {
    try {
      const {
        imageBase64,
        mimeType,
        motionPrompt,
        aspectRatio,
        durationSec,
        resolution,
      } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        motionPrompt?: string;
        aspectRatio?: string;
        durationSec?: number;
        resolution?: "720p" | "1080p";
      };

      const checked = validateImageInput(
        imageBase64,
        mimeType,
        "approved product image"
      );
      if (checked.ok === false) {
        res.status(400).json({ error: checked.error });
        return;
      }

      const cleanPrompt = clampText(motionPrompt, 1200);
      if (!cleanPrompt) {
        res.status(400).json({ error: "motionPrompt is required." });
        return;
      }

      const ratio: AspectRatioOption = ASPECT_RATIOS.includes(
        aspectRatio as AspectRatioOption
      )
        ? (aspectRatio as AspectRatioOption)
        : "9:16";

      const aiBeta = getGeminiBetaClient();
      const access = await verifyVideoModelAccess(aiBeta);
      updateCapabilityState("video", access.model, access.status, access.note);
      if (!access.available) {
        res.status(access.status === "quota_limited" ? 402 : 403).json({
          error: access.note,
          availability: access,
        });
        return;
      }

      const job = await startVideoGenerationJob(aiBeta, {
        imageBase64: checked.base64,
        mimeType: checked.mimeType,
        motionPrompt: cleanPrompt,
        aspectRatio: ratio,
        durationSec: typeof durationSec === "number" ? durationSec : 15,
        resolution: resolution === "720p" ? "720p" : "1080p",
      });

      updateCapabilityState(
        "video",
        getModelConfig().videoGenModel,
        "available",
        `${getModelConfig().videoGenModel} job queued via v1beta Interactions API.`
      );
      res.status(202).json(job);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Video generation start failed.";
      updateCapabilityState(
        "video",
        getModelConfig().videoGenModel,
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
      res.status(isPaidOrQuota ? 402 : 500).json({ error: msg });
    }
  });

  app.get("/api/video-studio/status/:jobId", async (req: Request, res: Response) => {
    const safeId = sanitizeId(req.params.jobId);
    if (!safeId) {
      res.status(400).json({ error: "Invalid job ID." });
      return;
    }
    try {
      const aiBeta = getGeminiBetaClient();
      const job = await pollVideoJobStatus(aiBeta, safeId);
      if (!job) {
        res.status(404).json({ error: "Video generation job not found." });
        return;
      }
      res.json(job);
    } catch (error: unknown) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to check video status.",
      });
    }
  });

  app.post("/api/video-studio/extend", async (req: Request, res: Response) => {
    try {
      const previousInteractionId = clampText(
        req.body?.previousInteractionId,
        160
      );
      const continuationPrompt = clampText(req.body?.continuationPrompt, 800);
      const aspectRatio: AspectRatioOption = ASPECT_RATIOS.includes(
        req.body?.aspectRatio as AspectRatioOption
      )
        ? (req.body.aspectRatio as AspectRatioOption)
        : "9:16";
      const extraSeconds =
        typeof req.body?.extraSeconds === "number" ? req.body.extraSeconds : 10;

      if (!previousInteractionId) {
        res
          .status(400)
          .json({ error: "previousInteractionId is required to extend video." });
        return;
      }

      const aiBeta = getGeminiBetaClient();
      const job = await extendVideoJob(aiBeta, {
        previousInteractionId,
        continuationPrompt,
        aspectRatio,
        extraSeconds,
        resolution: "1080p",
      });
      res.status(202).json(job);
    } catch (error: unknown) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Video extension failed.",
      });
    }
  });

  app.get("/api/video-studio/file/:filename", (req: Request, res: Response) => {
    const filePath = getJobVideoPath(req.params.filename);
    if (!filePath) {
      res.status(404).json({ error: "Video file not found." });
      return;
    }
    res.setHeader("Content-Type", "video/mp4");
    res.sendFile(filePath);
  });

  // 7. Project Management CRUD
  app.get("/api/projects", (_req: Request, res: Response) => {
    res.json({ projects: listProjects() });
  });

  app.get("/api/projects/:id", (req: Request, res: Response) => {
    const project = getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json(project);
  });

  app.post("/api/projects", (req: Request, res: Response) => {
    try {
      const body = req.body as {
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
        keepAssetFilenames?: string[];
      };

      const campaignType: CampaignType = CAMPAIGN_TYPES.includes(
        body.campaignType as CampaignType
      )
        ? (body.campaignType as CampaignType)
        : "affiliate";

      const project = saveProject({
        id: body.id,
        name: clampText(body.name, 120) || "Untitled Campaign",
        campaignType,
        clientOrBrandName: clampText(body.clientOrBrandName, 120),
        language: body.language === "english" ? "english" : "tagalog",
        targetTone: clampText(body.targetTone, 40) || "viral_urgency",
        visualStyle: clampText(body.visualStyle, 40) || "Luxury",
        aspectRatio: clampText(body.aspectRatio, 16) || "9:16",
        generationMode:
          body.generationMode === "ai_creative" ? "ai_creative" : "exact_product",
        motionPreset: normalizeMotionPreset(body.motionPreset),
        motionPrompt: clampText(body.motionPrompt, 1200),
        notes: clampText(body.notes, 2000),
        analysis: body.analysis ?? null,
        assetsToSave: Array.isArray(body.assetsToSave) ? body.assetsToSave : [],
        keepAssetFilenames: Array.isArray(body.keepAssetFilenames)
          ? body.keepAssetFilenames
          : undefined,
      });

      res.status(201).json(project);
    } catch (error: unknown) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to save project.",
      });
    }
  });

  app.patch("/api/projects/:id", (req: Request, res: Response) => {
    const updated = renameOrPatchProject(req.params.id, req.body || {});
    if (!updated) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json(updated);
  });

  app.delete("/api/projects/:id", (req: Request, res: Response) => {
    const deleted = deleteProject(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json({ deleted: true });
  });

  app.get(
    "/api/projects/:id/assets/:filename",
    (req: Request, res: Response) => {
      const assetPath = getProjectAssetPath(req.params.id, req.params.filename);
      if (!assetPath) {
        res.status(404).json({ error: "Asset not found." });
        return;
      }
      if (req.query.download === "1") {
        res.download(assetPath, path.basename(assetPath));
        return;
      }
      res.sendFile(assetPath);
    }
  );

  if (isProduction) {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Product Studio AI listening on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
