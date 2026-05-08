// src/components/Archives/ArchiveSidebar.tsx
// Sidebar with header, search, filters, collections, smart folders, bulk actions, and item views

import React, { useEffect, useRef, useState } from 'react';
import { Activity, Download, Filter, Folder, FolderPlus, GripHorizontal, HardDrive, HelpCircle, Inbox, List, Loader2, Plus, Search, Tags, Trash2, Wand2 } from 'lucide-react';
import { importAllSources, totalsOf } from '../../services/memoryIngestService';
import toast from 'react-hot-toast';
import type { ArchiveItem, ArchiveType } from '../../types';
import { useArchiveStore } from '../../store/archiveStore';
import { ArchiveListView } from './ArchiveListView';
import { ArchiveGridView } from './ArchiveGridView';
import { ArchiveTimelineView } from './ArchiveTimelineView';

// Ordered for the operator's frequency: conversation streams first, then derivatives, then media.
const filterOptions: Array<ArchiveType | 'all' | 'starred'> = [
  'all',
  'starred',
  'message',
  'email',
  'relay_message',
  'relay_note',
  'relay_live',
  'glimpse',
  'meeting_note',
  'transcript',
  'decision_log',
  'summary',
  'journal',
  'war_room_session',
  'artifact',
  'document',
  'image',
  'video',
];

const getFilterLabel = (filter: ArchiveType | 'all' | 'starred') => {
  switch (filter) {
    case 'all': return 'All';
    case 'starred': return 'Starred';
    case 'message': return 'Messages';
    case 'email': return 'Email';
    case 'relay_message': return 'Relay Voice Messages';
    case 'relay_note': return 'Relay Voice Notes';
    case 'relay_live': return 'Relay Live Calls';
    case 'glimpse': return 'Video Glimpses';
    case 'transcript': return 'Transcript';
    case 'meeting_note': return 'Meetings';
    case 'vox_transcript': return 'Vox Transcripts';
    case 'decision_log': return 'Decisions';
    case 'journal': return 'Journal';
    case 'summary': return 'AI Summaries';
    case 'artifact': return 'Artifact';
    case 'image': return 'Image';
    case 'video': return 'Video';
    case 'document': return 'Document';
    case 'war_room_session': return 'War Room Sessions';
    default: return filter;
  }
};

const getFilterShortLabel = (filter: ArchiveType | 'all' | 'starred') => {
  switch (filter) {
    case 'all': return 'All';
    case 'starred': return 'Starred';
    case 'message': return 'SMS';
    case 'email': return 'Email';
    case 'relay_message': return 'Voice';
    case 'relay_note': return 'Notes';
    case 'relay_live': return 'Live';
    case 'glimpse': return 'Glimpse';
    case 'transcript': return 'Script';
    case 'meeting_note': return 'Meeting';
    case 'vox_transcript': return 'Vox';
    case 'decision_log': return 'Decision';
    case 'journal': return 'Journal';
    case 'summary': return 'Summary';
    case 'artifact': return 'Artifact';
    case 'image': return 'Image';
    case 'video': return 'Video';
    case 'document': return 'Doc';
    case 'war_room_session': return 'War Room';
    default: return filter;
  }
};

interface ArchiveSidebarProps {
  onOpenShortcuts?: () => void;
}

