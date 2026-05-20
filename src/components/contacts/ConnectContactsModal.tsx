import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, Search, ShieldAlert, UsersRound, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Contact, ContactType } from '../../types';
import {
  googleContactsService,
  importSelectedContacts,
  ImportSelectedLabelsResult,
  WorkspaceNotBootstrappedError,
} from '../../services/googleContactsService';
import { showImportErrorToast } from '../../services/toastFactory';

interface ConnectContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportSelectedLabelsResult & { keptContactsForTrim?: Contact[] }) => void;
  workspaceId: string;
  workspaceName?: string;
}

interface ContactGroup {
  id: string;
  name: string;
  memberCount: number;
}

type Step = 'stage' | 'tag' | 'confirm';

interface CategoryOption {
  value: ContactType;
  labelKey: string;
}

const CATEGORIES: CategoryOption[] = [
  { value: 'team', labelKey: 'category_team' },
  { value: 'client', labelKey: 'category_client' },
  { value: 'lead', labelKey: 'category_lead' },
  { value: 'partner', labelKey: 'category_partner' },
  { value: 'vendor', labelKey: 'category_vendor' },
  { value: 'volunteer', labelKey: 'category_volunteer' },
  { value: 'network', labelKey: 'category_network' },
  { value: 'other', labelKey: 'category_other' },
];

const DEFAULT_CATEGORY: ContactType = 'network';
const ORPHAN_GROUP_ID = '__orphan__';

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'summary',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const STEPS: Step[] = ['stage', 'tag', 'confirm'];

