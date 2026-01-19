import React, { useState, useMemo, useCallback, useEffect } from 'react';

// Types
type ConversationMode = 'available' | 'focus' | 'dnd' | 'away' | 'custom';

interface ModeConfig {
  id: ConversationMode;
  label: string;
  icon: string;
  color: string;
  description: string;
  autoReply?: string;
  allowNotifications: boolean;
  allowUrgent: boolean;
  showOnlineStatus: boolean;
  muteSounds: boolean;
}

interface ScheduledMode {
  id: string;
  mode: ConversationMode;
  startTime: string;
  endTime: string;
  days: string[];
  isEnabled: boolean;
}

interface CustomMode {
  id: string;
  name: string;
  icon: string;
  color: string;
  config: Omit<ModeConfig, 'id' | 'label' | 'icon' | 'color' | 'description'>;
}

interface ConversationModesProps {
  currentMode?: ConversationMode;
  onModeChange?: (mode: ConversationMode) => void;
  onScheduleCreate?: (schedule: Omit<ScheduledMode, 'id'>) => void;
}

// Default mode configurations
const defaultModes: ModeConfig[] = [
  {
    id: 'available',
    label: 'Available',
    icon: 'fa-circle',
    color: '#10B981',
    description: 'You are online and available for messages',
    allowNotifications: true,
    allowUrgent: true,
    showOnlineStatus: true,
    muteSounds: false
  },
  {
    id: 'focus',
    label: 'Focus Mode',
    icon: 'fa-bullseye',
    color: '#8B5CF6',
    description: 'Minimize distractions, only urgent messages',
    autoReply: "I'm in focus mode right now. I'll respond to non-urgent messages later.",
    allowNotifications: false,
    allowUrgent: true,
    showOnlineStatus: true,
    muteSounds: true
  },
  {
    id: 'dnd',
    label: 'Do Not Disturb',
    icon: 'fa-moon',
    color: '#EF4444',
    description: 'No notifications, appear offline',
    autoReply: "I'm currently unavailable. Please leave a message and I'll get back to you.",
    allowNotifications: false,
    allowUrgent: false,
    showOnlineStatus: false,
    muteSounds: true
  },
  {
    id: 'away',
    label: 'Away',
    icon: 'fa-clock',
    color: '#F59E0B',
    description: 'Show as away, receive notifications',
    autoReply: "I'm currently away from my desk. I'll respond when I return.",
    allowNotifications: true,
    allowUrgent: true,
    showOnlineStatus: true,
    muteSounds: false
  }
];

// Mock scheduled modes
const mockScheduledModes: ScheduledMode[] = [
  {
    id: 's1',
    mode: 'focus',
    startTime: '09:00',
    endTime: '12:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    isEnabled: true
  },
  {
    id: 's2',
    mode: 'dnd',
    startTime: '22:00',
    endTime: '08:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    isEnabled: true
  }
];

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#0a0a0f',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  currentStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 20px'
  },
  section: {
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '12px'
  },
  modeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px'
  },
  modeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '16px',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  modeCardActive: {
    borderColor: 'rgba(139, 92, 246, 0.5)',
    backgroundColor: 'rgba(139, 92, 246, 0.1)'
  },
  modeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px'
  },
  modeIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px'
  },
  modeName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9'
  },
  modeDescription: {
    fontSize: '11px',
    color: '#64748b',
    lineHeight: 1.4
  },
  modeFeatures: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
    flexWrap: 'wrap' as const
  },
  featureBadge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  scheduleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '10px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  scheduleInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  scheduleIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px'
  },
  scheduleTime: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#f1f5f9'
  },
  scheduleDays: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px'
  },
  toggle: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'background-color 0.2s ease'
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'white',
    position: 'absolute' as const,
    top: '2px',
    transition: 'left 0.2s ease',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
  },
  autoReplySection: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    padding: '14px',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  autoReplyLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  autoReplyText: {
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: 1.5,
    fontStyle: 'italic'
  },
  editButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    color: '#a78bfa',
    cursor: 'pointer',
    fontSize: '10px',
    marginLeft: 'auto'
  },
  addScheduleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px dashed rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s ease'
  },
  quickActions: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px'
  },
  quickButton: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease'
  },
  timer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: '10px',
    marginBottom: '16px'
  },
  timerText: {
    fontSize: '13px',
    color: '#a78bfa'
  },
  timerValue: {
    fontWeight: 700,
    marginLeft: 'auto'
  }
};

