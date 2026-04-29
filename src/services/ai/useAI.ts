// React hook wrapper — pulls workspaceId from context so components don't have to.
// Services (non-React code) should call invokeAI directly with workspaceId.
//
// Resolves the user's saved model preference (from aiPreferencesService) and
// passes it as `modelOverride` unless the caller supplied their own. Inline
// override always wins so ad-hoc selectors (e.g. "send THIS one with Sonnet")
// work without disturbing saved prefs.

import { useCallback, useEffect } from 'react';
import { useWorkspaceData } from '../../contexts/WorkspaceContext';
import { invokeAI, invokeAIPrompt, invokeAIJson } from './aiService';
import { aiPreferencesService } from '../aiPreferencesService';
import type { AITask, AIInvokeParams, AIResult } from './types';

interface CallOpts {
  signal?: AbortSignal;
  /** Inline ad-hoc override for this single call. Wins over saved prefs. */
  modelOverride?: string;
}

export function useAI() {
  const { currentWorkspace } = useWorkspaceData();
  const workspaceId = currentWorkspace?.id;

  // Warm prefs cache once so synchronous resolve() works on first call.
  useEffect(() => { void aiPreferencesService.load(); }, []);

  const resolveOverride = (task: AITask, inline?: string): string | undefined =>
    inline ?? (aiPreferencesService.resolve(task) ?? undefined);

  const invoke = useCallback(
    async (task: AITask, params: AIInvokeParams, opts?: CallOpts | AbortSignal): Promise<AIResult> => {
      if (!workspaceId) throw new Error('No active workspace');
      // Backward-compat: existing callers pass an AbortSignal as 3rd arg.
      const o: CallOpts = opts instanceof AbortSignal ? { signal: opts } : (opts ?? {});
      return invokeAI(task, params, {
        workspaceId,
        signal: o.signal,
        modelOverride: resolveOverride(task, o.modelOverride),
      });
    },
    [workspaceId],
  );

  const prompt = useCallback(
    async (
      task: AITask,
      promptText: string,
      opts?: { systemPrompt?: string; jsonMode?: boolean; temperature?: number; signal?: AbortSignal; modelOverride?: string },
    ): Promise<string> => {
      if (!workspaceId) throw new Error('No active workspace');
      return invokeAIPrompt(task, promptText, {
        workspaceId,
        ...opts,
        modelOverride: resolveOverride(task, opts?.modelOverride),
      });
    },
    [workspaceId],
  );

  const json = useCallback(
    async <T = unknown>(
      task: AITask,
      promptText: string,
      opts?: { systemPrompt?: string; temperature?: number; signal?: AbortSignal; modelOverride?: string },
    ): Promise<T> => {
      if (!workspaceId) throw new Error('No active workspace');
      return invokeAIJson<T>(task, promptText, {
        workspaceId,
        ...opts,
        modelOverride: resolveOverride(task, opts?.modelOverride),
      });
    },
    [workspaceId],
  );

  return { invoke, prompt, json, workspaceId, ready: !!workspaceId };
}
