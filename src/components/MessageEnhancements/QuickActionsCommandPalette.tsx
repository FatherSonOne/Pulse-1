import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Types
interface CommandAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'navigation' | 'messaging' | 'search' | 'tools' | 'settings' | 'ai';
  shortcut?: string;
  keywords: string[];
  action: () => void;
  disabled?: boolean;
  badge?: string;
}

interface CommandCategory {
  id: string;
  label: string;
  icon: string;
}

interface QuickActionsCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: (actionId: string) => void;
  customActions?: CommandAction[];
  recentActions?: string[];
  embedded?: boolean; // When true, renders inline without modal overlay
}

const CATEGORIES: CommandCategory[] = [
  { id: 'navigation', label: 'Navigation', icon: '🧭' },
  { id: 'messaging', label: 'Messaging', icon: '💬' },
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'tools', label: 'Tools', icon: '🛠️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'ai', label: 'AI Features', icon: '🤖' },
];

// Default actions
const createDefaultActions = (
  handlers: {
    onNewMessage?: () => void;
    onSearch?: () => void;
    onSettings?: () => void;
    onExport?: () => void;
    onSchedule?: () => void;
    onAIAssist?: () => void;
    onTranslate?: () => void;
    onBookmarks?: () => void;
    onTemplates?: () => void;
    onSummary?: () => void;
    onTheme?: () => void;
    onShortcuts?: () => void;
    onNotifications?: () => void;
    onContacts?: () => void;
    onAnalytics?: () => void;
    onTags?: () => void;
    onArchive?: () => void;
    onPin?: () => void;
  } = {}
): CommandAction[] => [
  // Navigation
  {
    id: 'go-inbox',
    label: 'Go to Inbox',
    description: 'Navigate to your inbox',
    icon: '📥',
    category: 'navigation',
    shortcut: 'G I',
    keywords: ['inbox', 'home', 'main', 'messages'],
    action: () => console.log('Go to inbox'),
  },
  {
    id: 'go-sent',
    label: 'Go to Sent',
    description: 'View sent messages',
    icon: '📤',
    category: 'navigation',
    shortcut: 'G S',
    keywords: ['sent', 'outbox', 'sent messages'],
    action: () => console.log('Go to sent'),
  },
  {
    id: 'go-starred',
    label: 'Go to Starred',
    description: 'View starred messages',
    icon: '⭐',
    category: 'navigation',
    shortcut: 'G T',
    keywords: ['starred', 'favorites', 'important'],
    action: () => console.log('Go to starred'),
  },
  {
    id: 'go-archive',
    label: 'Go to Archive',
    description: 'View archived conversations',
    icon: '📦',
    category: 'navigation',
    keywords: ['archive', 'old', 'stored'],
    action: handlers.onArchive || (() => console.log('Go to archive')),
  },

  // Messaging
  {
    id: 'new-message',
    label: 'New Message',
    description: 'Compose a new message',
    icon: '✏️',
    category: 'messaging',
    shortcut: 'C',
    keywords: ['new', 'compose', 'write', 'create', 'message'],
    action: handlers.onNewMessage || (() => console.log('New message')),
  },
  {
    id: 'reply',
    label: 'Reply to Message',
    description: 'Reply to current conversation',
    icon: '↩️',
    category: 'messaging',
    shortcut: 'R',
    keywords: ['reply', 'respond', 'answer'],
    action: () => console.log('Reply'),
  },
  {
    id: 'forward',
    label: 'Forward Message',
    description: 'Forward selected message',
    icon: '➡️',
    category: 'messaging',
    shortcut: 'F',
    keywords: ['forward', 'share', 'send'],
    action: () => console.log('Forward'),
  },
  {
    id: 'schedule-message',
    label: 'Schedule Message',
    description: 'Schedule a message for later',
    icon: '📅',
    category: 'messaging',
    shortcut: 'Shift+S',
    keywords: ['schedule', 'later', 'timer', 'delay'],
    action: handlers.onSchedule || (() => console.log('Schedule')),
  },
  {
    id: 'use-template',
    label: 'Insert Template',
    description: 'Use a message template',
    icon: '📋',
    category: 'messaging',
    shortcut: 'T',
    keywords: ['template', 'preset', 'quick reply'],
    action: handlers.onTemplates || (() => console.log('Templates')),
  },
  {
    id: 'pin-message',
    label: 'Pin Message',
    description: 'Pin current message',
    icon: '📌',
    category: 'messaging',
    shortcut: 'P',
    keywords: ['pin', 'stick', 'important'],
    action: handlers.onPin || (() => console.log('Pin')),
  },

  // Search
  {
    id: 'search-all',
    label: 'Search All Messages',
    description: 'Search across all conversations',
    icon: '🔍',
    category: 'search',
    shortcut: '/',
    keywords: ['search', 'find', 'query', 'lookup'],
    action: handlers.onSearch || (() => console.log('Search')),
  },
  {
    id: 'search-contacts',
    label: 'Search Contacts',
    description: 'Find a specific contact',
    icon: '👤',
    category: 'search',
    keywords: ['contacts', 'people', 'user', 'person'],
    action: handlers.onContacts || (() => console.log('Search contacts')),
  },
  {
    id: 'search-attachments',
    label: 'Search Attachments',
    description: 'Find files and media',
    icon: '📎',
    category: 'search',
    keywords: ['attachments', 'files', 'media', 'images', 'documents'],
    action: () => console.log('Search attachments'),
  },
  {
    id: 'search-by-date',
    label: 'Search by Date',
    description: 'Find messages from a specific time',
    icon: '📆',
    category: 'search',
    keywords: ['date', 'time', 'when', 'calendar'],
    action: () => console.log('Search by date'),
  },

  // Tools
  {
    id: 'export-conversation',
    label: 'Export Conversation',
    description: 'Export current conversation',
    icon: '💾',
    category: 'tools',
    shortcut: 'Ctrl+E',
    keywords: ['export', 'download', 'save', 'backup'],
    action: handlers.onExport || (() => console.log('Export')),
  },
  {
    id: 'conversation-summary',
    label: 'Generate Summary',
    description: 'AI-powered conversation summary',
    icon: '📝',
    category: 'tools',
    keywords: ['summary', 'summarize', 'recap', 'overview'],
    action: handlers.onSummary || (() => console.log('Summary')),
  },
  {
    id: 'translate',
    label: 'Translate Message',
    description: 'Translate selected text',
    icon: '🌐',
    category: 'tools',
    keywords: ['translate', 'language', 'convert'],
    action: handlers.onTranslate || (() => console.log('Translate')),
  },
  {
    id: 'add-bookmark',
    label: 'Bookmark Message',
    description: 'Save message to bookmarks',
    icon: '🔖',
    category: 'tools',
    shortcut: 'B',
    keywords: ['bookmark', 'save', 'favorite'],
    action: handlers.onBookmarks || (() => console.log('Bookmark')),
  },
  {
    id: 'add-tag',
    label: 'Add Tag',
    description: 'Tag current conversation',
    icon: '🏷️',
    category: 'tools',
    keywords: ['tag', 'label', 'categorize'],
    action: handlers.onTags || (() => console.log('Add tag')),
  },
  {
    id: 'view-analytics',
    label: 'View Analytics',
    description: 'See conversation analytics',
    icon: '📊',
    category: 'tools',
    keywords: ['analytics', 'stats', 'metrics', 'data'],
    action: handlers.onAnalytics || (() => console.log('Analytics')),
  },

  // Settings
  {
    id: 'open-settings',
    label: 'Open Settings',
    description: 'Open app settings',
    icon: '⚙️',
    category: 'settings',
    shortcut: 'Ctrl+,',
    keywords: ['settings', 'preferences', 'options', 'config'],
    action: handlers.onSettings || (() => console.log('Settings')),
  },
  {
    id: 'notification-settings',
    label: 'Notification Settings',
    description: 'Configure notifications',
    icon: '🔔',
    category: 'settings',
    keywords: ['notifications', 'alerts', 'sounds'],
    action: handlers.onNotifications || (() => console.log('Notifications')),
  },
  {
    id: 'keyboard-shortcuts',
    label: 'Keyboard Shortcuts',
    description: 'View and edit shortcuts',
    icon: '⌨️',
    category: 'settings',
    shortcut: '?',
    keywords: ['keyboard', 'shortcuts', 'hotkeys', 'keys'],
    action: handlers.onShortcuts || (() => console.log('Shortcuts')),
  },
  {
    id: 'change-theme',
    label: 'Change Theme',
    description: 'Switch color theme',
    icon: '🎨',
    category: 'settings',
    keywords: ['theme', 'dark', 'light', 'color', 'appearance'],
    action: handlers.onTheme || (() => console.log('Theme')),
  },

  // AI Features
  {
    id: 'ai-compose',
    label: 'AI Compose',
    description: 'Let AI help write your message',
    icon: '✨',
    category: 'ai',
    shortcut: 'Ctrl+J',
    keywords: ['ai', 'compose', 'write', 'generate', 'assist'],
    action: handlers.onAIAssist || (() => console.log('AI compose')),
    badge: 'AI',
  },
  {
    id: 'ai-improve',
    label: 'Improve Message',
    description: 'AI suggestions to improve your text',
    icon: '💫',
    category: 'ai',
    keywords: ['improve', 'enhance', 'better', 'polish'],
    action: () => console.log('AI improve'),
    badge: 'AI',
  },
  {
    id: 'ai-tone',
    label: 'Adjust Tone',
    description: 'Change message tone with AI',
    icon: '🎭',
    category: 'ai',
    keywords: ['tone', 'formal', 'casual', 'friendly', 'professional'],
    action: () => console.log('AI tone'),
    badge: 'AI',
  },
  {
    id: 'ai-reply-suggestions',
    label: 'Reply Suggestions',
    description: 'Get AI-powered reply suggestions',
    icon: '💡',
    category: 'ai',
    keywords: ['suggestions', 'replies', 'ideas', 'recommend'],
    action: () => console.log('AI suggestions'),
    badge: 'AI',
  },
];

