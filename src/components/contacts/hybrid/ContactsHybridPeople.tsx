// ============================================
// CONTACTS HYBRID — PEOPLE (3-pane orchestrator)
// Path D redesign. Replaces the ContactsRedesigned body when the
// `contactsHybrid` feature flag is ON (gated in ContactsShell.tsx).
//
// Phases 2-4 — Browse column + filter engine + Focus column + Co-pilot rail.
// This component owns the filter + selection state and data loading
// (verbatim-ported from ContactsRedesigned) and renders the 3-pane shell:
// Col 1 BrowseColumn, Col 2 FocusColumn (full inline detail, reusing
// ContactDetail sub-components), Col 3 CopilotRail (todayFeedService agenda).
//
// Reuses services verbatim: useRelationshipIntelligence, getCircles,
// savedFiltersService, dataService. The legacy ContactsRedesigned/ContactDetail
// were removed in Phase 12 — this is now the sole People view (props mirror the
// former ContactsRedesignedProps shape, kept for the ContactsShell call site).
//
// DEFERRED from the legacy People surface (documented, NOT silently dropped —
// these are not filters, so Phase 2's AC is unaffected; each lands in its named
// phase):
//   • Relationship alerts → SURFACED in the Phase-4 CopilotRail: generateTodayFeed
//     folds relationshipAlertService alerts into the feed, so the rail's
//     Suggested list IS the alerts home (no separate banner needed).
//   • AI / NL contact search (AIContactSearch, the list-narrowing search bar) →
//     still deferred; distinct from the rail. The filter engine already supports
//     aiResultIds (null = inactive); wiring the bar is additive, a later phase.
//   • Duplicates banner + DuplicateDetectionModal → Phase 7 preserve-and-port.
//   • Bulk multi-select + BulkActionToolbar + workspace share → Phase 7.
//   • Grid view mode → optional/later (§9; List is the hybrid default).
//   • Add-contact 3-tile chooser (Find teammates / Google / manual) → Phase 7;
//     Phase 2 wires the manual AddContactModal so the footer is functional.
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md.
// ============================================

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ArrowLeft, Sparkles, UserSearch, Users, UserPlus, X } from 'lucide-react';
import { Contact } from '../../../types';
import type { SmartListType } from '../../../types/relationshipTypes';
import type { ContactCircle } from '../../../types/contactCircleTypes';
import { useFeatures } from '../../../contexts/FeatureContext';
import { useWorkspaceData, useWorkspacePermissions } from '../../../contexts/WorkspaceContext';
import { useRelationshipIntelligence } from '../../../hooks/useRelationshipIntelligence';
import { supabase } from '../../../services/supabase';
import { dataService } from '../../../services/dataService';
import { getCircles } from '../../../services/contactCircleService';
import { shareContactsToWorkspace } from '../../../services/workspaceContactsService';
import {
  applyFilterPredicate,
  createSavedFilter,
  deleteSavedFilter,
  listSavedFilters,
  updateSavedFilter,
  type FilterPredicate,
  type SavedFilter,
} from '../../../services/savedFiltersService';
import { SavedFiltersPanel } from '../SavedFiltersPanel';
import { NamePromptModal } from '../NamePromptModal';
import { AddContactModal } from '../AddContactModal';
import { EditContactModal } from '../EditContactModal';
import { BulkActionToolbar } from '../BulkActionToolbar';
import { WorkspaceShareModal } from '../WorkspaceShareModal';
import { FindTeammatesSheet } from '../FindTeammatesSheet';
import type { DiscoveredPulseUser } from '../../../services/pulseUserDiscoveryService';
import { BrowseColumn } from './list/BrowseColumn';
import { FocusColumn } from './detail/FocusColumn';
import { CopilotRail } from './copilot/CopilotRail';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { composeEmail } from './channels/actions';
import {
  filterBrowseContacts,
  countBrowseContacts,
  type FilterStatus,
} from './list/browseFilter';

interface ContactsHybridPeopleProps {
  contacts: Contact[];
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onSyncComplete?: (newContacts: Contact[]) => void;
  onUpdateContact?: (updatedContact: Contact) => void;
  onAddContact?: (contact: Omit<Contact, 'id'>) => Promise<Contact | null>;
  onDeleteContact?: (contactId: string) => Promise<boolean>;
  openAddContact?: boolean;
}

