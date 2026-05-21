// VoxKeyboardShortcutsHelp - Modal showing all available keyboard shortcuts
// Triggered by pressing '?' in any Relay mode

import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { RELAY_SHORTCUTS } from '../../hooks/useRelayKeyboardShortcuts';

interface VoxKeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

export const VoxKeyboardShortcutsHelp: React.FC<VoxKeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
  isDarkMode = false,
}) => {
  if (!isOpen) return null;

  const shortcuts = Object.entries(RELAY_SHORTCUTS);

  return (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-fadeIn"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: isDarkMode ? '#0a0a0a' : '#ffffff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b"
          style={{
            borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-xl"
                style={{
                  background: 'rgba(244,63,94,0.10)',
                  color: '#f43f5e',
                }}
              >
                <Keyboard className="w-6 h-6" />
              </div>
              <div>
                <h2
                  className="text-xl font-bold"
                  style={{ color: isDarkMode ? '#f9fafb' : '#111827' }}
                >
                  Keyboard Shortcuts
                </h2>
                <p
                  className="text-sm"
                  style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                >
                  Speed up your workflow with these shortcuts
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl transition-all hover:scale-110 active:scale-95"
              style={{
                background: isDarkMode ? '#374151' : '#e5e7eb',
                color: isDarkMode ? '#f9fafb' : '#111827',
              }}
              aria-label="Close shortcuts help"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shortcuts.map(([key, description]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 p-3 rounded-xl transition-all hover:scale-105"
                style={{
                  background: isDarkMode ? '#1f293740' : '#f3f4f650',
                }}
              >
                <span
                  className="text-sm flex-1"
                  style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
                >
                  {description}
                </span>
                <kbd
                  className="px-3 py-1.5 rounded-lg font-mono text-xs font-semibold border-2 min-w-[60px] text-center"
                  style={{
                    background: isDarkMode ? '#374151' : '#fafafa',
                    color: isDarkMode ? '#f9fafb' : '#111827',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    boxShadow: isDarkMode
                      ? '0 2px 4px rgba(0,0,0,0.3)'
                      : '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t text-center"
          style={{
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          }}
        >
          <p
            className="text-xs"
            style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
          >
            Press <kbd className="px-2 py-1 rounded bg-gray-700 text-white font-mono text-xs mx-1">?</kbd> anytime to show this help
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default VoxKeyboardShortcutsHelp;
