import React, { useState, useMemo, useCallback } from 'react';

// Types
interface SmartFolder {
  id: string;
  name: string;
  icon: string;
  color: string;
  rules: FolderRule[];
  messageCount: number;
  unreadCount: number;
  isSystem: boolean;
  isExpanded?: boolean;
  subFolders?: SmartFolder[];
}

interface FolderRule {
  id: string;
  field: 'sender' | 'subject' | 'content' | 'attachment' | 'date' | 'label' | 'priority';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'before' | 'after' | 'hasAny' | 'hasNone';
  value: string;
  conjunction: 'AND' | 'OR';
}

interface FolderMessage {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  timestamp: Date;
  isUnread: boolean;
  hasAttachment: boolean;
  priority: 'low' | 'normal' | 'high';
  labels: string[];
}

interface SmartFoldersProps {
  onFolderSelect?: (folderId: string) => void;
  onCreateFolder?: (folder: Omit<SmartFolder, 'id' | 'messageCount' | 'unreadCount'>) => void;
  onDeleteFolder?: (folderId: string) => void;
}

// Mock data generators
const generateMockFolders = (): SmartFolder[] => [
  {
    id: 'inbox',
    name: 'Inbox',
    icon: 'fa-inbox',
    color: 'blue',
    rules: [],
    messageCount: 128,
    unreadCount: 12,
    isSystem: true
  },
  {
    id: 'priority',
    name: 'Priority',
    icon: 'fa-star',
    color: 'yellow',
    rules: [{ id: '1', field: 'priority', operator: 'equals', value: 'high', conjunction: 'AND' }],
    messageCount: 15,
    unreadCount: 5,
    isSystem: true
  },
  {
    id: 'attachments',
    name: 'With Attachments',
    icon: 'fa-paperclip',
    color: 'purple',
    rules: [{ id: '1', field: 'attachment', operator: 'hasAny', value: 'true', conjunction: 'AND' }],
    messageCount: 45,
    unreadCount: 3,
    isSystem: true
  },
  {
    id: 'work',
    name: 'Work',
    icon: 'fa-briefcase',
    color: 'indigo',
    rules: [
      { id: '1', field: 'sender', operator: 'contains', value: '@company.com', conjunction: 'OR' },
      { id: '2', field: 'label', operator: 'hasAny', value: 'work', conjunction: 'AND' }
    ],
    messageCount: 89,
    unreadCount: 8,
    isSystem: false,
    isExpanded: true,
    subFolders: [
      {
        id: 'work-projects',
        name: 'Projects',
        icon: 'fa-folder',
        color: 'indigo',
        rules: [{ id: '1', field: 'label', operator: 'hasAny', value: 'project', conjunction: 'AND' }],
        messageCount: 34,
        unreadCount: 2,
        isSystem: false
      },
      {
        id: 'work-meetings',
        name: 'Meetings',
        icon: 'fa-calendar',
        color: 'indigo',
        rules: [{ id: '1', field: 'content', operator: 'contains', value: 'meeting', conjunction: 'AND' }],
        messageCount: 21,
        unreadCount: 1,
        isSystem: false
      }
    ]
  },
  {
    id: 'personal',
    name: 'Personal',
    icon: 'fa-user',
    color: 'green',
    rules: [{ id: '1', field: 'label', operator: 'hasAny', value: 'personal', conjunction: 'AND' }],
    messageCount: 56,
    unreadCount: 4,
    isSystem: false
  },
  {
    id: 'newsletters',
    name: 'Newsletters',
    icon: 'fa-newspaper',
    color: 'orange',
    rules: [
      { id: '1', field: 'sender', operator: 'contains', value: 'newsletter', conjunction: 'OR' },
      { id: '2', field: 'subject', operator: 'contains', value: 'weekly', conjunction: 'OR' }
    ],
    messageCount: 124,
    unreadCount: 18,
    isSystem: false
  },
  {
    id: 'archive',
    name: 'Archive',
    icon: 'fa-box-archive',
    color: 'zinc',
    rules: [],
    messageCount: 1250,
    unreadCount: 0,
    isSystem: true
  }
];

const generateMockMessages = (): FolderMessage[] => [
  {
    id: '1',
    sender: 'Alice Chen',
    subject: 'Q1 Project Update',
    preview: 'Here are the latest updates on our Q1 deliverables...',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    isUnread: true,
    hasAttachment: true,
    priority: 'high',
    labels: ['work', 'project']
  },
  {
    id: '2',
    sender: 'Bob Smith',
    subject: 'Team Meeting Notes',
    preview: 'Attached are the notes from today\'s standup meeting...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    isUnread: true,
    hasAttachment: true,
    priority: 'normal',
    labels: ['work', 'meeting']
  },
  {
    id: '3',
    sender: 'Newsletter Weekly',
    subject: 'This Week in Tech',
    preview: 'Top stories: AI advances, new product launches...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    isUnread: false,
    hasAttachment: false,
    priority: 'low',
    labels: ['newsletter']
  },
  {
    id: '4',
    sender: 'Carol Davis',
    subject: 'Weekend Plans',
    preview: 'Hey! Are you free this Saturday for the hiking trip?',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
    isUnread: true,
    hasAttachment: false,
    priority: 'normal',
    labels: ['personal']
  }
];

