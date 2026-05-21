// src/components/PulseComposer/geminiSmartComposeProvider.ts
//
// Gemini-backed Smart Compose provider. Replaces the deterministic stub
// shipped with PR 1 (Messages Tools Redesign Surface 1). Calls Gemini
// through the Supabase ai-router edge function via invokeAIPrompt;
// per Pulse convention no API key is ever sent from the client.
//
// Latency posture:
//   • The hook (useSmartCompose) debounces by 600ms before calling
//     this provider. We add no extra delay.
//   • Network round-trip ~300-700ms typical. Ghost text appears as a
//     low-emphasis suffix; if the user types more during the call,
//     useSmartCompose aborts via the passed AbortSignal and we drop
//     the stale completion silently.
//
// Output quality guardrails:
//   • System prompt asks for 1-5 words, no quotes, no preamble.
//   • Strip stray surrounding quotes the model sometimes adds anyway.
//   • Drop completions longer than 120 chars (likely the model going
//     off-leash; better to suggest nothing than a paragraph).
//   • Skip the call entirely for very short drafts (<4 chars) or
//     drafts already ending in terminal punctuation.

import { invokeAIPrompt } from '../../services/ai/aiService';
import { getCurrentWorkspaceId } from '../../services/ai/getWorkspaceId';
import type { SmartComposeProvider, SmartComposeSuggestion } from './types';

const SYSTEM_PROMPT =
  "You are an inline writing assistant inside a chat composer. Continue the user's draft message naturally with 1-5 words. " +
  "Output ONLY the continuation text. No quotes, no preamble, no labels, no explanation. " +
  "If the draft already feels complete, output exactly: NONE";

const MAX_COMPLETION_LEN = 120;
const MIN_DRAFT_LEN = 4;
// Hard cap on the model's output. The system prompt asks for 1-5 words but
// the prompt is not a contract — without a token cap the content_generation
// task default (4096) applies and the model can stream back a paragraph
// every keystroke pause. 32 covers ~10 words with headroom for tokenizer
// quirks; anything longer is dropped by MAX_COMPLETION_LEN below anyway.
const MAX_OUTPUT_TOKENS = 32;

export const geminiSmartComposeProvider: SmartComposeProvider = async (
  current,
  signal,
): Promise<SmartComposeSuggestion | null> => {
  if (signal.aborted) return null;

  const trimmed = current.trim();
  if (trimmed.length < MIN_DRAFT_LEN) return null;
  // No suffix after terminal punctuation -- looks more natural.
  if (/[.!?]\s*$/.test(trimmed)) return null;

  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) return null;

  try {
    const userPrompt = `Continue this draft message naturally. Return ONLY the continuation:\n\n${current}`;
    const raw = await invokeAIPrompt('content_generation', userPrompt, {
      workspaceId,
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.4,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

    if (signal.aborted) return null;

    let cleaned = (raw ?? '').trim();
    // Strip wrap quotes the model sometimes adds despite the instruction.
    cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '').trim();
    // Strip leading "..." continuation markers if present.
    cleaned = cleaned.replace(/^\.{2,}\s*/, '');
    // Skip when the model returned the sentinel for "draft is complete".
    if (!cleaned || cleaned === 'NONE') return null;
    if (cleaned.length > MAX_COMPLETION_LEN) return null;

    // Re-anchor a leading space when the current text doesn't already end
    // in whitespace and the completion doesn't lead with whitespace --
    // otherwise the suggested text glues onto the last word.
    const needsLeadingSpace =
      !current.endsWith(' ') && !cleaned.match(/^[\s.,;:!?)]/);
    const completion = needsLeadingSpace ? ' ' + cleaned : cleaned;

    return {
      id: `gemini-${current.length}-${cleaned.slice(0, 24)}`,
      completion,
    };
  } catch (err) {
    // Silent failure per useSmartCompose spec -- the composer just shows
    // no ghost text on this keystroke and tries again on the next.
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[geminiSmartComposeProvider] failed', err);
    }
    return null;
  }
};
