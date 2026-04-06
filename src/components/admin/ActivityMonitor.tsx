// ============================================
// ACTIVITY MONITOR — Admin live activity panel
// Four panels: Presence, Signups, Leaderboard, Event Feed
// ============================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { settingsService } from '../../services/settingsService';

import { Loader2, RefreshCw, Zap } from 'lucide-react';

// ==================== TYPES ====================

interface UserPresence {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  onlineStatus: 'online' | 'offline' | 'away' | 'busy';
  lastActiveAt?: Date;
  createdAt: Date;
  messagesCount: number;
}

interface MessageStat {
  userId: string;
  name: string;
  totalSent7d: number;
  todaySent: number;
}

interface FeedEvent {
  id: string;
  action: string;
  actorName: string;
  details?: string;
  createdAt: Date;
}

// ==================== HELPERS ====================

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function statusDot(s: string): string {
  if (s === 'online') return '#22c55e';
  if (s === 'away')   return '#f59e0b';
  if (s === 'busy')   return '#ef4444';
  return '#52525b';
}

function statusLabel(s: string): string {
  if (s === 'online') return 'Online';
  if (s === 'away')   return 'Away';
  if (s === 'busy')   return 'Busy';
  return 'Offline';
}

const STATUS_ORDER: Record<string, number> = { online: 0, away: 1, busy: 2, offline: 3 };

function eventIcon(action: string): string {
  if (action.includes('login'))    return 'fa-right-to-bracket';
  if (action.includes('logout'))   return 'fa-right-from-bracket';
  if (action.includes('role'))     return 'fa-user-shield';
  if (action.includes('delete'))   return 'fa-trash';
  if (action.includes('settings')) return 'fa-gear';
  if (action.includes('message'))  return 'fa-comment';
  if (action.includes('suspend'))  return 'fa-user-slash';
  if (action.includes('active') || action.includes('approv')) return 'fa-user-check';
  if (action.includes('signup') || action.includes('creat'))  return 'fa-user-plus';
  return 'fa-circle-dot';
}

function eventColor(action: string): string {
  if (action.includes('login'))    return '#22c55e';
  if (action.includes('logout'))   return '#52525b';
  if (action.includes('delete') || action.includes('suspend')) return '#ef4444';
  if (action.includes('role'))     return '#8b5cf6';
  if (action.includes('settings')) return '#f59e0b';
  if (action.includes('signup') || action.includes('creat'))   return '#06b6d4';
  return '#6366f1';
}

