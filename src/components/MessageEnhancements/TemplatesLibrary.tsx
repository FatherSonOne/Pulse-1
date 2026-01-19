import React, { useState, useCallback, useMemo } from 'react';

// Types
interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
  tags: string[];
  variables: string[];
  usageCount: number;
  lastUsed?: Date;
  isFavorite: boolean;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface TemplateCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
}

interface TemplatesLibraryProps {
  onSelectTemplate?: (template: Template) => void;
  onInsertTemplate?: (content: string, variables: Record<string, string>) => void;
  onCreateTemplate?: (template: Omit<Template, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>) => void;
}

// Mock categories
const CATEGORIES: TemplateCategory[] = [
  { id: 'all', name: 'All Templates', icon: 'fa-layer-group', color: 'zinc', count: 24 },
  { id: 'greetings', name: 'Greetings', icon: 'fa-hand-wave', color: 'yellow', count: 6 },
  { id: 'followups', name: 'Follow-ups', icon: 'fa-rotate', color: 'blue', count: 5 },
  { id: 'responses', name: 'Responses', icon: 'fa-reply', color: 'green', count: 4 },
  { id: 'scheduling', name: 'Scheduling', icon: 'fa-calendar', color: 'purple', count: 5 },
  { id: 'closings', name: 'Closings', icon: 'fa-flag-checkered', color: 'orange', count: 4 }
];

// Mock templates
const generateMockTemplates = (): Template[] => [
  {
    id: '1',
    name: 'Professional Greeting',
    content: 'Hi {{name}},\n\nI hope this message finds you well. {{custom_message}}\n\nBest regards,\n{{sender}}',
    category: 'greetings',
    tags: ['formal', 'business'],
    variables: ['name', 'custom_message', 'sender'],
    usageCount: 45,
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 2),
    isFavorite: true,
    isShared: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5)
  },
  {
    id: '2',
    name: 'Quick Check-in',
    content: 'Hey {{name}}! Just checking in to see how things are going. Let me know if you need anything!',
    category: 'followups',
    tags: ['casual', 'friendly'],
    variables: ['name'],
    usageCount: 32,
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 24),
    isFavorite: true,
    isShared: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10)
  },
  {
    id: '3',
    name: 'Meeting Request',
    content: 'Hi {{name}},\n\nI\'d like to schedule a meeting to discuss {{topic}}. Are you available on {{date}} at {{time}}?\n\nPlease let me know what works best for you.',
    category: 'scheduling',
    tags: ['meeting', 'calendar'],
    variables: ['name', 'topic', 'date', 'time'],
    usageCount: 28,
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 48),
    isFavorite: false,
    isShared: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15)
  },
  {
    id: '4',
    name: 'Thank You Note',
    content: 'Thank you so much for {{reason}}! I really appreciate your {{quality}}. Looking forward to {{next_step}}.',
    category: 'responses',
    tags: ['gratitude', 'positive'],
    variables: ['reason', 'quality', 'next_step'],
    usageCount: 21,
    isFavorite: false,
    isShared: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10)
  },
  {
    id: '5',
    name: 'Out of Office',
    content: 'Hi,\n\nThank you for your message. I\'m currently out of the office and will return on {{return_date}}. For urgent matters, please contact {{backup_contact}}.\n\nI\'ll respond to your message upon my return.',
    category: 'responses',
    tags: ['auto-reply', 'ooo'],
    variables: ['return_date', 'backup_contact'],
    usageCount: 15,
    isFavorite: false,
    isShared: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
  },
  {
    id: '6',
    name: 'Project Update',
    content: 'Hi team,\n\nHere\'s a quick update on {{project_name}}:\n\n- Status: {{status}}\n- Progress: {{progress}}%\n- Next milestone: {{milestone}}\n\nLet me know if you have any questions!',
    category: 'followups',
    tags: ['project', 'update', 'team'],
    variables: ['project_name', 'status', 'progress', 'milestone'],
    usageCount: 18,
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 72),
    isFavorite: true,
    isShared: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
  }
];

