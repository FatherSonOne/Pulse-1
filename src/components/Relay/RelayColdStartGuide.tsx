// RelayColdStartGuide — first-run teaching for the Relay surfaces.
//
// Shown in place of the front-door (Inbox · all) empty state for a new user,
// until dismissed (persisted in localStorage). It is ADDITIVE: the existing
// VoxEmptyState front door still renders once the guide is dismissed and for
// every source-filtered no-results view. The guide both orients ("what is
// Inbox") and teaches the surfaces, with each row a jump straight into that
// surface — so a new user learns the lay of the land by using it.
//
// Live is offered only when relayLiveRooms is on, matching the rail (which
// hides Live behind the same flag). Coral budget: the CTA uses the rose brand
// gradient (#f43f5e → #ec4899), identical to VoxEmptyState's vox-empty-cta —
// coral stays reserved for AI surfaces; nothing here is coral.

import React from 'react';
import {
  Inbox,
  User,
  Hash,
  Radio,
  FileText,
  Headphones,
  X,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useFeatures } from '../../contexts/FeatureContext';

export const RELAY_COLDSTART_DISMISS_KEY = 'relay_coldstart_dismissed_v1';

type GuideView = 'direct' | 'channel' | 'broadcast' | 'notes' | 'live';

interface Surface {
  view: GuideView;
  name: string;
  blurb: string;
  Icon: LucideIcon;
  /** Gated behind relayLiveRooms — only shown when Live is enabled. */
  liveOnly?: boolean;
}

// Copy follows the Relay voice (terse, no exclamation, recommend the next
// move) and mirrors the rail's scope-first descriptions (S2-3).
const SURFACES: Surface[] = [
  { view: 'direct',    name: 'Direct',    blurb: 'One person. Hold space to record, release to send.', Icon: User },
  { view: 'channel',   name: 'Channels',  blurb: 'A whole team, in one voice channel.',                Icon: Hash },
  { view: 'broadcast', name: 'Broadcast', blurb: 'Record once, reach everyone.',                       Icon: Radio },
  { view: 'notes',     name: 'Notes',     blurb: 'Private voice memos, just for you.',                  Icon: FileText },
  { view: 'live',      name: 'Live',      blurb: 'Drop into a live voice room.',                        Icon: Headphones, liveOnly: true },
];

export interface RelayColdStartGuideProps {
  /** Jump to a top-level Relay surface. */
  onSelectView: (view: GuideView) => void;
  /** Open the composer ("Record your first message"). */
  onCompose: () => void;
  /** Persist + hide the guide (parent falls back to the plain empty state). */
  onDismiss: () => void;
}

export const RelayColdStartGuide: React.FC<RelayColdStartGuideProps> = ({
  onSelectView,
  onCompose,
  onDismiss,
}) => {
  const { isFeatureEnabled } = useFeatures();
  const liveEnabled = isFeatureEnabled('relayLiveRooms');
  const surfaces = SURFACES.filter((s) => !s.liveOnly || liveEnabled);

  return (
    <div className="flex flex-col items-center justify-center min-h-[360px] px-6 py-12">
      <div
        className="w-full max-w-md rounded-2xl border p-5"
        style={{ borderColor: 'var(--pulse-border)', background: 'var(--pulse-surface)' }}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'var(--pulse-canvas)', border: '1px solid var(--pulse-border)' }}
            >
              <Inbox className="w-4 h-4" style={{ color: 'var(--pulse-ink-3)' }} />
            </span>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.14em]"
              style={{ color: 'var(--pulse-ink-3)' }}
            >
              Relay · Inbox
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss intro"
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <h3 className="text-lg font-light mb-1" style={{ color: 'var(--pulse-ink)' }}>
          Your voice, in one place
        </h3>
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--pulse-ink-2)' }}>
          Inbox gathers every direct message, broadcast, and note across Relay, newest
          first. Here is where each kind of voice lives:
        </p>

        <ul className="space-y-1 mb-4">
          {surfaces.map((s) => (
            <li key={s.view}>
              <button
                type="button"
                onClick={() => onSelectView(s.view)}
                className="w-full flex items-center gap-3 text-left px-2 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition group"
              >
                <span
                  className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--pulse-canvas)', border: '1px solid var(--pulse-border)' }}
                >
                  <s.Icon className="w-4 h-4" style={{ color: 'var(--pulse-ink-3)' }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm" style={{ color: 'var(--pulse-ink)' }}>
                    {s.name}
                  </span>
                  <span className="block text-xs truncate" style={{ color: 'var(--pulse-ink-2)' }}>
                    {s.blurb}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition" />
              </button>
            </li>
          ))}
        </ul>

        <button type="button" onClick={onCompose} className="vox-coldstart-cta">
          Record your first message
        </button>
        <p
          className="font-mono text-[10px] uppercase tracking-[0.1em] mt-3 text-center"
          style={{ color: 'var(--pulse-ink-3)' }}
        >
          Hold space to record · ? for shortcuts
        </p>
      </div>

      <style>{`
        .vox-coldstart-cta {
          width: 100%;
          margin-top: 4px;
          padding: 12px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%);
          box-shadow: 0 4px 12px rgba(244, 63, 94, 0.30);
          transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .vox-coldstart-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(244, 63, 94, 0.40);
        }
        .vox-coldstart-cta:active { transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .vox-coldstart-cta { transition: none; }
          .vox-coldstart-cta:hover { transform: none; }
        }
      `}</style>
    </div>
  );
};

export default React.memo(RelayColdStartGuide);
