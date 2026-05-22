import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Contact } from '../../types';
import { AddContactModal } from './AddContactModal';
import { EditContactModal } from './EditContactModal';
import { useRelationshipIntelligence } from '../../hooks/useRelationshipIntelligence';
import { RelationshipAlertsFeed } from './RelationshipAlertsFeed';
import { DuplicateDetectionModal } from './DuplicateDetectionModal';
import { SmartListType, RelationshipProfile, LeadScore, getRelationshipHealthColor } from '../../types/relationshipTypes';
import { ContactDetail } from './ContactDetail';
import { supabase } from '../../services/supabase';
import { dataService } from '../../services/dataService';
import { getCircles } from '../../services/contactCircleService';
import type { ContactCircle } from '../../types/contactCircleTypes';
import { useWorkspaceData, useWorkspacePermissions } from '../../contexts/WorkspaceContext';
import { shareContactsToWorkspace } from '../../services/workspaceContactsService';
import {
  applyFilterPredicate,
  createSavedFilter,
  deleteSavedFilter,
  listSavedFilters,
  updateSavedFilter,
  type FilterPredicate,
  type SavedFilter,
} from '../../services/savedFiltersService';
import { ArchivedToggle } from './ArchivedToggle';
import { BulkActionToolbar } from './BulkActionToolbar';
import { ProvenanceChip, type ContactProvenanceSource } from './ProvenanceChip';
import { SavedFiltersPanel } from './SavedFiltersPanel';
import { WorkspaceShareModal } from './WorkspaceShareModal';
import { NamePromptModal } from './NamePromptModal';
import { ReceivedTab } from './cards/ReceivedTab';
import { ShareCardModal } from './cards/ShareCardModal';
import { ShareCardBundleModal } from './cards/ShareCardBundleModal';
import { SentCardsView } from './cards/SentCardsView';
import { FindTeammatesSheet } from './FindTeammatesSheet';
import type { DiscoveredPulseUser } from '../../services/pulseUserDiscoveryService';
import './Contacts.css';

import { ArrowDown, ArrowUp, Bell, Building2, Check, ChevronDown, ChevronRight, Clock, Copy, Flame, LayoutGrid, List, MessageSquare, Moon, Network, Plus, Radio, RefreshCw, Search, Snowflake, Star, UserPlus, UserSearch, UserX, Users, Video, Wand2, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface ContactsRedesignedProps {
  contacts: Contact[];
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onSyncComplete?: (newContacts: Contact[]) => void;
  onUpdateContact?: (updatedContact: Contact) => void;
  onAddContact?: (contact: Omit<Contact, 'id'>) => Promise<Contact | null>;
  onDeleteContact?: (contactId: string) => Promise<boolean>;
  openAddContact?: boolean;
}

type ViewStyle = 'grid' | 'list';
type FilterStatus = 'all' | 'online' | 'offline';

interface SmartListConfig {
  id: SmartListType;
  label: string;
  Icon: LucideIcon;
}

// ============================================
// SMART LIST CONFIGURATION
// ============================================

// ============================================
// CONTACT FILTERING TAXONOMY (Phase D mental model)
// ============================================
// Pulse Contacts uses four distinct filtering surfaces. They overlap less
// than they look once their jobs are kept straight:
//
//   TAGS         User-applied labels. The user attaches a tag to a contact
//                via Edit Contact; the tag travels with the contact row.
//                Source of truth: contact.groups[].
//                Example: applying "Customer" to a list of contacts the
//                user manually triaged as customers.
//
//   SMART LISTS  System-computed filters. Pulse evaluates each list against
//                relationship profile data (last interaction, score,
//                trend) at render time. The user does not apply these to
//                anything; they read like a query.
//                Source of truth: RelationshipProfile[].
//                Example: "Warm Leads" returns profiles where score >= 60
//                and trend === 'rising', regardless of any tag.
//
//   SAVED FILTERS  User-saved predicates over tags + smart lists + circle
//                  membership. Live in savedFiltersService; can be
//                  workspace-scoped.
//
//   CIRCLES      A saved-filter-shape: user-curated groups with members
//                stored in contact_circles. In Phase D Circles were
//                demoted from a top-level tab to a Sidebar facet on People
//                (see Step 5 commit).
//
// Phase D collision fix: the "VIP" tag chip was removed from the
// hardcoded TAGS palette because "VIP Contacts" already exists as a
// smart list driven by RelationshipProfile.isVip. Users who still want a
// per-contact "starred" treatment can apply any tag in Edit Contact and
// filter via Saved Filters.

const SMART_LISTS: SmartListConfig[] = [
  { id: 'needs_follow_up', label: 'Needs Follow-up', Icon: Clock },
  { id: 'warm_leads', label: 'Warm Leads', Icon: Flame },
  { id: 'inactive_30_days', label: 'Inactive (30d)', Icon: Moon },
  { id: 'vip', label: 'VIP Contacts', Icon: Star },
  { id: 'cold_leads', label: 'Cold Leads', Icon: Snowflake },
  { id: 'recent_contacts', label: 'Recent', Icon: Zap },
];

const TAGS = [
  { id: 'prospect', label: 'Prospect', activeColor: '#3b82f6' },
  { id: 'customer', label: 'Customer', activeColor: '#10b981' },
  { id: 'partner', label: 'Partner', activeColor: '#a855f7' },
  { id: 'vendor', label: 'Vendor', activeColor: '#06b6d4' },
];

// ============================================
// SIDEBAR COMPONENT
// ============================================

interface SidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterStatus: FilterStatus;
  onFilterStatusChange: (status: FilterStatus) => void;
  filterTag: string | null;
  onFilterTagChange: (tag: string | null) => void;
  activeSmartList: SmartListType | null;
  onSmartListChange: (list: SmartListType | null) => void;
  counts: { total: number; online: number; offline: number };
  smartListCounts: Record<SmartListType, number>;
  alertCount: number;
  onViewAlerts: () => void;
  onAddContact: () => void;
  headerReplacement?: React.ReactNode;
  showArchived: boolean;
  archivedCount: number;
  onToggleArchived: (next: boolean) => void;
  savedFiltersPanel?: React.ReactNode;
  circles: ContactCircle[];
  activeCircleId: string | null;
  onCircleChange: (circleId: string | null) => void;
}