export const TemplatesLibrary: React.FC<TemplatesLibraryProps> = ({
  onSelectTemplate,
  onInsertTemplate,
  onCreateTemplate
}) => {
  const [templates, setTemplates] = useState<Template[]>(generateMockTemplates);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    content: '',
    category: 'greetings',
    tags: [] as string[],
    isFavorite: false,
    isShared: false
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [templates, selectedCategory, searchQuery]);

  const favoriteTemplates = useMemo(() =>
    templates.filter(t => t.isFavorite).slice(0, 4),
    [templates]
  );

  const extractVariables = useCallback((content: string): string[] => {
    const matches = content.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  }, []);

  const fillTemplate = useCallback((content: string, values: Record<string, string>): string => {
    let filled = content;
    Object.entries(values).forEach(([key, value]) => {
      filled = filled.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
    });
    return filled;
  }, []);

  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
    setVariableValues({});
    onSelectTemplate?.(template);
  }, [onSelectTemplate]);

  const handleInsertTemplate = useCallback(() => {
    if (!selectedTemplate) return;
    const filledContent = fillTemplate(selectedTemplate.content, variableValues);

    // Update usage count
    setTemplates(prev => prev.map(t =>
      t.id === selectedTemplate.id
        ? { ...t, usageCount: t.usageCount + 1, lastUsed: new Date() }
        : t
    ));

    onInsertTemplate?.(filledContent, variableValues);
    setSelectedTemplate(null);
    setVariableValues({});
  }, [selectedTemplate, variableValues, fillTemplate, onInsertTemplate]);

  const toggleFavorite = useCallback((templateId: string) => {
    setTemplates(prev => prev.map(t =>
      t.id === templateId ? { ...t, isFavorite: !t.isFavorite } : t
    ));
  }, []);

  const handleCreateTemplate = useCallback(() => {
    if (!newTemplate.name.trim() || !newTemplate.content.trim()) return;

    const template: Template = {
      id: Date.now().toString(),
      name: newTemplate.name,
      content: newTemplate.content,
      category: newTemplate.category,
      tags: newTemplate.tags,
      variables: extractVariables(newTemplate.content),
      usageCount: 0,
      isFavorite: newTemplate.isFavorite,
      isShared: newTemplate.isShared,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setTemplates(prev => [template, ...prev]);
    onCreateTemplate?.(template);
    setNewTemplate({ name: '', content: '', category: 'greetings', tags: [], isFavorite: false, isShared: false });
    setShowCreateModal(false);
  }, [newTemplate, extractVariables, onCreateTemplate]);

  const getCategoryColor = (colorName: string): { bg: string; text: string } => {
    const colors: Record<string, { bg: string; text: string }> = {
      zinc: { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' },
      yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
      blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
      green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
      purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
      orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' }
    };
    return colors[colorName] || colors.zinc;
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <i className="fa-solid fa-bookmark text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Templates Library</p>
            <p className="text-xs text-zinc-500">{templates.length} templates</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <i className={`fa-solid ${viewMode === 'grid' ? 'fa-list' : 'fa-grip'} text-zinc-500`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition"
          >
            <i className="fa-solid fa-plus mr-1" />
            New
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
        />
      </div>

      {/* Favorites */}
      {favoriteTemplates.length > 0 && !searchQuery && selectedCategory === 'all' && (
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
            <i className="fa-solid fa-star text-yellow-500 mr-1" />
            Favorites
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {favoriteTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="flex-shrink-0 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"
              >
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300 whitespace-nowrap">{template.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {CATEGORIES.map(category => {
          const colors = getCategoryColor(category.color);
          const isSelected = selectedCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                isSelected
                  ? `${colors.bg} ${colors.text}`
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <i className={`fa-solid ${category.icon}`} />
              {category.name}
              <span className="opacity-60">({category.count})</span>
            </button>
          );
        })}
      </div>

      {/* Template Detail Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-zinc-900 dark:text-white">{selectedTemplate.name}</h3>
                  <button
                    onClick={() => toggleFavorite(selectedTemplate.id)}
                    className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                  >
                    <i className={`fa-${selectedTemplate.isFavorite ? 'solid' : 'regular'} fa-star text-yellow-500`} />
                  </button>
                </div>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                >
                  <i className="fa-solid fa-xmark text-zinc-500" />
                </button>
              </div>
              <div className="flex gap-1 mt-2">
                {selectedTemplate.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-zinc-600 dark:text-zinc-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Variables */}
              {selectedTemplate.variables.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Fill in variables:</p>
                  {selectedTemplate.variables.map(variable => (
                    <div key={variable}>
                      <label className="block text-xs text-zinc-500 mb-1 capitalize">
                        {variable.replace(/_/g, ' ')}
                      </label>
                      <input
                        type="text"
                        value={variableValues[variable] || ''}
                        onChange={(e) => setVariableValues(prev => ({ ...prev, [variable]: e.target.value }))}
                        placeholder={`Enter ${variable.replace(/_/g, ' ')}`}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Preview */}
              <div>
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Preview:</p>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {fillTemplate(selectedTemplate.content, variableValues)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-2">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertTemplate}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                <i className="fa-solid fa-check mr-1" />
                Insert Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Grid/List */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-8">
          <i className="fa-solid fa-bookmark text-zinc-300 text-3xl mb-3" />
          <p className="text-sm text-zinc-500">No templates found</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-2">
          {filteredTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-amber-300 dark:hover:border-amber-700 transition text-left group"
            >
              <div className="flex items-start justify-between mb-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-white line-clamp-1">{template.name}</p>
                {template.isFavorite && (
                  <i className="fa-solid fa-star text-yellow-500 text-xs" />
                )}
              </div>
              <p className="text-xs text-zinc-500 line-clamp-2 mb-2">{template.content}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">{template.usageCount} uses</span>
                {template.isShared && (
                  <i className="fa-solid fa-share-nodes text-zinc-400 text-[10px]" />
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              className="w-full p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-amber-300 dark:hover:border-amber-700 transition text-left"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{template.name}</p>
                    {template.isFavorite && <i className="fa-solid fa-star text-yellow-500 text-xs" />}
                    {template.isShared && <i className="fa-solid fa-share-nodes text-zinc-400 text-xs" />}
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-1 mt-1">{template.content}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400">{template.usageCount} uses</p>
                  {template.lastUsed && (
                    <p className="text-[10px] text-zinc-400">{formatTimeAgo(template.lastUsed)}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="font-semibold text-zinc-900 dark:text-white">Create Template</h3>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                  placeholder="Template name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Content <span className="text-zinc-400">(use {"{{variable}}"} for placeholders)</span>
                </label>
                <textarea
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full h-32 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm resize-none"
                  placeholder="Hi {{name}}, thank you for..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Category</label>
                <select
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                >
                  {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
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
                onClick={handleCreateTemplate}
                disabled={!newTemplate.name.trim() || !newTemplate.content.trim()}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Quick Template Insert Button
interface TemplateInsertButtonProps {
  onSelect: () => void;
}

export const TemplateInsertButton: React.FC<TemplateInsertButtonProps> = ({ onSelect }) => (
  <button
    onClick={onSelect}
    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
    title="Insert template"
  >
    <i className="fa-solid fa-bookmark text-zinc-500" />
  </button>
);