const FOLDER_COLORS = [
  { id: 'blue', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  { id: 'green', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
  { id: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
  { id: 'orange', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  { id: 'red', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  { id: 'purple', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  { id: 'indigo', bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400', dot: 'bg-indigo-500' },
  { id: 'pink', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400', dot: 'bg-pink-500' },
  { id: 'zinc', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400', dot: 'bg-zinc-500' }
];

export const SmartFolders: React.FC<SmartFoldersProps> = ({
  onFolderSelect,
  onCreateFolder,
  onDeleteFolder
}) => {
  const [folders, setFolders] = useState<SmartFolder[]>(generateMockFolders);
  const [selectedFolder, setSelectedFolder] = useState<string>('inbox');
  const [messages] = useState<FolderMessage[]>(generateMockMessages);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<SmartFolder | null>(null);
  const [newFolder, setNewFolder] = useState({
    name: '',
    icon: 'fa-folder',
    color: 'blue',
    rules: [] as FolderRule[]
  });
  const [viewMode, setViewMode] = useState<'sidebar' | 'grid'>('sidebar');

  const getColorClasses = useCallback((colorId: string) => {
    return FOLDER_COLORS.find(c => c.id === colorId) || FOLDER_COLORS[0];
  }, []);

  const toggleFolderExpand = useCallback((folderId: string) => {
    setFolders(prev => prev.map(f =>
      f.id === folderId ? { ...f, isExpanded: !f.isExpanded } : f
    ));
  }, []);

  const handleSelectFolder = useCallback((folderId: string) => {
    setSelectedFolder(folderId);
    onFolderSelect?.(folderId);
  }, [onFolderSelect]);

  const addRule = useCallback(() => {
    setNewFolder(prev => ({
      ...prev,
      rules: [...prev.rules, {
        id: Date.now().toString(),
        field: 'sender',
        operator: 'contains',
        value: '',
        conjunction: 'AND'
      }]
    }));
  }, []);

  const updateRule = useCallback((ruleId: string, updates: Partial<FolderRule>) => {
    setNewFolder(prev => ({
      ...prev,
      rules: prev.rules.map(r => r.id === ruleId ? { ...r, ...updates } : r)
    }));
  }, []);

  const removeRule = useCallback((ruleId: string) => {
    setNewFolder(prev => ({
      ...prev,
      rules: prev.rules.filter(r => r.id !== ruleId)
    }));
  }, []);

  const handleCreateFolder = useCallback(() => {
    if (!newFolder.name.trim()) return;

    const folder: SmartFolder = {
      id: Date.now().toString(),
      name: newFolder.name,
      icon: newFolder.icon,
      color: newFolder.color,
      rules: newFolder.rules,
      messageCount: 0,
      unreadCount: 0,
      isSystem: false
    };

    setFolders(prev => [...prev, folder]);
    onCreateFolder?.(folder);
    setNewFolder({ name: '', icon: 'fa-folder', color: 'blue', rules: [] });
    setShowCreateModal(false);
  }, [newFolder, onCreateFolder]);

  const handleDeleteFolder = useCallback((folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId));
    onDeleteFolder?.(folderId);
    if (selectedFolder === folderId) {
      setSelectedFolder('inbox');
    }
  }, [selectedFolder, onDeleteFolder]);

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const totalUnread = useMemo(() =>
    folders.reduce((sum, f) => sum + f.unreadCount, 0),
    [folders]
  );

  const renderFolder = (folder: SmartFolder, depth: number = 0) => {
    const colors = getColorClasses(folder.color);
    const isSelected = selectedFolder === folder.id;
    const hasSubFolders = folder.subFolders && folder.subFolders.length > 0;

    return (
      <div key={folder.id}>
        <button
          onClick={() => handleSelectFolder(folder.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition group ${
            isSelected
              ? `${colors.bg} ${colors.text}`
              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {hasSubFolders && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolderExpand(folder.id);
              }}
              className="w-4 h-4 flex items-center justify-center"
            >
              <i className={`fa-solid fa-chevron-right text-[10px] transition-transform ${folder.isExpanded ? 'rotate-90' : ''}`} />
            </button>
          )}
          {!hasSubFolders && <span className="w-4" />}

          <i className={`fa-solid ${folder.icon} w-4`} />
          <span className="flex-1 text-left truncate">{folder.name}</span>

          {folder.unreadCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
              isSelected ? 'bg-white/30' : colors.bg + ' ' + colors.text
            }`}>
              {folder.unreadCount}
            </span>
          )}

          {!folder.isSystem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFolder(folder.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition"
            >
              <i className="fa-solid fa-trash text-red-500 text-xs" />
            </button>
          )}
        </button>

        {hasSubFolders && folder.isExpanded && (
          <div className="ml-2">
            {folder.subFolders!.map(sub => renderFolder(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
            <i className="fa-solid fa-folder-tree text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Smart Folders</p>
            <p className="text-xs text-zinc-500">{totalUnread} unread messages</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode(viewMode === 'sidebar' ? 'grid' : 'sidebar')}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <i className={`fa-solid ${viewMode === 'sidebar' ? 'fa-grip' : 'fa-list'} text-zinc-500`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-900/50 transition"
          >
            <i className="fa-solid fa-plus" />
          </button>
        </div>
      </div>

      {/* Folder List - Sidebar View */}
      {viewMode === 'sidebar' && (
        <div className="space-y-1">
          {folders.map(folder => renderFolder(folder))}
        </div>
      )}

      {/* Folder Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 gap-2">
          {folders.map(folder => {
            const colors = getColorClasses(folder.color);
            return (
              <button
                key={folder.id}
                onClick={() => handleSelectFolder(folder.id)}
                className={`p-3 rounded-lg border transition text-left ${
                  selectedFolder === folder.id
                    ? `${colors.bg} border-current ${colors.text}`
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-teal-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <i className={`fa-solid ${folder.icon}`} />
                  <span className="font-medium text-sm truncate">{folder.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{folder.messageCount} messages</span>
                  {folder.unreadCount > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                      {folder.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Folder Messages */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
          Messages in {folders.find(f => f.id === selectedFolder)?.name || 'Inbox'}
        </p>
        <div className="space-y-2">
          {messages.slice(0, 3).map(msg => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg border transition cursor-pointer ${
                msg.isUnread
                  ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                  : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
              } hover:border-teal-300`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {msg.isUnread && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  <span className={`text-sm ${msg.isUnread ? 'font-semibold' : ''} text-zinc-900 dark:text-white`}>
                    {msg.sender}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {msg.priority === 'high' && (
                    <i className="fa-solid fa-star text-yellow-500 text-xs" />
                  )}
                  {msg.hasAttachment && (
                    <i className="fa-solid fa-paperclip text-zinc-400 text-xs" />
                  )}
                  <span className="text-xs text-zinc-500">{formatTimeAgo(msg.timestamp)}</span>
                </div>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">{msg.subject}</p>
              <p className="text-xs text-zinc-500 mt-1 truncate">{msg.preview}</p>
              {msg.labels.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {msg.labels.map(label => (
                    <span key={label} className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900 dark:text-white">Create Smart Folder</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                >
                  <i className="fa-solid fa-xmark text-zinc-500" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Folder Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={newFolder.name}
                  onChange={(e) => setNewFolder(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                  placeholder="Enter folder name"
                />
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Color
                </label>
                <div className="flex gap-2">
                  {FOLDER_COLORS.map(color => (
                    <button
                      key={color.id}
                      onClick={() => setNewFolder(prev => ({ ...prev, color: color.id }))}
                      className={`w-6 h-6 rounded-full ${color.dot} ${
                        newFolder.color === color.id ? 'ring-2 ring-offset-2 ring-teal-500' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Rules */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Filter Rules
                  </label>
                  <button
                    onClick={addRule}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    + Add Rule
                  </button>
                </div>

                {newFolder.rules.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No rules - folder will be manual</p>
                ) : (
                  <div className="space-y-2">
                    {newFolder.rules.map((rule, index) => (
                      <div key={rule.id} className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        {index > 0 && (
                          <select
                            value={rule.conjunction}
                            onChange={(e) => updateRule(rule.id, { conjunction: e.target.value as 'AND' | 'OR' })}
                            className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                          >
                            <option value="AND">AND</option>
                            <option value="OR">OR</option>
                          </select>
                        )}
                        <select
                          value={rule.field}
                          onChange={(e) => updateRule(rule.id, { field: e.target.value as FolderRule['field'] })}
                          className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        >
                          <option value="sender">Sender</option>
                          <option value="subject">Subject</option>
                          <option value="content">Content</option>
                          <option value="label">Label</option>
                          <option value="priority">Priority</option>
                        </select>
                        <select
                          value={rule.operator}
                          onChange={(e) => updateRule(rule.id, { operator: e.target.value as FolderRule['operator'] })}
                          className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        >
                          <option value="contains">contains</option>
                          <option value="equals">equals</option>
                          <option value="startsWith">starts with</option>
                          <option value="endsWith">ends with</option>
                        </select>
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                          className="flex-1 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                          placeholder="Value"
                        />
                        <button
                          onClick={() => removeRule(rule.id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        >
                          <i className="fa-solid fa-trash text-red-500 text-xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolder.name.trim()}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Folder Badge Component
interface FolderBadgeProps {
  name: string;
  color: string;
  count?: number;
  onClick?: () => void;
}

export const FolderBadge: React.FC<FolderBadgeProps> = ({ name, color, count, onClick }) => {
  const colors = FOLDER_COLORS.find(c => c.id === color) || FOLDER_COLORS[0];

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} hover:opacity-80 transition`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {name}
      {count !== undefined && count > 0 && (
        <span className="ml-1 opacity-70">({count})</span>
      )}
    </button>
  );
};
