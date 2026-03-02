// ============================================
// ACTIVITY MONITOR — Admin live activity panel
// Four panels: Presence, Signups, Leaderboard, Event Feed
// ============================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../services/supabase';

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
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#27272a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, color: '#a1a1aa', fontWeight: 700, flexShrink: 0,
      letterSpacing: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// ==================== STAT CARD ====================

function StatCard({ label, value, icon, color, pulse }: {
  label: string; value: number | string; icon: string; color: string; pulse?: boolean;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {pulse
          ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: `0 0 8px ${color}` }} />
          : <i className={`fa-solid ${icon}`} style={{ color, fontSize: 13 }} />
        }
        <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

// ==================== PANEL HEADER ====================

function PanelHeader({ icon, iconColor, title, right }: {
  icon: string; iconColor: string; title: string; right?: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className={`fa-solid ${icon}`} style={{ color: iconColor, fontSize: 13 }} />
        <span style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{title}</span>
      </div>
      {right && <div style={{ fontSize: 11, color: '#52525b' }}>{right}</div>}
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
    loadAll();
    timerRef.current = setInterval(loadAll, 30_000);

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
  const total7d      = msgStats.reduce((s, u) => s + u.totalSent7d, 0);
  const maxMsg       = Math.max(...msgStats.map(u => u.totalSent7d), 1);

  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#52525b' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 22, marginRight: 12 }} />
        Loading activity data…
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 0 40px' }}>

      {/* ── Header KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Users"     value={users.length}  icon="fa-users"       color="#6366f1" />
        <StatCard label="Online Now"      value={onlineCount}   icon="fa-circle"      color="#22c55e" pulse />
        <StatCard label="Away / Busy"     value={awayCount}     icon="fa-moon"        color="#f59e0b" />
        <StatCard label="New This Week"   value={newThisWeek}   icon="fa-user-plus"   color="#06b6d4" />
        <StatCard label="Messages (7d)"   value={total7d}       icon="fa-comment-dots" color="#a855f7" />
      </div>

      {/* ── Panels row 1: Presence + Signups ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Panel 1 — Live Presence */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <PanelHeader
            icon="fa-circle"
            iconColor="#22c55e"
            title="Live Presence"
            right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} /> Realtime</span>}
          />
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {users.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                {/* Avatar + dot */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {u.avatarUrl
                    ? <img src={u.avatarUrl} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                    : <Initials name={u.name} size={32} />
                  }
                  <span style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 10, height: 10, borderRadius: '50%',
                    background: statusDot(u.onlineStatus),
                    border: '2px solid #09090b',
                  }} />
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: '#52525b' }}>
                    {u.onlineStatus === 'online'
                      ? 'Online now'
                      : u.lastActiveAt ? relativeTime(u.lastActiveAt) : 'Never seen'
                    }
                  </div>
                </div>
                {/* Badge */}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  background: `${statusDot(u.onlineStatus)}18`,
                  color: statusDot(u.onlineStatus),
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {statusLabel(u.onlineStatus)}
                </span>
              </div>
            ))}
            {users.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#52525b', fontSize: 13 }}>No users yet</div>
            )}
          </div>
        </div>

        {/* Panel 2 — Recent Signups */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <PanelHeader
            icon="fa-user-plus"
            iconColor="#06b6d4"
            title="Recent Signups"
            right={`${newToday} today · ${newThisWeek} this week`}
          />
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {[...users]
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .slice(0, 20)
              .map(u => {
                const isNew = u.createdAt.getTime() > dayAgo;
                return (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <Initials name={u.name} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                        {isNew && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#06b6d420', color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>New</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#a1a1aa' }}>{relativeTime(u.createdAt)}</div>
                      <div style={{ fontSize: 11, color: '#52525b' }}>{u.messagesCount} msgs</div>
                    </div>
                  </div>
                );
              })}
            {users.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#52525b', fontSize: 13 }}>No users yet</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Panel 3: Message Leaderboard ── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
        <PanelHeader
          icon="fa-ranking-star"
          iconColor="#a855f7"
          title="Message Activity — Last 7 Days"
          right={`${total7d.toLocaleString()} total sent`}
        />
        <div style={{ padding: '16px 20px' }}>
          {msgStats.length === 0 ? (
            // Fall back: show messages_count from user_profiles
            users.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...users]
                  .filter(u => u.messagesCount > 0)
                  .sort((a, b) => b.messagesCount - a.messagesCount)
                  .slice(0, 10)
                  .map((u, i) => {
                    const maxCount = Math.max(...users.map(x => x.messagesCount), 1);
                    return (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ width: 20, textAlign: 'right', fontSize: 12, fontWeight: 700, color: i < 3 ? ['#f59e0b','#9ca3af','#b45309'][i] : '#3f3f46' }}>{i + 1}</span>
                        <Initials name={u.name} size={28} />
                        <span style={{ fontSize: 13, color: '#e4e4e7', fontWeight: 500, width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{u.name}</span>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(to right, #6366f1, #a855f7)', width: `${(u.messagesCount / maxCount) * 100}%`, transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f4f4f5', flexShrink: 0, minWidth: 36, textAlign: 'right' }}>{u.messagesCount}</span>
                      </div>
                    );
                  })}
                {users.every(u => u.messagesCount === 0) && (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#52525b', fontSize: 13 }}>No messages tracked yet — activity will appear once users start messaging.</div>
                )}
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#52525b', fontSize: 13 }}>No data yet.</div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {msgStats.slice(0, 10).map((u, i) => (
                <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 20, textAlign: 'right', fontSize: 12, fontWeight: 700, color: i < 3 ? ['#f59e0b','#9ca3af','#b45309'][i] : '#3f3f46' }}>{i + 1}</span>
                  <Initials name={u.name} size={28} />
                  <span style={{ fontSize: 13, color: '#e4e4e7', fontWeight: 500, width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{u.name}</span>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(to right, #6366f1, #a855f7)', width: `${(u.totalSent7d / maxMsg) * 100}%`, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 70 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#f4f4f5' }}>{u.totalSent7d}</span>
                    {u.todaySent > 0 && (
                      <span style={{ fontSize: 11, color: '#22c55e', marginLeft: 6 }}>+{u.todaySent} today</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel 4: Event Feed ── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-bolt" style={{ color: '#f59e0b', fontSize: 13 }} />
            <span style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>Event Feed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#52525b' }}>
              Auto-refreshes · last {relativeTime(lastRefresh)}
            </span>
            <button
              type="button"
              onClick={loadAll}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#a1a1aa', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <i className="fa-solid fa-rotate" />
              Refresh
            </button>
          </div>
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {feed.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#52525b', fontSize: 13 }}>
              No events logged yet — actions taken in the app will appear here.
            </div>
          ) : (
            feed.map(ev => (
              <div key={ev.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: `${eventColor(ev.action)}14`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className={`fa-solid ${eventIcon(ev.action)}`} style={{ fontSize: 12, color: eventColor(ev.action) }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600 }}>{ev.actorName}</span>
                    {' '}
                    <span style={{ color: '#71717a' }}>{ev.action.replace(/_/g, ' ')}</span>
                  </div>
                  {ev.details && (
                    <div style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>{ev.details}</div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: '#3f3f46', flexShrink: 0, paddingTop: 2 }}>{relativeTime(ev.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default ActivityMonitor;
