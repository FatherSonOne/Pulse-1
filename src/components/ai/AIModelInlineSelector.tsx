/**
 * AIModelInlineSelector
 *
 * Drop-in popover that lets the user pick a one-shot model override for a
 * specific AI call. Used next to "Generate", "Smart reply", "Summarize"
 * buttons across Pulse so a user can say "this one with Sonnet" without
 * touching their saved preferences.
 *
 * Usage:
 *   <AIModelInlineSelector
 *     task="email_draft"
 *     value={overrideId}
 *     onChange={setOverrideId}
 *     compact
 *   />
 *
 * The selected id is meant to be passed straight into `useAI().invoke(task, params, { modelOverride })`.
 * Pass `null` to mean "use my saved preference (or auto)".
 *
 * The component filters models by capability — for `web_search`, only
 * Gemini is shown; for everything else the whole catalog is offered.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Sparkles, Check } from 'lucide-react';
import { AI_MODEL_CATALOG, findModel } from '../../lib/aiModelCatalog';
import type { AITask } from '../../services/ai/types';
import { aiPreferencesService } from '../../services/aiPreferencesService';

interface AIModelInlineSelectorProps {
  task: AITask;
  /** Currently selected override id, or null = use saved preference. */
  value: string | null;
  onChange: (modelId: string | null) => void;
  /** Compact mode shows just the badge + chevron, no label. */
  compact?: boolean;
  className?: string;
}

export const AIModelInlineSelector: React.FC<AIModelInlineSelectorProps> = ({
  task,
  value,
  onChange,
  compact = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const t = window.setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  const availableModels = AI_MODEL_CATALOG.filter((m) =>
    task === 'web_search' ? m.supports.webSearch : true,
  );

  const explicit = value ? findModel(value) : null;
  const resolvedFromPrefs = !explicit ? aiPreferencesService.resolveModel(task) : null;
  const displayed = explicit ?? resolvedFromPrefs;
  const labelText = displayed ? displayed.label : 'Auto';
  const isOverride = !!explicit;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-md transition ${
          compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
        } ${
          isOverride
            ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
        }`}
        title={isOverride ? `Override: ${labelText}` : `Auto (${labelText})`}
        aria-expanded={open}
      >
        <Sparkles className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        <span className="font-medium">{labelText}</span>
        <ChevronDown className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden"
          role="listbox"
        >
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Use for this {task.replaceAll('_', ' ')}
            </p>
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {/* Auto option — clears the inline override */}
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition ${
                  !isOverride ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''
                }`}
                role="option"
                aria-selected={!isOverride}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      Auto (use my preferences)
                    </p>
                    {resolvedFromPrefs && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Resolves to {resolvedFromPrefs.label}
                      </p>
                    )}
                  </div>
                  {!isOverride && <Check className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />}
                </div>
              </button>
            </li>
            <li className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
            {availableModels.map((m) => {
              const selected = explicit?.id === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition ${
                      selected ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''
                    }`}
                    role="option"
                    aria-selected={selected}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{m.label}</p>
                          <span className="text-[9px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {m.tier}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                          {m.tagline}
                        </p>
                      </div>
                      {selected && <Check className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AIModelInlineSelector;
