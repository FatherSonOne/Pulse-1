import React, { useState, useMemo, useCallback } from 'react';

// Types
interface QuickReply {
  id: string;
  text: string;
  category: 'greeting' | 'acknowledgment' | 'question' | 'closing' | 'custom' | 'ai-suggested';
  useCount: number;
  lastUsed?: Date;
  emoji?: string;
  isAISuggested?: boolean;
  confidence?: number;
  contextMatch?: string;
}

interface AISuggestion {
  id: string;
  text: string;
  confidence: number;
  reason: string;
  tone: 'professional' | 'friendly' | 'casual' | 'formal';
  category: string;
}

interface QuickRepliesProps {
  lastReceivedMessage?: string;
  conversationContext?: string;
  onSelectReply?: (text: string) => void;
  onCustomize?: (reply: QuickReply) => void;
}

// Mock quick replies
const defaultQuickReplies: QuickReply[] = [
  { id: 'qr1', text: 'Thanks for letting me know!', category: 'acknowledgment', useCount: 45, emoji: '👍' },
  { id: 'qr2', text: "I'll look into this and get back to you.", category: 'acknowledgment', useCount: 38, emoji: '🔍' },
  { id: 'qr3', text: 'Sounds good to me!', category: 'acknowledgment', useCount: 32, emoji: '✅' },
  { id: 'qr4', text: "Let me check and I'll follow up.", category: 'acknowledgment', useCount: 28, emoji: '📋' },
  { id: 'qr5', text: 'Hi! How can I help you today?', category: 'greeting', useCount: 25, emoji: '👋' },
  { id: 'qr6', text: 'Good morning! Ready when you are.', category: 'greeting', useCount: 22, emoji: '☀️' },
  { id: 'qr7', text: 'Could you provide more details?', category: 'question', useCount: 20, emoji: '❓' },
  { id: 'qr8', text: 'When do you need this by?', category: 'question', useCount: 18, emoji: '📅' },
  { id: 'qr9', text: 'Let me know if you have any questions!', category: 'closing', useCount: 15, emoji: '💬' },
  { id: 'qr10', text: 'Talk soon!', category: 'closing', useCount: 12, emoji: '👋' }
];

