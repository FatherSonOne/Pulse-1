// Keyboard Shortcuts Manager
import React, { useState, useEffect, useCallback } from 'react';

interface Shortcut {
  id: string;
  keys: string[];
  action: string;
  description: string;
  category: 'navigation' | 'messaging' | 'formatting' | 'actions' | 'general';
  enabled: boolean;
  customizable: boolean;
}

interface KeyboardShortcutsProps {
  shortcuts: Shortcut[];
  onShortcutTriggered?: (action: string) => void;
  onUpdateShortcut?: (id: string, keys: string[]) => void;
  onToggleShortcut?: (id: string, enabled: boolean) => void;
  onResetDefaults?: () => void;
  compact?: boolean;
}

const defaultShortcuts: Shortcut[] = [
  // Navigation
  { id: 'nav-up', keys: ['ArrowUp'], action: 'navigate-up', description: 'Previous conversation', category: 'navigation', enabled: true, customizable: true },
  { id: 'nav-down', keys: ['ArrowDown'], action: 'navigate-down', description: 'Next conversation', category: 'navigation', enabled: true, customizable: true },
  { id: 'nav-search', keys: ['Ctrl', 'K'], action: 'open-search', description: 'Open search', category: 'navigation', enabled: true, customizable: true },
  { id: 'nav-home', keys: ['Ctrl', 'H'], action: 'go-home', description: 'Go to home', category: 'navigation', enabled: true, customizable: true },

  // Messaging
  { id: 'msg-send', keys: ['Enter'], action: 'send-message', description: 'Send message', category: 'messaging', enabled: true, customizable: false },
  { id: 'msg-newline', keys: ['Shift', 'Enter'], action: 'new-line', description: 'New line', category: 'messaging', enabled: true, customizable: false },
  { id: 'msg-reply', keys: ['Ctrl', 'R'], action: 'quick-reply', description: 'Quick reply', category: 'messaging', enabled: true, customizable: true },
  { id: 'msg-attach', keys: ['Ctrl', 'U'], action: 'attach-file', description: 'Attach file', category: 'messaging', enabled: true, customizable: true },
  { id: 'msg-emoji', keys: ['Ctrl', 'E'], action: 'open-emoji', description: 'Open emoji picker', category: 'messaging', enabled: true, customizable: true },
  { id: 'msg-template', keys: ['Ctrl', 'T'], action: 'open-templates', description: 'Open templates', category: 'messaging', enabled: true, customizable: true },

  // Formatting
  { id: 'fmt-bold', keys: ['Ctrl', 'B'], action: 'format-bold', description: 'Bold text', category: 'formatting', enabled: true, customizable: true },
  { id: 'fmt-italic', keys: ['Ctrl', 'I'], action: 'format-italic', description: 'Italic text', category: 'formatting', enabled: true, customizable: true },
  { id: 'fmt-code', keys: ['Ctrl', '`'], action: 'format-code', description: 'Code block', category: 'formatting', enabled: true, customizable: true },
  { id: 'fmt-link', keys: ['Ctrl', 'L'], action: 'insert-link', description: 'Insert link', category: 'formatting', enabled: true, customizable: true },

  // Actions
  { id: 'act-pin', keys: ['Ctrl', 'P'], action: 'pin-message', description: 'Pin message', category: 'actions', enabled: true, customizable: true },
  { id: 'act-archive', keys: ['Ctrl', 'Shift', 'A'], action: 'archive-thread', description: 'Archive thread', category: 'actions', enabled: true, customizable: true },
  { id: 'act-mute', keys: ['Ctrl', 'M'], action: 'mute-thread', description: 'Mute thread', category: 'actions', enabled: true, customizable: true },
  { id: 'act-delete', keys: ['Ctrl', 'Shift', 'D'], action: 'delete-message', description: 'Delete message', category: 'actions', enabled: true, customizable: true },

  // General
  { id: 'gen-settings', keys: ['Ctrl', ','], action: 'open-settings', description: 'Open settings', category: 'general', enabled: true, customizable: true },
  { id: 'gen-help', keys: ['Ctrl', '/'], action: 'show-shortcuts', description: 'Show shortcuts', category: 'general', enabled: true, customizable: true },
  { id: 'gen-escape', keys: ['Escape'], action: 'close-modal', description: 'Close modal/cancel', category: 'general', enabled: true, customizable: false },
  { id: 'gen-focus', keys: ['Ctrl', 'Shift', 'F'], action: 'focus-mode', description: 'Toggle focus mode', category: 'general', enabled: true, customizable: true }
];

