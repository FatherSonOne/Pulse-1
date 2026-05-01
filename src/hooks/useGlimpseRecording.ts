// useGlimpseRecording Hook - Video recording with cam OR cam+screen capture.
// In cam-screen mode, a canvas-based compositor draws the screen track as the
// background and the cam track as a PIP overlay; the resulting MediaStream is
// what gets previewed AND recorded, so the saved file already has the PIP baked
// in. The audio track always comes from the cam (voice), never the screen.

import { useState, useRef, useCallback, useEffect } from 'react';
import { GlimpseRecordingState } from '../services/glimpse/glimpseTypes';

export type GlimpseCaptureMode = 'cam' | 'cam-screen';
export type GlimpsePipCorner = 'tl' | 'tr' | 'bl' | 'br';

export interface UseGlimpseRecordingOptions {
  maxDuration?: number;
  videoQuality?: '480p' | '720p' | '1080p';
  facingMode?: 'user' | 'environment';
  captureMode?: GlimpseCaptureMode;
  pipCorner?: GlimpsePipCorner;
  onRecordingComplete?: (blob: Blob, thumbnail: Blob) => void;
  onError?: (error: string) => void;
  /**
   * Fired when a screen-share session ends. `reason` distinguishes a
   * user-cancel at the picker (no share ever started) from an ended track
   * mid-recording (the user clicked the browser's "Stop sharing" bar).
   */
  onScreenShareEnded?: (reason: 'user-cancel' | 'track-ended') => void;
}

export interface UseGlimpseRecordingReturn {
  state: GlimpseRecordingState;
  stream: MediaStream | null;
  isRecording: boolean;
  isPreviewing: boolean;
  duration: number;
  previewUrl: string | null;

  captureMode: GlimpseCaptureMode;
  setCaptureMode: (mode: GlimpseCaptureMode) => void;
  pipCorner: GlimpsePipCorner;
  swapPipCorner: () => void;
  mirrorPreview: boolean;

  startPreview: () => Promise<boolean>;
  stopPreview: () => void;
  flipCamera: () => Promise<void>;

  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;

  discardRecording: () => void;
  getRecording: () => { video: Blob; thumbnail: Blob } | null;

  videoRef: React.RefObject<HTMLVideoElement>;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
}

