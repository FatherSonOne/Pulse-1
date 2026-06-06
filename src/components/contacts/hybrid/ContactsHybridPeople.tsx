// ============================================
// CONTACTS HYBRID — PEOPLE (3-pane orchestrator)
// Path D redesign. Replaces the ContactsRedesigned body when the
// `contactsHybrid` feature flag is ON (gated in ContactsShell.tsx).
//
// Phase 2 — Browse column + filter engine. This component owns the filter
// state + data loading (verbatim-ported from ContactsRedesigned) and renders
// the 3-pane shell: Col 1 BrowseColumn (real), Col 2 Focus (selected contact +
// the Phase-1 ChannelRow in its real home; full detail lands in Phase 3),
// Col 3 Co-pilot (placeholder until Phase 4).
//
// Reuses services verbatim: useRelationshipIntelligence, getCircles,
// savedFiltersService, dataService. Legacy ContactsRedesigned stays intact
// until Phase 12. Props mirror ContactsRedesignedProps.
//
// DEFERRED from the legacy People surface (documented, NOT silently dropped —
// these are not filters, so Phase 2's AC is unaffected; each lands in its named
// phase):
//   • Relationship alerts banner + RelationshipAlertsFeed (legacy Sidebar
//     ~lines 323-350) → Phase 4 Co-pilot rail (alerts are AI-surfaced signals).
//     The handoff matrix never assigned this a home; flagged for §4.7.
//   • AI / NL contact search (AIContactSearch) → Phase 4 Co-pilot.
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
import { Contact } from '../../../types';
import type { SmartListType } from '../../../types/relationshipTypes';
import type { ContactCircle } from '../../../types/contactCircleTypes';
import { useFeatures } from '../../../contexts/FeatureContext';
import { useWorkspaceData, useWorkspacePermissions } from '../../../contexts/WorkspaceContext';
import { useRelationshipIntelligence } from '../../../hooks/useRelationshipIntelligence';
import { supabase } from '../../../services/supabase';
import { dataService } from '../../../services/dataService';
import { getCircles } from '../../../services/contactCircleService';
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
import { ChannelRow } from './channels/ChannelRow';
import { BrowseColumn } from './list/BrowseColumn';
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
  openAddContact,
}) => {
  const { t } = useTranslation();
  const { features } = useFeatures();
  const { currentWorkspace } = useWorkspaceData();
  const { isAdmin, isOwner } = useWorkspacePermissions();

  // ── Selection + filter state ──────────────────────────────────────────────
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
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

  const { profiles, smartListCounts } = useRelationshipIntelligence();

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
  const selectedContact = useMemo(
    () => [...contacts, ...archivedContacts].find((c) => c.id === selectedContactId) ?? null,
    [contacts, archivedContacts, selectedContactId],
  );

  // Phase 2 quick-log; the real inline-note editor is FocusColumn (Phase 3).
  const handleNote = (c: Contact) => {
    if (!onUpdateContact) return;
    const stamp = new Date().toLocaleString();
    onUpdateContact({ ...c, notes: `${c.notes ? `${c.notes}\n` : ''}[${stamp}] Quick note (Phase 2)` });
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

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: 'var(--pulse-canvas)' }}>
      {/* Col 1 — Browse */}
      <BrowseColumn
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
        onSmartListChange={setActiveSmartList}
        circles={circles}
        activeCircleId={activeCircleId}
        onCircleChange={setActiveCircleId}
        showArchived={showArchived}
        archivedCount={archivedCount}
        onToggleArchived={(next) => {
          setShowArchived(next);
          setActiveSavedFilterId(null);
        }}
        savedFiltersPanel={savedFiltersPanel}
        activeDrawerFilterCount={activeDrawerFilterCount}
        onAddContact={() => setShowAddModal(true)}
      />

      {/* Col 2 — Focus */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {selectedContact ? (
          <div className="max-w-xl mx-auto px-6 py-8">
            <div className="flex items-center gap-4">
              <span
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-semibold shrink-0"
                style={{ backgroundColor: selectedContact.avatarColor || '#6366f1' }}
              >
                {selectedContact.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                  {selectedContact.name}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                  {selectedContact.role || 'Contact'}
                  {selectedContact.company ? ` · ${selectedContact.company}` : ''}
                </p>
              </div>
            </div>

            {/* The Phase-1 ChannelRow, now in its real home (the Focus pane). */}
            <div className="mt-6">
              <div
                className="text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500 mb-2"
                style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
              >
                Your next touch
              </div>
              <ChannelRow
                contact={selectedContact}
                emailEnabled={features.emailEnabled}
                onAction={onAction}
                onNote={handleNote}
              />
            </div>

            <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
              Cadence spine, cross-channel timeline, contact info, groups, and AI context arrive in
              Phase 3.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 text-zinc-400 dark:text-zinc-500">
            <p className="text-sm">Select a contact to focus.</p>
            <p className="text-xs mt-1">
              {filteredContacts.length} of {counts.total} shown.
            </p>
          </div>
        )}
      </div>

      {/* Col 3 — Co-pilot (placeholder until Phase 4) */}
      <div
        className="hidden xl:flex flex-col w-[320px] shrink-0 border-l p-4"
        style={{ borderColor: 'var(--pulse-border)', background: 'var(--pulse-canvas)' }}
      >
        <div
          className="text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500"
          style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
        >
          Pulse AI
        </div>
        <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">
          The AI co-pilot rail — Suggested + drafted opener, relationship alerts, and the Route
          hint — arrives in Phase 4.
        </p>
      </div>

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
    </div>
  );
};

export default ContactsHybridPeople;
