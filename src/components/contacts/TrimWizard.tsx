import React, { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, Scissors, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { List } from 'react-window';
import { useTranslation } from 'react-i18next';
import { Contact } from '../../types';
import { supabase } from '../../services/supabase';

interface TrimWizardProps {
  isOpen: boolean;
  importedContacts: Contact[];
  workspaceId: string;
  onComplete: () => void;
  onClose: () => void;
}

interface TrimRowProps {
  contacts: Contact[];
  keptIds: Set<string>;
  toggleContact: (id: string) => void;
  rowSkipLabel: (name: string) => string;
  keepLabel: string;
}

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const externalIdForContact = (contact: Contact): string => contact.id.replace(/^google_/, '');

const avatarStyleFor = (contact: Contact): CSSProperties | undefined => {
  if (!contact.avatarColor || contact.avatarColor.startsWith('bg-')) return undefined;
  return { background: contact.avatarColor };
};

const TrimRow: React.FC<{
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
  index: number;
  style: CSSProperties;
} & TrimRowProps> = ({
  ariaAttributes,
  index,
  style,
  contacts,
  keptIds,
  toggleContact,
  rowSkipLabel,
  keepLabel,
}) => {
  const contact = contacts[index];
  const isKept = keptIds.has(contact.id);
  const avatarClass = contact.avatarColor?.startsWith('bg-') ? contact.avatarColor : '';

  return (
    <div
      {...ariaAttributes}
      style={style}
      className="px-3"
    >
      <div
        className={`h-[56px] rounded-lg border flex items-center gap-3 px-3 transition-opacity ${isKept ? '' : 'opacity-50'}`}
        style={{
          background: isKept ? 'var(--pulse-surface)' : 'var(--pulse-tone-overdue-soft)',
          borderColor: isKept ? 'var(--pulse-border)' : 'var(--pulse-tone-overdue)',
        }}
      >
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold ${avatarClass}`}
          style={avatarStyleFor(contact) ?? { background: 'var(--pulse-rose)' }}
        >
          {contact.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold truncate ${isKept ? '' : 'line-through'}`} style={{ color: 'var(--pulse-ink)' }}>
            {contact.name}
          </div>
          <div className="text-xs truncate" style={{ color: 'var(--pulse-ink-3)' }}>
            {contact.email}
          </div>
        </div>
        {contact.groups?.[0] && (
          <span className="hidden sm:inline-flex rounded-full px-2 py-1 text-xs" style={{ background: 'var(--pulse-rose-softer)', color: 'var(--pulse-ink-2)' }}>
            {contact.groups[0]}
          </span>
        )}
        <label className="min-h-[44px] flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--pulse-ink-2)' }}>
          <input
            type="checkbox"
            checked={isKept}
            onChange={() => toggleContact(contact.id)}
            aria-label={rowSkipLabel(contact.name)}
            className="min-h-[44px] min-w-[44px] accent-[var(--pulse-rose)]"
          />
          {keepLabel}
        </label>
      </div>
    </div>
  );
};

