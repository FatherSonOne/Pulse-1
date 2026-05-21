import React from 'react';
import GlanceTileShell from './GlanceTileShell';

interface AttentionDensityTileProps {
  messages: number;
  email: number;
  relay: number;
  calendar: number;
  urgent: number;
  onClick?: () => void;
}

interface Slice {
  key: string;
  label: string;
  count: number;
  className: string;
}

const AttentionDensityTile: React.FC<AttentionDensityTileProps> = ({
  messages,
  email,
  relay,
  calendar,
  urgent,
  onClick,
}) => {
  const total = messages + email + relay + calendar;

  const slices: Slice[] = [
    { key: 'messages', label: 'MSG',   count: messages, className: 'bg-rose-500' },
    { key: 'email',    label: 'EMAIL', count: email,    className: 'bg-blue-500' },
    { key: 'relay',    label: 'RELAY', count: relay,    className: 'bg-violet-500' },
    { key: 'cal',      label: 'CAL',   count: calendar, className: 'bg-amber-500' },
  ].filter(s => s.count > 0);

  return (
    <GlanceTileShell
      label="ATTENTION"
      ariaLabel={`Attention density: ${total} open, ${urgent} urgent`}
      onClick={onClick}
      headline={
        <span className="flex items-baseline gap-2">
          <span>{total}</span>
          <span className="pulse-label text-zinc-400 dark:text-zinc-500">OPEN</span>
          {urgent > 0 && (
            <>
              <span className="pulse-label text-zinc-300 dark:text-zinc-600">·</span>
              <span className="pulse-label text-rose-600 dark:text-rose-400">{urgent} URGENT</span>
            </>
          )}
        </span>
      }
    >
      {total === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Inbox is quiet.</p>
      ) : (
        <>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden bg-zinc-100 dark:bg-white/[0.04] flex"
            role="img"
            aria-label="Attention by source"
          >
            {slices.map(s => (
              <div
                key={s.key}
                className={s.className}
                style={{ width: `${(s.count / total) * 100}%` }}
                title={`${s.label}: ${s.count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">
            {slices.map(s => (
              <span key={s.key} className="pulse-label text-zinc-500 dark:text-zinc-400">
                {s.label} · {s.count}
              </span>
            ))}
          </div>
        </>
      )}
    </GlanceTileShell>
  );
};

export default AttentionDensityTile;
