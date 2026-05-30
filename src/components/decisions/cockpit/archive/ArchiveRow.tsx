/**
 * ArchiveRow — one row in the Archive timeline rail. Reuses the queue-row
 * shell; shows a kind/status icon, title, and the archived date.
 */
import { CheckCircle2, Ban, Scale, XCircle } from 'lucide-react';
import type { ArchiveItem } from './ArchiveView';

interface ArchiveRowProps {
  item: ArchiveItem;
  active: boolean;
  onSelect: () => void;
}

export function ArchiveRow({ item, active, onSelect }: ArchiveRowProps) {
  const isTask = item.type === 'task';
  const cancelled = item.status === 'cancelled';
  const Icon = item.type === 'decision' ? Scale : cancelled ? XCircle : item.status === 'done' ? CheckCircle2 : Ban;
  const color = cancelled ? 'var(--dt-status-cancelled)' : isTask ? 'var(--dt-status-done)' : 'var(--dt-status-decided)';

  return (
    <div role="option" aria-selected={active} tabIndex={-1} onClick={onSelect} className="ck-qitem" data-active={active}>
      {active && <span className="ck-qitem-stripe" aria-hidden />}
      <span className="ck-qitem-status" style={{ color }}><Icon size={15} strokeWidth={2.2} /></span>
      <div className="ck-qitem-main">
        <div className="ck-qitem-title">{item.title}</div>
        <div className="ck-qitem-meta">
          <span className="ck-qitem-due">{item.completedDate.toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