// Same fallback the legacy component uses when the intelligence hook hasn't
// resolved counts yet (keeps the full SmartListType record total).
const EMPTY_SMART_LIST_COUNTS: Record<SmartListType, number> = {
  needs_follow_up: 0,
  warm_leads: 0,
  inactive_30_days: 0,
  vip: 0,
  hot_leads: 0,
  at_risk: 0,
  cold_leads: 0,
  recent_contacts: 0,
  company: 0,
  tag: 0,
  custom: 0,
};

export const ContactsHybridPeople: React.FC<ContactsHybridPeopleProps> = ({
  contacts,
  onAction,
  onSyncComplete,
  onUpdateContact,
  onAddContact,
  onDeleteContact,
  openAddContact,
}) => {
  const { t } = useTranslation();
  const { features } = useFeatures();
  const { currentWorkspace, workspaces } = useWorkspaceData();
  const { isAdmin, isOwner } = useWorkspacePermissions();

  // ── Selection + filter state ──────────────────────────────────────────────
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  // Responsive: below md the 3-pane collapses to a single column (master-detail
  // Browse<->Focus) with the Co-pilot rail behind a toggle. JS check, not Tailwind
  // responsive variants (unreliable in this tree — see the Co-pilot note below).
  const isDesktop = useMediaQuery('(min-width: 768px)');
  // Wider gate for the inline Co-pilot rail. Between 768px and 1100px the
  // Browse + Focus panes already fill the row; adding the 300px rail there
  // crushes both to unusable widths. Above 1100px there's room for all three;
  // below it the Co-pilot moves to the FAB + slide-over sheet.
  const isWide = useMediaQuery('(min-width: 1100px)');
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [activeSmartList, setActiveSmartList] = useState<SmartListType | null>(null);
  const [activeCircleId, setActiveCircleId] = useState<string | null>(null);
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // ── Loaded data ───────────────────────────────────────────────────────────
  const [archivedContacts, setArchivedContacts] = useState<Contact[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [circles, setCircles] = useState<ContactCircle[]>([]);
  const [savedFilters, setSavedFilters] = useState<{ user: SavedFilter[]; workspace: SavedFilter[] }>({
    user: [],
    workspace: [],
  });
  const [orphanedConditionsByFilterId, setOrphanedConditionsByFilterId] = useState<Record<string, number>>({});
  const [namePromptState, setNamePromptState] = useState<{
    title: string;
    placeholder?: string;
    initialValue?: string;
    cta?: string;
    onSubmit: (name: string) => void;
  } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkInFlight, setBulkInFlight] = useState(false);
  const [showWorkspaceShare, setShowWorkspaceShare] = useState(false);
  const [showAddChooser, setShowAddChooser] = useState(false);
  const [showFindTeammates, setShowFindTeammates] = useState(false);

  const { profiles, smartListCounts, getProfileByEmail, getLeadScoreByEmail } =
    useRelationshipIntelligence();

  // ── Data loading (ported verbatim from ContactsRedesigned) ────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const refreshArchivedContacts = async () => {
    const archived = await dataService.getContacts({ archivedOnly: true });
    setArchivedContacts(archived);
    setArchivedCount(archived.length);
  };

  useEffect(() => {
    refreshArchivedContacts();
  }, [contacts.length]);

  useEffect(() => {
    if (!userId) return;
    getCircles(userId)
      .then(setCircles)
      .catch((error) => console.warn('[ContactsHybridPeople] circles load failed:', error));
  }, [userId, contacts.length]);

  useEffect(() => {
    let cancelled = false;
    listSavedFilters(currentWorkspace?.id)
      .then((filters) => {
        if (!cancelled) setSavedFilters(filters);
      })
      .catch((error) => console.warn('[ContactsHybridPeople] saved filters load failed:', error));
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id]);

  // Open the manual-add modal when the shell signals it.
  useEffect(() => {
    if (openAddContact) setShowAddModal(true);
  }, [openAddContact]);

  // Cross-surface events (mirror legacy): apply a smart list, or select a
  // contact (palette "Open <person>" relayed by ContactsShell).
  useEffect(() => {
    const applyHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ list: SmartListType }>).detail;
      if (detail?.list) {
        setActiveSmartList(detail.list);
        setFilterTag(null);
      }
    };
    window.addEventListener('pulse:contacts:apply-smart-list', applyHandler);
    return () => window.removeEventListener('pulse:contacts:apply-smart-list', applyHandler);
  }, []);

  useEffect(() => {
    const selectHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      if (detail?.id && contacts.some((c) => c.id === detail.id)) setSelectedContactId(detail.id);
    };
    window.addEventListener('pulse:contacts:select-contact', selectHandler);
    return () => window.removeEventListener('pulse:contacts:select-contact', selectHandler);
  }, [contacts]);

  // ── Derived: base set, counts, filtered list ──────────────────────────────
  const baseContacts = showArchived ? archivedContacts : contacts;

  const counts = useMemo(() => countBrowseContacts(baseContacts), [baseContacts]);

  const filteredContacts = useMemo(
    () =>
      filterBrowseContacts({
        baseContacts,
        profiles,
        circles,
        savedFilters,
        search,
        aiResultIds: null, // AI/NL search lands in Phase 4 (Co-pilot)
        filterStatus,
        filterTag,
        activeSmartList,
        activeCircleId,
        activeSavedFilterId,
      }),
    [
      baseContacts,
      profiles,
      circles,
      savedFilters,
      search,
      filterStatus,
      filterTag,
      activeSmartList,
      activeCircleId,
      activeSavedFilterId,
    ],
  );

  // Orphaned saved-filter conditions (for the SavedFiltersPanel badges).
  useEffect(() => {
    const knownCircleIds = new Set(circles.map((circle) => circle.id));
    const knownTagUuids = new Set(baseContacts.flatMap((contact) => contact.groups ?? []));
    const next: Record<string, number> = {};
    [...savedFilters.user, ...savedFilters.workspace].forEach((filter) => {
      next[filter.id] = applyFilterPredicate(
        filter.predicate_json,
        baseContacts,
        knownCircleIds,
        knownTagUuids,
      ).orphanedConditions;
    });
    setOrphanedConditionsByFilterId(next);
  }, [baseContacts, circles, savedFilters]);

  // ── Saved-filter management (ported) ──────────────────────────────────────
  const buildCurrentPredicate = (): FilterPredicate => ({
    search: search.trim() || undefined,
    archived: showArchived ? true : undefined,
  });

  const reloadSavedFilters = async () => {
    const filters = await listSavedFilters(currentWorkspace?.id);
    setSavedFilters(filters);
  };

  const handleSaveCurrentFilter = async (draft?: { name: string; scope: 'personal' | 'workspace' }) => {
    if (draft?.name) {
      try {
        await createSavedFilter({
          name: draft.name,
          predicate: buildCurrentPredicate(),
          workspaceId: draft.scope === 'workspace' ? currentWorkspace?.id : undefined,
        });
        await reloadSavedFilters();
      } catch (error) {
        console.error('[ContactsHybridPeople] save filter failed:', error);
        toast.error("Couldn't save filter");
      }
      return;
    }
    setNamePromptState({
      title: t('contacts.savedFilters.save_dialog_title'),
      placeholder: t('contacts.savedFilters.save_dialog_name_placeholder'),
      cta: t('contacts.savedFilters.save_dialog_cta'),
      onSubmit: async (name) => {
        setNamePromptState(null);
        try {
          await createSavedFilter({ name, predicate: buildCurrentPredicate(), workspaceId: undefined });
          await reloadSavedFilters();
        } catch (error) {
          console.error('[ContactsHybridPeople] save filter failed:', error);
          toast.error("Couldn't save filter");
        }
      },
    });
  };

  const handleEditSavedFilter = async (id: string) => {
    const filter = [...savedFilters.user, ...savedFilters.workspace].find((item) => item.id === id);
    if (!filter) return;
    setNamePromptState({
      title: t('contacts.savedFilters.save_dialog_title'),
      placeholder: t('contacts.savedFilters.save_dialog_name_placeholder'),
      initialValue: filter.name,
      cta: t('contacts.savedFilters.save_dialog_cta'),
      onSubmit: async (name) => {
        setNamePromptState(null);
        if (!name || name === filter.name) return;
        try {
          await updateSavedFilter(id, { name });
          await reloadSavedFilters();
        } catch (error) {
          console.error('[ContactsHybridPeople] rename filter failed:', error);
          toast.error("Couldn't rename filter");
        }
      },
    });
  };

  const handleDeleteSavedFilter = async (id: string) => {
    try {
      await deleteSavedFilter(id);
      if (activeSavedFilterId === id) setActiveSavedFilterId(null);
      await reloadSavedFilters();
    } catch (error) {
      console.error('[ContactsHybridPeople] delete filter failed:', error);
      toast.error("Couldn't delete filter");
    }
  };

  // ── Focus pane helpers ────────────────────────────────────────────────────
  // ── Bulk selection (Phase 7) ──────────────────────────────────────────────
  const selectedIdList = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const handleToggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Warn when a bulk archive would empty a whole circle (mirrors legacy).
  const affectsCircle = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const emptied = circles.find(
      (circle) =>
        circle.memberContactIds.length > 0 &&
        circle.memberContactIds.every((id) => selectedIds.has(id)),
    );
    return emptied?.name ?? null;
  }, [circles, selectedIds]);

  const refreshAfterBulkOperation = async () => {
    await refreshArchivedContacts();
    const nextContacts = await dataService.getContacts();
    onSyncComplete?.(nextContacts);
    // If the focused contact was part of the bulk op (archived/deleted), drop the
    // focus so the Focus pane doesn't keep showing a now-removed contact.
    if (selectedContactId && selectedIdList.includes(selectedContactId)) {
      setSelectedContactId(null);
    }
  };

  const handleBulkArchive = async () => {
    if (bulkInFlight || selectedIdList.length === 0) return;
    setBulkInFlight(true);
    try {
      const result = await dataService.archiveContacts(selectedIdList);
      if (result.failed.length > 0) {
        toast.error(t('contacts.bulkToolbar.partial_failure', { succeeded: result.succeeded.length, failed: result.failed.length, total: selectedIdList.length }));
      } else {
        toast.success(t('contacts.bulkToolbar.success_archived', { count: result.succeeded.length }));
      }
      setSelectedIds(new Set());
      await refreshAfterBulkOperation();
    } finally {
      setBulkInFlight(false);
    }
  };

  const handleBulkRestore = async () => {
    if (bulkInFlight || selectedIdList.length === 0) return;
    setBulkInFlight(true);
    try {
      const result = await dataService.restoreContacts(selectedIdList);
      if (result.failed.length > 0) {
        toast.error(t('contacts.bulkToolbar.partial_failure', { succeeded: result.succeeded.length, failed: result.failed.length, total: selectedIdList.length }));
      } else {
        toast.success(t('contacts.bulkToolbar.success_restored', { count: result.succeeded.length }));
      }
      setSelectedIds(new Set());
      await refreshAfterBulkOperation();
    } finally {
      setBulkInFlight(false);
    }
  };

  const handleBulkDelete = async () => {
    if (bulkInFlight || selectedIdList.length === 0) return;
    setBulkInFlight(true);
    try {
      const result = await dataService.bulkDeleteContacts(selectedIdList);
      if (result.failed.length > 0) {
        toast.error(t('contacts.bulkToolbar.partial_failure', { succeeded: result.succeeded.length, failed: result.failed.length, total: selectedIdList.length }));
      }
      setSelectedIds(new Set());
      await refreshAfterBulkOperation();
    } finally {
      setBulkInFlight(false);
    }
  };

  const handleShareToWorkspace = async (workspaceId: string) => {
    if (bulkInFlight || selectedIdList.length === 0) return { shared: 0, failed: 0 };
    setBulkInFlight(true);
    try {
      const result = await shareContactsToWorkspace(selectedIdList, workspaceId);
      const workspaceName = workspaces.find((w) => w.id === workspaceId)?.name ?? '';
      if (result.failed.length > 0) {
        toast.error(t('contacts.bulkToolbar.partial_failure', { succeeded: result.succeeded.length, failed: result.failed.length, total: selectedIdList.length }));
      } else {
        toast.success(t('contacts.bulkToolbar.success_shared', { count: result.succeeded.length, workspace: workspaceName }));
      }
      setShowWorkspaceShare(false);
      setSelectedIds(new Set());
      await refreshAfterBulkOperation();
      return { shared: result.succeeded.length, failed: result.failed.length };
    } finally {
      setBulkInFlight(false);
    }
  };

  // Cards (Send-as-card) intentionally omitted — Phase C, deferred to a later slice.
  const bulkToolbar = (
    <BulkActionToolbar
      selectedCount={selectedIds.size}
      onClearSelection={() => setSelectedIds(new Set())}
      onShare={() => setShowWorkspaceShare(true)}
      onArchive={handleBulkArchive}
      onUnarchive={handleBulkRestore}
      onDelete={handleBulkDelete}
      onSaveAsFilter={() => handleSaveCurrentFilter()}
      canShare={!!currentWorkspace && selectedIds.size >= 2}
      canDelete
      isInArchivedView={showArchived}
      affectsCircle={affectsCircle}
    />
  );

  // ── Focus pane helpers ────────────────────────────────────────────────────
  const selectedContact = useMemo(
    () => [...contacts, ...archivedContacts].find((c) => c.id === selectedContactId) ?? null,
    [contacts, archivedContacts, selectedContactId],
  );

  const selectedProfile = selectedContact?.email ? getProfileByEmail(selectedContact.email) : null;
  const selectedLeadScore = selectedContact?.email ? getLeadScoreByEmail(selectedContact.email) : null;

  // Phase 9: keyboard navigation over the Browse list. Kept local to the hybrid
  // (not the shared useContactsKeyboard hook) so it never affects the legacy
  // surface. ArrowUp/Down move the selection; Enter fires the primary action;
  // 'e' emails an external contact (when Email is enabled).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (filteredContacts.length === 0) return;
        e.preventDefault();
        const idx = filteredContacts.findIndex((c) => c.id === selectedContactId);
        const next =
          e.key === 'ArrowDown'
            ? Math.min(idx < 0 ? 0 : idx + 1, filteredContacts.length - 1)
            : Math.max(idx < 0 ? 0 : idx - 1, 0);
        setSelectedContactId(filteredContacts[next].id);
      } else if (e.key === 'Enter' && selectedContact) {
        if (selectedContact.pulseUserId) {
          e.preventDefault();
          onAction('message', selectedContact.id);
        } else if (features.emailEnabled) {
          e.preventDefault();
          composeEmail(selectedContact);
        }
      } else if (e.key === 'e' && selectedContact && !selectedContact.pulseUserId && features.emailEnabled) {
        e.preventDefault();
        composeEmail(selectedContact);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filteredContacts, selectedContactId, selectedContact, features.emailEnabled, onAction]);

  const handleEditContact = (c: Contact) => {
    setContactToEdit(c);
    setShowEditModal(true);
  };
  const handleSaveContact = async (updated: Contact) => {
    onUpdateContact?.(updated);
  };

  const handleAddContactWrapper = async (newContact: Omit<Contact, 'id'>) => {
    if (onAddContact) await onAddContact(newContact);
  };

  const activeDrawerFilterCount =
    (activeSmartList ? 1 : 0) +
    (activeCircleId ? 1 : 0) +
    (activeSavedFilterId ? 1 : 0) +
    (showArchived ? 1 : 0);

  const savedFiltersPanel = (
    <SavedFiltersPanel
      userFilters={savedFilters.user}
      workspaceFilters={savedFilters.workspace}
      activeFilterId={activeSavedFilterId}
      onSelectFilter={setActiveSavedFilterId}
      onSaveCurrent={handleSaveCurrentFilter}
      onEditFilter={handleEditSavedFilter}
      onDeleteFilter={handleDeleteSavedFilter}
      canEditWorkspaceFilters={isAdmin || isOwner}
      orphanedConditionsByFilterId={orphanedConditionsByFilterId}
    />
  );

  const copilotRail = (
    <CopilotRail
      userId={userId ?? undefined}
      contacts={contacts}
      emailEnabled={features.emailEnabled}
      onSelectContact={setSelectedContactId}
      onAction={onAction}
    />
  );

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: 'var(--pulse-canvas)' }}>
      {/* Col 1 — Browse. Mobile: full-width primary pane, shown only when no
          contact is selected (master-detail). */}
      {(isDesktop || !selectedContact) && (
      <BrowseColumn
        fullWidth={!isDesktop}
        contacts={filteredContacts}
        selectedContactId={selectedContactId}
        onSelectContact={(c) => setSelectedContactId(c.id)}
        search={search}
        onSearchChange={setSearch}
        counts={counts}
        filterStatus={filterStatus}
        onFilterStatusChange={(s) => {
          setFilterStatus(s);
          setActiveSmartList(null);
        }}
        filterTag={filterTag}
        onFilterTagChange={(tag) => {
          setFilterTag(tag);
          setActiveSmartList(null);
        }}
        activeSmartList={activeSmartList}
        smartListCounts={smartListCounts || EMPTY_SMART_LIST_COUNTS}
        onSmartListChange={(list) => {
          setActiveSmartList(list);
          setSelectedIds(new Set());
        }}
        circles={circles}
        activeCircleId={activeCircleId}
        onCircleChange={(id) => {
          setActiveCircleId(id);
          setSelectedIds(new Set());
        }}
        showArchived={showArchived}
        archivedCount={archivedCount}
        onToggleArchived={(next) => {
          setShowArchived(next);
          setActiveSavedFilterId(null);
          setSelectedIds(new Set());
        }}
        savedFiltersPanel={savedFiltersPanel}
        activeDrawerFilterCount={activeDrawerFilterCount}
        selectedIds={selectedIds}
        onToggleCheck={handleToggleSelection}
        onSelectAllVisible={() => setSelectedIds(new Set(filteredContacts.map((c) => c.id)))}
        onClearSelection={() => setSelectedIds(new Set())}
        bulkToolbar={bulkToolbar}
        onAddContact={() => setShowAddChooser(true)}
      />
      )}

      {/* Col 2 — Focus. Mobile: full-width, shown only when a contact is
          selected, with a back affordance to return to Browse. */}
      {(isDesktop || selectedContact) && (
      <div className="flex-1 min-w-0 flex flex-col">
        {!isDesktop && selectedContact && (
          <button
            type="button"
            onClick={() => setSelectedContactId(null)}
            className="flex items-center gap-2 px-4 h-12 shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-300 border-b"
            style={{ borderColor: 'var(--pulse-border)' }}
          >
            <ArrowLeft className="w-4 h-4" /> Contacts
          </button>
        )}
        <div className="flex-1 min-h-0">
        {selectedContact ? (
          <FocusColumn
            contact={selectedContact}
            userId={userId ?? undefined}
            relationshipProfile={selectedProfile}
            leadScore={selectedLeadScore}
            emailEnabled={features.emailEnabled}
            onAction={onAction}
            onUpdateContact={onUpdateContact}
            onEdit={handleEditContact}
            onDelete={
              onDeleteContact
                ? async () => {
                    const ok = await onDeleteContact(selectedContact.id);
                    if (ok) setSelectedContactId(null);
                  }
                : undefined
            }
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 text-zinc-400 dark:text-zinc-500">
            <p className="text-sm">Select a contact to focus.</p>
            <p className="text-xs mt-1">
              {filteredContacts.length} of {counts.total} shown.
            </p>
          </div>
        )}
        </div>
      </div>
      )}

      {/* Col 3 — Co-pilot. Wide (≥1100px): inline 300px rail (plain flex + inline
          width to sidestep this tree's flaky Tailwind JIT — responsive variants
          don't always regenerate on HMR). Below 1100px (incl. the 768–1100 mid
          range and true mobile): hidden behind a toggle that opens it as a
          right-side sheet, so Browse + Focus keep their full width. */}
      {isWide ? (
        <div
          className="flex flex-col shrink-0 border-l p-4 overflow-hidden"
          style={{ width: 300, borderColor: 'var(--pulse-border)', background: 'var(--pulse-canvas)' }}
        >
          {copilotRail}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setCopilotOpen(true)}
            aria-label="Open Pulse AI co-pilot"
            className="fixed right-4 bottom-[calc(1.25rem+var(--pulse-bottom-bar))] z-[60] w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            style={{ background: 'var(--pulse-rose)', color: '#fff' }}
          >
            <Sparkles className="w-5 h-5" />
          </button>
          {copilotOpen && (
            <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label="Pulse AI co-pilot">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCopilotOpen(false)} aria-hidden="true" />
              <div
                className="relative w-[88%] max-w-sm h-full flex flex-col border-l p-4 overflow-hidden"
                style={{ borderColor: 'var(--pulse-border)', background: 'var(--pulse-canvas)' }}
              >
                <button
                  type="button"
                  onClick={() => setCopilotOpen(false)}
                  aria-label="Close"
                  className="self-end mb-2 w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {copilotRail}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <NamePromptModal
        isOpen={!!namePromptState}
        title={namePromptState?.title ?? ''}
        placeholder={namePromptState?.placeholder}
        initialValue={namePromptState?.initialValue}
        cta={namePromptState?.cta}
        onSubmit={(name) => namePromptState?.onSubmit(name)}
        onClose={() => setNamePromptState(null)}
      />
      <AddContactModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={async (contact) => {
          await onAddContact?.(contact);
        }}
      />
      <EditContactModal
        isOpen={showEditModal}
        contact={contactToEdit}
        onClose={() => {
          setShowEditModal(false);
          setContactToEdit(null);
        }}
        onSave={handleSaveContact}
      />
      <WorkspaceShareModal
        open={showWorkspaceShare}
        contactIds={selectedIdList}
        availableWorkspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
        onShare={handleShareToWorkspace}
        onCancel={() => setShowWorkspaceShare(false)}
      />

      {/* Add-contact chooser (3 tiles) — ported from ContactsRedesigned. The
          Add Contact footer opens this; manual tile opens AddContactModal,
          Google tile dispatches the existing connect-modal event, teammates
          tile opens FindTeammatesSheet. */}
      {showAddChooser && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.70)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowAddChooser(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-contact-chooser-title"
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: 'var(--pulse-surface)',
              border: '1px solid var(--pulse-border)',
              boxShadow: 'var(--pulse-shadow-md)',
              color: 'var(--pulse-ink)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b" style={{ borderColor: 'var(--pulse-border)' }}>
              <h2 id="add-contact-chooser-title" className="text-lg font-semibold">
                Add a contact
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
                Pick someone from Google, or add one yourself.
              </p>
            </div>
            <div className="p-3 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddChooser(false);
                  setShowFindTeammates(true);
                }}
                className="w-full flex items-start gap-3 p-3 rounded-xl border text-left hover:border-rose-300 dark:hover:border-rose-400/40 transition-colors"
                style={{ borderColor: 'var(--pulse-border)', background: 'var(--pulse-canvas)' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--pulse-tone-info-soft)' }}
                >
                  <UserSearch className="w-4 h-4" style={{ color: 'var(--pulse-tone-info)' }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">Find teammates on Pulse</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--pulse-ink-3)' }}>
                    See who's already here. Add them in one tap.
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddChooser(false);
                  window.dispatchEvent(new CustomEvent('pulse:contacts:open-connect-modal'));
                }}
                className="w-full flex items-start gap-3 p-3 rounded-xl border text-left hover:border-rose-300 dark:hover:border-rose-400/40 transition-colors"
                style={{ borderColor: 'var(--pulse-border)', background: 'var(--pulse-canvas)' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--pulse-rose-soft)' }}
                >
                  <Users className="w-4 h-4" style={{ color: 'var(--pulse-rose)' }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">Import from Google</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--pulse-ink-3)' }}>
                    Open the picker. Tick exactly who Pulse should know about.
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddChooser(false);
                  setShowAddModal(true);
                }}
                className="w-full flex items-start gap-3 p-3 rounded-xl border text-left hover:border-rose-300 dark:hover:border-rose-400/40 transition-colors"
                style={{ borderColor: 'var(--pulse-border)', background: 'var(--pulse-canvas)' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--pulse-tone-neutral-soft)' }}
                >
                  <UserPlus className="w-4 h-4" style={{ color: 'var(--pulse-tone-neutral)' }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">Add manually</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--pulse-ink-3)' }}>
                    Fill in a name, email, phone. Stays Pulse-local.
                  </div>
                </div>
              </button>
            </div>
            <div className="px-5 py-3 border-t flex justify-end" style={{ borderColor: 'var(--pulse-border)' }}>
              <button
                type="button"
                onClick={() => setShowAddChooser(false)}
                className="min-h-[36px] px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ color: 'var(--pulse-ink-2)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <FindTeammatesSheet
        isOpen={showFindTeammates}
        onClose={() => setShowFindTeammates(false)}
        workspaceId={currentWorkspace?.id ?? ''}
        onAdd={async (user: DiscoveredPulseUser) => {
          await handleAddContactWrapper({
            name: user.display_name,
            email: '',
            role: user.shared_workspace_role,
            avatarColor: '#f43f5e',
            avatarUrl: user.avatar_url ?? undefined,
            status: (user.online_status as Contact['status']) ?? 'offline',
            source: 'local',
            pulseUserId: user.user_id,
          });
        }}
      />
    </div>
  );
};

export default ContactsHybridPeople;
