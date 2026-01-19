// Conversation Summary Generator
import React, { useState, useMemo } from 'react';

interface SummarySection {
  id: string;
  title: string;
  content: string;
  type: 'overview' | 'decisions' | 'action-items' | 'key-points' | 'timeline' | 'participants';
  items?: string[];
}

interface ConversationSummaryProps {
  messages: Array<{
    id: string;
    text: string;
    sender: 'user' | 'other';
    senderName?: string;
    timestamp: string;
  }>;
  contactName: string;
  threadTitle?: string;
  onGenerateSummary?: () => Promise<string>;
  onExportSummary?: (format: 'text' | 'markdown' | 'pdf') => void;
  onShareSummary?: (method: 'email' | 'copy' | 'slack') => void;
  compact?: boolean;
}

export const ConversationSummary: React.FC<ConversationSummaryProps> = ({
  messages,
  contactName,
  threadTitle,
  onGenerateSummary,
  onExportSummary,
  onShareSummary,
  compact = false
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [customSummary, setCustomSummary] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [summaryLength, setSummaryLength] = useState<'brief' | 'detailed'>('brief');

  // Generate summary sections from messages
  const summarySections = useMemo((): SummarySection[] => {
    if (!messages || messages.length === 0) return [];

    const sections: SummarySection[] = [];

    // Overview
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    const duration = new Date(lastMessage.timestamp).getTime() - new Date(firstMessage.timestamp).getTime();
    const durationDays = Math.floor(duration / (1000 * 60 * 60 * 24));
    const userMessages = messages.filter(m => m.sender === 'user').length;
    const otherMessages = messages.filter(m => m.sender === 'other').length;

    sections.push({
      id: 'overview',
      title: 'Overview',
      type: 'overview',
      content: `This conversation with ${contactName} spans ${durationDays > 0 ? `${durationDays} days` : 'today'} and includes ${messages.length} messages. You sent ${userMessages} messages and ${contactName} sent ${otherMessages}.`
    });

    // Key points extraction
    const keyPointIndicators = ['important', 'key', 'main', 'critical', 'essential', 'must', 'need to', 'should'];
    const keyPointMessages = messages.filter(m =>
      keyPointIndicators.some(indicator => m.text.toLowerCase().includes(indicator))
    );

    if (keyPointMessages.length > 0) {
      sections.push({
        id: 'key-points',
        title: 'Key Points',
        type: 'key-points',
        content: 'Important points discussed in this conversation:',
        items: keyPointMessages.slice(0, 5).map(m =>
          m.text.length > 100 ? m.text.substring(0, 100) + '...' : m.text
        )
      });
    }

    // Decisions extraction
    const decisionIndicators = ['decided', 'agreed', 'confirmed', 'will do', 'let\'s go with', 'final', 'approved'];
    const decisionMessages = messages.filter(m =>
      decisionIndicators.some(indicator => m.text.toLowerCase().includes(indicator))
    );

    if (decisionMessages.length > 0) {
      sections.push({
        id: 'decisions',
        title: 'Decisions Made',
        type: 'decisions',
        content: 'Decisions and agreements from this conversation:',
        items: decisionMessages.slice(0, 5).map(m =>
          m.text.length > 100 ? m.text.substring(0, 100) + '...' : m.text
        )
      });
    }

    // Action items extraction
    const actionIndicators = ['todo', 'task', 'action', 'need to', 'should', 'will', 'going to', 'deadline', 'by tomorrow', 'by next'];
    const actionMessages = messages.filter(m =>
      actionIndicators.some(indicator => m.text.toLowerCase().includes(indicator)) &&
      m.text.includes('?') === false // Exclude questions
    );

    if (actionMessages.length > 0) {
      sections.push({
        id: 'action-items',
        title: 'Action Items',
        type: 'action-items',
        content: 'Tasks and action items identified:',
        items: actionMessages.slice(0, 5).map(m =>
          m.text.length > 100 ? m.text.substring(0, 100) + '...' : m.text
        )
      });
    }

    // Timeline
    const milestoneMessages = messages.filter((m, i) => {
      // First, last, and every 10th message
      return i === 0 || i === messages.length - 1 || i % 10 === 0;
    });

    sections.push({
      id: 'timeline',
      title: 'Timeline',
      type: 'timeline',
      content: 'Key moments in this conversation:',
      items: milestoneMessages.slice(0, 6).map(m => {
        const date = new Date(m.timestamp);
        const sender = m.sender === 'user' ? 'You' : contactName;
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${sender}: "${m.text.substring(0, 50)}${m.text.length > 50 ? '...' : ''}"`;
      })
    });

    // Participants summary
    const participantStats = {
      user: {
        messages: userMessages,
        avgLength: Math.round(messages.filter(m => m.sender === 'user').reduce((sum, m) => sum + m.text.length, 0) / userMessages) || 0,
        questions: messages.filter(m => m.sender === 'user' && m.text.includes('?')).length
      },
      other: {
        messages: otherMessages,
        avgLength: Math.round(messages.filter(m => m.sender === 'other').reduce((sum, m) => sum + m.text.length, 0) / otherMessages) || 0,
        questions: messages.filter(m => m.sender === 'other' && m.text.includes('?')).length
      }
    };

    sections.push({
      id: 'participants',
      title: 'Participation',
      type: 'participants',
      content: 'Conversation participation breakdown:',
      items: [
        `You: ${participantStats.user.messages} messages, avg ${participantStats.user.avgLength} chars, ${participantStats.user.questions} questions`,
        `${contactName}: ${participantStats.other.messages} messages, avg ${participantStats.other.avgLength} chars, ${participantStats.other.questions} questions`
      ]
    });

    return sections;
  }, [messages, contactName]);

  const handleGenerateSummary = async () => {
    if (!onGenerateSummary) return;

    setIsGenerating(true);
    try {
      const summary = await onGenerateSummary();
      setCustomSummary(summary);
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getSectionIcon = (type: SummarySection['type']) => {
    switch (type) {
      case 'overview': return 'fa-eye';
      case 'decisions': return 'fa-gavel';
      case 'action-items': return 'fa-tasks';
      case 'key-points': return 'fa-key';
      case 'timeline': return 'fa-clock';
      case 'participants': return 'fa-users';
      default: return 'fa-info-circle';
    }
  };

  const getSectionColor = (type: SummarySection['type']) => {
    switch (type) {
      case 'overview': return 'blue';
      case 'decisions': return 'purple';
      case 'action-items': return 'amber';
      case 'key-points': return 'green';
      case 'timeline': return 'cyan';
      case 'participants': return 'pink';
      default: return 'zinc';
    }
  };

  const activeContent = summarySections.find(s => s.id === activeSection);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400">
          <i className="fa-solid fa-file-lines text-xs" />
          <span className="text-xs font-medium">{summarySections.length} sections</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <i className="fa-solid fa-file-lines text-green-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">
                {threadTitle || `Conversation with ${contactName}`}
              </h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {messages?.length || 0} messages analyzed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onGenerateSummary && (
              <button
                onClick={handleGenerateSummary}
                disabled={isGenerating}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-green-500 text-white hover:bg-green-600 transition disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-wand-magic-sparkles" />
                    AI Summary
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Summary length toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Length:</span>
          <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg p-0.5">
            {['brief', 'detailed'].map(length => (
              <button
                key={length}
                onClick={() => setSummaryLength(length as typeof summaryLength)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium capitalize transition ${
                  summaryLength === length
                    ? 'bg-white dark:bg-zinc-600 text-zinc-800 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {length}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom AI Summary */}
      {customSummary && (
        <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-sparkles text-green-500 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">AI-Generated Summary</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{customSummary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 px-4 py-2 overflow-x-auto border-b border-zinc-100 dark:border-zinc-700">
        {summarySections.map(section => {
          const color = getSectionColor(section.type);
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition ${
                activeSection === section.id
                  ? `bg-${color}-100 dark:bg-${color}-900/40 text-${color}-600 dark:text-${color}-400`
                  : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600'
              }`}
            >
              <i className={`fa-solid ${getSectionIcon(section.type)}`} />
              {section.title}
            </button>
          );
        })}
      </div>

      {/* Section content */}
      <div className="p-4">
        {activeContent ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${getSectionColor(activeContent.type)}-100 dark:bg-${getSectionColor(activeContent.type)}-900/40`}>
                <i className={`fa-solid ${getSectionIcon(activeContent.type)} text-${getSectionColor(activeContent.type)}-500 text-sm`} />
              </div>
              <h4 className="text-sm font-bold text-zinc-800 dark:text-white">
                {activeContent.title}
              </h4>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
              {activeContent.content}
            </p>
            {activeContent.items && activeContent.items.length > 0 && (
              <ul className="space-y-2">
                {activeContent.items.slice(0, summaryLength === 'brief' ? 3 : undefined).map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold bg-${getSectionColor(activeContent.type)}-100 dark:bg-${getSectionColor(activeContent.type)}-900/40 text-${getSectionColor(activeContent.type)}-600 dark:text-${getSectionColor(activeContent.type)}-400`}>
                      {idx + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
              <i className="fa-solid fa-file-lines text-zinc-400 text-lg" />
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No summary available</p>
          </div>
        )}
      </div>

      {/* Export/Share actions */}
      {(onExportSummary || onShareSummary) && (
        <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between">
            {onExportSummary && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Export:</span>
                {['text', 'markdown', 'pdf'].map(format => (
                  <button
                    key={format}
                    onClick={() => onExportSummary(format as 'text' | 'markdown' | 'pdf')}
                    className="px-2 py-1 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600 uppercase transition"
                  >
                    {format}
                  </button>
                ))}
              </div>
            )}
            {onShareSummary && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Share:</span>
                <button
                  onClick={() => onShareSummary('copy')}
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                  title="Copy to clipboard"
                >
                  <i className="fa-solid fa-copy text-xs" />
                </button>
                <button
                  onClick={() => onShareSummary('email')}
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                  title="Send via email"
                >
                  <i className="fa-solid fa-envelope text-xs" />
                </button>
                <button
                  onClick={() => onShareSummary('slack')}
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                  title="Share to Slack"
                >
                  <i className="fa-brands fa-slack text-xs" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Summary badge for thread list
export const SummaryBadge: React.FC<{
  messageCount: number;
  hasSummary?: boolean;
  onClick?: () => void;
}> = ({ messageCount, hasSummary = false, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition ${
        hasSummary
          ? 'text-green-500 bg-green-100 dark:bg-green-900/40'
          : 'text-zinc-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
      }`}
      title={hasSummary ? 'View summary' : 'Generate summary'}
    >
      <i className="fa-solid fa-file-lines text-xs" />
      {messageCount > 0 && <span className="text-[10px] font-medium">{messageCount}</span>}
    </button>
  );
};

export default ConversationSummary;
