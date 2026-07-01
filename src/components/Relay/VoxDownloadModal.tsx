// VoxDownloadModal - Export format selection and download progress
// Audio mode (default): WebM / MP3 / WAV — original VOX recordings are audio.
// Video mode (Glimpse): WebM video / Audio-only MP3 — original glimpses are
//   video+audio; MP3 is an audio-track extract via AudioContext (which drops
//   the video track on decode). No MP4 yet — that needs a real transcode
//   pipeline (ffmpeg.wasm / mp4-muxer), out of scope here.

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
  Archive,
} from 'lucide-react';
import JSZip from 'jszip';
import { Mp3Encoder } from 'lamejs';
import { VoxSelectionItem } from '../../hooks/useVoxSelection';
import { getPlayableUrl } from '../../services/relay/resolveAudioUrl';

interface VoxDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: VoxSelectionItem[];
  isDarkMode?: boolean;
  accentColor?: string;
  onComplete?: () => void;
  /** 'audio' (default — VOX) or 'video' (Glimpse). Drives format options,
   *  title, mime types, and ZIP filename prefix. */
  mode?: 'audio' | 'video';
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

const FORMATS_AUDIO: FormatOption[] = [
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

// Glimpses are video+audio. WebM is the original (plays in Chrome/Edge/
// Firefox/VLC/QuickTime out of the box) — no conversion, no quality loss.
// Audio-only MP3 strips the video track via AudioContext decode and re-
// encodes the audio with lamejs; useful for transcription or pure-listen.
// No WAV (uncompressed audio without the video defeats the point), no MP4
// (would need ffmpeg.wasm — separate engineering task).
const FORMATS_VIDEO: FormatOption[] = [
  {
    id: 'webm',
    name: 'WebM',
    description: 'Original video + audio, fastest download',
    icon: <Zap className="w-5 h-5" />,
    pros: ['Fastest', 'No conversion', 'Video + audio'],
    fileSize: 'Small',
  },
  {
    id: 'mp3',
    name: 'Audio only (MP3)',
    description: 'Strip the video, keep voice for listening or transcribing',
    icon: <Music className="w-5 h-5" />,
    pros: ['Audio only', 'Smaller', 'Good for transcription'],
    fileSize: 'Medium',
  },
];

const ACCENT_COLOR = '#f43f5e';

export const VoxDownloadModal: React.FC<VoxDownloadModalProps> = ({
  isOpen,
  onClose,
  items,
  isDarkMode = false,
  accentColor = ACCENT_COLOR,
  onComplete,
  mode = 'audio',
}) => {
  const isVideo = mode === 'video';
  const FORMATS = isVideo ? FORMATS_VIDEO : FORMATS_AUDIO;
  const noun = isVideo ? 'glimpse' : 'message';
  const zipPrefix = isVideo ? 'glimpse' : 'vox';
  const title = isVideo ? 'Download Glimpse' : 'Download Vox';
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('webm');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadAsZip, setDownloadAsZip] = useState(false);

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
      // Sign first so downloads work once the bucket is private (no-op on a
      // public bucket / blob URL).
      const signed = await getPlayableUrl(url);
      const response = await fetch(signed);
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
      const signed = await getPlayableUrl(url);
      const response = await fetch(signed);
      const arrayBuffer = await response.arrayBuffer();

      // For WebM, return original — video mode preserves the video track
      // (mime video/webm), audio mode strips to audio/webm framing.
      if (targetFormat === 'webm') {
        return new Blob([arrayBuffer], { type: isVideo ? 'video/webm' : 'audio/webm' });
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

      // MP3 encoding via lamejs
      const mp3Blob = await audioBufferToMp3(audioBuffer);
      await audioContext.close();
      return mp3Blob;
    } catch (err) {
      console.error('Conversion error:', err);
      return null;
    }
  }, []);

  // WAV encoding helper
  const audioBufferToMp3 = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const kbps = 128;

    const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);
    const mp3Data: Int8Array[] = [];
    const sampleBlockSize = 1152; // lamejs processes 1152 samples at a time

    // Convert Float32 channel data to Int16
    const floatToInt16 = (float32: Float32Array): Int16Array => {
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return int16;
    };

    const left = floatToInt16(audioBuffer.getChannelData(0));
    const right = numChannels > 1 ? floatToInt16(audioBuffer.getChannelData(1)) : undefined;

    for (let i = 0; i < left.length; i += sampleBlockSize) {
      const leftChunk = left.subarray(i, i + sampleBlockSize);
      const rightChunk = right?.subarray(i, i + sampleBlockSize);
      const mp3buf = rightChunk
        ? encoder.encodeBuffer(leftChunk, rightChunk)
        : encoder.encodeBuffer(leftChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    const flush = encoder.flush();
    if (flush.length > 0) {
      mp3Data.push(flush);
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
  };

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

  // Generate enhanced file name with order, timestamp, and sender
  const generateFileName = (item: VoxSelectionItem, index: number, format: ExportFormat): string => {
    const date = new Date(item.timestamp);
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/:/g, ''); // HHMMSS
    const sender = item.sender === 'me'
      ? 'You'
      : (item.senderName || item.contactName || 'Contact');
    const orderStr = String(index + 1).padStart(3, '0'); // 001, 002, etc.

    // Format: 001_2026-02-20_143022_You.wav
    return `${orderStr}_${dateStr}_${timeStr}_${sender}.${format}`;
  };

  // Handle ZIP download
  const handleZipDownload = async () => {
    if (items.length === 0) return;

    setIsDownloading(true);
    setProgress(0);
    setCompletedCount(0);
    setError(null);

    try {
      const zip = new JSZip();

      // Sort items chronologically for consistent ordering
      const sortedItems = [...items].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Add all files to ZIP
      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        const fileName = generateFileName(item, i, selectedFormat);

        try {
          if (selectedFormat === 'webm') {
            // Add WebM directly (sign first for private-bucket reads).
            const signed = await getPlayableUrl(item.url);
            const response = await fetch(signed);
            const blob = await response.blob();
            zip.file(fileName, blob);
          } else {
            // Convert and add
            const blob = await convertAudio(item.url, selectedFormat);
            if (blob) {
              zip.file(fileName, blob);
            }
          }
        } catch (err) {
          console.error(`Failed to add item ${item.id} to ZIP:`, err);
        }

        setCompletedCount(i + 1);
        setProgress(((i + 1) / sortedItems.length) * 85); // 85% for adding files
      }

      // Generate ZIP file
      setProgress(90);
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Create ZIP filename with date range
      const firstDate = new Date(sortedItems[0].timestamp);
      const lastDate = new Date(sortedItems[sortedItems.length - 1].timestamp);
      const dateStr = firstDate.toISOString().slice(0, 10);
      const zipFileName = sortedItems.length === 1
        ? `${zipPrefix}_${dateStr}.zip`
        : `${zipPrefix}_${dateStr}_${sortedItems.length}_${isVideo ? 'glimpses' : 'messages'}.zip`;

      // Download ZIP
      setProgress(95);
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setProgress(100);
      setIsDownloading(false);

      setTimeout(() => {
        onClose();
        onComplete?.();
      }, 500);
    } catch (err) {
      console.error('ZIP creation error:', err);
      setError('Failed to create ZIP file. Please try again.');
      setIsDownloading(false);
    }
  };

  // Handle individual downloads
  const handleDownload = async () => {
    if (items.length === 0) return;

    setIsDownloading(true);
    setProgress(0);
    setCompletedCount(0);
    setError(null);

    let successCount = 0;

    // Sort items chronologically for consistent ordering
    const sortedItems = [...items].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 0; i < sortedItems.length; i++) {
      const item = sortedItems[i];
      const fileName = generateFileName(item, i, selectedFormat);

      try {
        if (selectedFormat === 'webm') {
          // Direct download for WebM
          const success = await downloadFile(item.url, fileName);
          if (success) successCount++;
        } else {
          // Convert and download
          const blob = await convertAudio(item.url, selectedFormat);

          if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
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
      setProgress(((i + 1) / sortedItems.length) * 100);

      // Small delay between downloads to avoid browser blocking
      if (i < sortedItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    setIsDownloading(false);

    if (successCount === sortedItems.length) {
      setTimeout(() => {
        onClose();
        onComplete?.();
      }, 500);
    } else if (successCount === 0) {
      setError('Failed to download files. Please try again.');
    } else {
      setError(`Downloaded ${successCount} of ${sortedItems.length} files.`);
    }
  };

  if (!isOpen) return null;

  const tc = {
    overlay: isDarkMode ? 'bg-zinc-950/70' : 'bg-zinc-950/50',
    modalBg: isDarkMode
      ? 'bg-[#080808]'
      : 'bg-white',
    border: isDarkMode ? 'border-[rgba(255,255,255,0.06)]' : 'border-gray-200/60',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    cardBg: isDarkMode ? 'bg-white/[0.03]' : 'bg-gray-50',
    cardBorder: isDarkMode ? 'border-[rgba(255,255,255,0.06)]' : 'border-gray-200/50',
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
              <h2 className={`text-lg font-bold ${tc.text}`}>{title}</h2>
              <p className={`text-xs ${tc.textMuted}`}>
                {items.length} {items.length === 1 ? noun : `${noun}s`} · {formatDuration(totalDuration)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDownloading}
            className={`p-2 rounded-lg transition-colors ease-pulse ${tc.textMuted} hover:${tc.text} ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'} disabled:opacity-40`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Format Selection */}
          <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 font-mono ${tc.textMuted}`}>
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
                  className={`w-full p-4 rounded-xl border text-left transition-colors ease-pulse ${
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
                  className="h-full rounded-full transition-[width] duration-300 ease-pulse"
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

          {/* ZIP Download Option */}
          {items.length > 1 && (
            <div className="mb-4">
              <button
                onClick={() => !isDownloading && setDownloadAsZip(!downloadAsZip)}
                disabled={isDownloading}
                className={`w-full p-3 rounded-xl border text-left transition-colors ease-pulse ${
                  downloadAsZip
                    ? 'border-2'
                    : `${tc.cardBorder} border ${tc.cardBg}`
                } disabled:opacity-60`}
                style={downloadAsZip ? {
                  borderColor: accentColor,
                  background: isDarkMode ? `${accentColor}10` : `${accentColor}08`,
                } : undefined}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}
                    style={{
                      background: downloadAsZip ? accentColor : (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                      color: downloadAsZip ? 'white' : (isDarkMode ? '#9ca3af' : '#6b7280'),
                    }}
                  >
                    <Archive className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold ${tc.text}`}>Download as ZIP</div>
                    <p className={`text-sm ${tc.textSecondary}`}>
                      All files in a single archive
                    </p>
                  </div>
                  {downloadAsZip && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: accentColor }}
                    >
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </button>
            </div>
          )}

          {/* Download Button */}
          <button
            onClick={downloadAsZip ? handleZipDownload : handleDownload}
            disabled={isDownloading || items.length === 0}
            className="w-full py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-colors ease-pulse disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              boxShadow: !isDownloading ? `0 4px 14px ${accentColor}30` : 'none',
            }}
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {downloadAsZip ? 'Creating ZIP...' : 'Downloading...'}
              </>
            ) : (
              <>
                {downloadAsZip ? <Archive className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                {downloadAsZip
                  ? `Download ZIP (${items.length} files)`
                  : `Download ${items.length} ${items.length === 1 ? 'File' : 'Files'}`
                }
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoxDownloadModal;
