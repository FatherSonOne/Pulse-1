// src/components/ToolsMenuV2/Insights/useInsights.ts
// PR 3b — Surface 3 · Insights state machine + AI provider hook.
//
// Mirror of useThreadSummary's pattern, but the generated payload is a
// chip array + highlight cards (no determinate progress — Insights are
// always a fixed-shape extraction). Production wiring goes through a
// Supabase edge function per Pulse memory note "Pulse Gemini Routing is
// Server-Side"; PR 3b ships a deterministic stub.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  STUB_AI_DELAY_MS,
  type InsightsProvider,
  type InsightsState,
} from '../types';

const stubProvider: InsightsProvider = async (input, signal) => {
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
    chips: [
      { id: 'topic-pricing', label: 'Pricing page · 8 msgs' },
      { id: 'topic-q3', label: 'Q3 timeline · 6 msgs' },
      { id: 'topic-vendor', label: 'Vendor SOW · 4 msgs' },
      { id: 'topic-marcus', label: 'Marcus intro · 2 msgs' },
    ],
    highlights: [
      {
        id: 'h-unresolved',
        title: 'Unresolved question',
        detail:
          'Marcus has not been looped in on the revised scope doc yet.',
      },
      {
        id: 'h-decision',
        title: 'Decision made',
        detail: 'Kickoff moved from Tuesday to Thursday with Casey.',
      },
    ],
    sourceMessages: input.messageCount,
  };
};

export interface UseInsightsArgs {
  threadId: string;
  messageCount: number;
  suggestionProvider?: InsightsProvider;
}

export interface UseInsightsReturn {
  state: InsightsState;
  generate: () => void;
  cancel: () => void;
}

export function useInsights({
  threadId,
  messageCount,
  suggestionProvider,
}: UseInsightsArgs): UseInsightsReturn {
  const [state, setState] = useState<InsightsState>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  // Reset when the thread switches.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ kind: 'idle' });
  }, [threadId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ kind: 'idle' });
  }, []);

  const generate = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: 'generating', startedAt: Date.now() });

    const provider = suggestionProvider ?? stubProvider;
    provider({ threadId, messageCount }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setState({
          kind: 'generated',
          chips: result.chips,
          highlights: result.highlights,
          sourceMessages: result.sourceMessages,
          generatedAt: Date.now(),
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : 'Couldn’t generate insights.';
        setState({ kind: 'error', message });
      });
  }, [threadId, messageCount, suggestionProvider]);

  return { state, generate, cancel };
}
