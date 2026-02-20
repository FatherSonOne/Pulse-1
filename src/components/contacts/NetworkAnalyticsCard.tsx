// ============================================
// NETWORK ANALYTICS CARD
// Compact summary card showing network health metrics.
// Shown in CirclesView header area.
// ============================================

import React from 'react';
import { ContactCircle } from '../../types/contactCircleTypes';
import { Contact } from '../../types';
import { RelationshipProfile } from '../../types/relationshipTypes';

// ==================== TYPES ====================

interface NetworkAnalyticsCardProps {
  circles: ContactCircle[];
  contacts: Contact[];
  profiles: RelationshipProfile[];
  orphanCount: number;
}

// ==================== HELPERS ====================

function getNetworkHealthColor(score: number): string {
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function getNetworkHealthLabel(score: number): string {
  if (score >= 80) return 'Thriving';
  if (score >= 60) return 'Healthy';
  if (score >= 40) return 'Fair';
  return 'Needs work';
}

// ==================== COMPONENT ====================

export const NetworkAnalyticsCard: React.FC<NetworkAnalyticsCardProps> = ({
  circles,
  contacts,
  profiles,
  orphanCount,
}) => {
  // Calculate aggregate network health from all profiles
  const avgScore = profiles.length > 0
    ? Math.round(profiles.reduce((sum, p) => sum + p.relationshipScore, 0) / profiles.length)
    : undefined;

  // Count contacts with strong relationships
  const strongCount = profiles.filter(p => p.relationshipScore >= 70).length;
  const atRiskCount = profiles.filter(p => p.relationshipScore < 30).length;

  // Circle coverage
  const coveredIds = new Set(circles.flatMap(c => c.memberContactIds));
  const coveragePercent = contacts.length > 0
    ? Math.round((coveredIds.size / contacts.length) * 100)
    : 0;

  const stats = [
    {
      label: 'Network health',
      value: avgScore !== undefined ? String(avgScore) : '—',
      sub: avgScore !== undefined ? getNetworkHealthLabel(avgScore) : 'No data',
      colorClass: avgScore !== undefined ? getNetworkHealthColor(avgScore) : 'text-zinc-400',
      icon: 'fa-solid fa-heart-pulse',
    },
    {
      label: 'Circles',
      value: String(circles.length),
      sub: `${contacts.length} contacts`,
      colorClass: 'text-indigo-600 dark:text-indigo-400',
      icon: 'fa-solid fa-circle-nodes',
    },
    {
      label: 'Strong ties',
      value: String(strongCount),
      sub: `${atRiskCount} at risk`,
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      icon: 'fa-solid fa-handshake',
    },
    {
      label: 'Coverage',
      value: `${coveragePercent}%`,
      sub: orphanCount > 0 ? `${orphanCount} unorganised` : 'All organised',
      colorClass: coveragePercent >= 80
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-amber-600 dark:text-amber-400',
      icon: 'fa-solid fa-chart-pie',
    },
  ];

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <i className="fa-solid fa-chart-network text-xs text-indigo-500" />
        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          Network Overview
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(stat => (
          <div
            key={stat.label}
            className="bg-white/60 dark:bg-zinc-900/40 rounded-lg p-2.5 text-center"
          >
            <div className="flex items-center justify-center mb-1">
              <i className={`${stat.icon} text-xs text-zinc-400`} />
            </div>
            <div className={`text-lg font-bold leading-none mb-0.5 ${stat.colorClass}`}>
              {stat.value}
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
              {stat.label}
            </div>
            <div className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-tight mt-0.5">
              {stat.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NetworkAnalyticsCard;
