// VideoIOSettings Component - Video input device configuration
// "Control Room" aesthetic with live camera preview

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Camera,
  RefreshCw,
  MonitorPlay,
  FlipHorizontal,
} from 'lucide-react';
import { useMediaDevices } from '../../../hooks/useMediaDevices';
import { settingsService, PulseSettings } from '../../../services/settingsService';
import { CustomSelect } from './CustomSelect';

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
  accentColor = '#f43f5e',
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
    bg: isDarkMode ? 'bg-white/[0.03]' : 'bg-white/80',
    cardBg: isDarkMode ? 'bg-white/[0.03]' : 'bg-gray-50/80',
    border: isDarkMode ? 'border-[rgba(255,255,255,0.06)]' : 'border-gray-200/60',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    inputBg: isDarkMode ? 'bg-white/[0.055]' : 'bg-white',
    hoverBg: isDarkMode ? 'hover:bg-white/[0.055]' : 'hover:bg-gray-100/80',
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
            className="w-full px-4 py-2.5 rounded-lg font-medium text-white transition-colors ease-pulse"
            style={{
              background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
              boxShadow: `0 4px 14px ${accentColor}30`,
            }}
          >
            Grant Permission
          </button>
        </div>
      )}

      {/* Camera Preview — flat ink-near-true canvas (was a purple-tinted
          gradient `#0a0a0f → #1a1a25` which leaked off-palette purple into
          the chrome). The video itself is the focus; the surround stays out
          of the way. */}
      <div className={`rounded-xl border ${tc.border} overflow-hidden`}>
        <div className="relative aspect-video bg-[#080808] flex items-center justify-center">
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
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ease-pulse"
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
                  className="p-1.5 rounded-lg transition-colors ease-pulse"
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
                className="flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[10px] uppercase tracking-[0.1em]"
                style={{ background: 'rgba(0,0,0,0.5)', color: accentColor }}
              >
                {/* Pulse uses coral for live state. Green here was a
                    Status-Stays-Status violation (green = status-done). */}
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Live
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
        <CustomSelect
          value={selectedCamera}
          onChange={handleCameraChange}
          disabled={isLoading || !hasPermission}
          isDarkMode={isDarkMode}
          accentColor={accentColor}
          tc={tc}
          ariaLabel="Camera"
          options={[
            { value: '', label: 'Default Camera' },
            ...videoInputs.map((device) => ({ value: device.deviceId, label: device.label })),
          ]}
        />
      </div>

      {/* Video Quality — segmented control (was 3-card grid). Selected
          resolution is shown underneath so each segment stays single-line. */}
      <div className="space-y-3">
        <label className={`flex items-center gap-2 text-sm font-medium ${tc.text}`}>
          <MonitorPlay className="w-4 h-4" style={{ color: accentColor }} />
          Video Quality
        </label>
        <div
          className={`inline-flex w-full p-0.5 rounded-md ${isDarkMode ? 'bg-[rgba(255,255,255,0.055)]' : 'bg-[#f2f2f2]'}`}
          role="radiogroup"
          aria-label="Video quality"
        >
          {VIDEO_QUALITIES.map((quality) => {
            const isSelected = videoQuality === quality.id;
            return (
              <button
                key={quality.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleQualityChange(quality.id as typeof videoQuality)}
                className={`flex-1 px-3 py-1.5 rounded font-mono text-[11px] uppercase tracking-[0.1em] transition ${
                  isSelected
                    ? 'bg-[rgba(244,63,94,0.10)] text-[#e11d48] dark:text-[#fb7185]'
                    : isDarkMode
                      ? 'text-[#b4b4b8] hover:text-[#fafafa]'
                      : 'text-[#52525b] hover:text-[#0f0f0f]'
                }`}
              >
                {quality.name}
              </button>
            );
          })}
        </div>
        {(() => {
          const selected = VIDEO_QUALITIES.find((q) => q.id === videoQuality);
          if (!selected) return null;
          return (
            <p className={`text-xs ${tc.textMuted}`}>
              {selected.description}
              <span className="mx-1.5 opacity-50">·</span>
              <span className="font-mono">{selected.resolution}</span>
            </p>
          );
        })()}
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
              className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-pulse ${
                previewEnabled ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={previewEnabled ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ease-pulse ${
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
              className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-pulse ${
                mirrorPreview ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={mirrorPreview ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ease-pulse ${
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
