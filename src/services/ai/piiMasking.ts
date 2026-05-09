// PII masking — strips obvious identifiers from prompts before they hit AI providers.
//
// Effective masking = (workspace.ai_pii_masking_enforced) OR (settings.aiPiiMaskingEnabled).
// The org flag is passed via InvokeAIOptions when the caller has the workspace
// in hand; the user flag is read here from settingsService.
//
// Patterns are deliberately conservative — false positives are mostly harmless
// (a "[email]" placeholder where there wasn't really an email is a small
// quality hit), but false negatives leak PII to providers, which is the
// scenario this is supposed to prevent.

import { settingsService } from '../settingsService';
import type { AIInvokeParams, AIMessage } from './types';

const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// US-style + international with country code. Matches 10–15 digits with
// optional separators. Bounded to avoid matching version numbers or IDs.
const PHONE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
// Credit-card-like 13–16 digit groups with optional separators. The trailing
// boundary keeps it from gobbling longer tokens like UUIDs.
const CREDIT_CARD = /\b(?:\d[ -]?){13,16}\b/g;
// IPv4 — useful to scrub from logs/stack traces users paste in.
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

/**
 * Replace obvious PII tokens in a string with bracketed placeholders.
 * Order matters — credit-card runs before phone so a 16-digit number isn't
 * partially captured as a phone.
 */
export function maskPII(input: string): string {
  if (!input) return input;
  return input
    .replace(CREDIT_CARD, '[card]')
    .replace(SSN, '[ssn]')
    .replace(EMAIL, '[email]')
    .replace(PHONE, '[phone]')
    .replace(IPV4, '[ip]');
}

/**
 * Apply maskPII to every message + systemPrompt in an AI request payload.
 * Pure — returns a new object; doesn't mutate the input.
 */
export function maskParams(params: AIInvokeParams): AIInvokeParams {
  const messages: AIMessage[] = (params.messages ?? []).map((m) => ({
    ...m,
    content: typeof m.content === 'string' ? maskPII(m.content) : m.content,
  }));
  return {
    ...params,
    messages,
    ...(params.systemPrompt
      ? { systemPrompt: maskPII(params.systemPrompt) }
      : {}),
  };
}

/**
 * Resolve whether masking should apply for the current call.
 *
 * The caller may pass `enforced` if it already knows the workspace's
 * ai_pii_masking_enforced flag. Otherwise we fall back to the user setting.
 */
export async function shouldMask(opts?: { enforced?: boolean }): Promise<boolean> {
  if (opts?.enforced) return true;
  try {
    return Boolean(await settingsService.get('aiPiiMaskingEnabled'));
  } catch {
    return false;
  }
}
