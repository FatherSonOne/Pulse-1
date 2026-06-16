// ─────────────────────────────────────────────────────────────────────────────
// BroadcastRecipientPicker — opens when the user flips BROADCAST on. Lists
// Pulse-linked contacts (the only contacts reachable through live-location
// realtime) and lets the operator pick who can see this session's broadcast.
//
// Behaviour: confirm → bulk grant via setBroadcastRecipients → caller
// starts the broadcast. Stopping the broadcast in MapFilterBar calls
// endBroadcastRecipients which revokes consent for the same set, so the
// receiver loses access the moment the broadcaster goes quiet.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useRef, useState } from 'react';
import { Check, Radio, Users, X } from 'lucide-react';
import { Contact } from '../../../types';
import { useDialogA11y } from './useDialogA11y';

interface BroadcastRecipientPickerProps {
  contacts: Contact[];
  /** Recipient user ids selected when the picker opens (e.g. last session). */
  initialSelectedUserIds?: string[];
  isDarkMode: boolean;
  onCancel: () => void;
  onConfirm: (recipientUserIds: string[]) => void;
  /** When true, render the picker content INLINE (no modal overlay / sheet chrome /
   *  focus trap) for embedding inside a drawer section — e.g. the LiveTeamDrawer
   *  "Share my location" expander, so picking recipients isn't a separate modal.
   *  Default false = the full bottom-sheet modal (OFF-path filter pill + `b` key). */
  inline?: boolean;
}

function eligibleContacts(contacts: Contact[]): Contact[] {
  return contacts.filter(c => !!c.pulseUserId);
}

const BroadcastRecipientPicker: React.FC<BroadcastRecipientPickerProps> = ({
  contacts,
  initialSelectedUserIds = [],
  isDarkMode,
  onCancel,
  onConfirm,
  inline = false,
}) => {
  const eligible = useMemo(() => eligibleContacts(contacts), [contacts]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedUserIds));
  const sheetRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter(c => c.name.toLowerCase().includes(q));
  }, [eligible, query]);

  // Shared dialog a11y — focus trap, Escape, restore focus to trigger on
  // unmount. Initial focus goes to the search input (the most useful entry
  // point — operator usually starts typing a name to narrow the list).
  useDialogA11y({ containerRef: sheetRef, onClose: onCancel, initialFocusRef: searchInputRef, enabled: !inline });

  const toggleContact = (userId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(eligible.map(c => c.pulseUserId!).filter(Boolean) as string[]));
  const clearAll = () => setSelected(new Set());

  // Shared inner content — identical in the modal and the inline (drawer) render.
  const content = (
    <>
      <div className="px-4 py-3 space-y-3">
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Pulse contacts…"
          aria-label="Search Pulse contacts"
          className={`w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors ${
            isDarkMode
              ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-rose-500'
              : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-500'
          }`}
        />
        <div className="flex items-center justify-between text-xs">
          <span
            className={isDarkMode ? 'text-gray-500' : 'text-gray-500'}
            aria-live="polite"
            aria-atomic="true"
          >
            {selected.size} selected of {eligible.length}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={selectAll}
              disabled={eligible.length === 0}
              className={`text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:underline disabled:opacity-40 ${
                isDarkMode ? 'text-rose-300 hover:text-rose-200' : 'text-rose-600 hover:text-rose-700'
              }`}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={selected.size === 0}
              className={`text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:underline disabled:opacity-40 ${
                isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div
        role="group"
        aria-label="Pulse contacts to share your live location with"
        className="max-h-72 overflow-y-auto border-t"
        style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }}
      >
        {eligible.length === 0 ? (
          <p className={`px-4 py-10 text-sm text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            No Pulse-linked contacts yet. Invite a teammate to share live location.
          </p>
        ) : filtered.length === 0 ? (
          <p className={`px-4 py-10 text-sm text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            No contacts match your search.
          </p>
        ) : (
          filtered.map(c => {
            const userId = c.pulseUserId!;
            const isSelected = selected.has(userId);
            const accessibleName = c.role ? `${c.name}, ${c.role}` : c.name;
            return (
              <button
                key={c.id}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                aria-label={accessibleName}
                onClick={() => toggleContact(userId)}
                onKeyDown={(e) => {
                  // role=checkbox on <button>: Space already toggles via
                  // the button's native click behaviour. Enter does too on
                  // most browsers — explicit handler keeps SR / keyboard
                  // parity with native <input type=checkbox>.
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggleContact(userId);
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:bg-rose-500/10 ${
                  isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                }`}
              >
                <div
                  aria-hidden="true"
                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors flex-shrink-0 ${
                    isSelected
                      ? 'bg-rose-500 text-white'
                      : isDarkMode ? 'bg-white/10 text-transparent' : 'bg-gray-100 text-transparent'
                  }`}
                  style={{ border: isSelected ? '1px solid rgb(244 63 94)' : '1px solid rgba(0,0,0,0.12)' }}
                >
                  <Check size={11} />
                </div>
                <div
                  aria-hidden="true"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                  style={{ backgroundColor: c.avatarColor || '#f43f5e' }}
                >
                  {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1" aria-hidden="true">
                  <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {c.name}
                  </p>
                  {c.role && (
                    <p className={`text-xs truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {c.role}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className={`px-4 py-3 border-t flex items-center gap-2 ${isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-100 bg-gray-50'}`}>
        <button
          type="button"
          onClick={onCancel}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
            isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(Array.from(selected))}
          disabled={selected.size === 0}
          aria-label={`Broadcast to ${selected.size} ${selected.size === 1 ? 'recipient' : 'recipients'}`}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
        >
          <Users size={11} aria-hidden="true" />
          <span aria-hidden="true">Broadcast to {selected.size}</span>
        </button>
      </div>
    </>
  );

  // Inline (drawer-embedded) — no overlay, no sheet chrome, no modal header, no
  // focus trap (useDialogA11y disabled). The drawer section provides context.
  if (inline) {
    return (
      <div
        ref={sheetRef}
        className={`rounded-xl border overflow-hidden ${
          isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/60'
        }`}
      >
        {content}
      </div>
    );
  }

  // Modal bottom-sheet — OFF-path filter pill + `b` key. Byte-identical to before.
  return (
    <div
      className="absolute inset-0 z-30 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-picker-title"
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-t-2xl border-t border-x shadow-2xl overflow-hidden map-sheet-up ${
          isDarkMode ? 'bg-zinc-950 border-white/10' : 'bg-white border-gray-200'
        }`}
        style={{ maxHeight: '80%' }}
      >
        <div className={`flex items-center justify-between px-4 py-3 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-rose-500" aria-hidden="true" />
            <span
              id="broadcast-picker-title"
              className="text-[11px] tracking-[0.1em] uppercase"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Pick who can see your live location
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className={`p-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
              isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {content}
      </div>
    </div>
  );
};

export default BroadcastRecipientPicker;
