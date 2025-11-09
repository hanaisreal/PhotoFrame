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
  type RefObject,
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

interface BoothAppShellProps {
  children: ReactNode;
  canvasRef: RefObject<HTMLCanvasElement>;
  canvasWidth: number;
  canvasHeight: number;
}

const BoothAppShell = ({
  children,
  canvasRef,
  canvasWidth,
  canvasHeight,
}: BoothAppShellProps) => (
  <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-8 px-4 py-10">
    {children}
    <canvas
      ref={canvasRef}
      className="hidden"
      width={canvasWidth}
      height={canvasHeight}
    />
  </div>
);

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
    // Don't stop the stream during arrange - let users see the preview
    // Only stop when explicitly needed (e.g., component unmount or explicit cleanup)
    if (stage === "final" || stage === "idle") {
      // Keep camera active even during arrange phase for preview
      return;
    }
  }, [stage]);

  // Temporarily disable background interval to see if it's causing white screen
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     const video = videoRef.current;
  //     const stream = streamRef.current;

  //     if (video && stream && stream.active && !video.srcObject) {
  //       console.log('🎥 FORCING srcObject reassignment');
  //       video.srcObject = stream;
  //     }
  //   }, 100);

  //   return () => clearInterval(interval);
  // }, [hasCameraAccess]);

  const safePlay = useCallback(async (video: HTMLVideoElement) => {
    if (!video.isConnected) {
      console.info("🎥 Skipping play because video element is disconnected.");
      return false;
    }
    try {
      await video.play();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.info("🎥 Video play aborted because the element was removed.");
        return false;
      }
      throw error;
    }
  }, []);

  const ensureVideoPlaying = useCallback(async () => {
    const video = videoRef.current;
    console.log('🎥 ensureVideoPlaying called', {
      hasVideo: !!video,
      hasStream: !!streamRef.current,
      streamActive: streamRef.current?.active,
      videoSrcObject: !!video?.srcObject,
      videoPaused: video?.paused,
      videoReadyState: video?.readyState
    });

    if (!video || !streamRef.current) {
      console.warn('🎥 Missing video or stream');
      return false;
    }

    try {
      // Simple approach: just play the video
      const played = await safePlay(video);
      if (!played) {
        setIsVideoReady(false);
        return false;
      }
      console.log('🎥 ensureVideoPlaying SUCCESS', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        paused: video.paused,
        currentTime: video.currentTime
      });
      setIsVideoReady(true);
      return true;
    } catch (error) {
      console.warn("🎥 ensureVideoPlaying FAILED:", error);
      setIsVideoReady(false);
      return false;
    }
  }, [safePlay]);

  const waitForVideoReady = useCallback(
    async (timeoutMs = 5000) => {
      const video = videoRef.current;
      const stream = streamRef.current;

      console.log('🎥 waitForVideoReady called', {
        hasVideo: !!video,
        hasStream: !!stream,
        streamActive: stream?.active,
        videoReadyState: video?.readyState,
        videoWidth: video?.videoWidth,
        videoHeight: video?.videoHeight,
        videoSrcObject: !!video?.srcObject,
        timeoutMs
      });

      if (!video) {
        throw new Error("비디오 요소를 찾지 못했습니다.");
      }

      if (stream && video.srcObject !== stream) {
        console.log('🎥 Setting srcObject in waitForVideoReady');
        video.srcObject = stream;
      }

      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        console.log('🎥 Video already ready, skipping wait');
        return;
      }

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let timeoutId: number | null = null;

        const handleReady = () => {
          if (settled) {
            return;
          }
          console.log('🎥 waitForVideoReady handleReady called', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState,
            paused: video.paused
          });
          settled = true;
          cleanup();
          resolve();
        };

        const handleError = () => {
          if (settled) {
            return;
          }
          console.log('🎥 waitForVideoReady handleError called', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState,
            paused: video.paused,
            isConnected: video.isConnected,
            srcObject: !!video.srcObject
          });
          settled = true;
          cleanup();
          reject(new Error("비디오 메타데이터 로드에 실패했습니다."));
        };

        function cleanup() {
          video.removeEventListener("loadedmetadata", handleReady);
          video.removeEventListener("loadeddata", handleReady);
          video.removeEventListener("canplay", handleReady);
          video.removeEventListener("error", handleError);
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
          }
        }

        timeoutId = window.setTimeout(() => {
          handleError();
        }, timeoutMs);

        video.addEventListener("loadedmetadata", handleReady);
        video.addEventListener("loadeddata", handleReady);
        video.addEventListener("canplay", handleReady);
        video.addEventListener("error", handleError);

        if (!video.isConnected) {
          handleError();
          return;
        }

        // Skip the play attempt during waitForVideoReady since it causes element removal
        // Just wait for metadata events instead
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          handleReady();
        }
      });

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error("비디오 해상도를 가져오지 못했습니다.");
      }
    },
    [safePlay],
  );

  const initializeCamera = useCallback(async () => {
    console.log('🎥 initializeCamera called', { isRequestingCamera });

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
      console.log('🎥 Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 16 / 9 },
          facingMode: "user",
        },
        audio: false,
      });

      console.log('🎥 Camera access granted!', {
        streamActive: stream.active,
        tracks: stream.getVideoTracks().length,
        trackEnabled: stream.getVideoTracks()[0]?.enabled,
        trackReadyState: stream.getVideoTracks()[0]?.readyState
      });

      streamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();
      if (settings?.width && settings?.height) {
        setVideoAspectRatio(settings.width / settings.height);
      }

      if (videoRef.current) {
        const video = videoRef.current;
        console.log('🎥 Setting up video element...');

        video.muted = true;
        video.playsInline = true;

        // Try different approaches to set the stream
        try {
          video.srcObject = stream;
          console.log('🎥 srcObject assignment attempted');
        } catch (error) {
          console.error('🎥 srcObject assignment failed:', error);
          // Fallback for older browsers
          try {
            video.src = window.URL.createObjectURL(stream as any);
            console.log('🎥 Fallback URL.createObjectURL used');
          } catch (fallbackError) {
            console.error('🎥 Fallback also failed:', fallbackError);
          }
        }

        // Wait for video to load metadata
        let metadataReady = false;
        try {
          await waitForVideoReady();
          metadataReady = true;
        } catch (metadataError) {
          console.warn("🎥 Failed to confirm metadata during init:", metadataError);
        }

        console.log('🎥 After metadata load:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          paused: video.paused,
          srcObject: !!video.srcObject
        });

        setIsVideoReady(metadataReady);

        // Clear any existing errors
        setStreamError(null);

        // Try to start playback immediately
        try {
          const played = await safePlay(video);
          if (played) {
            console.log('🎥 Video play succeeded!', {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              currentTime: video.currentTime,
              paused: video.paused
            });
          }
        } catch (error) {
          console.warn("🎥 Initial video play failed - this is normal for autoplay restrictions:", error);
          // Don't set a stream error - this is expected behavior
          // The video stream is ready, just needs user interaction
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
  }, [isRequestingCamera, safePlay, waitForVideoReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const markReady = () => setIsVideoReady(true);
    const markNotReady = () => setIsVideoReady(false);
    video.addEventListener("playing", markReady);
    video.addEventListener("pause", markNotReady);
    return () => {
      video.removeEventListener("playing", markReady);
      video.removeEventListener("pause", markNotReady);
    };
  }, []);

  // Separate useEffect to handle setting srcObject when both video and stream are available
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;

    console.log('🎥 useEffect for srcObject:', {
      hasVideo: !!video,
      hasStream: !!stream,
      streamActive: stream?.active,
      hasCameraAccess,
      stage,
      currentVideoSrcObject: !!video?.srcObject
    });

    if (!video || !stream || !stream.active || !hasCameraAccess) {
      console.log('🎥 Skipping srcObject assignment - missing requirements');
      return;
    }

    if (video.srcObject === stream) {
      console.log('🎥 srcObject already set correctly');
      return;
    }

    try {
      console.log('🎥 Setting srcObject in useEffect...');
      video.srcObject = stream;

      const handleLoadedMetadata = () => {
        console.log('🎥 Video metadata loaded in useEffect:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState
        });
        setIsVideoReady(true);

        // Try to play the video
        void safePlay(video).catch(error => {
          console.warn('🎥 Video play failed in useEffect:', error);
        });
      };

      if (video.readyState >= 1) {
        handleLoadedMetadata();
      } else {
        video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      }

    } catch (error) {
      console.error('🎥 srcObject assignment failed in useEffect:', error);
    }
  }, [hasCameraAccess, safePlay]); // Only re-run when camera access changes

  useEffect(() => {
    if (!hasCameraAccess || isVideoReady) {
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

    window.addEventListener("pointerdown", resumeOnInteraction);
    window.addEventListener("keydown", resumeOnInteraction);
    window.addEventListener("click", resumeOnInteraction);
    window.addEventListener("touchstart", resumeOnInteraction);

    return () => {
      window.removeEventListener("pointerdown", resumeOnInteraction);
      window.removeEventListener("keydown", resumeOnInteraction);
      window.removeEventListener("click", resumeOnInteraction);
      window.removeEventListener("touchstart", resumeOnInteraction);
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
    const stream = streamRef.current;

    console.log('🎥 drawVideoFrame called', {
      hasVideo: !!video,
      hasCanvas: !!canvas,
      hasStream: !!stream,
      videoWidth: video?.videoWidth,
      videoHeight: video?.videoHeight,
      videoPaused: video?.paused,
      videoReadyState: video?.readyState,
      videoSrcObject: !!video?.srcObject,
      streamActive: stream?.active,
      slot: slot ? `${slot.width}x${slot.height}` : 'full'
    });

    if (!video || !canvas || !stream) {
      console.error('🎥 Missing video, canvas, or stream');
      return null;
    }

    // Ensure video has the stream
    if (!video.srcObject || video.srcObject !== stream) {
      console.log('🎥 Re-setting srcObject before capture');
      video.srcObject = stream;
    }

    // Wait a moment for video to be ready
    if (video.readyState < 2) {
      console.warn('🎥 Video not ready for capture, readyState:', video.readyState);
      return null;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error('🎥 Cannot get canvas 2d context');
      return null;
    }

    // Use actual video dimensions or fallback
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const fallbackWidth = template.layout.canvas.width;
    const fallbackHeight = template.layout.canvas.height;

    console.log('🎥 Video dimensions for capture:', {
      videoWidth,
      videoHeight,
      fallbackWidth,
      fallbackHeight,
      hasVideoDimensions: videoWidth > 0 && videoHeight > 0
    });

    // If video dimensions are not available, try a different approach
    if (!videoWidth || !videoHeight) {
      console.error('🎥 Video has no dimensions, trying with stream video track...');

      // Try to get dimensions from the video track
      const tracks = stream.getVideoTracks();
      if (tracks.length > 0) {
        const settings = tracks[0].getSettings();
        console.log('🎥 Video track settings:', settings);
        if (settings.width && settings.height) {
          // Use track dimensions as fallback
          const trackWidth = settings.width;
          const trackHeight = settings.height;
          console.log('🎥 Using track dimensions:', trackWidth, trackHeight);
        }
      }
      return null;
    }

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

      console.log('🎥 Drawing to slot canvas:', {
        sx, sy, sourceWidth, sourceHeight,
        destWidth: slot.width,
        destHeight: slot.height
      });

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

      // Check if canvas actually contains image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasNonTransparentPixels = Array.from(imageData.data).some((value, index) =>
        index % 4 !== 3 && value !== 255  // Check RGB values (skip alpha), not all white
      );

      console.log('🎥 Canvas pixel analysis:', {
        hasNonTransparentPixels,
        totalPixels: imageData.data.length / 4,
        samplePixels: Array.from(imageData.data.slice(0, 20))
      });

      const dataUrl = canvas.toDataURL("image/png");
      console.log('🎥 Slot capture completed, data URL length:', dataUrl.length);
      return dataUrl;
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

  const keepPreviewAlive = useCallback(
    async (reason: string, options?: { metadataTimeout?: number }) => {
      const video = videoRef.current;
      const stream = streamRef.current;

      if (!video || !stream) {
        console.warn(`🎥 keepPreviewAlive skipped (${reason}) - missing refs`, {
          hasVideo: !!video,
          hasStream: !!stream,
        });
        return false;
      }

      if (!stream.active) {
        console.warn(`🎥 keepPreviewAlive skipped (${reason}) - inactive stream`);
        return false;
      }

      if (video.srcObject !== stream) {
        console.log(`🎥 keepPreviewAlive reattaching stream (${reason})`);
        video.srcObject = stream;
      }

      if (video.readyState < 2 || video.videoWidth === 0) {
        try {
          await waitForVideoReady(options?.metadataTimeout ?? 1500);
        } catch (error) {
          console.warn(`🎥 keepPreviewAlive metadata wait failed (${reason}):`, error);
        }
      }

      if (video.paused) {
        try {
          const played = await safePlay(video);
          if (!played) {
            console.warn(
              `🎥 keepPreviewAlive play skipped (${reason}) - element disconnected`,
            );
          }
        } catch (error) {
          console.warn(`🎥 keepPreviewAlive play failed (${reason}):`, error);
        }
      }

      const ready =
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        !video.paused;

      if (!ready) {
        console.warn(`🎥 keepPreviewAlive incomplete (${reason})`, {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          paused: video.paused,
          hasSrcObject: !!video.srcObject,
        });
      } else {
        console.log(`🎥 keepPreviewAlive OK (${reason})`, {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
      }

      return ready;
    },
    [safePlay, waitForVideoReady],
  );

  useEffect(() => {
    if (stage !== "capture" || !hasCameraAccess) {
      return;
    }

    let cancelled = false;

    const tick = () => {
      if (cancelled) {
        return;
      }
      void keepPreviewAlive("keep-alive");
    };

    tick();
    const intervalId = window.setInterval(tick, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [hasCameraAccess, keepPreviewAlive, stage]);

  const runCountdown = async () => {
    const video = videoRef.current;
    const stream = streamRef.current;

    await keepPreviewAlive("countdown-start", { metadataTimeout: 800 });

    console.log('🎥 BEFORE setStatus("countdown") - video state:', {
      videoWidth: video?.videoWidth,
      videoHeight: video?.videoHeight,
      paused: video?.paused,
      readyState: video?.readyState,
      srcObject: !!video?.srcObject
    });

    setStatus("countdown");

    // Check video state IMMEDIATELY after status change
    console.log('🎥 AFTER setStatus("countdown") - video state:', {
      videoWidth: video?.videoWidth,
      videoHeight: video?.videoHeight,
      paused: video?.paused,
      readyState: video?.readyState,
      srcObject: !!video?.srcObject
    });

    // Wait a moment to see if something async affects it
    await delay(50);
    console.log('🎥 50ms after setStatus("countdown") - video state:', {
      videoWidth: video?.videoWidth,
      videoHeight: video?.videoHeight,
      paused: video?.paused,
      readyState: video?.readyState,
      srcObject: !!video?.srcObject
    });
    void keepPreviewAlive("countdown-post-status", { metadataTimeout: 600 });

    for (let value = COUNTDOWN_START; value >= 1; value -= 1) {
      setCountdown(value);

      // Don't touch video at all during countdown to prevent flickers
      // Log video state during each countdown number
      console.log(`🎥 Countdown ${value} - video state:`, {
        paused: video?.paused,
        readyState: video?.readyState,
        videoWidth: video?.videoWidth,
        videoHeight: video?.videoHeight
      });

      // biome-ignore lint/suspicious/noAwaitInLoop: countdown needs step delay
      await delay(1000);
    }
    setCountdown(null);
  };

  const abortCapture = useCallback(
    (message?: string) => {
      if (message) {
        setStreamError(message);
      }
      setStatus("idle");
      setCountdown(null);
      setStage("capture");
    },
    [],
  );

  const captureSequence = async () => {
    console.log('🎥 Starting capture sequence...');

    if (!videoRef.current || !canvasRef.current) {
      abortCapture("카메라 초기화가 완료되지 않았습니다.");
      return;
    }

    if (!slots.length) {
      abortCapture("이 템플릿에는 사용할 수 있는 슬롯이 없습니다.");
      return;
    }

    console.log('🎥 Video state before capture:', {
      paused: videoRef.current.paused,
      readyState: videoRef.current.readyState,
      videoWidth: videoRef.current.videoWidth,
      videoHeight: videoRef.current.videoHeight
    });

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
      console.log(`🎥 Capturing shot ${index + 1}/${captureCount}`);
      setCurrentShotIndex(index);
      const overlaySlot = slots[index % slots.length] ?? slots[0];
      await runCountdown();

      // Log video state before switching to capturing
      console.log('🎥 BEFORE setStatus("capturing") - video state:', {
        videoWidth: videoRef.current?.videoWidth,
        videoHeight: videoRef.current?.videoHeight,
        srcObject: !!videoRef.current?.srcObject,
        readyState: videoRef.current?.readyState
      });

      setStatus("capturing");

      // Log video state after switching to capturing
      console.log('🎥 AFTER setStatus("capturing") - video state:', {
        videoWidth: videoRef.current?.videoWidth,
        videoHeight: videoRef.current?.videoHeight,
        srcObject: !!videoRef.current?.srcObject,
        readyState: videoRef.current?.readyState
      });

      console.log('🎥 Video state during capture:', {
        paused: videoRef.current.paused,
        readyState: videoRef.current.readyState,
        videoWidth: videoRef.current.videoWidth,
        videoHeight: videoRef.current.videoHeight
      });

      // Ensure srcObject is properly set before capture
      const stream = streamRef.current;
      if (!videoRef.current.srcObject && stream) {
        console.log('🎥 Re-assigning srcObject before capture...');
        videoRef.current.srcObject = stream;
      }

      // Ensure video metadata is loaded and video is ready
      if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
        console.log('🎥 Video metadata not loaded, trying manual approach...');

        // Instead of using waitForVideoReady which can cause element removal,
        // try a simpler approach with shorter timeout
        let retries = 0;
        const maxRetries = 10;

        while (retries < maxRetries) {
          console.log(`🎥 Retry ${retries}/${maxRetries} - Video state:`, {
            videoWidth: videoRef.current.videoWidth,
            videoHeight: videoRef.current.videoHeight,
            readyState: videoRef.current.readyState,
            paused: videoRef.current.paused,
            srcObject: !!videoRef.current.srcObject,
            streamActive: stream?.active
          });

          // If still no srcObject, try to set it again
          if (!videoRef.current.srcObject && stream) {
            console.log('🎥 Re-setting srcObject during retry...');
            videoRef.current.srcObject = stream;
          }

          // Skip video.load() calls that cause white screen flashes

          if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
            console.log('🎥 Video dimensions loaded:', {
              videoWidth: videoRef.current.videoWidth,
              videoHeight: videoRef.current.videoHeight,
              readyState: videoRef.current.readyState
            });
            break;
          }

          await delay(200);
          retries++;
        }

        if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
          console.error('🎥 Video dimensions still not available after retries');
          abortCapture("비디오 해상도를 가져올 수 없습니다. 다시 시도해주세요.");
          return;
        }
      }

      // Ensure video is playing before capture
      if (videoRef.current.paused) {
        console.log('🎥 Video is paused, attempting to play before capture...');
        try {
          const played = await safePlay(videoRef.current);
          if (played) {
            console.log('🎥 Video play successful before capture');
          } else {
            console.warn('🎥 Video play skipped before capture (element missing)');
          }
        } catch (error) {
          console.error('🎥 Failed to play video before capture:', error);
        }
      }

      // Wait a brief moment for video to be stable
      await delay(200);

      const slotCapture = drawVideoFrame(overlaySlot);
      if (!slotCapture) {
        abortCapture("캡처에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      console.log('🎥 Shot captured successfully', {
        dataUrlLength: slotCapture.length,
        dataUrlPreview: slotCapture.substring(0, 100) + '...',
        overlaySlot: `${overlaySlot.width}x${overlaySlot.height}`
      });

      setCapturedShots((prev) => {
        const next = [...prev];
        next[index] = slotCapture;
        return next;
      });

      // Resume video playback after each shot and ensure stream stability
      try {
        const video = videoRef.current;
        const stream = streamRef.current;

        if (video && stream) {
          // Ensure srcObject is still assigned
          if (video.srcObject !== stream) {
            console.log('🎥 Re-assigning srcObject after shot...');
            video.srcObject = stream;
          }

          // Resume playback if paused
          if (video.paused) {
            console.log('🎥 Resuming video after shot capture...');
            await safePlay(video);
          }

          // Log state after resuming
          console.log('🎥 Video state after shot resume:', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            paused: video.paused,
            readyState: video.readyState,
            srcObject: !!video.srcObject
          });
        }
      } catch (error) {
        console.warn('🎥 Failed to resume video after shot:', error);
      }

      if (index < captureCount - 1) {
        setStatus("waiting");
        // biome-ignore lint/suspicious/noAwaitInLoop: sequential delay between shots is required
        await delay(BETWEEN_SHOTS_DELAY);
      }
    }

    console.log('🎥 Capture sequence completed');
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

      // Skip drawing legacy overlay assets to ensure the final PNG reflects the edited layout only

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
      <BoothAppShell
        canvasRef={canvasRef}
        canvasWidth={template.layout.canvas.width}
        canvasHeight={template.layout.canvas.height}
      >
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
                        className={`absolute z-20 flex cursor-pointer items-center justify-center overflow-hidden transition ${
                          assignedImage
                            ? ""
                            : "border border-dashed border-white/50 bg-white/20"
                        } ${isActive ? "ring-2 ring-white/80" : ""}`}
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
                          <span className="select-none px-2 text-center text-[10px] font-semibold text-white/70">
                            사진을 드래그해서 배치하세요
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Overlay hidden during arrangement to keep slot drop targets clear */}
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
            {/* Debug info for captured shots */}
            <div className="mt-2 text-xs text-slate-400">
              Debug: {capturedShots.map((shot, i) => `${i+1}:${shot ? 'OK' : 'Empty'}`).join(', ')}
            </div>
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
      </BoothAppShell>
    );
  }

  return (
    <BoothAppShell
      canvasRef={canvasRef}
      canvasWidth={template.layout.canvas.width}
      canvasHeight={template.layout.canvas.height}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl relative overflow-hidden shadow-xl">
          <div
            className="relative mx-auto w-full max-w-4xl"
            style={{
              aspectRatio: cameraAspectRatio,
              maxHeight: "60vh",
              width: "100%",
            }}
          >
            {/** Camera feed */}
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover z-10"
              playsInline
              muted
              autoPlay
              onLoadedMetadata={handleVideoMetadata}
              onLoadedData={() => console.log('Video loaded data')}
              onCanPlay={() => console.log('Video can play')}
              onPlay={() => console.log('Video started playing')}
              onPause={() => console.log('🎥 Video paused during countdown')}
              onPlaying={() => console.log('🎥 Video playing during countdown')}
              style={{
                visibility: 'visible',
                opacity: 1
              }}
            />
            {/** Permission overlay */}
            {!hasCameraAccess ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center text-white">
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
            {/* Countdown number positioned in corner to avoid covering video */}
            {countdown ? (
              <div className="absolute top-8 left-8 z-20 pointer-events-none">
                <span
                  className="text-8xl font-bold text-white drop-shadow-2xl"
                  style={{
                    textShadow: '3px 3px 6px rgba(0,0,0,0.8)'
                  }}
                >
                  {countdown}
                </span>
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

            {/* Debug info removed */}
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
    </BoothAppShell>
  );
};
