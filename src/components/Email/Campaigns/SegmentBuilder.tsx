// src/components/Email/Campaigns/SegmentBuilder.tsx
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  emailSegmentService,
  EmailSegment,
  SegmentInput,
  SegmentRule,
  SegmentRuleType,
} from '../../../services/emailSegmentService';
import { supabase } from '../../../services/supabase';

import { Loader2, Users, X } from 'lucide-react';

interface SegmentBuilderProps {
  segment?: EmailSegment | null; // null/undefined = new
  onSave: (segment: EmailSegment) => void;
  onClose: () => void;
}

const RULE_OPTIONS: {
  type: SegmentRuleType;
  label: string;
  hasValue: boolean;
  unit?: string;
  defaultValue?: number;
}[] = [
  { type: 'all',                       label: 'All Contacts',              hasValue: false },
  { type: 'last_contacted_days',       label: 'Active in last N days',     hasValue: true, unit: 'days', defaultValue: 30 },
  { type: 'relationship_strength_min', label: 'Relationship strength ≥ N', hasValue: true, unit: '', defaultValue: 75 },
  { type: 'is_important',              label: 'Marked Important',          hasValue: false },
];

export const SegmentBuilder: React.FC<SegmentBuilderProps> = ({ segment, onSave, onClose }) => {
  const [name, setName]         = useState(segment?.name ?? '');
  const [ruleType, setRuleType] = useState<SegmentRuleType>(
    segment?.filter_rules?.[0]?.type ?? 'all',
  );
  const [ruleValue, setRuleValue]     = useState<number>(
    segment?.filter_rules?.[0]?.value ?? 30,
  );
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing]   = useState(false);
  const [saving, setSaving]           = useState(false);

  const selectedOption = RULE_OPTIONS.find((o) => o.type === ruleType) ?? RULE_OPTIONS[0];

  const buildRules = (): SegmentRule[] => {
    if (!selectedOption.hasValue) return [{ type: ruleType }];
    return [{ type: ruleType, value: ruleValue }];
  };

  const runPreview = async () => {
    setPreviewing(true);
    setPreviewCount(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const emails = await emailSegmentService.applyRules(user.id, buildRules());
      setPreviewCount(emails.length);
    } catch (err) {
      console.warn('[SegmentBuilder] Preview failed:', err);
      setPreviewCount(null);
    } finally {
      setPreviewing(false);
    }
  };

  // Auto-preview when rule type or value changes
  useEffect(() => {
    void runPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleType, ruleValue]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Segment name is required'); return; }
    setSaving(true);
    try {
      const input: SegmentInput = { name: name.trim(), filter_rules: buildRules() };
      let result: EmailSegment;
      if (segment?.id) {
        result = await emailSegmentService.update(segment.id, input);
      } else {
        result = await emailSegmentService.create(input);
      }
      toast.success(`Segment "${result.name}" saved`);
      onSave(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save segment';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500/40';
  const labelClass =
    'block text-xs font-semibold text-stone-600 dark:text-zinc-300 mb-1.5 uppercase tracking-wide';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-stone-200 dark:border-zinc-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-stone-900 dark:text-white">
            {segment ? 'Edit Segment' : 'New Segment'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="text-sm" />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className={labelClass}>Segment Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hot Leads"
            className={inputClass}
          />
        </div>

        {/* Rule selector */}
        <div>
          <label className={labelClass}>Filter Rule</label>
          <select
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as SegmentRuleType)}
            className={inputClass}
          >
            {RULE_OPTIONS.map((o) => (
              <option key={o.type} value={o.type}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Threshold input (only when rule has a numeric value) */}
        {selectedOption.hasValue && (
          <div>
            <label className={labelClass}>
              Threshold {selectedOption.unit && `(${selectedOption.unit})`}
            </label>
            <input
              type="number"
              min={1}
              max={ruleType === 'relationship_strength_min' ? 100 : 365}
              value={ruleValue}
              onChange={(e) => setRuleValue(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        )}

        {/* Live preview count */}
        <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 dark:bg-zinc-800 rounded-xl">
          {previewing ? (
            <>
              <Loader2 className="animate-spin text-rose-500" />
              <span className="text-sm text-stone-500 dark:text-zinc-400">Calculating…</span>
            </>
          ) : (
            <>
              <Users className="text-rose-500" />
              <span className="text-sm font-medium text-stone-900 dark:text-white">
                {previewCount !== null ? `${previewCount} contacts match` : '— contacts match'}
              </span>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 hover:bg-stone-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-sm disabled:opacity-50 transition-opacity hover:opacity-90"
          >
            {saving ? <Loader2 className="animate-spin" /> : 'Save Segment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SegmentBuilder;
