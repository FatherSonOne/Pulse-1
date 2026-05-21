// src/components/ToolsMenuV2/ThreadAudit/ThreadAudit.tsx
// PR 3a — Surface 3 · slim Tools menu · Thread Audit tile body.
//
// Tabbed surface with three sub-tabs (Pace · Sentiment · Flow). Pace is
// real (with stub data); Sentiment + Flow render placeholder content.
// When the active thread has <5 messages, every sub-tab body is replaced
// with the locked empty-state copy from the spec.
//
// A11y: role="tablist" / role="tab" / role="tabpanel" with manual focus
// activation per the WAI-ARIA tabs pattern. Arrow keys cycle tabs;
// Home / End jump to ends; Esc bubbles up to the shell.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import PaceTab from './PaceTab';
import SentimentTab from './SentimentTab';
import FlowTab from './FlowTab';
import type { ToolsMenuTileBodyProps } from '../types';
import { AUDIT_MIN_MESSAGES } from '../types';

type AuditTabId = 'pace' | 'sentiment' | 'flow';

const TABS: ReadonlyArray<{ id: AuditTabId; label: string }> = [
  { id: 'pace', label: 'Pace' },
  { id: 'sentiment', label: 'Sentiment' },
  { id: 'flow', label: 'Flow' },
];

export const ThreadAudit: React.FC<ToolsMenuTileBodyProps> = ({
  threadId,
  messageCount,
  isDarkMode,
}) => {
  const [active, setActive] = useState<AuditTabId>('pace');
  const tablistRef = useRef<HTMLDivElement>(null);

  const focusTab = useCallback((id: AuditTabId) => {
    const root = tablistRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLButtonElement>(`[data-tab-id="${id}"]`);
    el?.focus();
  }, []);

  const onTablistKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = TABS.findIndex((t) => t.id === active);
    if (idx < 0) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = TABS[(idx + 1) % TABS.length];
      setActive(next.id);
      focusTab(next.id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = TABS[(idx - 1 + TABS.length) % TABS.length];
      setActive(next.id);
      focusTab(next.id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(TABS[0].id);
      focusTab(TABS[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = TABS[TABS.length - 1];
      setActive(last.id);
      focusTab(last.id);
    }
  };

  const isDisabled = messageCount < AUDIT_MIN_MESSAGES;

  // Reset to Pace whenever the active thread switches.
  useEffect(() => {
    setActive('pace');
  }, [threadId]);

  return (
    <div className="space-y-4">
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Thread audit views"
        onKeyDown={onTablistKeyDown}
        className={[
          'flex items-center gap-1 p-1 rounded-xl',
          isDarkMode ? 'bg-white/5' : 'bg-black/[0.04]',
        ].join(' ')}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-tab-id={tab.id}
              id={`audit-tab-${tab.id}`}
              aria-controls={`audit-panel-${tab.id}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={[
                'flex-1 px-3 py-2 rounded-lg text-sm font-medium min-h-[40px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                isActive
                  ? isDarkMode
                    ? 'bg-zinc-900 text-zinc-100 shadow-sm'
                    : 'bg-white text-zinc-900 shadow-sm'
                  : isDarkMode
                    ? 'text-zinc-400 hover:text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-900',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`audit-panel-${tab.id}`}
            aria-labelledby={`audit-tab-${tab.id}`}
            hidden={!isActive}
            tabIndex={0}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded-lg"
          >
            {isActive ? (
              isDisabled ? (
                <DisabledState isDarkMode={isDarkMode} />
              ) : tab.id === 'pace' ? (
                <PaceTab
                  threadId={threadId}
                  messageCount={messageCount}
                  isDarkMode={isDarkMode}
                />
              ) : tab.id === 'sentiment' ? (
                <SentimentTab isDarkMode={isDarkMode} />
              ) : (
                <FlowTab isDarkMode={isDarkMode} />
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

interface DisabledStateProps {
  isDarkMode: boolean;
}

const DisabledState: React.FC<DisabledStateProps> = ({ isDarkMode }) => (
  <div
    className={[
      'rounded-xl border px-4 py-8 text-center',
      isDarkMode
        ? 'border-white/10 bg-white/[0.02] text-zinc-400'
        : 'border-black/10 bg-black/[0.02] text-zinc-500',
    ].join(' ')}
  >
    <p className="text-sm font-semibold">
      Need {AUDIT_MIN_MESSAGES}+ messages
    </p>
    <p className="mt-1 text-xs">Say more, see more.</p>
  </div>
);

export default ThreadAudit;
