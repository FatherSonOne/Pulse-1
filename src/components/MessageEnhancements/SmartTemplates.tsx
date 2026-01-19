// Smart Templates System with AI Suggestions
import React, { useState, useMemo } from 'react';

interface Template {
  id: string;
  name: string;
  category: 'greeting' | 'follow-up' | 'meeting' | 'feedback' | 'closing' | 'custom';
  content: string;
  variables: string[];
  usageCount: number;
  lastUsed?: string;
  createdBy: string;
  isAISuggested?: boolean;
  tags: string[];
}

interface SmartTemplatesProps {
  templates: Template[];
  contextKeywords?: string[];
  contactName?: string;
  onInsertTemplate: (content: string) => void;
  onSaveTemplate?: (template: Omit<Template, 'id' | 'usageCount' | 'lastUsed'>) => void;
  onDeleteTemplate?: (id: string) => void;
  onEditTemplate?: (id: string, updates: Partial<Template>) => void;
  compact?: boolean;
}

const categoryConfig = {
  greeting: { icon: 'fa-hand-wave', color: 'amber', label: 'Greetings' },
  'follow-up': { icon: 'fa-reply', color: 'blue', label: 'Follow-ups' },
  meeting: { icon: 'fa-calendar', color: 'purple', label: 'Meetings' },
  feedback: { icon: 'fa-comment-dots', color: 'green', label: 'Feedback' },
  closing: { icon: 'fa-hand-peace', color: 'pink', label: 'Closings' },
  custom: { icon: 'fa-star', color: 'zinc', label: 'Custom' }
};

// Built-in templates
const defaultTemplates: Template[] = [
  {
    id: 'greeting-1',
    name: 'Friendly Hello',
    category: 'greeting',
    content: 'Hey {{name}}! Hope you\'re having a great {{timeOfDay}}. Just wanted to reach out about...',
    variables: ['name', 'timeOfDay'],
    usageCount: 0,
    createdBy: 'system',
    tags: ['casual', 'friendly']
  },
  {
    id: 'greeting-2',
    name: 'Professional Introduction',
    category: 'greeting',
    content: 'Hi {{name}}, I hope this message finds you well. I\'m reaching out regarding...',
    variables: ['name'],
    usageCount: 0,
    createdBy: 'system',
    tags: ['formal', 'professional']
  },
  {
    id: 'follow-up-1',
    name: 'Gentle Reminder',
    category: 'follow-up',
    content: 'Hi {{name}}, just following up on our previous conversation about {{topic}}. Any updates on your end?',
    variables: ['name', 'topic'],
    usageCount: 0,
    createdBy: 'system',
    tags: ['reminder', 'polite']
  },
  {
    id: 'follow-up-2',
    name: 'Check-in',
    category: 'follow-up',
    content: 'Hey {{name}}, wanted to check in and see how things are going with {{project}}. Let me know if you need anything!',
    variables: ['name', 'project'],
    usageCount: 0,
    createdBy: 'system',
    tags: ['casual', 'supportive']
  },
  {
    id: 'meeting-1',
    name: 'Schedule Request',
    category: 'meeting',
    content: 'Hi {{name}}, would you be available for a quick call {{timeframe}}? I\'d like to discuss {{topic}}.',
    variables: ['name', 'timeframe', 'topic'],
    usageCount: 0,
    createdBy: 'system',
    tags: ['scheduling', 'request']
  },
  {
    id: 'meeting-2',
    name: 'Meeting Confirmation',
    category: 'meeting',
    content: 'Perfect! I\'ve got us down for {{datetime}}. Looking forward to chatting about {{topic}}.',
    variables: ['datetime', 'topic'],
    usageCount: 0,
    createdBy: 'system',
    tags: ['confirmation', 'scheduling']
  },
  {
    id: 'feedback-1',
    name: 'Positive Feedback',
    category: 'feedback',
    content: 'Great work on {{item}}, {{name}}! Really impressed with {{specificDetail}}.',
    variables: ['item', 'name', 'specificDetail'],
    usageCount: 0,
    createdBy: 'system',
    tags: ['positive', 'praise']
  },
  {
    id: 'feedback-2',
    name: 'Constructive Suggestion',
    category: 'feedback',
    content: 'Thanks for sharing {{item}}. One thought - have you considered {{suggestion}}? Might help with {{benefit}}.',
    variables: ['item', 'suggestion', 'benefit'],
    usageCount: 0,
    createdBy: 'system',
    tags: ['constructive', 'helpful']
  },
  {
    id: 'closing-1',
    name: 'Friendly Sign-off',
    category: 'closing',
    content: 'Thanks so much, {{name}}! Talk soon.',
    variables: ['name'],
    usageCount: 0,
    createdBy: 'system',
    tags: ['casual', 'friendly']
  },
  {
    id: 'closing-2',
    name: 'Action Item Closing',
    category: 'closing',
    content: 'I\'ll {{action}} and get back to you by {{deadline}}. Let me know if anything changes!',
    variables: ['action', 'deadline'],
    usageCount: 0,
    createdBy: 'system',
    tags: ['action', 'commitment']
  }
];

