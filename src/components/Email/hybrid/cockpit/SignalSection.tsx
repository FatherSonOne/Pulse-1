// SignalSection — SIGNAL · TODAY curated rows.
// Phase 5: registers j/k/o/Enter keyboard handlers for keyboard-driven
// navigation through the signal list, gated on mode === 'cockpit'.
import React, { useEffect } from 'react';
import { Flame } from 'lucide-react';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../../store/emailComposeStore';
import { AiChip } from '../primitives';
import { TRIAGE_QUEUE_IDS } from '../data/mockEmails';
import type { EmailRow } from '../data/emailRow';
import { SignalRow } from './SignalRow';

interface SignalSectionProps {
  signals: EmailRow[];
  queueIds?: string[];
  clearedIds?: string[];
  onTriageOne?: (emailId: string) => void;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export const SignalSection: React.FC<SignalSectionProps> = ({
  signals,
  queueIds = TRIAGE_QUEUE_IDS,
  clearedIds = [],
  onTriageOne,
}) => {
  const mode = useEmailUIStore((s) => s.emailHybridMode);
  const expandedId = useEmailUIStore((s) => s.expandedSignalRowId);
  const setExpandedId = useEmailUIStore((s) => s.setExpandedSignalRowId);
  const focusedId = useEmailUIStore((s) => s.focusedSignalRowId);
  const setFocusedId = useEmailUIStore((s) => s.setFocusedSignalRowId);

  const showKeyboardShortcuts = useEmailUIStore((s) => s.showKeyboardShortcuts);
  const showEmailSettings = useEmailUIStore((s) => s.showEmailSettings);
  const showReauthModal = useEmailUIStore((s) => s.showReauthModal);
  const showComposer = useEmailComposeStore((s) => s.showComposer);

  // Default focus to the first signal whenever the set changes.
  useEffect(() => {
    if (signals.length === 0) {
      if (focusedId !== null) setFocusedId(null);
      return;
    }
    if (!focusedId || !signals.some((s) => s.id === focusedId)) {
      setFocusedId(signals[0].id);
    }
  }, [signals, focusedId, setFocusedId]);

  // j / k / o / Enter — Cockpit-only signal navigation.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (mode !== 'cockpit') return;
      if (isTextInputTarget(e.target)) return;
      if (showComposer || showKeyboardShortcuts || showEmailSettings || showReauthModal) return;
      if (signals.length === 0) return;

      const hasCtrl = e.ctrlKey || e.metaKey;
      if (hasCtrl) return;

      const curIdx = focusedId ? signals.findIndex((s) => s.id === focusedId) : -1;

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          const nextIdx = Math.min(curIdx + 1, signals.length - 1);
          setFocusedId(signals[Math.max(nextIdx, 0)].id);
          return;
        }
        case 'k':
        case 'ArrowUp': {
          e.preventDefault();
          const prevIdx = Math.max(curIdx - 1, 0);
          setFocusedId(signals[prevIdx].id);
          return;
        }
        case 'o':
        case 'Enter': {
          e.preventDefault();
          if (!focusedId) return;
          setExpandedId(expandedId === focusedId ? null : focusedId);
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    mode, signals, focusedId, expandedId,
    setFocusedId, setExpandedId,
    showComposer, showKeyboardShortcuts, showEmailSettings, showReauthModal,
  ]);

  if (signals.length === 0) return null;

  return (
    <section className="mb-9">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 pulse-rose-color" />
          <h2 className="text-sm font-semibold pulse-ink-color uppercase font-mono-pulse tracking-wide-mono">
            Signal · today
          </h2>
          <AiChip variant="muted">Claude curated</AiChip>
        </div>
        <span className="text-[11px] font-mono-pulse pulse-ink-3-color">{signals.length} ITEMS</span>
      </div>

      <div className="space-y-2">
        {signals.map((s) => {
          const idxInQueue = queueIds.indexOf(s.id);
          const cleared = clearedIds.includes(s.id);
          return (
            <SignalRow
              key={s.id}
              email={s}
              expanded={expandedId === s.id}
              focused={focusedId === s.id}
              onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
              onFocus={() => setFocusedId(s.id)}
              onTriage={onTriageOne ? () => onTriageOne(s.id) : undefined}
              queuePos={idxInQueue >= 0 && !cleared ? idxInQueue + 1 : null}
              queueTotal={queueIds.length}
              queueCleared={cleared}
            />
          );
        })}
      </div>
    </section>
  );
};

export default SignalSection;
