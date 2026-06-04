import React, { useEffect, useCallback, useState } from 'react';
import { useArchiveStore } from '../store/archiveStore';
import { ArchiveSidebar } from './Archives/ArchiveSidebar';
import { ArchiveDetailView } from './Archives/ArchiveDetailView';
import { MemoryOverviewPanel } from './Archives/MemoryOverviewPanel';
import { ArchiveModals } from './Archives/ArchiveModals';
import { ShortcutOverlay } from './Archives/ShortcutOverlay';
import CapturesView from './Captures/CapturesView';

type ArchivesTab = 'memory' | 'notes';

const Archives: React.FC = () => {
  const loading = useArchiveStore(s => s.loading);
  const selectedItem = useArchiveStore(s => s.selectedItem);
  const items = useArchiveStore(s => s.items);
  const loadData = useArchiveStore(s => s.loadData);
  const checkDriveConnection = useArchiveStore(s => s.checkDriveConnection);
  const backfillContactLinks = useArchiveStore(s => s.backfillContactLinks);
  const refreshData = useArchiveStore(s => s.refreshData);
  const loadTimelineEvents = useArchiveStore(s => s.loadTimelineEvents);
  const loadRelatedItems = useArchiveStore(s => s.loadRelatedItems);
  const query = useArchiveStore(s => s.query);
  const activeFilter = useArchiveStore(s => s.activeFilter);
  const activeCollectionId = useArchiveStore(s => s.activeCollectionId);
  const activeSmartFolderId = useArchiveStore(s => s.activeSmartFolderId);
  const viewMode = useArchiveStore(s => s.viewMode);
  const setSelectedItem = useArchiveStore(s => s.setSelectedItem);
  const handleToggleStar = useArchiveStore(s => s.handleToggleStar);
  const openModal = useArchiveStore(s => s.openModal);
  const modals = useArchiveStore(s => s.modals);
  const closeModal = useArchiveStore(s => s.closeModal);
  const handleStartEdit = useArchiveStore(s => s.handleStartEdit);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Tab toggle between the existing Memory (archive_items) view and the new
  // Notes (pulse_notes) view. Defaults to Notes when arriving with either
  //   - `pulse_focus_note` (specific note to focus, set by dashboard row + palette), or
  //   - `pulse_archives_tab = 'notes'` (generic "open the notes tab" sentinel
  //     set by the Capture widget's View All / SEE ALL links).
  const [activeTab, setActiveTab] = useState<ArchivesTab>(() => {
    if (sessionStorage.getItem('pulse_focus_note')) return 'notes';
    const tabHint = sessionStorage.getItem('pulse_archives_tab');
    if (tabHint === 'notes') {
      sessionStorage.removeItem('pulse_archives_tab');
      return 'notes';
    }
    return 'memory';
  });

  // Initial data load
  useEffect(() => {
    loadData();
    checkDriveConnection();
    // One-time repair: link already-archived emails to CRM contacts by sender
    // address so Top People populates. Idempotent + best-effort (no-op in demo).
    backfillContactLinks();
  }, []);

  // Refresh items when filters/search change
  useEffect(() => {
    refreshData();
  }, [query, activeFilter, activeCollectionId, activeSmartFolderId]);

  // Load timeline events when switching to timeline view
  useEffect(() => {
    if (viewMode === 'timeline') {
      loadTimelineEvents();
    }
  }, [viewMode]);

  // Load related items when selected item changes
  useEffect(() => {
    if (selectedItem) {
      loadRelatedItems(selectedItem.id);
    }
  }, [selectedItem]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Escape: close shortcut overlay → modal → detail
    if (e.key === 'Escape') {
      if (shortcutsOpen) {
        setShortcutsOpen(false);
        return;
      }
      const openModalName = Object.entries(modals).find(([, v]) => v === true || (v !== null && v !== false))?.[0];
      if (openModalName) {
        closeModal(openModalName as keyof typeof modals);
        return;
      }
      if (selectedItem) {
        setSelectedItem(null);
        return;
      }
    }

    // Don't fire shortcuts when typing in inputs
    if (isInput) return;

    // ? or Shift+/: open shortcut overlay
    if (e.key === '?') {
      e.preventDefault();
      setShortcutsOpen(true);
      return;
    }

    // / or Ctrl+K: focus search
    if (e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>('[data-archive-search]');
      searchInput?.focus();
      return;
    }

    // j/k: navigate items
    if (e.key === 'j' || e.key === 'k') {
      if (items.length === 0) return;
      const currentIndex = selectedItem ? items.findIndex(i => i.id === selectedItem.id) : -1;
      const nextIndex = e.key === 'j'
        ? Math.min(currentIndex + 1, items.length - 1)
        : Math.max(currentIndex - 1, 0);
      if (nextIndex >= 0 && nextIndex < items.length) {
        setSelectedItem(items[nextIndex]);
      }
      return;
    }

    // s: toggle star
    if (e.key === 's' && selectedItem) {
      handleToggleStar(selectedItem.id);
      return;
    }

    // e: edit
    if (e.key === 'e' && selectedItem) {
      handleStartEdit();
      return;
    }

    // d or Delete: delete
    if ((e.key === 'd' || e.key === 'Delete') && selectedItem) {
      openModal('deleteConfirm', selectedItem.id);
      return;
    }
  }, [items, selectedItem, modals, shortcutsOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-2xl">

      {/* Tab strip: Memory (archive_items) vs Notes (pulse_notes) */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-white/[0.06] px-4 shrink-0">
        {([
          { id: 'memory' as const, label: 'MEMORY' },
          { id: 'notes'  as const, label: 'NOTES' },
        ]).map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3 py-2.5 pulse-label transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded-sm ${
                isActive
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {tab.label}
              {isActive && (
                <span aria-hidden="true" className="absolute left-2 right-2 -bottom-px h-px bg-rose-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* MEMORY (legacy archive_items) */}
      {activeTab === 'memory' && (
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <ArchiveSidebar onOpenShortcuts={() => setShortcutsOpen(true)} />
          <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 relative">
            {selectedItem ? <ArchiveDetailView /> : <MemoryOverviewPanel />}
          </div>
        </div>
      )}

      {/* NOTES (pulse_notes — Capture layer) */}
      {activeTab === 'notes' && (
        <div className="flex-1 min-h-0">
          <CapturesView />
        </div>
      )}

      {/* All modals rendered here */}
      <ArchiveModals />

      {/* Keyboard shortcut overlay */}
      <ShortcutOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
};

export default Archives;
