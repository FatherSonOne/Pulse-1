// TemplateVariablesModal.tsx - Prompt for template variable values
import React, { useState, useEffect } from 'react';
import { EmailTemplate, emailSyncService } from '../../services/emailSyncService';

interface TemplateVariablesModalProps {
  template: EmailTemplate;
  onApply: (subject: string | undefined, body: string) => void;
  onClose: () => void;
}

export const TemplateVariablesModal: React.FC<TemplateVariablesModalProps> = ({
  template,
  onApply,
  onClose,
}) => {
  const [variables, setVariables] = useState<Record<string, string>>({});

  // Initialize variables from template
  useEffect(() => {
    if (template.variables) {
      const initial: Record<string, string> = {};
      template.variables.forEach(v => {
        initial[v] = '';
      });
      setVariables(initial);
    }
  }, [template]);

  // Handle variable change
  const handleChange = (varName: string, value: string) => {
    setVariables(prev => ({
      ...prev,
      [varName]: value,
    }));
  };

  // Apply template with variables
  const handleApply = () => {
    const appliedBody = emailSyncService.applyTemplateVariables(template.body, variables);
    const appliedSubject = template.subject
      ? emailSyncService.applyTemplateVariables(template.subject, variables)
      : undefined;

    onApply(appliedSubject, appliedBody);
  };

  // Skip if no variables
  const hasVariables = template.variables && template.variables.length > 0;

  // If no variables, apply immediately
  useEffect(() => {
    if (!hasVariables) {
      onApply(template.subject, template.body);
    }
  }, [hasVariables, template, onApply]);

  // Don't render if no variables
  if (!hasVariables) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <i className="fa-solid fa-code text-white text-sm"></i>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Fill in Variables</h2>
              <p className="text-xs text-zinc-500">{template.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Variables form */}
        <div className="p-5 space-y-4">
          {template.variables?.map((varName) => (
            <div key={varName}>
              <label className="block text-sm text-zinc-300 mb-1.5 capitalize">
                {varName.replace(/_/g, ' ')}
              </label>
              <input
                type="text"
                value={variables[varName] || ''}
                onChange={(e) => handleChange(varName, e.target.value)}
                placeholder={`Enter ${varName.replace(/_/g, ' ')}`}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                autoFocus={template.variables?.indexOf(varName) === 0}
              />
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="px-5 pb-4">
          <div className="text-xs text-zinc-500 mb-2">Preview:</div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400 max-h-32 overflow-y-auto">
            {template.subject && (
              <div className="text-zinc-300 mb-2">
                <strong>Subject:</strong> {emailSyncService.applyTemplateVariables(template.subject, variables)}
              </div>
            )}
            <div className="whitespace-pre-wrap">
              {emailSyncService.applyTemplateVariables(template.body, variables).substring(0, 200)}
              {template.body.length > 200 && '...'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <button
            onClick={handleApply}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg text-sm transition"
          >
            <i className="fa-solid fa-check"></i>
            Apply Template
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateVariablesModal;
