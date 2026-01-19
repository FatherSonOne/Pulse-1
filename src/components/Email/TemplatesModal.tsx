// TemplatesModal.tsx - Email templates management
import React, { useState, useEffect } from 'react';
import { emailSyncService, EmailTemplate } from '../../services/emailSyncService';
import toast from 'react-hot-toast';

interface TemplatesModalProps {
  onSelectTemplate: (template: EmailTemplate) => void;
  onClose: () => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  onSelectTemplate,
  onClose,
}) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for creating/editing
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await emailSyncService.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  // Start editing a template
  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setSubject(template.subject || '');
    setBody(template.body);
    setCategory(template.category || '');
    setIsCreating(false);
  };

  // Start creating new template
  const handleStartCreate = () => {
    setEditingTemplate(null);
    setName('');
    setSubject('');
    setBody('');
    setCategory('');
    setIsCreating(true);
  };

  // Save template (create or update)
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (!body.trim()) {
      toast.error('Please enter template content');
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        // Update existing
        await emailSyncService.updateTemplate(editingTemplate.id, {
          name,
          subject: subject || undefined,
          body,
          category: category || undefined,
        });
        toast.success('Template updated');
      } else {
        // Create new
        await emailSyncService.createTemplate({
          name,
          subject: subject || undefined,
          body,
          category: category || undefined,
        });
        toast.success('Template created');
      }

      // Reset form and reload
      setEditingTemplate(null);
      setIsCreating(false);
      setName('');
      setSubject('');
      setBody('');
      setCategory('');
      await loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const handleDelete = async (templateId: string) => {
    if (!confirm('Delete this template?')) return;

    try {
      await emailSyncService.deleteTemplate(templateId);
      toast.success('Template deleted');
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  // Use template
  const handleUseTemplate = (template: EmailTemplate) => {
    onSelectTemplate(template);
    onClose();
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingTemplate(null);
    setIsCreating(false);
    setName('');
    setSubject('');
    setBody('');
    setCategory('');
  };

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const cat = template.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, EmailTemplate[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <i className="fa-solid fa-file-lines text-white"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Email Templates</h2>
              <p className="text-sm text-zinc-500">Save and reuse common email formats</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Template list */}
          <div className={`${isCreating || editingTemplate ? 'w-1/2 border-r border-zinc-800' : 'w-full'} overflow-y-auto p-4`}>
            {/* Create button */}
            <button
              onClick={handleStartCreate}
              className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-xl transition"
            >
              <i className="fa-solid fa-plus"></i>
              <span className="font-medium">Create New Template</span>
            </button>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <i className="fa-solid fa-circle-notch fa-spin text-2xl text-zinc-500"></i>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <i className="fa-solid fa-file-circle-plus text-4xl mb-3 block"></i>
                <p>No templates yet</p>
                <p className="text-sm">Create your first template to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                  <div key={category}>
                    <div className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-2 px-1">
                      {category}
                    </div>
                    <div className="space-y-2">
                      {categoryTemplates.map((template) => (
                        <div
                          key={template.id}
                          className={`p-3 rounded-xl border transition cursor-pointer ${
                            editingTemplate?.id === template.id
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className="flex-1 min-w-0"
                              onClick={() => handleUseTemplate(template)}
                            >
                              <div className="font-medium text-white text-sm truncate">
                                {template.name}
                              </div>
                              {template.subject && (
                                <div className="text-xs text-zinc-400 truncate mt-0.5">
                                  Subject: {template.subject}
                                </div>
                              )}
                              <div className="text-xs text-zinc-500 mt-1 line-clamp-2">
                                {template.body.substring(0, 100)}...
                              </div>
                              {template.variables && template.variables.length > 0 && (
                                <div className="flex items-center gap-1 mt-2">
                                  <i className="fa-solid fa-code text-[10px] text-amber-500"></i>
                                  <span className="text-[10px] text-amber-500">
                                    Variables: {template.variables.join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(template);
                                }}
                                className="w-7 h-7 rounded hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-white transition"
                                title="Edit"
                              >
                                <i className="fa-solid fa-pen text-xs"></i>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(template.id);
                                }}
                                className="w-7 h-7 rounded hover:bg-red-500/20 flex items-center justify-center text-zinc-500 hover:text-red-400 transition"
                                title="Delete"
                              >
                                <i className="fa-solid fa-trash text-xs"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit/Create panel */}
          {(isCreating || editingTemplate) && (
            <div className="w-1/2 p-4 overflow-y-auto">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-white mb-1">
                  {isCreating ? 'Create Template' : 'Edit Template'}
                </h3>
                <p className="text-xs text-zinc-500">
                  Use {'{{variable}}'} syntax for dynamic placeholders
                </p>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Template Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Meeting Follow-up"
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Category (optional)</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., Sales, Support, Follow-ups"
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Subject Line (optional)</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Following up on {{topic}}"
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Email Body *</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={`Hi {{name}},\n\nThank you for your time today. I wanted to follow up on {{topic}}.\n\nBest regards`}
                    rows={10}
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                {/* Variable hint */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-lightbulb text-amber-500 text-sm mt-0.5"></i>
                    <div className="text-xs text-amber-200">
                      <strong>Pro tip:</strong> Use {'{{name}}'}, {'{{company}}'}, {'{{date}}'}, etc. as placeholders. You'll be prompted to fill them when using the template.
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white rounded-lg text-sm font-medium transition"
                  >
                    {saving ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-check"></i>
                        {isCreating ? 'Create Template' : 'Save Changes'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplatesModal;
