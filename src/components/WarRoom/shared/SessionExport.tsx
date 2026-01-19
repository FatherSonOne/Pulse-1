import React, { useState } from 'react';
import { AIMessage } from '../../../services/ragService';
import toast from 'react-hot-toast';

interface SessionExportProps {
  sessionId: string;
  sessionTitle: string;
  messages: AIMessage[];
  topic?: string;
  mode?: string;
  documents?: { title: string; summary?: string }[];
  onClose: () => void;
  className?: string;
}

export const SessionExport: React.FC<SessionExportProps> = ({
  sessionId,
  sessionTitle,
  messages,
  topic,
  mode,
  documents = [],
  onClose,
  className = ''
}) => {
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const generateMarkdown = (includeSummary = false): string => {
    const timestamp = new Date().toLocaleString();

    let md = `# ${sessionTitle}\n\n`;
    md += `**Exported:** ${timestamp}\n`;
    if (mode) md += `**Mode:** ${mode}\n`;
    if (topic) md += `**Focus Topic:** ${topic}\n`;
    md += `**Messages:** ${messages.length}\n\n`;
    md += `---\n\n`;

    // Include document summaries if available
    if (documents.length > 0) {
      md += `## Context Documents\n\n`;
      documents.forEach(doc => {
        md += `- **${doc.title}**`;
        if (doc.summary) md += `: ${doc.summary}`;
        md += `\n`;
      });
      md += `\n---\n\n`;
    }

    // Messages
    md += `## Conversation\n\n`;
    messages.forEach(msg => {
      const role = msg.role === 'user' ? 'You' : 'AI';
      const time = new Date(msg.created_at).toLocaleTimeString();

      md += `### ${role} (${time})\n\n`;
      md += `${msg.content}\n\n`;

      if (msg.citations && msg.citations.length > 0) {
        md += `*Sources: ${msg.citations.map((c: any) => c.title).join(', ')}*\n\n`;
      }
    });

    return md;
  };

  const generateJSON = () => {
    return {
      session: {
        id: sessionId,
        title: sessionTitle,
        topic,
        mode,
        exported_at: new Date().toISOString()
      },
      documents: documents.map(d => ({
        title: d.title,
        summary: d.summary
      })),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
        citations: m.citations
      }))
    };
  };

  const extractKeyPoints = (): string[] => {
    const points: string[] = [];
    const aiMessages = messages.filter(m => m.role === 'assistant');

    aiMessages.forEach(msg => {
      // Extract bullet points
      const bullets = msg.content.match(/^[\-\*\d\.]+\s+.+$/gm);
      if (bullets) {
        points.push(...bullets.slice(0, 3).map(b => b.replace(/^[\-\*\d\.]+\s+/, '')));
      }
    });

    return points.slice(0, 10);
  };

  const extractActionItems = (): string[] => {
    const actions: string[] = [];
    const content = messages.map(m => m.content).join('\n');

    // Look for action-like phrases
    const patterns = [
      /(?:should|need to|must|will|going to|plan to|want to)\s+([^.!?]+)/gi,
      /(?:action item|todo|task|next step)[:\s]+([^.!?]+)/gi,
      /(?:let's|we should|you should)\s+([^.!?]+)/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const action = match[1].trim();
        if (action.length > 10 && action.length < 200) {
          actions.push(action);
        }
      }
    });

    return [...new Set(actions)].slice(0, 10);
  };

  const handleExport = (format: 'markdown' | 'json' | 'clipboard' | 'key-points') => {
    try {
      if (format === 'markdown') {
        const content = generateMarkdown();
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sessionTitle.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exported as Markdown');
      } else if (format === 'json') {
        const content = JSON.stringify(generateJSON(), null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sessionTitle.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exported as JSON');
      } else if (format === 'clipboard') {
        const content = generateMarkdown();
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard');
      } else if (format === 'key-points') {
        const keyPoints = extractKeyPoints();
        const actionItems = extractActionItems();

        let summary = `# Session Summary: ${sessionTitle}\n\n`;

        if (topic) {
          summary += `**Topic:** ${topic}\n\n`;
        }

        if (keyPoints.length > 0) {
          summary += `## Key Points\n`;
          keyPoints.forEach(p => {
            summary += `- ${p}\n`;
          });
          summary += `\n`;
        }

        if (actionItems.length > 0) {
          summary += `## Action Items\n`;
          actionItems.forEach(a => {
            summary += `- [ ] ${a}\n`;
          });
        }

        navigator.clipboard.writeText(summary);
        toast.success('Key points copied to clipboard');
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    }
  };

  return (
    <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 ${className}`}>
      <div className="war-room-modal w-full max-w-lg mx-4 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold war-room-text-primary">
              <i className="fa fa-share-nodes mr-2"></i>
              Export Session
            </h3>
            <p className="text-xs war-room-text-secondary mt-1">
              {messages.length} messages
              {topic && ` | Topic: ${topic}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="war-room-btn war-room-btn-icon"
          >
            <i className="fa fa-times"></i>
          </button>
        </div>

        {/* Export Options */}
        <div className="p-4 space-y-3">
          {/* Full Export Options */}
          <button
            onClick={() => handleExport('markdown')}
            className="war-room-list-item w-full p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <i className="fa fa-file-lines text-blue-400"></i>
              </div>
              <div className="flex-1">
                <div className="font-medium">Markdown File</div>
                <div className="text-xs war-room-text-secondary">Full conversation as .md file</div>
              </div>
              <i className="fa fa-download war-room-text-secondary"></i>
            </div>
          </button>

          <button
            onClick={() => handleExport('json')}
            className="war-room-list-item w-full p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <i className="fa fa-code text-purple-400"></i>
              </div>
              <div className="flex-1">
                <div className="font-medium">JSON Data</div>
                <div className="text-xs war-room-text-secondary">Structured data for integrations</div>
              </div>
              <i className="fa fa-download war-room-text-secondary"></i>
            </div>
          </button>

          <button
            onClick={() => handleExport('clipboard')}
            className="war-room-list-item w-full p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <i className="fa fa-clipboard text-emerald-400"></i>
              </div>
              <div className="flex-1">
                <div className="font-medium">Copy to Clipboard</div>
                <div className="text-xs war-room-text-secondary">Paste into docs, notes, or messages</div>
              </div>
              <i className="fa fa-copy war-room-text-secondary"></i>
            </div>
          </button>

          <button
            onClick={() => handleExport('key-points')}
            className="war-room-list-item w-full p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500/20 rounded-lg flex items-center justify-center">
                <i className="fa fa-list-check text-rose-400"></i>
              </div>
              <div className="flex-1">
                <div className="font-medium">Key Points & Actions</div>
                <div className="text-xs war-room-text-secondary">Extracted insights and action items</div>
              </div>
              <i className="fa fa-sparkles war-room-text-secondary"></i>
            </div>
          </button>
        </div>

        {/* Quick Stats */}
        <div className="p-4 border-t border-white/10 bg-white/5">
          <div className="grid grid-cols-3 gap-4 text-center text-xs">
            <div>
              <div className="text-lg font-bold war-room-text-primary">{messages.length}</div>
              <div className="war-room-text-secondary">Messages</div>
            </div>
            <div>
              <div className="text-lg font-bold war-room-text-primary">
                {messages.filter(m => m.role === 'assistant').length}
              </div>
              <div className="war-room-text-secondary">AI Responses</div>
            </div>
            <div>
              <div className="text-lg font-bold war-room-text-primary">{documents.length}</div>
              <div className="war-room-text-secondary">Documents</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
