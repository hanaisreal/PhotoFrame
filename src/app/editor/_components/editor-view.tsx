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
  const setOverlayDataUrl = useEditorStore((state) => state.setOverlayDataUrl);
  const overlayDataUrl = useEditorStore((state) => state.overlayDataUrl);
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

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/booth/${currentSlug}`
      : `/booth/${currentSlug}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div>
          <h2 className="text-lg font-semibold">템플릿 정보</h2>
          <div className="mt-4 space-y-4 text-sm">
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
                onChange={(event) =>
                  setTemplateDescription(event.target.value)
                }
                rows={3}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
              />
            </label>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">레이아웃</h2>
          <div className="mt-4 space-y-3 text-sm">
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

        <div>
          <h2 className="text-lg font-semibold">하단 문구</h2>
          <div className="mt-4 space-y-3 text-sm">
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
          <h2 className="text-lg font-semibold">이미지 & 스티커</h2>
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
        </div>

        {errorMessage ? (
          <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-600">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-3">
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
                href={shareUrl}
                className="font-medium text-slate-900 underline"
              >
                {shareUrl}
              </Link>
            </p>
            <p className="mt-1">Supabase 미설정 시 .dist/templates 에 저장됩니다.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <EditorCanvas stageRef={stageRef} />
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
