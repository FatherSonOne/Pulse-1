// OutcomeRetrospective: 3-button rating + freeform reflection prompt that
// fires N days after a decision is marked Decided. The wizard's Step 4
// retrospectiveDays drives whether and when this surfaces.
//
// Phase 4 of the Decisions and Tasks overhaul.

import React, { useState } from 'react';
import { Sparkles, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import { decisionContextService } from '../../../services/decisionContextService';
import './DecisionContext.css';

interface OutcomeRetrospectiveProps {
  decisionId: string;
  decisionTitle: string;
  workspaceId: string;
  userId: string;
  promptId: string;
  /** Called when the operator records or dismisses. */
  onResolved: () => void;
  onDismiss: () => void;
}

type Rating = 'good' | 'neutral' | 'poor';

export const OutcomeRetrospective: React.FC<OutcomeRetrospectiveProps> = ({
  decisionId,
  decisionTitle,
  workspaceId,
  userId,
  promptId,
  onResolved,
  onDismiss,
}) => {
  const [rating, setRating] = useState<Rating | null>(null);
  const [reflection, setReflection] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating || submitting) return;
    setSubmitting(true);
    const ok = await decisionContextService.recordOutcome({
      decisionId,
      workspaceId,
      userId,
      rating,
      reflection,
    });
    if (ok) {
      await decisionContextService.resolvePrompt(promptId);
      toast.success('Outcome recorded.');
      onResolved();
    } else {
      toast.error('Could not save the outcome. Try again.');
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    await decisionContextService.dismissPrompt(promptId);
    onDismiss();
  };

  return (
    <div className="dx-retro" role="region" aria-label="Decision retrospective">
      <header className="dx-retro-header">
        <div className="dx-retro-eyebrow">
          <Sparkles size={12} aria-hidden="true" />
          <span className="dt-label">Pulse AI &middot; Look back</span>
        </div>
        <h3 className="dx-retro-title">How did this decision turn out?</h3>
        <p className="dx-retro-sub">{decisionTitle}</p>
      </header>

      <div className="dx-retro-ratings" role="radiogroup" aria-label="Outcome rating">
        <button
          type="button"
          role="radio"
          aria-checked={rating === 'good'}
          className={`dx-retro-rating${rating === 'good' ? ' is-selected' : ''}`}
          data-rating="good"
          onClick={() => setRating('good')}
        >
          <ThumbsUp size={14} aria-hidden="true" />
          <span>Worked well</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={rating === 'neutral'}
          className={`dx-retro-rating${rating === 'neutral' ? ' is-selected' : ''}`}
          data-rating="neutral"
          onClick={() => setRating('neutral')}
        >
          <Minus size={14} aria-hidden="true" />
          <span>Mixed</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={rating === 'poor'}
          className={`dx-retro-rating${rating === 'poor' ? ' is-selected' : ''}`}
          data-rating="poor"
          onClick={() => setRating('poor')}
        >
          <ThumbsDown size={14} aria-hidden="true" />
          <span>Did not work</span>
        </button>
      </div>

      <label htmlFor="dx-retro-reflection" className="dx-retro-label dt-label">
        Reflection
      </label>
      <textarea
        id="dx-retro-reflection"
        className="dx-retro-textarea"
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
        placeholder="What did you learn? What would you do differently next time?"
        rows={3}
      />

      <div className="dx-retro-actions">
        <button
          type="button"
          className="dx-retro-action-secondary"
          onClick={handleDismiss}
          disabled={submitting}
        >
          Skip
        </button>
        <button
          type="button"
          className="dx-retro-action-primary"
          onClick={handleSubmit}
          disabled={!rating || submitting}
        >
          {submitting ? 'Saving' : 'Record outcome'}
        </button>
      </div>
    </div>
  );
};
