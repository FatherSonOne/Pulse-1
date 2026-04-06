import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteWorkspaceDialogProps {
  workspaceName: string;
  mode: 'soft' | 'hard';
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteWorkspaceDialog: React.FC<DeleteWorkspaceDialogProps> = ({
  workspaceName,
  mode,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen) return null;

  const isSoft = mode === 'soft';
  const requiredText = workspaceName;
  const isConfirmed = confirmText === requiredText;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full border border-zinc-200 dark:border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isSoft ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              <AlertTriangle className={`w-5 h-5 ${
                isSoft ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              {isSoft ? 'Archive Workspace' : 'Permanently Delete Workspace'}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {isSoft ? (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                This will archive <strong className="text-zinc-900 dark:text-white">{workspaceName}</strong> and
                hide it from all members. You have <strong>30 days</strong> to restore it before it becomes
                eligible for permanent deletion.
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Members will lose access immediately. Invites will stop working. All data is preserved during the recovery window.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                This will <strong className="text-red-600 dark:text-red-400">permanently delete</strong>{' '}
                <strong className="text-zinc-900 dark:text-white">{workspaceName}</strong> and all associated
                data including members, invites, and workspace settings.
              </p>
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg p-3">
                <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                  This action cannot be undone. All data will be permanently removed.
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Type <strong className="font-mono text-zinc-900 dark:text-white">{requiredText}</strong> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={requiredText}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              autoFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmed || isLoading}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
              isSoft
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isLoading
              ? (isSoft ? 'Archiving...' : 'Deleting...')
              : (isSoft ? 'Archive Workspace' : 'Delete Permanently')}
          </button>
        </div>
      </div>
    </div>
  );
};
