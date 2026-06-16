// ─────────────────────────────────────────────────────────────────────────────
// SurfacesCluster — Direction-D "Horizon" floating-chrome (Tier-3 §8B) top-right
// island that unifies the Map's slide-in surfaces into one neutral icon cluster:
// Routes · Live · Fences, each with an optional monochrome count badge. Replaces
// the scattered band-era entry points (broadcast pill / bottom-left geofences
// button) so the float layout has a single, legible surface switcher.
//
// Routes is rendered ONLY when onOpenRoutes is supplied (the P10 Routes drawer
// lands in F5) — until then the cluster shows Live + Fences and never a dead
// button. Each button opens a dialog drawer (aria-haspopup) and reflects its open
// state via aria-expanded. NEUTRAL — coral is reserved for AI/live signal
// (CLAUDE.md §4); colors come from the canonical --pulse-* tokens.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Route, Shield, Users } from 'lucide-react';

export interface SurfacesClusterProps {
  isDarkMode: boolean;
  onOpenLive: () => void;
  liveActive: boolean;
  liveBadge?: number;
  onOpenFences: () => void;
  fencesActive: boolean;
  fencesBadge?: number;
  /** F5 (P10): when provided, the Routes button appears at the head of the cluster. */
  onOpenRoutes?: () => void;
  routesActive?: boolean;
  routesBadge?: number;
}

interface SurfaceBtnProps {
  label: string;
  Icon: typeof Users;
  active: boolean;
  badge?: number;
  isDarkMode: boolean;
  onClick: () => void;
}

const SurfaceBtn: React.FC<SurfaceBtnProps> = ({ label, Icon, active, badge, isDarkMode, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-haspopup="dialog"
    aria-expanded={active}
    aria-label={`${label}${badge && badge > 0 ? ` — ${badge}` : ''}`}
    title={label}
    className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
      isDarkMode ? 'focus-visible:ring-zinc-400' : 'focus-visible:ring-zinc-500'
    }`}
    style={{
      background: active ? 'var(--pulse-surface-raised)' : 'transparent',
      border: `1px solid ${active ? 'var(--pulse-border-strong)' : 'transparent'}`,
      color: active ? 'var(--pulse-ink)' : 'var(--pulse-ink-2)',
    }}
  >
    <Icon size={17} aria-hidden="true" />
    {badge != null && badge > 0 && (
      <span
        aria-hidden="true"
        className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
        style={{ background: 'var(--pulse-ink)', color: 'var(--pulse-canvas)' }}
      >
        {badge}
      </span>
    )}
  </button>
);

export const SurfacesCluster: React.FC<SurfacesClusterProps> = ({
  isDarkMode,
  onOpenLive,
  liveActive,
  liveBadge,
  onOpenFences,
  fencesActive,
  fencesBadge,
  onOpenRoutes,
  routesActive,
  routesBadge,
}) => {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl backdrop-blur-md"
      style={{
        background: 'var(--pulse-surface)',
        border: '1px solid var(--pulse-border)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
      }}
    >
      {onOpenRoutes && (
        <SurfaceBtn
          label="Routes"
          Icon={Route}
          active={!!routesActive}
          badge={routesBadge}
          isDarkMode={isDarkMode}
          onClick={onOpenRoutes}
        />
      )}
      <SurfaceBtn
        label="Live"
        Icon={Users}
        active={liveActive}
        badge={liveBadge}
        isDarkMode={isDarkMode}
        onClick={onOpenLive}
      />
      <SurfaceBtn
        label="Fences"
        Icon={Shield}
        active={fencesActive}
        badge={fencesBadge}
        isDarkMode={isDarkMode}
        onClick={onOpenFences}
      />
    </div>
  );
};
