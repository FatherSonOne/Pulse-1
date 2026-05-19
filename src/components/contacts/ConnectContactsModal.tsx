import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Loader2, UsersRound, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Contact } from '../../types';
import {
  googleContactsService,
  importSelectedLabels,
  ImportSelectedLabelsResult,
  WorkspaceNotBootstrappedError,
} from '../../services/googleContactsService';
import { showImportErrorToast } from '../../services/toastFactory';

interface ConnectContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportSelectedLabelsResult & { keptContactsForTrim?: Contact[] }) => void;
  workspaceId: string;
}

interface ContactGroup {
  id: string;
  name: string;
  memberCount: number;
}

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'summary',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const GroupCheckbox: React.FC<{
  checked: boolean;
  isPartial: boolean;
  ariaLabel: string;
  onChange: () => void;
}> = ({ checked, isPartial, ariaLabel, onChange }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = isPartial;
  }, [isPartial]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-checked={isPartial ? 'mixed' : checked}
      aria-label={ariaLabel}
      onChange={onChange}
      className="min-h-[44px] min-w-[44px] accent-[var(--pulse-rose)]"
    />
  );
};

export const ConnectContactsModal: React.FC<ConnectContactsModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  workspaceId,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoading(true);
    setSelectedLabelIds(new Set());
    setSelectedContactIds(new Set());

    Promise.all([
      googleContactsService.getContactGroups(),
      googleContactsService.getAllContacts(),
    ])
      .then(([nextGroups, nextContacts]) => {
        if (cancelled) return;
        setGroups(nextGroups);
        setContacts(nextContacts);
      })
      .catch(() => {
        if (!cancelled) showImportErrorToast(t('contacts.connectModal.error_generic'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      cancelled = true;
    };
  }, [isOpen, t]);

  const contactsByGroup = useMemo(() => {
    const map = new Map<string, Contact[]>();
    groups.forEach(group => map.set(group.id, []));
    contacts.forEach(contact => {
      contact.groups?.forEach(groupId => {
        if (!map.has(groupId)) map.set(groupId, []);
        map.get(groupId)?.push(contact);
      });
    });
    return map;
  }, [contacts, groups]);

  const orphanContacts = useMemo(
    () => contacts.filter(contact => !contact.groups || contact.groups.length === 0),
    [contacts]
  );

  const selectedCount = selectedContactIds.size;
  const selectedContactsForTrim = useMemo(
    () => contacts.filter(contact => selectedContactIds.has(contact.id)),
    [contacts, selectedContactIds]
  );

  const updateLabelsFromContacts = (nextSelectedContacts: Set<string>, baseLabels: Set<string>) => {
    groups.forEach(group => {
      const groupContacts = contactsByGroup.get(group.id) ?? [];
      if (groupContacts.length > 0 && groupContacts.some(contact => nextSelectedContacts.has(contact.id))) {
        baseLabels.add(group.id);
      } else if (groupContacts.length > 0) {
        baseLabels.delete(group.id);
      }
    });
  };

  const toggleGroup = (group: ContactGroup) => {
    const groupContacts = contactsByGroup.get(group.id) ?? [];
    const isAllChecked = groupContacts.length > 0 && groupContacts.every(contact => selectedContactIds.has(contact.id));

    setSelectedContactIds(prev => {
      const next = new Set(prev);
      groupContacts.forEach(contact => {
        if (isAllChecked) next.delete(contact.id);
        else next.add(contact.id);
      });
      return next;
    });
    setSelectedLabelIds(prev => {
      const next = new Set(prev);
      if (isAllChecked) next.delete(group.id);
      else next.add(group.id);
      return next;
    });
  };

  const toggleContact = (contact: Contact) => {
    const nextContacts = new Set(selectedContactIds);
    if (nextContacts.has(contact.id)) nextContacts.delete(contact.id);
    else nextContacts.add(contact.id);

    const nextLabels = new Set(selectedLabelIds);
    updateLabelsFromContacts(nextContacts, nextLabels);
    setSelectedContactIds(nextContacts);
    setSelectedLabelIds(nextLabels);
  };

  const toggleOrphans = () => {
    const allChecked = orphanContacts.length > 0 && orphanContacts.every(contact => selectedContactIds.has(contact.id));
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      orphanContacts.forEach(contact => {
        if (allChecked) next.delete(contact.id);
        else next.add(contact.id);
      });
      return next;
    });
  };

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

  const handleImport = async () => {
    if (selectedLabelIds.size === 0) return;
    setIsImporting(true);
    try {
      const result = await importSelectedLabels(Array.from(selectedLabelIds), workspaceId);
      onImportComplete({ ...result, keptContactsForTrim: selectedContactsForTrim });
    } catch (error) {
      if (error instanceof WorkspaceNotBootstrappedError) {
        showImportErrorToast(t('contacts.connectModal.error_workspace_not_ready'));
      } else {
        showImportErrorToast(t('contacts.connectModal.error_generic'));
      }
    } finally {
      setIsImporting(false);
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
            aria-labelledby="connect-contacts-title"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="w-full max-w-2xl max-h-[88vh] rounded-xl border overflow-hidden flex flex-col"
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
                <UsersRound className="w-5 h-5" style={{ color: 'var(--pulse-rose)' }} aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h2 id="connect-contacts-title" className="text-xl font-semibold">
                  {t('contacts.connectModal.headline')}
                </h2>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--pulse-ink-2)' }}>
                  {t('contacts.connectModal.body')}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center"
                style={{ color: 'var(--pulse-ink-2)' }}
                aria-label={t('contacts.connectModal.cta_secondary')}
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: 'var(--pulse-canvas)' }}>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[60px] rounded-lg animate-pulse"
                    style={{ background: 'var(--pulse-surface-raised)' }}
                  />
                ))
              ) : (
                groups.map(group => {
                  const groupContacts = contactsByGroup.get(group.id) ?? [];
                  const checkedCount = groupContacts.filter(contact => selectedContactIds.has(contact.id)).length;
                  const isAllChecked = groupContacts.length > 0 && checkedCount === groupContacts.length;
                  const isPartial = checkedCount > 0 && checkedCount < groupContacts.length;

                  return (
                    <details
                      key={group.id}
                      className="rounded-lg border"
                      style={{ background: 'var(--pulse-surface)', borderColor: 'var(--pulse-border)' }}
                    >
                      <summary className="min-h-[44px] flex items-center gap-3 px-3 cursor-pointer list-none">
                        <ChevronDown className="w-4 h-4" aria-hidden="true" style={{ color: 'var(--pulse-ink-3)' }} />
                        <GroupCheckbox
                          checked={isAllChecked}
                          isPartial={isPartial}
                          ariaLabel={t('contacts.connectModal.select_all_in_group', { group: group.name })}
                          onChange={() => toggleGroup(group)}
                        />
                        <span className="flex-1 text-sm font-medium">
                          {group.name || t('contacts.connectModal.group_label_unlabeled')} ({group.memberCount})
                        </span>
                      </summary>
                      <div className="border-t px-3 py-2 space-y-1" style={{ borderColor: 'var(--pulse-border)' }}>
                        {groupContacts.map(contact => (
                          <label key={contact.id} className="min-h-[44px] flex items-center gap-3 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedContactIds.has(contact.id)}
                              onChange={() => toggleContact(contact)}
                              aria-label={t('contacts.connectModal.select_contact', { name: contact.name })}
                              className="min-h-[44px] min-w-[44px] accent-[var(--pulse-rose)]"
                            />
                            <span className="font-medium">{contact.name}</span>
                            <span className="truncate" style={{ color: 'var(--pulse-ink-3)' }}>{contact.email}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  );
                })
              )}
            </div>

            <div className="border-t p-4 space-y-4" style={{ borderColor: 'var(--pulse-border)' }}>
              <label className="min-h-[44px] flex items-center gap-3 rounded-lg border px-3" style={{ borderColor: 'var(--pulse-border)' }}>
                <input
                  type="checkbox"
                  checked={orphanContacts.length > 0 && orphanContacts.every(contact => selectedContactIds.has(contact.id))}
                  onChange={toggleOrphans}
                  className="min-h-[44px] min-w-[44px] accent-[var(--pulse-rose)]"
                />
                <span className="text-sm font-medium">{t('contacts.connectModal.orphan_bucket_label')}</span>
                <em className="text-xs not-italic" style={{ color: 'var(--pulse-ink-3)' }}>
                  {t('contacts.connectModal.orphan_bucket_default_off_note')}
                </em>
              </label>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div aria-live="polite" className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
                  {t('contacts.connectModal.selected_count', { count: selectedCount })}
                </div>
                <div className="flex flex-col md:flex-row gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] px-4 py-2 rounded-lg font-semibold"
                    style={{ color: 'var(--pulse-ink-2)', border: '1px solid var(--pulse-border)' }}
                  >
                    {t('contacts.connectModal.cta_secondary')}
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={selectedLabelIds.size === 0 || isImporting}
                    className="min-h-[44px] px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background: 'var(--pulse-rose)' }}
                  >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
                    {t('contacts.connectModal.cta_primary', { count: selectedCount })}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConnectContactsModal;
