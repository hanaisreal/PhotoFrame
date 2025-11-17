"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import type Konva from "konva";
import { ImageIcon, Loader2, Share2, Sparkles, Trash, Camera } from "lucide-react";
import { createPortal } from "react-dom";

import { useLanguage } from "@/contexts/language-context";

import { EditorCanvas } from "@/components/editor/editor-canvas";
import { persistTemplate } from "@/app/editor/actions";
import { createTemplateSlug } from "@/lib/slug";
import { readFileAsDataUrl, getImageDimensions } from "@/lib/utils/image";
import { exportStageWithTransparentSlots } from "@/lib/utils/stage";
import type { FrameTemplate, ImageElement } from "@/types/frame";
import { useEditorStore } from "@/state/editor-store";

interface EditorViewProps {
  initialTemplate?: FrameTemplate;
}

type SaveState = "idle" | "saving" | "saved" | "error";
type EditorStep = {
  id: string;
  title: string;
  description: string;
  render: () => ReactElement;
};

export const EditorView = ({ initialTemplate }: EditorViewProps) => {
  const { t } = useLanguage();
  const stageRef = useRef<Konva.Stage>(null!);
  const [currentSlug, setCurrentSlug] = useState<string>(() =>
    initialTemplate?.slug ?? "",
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backgroundProcessingId, setBackgroundProcessingId] = useState<
    string | null
  >(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationOverlay, setCelebrationOverlay] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isProcessingClick, setIsProcessingClick] = useState(false);

  // Get canvas selection from store
  const canvasSelection = useEditorStore((state) => state.selection);

  // Sync selectedImageId with canvas selection
  useEffect(() => {
    if (canvasSelection.kind === 'image' && canvasSelection.id) {
      console.log('🎯 Canvas selected image:', canvasSelection.id);
      setSelectedImageId(canvasSelection.id);
    } else if (canvasSelection.kind !== 'image') {
      // If user selected something else (text, sticker) or nothing, clear image selection
      setSelectedImageId(null);
    }
  }, [canvasSelection]);

  const layout = useEditorStore((state) => state.layout);
  const images = useEditorStore((state) => state.images);
  const stickers = useEditorStore((state) => state.stickers);
  const templateName = useEditorStore((state) => state.templateName);
  const templateDescription = useEditorStore(
    (state) => state.templateDescription,
  );
  const setTemplateName = useEditorStore((state) => state.setTemplateName);
  const setTemplateDescription = useEditorStore(
    (state) => state.setTemplateDescription,
  );
  const setFrameOptions = useEditorStore((state) => state.setFrameOptions);
  const setSlotCount = useEditorStore((state) => state.setSlotCount);
  const addImage = useEditorStore((state) => state.addImage);
  const removeImage = useEditorStore((state) => state.removeImage);
  const updateImage = useEditorStore((state) => state.updateImage);
  const addSticker = useEditorStore((state) => state.addSticker);
  const removeSticker = useEditorStore((state) => state.removeSticker);
  const addText = useEditorStore((state) => state.addText);
  const updateTextElement = useEditorStore((state) => state.updateText);
  const removeText = useEditorStore((state) => state.removeText);
  const removeImageBackground = useEditorStore((state) => state.removeImageBackground);
  const setOverlayDataUrl = useEditorStore((state) => state.setOverlayDataUrl);
  const overlayDataUrl = useEditorStore((state) => state.overlayDataUrl);
  const texts = useEditorStore((state) => state.texts);
  const loadTemplate = useEditorStore((state) => state.loadTemplate);
  const reset = useEditorStore((state) => state.reset);

  // Generate slug on client side to avoid hydration mismatch
  useEffect(() => {
    if (!initialTemplate && !currentSlug) {
      setCurrentSlug(createTemplateSlug());
    }
  }, [currentSlug, initialTemplate]);

  useEffect(() => {
    if (initialTemplate) {
      loadTemplate({
        templateName: initialTemplate.name,
        templateDescription: initialTemplate.description,
        layout: initialTemplate.layout,
        images: initialTemplate.images,
        stickers: initialTemplate.stickers,
        texts: initialTemplate.texts ?? [],
        overlayDataUrl: initialTemplate.overlayDataUrl,
      });
      setCurrentSlug(initialTemplate.slug);
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplate?.slug]);

  const slotOptions = useMemo(
    () =>
      layout.slots.map((slot, index) => ({
        id: slot.id,
        label: `${index + 1}${t("editor.shotNumber")}`,
      })),
    [layout.slots, t],
  );

  const renderTemplateInfoStep = () => (
    <div className="space-y-4 text-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          {t("editor.templateInfo")}
        </h2>
        <div className="mt-4 space-y-4">
          <label className="grid gap-1">
            <span className="font-medium text-gray-600">{t("editor.projectName")}</span>
            <input
              type="text"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
            />
          </label>
          <label className="grid gap-1">
            <span className="font-medium text-gray-600">{t("editor.description")}</span>
            <textarea
              value={templateDescription}
              onChange={(event) => setTemplateDescription(event.target.value)}
              rows={3}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
            />
          </label>
        </div>
      </div>
    </div>
  );

  const renderLayoutStep = () => (
    <div className="space-y-4 text-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          {t("editor.layoutFrame")}
        </h2>
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-2">
            <span className="font-medium text-gray-600">{t("editor.cutCount")}</span>
            <select
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
              value={layout.slots.length}
              onChange={(event) => setSlotCount(Number(event.target.value))}
            >
              {[2, 3, 4, 5].map((count) => (
                <option key={count} value={count}>
                  {count}{t("editor.cuts")}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 rounded-2xl bg-slate-50 p-4">
            <label className="flex items-center justify-between text-sm text-gray-600">
              <span>{t("editor.frameColor")}</span>
              <input
                type="color"
                value={layout.frame.color}
                onChange={(event) =>
                  setFrameOptions({ color: event.target.value })
                }
                className="h-8 w-16 cursor-pointer rounded border border-gray-200"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-gray-600">
              <span>{t("editor.backgroundColor")}</span>
              <input
                type="color"
                value={layout.frame.backgroundColor}
                onChange={(event) =>
                  setFrameOptions({ backgroundColor: event.target.value })
                }
                className="h-8 w-16 cursor-pointer rounded border border-gray-200"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-gray-600">
                {t("editor.frameThickness")} ({layout.frame.thickness.toFixed(0)}{t("editor.px")})
              </span>
              <input
                type="range"
                min={8}
                max={80}
                value={layout.frame.thickness}
                onChange={(event) =>
                  setFrameOptions({ thickness: Number(event.target.value) })
                }
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTextStep = () => (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{t("editor.textBox")}</h2>
        <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
          <p className="font-medium text-slate-800">Coming soon!</p>
          <p className="mt-1 text-xs text-gray-500">
            Text creation and editing are temporarily locked while we improve the experience. Existing text layers will still render on the canvas, but changes are disabled for now.
          </p>
        </div>
      </div>
    </div>
  );

  const renderMediaStep = () => (
    <div className="space-y-4 text-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          {t("editor.imagesStickers")}
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed px-3 py-3 text-sm font-medium transition ${
            isUploadingFiles
              ? "border-slate-400 text-slate-400 cursor-not-allowed"
              : "border-gray-300 text-gray-600 hover:border-slate-900 hover:text-slate-900"
          }`}>
            {isUploadingFiles ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading photos...
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4" />
                {t("editor.addPhoto")} (Multiple)
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={isUploadingFiles}
              className="hidden"
              onChange={(event) => handleFileChange(event)}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 px-3 py-3 text-sm font-medium text-gray-500 transition hover:border-slate-900 hover:text-slate-900">
            <Sparkles className="h-4 w-4" />
            {t("editor.uploadSticker")}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => handleFileChange(event, { asSticker: true })}
            />
          </label>
        </div>
        {/* Fixed Remove Background Section - Slim & Fully Clickable */}
        <div
          className="mb-4 rounded-2xl border border-dashed border-purple-300 bg-purple-50 px-3 py-3 text-sm font-medium transition cursor-pointer select-none hover:border-purple-600 hover:bg-purple-100"
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (isProcessingClick) {
              console.log('🚫 Click already in progress, ignoring...');
              return;
            }

            setIsProcessingClick(true);

            console.log('🔧 Remove background clicked!', {
              selectedImageId,
              backgroundProcessingId,
              imagesLength: images.length
            });

            try {
              if (backgroundProcessingId !== null) {
                console.log('❌ Background processing already in progress!');
                return;
              }

              if (images.length === 0) {
                console.log('❌ No images available!');
                return;
              }

              // Auto-select first image if none selected
              let targetImageId = selectedImageId;
              if (!targetImageId) {
                targetImageId = images[0].id;
                console.log('🎯 Auto-selecting first image:', targetImageId);
                setSelectedImageId(targetImageId);
              }

              const selectedImage = images.find(img => img.id === targetImageId);
              console.log('🔍 Found target image:', selectedImage);

              if (selectedImage) {
                console.log('🚀 Calling handleRemoveBackground...');
                await handleRemoveBackground(selectedImage);
              } else {
                console.log('❌ Target image not found in images array!');
              }
            } finally {
              setTimeout(() => setIsProcessingClick(false), 1000);
            }
          }}
        >
          <div className="flex items-center justify-center gap-2">
            {backgroundProcessingId ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                <span className="text-purple-600 font-medium">Removing Background...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-purple-600 font-medium">
                  Remove Background
                </span>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {images.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-gray-500">
              {t("editor.noImagesYet")}
            </p>
          ) : (
            images.map((image, index) => (
              <div
                key={`${image.id}-${index}`}
                className={`rounded-2xl border p-3 text-sm transition ${
                  selectedImageId === image.id
                    ? "border-purple-300 bg-purple-50"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">
                    {t("editor.imageId")} {image.id.slice(0, 4)}
                    {selectedImageId === image.id && (
                      <span className="ml-2 text-xs text-purple-600 font-semibold">SELECTED</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="rounded-full p-1 text-gray-400 hover:bg-slate-100 hover:text-slate-900"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🗑️ Delete button clicked for image:', image.id);
                      removeImage(image.id);
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid gap-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-gray-500">{t("editor.connectedCut")}</span>
                    <select
                      className="rounded-xl border border-gray-200 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
                      value={image.slotId ?? "none"}
                      onChange={(event) =>
                        handleAssignSlot(
                          image,
                          event.target.value === "none"
                            ? null
                            : event.target.value,
                        )
                      }
                    >
                      <option value="none">{t("editor.noConnection")}</option>
                      {slotOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))
          )}
        </div>
        {stickers.length > 0 ? (
          <div className="mt-6 space-y-2 rounded-2xl bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-gray-700">
              {t("editor.stickerLayer")}
            </h3>
            {stickers.map((sticker) => (
              <div
                key={sticker.id}
                className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm"
              >
                <span className="text-gray-600">
                  {sticker.name ?? `Sticker ${sticker.id.slice(0, 4)}`}
                </span>
                <button
                  type="button"
                  className="rounded-full p-1 text-gray-400 transition hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => removeSticker(sticker.id)}
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-600">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </div>
  );

  const steps: EditorStep[] = useMemo(
    () => [
      {
        id: "info",
        title: t("editor.basicInfo"),
        description: t("editor.basicInfoDesc"),
        render: renderTemplateInfoStep,
      },
      {
        id: "layout",
        title: t("editor.frameComposition"),
        description: t("editor.frameCompositionDesc"),
        render: renderLayoutStep,
      },
      {
        id: "text",
        title: t("editor.textLabel"),
        description: t("editor.textDesc"),
        render: renderTextStep,
      },
      {
        id: "media",
        title: t("editor.imagesStickerLabel"),
        description: t("editor.imagesStickerDesc"),
        render: renderMediaStep,
      },
    ],
    [t, renderTemplateInfoStep, renderLayoutStep, renderTextStep, renderMediaStep],
  );

  const handleUploadImage = async (
    file: File,
    options: { assignToSlot?: string | null; asSticker?: boolean },
  ) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const { width, height } = await getImageDimensions(dataUrl);
      const targetSlot = layout.slots.find(
        (slot) => slot.id === options.assignToSlot,
      );
      const slotWidth = targetSlot?.width ?? layout.canvas.width;
      const slotHeight = targetSlot?.height ?? layout.canvas.height;

      const baseScale = Math.min(
        1,
        slotWidth / width,
        slotHeight / height,
      );

      const x = targetSlot
        ? (slotWidth - width * baseScale) / 2
        : (layout.canvas.width - width * baseScale) / 2;
      const y = targetSlot
        ? (slotHeight - height * baseScale) / 2
        : (layout.canvas.height - height * baseScale) / 2;

      if (options.asSticker) {
        const stickerId = addSticker({
          name: file.name ?? "sticker",
          dataUrl,
          x,
          y,
          width,
          height,
          scaleX: baseScale,
          scaleY: baseScale,
          rotation: 0,
        });
        console.log('🐛 [Upload Debug] Added sticker:', stickerId, file.name);
      } else {
        const imageId = addImage({
          dataUrl,
          slotId: options.assignToSlot ?? null,
          x,
          y,
          width,
          height,
          scaleX: baseScale,
          scaleY: baseScale,
          rotation: 0,
          clipToSlot: Boolean(options.assignToSlot),
          backgroundRemoved: false,
        });
        console.log('🐛 [Upload Debug] Added image:', imageId, file.name);
        console.log('🐛 [Upload Debug] Current images count in store:', images.length + 1);

        // Auto-select the newly uploaded image
        console.log('🎯 Auto-selecting uploaded image:', imageId);
        setSelectedImageId(imageId);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(t("error.imageLoadError"));
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    { asSticker = false }: { asSticker?: boolean } = {},
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsUploadingFiles(true);
    setErrorMessage(null);

    try {
      // Process all selected files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file) {
          await handleUploadImage(file, { assignToSlot: null, asSticker });
        }
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      setErrorMessage(t("error.multipleFileUploadError"));
    } finally {
      setIsUploadingFiles(false);
      event.target.value = "";
    }
  };

  const handleAssignSlot = (image: ImageElement, slotId: string | null) => {
    if (!slotId) {
      updateImage(image.id, {
        slotId: null,
        clipToSlot: false,
        x: image.x,
        y: image.y,
      });
      return;
    }

    const slot = layout.slots.find((item) => item.id === slotId);
    if (!slot) {
      return;
    }

    const maxScale = Math.min(
      slot.width / image.width,
      slot.height / image.height,
      1,
    );
    const scale = Math.min(image.scaleX, maxScale);

    updateImage(image.id, {
      slotId,
      clipToSlot: true,
      x: (slot.width - image.width * scale) / 2,
      y: (slot.height - image.height * scale) / 2,
      scaleX: scale,
      scaleY: scale,
    });
  };

  const handleSaveTemplate = async () => {
    // Set loading state immediately when button is clicked
    setSaveState("saving");
    console.log('🐛 [Save Debug] Save state set to "saving"');

    const stage = stageRef.current;
    let nextOverlay = overlayDataUrl;

    // Always regenerate overlay so every saved template reflects the latest arrangement
    if (stage) {
      nextOverlay = exportStageWithTransparentSlots(stage);
      setOverlayDataUrl(nextOverlay);
    }

    try {

      // Debug: Log the images array before saving
      console.log('🐛 [Save Debug] Images being saved:', images.length, images);
      console.log('🐛 [Save Debug] Stickers being saved:', stickers.length, stickers);
      console.log('🐛 [Save Debug] Texts being saved:', texts.length, texts);

      const payload = {
        slug: currentSlug,
        templateName,
        templateDescription,
        layout,
        images,
        stickers,
        texts,
        overlayDataUrl: nextOverlay ?? "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log('🐛 [Save Debug] Full payload:', payload);
      const result = await persistTemplate(payload);
      setCurrentSlug(result.slug);
      setSaveState("saved");

      // Generate celebration overlay and trigger celebration (stay visible until user closes)
      if (nextOverlay) {
        setCelebrationOverlay(nextOverlay);
        setShowCelebration(true);
      }

      setTimeout(() => setSaveState("idle"), 2000);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage(t("error.templateSaveFailed"));
      setSaveState("error");
    }
  };

  const handleRemoveBackground = async (image: ImageElement) => {
    try {
      setBackgroundProcessingId(image.id);
      const success = await removeImageBackground(image.id);

      if (!success) {
        throw new Error(t("error.backgroundRemovalFailed"));
      }

      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage(t("error.backgroundRemovalError"));
    } finally {
      setBackgroundProcessingId(null);
    }
  };

  const relativeShareUrl = `/booth/${currentSlug}`;
  const [shareUrl, setShareUrl] = useState(relativeShareUrl);

  useEffect(() => {
    setShareUrl(
      typeof window !== "undefined"
        ? `${window.location.origin}/booth/${currentSlug}`
        : relativeShareUrl,
    );
  }, [currentSlug, relativeShareUrl]);

  // Portal loading spinner component
  const LoadingSpinner = () => {
    if (typeof window === 'undefined' || saveState !== "saving") return null;

    return createPortal(
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 999999,
          pointerEvents: 'auto'
        }}
      >
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Cool loading spinner with multiple rings */}
          <div className="relative">
            {/* Outer ring */}
            <div className="w-24 h-24 border-4 border-white/20 rounded-full animate-spin border-t-white"></div>
            {/* Middle ring */}
            <div className="absolute inset-2 w-20 h-20 border-4 border-blue-400/30 rounded-full border-t-blue-400" style={{animation: 'spin 1s linear infinite reverse'}}></div>
            {/* Inner ring */}
            <div className="absolute inset-4 w-16 h-16 border-4 border-purple-400/30 rounded-full animate-spin border-t-purple-400"></div>
            {/* Center dot */}
            <div className="absolute inset-8 w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-pulse"></div>
          </div>

          {/* Loading text with animation */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Saving your photoframe</h2>
            <div className="flex items-center justify-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      <LoadingSpinner />
      <div className="mx-auto flex w-full max-w-6xl items-stretch gap-6 p-4">
      <div className="flex h-[calc(100vh-120px)] w-[320px] flex-col rounded-2xl bg-white shadow-sm border border-gray-100">
        {/* Clean Tab Navigation */}
        <div className="flex p-1 bg-gray-50 rounded-2xl m-3">
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            return (
              <button
                type="button"
                key={step.id}
                onClick={() => setCurrentStepIndex(index)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-xl transition-all ${
                  isActive
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {step.title}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 px-4 pb-4 overflow-y-auto">
          {steps[currentStepIndex].render()}
        </div>

        {/* Action Buttons */}
        <div className="px-4 pb-4 mt-4 grid gap-3">
          <button
            type="button"
            onClick={handleSaveTemplate}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {saveState === "saving" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("editor.saving")}
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                {t("editor.saveAndShare")}
              </>
            )}
          </button>
          {saveState === "saved" ? (
            <p className="text-center text-sm text-emerald-600">
              {t("editor.saveCompleted")}
            </p>
          ) : null}
          <div className="rounded-2xl bg-slate-50 p-3 text-xs text-gray-600">
            <p>
              {t("editor.shareLink")}{" "}
              <Link
                href={relativeShareUrl}
                className="font-medium text-slate-900 underline"
              >
                {shareUrl}
              </Link>
            </p>
            <p className="mt-1">{t("editor.supabaseNote")}</p>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex flex-1 flex-col gap-4">
        <div className="flex min-h-[calc(100vh-120px)] items-center justify-center rounded-3xl bg-white p-4 shadow-sm overflow-hidden">
          <EditorCanvas stageRef={stageRef} />
        </div>
      </div>
      </div>

      {/* Celebration popup with falling emojis */}
      {showCelebration && (
        <CelebrationOverlay
          overlayImage={celebrationOverlay}
          templateSlug={currentSlug}
          shareUrl={shareUrl}
          onClose={() => {
            setShowCelebration(false);
            setCelebrationOverlay(null);
          }}
        />
      )}
    </>
  );
};

// Falling Emojis Component
const FallingEmojis = () => {
  const [emojis, setEmojis] = useState<Array<{
    id: string;
    emoji: string;
    left: number;
    animationDelay: number;
    animationDuration: number;
  }>>([]);

  const positiveEmojis = ['🎉', '✨', '🎊', '🥳', '🎈', '🌟', '💫', '🎆', '🎇', '🏆', '👏', '🙌', '💖', '😍', '😊', '🤩', '🔥', '🚀', '🌈', '🦄'];

  useEffect(() => {
    // Continue generating emojis forever until component unmounts
    const interval = setInterval(() => {
      setEmojis(prev => {
        // Keep only recent emojis to prevent memory issues
        const recentEmojis = prev.slice(-40);
        return [
          ...recentEmojis,
          {
            id: `emoji-${Date.now()}-${Math.random()}`,
            emoji: positiveEmojis[Math.floor(Math.random() * positiveEmojis.length)],
            left: Math.random() * 100,
            animationDelay: 0,
            animationDuration: 3000 + Math.random() * 2000,
          }
        ];
      });
    }, 300);

    return () => {
      clearInterval(interval);
    };
  }, [positiveEmojis]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[300] overflow-hidden">
      {emojis.map((emoji) => (
        <div
          key={emoji.id}
          className="absolute text-3xl select-none"
          style={{
            left: `${emoji.left}%`,
            top: '-50px',
            animationName: 'fall',
            animationDuration: `${emoji.animationDuration}ms`,
            animationDelay: `${emoji.animationDelay}ms`,
            animationTimingFunction: 'ease-in',
            animationFillMode: 'forwards',
          }}
        >
          {emoji.emoji}
        </div>
      ))}
      <style jsx>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

// Celebration Overlay Component
interface CelebrationOverlayProps {
  overlayImage: string | null;
  templateSlug: string;
  shareUrl: string;
  onClose: () => void;
}

const CelebrationOverlay = ({ overlayImage, templateSlug, shareUrl, onClose }: CelebrationOverlayProps) => {
  const [showPresent, setShowPresent] = useState(false);
  const [copied, setCopied] = useState(false);

  // Trigger present animation after component mounts
  useEffect(() => {
    const timer = setTimeout(() => setShowPresent(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center">
      {/* Dimmed background */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Falling emojis */}
      <FallingEmojis />

      {/* Present popup */}
      <div
        className={`relative z-10 transform transition-all duration-700 ${
          showPresent ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
      >
        <div className="bg-white rounded-2xl p-4 shadow-2xl max-w-sm mx-4 text-center border-2 border-yellow-400">
          {/* Present emoji and title */}
          <div className="text-4xl mb-2">🎁</div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Congratulations!</h2>
          <p className="text-slate-600 mb-3 text-sm">Your photoframe is ready!</p>

          {/* Photoframe preview */}
          {overlayImage && (
            <div className="mb-3">
              <div
                className={`transform transition-all duration-1000 delay-300 ${
                  showPresent ? 'scale-100 opacity-100 rotate-0' : 'scale-75 opacity-0 rotate-12'
                }`}
              >
                <img
                  src={overlayImage}
                  alt="Your photoframe"
                  className="w-full max-w-40 mx-auto rounded-lg shadow-lg border-2 border-white"
                  style={{
                    filter: 'drop-shadow(0 5px 15px rgba(0,0,0,0.2))'
                  }}
                />
              </div>
            </div>
          )}

          {/* Direct share link */}
          <div className="mb-3 rounded-lg border border-dashed border-yellow-300 bg-yellow-50 p-3 text-left">
            <p className="text-xs font-semibold text-yellow-900">Photoframe Link</p>
            <p className="mt-1 text-xs text-yellow-800 break-all line-clamp-2">{shareUrl}</p>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 rounded-md bg-yellow-400/80 px-2 py-1 text-xs font-semibold text-yellow-900 transition hover:bg-yellow-400"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <Link
              href={shareUrl || `/booth/${templateSlug}`}
              className="w-full bg-emerald-600 text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-all transform hover:scale-105 inline-flex items-center justify-center gap-2"
            >
              <Camera className="h-4 w-4" />
              Let's take photos right now!
            </Link>

            <button
              onClick={onClose}
              className="w-full bg-gray-200 text-slate-700 py-2 px-4 rounded-lg text-xs font-medium hover:bg-gray-300 transition-all"
            >
              Continue Editing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
