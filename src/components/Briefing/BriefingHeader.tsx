import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BriefingHeaderProps {
  weekStart: string | null;
  weekEnd: string | null;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  const startDate = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  const startMonth = startDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const endMonth = endDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const startDay = startDate.getUTCDate();
  const endDay = endDate.getUTCDate();
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}–${endDay}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}

export const BriefingHeader: React.FC<BriefingHeaderProps> = ({
  weekStart,
  weekEnd,
  onPrevWeek,
  onNextWeek,
  onToday,
}) => {
  const range = formatRange(weekStart, weekEnd);
  return (
    <div className="briefing-header">
      <div className="briefing-title-block">
        <h1 className="briefing-title">Briefing</h1>
        {range && <span className="briefing-week">Week of {range}</span>}
      </div>
      <div className="briefing-nav" role="group" aria-label="Week navigation">
        <button
          type="button"
          className="briefing-nav-btn"
          onClick={onPrevWeek}
          aria-label="Previous week"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="briefing-nav-today"
          onClick={onToday}
        >
          Today
        </button>
        <button
          type="button"
          className="briefing-nav-btn"
          onClick={onNextWeek}
          aria-label="Next week"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default BriefingHeader;