export const ConnectContactsModal: React.FC<ConnectContactsModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  workspaceId,
  workspaceName,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('stage');
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Map<string, ContactType>>(new Map());
  const [bulkCategory, setBulkCategory] = useState<ContactType>(DEFAULT_CATEGORY);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scopeLost, setScopeLost] = useState(false);

  // Reset all state every time the modal opens, then load groups + contacts.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setStep('stage');
    setSelectedContactIds(new Set());
    setAssignments(new Map());
    setBulkCategory(DEFAULT_CATEGORY);
    setSearch('');
    setScopeLost(false);
    setIsLoading(true);

    Promise.all([
      googleContactsService.getContactGroups(),
      googleContactsService.getAllContacts(),
    ])
      .then(([nextGroups, nextContacts]) => {
        if (cancelled) return;
        setGroups(nextGroups);
        setContacts(nextContacts);
        // Diagnostic: Google's People API doesn't always 403 when the
        // contacts.readonly scope is missing -- sometimes it returns 200
        // with empty connections, which makes the wizard look "empty"
        // for no apparent reason. If both lists are empty and we got
        // here without throwing, treat it as a likely scope problem
        // and surface the reconnect banner so the user has a fix path.
        if (nextGroups.length === 0 && nextContacts.length === 0) {
          console.warn(
            '[ConnectContactsModal] Google returned 0 groups and 0 contacts. ' +
            'Most common cause: the connected Google account is missing the ' +
            'contacts.readonly scope. Showing reconnect banner.'
          );
          setScopeLost(true);
        }
      })
      .catch((error: { code?: string; status?: number; message?: string }) => {
        if (cancelled) return;
        console.error('[ConnectContactsModal] load failed:', error);
        // Anything that looks like a token-expired / scope-revoked /
        // unauthenticated / no-Google-account response triggers the
        // in-modal reconnect banner rather than a generic toast the
        // user often misses.
        const isAuthFailure =
          error?.code === 'GOOGLE_CONTACTS_PERMISSION_DENIED' ||
          error?.code === 'GOOGLE_CONTACTS_NOT_CONNECTED' ||
          error?.status === 401 ||
          error?.status === 403 ||
          /401|403|unauthorized|invalid[_ ]grant|expired|permission|not[_ ]connected/i.test(error?.message ?? '');
        if (isAuthFailure) {
          setScopeLost(true);
        } else {
          showImportErrorToast(t('contacts.connectModal.error_generic'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      cancelled = true;
    };
    // Deliberately depend on isOpen only. Including `t` (i18next's
    // translator) would cause the effect to re-fire on every parent
    // re-render (each render produces a fresh `t` reference), which
    // would reset modal state and re-fetch contacts mid-interaction --
    // visually "the wizard disappears and returns to the empty state."
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-focus search on entering the stage step.
  useEffect(() => {
    if (step === 'stage' && !isLoading) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [step, isLoading]);

  const contactsByGroup = useMemo(() => {
    const map = new Map<string, Contact[]>();
    groups.forEach(group => map.set(group.id, []));
    map.set(ORPHAN_GROUP_ID, []);
    contacts.forEach(contact => {
      const groupIds = contact.groups ?? [];
      if (groupIds.length === 0) {
        map.get(ORPHAN_GROUP_ID)!.push(contact);
        return;
      }
      groupIds.forEach(groupId => {
        if (!map.has(groupId)) map.set(groupId, []);
        map.get(groupId)!.push(contact);
      });
    });
    return map;
  }, [contacts, groups]);

  const allGroupsWithOrphans = useMemo<ContactGroup[]>(() => {
    const orphanCount = contactsByGroup.get(ORPHAN_GROUP_ID)?.length ?? 0;
    return [
      ...groups,
      ...(orphanCount > 0
        ? [{ id: ORPHAN_GROUP_ID, name: t('contacts.connectModal.orphan_bucket_label'), memberCount: orphanCount }]
        : []),
    ];
  }, [groups, contactsByGroup, t]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allGroupsWithOrphans;
    return allGroupsWithOrphans.filter(group => {
      if (group.name.toLowerCase().includes(q)) return true;
      const members = contactsByGroup.get(group.id) ?? [];
      return members.some(
        contact =>
          contact.name.toLowerCase().includes(q) ||
          contact.email?.toLowerCase().includes(q)
      );
    });
  }, [allGroupsWithOrphans, contactsByGroup, search]);

  const filterContactRow = (contact: Contact): boolean => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      contact.name.toLowerCase().includes(q) ||
      (contact.email?.toLowerCase().includes(q) ?? false) ||
      (contact.company?.toLowerCase().includes(q) ?? false)
    );
  };

  const selectedCount = selectedContactIds.size;
  const selectedContacts = useMemo(
    () => contacts.filter(contact => selectedContactIds.has(contact.id)),
    [contacts, selectedContactIds]
  );

  const toggleContact = (contact: Contact) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(contact.id)) {
        next.delete(contact.id);
      } else {
        next.add(contact.id);
      }
      return next;
    });
    setAssignments(prev => {
      if (prev.has(contact.id)) return prev;
      const next = new Map(prev);
      next.set(contact.id, DEFAULT_CATEGORY);
      return next;
    });
  };

  const toggleGroup = (group: ContactGroup) => {
    const groupContacts = contactsByGroup.get(group.id) ?? [];
    const visible = groupContacts.filter(filterContactRow);
    const allChecked = visible.length > 0 && visible.every(contact => selectedContactIds.has(contact.id));

    setSelectedContactIds(prev => {
      const next = new Set(prev);
      visible.forEach(contact => {
        if (allChecked) next.delete(contact.id);
        else next.add(contact.id);
      });
      return next;
    });
    setAssignments(prev => {
      const next = new Map(prev);
      visible.forEach(contact => {
        if (!allChecked && !next.has(contact.id)) {
          next.set(contact.id, DEFAULT_CATEGORY);
        }
      });
      return next;
    });
  };

  const setContactCategory = (contactId: string, category: ContactType) => {
    setAssignments(prev => {
      const next = new Map(prev);
      next.set(contactId, category);
      return next;
    });
  };

  const applyBulkCategory = () => {
    setAssignments(prev => {
      const next = new Map(prev);
      selectedContactIds.forEach(id => next.set(id, bulkCategory));
      return next;
    });
  };

  const breakdownByCategory = useMemo(() => {
    const counts = new Map<ContactType, number>();
    selectedContactIds.forEach(id => {
      const cat = assignments.get(id) ?? DEFAULT_CATEGORY;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    });
    return CATEGORIES.map(c => ({ ...c, count: counts.get(c.value) ?? 0 })).filter(c => c.count > 0);
  }, [selectedContactIds, assignments]);

  const goNext = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const requestReconnect = () => {
    window.dispatchEvent(new CustomEvent('pulse:contacts:scope-missing'));
    onClose();
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
    if (selectedCount === 0) return;
    setIsImporting(true);
    try {
      const items = selectedContacts.map(contact => ({
        contact,
        contactType: assignments.get(contact.id) ?? DEFAULT_CATEGORY,
      }));
      const result = await importSelectedContacts(items, workspaceId);
      onImportComplete({ ...result, keptContactsForTrim: selectedContacts });
    } catch (error) {
      console.error('[ConnectContactsModal] import failed:', error);
      const e = error as { code?: string; status?: number; message?: string };
      const isAuthFailure =
        e?.code === 'GOOGLE_CONTACTS_PERMISSION_DENIED' ||
        e?.code === 'GOOGLE_CONTACTS_NOT_CONNECTED' ||
        e?.status === 401 ||
        e?.status === 403 ||
        /401|403|unauthorized|invalid[_ ]grant|expired|permission|not[_ ]connected/i.test(e?.message ?? '');
      if (error instanceof WorkspaceNotBootstrappedError) {
        showImportErrorToast(t('contacts.connectModal.error_workspace_not_ready'));
      } else if (isAuthFailure) {
        setScopeLost(true);
      } else {
        showImportErrorToast(t('contacts.connectModal.error_generic'));
      }
    } finally {
      setIsImporting(false);
    }
  };

  const stepIndex = STEPS.indexOf(step);
  const canAdvance = step === 'stage' ? selectedCount > 0 : step === 'tag' ? selectedCount > 0 : true;

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
            className="w-full max-w-3xl max-h-[88vh] rounded-xl border overflow-hidden flex flex-col"
            style={{
              background: 'var(--pulse-surface)',
              borderColor: 'var(--pulse-border)',
              boxShadow: 'var(--pulse-shadow-md)',
              color: 'var(--pulse-ink)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="p-5 border-b flex items-start gap-4" style={{ borderColor: 'var(--pulse-border)' }}>
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: 'var(--pulse-rose-soft)' }}
              >
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
                aria-label={t('contacts.connectModal.nav_cancel')}
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </header>

            <nav
              className="px-5 py-3 border-b flex items-center gap-3"
              style={{ borderColor: 'var(--pulse-border)', background: 'var(--pulse-canvas)' }}
              aria-label="Import progress"
            >
              {STEPS.map((s, idx) => {
                const isActive = s === step;
                const isDone = idx < stepIndex;
                return (
                  <React.Fragment key={s}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
                        style={{
                          background: isActive || isDone ? 'var(--pulse-rose)' : 'var(--pulse-surface-raised)',
                          color: isActive || isDone ? '#fff' : 'var(--pulse-ink-3)',
                        }}
                      >
                        {isDone ? <Check className="w-3 h-3" aria-hidden="true" /> : idx + 1}
                      </span>
                      <span
                        className="text-[11px] tracking-[0.1em] uppercase"
                        style={{
                          color: isActive ? 'var(--pulse-ink)' : 'var(--pulse-ink-3)',
                          fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
                          fontWeight: isActive ? 600 : 500,
                        }}
                      >
                        {t(`contacts.connectModal.step_${s}`)}
                      </span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <span className="flex-1 h-px" style={{ background: 'var(--pulse-border)' }} aria-hidden="true" />
                    )}
                  </React.Fragment>
                );
              })}
            </nav>

            {scopeLost && (
              <div
                className="px-5 py-3 border-b flex items-start gap-3"
                style={{
                  background: 'var(--pulse-tone-warning-soft)',
                  borderColor: 'var(--pulse-border)',
                  color: 'var(--pulse-ink)',
                }}
                role="alert"
              >
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--pulse-tone-warning)' }} aria-hidden="true" />
                <div className="flex-1 text-sm leading-5">
                  <div className="font-semibold">{t('contacts.connectModal.scope_lost_title')}</div>
                  <div style={{ color: 'var(--pulse-ink-2)' }}>{t('contacts.connectModal.scope_lost_body')}</div>
                </div>
                <button
                  type="button"
                  onClick={requestReconnect}
                  className="min-h-[36px] px-3 py-1.5 rounded-md text-sm font-semibold"
                  style={{ background: 'var(--pulse-rose)', color: '#fff' }}
                >
                  {t('contacts.connectModal.scope_lost_cta')}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto" style={{ background: 'var(--pulse-canvas)' }}>
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[60px] rounded-lg animate-pulse"
                      style={{ background: 'var(--pulse-surface-raised)' }}
                    />
                  ))}
                </div>
              ) : step === 'stage' ? (
                <StageStep
                  search={search}
                  setSearch={setSearch}
                  searchRef={searchRef}
                  filteredGroups={filteredGroups}
                  contactsByGroup={contactsByGroup}
                  filterContactRow={filterContactRow}
                  selectedContactIds={selectedContactIds}
                  toggleContact={toggleContact}
                  toggleGroup={toggleGroup}
                  t={t}
                />
              ) : step === 'tag' ? (
                <TagStep
                  selectedContacts={selectedContacts}
                  assignments={assignments}
                  setContactCategory={setContactCategory}
                  bulkCategory={bulkCategory}
                  setBulkCategory={setBulkCategory}
                  applyBulkCategory={applyBulkCategory}
                  t={t}
                />
              ) : (
                <ConfirmStep
                  count={selectedCount}
                  workspaceName={workspaceName}
                  breakdown={breakdownByCategory}
                  t={t}
                />
              )}
            </div>

            <footer
              className="border-t p-4 flex items-center justify-between gap-3"
              style={{ borderColor: 'var(--pulse-border)' }}
            >
              <div aria-live="polite" className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
                {t('contacts.connectModal.selected_count', { count: selectedCount })}
              </div>
              <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="min-h-[44px] px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5"
                    style={{ color: 'var(--pulse-ink-2)', border: '1px solid var(--pulse-border)' }}
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    {t('contacts.connectModal.nav_back')}
                  </button>
                )}
                {stepIndex < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canAdvance}
                    className="min-h-[44px] px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    style={{ background: 'var(--pulse-rose)' }}
                  >
                    {t('contacts.connectModal.nav_next')}
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={selectedCount === 0 || isImporting}
                    className="min-h-[44px] px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background: 'var(--pulse-rose)' }}
                  >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
                    {t('contacts.connectModal.nav_import', { count: selectedCount })}
                  </button>
                )}
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface StageStepProps {
  search: string;
  setSearch: (s: string) => void;
  searchRef: React.RefObject<HTMLInputElement>;
  filteredGroups: ContactGroup[];
  contactsByGroup: Map<string, Contact[]>;
  filterContactRow: (c: Contact) => boolean;
  selectedContactIds: Set<string>;
  toggleContact: (c: Contact) => void;
  toggleGroup: (g: ContactGroup) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const StageStep: React.FC<StageStepProps> = ({
  search,
  setSearch,
  searchRef,
  filteredGroups,
  contactsByGroup,
  filterContactRow,
  selectedContactIds,
  toggleContact,
  toggleGroup,
  t,
}) => {
  return (
    <div className="p-4 space-y-3">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: 'var(--pulse-ink-3)' }}
          aria-hidden="true"
        />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('contacts.connectModal.stage_search_placeholder')}
          className="w-full min-h-[44px] pl-9 pr-3 rounded-lg border text-sm"
          style={{
            background: 'var(--pulse-surface)',
            borderColor: 'var(--pulse-border)',
            color: 'var(--pulse-ink)',
          }}
        />
      </div>

      {filteredGroups.length === 0 ? (
        <div
          className="p-8 text-center text-sm rounded-lg border"
          style={{
            background: 'var(--pulse-surface)',
            borderColor: 'var(--pulse-border)',
            color: 'var(--pulse-ink-3)',
          }}
        >
          {search.trim() ? t('contacts.connectModal.stage_empty_state') : t('contacts.connectModal.stage_empty_groups')}
        </div>
      ) : (
        filteredGroups.map(group => {
          const groupContacts = contactsByGroup.get(group.id) ?? [];
          const visible = groupContacts.filter(filterContactRow);
          if (visible.length === 0) return null;
          const checkedCount = visible.filter(contact => selectedContactIds.has(contact.id)).length;
          const isAllChecked = visible.length > 0 && checkedCount === visible.length;
          const isPartial = checkedCount > 0 && checkedCount < visible.length;

          return (
            <details
              key={group.id}
              open={!!search.trim() || visible.length <= 8}
              className="rounded-lg border overflow-hidden"
              style={{ background: 'var(--pulse-surface)', borderColor: 'var(--pulse-border)' }}
            >
              <summary
                className="min-h-[44px] flex items-center gap-3 px-3 cursor-pointer list-none select-none"
              >
                <GroupCheckbox
                  checked={isAllChecked}
                  isPartial={isPartial}
                  ariaLabel={t('contacts.connectModal.select_all_in_group', { group: group.name })}
                  onChange={() => toggleGroup(group)}
                />
                <span className="flex-1 text-sm font-medium">
                  {group.name || t('contacts.connectModal.group_label_unlabeled')}
                </span>
                <span
                  className="text-[11px] tracking-[0.1em]"
                  style={{
                    color: 'var(--pulse-ink-3)',
                    fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
                  }}
                >
                  {checkedCount > 0 ? `${checkedCount} / ${visible.length}` : visible.length}
                </span>
              </summary>
              <div
                className="border-t px-3 py-2 space-y-0.5"
                style={{ borderColor: 'var(--pulse-border)' }}
              >
                {visible.map(contact => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    checked={selectedContactIds.has(contact.id)}
                    onToggle={() => toggleContact(contact)}
                    selectLabel={t('contacts.connectModal.select_contact', { name: contact.name })}
                  />
                ))}
              </div>
            </details>
          );
        })
      )}
    </div>
  );
};

