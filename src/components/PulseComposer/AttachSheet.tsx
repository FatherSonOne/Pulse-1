// src/components/PulseComposer/AttachSheet.tsx
// PR 1 — Messages Tools Redesign · Surface 1 · Compose bar.
//
// 3-item picker (File / Photo / Camera). Mobile renders as a bottom
// sheet with a drag handle (mock 1.8); desktop renders as a popover
// anchored to the `+` button. The actual file picking is a hidden
// <input type="file"> whose `accept` + `capture` attrs vary per kind.
//
// Coral budget: ZERO.

import React, { useEffect, useRef } from 'react';
import { Camera, FileText, Image as ImageIcon, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComposerAttachment } from './types';
import { TOUCH_TARGET_PX } from './types';

interface AttachSheetProps {
  open: boolean;
  isMobile: boolean;
  isDarkMode: boolean;
  /** Anchor rect (desktop only) — viewport coords of the trigger. */
  anchor?: { top: number; left: number; height: number } | null;
  onClose: () => void;
  onPick: (kind: ComposerAttachment['kind'], file: File) => void;
}

interface PickerRow {
  kind: ComposerAttachment['kind'];
  label: string;
  icon: LucideIcon;
  accept: string;
  capture?: 'user' | 'environment';
}

const ROWS: ReadonlyArray<PickerRow> = [
  { kind: 'file', label: 'File', icon: FileText, accept: '*/*' },
  { kind: 'photo', label: 'Photo', icon: ImageIcon, accept: 'image/*' },
  {
    kind: 'camera',
    label: 'Camera',
    icon: Camera,
    accept: 'image/*',
    capture: 'environment',
  },
];

export const AttachSheet: React.FC<AttachSheetProps> = ({
  open,
  isMobile,
  isDarkMode,
  anchor,
  onClose,
  onPick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const inputRefs = useRef<Record<ComposerAttachment['kind'], HTMLInputElement | null>>({
    file: null,
    photo: null,
    camera: null,
  });

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => firstButtonRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const renderRow = (row: PickerRow, index: number) => {
    const Icon = row.icon;
    return (
      <React.Fragment key={row.kind}>
        {index > 0 ? (
          <div
            role="separator"
            aria-hidden="true"
            className={isDarkMode ? 'h-px bg-white/10 mx-3' : 'h-px bg-black/10 mx-3'}
          />
        ) : null}
        <button
          ref={index === 0 ? firstButtonRef : undefined}
          type="button"
          role="menuitem"
          onClick={() => {
            inputRefs.current[row.kind]?.click();
          }}
          className={[
            'w-full flex items-center gap-3 px-4 text-left',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
            isMobile ? 'min-h-[52px]' : 'min-h-[44px]',
            isDarkMode ? 'text-zinc-100 hover:bg-white/5' : 'text-zinc-900 hover:bg-black/5',
          ].join(' ')}
          style={{ minWidth: TOUCH_TARGET_PX }}
        >
          <span
            className={[
              'flex items-center justify-center rounded-lg',
              isMobile ? 'w-10 h-10' : 'w-8 h-8',
              isDarkMode ? 'bg-white/5' : 'bg-black/5',
            ].join(' ')}
            aria-hidden="true"
          >
            <Icon size={isMobile ? 20 : 16} aria-hidden />
          </span>
          <span className="flex-1 text-sm font-medium">{row.label}</span>
        </button>
        <input
          ref={(el) => {
            inputRefs.current[row.kind] = el;
          }}
          type="file"
          accept={row.accept}
          capture={row.capture}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(row.kind, file);
            e.target.value = '';
            onClose();
          }}
        />
      </React.Fragment>
    );
  };

  // ─── Mobile bottom sheet ────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        />
        <div
          ref={containerRef}
          role="menu"
          aria-label="Attach"
          className={[
            'fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
            'animate-slide-up',
            isDarkMode
              ? 'bg-zinc-900 border-t border-white/10 text-zinc-100'
              : 'bg-white border-t border-black/10 text-zinc-900',
          ].join(' ')}
        >
          <div className="flex justify-center pt-2.5 pb-1">
            <div
              className={[
                'h-1 w-10 rounded-full',
                isDarkMode ? 'bg-white/15' : 'bg-black/15',
              ].join(' ')}
            />
          </div>
          <div className="py-2">
            {ROWS.map((row, i) => renderRow(row, i))}
          </div>
          <div className="px-4 pb-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className={[
                'w-full rounded-lg text-sm font-medium min-h-[44px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                isDarkMode
                  ? 'bg-white/5 text-zinc-200 hover:bg-white/10'
                  : 'bg-black/5 text-zinc-800 hover:bg-black/10',
              ].join(' ')}
            >
              Cancel
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─── Desktop popover ────────────────────────────────────────────
  const top = anchor ? anchor.top + anchor.height + 8 : 64;
  const left = anchor ? anchor.left : 16;
  return (
    <div
      ref={containerRef}
      role="menu"
      aria-label="Attach"
      style={{ position: 'fixed', top, left, zIndex: 50, width: 220 }}
      className={[
        'rounded-xl shadow-2xl backdrop-blur animate-fade-in overflow-hidden',
        isDarkMode
          ? 'bg-zinc-900/95 border border-white/10 text-zinc-100'
          : 'bg-white/98 border border-black/10 text-zinc-900',
      ].join(' ')}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-current/10">
        <span className="text-xs font-mono uppercase tracking-[0.1em] opacity-60">
          Attach
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={[
            'rounded p-1 min-w-[28px] min-h-[28px] flex items-center justify-center',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
            isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5',
          ].join(' ')}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className="py-1">{ROWS.map((row, i) => renderRow(row, i))}</div>
    </div>
  );
};

export default AttachSheet;
