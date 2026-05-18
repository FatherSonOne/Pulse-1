import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Contact } from '../../types';
import { AddContactModal } from './AddContactModal';
import { EditContactModal } from './EditContactModal';
import { syncGoogleContacts } from '../../services/authService';
import { useRelationshipIntelligence } from '../../hooks/useRelationshipIntelligence';
import { RelationshipAlertsFeed } from './RelationshipAlertsFeed';
import { DuplicateDetectionModal } from './DuplicateDetectionModal';
import { SmartListType, RelationshipProfile, LeadScore, getRelationshipHealthColor } from '../../types/relationshipTypes';
import { ContactDetail } from './ContactDetail';
import { supabase } from '../../services/supabase';
import { getContactInitial } from '../../utils/contactInitial';
import './Contacts.css';

import { ArrowDown, ArrowUp, Bell, Building2, Check, ChevronRight, Clock, Copy, Flame, LayoutGrid, List, MessageSquare, Moon, Network, Plus, Radio, RefreshCw, Search, Snowflake, Star, UserX, Users, Video, Wand2, X, Zap } from 'lucide-react';
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

const SMART_LISTS: SmartListConfig[] = [
  { id: 'needs_follow_up', label: 'Needs Follow-up', Icon: Clock },
  { id: 'warm_leads', label: 'Warm Leads', Icon: Flame },
  { id: 'inactive_30_days', label: 'Inactive (30d)', Icon: Moon },
  { id: 'vip', label: 'VIP Contacts', Icon: Star },
  { id: 'cold_leads', label: 'Cold Leads', Icon: Snowflake },
  { id: 'recent_contacts', label: 'Recent', Icon: Zap },
];

const TAGS = [
  { id: 'vip', label: 'VIP', activeColor: '#f59e0b' },
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
}

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
}) => (
  <div className="contacts-sidebar">
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
        />
      </div>
    </div>

    {/* Overview Section */}
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
    </div>

    {/* Tags Section */}
    <div className="contacts-sidebar-section">
      <div className="contacts-section-title">Tags</div>
      {TAGS.map((tag) => {
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

    {/* Alerts Banner — migrated from legacy orange RGBs to canonical
        --pulse-tone-warning tokens. Background and border honor light/dark
        via the same token, and the foreground rides off --pulse-tone-warning. */}
    {alertCount > 0 && (
      <div className="contacts-sidebar-section" style={{ paddingTop: 0 }}>
        <button
          onClick={onViewAlerts}
          className="contacts-filter-btn active"
          style={{
            background: 'var(--pulse-tone-warning-soft)',
            border: '1px solid var(--pulse-tone-warning-soft)',
          }}
        >
          <div className="contacts-filter-btn-content">
            <div
              className="contacts-filter-btn-icon"
              style={{ background: 'var(--pulse-tone-warning-soft)', color: 'var(--pulse-tone-warning)' }}
            >
              <Bell />
            </div>
            <span
              className="contacts-filter-btn-label"
              style={{ color: 'var(--pulse-tone-warning)' }}
            >
              {alertCount} Alert{alertCount !== 1 ? 's' : ''}
            </span>
          </div>
          <ChevronRight />
        </button>
      </div>
    )}

    {/* Smart Lists Section */}
    <div className="contacts-sidebar-section">
      <div className="contacts-section-title">Smart Lists</div>
      {SMART_LISTS.map((list) => {
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

    {/* Add Contact Button */}
    <button className="contacts-add-btn" onClick={onAddContact}>
      <Plus />
      Add Contact
    </button>
  </div>
);

// ============================================
// NODE CARD COMPONENT
// ============================================

interface NodeCardProps {
  contact: Contact;
  isSelected: boolean;
  onSelect: () => void;
  onToggleSelection: () => void;
  profile?: RelationshipProfile;
  leadScore?: LeadScore;
  onAction: (action: 'message' | 'vox' | 'meet') => void;
}

const NodeCard: React.FC<NodeCardProps> = ({
  contact,
  isSelected,
  onSelect,
  onToggleSelection,
  profile,
  leadScore,
  onAction,
}) => {
  const healthColor = profile ? getRelationshipHealthColor(profile.relationshipScore) : '#6b7280';

  return (
    <div
      className={`contacts-node ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
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
          aria-hidden="true"
          style={{
            backgroundColor: contact.avatarColor || '#6366f1',
            boxShadow: profile
              ? `0 0 0 3px ${getRelationshipHealthColor(profile.relationshipScore)}`
              : undefined,
          }}
        >
          {getContactInitial(contact.name)}
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

      {/* Quick Actions — always visible (dimmed at rest, full on hover/focus)
          for discoverability + keyboard a11y. Labels are sr-only spans
          referenced via aria-labelledby so browser translation tools can
          translate them (aria-label is not translated). */}
      <div
        className="contacts-node-actions"
        role="group"
        aria-label="Quick actions"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="contacts-node-action"
          aria-labelledby={`contact-action-msg-${contact.id}`}
          onClick={() => onAction('message')}
        >
          <span id={`contact-action-msg-${contact.id}`} className="sr-only">
            Message {contact.name}
          </span>
          <MessageSquare aria-hidden="true" />
        </button>
        <button
          type="button"
          className="contacts-node-action"
          aria-labelledby={`contact-action-vox-${contact.id}`}
          onClick={() => onAction('vox')}
        >
          <span id={`contact-action-vox-${contact.id}`} className="sr-only">
            Relay {contact.name}
          </span>
          <Radio aria-hidden="true" />
        </button>
        <button
          type="button"
          className="contacts-node-action"
          aria-labelledby={`contact-action-meet-${contact.id}`}
          onClick={() => onAction('meet')}
        >
          <span id={`contact-action-meet-${contact.id}`} className="sr-only">
            Meet with {contact.name}
          </span>
          <Video aria-hidden="true" />
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
          aria-hidden="true"
          style={{
            backgroundColor: contact.avatarColor || '#6366f1',
            boxShadow: profile
              ? `0 0 0 2px ${getRelationshipHealthColor(profile.relationshipScore)}`
              : undefined,
          }}
        >
          {getContactInitial(contact.name)}
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
          <div className="contacts-list-name">{contact.name}</div>
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

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

  // Stats
  const counts = useMemo(() => ({
    total: contacts.length,
    online: contacts.filter(c => c.status === 'online').length,
    offline: contacts.filter(c => c.status === 'offline').length,
  }), [contacts]);

  // Filtering
  const filteredContacts = useMemo(() => {
    let result = contacts.filter(c => {
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

    return result;
  }, [contacts, searchQuery, filterStatus, filterTag, activeSmartList, profiles]);

  // Handlers
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const googleContacts = await syncGoogleContacts();
      if (onSyncComplete) {
        onSyncComplete(googleContacts);
      }
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
          cold_leads: 0,
          recent_contacts: 0,
        }}
        alertCount={alerts.length}
        onViewAlerts={() => setShowAlertsPanel(true)}
        onAddContact={() => setShowAddModal(true)}
      />

      {/* Main Content */}
      <div className="contacts-main">
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
          contacts.length === 0 ? (
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
              <div />
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
    </div>
  );
};

export default ContactsRedesigned;
