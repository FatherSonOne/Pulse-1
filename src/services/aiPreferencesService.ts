/**
 * aiPreferencesService — per-user model preferences for the multi-provider
 * selector. Stored via `settingsService` so it syncs across devices.
 *
 * Three layers, resolved in order at invoke time:
 *   1. Inline override passed by the caller (e.g. "use Sonnet for THIS reply")
 *      → highest priority, never persisted.
 *   2. Per-task pin set by the user (e.g. "always use Haiku for email_reply")
 *      → optional, advanced users only.
 *   3. Quality dial — fast | balanced | quality | auto.
 *      → 'auto' (default) lets the router pick per-task as before.
 *      → other values bias the router to the matching tier when the task's
 *        own routing isn't more specific.
 *
 * The dial's tier-→-model resolution happens client-side, so the resulting
 * `modelOverride` is what's sent to the router. Server validates against
 * MODEL_ALLOWLIST regardless.
 */
import { settingsService } from './settingsService';
import type { AITask } from './ai/types';
import {
  AI_MODEL_CATALOG,
  TIER_DEFAULTS,
  findModel,
  type AIQualityTier,
  type AIModelInfo,
} from '../lib/aiModelCatalog';

export type QualityDial = 'auto' | AIQualityTier;

export interface AIPreferences {
  /** Top-level dial. 'auto' = follow router defaults. */
  dial: QualityDial;
  /** When dial=fast/balanced/premium, which model to use within that tier.
   *  Optional — if missing, falls back to TIER_DEFAULTS[tier]. */
  tierModels: Partial<Record<AIQualityTier, string>>;
  /** Per-task pins. Override everything else for that one task. */
  taskOverrides: Partial<Record<AITask, string>>;
}

const DEFAULTS: AIPreferences = {
  dial: 'auto',
  tierModels: {},
  taskOverrides: {},
};

const STORAGE_KEY = 'aiModelPreferences' as const;

class AIPreferencesService {
  private cache: AIPreferences | null = null;
  private listeners = new Set<(prefs: AIPreferences) => void>();

  async load(): Promise<AIPreferences> {
    if (this.cache) return this.cache;
    const stored = await settingsService.get(STORAGE_KEY) as Partial<AIPreferences> | null;
    this.cache = { ...DEFAULTS, ...(stored ?? {}) };
    return this.cache;
  }

  /** Synchronous accessor — returns cached prefs or defaults. Components
   *  that care about freshness should call `load()` once on mount. */
  current(): AIPreferences {
    return this.cache ?? DEFAULTS;
  }

  async save(prefs: AIPreferences): Promise<void> {
    this.cache = prefs;
    await settingsService.set(STORAGE_KEY, prefs);
    this.listeners.forEach(fn => fn(prefs));
  }

  async setDial(dial: QualityDial): Promise<void> {
    const prefs = await this.load();
    await this.save({ ...prefs, dial });
  }

  async setTierModel(tier: AIQualityTier, modelId: string | null): Promise<void> {
    const prefs = await this.load();
    const next = { ...prefs.tierModels };
    if (modelId) next[tier] = modelId;
    else delete next[tier];
    await this.save({ ...prefs, tierModels: next });
  }

  async pinTask(task: AITask, modelId: string | null): Promise<void> {
    const prefs = await this.load();
    const next = { ...prefs.taskOverrides };
    if (modelId) next[task] = modelId;
    else delete next[task];
    await this.save({ ...prefs, taskOverrides: next });
  }

  /** Resolve preferences to a concrete model id for a given task, or null
   *  to mean "let the router use its default". This is the function the
   *  invoke path calls before forwarding. */
  resolve(task: AITask): string | null {
    const prefs = this.current();
    // 1. Per-task pin wins.
    const pinned = prefs.taskOverrides[task];
    if (pinned && findModel(pinned)) return pinned;

    // 2. 'auto' dial → no override.
    if (prefs.dial === 'auto') return null;

    // 3. Tier-based resolution.
    const tier = prefs.dial;
    const userTierChoice = prefs.tierModels[tier];
    if (userTierChoice && findModel(userTierChoice)) return userTierChoice;
    return TIER_DEFAULTS[tier];
  }

  /** Helper: resolve to the full AIModelInfo, useful for badges/labels. */
  resolveModel(task: AITask): AIModelInfo | null {
    const id = this.resolve(task);
    return id ? findModel(id) : null;
  }

  subscribe(fn: (prefs: AIPreferences) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Reset everything to defaults (dial='auto', no overrides). */
  async reset(): Promise<void> {
    await this.save({ ...DEFAULTS });
  }
}

export const aiPreferencesService = new AIPreferencesService();
export default aiPreferencesService;

// Re-export model catalog so callers don't have to import twice.
export { AI_MODEL_CATALOG, findModel, TIER_DEFAULTS };
export type { AIModelInfo, AIQualityTier };
