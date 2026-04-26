import React, { useState, useEffect, useCallback } from 'react';
import {
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Loader2,
  Circle,
  LogOut,
  History,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { userSessionsService, UserSession } from '../../../services/userSessionsService';

function deviceIcon(deviceType: string | null): React.ReactElement {
  switch ((deviceType || '').toLowerCase()) {
    case 'mobile':  return <Smartphone className="w-4 h-4 text-zinc-400" />;
    case 'tablet':  return <Tablet className="w-4 h-4 text-zinc-400" />;
    case 'desktop': return <Laptop className="w-4 h-4 text-zinc-400" />;
    default:        return <Monitor className="w-4 h-4 text-zinc-400" />;
  }
}

function describe(s: UserSession): string {
  const parts = [s.browser_name, s.os_name].filter(Boolean);
  return parts.length ? parts.join(' · ') : (s.device_name || 'Unknown device');
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1)   return 'just now';
  if (min < 60)  return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24)    return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30)    return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const DevicesSessionsCard: React.FC = () => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await userSessionsService.list(30);
      setSessions(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load sessions';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (id: string) => {
    if (!confirm('Sign out this device?')) return;
    setRevokingId(id);
    try {
      await userSessionsService.revoke(id);
      toast.success('Device signed out');
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign out device';
      toast.error(msg);
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!confirm('Sign out of all other devices? You will stay signed in here.')) return;
    setIsRevokingOthers(true);
    try {
      const count = await userSessionsService.revokeOtherSessions();
      toast.success(count === 0 ? 'No other devices were active' : `Signed out of ${count} other device${count === 1 ? '' : 's'}`);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign out other devices';
      toast.error(msg);
    } finally {
      setIsRevokingOthers(false);
    }
  };

  const active = sessions.filter(s => s.is_active);
  const past   = sessions.filter(s => !s.is_active);
  const hasOthers = active.some(s => !s.is_current);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-zinc-500" />
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Devices &amp; sessions</h4>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-500 disabled:opacity-40"
          title="Refresh"
          aria-label="Refresh sessions"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Devices currently signed in to your account, plus your recent sign-in history.
      </p>

      {isLoading && sessions.length === 0 && (
        <div className="py-6 text-center">
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto" />
        </div>
      )}

      {!isLoading && sessions.length === 0 && (
        <div className="py-6 text-center text-xs text-zinc-400">
          No session records yet.
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Active ({active.length})</p>
          <div className="space-y-2">
            {active.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                {deviceIcon(s.device_type)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{describe(s)}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <Circle className="w-1.5 h-1.5 fill-emerald-500 text-emerald-500" />
                      active
                    </span>
                    {s.is_current && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-medium">this device</span>
                    )}
                    {s.mfa_verified && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">2FA</span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {s.ip_address && <><span className="font-mono">{s.ip_address}</span></>}
                    {s.location && <> · {s.location}</>}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Last active {relativeTime(s.last_active_at)}
                  </p>
                </div>
                {!s.is_current && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(s.id)}
                    disabled={revokingId === s.id}
                    className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-40 flex-shrink-0"
                  >
                    {revokingId === s.id ? 'Signing out...' : 'Sign out'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasOthers && (
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={isRevokingOthers}
            className="inline-flex items-center gap-2 text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-40"
          >
            <LogOut className="w-3.5 h-3.5" />
            {isRevokingOthers ? 'Signing out others...' : 'Sign out of all other devices'}
          </button>
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Recent sign-ins</p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {past.slice(0, 20).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-2 py-1.5 text-[11px]">
                {deviceIcon(s.device_type)}
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-700 dark:text-zinc-300 truncate">{describe(s)}</p>
                  <p className="text-zinc-400 mt-0.5">
                    Signed in {new Date(s.created_at).toLocaleString()}
                    {s.revoked_at && <> · ended {relativeTime(s.revoked_at)}</>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
