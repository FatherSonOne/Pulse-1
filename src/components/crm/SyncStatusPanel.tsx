// ============================================
// CRM SYNC STATUS PANEL
// Displays sync status and allows manual sync
// ============================================

import React, { useState, useEffect } from 'react';
import { CRMIntegration, SyncLog } from '../../types/crmTypes';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface SyncStatusPanelProps {
  integrations: CRMIntegration[];
  onRefresh?: () => void;
}

interface PlatformSyncCardProps {
  integration: CRMIntegration;
  onSync: (integrationId: string) => Promise<void>;
}

const PlatformSyncCard: React.FC<PlatformSyncCardProps> = ({ integration, onSync }) => {
  const [isSyncing, setIsSyncing] = useState(integration.syncStatus === 'syncing');
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    setIsSyncing(integration.syncStatus === 'syncing');
  }, [integration.syncStatus]);

  useEffect(() => {
    if (showLogs) {
      fetchSyncLogs();
    }
  }, [showLogs, integration.id]);

  const fetchSyncLogs = async () => {
    try {
      const response = await fetch(`/api/crm/integrations/${integration.id}/sync-logs`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('supabase_token')}`,
        },
      });

      if (response.ok) {
        const { data } = await response.json();
        setSyncLogs(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch sync logs:', error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      await onSync(integration.id);
      toast.success(`${integration.displayName} sync started`);

      // Poll for sync completion
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/crm/integrations`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('supabase_token')}`,
            },
          });

          if (response.ok) {
            const { data } = await response.json();
            const updated = data.find((i: CRMIntegration) => i.id === integration.id);

            if (updated && updated.syncStatus !== 'syncing') {
              setIsSyncing(false);
              clearInterval(interval);

              if (updated.syncStatus === 'error') {
                toast.error('Sync failed: ' + updated.syncErrorMessage);
              } else {
                toast.success('Sync completed successfully');
              }
            }
          }
        } catch (error) {
          console.error('Failed to check sync status:', error);
        }
      }, 3000);

      // Clear interval after 60 seconds
      setTimeout(() => clearInterval(interval), 60000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to start sync');
      setIsSyncing(false);
    }
  };

  const platformIcons = {
    hubspot: '🟠',
    salesforce: '☁️',
    pipedrive: '📊',
    zoho: '🔵',
  };

  const platformNames = {
    hubspot: 'HubSpot',
    salesforce: 'Salesforce',
    pipedrive: 'Pipedrive',
    zoho: 'Zoho CRM',
  };

  const getStatusIcon = () => {
    if (isSyncing) {
      return <RefreshCw size={20} className="sync-icon-spinning" />;
    }

    if (integration.syncStatus === 'error') {
      return <XCircle size={20} className="sync-icon-error" />;
    }

    return <CheckCircle size={20} className="sync-icon-success" />;
  };

  const getStatusText = () => {
    if (isSyncing) {
      return 'Syncing...';
    }

    if (integration.syncStatus === 'error') {
      return 'Sync Failed';
    }

    if (integration.lastSyncAt) {
      return `Synced ${formatDistanceToNow(new Date(integration.lastSyncAt), {
        addSuffix: true,
      })}`;
    }

    return 'Never synced';
  };

  return (
    <div className="platform-sync-card">
      <div className="platform-sync-header">
        <div className="platform-sync-info">
          <span className="platform-icon">{platformIcons[integration.platform]}</span>
          <div>
            <h4>{integration.displayName}</h4>
            <p>{platformNames[integration.platform]}</p>
          </div>
        </div>
        <button
          className="sync-btn"
          onClick={handleSync}
          disabled={isSyncing || !integration.isActive}
          title="Sync now"
        >
          <RefreshCw size={16} className={isSyncing ? 'spinning' : ''} />
        </button>
      </div>

      <div className="platform-sync-status">
        {getStatusIcon()}
        <span className="status-text">{getStatusText()}</span>
      </div>

      {integration.syncStatus === 'error' && integration.syncErrorMessage && (
        <div className="sync-error-message">
          <AlertCircle size={16} />
          <span>{integration.syncErrorMessage}</span>
        </div>
      )}

      <div className="platform-sync-stats">
        <div className="stat-item">
          <span className="stat-label">Contacts</span>
          <span className="stat-value">0</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Companies</span>
          <span className="stat-value">0</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Deals</span>
          <span className="stat-value">0</span>
        </div>
      </div>

      <button className="view-logs-btn" onClick={() => setShowLogs(!showLogs)}>
        {showLogs ? 'Hide' : 'View'} Sync History
      </button>

      {showLogs && (
        <div className="sync-logs">
          {syncLogs.length === 0 ? (
            <p className="no-logs">No sync history available</p>
          ) : (
            <ul className="sync-logs-list">
              {syncLogs.map((log) => (
                <li key={log.id} className={`sync-log-item sync-log-${log.status}`}>
                  <div className="sync-log-header">
                    <span className="sync-log-type">{log.syncType}</span>
                    <span className="sync-log-time">
                      {formatDistanceToNow(new Date(log.startedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="sync-log-stats">
                    {log.contactsSynced} contacts, {log.companiesSynced} companies,{' '}
                    {log.dealsSynced} deals
                  </div>
                  {log.errorMessage && (
                    <div className="sync-log-error">{log.errorMessage}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <style jsx>{`
        .platform-sync-card {
          background: var(--color-background, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 12px;
          padding: 20px;
        }

        .platform-sync-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .platform-sync-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .platform-icon {
          font-size: 32px;
        }

        .platform-sync-info h4 {
          margin: 0 0 4px;
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text, #111827);
        }

        .platform-sync-info p {
          margin: 0;
          font-size: 13px;
          color: var(--color-text-secondary, #6b7280);
        }

        .sync-btn {
          padding: 8px;
          background: var(--color-secondary, #f3f4f6);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .sync-btn:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .sync-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sync-btn .spinning {
          animation: spin 1s linear infinite;
        }

        .platform-sync-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: var(--color-secondary, #f3f4f6);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .sync-icon-spinning {
          animation: spin 1s linear infinite;
          color: #3b82f6;
        }

        .sync-icon-success {
          color: #16a34a;
        }

        .sync-icon-error {
          color: #dc2626;
        }

        .status-text {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text, #111827);
        }

        .sync-error-message {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 13px;
          color: #991b1b;
        }

        .platform-sync-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-item {
          text-align: center;
          padding: 12px;
          background: var(--color-secondary, #f3f4f6);
          border-radius: 8px;
        }

        .stat-label {
          display: block;
          font-size: 12px;
          color: var(--color-text-secondary, #6b7280);
          margin-bottom: 4px;
        }

        .stat-value {
          display: block;
          font-size: 20px;
          font-weight: 700;
          color: var(--color-text, #111827);
        }

        .view-logs-btn {
          width: 100%;
          padding: 8px;
          background: transparent;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary, #6b7280);
          cursor: pointer;
          transition: all 0.15s;
        }

        .view-logs-btn:hover {
          background: var(--color-secondary, #f3f4f6);
          color: var(--color-text, #111827);
        }

        .sync-logs {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--color-border, #e5e7eb);
        }

        .no-logs {
          text-align: center;
          padding: 20px;
          font-size: 13px;
          color: var(--color-text-secondary, #6b7280);
        }

        .sync-logs-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .sync-log-item {
          padding: 12px;
          border-left: 3px solid;
          margin-bottom: 8px;
          border-radius: 4px;
        }

        .sync-log-success {
          background: #f0fdf4;
          border-color: #16a34a;
        }

        .sync-log-partial {
          background: #fffbeb;
          border-color: #d97706;
        }

        .sync-log-failed {
          background: #fef2f2;
          border-color: #dc2626;
        }

        .sync-log-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .sync-log-type {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .sync-log-time {
          font-size: 11px;
          color: var(--color-text-secondary, #6b7280);
        }

        .sync-log-stats {
          font-size: 12px;
          color: var(--color-text-secondary, #6b7280);
        }

        .sync-log-error {
          margin-top: 6px;
          font-size: 12px;
          color: #991b1b;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({ integrations, onRefresh }) => {
  const handleSync = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/crm/integrations/${integrationId}/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('supabase_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to start sync');
      }

      onRefresh?.();
    } catch (error) {
      throw error;
    }
  };

  if (integrations.length === 0) {
    return (
      <div className="sync-status-panel-empty">
        <Clock size={48} />
        <h3>No CRM Integrations</h3>
        <p>Add a CRM integration to start syncing your contacts and deals.</p>
      </div>
    );
  }

  return (
    <div className="sync-status-panel">
      <div className="sync-status-header">
        <h3>CRM Sync Status</h3>
        <button className="refresh-all-btn" onClick={onRefresh}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="sync-platforms">
        {integrations.map((integration) => (
          <PlatformSyncCard
            key={integration.id}
            integration={integration}
            onSync={handleSync}
          />
        ))}
      </div>

      <style jsx>{`
        .sync-status-panel {
          padding: 24px;
        }

        .sync-status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .sync-status-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--color-text, #111827);
        }

        .refresh-all-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #3b82f6;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }

        .refresh-all-btn:hover {
          background: #2563eb;
        }

        .sync-platforms {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }

        .sync-status-panel-empty {
          text-align: center;
          padding: 60px 20px;
          color: var(--color-text-secondary, #6b7280);
        }

        .sync-status-panel-empty svg {
          color: var(--color-text-secondary, #9ca3af);
          margin-bottom: 16px;
        }

        .sync-status-panel-empty h3 {
          margin: 0 0 8px;
          font-size: 18px;
          font-weight: 600;
          color: var(--color-text, #111827);
        }

        .sync-status-panel-empty p {
          margin: 0;
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .sync-platforms {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
