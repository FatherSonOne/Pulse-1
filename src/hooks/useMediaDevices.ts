// useMediaDevices Hook - Enumerate and manage audio/video devices
// Provides reactive device lists with permission handling

import { useState, useEffect, useCallback, useRef } from 'react';

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
  groupId: string;
}

export interface UseMediaDevicesReturn {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
  requestPermission: (type?: 'audio' | 'video' | 'both') => Promise<boolean>;
  refresh: () => Promise<void>;
  getDeviceById: (deviceId: string) => MediaDeviceInfo | undefined;
}

export function useMediaDevices(): UseMediaDevicesReturn {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const aIn: MediaDeviceInfo[] = [];
      const aOut: MediaDeviceInfo[] = [];
      const vIn: MediaDeviceInfo[] = [];

      devices.forEach((device, index) => {
        const info: MediaDeviceInfo = {
          deviceId: device.deviceId,
          label: device.label || `${device.kind} ${index + 1}`,
          kind: device.kind as MediaDeviceInfo['kind'],
          groupId: device.groupId,
        };

        if (device.kind === 'audioinput') {
          aIn.push(info);
        } else if (device.kind === 'audiooutput') {
          aOut.push(info);
        } else if (device.kind === 'videoinput') {
          vIn.push(info);
        }
      });

      setAudioInputs(aIn);
      setAudioOutputs(aOut);
      setVideoInputs(vIn);

      // If we have labels, we have permission
      const hasLabels = devices.some(d => d.label && d.label.length > 0);
      setHasPermission(hasLabels);

      return hasLabels;
    } catch (err) {
      console.error('Error enumerating devices:', err);
      setError('Failed to enumerate devices');
      return false;
    }
  }, []);

  const requestPermission = useCallback(async (type: 'audio' | 'video' | 'both' = 'both'): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      cleanupStream();

      const constraints: MediaStreamConstraints = {};
      if (type === 'audio' || type === 'both') constraints.audio = true;
      if (type === 'video' || type === 'both') constraints.video = true;

      // Request permission by getting media stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Now enumerate with labels
      const hasLabels = await enumerateDevices();

      // Stop stream after getting device labels
      cleanupStream();

      setHasPermission(hasLabels);
      setIsLoading(false);
      return hasLabels;
    } catch (err: any) {
      console.error('Permission request failed:', err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Permission denied. Please allow access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No devices found. Please connect a microphone or camera.');
      } else {
        setError(`Failed to access devices: ${err.message}`);
      }

      setHasPermission(false);
      setIsLoading(false);
      return false;
    }
  }, [enumerateDevices, cleanupStream]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await enumerateDevices();
    setIsLoading(false);
  }, [enumerateDevices]);

  const getDeviceById = useCallback((deviceId: string): MediaDeviceInfo | undefined => {
    return [...audioInputs, ...audioOutputs, ...videoInputs].find(d => d.deviceId === deviceId);
  }, [audioInputs, audioOutputs, videoInputs]);

  // Initial enumeration
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await enumerateDevices();
      setIsLoading(false);
    };

    init();

    // Listen for device changes (plug/unplug)
    const handleDeviceChange = () => {
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      cleanupStream();
    };
  }, [enumerateDevices, cleanupStream]);

  return {
    audioInputs,
    audioOutputs,
    videoInputs,
    isLoading,
    error,
    hasPermission,
    requestPermission,
    refresh,
    getDeviceById,
  };
}

export default useMediaDevices;
