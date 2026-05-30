/**
 * VideoLinkSelector.tsx
 *
 * Provider picker for video conferencing links in EventCreationModal.
 * Shows 4 provider buttons: Pulse Meet, Google Meet, Zoom, Microsoft Teams.
 * Selected provider generates a link and shows copy + regenerate controls.
 * Unconfigured providers show a "Connect in Settings" prompt.
 */

import React, { useState, useCallback } from 'react';
import { Copy, ExternalLink, RefreshCw, Check } from 'lucide-react';
import {
  VideoProvider,
  VideoLinkResult,
  generatePulseMeetingLink,
  generateMeetLink,
  generateZoomLink,
  generateTeamsLink,
} from '../../services/videoConferencingService';

// ── Provider metadata ─────────────────────────────────────────────────────────

interface ProviderMeta {
  id: VideoProvider;
  label: string;
  icon: React.ReactNode;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'pulse',
    label: 'Pulse Meet',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    ),
  },
  {
    id: 'meet',
    label: 'Google Meet',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M20.5 6.5L15 11V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2h9a2 2 0 002-2v-4l5.5 4.5A.5.5 0 0021 17V7a.5.5 0 00-.5-.5z" />
      </svg>
    ),
  },
  {
    id: 'zoom',
    label: 'Zoom',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 13.5l-3-2.25V15a1 1 0 01-1 1H8a1 1 0 01-1-1V9a1 1 0 011-1h4.5a1 1 0 011 1v1.75l3-2.25v7z" />
      </svg>
    ),
  },
  {
    id: 'teams',
    label: 'Teams',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm4 1h-1.8a3.5 3.5 0 01.3 1.4V15h3a1 1 0 001-1v-1.5A3.5 3.5 0 0018.5 10zM3.5 10A3.5 3.5 0 000 13.5V15a1 1 0 001 1h3v-3.6A3.5 3.5 0 013.5 10zm6-1a3 3 0 100-6 3 3 0 000 6zm4.5 2H6a3 3 0 00-3 3v1.5a1 1 0 001 1h10a1 1 0 001-1V14a3 3 0 00-3-3z" />
      </svg>
    ),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface VideoLinkSelectorProps {
  eventId?: string;
  eventTitle?: string;
  eventDate?: string;
  durationMinutes?: number;
  onLinkGenerated?: (url: string, provider: VideoProvider) => void;
}

export const VideoLinkSelector: React.FC<VideoLinkSelectorProps> = ({
  eventId,
  eventTitle = 'Meeting',
  eventDate,
  durationMinutes = 60,
  onLinkGenerated,
}) => {
  const [selected, setSelected]   = useState<VideoProvider | null>(null);
  const [result, setResult]       = useState<VideoLinkResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [copied, setCopied]       = useState(false);

  const generate = useCallback(async (provider: VideoProvider) => {
    setSelected(provider);
    setLoading(true);
    setResult(null);

    let res: VideoLinkResult;
    const startTime = eventDate ? new Date(eventDate + 'T09:00:00') : new Date();

    switch (provider) {
      case 'pulse':
        res = await generatePulseMeetingLink(eventId ?? `evt-${Date.now()}`, eventTitle);
        break;
      case 'meet':
        res = await generateMeetLink(eventTitle);
        break;
      case 'zoom':
        res = await generateZoomLink(eventTitle, startTime, durationMinutes);
        break;
      case 'teams':
        res = await generateTeamsLink(eventTitle, startTime);
        break;
      default:
        res = { provider: 'none', url: null, label: 'None', needsSetup: false };
    }

    setResult(res);
    setLoading(false);

    if (res.url && onLinkGenerated) {
      onLinkGenerated(res.url, provider);
    }
  }, [eventId, eventTitle, eventDate, durationMinutes, onLinkGenerated]);

  function handleCopy() {
    if (!result?.url) return;
    navigator.clipboard.writeText(result.url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      {/* Provider buttons */}
      <div className="flex gap-2 flex-wrap">
        {PROVIDERS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => { void generate(p.id); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] ${
              selected === p.id
                ? 'bg-[var(--pulse-rose)] border-[var(--pulse-rose)] text-white'
                : 'bg-[var(--pulse-canvas-soft)] dark:bg-[var(--pulse-surface)] border-[var(--pulse-border-strong)] text-[var(--pulse-ink-2)] hover:border-[var(--pulse-rose-soft)] hover:text-[var(--pulse-rose)]'
            }`}
          >
            {p.icon}
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Result area */}
      {selected && (
        <div className="mt-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Generating link…
            </div>
          ) : result?.needsSetup ? (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <ExternalLink className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-700 dark:text-amber-400">{result.setupPrompt}</p>
              </div>
            </div>
          ) : result?.url ? (
            <div className="flex items-center gap-2 p-2.5 bg-[var(--pulse-canvas-soft)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg">
              <span className="flex-1 text-xs text-[var(--pulse-ink-2)] font-mono truncate">{result.url}</span>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy link"
                className="flex-shrink-0 p-1.5 text-zinc-400 hover:text-[var(--pulse-rose)] transition rounded"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => { void generate(selected); }}
                title="Regenerate"
                className="flex-shrink-0 p-1.5 text-zinc-400 hover:text-[var(--pulse-rose)] transition rounded"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default VideoLinkSelector;
