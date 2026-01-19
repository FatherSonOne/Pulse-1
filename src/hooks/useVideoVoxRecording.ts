// useVideoVoxRecording Hook - Video recording with MediaRecorder API
// Manages camera stream, recording state, and video processing

import { useState, useRef, useCallback, useEffect } from 'react';
import { VideoVoxRecordingState } from '../services/voxer/voxModeTypes';

export interface UseVideoVoxRecordingOptions {
  maxDuration?: number;  // Maximum recording duration in seconds
  videoQuality?: '480p' | '720p' | '1080p';
  facingMode?: 'user' | 'environment';
  onRecordingComplete?: (blob: Blob, thumbnail: Blob) => void;
  onError?: (error: string) => void;
}

export interface UseVideoVoxRecordingReturn {
  // State
  state: VideoVoxRecordingState;
  stream: MediaStream | null;
  isRecording: boolean;
  isPreviewing: boolean;
  duration: number;
  previewUrl: string | null;

  // Camera controls
  startPreview: () => Promise<boolean>;
  stopPreview: () => void;
  flipCamera: () => Promise<void>;

  // Recording controls
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;

  // Post-recording
  discardRecording: () => void;
  getRecording: () => { video: Blob; thumbnail: Blob } | null;

  // Refs for video elements
  videoRef: React.RefObject<HTMLVideoElement>;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
}

const VIDEO_CONSTRAINTS: Record<string, MediaTrackConstraints> = {
  '480p': { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
  '720p': { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
};

const DEFAULT_OPTIONS: UseVideoVoxRecordingOptions = {
  maxDuration: 60,
  videoQuality: '720p',
  facingMode: 'user',
};

export function useVideoVoxRecording(options: UseVideoVoxRecordingOptions = {}): UseVideoVoxRecordingReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [state, setState] = useState<VideoVoxRecordingState>({
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  // Start camera preview
  const startPreview = useCallback(async (): Promise<boolean> => {
    cleanup();

    try {
      setState(prev => ({ ...prev, status: 'previewing', error: null }));

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

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      return true;
    } catch (error: any) {
      console.error('Failed to start preview:', error);
      const errorMessage = error.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow access in your browser settings.'
        : error.name === 'NotFoundError'
          ? 'No camera found. Please connect a camera and try again.'
          : `Failed to access camera: ${error.message}`;

      setState(prev => ({
        ...prev,
        status: 'idle',
        error: errorMessage,
      }));
      opts.onError?.(errorMessage);
      return false;
    }
  }, [facingMode, opts, cleanup]);

  // Stop camera preview
  const stopPreview = useCallback(() => {
    cleanup();

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Revoke preview URL if exists
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
  }, [stream, state.previewUrl, opts.maxDuration, cleanup]);

  // Flip camera (toggle facing mode)
  const flipCamera = useCallback(async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
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
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Failed to flip camera:', error);
      opts.onError?.('Failed to switch camera');
    }
  }, [facingMode, stream, opts]);

  // Generate thumbnail from video
  const generateThumbnail = useCallback((video: HTMLVideoElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to create canvas context'));
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to generate thumbnail'));
          }
        },
        'image/jpeg',
        0.8
      );
    });
  }, []);

  // Start recording
  const startRecording = useCallback(() => {
    if (!stream || state.status !== 'previewing') return;

    chunksRef.current = [];
    startTimeRef.current = Date.now();

    // Choose supported MIME type
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
      setState(prev => ({ ...prev, error: 'No supported video format found' }));
      return;
    }

    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setState(prev => ({ ...prev, status: 'processing' }));

        const videoBlob = new Blob(chunksRef.current, { type: selectedMimeType });
        const videoUrl = URL.createObjectURL(videoBlob);

        // Generate thumbnail
        let thumbnailBlob: Blob | null = null;
        try {
          if (videoRef.current) {
            thumbnailBlob = await generateThumbnail(videoRef.current);
          }
        } catch (e) {
          console.warn('Failed to generate thumbnail:', e);
        }

        setState(prev => ({
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
        setState(prev => ({ ...prev, status: 'previewing', error: 'Recording failed' }));
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms

      setState(prev => ({ ...prev, status: 'recording', duration: 0, error: null }));

      // Start duration timer
      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setState(prev => {
          if (elapsed >= prev.maxDuration) {
            // Auto-stop at max duration
            stopRecording();
            return { ...prev, duration: prev.maxDuration };
          }
          return { ...prev, duration: elapsed };
        });
      }, 100);
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      setState(prev => ({ ...prev, error: `Failed to start recording: ${error.message}` }));
    }
  }, [stream, state.status, opts, generateThumbnail]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState(prev => ({ ...prev, status: 'paused' }));

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      const pausedDuration = state.duration;
      startTimeRef.current = Date.now() - (pausedDuration * 1000);

      mediaRecorderRef.current.resume();
      setState(prev => ({ ...prev, status: 'recording' }));

      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setState(prev => {
          if (elapsed >= prev.maxDuration) {
            stopRecording();
            return { ...prev, duration: prev.maxDuration };
          }
          return { ...prev, duration: elapsed };
        });
      }, 100);
    }
  }, [state.duration, stopRecording]);

  // Discard recording
  const discardRecording = useCallback(() => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    setState(prev => ({
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

  // Get recording blobs
  const getRecording = useCallback(() => {
    if (state.videoBlob && state.thumbnailBlob) {
      return {
        video: state.videoBlob,
        thumbnail: state.thumbnailBlob,
      };
    }
    return null;
  }, [state.videoBlob, state.thumbnailBlob]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
      }
    };
  }, []);

  return {
    state,
    stream,
    isRecording: state.status === 'recording',
    isPreviewing: state.status === 'previewing',
    duration: state.duration,
    previewUrl: state.previewUrl,
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

export default useVideoVoxRecording;
