/**
 * ArchiveMetrics — the velocity strip in the Archive filter bar (same 4
 * computations as the legacy ArchiveView, rendered inline as a compact strip).
 */
import { CheckCircle2, Clock, Scale, TrendingUp } from 'lucide-react';

export interface ArchiveMetricValues {
  completedTasksCount: number;
  avgCompletionDays: number;
  resolvedDecisionsCount: number;
  successRate: number;
}

export function ArchiveMetrics({ metrics }: { metrics: ArchiveMetricValues }) {
  const items = [
    { icon: CheckCircle2, tone: 'var(--dt-status-done)', value: String(metrics.completedTasksCount), label: 'completed' },
    { icon: Clock, tone: 'var(--dt-status-in-progress)', value: `${metrics.avgCompletionDays}d`, label: 'avg time' },
    { icon: Scale, tone: 'var(--dt-status-decided)', value: String(metrics.resolvedDecisionsCount), label: 'resolved' },
    { icon: TrendingUp, tone: 'var(--dt-status-proposed)', value: `${metrics.successRate}%`, label: 'success' },
  ];
  return (
    <div className="ck-archive-metrics">
      {items.map((m) => (
        <div key={m.label} className="ck-archive-metric">
          <m.icon size={13} style={{ color: m.tone }} />
          <span className="ck-archive-metric-val">{m.value}</span>
          <span className="ck-archive-metric-lbl">{m.label}</span>
        </div>
      ))}
    </div>
  );
}