// Generate AI suggestions based on context
const generateAISuggestions = (lastMessage?: string): AISuggestion[] => {
  if (!lastMessage) return [];

  const suggestions: AISuggestion[] = [];
  const lowerMsg = lastMessage.toLowerCase();

  if (lowerMsg.includes('meeting') || lowerMsg.includes('call')) {
    suggestions.push({
      id: 'ai1',
      text: 'I can make that time work. Looking forward to it!',
      confidence: 0.92,
      reason: 'Meeting confirmation detected',
      tone: 'professional',
      category: 'scheduling'
    });
    suggestions.push({
      id: 'ai2',
      text: 'Could we push it back by 30 minutes?',
      confidence: 0.78,
      reason: 'Alternative time suggestion',
      tone: 'professional',
      category: 'scheduling'
    });
  }

  if (lowerMsg.includes('help') || lowerMsg.includes('issue') || lowerMsg.includes('problem')) {
    suggestions.push({
      id: 'ai3',
      text: "I'd be happy to help! Can you share more details about the issue?",
      confidence: 0.95,
      reason: 'Help request detected',
      tone: 'friendly',
      category: 'support'
    });
    suggestions.push({
      id: 'ai4',
      text: "Let me take a look at this right away.",
      confidence: 0.88,
      reason: 'Urgent assistance offer',
      tone: 'professional',
      category: 'support'
    });
  }

  if (lowerMsg.includes('thanks') || lowerMsg.includes('thank you')) {
    suggestions.push({
      id: 'ai5',
      text: "You're welcome! Happy to help anytime.",
      confidence: 0.97,
      reason: 'Gratitude response',
      tone: 'friendly',
      category: 'acknowledgment'
    });
  }

  if (lowerMsg.includes('urgent') || lowerMsg.includes('asap') || lowerMsg.includes('immediately')) {
    suggestions.push({
      id: 'ai6',
      text: "I'm on it! Will prioritize this immediately.",
      confidence: 0.94,
      reason: 'Urgency detected',
      tone: 'professional',
      category: 'acknowledgment'
    });
  }

  if (lowerMsg.includes('?')) {
    suggestions.push({
      id: 'ai7',
      text: 'Great question! Let me find out for you.',
      confidence: 0.85,
      reason: 'Question detected',
      tone: 'friendly',
      category: 'response'
    });
  }

  // Default suggestion if no specific context
  if (suggestions.length === 0) {
    suggestions.push({
      id: 'ai8',
      text: 'Got it, thanks for the update!',
      confidence: 0.75,
      reason: 'General acknowledgment',
      tone: 'friendly',
      category: 'acknowledgment'
    });
  }

  return suggestions.slice(0, 3);
};

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    padding: '16px',
    backgroundColor: '#0a0a0f',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  aiSection: {
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    borderRadius: '10px',
    padding: '12px',
    border: '1px solid rgba(139, 92, 246, 0.1)'
  },
  suggestionsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px'
  },
  suggestion: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  suggestionText: {
    flex: 1,
    fontSize: '13px',
    color: '#e2e8f0',
    lineHeight: 1.4
  },
  confidenceBadge: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
    flexShrink: 0
  },
  reason: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '2px'
  },
  quickRepliesGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px'
  },
  quickReplyButton: {
    padding: '8px 12px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap' as const
  },
  categoryFilter: {
    display: 'flex',
    gap: '4px',
    marginBottom: '8px'
  },
  filterChip: {
    padding: '4px 10px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    transition: 'all 0.2s ease'
  },
  filterChipActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa'
  },
  useCount: {
    fontSize: '10px',
    color: '#4b5563',
    marginLeft: '4px'
  },
  toneBadge: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: 600,
    textTransform: 'uppercase' as const
  },
  customizeButton: {
    padding: '4px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '10px',
    opacity: 0,
    transition: 'opacity 0.2s ease'
  },
  addCustom: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px dashed rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s ease',
    width: '100%'
  }
};

