import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { StudioShell } from "./components/StudioShell";
import { DashboardView } from "./components/DashboardView";
import {
  ImageStudioView,
  type SampleProduct,
} from "./components/ImageStudioView";
import { VideoStudioView } from "./components/VideoStudioView";
import { CopywriterView, type CopyRegenScope } from "./components/CopywriterView";
import { CampaignStudioView } from "./components/CampaignStudioView";
import { ProjectsView } from "./components/ProjectsView";
import { ExportCenterView } from "./components/ExportCenterView";
import { SettingsView } from "./components/SettingsView";
import { MaskRefineModal } from "./components/MaskRefineModal";
import type {
  AspectRatioOption,
  BackdropPreset,
  CampaignType,
  ContentLanguage,
  CutoutResult,
  GeneratedVideoResult,
  ImageConceptAsset,
  ImageGenerationMode,
  ImageHistoryEntry,
  ModelAvailabilitySnapshot,
  ModelConfigSnapshot,
  MotionPreset,
  PipelineStep,
  ProductAnalysis,
  ProjectSummary,
  StoredProjectFull,
  StrategistTone,
  StudioSection,
  UsageStatsSnapshot,
  VideoAvailabilityStatus,
  VideoStylePreset,
  ViralHook,
  VisualStyle,
  VoiceName,
  VoiceoverDeliveryStyle,
  VoiceoverLanguageMode,
  VoiceoverPace,
} from "./types/studio";
import { removeBackgroundAndCompose } from "./utils/backgroundRemover";
import { compositeExactProductOverBackground } from "./utils/imageCompositor";
import {
  renderShowcaseVideo,
  unlockAudioContext,
} from "./utils/videoGenerator";

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return fileToDataUrl(blob);
}

function splitDataUrl(dataUrl: string): { base64: string; mimeType: string } {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header?.match(/data:([^;]+);/);
  return {
    mimeType: mimeMatch?.[1] || "image/png",
    base64: base64 || "",
  };
}

interface RawServerConcept {
  conceptIndex: number;
  title: string;
  direction: string;
  promptUsed: string;
  mode: ImageGenerationMode;
  aspectRatio: AspectRatioOption;
  engine: "nano_banana" | "studio_procedural";
  imageBase64?: string;
  mimeType?: string;
  fallbackBackdrop?: BackdropPreset;
  apiNotice?: string;
}

