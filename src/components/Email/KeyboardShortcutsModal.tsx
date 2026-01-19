// KeyboardShortcutsModal.tsx - Help modal showing keyboard shortcuts
import React, { useEffect, useRef } from 'react';
import { keyboardShortcuts } from '../../hooks/useEmailKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  onClose,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and escape key handling
  useEffect(() => {
    // Focus the close button when modal opens
    closeButtonRef.current?.focus();

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-stone-200 dark:border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center" aria-hidden="true">
              <i className="fa-solid fa-keyboard text-white"></i>
            </div>
            <div>
              <h2 id="keyboard-shortcuts-title" className="text-lg font-semibold text-stone-900 dark:text-white">Keyboard Shortcuts</h2>
              <p className="text-sm text-stone-500 dark:text-zinc-500">Navigate faster with these shortcuts</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
            aria-label="Close keyboard shortcuts"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh] p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {keyboardShortcuts.map((category) => (
              <div key={category.category}>
                <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide mb-3">
                  {category.category}
                </h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-3 bg-stone-50 dark:bg-zinc-800/50 rounded-lg"
                    >
                      <span className="text-sm text-stone-700 dark:text-zinc-300">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <React.Fragment key={keyIdx}>
                            {keyIdx > 0 && (
                              <span className="text-xs text-stone-400 dark:text-zinc-600 mx-0.5">+</span>
                            )}
                            <kbd className="px-2 py-1 text-xs font-medium bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 rounded shadow-sm text-stone-700 dark:text-zinc-300">
                              {key}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50">
          <p className="text-xs text-stone-500 dark:text-zinc-500 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded">?</kbd> anytime to show this help
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;
