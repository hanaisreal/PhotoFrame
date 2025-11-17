/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  Download,
  Edit,
  Loader2,
  RotateCcw,
} from "lucide-react";

import type { FrameSlot, FrameTemplate, ImageElement } from "@/types/frame";
import { useLanguage } from "@/contexts/language-context";

interface BoothViewProps {
  template: FrameTemplate;
}

interface BoothAppShellProps {
  children: ReactNode;
  canvasRef: RefObject<HTMLCanvasElement | null>;
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
const MAX_PREVIEW_WIDTH = 480;
const MAX_PREVIEW_HEIGHT = 720;

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const loadImage = (src: string, t: (key: string) => string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(t("error.imageLoadFailed")));
    img.src = src;
  });


export const BoothView = ({ template }: BoothViewProps) => {
  const { t } = useLanguage();
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
  const [loadingStep, setLoadingStep] = useState(0);
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
    setLoadingStep(0);
    setArrangementError(null);
    setCurrentShotIndex(0);
    setActiveSlotId(slots[0]?.id ?? null);
    setIsVideoReady(false);
  }, [captureCount, slots]);

  useEffect(() => {
    resetSessionState();
  }, [resetSessionState, template.slug]);

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
        throw new Error(t("error.videoElementNotFound"));
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
          reject(new Error(t("error.videoMetadataLoadFailed")));
        };

        function cleanup() {
          video?.removeEventListener("loadedmetadata", handleReady);
          video?.removeEventListener("loadeddata", handleReady);
          video?.removeEventListener("canplay", handleReady);
          video?.removeEventListener("error", handleError);
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
        throw new Error(t("error.videoResolutionFailed"));
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
      setStreamError(t("error.cameraNotSupported"));
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            video.src = (window.URL as any).createObjectURL(stream);
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
      let message = t("error.cameraPermissionNeeded");

      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError" || error.name === "SecurityError") {
          message = t("error.cameraPermissionDenied");
        } else if (error.name === "NotFoundError") {
          message = t("error.noCameraDevice");
        } else if (error.name === "NotReadableError") {
          message = t("error.cameraInUse");
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
            t("error.cameraPermissionNeeded"),
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

      // Apply horizontal flip for captured photo
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(
        video,
        sx,
        sy,
        sourceWidth,
        sourceHeight,
        -slot.width,
        0,
        slot.width,
        slot.height,
      );
      ctx.restore();

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

    // Apply horizontal flip for captured photo
    ctx.scale(-1, 1);
    ctx.drawImage(video, -dx - drawWidth, dy, drawWidth, drawHeight);
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
      abortCapture(t("error.cameraPermissionNeeded"));
      return;
    }

    if (!slots.length) {
      abortCapture(t("error.cameraPermissionNeeded"));
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
          abortCapture(t("error.videoResolutionFailed"));
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
        abortCapture(t("error.cameraPermissionNeeded"));
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
    setLoadingStep(0);

    // Loading step 1: Structuring
    setLoadingStep(1);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Loading step 2: Processing
    setLoadingStep(2);
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Loading step 3: Finalizing
    setLoadingStep(3);
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const canvas = document.createElement("canvas");
      canvas.width = template.layout.canvas.width;
      canvas.height = template.layout.canvas.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error(t("error.canvasNotFound"));
      }

      // Draw background
      ctx.fillStyle = template.layout.frame.backgroundColor;
      ctx.fillRect(
        0,
        0,
        template.layout.canvas.width,
        template.layout.canvas.height,
      );

      // 1. Draw stickers first (behind photos)
      const sortedStickers = [...template.stickers]
        .filter((sticker) => sticker.isVisible ?? true)
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

      for (const sticker of sortedStickers) {
        const image = await loadImage(sticker.dataUrl, t);
        ctx.save();
        ctx.translate(
          sticker.x + (sticker.width * sticker.scaleX) / 2,
          sticker.y + (sticker.height * sticker.scaleY) / 2,
        );
        ctx.rotate((sticker.rotation * Math.PI) / 180);
        ctx.globalAlpha = sticker.opacity ?? 1;
        ctx.drawImage(
          image,
          -(sticker.width * sticker.scaleX) / 2,
          -(sticker.height * sticker.scaleY) / 2,
          sticker.width * sticker.scaleX,
          sticker.height * sticker.scaleY,
        );
        ctx.restore();
      }

      // 2. Draw text elements from template data
      template.texts
        ?.filter((text) => text.isVisible ?? true)
        .forEach((text) => {
        ctx.save();
        ctx.translate(text.x + text.width / 2, text.y);
        ctx.rotate((text.rotation * Math.PI) / 180);
        ctx.fillStyle = text.color;
        ctx.font = `${text.fontSize}px ${text.fontFamily}`;
        ctx.textAlign = text.align;
        ctx.fillText(text.content, -text.width / 2, 0);
        ctx.restore();
      });


      const slotMap = new Map(slots.map((slot) => [slot.id, slot]));
      const slotImagesBySlot = template.images.reduce<Map<string, ImageElement[]>>((map, image) => {
        if (!image.slotId || image.isVisible === false) {
          return map;
        }
        if (!slotMap.has(image.slotId)) {
          console.warn(`🖼️ Template image ${image.id} references unknown slot ${image.slotId}`);
          return map;
        }
        if (!map.has(image.slotId)) {
          map.set(image.slotId, []);
        }
        map.get(image.slotId)!.push(image);
        return map;
      }, new Map());

      // 4. Draw slot images (photos) - IN FRONT of decorative elements
      await Promise.all(
        slots.map(async (slot) => {
          const shotIndex = slotAssignments[slot.id];
          if (shotIndex === null || shotIndex === undefined) {
            console.log(`🖼️ Slot ${slot.id} has no assigned shot, skipping`);
            return;
          }
          const capture = capturedShots[shotIndex];
          if (!capture) {
            console.log(`🖼️ Slot ${slot.id} shot ${shotIndex} is empty, skipping`);
            return;
          }
          console.log(`🖼️ Drawing captured shot ${shotIndex} to slot ${slot.id}`);
          const image = await loadImage(capture, t);
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

      // 4.5. Draw template images assigned to slots (background-removed images, etc.) - Also in slot positions
      for (const slot of slots) {
        const slotImages = slotImagesBySlot.get(slot.id);
        if (!slotImages?.length) {
          continue;
        }
        const sortedSlotImages = [...slotImages].sort(
          (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
        );
        for (const image of sortedSlotImages) {
          console.log(`🖼️ Drawing template image ${image.id} to slot ${slot.id}`);
          const img = await loadImage(image.dataUrl, t);
          ctx.save();
          if (image.clipToSlot) {
            ctx.beginPath();
            ctx.rect(slot.x, slot.y, slot.width, slot.height);
            ctx.clip();
          }
          ctx.globalAlpha = image.opacity ?? 1;
          const drawX = slot.x + image.x;
          const drawY = slot.y + image.y;
          ctx.translate(
            drawX + (image.width * image.scaleX) / 2,
            drawY + (image.height * image.scaleY) / 2,
          );
          ctx.rotate((image.rotation * Math.PI) / 180);
          ctx.drawImage(
            img,
            -(image.width * image.scaleX) / 2,
            -(image.height * image.scaleY) / 2,
            image.width * image.scaleX,
            image.height * image.scaleY,
          );
          ctx.restore();
        }
      }

      // 5. Draw floating images from template data (background-removed images, etc.) - ON TOP of slot photos
      const floatingImages = template.images
        .filter((img) => !img.slotId && (img.isVisible ?? true))
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

      for (const image of floatingImages) {
        console.log(`🖼️ Drawing floating template image ${image.id} at position (${image.x}, ${image.y})`);
        const img = await loadImage(image.dataUrl, t);
        ctx.save();
        ctx.translate(
          image.x + (image.width * image.scaleX) / 2,
          image.y + (image.height * image.scaleY) / 2,
        );
        ctx.rotate((image.rotation * Math.PI) / 180);
        ctx.globalAlpha = image.opacity ?? 1;
        ctx.drawImage(
          img,
          -(image.width * image.scaleX) / 2,
          -(image.height * image.scaleY) / 2,
          image.width * image.scaleX,
          image.height * image.scaleY,
        );
        ctx.restore();
      }

      // 6. Draw frame border (on top of everything)
      ctx.strokeStyle = template.layout.frame.color;
      ctx.lineWidth = template.layout.frame.thickness;
      ctx.strokeRect(
        template.layout.frame.thickness / 2,
        template.layout.frame.thickness / 2,
        template.layout.canvas.width - template.layout.frame.thickness,
        template.layout.canvas.height - template.layout.frame.thickness
      );

      const final = canvas.toDataURL("image/png");
      setFinalImage(final);
      setStatus("finished");
      setStage("arrange");
    } catch (error) {
      console.error(error);
      setStreamError(t("error.imageLoadError"));
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
    template.stickers,
    template.images,
    template.texts,
    template.layout.frame.color,
    template.layout.frame.thickness,
    t,
  ]);


  const canGenerateFinalImage = useMemo(
    () =>
      slots.length > 0 &&
      (
        // Allow if at least one slot is assigned
        slots.some((slot) => {
          const shotIndex = slotAssignments[slot.id];
          return typeof shotIndex === "number" && Boolean(capturedShots[shotIndex]);
        }) ||
        // Or if there are floating images from the editor
        (template.images && template.images.filter(img => !img.slotId).length > 0)
      ),
    [capturedShots, slotAssignments, slots, template.images],
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
    if (!canGenerateFinalImage) {
      setArrangementError(t("booth.photoArrangementDesc"));
      return;
    }
    setArrangementError(null);
    await composeFinalImage();
  }, [composeFinalImage, canGenerateFinalImage, t]);

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
      setArrangementError(t("booth.photoArrangementDesc"));
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
      setStreamError(t("error.cameraPermissionNeeded"));
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
        return t("status.countdownActive");
      case "capturing":
        return t("status.captureInProgress");
      case "waiting":
        return t("status.waitingBetweenShots");
      case "processing":
        return t("status.composingResult");
      case "arranging":
        return t("status.shootingComplete");
      case "finished":
        return t("status.allComplete");
      default:
        return hasCameraAccess
          ? t("status.ready")
          : t("status.needPermission");
    }
  })();

  if (stage === "arrange") {
    // Show loading screen during composition
    if (isComposing && !finalImage) {
      const loadingMessages = [
        "Preparing...",
        "Structuring your masterpiece...",
        "Processing photos...",
        "Adding final touches..."
      ];

      return (
        <BoothAppShell
          canvasRef={canvasRef}
          canvasWidth={template.layout.canvas.width}
          canvasHeight={template.layout.canvas.height}
        >
          {/* Beautiful gradient background */}
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
            <div className="max-w-md mx-auto text-center px-6">
              {/* Floating card */}
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-10 shadow-xl ring-1 ring-white/20 border border-white/30">
                {/* Animated loader */}
                <div className="relative mx-auto w-20 h-20 mb-8">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-slate-200 to-slate-300"></div>
                  <div className="absolute inset-1 rounded-full bg-white"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-transparent bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-border animate-spin">
                    <div className="absolute inset-1 rounded-full bg-white"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-slate-900 to-slate-700 opacity-20 animate-pulse"></div>
                  </div>
                </div>

                {/* Animated title */}
                <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent mb-6">
                  Creating Magic ✨
                </h2>

                {/* Smooth message transitions */}
                <div className="relative h-8 mb-8 overflow-hidden">
                  {loadingMessages.map((message, index) => (
                    <p
                      key={index}
                      className={`absolute inset-x-0 text-lg font-medium text-slate-600 transition-all duration-700 ease-in-out ${
                        index === loadingStep
                          ? 'opacity-100 translate-y-0'
                          : index < loadingStep
                          ? 'opacity-0 -translate-y-8'
                          : 'opacity-0 translate-y-8'
                      }`}
                    >
                      {message}
                    </p>
                  ))}
                </div>

                {/* Elegant progress bar */}
                <div className="w-full bg-gradient-to-r from-slate-100 to-slate-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-full transition-all duration-1000 ease-out shadow-sm"
                    style={{ width: `${(loadingStep / 3) * 100}%` }}
                  >
                    <div className="h-full bg-gradient-to-r from-white/30 to-transparent rounded-full"></div>
                  </div>
                </div>

                {/* Step indicators */}
                <div className="flex justify-center space-x-2 mt-6">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`w-2 h-2 rounded-full transition-all duration-500 ${
                        step <= loadingStep
                          ? 'bg-slate-900 scale-110'
                          : 'bg-slate-300 scale-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </BoothAppShell>
      );
    }

    // Show dedicated result page when final image is ready
    if (finalImage) {
      return (
        <BoothAppShell
          canvasRef={canvasRef}
          canvasWidth={template.layout.canvas.width}
          canvasHeight={template.layout.canvas.height}
        >
          {/* Subtle celebration animation */}
          <style jsx>{`
            @keyframes gentleFloat {
              0%, 100% {
                opacity: 0.6;
                transform: translateY(0px) scale(1);
              }
              50% {
                opacity: 1;
                transform: translateY(-10px) scale(1.1);
              }
            }
            .celebration-emoji {
              animation: gentleFloat 2s ease-in-out infinite;
            }
          `}</style>

          {/* Minimal floating emojis */}
          <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={`emoji-${i}`}
                className="absolute celebration-emoji text-2xl"
                style={{
                  left: `${15 + i * 15}%`,
                  top: `${10 + (i % 3) * 30}%`,
                  animationDelay: `${i * 0.3}s`,
                }}
              >
                {['🎉', '✨', '🎊', '🌟', '💫', '🎈'][i]}
              </div>
            ))}
          </div>

          <div className="min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-md mx-auto">
              {/* Success message */}
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🎉</div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                  Perfect!
                </h1>
                <p className="text-slate-600">
                  Your photo is ready to download
                </p>
              </div>

              {/* Clean image container */}
              <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
                <img
                  src={finalImage}
                  alt="Your final photo"
                  className="w-full h-auto rounded-xl shadow-md"
                  style={{ maxHeight: '60vh', objectFit: 'contain' }}
                />
              </div>

              {/* Clean action buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-4 px-6 rounded-xl text-base font-semibold hover:bg-slate-800 transition-colors shadow-lg"
                  onClick={handleDownload}
                >
                  <Download className="h-5 w-5" />
                  Download Photo
                </button>

                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-4 px-6 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors shadow-lg"
                  onClick={() => {
                    window.location.href = `/editor?slug=${template.slug}`;
                  }}
                >
                  <Edit className="h-5 w-5" />
                  Edit Frame
                </button>

                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-3 bg-slate-100 text-slate-700 py-4 px-6 rounded-xl text-base font-semibold hover:bg-slate-200 transition-colors"
                  onClick={() => {
                    setFinalImage(null);
                    setStatus("waiting");
                    setStage("capture");
                    setCapturedShots([]);
                    setSlotAssignments({});
                    setIsComposing(false);
                    setLoadingStep(0);
                  }}
                >
                  <RotateCcw className="h-5 w-5" />
                  Take New Photos
                </button>
              </div>
            </div>
          </div>
        </BoothAppShell>
      );
    }

    const canvasWidth = template.layout.canvas.width;
    const canvasHeight = template.layout.canvas.height;
    const canvasAspectRatio = canvasWidth / canvasHeight;
    const assignedSlotCount = slots.filter(
      (slot) => slotAssignments[slot.id] !== null,
    ).length;
    const widthScale = Math.min(MAX_PREVIEW_WIDTH / canvasWidth, 1);
    const heightScale = Math.min(MAX_PREVIEW_HEIGHT / canvasHeight, 1);
    const scale = Math.min(widthScale, heightScale);
    const displayWidth = canvasWidth * scale;
    const displayHeight = canvasHeight * scale;
    const slotScaleX = displayWidth / canvasWidth;
    const slotScaleY = displayHeight / canvasHeight;
    const frameContainerStyle: CSSProperties = {
      aspectRatio: canvasAspectRatio,
      width: `${displayWidth}px`,
      height: `${displayHeight}px`,
      maxWidth: "100%",
      backgroundColor: "transparent",
    };

    return (
      <BoothAppShell
        canvasRef={canvasRef}
        canvasWidth={template.layout.canvas.width}
        canvasHeight={template.layout.canvas.height}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t("booth.photoArrangement")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("booth.photoArrangementDesc")}
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {assignedSlotCount}/{slots.length} {t("booth.slotsCompleted")}
              </span>
            </div>

            {arrangementError ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{arrangementError}</span>
              </div>
            ) : null}

            <div className="mt-5 rounded-2xl bg-slate-100 p-4 max-h-[60vh] overflow-auto">
              <div
                className="relative mx-auto overflow-hidden rounded-2xl shadow-inner"
                style={frameContainerStyle}
              >
                {/* Reconstruct frame from template data instead of overlay */}
                <div
                  className="absolute inset-0 z-0"
                  style={{
                    backgroundColor: template.layout.frame.backgroundColor,
                    borderRadius: `${template.layout.frame.cornerRadius * Math.min(slotScaleX, slotScaleY)}px`
                  }}
                />


                {/* Render stickers from template */}
                {template.stickers.map((sticker) => (
                  <img
                    key={sticker.id}
                    src={sticker.dataUrl}
                    alt={sticker.name}
                    className="absolute pointer-events-none z-[10]"
                    style={{
                      left: `${sticker.x * slotScaleX}px`,
                      top: `${sticker.y * slotScaleY}px`,
                      width: `${sticker.width * sticker.scaleX * slotScaleX}px`,
                      height: `${sticker.height * sticker.scaleY * slotScaleY}px`,
                      transform: `rotate(${sticker.rotation}deg)`,
                    }}
                  />
                ))}

                {/* Render text elements from template */}
                {template.texts?.map((text) => (
                  <div
                    key={text.id}
                    className="absolute pointer-events-none z-[10]"
                    style={{
                      left: `${text.x * slotScaleX}px`,
                      top: `${text.y * slotScaleY}px`,
                      width: `${text.width * slotScaleX}px`,
                      fontSize: `${text.fontSize * Math.min(slotScaleX, slotScaleY)}px`,
                      color: text.color,
                      fontFamily: text.fontFamily,
                      textAlign: text.align,
                      transform: `rotate(${text.rotation}deg)`,
                    }}
                  >
                    {text.content}
                  </div>
                ))}

                {slots.map((slot) => {
                  const slotLeft = slot.x * slotScaleX;
                  const slotTop = slot.y * slotScaleY;
                  const slotWidth = slot.width * slotScaleX;
                  const slotHeight = slot.height * slotScaleY;
                  const slotCornerRadiusPx =
                    template.layout.frame.cornerRadius * slotScaleX;
                  const assignedIndex = slotAssignments[slot.id];
                  const assignedImage =
                    typeof assignedIndex === "number"
                      ? capturedShots[assignedIndex]
                      : null;
                  const isActive = activeSlotId === slot.id;
                  return (
                    <div
                      key={slot.id}
                      className={`absolute z-[50] flex cursor-pointer items-center justify-center overflow-hidden transition ${
                        assignedImage
                          ? ""
                          : "border border-dashed border-white/50 bg-white/20"
                      } ${isActive ? "ring-2 ring-white/80" : ""}`}
                        style={{
                          left: `${slotLeft}px`,
                          top: `${slotTop}px`,
                          width: `${slotWidth}px`,
                          height: `${slotHeight}px`,
                          borderRadius: `${slotCornerRadiusPx}px`,
                        }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleSlotDrop(event, slot.id)}
                      onClick={() => setActiveSlotId(slot.id)}
                    >
                      {assignedImage ? (
                        <>
                          <img
                            src={assignedImage}
                            alt={t("booth.selectedPhoto")}
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
                            {t("booth.clear")}
                          </button>
                        </>
                      ) : (
                        <span className="select-none px-2 text-center text-[10px] font-semibold text-white/70">
                          {t("booth.dragToPlace")}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Render floating images from template (background-removed images, etc.) - AFTER slots to be in front */}
                {template.images.filter(img => !img.slotId).map((image) => (
                  <img
                    key={image.id}
                    src={image.dataUrl}
                    alt="Template element"
                    className="absolute pointer-events-none z-[55]"
                    style={{
                      left: `${image.x * slotScaleX}px`,
                      top: `${image.y * slotScaleY}px`,
                      width: `${image.width * image.scaleX * slotScaleX}px`,
                      height: `${image.height * image.scaleY * slotScaleY}px`,
                      transform: `rotate(${image.rotation}deg)`,
                    }}
                  />
                ))}

                {/* Frame border - rendered last to be on top */}
                <div
                  className="absolute inset-0 z-[60] pointer-events-none"
                  style={{
                    border: `${template.layout.frame.thickness * Math.min(slotScaleX, slotScaleY)}px solid ${template.layout.frame.color}`,
                    borderRadius: `${template.layout.frame.cornerRadius * Math.min(slotScaleX, slotScaleY)}px`
                  }}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                onClick={handleConfirmArrangement}
                disabled={!canGenerateFinalImage || isComposing}
              >
                {isComposing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : ( 
                  <Check className="h-4 w-4" />
                )}
                {t("booth.confirmArrangement")}
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4" />
                {t("booth.reshoot")}
              </button>
            </div>

            {isComposing ? (
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("booth.composing")}
              </div>
            ) : null}

          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              {t("booth.capturedPhotos")}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {t("booth.capturedPhotosDesc")} ({capturedShots.filter(Boolean).length}
              /{captureCount} {t("booth.cuts")})
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
                        alt={`${index + 1}${t("editor.shotNumber")}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-1 items-center justify-center">
                        {t("booth.waitingForShoot")}
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                      #{index + 1}
                    </span>
                    {isUsed ? (
                      <span className="absolute right-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {t("booth.inUse")}
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
                opacity: 1,
                transform: 'scaleX(-1)' // Flip camera preview horizontally
              }}
            />
            {/** Permission overlay */}
            {!hasCameraAccess ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center text-white">
                <p className="text-sm leading-relaxed text-slate-200">
                  {t("booth.cameraPermissionNeeded")}
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
                      {t("booth.requesting")}
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" />
                      {t("booth.requestCameraPermission")}
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
              {t("booth.totalShotsInfo")} {captureCount}{t("booth.totalShotsInfo2")} {slots.length}{t("booth.totalShotsInfo3")}
            </p>
            <p className="mt-3 rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-600">
              {statusLabel}
            </p>
            {stage === "capture" ? (
              <p className="mt-1 text-xs font-medium text-slate-500">
                {t("booth.progress")} {Math.min(currentShotIndex + 1, captureCount)}/{captureCount}
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
                    {t("booth.requesting")}
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    {t("booth.requestCameraPermission")}
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
                  {t("status.captureInProgress")}
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  {t("booth.startShooting")}
                </>
              )}
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-500 transition hover:border-slate-900 hover:text-slate-900"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
              {t("booth.reshoot")}
            </button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              {t("booth.capturedPhotos")}
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
                        alt={`${index + 1}${t("editor.shotNumber")}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center text-xs text-slate-400">
                        {index + 1}{t("editor.shotNumber")} {t("booth.waitingForShoot")}
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
