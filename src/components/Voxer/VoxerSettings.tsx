// VoxerSettings Component - Comprehensive Voxer configuration modal
// "Control Room" aesthetic - professional broadcast studio feel

import React, { useState } from 'react';
import {
  X,
  Settings,
  Mic,
  Video,
  HardDrive,
  Sliders,
  Waves,
} from 'lucide-react';
import AudioIOSettings from './settings/AudioIOSettings';
import VideoIOSettings from './settings/VideoIOSettings';
import StorageSettings from './settings/StorageSettings';
import GeneralVoxSettings from './settings/GeneralVoxSettings';
import './Voxer.css';

interface VoxerSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

type SettingsTab = 'audio' | 'video' | 'storage' | 'general';

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'audio', label: 'Audio', icon: <Mic className="w-4 h-4" /> },
  { id: 'video', label: 'Video', icon: <Video className="w-4 h-4" /> },
  { id: 'storage', label: 'Storage', icon: <HardDrive className="w-4 h-4" /> },
  { id: 'general', label: 'General', icon: <Sliders className="w-4 h-4" /> },
];

const ACCENT_COLOR = '#8B5CF6'; // Voxer purple

export const VoxerSettings: React.FC<VoxerSettingsProps> = ({
  isOpen,
  onClose,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');

  if (!isOpen) return null;

  const tc = {
    overlay: isDarkMode ? 'bg-black/70' : 'bg-black/50',
    modalBg: isDarkMode
      ? 'bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800'
      : 'bg-gradient-to-br from-white via-white to-gray-50',
    headerBg: isDarkMode
      ? 'bg-gray-900/80'
      : 'bg-white/90',
    border: isDarkMode ? 'border-gray-700/50' : 'border-gray-200/60',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    tabBg: isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/80',
    tabActive: isDarkMode
      ? 'bg-gray-700/80 text-white'
      : 'bg-white text-gray-900 shadow-sm',
    tabInactive: isDarkMode
      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/40'
      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50',
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'audio':
        return <AudioIOSettings isDarkMode={isDarkMode} accentColor={ACCENT_COLOR} />;
      case 'video':
        return <VideoIOSettings isDarkMode={isDarkMode} accentColor={ACCENT_COLOR} />;
      case 'storage':
        return <StorageSettings isDarkMode={isDarkMode} accentColor={ACCENT_COLOR} />;
      case 'general':
        return <GeneralVoxSettings isDarkMode={isDarkMode} accentColor={ACCENT_COLOR} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${tc.overlay} backdrop-blur-sm`}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-2xl max-h-[90vh] rounded-2xl border ${tc.border} ${tc.modalBg} shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b ${tc.border} ${tc.headerBg} backdrop-blur-xl flex-shrink-0`}
          style={{
            background: isDarkMode
              ? `linear-gradient(135deg, ${ACCENT_COLOR}10 0%, transparent 50%)`
              : `linear-gradient(135deg, ${ACCENT_COLOR}08 0%, transparent 50%)`
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT_COLOR} 0%, ${ACCENT_COLOR}cc 100%)`,
                  boxShadow: `0 4px 14px ${ACCENT_COLOR}30`,
                }}
              >
                <Waves className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className={`text-lg font-bold ${tc.text}`}>Voxer Settings</h2>
                <p className={`text-xs ${tc.textMuted}`}>Configure audio, video, and preferences</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-all ${tc.textMuted} hover:${tc.text} ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={`px-6 py-3 border-b ${tc.border} flex-shrink-0`}>
          <div className={`flex p-1 rounded-xl ${tc.tabBg}`}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id ? tc.tabActive : tc.tabInactive
                }`}
                style={activeTab === tab.id ? {
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
                } : undefined}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderTabContent()}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${tc.border} flex-shrink-0 flex items-center justify-between`}>
          <p className={`text-xs ${tc.textMuted}`}>
            Settings are saved automatically
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-medium text-white transition-all"
            style={{
              background: `linear-gradient(135deg, ${ACCENT_COLOR} 0%, ${ACCENT_COLOR}cc 100%)`,
              boxShadow: `0 4px 14px ${ACCENT_COLOR}30`,
            }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Custom Styles */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoom-in-95 {
          from { transform: scale(0.95); }
          to { transform: scale(1); }
        }
        .animate-in {
          animation: fade-in 0.2s ease-out, zoom-in-95 0.2s ease-out;
        }

        /* Custom range input styling */
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          cursor: pointer;
          margin-top: -6px;
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          cursor: pointer;
          border: none;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 3px;
        }
        input[type="range"]::-moz-range-track {
          height: 6px;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};

export default VoxerSettings;