export const TrimWizard: React.FC<TrimWizardProps> = ({
  isOpen,
  importedContacts,
  workspaceId,
  onComplete,
  onClose,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const [keptIds, setKeptIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const invertedDefault = importedContacts.length > 200;

  useEffect(() => {
    if (!isOpen) return;
    setKeptIds(new Set(invertedDefault ? [] : importedContacts.map(contact => contact.id)));
    window.setTimeout(() => firstButtonRef.current?.focus(), 0);
  }, [importedContacts, invertedDefault, isOpen]);

  const skippedContacts = useMemo(
    () => importedContacts.filter(contact => !keptIds.has(contact.id)),
    [importedContacts, keptIds]
  );
  const keptCount = keptIds.size;
  const skippedCount = skippedContacts.length;

  const rowProps = useMemo<TrimRowProps>(() => ({
    contacts: importedContacts,
    keptIds,
    toggleContact: (id: string) => {
      setKeptIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    rowSkipLabel: (name: string) => t('contacts.trimWizard.row_skip_aria', { name }),
    keepLabel: t('contacts.trimWizard.keep_label'),
  }), [importedContacts, keptIds, t]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onClose();
      return;
    }

    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleConfirm = async () => {
    if (skippedCount > 50 && !window.confirm(t('contacts.trimWizard.skip_confirm', { count: skippedCount }))) {
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Missing authenticated user');

      const googleExternalIds = skippedContacts
        .filter(contact => contact.source === 'google' || contact.id.startsWith('google_'))
        .map(externalIdForContact);
      const directIds = skippedContacts
        .filter(contact => contact.source !== 'google' && !contact.id.startsWith('google_'))
        .map(contact => contact.id);

      if (googleExternalIds.length > 0) {
        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('user_id', user.id)
          .eq('platform', 'google')
          .in('external_id', googleExternalIds);
        if (error) throw error;
      }

      if (directIds.length > 0) {
        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('user_id', user.id)
          .in('id', directIds);
        if (error) throw error;
      }

      const skippedIds = new Set(skippedContacts.map(contact => contact.id));
      const contactsByLabel = new Map<string, Contact[]>();
      importedContacts.forEach(contact => {
        contact.groups?.forEach(labelId => {
          if (!contactsByLabel.has(labelId)) contactsByLabel.set(labelId, []);
          contactsByLabel.get(labelId)?.push(contact);
        });
      });

      const rejectedRows = Array.from(contactsByLabel.entries())
        .filter(([, labelContacts]) => labelContacts.length > 0 && labelContacts.every(contact => skippedIds.has(contact.id)))
        .map(([labelId]) => ({
          user_id: user.id,
          workspace_id: workspaceId,
          source: 'google',
          label_id: labelId,
          label_display: null,
        }));

      if (rejectedRows.length > 0) {
        const { error } = await supabase
          .from('rejected_import_labels')
          .upsert(rejectedRows, { onConflict: 'user_id,workspace_id,source,label_id' });
        if (error) throw error;
      }

      toast.success(t('contacts.trimWizard.trim_complete_toast', { kept: keptCount, skipped: skippedCount }));
      onComplete();
    } catch (error) {
      console.error('[TrimWizard] Failed to trim contacts:', error);
      toast.error(t('contacts.trimWizard.trim_error_toast'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trim-wizard-title"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="w-full max-w-3xl max-h-[90vh] rounded-xl border overflow-hidden flex flex-col"
            style={{
              background: 'var(--pulse-surface)',
              borderColor: 'var(--pulse-border)',
              boxShadow: 'var(--pulse-shadow-md)',
              color: 'var(--pulse-ink)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="p-5 border-b flex items-start gap-4" style={{ borderColor: 'var(--pulse-border)' }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'var(--pulse-rose-soft)' }}>
                <Scissors className="w-5 h-5" style={{ color: 'var(--pulse-rose)' }} aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h2 id="trim-wizard-title" className="text-xl font-semibold">{t('contacts.trimWizard.headline')}</h2>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--pulse-ink-2)' }}>
                  {t('contacts.trimWizard.body', { count: importedContacts.length })}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center"
                style={{ color: 'var(--pulse-ink-2)' }}
                aria-label={t('contacts.trimWizard.cta_secondary')}
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </header>

            <div className="p-4 space-y-4" style={{ background: 'var(--pulse-canvas)' }}>
              <div
                role="alert"
                className="rounded-lg border p-3 text-sm font-semibold"
                style={{
                  borderColor: invertedDefault ? 'var(--pulse-tone-warning)' : 'var(--pulse-rose)',
                  background: invertedDefault ? 'var(--pulse-tone-warning-soft)' : 'var(--pulse-rose-soft)',
                  color: 'var(--pulse-ink)',
                }}
              >
                {t(invertedDefault ? 'contacts.trimWizard.inverted_default_banner' : 'contacts.trimWizard.default_keep_banner')}
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div aria-live="polite" className="text-sm font-medium" style={{ color: 'var(--pulse-ink-2)' }}>
                  {t('contacts.trimWizard.counter', { kept: keptCount, skipped: skippedCount })}
                </div>
                <div className="flex gap-2">
                  <button
                    ref={firstButtonRef}
                    type="button"
                    onClick={() => setKeptIds(new Set(importedContacts.map(contact => contact.id)))}
                    className="min-h-[44px] px-4 py-2 rounded-lg font-semibold"
                    style={{ background: 'var(--pulse-rose-soft)', color: 'var(--pulse-ink)' }}
                  >
                    {t('contacts.trimWizard.check_all')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeptIds(new Set())}
                    className="min-h-[44px] px-4 py-2 rounded-lg font-semibold"
                    style={{
                      background: importedContacts.length >= 50 ? 'var(--pulse-tone-overdue-soft)' : 'var(--pulse-surface)',
                      border: '1px solid var(--pulse-border)',
                      color: importedContacts.length >= 50 ? 'var(--pulse-tone-overdue)' : 'var(--pulse-ink-2)',
                    }}
                  >
                    {t('contacts.trimWizard.uncheck_all')}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-[260px] p-1" style={{ background: 'var(--pulse-canvas)' }}>
              <List
                rowComponent={TrimRow}
                rowCount={importedContacts.length}
                rowHeight={64}
                rowProps={rowProps}
                overscanCount={6}
                style={{ height: 'min(48vh, 420px)', touchAction: 'pan-y' }}
              />
            </div>

            <footer className="border-t p-4 flex flex-col md:flex-row md:justify-end gap-2" style={{ borderColor: 'var(--pulse-border)' }}>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-lg font-semibold"
                style={{ color: 'var(--pulse-ink-2)', border: '1px solid var(--pulse-border)' }}
              >
                {t('contacts.trimWizard.cta_secondary')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSaving}
                className="min-h-[44px] px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: 'var(--pulse-rose)' }}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
                {t('contacts.trimWizard.cta_primary', { count: keptCount })}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TrimWizard;