const SectionToggle: React.FC<{
  label: string;
  open: boolean;
  onToggle: () => void;
  title?: string;
}> = ({ label, open, onToggle, title }) => (
  <button
    type="button"
    onClick={onToggle}
    title={title}
    aria-expanded={open}
    className="contacts-section-title contacts-section-title--toggle"
  >
    <span>{label}</span>
    <ChevronDown
      size={12}
      className="contacts-section-toggle-chevron"
      data-open={open ? 'true' : 'false'}
      aria-hidden="true"
    />
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterTag,
  onFilterTagChange,
  activeSmartList,
  onSmartListChange,
  counts,
  smartListCounts,
  alertCount,
  onViewAlerts,
  onAddContact,
  headerReplacement,
  showArchived,
  archivedCount,
  onToggleArchived,
  savedFiltersPanel,
  circles,
  activeCircleId,
  onCircleChange,
}) => {
  // Collapsible state per section. Default open; persisted to
  // localStorage so the operator's choice survives reloads.
  const readLs = (k: string, fallback: boolean): boolean => {
    try {
      const v = localStorage.getItem(`pulse_contacts_section_${k}`);
      return v === null ? fallback : v === '1';
    } catch {
      return fallback;
    }
  };
  const writeLs = (k: string, v: boolean) => {
    try { localStorage.setItem(`pulse_contacts_section_${k}`, v ? '1' : '0'); } catch { /* ignore */ }
  };
  const [tagsOpen, setTagsOpen] = useState(() => readLs('tags', true));
  const [smartListsOpen, setSmartListsOpen] = useState(() => readLs('smart_lists', true));
  const [circlesOpen, setCirclesOpen] = useState(() => readLs('circles', true));

  const toggleTags = () => { setTagsOpen(v => { writeLs('tags', !v); return !v; }); };
  const toggleSmartLists = () => { setSmartListsOpen(v => { writeLs('smart_lists', !v); return !v; }); };
  const toggleCircles = () => { setCirclesOpen(v => { writeLs('circles', !v); return !v; }); };

  return (
  <div className="contacts-sidebar">
    {headerReplacement ? (
      headerReplacement
    ) : (
      <div className="contacts-sidebar-header">
        <div className="contacts-sidebar-title">
          <Network />
          <span>Network</span>
        </div>
        <div className="contacts-search">
          <Search className="contacts-search-icon" />
          <input
            type="text"
            className="contacts-search-input"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            data-contacts-search
          />
        </div>
      </div>
    )}

    {/* Scroll region holds every section. The Add Contact button
        lives in a sibling footer below so it stays pinned. */}
    <div className="contacts-sidebar-scroll">
    <div className="contacts-sidebar-section">
      <div className="contacts-section-title">Overview</div>
      <button
        className={`contacts-filter-btn ${filterStatus === 'all' && !activeSmartList ? 'active' : ''}`}
        onClick={() => { onFilterStatusChange('all'); onSmartListChange(null); }}
      >
        <div className="contacts-filter-btn-content">
          <div className="contacts-filter-btn-icon">
            <Users />
          </div>
          <span className="contacts-filter-btn-label">All Contacts</span>
        </div>
        <span className="contacts-filter-btn-count">{counts.total}</span>
      </button>

      <button
        className={`contacts-filter-btn ${filterStatus === 'online' && !activeSmartList ? 'active' : ''}`}
        onClick={() => { onFilterStatusChange('online'); onSmartListChange(null); }}
      >
        <div className="contacts-filter-btn-content">
          <div className="contacts-status-dot online" />
          <span className="contacts-filter-btn-label">Online Now</span>
        </div>
        <span className="contacts-filter-btn-count">{counts.online}</span>
      </button>

      <ArchivedToggle
        showArchived={showArchived}
        archivedCount={archivedCount}
        onToggle={onToggleArchived}
      />
    </div>

    {/* Tags Section */}
    <div className="contacts-sidebar-section">
      <SectionToggle
        label="Tags"
        open={tagsOpen}
        onToggle={toggleTags}
        title="Labels you apply to contacts in Edit Contact."
      />
      {tagsOpen && TAGS.map((tag) => {
        const isActive = filterTag === tag.id;
        return (
          <button
            key={tag.id}
            className={`contacts-filter-btn ${isActive ? 'active' : ''}`}
            onClick={() => {
              onFilterTagChange(isActive ? null : tag.id);
              onSmartListChange(null);
            }}
          >
            <div className="contacts-filter-btn-content">
              <div
                className="contacts-tag-dot"
                style={{ backgroundColor: isActive ? tag.activeColor : 'currentColor' }}
              />
              <span className="contacts-filter-btn-label">{tag.label}</span>
            </div>
          </button>
        );
      })}
    </div>

    {/* Alerts Banner */}
    {alertCount > 0 && (
      <div className="contacts-sidebar-section" style={{ paddingTop: 0 }}>
        <button
          onClick={onViewAlerts}
          className="contacts-filter-btn active"
          style={{
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(234, 179, 8, 0.1))',
            border: '1px solid rgba(249, 115, 22, 0.2)',
          }}
        >
          <div className="contacts-filter-btn-content">
            <div className="contacts-filter-btn-icon" style={{ background: 'rgba(249, 115, 22, 0.2)' }}>
              <Bell />
            </div>
            <span className="contacts-filter-btn-label" style={{ color: '#f97316' }}>
              {alertCount} Alert{alertCount !== 1 ? 's' : ''}
            </span>
          </div>
          <ChevronRight />
        </button>
      </div>
    )}

    {/* Smart Lists Section */}
    <div className="contacts-sidebar-section">
      <SectionToggle
        label="Smart Lists"
        open={smartListsOpen}
        onToggle={toggleSmartLists}
        title="System-computed lists. Pulse evaluates relationship data at render time. Not user-edited."
      />
      {smartListsOpen && SMART_LISTS.map((list) => {
        const ListIcon = list.Icon;
        return (
          <button
            key={list.id}
            className={`contacts-smart-list ${activeSmartList === list.id ? 'active' : ''}`}
            onClick={() => onSmartListChange(activeSmartList === list.id ? null : list.id)}
          >
            <div className="contacts-smart-list-icon">
              <ListIcon size={14} />
            </div>
            <span className="contacts-smart-list-label">{list.label}</span>
            <span className="contacts-smart-list-count">{smartListCounts[list.id] || 0}</span>
          </button>
        );
      })}
    </div>

    {/* Circles facet — demoted from a top-level tab in Phase D.
        Click a circle to filter the contact list to its members.
        Auto-detect is exposed in the section header. */}
    {circles.length > 0 && (
      <div className="contacts-sidebar-section">
        <SectionToggle
          label="Circles"
          open={circlesOpen}
          onToggle={toggleCircles}
          title="User-curated groups. Click to filter People to a circle's members."
        />
        {circlesOpen && circles.map(circle => {
          const isActive = activeCircleId === circle.id;
          return (
            <button
              key={circle.id}
              className={`contacts-smart-list ${isActive ? 'active' : ''}`}
              onClick={() => onCircleChange(isActive ? null : circle.id)}
              title={circle.name}
            >
              <span
                className="contacts-smart-list-icon"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: circle.color || 'var(--pulse-tone-neutral)',
                    display: 'inline-block',
                  }}
                />
              </span>
              <span className="contacts-smart-list-label">{circle.name}</span>
              <span className="contacts-smart-list-count">{circle.memberContactIds.length}</span>
            </button>
          );
        })}
      </div>
    )}

    {savedFiltersPanel}
    </div>{/* /.contacts-sidebar-scroll */}

    {/* Sticky footer keeps Add Contact in view regardless of how many
        sections expand above. */}
    <div className="contacts-sidebar-footer">
      <button className="contacts-add-btn" onClick={onAddContact}>
        <Plus />
        Add Contact
      </button>
    </div>
  </div>
  );
};

