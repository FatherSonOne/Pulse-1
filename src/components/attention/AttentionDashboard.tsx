import { useState, useEffect } from 'react';
import { Moon, Sun, Play } from 'lucide-react';
import { attentionService, FocusSession } from '../../services/attentionService';
import { AttentionBudget, BatchedNotification } from '../../types';

interface AttentionDashboardProps {
  userId: string;
  onNotificationClick?: (notification: BatchedNotification) => void;
}

export const AttentionDashboard: React.FC<AttentionDashboardProps> = ({
  userId,
  onNotificationClick
}) => {
  const [budget, setBudget] = useState<AttentionBudget>({
    currentLoad: 0,
    maxLoad: 100,
    status: 'healthy',
    batchedCount: 0
  });
  const [batchedNotifications, setBatchedNotifications] = useState<BatchedNotification[]>([]);
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null);
  const [showBatchedPanel, setShowBatchedPanel] = useState(false);
  const [focusDuration, setFocusDuration] = useState(30);
  const [focusTopic, setFocusTopic] = useState('');
  const [showFocusSetup, setShowFocusSetup] = useState(false);
  const [analytics, setAnalytics] = useState<{
    averageDailyNotifications: number;
    totalFocusMinutes: number;
    completedSessions: number;
    averageInterruptions: number;
    dailyBreakdown: { date: string; notifications: number; focusMinutes: number }[];
  } | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (focusSession?.status === 'active') {
      const timer = setInterval(() => {
        const start = new Date(focusSession.started_at).getTime();
        setElapsedTime(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [focusSession]);

  const loadData = async () => {
    await attentionService.initialize(userId);
    const currentBudget = await attentionService.loadCurrentBudget(userId);
    setBudget(currentBudget);
    setBatchedNotifications(attentionService.getBatchedNotifications());
    setFocusSession(attentionService.getCurrentFocusSession());
    const analyticsData = await attentionService.getAnalytics(userId, 7);
    setAnalytics(analyticsData);
  };

  const handleStartFocus = async () => {
    const session = await attentionService.startFocusSession(userId, focusDuration, focusTopic || undefined);
    setFocusSession(session);
    setShowFocusSetup(false);
    setFocusTopic('');
    setElapsedTime(0);
  };

  const handleEndFocus = async () => {
    await attentionService.endFocusSession(userId);
    setFocusSession(null);
    setElapsedTime(0);
    loadData();
  };

  const handleClearBatched = async () => {
    await attentionService.clearBatchedNotifications(userId);
    setBatchedNotifications([]);
    setShowBatchedPanel(false);
    loadData();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Weekly Overview only renders when there's at least one non-zero datum.
  const hasWeeklyData = analytics ? (
    analytics.averageDailyNotifications > 0 ||
    analytics.totalFocusMinutes > 0 ||
    analytics.completedSessions > 0 ||
    analytics.averageInterruptions > 0 ||
    analytics.dailyBreakdown.some(d => d.notifications > 0)
  ) : false;

  return (
    <div className="flex flex-col gap-5">

      {/* Active Focus Session — bare strip, mono header, live timer */}
      {focusSession?.status === 'active' && (
        <section aria-labelledby="focus-active-heading">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-rose-500 pulse-heartbeat-slow shrink-0" />
            <span id="focus-active-heading" className="pulse-label text-rose-600 dark:text-rose-400 shrink-0">FOCUS · ACTIVE</span>
            {focusSession.topic && (
              <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate min-w-0 flex-1">
                {focusSession.topic}
              </span>
            )}
            <span className="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100 shrink-0">
              {formatTime(elapsedTime)}
              <span className="text-zinc-400 dark:text-zinc-500"> / {focusSession.planned_duration_minutes}:00</span>
            </span>
            <button
              onClick={handleEndFocus}
              className="pulse-label px-2.5 py-1 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-white/[0.05] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 shrink-0"
            >
              END
            </button>
          </div>
        </section>
      )}

      {/* Batched alerts — bare strip, only when present */}
      {budget.batchedCount > 0 && (
        <section aria-labelledby="attention-batched-heading">
          <div className="flex items-center justify-between mb-2">
            <h3 id="attention-batched-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
              BATCHED · {budget.batchedCount}
            </h3>
            <div className="flex items-center gap-3">
              {!showBatchedPanel && (
                <button
                  onClick={() => setShowBatchedPanel(true)}
                  className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
                >
                  EXPAND
                </button>
              )}
              <button
                onClick={handleClearBatched}
                className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
              >
                MARK ALL READ
              </button>
            </div>
          </div>
          {showBatchedPanel && batchedNotifications.length > 0 && (
            <ul className="space-y-px max-h-64 overflow-y-auto">
              {batchedNotifications.map(n => (
                <li key={n.id}>
                  <button
                    onClick={() => onNotificationClick?.(n)}
                    className="w-full text-left flex items-baseline gap-3 px-3 py-2 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                  >
                    <span className="pulse-label text-zinc-400 dark:text-zinc-500 shrink-0 min-w-[44px]">{n.source.toUpperCase()}</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate flex-1">{n.message}</span>
                    <span className="pulse-label text-zinc-500 dark:text-zinc-400 shrink-0">
                      {new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Focus Session — start row collapsed by default; expand to configure */}
      {!focusSession && (
        <section aria-labelledby="focus-start-heading">
          {!showFocusSetup ? (
            <div className="flex items-center justify-between gap-3">
              <h3 id="focus-start-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
                FOCUS SESSION
              </h3>
              <button
                onClick={() => setShowFocusSetup(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                <Play size={13} fill="currentColor" />
                Start deep work
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <h3 id="focus-start-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
                FOCUS SESSION · SETUP
              </h3>
              <input
                type="text"
                placeholder="What are you focusing on?"
                value={focusTopic}
                onChange={e => setFocusTopic(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/20 focus:outline-none transition-colors duration-150"
              />
              <div className="flex gap-1.5">
                {[15, 30, 45, 60, 90].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setFocusDuration(mins)}
                    className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                      focusDuration === mins
                        ? 'bg-rose-500 text-white'
                        : 'bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleStartFocus}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                >
                  <Play size={13} fill="currentColor" />
                  Start {focusDuration}-min focus
                </button>
                <button
                  onClick={() => setShowFocusSetup(false)}
                  className="pulse-label px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Weekly Overview — only when something happened this week */}
      {analytics && hasWeeklyData && (
        <section aria-labelledby="attention-week-heading">
          <h3 id="attention-week-heading" className="pulse-label text-zinc-500 dark:text-zinc-400 mb-3">
            WEEK · OVERVIEW
          </h3>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mb-4">
            {[
              { value: analytics.averageDailyNotifications, label: 'AVG NOTIFS/DAY' },
              { value: `${Math.round(analytics.totalFocusMinutes / 60)}H`, label: 'FOCUS' },
              { value: analytics.completedSessions, label: 'SESSIONS' },
              { value: analytics.averageInterruptions, label: 'AVG INTERRUPT' },
            ].map(s => (
              <div key={s.label}>
                <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-0.5">{s.label}</dt>
                <dd className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{s.value}</dd>
              </div>
            ))}
          </dl>
          {analytics.dailyBreakdown.some(d => d.notifications > 0) && (() => {
            const max = Math.max(...analytics.dailyBreakdown.map(d => d.notifications), 1);
            return (
              <div className="flex items-end gap-2 h-16">
                {analytics.dailyBreakdown.slice(-7).map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className="w-full bg-rose-500 rounded-sm min-h-[2px]"
                        style={{ height: `${(day.notifications / max) * 100}%` }}
                        title={`${day.date}: ${day.notifications} notifications`}
                      />
                    </div>
                    <span className="pulse-label text-zinc-400 dark:text-zinc-500">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {/* Focus Hours indicator — quiet single line, no card */}
      <section aria-labelledby="attention-hours-heading">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded">
          {attentionService.isWithinFocusHours() ? (
            <>
              <Moon size={13} className="text-violet-500 dark:text-violet-400 shrink-0" />
              <span id="attention-hours-heading" className="pulse-label text-violet-600 dark:text-violet-400 shrink-0">
                FOCUS HOURS
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Low-priority alerts are being batched.
              </span>
            </>
          ) : (
            <>
              <Sun size={13} className="text-amber-500 dark:text-amber-400 shrink-0" />
              <span id="attention-hours-heading" className="pulse-label text-amber-600 dark:text-amber-400 shrink-0">
                OPEN HOURS
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                All notifications deliver immediately.
              </span>
            </>
          )}
        </div>
      </section>

    </div>
  );
};
