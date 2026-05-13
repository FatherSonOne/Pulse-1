// RelaySettings — Relay configuration sheet.
//
// Right-edge sheet (not a centered modal) per brand discipline. Coral accent,
// no glassmorphism, mono uppercase tab labels. Wraps the four existing
// settings sub-components (Audio I/O, Video I/O, Storage, General).

import React, { useEffect, useState } from 'react';
import { X, Mic, Video, HardDrive, Sliders } from 'lucide-react';
import AudioIOSettings from './settings/AudioIOSettings';
import VideoIOSettings from './settings/VideoIOSettings';
import StorageSettings from './settings/StorageSettings';
import GeneralVoxSettings from './settings/GeneralVoxSettings';
import './Relay.css';

interface RelaySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

type SettingsTab = 'audio' | 'video' | 'storage' | 'general';

const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'audio', label: 'Audio', icon: Mic },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'general', label: 'General', icon: Sliders },
];

const ACCENT_COLOR = '#f43f5e';

export const RelaySettings: React.FC<RelaySettingsProps> = ({
  isOpen,
  onClose,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Relay settings"
    >
      {/* Flat dim — no glassmorphism on the backdrop. */}
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      {/* Right-edge sheet — single hairline along the inner edge replaces
          the heavy drop-shadow; the backdrop scrim handles depth. */}
      <aside
        className={`relative w-full sm:max-w-md h-full flex flex-col border-l ${
          isDarkMode
            ? 'bg-black border-[rgba(255,255,255,0.06)]'
            : 'bg-white border-[rgba(0,0,0,0.08)]'
        } animate-fade-in`}
      >
        {/* Header */}
        <div
          className={`px-4 py-3 flex items-center justify-between border-b ${
            isDarkMode ? 'border-[rgba(255,255,255,0.06)]' : 'border-[rgba(0,0,0,0.08)]'
          }`}
        >
          <h2
            className={`font-mono text-[11px] uppercase tracking-[0.1em] ${
              isDarkMode ? 'text-[#b4b4b8]' : 'text-[#52525b]'
            }`}
          >
            Relay settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-md transition ${
              isDarkMode ? 'hover:bg-[rgba(255,255,255,0.055)]' : 'hover:bg-[#f2f2f2]'
            }`}
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab nav */}
        <nav
          className={`flex items-center gap-1 px-3 py-2 border-b overflow-x-auto ${
            isDarkMode ? 'border-[rgba(255,255,255,0.06)]' : 'border-[rgba(0,0,0,0.08)]'
          }`}
          role="tablist"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] uppercase tracking-[0.1em] transition ${
                  isActive
                    ? 'bg-[rgba(244,63,94,0.10)] text-[#e11d48] dark:text-[#fb7185]'
                    : isDarkMode
                      ? 'text-[#b4b4b8] hover:bg-[rgba(255,255,255,0.055)]'
                      : 'text-[#52525b] hover:bg-[#f2f2f2]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">{renderTabContent()}</div>

        {/* Footer */}
        <div
          className={`px-4 py-3 border-t flex items-center justify-between ${
            isDarkMode ? 'border-[rgba(255,255,255,0.06)]' : 'border-[rgba(0,0,0,0.08)]'
          }`}
        >
          <p
            className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
              isDarkMode ? 'text-[#6b7280]' : 'text-[#6b7280]'
            }`}
          >
            Saved automatically
          </p>
          <button
            type="button"
            onClick={onClose}
            className="btn-brand-primary px-4 py-1.5 rounded-md font-mono text-[11px] uppercase tracking-[0.1em] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f43f5e] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  );
};

export default RelaySettings;
