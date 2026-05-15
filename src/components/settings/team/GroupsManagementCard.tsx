import React, { useState, useEffect, useCallback } from 'react';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';
import {
  FolderTree,
  Plus,
  Loader2,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronRight,
  UserPlus,
  X,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { workspaceService, WorkspaceGroup, WorkspaceMember } from '../../../services/workspaceService';

interface Props {
  workspaceId: string;
  members: WorkspaceMember[];
  isAdmin: boolean;
}

const GROUP_COLORS = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#8b5cf6', '#ec4899', '#64748b'];

export const GroupsManagementCard: React.FC<Props> = ({ workspaceId, members, isAdmin }) => {
  const [groups, setGroups] = useState<WorkspaceGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<Record<string, string[]>>({});

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState<string>(GROUP_COLORS[0]);
  const [isSavingNew, setIsSavingNew] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState<string>(GROUP_COLORS[0]);

  const [addingMemberFor, setAddingMemberFor] = useState<string | null>(null);
  const [memberToAdd, setMemberToAdd] = useState<string>('');

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await workspaceService.getGroups(workspaceId);
      setGroups(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load groups';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const loadGroupMembers = useCallback(async (groupId: string) => {
    try {
      const ids = await workspaceService.getGroupMembers(groupId);
      setGroupMembers(prev => ({ ...prev, [groupId]: ids }));
    } catch {
      // non-fatal
    }
  }, []);

  const handleToggleExpand = (groupId: string) => {
    if (expandedId === groupId) {
      setExpandedId(null);
    } else {
      setExpandedId(groupId);
      if (!groupMembers[groupId]) loadGroupMembers(groupId);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Name is required');
      return;
    }
    setIsSavingNew(true);
    try {
      const created = await workspaceService.createGroup(workspaceId, newName, newDesc, newColor);
      setGroups(prev => [...prev, { ...created, member_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
      setCreating(false);
      setNewName('');
      setNewDesc('');
      setNewColor(GROUP_COLORS[0]);
      toast.success(`Created "${created.name}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create group';
      toast.error(msg);
    } finally {
      setIsSavingNew(false);
    }
  };

  const beginEdit = (g: WorkspaceGroup) => {
    setEditingId(g.id);
    setEditName(g.name);
    setEditDesc(g.description ?? '');
    setEditColor(g.color ?? GROUP_COLORS[0]);
  };

  const handleSaveEdit = async (g: WorkspaceGroup) => {
    if (!editName.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const updated = await workspaceService.updateGroup(g.id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        color: editColor,
      });
      setGroups(prev =>
        prev
          .map(x => (x.id === g.id ? { ...x, ...updated, member_count: x.member_count } : x))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditingId(null);
      toast.success('Group updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update group';
      toast.error(msg);
    }
  };

  const handleDelete = async (g: WorkspaceGroup) => {
    if (!confirm(`Delete the "${g.name}" group? Members will not be removed from the workspace.`)) return;
    try {
      await workspaceService.deleteGroup(g.id);
      setGroups(prev => prev.filter(x => x.id !== g.id));
      if (expandedId === g.id) setExpandedId(null);
      toast.success('Group deleted');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete group';
      toast.error(msg);
    }
  };

  const handleAddMember = async (groupId: string) => {
    if (!memberToAdd) return;
    try {
      await workspaceService.addGroupMember(groupId, memberToAdd);
      setGroupMembers(prev => ({
        ...prev,
        [groupId]: [...(prev[groupId] ?? []), memberToAdd],
      }));
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, member_count: (g.member_count ?? 0) + 1 } : g));
      setMemberToAdd('');
      setAddingMemberFor(null);
      toast.success('Added to group');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add member';
      toast.error(msg);
    }
  };

  const handleRemoveMember = async (groupId: string, userId: string) => {
    try {
      await workspaceService.removeGroupMember(groupId, userId);
      setGroupMembers(prev => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).filter(id => id !== userId),
      }));
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, member_count: Math.max(0, (g.member_count ?? 0) - 1) } : g));
      toast.success('Removed from group');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove from group';
      toast.error(msg);
    }
  };

  const memberById = (id: string): WorkspaceMember | undefined => members.find(m => m.user_id === id);

  return (
    <SettingsCard className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-zinc-500" />
          <MonoLabel>Groups &amp; departments</MonoLabel>
        </div>
        {isAdmin && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600"
          >
            <Plus className="w-3.5 h-3.5" /> New group
          </button>
        )}
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Tags for organising members. Coming soon: mention routing,
        notification rules, and channel access derived from group
        membership.
      </p>

      {/* Create form */}
      {isAdmin && creating && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Group name"
            maxLength={60}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Color:</span>
            {GROUP_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition ${newColor === c ? 'border-zinc-900 dark:border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setCreating(false); setNewName(''); setNewDesc(''); }}
              className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSavingNew || !newName.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40"
            >
              {isSavingNew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Groups list */}
      {isLoading && groups.length === 0 && (
        <div className="py-6 text-center">
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto" />
        </div>
      )}

      {!isLoading && groups.length === 0 && !creating && (
        <div className="py-8 text-center text-xs text-zinc-400">
          No groups yet.{isAdmin && ' Create one above to get started.'}
        </div>
      )}

      <div className="space-y-2">
        {groups.map((g) => {
          const isExpanded = expandedId === g.id;
          const isEditing = editingId === g.id;
          const memberIds = groupMembers[g.id] ?? [];
          const groupMemberRecords = memberIds.map(memberById).filter((m): m is WorkspaceMember => !!m);
          const availableToAdd = members.filter(m => !memberIds.includes(m.user_id));

          return (
            <div key={g.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                <button
                  type="button"
                  onClick={() => handleToggleExpand(g.id)}
                  className="flex-shrink-0 text-zinc-400"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: g.color || '#71717a' }}
                />

                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(g.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{g.name}</p>
                    {g.description && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{g.description}</p>
                    )}
                  </button>
                ) : (
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={60}
                      className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Description"
                      className="w-full px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                    <div className="flex items-center gap-1.5">
                      {GROUP_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={`w-4 h-4 rounded-full border-2 ${editColor === c ? 'border-zinc-900 dark:border-white' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <span className="text-[11px] text-zinc-400 flex-shrink-0">
                  {g.member_count ?? 0} member{(g.member_count ?? 0) === 1 ? '' : 's'}
                </span>

                {isAdmin && !isEditing && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); beginEdit(g); }}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      title="Edit"
                      aria-label="Edit group"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(g); }}
                      className="p-1 text-zinc-400 hover:text-red-500"
                      title="Delete"
                      aria-label="Delete group"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {isAdmin && isEditing && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(g)}
                      className="p-1 text-emerald-500 hover:text-emerald-600"
                      title="Save"
                      aria-label="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1 text-zinc-400 hover:text-zinc-600"
                      title="Cancel"
                      aria-label="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded body */}
              {isExpanded && (
                <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 space-y-2 bg-zinc-50/50 dark:bg-zinc-800/20">
                  {groupMemberRecords.length === 0 && (
                    <p className="text-[11px] text-zinc-400 text-center py-2">No members in this group yet.</p>
                  )}
                  {groupMemberRecords.map(m => (
                    <div key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 bg-white dark:bg-zinc-900 rounded">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : (m.name || m.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-zinc-700 dark:text-zinc-300 flex-1 truncate">
                        {m.name || m.email || m.user_id.slice(0, 8)}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(g.id, m.user_id)}
                          className="p-1 text-zinc-400 hover:text-red-500"
                          title="Remove from group"
                          aria-label="Remove from group"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {isAdmin && (
                    <div className="pt-1">
                      {addingMemberFor === g.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={memberToAdd}
                            onChange={(e) => setMemberToAdd(e.target.value)}
                            aria-label="Member to add"
                            className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                          >
                            <option value="">Select a member...</option>
                            {availableToAdd.map(m => (
                              <option key={m.user_id} value={m.user_id}>
                                {m.name || m.email || m.user_id.slice(0, 8)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAddMember(g.id)}
                            disabled={!memberToAdd}
                            className="px-2 py-1 text-xs font-semibold text-white bg-rose-500 rounded disabled:opacity-40"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => { setAddingMemberFor(null); setMemberToAdd(''); }}
                            className="text-xs text-zinc-400 hover:text-zinc-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        availableToAdd.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAddingMemberFor(g.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600"
                          >
                            <UserPlus className="w-3 h-3" /> Add member
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SettingsCard>
  );
};
