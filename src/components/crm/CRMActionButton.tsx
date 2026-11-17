// ============================================
// CRM ACTION BUTTON COMPONENT
// Triggers CRM workflows from messages
// ============================================

import React, { useState } from 'react';
import { CRMActionType, CRMActionPayload } from '../../types/crmTypes';
import { crmActionsService } from '../../services/crmActionsService';

interface CRMActionButtonProps {
  label: string;
  actionType: CRMActionType;
  crmId: string;
  targetExternalId: string;
  payload: CRMActionPayload;
  chatId?: string;
  messageId?: string;
  templateName?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

/**
 * CRM Action Button Component
 * Allows users to trigger CRM workflows from Pulse chat
 * Examples: "Log Call", "Create Task", "Update Deal Stage"
 */
export const CRMActionButton: React.FC<CRMActionButtonProps> = ({
  label,
  actionType,
  crmId,
  targetExternalId,
  payload,
  chatId,
  messageId,
  templateName,
  icon,
  variant = 'primary',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      // Get current user ID (from auth context in real app)
      const userId = ''; // TODO: Get from auth

      await crmActionsService.createAction(
        actionType,
        crmId,
        targetExternalId,
        payload,
        userId,
        {
          chatId,
          messageId,
          templateName,
        }
      );

      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error) {
      console.error('CRM action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const buttonClass = `crm-action-button crm-button-${variant}`;

  return (
    <>
      <button
        className={buttonClass}
        onClick={handleClick}
        disabled={isLoading || isSuccess}
        title={`${actionType}: ${label}`}
      >
        {isLoading ? (
          <>
            <span className="loading-spinner">⏳</span> Working...
          </>
        ) : isSuccess ? (
          <>
            <span>✓</span> Done!
          </>
        ) : (
          <>
            {icon && <span>{icon}</span>} {label}
          </>
        )}
      </button>

      <style>{`
        .crm-action-button {
          padding: 10px 16px;
          border-radius: var(--radius-base);
          border: none;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 150ms var(--ease-standard);
          white-space: nowrap;
        }

        .crm-button-primary {
          background: var(--color-primary);
          color: var(--color-btn-primary-text);
        }

        .crm-button-primary:hover {
          background: var(--color-primary-hover);
        }

        .crm-button-secondary {
          background: var(--color-secondary);
          color: var(--color-text);
        }

        .crm-button-secondary:hover {
          background: var(--color-secondary-hover);
        }

        .crm-button-outline {
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text);
        }

        .crm-button-outline:hover {
          background: var(--color-secondary);
        }

        .crm-action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-spinner {
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
      `}</style>
    </>
  );
};
