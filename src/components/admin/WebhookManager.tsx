// ============================================
// WEBHOOK MANAGER COMPONENT
// Configure and monitor webhooks
// ============================================

import React, { useState, useEffect } from 'react';
import { webhookService, WebhookSource, WebhookLogEntry } from '../../services/webhookService';

interface WebhookConfig {
  source: WebhookSource;
  name: string;
  icon: string;
  endpoint: string;
  enabled: boolean;
  secret?: string;
  events: string[];
}

/**
 * WebhookManager Component
 * Configure webhook endpoints and view logs
 */
const WebhookManager: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([
    {
      source: 'slack',
      name: 'Slack',
      icon: '💬',
      endpoint: '/api/webhooks/slack',
      enabled: true,
      events: ['message', 'reaction_added', 'channel_created'],
    },
    {
      source: 'entomate',
      name: 'Entomate',
      icon: '🤖',
      endpoint: '/api/webhooks/entomate',
      enabled: true,
      events: ['automation.completed', 'automation.failed', 'automation.triggered'],
    },
    {
      source: 'gmail',
      name: 'Gmail',
      icon: '📧',
      endpoint: '/api/webhooks/gmail',
      enabled: false,
      events: ['message.received'],
    },
    {
      source: 'twilio',
      name: 'Twilio',
      icon: '📱',
      endpoint: '/api/webhooks/twilio',
      enabled: false,
      events: ['message.received', 'message.status'],
    },
    {
      source: 'github',
      name: 'GitHub',
      icon: '🐙',
      endpoint: '/api/webhooks/github',
      enabled: false,
      events: ['push', 'pull_request', 'issues'],
    },
    {
      source: 'custom',
      name: 'Custom',
      icon: '🔧',
      endpoint: '/api/webhooks/custom',
      enabled: false,
      events: ['*'],
    },
  ]);

  const [logs, setLogs] = useState<WebhookLogEntry[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [stats, setStats] = useState<{
    totalReceived: number;
    totalProcessed: number;
    totalFailed: number;
  }>({ totalReceived: 0, totalProcessed: 0, totalFailed: 0 });

  useEffect(() => {
    loadLogs();
    loadStats();
    const interval = setInterval(() => {
      loadLogs();
      loadStats();
    }, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadLogs = () => {
    const recentLogs = webhookService.getLogs({ limit: 50 });
    setLogs(recentLogs);
  };

  const loadStats = () => {
    const webhookStats = webhookService.getStats();
    setStats({
      totalReceived: webhookStats.totalReceived,
      totalProcessed: webhookStats.totalProcessed,
      totalFailed: webhookStats.totalFailed,
    });
  };

  const toggleWebhook = (source: WebhookSource) => {
    setWebhooks((prev) =>
      prev.map((w) =>
        w.source === source ? { ...w, enabled: !w.enabled } : w
      )
    );
    webhookService.setEnabled(source, !webhooks.find((w) => w.source === source)?.enabled);
  };

  const generateSecret = (source: WebhookSource) => {
    const secret = webhookService.generateSecret();
    setWebhooks((prev) =>
      prev.map((w) =>
        w.source === source ? { ...w, secret } : w
      )
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const testWebhook = async (webhook: WebhookConfig) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}${webhook.endpoint}`;

    try {
      const success = await webhookService.testWebhook(url, webhook.source, webhook.events[0]);
      alert(success ? 'Webhook test successful!' : 'Webhook test failed');
    } catch (error) {
      alert(`Webhook test error: ${error}`);
    }
  };

  const getBaseUrl = () => {
    return window.location.origin;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="webhook-manager">
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="settings-section" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#60a5fa' }}>{stats.totalReceived}</div>
          <div style={{ fontSize: '12px', color: '#a1a1aa' }}>Received</div>
        </div>
        <div className="settings-section" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#22c55e' }}>{stats.totalProcessed}</div>
          <div style={{ fontSize: '12px', color: '#a1a1aa' }}>Processed</div>
        </div>
        <div className="settings-section" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#ef4444' }}>{stats.totalFailed}</div>
          <div style={{ fontSize: '12px', color: '#a1a1aa' }}>Failed</div>
        </div>
      </div>

      {/* Webhook Configurations */}
      <div className="section-header">
        <h2>Webhook Endpoints</h2>
        <p style={{ color: '#a1a1aa', margin: '8px 0 0 0', fontSize: '14px' }}>
          Configure incoming webhooks from external services
        </p>
      </div>

      <div className="webhook-list">
        {webhooks.map((webhook) => (
          <div key={webhook.source} className="webhook-item">
            <div className="webhook-info">
              <span className="webhook-icon">{webhook.icon}</span>
              <div className="webhook-details">
                <h4>{webhook.name}</h4>
                <p>{getBaseUrl()}{webhook.endpoint}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className={`status-dot ${webhook.enabled ? 'connected' : 'disconnected'}`} />
              <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
                {webhook.enabled ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="webhook-actions">
              <button
                className="btn-icon"
                onClick={() => copyToClipboard(`${getBaseUrl()}${webhook.endpoint}`)}
                title="Copy URL"
              >
                📋
              </button>
              <button
                className="btn-icon"
                onClick={() => generateSecret(webhook.source)}
                title="Generate Secret"
              >
                🔑
              </button>
              <button
                className="btn-icon"
                onClick={() => testWebhook(webhook)}
                title="Test Webhook"
              >
                🧪
              </button>
              <button
                className="btn-icon"
                onClick={() => setSelectedWebhook(webhook)}
                title="Configure"
              >
                ⚙️
              </button>
              <div
                className={`toggle-switch ${webhook.enabled ? 'active' : ''}`}
                onClick={() => toggleWebhook(webhook.source)}
                style={{ marginLeft: '8px' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Webhook Details Modal */}
      {selectedWebhook && (
        <div className="settings-section" style={{ marginTop: '24px' }}>
          <h3>
            {selectedWebhook.icon} {selectedWebhook.name} Configuration
            <button
              onClick={() => setSelectedWebhook(null)}
              style={{
                float: 'right',
                background: 'none',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                fontSize: '18px',
              }}
            >
              ✕
            </button>
          </h3>

          <div className="setting-row">
            <div className="setting-label">
              <span>Endpoint URL</span>
              <small>Full webhook URL</small>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="settings-input"
                value={`${getBaseUrl()}${selectedWebhook.endpoint}`}
                readOnly
                style={{ width: '300px' }}
              />
              <button
                className="btn-secondary"
                onClick={() => copyToClipboard(`${getBaseUrl()}${selectedWebhook.endpoint}`)}
              >
                Copy
              </button>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">
              <span>Webhook Secret</span>
              <small>Use for signature verification</small>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type={showSecret ? 'text' : 'password'}
                className="settings-input"
                value={selectedWebhook.secret || 'Not configured'}
                readOnly
                style={{ width: '300px' }}
              />
              <button
                className="btn-secondary"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? 'Hide' : 'Show'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => generateSecret(selectedWebhook.source)}
              >
                Generate
              </button>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">
              <span>Subscribed Events</span>
              <small>Events this webhook listens for</small>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedWebhook.events.map((event) => (
                <span
                  key={event}
                  style={{
                    background: 'rgba(96, 165, 250, 0.2)',
                    color: '#60a5fa',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                >
                  {event}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Logs */}
      <div className="section-header" style={{ marginTop: '32px' }}>
        <h2>Recent Activity</h2>
        <button className="btn-secondary" onClick={loadLogs} style={{ marginLeft: 'auto' }}>
          Refresh
        </button>
      </div>

      <div className="webhook-logs">
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280' }}>
            No webhook activity yet
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="log-entry">
              <span className="log-time">{formatTime(log.timestamp)}</span>
              <span className="log-source">{log.source}</span>
              <span className={`log-status ${log.status}`}>{log.status}</span>
              <span style={{ color: '#e4e4e7' }}>{log.eventType}</span>
              {log.processingTime && (
                <span style={{ marginLeft: 'auto', color: '#6b7280' }}>
                  {log.processingTime}ms
                </span>
              )}
              {log.error && (
                <span style={{ color: '#ef4444', marginLeft: '8px' }}>
                  {log.error}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Instructions */}
      <div className="settings-section" style={{ marginTop: '24px' }}>
        <h3>📖 Setup Instructions</h3>
        <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <p><strong>1. Copy the webhook URL</strong> for the service you want to integrate.</p>
          <p><strong>2. Generate a secret</strong> for signature verification (recommended).</p>
          <p><strong>3. Configure the webhook</strong> in your external service's settings.</p>
          <p><strong>4. Test the connection</strong> using the test button.</p>
          <p><strong>5. Enable the webhook</strong> when ready to receive events.</p>
        </div>
      </div>
    </div>
  );
};

export default WebhookManager;
