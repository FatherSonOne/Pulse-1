// ActionItemExtractor.tsx - Extract action items from emails and create tasks
import React, { useState, useEffect } from 'react';
import { CachedEmail } from '../../services/emailSyncService';
import { supabase } from '../../services/supabase';

interface ActionItem {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: Date | null;
  assignee: string | null;
  selected: boolean;
}

interface ActionItemExtractorProps {
  email: CachedEmail;
  onCreateTasks: (items: ActionItem[]) => void;
  onDismiss: () => void;
}

export const ActionItemExtractor: React.FC<ActionItemExtractorProps> = ({
  email,
  onCreateTasks,
  onDismiss,
}) => {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    extractActionItems();
  }, [email]);

  const extractActionItems = () => {
    setLoading(true);
    try {
      const text = email.body_text || '';
      const items: ActionItem[] = [];

      // Common action patterns
      const actionPatterns = [
        // "Please [verb]..." patterns
        /please\s+(\w+\s+[^.!?\n]+)/gi,
        // "Can you [verb]..." patterns
        /can\s+you\s+(\w+\s+[^.!?\n]+)/gi,
        // "Could you [verb]..." patterns
        /could\s+you\s+(\w+\s+[^.!?\n]+)/gi,
        // "Would you [verb]..." patterns
        /would\s+you\s+(\w+\s+[^.!?\n]+)/gi,
        // "Need to [verb]..." patterns
        /need\s+to\s+(\w+\s+[^.!?\n]+)/gi,
        // "Make sure to [verb]..." patterns
        /make\s+sure\s+(?:to\s+)?(\w+\s+[^.!?\n]+)/gi,
        // "Don't forget to [verb]..." patterns
        /don'?t\s+forget\s+to\s+(\w+\s+[^.!?\n]+)/gi,
        // "Action item:" patterns
        /action\s*(?:item)?[:\s]+([^.!?\n]+)/gi,
        // "TODO:" patterns
        /todo[:\s]+([^.!?\n]+)/gi,
        // "- [ ]" checkbox patterns (markdown)
        /[-*]\s*\[\s*\]\s*([^.\n]+)/gi,
        // Numbered list items with verbs
        /\d+\.\s*((?:review|send|create|update|check|complete|submit|prepare|schedule|follow|contact|confirm|approve|finalize)[^.!?\n]+)/gi,
      ];

      const seenItems = new Set<string>();

      for (const pattern of actionPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const itemText = match[1].trim();

          // Skip very short or very long items
          if (itemText.length < 10 || itemText.length > 200) continue;

          // Skip duplicates (case-insensitive)
          const normalized = itemText.toLowerCase();
          if (seenItems.has(normalized)) continue;
          seenItems.add(normalized);

          // Determine priority based on keywords
          let priority: 'high' | 'medium' | 'low' = 'medium';
          const lowerText = itemText.toLowerCase();

          if (
            lowerText.includes('urgent') ||
            lowerText.includes('asap') ||
            lowerText.includes('immediately') ||
            lowerText.includes('critical') ||
            lowerText.includes('today')
          ) {
            priority = 'high';
          } else if (
            lowerText.includes('when you can') ||
            lowerText.includes('when possible') ||
            lowerText.includes('eventually') ||
            lowerText.includes('low priority')
          ) {
            priority = 'low';
          }

          // Try to extract due date
          let dueDate: Date | null = null;
          const dueDatePatterns = [
            /by\s+(?:end\s+of\s+)?(?:today|eod)/i,
            /by\s+(?:end\s+of\s+)?(?:tomorrow)/i,
            /by\s+(?:end\s+of\s+)?(?:this\s+week|friday)/i,
            /by\s+(\w+\s+\d{1,2})/i,
            /due\s+(\w+\s+\d{1,2})/i,
          ];

          for (const datePattern of dueDatePatterns) {
            const dateMatch = itemText.match(datePattern);
            if (dateMatch) {
              const today = new Date();

              if (/today|eod/i.test(dateMatch[0])) {
                dueDate = today;
              } else if (/tomorrow/i.test(dateMatch[0])) {
                dueDate = new Date(today);
                dueDate.setDate(dueDate.getDate() + 1);
              } else if (/this\s+week|friday/i.test(dateMatch[0])) {
                dueDate = new Date(today);
                const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
                dueDate.setDate(dueDate.getDate() + daysUntilFriday);
              }
              break;
            }
          }

          items.push({
            id: `action-${items.length}-${Date.now()}`,
            text: itemText.charAt(0).toUpperCase() + itemText.slice(1),
            priority,
            dueDate,
            assignee: null,
            selected: priority === 'high', // Auto-select high priority items
          });
        }
      }

      // Limit to 5 items max
      setActionItems(items.slice(0, 5));
    } catch (error) {
      console.error('Error extracting action items:', error);
      setActionItems([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id: string) => {
    setActionItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleCreateTasks = async () => {
    const selectedItems = actionItems.filter(item => item.selected);
    if (selectedItems.length === 0) return;

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create tasks in the database
      const tasksToCreate = selectedItems.map(item => ({
        user_id: user.id,
        title: item.text,
        description: `From email: ${email.subject || '(no subject)'}`,
        priority: item.priority,
        status: 'pending',
        due_date: item.dueDate?.toISOString() || null,
        source: 'email',
        source_id: email.id,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('tasks')
        .insert(tasksToCreate);

      if (error) {
        console.error('Error creating tasks:', error);
        // Still call the callback to close the extractor
      }

      onCreateTasks(selectedItems);
    } catch (error) {
      console.error('Error creating tasks:', error);
    } finally {
      setCreating(false);
    }
  };

  const getPriorityStyles = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return {
          bg: 'bg-red-500/20',
          text: 'text-red-600 dark:text-red-400',
          label: 'High',
        };
      case 'medium':
        return {
          bg: 'bg-amber-500/20',
          text: 'text-amber-600 dark:text-amber-400',
          label: 'Medium',
        };
      default:
        return {
          bg: 'bg-green-500/20',
          text: 'text-green-600 dark:text-green-400',
          label: 'Low',
        };
    }
  };

  const formatDueDate = (date: Date | null): string => {
    if (!date) return '';
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="bg-purple-500/10 dark:bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-circle-notch fa-spin text-purple-500"></i>
          <span className="text-stone-600 dark:text-zinc-400 text-sm">Scanning for action items...</span>
        </div>
      </div>
    );
  }

  if (actionItems.length === 0) {
    return null;
  }

  const selectedCount = actionItems.filter(i => i.selected).length;

  return (
    <div className="bg-purple-500/10 dark:bg-purple-500/5 border border-purple-500/20 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <i className="fa-solid fa-list-check text-white text-sm"></i>
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-white text-sm">Action Items Detected</h3>
            <span className="text-xs text-stone-500 dark:text-zinc-500">
              {actionItems.length} item{actionItems.length > 1 ? 's' : ''} found
            </span>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="w-6 h-6 rounded hover:bg-purple-500/20 flex items-center justify-center text-stone-400 dark:text-zinc-500 hover:text-stone-600 dark:hover:text-white transition"
        >
          <i className="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>

      {/* Action items list */}
      <div className="p-4 space-y-2">
        {actionItems.map((item) => {
          const priorityStyles = getPriorityStyles(item.priority);

          return (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition ${
                item.selected
                  ? 'bg-purple-500/20 border border-purple-500/30'
                  : 'bg-white dark:bg-zinc-800/50 border border-transparent hover:border-purple-500/20'
              }`}
            >
              {/* Checkbox */}
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                item.selected
                  ? 'bg-purple-500 border-purple-500'
                  : 'border-stone-300 dark:border-zinc-600'
              }`}>
                {item.selected && (
                  <i className="fa-solid fa-check text-white text-xs"></i>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-stone-900 dark:text-white mb-1">
                  {item.text}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${priorityStyles.bg} ${priorityStyles.text}`}>
                    {priorityStyles.label}
                  </span>
                  {item.dueDate && (
                    <span className="text-xs text-stone-500 dark:text-zinc-500 flex items-center gap-1">
                      <i className="fa-regular fa-calendar"></i>
                      {formatDueDate(item.dueDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          onClick={handleCreateTasks}
          disabled={selectedCount === 0 || creating}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 font-medium rounded-lg transition ${
            selectedCount === 0
              ? 'bg-stone-200 dark:bg-zinc-800 text-stone-400 dark:text-zinc-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
          }`}
        >
          {creating ? (
            <>
              <i className="fa-solid fa-circle-notch fa-spin"></i>
              Creating...
            </>
          ) : (
            <>
              <i className="fa-solid fa-plus"></i>
              Create {selectedCount} Task{selectedCount !== 1 ? 's' : ''}
            </>
          )}
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-2 text-stone-600 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white font-medium rounded-lg hover:bg-stone-200 dark:hover:bg-zinc-800 transition"
        >
          Skip
        </button>
      </div>
    </div>
  );
};

export default ActionItemExtractor;
