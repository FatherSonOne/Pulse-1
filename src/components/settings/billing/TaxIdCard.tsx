import React, { useState, useEffect } from 'react';
import { Receipt, Loader2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspaceData, useWorkspaceActions } from '../../../contexts/WorkspaceContext';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';

const TAX_ID_TYPES: { value: string; label: string; example: string }[] = [
  { value: 'us_ein',     label: 'United States — EIN',           example: '12-3456789' },
  { value: 'eu_vat',     label: 'European Union — VAT',          example: 'DE123456789' },
  { value: 'gb_vat',     label: 'United Kingdom — VAT',          example: 'GB123456789' },
  { value: 'ca_bn',      label: 'Canada — BN',                   example: '123456789RC0001' },
  { value: 'ca_gst_hst', label: 'Canada — GST / HST',            example: '123456789RT0001' },
  { value: 'au_abn',     label: 'Australia — ABN',               example: '12 345 678 901' },
  { value: 'au_arn',     label: 'Australia — ARN',               example: '123456789012' },
  { value: 'sg_uen',     label: 'Singapore — UEN',               example: '202123456A' },
  { value: 'in_gst',     label: 'India — GST',                   example: '12ABCDE3456F7Z8' },
  { value: 'jp_cn',      label: 'Japan — Corporate Number',      example: '1234567891011' },
  { value: 'jp_rn',      label: 'Japan — Registered Foreign Businesses', example: '12345' },
  { value: 'br_cnpj',    label: 'Brazil — CNPJ',                 example: '12.345.678/0001-90' },
  { value: 'br_cpf',     label: 'Brazil — CPF',                  example: '123.456.789-00' },
  { value: 'mx_rfc',     label: 'Mexico — RFC',                  example: 'ABC010101AAA' },
  { value: 'za_vat',     label: 'South Africa — VAT',            example: '4123456789' },
  { value: 'ch_vat',     label: 'Switzerland — VAT',             example: 'CHE-123.456.789 MWST' },
  { value: 'no_vat',     label: 'Norway — VAT',                  example: '123456789MVA' },
  { value: 'nz_gst',     label: 'New Zealand — GST',             example: '123-456-789' },
  { value: 'kr_brn',     label: 'South Korea — BRN',             example: '123-45-67890' },
  { value: 'tw_vat',     label: 'Taiwan — VAT',                  example: '12345678' },
  { value: 'ae_trn',     label: 'UAE — TRN',                     example: '123456789012345' },
  { value: 'sa_vat',     label: 'Saudi Arabia — VAT',            example: '123456789012345' },
  { value: 'th_vat',     label: 'Thailand — VAT',                example: '1234567891234' },
  { value: 'other',      label: 'Other / Custom',                example: '' },
];

export const TaxIdCard: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const { updateWorkspace } = useWorkspaceActions();

  const [type, setType]   = useState<string>(currentWorkspace?.tax_id_type ?? '');
  const [value, setValue] = useState<string>(currentWorkspace?.tax_id_value ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    setType(currentWorkspace.tax_id_type ?? '');
    setValue(currentWorkspace.tax_id_value ?? '');
  }, [currentWorkspace?.id, currentWorkspace?.tax_id_type, currentWorkspace?.tax_id_value]);

  if (!currentWorkspace) return null;

  const dirty =
    type  !== (currentWorkspace.tax_id_type  ?? '') ||
    value !== (currentWorkspace.tax_id_value ?? '');

  const handleSave = async () => {
    const v = value.trim();
    const t = type.trim();

    // Both empty → clear it.
    if (!t && !v) {
      setIsSaving(true);
      try {
        await updateWorkspace(currentWorkspace.id, { tax_id_type: null, tax_id_value: null });
        toast.success('Tax ID removed');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update tax ID';
        toast.error(msg);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!t || !v) {
      toast.error('Pick a tax ID type and enter a value');
      return;
    }
    if (v.length < 4 || v.length > 64) {
      toast.error('Tax ID must be 4–64 characters');
      return;
    }

    setIsSaving(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        tax_id_type:  t,
        tax_id_value: v,
      });
      toast.success('Tax ID saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update tax ID';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const example = TAX_ID_TYPES.find(o => o.value === type)?.example;

  return (
    <SettingsCard className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="w-4 h-4 text-zinc-500" />
        <MonoLabel>Tax ID</MonoLabel>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Optional. Appears on invoices and exports we generate. The canonical record lives in your Stripe
        customer; for VAT-compliance changes use the Customer Portal so Stripe re-validates.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="tax-id-type" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
            Type
          </label>
          <select
            id="tax-id-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          >
            <option value="">— None —</option>
            {TAX_ID_TYPES.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tax-id-value" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
            Number
          </label>
          <input
            id="tax-id-value"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={example || ''}
            spellCheck={false}
            autoComplete="off"
            className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
          {example && (
            <p className="text-[10px] text-zinc-400 mt-1">Example: <code className="font-mono">{example}</code></p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-zinc-400 inline-flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />
          Manage canonical Stripe record from the Customer Portal
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !dirty}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Tax ID'}
        </button>
      </div>
    </SettingsCard>
  );
};
