// Conversation Flow Visualization
import React, { useMemo, useState } from 'react';

interface MessageNode {
  id: string;
  text: string;
  sender: 'user' | 'other';
  timestamp: string;
  type: 'message' | 'decision' | 'task' | 'question' | 'milestone';
  reactions?: string[];
}

interface FlowData {
  nodes: Array<{
    id: string;
    type: MessageNode['type'];
    sender: 'user' | 'other';
    preview: string;
    timestamp: Date;
    importance: number;
  }>;
  phases: Array<{
    name: string;
    startIdx: number;
    endIdx: number;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  turningPoints: Array<{
    idx: number;
    reason: string;
  }>;
}

interface ConversationFlowVizProps {
  messages: MessageNode[];
  contactName: string;
  onMessageClick?: (messageId: string) => void;
}

export const ConversationFlowViz: React.FC<ConversationFlowVizProps> = ({
  messages,
  contactName,
  onMessageClick
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'flow' | 'heatmap'>('timeline');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const flowData = useMemo((): FlowData => {
    // Handle undefined/empty messages
    if (!messages || messages.length === 0) {
      return { nodes: [], phases: [], turningPoints: [] };
    }

    // Analyze messages and create flow visualization data
    const nodes = messages.map(msg => {
      // Detect message type
      let type: MessageNode['type'] = 'message';
      const lowerText = msg.text.toLowerCase();

      if (lowerText.includes('decide') || lowerText.includes('agreed') || lowerText.includes('let\'s go with')) {
        type = 'decision';
      } else if (lowerText.includes('todo') || lowerText.includes('action item') || lowerText.includes('need to')) {
        type = 'task';
      } else if (msg.text.includes('?')) {
        type = 'question';
      } else if (lowerText.includes('milestone') || lowerText.includes('completed') || lowerText.includes('done!')) {
        type = 'milestone';
      }

      // Calculate importance
      let importance = 1;
      if (type !== 'message') importance += 2;
      if (msg.reactions && msg.reactions.length > 0) importance += msg.reactions.length;
      if (msg.text.length > 200) importance += 1;

      return {
        id: msg.id,
        type,
        sender: msg.sender,
        preview: msg.text.slice(0, 50) + (msg.text.length > 50 ? '...' : ''),
        timestamp: new Date(msg.timestamp),
        importance: Math.min(5, importance)
      };
    });

    // Detect conversation phases
    const phases: FlowData['phases'] = [];
    const chunkSize = Math.max(3, Math.floor(nodes.length / 5));
    for (let i = 0; i < nodes.length; i += chunkSize) {
      const chunk = nodes.slice(i, Math.min(i + chunkSize, nodes.length));

      // Determine phase sentiment (simplified)
      const questionCount = chunk.filter(n => n.type === 'question').length;
      const decisionCount = chunk.filter(n => n.type === 'decision' || n.type === 'milestone').length;

      let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
      if (decisionCount > questionCount) sentiment = 'positive';
      else if (questionCount > chunk.length / 2) sentiment = 'negative';

      // Name the phase
      let name = 'Discussion';
      if (i === 0) name = 'Opening';
      else if (i + chunkSize >= nodes.length) name = 'Resolution';
      else if (decisionCount > 0) name = 'Decision Point';
      else if (questionCount > 1) name = 'Exploration';

      phases.push({
        name,
        startIdx: i,
        endIdx: Math.min(i + chunkSize - 1, nodes.length - 1),
        sentiment
      });
    }

    // Find turning points
    const turningPoints: FlowData['turningPoints'] = [];
    nodes.forEach((node, idx) => {
      if (idx > 0 && node.type !== 'message' && nodes[idx - 1].type === 'message') {
        turningPoints.push({
          idx,
          reason: node.type === 'decision' ? 'Decision made' :
            node.type === 'milestone' ? 'Milestone reached' :
            node.type === 'task' ? 'Action item created' :
            'Key question asked'
        });
      }
    });

    return { nodes, phases, turningPoints };
  }, [messages]);

  const getTypeIcon = (type: MessageNode['type']) => {
    switch (type) {
      case 'decision': return 'fa-gavel';
      case 'task': return 'fa-check-circle';
      case 'question': return 'fa-question-circle';
      case 'milestone': return 'fa-flag-checkered';
      default: return 'fa-comment';
    }
  };

  const getTypeColor = (type: MessageNode['type']) => {
    switch (type) {
      case 'decision': return 'text-purple-500 bg-purple-100 dark:bg-purple-900/40';
      case 'task': return 'text-green-500 bg-green-100 dark:bg-green-900/40';
      case 'question': return 'text-amber-500 bg-amber-100 dark:bg-amber-900/40';
      case 'milestone': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/40';
      default: return 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800';
    }
  };

  const getSentimentColor = (sentiment: 'positive' | 'neutral' | 'negative') => {
    switch (sentiment) {
      case 'positive': return 'bg-emerald-500';
      case 'negative': return 'bg-red-500';
      default: return 'bg-zinc-400';
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <i className="fa-solid fa-diagram-project text-indigo-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Conversation Flow</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{messages?.length || 0} messages analyzed</p>
            </div>
          </div>
          <div className="flex gap-1">
            {(['timeline', 'flow', 'heatmap'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 py-1 text-[10px] font-medium rounded transition ${
                  viewMode === mode
                    ? 'bg-indigo-500 text-white'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {viewMode === 'timeline' && (
          <div className="space-y-2">
            {/* Phase Headers */}
            <div className="flex gap-1 mb-4">
              {flowData.phases.map((phase, idx) => (
                <div
                  key={idx}
                  className="flex-1"
                  style={{ flexGrow: phase.endIdx - phase.startIdx + 1 }}
                >
                  <div className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate mb-1">
                    {phase.name}
                  </div>
                  <div className={`h-1 rounded-full ${getSentimentColor(phase.sentiment)}`} />
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="relative">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-700 transform -translate-x-1/2" />

              {flowData.nodes.filter(n => n.importance > 1).map((node, idx) => {
                const isLeft = node.sender === 'user';
                const isTurningPoint = flowData.turningPoints.some(tp => tp.idx === flowData.nodes.indexOf(node));

                return (
                  <div
                    key={node.id}
                    className={`relative flex items-center mb-3 ${isLeft ? 'justify-start' : 'justify-end'}`}
                  >
                    <button
                      onClick={() => onMessageClick?.(node.id)}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className={`w-[45%] p-2 rounded-lg border transition-all ${
                        isTurningPoint ? 'border-indigo-400 dark:border-indigo-600' : 'border-zinc-200 dark:border-zinc-700'
                      } ${hoveredNode === node.id ? 'scale-105 shadow-lg' : ''} ${
                        isLeft ? 'text-left mr-auto' : 'text-right ml-auto'
                      } bg-white dark:bg-zinc-900`}
                    >
                      <div className={`flex items-center gap-1.5 ${isLeft ? '' : 'justify-end'}`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${getTypeColor(node.type)}`}>
                          <i className={`fa-solid ${getTypeIcon(node.type)} text-[8px]`} />
                        </div>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {node.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-700 dark:text-zinc-300 mt-1 line-clamp-2">
                        {node.preview}
                      </div>
                    </button>

                    {/* Center dot */}
                    <div className="absolute left-1/2 transform -translate-x-1/2">
                      <div className={`w-3 h-3 rounded-full border-2 border-white dark:border-zinc-800 ${
                        isTurningPoint ? 'bg-indigo-500' : getTypeColor(node.type).split(' ')[0].replace('text', 'bg')
                      }`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'flow' && (
          <div className="flex flex-wrap gap-2 items-center justify-center">
            {flowData.nodes.map((node, idx) => (
              <React.Fragment key={node.id}>
                <button
                  onClick={() => onMessageClick?.(node.id)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    getTypeColor(node.type)
                  } ${hoveredNode === node.id ? 'scale-125 ring-2 ring-indigo-500' : ''}`}
                  style={{ opacity: 0.4 + (node.importance * 0.15) }}
                  title={node.preview}
                >
                  <i className={`fa-solid ${getTypeIcon(node.type)} text-xs`} />
                </button>
                {idx < flowData.nodes.length - 1 && (
                  <i className="fa-solid fa-chevron-right text-zinc-300 dark:text-zinc-600 text-[8px]" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {viewMode === 'heatmap' && (
          <div>
            <div className="grid grid-cols-12 gap-0.5">
              {flowData.nodes.map(node => {
                const intensity = node.importance / 5;
                return (
                  <button
                    key={node.id}
                    onClick={() => onMessageClick?.(node.id)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className={`aspect-square rounded transition-all ${
                      hoveredNode === node.id ? 'ring-2 ring-indigo-500' : ''
                    }`}
                    style={{
                      backgroundColor: node.sender === 'user'
                        ? `rgba(59, 130, 246, ${intensity})`
                        : `rgba(34, 197, 94, ${intensity})`
                    }}
                    title={`${node.sender}: ${node.preview}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-center gap-6 mt-3 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-zinc-500 dark:text-zinc-400">You</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-zinc-500 dark:text-zinc-400">{contactName}</span>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700 justify-center">
          {[
            { type: 'decision' as const, label: 'Decision' },
            { type: 'task' as const, label: 'Task' },
            { type: 'question' as const, label: 'Question' },
            { type: 'milestone' as const, label: 'Milestone' },
          ].map(item => (
            <div key={item.type} className="flex items-center gap-1">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${getTypeColor(item.type)}`}>
                <i className={`fa-solid ${getTypeIcon(item.type)} text-[8px]`} />
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Turning Points Summary */}
        {flowData.turningPoints.length > 0 && (
          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
            <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Key Moments
            </div>
            <div className="space-y-1">
              {flowData.turningPoints.slice(0, 3).map((tp, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <i className="fa-solid fa-star text-amber-500 text-[8px]" />
                  {tp.reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationFlowViz;