export const SmartTemplates: React.FC<SmartTemplatesProps> = ({
  templates = [],
  contextKeywords = [],
  contactName,
  onInsertTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  onEditTemplate,
  compact = false
}) => {
  const [activeCategory, setActiveCategory] = useState<Template['category'] | 'all' | 'suggested'>('suggested');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Combine default and custom templates
  const allTemplates = useMemo(() => {
    return [...defaultTemplates, ...templates];
  }, [templates]);

  // Generate AI suggestions based on context
  const suggestedTemplates = useMemo(() => {
    if (contextKeywords.length === 0) return allTemplates.slice(0, 4);

    const scored = allTemplates.map(template => {
      let score = 0;
      const contentLower = template.content.toLowerCase();
      const tagsLower = template.tags.map(t => t.toLowerCase());

      contextKeywords.forEach(keyword => {
        if (contentLower.includes(keyword.toLowerCase())) score += 2;
        if (tagsLower.some(tag => tag.includes(keyword.toLowerCase()))) score += 1;
      });

      // Boost by usage
      score += Math.min(template.usageCount * 0.1, 2);

      return { template, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(s => ({ ...s.template, isAISuggested: true }));
  }, [allTemplates, contextKeywords]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let filtered = activeCategory === 'suggested'
      ? suggestedTemplates
      : activeCategory === 'all'
        ? allTemplates
        : allTemplates.filter(t => t.category === activeCategory);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [allTemplates, suggestedTemplates, activeCategory, searchQuery]);

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  const processTemplate = (template: Template, values: Record<string, string>) => {
    let content = template.content;

    // Auto-fill common variables
    const autoValues: Record<string, string> = {
      name: contactName || values.name || '[Name]',
      timeOfDay: getTimeOfDay(),
      ...values
    };

    template.variables.forEach(variable => {
      const value = autoValues[variable] || `[${variable}]`;
      content = content.replace(new RegExp(`{{${variable}}}`, 'g'), value);
    });

    return content;
  };

  const handleInsertTemplate = (template: Template) => {
    const content = processTemplate(template, variableValues);
    onInsertTemplate(content);
    setSelectedTemplate(null);
    setVariableValues({});
  };

  const handleQuickInsert = (template: Template) => {
    // Check if template has variables that need filling
    const unfilled = template.variables.filter(v =>
      v !== 'name' && v !== 'timeOfDay'
    );

    if (unfilled.length > 0) {
      setSelectedTemplate(template);
    } else {
      handleInsertTemplate(template);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
          <i className="fa-solid fa-file-lines text-xs" />
          <span className="text-xs font-medium">{allTemplates.length} templates</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Smart Templates</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {filteredTemplates.length} templates available
              </p>
            </div>
          </div>
          {onSaveTemplate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition"
            >
              <i className="fa-solid fa-plus" />
              New
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
            placeholder="Search templates..."
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white placeholder-zinc-400"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategory('suggested')}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition ${
              activeCategory === 'suggested'
                ? 'bg-purple-500 text-white'
                : 'bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
            }`}
          >
            <i className="fa-solid fa-sparkles" />
            Suggested
          </button>
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition ${
              activeCategory === 'all'
                ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-800'
                : 'bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-600'
            }`}
          >
            All
          </button>
          {Object.entries(categoryConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key as Template['category'])}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition ${
                activeCategory === key
                  ? `bg-${config.color}-500 text-white`
                  : 'bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-600'
              }`}
            >
              <i className={`fa-solid ${config.icon}`} />
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates list */}
      <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-700">
        {filteredTemplates.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
              <i className="fa-solid fa-file-lines text-zinc-400 text-lg" />
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No templates found</p>
          </div>
        ) : (
          filteredTemplates.map(template => {
            const config = categoryConfig[template.category];
            return (
              <div
                key={template.id}
                className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition cursor-pointer"
                onClick={() => handleQuickInsert(template)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-${config.color}-100 dark:bg-${config.color}-900/40`}>
                    <i className={`fa-solid ${config.icon} text-${config.color}-500 text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-800 dark:text-white">
                        {template.name}
                      </span>
                      {template.isAISuggested && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                          <i className="fa-solid fa-sparkles mr-0.5" />
                          Suggested
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                      {template.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {template.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                        >
                          {tag}
                        </span>
                      ))}
                      {template.usageCount > 0 && (
                        <span className="text-[10px] text-zinc-400">
                          Used {template.usageCount}x
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {template.createdBy !== 'system' && onEditTemplate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTemplate(template);
                          setShowCreateModal(true);
                        }}
                        className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                      >
                        <i className="fa-solid fa-pen text-xs" />
                      </button>
                    )}
                    {template.createdBy !== 'system' && onDeleteTemplate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTemplate(template.id);
                        }}
                        className="p-1 text-zinc-400 hover:text-red-500 transition"
                      >
                        <i className="fa-solid fa-trash text-xs" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Variable fill modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-4">
            <h4 className="text-sm font-bold text-zinc-800 dark:text-white mb-3">
              Fill in the details
            </h4>
            <div className="space-y-3 mb-4">
              {selectedTemplate.variables
                .filter(v => v !== 'name' && v !== 'timeOfDay')
                .map(variable => (
                  <div key={variable}>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1 capitalize">
                      {variable.replace(/([A-Z])/g, ' $1')}
                    </label>
                    <input
                      type="text"
                      value={variableValues[variable] || ''}
                      onChange={(e) => setVariableValues(prev => ({ ...prev, [variable]: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
                      placeholder={`Enter ${variable}...`}
                    />
                  </div>
                ))}
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg mb-4">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-medium">Preview:</span>
              </p>
              <p className="text-sm text-zinc-800 dark:text-white mt-1">
                {processTemplate(selectedTemplate, variableValues)}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedTemplate(null);
                  setVariableValues({});
                }}
                className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleInsertTemplate(selectedTemplate)}
                className="px-4 py-1.5 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {showCreateModal && (
        <TemplateEditor
          template={editingTemplate}
          onSave={(template) => {
            if (editingTemplate && onEditTemplate) {
              onEditTemplate(editingTemplate.id, template);
            } else if (onSaveTemplate) {
              onSaveTemplate(template);
            }
            setShowCreateModal(false);
            setEditingTemplate(null);
          }}
          onCancel={() => {
            setShowCreateModal(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
};

// Template editor component
const TemplateEditor: React.FC<{
  template?: Template | null;
  onSave: (template: Omit<Template, 'id' | 'usageCount' | 'lastUsed'>) => void;
  onCancel: () => void;
}> = ({ template, onSave, onCancel }) => {
  const [name, setName] = useState(template?.name || '');
  const [category, setCategory] = useState<Template['category']>(template?.category || 'custom');
  const [content, setContent] = useState(template?.content || '');
  const [tags, setTags] = useState(template?.tags.join(', ') || '');

  // Extract variables from content
  const variables = useMemo(() => {
    const matches = content.match(/{{(\w+)}}/g) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
  }, [content]);

  const handleSave = () => {
    if (!name.trim() || !content.trim()) return;

    onSave({
      name: name.trim(),
      category,
      content: content.trim(),
      variables,
      createdBy: 'user',
      tags: tags.split(',').map(t => t.trim()).filter(Boolean)
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-4">
        <h4 className="text-sm font-bold text-zinc-800 dark:text-white mb-4">
          {template ? 'Edit Template' : 'Create Template'}
        </h4>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
              placeholder="Template name..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Template['category'])}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
            >
              {Object.entries(categoryConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Content
              <span className="text-zinc-400 font-normal ml-2">
                Use {"{{variable}}"} for placeholders
              </span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white resize-none"
              rows={4}
              placeholder="Hi {{name}}, ..."
            />
            {variables.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="text-[10px] text-zinc-500">Variables:</span>
                {variables.map(v => (
                  <span key={v} className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                    {v}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
              placeholder="casual, friendly, work..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !content.trim()}
            className="px-4 py-1.5 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// Quick template button for message input
export const TemplateButton: React.FC<{
  onClick: () => void;
  hasTemplates?: boolean;
}> = ({ onClick, hasTemplates = true }) => {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded transition ${
        hasTemplates
          ? 'text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
          : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
      }`}
      title="Message templates"
    >
      <i className="fa-solid fa-file-lines text-sm" />
    </button>
  );
};

export default SmartTemplates;
