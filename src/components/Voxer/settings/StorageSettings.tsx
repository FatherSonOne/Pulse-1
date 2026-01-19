// StorageSettings Component - Download folder and storage configuration
// "Control Room" aesthetic with file system access

import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Download,
  HardDrive,
  Trash2,
  Clock,
  ChevronDown,
  FolderCheck,
  AlertCircle,
} from 'lucide-react';
import { settingsService, PulseSettings } from '../../../services/settingsService';

interface StorageSettingsProps {
  isDarkMode?: boolean;
  accentColor?: string;
}

// Extend window for File System Access API
declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

const RETENTION_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 0, label: 'Forever' },
];

export const StorageSettings: React.FC<StorageSettingsProps> = ({
  isDarkMode = false,
  accentColor = '#8B5CF6',
}) => {
  const [downloadFolder, setDownloadFolder] = useState('');
  const [autoDownload, setAutoDownload] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<{ used: number; quota: number } | null>(null);

  // Check if File System Access API is available
  const hasFileSystemAccess = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await settingsService.getAll();
      setDownloadFolder(settings.voxDownloadFolder || '');
      setAutoDownload(settings.voxAutoDownload ?? false);
      setRetentionDays(settings.voxKeepRecordingsDays ?? 30);
    };
    loadSettings();
    estimateStorageUsage();
  }, []);

  const estimateStorageUsage = async () => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        setStorageUsage({
          used: estimate.usage || 0,
          quota: estimate.quota || 0,
        });
      }
    } catch (err) {
      console.error('Could not estimate storage:', err);
    }
  };

  const saveSetting = async <K extends keyof PulseSettings>(key: K, value: PulseSettings[K]) => {
    await settingsService.set(key, value);
  };

  const selectDownloadFolder = async () => {
    if (!hasFileSystemAccess) {
      setFolderError('Your browser does not support folder selection');
      return;
    }

    setIsSelectingFolder(true);
    setFolderError(null);

    try {
      const handle = await window.showDirectoryPicker!();
      const folderName = handle.name;
      setDownloadFolder(folderName);
      saveSetting('voxDownloadFolder', folderName);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Folder selection error:', err);
        setFolderError('Failed to select folder');
      }
    } finally {
      setIsSelectingFolder(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
      {/* Download Folder Selection */}
      <div className="space-y-3">
        <label className={`flex items-center gap-2 text-sm font-medium ${tc.text}`}>
          <FolderOpen className="w-4 h-4" style={{ color: accentColor }} />
          Download Folder
        </label>

        <div className={`p-4 rounded-xl border ${tc.border} ${tc.cardBg}`}>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: downloadFolder ? `${accentColor}20` : isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              }}
            >
              {downloadFolder ? (
                <FolderCheck className="w-6 h-6" style={{ color: accentColor }} />
              ) : (
                <FolderOpen className={`w-6 h-6 ${tc.textMuted}`} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {downloadFolder ? (
                <>
                  <p className={`font-medium ${tc.text} truncate`}>{downloadFolder}</p>
                  <p className={`text-xs ${tc.textMuted}`}>Selected folder for Vox downloads</p>
                </>
              ) : (
                <>
                  <p className={`font-medium ${tc.textSecondary}`}>No folder selected</p>
                  <p className={`text-xs ${tc.textMuted}`}>Using browser default downloads</p>
                </>
              )}
            </div>

            <button
              onClick={selectDownloadFolder}
              disabled={isSelectingFolder || !hasFileSystemAccess}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{
                background: `${accentColor}15`,
                color: accentColor,
              }}
            >
              {isSelectingFolder ? 'Selecting...' : downloadFolder ? 'Change' : 'Select'}
            </button>
          </div>

          {folderError && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-500">{folderError}</span>
            </div>
          )}

          {!hasFileSystemAccess && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-sm text-amber-500">
                Folder selection requires Chrome, Edge, or Opera browser
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Auto Download Toggle */}
      <div className={`p-4 rounded-xl border ${tc.border} ${tc.cardBg}`}>
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${accentColor}20` }}
            >
              <Download className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <span className={`font-medium ${tc.text}`}>Auto-Download Received Voxes</span>
              <p className={`text-xs ${tc.textMuted}`}>Automatically save incoming voice messages</p>
            </div>
          </div>
          <button
            onClick={() => {
              setAutoDownload(!autoDownload);
              saveSetting('voxAutoDownload', !autoDownload);
            }}
            className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
              autoDownload ? '' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            style={autoDownload ? { background: accentColor } : undefined}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                autoDownload ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Retention Period */}
      <div className="space-y-3">
        <label className={`flex items-center gap-2 text-sm font-medium ${tc.text}`}>
          <Clock className="w-4 h-4" style={{ color: accentColor }} />
          Keep Recordings For
        </label>
        <div className="relative">
          <select
            value={retentionDays}
            onChange={(e) => {
              const value = Number(e.target.value);
              setRetentionDays(value);
              saveSetting('voxKeepRecordingsDays', value);
            }}
            className={`w-full px-4 py-3 pr-10 rounded-xl border ${tc.border} ${tc.inputBg} ${tc.text} appearance-none cursor-pointer transition-all focus:outline-none focus:ring-2`}
          >
            {RETENTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${tc.textMuted} pointer-events-none`} />
        </div>
        <p className={`text-xs ${tc.textMuted}`}>
          {retentionDays === 0
            ? 'Recordings will be kept indefinitely'
            : `Recordings older than ${retentionDays} days will be automatically deleted`}
        </p>
      </div>

      {/* Storage Usage */}
      {storageUsage && (
        <div className="space-y-3">
          <label className={`flex items-center gap-2 text-sm font-medium ${tc.text}`}>
            <HardDrive className="w-4 h-4" style={{ color: accentColor }} />
            Storage Usage
          </label>
          <div className={`p-4 rounded-xl border ${tc.border} ${tc.cardBg}`}>
            {/* Progress Bar */}
            <div className="mb-3">
              <div className={`h-3 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((storageUsage.used / storageUsage.quota) * 100, 100)}%`,
                    background: `linear-gradient(90deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
                  }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-lg font-semibold ${tc.text}`}>
                  {formatBytes(storageUsage.used)}
                </span>
                <span className={`text-sm ${tc.textMuted}`}> used</span>
              </div>
              <div className="text-right">
                <span className={`text-sm ${tc.textMuted}`}>of </span>
                <span className={`text-sm font-medium ${tc.textSecondary}`}>
                  {formatBytes(storageUsage.quota)}
                </span>
              </div>
            </div>

            {/* Clear Cache Button */}
            <button
              className={`w-full mt-4 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${tc.border} border ${tc.hoverBg}`}
              onClick={() => {
                // Clear cached data
                if ('caches' in window) {
                  caches.keys().then(names => {
                    names.forEach(name => {
                      if (name.includes('vox')) {
                        caches.delete(name);
                      }
                    });
                  });
                  estimateStorageUsage();
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
              <span className={tc.textSecondary}>Clear Cached Recordings</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageSettings;
