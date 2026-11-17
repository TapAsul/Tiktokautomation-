export type StudioSection =
  | "overview"
  | "image_studio"
  | "video_studio"
  | "copywriter"
  | "campaign_studio"
  | "projects"
  | "export_center"
  | "settings";

export type BackdropPreset =
  | "travertine"
  | "obsidian"
  | "botanical"
  | "street_concrete"
  | "blush"
  | "pearl";

export type VideoStylePreset = "minimal" | "energetic" | "editorial";
export type StrategistTone =
  | "viral_urgency"
  | "clean_aesthetic"
  | "problem_solution";
export type ContentLanguage = "tagalog" | "english";
export type VoiceName = "Kore" | "Zephyr" | "Puck" | "Charon" | "Fenrir";
export type VoiceoverLanguageMode = "full_tagalog" | "taglish" | "english";
export type VoiceoverDeliveryStyle =
  | "budol_energy"
  | "kwento"
  | "sosyal"
  | "promo_rush"
  | "kalma_asmr";
export type VoiceoverPace = "natural" | "mabilis" | "mabagal";
export type WearType =
  | "apparel_top"
  | "eyewear"
  | "headwear"
  | "handheld_showcase";
export type PresentationMode = "ugc_creator" | "product_only";

export type VisualStyle =
  | "Luxury"
  | "Minimalist"
  | "Cinematic"
  | "Futuristic"
  | "Editorial"
  | "Organic"
  | "Vibrant"
  | "Warm Studio";

export type AspectRatioOption = "9:16" | "1:1" | "3:4" | "16:9";
export type ImageGenerationMode = "exact_product" | "ai_creative";
export type CampaignType = "affiliate" | "own_brand" | "client_agency";

export type MotionPreset =
  | "Cinematic Product Reveal"
  | "Slow Camera Push"
  | "Floating Product Showcase"
  | "Rotating Product Display"
  | "Luxury Commercial"
  | "Minimalist Product Presentation"
  | "Dramatic Lighting Reveal"
  | "TikTok Product Advertisement";

export interface ProductBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface ViralHook {
  id: string;
  style: string;
  onScreenText: string;
  spokenLine: string;
}

export interface VideoScript {
  beat1Hook: string;
  beat2Benefit: string;
  beat3Offer: string;
  voiceoverText: string;
}

export interface StrategistCopy {
  competitiveAngle: string;
  hooks: ViralHook[];
  headlines?: string[];
  productDescription?: string;
  caption: string;
  hashtags: string[];
  ctaSuggestions?: string[];
  videoScript: VideoScript;
  googleFlowPrompt: string;
  backgroundPrompt: string;
}

export interface ProductAnalysis {
  productName: string;
  category: string;
  appearance?: string;
  colors?: string[];
  shape?: string;
  material?: string;
  branding?: string;
  visibleText?: string;
  distinguishingDetails?: string;
  wearType: WearType;
  shortTagline: string;
  keyBenefits: string[];
  targetAudience: string;
  productBox: ProductBox;
  suggestedBackdrop: BackdropPreset;
  accentHex: string;
  strategist: StrategistCopy;
}

export interface CutoutResult {
  cutoutDataUrl: string;
  studioImageDataUrl: string;
  ugcTryOnDataUrl?: string;
  ugcPointingDataUrl?: string;
  cutoutWidth: number;
  cutoutHeight: number;
}

export interface ImageConceptAsset {
  id: string;
  conceptIndex: number;
  title: string;
  direction: string;
  promptUsed: string;
  mode: ImageGenerationMode;
  visualStyle: VisualStyle;
  aspectRatio: AspectRatioOption;
  engine: "nano_banana" | "studio_procedural";
  backgroundDataUrl?: string;
  finalImageDataUrl: string;
  approvedForVideo?: boolean;
  approvedForCampaign?: boolean;
  apiNotice?: string;
  createdAt?: string;
}

export interface ImageHistoryEntry {
  id: string;
  createdAt: string;
  productName: string;
  visualStyle: VisualStyle;
  aspectRatio: AspectRatioOption;
  mode: ImageGenerationMode;
  concepts: ImageConceptAsset[];
}

export interface GeneratedVideoResult {
  videoUrl: string;
  blob?: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
  durationSec: number;
  resolution?: string;
  engine?: "gemini_omni" | "local_compositor" | "google_flow_upload";
  jobId?: string;
  interactionId?: string;
  jobVideoFilename?: string;
  label?: string;
}

export interface VideoAvailabilityStatus {
  available: boolean;
  status: ModelCapabilityStatus;
  model: string;
  apiVersion: string;
  endpoint: string;
  note: string;
}

export interface UsageStatsSnapshot {
  analysisCalls: number;
  copyCalls: number;
  imageGenCalls: number;
  videoGenCalls: number;
  ttsCalls: number;
  errors: number;
  lastUpdated: string;
  recentLogs: Array<{
    id: string;
    operation: string;
    model: string;
    status: "success" | "error";
    durationMs: number;
    note?: string;
    timestamp: string;
  }>;
}

export interface ModelConfigSnapshot {
  analysisModel: string;
  analysisFallbackModel: string;
  imageGenModel: string;
  videoGenModel: string;
  ttsModel: string;
  ttsFallbackModel: string;
  updatedAt: string;
}

export type ModelCapabilityStatus =
  | "available"
  | "quota_limited"
  | "unavailable"
  | "untested";

export interface ServiceCapabilityEntry {
  service: "analysis" | "image" | "video" | "tts";
  label: string;
  model: string;
  status: ModelCapabilityStatus;
  note: string;
  checkedAt: string | null;
}

export interface ModelAvailabilitySnapshot {
  keyConfigured: boolean;
  config: ModelConfigSnapshot;
  services: ServiceCapabilityEntry[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  campaignType: CampaignType;
  clientOrBrandName: string;
  visualStyle: string;
  aspectRatio: string;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
  assetCount: number;
  videoCount: number;
}

export interface StoredProjectFull {
  id: string;
  name: string;
  campaignType: CampaignType;
  clientOrBrandName: string;
  language: ContentLanguage;
  targetTone: StrategistTone;
  visualStyle: VisualStyle;
  aspectRatio: AspectRatioOption;
  generationMode: ImageGenerationMode;
  motionPreset: MotionPreset;
  motionPrompt: string;
  notes: string;
  analysis: ProductAnalysis | null;
  assets: Array<{
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
  }>;
  createdAt: string;
  updatedAt: string;
}

export type PipelineStep =
  | "idle"
  | "analyzing"
  | "removing_bg"
  | "generating_images"
  | "voiceover"
  | "rendering_video"
  | "complete"
  | "error";
