// LaneRow — compact row inside a LaneSection.
// Phase 12.4: rows now open the slide-out EmailReaderPanel instead of
// expanding inline (the row is too narrow for inline reading anyway).
// Signal rows still use inline expansion — different UX intent.
import React from 'react';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import type { EmailRow } from '../data/emailRow';
import { Avatar } from '../primitives';

interface LaneRowProps {
  email: EmailRow;
  showTopBorder?: boolean;
}

function isInsideInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('button, a, input, textarea, select, label'));
}

export const LaneRow: React.FC<LaneRowProps> = ({ email, showTopBorder }) => {
  const setReaderPanelEmailId = useEmailUIStore((s) => s.setReaderPanelEmailId);

  const handleClick = (e: React.MouseEvent) => {
    if (isInsideInteractive(e.target)) return;
    setReaderPanelEmailId(email.id);
  };

  return (
    <div
      className={`selectable-row flex items-center gap-3 px-4 py-2.5 cursor-pointer ${
        showTopBorder ? 'border-t pulse-border-color' : ''
      }`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setReaderPanelEmailId(email.id);
        }
      }}
      aria-label={`Open email from ${email.from}: ${email.subject}`}
    >
      <Avatar name={email.from} size={26} />
      <span className="text-[12.5px] pulse-ink-color truncate min-w-[140px]">{email.from}</span>
      <span className="text-[12.5px] pulse-ink-2-color truncate flex-1">{email.subject}</span>
      <span className="text-[11px] font-mono-pulse pulse-ink-3-color tnum shrink-0 w-12 text-right">{email.when}</span>
    </div>
  );
};

export default LaneRow;
