// FilterManager.tsx - Email filters and rules management
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface EmailFilter {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  from_contains?: string;
  to_contains?: string;
  subject_contains?: string;
  body_contains?: string;
  has_attachment?: boolean;
  apply_labels: string[];
  mark_as_read: boolean;
  archive: boolean;
  star: boolean;
  forward_to?: string;
  delete: boolean;
  enabled: boolean;
  match_count: number;
  last_matched_at?: string;
  created_at: string;
}

interface FilterManagerProps {
  onClose: () => void;
  initialFrom?: string; // Pre-fill from email address (e.g., from "Create filter" in email)
  initialSubject?: string;
}

export const FilterManager: React.FC<FilterManagerProps> = ({
  onClose,
  initialFrom,
  initialSubject
}) => {
  const [filters, setFilters] = useState<EmailFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFilter, setEditingFilter] = useState<Partial<EmailFilter> | null>(null);
  const [showCreate, setShowCreate] = useState(!!initialFrom || !!initialSubject);
  const [availableLabels, setAvailableLabels] = useState<{ id: string; name: string; color: string }[]>([]);

  // Initialize with pre-filled values
  useEffect(() => {
    if (initialFrom || initialSubject) {
      setEditingFilter({
        from_contains: initialFrom,
        subject_contains: initialSubject,
        apply_labels: [],
        mark_as_read: false,
        archive: false,
        star: false,
        delete: false,
        enabled: true
      });
    }
  }, [initialFrom, initialSubject]);

  // Load filters and labels
  useEffect(() => {
    loadFilters();
    loadLabels();
  }, []);

  const loadFilters = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('email_filters')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFilters(data || []);
    } catch (error) {
      console.error('Error loading filters:', error);
      toast.error('Failed to load filters');
    } finally {
      setLoading(false);
    }
  };

  const loadLabels = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('email_labels')
        .select('id, name, color')
        .eq('user_id', user.id);

      if (error) throw error;
      setAvailableLabels(data || []);
    } catch (error) {
      console.error('Error loading labels:', error);
    }
  };

  // Save filter (create or update)
  const handleSaveFilter = async () => {
    if (!editingFilter) return;

    // Validate
    if (!editingFilter.from_contains && !editingFilter.subject_contains &&
        !editingFilter.body_contains && editingFilter.has_attachment === undefined) {
      toast.error('At least one filter condition is required');
      return;
    }

    if (!editingFilter.apply_labels?.length && !editingFilter.mark_as_read &&
        !editingFilter.archive && !editingFilter.star && !editingFilter.delete) {
      toast.error('At least one action is required');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const filterData = {
        ...editingFilter,
        user_id: user.id,
        name: editingFilter.name || generateFilterName(editingFilter),
        updated_at: new Date().toISOString()
      };

      if (editingFilter.id) {
        // Update existing
        const { error } = await supabase
          .from('email_filters')
          .update(filterData)
          .eq('id', editingFilter.id);

        if (error) throw error;
        toast.success('Filter updated');
      } else {
        // Create new
        const { error } = await supabase
          .from('email_filters')
          .insert(filterData);

        if (error) throw error;
        toast.success('Filter created');
      }

      setEditingFilter(null);
      setShowCreate(false);
      loadFilters();
    } catch (error) {
      console.error('Error saving filter:', error);
      toast.error('Failed to save filter');
    }
  };

  // Delete filter
  const handleDeleteFilter = async (filterId: string) => {
    try {
      const { error } = await supabase
        .from('email_filters')
        .delete()
        .eq('id', filterId);

      if (error) throw error;

      setFilters(prev => prev.filter(f => f.id !== filterId));
      toast.success('Filter deleted');
    } catch (error) {
      console.error('Error deleting filter:', error);
      toast.error('Failed to delete filter');
    }
  };

  // Toggle filter enabled
  const handleToggleFilter = async (filter: EmailFilter) => {
    try {
      const { error } = await supabase
        .from('email_filters')
        .update({
          enabled: !filter.enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', filter.id);

      if (error) throw error;

      setFilters(prev => prev.map(f =>
        f.id === filter.id ? { ...f, enabled: !f.enabled } : f
      ));
    } catch (error) {
      console.error('Error toggling filter:', error);
      toast.error('Failed to update filter');
    }
  };

  // Generate filter name from conditions
  const generateFilterName = (filter: Partial<EmailFilter>): string => {
    const parts: string[] = [];
    if (filter.from_contains) parts.push(`from:${filter.from_contains}`);
    if (filter.subject_contains) parts.push(`subject:${filter.subject_contains}`);
    if (filter.has_attachment) parts.push('has:attachment');
    return parts.join(' ') || 'Unnamed Filter';
  };

  // Toggle label in filter
  const toggleFilterLabel = (labelName: string) => {
    if (!editingFilter) return;

    const currentLabels = editingFilter.apply_labels || [];
    const newLabels = currentLabels.includes(labelName)
      ? currentLabels.filter(l => l !== labelName)
      : [...currentLabels, labelName];

    setEditingFilter({ ...editingFilter, apply_labels: newLabels });
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
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-stone-200 dark:border-zinc-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-manager-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <i className="fa-solid fa-filter text-white"></i>
            </div>
            <div>
              <h2 id="filter-manager-title" className="text-lg font-semibold text-stone-900 dark:text-white">
                Email Filters
              </h2>
              <p className="text-sm text-stone-500 dark:text-zinc-500">
                Automatically organize incoming emails
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
        <div className="overflow-y-auto max-h-[60vh] p-6">
          {showCreate || editingFilter ? (
            /* Filter Editor */
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-2">
                  Filter Name (optional)
                </label>
                <input
                  type="text"
                  value={editingFilter?.name || ''}
                  onChange={(e) => setEditingFilter({ ...editingFilter, name: e.target.value })}
                  placeholder="Auto-generated if empty"
                  className="w-full px-4 py-2 bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-stone-900 dark:text-white placeholder-stone-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Conditions */}
              <div>
                <h3 className="text-sm font-medium text-stone-700 dark:text-zinc-300 mb-3">
                  When emails match...
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-stone-500 dark:text-zinc-500 w-20">From:</span>
                    <input
                      type="text"
                      value={editingFilter?.from_contains || ''}
                      onChange={(e) => setEditingFilter({ ...editingFilter, from_contains: e.target.value })}
                      placeholder="Sender email or name"
                      className="flex-1 px-3 py-2 bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm text-stone-900 dark:text-white placeholder-stone-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-stone-500 dark:text-zinc-500 w-20">Subject:</span>
                    <input
                      type="text"
                      value={editingFilter?.subject_contains || ''}
                      onChange={(e) => setEditingFilter({ ...editingFilter, subject_contains: e.target.value })}
                      placeholder="Words in subject"
                      className="flex-1 px-3 py-2 bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm text-stone-900 dark:text-white placeholder-stone-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-stone-500 dark:text-zinc-500 w-20">Body:</span>
                    <input
                      type="text"
                      value={editingFilter?.body_contains || ''}
                      onChange={(e) => setEditingFilter({ ...editingFilter, body_contains: e.target.value })}
                      placeholder="Words in body"
                      className="flex-1 px-3 py-2 bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm text-stone-900 dark:text-white placeholder-stone-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingFilter?.has_attachment || false}
                      onChange={(e) => setEditingFilter({ ...editingFilter, has_attachment: e.target.checked || undefined })}
                      className="w-4 h-4 rounded border-stone-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-500/30"
                    />
                    <span className="text-sm text-stone-700 dark:text-zinc-300">Has attachment</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div>
                <h3 className="text-sm font-medium text-stone-700 dark:text-zinc-300 mb-3">
                  Do this...
                </h3>
                <div className="space-y-3">
                  {/* Apply labels */}
                  {availableLabels.length > 0 && (
                    <div>
                      <span className="text-sm text-stone-500 dark:text-zinc-500 block mb-2">Apply labels:</span>
                      <div className="flex flex-wrap gap-2">
                        {availableLabels.map((label) => (
                          <button
                            key={label.id}
                            onClick={() => toggleFilterLabel(label.name)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition ${
                              editingFilter?.apply_labels?.includes(label.name)
                                ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                : 'bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 hover:bg-stone-200 dark:hover:bg-zinc-700'
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: label.color }}
                            ></span>
                            {label.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Other actions */}
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingFilter?.mark_as_read || false}
                        onChange={(e) => setEditingFilter({ ...editingFilter, mark_as_read: e.target.checked })}
                        className="w-4 h-4 rounded border-stone-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-500/30"
                      />
                      <span className="text-sm text-stone-700 dark:text-zinc-300">Mark as read</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingFilter?.archive || false}
                        onChange={(e) => setEditingFilter({ ...editingFilter, archive: e.target.checked })}
                        className="w-4 h-4 rounded border-stone-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-500/30"
                      />
                      <span className="text-sm text-stone-700 dark:text-zinc-300">Skip inbox (archive)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingFilter?.star || false}
                        onChange={(e) => setEditingFilter({ ...editingFilter, star: e.target.checked })}
                        className="w-4 h-4 rounded border-stone-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-500/30"
                      />
                      <span className="text-sm text-stone-700 dark:text-zinc-300">Star it</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingFilter?.delete || false}
                        onChange={(e) => setEditingFilter({ ...editingFilter, delete: e.target.checked })}
                        className="w-4 h-4 rounded border-stone-300 dark:border-zinc-600 text-red-500 focus:ring-red-500/30"
                      />
                      <span className="text-sm text-red-600 dark:text-red-400">Delete it</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Editor Actions */}
              <div className="flex gap-3 pt-4 border-t border-stone-200 dark:border-zinc-800">
                <button
                  onClick={() => {
                    setEditingFilter(null);
                    setShowCreate(false);
                  }}
                  className="flex-1 px-4 py-2 bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 dark:hover:bg-zinc-700 rounded-lg text-stone-700 dark:text-white font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFilter}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition"
                >
                  {editingFilter?.id ? 'Update Filter' : 'Create Filter'}
                </button>
              </div>
            </div>
          ) : (
            /* Filter List */
            <>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <i className="fa-solid fa-circle-notch fa-spin text-2xl text-stone-400 dark:text-zinc-600"></i>
                </div>
              ) : filters.length === 0 ? (
                <div className="text-center py-12 text-stone-500 dark:text-zinc-500">
                  <i className="fa-solid fa-filter text-4xl mb-4 opacity-50"></i>
                  <p className="font-medium">No filters yet</p>
                  <p className="text-sm mt-1">Create filters to automatically organize your emails</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filters.map((filter) => (
                    <div
                      key={filter.id}
                      className={`p-4 rounded-xl border transition ${
                        filter.enabled
                          ? 'bg-white dark:bg-zinc-800/50 border-stone-200 dark:border-zinc-800'
                          : 'bg-stone-100 dark:bg-zinc-900/50 border-stone-200 dark:border-zinc-800/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-stone-900 dark:text-white truncate">
                              {filter.name}
                            </h4>
                            {!filter.enabled && (
                              <span className="text-xs px-2 py-0.5 bg-stone-200 dark:bg-zinc-700 text-stone-500 dark:text-zinc-400 rounded">
                                Disabled
                              </span>
                            )}
                          </div>

                          {/* Conditions */}
                          <div className="flex flex-wrap gap-2 text-xs text-stone-500 dark:text-zinc-500 mb-2">
                            {filter.from_contains && (
                              <span className="px-2 py-0.5 bg-stone-100 dark:bg-zinc-800 rounded">
                                from:{filter.from_contains}
                              </span>
                            )}
                            {filter.subject_contains && (
                              <span className="px-2 py-0.5 bg-stone-100 dark:bg-zinc-800 rounded">
                                subject:{filter.subject_contains}
                              </span>
                            )}
                            {filter.has_attachment && (
                              <span className="px-2 py-0.5 bg-stone-100 dark:bg-zinc-800 rounded">
                                has:attachment
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2 text-xs">
                            {filter.apply_labels.map((label) => (
                              <span key={label} className="px-2 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded">
                                label:{label}
                              </span>
                            ))}
                            {filter.mark_as_read && (
                              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">
                                mark read
                              </span>
                            )}
                            {filter.archive && (
                              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded">
                                archive
                              </span>
                            )}
                            {filter.star && (
                              <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded">
                                star
                              </span>
                            )}
                            {filter.delete && (
                              <span className="px-2 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded">
                                delete
                              </span>
                            )}
                          </div>

                          {/* Stats */}
                          {filter.match_count > 0 && (
                            <p className="text-xs text-stone-400 dark:text-zinc-600 mt-2">
                              Matched {filter.match_count} email{filter.match_count !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleFilter(filter)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                              filter.enabled
                                ? 'text-green-500 hover:bg-green-500/10'
                                : 'text-stone-400 dark:text-zinc-600 hover:bg-stone-100 dark:hover:bg-zinc-800'
                            }`}
                            title={filter.enabled ? 'Disable filter' : 'Enable filter'}
                          >
                            <i className={`fa-solid ${filter.enabled ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                          </button>
                          <button
                            onClick={() => setEditingFilter(filter)}
                            className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
                            title="Edit filter"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteFilter(filter.id)}
                            className="w-8 h-8 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-red-500 transition"
                            title="Delete filter"
                          >
                            <i className="fa-solid fa-trash text-xs"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create button */}
              <button
                onClick={() => {
                  setEditingFilter({
                    apply_labels: [],
                    mark_as_read: false,
                    archive: false,
                    star: false,
                    delete: false,
                    enabled: true
                  });
                  setShowCreate(true);
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition"
              >
                <i className="fa-solid fa-plus"></i>
                Create New Filter
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterManager;
