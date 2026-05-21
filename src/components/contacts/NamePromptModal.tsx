// ============================================
// NAME PROMPT MODAL
// Replaces window.prompt() for "what should we call this?" flows
// (Save filter as new, Rename saved filter, etc.). Keeps the input
// inside Pulse chrome instead of dropping the user into the browser's
// native dialog box. Voice and styling match the rest of the section.
// ============================================

import React, { useEffect, useRef, useState } from 'react';

interface NamePromptModalProps {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  cta?: string;
  cancelLabel?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export const NamePromptModal: React.FC<NamePromptModalProps> = ({
  isOpen,
  title,
  placeholder,
  initialValue = '',
  cta = 'Save',
  cancelLabel = 'Cancel',
  onSubmit,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-prompt-title"
        className="w-full max-w-md rounded-xl border overflow-hidden"
        style={{
          background: 'var(--pulse-surface)',
          borderColor: 'var(--pulse-border)',
          boxShadow: 'var(--pulse-shadow-md)',
          color: 'var(--pulse-ink)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-5 border-b" style={{ borderColor: 'var(--pulse-border)' }}>
          <h2 id="name-prompt-title" className="text-base font-semibold">
            {title}
          </h2>
        </div>
        <div className="p-5">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder={placeholder}
            className="w-full min-h-[44px] px-3 rounded-lg border text-sm"
            style={{
              background: 'var(--pulse-canvas)',
              borderColor: 'var(--pulse-border)',
              color: 'var(--pulse-ink)',
            }}
          />
        </div>
        <div
          className="px-5 py-3 border-t flex items-center justify-end gap-2"
          style={{ borderColor: 'var(--pulse-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium"
            style={{ color: 'var(--pulse-ink-2)', border: '1px solid var(--pulse-border)' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className="min-h-[40px] px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--pulse-rose)' }}
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NamePromptModal;
