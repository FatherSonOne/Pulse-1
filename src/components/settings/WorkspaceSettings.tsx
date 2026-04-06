import React, { useState } from 'react';
import { AlertTriangle, Building2, Archive, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspaceData, useWorkspaceActions, useWorkspacePermissions } from '../../contexts/WorkspaceContext';
import { DeleteWorkspaceDialog } from './DeleteWorkspaceDialog';

export const WorkspaceSettings: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const { softDeleteWorkspace, hardDeleteWorkspace, updateWorkspace } = useWorkspaceActions();
  const { isOwner, isAdmin } = useWorkspacePermissions();

  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit state
  const [name, setName] = useState(currentWorkspace?.name ?? '');
  const [description, setDescription] = useState(currentWorkspace?.description ?? '');
  const [isSaving, setIsSaving] = useState(false);

  if (!currentWorkspace) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm p-6">
        No workspace selected.
      </div>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Workspace name is required');
      return;
    }
    setIsSaving(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      toast.success('Workspace updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update workspace');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteMode) return;
    setIsDeleting(true);
    const toastId = toast.loading(
      deleteMode === 'soft' ? 'Archiving workspace...' : 'Permanently deleting workspace...',
    );
    try {
      if (deleteMode === 'soft') {
        await softDeleteWorkspace(currentWorkspace.id);
        toast.success('Workspace archived. You have 30 days to restore it.', { id: toastId });
      } else {
        await hardDeleteWorkspace(currentWorkspace.id);
        toast.success('Workspace permanently deleted.', { id: toastId });
      }
      setDeleteMode(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workspace', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Workspace info */}
      <div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-rose-500" />
          Workspace
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage your workspace name, description, and lifecycle.
        </p>
      </div>

      {/* Edit fields */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!isAdmin}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
        </div>
        {isAdmin && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving || name.trim() === currentWorkspace.name && (description.trim() || '') === (currentWorkspace.description || '')}
              className="px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone — only for owner/admin */}
      {isAdmin && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Danger Zone</h4>
          </div>

          <p className="text-xs text-red-600/80 dark:text-red-400/80">
            Archiving hides the workspace from all members. The owner has 30 days to restore it before
            data becomes eligible for permanent deletion.
          </p>

          <div className="flex flex-wrap gap-3">
            {/* Archive — owner + admin */}
            <button
              onClick={() => setDeleteMode('soft')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
            >
              <Archive className="w-4 h-4" />
              Archive Workspace
            </button>

            {/* Permanent delete — owner only */}
            {isOwner && (
              <button
                onClick={() => setDeleteMode('hard')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
                Permanently Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {deleteMode && (
        <DeleteWorkspaceDialog
          workspaceName={currentWorkspace.name}
          mode={deleteMode}
          isOpen={true}
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteMode(null)}
        />
      )}
    </div>
  );
};