function Initials({ name, size = 32 }: { name: string; size?: number }) {
  const sizeClass = size === 32 ? 'w-8 h-8 text-[13px]' : size === 28 ? 'w-7 h-7 text-[11px]' : `w-[${size}px] h-[${size}px] text-[${Math.round(size * 0.4)}px]`;
  return (
    <div className={`${sizeClass} rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 font-bold shrink-0 tracking-normal`}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// ==================== STAT CARD ====================

function StatCard({ label, value, icon, color, pulse }: {
  label: string; value: number | string; icon: string; color: string; pulse?: boolean;
}) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        {pulse
          ? <span className="w-2 h-2 rounded-full inline-block" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          : <i className={`fa-solid ${icon} text-[13px]`} style={{ color }} />
        }
        <span className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-[28px] font-bold text-zinc-900 dark:text-white leading-none">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

// ==================== PANEL HEADER ====================

function PanelHeader({ icon, iconColor, title, right }: {
  icon: string; iconColor: string; title: string; right?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <i className={`fa-solid ${icon} text-[13px]`} style={{ color: iconColor }} />
        <span className="font-bold text-zinc-900 dark:text-white text-sm">{title}</span>
      </div>
      {right && <div className="text-[11px] text-zinc-400 dark:text-zinc-500">{right}</div>}
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

const ActivityMonitor: React.FC = () => {
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [msgStats, setMsgStats] = useState<MessageStat[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const [hideFromLeaderboard, setHideFromLeaderboard] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // ── Fetch: presence ──────────────────────────────────────────
  const fetchPresence = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, display_name, full_name, email, avatar_url, online_status, last_active_at, last_seen_at, created_at, messages_count');

    if (error) { console.error('[ActivityMonitor] presence:', error); return; }

    const mapped: UserPresence[] = (data || []).map(u => ({
      id: u.id,
      name: u.display_name || u.full_name || u.email?.split('@')[0] || 'Unknown',
      email: u.email || '',
      avatarUrl: u.avatar_url,
      onlineStatus: u.online_status || 'offline',
      lastActiveAt: u.last_active_at
        ? new Date(u.last_active_at)
        : u.last_seen_at ? new Date(u.last_seen_at) : undefined,
      createdAt: new Date(u.created_at),
      messagesCount: u.messages_count || 0,
    }));

    mapped.sort((a, b) => (STATUS_ORDER[a.onlineStatus] ?? 3) - (STATUS_ORDER[b.onlineStatus] ?? 3));
    setUsers(mapped);
    setLoading(false);
  }, []);

  // ── Fetch: message leaderboard ───────────────────────────────
  const fetchMsgStats = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const sevenAgo = new Date();
    sevenAgo.setDate(sevenAgo.getDate() - 7);

    const { data: metrics, error } = await supabase
      .from('analytics_daily_metrics')
      .select('user_id, date, messages_sent')
      .gte('date', sevenAgo.toISOString().split('T')[0]);

    if (error) {
      // Fall back: build from user_profiles.messages_count
      console.warn('[ActivityMonitor] analytics_daily_metrics unavailable, using messages_count');
      return;
    }

    // Fetch names for mapping
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, display_name, full_name, email');

    const nameMap = new Map((profiles || []).map(p => [
      p.id,
      p.display_name || p.full_name || p.email?.split('@')[0] || 'Unknown',
    ]));

    const agg = new Map<string, { total: number; today: number }>();
    for (const m of (metrics || [])) {
      const cur = agg.get(m.user_id) ?? { total: 0, today: 0 };
      cur.total += m.messages_sent || 0;
      if (m.date === today) cur.today = m.messages_sent || 0;
      agg.set(m.user_id, cur);
    }

    const stats: MessageStat[] = Array.from(agg.entries())
      .map(([userId, counts]) => ({
        userId,
        name: nameMap.get(userId) || 'Unknown',
        totalSent7d: counts.total,
        todaySent: counts.today,
      }))
      .sort((a, b) => b.totalSent7d - a.totalSent7d);

    setMsgStats(stats);
  }, []);

  // ── Fetch: event feed ────────────────────────────────────────
  const fetchFeed = useCallback(async () => {
    const { data, error } = await supabase
      .from('admin_activity_logs')
      .select('id, action, actor_name, details, created_at')
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) { console.error('[ActivityMonitor] feed:', error); return; }

    setFeed((data || []).map(e => ({
      id: e.id,
      action: e.action,
      actorName: e.actor_name || 'System',
      details: e.details,
      createdAt: new Date(e.created_at),
    })));
  }, []);

  // ── Load all & schedule refresh ──────────────────────────────
  const loadAll = useCallback(async () => {
    await Promise.all([fetchPresence(), fetchMsgStats(), fetchFeed()]);
    setLastRefresh(new Date());
  }, [fetchPresence, fetchMsgStats, fetchFeed]);

  useEffect(() => {
    // Load current user ID and leaderboard setting
    const loadUserSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);
        const lbSetting = await settingsService.get('activityMonitorLeaderboard');
        if (lbSetting === false) setHideFromLeaderboard(true);
      } catch {}
    };
    loadUserSettings();

    loadAll();

    // Respect sync frequency setting
    const syncFreq = localStorage.getItem('pulse_sync_frequency') || 'realtime';
    const intervalMap: Record<string, number> = {
      realtime: 10_000,
      '15min': 15 * 60_000,
      hourly: 60 * 60_000,
    };
    const interval = intervalMap[syncFreq];
    if (interval) {
      timerRef.current = setInterval(loadAll, interval);
    }
    // 'manual' = no auto-refresh

    // Real-time: re-fetch presence when any user's online_status changes
    const ch = supabase
      .channel('am-presence')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_profiles' }, fetchPresence)
      .subscribe();

    return () => {
      clearInterval(timerRef.current);
      supabase.removeChannel(ch);
    };
  }, [loadAll, fetchPresence]);

  // ── Derived ──────────────────────────────────────────────────
  const onlineCount  = users.filter(u => u.onlineStatus === 'online').length;
  const awayCount    = users.filter(u => u.onlineStatus === 'away' || u.onlineStatus === 'busy').length;
  const dayAgo       = Date.now() - 86_400_000;
  const weekAgo      = Date.now() - 7 * 86_400_000;
  const newToday     = users.filter(u => u.createdAt.getTime() > dayAgo).length;
  const newThisWeek  = users.filter(u => u.createdAt.getTime() > weekAgo).length;
  // Filter current user from leaderboard if they opted out
  const filteredMsgStats = hideFromLeaderboard && currentUserId
    ? msgStats.filter(u => u.userId !== currentUserId)
    : msgStats;
  const total7d      = filteredMsgStats.reduce((s, u) => s + u.totalSent7d, 0);
  const maxMsg       = Math.max(...filteredMsgStats.map(u => u.totalSent7d), 1);

  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-zinc-400 dark:text-zinc-500">
        <Loader2 className="animate-spin" />
        Loading activity data…
      </div>
    );
  }

  return (
    <div className="pt-6 pb-10">

      {/* ── Header KPIs ── */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Users"     value={users.length}  icon="fa-users"       color="#6366f1" />
        <StatCard label="Online Now"      value={onlineCount}   icon="fa-circle"      color="#22c55e" pulse />
        <StatCard label="Away / Busy"     value={awayCount}     icon="fa-moon"        color="#f59e0b" />
        <StatCard label="New This Week"   value={newThisWeek}   icon="fa-user-plus"   color="#06b6d4" />
        <StatCard label="Messages (7d)"   value={total7d}       icon="fa-comment-dots" color="#a855f7" />
      </div>

      {/* ── Panels row 1: Presence + Signups ── */}
      <div className="grid grid-cols-2 gap-5 mb-5">

        {/* Panel 1 — Live Presence */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <PanelHeader
            icon="fa-circle"
            iconColor="#22c55e"
            title="Live Presence"
            right={<span className="inline-flex items-center gap-[5px]"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} /> Realtime</span>}
          />
          <div className="max-h-[340px] overflow-y-auto">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800/50">
                {/* Avatar + dot */}
                <div className="relative shrink-0">
                  {u.avatarUrl
                    ? <img src={u.avatarUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                    : <Initials name={u.name} size={32} />
                  }
                  <span
                    className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-950"
                    style={{ background: statusDot(u.onlineStatus) }}
                  />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate">{u.name}</div>
                  <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    {u.onlineStatus === 'online'
                      ? 'Online now'
                      : u.lastActiveAt ? relativeTime(u.lastActiveAt) : 'Never seen'
                    }
                  </div>
                </div>
                {/* Badge */}
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-[0.04em]"
                  style={{
                    background: `${statusDot(u.onlineStatus)}18`,
                    color: statusDot(u.onlineStatus),
                  }}
                >
                  {statusLabel(u.onlineStatus)}
                </span>
              </div>
            ))}
            {users.length === 0 && (
              <div className="p-10 text-center text-zinc-400 dark:text-zinc-500 text-[13px]">No users yet</div>
            )}
          </div>
        </div>

        {/* Panel 2 — Recent Signups */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <PanelHeader
            icon="fa-user-plus"
            iconColor="#06b6d4"
            title="Recent Signups"
            right={`${newToday} today · ${newThisWeek} this week`}
          />
          <div className="max-h-[340px] overflow-y-auto">
            {[...users]
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .slice(0, 20)
              .map(u => {
                const isNew = u.createdAt.getTime() > dayAgo;
                return (
                  <div key={u.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800/50">
                    <Initials name={u.name} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate">{u.name}</span>
                        {isNew && (
                          <span className="text-[9px] font-bold px-1.5 py-px rounded-full bg-cyan-500/10 text-cyan-500 uppercase tracking-wide shrink-0">New</span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{u.email}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{relativeTime(u.createdAt)}</div>
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500">{u.messagesCount} msgs</div>
                    </div>
                  </div>
                );
              })}
            {users.length === 0 && (
              <div className="p-10 text-center text-zinc-400 dark:text-zinc-500 text-[13px]">No users yet</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Panel 3: Message Leaderboard ── */}
      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden mb-5">
        <PanelHeader
          icon="fa-ranking-star"
          iconColor="#a855f7"
          title="Message Activity — Last 7 Days"
          right={`${total7d.toLocaleString()} total sent`}
        />
        <div className="px-5 py-4">
          {msgStats.length === 0 ? (
            // Fall back: show messages_count from user_profiles
            users.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {[...users]
                  .filter(u => u.messagesCount > 0)
                  .sort((a, b) => b.messagesCount - a.messagesCount)
                  .slice(0, 10)
                  .map((u, i) => {
                    const maxCount = Math.max(...users.map(x => x.messagesCount), 1);
                    return (
                      <div key={u.id} className="flex items-center gap-3">
                        <span
                          className="w-5 text-right text-xs font-bold"
                          style={{ color: i < 3 ? ['#f59e0b','#9ca3af','#b45309'][i] : undefined }}
                        >
                          <span className={i >= 3 ? 'text-zinc-400 dark:text-zinc-600' : ''}>{i + 1}</span>
                        </span>
                        <Initials name={u.name} size={28} />
                        <span className="text-[13px] text-zinc-800 dark:text-zinc-200 font-medium w-[140px] truncate shrink-0">{u.name}</span>
                        <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-[width] duration-500 ease-out" style={{ width: `${(u.messagesCount / maxCount) * 100}%` }} />
                        </div>
                        <span className="text-[13px] font-bold text-zinc-900 dark:text-white shrink-0 min-w-[36px] text-right">{u.messagesCount}</span>
                      </div>
                    );
                  })}
                {users.every(u => u.messagesCount === 0) && (
                  <div className="py-6 text-center text-zinc-400 dark:text-zinc-500 text-[13px]">No messages tracked yet — activity will appear once users start messaging.</div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-zinc-400 dark:text-zinc-500 text-[13px]">No data yet.</div>
            )
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredMsgStats.slice(0, 10).map((u, i) => (
                <div key={u.userId} className="flex items-center gap-3">
                  <span
                    className="w-5 text-right text-xs font-bold"
                    style={{ color: i < 3 ? ['#f59e0b','#9ca3af','#b45309'][i] : undefined }}
                  >
                    <span className={i >= 3 ? 'text-zinc-400 dark:text-zinc-600' : ''}>{i + 1}</span>
                  </span>
                  <Initials name={u.name} size={28} />
                  <span className="text-[13px] text-zinc-800 dark:text-zinc-200 font-medium w-[140px] truncate shrink-0">{u.name}</span>
                  <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-[width] duration-500 ease-out" style={{ width: `${(u.totalSent7d / maxMsg) * 100}%` }} />
                  </div>
                  <div className="shrink-0 text-right min-w-[70px]">
                    <span className="text-[13px] font-bold text-zinc-900 dark:text-white">{u.totalSent7d}</span>
                    {u.todaySent > 0 && (
                      <span className="text-[11px] text-green-500 ml-1.5">+{u.todaySent} today</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel 4: Event Feed ── */}
      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap />
            <span className="font-bold text-zinc-900 dark:text-white text-sm">Event Feed</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Auto-refreshes · last {relativeTime(lastRefresh)}
            </span>
            <button
              type="button"
              onClick={loadAll}
              className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2.5 py-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 cursor-pointer flex items-center gap-[5px] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <RefreshCw />
              Refresh
            </button>
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {feed.length === 0 ? (
            <div className="p-10 text-center text-zinc-400 dark:text-zinc-500 text-[13px]">
              No events logged yet — actions taken in the app will appear here.
            </div>
          ) : (
            feed.map(ev => (
              <div key={ev.id} className="flex items-start gap-3 px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800/50">
                <div
                  className="w-[30px] h-[30px] rounded-lg shrink-0 flex items-center justify-center"
                  style={{ background: `${eventColor(ev.action)}14` }}
                >
                  <i className={`fa-solid ${eventIcon(ev.action)} text-xs`} style={{ color: eventColor(ev.action) }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-zinc-800 dark:text-zinc-200 leading-[1.4]">
                    <span className="font-semibold">{ev.actorName}</span>
                    {' '}
                    <span className="text-zinc-500">{ev.action.replace(/_/g, ' ')}</span>
                  </div>
                  {ev.details && (
                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{ev.details}</div>
                  )}
                </div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-600 shrink-0 pt-0.5">{relativeTime(ev.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default ActivityMonitor;
