// LabelManager.tsx - Email labels/tags management modal
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

import { Check, Loader2, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';

interface EmailLabel {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon?: string;
  email_count?: number;
  created_at: string;
}

interface LabelManagerProps {
  onClose: () => void;
  emailId?: string; // If provided, manage labels for this email
  currentLabels?: string[]; // Current labels on the email
  onLabelsChanged?: (labels: string[]) => void;
}

const LABEL_COLORS = [
  { name: 'Rose', value: '#f43f5e', bg: 'bg-rose-500' },
  { name: 'Orange', value: '#f97316', bg: 'bg-orange-500' },
  { name: 'Amber', value: '#f59e0b', bg: 'bg-amber-500' },
  { name: 'Lime', value: '#84cc16', bg: 'bg-lime-500' },
  { name: 'Emerald', value: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Cyan', value: '#06b6d4', bg: 'bg-cyan-500' },
  { name: 'Blue', value: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Violet', value: '#8b5cf6', bg: 'bg-violet-500' },
  { name: 'Fuchsia', value: '#d946ef', bg: 'bg-fuchsia-500' },
  { name: 'Pink', value: '#ec4899', bg: 'bg-pink-500' },
];

export const LabelManager: React.FC<LabelManagerProps> = ({
  onClose,
  emailId,
  currentLabels = [],
  onLabelsChanged
}) => {
  const [labels, setLabels] = useState<EmailLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0].value);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set(currentLabels));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Load labels
  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('email_labels')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setLabels(data || []);
    } catch (error) {
      console.error('Error loading labels:', error);
      toast.error('Failed to load labels');
    } finally {
      setLoading(false);
    }
  };

  // Create new label
  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) {
      toast.error('Label name is required');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('email_labels')
        .insert({
          user_id: user.id,
          name: newLabelName.trim(),
          color: newLabelColor
        })
        .select()
        .single();

      if (error) throw error;

      setLabels(prev => [...prev, data]);
      setNewLabelName('');
      setShowCreate(false);
      toast.success('Label created');
    } catch (error) {
      console.error('Error creating label:', error);
      toast.error('Failed to create label');
    }
  };

  // Delete label
  const handleDeleteLabel = async (labelId: string) => {
    try {
      const { error } = await supabase
        .from('email_labels')
        .delete()
        .eq('id', labelId);

      if (error) throw error;

      setLabels(prev => prev.filter(l => l.id !== labelId));
      toast.success('Label deleted');
    } catch (error) {
      console.error('Error deleting label:', error);
      toast.error('Failed to delete label');
    }
  };

  // Begin inline rename
  const startRename = (label: EmailLabel) => {
    setEditingId(label.id);
    setEditingName(label.name);
  };

  // Cancel inline rename
  const cancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  // Save inline rename (mirrors handleDeleteLabel/handleCreateLabel pattern)
  const handleRenameLabel = async (labelId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.error('Label name is required');
      return;
    }

    try {
      const { error } = await supabase
        .from('email_labels')
        .update({ name: trimmed })
        .eq('id', labelId);

      if (error) throw error;

      setLabels(prev => prev.map(l => (l.id === labelId ? { ...l, name: trimmed } : l)));
      setEditingId(null);
      setEditingName('');
      toast.success('Label renamed');
    } catch (error) {
      console.error('Error renaming label:', error);
      toast.error('Failed to rename label');
    }
  };

  // Toggle label selection for email
  const toggleLabelForEmail = (labelName: string) => {
    const newSelected = new Set(selectedLabels);
    if (newSelected.has(labelName)) {
      newSelected.delete(labelName);
    } else {
      newSelected.add(labelName);
    }
    setSelectedLabels(newSelected);
  };

  // Apply label changes to email
  const handleApplyLabels = async () => {
    if (!emailId) {
      onClose();
      return;
    }

    try {
      const newLabels = Array.from(selectedLabels);

      const { error } = await supabase
        .from('cached_emails')
        .update({
          labels: newLabels,
          updated_at: new Date().toISOString()
        })
        .eq('id', emailId);

      if (error) throw error;

      onLabelsChanged?.(newLabels);
      toast.success('Labels updated');
      onClose();
    } catch (error) {
      console.error('Error applying labels:', error);
      toast.error('Failed to apply labels');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 pulse-modal-scrim"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative pulse-surface rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden border pulse-border-color"
        role="dialog"
        aria-modal="true"
        aria-labelledby="label-manager-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b pulse-border-color">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl pulse-surface-raised border pulse-border-color flex items-center justify-center pulse-ink-2-color">
              <Tags className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h2 id="label-manager-title" className="text-lg font-semibold pulse-ink-color">
                {emailId ? 'Manage Labels' : 'Labels'}
              </h2>
              <p className="text-sm pulse-ink-3-color">
                {emailId ? 'Add or remove labels' : 'Create and manage labels'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:pulse-surface-raised flex items-center justify-center pulse-ink-3-color hover:pulse-ink-color transition"
            aria-label="Close"
          >
            <X />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[50vh] p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 pulse-ink-3-color animate-spin" />
            </div>
          ) : (
            <>
              {/* Label list */}
              <div className="space-y-1">
                {labels.length === 0 && !showCreate && (
                  <div className="text-center py-8 pulse-ink-3-color">
                    <Tags className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p>No labels yet</p>
                    <p className="text-sm mt-1">Create your first label to organize emails</p>
                  </div>
                )}

                {labels.map((label) => (
                  <div
                    key={label.id}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition cursor-pointer border ${
                      selectedLabels.has(label.name)
                        ? 'pulse-rose-bg-soft-color pulse-rose-border'
                        : 'hover:pulse-surface-raised border-transparent hover:pulse-border-color'
                    }`}
                    onClick={() => emailId && editingId !== label.id && toggleLabelForEmail(label.name)}
                  >
                    {/* Color dot */}
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: label.color }}
                    ></div>

                    {/* Label name OR inline rename input */}
                    {editingId === label.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameLabel(label.id);
                          if (e.key === 'Escape') cancelRename();
                        }}
                        className="flex-1 px-2 py-1 pulse-surface border pulse-border-color rounded-lg text-sm pulse-ink-color focus:outline-none focus:pulse-rose-border"
                        autoFocus
                      />
                    ) : (
                      <span className="flex-1 pulse-ink-color font-medium">
                        {label.name}
                      </span>
                    )}

                    {/* Checkbox for email mode */}
                    {emailId && (
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                        selectedLabels.has(label.name)
                          ? 'pulse-rose-bg-color pulse-rose-border'
                          : 'pulse-border-strong-color'
                      }`}>
                        {selectedLabels.has(label.name) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    )}

                    {/* Rename + Delete (only in manage mode) */}
                    {!emailId && (
                      editingId === label.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameLabel(label.id);
                            }}
                            className="w-7 h-7 rounded-lg hover:pulse-surface-raised flex items-center justify-center pulse-rose-color transition"
                            aria-label="Save name"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelRename();
                            }}
                            className="w-7 h-7 rounded-lg hover:pulse-surface-raised flex items-center justify-center pulse-ink-3-color hover:pulse-ink-color transition"
                            aria-label="Cancel rename"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(label);
                            }}
                            className="w-7 h-7 rounded-lg hover:pulse-surface-raised flex items-center justify-center pulse-ink-3-color hover:pulse-ink-color transition"
                            aria-label={`Rename ${label.name} label`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLabel(label.id);
                            }}
                            className="w-7 h-7 rounded-lg hover:pulse-surface-raised flex items-center justify-center pulse-ink-3-color transition hover:text-[color:var(--pulse-tone-overdue)]"
                            aria-label={`Delete ${label.name} label`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>

              {/* Create new label */}
              {showCreate ? (
                <div className="mt-4 p-4 pulse-surface-raised border pulse-border-color rounded-xl">
                  <span className="block font-mono-pulse tracking-wide-mono text-[10px] uppercase pulse-ink-3-color mb-2">New label</span>
                  <div className="mb-3">
                    <input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="Label name..."
                      className="w-full px-3 py-2 pulse-surface border pulse-border-color rounded-lg pulse-ink-color placeholder:pulse-ink-3-color focus:outline-none focus:pulse-rose-border"
                      autoFocus
                    />
                  </div>

                  {/* Color picker */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {LABEL_COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setNewLabelColor(color.value)}
                        className={`w-6 h-6 rounded-full transition ${
                          newLabelColor === color.value ? 'ring-2 ring-offset-2 ring-offset-transparent pulse-rose-border ring-[color:var(--pulse-rose)]' : ''
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                        aria-label={`Select ${color.name} color`}
                      />
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowCreate(false);
                        setNewLabelName('');
                      }}
                      className="flex-1 px-4 py-2 pulse-surface-raised border pulse-border-color hover:pulse-border-strong-color rounded-lg pulse-ink-color text-sm font-medium transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateLabel}
                      className="flex-1 px-4 py-2 pulse-rose-bg-color hover:opacity-90 rounded-lg text-white text-sm font-medium transition"
                    >
                      Create
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 pulse-surface-raised border border-dashed pulse-border-color hover:pulse-border-strong-color rounded-lg pulse-ink-2-color text-sm font-medium transition"
                >
                  <Plus className="w-4 h-4" />
                  Create New Label
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer - Apply button for email mode */}
        {emailId && (
          <div className="px-6 py-4 border-t pulse-border-color pulse-surface-raised">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 pulse-surface border pulse-border-color hover:pulse-border-strong-color rounded-lg pulse-ink-color font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyLabels}
                className="flex-1 px-4 py-2 pulse-rose-bg-color hover:opacity-90 rounded-lg text-white font-medium transition"
              >
                Apply Labels
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabelManager;
