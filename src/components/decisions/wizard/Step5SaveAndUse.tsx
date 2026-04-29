// Step 5: Save and use.
//
// Final summary of what the wizard will create, plus a save-as-template
// affordance. Two primary actions: "Use this once" creates the decision
// and tasks but doesn't save a template; "Save as template" also saves a
// reusable template into decision_templates for future use.

import React, { useState } from 'react';
import { Plus, BookmarkPlus } from 'lucide-react';
import { TextField } from './primitives/TextField';
import { TextareaField } from './primitives/TextareaField';
import type { FrameId, SuggestedTask, Step4Output, WizardState } from './types';
import { getFrame } from './frames';

interface Step5SaveAndUseProps {
  wizardState: WizardState & { frameId: FrameId };
  isSubmitting: boolean;
  onUseOnce: () => void;
  onSaveAndUse: (opts: { name: string; description?: string; sharedWithWorkspace: boolean }) => void;
}

export const Step5SaveAndUse: React.FC<Step5SaveAndUseProps> = ({
  wizardState,
  isSubmitting,
  onUseOnce,
  onSaveAndUse,
}) => {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [shared, setShared] = useState(false);

  const frame = getFrame(wizardState.frameId);
  const decisionTitle = frame
    ? frame.deriveDecisionTitle(wizardState.step2 as never)
    : 'Untitled decision';
  const decisionMomentTask = wizardState.step3Tasks.find((t) => t.isDecisionMoment);

  const handleSaveAndUse = () => {
    if (!templateName.trim()) return;
    onSaveAndUse({
      name: templateName.trim(),
      description: templateDescription.trim() || undefined,
      sharedWithWorkspace: shared,
    });
  };

  return (
    <div className="dw-step5">
      <header className="dw-step5-header">
        <h3 className="dw-step5-title">Ready to go</h3>
        <p className="dw-step5-sub">
          Pulse will create one decision and {wizardState.step3Tasks.length}{' '}
          {wizardState.step3Tasks.length === 1 ? 'task' : 'tasks'}.
        </p>
      </header>

      <div className="dw-step5-summary">
        <div className="dw-step5-summary-row">
          <span className="dt-label">Decision</span>
          <span className="dw-step5-summary-value">{decisionTitle}</span>
        </div>
        <div className="dw-step5-summary-row">
          <span className="dt-label">Frame</span>
          <span className="dw-step5-summary-value">{frame?.label ?? wizardState.frameId}</span>
        </div>
        {decisionMomentTask && (
          <div className="dw-step5-summary-row">
            <span className="dt-label">Decision moment</span>
            <span className="dw-step5-summary-value">{decisionMomentTask.title}</span>
          </div>
        )}
        {wizardState.step4.decideByDate && (
          <div className="dw-step5-summary-row">
            <span className="dt-label">Decide by</span>
            <span className="dw-step5-summary-value">{formatDate(wizardState.step4.decideByDate)}</span>
          </div>
        )}
        {wizardState.step4.retrospectiveDays > 0 && (
          <div className="dw-step5-summary-row">
            <span className="dt-label">Look back in</span>
            <span className="dw-step5-summary-value">
              {wizardState.step4.retrospectiveDays} days
            </span>
          </div>
        )}
      </div>

      {showSaveForm && (
        <div className="dw-step5-save-form">
          <TextField
            label="Template name"
            value={templateName}
            onChange={setTemplateName}
            placeholder="e.g. Senior backend hire"
            required
            autoFocus
          />
          <TextareaField
            label="Description"
            value={templateDescription}
            onChange={setTemplateDescription}
            placeholder="Optional. Helps you find this template later."
            rows={2}
          />
          <label className="dw-step5-share">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />
            <span>Share with workspace</span>
          </label>
        </div>
      )}

      <div className="dw-step5-actions">
        {!showSaveForm ? (
          <>
            <button
              type="button"
              className="dw-button-secondary"
              onClick={() => setShowSaveForm(true)}
              disabled={isSubmitting}
            >
              <BookmarkPlus size={14} aria-hidden="true" />
              Save as template
            </button>
            <button
              type="button"
              className="dw-button-primary"
              onClick={onUseOnce}
              disabled={isSubmitting}
            >
              <Plus size={14} aria-hidden="true" strokeWidth={2.5} />
              {isSubmitting ? 'Creating' : 'Use this once'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="dw-button-secondary"
              onClick={() => setShowSaveForm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="dw-button-primary"
              onClick={handleSaveAndUse}
              disabled={!templateName.trim() || isSubmitting}
            >
              <BookmarkPlus size={14} aria-hidden="true" />
              {isSubmitting ? 'Saving' : 'Save and use'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
