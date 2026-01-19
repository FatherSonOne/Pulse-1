import React, { useState, useMemo, useCallback } from 'react';

// Types
interface KeyMoment {
  id: string;
  type: 'decision' | 'action_item' | 'question' | 'milestone' | 'agreement' | 'concern' | 'celebration';
  title: string;
  content: string;
  messageId: string;
  timestamp: Date;
  participants: string[];
  importance: 'low' | 'medium' | 'high' | 'critical';
  isResolved?: boolean;
  relatedMoments?: string[];
  tags: string[];
  aiConfidence: number;
}

interface ConversationSummary {
  id: string;
  conversationId: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: Date;
  keyPoints: string[];
  decisions: string[];
  actionItems: { item: string; assignee?: string; dueDate?: Date; completed: boolean }[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  topicsCovered: string[];
  participantActivity: { name: string; messageCount: number; engagement: number }[];
}

interface HighlightCollection {
  id: string;
  name: string;
  description: string;
  momentIds: string[];
  createdAt: Date;
  isAuto: boolean;
  icon: string;
  color: string;
}

interface ConversationHighlightsProps {
  conversationId?: string;
  onMomentClick?: (moment: KeyMoment) => void;
  onNavigateToMessage?: (messageId: string) => void;
}

// Mock data generators
const generateMockMoments = (): KeyMoment[] => [
  {
    id: 'm1',
    type: 'decision',
    title: 'Project Timeline Approved',
    content: 'We agreed to launch the MVP by end of Q1 with core features only',
    messageId: 'msg_001',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    participants: ['Alice', 'Bob'],
    importance: 'high',
    tags: ['project', 'timeline', 'mvp'],
    aiConfidence: 0.95,
    relatedMoments: ['m3']
  },
  {
    id: 'm2',
    type: 'action_item',
    title: 'Design Review Needed',
    content: 'Bob will prepare the UI mockups for the dashboard by Friday',
    messageId: 'msg_005',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    participants: ['Bob'],
    importance: 'medium',
    isResolved: false,
    tags: ['design', 'dashboard', 'review'],
    aiConfidence: 0.88
  },
  {
    id: 'm3',
    type: 'milestone',
    title: 'Phase 1 Completed',
    content: 'Successfully finished the authentication module with all tests passing',
    messageId: 'msg_012',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    participants: ['Alice', 'Bob', 'Carol'],
    importance: 'high',
    tags: ['milestone', 'auth', 'phase1'],
    aiConfidence: 0.92
  },
  {
    id: 'm4',
    type: 'question',
    title: 'API Rate Limiting',
    content: 'Should we implement rate limiting on the public endpoints?',
    messageId: 'msg_018',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    participants: ['Carol'],
    importance: 'medium',
    isResolved: true,
    tags: ['api', 'security', 'rate-limit'],
    aiConfidence: 0.85
  },
  {
    id: 'm5',
    type: 'agreement',
    title: 'Code Review Policy',
    content: 'All PRs require at least 2 approvals before merging to main',
    messageId: 'msg_025',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    participants: ['Alice', 'Bob', 'Carol', 'Dave'],
    importance: 'high',
    tags: ['policy', 'code-review', 'process'],
    aiConfidence: 0.91
  },
  {
    id: 'm6',
    type: 'concern',
    title: 'Performance Issues',
    content: 'Database queries are taking too long on the reports page',
    messageId: 'msg_030',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    participants: ['Dave'],
    importance: 'critical',
    isResolved: false,
    tags: ['performance', 'database', 'urgent'],
    aiConfidence: 0.89
  },
  {
    id: 'm7',
    type: 'celebration',
    title: '1000 Users Milestone',
    content: 'We just hit 1000 active users! Great work everyone!',
    messageId: 'msg_040',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    participants: ['Alice'],
    importance: 'medium',
    tags: ['milestone', 'users', 'celebration'],
    aiConfidence: 0.97
  }
];

const generateMockSummary = (): ConversationSummary => ({
  id: 's1',
  conversationId: 'conv_001',
  period: 'weekly',
  date: new Date(),
  keyPoints: [
    'MVP launch timeline confirmed for end of Q1',
    'New code review policy established with 2-approval requirement',
    'Performance concerns raised about database queries',
    'Authentication module completed successfully'
  ],
  decisions: [
    'Launch MVP with core features only',
    'Implement rate limiting on public APIs',
    'Require 2 approvals for all PRs'
  ],
  actionItems: [
    { item: 'Prepare UI mockups for dashboard', assignee: 'Bob', dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), completed: false },
    { item: 'Investigate database performance', assignee: 'Dave', completed: false },
    { item: 'Update API documentation', assignee: 'Carol', completed: true }
  ],
  sentiment: 'positive',
  topicsCovered: ['Project Planning', 'Technical Decisions', 'Team Process', 'Performance'],
  participantActivity: [
    { name: 'Alice', messageCount: 45, engagement: 0.92 },
    { name: 'Bob', messageCount: 38, engagement: 0.85 },
    { name: 'Carol', messageCount: 32, engagement: 0.78 },
    { name: 'Dave', messageCount: 28, engagement: 0.72 }
  ]
});

