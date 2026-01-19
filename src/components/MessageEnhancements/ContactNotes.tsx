import React, { useState, useMemo, useCallback } from 'react';

// Types
interface ContactNote {
  id: string;
  contactId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  category: 'general' | 'meeting' | 'preference' | 'important' | 'follow-up';
  isPinned: boolean;
  tags: string[];
}

interface ContactInteraction {
  id: string;
  contactId: string;
  type: 'message' | 'call' | 'meeting' | 'email' | 'file_shared';
  timestamp: Date;
  summary: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  duration?: number; // in minutes for calls/meetings
}

interface ContactProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  timezone?: string;
  preferredContactMethod?: 'message' | 'email' | 'call';
  communicationStyle?: 'formal' | 'casual' | 'brief';
  importantDates?: { label: string; date: Date }[];
  customFields?: { label: string; value: string }[];
}

interface ContactNotesProps {
  contactId: string;
  contactName: string;
  onNoteCreate?: (note: Omit<ContactNote, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onNoteUpdate?: (note: ContactNote) => void;
  onNoteDelete?: (noteId: string) => void;
}

// Mock data generators
const generateMockNotes = (contactId: string): ContactNote[] => [
  {
    id: 'n1',
    contactId,
    content: 'Prefers morning meetings before 11 AM. Very responsive on Slack.',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    category: 'preference',
    isPinned: true,
    tags: ['scheduling', 'communication']
  },
  {
    id: 'n2',
    contactId,
    content: 'Discussed Q2 roadmap priorities. Agreed to focus on mobile-first approach.',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    category: 'meeting',
    isPinned: false,
    tags: ['roadmap', 'mobile']
  },
  {
    id: 'n3',
    contactId,
    content: 'Birthday: March 15. Favorite coffee: Oat milk latte.',
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    category: 'general',
    isPinned: false,
    tags: ['personal']
  },
  {
    id: 'n4',
    contactId,
    content: 'IMPORTANT: Has final approval authority on all design decisions.',
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    category: 'important',
    isPinned: true,
    tags: ['approval', 'design']
  },
  {
    id: 'n5',
    contactId,
    content: 'Follow up on API documentation review by end of week.',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    category: 'follow-up',
    isPinned: false,
    tags: ['api', 'documentation']
  }
];

const generateMockInteractions = (contactId: string): ContactInteraction[] => [
  {
    id: 'i1',
    contactId,
    type: 'message',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    summary: 'Discussed project timeline adjustments',
    sentiment: 'positive'
  },
  {
    id: 'i2',
    contactId,
    type: 'meeting',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    summary: 'Weekly sync - reviewed sprint progress',
    sentiment: 'positive',
    duration: 30
  },
  {
    id: 'i3',
    contactId,
    type: 'file_shared',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    summary: 'Shared design mockups v2.pdf'
  },
  {
    id: 'i4',
    contactId,
    type: 'call',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    summary: 'Quick call about budget concerns',
    sentiment: 'neutral',
    duration: 15
  },
  {
    id: 'i5',
    contactId,
    type: 'message',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    summary: 'Resolved issue with login credentials',
    sentiment: 'positive'
  }
];

const generateMockProfile = (contactId: string, name: string | undefined): ContactProfile => ({
  id: contactId,
  name: name || 'Unknown Contact',
  email: `${(name || 'unknown').toLowerCase().replace(' ', '.')}@company.com`,
  phone: '+1 (555) 123-4567',
  company: 'Acme Corp',
  role: 'Product Manager',
  timezone: 'America/New_York',
  preferredContactMethod: 'message',
  communicationStyle: 'casual',
  importantDates: [
    { label: 'Birthday', date: new Date('2024-03-15') },
    { label: 'Work Anniversary', date: new Date('2024-06-01') }
  ],
  customFields: [
    { label: 'Department', value: 'Product' },
    { label: 'Reports To', value: 'Sarah Johnson' }
  ]
});

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#0a0a0f',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    padding: '12px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  tab: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.2s ease'
  },
  tabActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa'
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 20px'
  },
  profileSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px'
  },
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 600
  },
  profileInfo: {
    flex: 1
  },
  profileName: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#f1f5f9'
  },
  profileRole: {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '2px'
  },
  profileDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px'
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#94a3b8'
  },
  noteCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '10px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    position: 'relative' as const
  },
  noteHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  categoryBadge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const
  },
  noteContent: {
    fontSize: '13px',
    color: '#e2e8f0',
    lineHeight: 1.5,
    marginBottom: '10px'
  },
  noteMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  noteTags: {
    display: 'flex',
    gap: '4px'
  },
  tag: {
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    color: '#a78bfa',
    fontSize: '10px'
  },
  noteDate: {
    fontSize: '10px',
    color: '#64748b'
  },
  pinIcon: {
    position: 'absolute' as const,
    top: '10px',
    right: '10px',
    color: '#fbbf24',
    fontSize: '12px'
  },
  interactionItem: {
    display: 'flex',
    gap: '12px',
    padding: '12px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  interactionIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    flexShrink: 0
  },
  interactionContent: {
    flex: 1
  },
  interactionSummary: {
    fontSize: '13px',
    color: '#e2e8f0',
    marginBottom: '4px'
  },
  interactionMeta: {
    fontSize: '11px',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  addNoteButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px dashed rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '13px',
    marginTop: '12px',
    transition: 'all 0.2s ease'
  },
  newNoteForm: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '16px',
    border: '1px solid rgba(139, 92, 246, 0.3)'
  },
  textarea: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: '80px',
    marginBottom: '12px'
  },
  formActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  categorySelect: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#94a3b8',
    fontSize: '12px',
    cursor: 'pointer'
  },
  saveButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#8B5CF6',
    color: 'white',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500
  }
};