export const ArchiveSidebar: React.FC<ArchiveSidebarProps> = ({ onOpenShortcuts }) => {
  const [importing, setImporting] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Bulk delete with undo — calls the store's deferred-commit primitive then renders
  // a toast with an Undo button. After 5s without undo, commit fires the actual delete.
  const handleBulkDeleteWithUndo = async () => {
    const { handleBulkDelete } = useArchiveStore.getState();
    await handleBulkDelete();
    const pending = (window as any).__pulseMemoryBulkDelete as
      | { count: number; undo: () => boolean; commit: () => Promise<void> }
      | undefined;
    if (!pending) return;

    const toastId = toast.custom(
      (t) => (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white shadow-2xl border border-white/[0.08] min-w-[280px]">
          <Trash2 className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span className="text-sm flex-1">
            Deleted <span className="font-mono tabular-nums">{pending.count}</span>{' '}
            item{pending.count === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => {
              if (pending.undo()) {
                toast.success('Restored', { id: toastId });
              }
            }}
            className="text-xs font-mono uppercase tracking-[0.12em] text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 rounded hover:bg-white/[0.05]"
          >
            Undo
          </button>
        </div>
      ),
      { duration: 5000 },
    );

    // Schedule the actual commit after 5 seconds
    setTimeout(async () => {
      try {
        await pending.commit();
      } catch (err) {
        toast.error(`Delete failed: ${(err as Error)?.message || 'unknown error'}`);
      } finally {
        delete (window as any).__pulseMemoryBulkDelete;
      }
    }, 5000);
  };

  const handleImportPast = async () => {
    if (importing) return;
    setImporting(true);
    const t = toast.loading('Importing past conversations from all Pulse sources...');
    try {
      const result = await importAllSources(90);
      const total = totalsOf(result);
      // Build a per-source breakdown for the toast
      const breakdown = (Object.entries(result) as [keyof typeof result, typeof total][])
        .filter(([, r]) => r.attempted > 0)
        .map(([key, r]) => `${key.replace(/_/g, ' ')} ${r.inserted}/${r.attempted}`)
        .join(' · ');
      const headline =
        total.attempted === 0
          ? 'No conversations found across any source'
          : `Imported ${total.inserted} new${total.skipped > 0 ? `, ${total.skipped} already in memory` : ''}${total.errors > 0 ? `, ${total.errors} failed` : ''}`;
      if (breakdown) {
        toast.success(`${headline}\n${breakdown}`, { id: t, duration: 6000 });
      } else {
        toast.success(headline, { id: t });
      }
      // Refresh the store so new items appear
      await useArchiveStore.getState().refreshData();
    } catch (err) {
      toast.error(`Import failed: ${(err as Error)?.message || 'unknown error'}`, { id: t });
    } finally {
      setImporting(false);
    }
  };

  const {
    items,
    collections,
    smartFolders,
    selectedItem,
    selectedItems,
    loading,
    viewMode,
    sidebarMode,
    activeFilter,
    activeCollectionId,
    activeSmartFolderId,
    query,
    driveConnected,
    demoMode,
    setViewMode,
    setSidebarMode,
    setActiveFilter,
    setActiveCollectionId,
    setActiveSmartFolderId,
    setQuery,
    openModal,
    handleBulkDelete,
    handleBulkExport,
    clearSelection,
    selectAll,
    toggleSelectItem,
    loadMore,
    loadingMore,
    hasMore,
    seedDemoData,
    clearDemoData,
  } = useArchiveStore();

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleSelectAll = () => {
    selectAll();
  };

  // Group items by date for list view
  const groupedItems = items.reduce((acc, item) => {
    const dateKey = item.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, ArchiveItem[]>);

  // Type counts power the progressive filter disclosure — top types by frequency
  // get pinned to the primary row; the rest hide behind a "More" toggle.
  const typeCounts = React.useMemo(() => {
    const counts = new Map<ArchiveType, number>();
    items.forEach(i => counts.set(i.type, (counts.get(i.type) || 0) + 1));
    return counts;
  }, [items]);

  const PRIMARY_FILTER_COUNT = 5;
  const { primaryFilters, secondaryFilters } = React.useMemo(() => {
    const types = filterOptions.filter((f): f is ArchiveType => f !== 'all' && f !== 'starred');
    const ranked = types.slice().sort((a, b) => (typeCounts.get(b) || 0) - (typeCounts.get(a) || 0));
    const top = ranked.slice(0, PRIMARY_FILTER_COUNT);
    const rest = ranked.slice(PRIMARY_FILTER_COUNT);
    // If the active filter isn't in `top`, keep it visible by promoting it
    if (activeFilter !== 'all' && activeFilter !== 'starred' && !top.includes(activeFilter as ArchiveType)) {
      top.unshift(activeFilter as ArchiveType);
      const idx = rest.indexOf(activeFilter as ArchiveType);
      if (idx >= 0) rest.splice(idx, 1);
    }
    return {
      primaryFilters: ['all' as const, 'starred' as const, ...top],
      secondaryFilters: rest,
    };
  }, [typeCounts, activeFilter]);

  return (
    <div className={`w-full md:w-[420px] flex flex-col border-r border-zinc-200 dark:border-zinc-800 relative ${selectedItem ? 'hidden md:flex' : 'flex'}`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border border-rose-500/60 flex items-center justify-center relative" aria-hidden>
              <span className="text-[11px] font-mono font-medium text-rose-500 tracking-tight">M</span>
            </div>
            <div>
              <h2 className="text-lg font-light text-zinc-900 dark:text-zinc-50 tracking-wide">Memory</h2>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono uppercase tracking-widest">
                {items.length} item{items.length === 1 ? '' : 's'}
                {demoMode ? (
                  <>
                    {' · '}
                    <span className="text-rose-500 dark:text-rose-400">demo</span>
                    {' · '}
                    <button
                      onClick={() => clearDemoData()}
                      className="underline decoration-dotted underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                    >
                      clear
                    </button>
                  </>
                ) : (
                  ' · every word, every voice'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* View mode buttons */}
            <button
              onClick={() => setViewMode('list')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${viewMode === 'list' ? 'bg-rose-500/[0.10] text-rose-500 dark:text-rose-400' : 'bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              title="List view"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${viewMode === 'grid' ? 'bg-rose-500/[0.10] text-rose-500 dark:text-rose-400' : 'bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              title="Grid view"
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <GripHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${viewMode === 'timeline' ? 'bg-rose-500/[0.10] text-rose-500 dark:text-rose-400' : 'bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-100'}`}
              title="Timeline view"
              aria-label="Timeline view"
              aria-pressed={viewMode === 'timeline'}
            >
              <Activity className="w-4 h-4" />
            </button>
            {onOpenShortcuts && (
              <>
                <span className="w-px h-4 bg-zinc-300/60 dark:bg-white/[0.08] mx-0.5" aria-hidden />
                <button
                  onClick={onOpenShortcuts}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-100 transition"
                  title="Keyboard shortcuts (?)"
                  aria-label="Keyboard shortcuts"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memory... (press /)"
            data-archive-search
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-rose-500/50 transition"
          />
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400 dark:text-zinc-600 pointer-events-none" />
        </div>

        {/* Sidebar Mode Tabs */}
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl mb-3">
          <button
            onClick={() => { setSidebarMode('filters'); setActiveCollectionId(null); setActiveSmartFolderId(null); }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${sidebarMode === 'filters' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
          <button
            onClick={() => { setSidebarMode('collections'); setActiveFilter('all'); setActiveSmartFolderId(null); }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${sidebarMode === 'collections' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Folder className="w-3.5 h-3.5" /> Collections
          </button>
          <button
            onClick={() => { setSidebarMode('smart-folders'); setActiveFilter('all'); setActiveCollectionId(null); }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${sidebarMode === 'smart-folders' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Wand2 className="w-3.5 h-3.5" /> Smart
          </button>
        </div>

        {/* Filter chip row — top 5 by count, rest hidden behind "More" disclosure */}
        {sidebarMode === 'filters' && (
          <div className="space-y-1.5">
            <div className="-mx-1 overflow-x-auto scrollbar-thin">
              <div className="flex gap-1.5 px-1 min-w-max items-center">
                {primaryFilters.map(f => {
                  const active = activeFilter === f;
                  const count = f === 'all'
                    ? items.length
                    : f === 'starred'
                      ? items.filter(i => i.starred).length
                      : (typeCounts.get(f) || 0);
                  return (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      title={getFilterLabel(f)}
                      className={`inline-flex items-baseline gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-[0.12em] whitespace-nowrap border transition-colors duration-200 ${
                        active
                          ? 'bg-rose-500/[0.10] text-rose-600 dark:text-rose-400 border-rose-500/40'
                          : 'bg-transparent text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/[0.06] hover:border-rose-500/30 hover:text-rose-500'
                      }`}
                      style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
                    >
                      <span>{getFilterShortLabel(f)}</span>
                      {count > 0 && <span className={`text-[9px] tabular-nums ${active ? 'text-rose-500/80 dark:text-rose-400/80' : 'text-zinc-400 dark:text-zinc-600'}`}>{count}</span>}
                    </button>
                  );
                })}
                {secondaryFilters.length > 0 && (
                  <button
                    onClick={() => setFiltersExpanded(v => !v)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-[0.12em] whitespace-nowrap border border-dashed border-zinc-300 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-500 hover:border-rose-500/30 hover:text-rose-500 transition-colors"
                    aria-expanded={filtersExpanded}
                    title={filtersExpanded ? 'Collapse filters' : 'Show all filters'}
                  >
                    {filtersExpanded ? 'Less' : `More · ${secondaryFilters.length}`}
                  </button>
                )}
              </div>
            </div>
            {filtersExpanded && secondaryFilters.length > 0 && (
              <div className="-mx-1 overflow-x-auto scrollbar-thin">
                <div className="flex gap-1.5 px-1 min-w-max">
                  {secondaryFilters.map(f => {
                    const active = activeFilter === f;
                    const count = typeCounts.get(f) || 0;
                    return (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        title={getFilterLabel(f)}
                        className={`inline-flex items-baseline gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-[0.12em] whitespace-nowrap border transition-colors duration-200 ${
                          active
                            ? 'bg-rose-500/[0.10] text-rose-600 dark:text-rose-400 border-rose-500/40'
                            : 'bg-transparent text-zinc-500 dark:text-zinc-500 border-zinc-200/60 dark:border-white/[0.04] hover:border-rose-500/30 hover:text-rose-500'
                        }`}
                        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
                      >
                        <span>{getFilterShortLabel(f)}</span>
                        {count > 0 && <span className={`text-[9px] tabular-nums ${active ? 'text-rose-500/80 dark:text-rose-400/80' : 'text-zinc-400 dark:text-zinc-600'}`}>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {sidebarMode === 'collections' && (
          <div className="space-y-1">
            <button
              onClick={() => setActiveCollectionId(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${!activeCollectionId ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'}`}
            >
              <Inbox className="w-4 h-4 flex-shrink-0" />
              <span>All items</span>
              <span className="ml-auto text-xs font-mono opacity-60">{items.length}</span>
            </button>
            {collections.map(col => (
              <button
                key={col.id}
                onClick={() => setActiveCollectionId(col.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${activeCollectionId === col.id ? 'bg-rose-500/10 text-rose-500' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
              >
                <i className={`fa-solid ${col.icon}`} style={{ color: col.color }}></i>
                <span className="truncate">{col.name}</span>
                <span className="ml-auto text-xs opacity-60">{col.itemCount}</span>
              </button>
            ))}
            <button
              onClick={() => openModal('createCollection')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>New Collection</span>
            </button>
          </div>
        )}

        {sidebarMode === 'smart-folders' && (
          <div className="space-y-1">
            {smartFolders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setActiveSmartFolderId(folder.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${activeSmartFolderId === folder.id ? 'bg-rose-500/10 text-rose-500' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
              >
                <i className={`fa-solid ${folder.icon}`} style={{ color: folder.color }}></i>
                <span className="truncate">{folder.name}</span>
                <span className="ml-auto text-xs opacity-60">{folder.itemCount}</span>
              </button>
            ))}
            <button
              onClick={() => openModal('createSmartFolder')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>New Smart Folder</span>
            </button>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedItems.size > 0 && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-500/10 rounded transition"
            >
              {selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs text-rose-500 font-medium">{selectedItems.size} selected</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => openModal('bulkTag')}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/10 hover:text-zinc-900 dark:hover:text-zinc-100 rounded transition"
            >
              <Tags className="w-3 h-3" /> Tag
            </button>
            <button
              onClick={() => openModal('bulkCollection')}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/10 hover:text-zinc-900 dark:hover:text-zinc-100 rounded transition"
            >
              <FolderPlus className="w-3 h-3" /> Collection
            </button>
            <button
              onClick={handleBulkExport}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/10 hover:text-zinc-900 dark:hover:text-zinc-100 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!driveConnected}
              title={driveConnected ? 'Export to Google Drive' : 'Connect Google Drive to export'}
            >
              <HardDrive className="w-3 h-3" /> Export
            </button>
            <span className="w-px h-4 bg-zinc-300/60 dark:bg-white/[0.08] mx-1" aria-hidden />
            <button
              onClick={handleBulkDeleteWithUndo}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded transition"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
            <button
              onClick={clearSelection}
              className="px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-500/10 hover:text-zinc-900 dark:hover:text-zinc-100 rounded transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : viewMode === 'timeline' ? (
          <ArchiveTimelineView />
        ) : viewMode === 'list' ? (
          <ArchiveListView groupedItems={groupedItems} />
        ) : (
          <ArchiveGridView items={items} />
        )}

        {/* Infinite scroll sentinel */}
        {hasMore && items.length > 0 && (
          <div ref={sentinelRef} className="flex items-center justify-center py-4">
            {loadingMore && <Loader2 className="w-5 h-5 text-rose-500 animate-spin" />}
          </div>
        )}

        {items.length === 0 && !loading && (
          <div className="flex flex-col items-center py-12 px-3 text-center">
            <div className="w-12 h-12 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-4">
              <Inbox className="w-5 h-5 text-zinc-400 dark:text-zinc-600" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500 mb-2">
              Memory · empty
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-5 max-w-[280px]">
              Pulse archives every message, email, voice note, transcript, decision, and AI summary as it happens.
            </p>
            <div className="w-full max-w-[280px] space-y-1">
              <a
                href="#meetings"
                className="block text-left px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.06] hover:border-rose-500/40 hover:bg-rose-500/[0.04] transition-colors"
              >
                <span className="text-[10px] font-mono uppercase tracking-wider text-rose-500">Record</span>
                <span className="text-xs text-zinc-700 dark:text-zinc-300 ml-2">a meeting</span>
              </a>
              <a
                href="#relay"
                className="block text-left px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.06] hover:border-rose-500/40 hover:bg-rose-500/[0.04] transition-colors"
              >
                <span className="text-[10px] font-mono uppercase tracking-wider text-rose-500">Capture</span>
                <span className="text-xs text-zinc-700 dark:text-zinc-300 ml-2">a voice note</span>
              </a>
              <button
                onClick={handleImportPast}
                disabled={importing}
                className="w-full inline-flex items-center justify-between px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.06] hover:border-rose-500/40 hover:bg-rose-500/[0.04] transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                <span className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-rose-500">Import</span>
                  <span className="text-xs text-zinc-700 dark:text-zinc-300">past conversations from Pulse</span>
                </span>
                {importing ? (
                  <Loader2 className="w-3.5 h-3.5 text-rose-500 animate-spin flex-shrink-0" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600 flex-shrink-0" />
                )}
              </button>
            </div>
            <div className="mt-6 pt-5 border-t border-zinc-200/60 dark:border-white/[0.06] w-full max-w-[280px]">
              <button
                onClick={() => seedDemoData()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500 hover:text-rose-500 hover:bg-rose-500/[0.04] border border-dashed border-zinc-300 dark:border-white/[0.08] hover:border-rose-500/30 transition-colors"
                title="Load 30 demo conversations to preview Memory"
              >
                Seed demo data
              </button>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-2 leading-relaxed">
                In-memory only. Cleared on refresh.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchiveSidebar;
