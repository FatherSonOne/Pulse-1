// Step 1: Frame select.
//
// The operator picks one of 6 frames OR types a plain-English description and
// lets AI classify. The 6-frame grid renders from the FRAMES registry; if a
// frame hasn't shipped yet it simply doesn't appear (registry is empty during
// scaffolding, fills in as frame agents complete).

import React, { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { FRAMES } from './frames';
import type { FrameId } from './types';

interface Step1FrameSelectProps {
  /** When the operator picks a frame from the grid. */
  onPickFrame: (frameId: FrameId) => void;
  /** When the operator submits the plain-English textarea. */
  onParseDescription: (description: string) => Promise<void>;
  /** Set while the AI parser is running. */
  isParsing: boolean;
}

export const Step1FrameSelect: React.FC<Step1FrameSelectProps> = ({
  onPickFrame,
  onParseDescription,
  isParsing,
}) => {
  const [description, setDescription] = useState('');

  const handleParse = () => {
    if (!description.trim() || isParsing) return;
    onParseDescription(description.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleParse();
    }
  };

  return (
    <div className="dw-step1">
      <header className="dw-step1-header">
        <h3 className="dw-step1-title">What are you working out?</h3>
        <p className="dw-step1-sub">
          Pick a frame, or describe it in plain English and AI picks for you.
        </p>
      </header>

      {FRAMES.length > 0 && (
        <div className="dw-step1-grid" role="group" aria-label="Decision frames">
          {FRAMES.map((frame) => {
            const Icon = frame.icon;
            return (
              <button
                key={frame.id}
                type="button"
                className="dw-step1-card"
                onClick={() => onPickFrame(frame.id)}
              >
                <Icon size={20} aria-hidden="true" className="dw-step1-card-icon" />
                <span className="dw-step1-card-label">{frame.label}</span>
                <span className="dw-step1-card-blurb">{frame.blurb}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="dw-step1-divider" aria-hidden="true">
        <span className="dt-label">OR</span>
      </div>

      <div className="dw-step1-ai">
        <label htmlFor="dw-ai-description" className="dw-step1-ai-label dt-label">
          Describe it in plain English
        </label>
        <textarea
          id="dw-ai-description"
          className="dw-step1-ai-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. I need to hire a senior backend engineer by end of month, must know Postgres and Go."
          rows={3}
          disabled={isParsing}
        />
        <button
          type="button"
          className="dw-step1-ai-button"
          onClick={handleParse}
          disabled={!description.trim() || isParsing}
        >
          {isParsing ? (
            <>
              <Sparkles size={14} aria-hidden="true" className="dw-step1-ai-spinner" />
              Thinking
            </>
          ) : (
            <>
              <ArrowRight size={14} aria-hidden="true" />
              Make plan
            </>
          )}
        </button>
      </div>
    </div>
  );
};
