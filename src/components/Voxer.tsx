
import React, { useState } from 'react';
import { Contact } from '../types';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

// Keyboard shortcuts
import { useVoxerKeyboardShortcuts } from '../hooks/useVoxerKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './Voxer/VoxKeyboardShortcutsHelp';

// Vox Mode System - 7 Communication Styles
import {
  VoxModeSelector,
  ClassicVoxerMode,
  PulseRadio,
  VoiceThreadsMode,
  TeamVoxMode,
  VoxNotesMode,
  QuickVoxMode,
  VoxDropMode,
} from './Voxer/index';
import { VoxMode } from '../services/voxer/voxModeTypes';

interface VoxerProps {
  apiKey: string;
  contacts: Contact[];
  initialContactId?: string;
  isDarkMode?: boolean;
}

const Voxer: React.FC<VoxerProps> = ({ apiKey, contacts, initialContactId, isDarkMode = false }) => {
  // Get user from auth context
  const { user } = useAuth();
  const userId = user?.id || 'guest';

  // Vox Mode System state
  const [currentVoxMode, setCurrentVoxMode] = useState<VoxMode | null>(null);
  const [showVoxModeSelector, setShowVoxModeSelector] = useState(true);
  const [lastVoxMode, setLastVoxMode] = useState<VoxMode | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Mode names for keyboard shortcut toast notifications
  const MODE_NAMES: Record<string, string> = {
    classic: 'Classic Voxer',
    pulse_radio: 'Pulse Radio',
    voice_threads: 'Voice Threads',
    team_vox: 'Team Vox',
    vox_notes: 'Vox Notes',
    quick_vox: 'Quick Vox',
    vox_drop: 'Vox Drop',
  };

  // Handle mode selection callback
  const handleBackToSelector = () => {
    setCurrentVoxMode(null);
    setShowVoxModeSelector(true);
  };

  const handleSelectMode = (mode: VoxMode | null) => {
    if (mode !== null) setLastVoxMode(mode);
    setCurrentVoxMode(mode);
    setShowVoxModeSelector(false);
  };

  // Global keyboard shortcuts — mode switching (1-8) and help (?)
  // Escape/go-back is only handled here when NO mode is active, to avoid double-firing
  // with per-mode keyboard shortcut handlers each mode component registers.
  useVoxerKeyboardShortcuts({
    onSwitchMode: (mode) => {
      const voxMode = mode === 'classic' ? null : mode as VoxMode;
      setCurrentVoxMode(voxMode);
      setShowVoxModeSelector(false);
      toast.success(`Switched to ${MODE_NAMES[mode] || mode}`, { duration: 1500 });
    },
    onShowHelp: () => setShowShortcutsHelp(true),
    // Only handle Escape at parent level when no mode component is mounted (no child handler)
    onGoBack: !currentVoxMode ? () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (showVoxModeSelector) setShowVoxModeSelector(false);
    } : undefined,
  }, true);

  // If a Vox Mode is selected, render that mode's full interface instead of the default Voxer
  if (currentVoxMode) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-xl">
        {currentVoxMode === 'pulse_radio' && (
          <PulseRadio onBack={handleBackToSelector} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}
        {currentVoxMode === 'voice_threads' && (
          <VoiceThreadsMode onBack={handleBackToSelector} contacts={contacts} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}
        {currentVoxMode === 'team_vox' && (
          <TeamVoxMode onBack={handleBackToSelector} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}
        {currentVoxMode === 'vox_notes' && (
          <VoxNotesMode onBack={handleBackToSelector} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}
        {currentVoxMode === 'quick_vox' && (
          <QuickVoxMode onBack={handleBackToSelector} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}
        {currentVoxMode === 'vox_drop' && (
          <VoxDropMode onBack={handleBackToSelector} apiKey={apiKey} isDarkMode={isDarkMode} />
        )}

        {/* Vox Mode Selector Modal (can be opened from within modes) */}
        <VoxModeSelector
          isOpen={showVoxModeSelector}
          onClose={() => setShowVoxModeSelector(false)}
          onSelectMode={handleSelectMode}
          currentMode={currentVoxMode}
          isDarkMode={isDarkMode}
        />

        {/* Global keyboard shortcuts help modal */}
        <VoxKeyboardShortcutsHelp
          isOpen={showShortcutsHelp}
          onClose={() => setShowShortcutsHelp(false)}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  // Show mode selector as landing page when no mode is selected
  if (showVoxModeSelector && !currentVoxMode) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-xl">
        <VoxModeSelector
          isOpen={true}
          onClose={() => {
            // If user closes without selecting, default to classic mode
            setShowVoxModeSelector(false);
          }}
          onSelectMode={handleSelectMode}
          currentMode={lastVoxMode}
          isDarkMode={isDarkMode}
        />

        {/* Global keyboard shortcuts help modal */}
        <VoxKeyboardShortcutsHelp
          isOpen={showShortcutsHelp}
          onClose={() => setShowShortcutsHelp(false)}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  // Classic Voxer Mode - When no vox mode is selected, show the new ClassicVoxerMode
  // This replaces the old broken page with the avant-garde redesigned Classic Voxer
  if (!currentVoxMode) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-xl">
        <ClassicVoxerMode
          onBack={handleBackToSelector}
          apiKey={apiKey}
          isDarkMode={isDarkMode}
        />

        {/* Vox Mode Selector Modal (can be opened from within Classic mode) */}
        <VoxModeSelector
          isOpen={showVoxModeSelector}
          onClose={() => setShowVoxModeSelector(false)}
          onSelectMode={handleSelectMode}
          currentMode={null}
          isDarkMode={isDarkMode}
        />

        {/* Global keyboard shortcuts help modal */}
        <VoxKeyboardShortcutsHelp
          isOpen={showShortcutsHelp}
          onClose={() => setShowShortcutsHelp(false)}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  // This fallback should never be reached - all code paths above return a mode component
  // If you see this error, there's a bug in the mode routing logic
  return (
    <div className="h-full flex items-center justify-center bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <div className="text-center p-8">
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
          Voxer Mode Error
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          No valid mode selected. This is a bug - please report it.
        </p>
        <button
          onClick={() => {
            setCurrentVoxMode(null);
            setShowVoxModeSelector(true);
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
        >
          Open Mode Selector
        </button>
      </div>
    </div>
  );
};

export default Voxer;
