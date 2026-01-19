import { useState, useEffect } from 'react';
import {
  FileText,
  GitBranch,
  MessageSquare,
  Users,
  Clock,
  Tag,
  ExternalLink,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Search,
  Lightbulb,
  RefreshCw,
  BookOpen,
  Link2
} from 'lucide-react';
import { generateThreadContext, generateHandoffSummary } from '../../services/geminiService';
import { ThreadContext, HandoffSummary, Message } from '../../types';
import './ContextPanel.css';

interface ContextPanelProps {
  threadId: string;
  messages: Message[];
  apiKey: string;
  onDocClick?: (doc: { name: string; type: string; url?: string }) => void;
  onDecisionClick?: (decision: string) => void;
}

interface RelatedItem {
  id: string;
  type: 'decision' | 'task' | 'document' | 'thread';
  title: string;
  status?: string;
  date?: Date;
  url?: string;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  threadId,
  messages,
  apiKey,
  onDocClick,
  onDecisionClick
}) => {
  const [context, setContext] = useState<ThreadContext | null>(null);
  const [handoff, setHandoff] = useState<HandoffSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'context' | 'handoff' | 'related'>('context');
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);

  useEffect(() => {
    if (messages.length > 0 && apiKey) {
      loadContext();
    }
  }, [messages, apiKey]);

  const loadContext = async () => {
    setLoading(true);
    try {
      const history = messages
        .map((m) => `[${m.sender}]: ${m.text}`)
        .join('\n');

      const [contextResult, handoffResult] = await Promise.all([
        generateThreadContext(apiKey, history),
        messages.length > 5 ? generateHandoffSummary(apiKey, history) : null
      ]);

      if (contextResult) {
        setContext(contextResult);
      }
      if (handoffResult) {
        setHandoff(handoffResult);
      }

      // Generate mock related items based on context
      if (contextResult) {
        const items: RelatedItem[] = [];

        // Add decisions as related items
        contextResult.decisions.forEach((dec, i) => {
          items.push({
            id: `decision-${i}`,
            type: 'decision',
            title: dec,
            status: 'decided',
            date: new Date()
          });
        });

        // Add docs as related items
        contextResult.relatedDocs.forEach((doc, i) => {
          items.push({
            id: `doc-${i}`,
            type: 'document',
            title: doc.name,
            url: doc.url
          });
        });

        setRelatedItems(items);
      }
    } catch (error) {
      console.error('Error loading context:', error);
    }
    setLoading(false);
  };

  const getDocIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText size={16} className="pdf-icon" />;
      case 'doc':
        return <FileText size={16} className="doc-icon" />;
      case 'sheet':
        return <FileText size={16} className="sheet-icon" />;
      case 'image':
        return <FileText size={16} className="image-icon" />;
      default:
        return <FileText size={16} />;
    }
  };

  const renderContextTab = () => {
    if (!context) {
      return (
        <div className="empty-state">
          <Search size={32} />
          <p>No context extracted yet</p>
          <small>Context will appear as the conversation develops</small>
        </div>
      );
    }

    return (
      <div className="context-content">
        {/* Key Topics */}
        {context.keyTopics.length > 0 && (
          <div className="context-section">
            <h4>
              <Tag size={16} /> Key Topics
            </h4>
            <div className="topics-grid">
              {context.keyTopics.map((topic, i) => (
                <span key={i} className="topic-chip">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Decisions Made */}
        {context.decisions.length > 0 && (
          <div className="context-section">
            <h4>
              <CheckCircle size={16} /> Decisions Made
            </h4>
            <div className="decisions-list">
              {context.decisions.map((decision, i) => (
                <div
                  key={i}
                  className="decision-item"
                  onClick={() => onDecisionClick?.(decision)}
                >
                  <CheckCircle size={14} className="decision-icon" />
                  <span>{decision}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Documents */}
        {context.relatedDocs.length > 0 && (
          <div className="context-section">
            <h4>
              <FileText size={16} /> Related Documents
            </h4>
            <div className="docs-list">
              {context.relatedDocs.map((doc, i) => (
                <div
                  key={i}
                  className="doc-item"
                  onClick={() => onDocClick?.(doc)}
                >
                  {getDocIcon(doc.type)}
                  <span className="doc-name">{doc.name}</span>
                  <span className="doc-type">{doc.type.toUpperCase()}</span>
                  {doc.url && <ExternalLink size={12} />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHandoffTab = () => {
    if (!handoff) {
      return (
        <div className="empty-state">
          <Users size={32} />
          <p>No handoff summary yet</p>
          <small>Add more messages to generate a handoff summary</small>
        </div>
      );
    }

    return (
      <div className="handoff-content">
        {/* Context Summary */}
        <div className="handoff-section">
          <h4>
            <BookOpen size={16} /> Context Summary
          </h4>
          <p className="handoff-context">{handoff.context}</p>
        </div>

        {/* Key Decisions */}
        {handoff.keyDecisions.length > 0 && (
          <div className="handoff-section">
            <h4>
              <CheckCircle size={16} /> Key Decisions
            </h4>
            <ul className="handoff-list">
              {handoff.keyDecisions.map((decision, i) => (
                <li key={i}>{decision}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Pending Actions */}
        {handoff.pendingActions.length > 0 && (
          <div className="handoff-section">
            <h4>
              <AlertCircle size={16} /> Pending Actions
            </h4>
            <ul className="handoff-list pending">
              {handoff.pendingActions.map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ul>
          </div>
        )}

        <button className="btn-copy-handoff">
          <FileText size={14} />
          Copy Handoff Summary
        </button>
      </div>
    );
  };

  const renderRelatedTab = () => {
    if (relatedItems.length === 0) {
      return (
        <div className="empty-state">
          <Link2 size={32} />
          <p>No related items found</p>
          <small>Related decisions, tasks, and documents will appear here</small>
        </div>
      );
    }

    return (
      <div className="related-content">
        {relatedItems.map((item) => (
          <div key={item.id} className={`related-item type-${item.type}`}>
            <div className="related-icon">
              {item.type === 'decision' && <CheckCircle size={16} />}
              {item.type === 'task' && <AlertCircle size={16} />}
              {item.type === 'document' && <FileText size={16} />}
              {item.type === 'thread' && <MessageSquare size={16} />}
            </div>
            <div className="related-info">
              <span className="related-type">{item.type}</span>
              <span className="related-title">{item.title}</span>
              {item.status && (
                <span className={`related-status status-${item.status}`}>
                  {item.status}
                </span>
              )}
            </div>
            <ChevronRight size={16} className="related-arrow" />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="context-panel">
      <div className="panel-header">
        <h3>
          <GitBranch size={18} /> Thread Context
        </h3>
        <button
          className="btn-refresh"
          onClick={loadContext}
          disabled={loading}
          title="Analyze Conversation"
        >
          {loading ? (
            <i className="fa-solid fa-circle-notch fa-spin"></i>
          ) : (
            <i className="fa-solid fa-wand-magic-sparkles"></i>
          )}
        </button>
      </div>

      <div className="panel-tabs">
        <button
          className={activeTab === 'context' ? 'active' : ''}
          onClick={() => setActiveTab('context')}
        >
          <Lightbulb size={14} />
          Context
        </button>
        <button
          className={activeTab === 'handoff' ? 'active' : ''}
          onClick={() => setActiveTab('handoff')}
        >
          <Users size={14} />
          Handoff
        </button>
        <button
          className={activeTab === 'related' ? 'active' : ''}
          onClick={() => setActiveTab('related')}
        >
          <Link2 size={14} />
          Related
          {relatedItems.length > 0 && (
            <span className="count-badge">{relatedItems.length}</span>
          )}
        </button>
      </div>

      <div className="panel-content">
        {loading ? (
          <div className="loading-state">
            <RefreshCw size={24} className="spinning" />
            <span>Analyzing thread...</span>
          </div>
        ) : (
          <>
            {activeTab === 'context' && renderContextTab()}
            {activeTab === 'handoff' && renderHandoffTab()}
            {activeTab === 'related' && renderRelatedTab()}
          </>
        )}
      </div>

      {/* Quick Stats */}
      <div className="panel-footer">
        <div className="quick-stats">
          <div className="stat">
            <MessageSquare size={14} />
            <span>{messages.length} messages</span>
          </div>
          <div className="stat">
            <Clock size={14} />
            <span>
              {messages.length > 0
                ? new Date(messages[0].timestamp).toLocaleDateString()
                : 'No messages'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
