/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AlertTriangle,
  Camera,
  Download,
  Loader2,
  RotateCcw,
} from "lucide-react";

import type { FrameSlot, FrameTemplate } from "@/types/frame";

interface BoothViewProps {
  template: FrameTemplate;
}

type BoothStatus =
  | "idle"
  | "countdown"
  | "capturing"
  | "waiting"
  | "processing"
  | "finished";

const COUNTDOWN_START = 3;
const BETWEEN_SHOTS_DELAY = 5000;

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = src;
  });

export const BoothView = ({ template }: BoothViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<BoothStatus>("idle");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [slotShots, setSlotShots] = useState<string[]>(
    Array(template.layout.slots.length).fill(""),
  );
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [currentOverlayIndex, setCurrentOverlayIndex] = useState(0);

  const overlayUrl = template.overlayDataUrl;
  const initializeCamera = useCallback(async () => {
    if (isRequestingCamera) {
      return streamRef.current !== null;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStreamError("현재 브라우저에서는 카메라를 지원하지 않습니다.");
      return false;
    }

    setStreamError(null);
    setIsRequestingCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: template.layout.canvas.width,
          height: template.layout.canvas.height,
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (error) {
          console.warn("비디오 재생에 실패했습니다.", error);
        }
      }

      setHasCameraAccess(true);
      setStatus("idle");
      return true;
    } catch (error) {
      console.error(error);
      let message =
        "카메라 접근 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.";

      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError" || error.name === "SecurityError") {
          message =
            "카메라 권한이 차단되어 있습니다. 주소창 근처의 카메라 아이콘을 눌러 허용으로 변경해주세요.";
        } else if (error.name === "NotFoundError") {
          message = "사용 가능한 카메라 장치를 찾지 못했습니다.";
        } else if (error.name === "NotReadableError") {
          message = "다른 애플리케이션이 카메라를 사용 중입니다. 종료 후 다시 시도해주세요.";
        }
      }

      setStreamError(message);
      setHasCameraAccess(false);
      streamRef.current = null;
      return false;
    } finally {
      setIsRequestingCamera(false);
    }
  }, [
    isRequestingCamera,
    template.layout.canvas.height,
    template.layout.canvas.width,
  ]);
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const slots = useMemo(() => template.layout.slots, [template.layout.slots]);

  const drawVideoFrame = (slot?: FrameSlot) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return null;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    const { width: canvasWidth, height: canvasHeight } = template.layout.canvas;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const videoWidth = video.videoWidth || canvasWidth;
    const videoHeight = video.videoHeight || canvasHeight;
    const videoRatio = videoWidth / videoHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let drawWidth = canvasWidth;
    let drawHeight = canvasHeight;
    if (videoRatio > canvasRatio) {
      drawHeight = canvasHeight;
      drawWidth = videoRatio * drawHeight;
    } else {
      drawWidth = canvasWidth;
      drawHeight = drawWidth / videoRatio;
    }
    const dx = (canvasWidth - drawWidth) / 2;
    const dy = (canvasHeight - drawHeight) / 2;

    ctx.save();
    ctx.fillStyle = template.layout.frame.backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(video, dx, dy, drawWidth, drawHeight);
    ctx.restore();

    if (slot) {
      const slotCanvas = document.createElement("canvas");
      slotCanvas.width = slot.width;
      slotCanvas.height = slot.height;
      const slotCtx = slotCanvas.getContext("2d");
      if (!slotCtx) {
        return null;
      }
      slotCtx.drawImage(
        canvas,
        slot.x,
        slot.y,
        slot.width,
        slot.height,
        0,
        0,
        slot.width,
        slot.height,
      );
      return slotCanvas.toDataURL("image/png");
    }

    return canvas.toDataURL("image/png");
  };

  const runCountdown = async () => {
    setStatus("countdown");
    for (let value = COUNTDOWN_START; value >= 1; value -= 1) {
      setCountdown(value);
      // biome-ignore lint/suspicious/noAwaitInLoop: countdown needs step delay
      await delay(1000);
    }
    setCountdown(null);
  };

  const captureSequence = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setStreamError("카메라 초기화가 완료되지 않았습니다.");
      return;
    }

    setSlotShots(Array(slots.length).fill(""));
    setFinalImage(null);

    for (let index = 0; index < slots.length; index += 1) {
      setCurrentShotIndex(index);
      setCurrentOverlayIndex(index);
      await runCountdown();
      setStatus("capturing");

      const slot = slots[index];
      const slotCapture = drawVideoFrame(slot);
      if (!slotCapture) {
        setStreamError("캡처에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      setSlotShots((prev) => {
        const next = [...prev];
        next[index] = slotCapture;
        return next;
      });

      if (index < slots.length - 1) {
        setStatus("waiting");
        // biome-ignore lint/suspicious/noAwaitInLoop: sequential delay between shots is required
        await delay(BETWEEN_SHOTS_DELAY);
      }
    }

    setStatus("processing");
    await composeFinalImage();
  };

  const composeFinalImage = async () => {
    setIsComposing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = template.layout.canvas.width;
      canvas.height = template.layout.canvas.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("캔버스를 초기화하지 못했습니다.");
      }

      ctx.fillStyle = template.layout.frame.backgroundColor;
      ctx.fillRect(
        0,
        0,
        template.layout.canvas.width,
        template.layout.canvas.height,
      );

      await Promise.all(
        slots.map(async (slot, index) => {
          const capture = slotShots[index];
          if (!capture) {
            return;
          }
          const image = await loadImage(capture);
          ctx.drawImage(
            image,
            0,
            0,
            image.width,
            image.height,
            slot.x,
            slot.y,
            slot.width,
            slot.height,
          );
        }),
      );

      if (overlayUrl) {
        const overlay = await loadImage(overlayUrl);
        ctx.drawImage(
          overlay,
          0,
          0,
          overlay.width,
          overlay.height,
          0,
          0,
          template.layout.canvas.width,
          template.layout.canvas.height,
        );
      }

      const final = canvas.toDataURL("image/png");
      setFinalImage(final);
      setStatus("finished");
    } catch (error) {
      console.error(error);
      setStreamError("결과물을 합성하는 중 오류가 발생했습니다.");
    } finally {
      setIsComposing(false);
    }
  };

  const handleStart = async () => {
    if (status === "countdown" || status === "capturing" || isRequestingCamera) {
      return;
    }
    setStreamError(null);
    if (!hasCameraAccess || !streamRef.current) {
      const granted = await initializeCamera();
      if (!granted) {
        return;
      }
    }

    if (!videoRef.current || !canvasRef.current) {
      setStreamError("카메라 초기화가 완료되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    await captureSequence();
  };

  const handleDownload = () => {
    if (!finalImage) {
      return;
    }
    const link = document.createElement("a");
    link.href = finalImage;
    link.download = `party-frame-${template.slug}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setSlotShots(Array(slots.length).fill(""));
    setFinalImage(null);
    setStatus("idle");
    setCountdown(null);
    setStreamError(null);
    setCurrentShotIndex(0);
    setCurrentOverlayIndex(0);
  };

  useEffect(() => {
    if (status === "finished") {
      setCurrentOverlayIndex(slots.length - 1);
    }
  }, [slots.length, status]);

  const statusLabel = (() => {
    switch (status) {
      case "countdown":
        return "카운트다운 중...";
      case "capturing":
        return "촬영 중입니다!";
      case "waiting":
        return "다음 컷까지 잠시 대기해주세요.";
      case "processing":
        return "결과물 합성 중...";
      case "finished":
        return "촬영이 완료되었습니다!";
      default:
        return hasCameraAccess
          ? "준비가 되면 아래 버튼을 눌러 촬영을 시작하세요."
          : "촬영 전에 카메라 권한 요청 버튼을 눌러 허용해주세요.";
    }
  })();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-3xl bg-black relative overflow-hidden shadow-xl">
        <div className="relative aspect-[9/16] w-full">
          {/** Camera feed */}
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            muted
          />
          {/** Permission overlay */}
          {!hasCameraAccess ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center text-white">
              <p className="text-sm leading-relaxed text-slate-200">
                카메라 권한이 필요합니다. 아래 버튼을 눌러 브라우저 권한 요청을 허용해주세요.
              </p>
              <button
                type="button"
                onClick={initializeCamera}
                disabled={isRequestingCamera}
                className="flex items-center justify-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/60"
              >
                {isRequestingCamera ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    요청 중...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    카메라 권한 요청
                  </>
                )}
              </button>
            </div>
          ) : null}
          {/** Slot guide instead of full overlay while capturing */}
          {hasCameraAccess &&
          !finalImage &&
          status !== "processing" &&
          status !== "finished" ? (
            (() => {
              const slot = slots[currentOverlayIndex] ?? slots[0];
              if (!slot) {
                return null;
              }
              const canvas = template.layout.canvas;
              const slotStyle: CSSProperties = {
                left: `${(slot.x / canvas.width) * 100}%`,
                top: `${(slot.y / canvas.height) * 100}%`,
                width: `${(slot.width / canvas.width) * 100}%`,
                height: `${(slot.height / canvas.height) * 100}%`,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
                borderRadius: `${(template.layout.frame.cornerRadius / canvas.width) * 100}%`,
              };
              return (
                <div className="pointer-events-none absolute inset-0 z-10">
                  <div
                    className="absolute border-2 border-white/90 shadow-[0_0_30px_rgba(0,0,0,0.35)] transition-all"
                    style={slotStyle}
                  />
                </div>
              );
            })()
          ) : null}
          {/** Final overlay shown after capture */}
          {overlayUrl && (status === "finished" || !!finalImage) ? (
            <img
              src={overlayUrl}
              alt="프레임 오버레이"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
          ) : null}
          {countdown ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="text-6xl font-bold text-white">{countdown}</span>
            </div>
          ) : null}
        </div>
        <div className="border-t border-white/10 bg-black/60 p-4 text-center text-white text-sm">
          {statusLabel}
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {template.name}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            총 {slots.length}컷을 자동으로 촬영합니다. 촬영 간격은 기본 5초입니다.
          </p>
        </div>

        {streamError ? (
          <div className="flex items-start gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span>{streamError}</span>
          </div>
        ) : null}

        <div className="grid gap-2">
          {!hasCameraAccess ? (
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
              onClick={initializeCamera}
              disabled={isRequestingCamera}
            >
              {isRequestingCamera ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  권한 요청 중...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  카메라 권한 요청
                </>
              )}
            </button>
          ) : null}
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            onClick={handleStart}
            disabled={
              Boolean(streamError) || status === "countdown" || !hasCameraAccess
            }
          >
            {status === "countdown" || status === "capturing" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                촬영 중...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                촬영 시작하기
              </>
            )}
          </button>
          {status === "finished" ? (
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-900 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              결과물 다운로드 (PNG)
            </button>
          ) : null}
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-500 transition hover:border-slate-900 hover:text-slate-900"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4" />
            다시 준비하기
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700">
            촬영 결과 미리보기
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {slotShots.map((shot, index) => {
              const isActive =
                status !== "finished" && index === currentShotIndex;
              return (
                <div
                  key={slots[index]?.id ?? index}
                  className={`relative overflow-hidden rounded-xl border bg-slate-50 ${
                    isActive ? "border-slate-900" : "border-slate-200"
                  }`}
                >
                  {shot ? (
                    <img
                      src={shot}
                      alt={`컷 ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center text-xs text-slate-400">
                      {index + 1}컷 대기중
                    </div>
                  )}
                  {isActive ? (
                    <div className="absolute inset-0 border-2 border-dashed border-white" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {isComposing ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            결과물을 합성하고 있습니다...
          </div>
        ) : null}

        {finalImage ? (
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              최종 결과물
            </h3>
            <img
              src={finalImage}
              alt="최종 결과물"
              className="mt-2 w-full rounded-2xl border border-slate-200"
            />
          </div>
        ) : null}
      </div>

      <canvas
        ref={canvasRef}
        className="hidden"
        width={template.layout.canvas.width}
        height={template.layout.canvas.height}
      />
    </div>
  );
};
