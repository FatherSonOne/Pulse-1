import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../services/supabase';
import GlanceTileShell from './GlanceTileShell';

interface DecisionVelocityTileProps {
  workspaceId: string | null | undefined;
  onClick?: () => void;
}

const WEEKS = 6;
const MS_PER_WEEK = 7 * 86_400_000;

const DecisionVelocityTile: React.FC<DecisionVelocityTileProps> = ({ workspaceId, onClick }) => {
  const [points, setPoints] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      const since = new Date(Date.now() - WEEKS * MS_PER_WEEK).toISOString();
      const { data, error } = await supabase
        .from('decisions')
        .select('decided_at')
        .eq('workspace_id', workspaceId)
        .eq('status', 'decided')
        .gte('decided_at', since)
        .order('decided_at', { ascending: true });

      if (!active) return;
      if (error || !data) {
        setPoints([]);
        setLoading(false);
        return;
      }

      const buckets = new Array(WEEKS).fill(0);
      const now = Date.now();
      data.forEach(row => {
        if (!row.decided_at) return;
        const t = new Date(row.decided_at).getTime();
        const weeksAgo = Math.min(WEEKS - 1, Math.floor((now - t) / MS_PER_WEEK));
        const idx = WEEKS - 1 - weeksAgo;
        if (idx >= 0 && idx < WEEKS) buckets[idx]++;
      });
      setPoints(buckets);
      setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [workspaceId]);

  const { latest, prev, max, trend } = useMemo(() => {
    if (points.length === 0) return { latest: 0, prev: 0, max: 0, trend: 'flat' as const };
    const lt = points[points.length - 1];
    const pv = points.length >= 2 ? points[points.length - 2] : 0;
    const mx = Math.max(1, ...points);
    const tr: 'up' | 'down' | 'flat' = lt > pv ? 'up' : lt < pv ? 'down' : 'flat';
    return { latest: lt, prev: pv, max: mx, trend: tr };
  }, [points]);

  if (loading || points.length === 0 || points.every(p => p === 0)) return null;

  const width = 100;
  const height = 32;
  const stepX = width / Math.max(1, points.length - 1);
  const pathD = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - (p / max) * height;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const trendColor =
    trend === 'up'   ? 'text-emerald-600 dark:text-emerald-400' :
    trend === 'down' ? 'text-red-600 dark:text-red-400' :
                       'text-zinc-500 dark:text-zinc-400';
  const trendGlyph = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const strokeColor = trend === 'down' ? '#ef4444' : '#f43f5e';

  return (
    <GlanceTileShell
      label="DECISION VELOCITY"
      ariaLabel={`${latest} decisions this week, ${trend === 'up' ? 'up from' : trend === 'down' ? 'down from' : 'same as'} ${prev} last week`}
      onClick={onClick}
      headline={
        <span className="flex items-baseline gap-2">
          <span>{latest}</span>
          <span className="pulse-label text-zinc-400 dark:text-zinc-500">/ WK</span>
          <span className={`pulse-label ${trendColor}`}>
            {trendGlyph} {Math.abs(latest - prev) || ''}
          </span>
        </span>
      }
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-8"
        aria-hidden="true"
      >
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => {
          if (i !== points.length - 1) return null;
          const x = i * stepX;
          const y = height - (p / max) * height;
          return <circle key={i} cx={x} cy={y} r="2" fill={strokeColor} />;
        })}
      </svg>
    </GlanceTileShell>
  );
};

export default DecisionVelocityTile;
