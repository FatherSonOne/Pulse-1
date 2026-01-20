// ============================================
// MONITORING ALERTS SYSTEM
// Alert configuration and notification handlers
// ============================================

import { captureMessage, captureError } from './sentry';
import { trackEvent } from './analytics';

export interface Alert {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  duration: number; // milliseconds
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  actions: AlertAction[];
}

export type AlertAction = 'slack' | 'email' | 'sentry' | 'webhook' | 'auto_rollback';

// Alert rules configuration
const alertRules: AlertRule[] = [
  // Error rate alerts
  {
    id: 'error_rate_critical',
    name: 'Critical Error Rate',
    metric: 'error_rate',
    condition: 'greater_than',
    threshold: 5, // 5%
    duration: 5 * 60 * 1000, // 5 minutes
    severity: 'critical',
    enabled: true,
    actions: ['slack', 'sentry', 'auto_rollback']
  },
  {
    id: 'error_rate_warning',
    name: 'Elevated Error Rate',
    metric: 'error_rate',
    condition: 'greater_than',
    threshold: 1, // 1%
    duration: 5 * 60 * 1000,
    severity: 'warning',
    enabled: true,
    actions: ['slack', 'sentry']
  },

  // Performance alerts
  {
    id: 'response_time_critical',
    name: 'Critical Response Time',
    metric: 'response_time_p95',
    condition: 'greater_than',
    threshold: 1000, // 1000ms
    duration: 5 * 60 * 1000,
    severity: 'critical',
    enabled: true,
    actions: ['slack', 'sentry']
  },
  {
    id: 'response_time_warning',
    name: 'Elevated Response Time',
    metric: 'response_time_p95',
    condition: 'greater_than',
    threshold: 500, // 500ms
    duration: 10 * 60 * 1000,
    severity: 'warning',
    enabled: true,
    actions: ['slack']
  },

  // User engagement alerts
  {
    id: 'active_users_drop',
    name: 'Active Users Drop',
    metric: 'active_users_change',
    condition: 'less_than',
    threshold: -10, // 10% drop
    duration: 5 * 60 * 1000,
    severity: 'warning',
    enabled: true,
    actions: ['slack', 'email']
  },

  // Database alerts
  {
    id: 'database_connection_failure',
    name: 'Database Connection Failure',
    metric: 'database_connection_errors',
    condition: 'greater_than',
    threshold: 3,
    duration: 1 * 60 * 1000,
    severity: 'critical',
    enabled: true,
    actions: ['slack', 'sentry', 'email']
  },

  // Resource alerts
  {
    id: 'memory_usage_high',
    name: 'High Memory Usage',
    metric: 'memory_usage_percent',
    condition: 'greater_than',
    threshold: 90,
    duration: 5 * 60 * 1000,
    severity: 'warning',
    enabled: true,
    actions: ['slack']
  },

  // Security alerts
  {
    id: 'authentication_failures',
    name: 'High Authentication Failures',
    metric: 'auth_failures_per_minute',
    condition: 'greater_than',
    threshold: 10,
    duration: 5 * 60 * 1000,
    severity: 'error',
    enabled: true,
    actions: ['slack', 'sentry', 'email']
  },

  // Core Web Vitals
  {
    id: 'lcp_poor',
    name: 'Poor Largest Contentful Paint',
    metric: 'lcp',
    condition: 'greater_than',
    threshold: 2500, // 2.5s
    duration: 10 * 60 * 1000,
    severity: 'warning',
    enabled: true,
    actions: ['slack']
  },
  {
    id: 'cls_poor',
    name: 'Poor Cumulative Layout Shift',
    metric: 'cls',
    condition: 'greater_than',
    threshold: 0.25,
    duration: 10 * 60 * 1000,
    severity: 'warning',
    enabled: true,
    actions: ['slack']
  }
];

// Alert state tracking
const alertState = new Map<string, {
  triggered: boolean;
  firstTriggered: Date | null;
  lastNotified: Date | null;
  count: number;
}>();

// Initialize alert state
alertRules.forEach(rule => {
  alertState.set(rule.id, {
    triggered: false,
    firstTriggered: null,
    lastNotified: null,
    count: 0
  });
});

// Check if metric violates alert rule
export function checkAlertRule(
  rule: AlertRule,
  currentValue: number
): boolean {
  switch (rule.condition) {
    case 'greater_than':
      return currentValue > rule.threshold;
    case 'less_than':
      return currentValue < rule.threshold;
    case 'equals':
      return currentValue === rule.threshold;
    default:
      return false;
  }
}

// Evaluate alert and trigger if needed
export function evaluateAlert(
  ruleId: string,
  currentValue: number
): void {
  const rule = alertRules.find(r => r.id === ruleId);
  if (!rule || !rule.enabled) {
    return;
  }

  const state = alertState.get(ruleId);
  if (!state) {
    return;
  }

  const isViolating = checkAlertRule(rule, currentValue);
  const now = new Date();

  if (isViolating) {
    if (!state.triggered) {
      // First time violating
      state.triggered = true;
      state.firstTriggered = now;
      state.count = 1;
    } else {
      state.count++;

      // Check if duration threshold is met
      const timeSinceFirst = now.getTime() - (state.firstTriggered?.getTime() || 0);
      if (timeSinceFirst >= rule.duration) {
        // Duration threshold met, trigger alert
        const alert: Alert = {
          id: `${ruleId}_${now.getTime()}`,
          name: rule.name,
          severity: rule.severity,
          threshold: rule.threshold,
          currentValue,
          message: generateAlertMessage(rule, currentValue),
          timestamp: now,
          metadata: {
            ruleId,
            violationCount: state.count,
            durationMs: timeSinceFirst
          }
        };

        triggerAlert(alert, rule.actions);

        // Reset state after triggering
        state.lastNotified = now;
      }
    }
  } else {
    // Metric is back to normal
    if (state.triggered) {
      // Send recovery notification
      sendRecoveryNotification(rule, currentValue);

      // Reset state
      state.triggered = false;
      state.firstTriggered = null;
      state.count = 0;
    }
  }
}

