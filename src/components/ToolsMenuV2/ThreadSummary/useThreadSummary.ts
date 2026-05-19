// src/components/ToolsMenuV2/ThreadSummary/useThreadSummary.ts
// PR 3b — Surface 3 · Thread Summary state machine + AI provider hook.
//
// Owns the {idle | generating | generated | error} state machine for a
// single thread summary. Mirrors PulseComposer/useSmartCompose's
// provider-with-AbortController pattern so the real Gemini edge function
// can drop in without touching the UI.
//
// IMPORTANT: per Pulse memory note "Pulse Gemini Routing is Server-Side",
// the production provider must call a Supabase edge function — NEVER an
// API key in the browser. PR 3b ships a deterministic stub; the real
// wiring is a separate PR and lives behind this same provider contract.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  STUB_AI_DELAY_MS,
  SUMMARY_DETERMINATE_THRESHOLD,
  type ThreadSummaryProvider,
  type ThreadSummaryState,
} from '../types';

/**
 * Deterministic dev fixture. Returns after ~1.5s with a multi-paragraph
 * summary that's safe to ship behind the feature flag. Real wiring goes
 * through a Supabase edge function (see file header).
 */
const stubProvider: ThreadSummaryProvider = async (input, signal) => {
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, STUB_AI_DELAY_MS);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true },
    );
  });
  return {
    summary:
      'Casey raised concerns about the Q3 timeline on Monday, citing ' +
      'dependencies on the design review.\n\n' +
      'You agreed to move the kickoff to Thursday and to loop in ' +
      'Marcus before Wednesday EOD.\n\n' +
      'Open items: Marcus intro, revised scope doc, vendor SOW.',
    sourceMessages: input.messageCount,
  };
};

export interface UseThreadSummaryArgs {
  threadId: string;
  messageCount: number;
  /** Provider override — pass the real edge-function caller here. */
  suggestionProvider?: ThreadSummaryProvider;
}

export interface UseThreadSummaryReturn {
  state: ThreadSummaryState;
  /** Kick off generation (or regenerate if already generated). */
  generate: () => void;
  /** Abort an in-flight request and return to idle. */
  cancel: () => void;
  /** Whether progress should render as determinate (msgCount > 200). */
  isDeterminate: boolean;
}

export function useThreadSummary({
  threadId,
  messageCount,
  suggestionProvider,
}: UseThreadSummaryArgs): UseThreadSummaryReturn {
  const [state, setState] = useState<ThreadSummaryState>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset whenever the thread switches.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setState({ kind: 'idle' });
  }, [threadId]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setState({ kind: 'idle' });
  }, []);

  const generate = useCallback(() => {
    // Abort any prior in-flight call before starting a new one.
    abortRef.current?.abort();
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = Date.now();
    setState({
      kind: 'generating',
      startedAt,
      progress: 0,
      totalMessages: messageCount,
    });

    // Drive the determinate progress bar synthetically while the stub
    // resolves. Real provider can call an onProgress callback later;
    // for PR 3b we tween 0 -> 0.9 over the stub delay and let the
    // resolved promise flip to 1.0.
    progressTimerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.kind !== 'generating') return prev;
        const next = Math.min(prev.progress + 0.07, 0.9);
        return { ...prev, progress: next };
      });
    }, 120);

    const provider = suggestionProvider ?? stubProvider;
    provider({ threadId, messageCount }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        setState({
          kind: 'generated',
          summary: result.summary,
          sourceMessages: result.sourceMessages,
          generatedAt: Date.now(),
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        const message =
          err instanceof Error
            ? err.message
            : 'Couldn’t generate summary.';
        setState({ kind: 'error', message });
      });
  }, [threadId, messageCount, suggestionProvider]);

  const isDeterminate = messageCount > SUMMARY_DETERMINATE_THRESHOLD;

  return { state, generate, cancel, isDeterminate };
}
