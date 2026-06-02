/**
 * Enhanced Email Templates Modal
 * Full-featured template management with categories, favorites, search, and AI generation
 */

import React, { useState, useEffect } from 'react';
import { emailTemplateService, EmailTemplate, TemplateCategory, TEMPLATE_VARIABLES } from '../../services/emailTemplateService';
import { getSessionUserSync } from '../../services/authService';
import toast from 'react-hot-toast';

import { BarChart2, Code, FileText, Pen, Plus, Search, Star, Trash2, X } from 'lucide-react';

interface EmailTemplatesModalEnhancedProps {
  onSelectTemplate: (template: EmailTemplate) => void;
  onClose: () => void;
}

export const EmailTemplatesModalEnhanced: React.FC<EmailTemplatesModalEnhancedProps> = ({
  onSelectTemplate,
  onClose,
}) => {
  const user = getSessionUserSync();

  // State
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'edit' | 'create'>('list');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [saving, setSaving] = useState(false);

  // Load data
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [templatesResult, categoriesResult] = await Promise.all([
        emailTemplateService.getTemplates(user.id),
        emailTemplateService.getCategories(user.id)
      ]);

      if (templatesResult.data) {
        setTemplates(templatesResult.data);
      }
      if (categoriesResult.data) {
        setCategories(categoriesResult.data);
      }
    } catch (error) {
      console.error('[EmailTemplatesModal] Load error:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    // Filter by favorites
    if (showFavoritesOnly && !template.is_favorite) return false;

    // Filter by category
    if (selectedCategory && template.category !== selectedCategory) return false;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(query) ||
        template.body?.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Handle template selection
  const handleSelect = async (template: EmailTemplate) => {
    await emailTemplateService.incrementUsage(template.id);
    onSelectTemplate(template);
    onClose();
  };

  // Toggle favorite
  const handleToggleFavorite = async (template: EmailTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await emailTemplateService.toggleFavorite(template.id, !template.is_favorite);
    if (error) {
      toast.error('Failed to update favorite');
    } else {
      setTemplates(prev => prev.map(t =>
        t.id === template.id ? { ...t, is_favorite: !t.is_favorite } : t
      ));
    }
  };

  // Delete template
  const handleDelete = async (template: EmailTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete template "${template.name}"?`)) return;

    const { error } = await emailTemplateService.deleteTemplate(template.id);
    if (error) {
      toast.error('Failed to delete template');
    } else {
      toast.success('Template deleted');
      setTemplates(prev => prev.filter(t => t.id !== template.id));
    }
  };

  // Start editing
  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description || '');
    setFormSubject(template.subject || '');
    setFormBody(template.body || '');
    setFormCategory(template.category || '');
    setView('edit');
  };

  // Start creating
  const handleCreate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormSubject('');
    setFormBody('');
    setFormCategory('');
    setView('create');
  };

  // Save template
  const handleSave = async () => {
    if (!user) return;
    if (!formName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (!formBody.trim()) {
      toast.error('Please enter template content');
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        // Update
        const { data, error } = await emailTemplateService.updateTemplate(editingTemplate.id, {
          name: formName,
          description: formDescription || undefined,
          subject: formSubject || undefined,
          body: formBody,
          category: formCategory || undefined,
        });

        if (error) throw error;
        if (data) {
          setTemplates(prev => prev.map(t => t.id === data.id ? data : t));
          toast.success('Template updated');
        }
      } else {
        // Create
        const { data, error } = await emailTemplateService.createTemplate({
          user_id: user.id,
          name: formName,
          description: formDescription || undefined,
          subject: formSubject || undefined,
          body: formBody,
          category: formCategory || undefined,
        });

        if (error) throw error;
        if (data) {
          setTemplates(prev => [data, ...prev]);
          toast.success('Template created');
        }
      }

      setView('list');
    } catch (error) {
      console.error('[EmailTemplatesModal] Save error:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Insert variable into body
  const insertVariable = (varName: string) => {
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formBody;
    const before = text.substring(0, start);
    const after = text.substring(end);

    setFormBody(before + `{{${varName}}}` + after);

    // Set cursor position after variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varName.length + 4, start + varName.length + 4);
    }, 0);
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 pulse-modal-scrim" onClick={onClose} />

      {/* Modal */}
      <div className="relative pulse-surface border pulse-border-color rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b pulse-border-color">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl pulse-surface-raised border pulse-border-color flex items-center justify-center pulse-ink-2-color">
              <FileText className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold pulse-ink-color">
                {view === 'list' ? 'Email Templates' : view === 'edit' ? 'Edit Template' : 'Create Template'}
              </h2>
              <p className="text-xs pulse-ink-3-color font-mono-pulse tracking-wide-mono tnum">
                {view === 'list' ? `${filteredTemplates.length} template${filteredTemplates.length !== 1 ? 's' : ''}` : 'Manage your email templates'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:pulse-surface-raised flex items-center justify-center pulse-ink-3-color hover:pulse-ink-color transition"
          >
            <X />
          </button>
        </div>

        {/* Content */}
        {view === 'list' ? (
          <>
            {/* Toolbar */}
            <div className="px-6 py-4 border-b pulse-border-color space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 pulse-ink-3-color text-sm" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pulse-surface-raised border pulse-border-color rounded-lg pl-10 pr-4 py-2.5 text-sm pulse-ink-color placeholder:pulse-ink-3-color focus:outline-none focus:pulse-rose-border"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                    showFavoritesOnly
                      ? 'pulse-rose-bg-soft-color pulse-rose-border pulse-rose-color'
                      : 'pulse-surface-raised border-transparent pulse-ink-2-color hover:pulse-border-color'
                  }`}
                >
                  <Star className="mr-1.5" />
                  Favorites
                </button>

                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                      selectedCategory === cat.name
                        ? 'pulse-rose-bg-soft-color pulse-rose-border pulse-rose-color'
                        : 'pulse-surface-raised border-transparent pulse-ink-2-color hover:pulse-border-color'
                    }`}
                  >
                    {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
                    {cat.name}
                  </button>
                ))}

                <button
                  onClick={handleCreate}
                  className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium pulse-rose-bg-color hover:opacity-90 text-white transition"
                >
                  <Plus className="mr-1.5" />
                  New Template
                </button>
              </div>
            </div>

            {/* Templates List */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 pulse-rose-border border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="text-4xl pulse-ink-3-color opacity-50 mb-3 mx-auto" />
                  <p className="pulse-ink-3-color">No templates found</p>
                  <button
                    onClick={handleCreate}
                    className="mt-4 px-4 py-2 pulse-rose-bg-color hover:opacity-90 text-white rounded-lg text-sm font-medium transition"
                  >
                    Create your first template
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTemplates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => handleSelect(template)}
                      className="pulse-surface-raised border pulse-border-color rounded-xl p-4 hover:pulse-border-strong-color transition cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium pulse-ink-color group-hover:pulse-rose-color transition mb-1">
                            {template.name}
                          </h3>
                          {template.description && (
                            <p className="text-xs pulse-ink-3-color line-clamp-1">{template.description}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleToggleFavorite(template, e)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                            template.is_favorite
                              ? 'text-amber-400 hover:text-amber-300'
                              : 'pulse-ink-3-color hover:text-amber-400 hover:pulse-surface'
                          }`}
                        >
                          <i className={`fa-${template.is_favorite ? 'solid' : 'regular'} fa-star text-sm`}></i>
                        </button>
                      </div>

                      <div className="text-xs pulse-ink-2-color line-clamp-2 mb-3 font-mono-pulse">
                        {template.body}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 pulse-ink-3-color">
                          {template.category && (
                            <span className="px-2 py-1 pulse-surface border pulse-border-color rounded-md font-mono-pulse tracking-wide-mono">
                              {template.category}
                            </span>
                          )}
                          {template.variables.length > 0 && (
                            <span className="flex items-center gap-1 font-mono-pulse tnum">
                              <Code />
                              {template.variables.length} var{template.variables.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          <span className="flex items-center gap-1 font-mono-pulse tnum">
                            <BarChart2 />
                            {template.use_count} use{template.use_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(template); }}
                            className="w-6 h-6 rounded hover:pulse-surface flex items-center justify-center pulse-ink-3-color hover:pulse-ink-color transition"
                          >
                            <Pen className="text-xs" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(template, e)}
                            className="w-6 h-6 rounded hover:pulse-surface flex items-center justify-center pulse-ink-3-color transition hover:text-[color:var(--pulse-tone-overdue)]"
                          >
                            <Trash2 className="text-xs" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Edit/Create Form */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Name */}
              <div>
                <label className="block font-mono-pulse tracking-wide-mono text-[10px] uppercase pulse-ink-3-color mb-2">Template Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Sales Follow-up"
                  className="w-full pulse-surface-raised border pulse-border-color rounded-lg px-4 py-2.5 pulse-ink-color placeholder:pulse-ink-3-color focus:outline-none focus:pulse-rose-border"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-mono-pulse tracking-wide-mono text-[10px] uppercase pulse-ink-3-color mb-2">Description (optional)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of template usage"
                  className="w-full pulse-surface-raised border pulse-border-color rounded-lg px-4 py-2.5 pulse-ink-color placeholder:pulse-ink-3-color focus:outline-none focus:pulse-rose-border"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block font-mono-pulse tracking-wide-mono text-[10px] uppercase pulse-ink-3-color mb-2">Category</label>
                <input
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="e.g., Sales, Support, Marketing"
                  className="w-full pulse-surface-raised border pulse-border-color rounded-lg px-4 py-2.5 pulse-ink-color placeholder:pulse-ink-3-color focus:outline-none focus:pulse-rose-border"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block font-mono-pulse tracking-wide-mono text-[10px] uppercase pulse-ink-3-color mb-2">Subject (optional)</label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Email subject line"
                  className="w-full pulse-surface-raised border pulse-border-color rounded-lg px-4 py-2.5 pulse-ink-color placeholder:pulse-ink-3-color focus:outline-none focus:pulse-rose-border"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block font-mono-pulse tracking-wide-mono text-[10px] uppercase pulse-ink-3-color mb-2">Body *</label>
                <textarea
                  id="template-body"
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Email body content... Use {{variableName}} for dynamic content"
                  rows={12}
                  className="w-full pulse-surface-raised border pulse-border-color rounded-lg px-4 py-3 pulse-ink-color placeholder:pulse-ink-3-color focus:outline-none focus:pulse-rose-border font-mono-pulse text-sm resize-none"
                />
              </div>

              {/* Variables Helper */}
              <div className="pulse-surface-raised border pulse-border-color rounded-lg p-4">
                <div className="font-mono-pulse tracking-wide-mono text-[10px] uppercase pulse-ink-3-color mb-3">Available Variables (click to insert):</div>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_VARIABLES.slice(0, 12).map(v => (
                    <button
                      key={v.name}
                      onClick={() => insertVariable(v.name)}
                      className="px-3 py-1.5 pulse-surface border pulse-border-color hover:pulse-rose-bg-color hover:text-white pulse-ink-2-color rounded-lg text-xs font-mono-pulse transition"
                      title={v.description}
                    >
                      {`{{${v.name}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 pulse-rose-bg-color hover:opacity-90 disabled:opacity-50 text-white rounded-lg font-medium transition"
                >
                  {saving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
                <button
                  onClick={() => setView('list')}
                  className="px-4 py-2.5 pulse-surface-raised border pulse-border-color hover:pulse-border-strong-color pulse-ink-color rounded-lg font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailTemplatesModalEnhanced;
