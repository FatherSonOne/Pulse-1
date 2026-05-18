// ─────────────────────────────────────────────────────────────────────────────
// Contact picker overlay (Atlas empty-state path). Tightly coupled to the
// empty state and not reused elsewhere, but lifted out of PulseMapView so
// the host component can shrink. useDialogA11y wires focus trap + restore.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import { Contact } from '../../../types';
import { useDialogA11y } from './useDialogA11y';

export interface ContactLocationPickerOverlayProps {
  contacts: Contact[];
  isDarkMode: boolean;
  onClose: () => void;
  onPick: (contactId: string) => void;
}

export const ContactLocationPickerOverlay: React.FC<ContactLocationPickerOverlayProps> = ({
  contacts,
  isDarkMode,
  onClose,
  onPick,
}) => {
  const [query, setQuery] = useState('');
  const filtered = contacts.filter(c =>
    !query || c.name.toLowerCase().includes(query.toLowerCase())
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Shared dialog a11y — focus trap, Escape, restore focus to trigger on
  // unmount. Initial focus goes to the search field so the operator can
  // immediately filter the contact list.
  useDialogA11y({ containerRef, onClose, initialFocusRef: searchInputRef });

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-picker-title"
    >
      <div
        ref={containerRef}
        className={`w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden ${
          isDarkMode ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-200'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`px-5 py-4 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
          <h3
            id="contact-picker-title"
            className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          >
            Pick a contact to locate
          </h3>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search contacts by name"
            className={`mt-3 w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors ${
              isDarkMode
                ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-rose-500'
                : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-500'
            }`}
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className={`px-5 py-8 text-sm text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              No contacts match your search.
            </p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick(c.id)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:bg-rose-500/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500 ${
                  isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                }`}
              >
                <div
                  aria-hidden="true"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                  style={{ backgroundColor: c.avatarColor || '#f43f5e' }}
                >
                  {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
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
            ))
          )}
        </div>
      </div>
    </div>
  );
};
