// DecisionWizard: 5-step shell + state machine.
//
// Renders inside a slide-down panel (matches the DecisionTemplates pattern
// shipped earlier in this session). Manages the cross-step state, frame
// selection, validation, AI calls for Step 3 task suggestion, and submit.
//
// The wizard does NOT call decisionService / taskService directly. It
// builds a WizardOutput payload and hands it to the host via onSubmit.
// The host (DecisionTaskHub) is responsible for the database writes, so
// we don't entangle the wizard with workspace/user context.

import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { X, ChevronRight } from 'lucide-react';
import type { User } from '../../../types';
import { Step1FrameSelect } from './Step1FrameSelect';
import { Step2FrameForm } from './Step2FrameForm';
import { Step3TaskShaping } from './Step3TaskShaping';
import { Step4Rhythm } from './Step4Rhythm';
import { Step5SaveAndUse } from './Step5SaveAndUse';
import { getFrame, FRAMES } from './frames';
import { classifyAndPrefill } from '../../../services/decisionWizardAI';
import { useAIErrorHandler } from '../../../hooks/useAIErrorHandler';
import type {
  FrameId,
  Step4Output,
  SuggestedTask,
  WizardOutput,
  WizardState,
} from './types';
import './DecisionWizard.css';

interface DecisionWizardProps {
  workspaceId: string;
  currentUserId: string;
  workspaceMembers: User[];
  /** When provided, the wizard opens with this frame pre-selected and skips Step 1. */
  initialFrameId?: FrameId;
  onClose: () => void;
  onSubmit: (output: WizardOutput) => Promise<void>;
}

function defaultStep4(decideByDateFromFrame: string | null): Step4Output {
  return {
    decideByDate: decideByDateFromFrame,
    shipByDate: null,
    checkInCadence: 'none',
    remindBeforeDays: 1,
    retrospectiveDays: 0,
  };
}

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Action =
  | { type: 'pick_frame'; frameId: FrameId; defaultStep2: Record<string, unknown> }
  | { type: 'set_step2'; step2: Record<string, unknown> }
  | { type: 'set_step3'; tasks: SuggestedTask[] }
  | { type: 'set_step4'; step4: Step4Output }
  | { type: 'goto'; step: WizardState['step'] }
  | { type: 'reset_to_step1' };

const initialState: WizardState = {
  step: 1,
  frameId: null,
  step2: {},
  step3Tasks: [],
  step4: defaultStep4(todayPlusDays(7)),
  saveAsTemplate: null,
};

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'pick_frame':
      return {
        ...state,
        frameId: action.frameId,
        step2: action.defaultStep2,
        step3Tasks: [],
        step: 2,
      };
    case 'set_step2':
      return { ...state, step2: action.step2 };
    case 'set_step3':
      return { ...state, step3Tasks: action.tasks };
    case 'set_step4':
      return { ...state, step4: action.step4 };
    case 'goto':
      return { ...state, step: action.step };
    case 'reset_to_step1':
      return { ...initialState };
    default:
      return state;
  }
}

