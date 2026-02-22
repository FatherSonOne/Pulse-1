import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, CheckSquare, TrendingUp, Sparkles, Plus } from 'lucide-react';
import { DecisionTemplate, decisionTemplateService, TemplateVariables } from '../../services/decisionTemplateService';
import './DecisionTemplates.css';

interface DecisionTemplatesProps {
  workspaceId?: string;
  onClose: () => void;
  onSelectTemplate: (template: DecisionTemplate, variables: TemplateVariables) => void;
}

interface CategoryTab {
  category: string;
  count: number;
  icon: string;
}

export const DecisionTemplates: React.FC<DecisionTemplatesProps> = ({
  workspaceId,
  onClose,
  onSelectTemplate
}) => {
  const [templates, setTemplates] = useState<DecisionTemplate[]>([]);
  const [categories, setCategories] = useState<CategoryTab[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<DecisionTemplate | null>(null);
  const [variables, setVariables] = useState<TemplateVariables>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, [workspaceId]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const [templateData, categoryData] = await Promise.all([
        decisionTemplateService.getTemplates(workspaceId),
        decisionTemplateService.getCategories(workspaceId)
      ]);

      setTemplates(templateData);
      setCategories([
        { category: 'All', count: templateData.length, icon: '📋' },
        ...categoryData.map(c => ({ ...c, icon: c.icon || '📁' }))
      ]);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
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
      alert(`Please fill in all required fields: ${missingVars.map(([key]) => key).join(', ')}`);
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
                <Sparkles size={24} className="header-icon" />
                <div>
                  <h2 className="decision-templates-title">Decision Templates</h2>
                  <p className="decision-templates-subtitle">Start with a proven decision framework</p>
                </div>
              </div>
              <button
                className="decision-templates-close"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="decision-templates-content">
              {/* Search Bar */}
              <div className="templates-search">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              {/* Category Tabs */}
              <div className="category-tabs">
                {categories.map(({ category, count, icon }) => (
                  <button
                    key={category}
                    className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    <span className="category-icon">{icon}</span>
                    <span className="category-name">{category}</span>
                    <span className="category-count">{count}</span>
                  </button>
                ))}
              </div>

              {/* Template Grid */}
              {loading ? (
                <div className="templates-loading">
                  <div className="spinner"></div>
                  <p>Loading templates...</p>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="templates-empty">
                  <Sparkles size={48} color="#ccc" />
                  <h3>No templates found</h3>
                  <p>Try a different category or search term</p>
                </div>
              ) : (
                <div className="templates-grid">
                  {filteredTemplates.map(template => (
                    <div
                      key={template.id}
                      className="template-card"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="template-card-header">
                        <span className="template-icon">{template.icon || '📋'}</span>
                        <div className="template-meta">
                          {template.is_system && (
                            <span className="system-badge">System</span>
                          )}
                          {template.category && (
                            <span className="category-badge">{template.category}</span>
                          )}
                        </div>
                      </div>
                      <h3 className="template-name">{template.name}</h3>
                      <p className="template-description">{template.description}</p>
                      <div className="template-stats">
                        <span className="stat-item">
                          <CheckSquare size={14} />
                          {template.suggested_tasks.length} tasks
                        </span>
                        <span className="stat-item">
                          <TrendingUp size={14} />
                          {template.usage_count} uses
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // Template Configuration View
          <>
            <div className="decision-templates-header">
              <div className="header-left">
                <button
                  className="back-button"
                  onClick={() => setSelectedTemplate(null)}
                  aria-label="Back to templates"
                >
                  ←
                </button>
                <div>
                  <h2 className="decision-templates-title">{selectedTemplate.name}</h2>
                  <p className="decision-templates-subtitle">Fill in the details</p>
                </div>
              </div>
              <button
                className="decision-templates-close"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="decision-templates-content template-config">
              {/* Template Info */}
              <div className="template-info-card">
                <div className="info-header">
                  <span className="template-icon-large">{selectedTemplate.icon || '📋'}</span>
                  <div>
                    <h3>{selectedTemplate.name}</h3>
                    <p>{selectedTemplate.description}</p>
                  </div>
                </div>
                <div className="info-stats">
                  <div className="stat">
                    <CheckSquare size={16} />
                    <span>{selectedTemplate.suggested_tasks.length} suggested tasks</span>
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
