import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Contact } from '../../types';
import { AddContactModal } from './AddContactModal';
import { EditContactModal } from './EditContactModal';
import { syncGoogleContacts } from '../../services/authService';
import { useRelationshipIntelligence } from '../../hooks/useRelationshipIntelligence';
import { RelationshipAlertsFeed } from './RelationshipAlertsFeed';
import { DuplicateDetectionModal } from './DuplicateDetectionModal';
import { SmartListType, RelationshipProfile, LeadScore, getRelationshipHealthColor } from '../../types/relationshipTypes';
import './Contacts.css';

// ============================================
// TYPES
// ============================================

interface ContactsRedesignedProps {
  contacts: Contact[];
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onSyncComplete?: (newContacts: Contact[]) => void;
  onUpdateContact?: (updatedContact: Contact) => void;
  onAddContact?: (contact: Omit<Contact, 'id'>) => Promise<Contact | null>;
  openAddContact?: boolean;
}

type ViewStyle = 'grid' | 'list';
type FilterStatus = 'all' | 'online' | 'offline';

interface SmartListConfig {
  id: SmartListType;
  label: string;
  icon: string;
  iconClass: string;
}

// ============================================
// SMART LIST CONFIGURATION
// ============================================

const SMART_LISTS: SmartListConfig[] = [
  { id: 'needs_follow_up', label: 'Needs Follow-up', icon: 'fa-clock', iconClass: 'follow-up' },
  { id: 'warm_leads', label: 'Warm Leads', icon: 'fa-fire', iconClass: 'warm' },
  { id: 'inactive_30_days', label: 'Inactive (30d)', icon: 'fa-moon', iconClass: 'inactive' },
  { id: 'vip', label: 'VIP Contacts', icon: 'fa-star', iconClass: 'vip' },
  { id: 'cold_leads', label: 'Cold Leads', icon: 'fa-snowflake', iconClass: 'cold' },
  { id: 'recent_contacts', label: 'Recent', icon: 'fa-bolt', iconClass: 'recent' },
];