const VIDEO_CONSTRAINTS: Record<string, MediaTrackConstraints> = {
  '480p': { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
  '720p': { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
};

// Output composited canvas size — caps screen tracks (which can arrive at 4K+
// on retina monitors) so the encoder doesn't choke and uploads stay reasonable.
const COMPOSITE_DIMS: Record<string, { width: number; height: number }> = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

const DEFAULT_OPTIONS: UseGlimpseRecordingOptions = {
  maxDuration: 60,
  videoQuality: '720p',
  facingMode: 'user',
  captureMode: 'cam',
  pipCorner: 'br',
};

interface CompositorRefs {
  canvas: HTMLCanvasElement;
  camVideo: HTMLVideoElement;
  screenVideo: HTMLVideoElement;
  ctx: CanvasRenderingContext2D;
  rafId: number;
  width: number;
  height: number;
  cancelled: boolean;
}

export function useGlimpseRecording(options: UseGlimpseRecordingOptions = {}): UseGlimpseRecordingReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [state, setState] = useState<GlimpseRecordingState>({
    status: 'idle',
    duration: 0,
    maxDuration: opts.maxDuration || 60,
    videoBlob: null,
    thumbnailBlob: null,
    previewUrl: null,
    error: null,
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(opts.facingMode || 'user');
  const [captureMode, setCaptureModeState] = useState<GlimpseCaptureMode>(opts.captureMode || 'cam');
  const [pipCorner, setPipCorner] = useState<GlimpsePipCorner>(opts.pipCorner || 'br');

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Sources for compositing; kept on refs so cleanup can find them.
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const compositorRef = useRef<CompositorRefs | null>(null);
  const pipCornerRef = useRef<GlimpsePipCorner>(pipCorner);
  pipCornerRef.current = pipCorner;

  // ============================================
  // INTERNAL: stream + compositor lifecycle
  // ============================================

  const stopAllSourceTracks = useCallback(() => {
    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
  }, []);

  const tearDownCompositor = useCallback(() => {
    if (compositorRef.current) {
      compositorRef.current.cancelled = true;
      cancelAnimationFrame(compositorRef.current.rafId);
      try {
        compositorRef.current.camVideo.pause();
        compositorRef.current.screenVideo.pause();
        compositorRef.current.camVideo.srcObject = null;
        compositorRef.current.screenVideo.srcObject = null;
      } catch {
        // ignore
      }
      compositorRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  // ============================================
  // INTERNAL: cam-screen compositor
  // ============================================

  const buildCompositedStream = useCallback(
    async (camStream: MediaStream, screenStream: MediaStream): Promise<MediaStream> => {
      const dims = COMPOSITE_DIMS[opts.videoQuality || '720p'];
      const canvas = document.createElement('canvas');
      canvas.width = dims.width;
      canvas.height = dims.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas 2d context not available');

      const camVideo = document.createElement('video');
      camVideo.srcObject = camStream;
      camVideo.muted = true;
      camVideo.playsInline = true;

      const screenVideo = document.createElement('video');
      screenVideo.srcObject = screenStream;
      screenVideo.muted = true;
      screenVideo.playsInline = true;

      // Wait for both sources to have dimensions before drawing
      await Promise.all([
        new Promise<void>((res) => {
          if (camVideo.readyState >= 2) return res();
          camVideo.onloadeddata = () => res();
        }),
        new Promise<void>((res) => {
          if (screenVideo.readyState >= 2) return res();
          screenVideo.onloadeddata = () => res();
        }),
      ]);

      await Promise.all([camVideo.play(), screenVideo.play()]);

      const refs: CompositorRefs = {
        canvas,
        camVideo,
        screenVideo,
        ctx,
        rafId: 0,
        width: dims.width,
        height: dims.height,
        cancelled: false,
      };

      const draw = () => {
        if (refs.cancelled) return;
        const w = refs.width;
        const h = refs.height;

        // Background fill (in case screen content has letterboxing)
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        // Screen as background, contain-fit (preserve aspect)
        if (refs.screenVideo.videoWidth > 0) {
          const sw = refs.screenVideo.videoWidth;
          const sh = refs.screenVideo.videoHeight;
          const scale = Math.min(w / sw, h / sh);
          const dw = sw * scale;
          const dh = sh * scale;
          const dx = (w - dw) / 2;
          const dy = (h - dh) / 2;
          ctx.drawImage(refs.screenVideo, dx, dy, dw, dh);
        }

        // Cam as PIP, ~22% width, mirrored, in the active corner
        if (refs.camVideo.videoWidth > 0) {
          const cw = refs.camVideo.videoWidth;
          const ch = refs.camVideo.videoHeight;
          const pipW = Math.round(w * 0.22);
          const pipH = Math.round(pipW * (ch / cw));
          const margin = Math.round(w * 0.018);

          const corner = pipCornerRef.current;
          const x =
            corner === 'tl' || corner === 'bl' ? margin : w - pipW - margin;
          const y =
            corner === 'tl' || corner === 'tr' ? margin : h - pipH - margin;

          // Coral border behind PIP
          ctx.fillStyle = '#f43f5e';
          ctx.fillRect(x - 2, y - 2, pipW + 4, pipH + 4);

          // Rounded clip + mirror cam
          const r = 12;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + pipW, y, x + pipW, y + pipH, r);
          ctx.arcTo(x + pipW, y + pipH, x, y + pipH, r);
          ctx.arcTo(x, y + pipH, x, y, r);
          ctx.arcTo(x, y, x + pipW, y, r);
          ctx.closePath();
          ctx.clip();
          ctx.translate(x + pipW, y);
          ctx.scale(-1, 1);
          ctx.drawImage(refs.camVideo, 0, 0, pipW, pipH);
          ctx.restore();
        }

        refs.rafId = requestAnimationFrame(draw);
      };

      refs.rafId = requestAnimationFrame(draw);
      compositorRef.current = refs;

      // Captured at 30 FPS to match VIDEO_CONSTRAINTS
      const captured = (canvas as HTMLCanvasElement & {
        captureStream?: (frameRate?: number) => MediaStream;
      }).captureStream?.(30);
      if (!captured) throw new Error('canvas.captureStream is not supported in this browser');

      // Audio always from cam (voice) — never screen audio
      const camAudio = camStream.getAudioTracks()[0];
      if (camAudio) captured.addTrack(camAudio);

      return captured;
    },
    [opts.videoQuality]
  );

  // ============================================
  // CAMERA / SCREEN — start/stop preview
  // ============================================

  const startCamOnlyPreview = useCallback(async (): Promise<boolean> => {
    cleanup();
    tearDownCompositor();
    stopAllSourceTracks();

    try {
      setState((prev) => ({ ...prev, status: 'previewing', error: null }));

      const constraints: MediaStreamConstraints = {
        video: {
          ...VIDEO_CONSTRAINTS[opts.videoQuality || '720p'],
          facingMode: { ideal: facingMode },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      const camStream = await navigator.mediaDevices.getUserMedia(constraints);
      camStreamRef.current = camStream;
      setStream(camStream);

      if (videoRef.current) {
        videoRef.current.srcObject = camStream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      return true;
    } catch (error: any) {
      console.error('Failed to start cam preview:', error);
      const errorMessage =
        error.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow access in your browser settings.'
          : error.name === 'NotFoundError'
          ? 'No camera found. Connect one and try again.'
          : `Camera unavailable: ${error.message}`;

      setState((prev) => ({ ...prev, status: 'idle', error: errorMessage }));
      opts.onError?.(errorMessage);
      return false;
    }
  }, [facingMode, opts, cleanup, stopAllSourceTracks, tearDownCompositor]);

  const startCamScreenPreview = useCallback(async (): Promise<boolean> => {
    cleanup();
    tearDownCompositor();
    stopAllSourceTracks();

    try {
      setState((prev) => ({ ...prev, status: 'previewing', error: null }));

      // Order matters: getDisplayMedia REQUIRES transient user activation,
      // and getUserMedia consumes that activation when it resolves. Asking
      // for the screen FIRST keeps the click gesture intact for the picker;
      // the camera prompt that follows is more lenient on activation.
      if (typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        throw new Error('Screen capture is not supported in this browser');
      }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = screenStream;

      // Cam track second.
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...VIDEO_CONSTRAINTS[opts.videoQuality || '720p'],
          facingMode: { ideal: facingMode },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      camStreamRef.current = camStream;

      // If the user clicks the browser's "Stop sharing" UI, fall back to cam.
      const screenTrack = screenStream.getVideoTracks()[0];
      if (screenTrack) {
        screenTrack.onended = async () => {
          opts.onScreenShareEnded?.('track-ended');
          // If we are still in this mode, drop back to cam-only seamlessly.
          tearDownCompositor();
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
          }
          // Restart cam-only preview using existing cam track if available
          if (camStreamRef.current) {
            setStream(camStreamRef.current);
            if (videoRef.current) {
              videoRef.current.srcObject = camStreamRef.current;
              try {
                await videoRef.current.play();
              } catch {
                /* ignore */
              }
            }
          }
          setCaptureModeState('cam');
        };
      }

      const composite = await buildCompositedStream(camStream, screenStream);
      setStream(composite);

      if (videoRef.current) {
        videoRef.current.srcObject = composite;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      return true;
    } catch (error: any) {
      // Tear down any partial state
      tearDownCompositor();
      stopAllSourceTracks();

      // User-cancel from the screen-share picker is a normal action, not an
      // error. Chrome reports it as `NotAllowedError: Permission denied by
      // user`. Distinguish that from a true permission-deny / unsupported case
      // and route through the soft-cancel path with a calm toast.
      const message: string = error?.message || '';
      const isUserCancel =
        error?.name === 'NotAllowedError' &&
        (/Permission denied by user/i.test(message) ||
          /Permission denied by system/i.test(message));

      if (isUserCancel) {
        setState((prev) => ({ ...prev, status: 'idle', error: null }));
        opts.onScreenShareEnded?.('user-cancel');
        return false;
      }

      console.error('Failed to start cam+screen preview:', error);

      const errorMessage =
        error?.name === 'NotAllowedError'
          ? 'Permission denied. Allow camera and screen sharing to use this mode.'
          : message.includes('not supported')
          ? message
          : `Capture unavailable: ${message || 'unknown error'}`;

      setState((prev) => ({ ...prev, status: 'idle', error: errorMessage }));
      opts.onError?.(errorMessage);
      return false;
    }
  }, [
    facingMode,
    opts,
    cleanup,
    stopAllSourceTracks,
    tearDownCompositor,
    buildCompositedStream,
  ]);

  const startPreview = useCallback(async (): Promise<boolean> => {
    if (captureMode === 'cam-screen') return startCamScreenPreview();
    return startCamOnlyPreview();
  }, [captureMode, startCamOnlyPreview, startCamScreenPreview]);

  const stopPreview = useCallback(() => {
    cleanup();
    tearDownCompositor();
    stopAllSourceTracks();

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);

    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    setState({
      status: 'idle',
      duration: 0,
      maxDuration: opts.maxDuration || 60,
      videoBlob: null,
      thumbnailBlob: null,
      previewUrl: null,
      error: null,
    });
  }, [state.previewUrl, opts.maxDuration, cleanup, stopAllSourceTracks, tearDownCompositor]);

  // Flip camera — only meaningful in cam-only mode (would also flip the PIP,
  // but it's typically the front cam in cam-screen and rarely needs flipping).
  const flipCamera = useCallback(async () => {
    if (captureMode === 'cam-screen') return; // No-op
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);

    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          ...VIDEO_CONSTRAINTS[opts.videoQuality || '720p'],
          facingMode: { ideal: newFacingMode },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      camStreamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Failed to flip camera:', error);
      opts.onError?.('Failed to switch camera');
    }
  }, [captureMode, facingMode, opts]);

  // ============================================
  // THUMBNAIL
  // ============================================

  const generateThumbnail = useCallback((video: HTMLVideoElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to create canvas context'));
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to generate thumbnail'));
        },
        'image/jpeg',
        0.85
      );
    });
  }, []);

  // ============================================
  // RECORDING
  // ============================================

  const startRecording = useCallback(() => {
    if (!stream || state.status !== 'previewing') return;

    chunksRef.current = [];
    startTimeRef.current = Date.now();

    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];

    let selectedMimeType = '';
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        break;
      }
    }

    if (!selectedMimeType) {
      setState((prev) => ({ ...prev, error: 'No supported video format found' }));
      return;
    }

    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: captureMode === 'cam-screen' ? 4_000_000 : 2_500_000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setState((prev) => ({ ...prev, status: 'processing' }));

        const videoBlob = new Blob(chunksRef.current, { type: selectedMimeType });
        const videoUrl = URL.createObjectURL(videoBlob);

        let thumbnailBlob: Blob | null = null;
        try {
          if (videoRef.current) {
            thumbnailBlob = await generateThumbnail(videoRef.current);
          }
        } catch (e) {
          console.warn('Failed to generate thumbnail:', e);
        }

        setState((prev) => ({
          ...prev,
          status: 'ready',
          videoBlob,
          thumbnailBlob,
          previewUrl: videoUrl,
        }));

        if (thumbnailBlob) {
          opts.onRecordingComplete?.(videoBlob, thumbnailBlob);
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        console.error('MediaRecorder error:', event);
        setState((prev) => ({ ...prev, status: 'previewing', error: 'Recording failed' }));
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);

      setState((prev) => ({ ...prev, status: 'recording', duration: 0, error: null }));

      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setState((prev) => {
          if (elapsed >= prev.maxDuration) {
            stopRecording();
            return { ...prev, duration: prev.maxDuration };
          }
          return { ...prev, duration: elapsed };
        });
      }, 100);
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      setState((prev) => ({ ...prev, error: `Failed to start recording: ${error.message}` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, state.status, opts, generateThumbnail, captureMode]);

  const stopRecording = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState((prev) => ({ ...prev, status: 'paused' }));

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      const pausedDuration = state.duration;
      startTimeRef.current = Date.now() - pausedDuration * 1000;

      mediaRecorderRef.current.resume();
      setState((prev) => ({ ...prev, status: 'recording' }));

      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setState((prev) => {
          if (elapsed >= prev.maxDuration) {
            stopRecording();
            return { ...prev, duration: prev.maxDuration };
          }
          return { ...prev, duration: elapsed };
        });
      }, 100);
    }
  }, [state.duration, stopRecording]);

  const discardRecording = useCallback(() => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    setState((prev) => ({
      ...prev,
      status: 'previewing',
      duration: 0,
      videoBlob: null,
      thumbnailBlob: null,
      previewUrl: null,
      error: null,
    }));

    chunksRef.current = [];
  }, [state.previewUrl]);

  const getRecording = useCallback(() => {
    if (state.videoBlob && state.thumbnailBlob) {
      return { video: state.videoBlob, thumbnail: state.thumbnailBlob };
    }
    return null;
  }, [state.videoBlob, state.thumbnailBlob]);

  // ============================================
  // PUBLIC: capture mode + PIP corner
  // ============================================

  const setCaptureMode = useCallback((mode: GlimpseCaptureMode) => {
    // Mode switching is only valid from idle. UI guards on the same condition.
    setCaptureModeState(mode);
  }, []);

  const swapPipCorner = useCallback(() => {
    setPipCorner((prev) => {
      const next: Record<GlimpsePipCorner, GlimpsePipCorner> = {
        br: 'bl',
        bl: 'tl',
        tl: 'tr',
        tr: 'br',
      };
      return next[prev];
    });
  }, []);

  // ============================================
  // CLEANUP ON UNMOUNT
  // ============================================

  useEffect(() => {
    return () => {
      cleanup();
      tearDownCompositor();
      stopAllSourceTracks();
      if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    stream,
    isRecording: state.status === 'recording',
    isPreviewing: state.status === 'previewing',
    duration: state.duration,
    previewUrl: state.previewUrl,

    captureMode,
    setCaptureMode,
    pipCorner,
    swapPipCorner,
    mirrorPreview: captureMode === 'cam',

    startPreview,
    stopPreview,
    flipCamera,

    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,

    discardRecording,
    getRecording,

    videoRef,
    previewVideoRef,
  };
}

export default useGlimpseRecording;
