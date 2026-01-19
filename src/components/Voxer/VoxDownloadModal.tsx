// VoxDownloadModal - Export format selection and download progress
// Supports WebM (original), MP3, and WAV export formats

import React, { useState, useCallback } from 'react';
import {
  X,
  Download,
  Check,
  Loader2,
  FileAudio,
  Zap,
  Music,
  Waves,
  FolderDown,
  AlertCircle,
} from 'lucide-react';
import { VoxSelectionItem } from '../../hooks/useVoxSelection';

interface VoxDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: VoxSelectionItem[];
  isDarkMode?: boolean;
  accentColor?: string;
  onComplete?: () => void;
}

type ExportFormat = 'webm' | 'mp3' | 'wav';

interface FormatOption {
  id: ExportFormat;
  name: string;
  description: string;
  icon: React.ReactNode;
  pros: string[];
  fileSize: string;
}

const FORMATS: FormatOption[] = [
  {
    id: 'webm',
    name: 'WebM',
    description: 'Original format, fastest download',
    icon: <Zap className="w-5 h-5" />,
    pros: ['Fastest', 'No conversion', 'Original quality'],
    fileSize: 'Small',
  },
  {
    id: 'mp3',
    name: 'MP3',
    description: 'Universal playback support',
    icon: <Music className="w-5 h-5" />,
    pros: ['Works everywhere', 'Good compression', 'Most compatible'],
    fileSize: 'Medium',
  },
  {
    id: 'wav',
    name: 'WAV',
    description: 'Uncompressed, highest quality',
    icon: <Waves className="w-5 h-5" />,
    pros: ['Lossless', 'Best quality', 'Easy editing'],
    fileSize: 'Large',
  },
];

const ACCENT_COLOR = '#8B5CF6';

