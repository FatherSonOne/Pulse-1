// src/components/Archives/ArchiveTimelineView.tsx
// Timeline view grouped by month with dot markers

import React from 'react';
import { archiveService } from '../../services/archiveService';
import { useArchiveStore } from '../../store/archiveStore';
import { getTypeConfig } from './archiveHelpers';

export const ArchiveTimelineView: React.FC = () => {
  const { timelineEvents, setSelectedItem } = useArchiveStore();

  // Group timeline events by month
  const timelineByMonth = timelineEvents.reduce((acc, event) => {
    const monthKey = event.date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(event);
    return acc;
  }, {} as Record<string, typeof timelineEvents>);

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-800"></div>
      {Object.entries(timelineByMonth).map(([month, events]) => (
        <div key={month} className="mb-6">
          <div className="relative pl-10 mb-3">
            <div className="absolute left-2.5 w-3 h-3 rounded-full bg-rose-500"></div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{month}</h3>
          </div>
          {events.map(event => {
            const config = getTypeConfig(event.type);
            return (
              <div
                key={event.id}
                onClick={() => archiveService.getArchive(event.archiveId).then(setSelectedItem)}
                className="relative pl-10 mb-2 cursor-pointer group"
              >
                <div className="absolute left-3 w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-rose-500 transition"></div>
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-rose-500/30 transition">
                  <div className="flex items-center gap-2 mb-1">
                    <config.Icon className={`${config.color} w-3 h-3`} />
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {event.date.toLocaleDateString()} {event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-zinc-900 dark:text-white">{event.title}</h4>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{event.preview}</p>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default ArchiveTimelineView;
