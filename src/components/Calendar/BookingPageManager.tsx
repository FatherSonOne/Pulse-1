/**
 * BookingPageManager.tsx
 * Manage booking pages inside CalendarSettingsPanel.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Copy, Check, Trash2, RefreshCw, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  BookingPage,
  BookingPageConfig,
  getMyBookingPages,
  createBookingPage,
  updateBookingPage,
  deleteBookingPage,
} from '../../services/bookingPageService';

const DURATIONS = [15, 30, 45, 60, 90, 120];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

interface CreateFormState {
  title: string;
  slug: string;
  description: string;
  duration_minutes: number;
  video_type: BookingPage['video_type'];
  days: number[];
  start: string;
  end: string;
}

const DEFAULT_FORM: CreateFormState = {
  title: '',
  slug: '',
  description: '',
  duration_minutes: 30,
  video_type: 'pulse',
  days: [1, 2, 3, 4, 5],
  start: '09:00',
  end: '17:00',
};

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export const BookingPageManager: React.FC = () => {
  const [pages, setPages]           = useState<BookingPage[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState<CreateFormState>(DEFAULT_FORM);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [copiedId, setCopiedId]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setPages(await getMyBookingPages()); }
    catch { /* tables not migrated yet */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleTitleChange(title: string) {
    setForm(prev => ({
      ...prev,
      title,
      slug: prev.slug || slugify(title),
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.slug.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const config: BookingPageConfig = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        duration_minutes: form.duration_minutes,
        video_type: form.video_type,
        availability_windows: form.days.map(d => ({ day: d, start: form.start, end: form.end })),
      };
      const page = await createBookingPage(config);
      setPages(prev => [page, ...prev]);
      setShowCreate(false);
      setForm(DEFAULT_FORM);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    await updateBookingPage(id, { is_active: !isActive });
    setPages(prev => prev.map(p => p.id === id ? { ...p, is_active: !isActive } : p));
  }

  async function handleDelete(id: string) {
    await deleteBookingPage(id);
    setPages(prev => prev.filter(p => p.id !== id));
  }

  function handleCopy(slug: string, id: string) {
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) return <div className="py-6 text-center text-zinc-400 text-sm">Loading booking pages…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--pulse-ink-2)] uppercase tracking-wide">Booking Pages</h3>
        <button type="button" onClick={() => setShowCreate(s => !s)} className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 font-medium transition">
          <Plus className="w-3.5 h-3.5" /> New page
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-[var(--pulse-canvas-soft)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-xl p-4 space-y-3">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Title</label>
            <input type="text" required value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder="30-minute intro call"
              className="w-full bg-[var(--pulse-surface)] dark:bg-[var(--pulse-canvas)] border border-[var(--pulse-border-strong)] rounded-lg px-3 py-2 text-sm dark:text-white outline-none focus:border-rose-400 transition" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">URL slug</label>
            <div className="flex items-center">
              <span className="text-xs text-zinc-400 bg-[var(--pulse-surface-raised)] dark:bg-[var(--pulse-surface-raised)] border border-r-0 border-[var(--pulse-border-strong)] rounded-l-lg px-2 py-2 whitespace-nowrap">/book/</span>
              <input type="text" required minLength={3} maxLength={60} pattern="[a-z0-9-]+" value={form.slug} onChange={e => setForm(p => ({ ...p, slug: slugify(e.target.value) }))} placeholder="intro-call"
                className="flex-1 bg-[var(--pulse-surface)] dark:bg-[var(--pulse-canvas)] border border-[var(--pulse-border-strong)] rounded-r-lg px-3 py-2 text-sm dark:text-white outline-none focus:border-rose-400 transition" />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Duration</label>
            <div className="flex gap-2 flex-wrap">
              {DURATIONS.map(d => (
                <button key={d} type="button" onClick={() => setForm(p => ({ ...p, duration_minutes: d }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${form.duration_minutes === d ? 'bg-rose-500 border-rose-500 text-white' : 'border-[var(--pulse-border-strong)] text-[var(--pulse-ink-2)] hover:border-rose-300'}`}>
                  {d}m
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Available days</label>
            <div className="flex gap-1.5">
              {DAYS.map((day, i) => (
                <button key={i} type="button" onClick={() => setForm(p => ({ ...p, days: p.days.includes(i) ? p.days.filter(d => d !== i) : [...p.days, i] }))}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition ${form.days.includes(i) ? 'bg-rose-500 text-white' : 'bg-[var(--pulse-surface-raised)] dark:bg-[var(--pulse-surface-raised)] text-zinc-500 hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-[var(--pulse-surface-raised)]'}`}>
                  {day[0]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Start time</label>
              <input type="time" aria-label="Availability start time" value={form.start} onChange={e => setForm(p => ({ ...p, start: e.target.value }))}
                className="w-full bg-[var(--pulse-surface)] dark:bg-[var(--pulse-canvas)] border border-[var(--pulse-border-strong)] rounded-lg px-3 py-2 text-sm dark:text-white outline-none focus:border-rose-400 transition" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">End time</label>
              <input type="time" aria-label="Availability end time" value={form.end} onChange={e => setForm(p => ({ ...p, end: e.target.value }))}
                className="w-full bg-[var(--pulse-surface)] dark:bg-[var(--pulse-canvas)] border border-[var(--pulse-border-strong)] rounded-lg px-3 py-2 text-sm dark:text-white outline-none focus:border-rose-400 transition" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { setShowCreate(false); setForm(DEFAULT_FORM); }} className="flex-1 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {/* Pages list */}
      {pages.length === 0 && !showCreate ? (
        <div className="text-center py-6 text-zinc-400 text-sm">
          No booking pages yet. Create one to let others schedule time with you.
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map(page => (
            <div key={page.id} className="flex items-center gap-3 p-3 bg-[var(--pulse-canvas-soft)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-xl group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{page.title}</span>
                  <span className="text-[10px] text-zinc-400">{page.duration_minutes}m</span>
                  {!page.is_active && <span className="text-[10px] bg-[var(--pulse-surface-raised)] dark:bg-[var(--pulse-surface-raised)] text-zinc-500 px-1.5 py-0.5 rounded">Inactive</span>}
                </div>
                <div className="text-xs text-zinc-400 font-mono truncate">/book/{page.slug}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button type="button" onClick={() => handleCopy(page.slug, page.id)} title="Copy link" className="p-1.5 text-zinc-400 hover:text-rose-500 transition rounded">
                  {copiedId === page.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a href={`/book/${page.slug}`} target="_blank" rel="noopener noreferrer" title="Open booking page" className="p-1.5 text-zinc-400 hover:text-rose-500 transition rounded">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button type="button" onClick={() => void handleToggle(page.id, page.is_active)} title={page.is_active ? 'Deactivate' : 'Activate'} className="p-1.5 text-zinc-400 hover:text-rose-500 transition rounded">
                  {page.is_active ? <ToggleRight className="w-4 h-4 text-rose-500" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button type="button" onClick={() => void handleDelete(page.id)} title="Delete" className="p-1.5 text-zinc-400 hover:text-red-500 transition rounded opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingPageManager;