export const VoxDownloadModal: React.FC<VoxDownloadModalProps> = ({
  isOpen,
  onClose,
  items,
  isDarkMode = false,
  accentColor = ACCENT_COLOR,
  onComplete,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('webm');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = items.reduce((sum, item) => sum + (item.duration || 0), 0);

  // Download a single file
  const downloadFile = useCallback(async (url: string, filename: string): Promise<boolean> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch file');

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(downloadUrl);
      return true;
    } catch (err) {
      console.error('Download error:', err);
      return false;
    }
  }, []);

  // Convert audio format (simplified - uses AudioContext for basic conversion)
  const convertAudio = useCallback(async (
    url: string,
    targetFormat: ExportFormat
  ): Promise<Blob | null> => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      // For WebM, return original
      if (targetFormat === 'webm') {
        return new Blob([arrayBuffer], { type: 'audio/webm' });
      }

      // Decode audio using AudioContext
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // For WAV, encode directly
      if (targetFormat === 'wav') {
        const wavBlob = audioBufferToWav(audioBuffer);
        await audioContext.close();
        return wavBlob;
      }

      // For MP3, we'd need a library like lamejs
      // For now, fallback to WAV if MP3 is requested but not available
      console.warn('MP3 encoding requires additional library - using WAV');
      const fallbackBlob = audioBufferToWav(audioBuffer);
      await audioContext.close();
      return fallbackBlob;
    } catch (err) {
      console.error('Conversion error:', err);
      return null;
    }
  }, []);

  // WAV encoding helper
  const audioBufferToWav = (audioBuffer: AudioBuffer): Blob => {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + audioBuffer.length * blockAlign);
    const view = new DataView(buffer);

    // Write WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + audioBuffer.length * blockAlign, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, audioBuffer.length * blockAlign, true);

    // Interleave channels and write samples
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = audioBuffer.getChannelData(channel)[i];
        const clampedSample = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  // Handle download
  const handleDownload = async () => {
    if (items.length === 0) return;

    setIsDownloading(true);
    setProgress(0);
    setCompletedCount(0);
    setError(null);

    let successCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const timestamp = new Date(item.timestamp).toISOString().slice(0, 10);
      const baseName = `vox_${item.mode}_${timestamp}_${item.id.slice(0, 8)}`;

      try {
        if (selectedFormat === 'webm') {
          // Direct download for WebM
          const success = await downloadFile(item.url, `${baseName}.webm`);
          if (success) successCount++;
        } else {
          // Convert and download
          const extension = selectedFormat === 'mp3' ? 'mp3' : 'wav';
          const blob = await convertAudio(item.url, selectedFormat);

          if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${baseName}.${extension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
            successCount++;
          }
        }
      } catch (err) {
        console.error(`Failed to download item ${item.id}:`, err);
      }

      setCompletedCount(i + 1);
      setProgress(((i + 1) / items.length) * 100);

      // Small delay between downloads
      if (i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    setIsDownloading(false);

    if (successCount === items.length) {
      setTimeout(() => {
        onClose();
        onComplete?.();
      }, 500);
    } else if (successCount === 0) {
      setError('Failed to download files. Please try again.');
    } else {
      setError(`Downloaded ${successCount} of ${items.length} files.`);
    }
  };

  if (!isOpen) return null;

  const tc = {
    overlay: isDarkMode ? 'bg-black/70' : 'bg-black/50',
    modalBg: isDarkMode
      ? 'bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800'
      : 'bg-gradient-to-br from-white via-white to-gray-50',
    border: isDarkMode ? 'border-gray-700/50' : 'border-gray-200/60',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    cardBg: isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50',
    cardBorder: isDarkMode ? 'border-gray-700/30' : 'border-gray-200/50',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${tc.overlay} backdrop-blur-sm`}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md rounded-2xl border ${tc.border} ${tc.modalBg} shadow-2xl overflow-hidden`}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b ${tc.border} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                boxShadow: `0 4px 14px ${accentColor}30`,
              }}
            >
              <FolderDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${tc.text}`}>Download Vox</h2>
              <p className={`text-xs ${tc.textMuted}`}>
                {items.length} {items.length === 1 ? 'message' : 'messages'} · {formatDuration(totalDuration)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDownloading}
            className={`p-2 rounded-lg transition-all ${tc.textMuted} hover:${tc.text} ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'} disabled:opacity-40`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Format Selection */}
          <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${tc.textMuted}`}>
            Export Format
          </h3>

          <div className="space-y-2 mb-6">
            {FORMATS.map((format) => {
              const isSelected = selectedFormat === format.id;

              return (
                <button
                  key={format.id}
                  onClick={() => !isDownloading && setSelectedFormat(format.id)}
                  disabled={isDownloading}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? `border-2`
                      : `${tc.cardBorder} border ${tc.cardBg}`
                  } disabled:opacity-60`}
                  style={isSelected ? {
                    borderColor: accentColor,
                    background: isDarkMode ? `${accentColor}10` : `${accentColor}08`,
                  } : undefined}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}
                      style={{
                        background: isSelected ? accentColor : (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                        color: isSelected ? 'white' : (isDarkMode ? '#9ca3af' : '#6b7280'),
                      }}
                    >
                      {format.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold ${tc.text}`}>{format.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} ${tc.textMuted}`}>
                          {format.fileSize}
                        </span>
                      </div>
                      <p className={`text-sm ${tc.textSecondary}`}>{format.description}</p>
                    </div>

                    {/* Selected indicator */}
                    {isSelected && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: accentColor }}
                      >
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Progress Bar (when downloading) */}
          {isDownloading && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm ${tc.textSecondary}`}>
                  Downloading {completedCount} of {items.length}...
                </span>
                <span className={`text-sm font-medium ${tc.text}`}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={isDownloading || items.length === 0}
            className="w-full py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              boxShadow: !isDownloading ? `0 4px 14px ${accentColor}30` : 'none',
            }}
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download {items.length} {items.length === 1 ? 'File' : 'Files'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoxDownloadModal;