// ============================================
// NODE CARD COMPONENT
// ============================================

interface NodeCardProps {
  contact: Contact;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onToggleSelection: () => void;
  profile?: RelationshipProfile;
  leadScore?: LeadScore;
  onAction: (action: 'message' | 'vox' | 'meet') => void;
}

const NodeCard: React.FC<NodeCardProps> = ({
  contact,
  isSelected,
  isChecked,
  onSelect,
  onToggleSelection,
  profile,
  leadScore,
  onAction,
}) => {
  const healthColor = profile ? getRelationshipHealthColor(profile.relationshipScore) : '#6b7280';
  const provenanceSource = ((contact as Contact & { import_source?: ContactProvenanceSource }).import_source
    ?? (contact.source === 'google'
      ? 'google'
      : contact.source === 'local'
        ? 'manual'
        : contact.source === 'vision'
          ? 'logos-vision'
          : 'legacy')) as ContactProvenanceSource;

  return (
    <div
      className={`contacts-node ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <button
        type="button"
        className={`contacts-node-select ${isChecked ? 'is-checked' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleSelection();
        }}
        role="checkbox"
        aria-checked={isChecked}
        aria-label={`Select ${contact.name}`}
      >
        <span className="contacts-node-select__box">
          {isChecked && <Check size={14} aria-hidden="true" />}
        </span>
      </button>

      <div className="contacts-node-provenance">
        <ProvenanceChip
          variant="dot"
          source={provenanceSource}
          addedAt={(contact as Contact & { created_at?: string }).created_at}
        />
      </div>

      {/* Lead Grade Badge */}
      {leadScore && (
        <div className={`contacts-node-lead ${leadScore.leadGrade}`}>
          {leadScore.leadGrade}
        </div>
      )}

      {/* Avatar with Orbits + relationship health ring */}
      <div className="contacts-node-avatar">
        <div className="contacts-node-orbit inner" />
        <div className="contacts-node-orbit outer" />
        <div
          className="contacts-node-avatar-inner"
          style={{
            backgroundColor: contact.avatarColor || '#6366f1',
            boxShadow: profile
              ? `0 0 0 3px ${getRelationshipHealthColor(profile.relationshipScore)}`
              : undefined,
          }}
        >
          {contact.name.charAt(0)}
        </div>
        <div className={`contacts-node-status ${contact.status || 'offline'}`} />
        {profile?.isVip && (
          <div className="contacts-node-vip">
            <Star />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="contacts-node-info">
        <div className="contacts-node-name">{contact.name}</div>
        <div className="contacts-node-role">{contact.role || 'Contact'}</div>
        {contact.company && (
          <div className="contacts-node-company">
            <Building2 />
            {contact.company}
          </div>
        )}
        {provenanceSource === 'logos-vision' && (
          <div style={{ marginTop: 8 }}>
            <ProvenanceChip variant="chip" source="logos-vision" addedAt={null} />
          </div>
        )}
      </div>

      {/* Relationship Health */}
      {profile && (
        <div className="contacts-node-health">
          <div className="contacts-node-health-bar">
            <div className="contacts-node-health-track">
              <div
                className="contacts-node-health-fill"
                style={{
                  width: `${profile.relationshipScore}%`,
                  backgroundColor: healthColor,
                }}
              />
            </div>
            <span className="contacts-node-health-value" style={{ color: healthColor }}>
              {profile.relationshipScore}
            </span>
            {profile.relationshipTrend === 'rising' && (
              <span className="contacts-node-health-trend up">
                <ArrowUp />
              </span>
            )}
            {profile.relationshipTrend === 'falling' && (
              <span className="contacts-node-health-trend down">
                <ArrowDown />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="contacts-node-actions" onClick={(e) => e.stopPropagation()}>
        <button className="contacts-node-action" onClick={() => onAction('message')}>
          <MessageSquare />
        </button>
        <button className="contacts-node-action" onClick={() => onAction('vox')}>
          <Radio />
        </button>
        <button className="contacts-node-action" onClick={() => onAction('meet')}>
          <Video />
        </button>
      </div>
    </div>
  );
};

// ============================================
// LIST ROW COMPONENT
// ============================================

interface ListRowProps {
  contact: Contact;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  profile?: RelationshipProfile;
  leadScore?: LeadScore;
}

const ListRow: React.FC<ListRowProps> = ({
  contact,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
  profile,
  leadScore,
}) => {
  const healthColor = profile ? getRelationshipHealthColor(profile.relationshipScore) : '#6b7280';
  const provenanceSource = ((contact as Contact & { import_source?: ContactProvenanceSource }).import_source
    ?? (contact.source === 'google'
      ? 'google'
      : contact.source === 'local'
        ? 'manual'
        : contact.source === 'vision'
          ? 'logos-vision'
          : 'legacy')) as ContactProvenanceSource;

  return (
    <div
      className={`contacts-list-row ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div
        className={`contacts-list-checkbox ${isChecked ? 'checked' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleCheck(); }}
      >
        {isChecked && <Check />}
      </div>

      <div className="contacts-list-user">
        <div
          className="contacts-list-avatar"
          style={{
            backgroundColor: contact.avatarColor || '#6366f1',
            boxShadow: profile
              ? `0 0 0 2px ${getRelationshipHealthColor(profile.relationshipScore)}`
              : undefined,
          }}
        >
          {contact.name.charAt(0)}
          <div
            className="contacts-list-avatar-status"
            style={{
              backgroundColor:
                contact.status === 'online' ? 'var(--cnt-status-online)' :
                contact.status === 'busy' ? 'var(--cnt-status-busy)' :
                'var(--cnt-status-offline)'
            }}
          />
        </div>
        <div>
          <div className="contacts-list-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {contact.name}
            {provenanceSource === 'logos-vision' && (
              <ProvenanceChip variant="chip" source="logos-vision" addedAt={null} />
            )}
          </div>
          <div className="contacts-list-role">{contact.role || 'Contact'}</div>
        </div>
      </div>

      <div className="contacts-list-email">{contact.email || '-'}</div>

      <div className="contacts-list-company">{contact.company || '-'}</div>

      <div className="contacts-list-health">
        {profile ? (
          <>
            <div className="contacts-list-health-bar">
              <div
                className="contacts-list-health-fill"
                style={{
                  width: `${profile.relationshipScore}%`,
                  backgroundColor: healthColor,
                }}
              />
            </div>
            <span className="contacts-list-health-value">{profile.relationshipScore}</span>
          </>
        ) : (
          <span className="contacts-list-health-value" style={{ color: 'var(--cnt-text-muted)' }}>-</span>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        {leadScore ? (
          <span
            className={`contacts-node-lead ${leadScore.leadGrade}`}
            style={{ position: 'static', display: 'inline-block' }}
          >
            {leadScore.leadGrade}
          </span>
        ) : (
          <span style={{ color: 'var(--cnt-text-muted)', fontSize: 11 }}>-</span>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ContactsRedesigned: React.FC<ContactsRedesignedProps> = ({
  contacts,
  onAction,
  onSyncComplete,
  onUpdateContact,
  onAddContact,
  onDeleteContact,
  openAddContact,
}) => {
  const { t } = useTranslation();
  const { currentWorkspace, workspaces } = useWorkspaceData();
  const { isAdmin, isOwner } = useWorkspacePermissions();
  // State
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewStyle, setViewStyle] = useState<ViewStyle>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [activeSmartList, setActiveSmartList] = useState<SmartListType | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddChooser, setShowAddChooser] = useState(false);
  const [showFindTeammates, setShowFindTeammates] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedContacts, setArchivedContacts] = useState<Contact[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [bulkOperationInFlight, setBulkOperationInFlight] = useState(false);
  const [showWorkspaceShare, setShowWorkspaceShare] = useState(false);

  // Phase C — contact-card sharing
  const phaseCEnabled = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_CONTACTS_PHASE_C_ENABLED === 'true';
  type CardsView = 'people' | 'received' | 'sent';
  const [cardsView, setCardsView] = useState<CardsView>('people');
  const [pendingDeeplinkCardId, setPendingDeeplinkCardId] = useState<string | null>(null);
  const [shareCardSubject, setShareCardSubject] = useState<Contact | null>(null);
  const [showShareCardBundle, setShowShareCardBundle] = useState(false);

  const [circles, setCircles] = useState<ContactCircle[]>([]);
  const [activeCircleId, setActiveCircleId] = useState<string | null>(null);
  const [savedFilters, setSavedFilters] = useState<{ user: SavedFilter[]; workspace: SavedFilter[] }>({ user: [], workspace: [] });
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string | null>(null);
  const [orphanedConditionsByFilterId, setOrphanedConditionsByFilterId] = useState<Record<string, number>>({});
  const [namePromptState, setNamePromptState] = useState<{
    title: string;
    placeholder?: string;
    initialValue?: string;
    cta?: string;
    onSubmit: (name: string) => void;
  } | null>(null);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Phase D step 7: respond to events dispatched by TodayEmptyState
  // (routed through ContactsShell). Applies a smart-list filter on
  // arrival to People so the operator lands where the empty-state CTA
  // promised.
  useEffect(() => {
    const applyHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ list: SmartListType }>).detail;
      if (detail?.list) {
        setActiveSmartList(detail.list);
        setFilterTag(null);
      }
    };
    window.addEventListener('pulse:contacts:apply-smart-list', applyHandler);
    return () => {
      window.removeEventListener('pulse:contacts:apply-smart-list', applyHandler);
    };
  }, []);

  // Phase C: Capacitor Universal Link / App Link → Received tab handoff (R-6).
  // We coexist with main.tsx's existing OAuth deeplink listener — the
  // Capacitor App plugin supports multiple appUrlOpen handlers.
  useEffect(() => {
    if (!phaseCEnabled) return;
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    const CARD_URL_RE = /^https:\/\/go\.pulse\.logosvision\.org\/c\/([a-zA-Z0-9-]+)\/?$/;

    const wire = async () => {
      try {
        // Lazy import keeps web builds free of @capacitor/app dep churn.
        const capCore = await import('@capacitor/core').catch(() => null);
        const isNative = capCore?.Capacitor?.isNativePlatform?.();
        if (!isNative) return;
        const appMod = await import('@capacitor/app').catch(() => null);
        if (cancelled || !appMod?.App) return;
        const handle = await appMod.App.addListener('appUrlOpen', ({ url }: { url: string }) => {
          const match = url.match(CARD_URL_RE);
          if (!match) return;
          const token = match[1];
          setCardsView('received');
          setPendingDeeplinkCardId(token);
          // TODO(phase-6-review): when the user is signed-out at deeplink
          // time, queue the token until sign-in completes. For now we
          // store it and rely on ReceivedTab to noop when not authed.
        });
        cleanup = () => {
          // PluginListenerHandle.remove() returns a promise; safe to fire-and-forget.
          handle.remove?.().catch(() => undefined);
        };
      } catch (err) {
        console.warn('[ContactsRedesigned] Phase C deeplink wiring failed:', err);
      }
    };
    void wire();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [phaseCEnabled]);

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
      .catch(error => console.warn('[ContactsRedesigned] circles load failed:', error));
  }, [userId, contacts.length]);

  useEffect(() => {
    let cancelled = false;
    listSavedFilters(currentWorkspace?.id)
      .then(filters => {
        if (!cancelled) setSavedFilters(filters);
      })
      .catch(error => console.warn('[ContactsRedesigned] saved filters load failed:', error));
    return () => { cancelled = true; };
  }, [currentWorkspace?.id]);

  // Relationship Intelligence
  const {
    profiles,
    alerts,
    smartListCounts,
    duplicates,
    leadScores,
    isLoading: isLoadingIntelligence,
    getProfileByEmail,
    getLeadScoreByEmail,
    dismissAlert,
    snoozeAlert,
    handleAlertAction,
    mergeDuplicates,
    dismissDuplicate,
  } = useRelationshipIntelligence();

  // Profile maps
  const relationshipProfiles = useMemo(() => {
    const map = new Map<string, RelationshipProfile>();
    profiles.forEach(p => map.set(p.contactEmail, p));
    return map;
  }, [profiles]);

  // Open add contact modal when prop changes
  useEffect(() => {
    if (openAddContact) {
      setShowAddModal(true);
    }
  }, [openAddContact]);

  const baseContacts = showArchived ? archivedContacts : contacts;

  // Stats
  const counts = useMemo(() => ({
    total: baseContacts.length,
    online: baseContacts.filter(c => c.status === 'online').length,
    offline: baseContacts.filter(c => c.status === 'offline').length,
  }), [baseContacts]);

  // Filtering
  const filteredContacts = useMemo(() => {
    let result = baseContacts.filter(c => {
      // Search
      const matchesSearch = searchQuery === '' ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Status Filter
      if (filterStatus === 'online' && c.status !== 'online') return false;
      if (filterStatus === 'offline' && c.status !== 'offline') return false;

      // Tag Filter
      if (filterTag && !c.groups?.includes(filterTag)) return false;

      // Circle facet filter
      if (activeCircleId) {
        const circle = circles.find(cc => cc.id === activeCircleId);
        if (!circle || !circle.memberContactIds.includes(c.id)) return false;
      }

      return true;
    });

    // Smart List Filter
    if (activeSmartList) {
      const smartListEmails = new Set(
        profiles
          .filter(p => {
            switch (activeSmartList) {
              case 'needs_follow_up':
                return p.lastEmailSentAt && (!p.lastEmailReceivedAt || p.lastEmailSentAt > p.lastEmailReceivedAt);
              case 'warm_leads':
                return p.relationshipScore >= 60 && p.relationshipTrend === 'rising';
              case 'inactive_30_days':
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return p.lastInteractionAt && new Date(p.lastInteractionAt) < thirtyDaysAgo;
              case 'vip':
                return p.isVip;
              case 'cold_leads':
                return p.relationshipScore < 40 || p.relationshipTrend === 'falling';
              case 'recent_contacts':
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                return p.lastInteractionAt && new Date(p.lastInteractionAt) >= sevenDaysAgo;
              default:
                return true;
            }
          })
          .map(p => p.contactEmail)
      );
      result = result.filter(c => c.email && smartListEmails.has(c.email));
    }

    const activeFilter = [...savedFilters.user, ...savedFilters.workspace].find(filter => filter.id === activeSavedFilterId);
    if (activeFilter) {
      const knownCircleIds = new Set(circles.map(circle => circle.id));
      const knownTagUuids = new Set(baseContacts.flatMap(contact => contact.groups ?? []));
      const applied = applyFilterPredicate(activeFilter.predicate_json, result, knownCircleIds, knownTagUuids);
      result = applied.matched;
    }

    return result;
  }, [baseContacts, searchQuery, filterStatus, filterTag, activeSmartList, profiles, savedFilters, activeSavedFilterId, circles, activeCircleId]);

  useEffect(() => {
    const knownCircleIds = new Set(circles.map(circle => circle.id));
    const knownTagUuids = new Set(baseContacts.flatMap(contact => contact.groups ?? []));
    const next: Record<string, number> = {};
    [...savedFilters.user, ...savedFilters.workspace].forEach(filter => {
      next[filter.id] = applyFilterPredicate(filter.predicate_json, baseContacts, knownCircleIds, knownTagUuids).orphanedConditions;
    });
    setOrphanedConditionsByFilterId(next);
  }, [baseContacts, circles, savedFilters]);

  // Handlers
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      window.dispatchEvent(new CustomEvent('pulse:contacts:open-connect-modal'));
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  useEffect(() => {
    if (selectedIds.size === 0) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedIds(new Set());
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size]);

  const refreshAfterBulkOperation = async () => {
    await refreshArchivedContacts();
    const nextContacts = await dataService.getContacts();
    onSyncComplete?.(nextContacts);
  };

  const selectedIdList = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const affectsCircle = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const selected = selectedIds;
    const emptied = circles.find(circle =>
      circle.memberContactIds.length > 0 &&
      circle.memberContactIds.every(id => selected.has(id))
    );
    return emptied?.name ?? null;
  }, [circles, selectedIds]);

  const handleBulkArchive = async () => {
    if (bulkOperationInFlight || selectedIdList.length === 0) return;
    setBulkOperationInFlight(true);
    try {
      const result = await dataService.archiveContacts(selectedIdList);
      if (result.failed.length > 0) {
        toast.error(t('contacts.bulkToolbar.partial_failure', {
          succeeded: result.succeeded.length,
          failed: result.failed.length,
          total: selectedIdList.length,
        }));
      } else {
        toast.success(t('contacts.bulkToolbar.success_archived', { count: result.succeeded.length }));
      }
      setSelectedIds(new Set());
      await refreshAfterBulkOperation();
    } finally {
      setBulkOperationInFlight(false);
    }
  };

  const handleBulkRestore = async () => {
    if (bulkOperationInFlight || selectedIdList.length === 0) return;
    setBulkOperationInFlight(true);
    try {
      const result = await dataService.restoreContacts(selectedIdList);
      if (result.failed.length > 0) {
        toast.error(t('contacts.bulkToolbar.partial_failure', {
          succeeded: result.succeeded.length,
          failed: result.failed.length,
          total: selectedIdList.length,
        }));
      } else {
        toast.success(t('contacts.bulkToolbar.success_restored', { count: result.succeeded.length }));
      }
      setSelectedIds(new Set());
      await refreshAfterBulkOperation();
    } finally {
      setBulkOperationInFlight(false);
    }
  };

  const handleBulkDelete = async () => {
    if (bulkOperationInFlight || selectedIdList.length === 0) return;
    setBulkOperationInFlight(true);
    try {
      const result = await dataService.bulkDeleteContacts(selectedIdList);
      if (result.failed.length > 0) {
        toast.error(t('contacts.bulkToolbar.partial_failure', {
          succeeded: result.succeeded.length,
          failed: result.failed.length,
          total: selectedIdList.length,
        }));
      }
      setSelectedIds(new Set());
      await refreshAfterBulkOperation();
    } finally {
      setBulkOperationInFlight(false);
    }
  };

  const buildCurrentPredicate = (): FilterPredicate => ({
    search: searchQuery.trim() || undefined,
    archived: showArchived ? true : undefined,
  });

  const reloadSavedFilters = async () => {
    const filters = await listSavedFilters(currentWorkspace?.id);
    setSavedFilters(filters);
  };

  const handleSaveCurrentFilter = async (draft?: { name: string; scope: 'personal' | 'workspace' }) => {
    if (draft?.name) {
      await createSavedFilter({
        name: draft.name,
        predicate: buildCurrentPredicate(),
        workspaceId: draft.scope === 'workspace' ? currentWorkspace?.id : undefined,
      });
      await reloadSavedFilters();
      return;
    }
    setNamePromptState({
      title: t('contacts.savedFilters.save_dialog_title'),
      placeholder: t('contacts.savedFilters.save_dialog_name_placeholder'),
      cta: t('contacts.savedFilters.save_dialog_cta'),
      onSubmit: async (name) => {
        setNamePromptState(null);
        await createSavedFilter({
          name,
          predicate: buildCurrentPredicate(),
          workspaceId: undefined,
        });
        await reloadSavedFilters();
      },
    });
  };

  const handleEditSavedFilter = async (id: string) => {
    const filter = [...savedFilters.user, ...savedFilters.workspace].find(item => item.id === id);
    if (!filter) return;
    setNamePromptState({
      title: t('contacts.savedFilters.save_dialog_title'),
      placeholder: t('contacts.savedFilters.save_dialog_name_placeholder'),
      initialValue: filter.name,
      cta: t('contacts.savedFilters.save_dialog_cta'),
      onSubmit: async (name) => {
        setNamePromptState(null);
        if (!name || name === filter.name) return;
        await updateSavedFilter(id, { name });
        await reloadSavedFilters();
      },
    });
  };

  const handleDeleteSavedFilter = async (id: string) => {
    await deleteSavedFilter(id);
    if (activeSavedFilterId === id) setActiveSavedFilterId(null);
    await reloadSavedFilters();
  };

  const handleShareToWorkspace = async (workspaceId: string) => {
    const result = await shareContactsToWorkspace(selectedIdList, workspaceId);
    const workspaceName = workspaces.find(workspace => workspace.id === workspaceId)?.name ?? '';
    if (result.failed.length > 0) {
      toast.error(t('contacts.bulkToolbar.partial_failure', {
        succeeded: result.succeeded.length,
        failed: result.failed.length,
        total: selectedIdList.length,
      }));
    } else {
      toast.success(t('contacts.bulkToolbar.success_shared', { count: result.succeeded.length, workspace: workspaceName }));
    }
    setShowWorkspaceShare(false);
    setSelectedIds(new Set());
    await refreshAfterBulkOperation();
    return { shared: result.succeeded.length, failed: result.failed.length };
  };

  const handleAddContactWrapper = async (newContact: Omit<Contact, 'id'>) => {
    if (onAddContact) {
      await onAddContact(newContact);
    }
  };

  const handleEditContact = (contact: Contact) => {
    setContactToEdit(contact);
    setShowEditModal(true);
  };

  const handleSaveContact = async (updatedContact: Contact) => {
    if (onUpdateContact) {
      onUpdateContact(updatedContact);
    }
    if (selectedContact?.id === updatedContact.id) {
      setSelectedContact(updatedContact);
    }
  };

  const selectedProfile = selectedContact?.email ? getProfileByEmail(selectedContact.email) : null;
  const selectedLeadScore = selectedContact?.email ? getLeadScoreByEmail(selectedContact.email) : null;
  const canDelete = !!onDeleteContact || selectedIds.size > 0;

  return (
    <div className="contacts-container">
      {/* Sidebar */}
      <Sidebar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        filterTag={filterTag}
        onFilterTagChange={setFilterTag}
        activeSmartList={activeSmartList}
        onSmartListChange={setActiveSmartList}
        counts={counts}
        smartListCounts={smartListCounts || {
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
        }}
        alertCount={alerts.length}
        onViewAlerts={() => setShowAlertsPanel(true)}
        onAddContact={() => setShowAddChooser(true)}
        showArchived={showArchived}
        archivedCount={archivedCount}
        onToggleArchived={(next) => {
          setShowArchived(next);
          setSelectedIds(new Set());
          setActiveSavedFilterId(null);
        }}
        headerReplacement={selectedIds.size > 0 ? (
          <BulkActionToolbar
            selectedCount={selectedIds.size}
            onClearSelection={() => setSelectedIds(new Set())}
            onShare={() => setShowWorkspaceShare(true)}
            onShareAsCard={phaseCEnabled ? () => {
              // selectedCount === 1 → single-card flow; otherwise bundle.
              if (selectedIds.size === 1) {
                const onlyId = Array.from(selectedIds)[0];
                const subject = baseContacts.find(c => c.id === onlyId);
                if (subject) setShareCardSubject(subject);
              } else {
                setShowShareCardBundle(true);
              }
            } : undefined}
            canShareAsCard={phaseCEnabled}
            onArchive={handleBulkArchive}
            onUnarchive={handleBulkRestore}
            onDelete={handleBulkDelete}
            onSaveAsFilter={() => handleSaveCurrentFilter()}
            canShare={!!currentWorkspace && selectedIds.size >= 2}
            canDelete
            isInArchivedView={showArchived}
            affectsCircle={affectsCircle}
          />
        ) : undefined}
        savedFiltersPanel={(
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
        )}
        circles={circles}
        activeCircleId={activeCircleId}
        onCircleChange={setActiveCircleId}
      />

      {/* Main Content */}
      <div className="contacts-main">

        {/* Phase C — tab strip (People · Received · Sent).
            Tab order per vision § IA: 4th tab "Received" sits to the right
            of the existing People view. Sent Cards lives in Settings →
            Activity in production; we surface it here as a sibling for now
            since the Pulse settings shell isn't restructured for this. */}
        {phaseCEnabled && (
          <div
            role="tablist"
            aria-label={t('contacts.tabs.received_label')}
            className="flex items-center gap-1 px-4 pt-3"
            style={{ borderBottom: '1px solid var(--pulse-border)' }}
          >
            <button
              role="tab"
              type="button"
              aria-selected={cardsView === 'people'}
              onClick={() => setCardsView('people')}
              className="rounded-t-lg px-3 py-2 text-sm font-medium"
              style={{
                minHeight: 44,
                background: cardsView === 'people' ? 'var(--pulse-surface-raised)' : 'transparent',
                color: cardsView === 'people' ? 'var(--pulse-ink)' : 'var(--pulse-ink-2)',
                borderBottom: cardsView === 'people' ? '2px solid var(--pulse-rose)' : '2px solid transparent',
              }}
            >
              People
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={cardsView === 'received'}
              onClick={() => {
                setCardsView('received');
                setPendingDeeplinkCardId(null);
              }}
              className="inline-flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-medium"
              style={{
                minHeight: 44,
                background: cardsView === 'received' ? 'var(--pulse-surface-raised)' : 'transparent',
                color: cardsView === 'received' ? 'var(--pulse-ink)' : 'var(--pulse-ink-2)',
                borderBottom: cardsView === 'received' ? '2px solid var(--pulse-rose)' : '2px solid transparent',
              }}
            >
              {t('contacts.tabs.received_label')}
              {/* Phase C coral exception per magi D-5 — signal-of-pending, not AI provenance.
                  Badge count is wired to the live fetchReceived call in ReceivedTab;
                  for the parent tab strip we show the badge when ReceivedTab posts a
                  count. TODO(phase-6-review): lift the count into a shared hook so the
                  badge reflects unread without double-fetch. */}
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={cardsView === 'sent'}
              onClick={() => setCardsView('sent')}
              className="rounded-t-lg px-3 py-2 text-sm font-medium"
              style={{
                minHeight: 44,
                background: cardsView === 'sent' ? 'var(--pulse-surface-raised)' : 'transparent',
                color: cardsView === 'sent' ? 'var(--pulse-ink)' : 'var(--pulse-ink-2)',
                borderBottom: cardsView === 'sent' ? '2px solid var(--pulse-rose)' : '2px solid transparent',
              }}
            >
              Sent cards
            </button>
          </div>
        )}

        {/* Phase C Received view */}
        {phaseCEnabled && cardsView === 'received' && (
          <ReceivedTab
            onOpenSentCards={() => setCardsView('sent')}
            onOpenCard={cardId => {
              setPendingDeeplinkCardId(cardId);
              // TODO(phase-6-review): wire to a real detail route. The current
              // pattern reuses the right-pane ContactDetail for People; the
              // received-card detail (ReceivedCardDetail) is rendered inside
              // ReceivedTab in a follow-up pass when the routing approach
              // settles. For now, the deeplink target is staged in state.
            }}
          />
        )}
        {phaseCEnabled && cardsView === 'sent' && (
          <SentCardsView onBack={() => setCardsView('received')} />
        )}

        {/* Default People surface (existing Phase A/B) */}
        {(!phaseCEnabled || cardsView === 'people') && (<>

        {/* Top Bar */}
        <div className="contacts-topbar">
          <div className="contacts-topbar-left">
            <div className="contacts-topbar-stats">
              <div className="contacts-stat">
                <span className="contacts-stat-value">{filteredContacts.length}</span>
                <span>contacts</span>
              </div>
              {activeSmartList && (
                <button
                  type="button"
                  className="contacts-stat contacts-stat-filter"
                  onClick={() => setActiveSmartList(null)}
                  aria-label={`Clear filter: ${SMART_LISTS.find(l => l.id === activeSmartList)?.label}`}
                >
                  <Wand2 />
                  <span>
                    {SMART_LISTS.find(l => l.id === activeSmartList)?.label}
                  </span>
                  <X />
                </button>
              )}
            </div>
          </div>

          <div className="contacts-topbar-right">
            <div className="contacts-view-toggle">
              <button
                className={`contacts-view-btn ${viewStyle === 'grid' ? 'active' : ''}`}
                onClick={() => setViewStyle('grid')}
              >
                <LayoutGrid />
              </button>
              <button
                className={`contacts-view-btn ${viewStyle === 'list' ? 'active' : ''}`}
                onClick={() => setViewStyle('list')}
              >
                <List />
              </button>
            </div>

            <button
              className={`contacts-action-btn ${isSyncing ? 'syncing' : ''}`}
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw />
            </button>
          </div>
        </div>

        {/* Duplicates Alert */}
        {duplicates.length > 0 && (
          <div
            style={{
              padding: '12px 24px',
              background: 'rgba(234, 179, 8, 0.1)',
              borderBottom: '1px solid rgba(234, 179, 8, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Copy />
              <span style={{ fontSize: 13, color: '#eab308' }}>
                {duplicates.length} potential duplicate{duplicates.length !== 1 ? 's' : ''} detected
              </span>
            </div>
            <button
              onClick={() => setShowDuplicatesModal(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#eab308',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Review & Merge
            </button>
          </div>
        )}

        {/* Content */}
        {filteredContacts.length === 0 ? (
          baseContacts.length === 0 ? (
            <div className="contacts-empty contacts-empty--first-run">
              <div className="contacts-empty-eyebrow">YOUR NETWORK</div>
              <h2 className="contacts-empty-headline">Build your network</h2>
              <p className="contacts-empty-lede">
                Add a contact or sync from Google. Pulse turns it into Smart Lists,
                relationship health, and follow-up nudges.
              </p>
              <div className="contacts-empty-actions">
                <button
                  type="button"
                  className="contacts-empty-cta contacts-empty-cta--primary"
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus size={16} />
                  Add a contact
                </button>
                <button
                  type="button"
                  className="contacts-empty-cta contacts-empty-cta--secondary"
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  <RefreshCw size={16} className={isSyncing ? 'contacts-empty-syncing' : ''} />
                  {isSyncing ? 'Syncing…' : 'Sync from Google'}
                </button>
              </div>
              <ul className="contacts-empty-perks">
                <li><Wand2 size={12} /> Smart Lists auto-group warm leads, follow-ups, and inactive ties</li>
                <li><Bell size={12} /> Alerts surface relationships that need attention</li>
                <li><MessageSquare size={12} /> One-tap reach via Messages, Relay, or Glimpse</li>
              </ul>
            </div>
          ) : (
            <div className="contacts-empty">
              <div className="contacts-empty-icon">
                <UserX />
              </div>
              <div className="contacts-empty-title">No matches</div>
              <div className="contacts-empty-desc">
                Adjust your search or clear filters to see more contacts.
              </div>
            </div>
          )
        ) : viewStyle === 'grid' ? (
          <div className="contacts-grid">
            <div className="contacts-grid-inner">
              {filteredContacts.map((contact, index) => (
                <NodeCard
                  key={contact.id}
                  contact={contact}
                  isSelected={selectedContact?.id === contact.id}
                  isChecked={selectedIds.has(contact.id)}
                  onSelect={() => setSelectedContact(contact)}
                  onToggleSelection={() => handleToggleSelection(contact.id)}
                  profile={relationshipProfiles.get(contact.email || '')}
                  leadScore={leadScores.get(contact.email || '')}
                  onAction={(action) => onAction(action, contact.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="contacts-list">
            <div className="contacts-list-header">
              <div>
                {(() => {
                  const allChecked = filteredContacts.length > 0 && filteredContacts.every(c => selectedIds.has(c.id));
                  const someChecked = filteredContacts.some(c => selectedIds.has(c.id)) && !allChecked;
                  return (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={allChecked ? true : someChecked ? 'mixed' : false}
                      title={allChecked ? 'Clear selection' : 'Select all visible'}
                      onClick={() => {
                        setSelectedIds(prev => {
                          if (allChecked) {
                            const next = new Set(prev);
                            filteredContacts.forEach(c => next.delete(c.id));
                            return next;
                          }
                          const next = new Set(prev);
                          filteredContacts.forEach(c => next.add(c.id));
                          return next;
                        });
                      }}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: '1.5px solid var(--pulse-border-strong)',
                        background: allChecked || someChecked ? 'var(--pulse-rose)' : 'transparent',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                      }}
                    >
                      {allChecked ? <Check size={12} /> : someChecked ? <span style={{ width: 8, height: 2, background: '#fff', borderRadius: 1 }} /> : null}
                    </button>
                  );
                })()}
              </div>
              <div>Name</div>
              <div>Email</div>
              <div>Company</div>
              <div>Health</div>
              <div style={{ textAlign: 'center' }}>Lead</div>
            </div>
            {filteredContacts.map((contact) => (
              <ListRow
                key={contact.id}
                contact={contact}
                isSelected={selectedContact?.id === contact.id}
                isChecked={selectedIds.has(contact.id)}
                onSelect={() => setSelectedContact(contact)}
                onToggleCheck={() => handleToggleSelection(contact.id)}
                profile={relationshipProfiles.get(contact.email || '')}
                leadScore={leadScores.get(contact.email || '')}
              />
            ))}
          </div>
        )}
        </>)}
      </div>

      {/* Detail Panel */}
      {selectedContact && (
        <ContactDetail
          contact={selectedContact}
          userId={userId ?? undefined}
          relationshipProfile={selectedProfile}
          leadScore={selectedLeadScore}
          onClose={() => setSelectedContact(null)}
          onAction={(action) => onAction(action, selectedContact.id)}
          onEdit={() => handleEditContact(selectedContact)}
          onSendAsCard={phaseCEnabled ? (c) => setShareCardSubject(c) : undefined}
          onDelete={onDeleteContact ? async () => {
            const ok = await onDeleteContact(selectedContact.id);
            if (ok) setSelectedContact(null);
          } : undefined}
        />
      )}

      {/* Alerts Panel */}
      {showAlertsPanel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setShowAlertsPanel(false)}
        >
          <div
            style={{
              width: 400,
              background: 'var(--cnt-bg-secondary)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: 16,
              borderBottom: '1px solid var(--cnt-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--cnt-text-primary)' }}>
                <Bell />
                Relationship Alerts
              </span>
              <button
                onClick={() => setShowAlertsPanel(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--cnt-text-muted)',
                  cursor: 'pointer',
                  padding: 8,
                }}
              >
                <X />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              <RelationshipAlertsFeed
                alerts={alerts}
                onDismiss={dismissAlert}
                onSnooze={snoozeAlert}
                onAction={handleAlertAction}
                isLoading={isLoadingIntelligence}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <DuplicateDetectionModal
        isOpen={showDuplicatesModal}
        onClose={() => setShowDuplicatesModal(false)}
        duplicates={duplicates}
        onMerge={mergeDuplicates}
        onDismiss={dismissDuplicate}
        isLoading={isLoadingIntelligence}
      />

      <AddContactModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddContactWrapper}
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
        availableWorkspaces={workspaces.map(workspace => ({ id: workspace.id, name: workspace.name }))}
        onShare={handleShareToWorkspace}
        onCancel={() => setShowWorkspaceShare(false)}
      />

      <NamePromptModal
        isOpen={!!namePromptState}
        title={namePromptState?.title ?? ''}
        placeholder={namePromptState?.placeholder}
        initialValue={namePromptState?.initialValue}
        cta={namePromptState?.cta}
        onSubmit={(name) => namePromptState?.onSubmit(name)}
        onClose={() => setNamePromptState(null)}
      />

      {/* Add Contact chooser: lets the operator pick between
          importing from Google (re-opens ConnectContactsModal via the
          existing pulse:contacts:open-connect-modal event) and adding
          one manually (opens AddContactModal). Replaces the prior
          single-button-opens-manual-modal flow. */}
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
              {/* Tile #1 — Find teammates on Pulse (info-soft slot) */}
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
              {/* Tile #2 — Import from Google */}
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
              {/* Tile #3 — Add manually (reassigned to neutral-soft per palette §1.1) */}
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

      {/* Find teammates sheet — workspace-native Pulse user discovery */}
      <FindTeammatesSheet
        isOpen={showFindTeammates}
        onClose={() => setShowFindTeammates(false)}
        workspaceId={currentWorkspace?.id ?? ''}
        onAdd={async (user: DiscoveredPulseUser) => {
          await handleAddContactWrapper({
            name: user.display_name,
            email: '',
            role: user.shared_workspace_role,
            avatarColor: '#3b82f6',
            avatarUrl: user.avatar_url ?? undefined,
            status: (user.online_status as Contact['status']) ?? 'offline',
            source: 'local',
            pulseUserId: user.user_id,
          });
        }}
      />

      {/* Phase C — contact-card sharing modals (gated by feature flag) */}
      {phaseCEnabled && (
        <>
          <ShareCardModal
            open={Boolean(shareCardSubject)}
            contact={shareCardSubject}
            onCancel={() => setShareCardSubject(null)}
            onSent={() => {
              setShareCardSubject(null);
              setSelectedIds(new Set());
            }}
          />
          <ShareCardBundleModal
            open={showShareCardBundle}
            subjects={baseContacts.filter(c => selectedIds.has(c.id))}
            onCancel={() => setShowShareCardBundle(false)}
            onSent={() => {
              setShowShareCardBundle(false);
              setSelectedIds(new Set());
            }}
          />
        </>
      )}
    </div>
  );
};

export default ContactsRedesigned;
