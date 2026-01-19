import React, { useState, useCallback, useMemo } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type SuggestionType = 'reply' | 'action' | 'followup' | 'reminder' | 'emoji' | 'correction';
type SuggestionSource = 'context' | 'history' | 'template' | 'ai' | 'pattern';
type ConfidenceLevel = 'high' | 'medium' | 'low';

interface Suggestion {
  id: string;
  type: SuggestionType;
  source: SuggestionSource;
  content: string;
  preview?: string;
  confidence: ConfidenceLevel;
  relevanceScore: number;
  context?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  usedCount: number;
  lastUsed?: Date;
}

interface SuggestionPattern {
  id: string;
  name: string;
  trigger: string;
  suggestions: string[];
  enabled: boolean;
  matchCount: number;
}

interface SuggestionSettings {
  enableReplySuggestions: boolean;
  enableActionSuggestions: boolean;
  enableFollowupReminders: boolean;
  enableEmojiSuggestions: boolean;
  enableCorrections: boolean;
  maxSuggestions: number;
  minConfidence: ConfidenceLevel;
  learnFromUsage: boolean;
  showConfidenceIndicator: boolean;
  autoExpandSuggestions: boolean;
}

interface SuggestionStats {
  totalGenerated: number;
  totalUsed: number;
  acceptanceRate: number;
  topTypes: { type: SuggestionType; count: number }[];
  topSources: { source: SuggestionSource; count: number }[];
  averageConfidence: number;
}

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

const generateMockSuggestions = (): Suggestion[] => {
  const types: SuggestionType[] = ['reply', 'action', 'followup', 'reminder', 'emoji', 'correction'];
  const sources: SuggestionSource[] = ['context', 'history', 'template', 'ai', 'pattern'];
  const confidences: ConfidenceLevel[] = ['high', 'medium', 'low'];

  const replySuggestions = [
    "Thanks for reaching out! I'll get back to you shortly.",
    "That sounds great! Let me check my schedule.",
    "I appreciate you letting me know.",
    "Perfect, I'll take care of it right away.",
    "Could you provide more details about this?",
    "I'm on it! Will update you soon.",
  ];

  const actionSuggestions = [
    "Schedule a follow-up call",
    "Add to calendar",
    "Create a task",
    "Set a reminder",
    "Forward to team",
    "Archive conversation",
  ];

  const followupSuggestions = [
    "Follow up on proposal sent last week",
    "Check in about project status",
    "Remind about upcoming deadline",
    "Ask for feedback on deliverables",
  ];

  const reminderSuggestions = [
    "Reminder: Reply to this message",
    "Don't forget to send the document",
    "Meeting tomorrow at 10 AM",
    "Follow up if no response by Friday",
  ];

  const emojiSuggestions = [
    "Add reaction",
    "Send thumbs up",
    "Heart this message",
    "Celebrate!",
  ];

  const correctionSuggestions = [
    "Did you mean 'their' instead of 'there'?",
    "Consider adding punctuation",
    "Possible typo detected: 'recieve' → 'receive'",
  ];

  const allContent: Record<SuggestionType, string[]> = {
    reply: replySuggestions,
    action: actionSuggestions,
    followup: followupSuggestions,
    reminder: reminderSuggestions,
    emoji: emojiSuggestions,
    correction: correctionSuggestions,
  };

  return types.flatMap((type, typeIndex) =>
    allContent[type].slice(0, 3).map((content, i) => ({
      id: `suggestion-${typeIndex}-${i}`,
      type,
      source: sources[Math.floor(Math.random() * sources.length)],
      content,
      confidence: confidences[Math.floor(Math.random() * confidences.length)],
      relevanceScore: 0.5 + Math.random() * 0.5,
      context: type === 'reply' ? 'Based on conversation context' : undefined,
      createdAt: new Date(Date.now() - Math.random() * 86400000),
      usedCount: Math.floor(Math.random() * 50),
      lastUsed: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 604800000) : undefined,
    }))
  );
};

