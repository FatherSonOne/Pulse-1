import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { X, Search, CheckSquare, TrendingUp, ArrowLeft, Plus } from 'lucide-react';
import { DecisionTemplate, decisionTemplateService, TemplateVariables } from '../../services/decisionTemplateService';
import './DecisionTemplates.css';

interface DecisionTemplatesProps {
  workspaceId?: string;
  onClose: () => void;
  onSelectTemplate: (template: DecisionTemplate, variables: TemplateVariables) => void;
}

export const DecisionTemplates: React.FC<DecisionTemplatesProps> = ({
  workspaceId,
  onClose,
  onSelectTemplate,
}) => {
  const [templates, setTemplates] = useState<DecisionTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<DecisionTemplate | null>(null);
  const [variables, setVariables] = useState<TemplateVariables>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, [workspaceId]);

  // Categories were removed: with 5 templates and 5 categories, every category
  // had exactly 1 item. The tab navigation duplicated the All view and added
  // cognitive overhead. Search handles filtering; the template name carries
  // category meaning ("Hire New Team Member" doesn't need a HIRING tag).
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const templateData = await decisionTemplateService.getTemplates(workspaceId);
      setTemplates(templateData);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter by name/description only. Category is searchable as plain text.
  const filteredTemplates = templates.filter((template) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      template.name.toLowerCase().includes(q) ||
      template.description?.toLowerCase().includes(q) ||
      template.category?.toLowerCase().includes(q)
    );
  });

  const handleSelectTemplate = (template: DecisionTemplate) => {
    setSelectedTemplate(template);

    // Extract variables from template
    const titleVars = decisionTemplateService.extractVariables(template.title_template);
    const descVars = template.description_template
      ? decisionTemplateService.extractVariables(template.description_template)
      : [];
    const allVars = [...new Set([...titleVars, ...descVars])];

    // Initialize variables object
    const initialVars: TemplateVariables = {};
    allVars.forEach(varName => {
      initialVars[varName] = '';
    });
    setVariables(initialVars);
  };

  const handleUseTemplate = () => {
    if (!selectedTemplate) return;

    // Check if all variables are filled
    const missingVars = Object.entries(variables).filter(([_, value]) => !value.trim());
    if (missingVars.length > 0) {
      const fields = missingVars.map(([key]) => key).join(', ');
      toast.error(`Fill in: ${fields}`, { duration: 3500 });
      return;
    }

    onSelectTemplate(selectedTemplate, variables);
    onClose();
  };

  const modalContent = (
    <div className="decision-templates-overlay" onClick={onClose}>
      <div className="decision-templates-modal" onClick={(e) => e.stopPropagation()}>
        {!selectedTemplate ? (
          // Template Browser View
          <>
            <div className="decision-templates-header">
              <div className="header-left">
                <h2 className="decision-templates-title">Decision Templates</h2>
                <p className="decision-templates-subtitle">
                  Start with a proven decision framework.
                </p>
              </div>
              <button
                className="decision-templates-close"
                onClick={onClose}
                aria-label="Close"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="decision-templates-content">
              {/* Search Bar */}
              <div className="templates-search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search templates"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  aria-label="Search templates"
                />
              </div>

              {/* Template Grid */}
              {loading ? (
                <div className="templates-loading">
                  <div className="spinner"></div>
                  <p>Loading templates</p>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="templates-empty">
                  <span className="dt-label templates-empty-eyebrow">No matches</span>
                  <h3>Nothing found for "{searchQuery}".</h3>
                  <p>Try a different search, or pick from the full list.</p>
                </div>
              ) : (
                <div className="templates-grid">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="template-card"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <h3 className="template-name">{template.name}</h3>
                      <p className="template-description">{template.description}</p>
                      <div className="template-stats">
                        <span className="stat-item">
                          <CheckSquare size={13} aria-hidden="true" />
                          <span className="dt-label">
                            {template.suggested_tasks.length} task
                            {template.suggested_tasks.length === 1 ? '' : 's'}
                          </span>
                        </span>
                        <span className="stat-item">
                          <TrendingUp size={13} aria-hidden="true" />
                          <span className="dt-label">
                            {template.usage_count} {template.usage_count === 1 ? 'use' : 'uses'}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // Template Configuration View
          <>
            <div className="decision-templates-header">
              <div className="header-left header-left-with-back">
                <button
                  className="back-button"
                  onClick={() => setSelectedTemplate(null)}
                  aria-label="Back to templates"
                  title="Back"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
                <div>
                  <h2 className="decision-templates-title">{selectedTemplate.name}</h2>
                  <p className="decision-templates-subtitle">Fill in the details.</p>
                </div>
              </div>
              <button
                className="decision-templates-close"
                onClick={onClose}
                aria-label="Close"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="decision-templates-content template-config">
              {/* Template Info */}
              <div className="template-info-card">
                <div className="info-header">
                  <div>
                    <h3>{selectedTemplate.name}</h3>
                    <p>{selectedTemplate.description}</p>
                  </div>
                </div>
                <div className="info-stats">
                  <div className="stat">
                    <CheckSquare size={14} aria-hidden="true" />
                    <span className="dt-label">
                      {selectedTemplate.suggested_tasks.length} suggested tasks
                    </span>
                  </div>
                  <div className="stat">
                    <span className="type-badge">{selectedTemplate.default_decision_type || 'consensus'}</span>
                  </div>
                </div>
              </div>

              {/* Variable Inputs */}
              {Object.keys(variables).length > 0 && (
                <div className="variable-inputs">
                  <h4>Fill in the details:</h4>
                  {Object.keys(variables).map(varName => (
                    <div key={varName} className="input-field">
                      <label htmlFor={`var-${varName}`}>
                        {varName.replace(/_/g, ' ')}
                        <span className="required">*</span>
                      </label>
                      <input
                        id={`var-${varName}`}
                        type="text"
                        value={variables[varName]}
                        onChange={(e) => setVariables({
                          ...variables,
                          [varName]: e.target.value
                        })}
                        placeholder={`Enter ${varName.replace(/_/g, ' ')}`}
                        className="variable-input"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Preview */}
              <div className="template-preview">
                <h4>Preview:</h4>
                <div className="preview-card">
                  <h5>Decision Title:</h5>
                  <p className="preview-title">
                    {decisionTemplateService.applyTemplate(selectedTemplate, variables).title}
                  </p>
                  {selectedTemplate.description_template && (
                    <>
                      <h5>Description:</h5>
                      <p className="preview-description">
                        {decisionTemplateService.applyTemplate(selectedTemplate, variables).description}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Suggested Tasks Preview */}
              <div className="suggested-tasks-preview">
                <h4>Suggested Tasks ({selectedTemplate.suggested_tasks.length}):</h4>
                <div className="tasks-list">
                  {selectedTemplate.suggested_tasks.map((task, index) => (
                    <div key={index} className="task-preview-card">
                      <div className="task-header">
                        <CheckSquare size={16} />
                        <span className="task-title">{task.title}</span>
                        {task.priority && (
                          <span className={`priority-badge priority-${task.priority}`}>
                            {task.priority}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="task-description">{task.description}</p>
                      )}
                      {task.deadline_offset_days && (
                        <p className="task-deadline">Due in {task.deadline_offset_days} days</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="template-config-actions">
                <button
                  className="use-template-button"
                  onClick={handleUseTemplate}
                  disabled={Object.values(variables).some(v => !v.trim())}
                >
                  <Plus size={18} />
                  Use This Template
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
