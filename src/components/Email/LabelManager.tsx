// LabelManager.tsx - Email labels/tags management modal
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

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
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden border border-stone-200 dark:border-zinc-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="label-manager-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <i className="fa-solid fa-tags text-white"></i>
            </div>
            <div>
              <h2 id="label-manager-title" className="text-lg font-semibold text-stone-900 dark:text-white">
                {emailId ? 'Manage Labels' : 'Labels'}
              </h2>
              <p className="text-sm text-stone-500 dark:text-zinc-500">
                {emailId ? 'Add or remove labels' : 'Create and manage labels'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[50vh] p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <i className="fa-solid fa-circle-notch fa-spin text-2xl text-stone-400 dark:text-zinc-600"></i>
            </div>
          ) : (
            <>
              {/* Label list */}
              <div className="space-y-2">
                {labels.length === 0 && !showCreate && (
                  <div className="text-center py-8 text-stone-500 dark:text-zinc-500">
                    <i className="fa-solid fa-tags text-3xl mb-3 opacity-50"></i>
                    <p>No labels yet</p>
                    <p className="text-sm mt-1">Create your first label to organize emails</p>
                  </div>
                )}

                {labels.map((label) => (
                  <div
                    key={label.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition cursor-pointer ${
                      selectedLabels.has(label.name)
                        ? 'bg-violet-500/10 border border-violet-500/30'
                        : 'hover:bg-stone-100 dark:hover:bg-zinc-800/50 border border-transparent'
                    }`}
                    onClick={() => emailId && toggleLabelForEmail(label.name)}
                  >
                    {/* Color dot */}
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: label.color }}
                    ></div>

                    {/* Label name */}
                    <span className="flex-1 text-stone-900 dark:text-white font-medium">
                      {label.name}
                    </span>

                    {/* Checkbox for email mode */}
                    {emailId && (
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                        selectedLabels.has(label.name)
                          ? 'bg-violet-500 border-violet-500'
                          : 'border-stone-300 dark:border-zinc-600'
                      }`}>
                        {selectedLabels.has(label.name) && (
                          <i className="fa-solid fa-check text-white text-xs"></i>
                        )}
                      </div>
                    )}

                    {/* Delete button (only in manage mode) */}
                    {!emailId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLabel(label.id);
                        }}
                        className="w-7 h-7 rounded hover:bg-stone-200 dark:hover:bg-zinc-700 flex items-center justify-center text-stone-400 dark:text-zinc-500 hover:text-red-500 transition"
                        aria-label={`Delete ${label.name} label`}
                      >
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Create new label */}
              {showCreate ? (
                <div className="mt-4 p-4 bg-stone-100 dark:bg-zinc-800/50 rounded-xl">
                  <div className="mb-3">
                    <input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="Label name..."
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-lg text-stone-900 dark:text-white placeholder-stone-500 dark:placeholder-zinc-500 focus:outline-none focus:border-violet-500"
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
                          newLabelColor === color.value ? 'ring-2 ring-offset-2 ring-violet-500 dark:ring-offset-zinc-900' : ''
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
                      className="flex-1 px-4 py-2 bg-stone-200 dark:bg-zinc-700 hover:bg-stone-300 dark:hover:bg-zinc-600 rounded-lg text-stone-700 dark:text-white text-sm font-medium transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateLabel}
                      className="flex-1 px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg text-white text-sm font-medium transition"
                    >
                      Create
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-stone-100 dark:bg-zinc-800/50 hover:bg-stone-200 dark:hover:bg-zinc-800 rounded-lg text-stone-600 dark:text-zinc-400 text-sm font-medium transition"
                >
                  <i className="fa-solid fa-plus"></i>
                  Create New Label
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer - Apply button for email mode */}
        {emailId && (
          <div className="px-6 py-4 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 dark:hover:bg-zinc-700 rounded-lg text-stone-700 dark:text-white font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyLabels}
                className="flex-1 px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg text-white font-medium transition"
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