const generateMockPatterns = (): SuggestionPattern[] => [
  {
    id: 'pattern-1',
    name: 'Meeting Requests',
    trigger: 'meeting|schedule|call|discuss',
    suggestions: ['Check calendar availability', 'Propose meeting times', 'Send calendar invite'],
    enabled: true,
    matchCount: 45,
  },
  {
    id: 'pattern-2',
    name: 'Thank You Responses',
    trigger: 'thank|thanks|appreciate',
    suggestions: ["You're welcome!", 'Happy to help!', 'Anytime!'],
    enabled: true,
    matchCount: 128,
  },
  {
    id: 'pattern-3',
    name: 'Question Follow-ups',
    trigger: '\\?$',
    suggestions: ['Answer the question', 'Ask for clarification', 'Forward to expert'],
    enabled: true,
    matchCount: 89,
  },
  {
    id: 'pattern-4',
    name: 'Urgent Messages',
    trigger: 'urgent|asap|immediately|critical',
    suggestions: ['Prioritize response', 'Set high-priority flag', 'Notify team'],
    enabled: true,
    matchCount: 23,
  },
  {
    id: 'pattern-5',
    name: 'Document Requests',
    trigger: 'document|file|attachment|send me',
    suggestions: ['Attach document', 'Share link', 'Request specifications'],
    enabled: false,
    matchCount: 67,
  },
];