// Category colors
const categoryColors: Record<string, { bg: string; color: string }> = {
  general: { bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' },
  meeting: { bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' },
  preference: { bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399' },
  important: { bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171' },
  'follow-up': { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }
};

// Interaction type config
const interactionConfig: Record<string, { icon: string; bg: string; color: string }> = {
  message: { icon: 'fa-message', bg: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' },
  call: { icon: 'fa-phone', bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399' },
  meeting: { icon: 'fa-video', bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' },
  email: { icon: 'fa-envelope', bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' },
  file_shared: { icon: 'fa-file', bg: 'rgba(236, 72, 153, 0.2)', color: '#f472b6' }
};

// Format date
const formatDate = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Main Component
export const ContactNotes: React.FC<ContactNotesProps> = ({
  contactId,
  contactName,
  onNoteCreate,
  onNoteUpdate,
  onNoteDelete
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'history' | 'profile'>('notes');
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<ContactNote['category']>('general');

  const notes = useMemo(() => generateMockNotes(contactId), [contactId]);
  const interactions = useMemo(() => generateMockInteractions(contactId), [contactId]);
  const profile = useMemo(() => generateMockProfile(contactId, contactName), [contactId, contactName]);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }, [notes]);

  const handleSaveNote = useCallback(() => {
    if (newNoteContent.trim()) {
      onNoteCreate?.({
        contactId,
        content: newNoteContent,
        category: newNoteCategory,
        isPinned: false,
        tags: []
      });
      setNewNoteContent('');
      setShowNewNote(false);
    }
  }, [contactId, newNoteContent, newNoteCategory, onNoteCreate]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <i className="fa-solid fa-address-book" />
          Contact Details
        </div>
      </div>

      <div style={styles.tabs}>
        {[
          { id: 'notes' as const, label: 'Notes', count: notes.length },
          { id: 'history' as const, label: 'History', count: interactions.length },
          { id: 'profile' as const, label: 'Profile', count: null }
        ].map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== null && <span style={{ marginLeft: '6px', opacity: 0.6 }}>({tab.count})</span>}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {activeTab === 'notes' && (
          <>
            {showNewNote && (
              <div style={styles.newNoteForm}>
                <textarea
                  style={styles.textarea}
                  placeholder="Write a note about this contact..."
                  value={newNoteContent}
                  onChange={e => setNewNoteContent(e.target.value)}
                  autoFocus
                />
                <div style={styles.formActions}>
                  <select
                    style={styles.categorySelect}
                    value={newNoteCategory}
                    onChange={e => setNewNoteCategory(e.target.value as ContactNote['category'])}
                  >
                    <option value="general">General</option>
                    <option value="meeting">Meeting</option>
                    <option value="preference">Preference</option>
                    <option value="important">Important</option>
                    <option value="follow-up">Follow-up</option>
                  </select>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      style={{ ...styles.categorySelect, border: 'none' }}
                      onClick={() => setShowNewNote(false)}
                    >
                      Cancel
                    </button>
                    <button style={styles.saveButton} onClick={handleSaveNote}>
                      Save Note
                    </button>
                  </div>
                </div>
              </div>
            )}

            {sortedNotes.map(note => {
              const catStyle = categoryColors[note.category];
              return (
                <div key={note.id} style={styles.noteCard}>
                  {note.isPinned && (
                    <i className="fa-solid fa-thumbtack" style={styles.pinIcon} />
                  )}
                  <div style={styles.noteHeader}>
                    <span style={{
                      ...styles.categoryBadge,
                      backgroundColor: catStyle.bg,
                      color: catStyle.color
                    }}>
                      {note.category}
                    </span>
                  </div>
                  <div style={styles.noteContent}>{note.content}</div>
                  <div style={styles.noteMeta}>
                    <div style={styles.noteTags}>
                      {note.tags.map(tag => (
                        <span key={tag} style={styles.tag}>#{tag}</span>
                      ))}
                    </div>
                    <span style={styles.noteDate}>
                      {note.updatedAt.getTime() !== note.createdAt.getTime() ? 'Updated ' : ''}
                      {formatDate(note.updatedAt)}
                    </span>
                  </div>
                </div>
              );
            })}

            <button
              style={styles.addNoteButton}
              onClick={() => setShowNewNote(true)}
            >
              <i className="fa-solid fa-plus" />
              Add Note
            </button>
          </>
        )}

        {activeTab === 'history' && (
          <>
            {interactions.map(interaction => {
              const config = interactionConfig[interaction.type];
              return (
                <div key={interaction.id} style={styles.interactionItem}>
                  <div style={{
                    ...styles.interactionIcon,
                    backgroundColor: config.bg,
                    color: config.color
                  }}>
                    <i className={`fa-solid ${config.icon}`} />
                  </div>
                  <div style={styles.interactionContent}>
                    <div style={styles.interactionSummary}>{interaction.summary}</div>
                    <div style={styles.interactionMeta}>
                      <span>{formatDate(interaction.timestamp)}</span>
                      {interaction.duration && <span>• {interaction.duration} min</span>}
                      {interaction.sentiment && (
                        <span style={{
                          color: interaction.sentiment === 'positive' ? '#34d399' :
                                 interaction.sentiment === 'negative' ? '#f87171' : '#94a3b8'
                        }}>
                          • {interaction.sentiment}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {activeTab === 'profile' && (
          <>
            <div style={styles.profileSection}>
              <div style={styles.profileHeader}>
                <div style={styles.avatar}>
                  {profile.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={styles.profileInfo}>
                  <div style={styles.profileName}>{profile.name}</div>
                  <div style={styles.profileRole}>{profile.role} at {profile.company}</div>
                </div>
              </div>
              <div style={styles.profileDetails}>
                <div style={styles.detailItem}>
                  <i className="fa-solid fa-envelope" />
                  {profile.email}
                </div>
                {profile.phone && (
                  <div style={styles.detailItem}>
                    <i className="fa-solid fa-phone" />
                    {profile.phone}
                  </div>
                )}
                {profile.timezone && (
                  <div style={styles.detailItem}>
                    <i className="fa-solid fa-globe" />
                    {profile.timezone}
                  </div>
                )}
                {profile.preferredContactMethod && (
                  <div style={styles.detailItem}>
                    <i className="fa-solid fa-star" />
                    Prefers {profile.preferredContactMethod}
                  </div>
                )}
              </div>
            </div>

            {profile.importantDates && profile.importantDates.length > 0 && (
              <div style={styles.profileSection}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px' }}>
                  Important Dates
                </div>
                {profile.importantDates.map((date, i) => (
                  <div key={i} style={{ ...styles.detailItem, marginBottom: '8px' }}>
                    <i className="fa-solid fa-calendar" />
                    <span>{date.label}: {date.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            )}

            {profile.customFields && profile.customFields.length > 0 && (
              <div style={styles.profileSection}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px' }}>
                  Additional Info
                </div>
                {profile.customFields.map((field, i) => (
                  <div key={i} style={{ ...styles.detailItem, marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>{field.label}:</span>
                    <span>{field.value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Quick note button for message context
export const QuickNoteButton: React.FC<{
  contactId: string;
  onAddNote: () => void;
}> = ({ contactId, onAddNote }) => {
  return (
    <button
      onClick={onAddNote}
      style={{
        padding: '4px 8px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        color: '#a78bfa',
        cursor: 'pointer',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}
    >
      <i className="fa-solid fa-sticky-note" />
      Add Note
    </button>
  );
};

export default ContactNotes;
