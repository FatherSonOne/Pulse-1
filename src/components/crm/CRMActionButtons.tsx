// ============================================
// CRM ACTION BUTTONS COMPONENT
// Contextual action buttons for CRM operations
// ============================================

import React, { useState } from 'react';
import { CRMIntegration, CRMActionType, CRMActionPayload } from '../../types/crmTypes';
import { CheckSquare, DollarSign, Phone, UserPlus, Mail, Calendar } from 'lucide-react';
import { crmActionsService } from '../../services/crmActionsService';
import toast from 'react-hot-toast';

interface CRMActionButtonsProps {
  integrations: CRMIntegration[];
  contactId?: string;
  dealId?: string;
  messageId?: string;
  chatId?: string;
  messageContent?: string;
}

interface ActionButtonConfig {
  type: CRMActionType;
  label: string;
  icon: React.ReactNode;
  variant: 'primary' | 'secondary' | 'outline';
  getPayload: (messageContent?: string) => CRMActionPayload;
}

export const CRMActionButtons: React.FC<CRMActionButtonsProps> = ({
  integrations,
  contactId,
  dealId,
  messageId,
  chatId,
  messageContent,
}) => {
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(
    integrations[0]?.id || null
  );

  const activeIntegration = integrations.find((i) => i.id === selectedIntegration);

  const actionButtons: ActionButtonConfig[] = [
    {
      type: 'create_task',
      label: 'Create Task',
      icon: <CheckSquare size={16} />,
      variant: 'outline',
      getPayload: (content) => ({
        fields: {
          title: 'Follow up from Pulse',
          description: content || 'Task created from Pulse message',
          priority: 'medium',
          dueDate: new Date(Date.now() + 86400000), // Tomorrow
        },
        associatedRecordId: contactId || dealId,
        associatedRecordType: contactId ? 'contact' : 'deal',
      }),
    },
    {
      type: 'update_deal',
      label: 'Update Deal',
      icon: <DollarSign size={16} />,
      variant: 'outline',
      getPayload: () => ({
        fields: {
          stage: 'Negotiation',
          notes: 'Updated from Pulse conversation',
        },
      }),
    },
    {
      type: 'log_call',
      label: 'Log Call',
      icon: <Phone size={16} />,
      variant: 'outline',
      getPayload: (content) => ({
        fields: {
          title: 'Call from Pulse',
          notes: content || 'Call logged from Pulse',
          duration: 900, // 15 minutes
          callTime: new Date(),
          outcome: 'Connected',
        },
        associatedRecordId: contactId || dealId,
        associatedRecordType: contactId ? 'contact' : 'deal',
      }),
    },
    {
      type: 'create_contact',
      label: 'Add Contact',
      icon: <UserPlus size={16} />,
      variant: 'outline',
      getPayload: () => ({
        fields: {
          firstName: 'New',
          lastName: 'Contact',
          lifecycleStage: 'lead',
        },
      }),
    },
  ];

  const handleAction = async (config: ActionButtonConfig) => {
    if (!activeIntegration) {
      toast.error('No CRM integration selected');
      return;
    }

    const actionKey = `${config.type}-${activeIntegration.id}`;
    setExecutingAction(actionKey);

    try {
      const payload = config.getPayload(messageContent);
      const targetId = config.type === 'update_deal' ? dealId : contactId;

      await crmActionsService.createAction(
        config.type,
        activeIntegration.id,
        targetId || '',
        payload,
        '', // User ID - should be from auth context
        {
          chatId,
          messageId,
          templateName: 'message_action',
        }
      );

      toast.success(`${config.label} successful!`);
    } catch (error: any) {
      console.error(`Failed to execute ${config.type}:`, error);
      toast.error(error.message || `Failed to ${config.label.toLowerCase()}`);
    } finally {
      setExecutingAction(null);
    }
  };

  if (integrations.length === 0) {
    return null;
  }

  return (
    <div className="crm-action-buttons-container">
      {/* Integration Selector (if multiple) */}
      {integrations.length > 1 && (
        <div className="crm-integration-selector">
          <label>CRM:</label>
          <select
            value={selectedIntegration || ''}
            onChange={(e) => setSelectedIntegration(e.target.value)}
            className="crm-integration-select"
          >
            {integrations.map((integration) => (
              <option key={integration.id} value={integration.id}>
                {integration.displayName} ({integration.platform})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Action Buttons */}
      <div className="crm-action-buttons">
        {actionButtons.map((config) => {
          const actionKey = `${config.type}-${activeIntegration?.id}`;
          const isExecuting = executingAction === actionKey;

          // Hide "Update Deal" button if no deal ID
          if (config.type === 'update_deal' && !dealId) {
            return null;
          }

          return (
            <button
              key={config.type}
              className={`crm-action-btn crm-action-btn-${config.variant}`}
              onClick={() => handleAction(config)}
              disabled={isExecuting || !activeIntegration}
              title={config.label}
            >
              {isExecuting ? (
                <>
                  <span className="crm-action-spinner">⏳</span>
                  <span>Working...</span>
                </>
              ) : (
                <>
                  {config.icon}
                  <span>{config.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        .crm-action-buttons-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px;
          background: var(--color-secondary, #f3f4f6);
          border-radius: 8px;
          margin: 12px 0;
        }

        .crm-integration-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .crm-integration-selector label {
          font-weight: 600;
          color: var(--color-text-secondary, #6b7280);
        }

        .crm-integration-select {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 6px;
          font-size: 13px;
          background: var(--color-background, #ffffff);
          color: var(--color-text, #111827);
        }

        .crm-action-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .crm-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .crm-action-btn-primary {
          background: #3b82f6;
          color: #ffffff;
          border: none;
        }

        .crm-action-btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .crm-action-btn-secondary {
          background: var(--color-background, #ffffff);
          color: var(--color-text, #111827);
          border: 1px solid var(--color-border, #e5e7eb);
        }

        .crm-action-btn-secondary:hover:not(:disabled) {
          background: var(--color-secondary, #f3f4f6);
        }

        .crm-action-btn-outline {
          background: transparent;
          color: var(--color-text, #111827);
          border: 1px solid var(--color-border, #e5e7eb);
        }

        .crm-action-btn-outline:hover:not(:disabled) {
          background: var(--color-background, #ffffff);
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .crm-action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .crm-action-spinner {
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .crm-action-buttons {
            flex-direction: column;
          }

          .crm-action-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};
