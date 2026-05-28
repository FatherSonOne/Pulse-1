// HybridFirstRunScreen — replaces the entire email surface when the user
// has never connected Gmail (no provider_token + no cached emails).
// Copy + visual language match the legacy first-run screen verbatim so users
// who have been linked to the email section keep seeing the same welcome.
import React from 'react';
import { Loader2, ExternalLink, MailCheck } from 'lucide-react';

interface HybridFirstRunScreenProps {
  connecting: boolean;
  onConnect: () => void;
}

export const HybridFirstRunScreen: React.FC<HybridFirstRunScreenProps> = ({
  connecting,
  onConnect,
}) => (
  <div
    className="email-hybrid-shell flex h-full w-full items-center justify-center p-8"
    style={{ background: 'var(--pulse-canvas)' }}
  >
    <div className="text-center max-w-md">
      <div className="relative w-20 h-20 mx-auto mb-7 flex items-center justify-center">
        <span
          className="absolute inset-0 rounded-full"
          aria-hidden="true"
          style={{ background: 'rgba(244, 63, 94, 0.18)' }}
        />
        <span
          className="absolute inset-3 rounded-full"
          aria-hidden="true"
          style={{ background: 'rgba(244, 63, 94, 0.12)' }}
        />
        <MailCheck className="w-7 h-7 relative pulse-rose-color" strokeWidth={1.75} />
      </div>

      <div className="font-mono-pulse text-[10px] uppercase tracking-wide-mono pulse-rose-color mb-3">
        Pulse Mail · Connect
      </div>

      <h2
        className="text-2xl pulse-ink-color tracking-tight mb-2"
        style={{ fontFamily: 'var(--pulse-font-serif)', fontWeight: 500 }}
      >
        One inbox, one surface.
      </h2>

      <p className="text-sm pulse-ink-2-color mb-7 max-w-[42ch] mx-auto leading-relaxed">
        Pulse pulls your Gmail in, summarizes what matters, and drafts replies in your voice.
        Sign in to your Google account to begin.
      </p>

      <button
        type="button"
        onClick={onConnect}
        disabled={connecting}
        className="inline-flex items-center gap-2 h-11 px-6 pulse-rose-bg-color text-white rounded-lg text-sm font-medium transition disabled:opacity-60"
        style={{
          boxShadow:
            '0 1px 0 rgba(244, 63, 94, 0.2), 0 4px 12px rgba(244, 63, 94, 0.18)',
        }}
      >
        {connecting
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <ExternalLink className="w-4 h-4" />}
        {connecting ? 'Opening Google' : 'Connect Google'}
      </button>

      <div className="mt-7 font-mono-pulse text-[10px] uppercase tracking-wide-mono pulse-ink-3-color">
        Read · Send · Search · Modify · Compose
      </div>
    </div>
  </div>
);

export default HybridFirstRunScreen;
