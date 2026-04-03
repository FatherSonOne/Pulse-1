/**
 * SharedCalendarPanel.tsx
 *
 * Renders the "Team Calendars" section in the calendar sidebar.
 * Shows each team calendar with a visibility toggle, member count,
 * and owner-only gear/create controls.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Settings, Lock, RefreshCw, Trash2, X } from 'lucide-react';
import {
  TeamCalendar,
  getMyTeamCalendars,
  createTeamCalendar,
  updateTeamCalendar,
  deleteCalendar,
} from '../../services/sharedCalendarService';

// ── Color palette for new calendars ──────────────────────────────────────────

const CAL_COLORS = [
  '#f43f5e', '#ec4899', '#8b5cf6', '#6366f1',
  '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b',
];

// ── Create calendar modal ─────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreated: (cal: TeamCalendar) => void;
}

const CreateCalendarModal: React.FC<CreateModalProps> = ({ onClose, onCreated }) => {
  const [name, setName]           = useState('');
  const [color, setColor]         = useState(CAL_COLORS[0]);
  const [description, setDesc]    = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const cal = await createTeamCalendar(name.trim(), color, [], description.trim() || undefined);
      onCreated(cal);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl animate-scale-in">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-base font-bold dark:text-white">New Team Calendar</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Marketing Calendar"
              required
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm dark:text-white outline-none focus:border-rose-400 transition"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {CAL_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition ring-offset-2 ${color === c ? 'ring-2 ring-rose-500' : 'ring-transparent hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="What's this calendar for?"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm dark:text-white outline-none focus:border-rose-400 transition"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main panel ────────────────────────────────────────────────────────────────

interface SharedCalendarPanelProps {
  visibleCalendars: Set<string>;
  toggleCalendarVisibility: (id: string) => void;
}

export const SharedCalendarPanel: React.FC<SharedCalendarPanelProps> = ({
  visibleCalendars,
  toggleCalendarVisibility,
}) => {
  const [calendars, setCalendars]   = useState<TeamCalendar[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCalId, setEditingCalId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const cals = await getMyTeamCalendars();
      setCalendars(cals);
    } catch {
      // Silently fail if tables don't exist yet (migration not run)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSaveEdit() {
    if (!editingCalId || !editName.trim()) return;
    setEditSaving(true);
    try {
      await updateTeamCalendar(editingCalId, { name: editName.trim() });
      setCalendars(prev => prev.map(c => c.id === editingCalId ? { ...c, name: editName.trim() } : c));
      setEditingCalId(null);
    } catch { /* ignore */ }
    finally { setEditSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteCalendar(id);
      setCalendars(prev => prev.filter(c => c.id !== id));
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return null; // Seamless — don't show skeleton in sidebar
  if (calendars.length === 0 && !showCreate) {
    return (
      <div className="mb-4 lg:mb-6">
        <div className="flex items-center justify-between mb-2 lg:mb-3">
          <h3 className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest">Team Calendars</h3>
          <button
            onClick={() => setShowCreate(true)}
            className="text-rose-400 hover:text-rose-500 transition flex-shrink-0"
            title="Create Team Calendar"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        {showCreate && (
          <CreateCalendarModal
            onClose={() => setShowCreate(false)}
            onCreated={cal => { setCalendars([cal]); setShowCreate(false); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mb-4 lg:mb-6">
      <div className="flex items-center justify-between mb-2 lg:mb-3">
        <h3 className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest">Team Calendars</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="text-rose-400 hover:text-rose-500 transition flex-shrink-0"
          title="Create Team Calendar"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-1">
        {calendars.map(cal => (
          <div key={cal.id} className="flex items-center gap-2 group py-0.5">
            {/* Color dot + visibility toggle */}
            <label className="flex items-center gap-1.5 flex-1 min-w-0 text-xs lg:text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
              <input
                type="checkbox"
                checked={visibleCalendars.has(cal.id)}
                onChange={() => toggleCalendarVisibility(cal.id)}
                className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-700 transition flex-shrink-0"
                style={{ accentColor: cal.color }}
              />
              <span className="truncate group-hover:text-zinc-900 dark:group-hover:text-white transition">
                {cal.name}
              </span>
            </label>

            {/* Role indicator */}
            {cal.my_role === 'viewer' && (
              <span title="View only"><Lock className="w-3 h-3 text-zinc-300 flex-shrink-0" aria-hidden="true" /></span>
            )}

            {/* Owner controls */}
            {cal.my_role === 'owner' && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  type="button"
                  onClick={() => { setEditingCalId(cal.id); setEditName(cal.name); }}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
                  title="Manage calendar"
                >
                  <Settings className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(cal.id)}
                  disabled={deletingId === cal.id}
                  className="text-zinc-400 hover:text-red-500 transition disabled:opacity-40"
                  title="Delete calendar"
                >
                  {deletingId === cal.id
                    ? <RefreshCw className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Inline rename editor */}
      {editingCalId && (
        <div className="mt-2 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          <label className="text-[10px] text-zinc-400 uppercase tracking-wider">Rename Calendar</label>
          <div className="flex gap-1.5 mt-1">
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingCalId(null); }}
              placeholder="Calendar name"
              className="flex-1 px-2 py-1 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded"
              autoFocus
            />
            <button type="button" onClick={handleSaveEdit} disabled={editSaving || !editName.trim()} className="px-2 py-1 text-xs bg-rose-500 text-white rounded disabled:opacity-50">
              {editSaving ? '…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditingCalId(null)} title="Cancel rename" className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateCalendarModal
          onClose={() => setShowCreate(false)}
          onCreated={cal => { setCalendars(prev => [...prev, cal]); setShowCreate(false); }}
        />
      )}
    </div>
  );
};

export default SharedCalendarPanel;
