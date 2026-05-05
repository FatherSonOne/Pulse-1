import React from 'react';
import { BriefingWin } from '../../services/weeklyBriefingService';

interface WinsStripProps {
  wins: BriefingWin[];
}

export const WinsStrip: React.FC<WinsStripProps> = ({ wins }) => {
  if (wins.length === 0) return null;
  return (
    <section className="briefing-wins" aria-label="Recent wins">
      <span className="briefing-wins-label">Wins</span>
      <ul className="briefing-wins-list" role="list">
        {wins.map(win => (
          <li key={win.id} className="briefing-win-chip">
            <span className="briefing-win-from">
              {win.fromName ? win.fromName : 'Anonymous'}
            </span>
            <span className="briefing-win-snippet">{win.snippet}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default WinsStrip;