// Confidence colors
const getConfidenceColor = (confidence: number): { bg: string; color: string } => {
  if (confidence >= 0.9) return { bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399' };
  if (confidence >= 0.75) return { bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' };
  return { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' };
};

// Tone colors
const toneColors: Record<string, { bg: string; color: string }> = {
  professional: { bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' },
  friendly: { bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399' },
  casual: { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' },
  formal: { bg: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }
};

// Category icons
const categoryIcons: Record<string, string> = {
  greeting: 'fa-hand-wave',
  acknowledgment: 'fa-check',
  question: 'fa-question',
  closing: 'fa-door-open',
  custom: 'fa-star',
  'ai-suggested': 'fa-brain'
};

// Main Component
export const QuickReplies: React.FC<QuickRepliesProps> = ({
  lastReceivedMessage,
  conversationContext,
  onSelectReply,
  onCustomize
}) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const aiSuggestions = useMemo(
    () => generateAISuggestions(lastReceivedMessage),
    [lastReceivedMessage]
  );

  const quickReplies = useMemo(() => {
    const sorted = [...defaultQuickReplies].sort((a, b) => b.useCount - a.useCount);
    if (activeCategory) {
      return sorted.filter(qr => qr.category === activeCategory);
    }
    return showAll ? sorted : sorted.slice(0, 6);
  }, [activeCategory, showAll]);

  const categories = [
    { id: 'greeting', label: 'Greetings' },
    { id: 'acknowledgment', label: 'Acknowledge' },
    { id: 'question', label: 'Questions' },
    { id: 'closing', label: 'Closings' }
  ];

  const handleSelectReply = useCallback((text: string) => {
    onSelectReply?.(text);
  }, [onSelectReply]);

  return (
    <div style={styles.container}>
      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div style={styles.aiSection}>
          <div style={styles.sectionTitle}>
            <i className="fa-solid fa-sparkles" style={{ color: '#a78bfa' }} />
            AI Suggested Replies
          </div>
          <div style={styles.suggestionsList}>
            {aiSuggestions.map(suggestion => {
              const confColor = getConfidenceColor(suggestion.confidence);
              const toneColor = toneColors[suggestion.tone];
              return (
                <div
                  key={suggestion.id}
                  style={styles.suggestion}
                  onClick={() => handleSelectReply(suggestion.text)}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139, 92, 246, 0.3)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={styles.suggestionText}>{suggestion.text}</div>
                    <div style={styles.reason}>{suggestion.reason}</div>
                  </div>
                  <span style={{
                    ...styles.toneBadge,
                    backgroundColor: toneColor.bg,
                    color: toneColor.color
                  }}>
                    {suggestion.tone}
                  </span>
                  <span style={{
                    ...styles.confidenceBadge,
                    backgroundColor: confColor.bg,
                    color: confColor.color
                  }}>
                    {Math.round(suggestion.confidence * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Replies */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <i className="fa-solid fa-bolt" />
          Quick Replies
        </div>

        <div style={styles.categoryFilter}>
          <button
            style={{
              ...styles.filterChip,
              ...(!activeCategory ? styles.filterChipActive : {})
            }}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              style={{
                ...styles.filterChip,
                ...(activeCategory === cat.id ? styles.filterChipActive : {})
              }}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div style={styles.quickRepliesGrid}>
          {quickReplies.map(reply => (
            <button
              key={reply.id}
              style={styles.quickReplyButton}
              onClick={() => handleSelectReply(reply.text)}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(139, 92, 246, 0.15)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(139, 92, 246, 0.3)';
                (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255, 255, 255, 0.1)';
                (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
              }}
            >
              {reply.emoji && <span>{reply.emoji}</span>}
              {reply.text}
              <span style={styles.useCount}>({reply.useCount})</span>
            </button>
          ))}
        </div>

        {!activeCategory && !showAll && defaultQuickReplies.length > 6 && (
          <button
            style={{ ...styles.addCustom, marginTop: '8px' }}
            onClick={() => setShowAll(true)}
          >
            <i className="fa-solid fa-chevron-down" />
            Show {defaultQuickReplies.length - 6} more replies
          </button>
        )}
      </div>

      {/* Add Custom */}
      <button
        style={styles.addCustom}
        onClick={() => onCustomize?.({ id: 'new', text: '', category: 'custom', useCount: 0 })}
      >
        <i className="fa-solid fa-plus" />
        Add custom quick reply
      </button>
    </div>
  );
};

// Inline Quick Reply Bar (for message input area)
export const QuickReplyBar: React.FC<{
  lastMessage?: string;
  onSelect: (text: string) => void;
}> = ({ lastMessage, onSelect }) => {
  const suggestions = useMemo(() => generateAISuggestions(lastMessage), [lastMessage]);
  const topReplies = defaultQuickReplies.slice(0, 4);

  const allReplies = [
    ...suggestions.map(s => ({ id: s.id, text: s.text, isAI: true })),
    ...topReplies.map(r => ({ id: r.id, text: r.text, isAI: false, emoji: r.emoji }))
  ].slice(0, 5);

  if (allReplies.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      gap: '6px',
      padding: '8px 0',
      overflowX: 'auto'
    }}>
      {allReplies.map(reply => (
        <button
          key={reply.id}
          onClick={() => onSelect(reply.text)}
          style={{
            padding: '6px 12px',
            borderRadius: '14px',
            border: reply.isAI ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: reply.isAI ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255, 255, 255, 0.03)',
            color: reply.isAI ? '#a78bfa' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease'
          }}
        >
          {reply.isAI && <i className="fa-solid fa-sparkles" style={{ fontSize: '9px' }} />}
          {'emoji' in reply && reply.emoji && <span>{reply.emoji}</span>}
          {reply.text.length > 30 ? reply.text.slice(0, 30) + '...' : reply.text}
        </button>
      ))}
    </div>
  );
};

export default QuickReplies;
