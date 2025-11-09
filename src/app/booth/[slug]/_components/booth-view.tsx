/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Camera,
  Check,
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
  | "arranging"
  | "finished";

type BoothStage = "capture" | "arrange";

const COUNTDOWN_START = 3;
const BETWEEN_SHOTS_DELAY = 5000;
const DEFAULT_CAPTURE_COUNT = 4;
const DEFAULT_VIDEO_RATIO = 16 / 9;

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

  const captureCount = useMemo(
    () => Math.max(template.layout.slots.length, DEFAULT_CAPTURE_COUNT),
    [template.layout.slots.length],
  );

  const [stage, setStage] = useState<BoothStage>("capture");
  const [status, setStatus] = useState<BoothStatus>("idle");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [capturedShots, setCapturedShots] = useState<string[]>(
    Array(captureCount).fill(""),
  );
  const [slotAssignments, setSlotAssignments] = useState<Record<string, number | null>>({});
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [arrangementError, setArrangementError] = useState<string | null>(null);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState(DEFAULT_VIDEO_RATIO);
  const [isVideoReady, setIsVideoReady] = useState(false);

  const overlayUrl = template.overlayDataUrl;
  const slots = useMemo(() => template.layout.slots, [template.layout.slots]);
  const resetSessionState = useCallback(() => {
    setCapturedShots(Array(captureCount).fill(""));
    setSlotAssignments(
      slots.reduce<Record<string, number | null>>((acc, slot) => {
        acc[slot.id] = null;
        return acc;
      }, {}),
    );
    setStage("capture");
    setStatus("idle");
    setCountdown(null);
    setStreamError(null);
    setFinalImage(null);
    setIsComposing(false);
    setArrangementError(null);
    setCurrentShotIndex(0);
    setActiveSlotId(slots[0]?.id ?? null);
    setIsVideoReady(false);
  }, [captureCount, slots]);

  useEffect(() => {
    resetSessionState();
  }, [resetSessionState, template.slug]);

  useEffect(() => {
    if (stage === "arrange") {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setHasCameraAccess(false);
      setIsVideoReady(false);
    }
  }, [stage]);

  const ensureVideoPlaying = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      return false;
    }
    const attemptPlay = async () => {
      try {
        const playResult = video.play();
        if (playResult !== undefined) {
          await playResult;
        }
        setIsVideoReady(true);
        return true;
      } catch (error) {
        console.warn("비디오 재생을 시작할 수 없습니다.", error);
        setIsVideoReady(false);
        return false;
      }
    };

    if (video.readyState >= 2) {
      return attemptPlay();
    }

    return new Promise<boolean>((resolve) => {
      const handleReady = async () => {
        cleanup();
        resolve(await attemptPlay());
      };
      const handleError = () => {
        cleanup();
        setIsVideoReady(false);
        resolve(false);
      };
      const cleanup = () => {
        video.removeEventListener("loadeddata", handleReady);
        video.removeEventListener("loadedmetadata", handleReady);
        video.removeEventListener("canplay", handleReady);
        video.removeEventListener("error", handleError);
      };
      video.addEventListener("loadeddata", handleReady, { once: true });
      video.addEventListener("loadedmetadata", handleReady, { once: true });
      video.addEventListener("canplay", handleReady, { once: true });
      video.addEventListener("error", handleError, { once: true });
    });
  }, []);

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
    setIsVideoReady(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 16 / 9 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();
      if (settings?.width && settings?.height) {
        setVideoAspectRatio(settings.width / settings.height);
      }
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.autoplay = true;
        videoRef.current.playsInline = true;
        videoRef.current.setAttribute("muted", "true");
        videoRef.current.setAttribute("autoplay", "true");
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("webkit-playsinline", "true");
        videoRef.current.srcObject = stream;
        const started = await ensureVideoPlaying();
        if (!started) {
          setStreamError(
            "브라우저가 미리보기를 자동 재생하지 못했습니다. 화면을 한 번 탭한 뒤 다시 시도해주세요.",
          );
          setHasCameraAccess(false);
          return false;
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
  }, [ensureVideoPlaying, isRequestingCamera]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const markReady = () => setIsVideoReady(true);
    const markNotReady = () => setIsVideoReady(false);
    video.addEventListener("playing", markReady);
    video.addEventListener("pause", markNotReady);
    video.addEventListener("stalled", markNotReady);
    video.addEventListener("suspend", markNotReady);
    video.addEventListener("emptied", markNotReady);
    return () => {
      video.removeEventListener("playing", markReady);
      video.removeEventListener("pause", markNotReady);
      video.removeEventListener("stalled", markNotReady);
      video.removeEventListener("suspend", markNotReady);
      video.removeEventListener("emptied", markNotReady);
    };
  }, []);

  useEffect(() => {
    if (!hasCameraAccess || isVideoReady) {
      return;
    }
    const video = videoRef.current;
    if (video?.readyState >= 2 && !video.paused) {
      setIsVideoReady(true);
      return;
    }
    const resumeOnInteraction = () => {
      void ensureVideoPlaying().then((started) => {
        if (!started) {
          setStreamError(
            "미리보기를 다시 실행하지 못했습니다. 브라우저 설정에서 카메라 권한을 확인하거나 새로고침 후 다시 시도해주세요.",
          );
        } else {
          setStreamError(null);
        }
      });
    };
    const resumeOnVisibility = () => {
      if (!document.hidden) {
        void ensureVideoPlaying();
      }
    };
    window.addEventListener("pointerdown", resumeOnInteraction);
    window.addEventListener("keydown", resumeOnInteraction);
    document.addEventListener("visibilitychange", resumeOnVisibility);
    return () => {
      window.removeEventListener("pointerdown", resumeOnInteraction);
      window.removeEventListener("keydown", resumeOnInteraction);
      document.removeEventListener("visibilitychange", resumeOnVisibility);
    };
  }, [ensureVideoPlaying, hasCameraAccess, isVideoReady]);
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsVideoReady(false);
    };
  }, []);

  const normalizedVideoRatio =
    videoAspectRatio > 1 ? videoAspectRatio : DEFAULT_VIDEO_RATIO;
  const cameraAspectRatio = normalizedVideoRatio;

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

    const fallbackWidth = template.layout.canvas.width;
    const fallbackHeight = template.layout.canvas.height;
    const videoWidth = video.videoWidth || fallbackWidth;
    const videoHeight = video.videoHeight || fallbackHeight;

    if (slot) {
      canvas.width = slot.width;
      canvas.height = slot.height;

      const slotRatio = slot.width / slot.height;
      const videoRatio = videoWidth / videoHeight;

      let sourceWidth = videoWidth;
      let sourceHeight = videoHeight;
      let sx = 0;
      let sy = 0;

      if (videoRatio > slotRatio) {
        sourceHeight = videoHeight;
        sourceWidth = sourceHeight * slotRatio;
        sx = (videoWidth - sourceWidth) / 2;
      } else {
        sourceWidth = videoWidth;
        sourceHeight = sourceWidth / slotRatio;
        sy = (videoHeight - sourceHeight) / 2;
      }

      ctx.drawImage(
        video,
        sx,
        sy,
        sourceWidth,
        sourceHeight,
        0,
        0,
        slot.width,
        slot.height,
      );
      return canvas.toDataURL("image/png");
    }

    canvas.width = fallbackWidth;
    canvas.height = fallbackHeight;

    const videoRatio = videoWidth / videoHeight;
    const canvasRatio = fallbackWidth / fallbackHeight;

    let drawWidth = fallbackWidth;
    let drawHeight = fallbackHeight;
    if (videoRatio > canvasRatio) {
      drawHeight = fallbackHeight;
      drawWidth = videoRatio * drawHeight;
    } else {
      drawWidth = fallbackWidth;
      drawHeight = drawWidth / videoRatio;
    }
    const dx = (fallbackWidth - drawWidth) / 2;
    const dy = (fallbackHeight - drawHeight) / 2;

    ctx.save();
    ctx.fillStyle = template.layout.frame.backgroundColor;
    ctx.fillRect(0, 0, fallbackWidth, fallbackHeight);
    ctx.drawImage(video, dx, dy, drawWidth, drawHeight);
    ctx.restore();

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

    if (!slots.length) {
      setStreamError("이 템플릿에는 사용할 수 있는 슬롯이 없습니다.");
      return;
    }

    setCapturedShots(Array(captureCount).fill(""));
    setFinalImage(null);
    setArrangementError(null);
    setStage("capture");
    setSlotAssignments(
      slots.reduce<Record<string, number | null>>((acc, slot) => {
        acc[slot.id] = null;
        return acc;
      }, {}),
    );

    for (let index = 0; index < captureCount; index += 1) {
      setCurrentShotIndex(index);
      const overlaySlot = slots[index % slots.length] ?? slots[0];
      await runCountdown();
      setStatus("capturing");

      const slotCapture = drawVideoFrame(overlaySlot);
      if (!slotCapture) {
        setStreamError("캡처에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      setCapturedShots((prev) => {
        const next = [...prev];
        next[index] = slotCapture;
        return next;
      });

      if (index < captureCount - 1) {
        setStatus("waiting");
        // biome-ignore lint/suspicious/noAwaitInLoop: sequential delay between shots is required
        await delay(BETWEEN_SHOTS_DELAY);
      }
    }

    setStatus("arranging");
    setStage("arrange");
    setActiveSlotId(slots[0]?.id ?? null);
  };

  const composeFinalImage = useCallback(async () => {
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
        slots.map(async (slot) => {
          const shotIndex = slotAssignments[slot.id];
          if (shotIndex === null || shotIndex === undefined) {
            return;
          }
          const capture = capturedShots[shotIndex];
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
      setStage("arrange");
    } catch (error) {
      console.error(error);
      setStreamError("결과물을 합성하는 중 오류가 발생했습니다.");
    } finally {
      setIsComposing(false);
    }
  }, [
    capturedShots,
    overlayUrl,
    slotAssignments,
    slots,
    template.layout.canvas.height,
    template.layout.canvas.width,
    template.layout.frame.backgroundColor,
  ]);

  const isAllSlotsAssigned = useMemo(
    () =>
      slots.length > 0 &&
      slots.every((slot) => {
        const shotIndex = slotAssignments[slot.id];
        return typeof shotIndex === "number" && Boolean(capturedShots[shotIndex]);
      }),
    [capturedShots, slotAssignments, slots],
  );

  const assignedShotIndexes = useMemo(() => {
    return new Set(
      Object.values(slotAssignments).filter(
        (value): value is number => typeof value === "number",
      ),
    );
  }, [slotAssignments]);

  const assignShotToSlot = useCallback(
    (slotId: string | null, shotIndex: number) => {
      if (!slotId || !capturedShots[shotIndex]) {
        return;
      }
      setSlotAssignments((prev) => {
        const next = { ...prev };
        Object.entries(next).forEach(([key, value]) => {
          if (value === shotIndex) {
            next[key] = null;
          }
        });
        next[slotId] = shotIndex;
        return next;
      });
      setArrangementError(null);
      setActiveSlotId(slotId);
    },
    [capturedShots],
  );

  const clearSlotAssignment = useCallback((slotId: string) => {
    setSlotAssignments((prev) => ({
      ...prev,
      [slotId]: null,
    }));
    setArrangementError(null);
  }, []);

  const handleConfirmArrangement = useCallback(async () => {
    if (!isAllSlotsAssigned) {
      setArrangementError("모든 프레임에 사진을 배치해주세요.");
      return;
    }
    setArrangementError(null);
    await composeFinalImage();
  }, [composeFinalImage, isAllSlotsAssigned]);

  const handleShotDragStart = (
    event: DragEvent<HTMLButtonElement>,
    shotIndex: number,
  ) => {
    if (!capturedShots[shotIndex]) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/plain", String(shotIndex));
    event.dataTransfer.effectAllowed = "move";
  };

  const handleSlotDrop = (event: DragEvent<HTMLDivElement>, slotId: string) => {
    event.preventDefault();
    const value = event.dataTransfer.getData("text/plain");
    const shotIndex = Number(value);
    if (Number.isNaN(shotIndex)) {
      return;
    }
    assignShotToSlot(slotId, shotIndex);
  };

  const handleShotClick = (shotIndex: number) => {
    const fallbackSlot =
      activeSlotId ??
      slots.find((slot) => slotAssignments[slot.id] === null)?.id ??
      slots[0]?.id ??
      null;
    if (!fallbackSlot) {
      setArrangementError("배치할 슬롯이 없습니다. 템플릿 구성을 확인해주세요.");
      return;
    }
    assignShotToSlot(fallbackSlot, shotIndex);
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
    resetSessionState();
  };
  const handleVideoMetadata = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width && height) {
      setVideoAspectRatio(width / height);
    }
  };

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
      case "arranging":
        return "촬영이 끝났어요. 사진 배치 화면으로 이동합니다.";
      case "finished":
        return "촬영이 완료되었습니다!";
      default:
        return hasCameraAccess
          ? "준비가 되면 아래 버튼을 눌러 촬영을 시작하세요."
          : "촬영 전에 카메라 권한 요청 버튼을 눌러 허용해주세요.";
    }
  })();

  const AppShell = ({ children }: { children: ReactNode }) => (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-8 px-4 py-10">
      {children}
      <canvas
        ref={canvasRef}
        className="hidden"
        width={template.layout.canvas.width}
        height={template.layout.canvas.height}
      />
    </div>
  );

  if (stage === "arrange") {
    const canvasAspectRatio =
      template.layout.canvas.width / template.layout.canvas.height;
    const assignedSlotCount = slots.filter(
      (slot) => slotAssignments[slot.id] !== null,
    ).length;
    const frameContainerStyle = {
      aspectRatio: canvasAspectRatio,
      height: "60vh",
      width: "auto",
      maxWidth: "100%",
    };

    return (
      <AppShell>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 max-h-[90vh] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  사진 배치
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  촬영한 사진을 원하는 프레임 위치에 드래그 앤 드롭하세요.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {assignedSlotCount}/{slots.length} 슬롯 배치 완료
              </span>
            </div>

            {arrangementError ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{arrangementError}</span>
              </div>
            ) : null}

            <div className="mt-5 rounded-2xl bg-slate-100 p-4">
              <div
                className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-inner"
                style={frameContainerStyle}
              >
                <div
                  className="absolute inset-0 z-10"
                  style={{ backgroundColor: template.layout.frame.backgroundColor }}
                >
                  {slots.map((slot) => {
                    const slotLeft = (slot.x / template.layout.canvas.width) * 100;
                    const slotTop = (slot.y / template.layout.canvas.height) * 100;
                  const slotWidth =
                    (slot.width / template.layout.canvas.width) * 100;
                  const slotHeight =
                    (slot.height / template.layout.canvas.height) * 100;
                  const slotCornerRadius =
                    (template.layout.frame.cornerRadius / slot.width) * 100;
                  const assignedIndex = slotAssignments[slot.id];
                  const assignedImage =
                    typeof assignedIndex === "number"
                      ? capturedShots[assignedIndex]
                      : null;
                    const isActive = activeSlotId === slot.id;
                    return (
                      <div
                        key={slot.id}
                        className={`absolute z-20 flex cursor-pointer items-center justify-center overflow-hidden border-2 transition ${
                          assignedImage
                            ? "border-white"
                            : "border-dashed border-white/70 bg-white/70"
                        } ${isActive ? "ring-2 ring-slate-900" : ""}`}
                        style={{
                          left: `${slotLeft}%`,
                          top: `${slotTop}%`,
                          width: `${slotWidth}%`,
                          height: `${slotHeight}%`,
                          borderRadius: `${slotCornerRadius}%`,
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleSlotDrop(event, slot.id)}
                        onClick={() => setActiveSlotId(slot.id)}
                      >
                        {assignedImage ? (
                          <>
                            <img
                              src={assignedImage}
                              alt="선택된 사진"
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                clearSlotAssignment(slot.id);
                              }}
                              className="absolute right-2 top-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow"
                            >
                              비우기
                            </button>
                          </>
                        ) : (
                          <span className="select-none px-2 text-center text-[10px] font-semibold text-slate-500">
                            사진을 드래그해서 배치하세요
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {overlayUrl ? (
                  <img
                    src={overlayUrl}
                    alt="프레임 오버레이"
                    className="pointer-events-none absolute inset-0 z-30 h-full w-full object-fill"
                  />
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                onClick={handleConfirmArrangement}
                disabled={!isAllSlotsAssigned || isComposing}
              >
                {isComposing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                배치 확정하기
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4" />
                다시 촬영하기
              </button>
              {finalImage ? (
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-900 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                  PNG 다운로드
                </button>
              ) : null}
            </div>

            {isComposing ? (
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                결과물을 합성하고 있습니다...
              </div>
            ) : null}

            {finalImage ? (
              <div className="mt-5">
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

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              촬영한 사진 목록
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              사진을 드래그하거나 클릭해 프레임에 배치하세요. ({capturedShots.filter(Boolean).length}
              /{captureCount} 컷)
            </p>
            <div className="mt-4 grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
              {capturedShots.map((shot, index) => {
                const isUsed = assignedShotIndexes.has(index);
                return (
                  <button
                    key={`shot-${index}`}
                    type="button"
                    className={`relative flex h-32 flex-col overflow-hidden rounded-xl border text-left text-xs transition ${
                      shot ? "bg-white" : "bg-slate-50 text-slate-400"
                    } ${isUsed ? "border-slate-900" : "border-slate-200"} ${
                      shot ? "hover:border-slate-900" : "cursor-not-allowed opacity-80"
                    }`}
                    draggable={Boolean(shot)}
                    onDragStart={(event) => handleShotDragStart(event, index)}
                    onClick={() => handleShotClick(index)}
                    disabled={!shot}
                  >
                    {shot ? (
                      <img
                        src={shot}
                        alt={`촬영 컷 ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-1 items-center justify-center">
                        촬영 대기중
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                      #{index + 1}
                    </span>
                    {isUsed ? (
                      <span className="absolute right-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                        사용중
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl bg-black relative overflow-hidden shadow-xl">
          <div
            className="relative mx-auto w-full max-w-4xl bg-black"
            style={{
              aspectRatio: cameraAspectRatio,
              maxHeight: "60vh",
              width: "100%",
            }}
          >
            {/** Camera feed */}
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              playsInline
              autoPlay
              muted
              onLoadedMetadata={handleVideoMetadata}
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
            {hasCameraAccess && !isVideoReady ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/60 p-6 text-center text-white">
                <p className="text-sm leading-relaxed text-slate-200">
                  브라우저가 자동으로 미리보기를 재생하지 못했습니다. 화면을 한 번 탭하거나 아래 버튼을 눌러 미리보기를 다시 시작해주세요.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void ensureVideoPlaying().then((started) => {
                      if (!started) {
                        setStreamError(
                          "미리보기를 다시 실행하지 못했습니다. 다른 탭에서 카메라를 사용 중인지 확인해주세요.",
                        );
                      }
                    })
                  }
                  className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow transition hover:bg-white"
                >
                  미리보기 다시 실행
                </button>
              </div>
            ) : null}
            {countdown ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
                <span className="text-6xl font-bold text-white">{countdown}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {template.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              총 {captureCount}컷을 순서대로 촬영합니다. 완성 프레임에는{" "}
              {slots.length}컷이 배치됩니다.
            </p>
            <p className="mt-3 rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-600">
              {statusLabel}
            </p>
            {stage === "capture" ? (
              <p className="mt-1 text-xs font-medium text-slate-500">
                진행 상태: {Math.min(currentShotIndex + 1, captureCount)}/{captureCount}
              </p>
            ) : null}
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
                Boolean(streamError) ||
                status === "countdown" ||
                status === "capturing" ||
                !hasCameraAccess
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
              {capturedShots.map((shot, index) => {
                const isActive =
                  stage === "capture" &&
                  (status === "countdown" || status === "capturing") &&
                  index === currentShotIndex;
                return (
                  <div
                    key={`capture-shot-${index}`}
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
        </div>
      </div>
    </AppShell>
  );
};
