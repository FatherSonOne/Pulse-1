// Network Graph Component
import React, { useMemo } from 'react';
import { Users, TrendingUp, Network } from 'lucide-react';
import type { Thread } from '../../types';
import type { NetworkNode } from '../../types/messageEnhancements';

interface NetworkGraphProps {
  threads: Thread[];
  onNodeClick?: (contactId: string) => void;
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  threads,
  onNodeClick
}) => {
  const networkData = useMemo(() => {
    // Build network nodes
    const nodes = new Map<string, NetworkNode>();
    
    threads.forEach(thread => {
      const existing = nodes.get(thread.contactId);
      if (existing) {
        existing.messageCount += thread.messages.length;
        existing.lastInteraction = new Date(Math.max(
          existing.lastInteraction.getTime(),
          thread.messages[thread.messages.length - 1]?.timestamp.getTime() || 0
        ));
      } else {
        nodes.set(thread.contactId, {
          id: thread.contactId,
          name: thread.contactName,
          avatar: thread.contactAvatar,
          messageCount: thread.messages.length,
          lastInteraction: thread.messages[thread.messages.length - 1]?.timestamp || new Date(),
          strength: 0,
          connections: []
        });
      }
    });
    
    // Calculate connection strength (normalized message count)
    const maxMessages = Math.max(...Array.from(nodes.values()).map(n => n.messageCount), 1);
    nodes.forEach(node => {
      node.strength = node.messageCount / maxMessages;
    });
    
    // Sort by strength
    const sortedNodes = Array.from(nodes.values()).sort((a, b) => b.messageCount - a.messageCount);
    
    return {
      nodes: sortedNodes,
      totalContacts: nodes.size,
      avgStrength: sortedNodes.reduce((sum, n) => sum + n.strength, 0) / nodes.size
    };
  }, [threads]);
  
  const getNodeSize = (strength: number) => {
    return 40 + (strength * 40); // 40px to 80px
  };
  
  const getColorByStrength = (strength: number) => {
    if (strength > 0.7) return 'bg-blue-600 border-blue-700';
    if (strength > 0.4) return 'bg-purple-600 border-purple-700';
    if (strength > 0.2) return 'bg-green-600 border-green-700';
    return 'bg-gray-600 border-gray-700';
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Connection Network
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {networkData.totalContacts} contacts • Avg strength: {(networkData.avgStrength * 100).toFixed(0)}%
          </p>
        </div>
        <Users className="w-6 h-6 text-gray-400" />
      </div>
      
      {/* Network Visualization (Bubble Chart Style) */}
      <div className="relative bg-gray-50 dark:bg-gray-900 rounded-lg p-6 min-h-[300px] flex flex-wrap items-center justify-center gap-4">
        {networkData.nodes.slice(0, 15).map((node) => {
          const size = getNodeSize(node.strength);
          return (
            <button
              key={node.id}
              onClick={() => onNodeClick?.(node.id)}
              className="relative group"
              style={{
                width: `${size}px`,
                height: `${size}px`
              }}
            >
              {/* Node Circle */}
              <div
                className={`w-full h-full rounded-full border-2 ${getColorByStrength(node.strength)} flex items-center justify-center text-white font-semibold transition-transform group-hover:scale-110 shadow-lg`}
                style={{
                  fontSize: `${Math.max(10, size / 4)}px`
                }}
              >
                {node.avatar ? (
                  <img
                    src={node.avatar}
                    alt={node.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>{node.name.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                  <div className="font-medium">{node.name}</div>
                  <div className="text-gray-300 dark:text-gray-400 mt-0.5">
                    {node.messageCount} messages
                  </div>
                  <div className="text-gray-300 dark:text-gray-400">
                    Strength: {(node.strength * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Top Connections List */}
      <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Strongest Connections
        </div>
        <div className="space-y-2">
          {networkData.nodes.slice(0, 5).map((node, index) => (
            <button
              key={node.id}
              onClick={() => onNodeClick?.(node.id)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
                #{index + 1}
              </div>
              {node.avatar ? (
                <img
                  src={node.avatar}
                  alt={node.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                  {node.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {node.name}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {node.messageCount} messages • {(node.strength * 100).toFixed(0)}% strength
                </div>
              </div>
              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${node.strength * 100}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