// Generate alert message
function generateAlertMessage(rule: AlertRule, currentValue: number): string {
  const threshold = rule.threshold;
  const condition = rule.condition.replace('_', ' ');

  return `${rule.name}: ${rule.metric} is ${condition} ${threshold} (current: ${currentValue})`;
}

// Trigger alert actions
function triggerAlert(alert: Alert, actions: AlertAction[]): void {
  console.error('🚨 ALERT TRIGGERED:', alert);

  actions.forEach(action => {
    switch (action) {
      case 'slack':
        sendSlackAlert(alert);
        break;
      case 'email':
        sendEmailAlert(alert);
        break;
      case 'sentry':
        sendSentryAlert(alert);
        break;
      case 'webhook':
        sendWebhookAlert(alert);
        break;
      case 'auto_rollback':
        triggerAutoRollback(alert);
        break;
    }
  });

  // Track alert in analytics
  trackEvent('Alert Triggered', {
    alert_id: alert.id,
    alert_name: alert.name,
    severity: alert.severity,
    metric: alert.metadata?.ruleId,
    current_value: alert.currentValue,
    threshold: alert.threshold
  });
}

// Send Slack alert
async function sendSlackAlert(alert: Alert): Promise<void> {
  const webhookUrl = import.meta.env.VITE_SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('Slack webhook URL not configured');
    return;
  }

  const severityEmoji = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨'
  };

  const severityColor = {
    info: '#36a64f',
    warning: '#ff9800',
    error: '#f44336',
    critical: '#d32f2f'
  };

  const payload = {
    text: `${severityEmoji[alert.severity]} ${alert.severity.toUpperCase()}: ${alert.name}`,
    attachments: [
      {
        color: severityColor[alert.severity],
        fields: [
          {
            title: 'Message',
            value: alert.message,
            short: false
          },
          {
            title: 'Current Value',
            value: alert.currentValue.toString(),
            short: true
          },
          {
            title: 'Threshold',
            value: alert.threshold.toString(),
            short: true
          },
          {
            title: 'Time',
            value: alert.timestamp.toISOString(),
            short: true
          }
        ],
        footer: 'Pulse Messages Monitoring',
        ts: Math.floor(alert.timestamp.getTime() / 1000)
      }
    ]
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Failed to send Slack alert:', error);
  }
}

// Send email alert
async function sendEmailAlert(alert: Alert): Promise<void> {
  // TODO: Implement email alert via Resend or similar service
  console.log('Email alert:', alert);
}

// Send Sentry alert
function sendSentryAlert(alert: Alert): void {
  const severity = alert.severity === 'critical' ? 'error' : 'warning';

  captureMessage(alert.message, severity, {
    alert_id: alert.id,
    alert_name: alert.name,
    current_value: alert.currentValue,
    threshold: alert.threshold,
    ...alert.metadata
  });
}

// Send webhook alert
async function sendWebhookAlert(alert: Alert): Promise<void> {
  const webhookUrl = import.meta.env.VITE_ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert)
    });
  } catch (error) {
    console.error('Failed to send webhook alert:', error);
  }
}

// Trigger automatic rollback
async function triggerAutoRollback(alert: Alert): Promise<void> {
  console.error('🔄 AUTO ROLLBACK TRIGGERED:', alert);

  // TODO: Implement automatic rollback logic
  // This would typically:
  // 1. Notify on-call engineer
  // 2. Trigger Vercel rollback
  // 3. Disable problematic feature flags
  // 4. Create incident ticket

  // For now, just send critical alert
  await sendSlackAlert({
    ...alert,
    message: `AUTO ROLLBACK TRIGGERED: ${alert.message}`,
    severity: 'critical'
  });
}

// Send recovery notification
async function sendRecoveryNotification(rule: AlertRule, currentValue: number): Promise<void> {
  const webhookUrl = import.meta.env.VITE_SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  const payload = {
    text: `✅ RECOVERED: ${rule.name}`,
    attachments: [
      {
        color: '#36a64f',
        fields: [
          {
            title: 'Status',
            value: 'Metric has returned to normal levels',
            short: false
          },
          {
            title: 'Current Value',
            value: currentValue.toString(),
            short: true
          },
          {
            title: 'Threshold',
            value: rule.threshold.toString(),
            short: true
          }
        ],
        footer: 'Pulse Messages Monitoring'
      }
    ]
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Failed to send recovery notification:', error);
  }
}

// Get all alert rules
export function getAlertRules(): AlertRule[] {
  return alertRules;
}

// Update alert rule
export function updateAlertRule(
  ruleId: string,
  updates: Partial<AlertRule>
): void {
  const ruleIndex = alertRules.findIndex(r => r.id === ruleId);
  if (ruleIndex !== -1) {
    alertRules[ruleIndex] = {
      ...alertRules[ruleIndex],
      ...updates
    };
  }
}

// Enable/disable alert rule
export function toggleAlertRule(ruleId: string, enabled: boolean): void {
  updateAlertRule(ruleId, { enabled });
}

// Export for monitoring dashboard
export { alertRules, alertState };
