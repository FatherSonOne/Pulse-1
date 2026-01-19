// ============================================
// CRM INTEGRATION SETUP WIZARD
// Multi-step wizard for configuring CRM integrations
// ============================================

import React, { useState, useEffect } from 'react';
import { CRMPlatform, CRMIntegration } from '../../types/crmTypes';
import { PlatformSelector } from './wizard/PlatformSelector';
import { OAuthConfiguration } from './wizard/OAuthConfiguration';
import { ConnectionTest } from './wizard/ConnectionTest';
import { SetupComplete } from './wizard/SetupComplete';
import { X } from 'lucide-react';
import './IntegrationSetupWizard.css';

interface IntegrationSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (integration: CRMIntegration) => void;
}

type WizardStep = 'platform' | 'oauth' | 'test' | 'complete';

export const IntegrationSetupWizard: React.FC<IntegrationSetupWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('platform');
  const [selectedPlatform, setSelectedPlatform] = useState<CRMPlatform | null>(null);
  const [integration, setIntegration] = useState<Partial<CRMIntegration>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check URL params for OAuth callback data
  useEffect(() => {
    if (!isOpen) return;

    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const platform = params.get('platform');
    const data = params.get('data');

    if (status === 'success' && platform && data) {
      try {
        const integrationData = JSON.parse(atob(data));
        setSelectedPlatform(platform as CRMPlatform);
        setIntegration(integrationData);
        setCurrentStep('test');

        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      } catch (err) {
        console.error('Failed to parse OAuth callback data:', err);
        setError('Failed to complete OAuth flow');
      }
    } else if (status === 'error') {
      const message = params.get('message');
      setError(message || 'OAuth authentication failed');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isOpen]);

  const handlePlatformSelect = (platform: CRMPlatform) => {
    setSelectedPlatform(platform);
    setIntegration({ platform });
    setCurrentStep('oauth');
  };

  const handleOAuthComplete = (data: Partial<CRMIntegration>) => {
    setIntegration((prev) => ({ ...prev, ...data }));
    setCurrentStep('test');
  };

  const handleTestComplete = async (displayName: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Save integration to database
      const response = await fetch('/api/crm/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('supabase_token')}`,
        },
        body: JSON.stringify({
          platform: integration.platform,
          display_name: displayName,
          access_token: integration.accessToken,
          refresh_token: integration.refreshToken,
          token_expires_at: integration.expiresAt,
          api_key: integration.apiKey,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save integration');
      }

      const { data } = await response.json();
      setIntegration(data);
      setCurrentStep('complete');
    } catch (err: any) {
      setError(err.message || 'Failed to save integration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    if (integration.id) {
      onComplete(integration as CRMIntegration);
    }
    onClose();
  };

  const handleBack = () => {
    const steps: WizardStep[] = ['platform', 'oauth', 'test', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleCloseWizard = () => {
    setCurrentStep('platform');
    setSelectedPlatform(null);
    setIntegration({});
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const stepNumber = {
    platform: 1,
    oauth: 2,
    test: 3,
    complete: 4,
  }[currentStep];

  return (
    <div className="wizard-overlay">
      <div className="wizard-container">
        {/* Header */}
        <div className="wizard-header">
          <div>
            <h2>Add CRM Integration</h2>
            <p className="wizard-subtitle">
              Step {stepNumber} of 4: {currentStep === 'platform' && 'Select Platform'}
              {currentStep === 'oauth' && 'Configure OAuth'}
              {currentStep === 'test' && 'Test Connection'}
              {currentStep === 'complete' && 'Setup Complete'}
            </p>
          </div>
          <button
            className="wizard-close-btn"
            onClick={handleCloseWizard}
            aria-label="Close wizard"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="wizard-progress">
          <div className="wizard-progress-bar" style={{ width: `${(stepNumber / 4) * 100}%` }} />
        </div>

        {/* Error Message */}
        {error && (
          <div className="wizard-error">
            <strong>Error:</strong> {error}
            <button onClick={() => setError(null)} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Step Content */}
        <div className="wizard-content">
          {currentStep === 'platform' && (
            <PlatformSelector onSelect={handlePlatformSelect} />
          )}

          {currentStep === 'oauth' && selectedPlatform && (
            <OAuthConfiguration
              platform={selectedPlatform}
              onComplete={handleOAuthComplete}
              onBack={handleBack}
            />
          )}

          {currentStep === 'test' && integration.platform && (
            <ConnectionTest
              integration={integration}
              onComplete={handleTestComplete}
              onBack={handleBack}
              isLoading={isLoading}
            />
          )}

          {currentStep === 'complete' && integration.id && (
            <SetupComplete integration={integration as CRMIntegration} onFinish={handleComplete} />
          )}
        </div>
      </div>
    </div>
  );
};
