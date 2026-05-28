// LaneRow — compact row inside a LaneSection.
import React from 'react';
import type { MockEmail } from '../data/mockEmails';
import { Avatar } from '../primitives';

interface LaneRowProps {
  email: MockEmail;
  showTopBorder?: boolean;
}

export const LaneRow: React.FC<LaneRowProps> = ({ email, showTopBorder }) => {
  return (
    <div
      className={`selectable-row flex items-center gap-3 px-4 py-2.5 cursor-pointer ${
        showTopBorder ? 'border-t pulse-border-color' : ''
      }`}
    >
      <Avatar name={email.from} size={26} />
      <span className="text-[12.5px] pulse-ink-color truncate min-w-[140px]">{email.from}</span>
      <span className="text-[12.5px] pulse-ink-2-color truncate flex-1">{email.subject}</span>
      <span className="text-[11px] font-mono-pulse pulse-ink-3-color tnum shrink-0">{email.when}</span>
    </div>
  );
};

export default LaneRow;
