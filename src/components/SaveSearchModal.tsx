import React, { useState } from 'react';
import { X, Bookmark } from 'lucide-react';
import { savedSearchesService } from '../services/savedSearches';
import { SearchFilters } from '../services/unifiedSearchService';

interface SaveSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  filters: SearchFilters;
  userId: string;
  onSaved?: () => void;
}

export const SaveSearchModal: React.FC<SaveSearchModalProps> = ({
  isOpen,
  onClose,
  query,
  filters,
  userId,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertFrequency, setAlertFrequency] = useState<'daily' | 'weekly' | 'instant'>('daily');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a name for this search.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await savedSearchesService.createSavedSearch(userId, {
        name: name.trim(),
        query,
        filters,
        alertEnabled,
        alertFrequency,
      });
      setName('');
      setAlertEnabled(false);
      onSaved?.();
      onClose();
    } catch (err) {
      setError('Failed to save search. Please try again.');
      console.error('SaveSearchModal:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Save search"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <Bookmark size={18} className="text-pink-500" />
            <h2 className="text-lg font-semibold">Save Search</h2>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 font-mono truncate">
          "{query}"
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              autoFocus
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-pink-400"
              placeholder="e.g. Invoices from Alice"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="alert-toggle"
              checked={alertEnabled}
              onChange={e => setAlertEnabled(e.target.checked)}
              className="w-4 h-4 accent-pink-500"
            />
            <label htmlFor="alert-toggle" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              Enable alerts for new results
            </label>
          </div>

          {alertEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alert frequency
              </label>
              <select
                value={alertFrequency}
                onChange={e => setAlertFrequency(e.target.value as typeof alertFrequency)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="instant">Instant</option>
                <option value="daily">Daily digest</option>
                <option value="weekly">Weekly digest</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? 'Saving…' : 'Save Search'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveSearchModal;