const categoryConfig = {
  navigation: { icon: 'fa-compass', label: 'Navigation', color: 'blue' },
  messaging: { icon: 'fa-message', label: 'Messaging', color: 'green' },
  formatting: { icon: 'fa-text-height', label: 'Formatting', color: 'purple' },
  actions: { icon: 'fa-bolt', label: 'Actions', color: 'amber' },
  general: { icon: 'fa-gear', label: 'General', color: 'zinc' }
};

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  shortcuts = defaultShortcuts,
  onShortcutTriggered,
  onUpdateShortcut,
  onToggleShortcut,
  onResetDefaults,
  compact = false
}) => {
  const [activeCategory, setActiveCategory] = useState<Shortcut['category'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordingKeys, setRecordingKeys] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  // Filter shortcuts
  const filteredShortcuts = shortcuts.filter(s => {
    if (activeCategory !== 'all' && s.category !== activeCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return s.description.toLowerCase().includes(query) ||
             s.keys.join(' ').toLowerCase().includes(query);
    }
    return true;
  });

  // Group by category
  const groupedShortcuts = filteredShortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) acc[shortcut.category] = [];
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  // Key recording handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isRecording) return;

    e.preventDefault();
    const key = e.key === ' ' ? 'Space' : e.key;
    const newKeys: string[] = [];

    if (e.ctrlKey) newKeys.push('Ctrl');
    if (e.shiftKey) newKeys.push('Shift');
    if (e.altKey) newKeys.push('Alt');
    if (e.metaKey) newKeys.push('Meta');

    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      newKeys.push(key);
    }

    setRecordingKeys(newKeys);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isRecording, handleKeyDown]);

  const startRecording = (id: string) => {
    setEditingId(id);
    setRecordingKeys([]);
    setIsRecording(true);
  };

  const saveRecording = () => {
    if (editingId && recordingKeys.length > 0 && onUpdateShortcut) {
      onUpdateShortcut(editingId, recordingKeys);
    }
    cancelRecording();
  };

  const cancelRecording = () => {
    setEditingId(null);
    setRecordingKeys([]);
    setIsRecording(false);
  };

  const formatKeys = (keys: string[]) => {
    return keys.map(key => {
      switch (key) {
        case 'ArrowUp': return '↑';
        case 'ArrowDown': return '↓';
        case 'ArrowLeft': return '←';
        case 'ArrowRight': return '→';
        case 'Enter': return '⏎';
        case 'Escape': return 'Esc';
        case 'Control':
        case 'Ctrl': return '⌃';
        case 'Shift': return '⇧';
        case 'Alt': return '⌥';
        case 'Meta': return '⌘';
        case 'Space': return '␣';
        case 'Backspace': return '⌫';
        case 'Delete': return '⌦';
        case 'Tab': return '⇥';
        default: return key.length === 1 ? key.toUpperCase() : key;
      }
    });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onShortcutTriggered?.('show-shortcuts')}
          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition"
        >
          <i className="fa-solid fa-keyboard text-xs" />
          <span className="text-xs font-medium">Shortcuts</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-zinc-50 to-slate-50 dark:from-zinc-900/50 dark:to-slate-900/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
              <i className="fa-solid fa-keyboard text-zinc-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Keyboard Shortcuts</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {shortcuts.filter(s => s.enabled).length} active shortcuts
              </p>
            </div>
          </div>
          {onResetDefaults && (
            <button
              onClick={onResetDefaults}
              className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
            >
              Reset defaults
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <i className="fa-solid fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shortcuts..."
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white placeholder-zinc-400"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition ${
              activeCategory === 'all'
                ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-800'
                : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600'
            }`}
          >
            All
          </button>
          {Object.entries(categoryConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key as Shortcut['category'])}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition ${
                activeCategory === key
                  ? `bg-${config.color}-100 dark:bg-${config.color}-900/40 text-${config.color}-600 dark:text-${config.color}-400`
                  : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600'
              }`}
            >
              <i className={`fa-solid ${config.icon}`} />
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shortcuts list */}
      <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-700">
        {Object.keys(groupedShortcuts).length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
              <i className="fa-solid fa-keyboard text-zinc-400 text-lg" />
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No shortcuts found</p>
          </div>
        ) : (
          Object.entries(groupedShortcuts).map(([category, items]) => {
            const config = categoryConfig[category as keyof typeof categoryConfig];
            return (
              <div key={category}>
                <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
                  <div className="flex items-center gap-2">
                    <i className={`fa-solid ${config.icon} text-${config.color}-500 text-xs`} />
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {config.label}
                    </span>
                  </div>
                </div>
                {items.map(shortcut => (
                  <div
                    key={shortcut.id}
                    className={`px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition ${
                      !shortcut.enabled ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {onToggleShortcut && (
                        <button
                          onClick={() => onToggleShortcut(shortcut.id, !shortcut.enabled)}
                          className={`w-4 h-4 rounded border transition ${
                            shortcut.enabled
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-zinc-300 dark:border-zinc-600'
                          }`}
                        >
                          {shortcut.enabled && <i className="fa-solid fa-check text-[8px]" />}
                        </button>
                      )}
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {shortcut.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingId === shortcut.id ? (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {recordingKeys.length > 0 ? (
                              formatKeys(recordingKeys).map((key, idx) => (
                                <kbd
                                  key={idx}
                                  className="px-2 py-1 text-xs font-mono bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded border border-amber-200 dark:border-amber-700"
                                >
                                  {key}
                                </kbd>
                              ))
                            ) : (
                              <span className="text-xs text-zinc-400 animate-pulse">
                                Press keys...
                              </span>
                            )}
                          </div>
                          <button
                            onClick={saveRecording}
                            disabled={recordingKeys.length === 0}
                            className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded disabled:opacity-50"
                          >
                            <i className="fa-solid fa-check text-xs" />
                          </button>
                          <button
                            onClick={cancelRecording}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <i className="fa-solid fa-times text-xs" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-1">
                            {formatKeys(shortcut.keys).map((key, idx) => (
                              <kbd
                                key={idx}
                                className="px-2 py-1 text-xs font-mono bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded border border-zinc-200 dark:border-zinc-600"
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                          {shortcut.customizable && onUpdateShortcut && (
                            <button
                              onClick={() => startRecording(shortcut.id)}
                              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
                              title="Customize shortcut"
                            >
                              <i className="fa-solid fa-pen text-xs" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* Recording overlay */}
      {isRecording && (
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <i className="fa-solid fa-keyboard animate-pulse" />
            <span className="text-xs">Recording shortcut... Press the keys you want to assign.</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Keyboard shortcut hook
export const useKeyboardShortcuts = (
  shortcuts: Shortcut[],
  onTrigger: (action: string) => void
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const pressedKeys: string[] = [];
      if (e.ctrlKey) pressedKeys.push('Ctrl');
      if (e.shiftKey) pressedKeys.push('Shift');
      if (e.altKey) pressedKeys.push('Alt');
      if (e.metaKey) pressedKeys.push('Meta');

      const key = e.key === ' ' ? 'Space' : e.key;
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        pressedKeys.push(key);
      }

      const matchedShortcut = shortcuts.find(s =>
        s.enabled &&
        s.keys.length === pressedKeys.length &&
        s.keys.every((k, i) => k === pressedKeys[i])
      );

      if (matchedShortcut) {
        e.preventDefault();
        onTrigger(matchedShortcut.action);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, onTrigger]);
};

// Shortcut display component
export const ShortcutHint: React.FC<{
  keys: string[];
  className?: string;
}> = ({ keys, className = '' }) => {
  const formatKey = (key: string) => {
    switch (key) {
      case 'Ctrl': return '⌃';
      case 'Shift': return '⇧';
      case 'Alt': return '⌥';
      case 'Meta': return '⌘';
      case 'Enter': return '⏎';
      case 'Escape': return 'Esc';
      default: return key.toUpperCase();
    }
  };

  return (
    <div className={`flex gap-0.5 ${className}`}>
      {keys.map((key, idx) => (
        <kbd
          key={idx}
          className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded border border-zinc-200 dark:border-zinc-600"
        >
          {formatKey(key)}
        </kbd>
      ))}
    </div>
  );
};

export default KeyboardShortcuts;
