// ActionItemExtractor.tsx - Extract action items from emails and create tasks
import React, { useState, useEffect } from 'react';
import { CachedEmail } from '../../services/emailSyncService';
import { supabase } from '../../services/supabase';

import { Calendar, Check, ListChecks, Loader2, Plus, X } from 'lucide-react';
import { AiChip } from './hybrid/primitives';

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

  // Priority → Pulse status tokens. High = overdue (red, urgent), Medium
  // = warning (amber, attention), Low = neutral (gray, defer). Per
  // DESIGN.md "Status-Stays-Status" rule, semantic status colors stay
  // in their own vocabulary — they sit inside this coral-bordered AI
  // surface as content, not chrome.
  const getPriorityTone = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return { color: 'var(--pulse-tone-overdue)', bg: 'var(--pulse-tone-overdue-soft)', label: 'High' };
      case 'medium':
        return { color: 'var(--pulse-tone-warning)', bg: 'var(--pulse-tone-warning-soft)', label: 'Medium' };
      default:
        return { color: 'var(--pulse-tone-neutral)', bg: 'var(--pulse-tone-neutral-soft)', label: 'Low' };
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
      <div style={{ background: 'var(--pulse-rose-soft)', border: '1px solid color-mix(in oklab, var(--pulse-rose) 25%, var(--pulse-border))', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--pulse-rose)' }} aria-hidden />
          <span style={{ fontSize: 13, color: 'var(--pulse-ink-2)' }}>Scanning the thread for action items…</span>
        </div>
      </div>
    );
  }

  if (actionItems.length === 0) {
    return null;
  }

  const selectedCount = actionItems.filter(i => i.selected).length;

  return (
    <div style={{
      background: 'var(--pulse-rose-soft)',
      border: '1px solid color-mix(in oklab, var(--pulse-rose) 25%, var(--pulse-border))',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header — AiChip-style provenance + count chip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid color-mix(in oklab, var(--pulse-rose) 15%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AiChip icon={<ListChecks className="w-3 h-3" aria-hidden />}>Tasks</AiChip>
          <span className="email-mono-label" style={{
            padding: '3px 7px', borderRadius: 4,
            background: 'var(--pulse-surface-raised)',
            color: 'var(--pulse-ink-3)',
          }}>
            {actionItems.length} found
          </span>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss action item suggestions"
          style={{
            width: 24, height: 24, borderRadius: 6, border: 'none',
            background: 'transparent', color: 'var(--pulse-ink-3)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 220ms cubic-bezier(0.16, 1, 0.3, 1), color 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--pulse-surface-raised)'; e.currentTarget.style.color = 'var(--pulse-ink-2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--pulse-ink-3)'; }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Action items list */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--pulse-surface)' }}>
        {actionItems.map((item) => {
          const tone = getPriorityTone(item.priority);
          return (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: 10, borderRadius: 8, cursor: 'pointer',
                background: item.selected ? 'var(--pulse-rose-soft)' : 'var(--pulse-surface-raised)',
                border: item.selected
                  ? '1px solid color-mix(in oklab, var(--pulse-rose) 35%, transparent)'
                  : '1px solid transparent',
                transition: 'background 220ms cubic-bezier(0.16, 1, 0.3, 1), border-color 220ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Checkbox */}
              <div style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                marginTop: 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: item.selected ? 'var(--pulse-rose)' : 'transparent',
                border: item.selected
                  ? '1.5px solid var(--pulse-rose)'
                  : '1.5px solid var(--pulse-border-strong)',
                color: 'white',
                transition: 'background 220ms cubic-bezier(0.16, 1, 0.3, 1), border-color 220ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                {item.selected && <Check className="w-3 h-3" strokeWidth={3} />}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--pulse-ink)', marginBottom: 6, lineHeight: 1.4 }}>
                  {item.text}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4,
                    background: tone.bg, color: tone.color,
                    fontFamily: 'var(--pulse-font-mono)',
                    fontSize: 10, fontWeight: 500,
                    letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1,
                  }}>
                    {tone.label}
                  </span>
                  {item.dueDate && (
                    <span style={{ fontSize: 11, color: 'var(--pulse-ink-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar className="w-3 h-3" aria-hidden />
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 16px' }}>
        <button
          onClick={handleCreateTasks}
          disabled={selectedCount === 0 || creating}
          style={{
            flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 8, border: 'none',
            cursor: selectedCount === 0 || creating ? 'not-allowed' : 'pointer',
            background: selectedCount === 0 ? 'var(--pulse-surface-raised)' : 'var(--pulse-rose)',
            color: selectedCount === 0 ? 'var(--pulse-ink-3)' : 'white',
            fontSize: 13, fontWeight: 500,
            boxShadow: selectedCount === 0 ? 'none' : '0 4px 12px var(--pulse-rose-glow)',
            transition: 'background 160ms ease, transform 160ms ease',
          }}
          onMouseEnter={(e) => {
            if (selectedCount === 0 || creating) return;
            e.currentTarget.style.background = 'var(--pulse-rose-deep)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            if (selectedCount === 0 || creating) return;
            e.currentTarget.style.background = 'var(--pulse-rose)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {creating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              Creating…
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" aria-hidden />
              Create {selectedCount} task{selectedCount !== 1 ? 's' : ''}
            </>
          )}
        </button>
        <button
          onClick={onDismiss}
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid var(--pulse-border)', cursor: 'pointer',
            background: 'transparent', color: 'var(--pulse-ink-2)',
            fontSize: 13, fontWeight: 500,
            transition: 'background 160ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--pulse-surface-raised)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          Skip
        </button>
      </div>
    </div>
  );
};

export default ActionItemExtractor;
