// src/components/Archives/ArchiveSidebar.tsx
// Sidebar with header, search, filters, collections, smart folders, bulk actions, and item views

import React, { useEffect, useRef } from 'react';
import { Activity, Check, Filter, Folder, FolderPlus, GripHorizontal, HardDrive, Inbox, List, Loader2, Plus, Search, Tags, Trash2, Wand2 } from 'lucide-react';
import type { ArchiveItem, ArchiveType } from '../../types';
import { useArchiveStore } from '../../store/archiveStore';
import { ArchiveListView } from './ArchiveListView';
import { ArchiveGridView } from './ArchiveGridView';
import { ArchiveTimelineView } from './ArchiveTimelineView';

const filterOptions: Array<ArchiveType | 'all' | 'starred'> = [
  'all', 'starred', 'war_room_session', 'transcript', 'meeting_note', 'vox_transcript', 'decision_log', 'journal', 'summary', 'artifact', 'image', 'video', 'document'
];

const getFilterIcon = (filter: ArchiveType | 'all' | 'starred') => {
  switch (filter) {
    case 'all': return 'fa-layer-group';
    case 'starred': return 'fa-star';
    case 'transcript': return 'fa-comments';
    case 'meeting_note': return 'fa-pen-clip';
    case 'vox_transcript': return 'fa-bullhorn';
    case 'decision_log': return 'fa-scale-balanced';
    case 'journal': return 'fa-pen-nib';
    case 'summary': return 'fa-list-check';
    case 'artifact': return 'fa-gem';
    case 'image': return 'fa-image';
    case 'video': return 'fa-video';
    case 'document': return 'fa-folder-open';
    case 'war_room_session': return 'fa-shield-halved';
    default: return 'fa-file';
  }
};

const getFilterLabel = (filter: ArchiveType | 'all' | 'starred') => {
  switch (filter) {
    case 'all': return 'All';
    case 'starred': return 'Starred';
    case 'transcript': return 'Transcript';
    case 'meeting_note': return 'Meeting';
    case 'vox_transcript': return 'Vox';
    case 'decision_log': return 'Decision';
    case 'journal': return 'Journal';
    case 'summary': return 'Summary';
    case 'artifact': return 'Artifact';
    case 'image': return 'Image';
    case 'video': return 'Video';
    case 'document': return 'Document';
    case 'war_room_session': return 'Studio Sessions';
    default: return filter;
  }
};

const getFilterShortLabel = (filter: ArchiveType | 'all' | 'starred') => {
  switch (filter) {
    case 'all': return 'All';
    case 'starred': return 'Starred';
    case 'transcript': return 'Transcript';
    case 'meeting_note': return 'Meeting';
    case 'vox_transcript': return 'Vox';
    case 'decision_log': return 'Decision';
    case 'journal': return 'Journal';
    case 'summary': return 'Summary';
    case 'artifact': return 'Artifact';
    case 'image': return 'Image';
    case 'video': return 'Video';
    case 'document': return 'Document';
    case 'war_room_session': return 'Studio';
    default: return filter;
  }
};

export const ArchiveSidebar: React.FC = () => {
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

  return (
    <div className={`w-full md:w-[420px] flex flex-col border-r border-zinc-200 dark:border-zinc-800 relative ${selectedItem ? 'hidden md:flex' : 'flex'}`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-red-500 flex items-center justify-center relative">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            </div>
            <div>
              <h2 className="text-lg font-light text-zinc-900 dark:text-white tracking-wide">Archives</h2>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                {items.length} items
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* View mode buttons */}
            <button
              onClick={() => setViewMode('list')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${viewMode === 'list' ? 'bg-red-500 text-white' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
              title="List view"
            >
              <List className="text-xs" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${viewMode === 'grid' ? 'bg-red-500 text-white' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
              title="Grid view"
            >
              <GripHorizontal className="text-xs" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${viewMode === 'timeline' ? 'bg-red-500 text-white' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
              title="Timeline view"
            >
              <Activity className="text-xs" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search archives... (press /)"
            data-archive-search
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-red-500/50 transition"
          />
          <Search className="absolute left-3.5 top-3 text-zinc-400 dark:text-zinc-600" />
        </div>

        {/* Sidebar Mode Tabs */}
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl mb-3">
          <button
            onClick={() => { setSidebarMode('filters'); setActiveCollectionId(null); setActiveSmartFolderId(null); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${sidebarMode === 'filters' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Filter className="mr-1.5" /> Filters
          </button>
          <button
            onClick={() => { setSidebarMode('collections'); setActiveFilter('all'); setActiveSmartFolderId(null); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${sidebarMode === 'collections' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Folder className="mr-1.5" /> Collections
          </button>
          <button
            onClick={() => { setSidebarMode('smart-folders'); setActiveFilter('all'); setActiveCollectionId(null); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${sidebarMode === 'smart-folders' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Wand2 className="mr-1.5" /> Smart
          </button>
        </div>

        {/* Filter Icon Buttons / Collections / Smart Folders */}
        {sidebarMode === 'filters' && (
          <div className="grid grid-cols-6 gap-1.5">
            {filterOptions.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                title={getFilterLabel(f)}
                className={`w-full aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all border ${
                  activeFilter === f
                    ? 'bg-red-500 text-white border-red-500 shadow-sm'
                    : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-red-500/50 hover:text-red-500'
                }`}
              >
                <i className={`fa-solid ${getFilterIcon(f)} text-sm`}></i>
                <span className="text-[8px] font-medium leading-none truncate w-full text-center px-0.5">{getFilterShortLabel(f)}</span>
              </button>
            ))}
          </div>
        )}

        {sidebarMode === 'collections' && (
          <div className="space-y-1">
            <button
              onClick={() => setActiveCollectionId(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${!activeCollectionId ? 'bg-red-500/10 text-red-500' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
            >
              <Inbox />
              <span>All Archives</span>
              <span className="ml-auto text-xs opacity-60">{items.length}</span>
            </button>
            {collections.map(col => (
              <button
                key={col.id}
                onClick={() => setActiveCollectionId(col.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${activeCollectionId === col.id ? 'bg-red-500/10 text-red-500' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
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
              <Plus />
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
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${activeSmartFolderId === folder.id ? 'bg-red-500/10 text-red-500' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
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
              <Plus />
              <span>New Smart Folder</span>
            </button>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedItems.size > 0 && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-500/10 rounded transition"
            >
              {selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs text-red-500 font-medium">{selectedItems.size} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              className="px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 rounded transition flex items-center"
            >
              <Trash2 className="mr-1" /> Delete
            </button>
            <button
              onClick={() => openModal('bulkTag')}
              className="px-2 py-1 text-xs text-blue-500 hover:bg-blue-500/10 rounded transition flex items-center"
            >
              <Tags className="mr-1" /> Tag
            </button>
            <button
              onClick={() => openModal('bulkCollection')}
              className="px-2 py-1 text-xs text-purple-500 hover:bg-purple-500/10 rounded transition flex items-center"
            >
              <FolderPlus className="mr-1" /> Collection
            </button>
            <button
              onClick={handleBulkExport}
              className="px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 rounded transition flex items-center"
              disabled={!driveConnected}
            >
              <HardDrive className="mr-1" /> Export
            </button>
            <button
              onClick={clearSelection}
              className="px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-500/10 rounded transition"
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
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
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
            {loadingMore && <Loader2 className="w-5 h-5 text-red-500 animate-spin" />}
          </div>
        )}

        {items.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-4">
              <Inbox className="text-2xl text-zinc-400 dark:text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-600">No archived items</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-700 mt-1">Items will appear here automatically</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchiveSidebar;
