// FilterManager.tsx - Email filters and rules management
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

import { Filter, Loader2, Pen, Plus, Trash2, X } from 'lucide-react';

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
        className="absolute inset-0 pulse-modal-scrim"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative pulse-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border pulse-border-color"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-manager-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b pulse-border-color">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl pulse-surface-raised border pulse-border-color flex items-center justify-center pulse-ink-2-color">
              <Filter className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h2 id="filter-manager-title" className="text-lg font-semibold pulse-ink-color">
                Email Filters
              </h2>
              <p className="text-sm pulse-ink-3-color">
                Automatically organize incoming emails
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
        <div className="overflow-y-auto max-h-[60vh] p-6">
          {showCreate || editingFilter ? (
            /* Filter Editor */
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block font-mono-pulse tracking-wide-mono text-[10px] uppercase pulse-ink-3-color mb-2">
                  Filter Name (optional)
                </label>
                <input
                  type="text"
                  value={editingFilter?.name || ''}
                  onChange={(e) => setEditingFilter({ ...editingFilter, name: e.target.value })}
                  placeholder="Auto-generated if empty"
                  className="w-full px-4 py-2 pulse-surface border pulse-border-color rounded-lg pulse-ink-color placeholder:pulse-ink-3-color focus:outline-none focus:pulse-rose-border"
                />
              </div>

              {/* Conditions */}
              <div>
                <h3 className="font-serif-pulse text-[15px] font-medium pulse-ink-color mb-3">
                  When emails match...
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm pulse-ink-2-color font-medium w-20">From:</span>
                    <input
                      type="text"
                      value={editingFilter?.from_contains || ''}
                      onChange={(e) => setEditingFilter({ ...editingFilter, from_contains: e.target.value })}
                      placeholder="Sender email or name"
                      className="flex-1 px-3 py-2 pulse-surface border pulse-border-color rounded-lg text-sm pulse-ink-color placeholder:pulse-ink-3-color focus:outline-none focus:pulse-rose-border"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm pulse-ink-2-color font-medium w-20">Subject:</span>
                    <input
                      type="text"
                      value={editingFilter?.subject_contains || ''}
                      onChange={(e) => setEditingFilter({ ...editingFilter, subject_contains: e.target.value })}
                      placeholder="Words in subject"
                      className="flex-1 px-3 py-2 pulse-surface border pulse-border-color rounded-lg text-sm pulse-ink-color placeholder:pulse-ink-3-color focus:outline-none focus:pulse-rose-border"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm pulse-ink-2-color font-medium w-20">Body:</span>
                    <input
                      type="text"
                      value={editingFilter?.body_contains || ''}
                      onChange={(e) => setEditingFilter({ ...editingFilter, body_contains: e.target.value })}
                      placeholder="Words in body"
                      className="flex-1 px-3 py-2 pulse-surface border pulse-border-color rounded-lg text-sm pulse-ink-color placeholder:pulse-ink-3-color focus:outline-none focus:pulse-rose-border"
                    />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingFilter?.has_attachment || false}
                      onChange={(e) => setEditingFilter({ ...editingFilter, has_attachment: e.target.checked || undefined })}
                      className="w-4 h-4 rounded pulse-border-strong-color accent-[color:var(--pulse-rose)]"
                    />
                    <span className="text-sm pulse-ink-color">Has attachment</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div>
                <h3 className="font-serif-pulse text-[15px] font-medium pulse-ink-color mb-3">
                  Do this...
                </h3>
                <div className="space-y-3">
                  {/* Apply labels */}
                  {availableLabels.length > 0 && (
                    <div>
                      <span className="block font-mono-pulse tracking-wide-mono text-[10px] uppercase pulse-ink-3-color mb-2">Apply labels</span>
                      <div className="flex flex-wrap gap-2">
                        {availableLabels.map((label) => (
                          <button
                            key={label.id}
                            onClick={() => toggleFilterLabel(label.name)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition ${
                              editingFilter?.apply_labels?.includes(label.name)
                                ? 'pulse-rose-bg-soft-color pulse-rose-border pulse-rose-color'
                                : 'pulse-surface pulse-border-color pulse-ink-2-color hover:pulse-surface-raised'
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
                        className="w-4 h-4 rounded pulse-border-strong-color accent-[color:var(--pulse-rose)]"
                      />
                      <span className="text-sm pulse-ink-color">Mark as read</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingFilter?.archive || false}
                        onChange={(e) => setEditingFilter({ ...editingFilter, archive: e.target.checked })}
                        className="w-4 h-4 rounded pulse-border-strong-color accent-[color:var(--pulse-rose)]"
                      />
                      <span className="text-sm pulse-ink-color">Skip inbox (archive)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingFilter?.star || false}
                        onChange={(e) => setEditingFilter({ ...editingFilter, star: e.target.checked })}
                        className="w-4 h-4 rounded pulse-border-strong-color accent-[color:var(--pulse-rose)]"
                      />
                      <span className="text-sm pulse-ink-color">Star it</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingFilter?.delete || false}
                        onChange={(e) => setEditingFilter({ ...editingFilter, delete: e.target.checked })}
                        className="w-4 h-4 rounded accent-[var(--pulse-tone-overdue)]"
                        style={{ borderColor: 'var(--pulse-tone-overdue)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--pulse-tone-overdue)' }}>Delete it</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Editor Actions */}
              <div className="flex gap-3 pt-4 border-t pulse-border-color">
                <button
                  onClick={() => {
                    setEditingFilter(null);
                    setShowCreate(false);
                  }}
                  className="flex-1 px-4 py-2 pulse-surface-raised border pulse-border-color hover:pulse-border-strong-color rounded-lg pulse-ink-color font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFilter}
                  className="flex-1 px-4 py-2 pulse-rose-bg-color hover:opacity-90 rounded-lg text-white font-medium transition"
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
                  <Loader2 className="w-6 h-6 pulse-ink-3-color animate-spin" />
                </div>
              ) : filters.length === 0 ? (
                <div className="text-center py-12 pulse-ink-3-color">
                  <Filter className="w-9 h-9 mx-auto mb-4 opacity-50" />
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
                          ? 'pulse-surface pulse-border-color hover:pulse-border-strong-color'
                          : 'pulse-surface-raised pulse-border-color opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold pulse-ink-color truncate">
                              {filter.name}
                            </h4>
                            {!filter.enabled && (
                              <span className="font-mono-pulse text-[10px] uppercase tracking-wide-mono px-2 py-0.5 pulse-surface-raised pulse-ink-3-color rounded">
                                Disabled
                              </span>
                            )}
                          </div>

                          {/* When … → Then … flow */}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="font-mono-pulse text-[9.5px] uppercase tracking-wide-mono pulse-ink-3-color">When</span>
                            {filter.from_contains && (
                              <span className="font-mono-pulse text-[10.5px] px-2 py-0.5 pulse-surface-raised pulse-ink-2-color rounded">
                                from: {filter.from_contains}
                              </span>
                            )}
                            {filter.subject_contains && (
                              <span className="font-mono-pulse text-[10.5px] px-2 py-0.5 pulse-surface-raised pulse-ink-2-color rounded">
                                subject: {filter.subject_contains}
                              </span>
                            )}
                            {filter.has_attachment && (
                              <span className="font-mono-pulse text-[10.5px] px-2 py-0.5 pulse-surface-raised pulse-ink-2-color rounded">
                                has: attachment
                              </span>
                            )}
                            <span className="pulse-ink-3-color text-sm">→</span>
                            <span className="font-mono-pulse text-[9.5px] uppercase tracking-wide-mono pulse-ink-3-color">Then</span>
                            {filter.apply_labels.map((label) => (
                              <span key={label} className="font-mono-pulse text-[10.5px] px-2 py-0.5 pulse-surface-raised pulse-ink-color rounded">
                                label: {label}
                              </span>
                            ))}
                            {filter.mark_as_read && (
                              <span className="font-mono-pulse text-[10.5px] px-2 py-0.5 rounded" style={{ background: 'var(--pulse-tone-positive-soft)', color: 'var(--pulse-tone-positive)' }}>
                                mark read
                              </span>
                            )}
                            {filter.archive && (
                              <span className="font-mono-pulse text-[10.5px] px-2 py-0.5 rounded" style={{ background: 'var(--pulse-tone-warning-soft)', color: 'var(--pulse-tone-warning)' }}>
                                archive
                              </span>
                            )}
                            {filter.star && (
                              <span className="font-mono-pulse text-[10.5px] px-2 py-0.5 rounded" style={{ background: 'var(--pulse-tone-info-soft)', color: 'var(--pulse-tone-info)' }}>
                                star
                              </span>
                            )}
                            {filter.delete && (
                              <span className="font-mono-pulse text-[10.5px] px-2 py-0.5 rounded" style={{ background: 'var(--pulse-tone-overdue-soft)', color: 'var(--pulse-tone-overdue)' }}>
                                delete
                              </span>
                            )}
                          </div>

                          {/* Stats */}
                          {filter.match_count > 0 && (
                            <p className="font-mono-pulse text-[11px] pulse-ink-3-color mt-2 tnum">
                              Matched {filter.match_count} email{filter.match_count !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {/* Enable/disable toggle switch (replaces fa-toggle glyph) */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={filter.enabled}
                            onClick={() => handleToggleFilter(filter)}
                            className={`relative w-[38px] h-[22px] rounded-full border transition-colors flex-none ${
                              filter.enabled
                                ? 'border-transparent'
                                : 'pulse-surface-raised pulse-border-color'
                            }`}
                            style={filter.enabled ? { background: 'var(--pulse-tone-positive)' } : undefined}
                            title={filter.enabled ? 'Disable filter' : 'Enable filter'}
                          >
                            <span
                              className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                filter.enabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            ></span>
                          </button>
                          <button
                            onClick={() => setEditingFilter(filter)}
                            className="w-8 h-8 rounded-lg hover:pulse-surface-raised flex items-center justify-center pulse-ink-3-color hover:pulse-ink-color transition"
                            title="Edit filter"
                          >
                            <Pen className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFilter(filter.id)}
                            className="w-8 h-8 rounded-lg hover:pulse-surface-raised flex items-center justify-center pulse-ink-3-color transition hover:text-[color:var(--pulse-tone-overdue)]"
                            title="Delete filter"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 pulse-rose-bg-color hover:opacity-90 rounded-lg text-white font-medium transition"
              >
                <Plus className="w-4 h-4" />
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
