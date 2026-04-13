import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, Building2, Archive, Trash2, Camera, Loader2, ArrowRightLeft, ScrollText, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkspaceData, useWorkspaceActions, useWorkspacePermissions } from '../../contexts/WorkspaceContext';
import { workspaceService, AuditLogEntry } from '../../services/workspaceService';
import { DeleteWorkspaceDialog } from './DeleteWorkspaceDialog';
import { supabase } from '../../services/supabase';

export const WorkspaceSettings: React.FC = () => {
  const { currentWorkspace, members } = useWorkspaceData();
  const { softDeleteWorkspace, hardDeleteWorkspace, updateWorkspace, refreshWorkspaces, refreshMembers } = useWorkspaceActions();
  const { isOwner, isAdmin } = useWorkspacePermissions();

  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit state
  const [name, setName] = useState(currentWorkspace?.name ?? '');
  const [description, setDescription] = useState(currentWorkspace?.description ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Audit log state
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const loadAuditLog = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoadingAudit(true);
    try {
      const entries = await workspaceService.getAuditLog(currentWorkspace.id);
      setAuditLog(entries);
    } catch {
      // non-fatal
    } finally {
      setIsLoadingAudit(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (showAuditLog) loadAuditLog();
  }, [showAuditLog, loadAuditLog]);

  if (!currentWorkspace) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm p-6">
        No workspace selected.
      </div>
    );
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorkspace) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${currentWorkspace.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('workspace-avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('workspace-avatars')
        .getPublicUrl(path);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await updateWorkspace(currentWorkspace.id, { avatar_url: avatarUrl });
      toast.success('Avatar updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload avatar';
      toast.error(msg);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update workspace';
      toast.error(msg);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete workspace';
      toast.error(msg, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferTargetId || !currentWorkspace) return;
    const target = members.find(m => m.user_id === transferTargetId);
    if (!confirm(`Transfer ownership of "${currentWorkspace.name}" to ${target?.name || 'this member'}? You will be demoted to admin.`)) return;

    setIsTransferring(true);
    try {
      await workspaceService.transferOwnership(currentWorkspace.id, transferTargetId);
      toast.success('Ownership transferred');
      setShowTransfer(false);
      setTransferTargetId('');
      await Promise.all([refreshWorkspaces(), refreshMembers()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to transfer ownership';
      toast.error(msg);
    } finally {
      setIsTransferring(false);
    }
  };

  const nonOwnerMembers = members.filter(m => m.role !== 'owner');

  const formatAction = (action: string) => action.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase());

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

      {/* Avatar + Edit fields */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold overflow-hidden">
              {currentWorkspace.avatar_url ? (
                <img src={currentWorkspace.avatar_url} alt={currentWorkspace.name} className="w-full h-full object-cover" />
              ) : (
                currentWorkspace.name.charAt(0).toUpperCase()
              )}
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-xl transition"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </button>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              aria-label="Upload workspace avatar"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-900 dark:text-white">{currentWorkspace.name}</p>
            <p className="text-xs text-zinc-500">{currentWorkspace.slug ? `slug: ${currentWorkspace.slug}` : 'Workspace'}</p>
          </div>
        </div>

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
              type="button"
              onClick={handleSave}
              disabled={isSaving || (name.trim() === currentWorkspace.name && (description.trim() || '') === (currentWorkspace.description || ''))}
              className="px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Transfer Ownership — owner only */}
      {isOwner && nonOwnerMembers.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-zinc-500" />
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Transfer Ownership</h4>
            </div>
            <button
              type="button"
              onClick={() => setShowTransfer(!showTransfer)}
              className="text-xs text-rose-500 hover:text-rose-600 font-medium"
            >
              {showTransfer ? 'Cancel' : 'Transfer'}
            </button>
          </div>
          {showTransfer && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Transfer ownership to another member. You will become an admin.
              </p>
              <select
                value={transferTargetId}
                onChange={(e) => setTransferTargetId(e.target.value)}
                aria-label="New owner"
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              >
                <option value="">Select a member...</option>
                {nonOwnerMembers.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name || m.email || m.user_id} ({m.role})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={!transferTargetId || isTransferring}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-40"
              >
                {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Audit Log — admin+ */}
      {isAdmin && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAuditLog(!showAuditLog)}
            className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
          >
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-zinc-500" />
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Audit Log</h4>
            </div>
            <span className="text-xs text-zinc-400">{showAuditLog ? 'Hide' : 'Show'}</span>
          </button>
          {showAuditLog && (
            <div className="border-t border-zinc-200 dark:border-zinc-700 max-h-80 overflow-y-auto">
              {isLoadingAudit ? (
                <div className="p-6 text-center">
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto" />
                </div>
              ) : auditLog.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">No audit entries yet.</div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {auditLog.map(entry => (
                    <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                      <Clock className="w-3.5 h-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-700 dark:text-zinc-300">
                          <span className="font-medium">{formatAction(entry.action)}</span>
                          {entry.target_id && (
                            <span className="text-zinc-400"> &middot; {entry.target_id.slice(0, 8)}...</span>
                          )}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          {new Date(entry.created_at).toLocaleString()} &middot; by {entry.actor_id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
            <button
              type="button"
              onClick={() => setDeleteMode('soft')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
            >
              <Archive className="w-4 h-4" />
              Archive Workspace
            </button>

            {isOwner && (
              <button
                type="button"
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
