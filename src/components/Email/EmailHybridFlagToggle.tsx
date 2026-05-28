// EmailHybridFlagToggle — floating one-click switch between the legacy
// PulseEmailClientRedesign and the new Cockpit + Triage hybrid surface.
// Reads + writes the same `ff_emailHybrid` localStorage key the
// useFeatureFlag dev-override path uses, then reloads the page so the
// branching in EmailClientWrapper re-evaluates from scratch.
//
// Temporary chrome — gets removed in Phase 11 alongside the flag flip + the
// legacy component deletion.
import React from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';

const FLAG_KEY = 'ff_emailHybrid';

function readHybridFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URLSearchParams(window.location.search).get(FLAG_KEY);
    if (url === 'on' || url === '1' || url === 'true') return true;
    if (url === 'off' || url === '0' || url === 'false') return false;
    return window.localStorage.getItem(FLAG_KEY) === 'on';
  } catch {
    return false;
  }
}

export const EmailHybridFlagToggle: React.FC = () => {
  const isOn = readHybridFlag();

  const toggle = () => {
    try {
      window.localStorage.setItem(FLAG_KEY, isOn ? 'off' : 'on');
    } catch {
      /* private browsing or quota — fall through, reload still picks up the URL param */
    }
    // Strip any conflicting query param so localStorage wins after reload.
    const url = new URL(window.location.href);
    url.searchParams.delete(FLAG_KEY);
    window.history.replaceState({}, '', url.toString());
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={isOn ? 'Switch back to the legacy email surface' : 'Try the new Cockpit + Triage UI'}
      aria-label={isOn ? 'Switch to legacy email' : 'Switch to new hybrid email'}
      style={{
        position: 'fixed',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 55,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px 5px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0.2,
        cursor: 'pointer',
        background: isOn ? '#f43f5e' : 'rgba(255, 255, 255, 0.96)',
        color: isOn ? '#fff' : '#52525b',
        border: isOn ? '1px solid transparent' : '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: isOn
          ? '0 4px 14px rgba(244, 63, 94, 0.25), inset 0 0 0 1px rgba(255,255,255,0.08)'
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'background 180ms ease, transform 180ms ease, box-shadow 180ms ease',
        backdropFilter: 'blur(6px)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateX(-50%) translateY(1px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateX(-50%)';
      }}
    >
      {isOn ? (
        <>
          <RotateCcw width={12} height={12} />
          <span>Back to legacy email</span>
        </>
      ) : (
        <>
          <Sparkles width={12} height={12} />
          <span>Try the new Cockpit</span>
          <span
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              opacity: 0.6,
              padding: '1px 4px',
              borderRadius: 3,
              background: 'rgba(0, 0, 0, 0.06)',
              marginLeft: 2,
            }}
          >
            BETA
          </span>
        </>
      )}
    </button>
  );
};

export default EmailHybridFlagToggle;