const generateMockCollections = (): HighlightCollection[] => [
  {
    id: 'c1',
    name: 'Project Decisions',
    description: 'All major decisions about the project',
    momentIds: ['m1', 'm5'],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    isAuto: true,
    icon: '⚖️',
    color: '#3B82F6'
  },
  {
    id: 'c2',
    name: 'Action Items',
    description: 'Tasks and follow-ups',
    momentIds: ['m2'],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    isAuto: true,
    icon: '✅',
    color: '#10B981'
  },
  {
    id: 'c3',
    name: 'Milestones',
    description: 'Key achievements and celebrations',
    momentIds: ['m3', 'm7'],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    isAuto: true,
    icon: '🎯',
    color: '#8B5CF6'
  }
];

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
  filterBar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap' as const
  },
  filterChip: {
    padding: '6px 12px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s ease'
  },
  filterChipActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    color: '#a78bfa'
  },
  momentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  momentHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  momentType: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  typeIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px'
  },
  momentTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9'
  },
  momentMeta: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px'
  },
  momentContent: {
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: 1.5,
    marginBottom: '12px'
  },
  momentFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px'
  },
  tags: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap' as const
  },
  tag: {
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    color: '#a78bfa',
    fontSize: '10px',
    fontWeight: 500
  },
  participants: {
    display: 'flex',
    gap: '4px'
  },
  participantBadge: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 600,
    border: '2px solid #0a0a0f'
  },
  importanceBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  summarySection: {
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  bulletList: {
    listStyle: 'none',
    padding: 0,
    margin: 0
  },
  bulletItem: {
    fontSize: '13px',
    color: '#cbd5e1',
    padding: '6px 0',
    paddingLeft: '16px',
    position: 'relative' as const,
    lineHeight: 1.5
  },
  actionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    marginBottom: '8px'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981'
  },
  activityBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px'
  },
  activityName: {
    width: '80px',
    fontSize: '12px',
    color: '#94a3b8'
  },
  activityBarOuter: {
    flex: 1,
    height: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    overflow: 'hidden'
  },
  activityBarInner: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease'
  },
  collectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    transition: 'all 0.2s ease'
  },
  collectionIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px'
  },
  collectionInfo: {
    flex: 1
  },
  collectionName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9',
    marginBottom: '4px'
  },
  collectionDesc: {
    fontSize: '12px',
    color: '#64748b'
  },
  collectionCount: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#a78bfa'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: '#64748b'
  },
  aiConfidence: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10px',
    color: '#64748b'
  },
  navigateButton: {
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
  }
};

// Type configurations
const typeConfig: Record<KeyMoment['type'], { icon: string; color: string; label: string }> = {
  decision: { icon: '⚖️', color: '#3B82F6', label: 'Decision' },
  action_item: { icon: '✅', color: '#10B981', label: 'Action Item' },
  question: { icon: '❓', color: '#F59E0B', label: 'Question' },
  milestone: { icon: '🎯', color: '#8B5CF6', label: 'Milestone' },
  agreement: { icon: '🤝', color: '#06B6D4', label: 'Agreement' },
  concern: { icon: '⚠️', color: '#EF4444', label: 'Concern' },
  celebration: { icon: '🎉', color: '#EC4899', label: 'Celebration' }
};

