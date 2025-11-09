/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type Konva from "konva";
import { Download, ImageIcon, Loader2, Share2, Sparkles, Trash } from "lucide-react";

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
  render: () => JSX.Element;
};

export const EditorView = ({ initialTemplate }: EditorViewProps) => {
  const stageRef = useRef<Konva.Stage>(null);
  const [currentSlug, setCurrentSlug] = useState<string>(() =>
    initialTemplate?.slug ?? createTemplateSlug(),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backgroundProcessingId, setBackgroundProcessingId] = useState<
    string | null
  >(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

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
  const setBottomText = useEditorStore((state) => state.setBottomText);
  const setSlotCount = useEditorStore((state) => state.setSlotCount);
  const addImage = useEditorStore((state) => state.addImage);
  const removeImage = useEditorStore((state) => state.removeImage);
  const updateImage = useEditorStore((state) => state.updateImage);
  const addSticker = useEditorStore((state) => state.addSticker);
  const removeSticker = useEditorStore((state) => state.removeSticker);
  const addText = useEditorStore((state) => state.addText);
  const updateTextElement = useEditorStore((state) => state.updateText);
  const removeText = useEditorStore((state) => state.removeText);
  const setOverlayDataUrl = useEditorStore((state) => state.setOverlayDataUrl);
  const overlayDataUrl = useEditorStore((state) => state.overlayDataUrl);
  const texts = useEditorStore((state) => state.texts);
  const loadTemplate = useEditorStore((state) => state.loadTemplate);
  const reset = useEditorStore((state) => state.reset);

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
      setCurrentSlug(createTemplateSlug());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplate?.slug]);

  const slotOptions = useMemo(
    () =>
      layout.slots.map((slot, index) => ({
        id: slot.id,
        label: `${index + 1}번 컷`,
      })),
    [layout.slots],
  );

  const renderTemplateInfoStep = () => (
    <div className="space-y-4 text-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          템플릿 정보
        </h2>
        <div className="mt-4 space-y-4">
          <label className="grid gap-1">
            <span className="font-medium text-gray-600">프로젝트 이름</span>
            <input
              type="text"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
            />
          </label>
          <label className="grid gap-1">
            <span className="font-medium text-gray-600">설명 (선택)</span>
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
          레이아웃 & 프레임
        </h2>
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-2">
            <span className="font-medium text-gray-600">컷 수</span>
            <select
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
              value={layout.slots.length}
              onChange={(event) => setSlotCount(Number(event.target.value))}
            >
              {[2, 3, 4, 5].map((count) => (
                <option key={count} value={count}>
                  {count} 컷
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 rounded-2xl bg-slate-50 p-4">
            <label className="flex items-center justify-between text-sm text-gray-600">
              <span>프레임 컬러</span>
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
              <span>배경 컬러</span>
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
                프레임 두께 ({layout.frame.thickness.toFixed(0)} px)
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
        <h2 className="text-base font-semibold text-slate-900">하단 문구</h2>
        <div className="mt-4 space-y-3">
          <label className="grid gap-1">
            <span className="font-medium text-gray-600">문구</span>
            <input
              type="text"
              value={layout.bottomText.content}
              onChange={(event) =>
                setBottomText({ content: event.target.value })
              }
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-gray-600">
            <span>텍스트 컬러</span>
            <input
              type="color"
              value={layout.bottomText.color}
              onChange={(event) =>
                setBottomText({ color: event.target.value })
              }
              className="h-8 w-16 cursor-pointer rounded border border-gray-200"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-gray-600">
              폰트 크기 ({layout.bottomText.fontSize.toFixed(0)} px)
            </span>
            <input
              type="range"
              min={24}
              max={96}
              value={layout.bottomText.fontSize}
              onChange={(event) =>
                setBottomText({ fontSize: Number(event.target.value) })
              }
            />
          </label>
        </div>
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-900">텍스트 상자</h2>
        <div className="mt-3 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => addText()}
            className="rounded-2xl border border-dashed border-gray-300 px-3 py-3 text-sm font-medium text-gray-600 transition hover:border-slate-900 hover:text-slate-900"
          >
            텍스트 추가
          </button>
          {texts.length === 0 ? (
            <p className="text-xs text-gray-500">
              텍스트 상자를 추가하면 자유롭게 문구를 배치할 수 있습니다.
            </p>
          ) : null}
          {texts.map((text) => (
            <div
              key={text.id}
              className="rounded-2xl border border-slate-200 p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">
                  텍스트 #{text.id.slice(-4)}
                </span>
                <button
                  type="button"
                  onClick={() => removeText(text.id)}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                >
                  삭제
                </button>
              </div>
              <label className="mt-2 grid gap-1 text-xs">
                <span className="font-medium text-gray-600">문구</span>
                <input
                  type="text"
                  value={text.content}
                  onChange={(event) =>
                    updateTextElement(text.id, {
                      content: event.target.value,
                    })
                  }
                  className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
                />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-gray-600">
                <label className="grid gap-1">
                  <span>글자 색상</span>
                  <input
                    type="color"
                    value={text.color}
                    onChange={(event) =>
                      updateTextElement(text.id, {
                        color: event.target.value,
                      })
                    }
                    className="h-8 w-full cursor-pointer rounded border border-gray-200"
                  />
                </label>
                <label className="grid gap-1">
                  <span>폰트 크기 ({text.fontSize.toFixed(0)} px)</span>
                  <input
                    type="range"
                    min={12}
                    max={120}
                    value={text.fontSize}
                    onChange={(event) =>
                      updateTextElement(text.id, {
                        fontSize: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label className="mt-2 grid gap-1 text-xs text-gray-600">
                <span>정렬</span>
                <select
                  value={text.align}
                  onChange={(event) =>
                    updateTextElement(text.id, {
                      align: event.target.value as typeof text.align,
                    })
                  }
                  className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
                >
                  <option value="left">왼쪽</option>
                  <option value="center">가운데</option>
                  <option value="right">오른쪽</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMediaStep = () => (
    <div className="space-y-4 text-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          이미지 & 스티커
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 px-3 py-3 text-sm font-medium text-gray-600 transition hover:border-slate-900 hover:text-slate-900">
            <ImageIcon className="h-4 w-4" />
            사진 추가
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleFileChange(event)}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 px-3 py-3 text-sm font-medium text-gray-500 transition hover:border-slate-900 hover:text-slate-900">
            <Sparkles className="h-4 w-4" />
            스티커 업로드
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleFileChange(event, { asSticker: true })}
            />
          </label>
        </div>
        <div className="mt-4 space-y-3">
          {images.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-gray-500">
              아직 추가된 이미지가 없습니다. 위 버튼을 눌러 업로드해보세요.
            </p>
          ) : (
            images.map((image) => (
              <div
                key={image.id}
                className="rounded-2xl border border-gray-200 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">
                    이미지 {image.id.slice(0, 4)}
                  </span>
                  <button
                    type="button"
                    className="rounded-full p-1 text-gray-400 hover:bg-slate-100 hover:text-slate-900"
                    onClick={() => removeImage(image.id)}
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid gap-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-gray-500">연결된 컷</span>
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
                      <option value="none">연결 안함</option>
                      {slotOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    onClick={() => handleRemoveBackground(image)}
                    disabled={backgroundProcessingId === image.id}
                  >
                    {backgroundProcessingId === image.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        배경 제거 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        배경 제거
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {stickers.length > 0 ? (
          <div className="mt-6 space-y-2 rounded-2xl bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-gray-700">
              스티커 레이어
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

  const steps: EditorStep[] = [
    {
      id: "info",
      title: "기본 정보",
      description: "프로젝트 이름과 설명",
      render: renderTemplateInfoStep,
    },
    {
      id: "layout",
      title: "프레임 구성",
      description: "컷 수와 색상, 두께 설정",
      render: renderLayoutStep,
    },
    {
      id: "text",
      title: "텍스트",
      description: "하단 문구와 텍스트 상자",
      render: renderTextStep,
    },
    {
      id: "media",
      title: "이미지 & 스티커",
      description: "사진 업로드와 배경제거",
      render: renderMediaStep,
    },
  ];

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
        addSticker({
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
      } else {
        addImage({
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
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("이미지를 불러오는 중 오류가 발생했습니다.");
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    { asSticker = false }: { asSticker?: boolean } = {},
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await handleUploadImage(file, { assignToSlot: null, asSticker });
    event.target.value = "";
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

  const handleGenerateOverlay = async () => {
    const stage = stageRef.current;
    if (!stage) {
      setErrorMessage("캔버스를 찾을 수 없습니다.");
      return;
    }
    const dataUrl = exportStageWithTransparentSlots(stage);
    setOverlayDataUrl(dataUrl);
    setErrorMessage(null);
  };

  const handleSaveTemplate = async () => {
    const stage = stageRef.current;
    let nextOverlay = overlayDataUrl;
    if (!nextOverlay && stage) {
      nextOverlay = exportStageWithTransparentSlots(stage);
      setOverlayDataUrl(nextOverlay);
    }

    try {
      setSaveState("saving");
      const payload = {
        slug: currentSlug,
        templateName,
        templateDescription,
        layout,
        images,
        stickers,
        texts,
        overlayDataUrl:
          nextOverlay ??
          (stage ? exportStageWithTransparentSlots(stage) : ""),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = await persistTemplate(payload);
      setCurrentSlug(result.slug);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("템플릿 저장에 실패했습니다. Supabase 설정을 확인해주세요.");
      setSaveState("error");
    }
  };

  const handleRemoveBackground = async (image: ImageElement) => {
    try {
      setBackgroundProcessingId(image.id);
      const response = await fetch("/api/remove-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: image.dataUrl }),
      });

      if (!response.ok) {
        const message = await response
          .json()
          .catch(() => ({ error: "배경제거에 실패했습니다." }));
        throw new Error(message.error ?? "배경제거에 실패했습니다.");
      }

      const data = (await response.json()) as { imageBase64: string };
      updateImage(image.id, {
        dataUrl: data.imageBase64,
        backgroundRemoved: true,
      });
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "배경 제거에 실패했습니다. REMOVE_BG_API_KEY 환경 변수를 확인해주세요.",
      );
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

  return (
    <div className="mx-auto flex w-full max-w-6xl items-stretch gap-6 p-4">
      <div className="flex h-[calc(100vh-120px)] w-[320px] flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          <div className="flex flex-wrap gap-2">
            {steps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              return (
                <button
                  type="button"
                  key={step.id}
                  onClick={() => setCurrentStepIndex(index)}
                  className={`flex flex-1 min-w-[120px] flex-col rounded-2xl border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-slate-900 bg-slate-900/5"
                      : isCompleted
                        ? "border-emerald-500/40 bg-emerald-50"
                        : "border-slate-200 hover:border-slate-900/60"
                  }`}
                >
                  <span className="text-[11px] font-semibold text-slate-500">
                    STEP {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {step.title}
                  </span>
                  <span className="text-xs text-slate-500">
                    {step.description}
                  </span>
                </button>
              );
            })}
          </div>
          <div>{steps[currentStepIndex].render()}</div>
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() =>
                setCurrentStepIndex((prev) => Math.max(0, prev - 1))
              }
              disabled={currentStepIndex === 0}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition enabled:hover:border-slate-900 enabled:hover:text-slate-900 disabled:opacity-50"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentStepIndex((prev) =>
                  Math.min(steps.length - 1, prev + 1),
                )
              }
              disabled={currentStepIndex === steps.length - 1}
              className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {currentStepIndex === steps.length - 1 ? "완료됨" : "다음"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <button
            type="button"
            onClick={handleGenerateOverlay}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
          >
            <Download className="h-4 w-4" />
            미리보기 이미지 갱신
          </button>
          <button
            type="button"
            onClick={handleSaveTemplate}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {saveState === "saving" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                저장 & 공유 링크 만들기
              </>
            )}
          </button>
          {saveState === "saved" ? (
            <p className="text-center text-sm text-emerald-600">
              저장이 완료되었습니다. 공유 링크를 확인하세요!
            </p>
          ) : null}
          <div className="rounded-2xl bg-slate-50 p-3 text-xs text-gray-600">
            <p>
              공유 링크:{" "}
              <Link
                href={relativeShareUrl}
                className="font-medium text-slate-900 underline"
              >
                {shareUrl}
              </Link>
            </p>
            <p className="mt-1">Supabase 미설정 시 .dist/templates 에 저장됩니다.</p>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex flex-1 flex-col gap-4">
        <div className="flex min-h-[calc(100vh-120px)] items-center justify-center rounded-3xl bg-white p-4 shadow-sm overflow-hidden">
          <EditorCanvas stageRef={stageRef} />
        </div>
        {overlayDataUrl ? (
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h3 className="text-sm font-semibold text-gray-700">
              프레임 미리보기 (PNG)
            </h3>
            <img
              src={overlayDataUrl}
              alt="프레임 미리보기"
              className="mt-3 w-full rounded-2xl border border-gray-200"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
