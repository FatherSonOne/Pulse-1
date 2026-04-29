// Decision Wizard AI: classifies a plain-English description into one of 6
// frames and pre-fills as many Step 2 fields as it can extract.
//
// Mirrors the geminiService.parseNaturalLanguageTaskWithFallback pattern:
//   - Routes through invokeAIJson (server-side keys, AI router enforces caps)
//   - Re-throws AI router hard errors via isRouterHardError so the toast
//     surface in useAIErrorHandler can show the upgrade CTA
//   - Soft-fails to a heuristic classifier if the AI call fails

import { invokeAIJson } from './ai/aiService';
import {
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from './ai/errors';
import { getCurrentWorkspaceId } from './ai/getWorkspaceId';
import type { FrameId } from '../components/decisions/wizard/types';
import type { User } from '../types';

type AIRouterError =
  | AICapExceededError
  | AITrialExpiredError
  | AIProviderUnavailableError;

function isRouterHardError(err: unknown): err is AIRouterError {
  return (
    err instanceof AICapExceededError ||
    err instanceof AITrialExpiredError ||
    err instanceof AIProviderUnavailableError
  );
}

export interface WizardAIResult {
  frameId: FrameId;
  confidence: 'high' | 'medium' | 'low';
  /** Partial Step 2 fields. Keys vary by frame; each frame's Step2Form
   *  defensively spreads its defaults under the prefill so missing fields
   *  fall back gracefully. */
  prefill: Record<string, unknown>;
}

/**
 * Classify a plain-English description into a frame and extract Step 2 fields.
 * Returns null on AI failure (caller should fall back to manual frame select).
 * Throws AICapExceededError / AITrialExpiredError / AIProviderUnavailableError
 * unchanged so the global handler can show its toast.
 */
export async function classifyAndPrefill(
  description: string,
  workspaceMembers: User[] = []
): Promise<WizardAIResult | null> {
  const trimmed = description.trim();
  if (!trimmed) return null;

  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return heuristicClassify(trimmed);

    const memberHints = workspaceMembers
      .slice(0, 10)
      .map((m) => `${(m as User & { full_name?: string }).full_name || m.email} (id: ${m.id})`)
      .join(', ');

    const today = new Date().toISOString().slice(0, 10);

    const result = await invokeAIJson<WizardAIResult>(
      'task_prioritization',
      `Classify the following decision description into one of these frames and extract any Step 2 fields you can identify.

Today's date is ${today}. Use this for any relative deadlines like "next week" or "end of month".

Frames:
- hire: hiring or recruitment ("hire a senior engineer", "fill the PM role")
- pick_tool: tool/vendor selection ("pick an auth provider", "evaluate Postgres vs MySQL")
- build: building a feature, product, or project ("build email digests", "launch the dashboard")
- allocate: distributing budget, time, headcount, or resources ("split Q3 budget", "allocate 4 engineers")
- strategy: high-level direction or strategic planning ("set Q3 strategy", "decide our 2-year direction")
- conflict: resolving a disagreement between people ("resolve A vs B disagreement on data model")

Workspace members for assignee/party matching: ${memberHints || '(none provided)'}

Decision description:
"""
${trimmed}
"""

Return JSON with this shape (omit fields you cannot confidently extract):
{
  "frameId": "hire" | "pick_tool" | "build" | "allocate" | "strategy" | "conflict",
  "confidence": "high" | "medium" | "low",
  "prefill": {
    // Hire fields:
    "roleTitle": string,
    "seniority": "junior" | "mid" | "senior" | "staff" | "lead",
    "whyNow": string,
    "mustHaves": string[],
    "niceToHaves": string[],
    "decideByDate": "YYYY-MM-DD",
    "stakeholders": string[],   // workspace member ids only

    // Pick a tool fields:
    "problem": string,
    "candidates": string[],
    "criteria": string[],
    "budgetCeiling": number,

    // Build fields:
    "whatBuilding": string,
    "forWhom": string,
    "hypothesis": string,
    "acceptanceSignal": string,
    "targetShipDate": "YYYY-MM-DD",

    // Allocate fields:
    "resourceType": "budget" | "time" | "headcount" | "seats" | "other",
    "resourceTypeOther": string,
    "totalAmount": string,
    "unit": string,
    "recipients": string[],

    // Strategy fields:
    "timeHorizon": "this_quarter" | "half" | "year" | "multi_year",
    "desiredOutcome": string,
    "currentBlockers": string[],
    "firstMove": string,

    // Conflict fields:
    "disagreement": string,
    "parties": string[],   // workspace member ids
    "partyPositions": [{ "partyId": "<workspace member id>", "position": "string" }]
  }
}

Only include fields relevant to the chosen frame. Be conservative: if a field is ambiguous, omit it rather than guessing.
Return ONLY valid JSON, no explanations.`,
      { workspaceId }
    );

    if (!result || !result.frameId || !isValidFrameId(result.frameId)) {
      return heuristicClassify(trimmed);
    }
    return {
      frameId: result.frameId,
      confidence: result.confidence ?? 'medium',
      prefill: result.prefill ?? {},
    };
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[decisionWizardAI:classifyAndPrefill] Falling back to heuristic', err);
    return heuristicClassify(trimmed);
  }
}

function isValidFrameId(s: string): s is FrameId {
  return ['hire', 'pick_tool', 'build', 'allocate', 'strategy', 'conflict'].includes(s);
}

/**
 * Keyword-based classifier used when AI is unavailable. Always returns a
 * result with low confidence so the UI can hint that the user might want
 * to override.
 */
function heuristicClassify(text: string): WizardAIResult {
  const t = text.toLowerCase();
  let frameId: FrameId = 'build';
  if (/\b(hire|recruit|candidate|role|applicant|interview|onboard)\b/.test(t)) {
    frameId = 'hire';
  } else if (/\b(tool|vendor|software|stack|platform|library|saas|provider)\b/.test(t)) {
    frameId = 'pick_tool';
  } else if (/\b(allocate|budget|distribute|divide|split|assign|seat|headcount)\b/.test(t)) {
    frameId = 'allocate';
  } else if (/\b(strategy|direction|plan|roadmap|vision|north star|quarter|q[1-4])\b/.test(t)) {
    frameId = 'strategy';
  } else if (/\b(conflict|disagree|argument|dispute|tension|resolve)\b/.test(t)) {
    frameId = 'conflict';
  }
  return {
    frameId,
    confidence: 'low',
    prefill: seedFromText(frameId, text),
  };
}

function seedFromText(frameId: FrameId, text: string): Record<string, unknown> {
  switch (frameId) {
    case 'hire':
      return { whyNow: text };
    case 'pick_tool':
      return { problem: text };
    case 'build':
      return { hypothesis: text };
    case 'strategy':
      return { desiredOutcome: text };
    case 'conflict':
      return { disagreement: text };
    case 'allocate':
    default:
      return {};
  }
}
