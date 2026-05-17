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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Radio, Users, X } from 'lucide-react';
import { Contact } from '../../../types';

interface BroadcastRecipientPickerProps {
  contacts: Contact[];
  /** Recipient user ids selected when the picker opens (e.g. last session). */
  initialSelectedUserIds?: string[];
  isDarkMode: boolean;
  onCancel: () => void;
  onConfirm: (recipientUserIds: string[]) => void;
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
}) => {
  const eligible = useMemo(() => eligibleContacts(contacts), [contacts]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedUserIds));
  const sheetRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter(c => c.name.toLowerCase().includes(q));
  }, [eligible, query]);

  // Focus trap + Esc close. Same pattern other Map sheets use so the keyboard
  // story stays consistent across overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); return; }
      if (e.key !== 'Tab') return;
      const root = sheetRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])'),
      ).filter(el => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

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

  return (
    <div
      className="absolute inset-0 z-30 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Pick recipients for your live broadcast"
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
            <Radio size={14} className="text-rose-500" />
            <span
              className="text-[11px] tracking-[0.1em] uppercase"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Pick who can see your live location
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel broadcast"
            className={`p-1 rounded transition-colors ${
              isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Pulse contacts…"
            className={`w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors ${
              isDarkMode
                ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-rose-500'
                : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-500'
            }`}
          />
          <div className="flex items-center justify-between text-xs">
            <span className={isDarkMode ? 'text-gray-500' : 'text-gray-500'}>
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

        <div className="max-h-72 overflow-y-auto border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }}>
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
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleContact(userId)}
                  aria-pressed={isSelected}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:bg-rose-500/10 ${
                    isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                  }`}
                >
                  <div
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
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                    style={{ backgroundColor: c.avatarColor || '#f43f5e' }}
                  >
                    {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
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
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
          >
            <Users size={11} />
            Broadcast to {selected.size}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BroadcastRecipientPicker;
