import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspaceActions } from '../../contexts/WorkspaceContext';
import { Workspace } from '../../services/workspaceService';
import { DeleteWorkspaceDialog } from './DeleteWorkspaceDialog';

interface DeletedWorkspaceInterstitialProps {
  deletedWorkspaces: Workspace[];
  onCreateNew: () => void;
}

export const DeletedWorkspaceInterstitial: React.FC<DeletedWorkspaceInterstitialProps> = ({
  deletedWorkspaces,
  onCreateNew,
}) => {
  const { restoreWorkspace, hardDeleteWorkspace } = useWorkspaceActions();
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Workspace | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRestore = async (workspace: Workspace) => {
    setIsRestoring(workspace.id);
    const toastId = toast.loading(`Restoring "${workspace.name}"...`);
    try {
      await restoreWorkspace(workspace.id);
      toast.success(`"${workspace.name}" has been restored!`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore workspace', { id: toastId });
    } finally {
      setIsRestoring(null);
    }
  };

  const handleHardDelete = async () => {
    if (!hardDeleteTarget) return;
    setIsDeleting(true);
    const toastId = toast.loading(`Permanently deleting "${hardDeleteTarget.name}"...`);
    try {
      await hardDeleteWorkspace(hardDeleteTarget.id);
      toast.success(`"${hardDeleteTarget.name}" has been permanently deleted.`, { id: toastId });
      setHardDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workspace', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateNew = async () => {
    // If there are deleted workspaces, hard-delete them first to clean up, then show create wizard
    for (const ws of deletedWorkspaces) {
      try {
        await hardDeleteWorkspace(ws.id);
      } catch {
        // Continue — best effort cleanup
      }
    }
    onCreateNew();
  };

  const getDaysRemaining = (deletedAt: string) => {
    const deleted = new Date(deletedAt);
    const expiry = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Your workspace was archived
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            You can restore it, create a fresh workspace, or permanently delete it.
          </p>
        </div>

        {/* Deleted workspace cards */}
        <div className="space-y-3">
          {deletedWorkspaces.map((ws) => {
            const daysLeft = getDaysRemaining(ws.deleted_at!);
            return (
              <div
                key={ws.id}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white">{ws.name}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Archived on {new Date(ws.deleted_at!).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    daysLeft <= 7
                      ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                  }`}>
                    {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRestore(ws)}
                    disabled={isRestoring === ws.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {isRestoring === ws.id ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    onClick={() => setHardDeleteTarget(ws)}
                    className="px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create new workspace */}
        <button
          onClick={handleCreateNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          Start Fresh — Create New Workspace
        </button>

        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          Creating a new workspace will permanently delete any archived workspaces.
        </p>
      </div>

      {/* Hard delete confirmation dialog */}
      {hardDeleteTarget && (
        <DeleteWorkspaceDialog
          workspaceName={hardDeleteTarget.name}
          mode="hard"
          isOpen={true}
          isLoading={isDeleting}
          onConfirm={handleHardDelete}
          onCancel={() => setHardDeleteTarget(null)}
        />
      )}
    </div>
  );
};
