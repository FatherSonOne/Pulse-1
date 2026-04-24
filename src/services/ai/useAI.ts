// React hook wrapper — pulls workspaceId from context so components don't have to.
// Services (non-React code) should call invokeAI directly with workspaceId.

import { useCallback } from 'react';
import { useWorkspaceData } from '../../contexts/WorkspaceContext';
import { invokeAI, invokeAIPrompt, invokeAIJson } from './aiService';
import type { AITask, AIInvokeParams, AIResult } from './types';

export function useAI() {
  const { currentWorkspace } = useWorkspaceData();
  const workspaceId = currentWorkspace?.id;

  const invoke = useCallback(
    async (task: AITask, params: AIInvokeParams, signal?: AbortSignal): Promise<AIResult> => {
      if (!workspaceId) throw new Error('No active workspace');
      return invokeAI(task, params, { workspaceId, signal });
    },
    [workspaceId],
  );

  const prompt = useCallback(
    async (
      task: AITask,
      promptText: string,
      opts?: { systemPrompt?: string; jsonMode?: boolean; temperature?: number; signal?: AbortSignal },
    ): Promise<string> => {
      if (!workspaceId) throw new Error('No active workspace');
      return invokeAIPrompt(task, promptText, { workspaceId, ...opts });
    },
    [workspaceId],
  );

  const json = useCallback(
    async <T = unknown>(
      task: AITask,
      promptText: string,
      opts?: { systemPrompt?: string; temperature?: number; signal?: AbortSignal },
    ): Promise<T> => {
      if (!workspaceId) throw new Error('No active workspace');
      return invokeAIJson<T>(task, promptText, { workspaceId, ...opts });
    },
    [workspaceId],
  );

  return { invoke, prompt, json, workspaceId, ready: !!workspaceId };
}