const TAGS = [
  { id: 'vip', label: 'VIP', color: 'bg-amber-500' },
  { id: 'prospect', label: 'Prospect', color: 'bg-blue-500' },
  { id: 'customer', label: 'Customer', color: 'bg-emerald-500' },
  { id: 'partner', label: 'Partner', color: 'bg-purple-500' },
  { id: 'vendor', label: 'Vendor', color: 'bg-cyan-500' },
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
        <i className="fa-solid fa-circle-nodes" />
        <span>Network</span>
      </div>
      <div className="contacts-search">
        <i className="fa-solid fa-magnifying-glass contacts-search-icon" />
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
            <i className="fa-solid fa-users" />
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
      {TAGS.map((tag) => (
        <button
          key={tag.id}
          className={`contacts-filter-btn ${filterTag === tag.id ? 'active' : ''}`}
          onClick={() => {
            onFilterTagChange(filterTag === tag.id ? null : tag.id);
            onSmartListChange(null);
          }}
        >
          <div className="contacts-filter-btn-content">
            <div className={`contacts-status-dot ${tag.color}`} style={{ borderRadius: 4 }} />
            <span className="contacts-filter-btn-label">{tag.label}</span>
          </div>
        </button>
      ))}
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
              <i className="fa-solid fa-bell" style={{ color: '#f97316' }} />
            </div>
            <span className="contacts-filter-btn-label" style={{ color: '#f97316' }}>
              {alertCount} Alert{alertCount !== 1 ? 's' : ''}
            </span>
          </div>
          <i className="fa-solid fa-chevron-right" style={{ fontSize: 10, color: '#f97316' }} />
        </button>
      </div>
    )}

    {/* Smart Lists Section */}
    <div className="contacts-sidebar-section">
      <div className="contacts-section-title">Smart Lists</div>
      {SMART_LISTS.map((list) => (
        <button
          key={list.id}
          className={`contacts-smart-list ${activeSmartList === list.id ? 'active' : ''}`}
          onClick={() => onSmartListChange(activeSmartList === list.id ? null : list.id)}
        >
          <div className={`contacts-smart-list-icon ${list.iconClass}`}>
            <i className={`fa-solid ${list.icon}`} />
          </div>
          <span className="contacts-smart-list-label">{list.label}</span>
          <span className="contacts-smart-list-count">{smartListCounts[list.id] || 0}</span>
        </button>
      ))}
    </div>

    {/* Add Contact Button */}
    <button className="contacts-add-btn" onClick={onAddContact}>
      <i className="fa-solid fa-plus" />
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

      {/* Avatar with Orbits */}
      <div className="contacts-node-avatar">
        <div className="contacts-node-orbit inner" />
        <div className="contacts-node-orbit outer" />
        <div
          className="contacts-node-avatar-inner"
          style={{ backgroundColor: contact.avatarColor || '#6366f1' }}
        >
          {contact.name.charAt(0)}
        </div>
        <div className={`contacts-node-status ${contact.status || 'offline'}`} />
        {profile?.isVip && (
          <div className="contacts-node-vip">
            <i className="fa-solid fa-star" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="contacts-node-info">
        <div className="contacts-node-name">{contact.name}</div>
        <div className="contacts-node-role">{contact.role || 'Contact'}</div>
        {contact.company && (
          <div className="contacts-node-company">
            <i className="fa-solid fa-building" />
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
                <i className="fa-solid fa-arrow-up" />
              </span>
            )}
            {profile.relationshipTrend === 'falling' && (
              <span className="contacts-node-health-trend down">
                <i className="fa-solid fa-arrow-down" />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="contacts-node-actions" onClick={(e) => e.stopPropagation()}>
        <button className="contacts-node-action" onClick={() => onAction('message')}>
          <i className="fa-solid fa-message" />
        </button>
        <button className="contacts-node-action" onClick={() => onAction('vox')}>
          <i className="fa-solid fa-walkie-talkie" />
        </button>
        <button className="contacts-node-action" onClick={() => onAction('meet')}>
          <i className="fa-solid fa-video" />
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
        {isChecked && <i className="fa-solid fa-check" style={{ fontSize: 10 }} />}
      </div>

      <div className="contacts-list-user">
        <div className="contacts-list-avatar" style={{ backgroundColor: contact.avatarColor || '#6366f1' }}>
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
// DETAIL PANEL COMPONENT
// ============================================

interface DetailPanelProps {
  contact: Contact;
  profile?: RelationshipProfile | null;
  leadScore?: LeadScore | null;
  onClose: () => void;
  onAction: (action: 'message' | 'vox' | 'meet') => void;
  onEdit: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({
  contact,
  profile,
  leadScore,
  onClose,
  onAction,
  onEdit,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'ai'>('overview');
  const healthColor = profile ? getRelationshipHealthColor(profile.relationshipScore) : '#6b7280';

  return (
    <div className="contacts-detail">
      <div className="contacts-detail-header">
        <span className="contacts-detail-title">Contact Details</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="contacts-detail-close" onClick={onEdit}>
            <i className="fa-solid fa-pen" />
          </button>
          <button className="contacts-detail-close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      </div>

      <div className="contacts-detail-content">
        {/* Profile Section */}
        <div className="contacts-detail-profile">
          <div className="contacts-detail-avatar">
            <div className="contacts-detail-avatar-ring" />
            <div
              className="contacts-detail-avatar-inner"
              style={{ backgroundColor: contact.avatarColor || '#6366f1' }}
            >
              {contact.name.charAt(0)}
            </div>
            <div
              className="contacts-detail-avatar-status"
              style={{
                backgroundColor:
                  contact.status === 'online' ? 'var(--cnt-status-online)' :
                  contact.status === 'busy' ? 'var(--cnt-status-busy)' :
                  'var(--cnt-status-offline)'
              }}
            />
          </div>
          <div className="contacts-detail-name">{contact.name}</div>
          <div className="contacts-detail-role">{contact.role || 'Contact'}</div>
          {contact.company && (
            <div className="contacts-detail-company">
              <i className="fa-solid fa-building" />
              {contact.company}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="contacts-detail-actions">
          <button className="contacts-detail-action message" onClick={() => onAction('message')}>
            <i className="fa-solid fa-message" />
            <span>Message</span>
          </button>
          <button className="contacts-detail-action vox" onClick={() => onAction('vox')}>
            <i className="fa-solid fa-walkie-talkie" />
            <span>Vox</span>
          </button>
          <button className="contacts-detail-action meet" onClick={() => onAction('meet')}>
            <i className="fa-solid fa-video" />
            <span>Meet</span>
          </button>
        </div>

        {/* Relationship Health Card */}
        {profile && (
          <div className="contacts-detail-health">
            <div className="contacts-detail-health-header">
              <span className="contacts-detail-health-title">Relationship Health</span>
              <span className="contacts-detail-health-score" style={{ color: healthColor }}>
                {profile.relationshipScore}%
              </span>
            </div>
            <div className="contacts-detail-health-bar">
              <div
                className="contacts-detail-health-fill"
                style={{
                  width: `${profile.relationshipScore}%`,
                  backgroundColor: healthColor,
                }}
              />
            </div>
            <div className="contacts-detail-health-label">
              {profile.relationshipTrend === 'rising' && (
                <>
                  <i className="fa-solid fa-arrow-up" style={{ color: 'var(--cnt-status-online)' }} />
                  <span>Trending up</span>
                </>
              )}
              {profile.relationshipTrend === 'falling' && (
                <>
                  <i className="fa-solid fa-arrow-down" style={{ color: 'var(--cnt-status-busy)' }} />
                  <span>Trending down</span>
                </>
              )}
              {profile.relationshipTrend === 'stable' && (
                <>
                  <i className="fa-solid fa-minus" />
                  <span>Stable</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="contacts-detail-tabs">
          <button
            className={`contacts-detail-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`contacts-detail-tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </button>
          <button
            className={`contacts-detail-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 6 }} />
            AI
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="contacts-detail-section">
            <div className="contacts-detail-section-title">Contact Info</div>
            {contact.email && (
              <div className="contacts-detail-info-item">
                <div className="contacts-detail-info-icon">
                  <i className="fa-solid fa-envelope" />
                </div>
                <span className="contacts-detail-info-value">{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="contacts-detail-info-item">
                <div className="contacts-detail-info-icon">
                  <i className="fa-solid fa-phone" />
                </div>
                <span className="contacts-detail-info-value">{contact.phone}</span>
              </div>
            )}
            {contact.address && (
              <div className="contacts-detail-info-item">
                <div className="contacts-detail-info-icon">
                  <i className="fa-solid fa-location-dot" />
                </div>
                <span className="contacts-detail-info-value">{contact.address}</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="contacts-empty" style={{ padding: 24 }}>
            <div className="contacts-empty-icon" style={{ width: 48, height: 48, fontSize: 18 }}>
              <i className="fa-solid fa-clock-rotate-left" />
            </div>
            <div className="contacts-empty-title" style={{ fontSize: 14 }}>No Activity Yet</div>
            <div className="contacts-empty-desc" style={{ fontSize: 12 }}>
              Activity history will appear here
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          profile ? (
            <div className="contacts-detail-section">
              <div className="contacts-detail-section-title">AI Insights</div>
              <div style={{
                padding: 16,
                background: 'var(--cnt-bg-tertiary)',
                borderRadius: 12,
                fontSize: 13,
                color: 'var(--cnt-text-secondary)',
                lineHeight: 1.6,
              }}>
                {profile.isVip && (
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fa-solid fa-star" style={{ color: '#eab308' }} />
                    <span>VIP Contact - Prioritize engagement</span>
                  </div>
                )}
                {leadScore && leadScore.leadStatus === 'hot' && (
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fa-solid fa-fire" style={{ color: '#f97316' }} />
                    <span>Hot lead - High conversion potential</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa-solid fa-lightbulb" style={{ color: 'var(--cnt-accent-primary)' }} />
                  <span>Based on {profile.totalInteractions || 0} interactions</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="contacts-empty" style={{ padding: 24 }}>
              <div className="contacts-empty-icon" style={{ width: 48, height: 48, fontSize: 18 }}>
                <i className="fa-solid fa-wand-magic-sparkles" />
              </div>
              <div className="contacts-empty-title" style={{ fontSize: 14 }}>No Insights Yet</div>
              <div className="contacts-empty-desc" style={{ fontSize: 12 }}>
                AI insights will appear after interactions
              </div>
            </div>
          )
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
  openAddContact,
}) => {
  // State
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
                <div
                  className="contacts-stat"
                  style={{
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveSmartList(null)}
                >
                  <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#8b5cf6' }} />
                  <span style={{ color: '#8b5cf6' }}>
                    {SMART_LISTS.find(l => l.id === activeSmartList)?.label}
                  </span>
                  <i className="fa-solid fa-xmark" style={{ fontSize: 10, color: '#8b5cf6' }} />
                </div>
              )}
            </div>
          </div>

          <div className="contacts-topbar-right">
            <div className="contacts-view-toggle">
              <button
                className={`contacts-view-btn ${viewStyle === 'grid' ? 'active' : ''}`}
                onClick={() => setViewStyle('grid')}
              >
                <i className="fa-solid fa-grid-2" />
              </button>
              <button
                className={`contacts-view-btn ${viewStyle === 'list' ? 'active' : ''}`}
                onClick={() => setViewStyle('list')}
              >
                <i className="fa-solid fa-list" />
              </button>
            </div>

            <button
              className={`contacts-action-btn ${isSyncing ? 'syncing' : ''}`}
              onClick={handleSync}
              disabled={isSyncing}
            >
              <i className="fa-solid fa-arrows-rotate" />
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
              <i className="fa-solid fa-clone" style={{ color: '#eab308' }} />
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
          <div className="contacts-empty">
            <div className="contacts-empty-icon">
              <i className="fa-solid fa-user-slash" />
            </div>
            <div className="contacts-empty-title">No Contacts Found</div>
            <div className="contacts-empty-desc">
              {searchQuery ? 'Try adjusting your search or filters' : 'Add your first contact to get started'}
            </div>
          </div>
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
        <DetailPanel
          contact={selectedContact}
          profile={selectedProfile}
          leadScore={selectedLeadScore}
          onClose={() => setSelectedContact(null)}
          onAction={(action) => onAction(action, selectedContact.id)}
          onEdit={() => handleEditContact(selectedContact)}
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
                <i className="fa-solid fa-bell" style={{ color: '#f97316', marginRight: 8 }} />
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
                <i className="fa-solid fa-xmark" />
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
