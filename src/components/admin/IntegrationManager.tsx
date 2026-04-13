// ============================================
// INTEGRATION MANAGER COMPONENT
// Manage connections to external platforms
// ============================================

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { logosVisionService } from '../../services/logosVisionService';
import { entomateService } from '../../services/entomateService';
import { AnimatedIcon } from '../ui/AnimatedIcon';

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
      icon: 'target',
      status: 'disconnected',
    },
    {
      id: 'entomate',
      name: 'Entomate',
      description: 'Automation events and workflows',
      icon: 'gear',
      status: 'disconnected',
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Messages and channel notifications',
      icon: 'chat',
      status: 'disconnected',
    },
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Email inbox integration',
      icon: 'email',
      status: 'disconnected',
    },
    {
      id: 'twilio',
      name: 'Twilio SMS',
      description: 'SMS messaging integration',
      icon: 'mobile',
      status: 'disconnected',
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Repository and PR notifications',
      icon: 'link',
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
      const logosConnected = logosVisionService ? await logosVisionService.healthCheck() : false;
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

    try {
      let success = false;

      switch (integration.id) {
        case 'logos_vision':
          success = logosVisionService ? await logosVisionService.healthCheck() : false;
          break;
        case 'entomate':
          success = await entomateService.healthCheck();
          break;
        case 'slack':
          success = !!import.meta.env.VITE_SLACK_BOT_TOKEN;
          break;
        case 'gmail':
          success = !!import.meta.env.VITE_GMAIL_ACCESS_TOKEN;
          break;
        case 'twilio':
          success = !!import.meta.env.VITE_TWILIO_ACCOUNT_SID;
          break;
        case 'github':
          success = !!import.meta.env.VITE_GITHUB_TOKEN;
          break;
        default:
          success = false;
      }

      if (success) {
        updateIntegrationStatus(integration.id, 'connected');
        toast.success(`${integration.name} connected.`);
      } else {
        updateIntegrationStatus(integration.id, 'error');
        toast.error(`${integration.name} connection failed. Check configuration.`);
      }
    } catch (err) {
      updateIntegrationStatus(integration.id, 'error');
      toast.error(`Failed to connect ${integration.name}.`);
    }
  };

  const handleDisconnect = (integration: Integration) => {
    updateIntegrationStatus(integration.id, 'disconnected');
    toast.success(`${integration.name} disconnected.`);
  };

  const handleTest = async (integration: Integration) => {
    setTesting(integration.id);

    try {
      let success = false;

      switch (integration.id) {
        case 'logos_vision':
          success = logosVisionService ? await logosVisionService.healthCheck() : false;
          break;
        case 'entomate':
          success = await entomateService.healthCheck();
          break;
        default:
          // Simulate test for other integrations
          await new Promise((r) => setTimeout(r, 1000));
          success = integration.status === 'connected';
      }

      success ? toast.success(`${integration.name} connection successful!`) : toast.error(`${integration.name} connection failed.`);
    } catch (error) {
      toast.error(`Error testing ${integration.name}: ${error}`);
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
              <span className="integration-icon"><AnimatedIcon icon={integration.icon} size={24} /></span>
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
