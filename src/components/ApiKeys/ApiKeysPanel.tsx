/**
 * API Keys Management Panel
 * Allows users to create, view, and manage their API keys
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ApiKey,
  ApiScope,
  API_SCOPES,
  getApiKeys,
  createApiKey,
  deleteApiKey,
  revokeApiKey,
  updateApiKey,
  getApiUsageStats,
  ApiUsageStats,
  generateCurlExample,
  generateFetchExample,
  generatePythonExample
} from '../../services/apiKeyService';
import './ApiKeysPanel.css';

interface ApiKeysPanelProps {
  onClose?: () => void;
}

export const ApiKeysPanel: React.FC<ApiKeysPanelProps> = ({ onClose }) => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create key modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<ApiScope[]>(['read']);
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(100);
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Usage stats
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<ApiUsageStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Code examples modal
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState<'curl' | 'javascript' | 'python'>('curl');

  const loadKeys = useCallback(async () => {
    setLoading(true);
    const result = await getApiKeys();
    if (result.success) {
      setKeys(result.data || []);
    } else {
      setError(result.error || 'Failed to load API keys');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      setError('Please enter a name for the API key');
      return;
    }

    setCreating(true);
    setError(null);

    const expiresAt = newKeyExpiry ? new Date(newKeyExpiry) : undefined;

    const result = await createApiKey(
      newKeyName.trim(),
      newKeyScopes,
      newKeyRateLimit,
      expiresAt
    );

    if (result.success && result.data) {
      setCreatedKey(result.data.api_key);
      await loadKeys();
    } else {
      setError(result.error || 'Failed to create API key');
    }

    setCreating(false);
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This cannot be undone.')) {
      return;
    }

    const result = await deleteApiKey(keyId);
    if (result.success) {
      await loadKeys();
    } else {
      setError(result.error || 'Failed to delete API key');
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    const result = await revokeApiKey(keyId);
    if (result.success) {
      await loadKeys();
    } else {
      setError(result.error || 'Failed to revoke API key');
    }
  };

  const handleToggleActive = async (key: ApiKey) => {
    const result = await updateApiKey(key.id, { is_active: !key.is_active });
    if (result.success) {
      await loadKeys();
    } else {
      setError(result.error || 'Failed to update API key');
    }
  };

  const loadUsageStats = async (keyId: string) => {
    setSelectedKeyId(keyId);
    setLoadingStats(true);

    const result = await getApiUsageStats(keyId, 30);
    if (result.success) {
      setUsageStats(result.data || null);
    }

    setLoadingStats(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setNewKeyName('');
    setNewKeyScopes(['read']);
    setNewKeyRateLimit(100);
    setNewKeyExpiry('');
    setCreatedKey(null);
  };

  const toggleScope = (scope: ApiScope) => {
    if (newKeyScopes.includes(scope)) {
      setNewKeyScopes(newKeyScopes.filter(s => s !== scope));
    } else {
      setNewKeyScopes([...newKeyScopes, scope]);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCodeExample = () => {
    const key = createdKey || 'pk_live_xxxxxxxxxxxxx';
    switch (codeLanguage) {
      case 'curl':
        return generateCurlExample(key);
      case 'javascript':
        return generateFetchExample(key);
      case 'python':
        return generatePythonExample(key);
    }
  };

  return (
    <div className="api-keys-panel">
      <div className="api-keys-header">
        <div className="api-keys-title-row">
          <h2>API Keys</h2>
          {onClose && (
            <button className="close-btn" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="api-keys-description">
          Create and manage API keys for programmatic access to Pulse.
          Keep your keys secure - they provide access to your data.
        </p>
      </div>

      {error && (
        <div className="api-keys-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="api-keys-actions">
        <button className="create-key-btn" onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create API Key
        </button>
        <button className="docs-btn" onClick={() => setShowCodeModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
          </svg>
          View Examples
        </button>
      </div>

      {loading ? (
        <div className="api-keys-loading">
          <div className="spinner"></div>
          Loading API keys...
        </div>
      ) : keys.length === 0 ? (
        <div className="api-keys-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
          <h3>No API Keys</h3>
          <p>Create an API key to access Pulse programmatically.</p>
        </div>
      ) : (
        <div className="api-keys-list">
          {keys.map(key => (
            <div key={key.id} className={`api-key-item ${!key.is_active ? 'inactive' : ''}`}>
              <div className="api-key-main">
                <div className="api-key-info">
                  <div className="api-key-name">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                    {key.name}
                    {!key.is_active && <span className="inactive-badge">Inactive</span>}
                  </div>
                  <div className="api-key-prefix">
                    <code>{key.key_prefix}••••••••••••</code>
                  </div>
                </div>

                <div className="api-key-meta">
                  <div className="api-key-scopes">
                    {key.scopes.map(scope => (
                      <span key={scope} className={`scope-badge scope-${scope}`}>
                        {scope}
                      </span>
                    ))}
                  </div>
                  <div className="api-key-dates">
                    <span title="Created">Created: {formatDate(key.created_at)}</span>
                    <span title="Last used">Last used: {formatDate(key.last_used_at)}</span>
                    {key.expires_at && (
                      <span title="Expires" className="expires">
                        Expires: {formatDate(key.expires_at)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="api-key-actions">
                  <button
                    className="action-btn stats"
                    onClick={() => loadUsageStats(key.id)}
                    title="View usage"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 20V10M12 20V4M6 20v-6" />
                    </svg>
                  </button>
                  <button
                    className={`action-btn ${key.is_active ? 'deactivate' : 'activate'}`}
                    onClick={() => handleToggleActive(key)}
                    title={key.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {key.is_active ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                  <button
                    className="action-btn delete"
                    onClick={() => handleDeleteKey(key.id)}
                    title="Delete"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              {selectedKeyId === key.id && usageStats && (
                <div className="api-key-stats">
                  <div className="stats-grid">
                    <div className="stat-card">
                      <span className="stat-value">{usageStats.total_requests}</span>
                      <span className="stat-label">Total Requests</span>
                    </div>
                    <div className="stat-card success">
                      <span className="stat-value">{usageStats.successful_requests}</span>
                      <span className="stat-label">Successful</span>
                    </div>
                    <div className="stat-card error">
                      <span className="stat-value">{usageStats.failed_requests}</span>
                      <span className="stat-label">Failed</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-value">{usageStats.average_response_time}ms</span>
                      <span className="stat-label">Avg Response</span>
                    </div>
                  </div>
                  <button className="close-stats" onClick={() => setSelectedKeyId(null)}>
                    Close Stats
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !createdKey && closeCreateModal()}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            {createdKey ? (
              <>
                <div className="modal-header success">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="M22 4L12 14.01l-3-3" />
                  </svg>
                  <h3>API Key Created</h3>
                </div>
                <div className="modal-body">
                  <div className="key-display">
                    <p className="key-warning">
                      Copy this key now. You won't be able to see it again!
                    </p>
                    <div className="key-value">
                      <code>{createdKey}</code>
                      <button onClick={() => copyToClipboard(createdKey)} title="Copy">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="primary-btn" onClick={closeCreateModal}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-header">
                  <h3>Create API Key</h3>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      placeholder="e.g., Production App"
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label>Permissions</label>
                    <div className="scopes-grid">
                      {(Object.keys(API_SCOPES) as ApiScope[]).map(scope => (
                        <label key={scope} className="scope-checkbox">
                          <input
                            type="checkbox"
                            checked={newKeyScopes.includes(scope)}
                            onChange={() => toggleScope(scope)}
                          />
                          <span className="scope-name">{scope}</span>
                          <span className="scope-desc">{API_SCOPES[scope]}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Rate Limit (requests/minute)</label>
                    <input
                      type="number"
                      value={newKeyRateLimit}
                      onChange={e => setNewKeyRateLimit(parseInt(e.target.value) || 100)}
                      min={1}
                      max={1000}
                    />
                  </div>

                  <div className="form-group">
                    <label>Expiration (optional)</label>
                    <input
                      type="date"
                      value={newKeyExpiry}
                      onChange={e => setNewKeyExpiry(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="secondary-btn" onClick={closeCreateModal}>
                    Cancel
                  </button>
                  <button
                    className="primary-btn"
                    onClick={handleCreateKey}
                    disabled={creating || !newKeyName.trim() || newKeyScopes.length === 0}
                  >
                    {creating ? 'Creating...' : 'Create Key'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Code Examples Modal */}
      {showCodeModal && (
        <div className="modal-overlay" onClick={() => setShowCodeModal(false)}>
          <div className="modal-content wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>API Usage Examples</h3>
            </div>
            <div className="modal-body">
              <div className="code-tabs">
                <button
                  className={codeLanguage === 'curl' ? 'active' : ''}
                  onClick={() => setCodeLanguage('curl')}
                >
                  cURL
                </button>
                <button
                  className={codeLanguage === 'javascript' ? 'active' : ''}
                  onClick={() => setCodeLanguage('javascript')}
                >
                  JavaScript
                </button>
                <button
                  className={codeLanguage === 'python' ? 'active' : ''}
                  onClick={() => setCodeLanguage('python')}
                >
                  Python
                </button>
              </div>
              <div className="code-block">
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(getCodeExample())}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </button>
                <pre><code>{getCodeExample()}</code></pre>
              </div>

              <div className="endpoints-list">
                <h4>Available Endpoints</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Endpoint</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>GET</code></td>
                      <td><code>/api/v1/projects</code></td>
                      <td>List all projects</td>
                    </tr>
                    <tr>
                      <td><code>POST</code></td>
                      <td><code>/api/v1/projects</code></td>
                      <td>Create a project</td>
                    </tr>
                    <tr>
                      <td><code>GET</code></td>
                      <td><code>/api/v1/projects/:id</code></td>
                      <td>Get a project</td>
                    </tr>
                    <tr>
                      <td><code>GET</code></td>
                      <td><code>/api/v1/projects/:id/documents</code></td>
                      <td>List documents</td>
                    </tr>
                    <tr>
                      <td><code>POST</code></td>
                      <td><code>/api/v1/projects/:id/documents</code></td>
                      <td>Add a document</td>
                    </tr>
                    <tr>
                      <td><code>POST</code></td>
                      <td><code>/api/v1/projects/:id/chat</code></td>
                      <td>Chat with project AI</td>
                    </tr>
                    <tr>
                      <td><code>POST</code></td>
                      <td><code>/api/v1/capture</code></td>
                      <td>Quick capture content</td>
                    </tr>
                    <tr>
                      <td><code>GET</code></td>
                      <td><code>/api/v1/me</code></td>
                      <td>Get API key info</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={() => setShowCodeModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeysPanel;
