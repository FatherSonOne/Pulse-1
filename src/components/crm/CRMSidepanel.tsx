// ============================================
// CRM SIDEPANEL COMPONENT
// Shows CRM record data in chat sidebar
// ============================================

import React, { useState, useEffect } from 'react';
import { CRMDeal, CRMSidepanel, SidepanelField } from '../../types/crmTypes';
import { crmActionsService } from '../../services/crmActionsService';

interface CRMSidepanelProps {
  chatId: string;
  deal?: CRMDeal;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CRM Sidepanel Component
 * Displays CRM record (deal, contact, company) in chat
 * Allows inline field updates
 */
export const CRMSidepanelComponent: React.FC<CRMSidepanelProps> = ({
  chatId,
  deal,
  isOpen,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !deal) return null;

  // Key fields to display and edit
  const keyFields: SidepanelField[] = [
    {
      name: 'dealStage',
      label: 'Deal Stage',
      type: 'select',
      currentValue: deal.dealStage,
      options: [
        { label: 'Qualification', value: 'Qualification' },
        { label: 'Proposal', value: 'Proposal' },
        { label: 'Negotiation', value: 'Negotiation' },
        { label: 'Closed Won', value: 'Closed Won' },
        { label: 'Closed Lost', value: 'Closed Lost' },
      ],
      isEditable: true,
    },
    {
      name: 'dealAmount',
      label: 'Deal Amount',
      type: 'number',
      currentValue: deal.dealAmount,
      isEditable: true,
    },
    {
      name: 'closeDate',
      label: 'Close Date',
      type: 'date',
      currentValue: deal.closeDate?.toISOString().split('T')[0],
      isEditable: true,
    },
    {
      name: 'ownerName',
      label: 'Deal Owner',
      type: 'text',
      currentValue: deal.ownerName || 'Unassigned',
      isEditable: false,
    },
    {
      name: 'probability',
      label: 'Probability',
      type: 'number',
      currentValue: deal.probability || 0,
      isEditable: true,
    },
  ];

  const handleFieldChange = (fieldName: string, value: any) => {
    setEditedFields((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSaveChanges = async () => {
    if (!deal) return;

    setIsLoading(true);
    try {
      // Create CRM action to update deal
      await crmActionsService.createAction(
        'update_deal',
        deal.crmId,
        deal.externalId,
        {
          fields: {
            stage: editedFields.dealStage || deal.dealStage,
            amount: editedFields.dealAmount || deal.dealAmount,
            close_date: editedFields.closeDate || deal.closeDate,
            probability: editedFields.probability || deal.probability,
          },
        },
        '', // Current user ID - get from auth
        { chatId, templateName: 'sidepanel_update' }
      );

      setIsEditing(false);
      setEditedFields({});
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="crm-sidepanel">
      <div className="crm-sidepanel-header">
        <h3>{deal.name}</h3>
        <button
          className="crm-sidepanel-close"
          onClick={onClose}
          aria-label="Close CRM panel"
        >
          ✕
        </button>
      </div>

      <div className="crm-sidepanel-content">
        {/* Deal Info */}
        <section className="crm-section">
          <h4>Deal Information</h4>
          <div className="crm-fields">
            {keyFields.map((field) => (
              <div key={field.name} className="crm-field">
                <label>{field.label}</label>

                {isEditing && field.isEditable ? (
                  <>
                    {field.type === 'select' && (
                      <select
                        value={editedFields[field.name] || field.currentValue}
                        onChange={(e) =>
                          handleFieldChange(field.name, e.target.value)
                        }
                        className="crm-input"
                      >
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.type === 'number' && (
                      <input
                        type="number"
                        value={editedFields[field.name] ?? field.currentValue}
                        onChange={(e) =>
                          handleFieldChange(
                            field.name,
                            parseFloat(e.target.value)
                          )
                        }
                        className="crm-input"
                      />
                    )}

                    {field.type === 'date' && (
                      <input
                        type="date"
                        value={editedFields[field.name] || field.currentValue}
                        onChange={(e) =>
                          handleFieldChange(field.name, e.target.value)
                        }
                        className="crm-input"
                      />
                    )}

                    {field.type === 'text' && (
                      <input
                        type="text"
                        value={editedFields[field.name] ?? field.currentValue}
                        onChange={(e) =>
                          handleFieldChange(field.name, e.target.value)
                        }
                        className="crm-input"
                        disabled={!field.isEditable}
                      />
                    )}
                  </>
                ) : (
                  <div className="crm-value">{field.currentValue}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="crm-section">
          <h4>Quick Actions</h4>
          <div className="crm-actions">
            <button
              className="crm-action-btn"
              onClick={() =>
                crmActionsService.createAction(
                  'log_call',
                  deal.crmId,
                  deal.externalId,
                  { notes: 'Call logged from Pulse' },
                  '',
                  { chatId }
                )
              }
            >
              📞 Log Call
            </button>
            <button
              className="crm-action-btn"
              onClick={() =>
                crmActionsService.createAction(
                  'create_task',
                  deal.crmId,
                  deal.externalId,
                  {
                    title: 'Follow up on deal',
                    description: 'Discussed in Pulse chat',
                  },
                  '',
                  { chatId }
                )
              }
            >
              ✓ Create Task
            </button>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="crm-sidepanel-footer">
        {isEditing ? (
          <>
            <button
              className="crm-btn-primary"
              onClick={handleSaveChanges}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              className="crm-btn-secondary"
              onClick={() => {
                setIsEditing(false);
                setEditedFields({});
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button className="crm-btn-primary" onClick={() => setIsEditing(true)}>
            ✎ Edit Fields
          </button>
        )}
      </div>

      {/* Styles */}
      <style>{`
        .crm-sidepanel {
          width: 320px;
          background: var(--color-surface);
          border-left: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .crm-sidepanel-header {
          padding: 16px;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .crm-sidepanel-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .crm-sidepanel-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: var(--color-text-secondary);
        }

        .crm-sidepanel-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .crm-section {
          margin-bottom: 24px;
        }

        .crm-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text);
        }

        .crm-fields {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .crm-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .crm-field label {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .crm-input,
        .crm-value {
          padding: 8px;
          border-radius: var(--radius-base);
          font-size: 14px;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          color: var(--color-text);
        }

        .crm-value {
          border: none;
          padding: 8px;
          font-weight: 500;
        }

        .crm-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .crm-action-btn {
          padding: 10px;
          background: var(--color-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-base);
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: background 150ms;
        }

        .crm-action-btn:hover {
          background: var(--color-secondary-hover);
        }

        .crm-sidepanel-footer {
          padding: 12px 16px;
          border-top: 1px solid var(--color-border);
          display: flex;
          gap: 8px;
        }

        .crm-btn-primary,
        .crm-btn-secondary {
          flex: 1;
          padding: 10px;
          border-radius: var(--radius-base);
          border: none;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          transition: all 150ms;
        }

        .crm-btn-primary {
          background: var(--color-primary);
          color: var(--color-btn-primary-text);
        }

        .crm-btn-primary:hover {
          background: var(--color-primary-hover);
        }

        .crm-btn-secondary {
          background: var(--color-secondary);
          color: var(--color-text);
        }

        .crm-btn-secondary:hover {
          background: var(--color-secondary-hover);
        }

        .crm-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
