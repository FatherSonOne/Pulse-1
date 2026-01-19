// ============================================
// CONNECTION TEST - Step 3 of Wizard
// ============================================

import React, { useState, useEffect } from 'react';
import { CRMIntegration } from '../../../types/crmTypes';
import { CheckCircle, XCircle, ArrowLeft, Loader } from 'lucide-react';

interface ConnectionTestProps {
  integration: Partial<CRMIntegration>;
  onComplete: (displayName: string) => void;
  onBack: () => void;
  isLoading: boolean;
}

export const ConnectionTest: React.FC<ConnectionTestProps> = ({
  integration,
  onComplete,
  onBack,
  isLoading,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResults, setTestResults] = useState<{
    connection: boolean;
    permissions: boolean;
    dataAccess: boolean;
  } | null>(null);

  useEffect(() => {
    // Auto-test connection when component mounts
    testConnection();
  }, []);

  const testConnection = async () => {
    setTestStatus('testing');
    setTestResults(null);

    // Simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock test results (in production, call actual API)
    const results = {
      connection: true,
      permissions: true,
      dataAccess: true,
    };

    setTestResults(results);
    setTestStatus(results.connection && results.permissions ? 'success' : 'error');
  };

  const handleSubmit = () => {
    if (!displayName.trim()) {
      alert('Please enter a name for this integration');
      return;
    }
    onComplete(displayName.trim());
  };

  const platformNames = {
    hubspot: 'HubSpot',
    salesforce: 'Salesforce',
    pipedrive: 'Pipedrive',
    zoho: 'Zoho CRM',
  };

  return (
    <div className="connection-test">
      <button className="wizard-back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to OAuth Configuration
      </button>

      <div className="connection-test-header">
        <h3>Test Connection</h3>
        <p>Verifying your {platformNames[integration.platform || 'hubspot']} connection...</p>
      </div>

      {/* Test Status */}
      <div className="test-status-container">
        {testStatus === 'testing' && (
          <div className="test-status test-status-testing">
            <Loader className="spinner" size={32} />
            <h4>Testing Connection...</h4>
            <p>This may take a few moments</p>
          </div>
        )}

        {testStatus === 'success' && testResults && (
          <div className="test-status test-status-success">
            <CheckCircle size={48} className="status-icon-success" />
            <h4>Connection Successful!</h4>
            <p>All tests passed. Your integration is ready to use.</p>
          </div>
        )}

        {testStatus === 'error' && testResults && (
          <div className="test-status test-status-error">
            <XCircle size={48} className="status-icon-error" />
            <h4>Connection Failed</h4>
            <p>Some tests did not pass. Please check your configuration.</p>
          </div>
        )}
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="test-results">
          <h4>Test Results</h4>
          <ul className="test-results-list">
            <li className={testResults.connection ? 'test-pass' : 'test-fail'}>
              {testResults.connection ? (
                <CheckCircle size={20} />
              ) : (
                <XCircle size={20} />
              )}
              <div>
                <strong>API Connection</strong>
                <span>
                  {testResults.connection
                    ? 'Successfully connected to API'
                    : 'Failed to connect to API'}
                </span>
              </div>
            </li>

            <li className={testResults.permissions ? 'test-pass' : 'test-fail'}>
              {testResults.permissions ? (
                <CheckCircle size={20} />
              ) : (
                <XCircle size={20} />
              )}
              <div>
                <strong>Permissions</strong>
                <span>
                  {testResults.permissions
                    ? 'Required permissions granted'
                    : 'Missing required permissions'}
                </span>
              </div>
            </li>

            <li className={testResults.dataAccess ? 'test-pass' : 'test-fail'}>
              {testResults.dataAccess ? (
                <CheckCircle size={20} />
              ) : (
                <XCircle size={20} />
              )}
              <div>
                <strong>Data Access</strong>
                <span>
                  {testResults.dataAccess
                    ? 'Can read and write data'
                    : 'Cannot access data'}
                </span>
              </div>
            </li>
          </ul>
        </div>
      )}

      {/* Configuration Form */}
      {testStatus === 'success' && (
        <div className="connection-config">
          <div className="form-group">
            <label htmlFor="display-name">Integration Name</label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={`My ${platformNames[integration.platform || 'hubspot']} Account`}
              className="connection-input"
              autoFocus
            />
            <span className="form-help">
              Give this integration a memorable name (e.g., "Sales Team HubSpot")
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="connection-actions">
        {testStatus === 'error' && (
          <button className="btn btn-secondary" onClick={testConnection}>
            Retry Test
          </button>
        )}

        {testStatus === 'success' && (
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isLoading || !displayName.trim()}
          >
            {isLoading ? 'Saving...' : 'Complete Setup'}
          </button>
        )}
      </div>
    </div>
  );
};
