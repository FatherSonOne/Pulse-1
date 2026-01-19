/**
 * ContextualSuggestions Component
 * Shows smart tool suggestions based on context and usage patterns
 */

import React, { useMemo } from 'react';
import { Tool } from './types';
import { getCategoryColor } from './toolsData';

interface ContextualSuggestionsProps {
  allTools: Tool[];
  recentTools: string[];
  currentTime?: Date;
  onToolSelect: (toolId: string) => void;
}

export const ContextualSuggestions: React.FC<ContextualSuggestionsProps> = ({
  allTools,
  recentTools,
  currentTime = new Date(),
  onToolSelect
}) => {
  // Generate contextual suggestions based on time, recent usage, etc.
  const suggestions = useMemo(() => {
    const hour = currentTime.getHours();
    const suggestedToolIds: string[] = [];

    // Time-based suggestions
    if (hour >= 9 && hour < 12) {
      // Morning: productivity tools
      suggestedToolIds.push('brainstorm-assistant', 'smart-compose', 'templates');
    } else if (hour >= 13 && hour < 17) {
      // Afternoon: analysis tools
      suggestedToolIds.push('conversation-intelligence', 'sentiment-analysis', 'engagement-scoring');
    } else if (hour >= 18) {
      // Evening: summary and planning tools
      suggestedToolIds.push('analytics-export', 'draft-manager', 'scheduled-messages');
    }

    // Add tools related to recently used tools
    if (recentTools.length > 0) {
      const lastUsedTool = allTools.find(t => t.id === recentTools[0]);
      if (lastUsedTool) {
        // Suggest tools from the same category
        const relatedTools = allTools
          .filter(t => t.category === lastUsedTool.category && t.id !== lastUsedTool.id)
          .slice(0, 2);
        suggestedToolIds.push(...relatedTools.map(t => t.id));
      }
    }

    // Remove duplicates and filter to existing tools
    const uniqueIds = Array.from(new Set(suggestedToolIds));
    return allTools.filter(tool => uniqueIds.includes(tool.id)).slice(0, 4);
  }, [allTools, recentTools, currentTime]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="
        p-3 rounded-xl
        bg-purple-50 dark:bg-purple-950/20
        border border-purple-200 dark:border-purple-800/30
      "
      role="region"
      aria-label="Suggested tools"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <i className="fa-solid fa-lightbulb text-purple-600 dark:text-purple-400 text-sm"></i>
        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
          Suggested For You
        </h3>
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((tool) => {
          const colors = getCategoryColor(tool.category);

          return (
            <button
              key={tool.id}
              onClick={() => onToolSelect(tool.id)}
              className={`
                group
                inline-flex items-center gap-2 px-3 py-1.5
                rounded-lg
                border transition-all duration-200
                hover:scale-105 hover:shadow-md
                focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500
                ${colors.bg} ${colors.text} ${colors.border}
              `}
              title={tool.description}
            >
              <i className={`fa-solid ${tool.icon} text-xs`}></i>
              <span className="text-xs font-medium">{tool.name}</span>
              <i className="fa-solid fa-arrow-right text-xs opacity-0 group-hover:opacity-100 -ml-1 group-hover:ml-0 transition-all"></i>
            </button>
          );
        })}
      </div>
    </div>
  );
};
