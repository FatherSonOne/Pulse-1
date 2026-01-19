// ============================================
// INTEGRATION MANAGER COMPONENT
// Manage connections to external platforms
// ============================================

import React, { useState, useEffect } from 'react';
import { logosVisionService } from '../../services/logosVisionService';
import { entomateService } from '../../services/entomateService';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'pending' | 'error';
  lastSync?: Date;
  config?: Record<string, string>;
}

/**
 * IntegrationManager Component
 * Connect and manage external platform integrations
 */
const IntegrationManager: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'logos_vision',
      name: 'Logos Vision CRM',
      description: 'Sync contacts, projects, and activities',
      icon: '🎯',
      status: 'disconnected',
    },
    {
      id: 'entomate',
      name: 'Entomate',
      description: 'Automation events and workflows',
      icon: '🤖',
      status: 'disconnected',
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Messages and channel notifications',
      icon: '💬',
      status: 'disconnected',
    },
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Email inbox integration',
      icon: '📧',
      status: 'disconnected',
    },
    {
      id: 'twilio',
      name: 'Twilio SMS',
      description: 'SMS messaging integration',
      icon: '📱',
      status: 'disconnected',
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Repository and PR notifications',
      icon: '🐙',
      status: 'disconnected',
    },
  ]);

  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    // Check Logos Vision connection
    try {
      const logosConnected = await logosVisionService.healthCheck();
      updateIntegrationStatus('logos_vision', logosConnected ? 'connected' : 'disconnected');
    } catch {
      updateIntegrationStatus('logos_vision', 'error');
    }

    // Check Entomate connection
    try {
      const entomateConnected = await entomateService.healthCheck();
      updateIntegrationStatus('entomate', entomateConnected ? 'connected' : 'disconnected');
    } catch {
      updateIntegrationStatus('entomate', 'error');
    }

    // Check other integrations based on env vars
    if (import.meta.env.VITE_SLACK_BOT_TOKEN) {
      updateIntegrationStatus('slack', 'connected');
    }
    if (import.meta.env.VITE_GMAIL_ACCESS_TOKEN) {
      updateIntegrationStatus('gmail', 'connected');
    }
    if (import.meta.env.VITE_TWILIO_ACCOUNT_SID) {
      updateIntegrationStatus('twilio', 'connected');
    }
  };

  const updateIntegrationStatus = (id: string, status: Integration['status']) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status, lastSync: status === 'connected' ? new Date() : i.lastSync }
          : i
      )
    );
  };

  const handleConnect = async (integration: Integration) => {
    updateIntegrationStatus(integration.id, 'pending');

    // Simulate connection process
    // In production, this would open OAuth flow or configuration modal
    setTimeout(() => {
      // For demo, just toggle status
      const newStatus = integration.status === 'connected' ? 'disconnected' : 'connected';
      updateIntegrationStatus(integration.id, newStatus);
    }, 1500);
  };

  const handleDisconnect = (integration: Integration) => {
    if (confirm(`Are you sure you want to disconnect ${integration.name}?`)) {
      updateIntegrationStatus(integration.id, 'disconnected');
    }
  };

  const handleTest = async (integration: Integration) => {
    setTesting(integration.id);

    try {
      let success = false;

      switch (integration.id) {
        case 'logos_vision':
          success = await logosVisionService.healthCheck();
          break;
        case 'entomate':
          success = await entomateService.healthCheck();
          break;
        default:
          // Simulate test for other integrations
          await new Promise((r) => setTimeout(r, 1000));
          success = integration.status === 'connected';
      }

      alert(success ? `${integration.name} connection successful!` : `${integration.name} connection failed.`);
    } catch (error) {
      alert(`Error testing ${integration.name}: ${error}`);
    } finally {
      setTesting(null);
    }
  };

  const getStatusText = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Not Connected';
      case 'pending':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="integration-manager">
      <div className="section-header">
        <h2>Platform Integrations</h2>
        <p style={{ color: '#a1a1aa', margin: '8px 0 0 0', fontSize: '14px' }}>
          Connect external platforms to sync messages and data
        </p>
      </div>

      <div className="integration-grid">
        {integrations.map((integration) => (
          <div key={integration.id} className="integration-card">
            <div className="integration-card-header">
              <span className="integration-icon">{integration.icon}</span>
              <div className="integration-info">
                <h3>{integration.name}</h3>
                <p>{integration.description}</p>
              </div>
            </div>

            <div className="integration-status">
              <span className={`status-dot ${integration.status}`} />
              <span>{getStatusText(integration.status)}</span>
              {integration.lastSync && integration.status === 'connected' && (
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
                  Last sync: {integration.lastSync.toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className="integration-actions">
              {integration.status === 'connected' ? (
                <>
                  <button
                    className="btn-test"
                    onClick={() => handleTest(integration)}
                    disabled={testing === integration.id}
                  >
                    {testing === integration.id ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    className="btn-disconnect"
                    onClick={() => handleDisconnect(integration)}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  className="btn-connect"
                  onClick={() => handleConnect(integration)}
                  disabled={integration.status === 'pending'}
                >
                  {integration.status === 'pending' ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="section-header" style={{ marginTop: '32px' }}>
        <h2>API Configuration</h2>
        <p style={{ color: '#a1a1aa', margin: '8px 0 0 0', fontSize: '14px' }}>
          Configure API keys and endpoints
        </p>
      </div>

      <div className="settings-section">
        <div className="setting-row">
          <div className="setting-label">
            <span>Supabase URL</span>
            <small>Your Pulse database endpoint</small>
          </div>
          <input
            type="text"
            className="settings-input"
            value={import.meta.env.VITE_SUPABASE_URL || ''}
            readOnly
            style={{ width: '300px' }}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Logos Vision API</span>
            <small>Local Logos Vision server</small>
          </div>
          <input
            type="text"
            className="settings-input"
            value={import.meta.env.VITE_LOGOS_API_URL || 'http://localhost:3001/api'}
            readOnly
            style={{ width: '300px' }}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Entomate API</span>
            <small>Automation platform endpoint</small>
          </div>
          <input
            type="text"
            className="settings-input"
            value={import.meta.env.VITE_ENTOMATE_API_URL || 'http://localhost:3002/api'}
            readOnly
            style={{ width: '300px' }}
          />
        </div>
      </div>
    </div>
  );
};

export default IntegrationManager;
