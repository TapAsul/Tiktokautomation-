import type { GoogleGenAI } from "@google/genai";
import { getModelConfig } from "./modelConfig.js";
import { recordUsage } from "./studioStore.js";
import {
  formatGeminiError,
  type AspectRatioOption,
  type ImageGenerationMode,
  type VisualStyle,
} from "./validation.js";

export interface GeneratedConceptOutput {
  conceptIndex: number;
  title: string;
  direction: string;
  promptUsed: string;
  mode: ImageGenerationMode;
  aspectRatio: AspectRatioOption;
  engine: "nano_banana" | "studio_procedural";
  imageBase64?: string;
  mimeType?: string;
  fallbackBackdrop?:
    | "travertine"
    | "obsidian"
    | "botanical"
    | "street_concrete"
    | "blush"
    | "pearl";
  apiNotice?: string;
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
    | "travertine"
    | "obsidian"
    | "botanical"
    | "street_concrete"
    | "blush"
    | "pearl"
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

export async function generateAdConcepts(
  ai: GoogleGenAI,
  params: {
    productName: string;
    category: string;
    colors: string[];
    material: string;
    visualStyle: VisualStyle;
    aspectRatio: AspectRatioOption;
    mode: ImageGenerationMode;
    productImageBase64?: string;
    productImageMimeType?: string;
    conceptIndices: number[];
  }
): Promise<{
  concepts: GeneratedConceptOutput[];
  modelUsed: string;
  apiWarning?: string;
}> {
  const config = getModelConfig();
  const model = config.imageGenModel;
  const directions = STYLE_DIRECTIONS[params.visualStyle] || STYLE_DIRECTIONS.Luxury;
  const fallbackBackdrops =
    FALLBACK_BACKDROPS_BY_STYLE[params.visualStyle] ||
    FALLBACK_BACKDROPS_BY_STYLE.Luxury;

  let sharedApiWarning: string | undefined;

  const generateOne = async (idx: number): Promise<GeneratedConceptOutput> => {
    const start = Date.now();
    const safeIdx = Math.max(0, Math.min(2, idx));
    const direction = directions[safeIdx] || directions[0];
    const title = CONCEPT_TITLES[safeIdx] || `Concept ${safeIdx + 1}`;
    const colorContext =
      params.colors.length > 0
        ? `Complementing palette: ${params.colors.slice(0, 3).join(", ")}.`
        : "";

    const promptText =
      params.mode === "exact_product"
        ? `Empty commercial product photography studio background ONLY for ${params.productName} (${params.category}, ${params.material || "commercial item"}). Scene: ${direction}. ${colorContext} CRITICAL RULES: (1) Leave a clean, unobstructed center stage / flat pedestal surface for compositing a foreground product cutout later. (2) DO NOT draw or render any product, bottle, eyewear, clothing, or object in the center—background environment ONLY. (3) Match visual style: ${params.visualStyle}. (4) Shallow depth of field, photorealistic commercial advertising photography, 8k bokeh background, no text, no watermarks.`
        : `High-converting commercial advertising photograph featuring the exact product from the reference image cleanly placed as the hero centerpiece. Product: ${params.productName} (${params.category}). Visual style: ${params.visualStyle}. Set design: ${direction}. ${colorContext} Preserve the product silhouette, proportions, surface finish, and branding as closely as possible without distorting labels. Photorealistic commercial studio lighting, shallow depth of field, clean framing, no overlaid marketing text or watermarks.`;

    try {
      const contents =
        params.mode === "ai_creative" &&
        params.productImageBase64 &&
        params.productImageMimeType
          ? [
              {
                inlineData: {
                  mimeType: params.productImageMimeType,
                  data: params.productImageBase64,
                },
              },
              { text: promptText },
            ]
          : promptText;

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          imageConfig: {
            aspectRatio: params.aspectRatio,
          },
          abortSignal: AbortSignal.timeout(65000),
        },
      });

      const inline = extractInlineImage(response);
      if (!inline) {
        throw new Error("Nano Banana returned no image data.");
      }

      recordUsage(
        "image_gen",
        model,
        "success",
        Date.now() - start,
        `${params.mode} · ${params.visualStyle} · ${params.aspectRatio}`
      );

      return {
        conceptIndex: safeIdx,
        title,
        direction,
        promptUsed: promptText,
        mode: params.mode,
        aspectRatio: params.aspectRatio,
        engine: "nano_banana",
        imageBase64: inline.data,
        mimeType: inline.mimeType,
      };
    } catch (err: unknown) {
      const cleanMsg = formatGeminiError(err, model);
      recordUsage("image_gen", model, "error", Date.now() - start, cleanMsg);
      if (!sharedApiWarning) {
        sharedApiWarning = cleanMsg;
      }

      return {
        conceptIndex: safeIdx,
        title,
        direction,
        promptUsed: promptText,
        mode: params.mode,
        aspectRatio: params.aspectRatio,
        engine: "studio_procedural",
        fallbackBackdrop: fallbackBackdrops[safeIdx] || "travertine",
        apiNotice:
          params.mode === "exact_product"
            ? `${cleanMsg} Exact Product Mode preserved your product over a procedural ${params.visualStyle} studio background.`
            : cleanMsg,
      };
    }
  };

  const concepts = await Promise.all(params.conceptIndices.map(generateOne));

  return {
    concepts,
    modelUsed: model,
    apiWarning: sharedApiWarning,
  };
}
