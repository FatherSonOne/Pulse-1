import { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  Focus,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Moon,
  Sun,
  Play,
  Pause,
  X,
  ChevronRight,
  BarChart2,
  Target,
  AlertTriangle,
  Check
} from 'lucide-react';
import { attentionService, FocusSession } from '../../services/attentionService';
import { AttentionBudget, BatchedNotification } from '../../types';
import './AttentionDashboard.css';

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
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (focusSession?.status === 'active') {
      const timer = setInterval(() => {
        const start = new Date(focusSession.started_at).getTime();
        const now = Date.now();
        setElapsedTime(Math.floor((now - start) / 1000));
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
    const session = await attentionService.startFocusSession(
      userId,
      focusDuration,
      focusTopic || undefined
    );
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

  const getStatusColor = (status: AttentionBudget['status']) => {
    switch (status) {
      case 'healthy':
        return '#34d399';
      case 'strained':
        return '#fbbf24';
      case 'overloaded':
        return '#ef4444';
    }
  };

  const getStatusIcon = (status: AttentionBudget['status']) => {
    switch (status) {
      case 'healthy':
        return <Check size={16} />;
      case 'strained':
        return <AlertTriangle size={16} />;
      case 'overloaded':
        return <Zap size={16} />;
    }
  };

  return (
    <div className="attention-dashboard">
      <div className="attention-header">
        <h2>
          <Focus size={24} /> Attention Dashboard
        </h2>
        <div className="health-score" style={{ borderColor: getStatusColor(budget.status) }}>
          <span className="score-value">{healthScore}</span>
          <span className="score-label">Health</span>
        </div>
      </div>

      {/* Active Focus Session Banner */}
      {focusSession?.status === 'active' && (
        <div className="focus-active-banner">
          <div className="focus-info">
            <Focus className="pulse-icon" />
            <div>
              <h3>Focus Mode Active</h3>
              {focusSession.topic && <p>{focusSession.topic}</p>}
            </div>
          </div>
          <div className="focus-timer">
            <span className="time-elapsed">{formatTime(elapsedTime)}</span>
            <span className="time-planned">/ {focusSession.planned_duration_minutes}:00</span>
          </div>
          <button className="btn-end-focus" onClick={handleEndFocus}>
            <Pause size={16} /> End Session
          </button>
        </div>
      )}

      {/* Attention Budget Card */}
      <div className="budget-card">
        <div className="budget-header">
          <h3>
            <Bell size={18} /> Notification Budget
          </h3>
          <div className="budget-status" style={{ color: getStatusColor(budget.status) }}>
            {getStatusIcon(budget.status)}
            {budget.status}
          </div>
        </div>

        <div className="budget-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${budget.currentLoad}%`,
                backgroundColor: getStatusColor(budget.status)
              }}
            />
          </div>
          <div className="progress-labels">
            <span>{budget.currentLoad}% used</span>
            <span>{100 - budget.currentLoad}% remaining</span>
          </div>
        </div>

        {budget.batchedCount > 0 && (
          <button
            className="batched-notifications-btn"
            onClick={() => setShowBatchedPanel(!showBatchedPanel)}
          >
            <BellOff size={16} />
            {budget.batchedCount} batched notifications
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Batched Notifications Panel */}
      {showBatchedPanel && batchedNotifications.length > 0 && (
        <div className="batched-panel">
          <div className="batched-header">
            <h3>Batched Notifications</h3>
            <button className="btn-clear" onClick={handleClearBatched}>
              <Check size={16} /> Mark All Read
            </button>
          </div>
          <div className="batched-list">
            {batchedNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`batched-item priority-${notification.priority}`}
                onClick={() => onNotificationClick?.(notification)}
              >
                <div className="notification-source">{notification.source}</div>
                <div className="notification-message">{notification.message}</div>
                <div className="notification-time">
                  {new Date(notification.time).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Focus Mode Setup */}
      {!focusSession && (
        <div className="focus-setup-card">
          <div className="focus-setup-header">
            <h3>
              <Target size={18} /> Start Focus Session
            </h3>
          </div>

          {showFocusSetup ? (
            <div className="focus-form">
              <input
                type="text"
                placeholder="What are you focusing on? (optional)"
                value={focusTopic}
                onChange={(e) => setFocusTopic(e.target.value)}
              />
              <div className="duration-selector">
                <label>Duration:</label>
                <div className="duration-options">
                  {[15, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      className={focusDuration === mins ? 'active' : ''}
                      onClick={() => setFocusDuration(mins)}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
              <div className="focus-actions">
                <button className="btn-start" onClick={handleStartFocus}>
                  <Play size={16} /> Start Focus
                </button>
                <button className="btn-cancel" onClick={() => setShowFocusSetup(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-focus-cta" onClick={() => setShowFocusSetup(true)}>
              <Play size={20} />
              <span>Start a Focus Session</span>
              <small>Block notifications and track your deep work</small>
            </button>
          )}
        </div>
      )}

      {/* Analytics Overview */}
      {analytics && (
        <div className="analytics-card">
          <div className="analytics-header">
            <h3>
              <BarChart2 size={18} /> Weekly Overview
            </h3>
          </div>

          <div className="analytics-stats">
            <div className="stat">
              <div className="stat-icon">
                <Bell size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{analytics.averageDailyNotifications}</span>
                <span className="stat-label">Avg Daily Notifications</span>
              </div>
            </div>

            <div className="stat">
              <div className="stat-icon">
                <Clock size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{Math.round(analytics.totalFocusMinutes / 60)}h</span>
                <span className="stat-label">Focus Time</span>
              </div>
            </div>

            <div className="stat">
              <div className="stat-icon">
                <Target size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{analytics.completedSessions}</span>
                <span className="stat-label">Sessions</span>
              </div>
            </div>

            <div className="stat">
              <div className="stat-icon">
                <AlertTriangle size={20} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{analytics.averageInterruptions}</span>
                <span className="stat-label">Avg Interruptions</span>
              </div>
            </div>
          </div>

          {/* Mini Chart */}
          <div className="mini-chart">
            <div className="chart-bars">
              {analytics.dailyBreakdown.slice(-7).map((day, i) => {
                const maxNotifications = Math.max(
                  ...analytics.dailyBreakdown.map((d) => d.notifications)
                );
                const height = maxNotifications > 0
                  ? (day.notifications / maxNotifications) * 100
                  : 0;
                return (
                  <div key={i} className="chart-bar-container">
                    <div
                      className="chart-bar"
                      style={{ height: `${height}%` }}
                      title={`${day.date}: ${day.notifications} notifications`}
                    />
                    <span className="chart-label">
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
      <div className="focus-hours-card">
        <div className="focus-hours-indicator">
          {attentionService.isWithinFocusHours() ? (
            <>
              <Moon size={20} className="moon-icon" />
              <div>
                <h4>Focus Hours Active</h4>
                <p>Low-priority notifications are being batched</p>
              </div>
            </>
          ) : (
            <>
              <Sun size={20} className="sun-icon" />
              <div>
                <h4>Open Hours</h4>
                <p>All notifications are delivered immediately</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
