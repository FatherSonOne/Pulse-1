import React, { useEffect } from 'react';
import { VoiceAgentPanelRedesigned } from '../WarRoom/VoiceAgentPanelRedesigned';

interface OpenAIVoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  openaiApiKey: string;
  userId: string;
}

/**
 * OpenAI Realtime voice modal ("OpenAI voice" experience).
 * Uses the existing War Room realtime voice UI, wrapped in a full-screen modal.
 */
export const OpenAIVoiceCommandModal: React.FC<OpenAIVoiceCommandModalProps> = ({
  isOpen,
  onClose,
  openaiApiKey,
  userId,
}) => {
  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/45 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Voice commands"
    >
      {/* Left-side docked panel */}
      <div
        className="absolute top-0 bottom-0 left-0 w-full max-w-[520px] bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button (inside panel) */}
        <button
          type="button"
          className="absolute top-4 right-4 z-[100000] w-11 h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center justify-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close voice commands"
          title="Close"
        >
          <i className="fa-solid fa-xmark text-lg" />
        </button>

        <VoiceAgentPanelRedesigned
          userId={userId}
          openaiApiKey={openaiApiKey}
          autoConnect
          className="h-full w-full"
        />
      </div>
    </div>
  );
};

export default OpenAIVoiceCommandModal;

