// FoldersDropdown — popover folder switcher in the canvas top bar.
// Trigger button shows the current folder; click reveals the 9 system folders
// with unread counts. Click-outside / Esc both close it.
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useEmailStore } from '../../../../store/emailStore';
import type { EmailFolder } from '../../../../services/emailSyncService';
import { FOLDER_META, FOLDER_ORDER } from '../data/folderMeta';

export const FoldersDropdown: React.FC = () => {
  const currentFolder = useEmailStore((s) => s.currentFolder);
  const setCurrentFolder = useEmailStore((s) => s.setCurrentFolder);
  const folderCounts = useEmailStore((s) => s.folderCounts);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const meta = FOLDER_META[currentFolder];
  const TriggerIcon = meta.icon;

  // Click-outside + Esc close
  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const pick = (folder: EmailFolder) => {
    setCurrentFolder(folder);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] pulse-ink-color hover:pulse-surface-raised border pulse-border-color transition-transform active:scale-[0.97]"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch folder"
      >
        <TriggerIcon className="w-3.5 h-3.5" />
        <span className="font-medium">{meta.label}</span>
        <ChevronDown className="w-3 h-3 pulse-ink-3-color" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1.5 z-30 min-w-[260px] rounded-xl border pulse-border-color overflow-hidden hybrid-popover"
          style={{
            background: 'var(--pulse-canvas-soft)',
            boxShadow: '0 22px 60px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.30)',
          }}
        >
          {FOLDER_ORDER.map((id) => {
            const m = FOLDER_META[id];
            const Icon = m.icon;
            const count = folderCounts[id] || 0;
            const active = id === currentFolder;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pick(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition ${
                  active
                    ? 'pulse-rose-color pulse-rose-bg-soft-color font-medium'
                    : 'pulse-ink-color hover:pulse-surface-raised'
                }`}
              >
                <Icon className="w-3.5 h-3.5 opacity-80" />
                <span className="flex-1 text-left">{m.label}</span>
                {count > 0 && (
                  <span className={`text-[11px] font-mono-pulse tnum ${active ? 'pulse-rose-color' : 'pulse-ink-3-color'}`}>
                    {count > 999 ? '999+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FoldersDropdown;
