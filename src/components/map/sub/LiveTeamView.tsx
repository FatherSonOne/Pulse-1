// ============================================================
// LiveTeamView (Phase 3 IA — Map sub-view #1)
//
// First sub-view shipped under the Map section. Renders the
// currently-broadcasting team — Pulse-linked contacts whose
// `liveLocations` entry has `isSharing: true`. The Map sub-view
// shows everyone who *has* a place; this sub-view shows who's
// *transmitting now*. Different question, different surface.
//
// Routes + Geofences sub-views land in follow-ups.
// ============================================================

import React, { useMemo } from 'react';
import { Radio, MessageCircle, Mic, Video } from 'lucide-react';
import { Contact } from '../../../types';
import { UserLocation } from '../../../services/locationService';

interface LiveTeamViewProps {
  contacts: Contact[];
  liveLocations: Map<string, UserLocation>;
  isDarkMode: boolean;
  onContactAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
}

interface LiveRow {
  contact: Contact;
  location: UserLocation;
}

function formatLastSeen(updatedAt: Date): string {
  const now = Date.now();
  const diffSec = Math.floor((now - updatedAt.getTime()) / 1000);
  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

const LiveTeamView: React.FC<LiveTeamViewProps> = ({
  contacts,
  liveLocations,
  isDarkMode,
  onContactAction,
}) => {
  const rows = useMemo<LiveRow[]>(() => {
    const result: LiveRow[] = [];
    for (const c of contacts) {
      const loc = liveLocations.get(c.id);
      if (loc?.isSharing) result.push({ contact: c, location: loc });
    }
    // Most-recently-updated first.
    return result.sort((a, b) => (b.location.updatedAt?.getTime() ?? 0) - (a.location.updatedAt?.getTime() ?? 0));
  }, [contacts, liveLocations]);

  const containerCls = isDarkMode
    ? 'bg-zinc-950 text-gray-200'
    : 'bg-gray-50 text-gray-900';

  if (rows.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center w-full h-full ${containerCls}`}>
        <Radio
          size={32}
          className={`mb-3 ${isDarkMode ? 'text-rose-500/60' : 'text-rose-500/50'}`}
        />
        <p className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          No one's broadcasting
        </p>
        <p className={`text-xs mt-1 max-w-xs text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          When a teammate turns on Live in their Map filter bar, they'll show up here in real time.
        </p>
        <p
          className={`mt-4 text-[10px] tracking-[0.1em] uppercase ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Updates every few seconds
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-y-auto ${containerCls}`}>
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div
          className={`flex items-center gap-2 mb-3 text-[10px] tracking-[0.1em] uppercase ${
            isDarkMode ? 'text-gray-500' : 'text-gray-400'
          }`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500/70 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
          </span>
          <span>{rows.length} broadcasting now</span>
        </div>

        <div
          className={`rounded-xl overflow-hidden border ${
            isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-white'
          }`}
          role="list"
        >
          {rows.map(({ contact, location }, idx) => {
            const seen = location.updatedAt ? formatLastSeen(location.updatedAt) : '';
            const isLast = idx === rows.length - 1;
            return (
              <div
                key={contact.id}
                role="listitem"
                className={`flex items-center gap-3 px-4 py-3 ${
                  isLast ? '' : isDarkMode ? 'border-b border-white/5' : 'border-b border-gray-100'
                }`}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 relative"
                  style={{ backgroundColor: contact.avatarColor || '#f43f5e' }}
                >
                  {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 border-2"
                    style={{ borderColor: isDarkMode ? '#09090b' : '#ffffff' }}
                    aria-label="Live"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    {contact.name}
                  </p>
                  <p
                    className={`text-[11px] tracking-[0.05em] uppercase ${
                      isDarkMode ? 'text-gray-500' : 'text-gray-500'
                    }`}
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {seen || 'broadcasting'}
                    {location.lat != null && location.lng != null && (
                      <span className="ml-2 opacity-70">
                        {location.lat.toFixed(3)}, {location.lng.toFixed(3)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onContactAction('message', contact.id)}
                    title="Message"
                    aria-label={`Message ${contact.name}`}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                      isDarkMode ? 'text-gray-400 hover:bg-white/5 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                    }`}
                  >
                    <MessageCircle size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onContactAction('vox', contact.id)}
                    title="Voice"
                    aria-label={`Voice ${contact.name}`}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                      isDarkMode ? 'text-gray-400 hover:bg-white/5 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                    }`}
                  >
                    <Mic size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onContactAction('meet', contact.id)}
                    title="Meet"
                    aria-label={`Meet ${contact.name}`}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                      isDarkMode ? 'text-gray-400 hover:bg-white/5 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                    }`}
                  >
                    <Video size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LiveTeamView;
