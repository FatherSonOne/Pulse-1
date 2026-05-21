// ============================================================
// TeamRadarTile
//
// Dashboard glance tile: who on your team is broadcasting their
// location right now, and which contacts have gone stale.
//
// Polls teamRadarService every 45s — no realtime fan-out, no nested
// subscriptions. Renders `null` when there's nothing to show (no
// workspace, no broadcasting members AND no coverage gaps), matching
// the existing tile convention.
// ============================================================

import React, { useEffect, useState } from 'react';
import { Radio, MapPin, AlertCircle } from 'lucide-react';
import GlanceTileShell from './GlanceTileShell';
import {
  loadTeamRadar,
  formatStaleness,
  TeamRadarSnapshot,
  BroadcastingMember,
  CoverageGap,
} from '../../../services/teamRadarService';

interface TeamRadarTileProps {
  workspaceId: string | null | undefined;
  authUserId: string | null | undefined;
  onClick?: () => void;
}

const POLL_INTERVAL_MS = 45_000;

const TeamRadarTile: React.FC<TeamRadarTileProps> = ({ workspaceId, authUserId, onClick }) => {
  const [snapshot, setSnapshot] = useState<TeamRadarSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !authUserId) {
      setLoading(false);
      return;
    }
    let active = true;

    const refresh = async () => {
      try {
        const next = await loadTeamRadar(workspaceId, authUserId);
        if (active) setSnapshot(next);
      } catch (err) {
        console.warn('[TeamRadarTile] refresh failed:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [workspaceId, authUserId]);

  if (loading || !snapshot) return null;

  const { broadcasting, coverageGaps, totalMembers, totalGaps } = snapshot;

  // Render nothing when there's literally nothing actionable. Keeps the
  // tile-grid dense for new workspaces.
  if (broadcasting.length === 0 && totalGaps === 0) return null;

  const liveCount = broadcasting.length;
  const liveSuffix = totalMembers > 0 ? ` / ${totalMembers}` : '';

  return (
    <GlanceTileShell
      label="TEAM RADAR"
      ariaLabel={`${liveCount} team members live, ${totalGaps} coverage gaps`}
      onClick={onClick}
      headline={
        <span className="flex items-baseline gap-2">
          <span>{liveCount}{liveSuffix}</span>
          <span className="pulse-label text-zinc-400 dark:text-zinc-500">LIVE</span>
          {totalGaps > 0 && (
            <>
              <span className="pulse-label text-zinc-300 dark:text-zinc-600">·</span>
              <span className="pulse-label text-amber-600 dark:text-amber-400">{totalGaps} GAPS</span>
            </>
          )}
        </span>
      }
    >
      {broadcasting.length > 0 ? (
        <ul className="space-y-1.5">
          {broadcasting.slice(0, 3).map(m => (
            <BroadcastingRow key={m.userId} member={m} />
          ))}
          {broadcasting.length > 3 && (
            <li className="pulse-label text-zinc-500 dark:text-zinc-400">
              + {broadcasting.length - 3} more broadcasting
            </li>
          )}
        </ul>
      ) : (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
          <Radio size={12} className="text-zinc-400" />
          No team members live right now
        </div>
      )}

      {coverageGaps.length > 0 && (
        <div className="mt-2 pt-2 border-t border-zinc-200/60 dark:border-white/[0.06]">
          <div className="pulse-label text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
            <AlertCircle size={10} />
            COVERAGE GAPS
          </div>
          <ul className="space-y-0.5">
            {coverageGaps.map(g => (
              <CoverageGapRow key={g.contactId} gap={g} />
            ))}
          </ul>
        </div>
      )}
    </GlanceTileShell>
  );
};

const BroadcastingRow: React.FC<{ member: BroadcastingMember }> = ({ member }) => {
  const initials = member.name
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <li className="flex items-center gap-2 text-xs">
      {member.avatarUrl ? (
        <img
          src={member.avatarUrl}
          alt=""
          className="w-5 h-5 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
          {initials || '?'}
        </div>
      )}
      <span className="relative inline-flex h-2 w-2 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-500 opacity-60 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
      </span>
      <span className="truncate flex-1 text-zinc-700 dark:text-zinc-200 font-medium">
        {member.name}
      </span>
      <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-0.5 flex-shrink-0">
        {member.locationLabel && (
          <>
            <MapPin size={9} className="text-zinc-400" />
            <span className="truncate max-w-[80px]">{member.locationLabel}</span>
            <span className="text-zinc-300 dark:text-zinc-600 mx-0.5">·</span>
          </>
        )}
        {formatStaleness(member.staleSeconds)}
      </span>
    </li>
  );
};

const CoverageGapRow: React.FC<{ gap: CoverageGap }> = ({ gap }) => {
  const dotColor = gap.avatarColor || 'bg-zinc-400 dark:bg-zinc-600';
  const stalenessLabel = gap.daysStale == null
    ? 'never'
    : `${gap.daysStale}d`;
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor.startsWith('#') ? '' : dotColor}`}
        style={dotColor.startsWith('#') ? { backgroundColor: dotColor } : undefined}
      />
      <span className="truncate flex-1 text-zinc-700 dark:text-zinc-300">
        {gap.name}
        {gap.company && (
          <span className="text-zinc-400 dark:text-zinc-500"> · {gap.company}</span>
        )}
      </span>
      <span className="text-amber-600 dark:text-amber-400 font-medium flex-shrink-0">
        {stalenessLabel}
      </span>
    </li>
  );
};

export default TeamRadarTile;
