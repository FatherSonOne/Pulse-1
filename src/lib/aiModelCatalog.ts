/**
 * AI Model Catalog — single source of truth for the multi-provider selector.
 *
 * The ai-router edge function still owns the *default* routing per task
 * (see `supabase/functions/ai-router/tasks.ts`). This catalog drives the
 * UI selector and the override allowlist that the router validates against.
 *
 * Each entry describes:
 *   - provider/model identifiers passed straight through to the provider SDK
 *   - tier classification (fast / balanced / premium) for the quality dial
 *   - human-friendly label + tagline + relative-cost hint shown in the picker
 *   - capabilities so the UI can grey out options that don't fit the task
 *     (e.g. webSearch only on Gemini)
 *
 * Adding a model: append an entry here, mirror the id in the router's
 * `MODEL_ALLOWLIST` (server-side check), and you're done.
 */
export type AIProvider = 'gemini' | 'claude';
export type AIQualityTier = 'fast' | 'balanced' | 'premium';

export interface AIModelInfo {
  /** Stable string id used as the override key. */
  id: string;
  provider: AIProvider;
  /** Provider-specific model id passed to the API. */
  model: string;
  label: string;
  /** One-line tagline shown beneath the label in pickers. */
  tagline: string;
  tier: AIQualityTier;
  /** Relative cost vs the cheapest tier (1 = cheapest). */
  relativeCost: 1 | 2 | 4 | 8;
  /** Approximate output speed (1 = fastest). */
  speed: 1 | 2 | 3;
  /** Capability flags so the UI can filter inappropriate choices. */
  supports: {
    webSearch: boolean;
    promptCaching: boolean;
    /** Json mode via native API (Claude relies on prompt instruction). */
    nativeJsonMode: boolean;
  };
}

export const AI_MODEL_CATALOG: AIModelInfo[] = [
  // ── Fast tier ──────────────────────────────────────────────────
  {
    id: 'gemini-flash',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    tagline: 'Fastest. Best for bulk classification, short summaries, web search.',
    tier: 'fast',
    relativeCost: 1,
    speed: 1,
    supports: { webSearch: true, promptCaching: false, nativeJsonMode: true },
  },
  {
    id: 'claude-haiku',
    provider: 'claude',
    model: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    tagline: 'Fast and conversational. Great for chat replies, drafts, calendar prep.',
    tier: 'fast',
    relativeCost: 2,
    speed: 1,
    supports: { webSearch: false, promptCaching: true, nativeJsonMode: false },
  },
  // ── Balanced tier ──────────────────────────────────────────────
  {
    id: 'claude-sonnet',
    provider: 'claude',
    model: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    tagline: 'Balanced reasoning for synthesis, RAG, doc compare.',
    tier: 'balanced',
    relativeCost: 4,
    speed: 2,
    supports: { webSearch: false, promptCaching: true, nativeJsonMode: false },
  },
  // ── Premium tier ───────────────────────────────────────────────
  // Reserved for opt-in upgrade. Adding entries here only requires
  // mirroring the model id in the router allowlist.
];

export function findModel(id: string): AIModelInfo | null {
  return AI_MODEL_CATALOG.find(m => m.id === id) ?? null;
}

export function modelsForTier(tier: AIQualityTier): AIModelInfo[] {
  return AI_MODEL_CATALOG.filter(m => m.tier === tier);
}

/** Models compatible with the given task family. Used to filter inline
 *  ad-hoc selectors so users can't pick (say) Claude for a `web_search`. */
export function modelsForCapability(
  caps: Partial<AIModelInfo['supports']>,
): AIModelInfo[] {
  return AI_MODEL_CATALOG.filter(m =>
    Object.entries(caps).every(
      ([k, required]) => !required || m.supports[k as keyof AIModelInfo['supports']],
    ),
  );
}

/** Default model id per tier — used when the user has set a tier preference
 *  but no specific model. */
export const TIER_DEFAULTS: Record<AIQualityTier, string> = {
  fast: 'gemini-flash',
  balanced: 'claude-haiku',
  premium: 'claude-sonnet',
};