export default function App() {
  const [activeSection, setActiveSection] = useState<StudioSection>("overview");

  // Server Config, Availability, Usage & Saved Projects
  const [modelConfig, setModelConfig] = useState<ModelConfigSnapshot | null>(
    null
  );
  const [availability, setAvailability] =
    useState<ModelAvailabilitySnapshot | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [usage, setUsage] = useState<UsageStatsSnapshot | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  // Active Project / Campaign Metadata & Grounded Inputs
  const [projectId, setProjectId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState<string>("");
  const [campaignType, setCampaignType] = useState<CampaignType>("affiliate");
  const [clientOrBrandName, setClientOrBrandName] = useState<string>("");
  const [campaignNotes, setCampaignNotes] = useState<string>("");
  const [verifiedDiscounts, setVerifiedDiscounts] = useState<string>("");
  const [targetAudience, setTargetAudience] = useState<string>("");
  const [campaignObjectives, setCampaignObjectives] = useState<string>("");

  // Image Studio State
  const [sourceDataUrl, setSourceDataUrl] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>("");
  const [detailsImageDataUrl, setDetailsImageDataUrl] = useState<string | null>(
    null
  );
  const [detailsImageLabel, setDetailsImageLabel] = useState<string>("");
  const [pricePromo, setPricePromo] = useState<string>("");
  const [productDetails, setProductDetails] = useState<string>("");
  const [pasteTarget, setPasteTarget] = useState<"product" | "details">(
    "product"
  );

  const [language, setLanguage] = useState<ContentLanguage>("tagalog");
  const [tone, setTone] = useState<StrategistTone>("viral_urgency");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("Luxury");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>("9:16");
  const [generationMode, setGenerationMode] =
    useState<ImageGenerationMode>("exact_product");
  const [sensitivity, setSensitivity] = useState<number>(44);
  const [headlineOverlay, setHeadlineOverlay] = useState<string>("");
  const [promoOverlay, setPromoOverlay] = useState<string>("");

  const [step, setStep] = useState<PipelineStep>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showMaskRefineModal, setShowMaskRefineModal] = useState(false);

  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [cutout, setCutout] = useState<CutoutResult | null>(null);
  const [concepts, setConcepts] = useState<ImageConceptAsset[]>([]);
  const [imageHistory, setImageHistory] = useState<ImageHistoryEntry[]>([]);
  const [regeneratingConceptIdx, setRegeneratingConceptIdx] = useState<
    number | null
  >(null);

  // Video Studio State
  const [approvedVideoImgUrl, setApprovedVideoImgUrl] = useState<string | null>(
    null
  );
  const [approvedVideoImgLabel, setApprovedVideoImgLabel] =
    useState<string>("");
  const [motionPreset, setMotionPreset] = useState<MotionPreset>(
    "Cinematic Product Reveal"
  );
  const [motionPrompt, setMotionPrompt] = useState<string>("");
  const [videoDurationSec, setVideoDurationSec] = useState<number>(15);
  const [showLayerOverlays, setShowLayerOverlays] = useState<boolean>(true);
  const [omniVideo, setOmniVideo] = useState<GeneratedVideoResult | null>(null);
  const [localVideo, setLocalVideo] = useState<GeneratedVideoResult | null>(
    null
  );
  const [flowVideo, setFlowVideo] = useState<GeneratedVideoResult | null>(null);
  const [videoAvailability, setVideoAvailability] =
    useState<VideoAvailabilityStatus | null>(null);
  const [isCheckingVideoAccess, setIsCheckingVideoAccess] = useState(false);
  const [isAnalyzingForVideo, setIsAnalyzingForVideo] = useState(false);
  const [videoJobStatus, setVideoJobStatus] = useState<string | null>(null);
  const [videoJobError, setVideoJobError] = useState<string | null>(null);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isRenderingLocalVideo, setIsRenderingLocalVideo] = useState(false);
  const [localRenderProgress, setLocalRenderProgress] = useState(0);
  const [localRenderError, setLocalRenderError] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  // Copywriter, Backdrop & Voiceover State
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);
  const [backdrop, setBackdrop] = useState<BackdropPreset>("travertine");
  const [videoStyle, setVideoStyle] = useState<VideoStylePreset>("energetic");
  const [voiceName, setVoiceName] = useState<VoiceName>("Kore");
  const [voiceoverLangMode, setVoiceoverLangMode] =
    useState<VoiceoverLanguageMode>("full_tagalog");
  const [voiceoverStyle, setVoiceoverStyle] =
    useState<VoiceoverDeliveryStyle>("budol_energy");
  const [voiceoverPace, setVoiceoverPace] = useState<VoiceoverPace>("natural");
  const [voiceoverScriptDraft, setVoiceoverScriptDraft] = useState<string>("");
  const [voiceoverBase64, setVoiceoverBase64] = useState<string | null>(null);
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const [voiceoverError, setVoiceoverError] = useState<string | null>(null);
  const [isGeneratingVoiceScript, setIsGeneratingVoiceScript] = useState(false);
  const [isRegeneratingCopy, setIsRegeneratingCopy] = useState(false);
  const [isSynthesizingVoiceover, setIsSynthesizingVoiceover] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveStatusMsg, setSaveStatusMsg] = useState<string | null>(null);

  const refreshAvailability = useCallback(async (probe = false) => {
    if (probe) setIsCheckingAvailability(true);
    try {
      const res = await fetch(
        `/api/models/availability${probe ? "?probe=1" : ""}`
      );
      if (res.ok) {
        setAvailability(await res.json());
      }
    } catch {
      // ignore transient check failure
    } finally {
      if (probe) setIsCheckingAvailability(false);
    }
  }, []);

  const refreshMetadata = useCallback(async () => {
    try {
      const [cfgRes, usageRes, projRes, availRes] = await Promise.all([
        fetch("/api/config/models"),
        fetch("/api/usage"),
        fetch("/api/projects"),
        fetch("/api/models/availability"),
      ]);
      if (cfgRes.ok) setModelConfig(await cfgRes.json());
      if (usageRes.ok) setUsage(await usageRes.json());
      if (projRes.ok) {
        const data = await projRes.json();
        setProjects(data.projects || []);
      }
      if (availRes.ok) setAvailability(await availRes.json());
    } catch {
      // ignore transient network fetch on initial mount
    }
  }, []);

  const checkVideoAvailability = useCallback(async () => {
    setIsCheckingVideoAccess(true);
    try {
      const res = await fetch("/api/video-studio/availability");
      if (res.ok) {
        const data = (await res.json()) as VideoAvailabilityStatus;
        setVideoAvailability(data);
      }
    } catch {
      // ignore transient network check
    } finally {
      setIsCheckingVideoAccess(false);
    }
  }, []);

  useEffect(() => {
    void refreshMetadata();
    void checkVideoAvailability();
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, [refreshMetadata, checkVideoAvailability]);

  useEffect(() => {
    return () => {
      if (localVideo?.videoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(localVideo.videoUrl);
      }
    };
  }, [localVideo?.videoUrl]);

  useEffect(() => {
    return () => {
      if (flowVideo?.videoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(flowVideo.videoUrl);
      }
    };
  }, [flowVideo?.videoUrl]);

  useEffect(() => {
    return () => {
      if (voiceoverUrl) URL.revokeObjectURL(voiceoverUrl);
    };
  }, [voiceoverUrl]);

  const handleUpdateModelConfig = async (
    patch: Partial<Omit<ModelConfigSnapshot, "updatedAt">>
  ) => {
    const res = await fetch("/api/config/models", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setModelConfig(await res.json());
    }
  };

  // Build final display images from raw server outputs (preserving exact pixels in Exact Product Mode!)
  const finalizeConcepts = useCallback(
    async (
      rawConcepts: RawServerConcept[],
      activeCutout: CutoutResult | null,
      activeAnalysis: ProductAnalysis | null,
      activeStyle: VisualStyle,
      activeRatio: AspectRatioOption
    ): Promise<ImageConceptAsset[]> => {
      const built: ImageConceptAsset[] = [];
      for (const raw of rawConcepts) {
        const bgDataUrl =
          raw.imageBase64 && raw.mimeType
            ? `data:${raw.mimeType};base64,${raw.imageBase64}`
            : undefined;

        let finalImageDataUrl: string;
        if (raw.mode === "ai_creative" && bgDataUrl) {
          finalImageDataUrl = bgDataUrl;
        } else if (activeCutout?.cutoutDataUrl) {
          finalImageDataUrl = await compositeExactProductOverBackground({
            cutoutDataUrl: activeCutout.cutoutDataUrl,
            backgroundDataUrl: bgDataUrl,
            fallbackBackdrop:
              raw.fallbackBackdrop ||
              activeAnalysis?.suggestedBackdrop ||
              "travertine",
            aspectRatio: activeRatio,
            accentHex: activeAnalysis?.accentHex,
            visualStyle: activeStyle,
            headlineOverlay,
            promoBadgeOverlay: promoOverlay,
          });
        } else {
          finalImageDataUrl = bgDataUrl || sourceDataUrl || "";
        }

        built.push({
          id: `concept_${raw.conceptIndex}_${Date.now()}`,
          conceptIndex: raw.conceptIndex,
          title: raw.title,
          direction: raw.direction,
          promptUsed: raw.promptUsed,
          mode: raw.mode,
          visualStyle: activeStyle,
          aspectRatio: activeRatio,
          engine: raw.engine,
          backgroundDataUrl: raw.mode === "exact_product" ? bgDataUrl : undefined,
          finalImageDataUrl,
          apiNotice: raw.apiNotice,
        });
      }
      return built;
    },
    [headlineOverlay, promoOverlay, sourceDataUrl]
  );

  // Core Image Studio pipeline
  const generateImageConcepts = useCallback(
    async (
      targetAnalysis: ProductAnalysis,
      targetCutout: CutoutResult | null,
      targetSourceUrl: string,
      conceptIndex?: number
    ) => {
      const { base64, mimeType } = splitDataUrl(targetSourceUrl);
      const res = await fetch("/api/image-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: targetAnalysis.productName,
          category: targetAnalysis.category,
          colors: targetAnalysis.colors || [],
          material: targetAnalysis.material || "",
          visualStyle,
          aspectRatio,
          mode: generationMode,
          imageBase64: base64,
          mimeType,
          conceptIndex,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Image concept generation failed.");
      }

      if (data.apiWarning && generationMode === "ai_creative") {
        setApiWarning(
          `Nano Banana AI Creative Mode requires an active paid API key or quota (${data.apiWarning}). Switch to Exact Product Mode to composite cleanly with local studio scenes.`
        );
      } else if (data.apiWarning) {
        setApiWarning(
          `Exact Product Mode preserved your product pixels over local studio stages (Nano Banana background note: ${data.apiWarning}).`
        );
      } else {
        setApiWarning(null);
      }

      const hydrated = await finalizeConcepts(
        data.concepts || [],
        targetCutout,
        targetAnalysis,
        visualStyle,
        aspectRatio
      );

      if (typeof conceptIndex === "number") {
        setConcepts((prev) => {
          const next = [...prev];
          const idx = next.findIndex((c) => c.conceptIndex === conceptIndex);
          if (idx >= 0 && hydrated[0]) {
            next[idx] = hydrated[0];
          } else if (hydrated[0]) {
            next.push(hydrated[0]);
          }
          return next.sort((a, b) => a.conceptIndex - b.conceptIndex);
        });
      } else {
        setConcepts(hydrated);
        if (hydrated.length > 0) {
          setImageHistory((prev) => [
            {
              id: `hist_${Date.now()}`,
              createdAt: new Date().toISOString(),
              productName: targetAnalysis.productName,
              visualStyle,
              aspectRatio,
              mode: generationMode,
              concepts: hydrated,
            },
            ...prev.slice(0, 7),
          ]);
        }
        if (hydrated[0] && !approvedVideoImgUrl) {
          setApprovedVideoImgUrl(hydrated[0].finalImageDataUrl);
          setApprovedVideoImgLabel(hydrated[0].title);
        }
      }
      void refreshMetadata();
    },
    [
      approvedVideoImgUrl,
      aspectRatio,
      finalizeConcepts,
      generationMode,
      refreshMetadata,
      visualStyle,
    ]
  );

  const runAnalyzeAndGenerate = useCallback(async () => {
    if (!sourceDataUrl) {
      setErrorMsg("Upload or paste a product image first.");
      return;
    }

    setErrorMsg(null);
    setApiWarning(null);
    setSaveStatusMsg(null);

    try {
      setStep("analyzing");
      const { base64, mimeType } = splitDataUrl(sourceDataUrl);
      const detailsParts = detailsImageDataUrl
        ? splitDataUrl(detailsImageDataUrl)
        : null;

      const analyzeRes = await fetch("/api/analyze-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          targetTone: tone,
          language,
          pricePromo,
          productDetails,
          detailsImageBase64: detailsParts?.base64,
          detailsImageMimeType: detailsParts?.mimeType,
          campaignType,
        }),
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) {
        throw new Error(analyzeData?.error || "Product analysis failed.");
      }

      const parsed = analyzeData as ProductAnalysis;
      const chosenBackdrop = parsed.suggestedBackdrop || "travertine";
      setAnalysis(parsed);
      setBackdrop(chosenBackdrop);
      setTargetAudience((prev) => prev || parsed.targetAudience || "");
      setSelectedHookId(parsed.strategist.hooks[0]?.id ?? null);
      if (!campaignName.trim()) {
        setCampaignName(`${parsed.productName} Campaign`);
      }

      // Extract exact original product cutout
      setStep("removing_bg");
      const cutoutRes = await removeBackgroundAndCompose(
        sourceDataUrl,
        parsed.productBox,
        chosenBackdrop,
        sensitivity,
        parsed.accentHex,
        parsed.wearType
      );
      setCutout(cutoutRes);

      // Generate 3 commercial image concepts
      setStep("generating_images");
      await generateImageConcepts(parsed, cutoutRes, sourceDataUrl);
      setStep("complete");
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Image Studio workflow failed."
      );
      setStep("error");
    }
  }, [
    campaignName,
    campaignType,
    detailsImageDataUrl,
    generateImageConcepts,
    language,
    pricePromo,
    productDetails,
    sensitivity,
    sourceDataUrl,
    tone,
  ]);

  const hasExtraDetails = Boolean(
    detailsImageDataUrl || pricePromo.trim() || productDetails.trim()
  );

  const handleRequestAnalyzeAndGenerate = () => {
    if (!sourceDataUrl) return;
    if (!hasExtraDetails && !analysis) {
      setShowGenerateConfirm(true);
      return;
    }
    void runAnalyzeAndGenerate();
  };

  const handleGenerateConceptsOnly = async () => {
    if (!analysis || !sourceDataUrl) return;
    setErrorMsg(null);
    try {
      setStep("generating_images");
      await generateImageConcepts(analysis, cutout, sourceDataUrl);
      setStep("complete");
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Concept generation failed."
      );
      setStep("error");
    }
  };

  const handleRegenerateConcept = async (conceptIdx: number) => {
    if (!analysis || !sourceDataUrl) return;
    setRegeneratingConceptIdx(conceptIdx);
    setErrorMsg(null);
    try {
      await generateImageConcepts(analysis, cutout, sourceDataUrl, conceptIdx);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Concept regeneration failed."
      );
    } finally {
      setRegeneratingConceptIdx(null);
    }
  };

  // Sensitivity or Manual Mask refinement updates exact-product concepts immediately
  const handleSensitivityChange = async (newSens: number) => {
    setSensitivity(newSens);
    if (!sourceDataUrl || !analysis) return;
    try {
      const updatedCutout = await removeBackgroundAndCompose(
        sourceDataUrl,
        analysis.productBox,
        backdrop,
        newSens,
        analysis.accentHex,
        analysis.wearType
      );
      setCutout(updatedCutout);

      const recomposited = await Promise.all(
        concepts.map(async (c) => {
          if (c.mode !== "exact_product") return c;
          const img = await compositeExactProductOverBackground({
            cutoutDataUrl: updatedCutout.cutoutDataUrl,
            backgroundDataUrl: c.backgroundDataUrl,
            fallbackBackdrop: backdrop,
            aspectRatio: c.aspectRatio,
            accentHex: analysis.accentHex,
            visualStyle: c.visualStyle,
            headlineOverlay,
            promoBadgeOverlay: promoOverlay,
          });
          return { ...c, finalImageDataUrl: img };
        })
      );
      setConcepts(recomposited);
    } catch {
      // ignore live slider error
    }
  };

  const handleApplyManualCutout = async (newCutoutDataUrl: string) => {
    if (!cutout || !analysis) return;
    const updatedCutout: CutoutResult = {
      ...cutout,
      cutoutDataUrl: newCutoutDataUrl,
    };
    setCutout(updatedCutout);
    const recomposited = await Promise.all(
      concepts.map(async (c) => {
        if (c.mode !== "exact_product") return c;
        const img = await compositeExactProductOverBackground({
          cutoutDataUrl: newCutoutDataUrl,
          backgroundDataUrl: c.backgroundDataUrl,
          fallbackBackdrop: backdrop,
          aspectRatio: c.aspectRatio,
          accentHex: analysis.accentHex,
          visualStyle: c.visualStyle,
          headlineOverlay,
          promoBadgeOverlay: promoOverlay,
        });
        return { ...c, finalImageDataUrl: img };
      })
    );
    setConcepts(recomposited);
  };

  // Upload handlers
  const handleProductBlob = useCallback(async (blob: Blob, label: string) => {
    if (!blob.type.startsWith("image/")) {
      setErrorMsg("Please upload a valid PNG, JPG, or WebP image.");
      return;
    }
    const dataUrl = await fileToDataUrl(blob);
    setSourceDataUrl(dataUrl);
    setSourceLabel(label);
    setAnalysis(null);
    setCutout(null);
    setConcepts([]);
    setApprovedVideoImgUrl(null);
    setOmniVideo(null);
    setLocalVideo(null);
    setErrorMsg(null);
    setApiWarning(null);
    setStep("idle");
  }, []);

  const handleDetailsBlob = useCallback(async (blob: Blob, label: string) => {
    if (!blob.type.startsWith("image/")) return;
    const dataUrl = await fileToDataUrl(blob);
    setDetailsImageDataUrl(dataUrl);
    setDetailsImageLabel(label);
  }, []);

  const handlePasteDetails = async () => {
    setPasteTarget("details");
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          await handleDetailsBlob(blob, "Pasted specs screenshot");
          return;
        }
      }
    } catch {
      setErrorMsg("Press Ctrl+V / ⌘+V to paste your screenshot.");
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            if (pasteTarget === "details") {
              void handleDetailsBlob(file, "Pasted details screenshot");
            } else {
              void handleProductBlob(file, "Pasted product photo");
            }
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleDetailsBlob, handleProductBlob, pasteTarget]);

  const handleLoadSample = async (sample: SampleProduct) => {
    const res = await fetch(sample.imagePath);
    if (!res.ok) return;
    const blob = await res.blob();
    await handleProductBlob(blob, sample.label);
  };

  // Video Studio Handlers
  const handleGenerateMotionPrompt = async (customNotes?: string) => {
    setIsGeneratingPrompt(true);
    setVideoJobError(null);
    try {
      const res = await fetch("/api/video-studio/motion-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: analysis?.productName || approvedVideoImgLabel || "Commercial Product",
          category: analysis?.category || "E-Commerce",
          motionPreset,
          visualStyle,
          customNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Motion prompt failed.");
      setMotionPrompt(data.motionPrompt || "");
      void refreshMetadata();
    } catch (err: unknown) {
      setVideoJobError(
        err instanceof Error ? err.message : "Could not generate motion prompt."
      );
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const pollVideoJob = (jobId: string) => {
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/video-studio/status/${jobId}`);
        const job = await res.json();
        if (!res.ok) {
          throw new Error(job?.error || "Status check failed.");
        }
        setVideoJobStatus(`Status: ${job.status} (${job.model})`);
        if (job.status === "completed" && job.videoUrl) {
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setIsGeneratingVideo(false);
          setOmniVideo({
            videoUrl: job.videoUrl,
            mimeType: "video/mp4",
            extension: "mp4",
            durationSec: job.durationSec || videoDurationSec,
            resolution: job.resolution || "1080p",
            engine: "gemini_omni",
            jobId: job.id,
            interactionId: job.interactionId,
            jobVideoFilename: job.videoFile,
          });
          void refreshMetadata();
        } else if (job.status === "failed") {
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setIsGeneratingVideo(false);
          setVideoJobError(job.error || "Gemini Omni video generation failed.");
          void refreshMetadata();
        }
      } catch (err: unknown) {
        if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setIsGeneratingVideo(false);
        setVideoJobError(
          err instanceof Error ? err.message : "Polling video job failed."
        );
      }
    }, 3500);
  };

  const handleSubmitOmniVideo = async () => {
    if (!approvedVideoImgUrl) {
      setVideoJobError("Select or upload an approved product image first.");
      return;
    }
    const promptToSend =
      motionPrompt.trim() ||
      `${motionPreset} showcasing ${analysis?.productName || "this product"}, smooth commercial lighting, 30fps.`;
    if (!motionPrompt.trim()) setMotionPrompt(promptToSend);

    setIsGeneratingVideo(true);
    setVideoJobError(null);
    setVideoJobStatus("Submitting to Gemini Omni Interactions API...");
    try {
      const rawDataUrl = await urlToDataUrl(approvedVideoImgUrl);
      const { base64, mimeType } = splitDataUrl(rawDataUrl);
      const res = await fetch("/api/video-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          motionPrompt: promptToSend,
          aspectRatio: aspectRatio === "16:9" ? "16:9" : "9:16",
          durationSec: videoDurationSec,
          resolution: "1080p",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Video generation request failed.");
      }

      if (data.status === "completed" && data.videoUrl) {
        setIsGeneratingVideo(false);
        setVideoJobStatus("Completed");
        setOmniVideo({
          videoUrl: data.videoUrl,
          mimeType: "video/mp4",
          extension: "mp4",
          durationSec: data.durationSec || videoDurationSec,
          resolution: data.resolution || "1080p",
          engine: "gemini_omni",
          jobId: data.id,
          interactionId: data.interactionId,
          jobVideoFilename: data.videoFile,
        });
        void refreshMetadata();
      } else {
        setVideoJobStatus(`Queued (${data.id}) — rendering MP4...`);
        pollVideoJob(data.id);
      }
    } catch (err: unknown) {
      setIsGeneratingVideo(false);
      setVideoJobStatus(null);
      setVideoJobError(
        err instanceof Error ? err.message : "Failed to start video generation."
      );
      void refreshMetadata();
    }
  };

  const handleExtendOmniVideo = async () => {
    if (!omniVideo?.interactionId) return;
    setIsGeneratingVideo(true);
    setVideoJobError(null);
    setVideoJobStatus("Extending video via previous_interaction_id...");
    try {
      const res = await fetch("/api/video-studio/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previousInteractionId: omniVideo.interactionId,
          continuationPrompt:
            "Smoothly continue the product commercial motion with golden-hour rim light and steady framing hold.",
          aspectRatio: aspectRatio === "16:9" ? "16:9" : "9:16",
          extraSeconds: 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Video extension failed.");
      if (data.status === "completed" && data.videoUrl) {
        setIsGeneratingVideo(false);
        setOmniVideo({
          videoUrl: data.videoUrl,
          mimeType: "video/mp4",
          extension: "mp4",
          durationSec: data.durationSec || 25,
          resolution: data.resolution || "1080p",
          engine: "gemini_omni",
          jobId: data.id,
          interactionId: data.interactionId,
          jobVideoFilename: data.videoFile,
        });
      } else {
        pollVideoJob(data.id);
      }
    } catch (err: unknown) {
      setIsGeneratingVideo(false);
      setVideoJobError(
        err instanceof Error ? err.message : "Failed to extend video."
      );
    }
  };

  const activeVoiceoverScript =
    analysis?.strategist.videoScript.voiceoverText ?? voiceoverScriptDraft;

  const handleUpdateVoiceoverScript = (nextScript: string) => {
    setVoiceoverBase64(null);
    if (analysis) {
      setAnalysis({
        ...analysis,
        strategist: {
          ...analysis.strategist,
          videoScript: {
            ...analysis.strategist.videoScript,
            voiceoverText: nextScript,
          },
        },
      });
    } else {
      setVoiceoverScriptDraft(nextScript);
    }
  };

  const handleGenerateVoiceoverScript = async () => {
    const productTitle =
      analysis?.productName || approvedVideoImgLabel || sourceLabel || "Produkto";
    setIsGeneratingVoiceScript(true);
    setVoiceoverError(null);
    try {
      const res = await fetch("/api/voiceover/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productTitle,
          category: analysis?.category || "Consumer Goods",
          keyBenefits: analysis?.keyBenefits || [],
          pricePromo,
          verifiedDiscounts,
          productDetails,
          languageMode: voiceoverLangMode,
          deliveryStyle: voiceoverStyle,
          pace: voiceoverPace,
          existingScript: activeVoiceoverScript,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.voiceoverText) {
        throw new Error(data?.error || "Voiceover script generation failed.");
      }
      handleUpdateVoiceoverScript(data.voiceoverText as string);
      void refreshMetadata();
    } catch (err: unknown) {
      setVoiceoverError(
        err instanceof Error
          ? err.message
          : "Could not generate voiceover script."
      );
    } finally {
      setIsGeneratingVoiceScript(false);
    }
  };

  // Preserved Local Studio + TTS Voiceover Compositor
  const handleSynthesizeVoiceover = async (): Promise<string | null> => {
    const scriptText = activeVoiceoverScript.trim();
    if (!scriptText) return null;
    setIsSynthesizingVoiceover(true);
    setVoiceoverError(null);
    try {
      const res = await fetch("/api/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: scriptText,
          voiceName,
          languageMode: voiceoverLangMode,
          deliveryStyle: voiceoverStyle,
          pace: voiceoverPace,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.audioBase64) {
        throw new Error(data?.error || "Voiceover synthesis failed.");
      }
      setVoiceoverBase64(data.audioBase64);
      const bin = atob(data.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.mimeType || "audio/wav" });
      setVoiceoverUrl(URL.createObjectURL(blob));
      void refreshMetadata();
      return data.audioBase64 as string;
    } catch (err: unknown) {
      setVoiceoverError(
        err instanceof Error ? err.message : "Voiceover failed."
      );
      return null;
    } finally {
      setIsSynthesizingVoiceover(false);
    }
  };

  const handleAnalyzeStagedImage = async () => {
    const imgUrl = approvedVideoImgUrl || sourceDataUrl;
    if (!imgUrl) return;
    setIsAnalyzingForVideo(true);
    setLocalRenderError(null);
    setVideoJobError(null);
    try {
      const rawDataUrl = await urlToDataUrl(imgUrl);
      const { base64, mimeType } = splitDataUrl(rawDataUrl);
      const res = await fetch("/api/analyze-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          targetTone: tone,
          language,
          pricePromo,
          productDetails,
          campaignType,
        }),
      });
      const analyzed = (await res.json()) as ProductAnalysis;
      if (!res.ok) {
        throw new Error(
          (analyzed as unknown as { error?: string })?.error ||
            "Product analysis failed."
        );
      }
      setAnalysis(analyzed);
      setBackdrop(analyzed.suggestedBackdrop || "travertine");
      setSelectedHookId(analyzed.strategist.hooks?.[0]?.id ?? null);
      if (!sourceDataUrl) {
        setSourceDataUrl(rawDataUrl);
        setSourceLabel(approvedVideoImgLabel || analyzed.productName);
      }
      const cutRes = await removeBackgroundAndCompose(
        rawDataUrl,
        analyzed.productBox,
        analyzed.suggestedBackdrop || "travertine",
        sensitivity,
        analyzed.accentHex || "#E11D48",
        analyzed.wearType
      );
      setCutout(cutRes);

      const promptRes = await fetch("/api/video-studio/motion-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: analyzed.productName,
          category: analyzed.category,
          motionPreset,
          visualStyle,
        }),
      });
      if (promptRes.ok) {
        const promptData = await promptRes.json();
        if (promptData.motionPrompt) setMotionPrompt(promptData.motionPrompt);
      }
      void refreshMetadata();
    } catch (err: unknown) {
      setLocalRenderError(
        err instanceof Error ? err.message : "Could not analyze product image."
      );
    } finally {
      setIsAnalyzingForVideo(false);
    }
  };

  const handleRenderLocalVideo = async () => {
    const imgUrl = approvedVideoImgUrl || sourceDataUrl;
    if (!imgUrl && !cutout) {
      setLocalRenderError("Upload or select a product image first.");
      return;
    }
    unlockAudioContext();
    setIsRenderingLocalVideo(true);
    setLocalRenderProgress(0);
    setLocalRenderError(null);
    try {
      let activeCutout = cutout;
      if (!activeCutout && imgUrl) {
        const rawDataUrl = await urlToDataUrl(imgUrl);
        const box = analysis?.productBox || {
          ymin: 80,
          xmin: 80,
          ymax: 920,
          xmax: 920,
        };
        activeCutout = await removeBackgroundAndCompose(
          rawDataUrl,
          box,
          backdrop,
          sensitivity,
          analysis?.accentHex || "#E11D48",
          analysis?.wearType
        );
        setCutout(activeCutout);
      }
      if (!activeCutout) {
        throw new Error("Could not prepare product cutout layer.");
      }

      let vo = voiceoverBase64;
      if (!vo && activeVoiceoverScript.trim()) {
        vo = await handleSynthesizeVoiceover();
      }

      const matchingConceptBg =
        concepts.find((c) => c.finalImageDataUrl === approvedVideoImgUrl)
          ?.backgroundDataUrl || concepts[0]?.backgroundDataUrl;

      const productTitle =
        analysis?.productName || approvedVideoImgLabel || "Product Showcase";
      const fallbackScript = {
        beat1Hook: `${productTitle}`,
        beat2Benefit:
          analysis?.shortTagline || "Authentic Product Showcase",
        beat3Offer:
          language === "tagalog" ? "Check Out Now" : "Shop Now",
        voiceoverText: activeVoiceoverScript,
      };

      const rendered = await renderShowcaseVideo({
        cutoutDataUrl: activeCutout.cutoutDataUrl,
        backgroundDataUrl: matchingConceptBg,
        presentationMode: "product_only",
        productName: productTitle,
        tagline: analysis?.shortTagline || "",
        script: analysis?.strategist.videoScript || fallbackScript,
        backdropPreset: backdrop,
        stylePreset: videoStyle,
        motionPreset,
        aspectRatio: aspectRatio === "16:9" ? "16:9" : "9:16",
        accentHex: analysis?.accentHex || "#E11D48",
        language,
        voiceoverBase64: vo,
        showOverlays: showLayerOverlays,
        onProgress: setLocalRenderProgress,
      });
      setLocalVideo({ ...rendered, engine: "local_compositor" });
    } catch (err: unknown) {
      setLocalRenderError(
        err instanceof Error ? err.message : "Exact Product Showcase render failed."
      );
    } finally {
      setIsRenderingLocalVideo(false);
    }
  };

  const handleUploadFlowVideo = (file: File) => {
    const ext = file.name.toLowerCase().endsWith(".webm") ? "webm" : "mp4";
    const objectUrl = URL.createObjectURL(file);
    setFlowVideo({
      videoUrl: objectUrl,
      blob: file,
      mimeType: file.type || (ext === "webm" ? "video/webm" : "video/mp4"),
      extension: ext,
      durationSec: 0,
      engine: "google_flow_upload",
      label: file.name,
    });
  };

  const handleRegenerateCopy = async (
    customDirection?: string,
    scope: CopyRegenScope = "all",
    standaloneBrief?: {
      productName: string;
      category: string;
      benefitsText: string;
    }
  ) => {
    const activeName = standaloneBrief?.productName || analysis?.productName;
    if (!activeName) return;

    const activeCategory =
      standaloneBrief?.category || analysis?.category || "Consumer Goods";
    const activeBenefits = standaloneBrief?.benefitsText
      ? standaloneBrief.benefitsText
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean)
      : analysis?.keyBenefits || [];

    setIsRegeneratingCopy(true);
    try {
      const detailsParts = detailsImageDataUrl
        ? splitDataUrl(detailsImageDataUrl)
        : null;
      const res = await fetch("/api/regenerate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: activeName,
          category: activeCategory,
          keyBenefits: activeBenefits,
          targetTone: tone,
          language,
          pricePromo,
          verifiedDiscounts,
          targetAudience: targetAudience || analysis?.targetAudience,
          campaignObjectives,
          productDetails,
          detailsImageBase64: detailsParts?.base64,
          detailsImageMimeType: detailsParts?.mimeType,
          customPrompt: customDirection,
          campaignType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Copy regeneration failed.");

      if (!analysis) {
        const synthesizedAnalysis: ProductAnalysis = {
          productName: activeName,
          category: activeCategory,
          wearType: "handheld_showcase",
          shortTagline:
            data.headlines?.[0] || data.competitiveAngle || activeName,
          keyBenefits:
            activeBenefits.length > 0
              ? activeBenefits
              : [data.competitiveAngle || activeCategory],
          targetAudience: targetAudience || "TikTok Shop shoppers",
          productBox: { ymin: 100, xmin: 100, ymax: 900, xmax: 900 },
          suggestedBackdrop: "travertine",
          accentHex: "#E11D48",
          strategist: data,
        };
        setAnalysis(synthesizedAnalysis);
        setSelectedHookId(data.hooks?.[0]?.id ?? null);
        if (!campaignName.trim()) setCampaignName(`${activeName} Campaign`);
      } else if (scope === "hooks") {
        setAnalysis({
          ...analysis,
          strategist: { ...analysis.strategist, hooks: data.hooks },
        });
        setSelectedHookId(data.hooks?.[0]?.id ?? null);
      } else if (scope === "headlines") {
        setAnalysis({
          ...analysis,
          strategist: {
            ...analysis.strategist,
            headlines: data.headlines,
            ctaSuggestions: data.ctaSuggestions,
          },
        });
      } else if (scope === "caption") {
        setAnalysis({
          ...analysis,
          strategist: {
            ...analysis.strategist,
            productDescription: data.productDescription,
            caption: data.caption,
            hashtags: data.hashtags,
          },
        });
      } else {
        setAnalysis({ ...analysis, strategist: data });
        setSelectedHookId(data.hooks?.[0]?.id ?? null);
      }
      void refreshMetadata();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Copy regeneration failed."
      );
    } finally {
      setIsRegeneratingCopy(false);
    }
  };

  const handleSelectHook = (hook: ViralHook) => {
    setSelectedHookId(hook.id);
    if (!analysis) return;
    setAnalysis({
      ...analysis,
      strategist: {
        ...analysis.strategist,
        videoScript: {
          ...analysis.strategist.videoScript,
          beat1Hook: hook.onScreenText,
        },
      },
    });
  };

  // Save Project to Disk Backend
  const handleSaveProject = async () => {
    if (!analysis) return;
    setIsSavingProject(true);
    setSaveStatusMsg(null);
    try {
      const assetsToSave: Array<{
        id: string;
        label: string;
        kind: "source" | "cutout" | "concept" | "video" | "audio";
        dataUrlOrBase64?: string;
        jobVideoFilename?: string;
        mimeType: string;
        style?: string;
        mode?: string;
        direction?: string;
        aspectRatio?: string;
        engine?: string;
      }> = [];

      if (sourceDataUrl) {
        assetsToSave.push({
          id: "source_product",
          label: "Original Product",
          kind: "source",
          dataUrlOrBase64: sourceDataUrl,
          mimeType: splitDataUrl(sourceDataUrl).mimeType,
        });
      }

      if (cutout?.cutoutDataUrl) {
        assetsToSave.push({
          id: "exact_cutout",
          label: "Extracted Cutout",
          kind: "cutout",
          dataUrlOrBase64: cutout.cutoutDataUrl,
          mimeType: "image/png",
        });
      }

      for (const c of concepts) {
        assetsToSave.push({
          id: `concept_${c.conceptIndex + 1}`,
          label: c.title,
          kind: "concept",
          dataUrlOrBase64: c.finalImageDataUrl,
          mimeType: "image/png",
          style: c.visualStyle,
          mode: c.mode,
          direction: c.direction,
          aspectRatio: c.aspectRatio,
          engine: c.engine,
        });
      }

      if (omniVideo?.jobVideoFilename) {
        assetsToSave.push({
          id: "campaign_video_mp4",
          label: "Gemini Omni Video MP4",
          kind: "video",
          jobVideoFilename: omniVideo.jobVideoFilename,
          mimeType: "video/mp4",
        });
      } else if (localVideo?.blob) {
        const vidData = await fileToDataUrl(localVideo.blob);
        assetsToSave.push({
          id: "campaign_video_local",
          label: "Exact Product Showcase Video",
          kind: "video",
          dataUrlOrBase64: vidData,
          mimeType: localVideo.mimeType,
        });
      }
      if (flowVideo?.blob) {
        const flowData = await fileToDataUrl(flowVideo.blob);
        assetsToSave.push({
          id: "google_flow_upload",
          label: flowVideo.label || "Uploaded Google Flow Video",
          kind: "video",
          dataUrlOrBase64: flowData,
          mimeType: flowVideo.mimeType,
        });
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: projectId || undefined,
          name: campaignName.trim() || `${analysis.productName} Campaign`,
          campaignType,
          clientOrBrandName,
          language,
          targetTone: tone,
          visualStyle,
          aspectRatio,
          generationMode,
          motionPreset,
          motionPrompt,
          notes: campaignNotes,
          analysis,
          assetsToSave,
        }),
      });
      const saved = (await res.json()) as StoredProjectFull;
      if (!res.ok) throw new Error("Failed to save project.");
      setProjectId(saved.id);
      setCampaignName(saved.name);
      setSaveStatusMsg(`Saved project "${saved.name}" with ${saved.assets.length} assets.`);
      void refreshMetadata();
    } catch (err: unknown) {
      setSaveStatusMsg(
        err instanceof Error ? err.message : "Failed to save project."
      );
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleReopenProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) return;
      const proj = (await res.json()) as StoredProjectFull;
      setProjectId(proj.id);
      setCampaignName(proj.name);
      setCampaignType(proj.campaignType);
      setClientOrBrandName(proj.clientOrBrandName || "");
      setCampaignNotes(proj.notes || "");
      setLanguage(proj.language || "tagalog");
      setTone(proj.targetTone || "viral_urgency");
      setVisualStyle(proj.visualStyle || "Luxury");
      setAspectRatio(proj.aspectRatio || "9:16");
      setGenerationMode(proj.generationMode || "exact_product");
      setMotionPreset(
        (proj.motionPreset as MotionPreset) || "Cinematic Product Reveal"
      );
      setMotionPrompt(proj.motionPrompt || "");
      setAnalysis(proj.analysis);
      setTargetAudience(proj.analysis?.targetAudience || "");
      setSelectedHookId(proj.analysis?.strategist.hooks?.[0]?.id ?? null);

      const srcAsset = proj.assets.find((a) => a.kind === "source");
      const cutAsset = proj.assets.find((a) => a.kind === "cutout");
      const conceptAssets = proj.assets.filter((a) => a.kind === "concept");
      const videoAsset = proj.assets.find((a) => a.kind === "video");

      if (srcAsset) {
        const srcData = await urlToDataUrl(srcAsset.url);
        setSourceDataUrl(srcData);
        setSourceLabel(proj.analysis?.productName || proj.name);
      }

      if (cutAsset) {
        const cutData = await urlToDataUrl(cutAsset.url);
        setCutout({
          cutoutDataUrl: cutData,
          studioImageDataUrl: conceptAssets[0]?.url || cutData,
          cutoutWidth: 720,
          cutoutHeight: 720,
        });
      }

      const restoredConcepts: ImageConceptAsset[] = await Promise.all(
        conceptAssets.map(async (ca, idx) => ({
          id: ca.id || `restored_${idx}`,
          conceptIndex: idx,
          title: ca.label,
          direction: ca.direction || "",
          promptUsed: "",
          mode: (ca.mode as ImageGenerationMode) || proj.generationMode,
          visualStyle: (ca.style as VisualStyle) || proj.visualStyle,
          aspectRatio: (ca.aspectRatio as AspectRatioOption) || proj.aspectRatio,
          engine:
            ca.engine === "nano_banana" ? "nano_banana" : "studio_procedural",
          finalImageDataUrl: await urlToDataUrl(ca.url),
        }))
      );
      setConcepts(restoredConcepts);

      if (restoredConcepts[0]) {
        setApprovedVideoImgUrl(restoredConcepts[0].finalImageDataUrl);
        setApprovedVideoImgLabel(restoredConcepts[0].title);
      }

      if (videoAsset) {
        setOmniVideo({
          videoUrl: videoAsset.url,
          mimeType: videoAsset.mimeType || "video/mp4",
          extension: videoAsset.filename.endsWith(".webm") ? "webm" : "mp4",
          durationSec: 15,
          engine: "gemini_omni",
        });
      } else {
        setOmniVideo(null);
      }

      setActiveSection("campaign_studio");
    } catch {
      // ignore fetch error
    }
  };

  const resetSession = () => {
    setProjectId(null);
    setCampaignName("");
    setClientOrBrandName("");
    setCampaignNotes("");
    setSourceDataUrl(null);
    setSourceLabel("");
    setDetailsImageDataUrl(null);
    setDetailsImageLabel("");
    setPricePromo("");
    setProductDetails("");
    setAnalysis(null);
    setCutout(null);
    setConcepts([]);
    setApprovedVideoImgUrl(null);
    setApprovedVideoImgLabel("");
      setOmniVideo(null);
      setLocalVideo(null);
      setFlowVideo(null);
      setVoiceoverUrl(null);
      setVoiceoverBase64(null);
      setVoiceoverScriptDraft("");
      setVoiceoverError(null);
      setErrorMsg(null);
      setApiWarning(null);
      setSaveStatusMsg(null);
      setStep("idle");
      setActiveSection("image_studio");
    };

    const exportAssetCount =
      concepts.length +
      (cutout ? 1 : 0) +
      (omniVideo ? 1 : 0) +
      (localVideo ? 1 : 0) +
      (flowVideo ? 1 : 0) +
      (voiceoverUrl ? 1 : 0);

  return (
    <StudioShell
      activeSection={activeSection}
      onNavigate={setActiveSection}
      activeProductName={analysis?.productName}
      activeProjectName={campaignName || undefined}
      projectCount={projects.length}
      exportAssetCount={exportAssetCount}
      onNewSession={resetSession}
    >
      {activeSection === "overview" && (
        <DashboardView
          usage={usage}
          availability={availability}
          projects={projects}
          isCheckingAvailability={isCheckingAvailability}
          onRefreshAvailability={() => void refreshAvailability(true)}
          onStartUseCase={(type) => {
            setCampaignType(type);
            setActiveSection("image_studio");
          }}
          onNavigate={setActiveSection}
          onOpenProject={(id) => void handleReopenProject(id)}
        />
      )}

      {activeSection === "image_studio" && (
        <ImageStudioView
          sourceDataUrl={sourceDataUrl}
          sourceLabel={sourceLabel}
          detailsImageDataUrl={detailsImageDataUrl}
          detailsImageLabel={detailsImageLabel}
          pricePromo={pricePromo}
          productDetails={productDetails}
          language={language}
          tone={tone}
          visualStyle={visualStyle}
          aspectRatio={aspectRatio}
          generationMode={generationMode}
          sensitivity={sensitivity}
          analysis={analysis}
          cutout={cutout}
          concepts={concepts}
          imageHistory={imageHistory}
          step={step}
          regeneratingConceptIdx={regeneratingConceptIdx}
          errorMsg={errorMsg}
          apiWarning={apiWarning}
          headlineOverlay={headlineOverlay}
          promoOverlay={promoOverlay}
          onUploadProductFile={(f, lbl) => void handleProductBlob(f, lbl)}
          onUploadDetailsFile={(f, lbl) => void handleDetailsBlob(f, lbl)}
          onPasteDetails={() => void handlePasteDetails()}
          onClearDetailsImage={() => {
            setDetailsImageDataUrl(null);
            setDetailsImageLabel("");
          }}
          onChangePricePromo={setPricePromo}
          onChangeProductDetails={setProductDetails}
          onChangeLanguage={setLanguage}
          onChangeTone={setTone}
          onChangeVisualStyle={setVisualStyle}
          onChangeAspectRatio={setAspectRatio}
          onChangeGenerationMode={setGenerationMode}
          onChangeSensitivity={(v) => void handleSensitivityChange(v)}
          onChangeHeadlineOverlay={setHeadlineOverlay}
          onChangePromoOverlay={setPromoOverlay}
          onLoadSample={(s) => void handleLoadSample(s)}
          onRequestAnalyzeAndGenerate={handleRequestAnalyzeAndGenerate}
          onGenerateConceptsOnly={() => void handleGenerateConceptsOnly()}
          onRegenerateConcept={(idx) => void handleRegenerateConcept(idx)}
          onOpenMaskRefine={() => setShowMaskRefineModal(true)}
          onSendConceptToVideo={(concept) => {
            setApprovedVideoImgUrl(concept.finalImageDataUrl);
            setApprovedVideoImgLabel(concept.title);
            setActiveSection("video_studio");
          }}
          onSendToCampaign={() => setActiveSection("campaign_studio")}
          onSetPasteTarget={setPasteTarget}
        />
      )}

      {activeSection === "video_studio" && (
        <VideoStudioView
          analysis={analysis}
          cutout={cutout}
          concepts={concepts}
          approvedImageDataUrl={approvedVideoImgUrl}
          approvedImageLabel={approvedVideoImgLabel}
          motionPreset={motionPreset}
          motionPrompt={motionPrompt}
          aspectRatio={aspectRatio}
          durationSec={videoDurationSec}
          video={omniVideo}
          localVideo={localVideo}
          flowVideo={flowVideo}
          videoAvailability={videoAvailability}
          isCheckingVideoAccess={isCheckingVideoAccess}
          videoJobStatus={videoJobStatus}
          videoJobError={videoJobError}
          isAnalyzingForVideo={isAnalyzingForVideo}
          isGeneratingPrompt={isGeneratingPrompt}
          isGeneratingVideo={isGeneratingVideo}
          isRenderingLocalVideo={isRenderingLocalVideo}
          localRenderProgress={localRenderProgress}
          localRenderError={localRenderError}
          showLayerOverlays={showLayerOverlays}
          voiceoverScript={activeVoiceoverScript}
          voiceName={voiceName}
          voiceoverLangMode={voiceoverLangMode}
          voiceoverStyle={voiceoverStyle}
          voiceoverPace={voiceoverPace}
          voiceoverUrl={voiceoverUrl}
          voiceoverError={voiceoverError}
          isGeneratingVoiceScript={isGeneratingVoiceScript}
          isSynthesizingVoiceover={isSynthesizingVoiceover}
          backdrop={backdrop}
          videoStyle={videoStyle}
          language={language}
          onSelectApprovedImage={(url, lbl) => {
            setApprovedVideoImgUrl(url);
            setApprovedVideoImgLabel(lbl);
          }}
          onUploadDirectImage={async (blob, lbl) => {
            const url = await fileToDataUrl(blob);
            setApprovedVideoImgUrl(url);
            setApprovedVideoImgLabel(lbl);
          }}
          onAnalyzeStagedImage={() => void handleAnalyzeStagedImage()}
          onChangeMotionPreset={setMotionPreset}
          onChangeMotionPrompt={setMotionPrompt}
          onChangeAspectRatio={setAspectRatio}
          onChangeDurationSec={setVideoDurationSec}
          onChangeShowLayerOverlays={setShowLayerOverlays}
          onGenerateMotionPrompt={(notes) =>
            void handleGenerateMotionPrompt(notes)
          }
          onCheckVideoAvailability={() => void checkVideoAvailability()}
          onSubmitOmniVideo={() => void handleSubmitOmniVideo()}
          onExtendOmniVideo={() => void handleExtendOmniVideo()}
          onRenderLocalVideo={() => void handleRenderLocalVideo()}
          onUploadFlowVideo={handleUploadFlowVideo}
          onClearFlowVideo={() => setFlowVideo(null)}
          onChangeBackdrop={setBackdrop}
          onChangeVideoStyle={setVideoStyle}
          onChangeVoiceoverScript={handleUpdateVoiceoverScript}
          onChangeVoiceName={(v) => {
            setVoiceName(v);
            setVoiceoverBase64(null);
          }}
          onChangeVoiceoverLangMode={(m) => {
            setVoiceoverLangMode(m);
            setVoiceoverBase64(null);
          }}
          onChangeVoiceoverStyle={(s) => {
            setVoiceoverStyle(s);
            setVoiceoverBase64(null);
          }}
          onChangeVoiceoverPace={(p) => {
            setVoiceoverPace(p);
            setVoiceoverBase64(null);
          }}
          onGenerateVoiceoverScript={() => void handleGenerateVoiceoverScript()}
          onSynthesizeVoiceover={() => void handleSynthesizeVoiceover()}
          onUpdateGoogleFlowPrompt={(p) =>
            analysis &&
            setAnalysis({
              ...analysis,
              strategist: { ...analysis.strategist, googleFlowPrompt: p },
            })
          }
          onSendToCampaign={() => setActiveSection("campaign_studio")}
        />
      )}

      {activeSection === "copywriter" && (
        <CopywriterView
          analysis={analysis}
          language={language}
          tone={tone}
          campaignType={campaignType}
          pricePromo={pricePromo}
          verifiedDiscounts={verifiedDiscounts}
          targetAudience={targetAudience}
          campaignObjectives={campaignObjectives}
          productDetails={productDetails}
          selectedHookId={selectedHookId}
          voiceName={voiceName}
          voiceoverLangMode={voiceoverLangMode}
          voiceoverStyle={voiceoverStyle}
          voiceoverPace={voiceoverPace}
          voiceoverUrl={voiceoverUrl}
          voiceoverError={voiceoverError}
          isGeneratingVoiceScript={isGeneratingVoiceScript}
          isRegeneratingCopy={isRegeneratingCopy}
          isSynthesizingVoiceover={isSynthesizingVoiceover}
          onChangeLanguage={setLanguage}
          onChangeTone={setTone}
          onChangePricePromo={setPricePromo}
          onChangeVerifiedDiscounts={setVerifiedDiscounts}
          onChangeTargetAudience={setTargetAudience}
          onChangeCampaignObjectives={setCampaignObjectives}
          onChangeProductDetails={setProductDetails}
          onChangeVoiceName={(v) => {
            setVoiceName(v);
            setVoiceoverBase64(null);
          }}
          onChangeVoiceoverLangMode={(m) => {
            setVoiceoverLangMode(m);
            setVoiceoverBase64(null);
          }}
          onChangeVoiceoverStyle={(s) => {
            setVoiceoverStyle(s);
            setVoiceoverBase64(null);
          }}
          onChangeVoiceoverPace={(p) => {
            setVoiceoverPace(p);
            setVoiceoverBase64(null);
          }}
          onUpdateAnalysis={setAnalysis}
          onSelectHook={handleSelectHook}
          onRegenerateCopy={(dir, scope, brief) =>
            void handleRegenerateCopy(dir, scope, brief)
          }
          onGenerateVoiceoverScript={() => void handleGenerateVoiceoverScript()}
          onSynthesizeVoiceover={() => void handleSynthesizeVoiceover()}
          onNavigate={setActiveSection}
        />
      )}

      {activeSection === "campaign_studio" && (
        <CampaignStudioView
          projectId={projectId}
          campaignName={campaignName}
          campaignType={campaignType}
          clientOrBrandName={clientOrBrandName}
          notes={campaignNotes}
          pricePromo={pricePromo}
          verifiedDiscounts={verifiedDiscounts}
          targetAudience={targetAudience}
          campaignObjectives={campaignObjectives}
          language={language}
          tone={tone}
          analysis={analysis}
          concepts={concepts}
          video={omniVideo}
          localVideo={localVideo}
          motionPreset={motionPreset}
          motionPrompt={motionPrompt}
          selectedHookId={selectedHookId}
          voiceName={voiceName}
          voiceoverLangMode={voiceoverLangMode}
          voiceoverStyle={voiceoverStyle}
          voiceoverPace={voiceoverPace}
          voiceoverUrl={voiceoverUrl}
          voiceoverError={voiceoverError}
          isGeneratingVoiceScript={isGeneratingVoiceScript}
          isRegeneratingCopy={isRegeneratingCopy}
          isSynthesizingVoiceover={isSynthesizingVoiceover}
          isSavingProject={isSavingProject}
          saveStatusMsg={saveStatusMsg}
          onChangeCampaignName={setCampaignName}
          onChangeCampaignType={setCampaignType}
          onChangeClientOrBrandName={setClientOrBrandName}
          onChangeNotes={setCampaignNotes}
          onChangePricePromo={setPricePromo}
          onChangeVerifiedDiscounts={setVerifiedDiscounts}
          onChangeTargetAudience={setTargetAudience}
          onChangeCampaignObjectives={setCampaignObjectives}
          onChangeVoiceName={(v) => {
            setVoiceName(v);
            setVoiceoverBase64(null);
          }}
          onChangeVoiceoverLangMode={(m) => {
            setVoiceoverLangMode(m);
            setVoiceoverBase64(null);
          }}
          onChangeVoiceoverStyle={(s) => {
            setVoiceoverStyle(s);
            setVoiceoverBase64(null);
          }}
          onChangeVoiceoverPace={(p) => {
            setVoiceoverPace(p);
            setVoiceoverBase64(null);
          }}
          onUpdateAnalysis={setAnalysis}
          onSelectHook={handleSelectHook}
          onRegenerateCopy={(dir, scope) =>
            void handleRegenerateCopy(dir, scope)
          }
          onRegenerateConcept={(idx) => void handleRegenerateConcept(idx)}
          onGenerateVoiceoverScript={() => void handleGenerateVoiceoverScript()}
          onSynthesizeVoiceover={() => void handleSynthesizeVoiceover()}
          onSaveProject={() => void handleSaveProject()}
          onNavigate={setActiveSection}
        />
      )}

      {activeSection === "projects" && (
        <ProjectsView
          projects={projects}
          onRefreshProjects={() => void refreshMetadata()}
          onReopenProject={(id) => void handleReopenProject(id)}
          onRenameProject={async (id, name) => {
            await fetch(`/api/projects/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            });
            await refreshMetadata();
          }}
          onDeleteProject={async (id) => {
            await fetch(`/api/projects/${id}`, { method: "DELETE" });
            if (projectId === id) setProjectId(null);
            await refreshMetadata();
          }}
          onFetchProjectDetail={async (id) => {
            const res = await fetch(`/api/projects/${id}`);
            if (!res.ok) return null;
            return (await res.json()) as StoredProjectFull;
          }}
        />
      )}

      {activeSection === "export_center" && (
        <ExportCenterView
          analysis={analysis}
          cutout={cutout}
          concepts={concepts}
          imageHistory={imageHistory}
          omniVideo={omniVideo}
          localVideo={localVideo}
          flowVideo={flowVideo}
          voiceoverUrl={voiceoverUrl}
          onNavigate={setActiveSection}
        />
      )}

      {activeSection === "settings" && (
        <SettingsView
          modelConfig={modelConfig}
          availability={availability}
          isCheckingAvailability={isCheckingAvailability}
          onRefreshAvailability={() => void refreshAvailability(true)}
          onUpdateModelConfig={handleUpdateModelConfig}
        />
      )}

      {/* Ask Permission Confirmation Modal if Extra Details Were Not Supplied */}
      {showGenerateConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#121824] p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </span>
                <h2 className="font-display text-base font-bold text-white">
                  Confirm Generation Without Extra Details?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateConfirm(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You haven&apos;t attached a specs/price screenshot or typed product
              notes yet. Would you like to add details first so the AI
              copywriter uses exact pricing and specs, or generate directly from
              the photo?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGenerateConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                Add Details First
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGenerateConfirm(false);
                  void runAnalyzeAndGenerate();
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white cursor-pointer"
              >
                Proceed &amp; Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Segmentation Correction Modal */}
      {sourceDataUrl && cutout && analysis && (
        <MaskRefineModal
          isOpen={showMaskRefineModal}
          sourceDataUrl={sourceDataUrl}
          cutoutDataUrl={cutout.cutoutDataUrl}
          productBox={analysis.productBox}
          onClose={() => setShowMaskRefineModal(false)}
          onApplyCutout={(newUrl) => void handleApplyManualCutout(newUrl)}
        />
      )}
    </StudioShell>
  );
}
