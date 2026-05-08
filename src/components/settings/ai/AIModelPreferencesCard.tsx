/**
 * AIModelPreferencesCard
 *
 * Per-user AI model selector — the differentiator surface for the
 * multi-provider router. Lets users:
 *   1. Pick a quality dial: Auto (smart routing) / Fast / Balanced / Quality
 *   2. When the dial is set, optionally pick a specific model within that tier
 *   3. Reset to defaults
 *
 * Power-user per-task pinning is intentionally NOT exposed here — it's
 * available via `aiPreferencesService.pinTask()` for future inline UIs.
 *
 * Lives next to `<AIProvidersCard>` in AIIntelligenceSettings — providers
 * card controls *which* providers are reachable; this card controls *how
 * smart vs. fast* the user wants the model to be when many are available.
 */
import React, { useEffect, useState } from 'react';
import { Sparkles, Zap, Scale, Gem, Loader2, RotateCcw, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  aiPreferencesService,
  AI_MODEL_CATALOG,
  type AIPreferences,
  type QualityDial,
} from '../../../services/aiPreferencesService';
import {
  modelsForTier,
  TIER_DEFAULTS,
  type AIQualityTier,
  type AIModelInfo,
} from '../../../lib/aiModelCatalog';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';

// Type-guard to keep the icon map exhaustive at compile time without a
// runtime assertion.
type DialOption = {
  key: QualityDial;
  label: string;
  tagline: string;
  icon: React.ReactNode;
};

const DIAL_OPTIONS: DialOption[] = [
  {
    key: 'auto',
    label: 'Auto (recommended)',
    tagline: 'Pulse picks the right model per task — fast for triage, smart for synthesis.',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    key: 'fast',
    label: 'Fast',
    tagline: 'Lowest latency. Best for short replies, classification, web search.',
    icon: <Zap className="w-4 h-4" />,
  },
  {
    key: 'balanced',
    label: 'Balanced',
    tagline: 'Snappy but conversational. Good for drafts and chat.',
    icon: <Scale className="w-4 h-4" />,
  },
  {
    key: 'premium',
    label: 'Quality',
    tagline: 'Slower but smarter — favours deeper reasoning models.',
    icon: <Gem className="w-4 h-4" />,
  },
];

export const AIModelPreferencesCard: React.FC = () => {
  const [prefs, setPrefs] = useState<AIPreferences | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await aiPreferencesService.load();
      if (!cancelled) setPrefs(loaded);
    })();
    const unsub = aiPreferencesService.subscribe((p) => setPrefs(p));
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (!prefs) {
    return (
      <SettingsCard>
        <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
      </SettingsCard>
    );
  }

  const handleDialChange = async (dial: QualityDial) => {
    setBusy(true);
    try {
      await aiPreferencesService.setDial(dial);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save preference');
    } finally {
      setBusy(false);
    }
  };

  const handleTierModelChange = async (tier: AIQualityTier, modelId: string) => {
    setBusy(true);
    try {
      await aiPreferencesService.setTierModel(tier, modelId);
      toast.success(`Set ${modelId} for ${tier}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save preference');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset AI model preferences to defaults?')) return;
    setBusy(true);
    try {
      await aiPreferencesService.reset();
      toast.success('Preferences reset');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setBusy(false);
    }
  };

  const isDirty = prefs.dial !== 'auto' || Object.keys(prefs.tierModels).length > 0;
  const activeTier: AIQualityTier | null = prefs.dial === 'auto' ? null : prefs.dial;
  const tierModels = activeTier ? modelsForTier(activeTier) : [];
  const selectedTierModel = activeTier
    ? (prefs.tierModels[activeTier] ?? TIER_DEFAULTS[activeTier])
    : null;

  return (
    <SettingsCard className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-rose-500" />
          <MonoLabel>Model preferences</MonoLabel>
        </div>
        {isDirty && (
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition disabled:opacity-50"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Pulse routes each AI task to the right model automatically. Override that bias here — pick a
        speed-vs-quality tier, or a specific model.
      </p>

      {/* Quality dial */}
      <div className="space-y-2">
        {DIAL_OPTIONS.map((opt) => {
          const selected = prefs.dial === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleDialChange(opt.key)}
              disabled={busy}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border transition text-left disabled:opacity-50 ${
                selected
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${
                  selected
                    ? 'bg-rose-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{opt.label}</p>
                  {selected && (
                    <Check className="w-3.5 h-3.5 text-rose-500" />
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{opt.tagline}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tier model picker — only shown when a non-auto tier is selected */}
      {activeTier && tierModels.length > 1 && (
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Choose your {activeTier} model
          </p>
          <div className="space-y-1.5">
            {tierModels.map((m) => (
              <ModelOption
                key={m.id}
                model={m}
                selected={selectedTierModel === m.id}
                onSelect={() => handleTierModelChange(activeTier, m.id)}
                disabled={busy}
              />
            ))}
          </div>
        </div>
      )}

      {/* Catalog preview — handy for power users to see what's available */}
      <details className="pt-2">
        <summary className="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer select-none">
          See all available models
        </summary>
        <div className="mt-2 space-y-1.5">
          {AI_MODEL_CATALOG.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded text-xs"
            >
              <div className="min-w-0">
                <span className="font-medium text-zinc-900 dark:text-white">{m.label}</span>
                <span className="text-zinc-400 dark:text-zinc-500 ml-2">{m.tagline}</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider flex-shrink-0">
                {m.tier}
              </span>
            </div>
          ))}
        </div>
      </details>
    </SettingsCard>
  );
};

// ── Single model row in the tier picker ──────────────────────────

interface ModelOptionProps {
  model: AIModelInfo;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}

const ModelOption: React.FC<ModelOptionProps> = ({ model, selected, onSelect, disabled }) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={disabled}
    className={`w-full flex items-start gap-3 p-2.5 rounded-md border transition text-left disabled:opacity-50 ${
      selected
        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-900/10'
        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
    }`}
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">{model.label}</p>
        {selected && <Check className="w-3 h-3 text-rose-500" />}
        <span className="ml-auto text-[10px] text-zinc-500 dark:text-zinc-400">
          {'·'.repeat(model.relativeCost)} cost
        </span>
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{model.tagline}</p>
    </div>
  </button>
);

export default AIModelPreferencesCard;