const generateMockStats = (): SuggestionStats => ({
  totalGenerated: 2847,
  totalUsed: 1523,
  acceptanceRate: 53.5,
  topTypes: [
    { type: 'reply', count: 892 },
    { type: 'action', count: 456 },
    { type: 'followup', count: 234 },
    { type: 'reminder', count: 189 },
    { type: 'emoji', count: 145 },
    { type: 'correction', count: 78 },
  ],
  topSources: [
    { source: 'ai', count: 1123 },
    { source: 'context', count: 678 },
    { source: 'history', count: 456 },
    { source: 'template', count: 345 },
    { source: 'pattern', count: 245 },
  ],
  averageConfidence: 0.72,
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getSuggestionTypeIcon = (type: SuggestionType): string => {
  const icons: Record<SuggestionType, string> = {
    reply: '💬',
    action: '⚡',
    followup: '📅',
    reminder: '🔔',
    emoji: '😊',
    correction: '✏️',
  };
  return icons[type];
};

const getSuggestionTypeLabel = (type: SuggestionType): string => {
  const labels: Record<SuggestionType, string> = {
    reply: 'Quick Reply',
    action: 'Action',
    followup: 'Follow-up',
    reminder: 'Reminder',
    emoji: 'Emoji',
    correction: 'Correction',
  };
  return labels[type];
};

const getSourceLabel = (source: SuggestionSource): string => {
  const labels: Record<SuggestionSource, string> = {
    context: 'Context',
    history: 'History',
    template: 'Template',
    ai: 'AI',
    pattern: 'Pattern',
  };
  return labels[source];
};

const getConfidenceColor = (confidence: ConfidenceLevel): string => {
  const colors: Record<ConfidenceLevel, string> = {
    high: '#10b981',
    medium: '#f59e0b',
    low: '#6b7280',
  };
  return colors[confidence];
};

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#1a1a2e',
    color: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    padding: '0 20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  tab: {
    padding: '12px 20px',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '14px',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#ffffff',
    borderBottomColor: '#6366f1',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 600,
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap' as const,
  },
  filterChip: {
    padding: '6px 14px',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
  },
  filterChipActive: {
    background: '#6366f1',
    borderColor: '#6366f1',
    color: '#ffffff',
  },
  suggestionList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  suggestionCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid transparent',
  },
  suggestionCardHover: {
    borderColor: 'rgba(99, 102, 241, 0.5)',
    background: 'rgba(255,255,255,0.08)',
  },
  suggestionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  suggestionType: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.7)',
  },
  suggestionBadge: {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 500,
  },
  suggestionContent: {
    fontSize: '15px',
    lineHeight: 1.5,
    marginBottom: '8px',
  },
  suggestionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
  },
  confidenceBar: {
    width: '60px',
    height: '4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s',
  },
  actionButton: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    background: '#6366f1',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  patternCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
  },
  patternHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  patternName: {
    fontSize: '15px',
    fontWeight: 500,
  },
  patternTrigger: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    background: 'rgba(0,0,0,0.3)',
    padding: '4px 8px',
    borderRadius: '4px',
    marginTop: '8px',
  },
  patternSuggestions: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    marginTop: '12px',
  },
  patternSuggestion: {
    padding: '4px 10px',
    borderRadius: '6px',
    background: 'rgba(99, 102, 241, 0.2)',
    fontSize: '12px',
  },
  toggleSwitch: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.2)',
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'all 0.2s',
  },
  toggleSwitchActive: {
    background: '#6366f1',
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#ffffff',
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    transition: 'all 0.2s',
  },
  toggleKnobActive: {
    left: '22px',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '4px',
  },
  settingDescription: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
  },
  select: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(0,0,0,0.3)',
    color: '#ffffff',
    fontSize: '14px',
  },
  chartContainer: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
  },
  chartBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  chartLabel: {
    width: '80px',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.7)',
  },
  chartBarTrack: {
    flex: 1,
    height: '24px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  chartBarFill: {
    height: '100%',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '8px',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'width 0.5s ease-out',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: 'rgba(255,255,255,0.5)',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface SmartSuggestionsProps {
  conversationId?: string;
  currentMessage?: string;
  onSuggestionSelect?: (suggestion: Suggestion) => void;
  onClose?: () => void;
}

type TabType = 'suggestions' | 'patterns' | 'analytics' | 'settings';

export const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({
  conversationId,
  currentMessage,
  onSuggestionSelect,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('suggestions');
  const [suggestions] = useState<Suggestion[]>(generateMockSuggestions());
  const [patterns, setPatterns] = useState<SuggestionPattern[]>(generateMockPatterns());
  const [stats] = useState<SuggestionStats>(generateMockStats());
  const [typeFilter, setTypeFilter] = useState<SuggestionType | 'all'>('all');
  const [hoveredSuggestion, setHoveredSuggestion] = useState<string | null>(null);
  const [settings, setSettings] = useState<SuggestionSettings>({
    enableReplySuggestions: true,
    enableActionSuggestions: true,
    enableFollowupReminders: true,
    enableEmojiSuggestions: false,
    enableCorrections: true,
    maxSuggestions: 5,
    minConfidence: 'medium',
    learnFromUsage: true,
    showConfidenceIndicator: true,
    autoExpandSuggestions: false,
  });

  const filteredSuggestions = useMemo(() => {
    let filtered = suggestions;

    if (typeFilter !== 'all') {
      filtered = filtered.filter(s => s.type === typeFilter);
    }

    // Filter by minimum confidence
    const confidenceOrder: ConfidenceLevel[] = ['low', 'medium', 'high'];
    const minIndex = confidenceOrder.indexOf(settings.minConfidence);
    filtered = filtered.filter(s =>
      confidenceOrder.indexOf(s.confidence) >= minIndex
    );

    // Sort by relevance score
    return filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [suggestions, typeFilter, settings.minConfidence]);

  const handleSuggestionClick = useCallback((suggestion: Suggestion) => {
    onSuggestionSelect?.(suggestion);
  }, [onSuggestionSelect]);

  const handlePatternToggle = useCallback((patternId: string) => {
    setPatterns(prev => prev.map(p =>
      p.id === patternId ? { ...p, enabled: !p.enabled } : p
    ));
  }, []);

  const handleSettingToggle = useCallback((key: keyof SuggestionSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const renderSuggestionsTab = () => (
    <>
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{filteredSuggestions.length}</div>
          <div style={styles.statLabel}>Available</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#10b981' }}>
            {filteredSuggestions.filter(s => s.confidence === 'high').length}
          </div>
          <div style={styles.statLabel}>High Confidence</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.acceptanceRate}%</div>
          <div style={styles.statLabel}>Acceptance Rate</div>
        </div>
      </div>

      <div style={styles.filterRow}>
        {(['all', 'reply', 'action', 'followup', 'reminder', 'emoji', 'correction'] as const).map(type => (
          <button
            key={type}
            style={{
              ...styles.filterChip,
              ...(typeFilter === type ? styles.filterChipActive : {}),
            }}
            onClick={() => setTypeFilter(type)}
          >
            {type === 'all' ? 'All Types' : `${getSuggestionTypeIcon(type)} ${getSuggestionTypeLabel(type)}`}
          </button>
        ))}
      </div>

      <div style={styles.suggestionList}>
        {filteredSuggestions.slice(0, settings.maxSuggestions * 2).map(suggestion => (
          <div
            key={suggestion.id}
            style={{
              ...styles.suggestionCard,
              ...(hoveredSuggestion === suggestion.id ? styles.suggestionCardHover : {}),
            }}
            onMouseEnter={() => setHoveredSuggestion(suggestion.id)}
            onMouseLeave={() => setHoveredSuggestion(null)}
            onClick={() => handleSuggestionClick(suggestion)}
          >
            <div style={styles.suggestionHeader}>
              <div style={styles.suggestionType}>
                <span>{getSuggestionTypeIcon(suggestion.type)}</span>
                <span>{getSuggestionTypeLabel(suggestion.type)}</span>
                <span style={{
                  ...styles.suggestionBadge,
                  background: `${getConfidenceColor(suggestion.confidence)}20`,
                  color: getConfidenceColor(suggestion.confidence),
                }}>
                  {suggestion.confidence}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                via {getSourceLabel(suggestion.source)}
              </span>
            </div>
            <div style={styles.suggestionContent}>{suggestion.content}</div>
            <div style={styles.suggestionMeta}>
              {settings.showConfidenceIndicator && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Relevance:</span>
                  <div style={styles.confidenceBar}>
                    <div style={{
                      ...styles.confidenceFill,
                      width: `${suggestion.relevanceScore * 100}%`,
                      background: getConfidenceColor(suggestion.confidence),
                    }} />
                  </div>
                </div>
              )}
              {suggestion.usedCount > 0 && (
                <span>Used {suggestion.usedCount} times</span>
              )}
              <button style={styles.actionButton}>
                Use Suggestion
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const renderPatternsTab = () => (
    <>
      <div style={styles.sectionTitle}>
        <span>Suggestion Patterns</span>
        <button style={styles.actionButton}>+ Add Pattern</button>
      </div>

      {patterns.map(pattern => (
        <div key={pattern.id} style={styles.patternCard}>
          <div style={styles.patternHeader}>
            <div>
              <div style={styles.patternName}>{pattern.name}</div>
              <div style={styles.patternTrigger}>/{pattern.trigger}/</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                {pattern.matchCount} matches
              </span>
              <div
                style={{
                  ...styles.toggleSwitch,
                  ...(pattern.enabled ? styles.toggleSwitchActive : {}),
                }}
                onClick={() => handlePatternToggle(pattern.id)}
              >
                <div style={{
                  ...styles.toggleKnob,
                  ...(pattern.enabled ? styles.toggleKnobActive : {}),
                }} />
              </div>
            </div>
          </div>
          <div style={styles.patternSuggestions}>
            {pattern.suggestions.map((suggestion, i) => (
              <span key={i} style={styles.patternSuggestion}>{suggestion}</span>
            ))}
          </div>
        </div>
      ))}
    </>
  );

  const renderAnalyticsTab = () => {
    const maxTypeCount = Math.max(...stats.topTypes.map(t => t.count));
    const maxSourceCount = Math.max(...stats.topSources.map(s => s.count));

    const typeColors: Record<SuggestionType, string> = {
      reply: '#6366f1',
      action: '#10b981',
      followup: '#f59e0b',
      reminder: '#ef4444',
      emoji: '#ec4899',
      correction: '#8b5cf6',
    };

    const sourceColors: Record<SuggestionSource, string> = {
      ai: '#6366f1',
      context: '#10b981',
      history: '#f59e0b',
      template: '#ef4444',
      pattern: '#ec4899',
    };

    return (
      <>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalGenerated.toLocaleString()}</div>
            <div style={styles.statLabel}>Generated</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: '#10b981' }}>{stats.totalUsed.toLocaleString()}</div>
            <div style={styles.statLabel}>Used</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: '#f59e0b' }}>{stats.acceptanceRate}%</div>
            <div style={styles.statLabel}>Acceptance</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{Math.round(stats.averageConfidence * 100)}%</div>
            <div style={styles.statLabel}>Avg Confidence</div>
          </div>
        </div>

        <div style={styles.chartContainer}>
          <div style={{ ...styles.sectionTitle, marginBottom: '20px' }}>By Type</div>
          {stats.topTypes.map(item => (
            <div key={item.type} style={styles.chartBar}>
              <div style={styles.chartLabel}>
                {getSuggestionTypeIcon(item.type)} {getSuggestionTypeLabel(item.type)}
              </div>
              <div style={styles.chartBarTrack}>
                <div style={{
                  ...styles.chartBarFill,
                  width: `${(item.count / maxTypeCount) * 100}%`,
                  background: typeColors[item.type],
                }}>
                  {item.count}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.chartContainer}>
          <div style={{ ...styles.sectionTitle, marginBottom: '20px' }}>By Source</div>
          {stats.topSources.map(item => (
            <div key={item.source} style={styles.chartBar}>
              <div style={styles.chartLabel}>{getSourceLabel(item.source)}</div>
              <div style={styles.chartBarTrack}>
                <div style={{
                  ...styles.chartBarFill,
                  width: `${(item.count / maxSourceCount) * 100}%`,
                  background: sourceColors[item.source],
                }}>
                  {item.count}
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderSettingsTab = () => (
    <>
      <div style={styles.sectionTitle}>Suggestion Types</div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <div style={styles.settingLabel}>Reply Suggestions</div>
          <div style={styles.settingDescription}>Show quick reply options based on context</div>
        </div>
        <div
          style={{
            ...styles.toggleSwitch,
            ...(settings.enableReplySuggestions ? styles.toggleSwitchActive : {}),
          }}
          onClick={() => handleSettingToggle('enableReplySuggestions')}
        >
          <div style={{
            ...styles.toggleKnob,
            ...(settings.enableReplySuggestions ? styles.toggleKnobActive : {}),
          }} />
        </div>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <div style={styles.settingLabel}>Action Suggestions</div>
          <div style={styles.settingDescription}>Suggest actions like scheduling or archiving</div>
        </div>
        <div
          style={{
            ...styles.toggleSwitch,
            ...(settings.enableActionSuggestions ? styles.toggleSwitchActive : {}),
          }}
          onClick={() => handleSettingToggle('enableActionSuggestions')}
        >
          <div style={{
            ...styles.toggleKnob,
            ...(settings.enableActionSuggestions ? styles.toggleKnobActive : {}),
          }} />
        </div>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <div style={styles.settingLabel}>Follow-up Reminders</div>
          <div style={styles.settingDescription}>Get reminded to follow up on conversations</div>
        </div>
        <div
          style={{
            ...styles.toggleSwitch,
            ...(settings.enableFollowupReminders ? styles.toggleSwitchActive : {}),
          }}
          onClick={() => handleSettingToggle('enableFollowupReminders')}
        >
          <div style={{
            ...styles.toggleKnob,
            ...(settings.enableFollowupReminders ? styles.toggleKnobActive : {}),
          }} />
        </div>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <div style={styles.settingLabel}>Emoji Suggestions</div>
          <div style={styles.settingDescription}>Suggest emoji reactions for messages</div>
        </div>
        <div
          style={{
            ...styles.toggleSwitch,
            ...(settings.enableEmojiSuggestions ? styles.toggleSwitchActive : {}),
          }}
          onClick={() => handleSettingToggle('enableEmojiSuggestions')}
        >
          <div style={{
            ...styles.toggleKnob,
            ...(settings.enableEmojiSuggestions ? styles.toggleKnobActive : {}),
          }} />
        </div>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <div style={styles.settingLabel}>Text Corrections</div>
          <div style={styles.settingDescription}>Detect typos and grammar issues</div>
        </div>
        <div
          style={{
            ...styles.toggleSwitch,
            ...(settings.enableCorrections ? styles.toggleSwitchActive : {}),
          }}
          onClick={() => handleSettingToggle('enableCorrections')}
        >
          <div style={{
            ...styles.toggleKnob,
            ...(settings.enableCorrections ? styles.toggleKnobActive : {}),
          }} />
        </div>
      </div>

      <div style={{ ...styles.sectionTitle, marginTop: '24px' }}>Display Options</div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <div style={styles.settingLabel}>Maximum Suggestions</div>
          <div style={styles.settingDescription}>Number of suggestions to show at once</div>
        </div>
        <select
          style={styles.select}
          value={settings.maxSuggestions}
          onChange={(e) => setSettings(prev => ({ ...prev, maxSuggestions: Number(e.target.value) }))}
        >
          <option value={3}>3 suggestions</option>
          <option value={5}>5 suggestions</option>
          <option value={10}>10 suggestions</option>
          <option value={15}>15 suggestions</option>
        </select>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <div style={styles.settingLabel}>Minimum Confidence</div>
          <div style={styles.settingDescription}>Only show suggestions above this confidence level</div>
        </div>
        <select
          style={styles.select}
          value={settings.minConfidence}
          onChange={(e) => setSettings(prev => ({ ...prev, minConfidence: e.target.value as ConfidenceLevel }))}
        >
          <option value="low">Low and above</option>
          <option value="medium">Medium and above</option>
          <option value="high">High only</option>
        </select>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <div style={styles.settingLabel}>Show Confidence Indicator</div>
          <div style={styles.settingDescription}>Display relevance scores on suggestions</div>
        </div>
        <div
          style={{
            ...styles.toggleSwitch,
            ...(settings.showConfidenceIndicator ? styles.toggleSwitchActive : {}),
          }}
          onClick={() => handleSettingToggle('showConfidenceIndicator')}
        >
          <div style={{
            ...styles.toggleKnob,
            ...(settings.showConfidenceIndicator ? styles.toggleKnobActive : {}),
          }} />
        </div>
      </div>

      <div style={styles.settingRow}>
        <div style={styles.settingInfo}>
          <div style={styles.settingLabel}>Learn from Usage</div>
          <div style={styles.settingDescription}>Improve suggestions based on your selections</div>
        </div>
        <div
          style={{
            ...styles.toggleSwitch,
            ...(settings.learnFromUsage ? styles.toggleSwitchActive : {}),
          }}
          onClick={() => handleSettingToggle('learnFromUsage')}
        >
          <div style={{
            ...styles.toggleKnob,
            ...(settings.learnFromUsage ? styles.toggleKnobActive : {}),
          }} />
        </div>
      </div>
    </>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <span>🧠</span>
          <span>Smart Suggestions</span>
        </div>
        <div style={styles.subtitle}>
          AI-powered suggestions to help you communicate faster
        </div>
      </div>

      <div style={styles.tabs}>
        {(['suggestions', 'patterns', 'analytics', 'settings'] as TabType[]).map(tab => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {activeTab === 'suggestions' && renderSuggestionsTab()}
        {activeTab === 'patterns' && renderPatternsTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </div>
    </div>
  );
};

// ============================================================================
// QUICK SUGGESTION BUTTON COMPONENT
// ============================================================================

interface SuggestionButtonProps {
  onClick?: () => void;
  suggestionCount?: number;
  hasHighConfidence?: boolean;
}

export const SuggestionButton: React.FC<SuggestionButtonProps> = ({
  onClick,
  suggestionCount = 5,
  hasHighConfidence = true,
}) => {
  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '20px',
    border: 'none',
    background: hasHighConfidence
      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
      : 'rgba(255,255,255,0.1)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s',
  };

  return (
    <button style={buttonStyle} onClick={onClick}>
      <span>🧠</span>
      <span>Suggestions</span>
      {suggestionCount > 0 && (
        <span style={{
          padding: '2px 8px',
          borderRadius: '10px',
          background: 'rgba(255,255,255,0.2)',
          fontSize: '12px',
        }}>
          {suggestionCount}
        </span>
      )}
    </button>
  );
};

export default SmartSuggestions;