const importanceColors: Record<KeyMoment['importance'], { bg: string; color: string }> = {
  low: { bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' },
  medium: { bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' },
  high: { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' },
  critical: { bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }
};

// Helper functions
const formatDate = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Components
const MomentCard: React.FC<{
  moment: KeyMoment;
  onClick?: () => void;
  onNavigate?: () => void;
}> = ({ moment, onClick, onNavigate }) => {
  const config = typeConfig[moment.type];
  const importanceStyle = importanceColors[moment.importance];

  return (
    <div
      style={styles.momentCard}
      onClick={onClick}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
      }}
    >
      <div style={styles.momentHeader}>
        <div style={styles.momentType}>
          <div style={{ ...styles.typeIcon, backgroundColor: `${config.color}20` }}>
            {config.icon}
          </div>
          <div>
            <div style={styles.momentTitle}>{moment.title}</div>
            <div style={styles.momentMeta}>
              {config.label} • {formatDate(moment.timestamp)}
              {moment.isResolved !== undefined && (
                <span style={{ marginLeft: '8px', color: moment.isResolved ? '#10b981' : '#f59e0b' }}>
                  {moment.isResolved ? '✓ Resolved' : '○ Open'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            ...styles.importanceBadge,
            backgroundColor: importanceStyle.bg,
            color: importanceStyle.color
          }}>
            {moment.importance}
          </span>
        </div>
      </div>

      <div style={styles.momentContent}>{moment.content}</div>

      <div style={styles.momentFooter}>
        <div style={styles.tags}>
          {moment.tags.slice(0, 3).map(tag => (
            <span key={tag} style={styles.tag}>#{tag}</span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={styles.aiConfidence}>
            <span>🤖</span>
            <span>{Math.round(moment.aiConfidence * 100)}% confident</span>
          </div>

          <div style={styles.participants}>
            {moment.participants.slice(0, 3).map((p, i) => (
              <div key={p} style={{ ...styles.participantBadge, marginLeft: i > 0 ? '-8px' : 0 }}>
                {p[0]}
              </div>
            ))}
            {moment.participants.length > 3 && (
              <div style={{ ...styles.participantBadge, marginLeft: '-8px', backgroundColor: 'rgba(100, 116, 139, 0.2)' }}>
                +{moment.participants.length - 3}
              </div>
            )}
          </div>

          {onNavigate && (
            <button
              style={styles.navigateButton}
              onClick={e => { e.stopPropagation(); onNavigate(); }}
            >
              Go to message →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryView: React.FC<{ summary: ConversationSummary }> = ({ summary }) => {
  const sentimentColors = {
    positive: '#10B981',
    neutral: '#94A3B8',
    negative: '#EF4444',
    mixed: '#F59E0B'
  };

  return (
    <div>
      <div style={styles.summaryCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9' }}>
              {summary.period.charAt(0).toUpperCase() + summary.period.slice(1)} Summary
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              {summary.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div style={{
            padding: '6px 12px',
            borderRadius: '8px',
            backgroundColor: `${sentimentColors[summary.sentiment]}20`,
            color: sentimentColors[summary.sentiment],
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'capitalize'
          }}>
            {summary.sentiment} Sentiment
          </div>
        </div>

        <div style={styles.summarySection}>
          <div style={styles.sectionTitle}>
            <span>📌</span> Key Points
          </div>
          <ul style={styles.bulletList}>
            {summary.keyPoints.map((point, i) => (
              <li key={i} style={styles.bulletItem}>
                <span style={{ position: 'absolute', left: 0, color: '#8b5cf6' }}>•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div style={styles.summarySection}>
          <div style={styles.sectionTitle}>
            <span>⚖️</span> Decisions Made
          </div>
          <ul style={styles.bulletList}>
            {summary.decisions.map((decision, i) => (
              <li key={i} style={styles.bulletItem}>
                <span style={{ position: 'absolute', left: 0, color: '#3b82f6' }}>✓</span>
                {decision}
              </li>
            ))}
          </ul>
        </div>

        <div style={styles.summarySection}>
          <div style={styles.sectionTitle}>
            <span>✅</span> Action Items ({summary.actionItems.filter(a => !a.completed).length} pending)
          </div>
          {summary.actionItems.map((item, i) => (
            <div key={i} style={styles.actionItem}>
              <div style={{
                ...styles.checkbox,
                ...(item.completed ? styles.checkboxChecked : {})
              }}>
                {item.completed && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '13px',
                  color: item.completed ? '#64748b' : '#e2e8f0',
                  textDecoration: item.completed ? 'line-through' : 'none'
                }}>
                  {item.item}
                </div>
                {(item.assignee || item.dueDate) && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {item.assignee && <span>@{item.assignee}</span>}
                    {item.assignee && item.dueDate && <span> • </span>}
                    {item.dueDate && <span>Due {item.dueDate.toLocaleDateString()}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={styles.summarySection}>
          <div style={styles.sectionTitle}>
            <span>💬</span> Topics Covered
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {summary.topicsCovered.map(topic => (
              <span key={topic} style={{
                padding: '4px 12px',
                borderRadius: '16px',
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: '#a78bfa',
                fontSize: '12px'
              }}>
                {topic}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div style={styles.sectionTitle}>
            <span>👥</span> Participant Activity
          </div>
          {summary.participantActivity.map(p => (
            <div key={p.name} style={styles.activityBar}>
              <span style={styles.activityName}>{p.name}</span>
              <div style={styles.activityBarOuter}>
                <div style={{
                  ...styles.activityBarInner,
                  width: `${p.engagement * 100}%`,
                  backgroundColor: '#8b5cf6'
                }} />
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', width: '40px' }}>
                {p.messageCount} msgs
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CollectionsView: React.FC<{
  collections: HighlightCollection[];
  moments: KeyMoment[];
  onSelectCollection?: (collection: HighlightCollection) => void;
}> = ({ collections, moments, onSelectCollection }) => {
  return (
    <div>
      {collections.map(collection => {
        const collectionMoments = moments.filter(m => collection.momentIds.includes(m.id));
        return (
          <div
            key={collection.id}
            style={styles.collectionCard}
            onClick={() => onSelectCollection?.(collection)}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
            }}
          >
            <div style={{
              ...styles.collectionIcon,
              backgroundColor: `${collection.color}20`
            }}>
              {collection.icon}
            </div>
            <div style={styles.collectionInfo}>
              <div style={styles.collectionName}>
                {collection.name}
                {collection.isAuto && (
                  <span style={{
                    marginLeft: '8px',
                    fontSize: '10px',
                    color: '#64748b',
                    fontWeight: 400
                  }}>
                    Auto-generated
                  </span>
                )}
              </div>
              <div style={styles.collectionDesc}>{collection.description}</div>
            </div>
            <div style={styles.collectionCount}>{collectionMoments.length}</div>
          </div>
        );
      })}
    </div>
  );
};

// Main Component
export const ConversationHighlights: React.FC<ConversationHighlightsProps> = ({
  conversationId,
  onMomentClick,
  onNavigateToMessage
}) => {
  const [activeTab, setActiveTab] = useState<'moments' | 'summary' | 'collections'>('moments');
  const [selectedTypes, setSelectedTypes] = useState<KeyMoment['type'][]>([]);
  const [selectedImportance, setSelectedImportance] = useState<KeyMoment['importance'] | null>(null);

  const moments = useMemo(() => generateMockMoments(), []);
  const summary = useMemo(() => generateMockSummary(), []);
  const collections = useMemo(() => generateMockCollections(), []);

  const filteredMoments = useMemo(() => {
    return moments.filter(m => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(m.type)) return false;
      if (selectedImportance && m.importance !== selectedImportance) return false;
      return true;
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [moments, selectedTypes, selectedImportance]);

  const toggleType = useCallback((type: KeyMoment['type']) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }, []);

  const tabs = [
    { id: 'moments' as const, label: 'Key Moments', count: moments.length },
    { id: 'summary' as const, label: 'Summary', count: null },
    { id: 'collections' as const, label: 'Collections', count: collections.length }
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <span>✨</span>
          Conversation Highlights
        </div>
      </div>

      <div style={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== null && (
              <span style={{ marginLeft: '6px', opacity: 0.7 }}>({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {activeTab === 'moments' && (
          <>
            <div style={styles.filterBar}>
              {Object.entries(typeConfig).map(([type, config]) => (
                <button
                  key={type}
                  style={{
                    ...styles.filterChip,
                    ...(selectedTypes.includes(type as KeyMoment['type']) ? styles.filterChipActive : {})
                  }}
                  onClick={() => toggleType(type as KeyMoment['type'])}
                >
                  <span>{config.icon}</span>
                  {config.label}
                </button>
              ))}
            </div>

            {filteredMoments.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                <div style={{ fontSize: '14px' }}>No moments match your filters</div>
              </div>
            ) : (
              filteredMoments.map(moment => (
                <MomentCard
                  key={moment.id}
                  moment={moment}
                  onClick={() => onMomentClick?.(moment)}
                  onNavigate={onNavigateToMessage ? () => onNavigateToMessage(moment.messageId) : undefined}
                />
              ))
            )}
          </>
        )}

        {activeTab === 'summary' && <SummaryView summary={summary} />}

        {activeTab === 'collections' && (
          <CollectionsView
            collections={collections}
            moments={moments}
          />
        )}
      </div>
    </div>
  );
};

// Utility component for showing highlight indicator on messages
export const HighlightIndicator: React.FC<{
  type: KeyMoment['type'];
  onClick?: () => void;
}> = ({ type, onClick }) => {
  const config = typeConfig[type];

  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 8px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: `${config.color}20`,
        color: config.color,
        cursor: 'pointer',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}
    >
      <span>{config.icon}</span>
      {config.label}
    </button>
  );
};

export default ConversationHighlights;