// Main Component
export const ConversationModes: React.FC<ConversationModesProps> = ({
  currentMode = 'available',
  onModeChange,
  onScheduleCreate
}) => {
  const [activeMode, setActiveMode] = useState<ConversationMode>(currentMode);
  const [scheduledModes, setScheduledModes] = useState<ScheduledMode[]>(mockScheduledModes);
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null);

  const activeModeConfig = useMemo(
    () => defaultModes.find(m => m.id === activeMode) || defaultModes[0],
    [activeMode]
  );

  const handleModeChange = useCallback((mode: ConversationMode) => {
    setActiveMode(mode);
    setTimerMinutes(null);
    onModeChange?.(mode);
  }, [onModeChange]);

  const handleTimedMode = useCallback((mode: ConversationMode, minutes: number) => {
    setActiveMode(mode);
    setTimerMinutes(minutes);
    onModeChange?.(mode);

    // Auto-reset after timer
    setTimeout(() => {
      setActiveMode('available');
      setTimerMinutes(null);
      onModeChange?.('available');
    }, minutes * 60 * 1000);
  }, [onModeChange]);

  const toggleSchedule = useCallback((scheduleId: string) => {
    setScheduledModes(prev => prev.map(s =>
      s.id === scheduleId ? { ...s, isEnabled: !s.isEnabled } : s
    ));
  }, []);

  // Timer countdown effect
  useEffect(() => {
    if (timerMinutes === null) return;

    const interval = setInterval(() => {
      setTimerMinutes(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [timerMinutes !== null]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <i className="fa-solid fa-sliders" />
          Status & Modes
        </div>
        <div style={{
          ...styles.currentStatus,
          backgroundColor: `${activeModeConfig.color}20`,
          color: activeModeConfig.color
        }}>
          <i className={`fa-solid ${activeModeConfig.icon}`} />
          {activeModeConfig.label}
        </div>
      </div>

      <div style={styles.content}>
        {/* Timer indicator */}
        {timerMinutes !== null && (
          <div style={styles.timer}>
            <i className="fa-solid fa-hourglass-half" style={{ color: '#a78bfa' }} />
            <span style={styles.timerText}>
              {activeModeConfig.label} ends in
            </span>
            <span style={{ ...styles.timerText, ...styles.timerValue }}>
              {timerMinutes} min
            </span>
          </div>
        )}

        {/* Quick timed actions */}
        <div style={styles.quickActions}>
          <button
            style={styles.quickButton}
            onClick={() => handleTimedMode('focus', 30)}
          >
            <i className="fa-solid fa-bullseye" style={{ color: '#8B5CF6' }} />
            Focus 30m
          </button>
          <button
            style={styles.quickButton}
            onClick={() => handleTimedMode('focus', 60)}
          >
            <i className="fa-solid fa-bullseye" style={{ color: '#8B5CF6' }} />
            Focus 1h
          </button>
          <button
            style={styles.quickButton}
            onClick={() => handleTimedMode('dnd', 60)}
          >
            <i className="fa-solid fa-moon" style={{ color: '#EF4444' }} />
            DND 1h
          </button>
        </div>

        {/* Status modes */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Set Status</div>
          <div style={styles.modeGrid}>
            {defaultModes.map(mode => (
              <div
                key={mode.id}
                style={{
                  ...styles.modeCard,
                  ...(activeMode === mode.id ? styles.modeCardActive : {})
                }}
                onClick={() => handleModeChange(mode.id)}
              >
                <div style={styles.modeHeader}>
                  <div style={{
                    ...styles.modeIcon,
                    backgroundColor: `${mode.color}20`,
                    color: mode.color
                  }}>
                    <i className={`fa-solid ${mode.icon}`} />
                  </div>
                  <span style={styles.modeName}>{mode.label}</span>
                </div>
                <div style={styles.modeDescription}>{mode.description}</div>
                <div style={styles.modeFeatures}>
                  {mode.allowNotifications && (
                    <span style={{
                      ...styles.featureBadge,
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399'
                    }}>
                      <i className="fa-solid fa-bell" />
                      Notifs
                    </span>
                  )}
                  {mode.allowUrgent && (
                    <span style={{
                      ...styles.featureBadge,
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24'
                    }}>
                      <i className="fa-solid fa-bolt" />
                      Urgent
                    </span>
                  )}
                  {mode.muteSounds && (
                    <span style={{
                      ...styles.featureBadge,
                      backgroundColor: 'rgba(100, 116, 139, 0.2)',
                      color: '#94a3b8'
                    }}>
                      <i className="fa-solid fa-volume-xmark" />
                      Muted
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-reply preview */}
        {activeModeConfig.autoReply && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Auto-Reply Message</div>
            <div style={styles.autoReplySection}>
              <div style={styles.autoReplyLabel}>
                <i className="fa-solid fa-robot" />
                Automatic response when messaged
                <button style={styles.editButton}>Edit</button>
              </div>
              <div style={styles.autoReplyText}>
                "{activeModeConfig.autoReply}"
              </div>
            </div>
          </div>
        )}

        {/* Scheduled modes */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Scheduled Modes</div>
          {scheduledModes.map(schedule => {
            const modeConfig = defaultModes.find(m => m.id === schedule.mode) || defaultModes[0];
            return (
              <div key={schedule.id} style={styles.scheduleCard}>
                <div style={styles.scheduleInfo}>
                  <div style={{
                    ...styles.scheduleIcon,
                    backgroundColor: `${modeConfig.color}20`,
                    color: modeConfig.color
                  }}>
                    <i className={`fa-solid ${modeConfig.icon}`} />
                  </div>
                  <div>
                    <div style={styles.scheduleTime}>
                      {schedule.startTime} - {schedule.endTime}
                    </div>
                    <div style={styles.scheduleDays}>
                      {schedule.days.join(', ')} • {modeConfig.label}
                    </div>
                  </div>
                </div>
                <button
                  style={{
                    ...styles.toggle,
                    backgroundColor: schedule.isEnabled ? '#8B5CF6' : 'rgba(255, 255, 255, 0.1)'
                  }}
                  onClick={() => toggleSchedule(schedule.id)}
                >
                  <div style={{
                    ...styles.toggleKnob,
                    left: schedule.isEnabled ? '22px' : '2px'
                  }} />
                </button>
              </div>
            );
          })}
          <button style={styles.addScheduleButton}>
            <i className="fa-solid fa-plus" />
            Add Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

// Status indicator dot for header/sidebar
export const StatusDot: React.FC<{
  mode: ConversationMode;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}> = ({ mode, size = 'small', showLabel = false }) => {
  const config = defaultModes.find(m => m.id === mode) || defaultModes[0];
  const sizes = { small: 8, medium: 12, large: 16 };
  const dotSize = sizes[size];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: dotSize,
        height: dotSize,
        borderRadius: '50%',
        backgroundColor: config.color,
        boxShadow: `0 0 ${dotSize/2}px ${config.color}`
      }} />
      {showLabel && (
        <span style={{ fontSize: '12px', color: config.color, fontWeight: 500 }}>
          {config.label}
        </span>
      )}
    </div>
  );
};

export default ConversationModes;
