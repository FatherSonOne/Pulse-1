/**
 * Voice Session History Component
 * Displays and manages conversation history for voice sessions
 * 
 * Features:
 * - Real-time history updates
 * - Message filtering and search
 * - Export functionality
 * - Tool call visualization
 * - Transcript timestamps
 */

import React, { useState, useMemo } from 'react';
import { RealtimeHistoryItem } from '../../services/realtimeAgentService';
import { MarkdownRenderer } from '../shared';
import '../shared/PulseTypography.css';

interface VoiceSessionHistoryProps {
  history: RealtimeHistoryItem[];
  currentAgent: string;
  onClearHistory?: () => void;
  onExport?: (format: 'json' | 'text' | 'markdown') => void;
  className?: string;
}

export const VoiceSessionHistory: React.FC<VoiceSessionHistoryProps> = ({
  history,
  currentAgent,
  onClearHistory,
  onExport,
  className = '',
}) => {
  const [filter, setFilter] = useState<'all' | 'messages' | 'tools'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Filter history items
  const filteredHistory = useMemo(() => {
    let items = [...history];

    // Apply type filter
    if (filter === 'messages') {
      items = items.filter(item => item.type === 'message');
    } else if (filter === 'tools') {
      items = items.filter(item => item.type === 'function_call' || item.type === 'function_result');
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => {
        const content = item.content || item.transcript || item.name || item.output || '';
        return content.toLowerCase().includes(query);
      });
    }

    return items;
  }, [history, filter, searchQuery]);

  // Group consecutive items by type for better visualization
  const groupedHistory = useMemo(() => {
    const groups: { type: string; items: RealtimeHistoryItem[] }[] = [];
    let currentGroup: { type: string; items: RealtimeHistoryItem[] } | null = null;

    filteredHistory.forEach(item => {
      const groupType = item.type === 'message' ? `message-${item.role}` : 'tool';
      
      if (!currentGroup || currentGroup.type !== groupType) {
        currentGroup = { type: groupType, items: [item] };
        groups.push(currentGroup);
      } else {
        currentGroup.items.push(item);
      }
    });

    return groups;
  }, [filteredHistory]);

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleExport = (format: 'json' | 'text' | 'markdown') => {
    onExport?.(format);
    setShowExportMenu(false);
  };

  const exportToClipboard = (format: 'json' | 'text' | 'markdown') => {
    let content = '';

    if (format === 'json') {
      content = JSON.stringify(history, null, 2);
    } else if (format === 'text') {
      content = history.map(item => {
        if (item.type === 'message') {
          return `[${formatTimestamp(item.timestamp)}] ${item.role}: ${item.content || item.transcript}`;
        } else if (item.type === 'function_call') {
          return `[${formatTimestamp(item.timestamp)}] Tool: ${item.name}(${item.arguments})`;
        } else if (item.type === 'function_result') {
          return `[${formatTimestamp(item.timestamp)}] Result: ${item.output}`;
        }
        return '';
      }).join('\n');
    } else if (format === 'markdown') {
      content = `# Voice Session Transcript\n\n${history.map(item => {
        if (item.type === 'message') {
          return `**${item.role}** (${formatTimestamp(item.timestamp)}):\n> ${item.content || item.transcript}\n`;
        } else if (item.type === 'function_call') {
          return `\`\`\`\n🔧 ${item.name}(${item.arguments})\n\`\`\`\n`;
        } else if (item.type === 'function_result') {
          return `\`\`\`\n📤 ${item.output}\n\`\`\`\n`;
        }
        return '';
      }).join('\n')}`;
    }

    navigator.clipboard.writeText(content);
    setShowExportMenu(false);
  };

  return (
    <div className={`voice-session-history flex flex-col h-full ${className}`}>
      {/* Header - Archives-style */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 bg-cyan-500 rounded-full"></div>
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Session History
          </h3>
          <span className="font-mono text-[10px] text-zinc-600">
            {history.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Button */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Export"
            >
              <i className="fa fa-download" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-10">
                <button
                  onClick={() => exportToClipboard('text')}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 rounded-t-lg"
                >
                  <i className="fa fa-file-alt mr-2" />
                  Copy as Text
                </button>
                <button
                  onClick={() => exportToClipboard('markdown')}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800"
                >
                  <i className="fa fa-file-code mr-2" />
                  Copy as Markdown
                </button>
                <button
                  onClick={() => exportToClipboard('json')}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 rounded-b-lg"
                >
                  <i className="fa fa-file-code mr-2" />
                  Copy as JSON
                </button>
              </div>
            )}
          </div>

          {/* Clear Button */}
          {onClearHistory && history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
              title="Clear History"
            >
              <i className="fa fa-trash" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-2 border-b border-gray-800 space-y-2">
        {/* Search */}
        <div className="relative">
          <i className="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history..."
            className="w-full pl-9 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Type Filter */}
        <div className="flex gap-1">
          {(['all', 'messages', 'tools'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filter === type
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {type === 'all' && 'All'}
              {type === 'messages' && 'Messages'}
              {type === 'tools' && 'Tools'}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <i className="fa fa-inbox text-3xl mb-2" />
            <p className="text-sm">
              {history.length === 0 ? 'No history yet' : 'No matching items'}
            </p>
          </div>
        ) : (
          filteredHistory.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border transition-colors ${
                item.type === 'message'
                  ? item.role === 'user'
                    ? 'bg-cyan-500/5 border-cyan-500/20'
                    : 'bg-gray-800/50 border-gray-700'
                  : 'bg-purple-500/5 border-purple-500/20'
              }`}
            >
              {/* Item Header */}
              <button
                onClick={() => toggleExpanded(item.id)}
                className="w-full flex items-center justify-between p-2 text-left"
              >
                <div className="flex items-center gap-2">
                  {/* Icon */}
                  {item.type === 'message' ? (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      item.role === 'user'
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      <i className={`fa ${item.role === 'user' ? 'fa-user' : 'fa-robot'}`} />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-xs">
                      <i className={`fa ${item.type === 'function_call' ? 'fa-cog' : 'fa-check'}`} />
                    </div>
                  )}

                  {/* Label */}
                  <span className="text-sm text-gray-300">
                    {item.type === 'message' && (item.role === 'user' ? 'You' : 'AI')}
                    {item.type === 'function_call' && `Tool: ${item.name}`}
                    {item.type === 'function_result' && `Result: ${item.name}`}
                  </span>
                </div>

                {/* Timestamp & Expand */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatTimestamp(item.timestamp)}</span>
                  <i className={`fa fa-chevron-${expandedItems.has(item.id) ? 'up' : 'down'}`} />
                </div>
              </button>

              {/* Item Content (Expanded) - Archives-style formatting */}
              {expandedItems.has(item.id) && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-700/50">
                  {item.type === 'message' && (
                    item.role === 'assistant' ? (
                      <MarkdownRenderer
                        content={item.content || item.transcript || '(no content)'}
                        className="text-zinc-200"
                      />
                    ) : (
                      <p className="text-sm text-gray-200 leading-relaxed">
                        {item.content || item.transcript || '(no content)'}
                      </p>
                    )
                  )}

                  {item.type === 'function_call' && (
                    <div className="space-y-2">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-400">Arguments</div>
                      <pre className="text-xs text-cyan-400 bg-black/40 p-3 rounded-lg overflow-x-auto border border-cyan-500/20">
                        {item.arguments ? JSON.stringify(JSON.parse(item.arguments), null, 2) : '{}'}
                      </pre>
                    </div>
                  )}

                  {item.type === 'function_result' && (
                    <div className="space-y-2">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-green-400">Output</div>
                      <pre className="text-xs text-green-400 bg-black/40 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap border border-green-500/20">
                        {item.output || '(no output)'}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Collapsed Preview */}
              {!expandedItems.has(item.id) && (
                <div className="px-3 pb-2">
                  <p className="text-xs text-gray-400 truncate">
                    {item.type === 'message' && (item.content || item.transcript || '(no content)').substring(0, 100)}
                    {item.type === 'function_call' && `Arguments: ${item.arguments?.substring(0, 50)}...`}
                    {item.type === 'function_result' && `${item.output?.substring(0, 50)}...`}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-2 border-t border-gray-800 flex justify-between text-xs text-gray-500">
        <span>
          {filteredHistory.filter(i => i.type === 'message' && i.role === 'user').length} user messages
        </span>
        <span>
          {filteredHistory.filter(i => i.type === 'function_call').length} tool calls
        </span>
      </div>
    </div>
  );
};

export default VoiceSessionHistory;
