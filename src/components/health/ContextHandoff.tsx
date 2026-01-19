import { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { UserPlus, Sparkles, Copy, Check } from 'lucide-react';
import './ContextHandoff.css';

interface Props {
  channelId: string;
  messages: any[];
  onAddUser: () => void;
}

export function ContextHandoff({ channelId, messages, onAddUser }: Props) {
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateSummary = async () => {
    setLoading(true);
    
    // Take last 50 messages for context
    const recentMessages = messages.slice(-50);
    
    // Extract key information
    const participants = [...new Set(recentMessages.map(m => m.user?.full_name))];
    const topics = extractTopics(recentMessages);
    const decisions = recentMessages.filter(m => 
      m.content.toLowerCase().includes('decided') || 
      m.content.toLowerCase().includes('agreed')
    );
    const tasks = recentMessages.filter(m =>
      m.content.toLowerCase().includes('will') ||
      m.content.toLowerCase().includes('should') ||
      m.content.toLowerCase().includes('need to')
    );

    const summaryText = `
📋 **Quick Context Summary**

**Participants:** ${participants.join(', ')}

**Main Topics:**
${topics.map(t => `• ${t}`).join('\n')}

**Key Decisions:**
${decisions.slice(0, 3).map(d => `• ${d.content.slice(0, 100)}...`).join('\n') || '• No major decisions yet'}

**Pending Actions:**
${tasks.slice(0, 3).map(t => `• ${t.content.slice(0, 100)}...`).join('\n') || '• No pending actions'}

**Timeline:** Last ${messages.length} messages over ${calculateTimeSpan(messages)}

---
*Summary generated at ${new Date().toLocaleString()}*
    `.trim();

    setSummary(summaryText);
    setLoading(false);
    setShowSummary(true);

    // Save summary to database
    await supabase
      .from('pulse_context_summaries')
      .insert({
        channel_id: channelId,
        summary: summaryText,
        message_count: messages.length,
        created_at: new Date().toISOString()
      });
  };

  const extractTopics = (messages: any[]): string[] => {
    const text = messages.map(m => m.content).join(' ').toLowerCase();
    const topics: string[] = [];

    // Simple keyword extraction
    const keywords = ['feature', 'bug', 'design', 'api', 'database', 'user', 'security', 'performance'];
    keywords.forEach(keyword => {
      const count = (text.match(new RegExp(keyword, 'g')) || []).length;
      if (count > 2) {
        topics.push(`${keyword.charAt(0).toUpperCase()}${keyword.slice(1)} (mentioned ${count} times)`);
      }
    });

    return topics.length > 0 ? topics : ['General discussion'];
  };

  const calculateTimeSpan = (messages: any[]): string => {
    if (messages.length < 2) return 'today';
    
    const first = new Date(messages[0].created_at);
    const last = new Date(messages[messages.length - 1].created_at);
    const days = Math.floor((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday and today';
    return `${days} days`;
  };

  const copySummary = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="context-handoff">
      <button 
        className="handoff-trigger"
        onClick={onAddUser}
        title="Add person with context"
      >
        <UserPlus size={18} />
        <span>Add Person</span>
      </button>

      {showSummary && (
        <div className="summary-modal" onClick={() => setShowSummary(false)}>
          <div className="summary-content" onClick={(e) => e.stopPropagation()}>
            <div className="summary-header">
              <div className="summary-title">
                <Sparkles size={20} />
                <h3>Context Summary</h3>
              </div>
              <button className="close-btn" onClick={() => setShowSummary(false)}>
                ✕
              </button>
            </div>

            <div className="summary-body">
              <pre>{summary}</pre>
            </div>

            <div className="summary-actions">
              <button className="copy-btn" onClick={copySummary}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Summary'}
              </button>
              <button className="share-btn">
                Share via Email
              </button>
            </div>
          </div>
        </div>
      )}

      {!showSummary && (
        <button 
          className="generate-summary-btn"
          onClick={generateSummary}
          disabled={loading}
        >
          <Sparkles size={16} />
          {loading ? 'Generating...' : 'Generate Context Summary'}
        </button>
      )}
    </div>
  );
}