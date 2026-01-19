// VideoIOSettings Component - Video input device configuration
// "Control Room" aesthetic with live camera preview

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Camera,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  MonitorPlay,
  FlipHorizontal,
} from 'lucide-react';
import { useMediaDevices } from '../../../hooks/useMediaDevices';
import { settingsService, PulseSettings } from '../../../services/settingsService';

interface VideoIOSettingsProps {
  isDarkMode?: boolean;
  accentColor?: string;
}

const VIDEO_QUALITIES = [
  { id: '480p', name: '480p', description: 'Standard', resolution: '854×480' },
  { id: '720p', name: '720p HD', description: 'High Definition', resolution: '1280×720' },
  { id: '1080p', name: '1080p Full HD', description: 'Full HD', resolution: '1920×1080' },
];

export const VideoIOSettings: React.FC<VideoIOSettingsProps> = ({
  isDarkMode = false,
  accentColor = '#8B5CF6',
}) => {
  const { videoInputs, isLoading, hasPermission, requestPermission } = useMediaDevices();

  const [selectedCamera, setSelectedCamera] = useState('');
  const [videoQuality, setVideoQuality] = useState<'480p' | '720p' | '1080p'>('720p');
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [mirrorPreview, setMirrorPreview] = useState(true);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await settingsService.getAll();
      setSelectedCamera(settings.voxCameraDeviceId || '');
      setVideoQuality(settings.voxVideoQuality || '720p');
      setPreviewEnabled(settings.voxVideoPreviewEnabled ?? true);
      setMirrorPreview(settings.voxVideoMirror ?? true);
    };
    loadSettings();
  }, []);

  const saveSetting = async <K extends keyof PulseSettings>(key: K, value: PulseSettings[K]) => {
    await settingsService.set(key, value);
  };

  const stopPreview = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsPreviewActive(false);
  }, []);

  const startPreview = useCallback(async () => {
    setPreviewError(null);
    stopPreview();

    try {
      // Get resolution based on quality setting
      const resolutions = {
        '480p': { width: 854, height: 480 },
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 },
      };
      const res = resolutions[videoQuality];

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: res.width },
          height: { ideal: res.height },
          facingMode: 'user',
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsPreviewActive(true);
    } catch (err: any) {
      console.error('Camera preview error:', err);
      setPreviewError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied'
          : 'Failed to access camera'
      );
    }
  }, [selectedCamera, videoQuality, stopPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return stopPreview;
  }, [stopPreview]);

  // Restart preview when camera or quality changes
  useEffect(() => {
    if (isPreviewActive) {
      startPreview();
    }
  }, [selectedCamera, videoQuality]);

  const handleCameraChange = (deviceId: string) => {
    setSelectedCamera(deviceId);
    saveSetting('voxCameraDeviceId', deviceId);
  };

  const handleQualityChange = (quality: '480p' | '720p' | '1080p') => {
    setVideoQuality(quality);
    saveSetting('voxVideoQuality', quality);
  };

  const tc = {
    bg: isDarkMode ? 'bg-gray-900/60' : 'bg-white/80',
    cardBg: isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50/80',
    border: isDarkMode ? 'border-gray-700/50' : 'border-gray-200/60',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    inputBg: isDarkMode ? 'bg-gray-800/80' : 'bg-white',
    hoverBg: isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80',
  };

  return (
    <div className="space-y-6">
      {/* Permission Request */}
      {!hasPermission && (
        <div
          className={`p-4 rounded-xl border ${tc.border} ${tc.cardBg}`}
          style={{
            background: isDarkMode
              ? `linear-gradient(135deg, ${accentColor}10 0%, transparent 50%)`
              : `linear-gradient(135deg, ${accentColor}08 0%, transparent 50%)`
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${accentColor}20` }}
            >
              <Video className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h4 className={`font-semibold ${tc.text}`}>Camera Access Required</h4>
              <p className={`text-sm ${tc.textSecondary}`}>
                Allow access to see your camera devices
              </p>
            </div>
          </div>
          <button
            onClick={() => requestPermission('video')}
            className="w-full px-4 py-2.5 rounded-lg font-medium text-white transition-all"
            style={{
              background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
              boxShadow: `0 4px 14px ${accentColor}30`,
            }}
          >
            Grant Permission
          </button>
        </div>
      )}

      {/* Camera Preview */}
      <div className={`rounded-xl border ${tc.border} overflow-hidden`}>
        <div
          className="relative aspect-video bg-black flex items-center justify-center"
          style={{
            background: isDarkMode
              ? 'linear-gradient(135deg, #0a0a0f 0%, #1a1a25 100%)'
              : 'linear-gradient(135deg, #1a1a25 0%, #0a0a0f 100%)'
          }}
        >
          {isPreviewActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: mirrorPreview ? 'scaleX(-1)' : 'none' }}
            />
          ) : previewError ? (
            <div className="text-center p-4">
              <VideoOff className="w-12 h-12 mx-auto mb-2 text-red-400" />
              <p className="text-red-400 text-sm">{previewError}</p>
            </div>
          ) : (
            <div className="text-center p-4">
              <Camera className="w-12 h-12 mx-auto mb-2" style={{ color: accentColor, opacity: 0.5 }} />
              <p className={`${tc.textMuted} text-sm`}>Camera preview off</p>
            </div>
          )}

          {/* Preview Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={isPreviewActive ? stopPreview : startPreview}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: isPreviewActive ? 'rgba(239, 68, 68, 0.2)' : `${accentColor}30`,
                  color: isPreviewActive ? '#EF4444' : accentColor,
                }}
              >
                {isPreviewActive ? (
                  <>
                    <VideoOff className="w-4 h-4" />
                    Stop Preview
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4" />
                    Start Preview
                  </>
                )}
              </button>

              {isPreviewActive && (
                <button
                  onClick={() => {
                    setMirrorPreview(!mirrorPreview);
                    saveSetting('voxVideoMirror', !mirrorPreview);
                  }}
                  className="p-1.5 rounded-lg transition-all"
                  style={{
                    background: mirrorPreview ? `${accentColor}30` : 'rgba(255,255,255,0.1)',
                    color: mirrorPreview ? accentColor : 'white',
                  }}
                  title="Mirror preview"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              )}
            </div>

            {isPreviewActive && (
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono"
                style={{ background: 'rgba(0,0,0,0.5)', color: accentColor }}
              >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                LIVE
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Camera Selection */}
      <div className="space-y-3">
        <label className={`flex items-center gap-2 text-sm font-medium ${tc.text}`}>
          <Camera className="w-4 h-4" style={{ color: accentColor }} />
          Camera
        </label>
        <div className="relative">
          <select
            value={selectedCamera}
            onChange={(e) => handleCameraChange(e.target.value)}
            disabled={isLoading || !hasPermission}
            className={`w-full px-4 py-3 pr-10 rounded-xl border ${tc.border} ${tc.inputBg} ${tc.text} appearance-none cursor-pointer transition-all focus:outline-none focus:ring-2`}
          >
            <option value="">Default Camera</option>
            {videoInputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${tc.textMuted} pointer-events-none`} />
        </div>
      </div>

      {/* Video Quality */}
      <div className="space-y-3">
        <label className={`flex items-center gap-2 text-sm font-medium ${tc.text}`}>
          <MonitorPlay className="w-4 h-4" style={{ color: accentColor }} />
          Video Quality
        </label>
        <div className="grid grid-cols-3 gap-3">
          {VIDEO_QUALITIES.map((quality) => {
            const isSelected = videoQuality === quality.id;

            return (
              <button
                key={quality.id}
                onClick={() => handleQualityChange(quality.id as typeof videoQuality)}
                className={`relative p-3 rounded-xl border text-center transition-all ${
                  isSelected
                    ? ''
                    : `${tc.border} ${tc.cardBg} ${tc.hoverBg}`
                }`}
                style={isSelected ? {
                  background: `linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}05 100%)`,
                  borderColor: `${accentColor}50`,
                  boxShadow: `0 0 20px ${accentColor}15`,
                } : undefined}
              >
                {isSelected && (
                  <CheckCircle2
                    className="absolute top-2 right-2 w-3.5 h-3.5"
                    style={{ color: accentColor }}
                  />
                )}
                <h4 className={`font-semibold text-sm ${tc.text}`}>{quality.name}</h4>
                <p
                  className="text-[10px] font-mono mt-1"
                  style={{ color: isSelected ? accentColor : undefined }}
                >
                  {quality.resolution}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview Options */}
      <div className="space-y-3">
        <label className={`text-sm font-medium ${tc.text}`}>Preview Options</label>
        <div className={`p-4 rounded-xl border ${tc.border} ${tc.cardBg} space-y-4`}>
          {/* Auto Preview */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className={`font-medium ${tc.text}`}>Show Preview When Recording</span>
              <p className={`text-xs ${tc.textMuted}`}>Display camera preview during recording</p>
            </div>
            <button
              onClick={() => {
                setPreviewEnabled(!previewEnabled);
                saveSetting('voxVideoPreviewEnabled', !previewEnabled);
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                previewEnabled ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={previewEnabled ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  previewEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          {/* Mirror Preview */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className={`font-medium ${tc.text}`}>Mirror Video</span>
              <p className={`text-xs ${tc.textMuted}`}>Flip preview horizontally (like a mirror)</p>
            </div>
            <button
              onClick={() => {
                setMirrorPreview(!mirrorPreview);
                saveSetting('voxVideoMirror', !mirrorPreview);
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                mirrorPreview ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={mirrorPreview ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  mirrorPreview ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </div>
    </div>
  );
};

export default VideoIOSettings;