export const DecisionWizard: React.FC<DecisionWizardProps> = ({
  workspaceId,
  currentUserId,
  workspaceMembers,
  initialFrameId,
  onClose,
  onSubmit,
}) => {
  // Compute the initial state once based on initialFrameId (if provided),
  // then hand it to useReducer with the simpler two-arg signature so the
  // dispatch type infers correctly.
  const computedInitialState = useMemo<WizardState>(() => {
    if (initialFrameId) {
      const frame = getFrame(initialFrameId);
      if (frame) {
        return {
          ...initialState,
          frameId: initialFrameId,
          step2: frame.defaultStep2 as Record<string, unknown>,
          step: 2,
        };
      }
    }
    return initialState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [state, dispatch] = useReducer(reducer, computedInitialState);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [isSuggestingTasks, setIsSuggestingTasks] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const handleAIError = useAIErrorHandler();

  // Keyboard: Escape closes; Cmd/Ctrl+Enter advances or submits.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // Trigger the primary forward action via a custom event the
        // navigation buttons listen for.
        modalRef.current?.querySelector<HTMLButtonElement>('.dw-nav-primary')?.click();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const activeFrame = state.frameId ? getFrame(state.frameId) : null;

  const handlePickFrame = (frameId: FrameId) => {
    const frame = getFrame(frameId);
    if (!frame) return;
    setErrors({});
    dispatch({
      type: 'pick_frame',
      frameId,
      defaultStep2: frame.defaultStep2 as Record<string, unknown>,
    });
  };

  const handleParseDescription = async (description: string) => {
    setIsParsing(true);
    try {
      const result = await classifyAndPrefill(description, workspaceMembers);
      if (!result) {
        toast.error('Could not classify that description. Pick a frame above.');
        return;
      }
      const frame = getFrame(result.frameId);
      if (!frame) {
        toast.error('That frame is not available yet. Pick another above.');
        return;
      }
      const merged = {
        ...(frame.defaultStep2 as Record<string, unknown>),
        ...(result.prefill ?? {}),
      };
      dispatch({ type: 'pick_frame', frameId: result.frameId, defaultStep2: merged });
      if (result.confidence === 'low') {
        toast(`Best guess: ${frame.label}. Adjust the fields if needed.`, { duration: 3500 });
      }
    } catch (err) {
      const handled = handleAIError(err);
      if (!handled) {
        console.error('Parse description failed:', err);
        toast.error('Could not parse the description. Pick a frame manually.');
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleAdvanceFromStep2 = async () => {
    if (!activeFrame) return;
    const validation = activeFrame.validateStep2(state.step2 as never);
    if (Object.keys(validation).length > 0) {
      setErrors(validation as Record<string, string>);
      toast.error('Fix the highlighted fields.');
      return;
    }
    setErrors({});
    setIsSuggestingTasks(true);
    try {
      const decideBy = pickDecideByFromStep2(state.step2) ?? todayPlusDays(7);
      const tasks = await activeFrame.suggestTasks(state.step2 as never, decideBy);
      dispatch({ type: 'set_step3', tasks });
      // Seed Step 4's decide-by from Step 2 if available.
      dispatch({
        type: 'set_step4',
        step4: { ...state.step4, decideByDate: decideBy },
      });
      dispatch({ type: 'goto', step: 3 });
    } catch (err) {
      console.error('Task suggestion failed:', err);
      toast.error('Could not generate tasks. Try again or skip to Step 4.');
    } finally {
      setIsSuggestingTasks(false);
    }
  };

  const handleRegenerateTasks = async () => {
    if (!activeFrame) return;
    setIsSuggestingTasks(true);
    try {
      const decideBy = state.step4.decideByDate ?? todayPlusDays(7);
      const tasks = await activeFrame.suggestTasks(state.step2 as never, decideBy);
      dispatch({ type: 'set_step3', tasks });
    } catch (err) {
      console.error('Regenerate failed:', err);
      toast.error('Could not regenerate tasks.');
    } finally {
      setIsSuggestingTasks(false);
    }
  };

  const buildOutput = (saveAsTemplate?: { name: string; description?: string; sharedWithWorkspace: boolean }): WizardOutput => {
    if (!activeFrame || !state.frameId) {
      throw new Error('No active frame');
    }
    const decisionTitle = activeFrame.deriveDecisionTitle(state.step2 as never);
    const decisionDescription = activeFrame.deriveDecisionDescription(state.step2 as never);
    const decideBy = state.step4.decideByDate ?? todayPlusDays(7);
    const decideByDateMs = new Date(decideBy).getTime();

    // Resolve task deadlines from offsets relative to today.
    const resolvedTasks = state.step3Tasks.map((t) => {
      const offsetMs = t.deadlineOffsetDays * 24 * 60 * 60 * 1000;
      const deadlineMs = Date.now() + offsetMs;
      // Cap individual task deadlines at decide-by + 30 days as a sanity bound.
      const cappedMs = Math.min(deadlineMs, decideByDateMs + 30 * 24 * 60 * 60 * 1000);
      return {
        workspace_id: workspaceId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: 'todo' as const,
        assignee_id: t.assigneeId,
        deadline: new Date(cappedMs).toISOString(),
        metadata: {
          generated_by_wizard: true,
          frame_id: state.frameId,
          is_decision_moment: t.isDecisionMoment ?? false,
          is_immediate: t.isImmediate ?? false,
          created_by: currentUserId,
        },
      };
    });

    return {
      decision: {
        workspace_id: workspaceId,
        title: decisionTitle,
        description: decisionDescription,
        decision_type: activeFrame.defaultDecisionType ?? 'consensus',
        proposed_by: currentUserId,
        metadata: {
          frame_id: state.frameId,
          step2: state.step2,
          step4: state.step4,
        },
      },
      tasks: resolvedTasks,
      ...(saveAsTemplate ? {
        saveAsTemplate: {
          ...saveAsTemplate,
          config: {
            frameId: state.frameId,
            step2: state.step2,
            step4: state.step4,
          },
        },
      } : {}),
    };
  };

  const handleUseOnce = async () => {
    setIsSubmitting(true);
    try {
      const output = buildOutput();
      await onSubmit(output);
      onClose();
    } catch (err) {
      console.error('Submit failed:', err);
      toast.error('Could not create the decision. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAndUse = async (opts: { name: string; description?: string; sharedWithWorkspace: boolean }) => {
    setIsSubmitting(true);
    try {
      const output = buildOutput(opts);
      await onSubmit(output);
      onClose();
    } catch (err) {
      console.error('Save and use failed:', err);
      toast.error('Could not save the template. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepLabels = useMemo(
    () => ['Frame', 'Details', 'Tasks', 'Rhythm', 'Save'],
    []
  );

  const modalContent = (
    <>
      <div className="dw-overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        className="dw-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dw-modal-title"
      >
        <header className="dw-modal-header">
          <div className="dw-modal-header-left">
            <h2 id="dw-modal-title" className="dw-modal-title">New decision</h2>
            <ol className="dw-progress" aria-label="Wizard progress">
              {stepLabels.map((label, i) => {
                const stepNum = (i + 1) as WizardState['step'];
                const isActive = state.step === stepNum;
                const isComplete = state.step > stepNum;
                return (
                  <li
                    key={label}
                    className={`dw-progress-step${isActive ? ' is-active' : ''}${isComplete ? ' is-complete' : ''}`}
                  >
                    <span className="dw-progress-dot" aria-hidden="true" />
                    <span className="dw-progress-label dt-label">{label}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <button
            type="button"
            className="dw-modal-close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="dw-modal-body">
          {state.step === 1 && (
            <Step1FrameSelect
              onPickFrame={handlePickFrame}
              onParseDescription={handleParseDescription}
              isParsing={isParsing}
            />
          )}
          {state.step === 2 && state.frameId && (
            <Step2FrameForm
              frameId={state.frameId}
              step2={state.step2}
              onChange={(next) => dispatch({ type: 'set_step2', step2: next })}
              workspaceMembers={workspaceMembers}
              errors={errors}
              onBack={() => dispatch({ type: 'goto', step: 1 })}
            />
          )}
          {state.step === 3 && (
            <Step3TaskShaping
              tasks={state.step3Tasks}
              onChange={(tasks) => dispatch({ type: 'set_step3', tasks })}
              workspaceMembers={workspaceMembers}
              onRegenerate={handleRegenerateTasks}
              isRegenerating={isSuggestingTasks}
            />
          )}
          {state.step === 4 && (
            <Step4Rhythm
              value={state.step4}
              onChange={(step4) => dispatch({ type: 'set_step4', step4 })}
            />
          )}
          {state.step === 5 && state.frameId && (
            <Step5SaveAndUse
              wizardState={state as WizardState & { frameId: FrameId }}
              isSubmitting={isSubmitting}
              onUseOnce={handleUseOnce}
              onSaveAndUse={handleSaveAndUse}
            />
          )}
        </div>

        <footer className="dw-modal-footer">
          {state.step < 5 ? (
            <>
              {state.step > 1 && (
                <button
                  type="button"
                  className="dw-nav-secondary"
                  onClick={() => dispatch({ type: 'goto', step: (state.step - 1) as WizardState['step'] })}
                >
                  Back
                </button>
              )}
              <span className="dw-nav-spacer" />
              {state.step === 1 && FRAMES.length === 0 && (
                <span className="dw-nav-hint dt-label">Pick a frame to continue</span>
              )}
              {state.step === 2 && (
                <button
                  type="button"
                  className="dw-nav-primary"
                  onClick={handleAdvanceFromStep2}
                  disabled={isSuggestingTasks}
                >
                  {isSuggestingTasks ? 'Thinking' : 'Generate tasks'}
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              )}
              {state.step === 3 && (
                <button
                  type="button"
                  className="dw-nav-primary"
                  onClick={() => dispatch({ type: 'goto', step: 4 })}
                  disabled={state.step3Tasks.length === 0}
                >
                  Set rhythm
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              )}
              {state.step === 4 && (
                <button
                  type="button"
                  className="dw-nav-primary"
                  onClick={() => dispatch({ type: 'goto', step: 5 })}
                >
                  Review
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            // Step 5 has its own submit buttons inside the body.
            <span className="dw-nav-hint dt-label">Pick an action above</span>
          )}
        </footer>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
};

function pickDecideByFromStep2(step2: Record<string, unknown>): string | null {
  const v = (step2 as { decideByDate?: string; targetShipDate?: string });
  return v.decideByDate ?? v.targetShipDate ?? null;
}
