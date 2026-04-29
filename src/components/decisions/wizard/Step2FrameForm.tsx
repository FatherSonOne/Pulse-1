// Step 2: Frame form router.
//
// Looks up the active frame from the registry and renders its Step2Form.
// Validation errors are computed by the frame's validateStep2 and surfaced
// to the form.

import React, { useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { getFrame } from './frames';
import type { FrameId } from './types';
import type { User } from '../../../types';

interface Step2FrameFormProps {
  frameId: FrameId;
  step2: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  workspaceMembers: User[];
  errors: Record<string, string>;
  onBack: () => void;
}

export const Step2FrameForm: React.FC<Step2FrameFormProps> = ({
  frameId,
  step2,
  onChange,
  workspaceMembers,
  errors,
  onBack,
}) => {
  const frame = useMemo(() => getFrame(frameId), [frameId]);

  if (!frame) {
    return (
      <div className="dw-step2-missing">
        <p>This frame is not yet available. Pick another or describe in plain English.</p>
        <button type="button" className="dw-back-button" onClick={onBack}>
          <ChevronLeft size={14} aria-hidden="true" />
          Back
        </button>
      </div>
    );
  }

  const Step2Form = frame.Step2Form;
  const Icon = frame.icon;

  return (
    <div className="dw-step2">
      <header className="dw-step2-header">
        <button
          type="button"
          className="dw-back-button"
          onClick={onBack}
          aria-label="Back to frame select"
          title="Back"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <Icon size={18} aria-hidden="true" className="dw-step2-icon" />
        <div>
          <h3 className="dw-step2-title">{frame.label}</h3>
          <p className="dw-step2-sub">{frame.blurb}</p>
        </div>
      </header>

      <div className="dw-step2-form">
        <Step2Form
          value={step2 as never}
          onChange={onChange as never}
          workspaceMembers={workspaceMembers}
          errors={errors as never}
        />
      </div>
    </div>
  );
};