interface TagStepProps {
  selectedContacts: Contact[];
  assignments: Map<string, ContactType>;
  setContactCategory: (id: string, cat: ContactType) => void;
  bulkCategory: ContactType;
  setBulkCategory: (cat: ContactType) => void;
  applyBulkCategory: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const TagStep: React.FC<TagStepProps> = ({
  selectedContacts,
  assignments,
  setContactCategory,
  bulkCategory,
  setBulkCategory,
  applyBulkCategory,
  t,
}) => {
  if (selectedContacts.length === 0) {
    return (
      <div
        className="m-4 p-8 text-center text-sm rounded-lg border"
        style={{
          background: 'var(--pulse-surface)',
          borderColor: 'var(--pulse-border)',
          color: 'var(--pulse-ink-3)',
        }}
      >
        {t('contacts.connectModal.tag_no_selection')}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border"
        style={{ background: 'var(--pulse-surface)', borderColor: 'var(--pulse-border)' }}
      >
        <label
          htmlFor="bulk-category"
          className="text-[11px] tracking-[0.1em] uppercase"
          style={{
            color: 'var(--pulse-ink-2)',
            fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
            fontWeight: 600,
          }}
        >
          {t('contacts.connectModal.tag_set_all_label')}
        </label>
        <select
          id="bulk-category"
          value={bulkCategory}
          onChange={(e) => setBulkCategory(e.target.value as ContactType)}
          className="min-h-[40px] px-3 rounded-md border text-sm flex-1"
          style={{
            background: 'var(--pulse-canvas)',
            borderColor: 'var(--pulse-border)',
            color: 'var(--pulse-ink)',
          }}
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>
              {t(`contacts.connectModal.${c.labelKey}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={applyBulkCategory}
          className="min-h-[40px] px-4 py-2 rounded-md text-sm font-semibold"
          style={{
            border: '1px solid var(--pulse-rose)',
            color: 'var(--pulse-rose)',
            background: 'var(--pulse-rose-softer)',
          }}
        >
          {t('contacts.connectModal.tag_set_all_apply')}
        </button>
      </div>

      <ul className="space-y-1" role="list">
        {selectedContacts.map(contact => {
          const category = assignments.get(contact.id) ?? DEFAULT_CATEGORY;
          return (
            <li
              key={contact.id}
              className="flex items-center gap-3 p-2 rounded-md"
              style={{ background: 'var(--pulse-surface)' }}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${contact.avatarColor}`}
                aria-hidden="true"
              >
                {contact.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{contact.name}</div>
                <div className="text-xs truncate" style={{ color: 'var(--pulse-ink-3)' }}>
                  {contact.email || contact.company || ''}
                </div>
              </div>
              <select
                value={category}
                onChange={(e) => setContactCategory(contact.id, e.target.value as ContactType)}
                aria-label={`Category for ${contact.name}`}
                className="min-h-[36px] px-2 rounded-md border text-sm"
                style={{
                  background: 'var(--pulse-canvas)',
                  borderColor: 'var(--pulse-border)',
                  color: 'var(--pulse-ink)',
                }}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>
                    {t(`contacts.connectModal.${c.labelKey}`)}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

interface ConfirmStepProps {
  count: number;
  workspaceName?: string;
  breakdown: Array<CategoryOption & { count: number }>;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const ConfirmStep: React.FC<ConfirmStepProps> = ({ count, workspaceName, breakdown, t }) => {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold mb-1">{t('contacts.connectModal.confirm_title')}</h3>
        <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
          {t('contacts.connectModal.confirm_body', { count, workspace: workspaceName || 'this workspace' })}
        </p>
      </div>

      <div>
        <h4
          className="text-[11px] tracking-[0.1em] uppercase mb-2"
          style={{
            color: 'var(--pulse-ink-3)',
            fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
            fontWeight: 600,
          }}
        >
          {t('contacts.connectModal.confirm_breakdown_heading')}
        </h4>
        <ul
          className="rounded-lg border divide-y"
          style={{
            background: 'var(--pulse-surface)',
            borderColor: 'var(--pulse-border)',
          }}
          role="list"
        >
          {breakdown.map(row => (
            <li key={row.value} className="flex items-center justify-between p-3">
              <span className="text-sm font-medium">{t(`contacts.connectModal.${row.labelKey}`)}</span>
              <span
                className="text-[11px] tracking-[0.1em]"
                style={{
                  color: 'var(--pulse-ink-2)',
                  fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
                }}
              >
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

interface ContactRowProps {
  contact: Contact;
  checked: boolean;
  onToggle: () => void;
  selectLabel: string;
}

const ContactRow: React.FC<ContactRowProps> = ({ contact, checked, onToggle, selectLabel }) => {
  return (
    <label className="min-h-[44px] flex items-center gap-3 px-1 py-1 rounded-md cursor-pointer hover:bg-[var(--pulse-surface-raised)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={selectLabel}
        className="w-4 h-4 accent-[var(--pulse-rose)] flex-shrink-0"
      />
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0 ${contact.avatarColor}`}
        aria-hidden="true"
      >
        {contact.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
        <span className="font-medium truncate">{contact.name}</span>
        {contact.email && (
          <span className="truncate" style={{ color: 'var(--pulse-ink-3)' }}>
            {contact.email}
          </span>
        )}
      </div>
      {contact.company && (
        <span className="hidden sm:inline text-xs truncate" style={{ color: 'var(--pulse-ink-3)' }}>
          {contact.company}
        </span>
      )}
    </label>
  );
};

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
      className="w-4 h-4 accent-[var(--pulse-rose)] flex-shrink-0"
    />
  );
};

export default ConnectContactsModal;
