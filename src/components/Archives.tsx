import React, { useEffect, useCallback } from 'react';
import { useArchiveStore } from '../store/archiveStore';
import { ArchiveSidebar } from './Archives/ArchiveSidebar';
import { ArchiveDetailView } from './Archives/ArchiveDetailView';
import { ArchiveStatsPanel } from './Archives/ArchiveStatsPanel';
import { ArchiveModals } from './Archives/ArchiveModals';

const Archives: React.FC = () => {
  const loading = useArchiveStore(s => s.loading);
  const selectedItem = useArchiveStore(s => s.selectedItem);
  const items = useArchiveStore(s => s.items);
  const loadData = useArchiveStore(s => s.loadData);
  const checkDriveConnection = useArchiveStore(s => s.checkDriveConnection);
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

  // Initial data load
  useEffect(() => {
    loadData();
    checkDriveConnection();
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

    // Escape: close detail or modals
    if (e.key === 'Escape') {
      // Close any open modal first
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
  }, [items, selectedItem, modals]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-full flex flex-col md:flex-row bg-white dark:bg-black rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-2xl">
      {/* Sidebar with search, filters, and item views */}
      <ArchiveSidebar />

      {/* Main content area: detail view or stats panel */}
      <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 relative">
        {selectedItem ? (
          <ArchiveDetailView />
        ) : (
          <ArchiveStatsPanel />
        )}
      </div>

      {/* All modals rendered here */}
      <ArchiveModals />
    </div>
  );
};

export default Archives;