export const QuickActionsCommandPalette: React.FC<QuickActionsCommandPaletteProps> = ({
  isOpen,
  onClose,
  onAction,
  customActions = [],
  recentActions = [],
  embedded = false,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Combine default and custom actions
  const allActions = useMemo(() => {
    const defaults = createDefaultActions();
    return [...defaults, ...customActions];
  }, [customActions]);

  // Filter actions based on query and category
  const filteredActions = useMemo(() => {
    let results = allActions;

    // Filter by category if selected
    if (selectedCategory) {
      results = results.filter(action => action.category === selectedCategory);
    }

    // Filter by search query
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(action =>
        action.label.toLowerCase().includes(lowerQuery) ||
        action.description.toLowerCase().includes(lowerQuery) ||
        action.keywords.some(k => k.toLowerCase().includes(lowerQuery))
      );
    }

    // Sort: recent first, then alphabetically
    results.sort((a, b) => {
      const aRecent = recentActions.indexOf(a.id);
      const bRecent = recentActions.indexOf(b.id);

      if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;
      if (aRecent !== -1) return -1;
      if (bRecent !== -1) return 1;

      return a.label.localeCompare(b.label);
    });

    return results;
  }, [allActions, query, selectedCategory, recentActions]);

  // Group actions by category for display
  const groupedActions = useMemo(() => {
    if (selectedCategory) {
      return { [selectedCategory]: filteredActions };
    }

    const groups: Record<string, CommandAction[]> = {};
    filteredActions.forEach(action => {
      if (!groups[action.category]) {
        groups[action.category] = [];
      }
      groups[action.category].push(action);
    });

    return groups;
  }, [filteredActions, selectedCategory]);

  // Flat list of visible actions for keyboard navigation
  const flatActions = useMemo(() => {
    const flat: CommandAction[] = [];
    Object.values(groupedActions).forEach(actions => {
      flat.push(...actions);
    });
    return flat;
  }, [groupedActions]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
      setSelectedCategory(null);
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Execute selected action
  const executeAction = useCallback((action: CommandAction) => {
    if (action.disabled) return;
    action.action();
    onAction?.(action.id);
    onClose();
  }, [onAction, onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, flatActions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatActions[selectedIndex]) {
          executeAction(flatActions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (selectedCategory) {
          setSelectedCategory(null);
        } else {
          onClose();
        }
        break;
      case 'Tab':
        e.preventDefault();
        // Cycle through categories
        const categoryIds = CATEGORIES.map(c => c.id);
        const currentCatIndex = selectedCategory ? categoryIds.indexOf(selectedCategory) : -1;
        const nextIndex = (currentCatIndex + 1) % (categoryIds.length + 1);
        setSelectedCategory(nextIndex === categoryIds.length ? null : categoryIds[nextIndex]);
        break;
    }
  }, [flatActions, selectedIndex, selectedCategory, executeAction, onClose]);

  // Global keyboard shortcut to open
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen && !embedded) return null;

  let actionIndex = 0;

  // Inner content component - reused for both embedded and modal modes
  const paletteContent = (
    <div
      style={{
        background: embedded ? 'transparent' : 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(20, 20, 35, 0.98))',
        borderRadius: '16px',
        width: '100%',
        maxWidth: embedded ? '100%' : '600px',
        maxHeight: embedded ? '100%' : '70vh',
        overflow: 'hidden',
        boxShadow: embedded ? 'none' : '0 20px 60px rgba(0, 0, 0, 0.5)',
        border: embedded ? 'none' : '1px solid rgba(255,255,255,0.1)',
      }}
    >
        {/* Search Input */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '12px 16px',
          }}>
            <span style={{ fontSize: '1.2rem', opacity: 0.6 }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '1rem',
                outline: 'none',
              }}
            />
            <span style={{
              fontSize: '0.75rem',
              opacity: 0.4,
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '4px',
            }}>
              ESC to close
            </span>
          </div>

          {/* Category Tabs */}
          <div style={{
            display: 'flex',
            gap: '6px',
            marginTop: '12px',
            flexWrap: 'wrap',
          }}>
            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                background: selectedCategory === null ? 'rgba(138, 43, 226, 0.3)' : 'rgba(255,255,255,0.05)',
                border: selectedCategory === null ? '1px solid rgba(138, 43, 226, 0.5)' : '1px solid transparent',
                borderRadius: '8px',
                padding: '6px 12px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>✨</span> All
            </button>
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                style={{
                  background: selectedCategory === category.id ? 'rgba(138, 43, 226, 0.3)' : 'rgba(255,255,255,0.05)',
                  border: selectedCategory === category.id ? '1px solid rgba(138, 43, 226, 0.5)' : '1px solid transparent',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{category.icon}</span> {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions List */}
        <div
          ref={listRef}
          style={{
            maxHeight: 'calc(70vh - 140px)',
            overflow: 'auto',
            padding: '8px',
          }}
        >
          {flatActions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'rgba(255,255,255,0.5)',
            }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '12px' }}>🔍</span>
              No commands found for "{query}"
            </div>
          ) : (
            Object.entries(groupedActions).map(([categoryId, actions]) => {
              const category = CATEGORIES.find(c => c.id === categoryId);

              return (
                <div key={categoryId} style={{ marginBottom: '16px' }}>
                  {!selectedCategory && (
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.4)',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      {category?.icon} {category?.label}
                    </div>
                  )}

                  {actions.map((action) => {
                    const currentIndex = actionIndex++;
                    const isSelected = currentIndex === selectedIndex;

                    return (
                      <button
                        key={action.id}
                        data-index={currentIndex}
                        onClick={() => executeAction(action)}
                        disabled={action.disabled}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 16px',
                          background: isSelected ? 'rgba(138, 43, 226, 0.2)' : 'transparent',
                          border: isSelected ? '1px solid rgba(138, 43, 226, 0.3)' : '1px solid transparent',
                          borderRadius: '10px',
                          cursor: action.disabled ? 'not-allowed' : 'pointer',
                          color: action.disabled ? 'rgba(255,255,255,0.3)' : 'white',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                          marginBottom: '4px',
                        }}
                      >
                        <span style={{ fontSize: '1.3rem' }}>{action.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}>
                            {action.label}
                            {action.badge && (
                              <span style={{
                                fontSize: '0.65rem',
                                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                              }}>
                                {action.badge}
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: '0.8rem',
                            opacity: 0.6,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {action.description}
                          </div>
                        </div>
                        {action.shortcut && (
                          <div style={{
                            display: 'flex',
                            gap: '4px',
                          }}>
                            {action.shortcut.split('+').map((key, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '4px 8px',
                                  background: 'rgba(255,255,255,0.1)',
                                  borderRadius: '4px',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {key.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.4)',
        }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Tab Categories</span>
          </div>
          <div>
            {flatActions.length} commands available
          </div>
        </div>
      </div>
  );

  // If embedded mode, render content directly without modal wrapper
  if (embedded) {
    return paletteContent;
  }

  // Modal mode with overlay
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        zIndex: 10000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {paletteContent}
    </div>
  );
};

// Hook to use command palette
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
};

// Button to open command palette
export const CommandPaletteButton: React.FC<{
  onClick?: () => void;
}> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '8px 16px',
        color: 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        fontSize: '0.85rem',
        transition: 'all 0.2s ease',
      }}
      title="Open command palette (Ctrl+K)"
    >
      <span>🔍</span>
      <span>Quick Actions</span>
      <span style={{
        fontSize: '0.7rem',
        padding: '2px 6px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '4px',
        fontFamily: 'monospace',
      }}>
        ⌘K
      </span>
    </button>
  );
};

export default QuickActionsCommandPalette;
