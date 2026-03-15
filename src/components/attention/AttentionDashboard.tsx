import { useState, useEffect } from 'react';
import {
  Bell, BellOff, Focus, Clock, Zap,
  Moon, Sun, Play, Pause,
  BarChart2, Target, AlertTriangle, Check
} from 'lucide-react';
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
  const [healthScore, setHealthScore] = useState(100);
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
    setHealthScore(attentionService.calculateHealthScore());
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

  const statusColor = {
    healthy: 'text-emerald-500 dark:text-emerald-400',
    strained: 'text-amber-500 dark:text-amber-400',
    overloaded: 'text-red-500 dark:text-red-400',
  }[budget.status];

  const statusBarColor = {
    healthy: 'bg-emerald-500',
    strained: 'bg-amber-500',
    overloaded: 'bg-red-500',
  }[budget.status];

  const statusBorder = {
    healthy: 'border-emerald-400',
    strained: 'border-amber-400',
    overloaded: 'border-red-400',
  }[budget.status];

  const StatusIcon = {
    healthy: Check,
    strained: AlertTriangle,
    overloaded: Zap,
  }[budget.status];

  return (
    <div className="flex flex-col gap-4">

      {/* Active Focus Banner */}
      {focusSession?.status === 'active' && (
        <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl animate-pulse-border">
          <div className="flex items-center gap-3">
            <Focus size={18} className="text-rose-500 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Focus Mode Active</p>
              {focusSession.topic && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{focusSession.topic}</p>
              )}
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-zinc-900 dark:text-white font-mono">{formatTime(elapsedTime)}</span>
            <span className="text-sm text-zinc-400">/ {focusSession.planned_duration_minutes}:00</span>
          </div>
          <button
            onClick={handleEndFocus}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition"
          >
            <Pause size={14} /> End Session
          </button>
        </div>
      )}

      {/* Notification Budget */}
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700/60">
        <div className="flex justify-between items-center mb-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <Bell size={15} className="text-rose-500" />
            Notification Budget
          </h3>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1 text-xs font-bold uppercase ${statusColor}`}>
              <StatusIcon size={13} />
              {budget.status}
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${statusBorder} bg-white dark:bg-zinc-900`}>
              <span className="text-sm font-bold text-zinc-900 dark:text-white leading-none">{healthScore}</span>
              <span className="text-[9px] text-zinc-400 uppercase tracking-wider">score</span>
            </div>
          </div>
        </div>
        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${statusBarColor}`}
            style={{ width: `${budget.currentLoad}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
          <span>{budget.currentLoad}% used</span>
          <span>{100 - budget.currentLoad}% remaining</span>
        </div>
        {budget.batchedCount > 0 && (
          <button
            onClick={() => setShowBatchedPanel(!showBatchedPanel)}
            className="flex items-center gap-2 w-full p-3 mt-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-amber-700 dark:text-amber-400 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-950/40 transition"
          >
            <BellOff size={14} />
            {budget.batchedCount} batched notifications
          </button>
        )}
      </div>

      {/* Batched Notifications Panel */}
      {showBatchedPanel && batchedNotifications.length > 0 && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700/60">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Batched Notifications</h3>
            <button
              onClick={handleClearBatched}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition"
            >
              <Check size={12} /> Mark All Read
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {batchedNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => onNotificationClick?.(n)}
                className={`flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition border-l-2 ${n.priority === 'medium' ? 'border-amber-400' : 'border-zinc-300 dark:border-zinc-600'}`}
              >
                <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 rounded text-[10px] font-bold text-rose-600 dark:text-rose-400 shrink-0">{n.source}</span>
                <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 truncate">{n.message}</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">{new Date(n.time).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Focus Session */}
      {!focusSession && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700/60">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white mb-3">
            <Target size={15} className="text-rose-500" />
            Start Focus Session
          </h3>
          {showFocusSetup ? (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="What are you focusing on? (optional)"
                value={focusTopic}
                onChange={(e) => setFocusTopic(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-rose-500/60 focus:outline-none transition"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-500 dark:text-zinc-400">Duration</label>
                <div className="flex gap-2">
                  {[15, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setFocusDuration(mins)}
                      className={`flex-1 py-2 text-sm rounded-lg font-medium transition ${
                        focusDuration === mins
                          ? 'bg-rose-500 border border-rose-500 text-white'
                          : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-rose-500/60'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleStartFocus}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-semibold text-sm transition"
                >
                  <Play size={14} /> Start Focus
                </button>
                <button
                  onClick={() => setShowFocusSetup(false)}
                  className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowFocusSetup(true)}
              className="flex flex-col items-center justify-center w-full p-6 bg-rose-50 dark:bg-rose-950/20 border-2 border-dashed border-rose-200 dark:border-rose-800/50 rounded-xl text-zinc-900 dark:text-white cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-950/30 hover:border-rose-400 dark:hover:border-rose-700 transition"
            >
              <Play size={20} className="text-rose-500 mb-2" />
              <span className="font-semibold text-base">Start a Focus Session</span>
              <small className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Block notifications and track your deep work</small>
            </button>
          )}
        </div>
      )}

      {/* Analytics */}
      {analytics && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700/60">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white mb-4">
            <BarChart2 size={15} className="text-pink-500" />
            Weekly Overview
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { Icon: Bell, value: analytics.averageDailyNotifications, label: 'Avg Daily Notifications' },
              { Icon: Clock, value: `${Math.round(analytics.totalFocusMinutes / 60)}h`, label: 'Focus Time' },
              { Icon: Target, value: analytics.completedSessions, label: 'Sessions' },
              { Icon: AlertTriangle, value: analytics.averageInterruptions, label: 'Avg Interruptions' },
            ].map(({ Icon, value, label }) => (
              <div key={label} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div className="w-8 h-8 flex items-center justify-center bg-rose-50 dark:bg-rose-950/30 rounded-lg text-rose-500 dark:text-rose-400 shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-lg font-bold text-zinc-900 dark:text-white leading-none">{value}</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">{label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Mini Chart */}
          <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
            <div className="flex justify-between items-end h-20 gap-2">
              {analytics.dailyBreakdown.slice(-7).map((day, i) => {
                const max = Math.max(...analytics.dailyBreakdown.map((d) => d.notifications), 1);
                const height = (day.notifications / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full">
                    <div className="flex-1 flex items-end w-full">
                      <div
                        className="w-full bg-gradient-to-t from-rose-500 to-pink-400 rounded-sm min-h-[3px] transition-all duration-300"
                        style={{ height: `${height}%` }}
                        title={`${day.date}: ${day.notifications} notifications`}
                      />
                    </div>
                    <span className="mt-1.5 text-[9px] text-zinc-400 dark:text-zinc-500">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Focus Hours Indicator */}
      <div className={`rounded-xl px-4 py-3 border ${attentionService.isWithinFocusHours() ? 'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800/40' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40'}`}>
        <div className="flex items-center gap-3">
          {attentionService.isWithinFocusHours() ? (
            <>
              <Moon size={18} className="text-violet-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Focus Hours Active</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Low-priority notifications are being batched</p>
              </div>
            </>
          ) : (
            <>
              <Sun size={18} className="text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Open Hours</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">All notifications are delivered immediately</p>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
};
