// src/store/archiveStore.ts
// Zustand store for Archives section — items, collections, smart folders, bulk ops, AI tools

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { archiveService } from '../services/archiveService';
import { googleDriveService } from '../services/googleDriveService';
import { googleCalendarService } from '../services/googleCalendarService';
import { userContactService } from '../services/userContactService';
import { backfillEmailContactLinks } from '../services/memoryIngestService';
import type { ArchiveItem, ArchiveType, ArchiveCollection, SmartFolder, ArchiveTimelineEvent, SmartFolderRule } from '../types';
import toast from 'react-hot-toast';

export interface VersionHistoryItem {
  id: string;
  date: Date;
  action: string;
  user: string;
  content?: string;
  title?: string;
}

export type ViewMode = 'list' | 'grid' | 'timeline';
export type SidebarMode = 'filters' | 'collections' | 'smart-folders';

interface ArchiveModals {
  share: boolean;
  tags: boolean;
  collectionPicker: boolean;
  contactPicker: boolean;
  translate: boolean;
  history: boolean;
  createCollection: boolean;
  createSmartFolder: boolean;
  deleteConfirm: string | null;
  actionItemsResult: string[] | null;
  bulkTag: boolean;
  bulkCollection: boolean;
}

interface ArchiveState {
  // Data
  items: ArchiveItem[];
  collections: ArchiveCollection[];
  smartFolders: SmartFolder[];
  timelineEvents: ArchiveTimelineEvent[];
  relatedItems: ArchiveItem[];
  contacts: any[];
  /** CRM contact id → display name, for archives linked to a CRM contact
   *  (e.g. emails resolved by sender address). Powers Top People / Recent
   *  names that aren't covered by the Pulse-users `contacts` array. */
  contactNames: Record<string, string>;
  versionHistory: VersionHistoryItem[];

  // Demo mode (in-memory seed; never written to DB)
  demoMode: boolean;
  demoItems: ArchiveItem[] | null;

  // Loading & Pagination
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  page: number;
  exporting: boolean;
  aiProcessing: string | null;
  ttsLoading: boolean;
  restoringVersion: string | null;

  // Navigation
  query: string;
  activeFilter: ArchiveType | 'all' | 'starred';
  activeCollectionId: string | null;
  activeSmartFolderId: string | null;
  viewMode: ViewMode;
  sidebarMode: SidebarMode;

  // Selection
  selectedItem: ArchiveItem | null;
  hoveredItem: ArchiveItem | null;
  selectedItems: Set<string>;

  // Drive
  driveConnected: boolean;
  exportProgress: { current: number; total: number } | null;

  // Editor
  isEditing: boolean;
  editTitle: string;
  editContent: string;

  // Form state
  newCollectionName: string;
  newCollectionColor: string;
  newCollectionIcon: string;
  newFolderName: string;
  newFolderRules: SmartFolderRule[];
  newFolderOperator: 'and' | 'or';
  contactSearch: string;
  newTag: string;
  bulkTagValue: string;

  // UI
  isSpeaking: boolean;
  isFullscreen: boolean;
  shareSuccess: string | null;

  // Modals
  modals: ArchiveModals;

  // --- Actions ---

  // Data loading
  loadData: () => Promise<void>;
  refreshData: () => Promise<void>;
  seedDemoData: () => Promise<void>;
  clearDemoData: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadTimelineEvents: () => Promise<void>;
  loadRelatedItems: (archiveId: string) => Promise<void>;
  loadContacts: () => Promise<void>;
  resolveContactNames: () => Promise<void>;
  backfillContactLinks: () => Promise<void>;
  checkDriveConnection: () => Promise<void>;

  // Simple setters
  setQuery: (query: string) => void;
  setActiveFilter: (filter: ArchiveType | 'all' | 'starred') => void;
  setActiveCollectionId: (id: string | null) => void;
  setActiveSmartFolderId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setSelectedItem: (item: ArchiveItem | null) => void;
  setHoveredItem: (item: ArchiveItem | null) => void;
  toggleSelectItem: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // Modal control
  openModal: (name: keyof ArchiveModals, value?: any) => void;
  closeModal: (name: keyof ArchiveModals) => void;

  // Form setters
  setEditTitle: (title: string) => void;
  setEditContent: (content: string) => void;
  setNewCollectionName: (name: string) => void;
  setNewCollectionColor: (color: string) => void;
  setNewCollectionIcon: (icon: string) => void;
  setNewFolderName: (name: string) => void;
  setNewFolderRules: (rules: SmartFolderRule[]) => void;
  setNewFolderOperator: (op: 'and' | 'or') => void;
  setContactSearch: (search: string) => void;
  setNewTag: (tag: string) => void;
  setBulkTagValue: (value: string) => void;

  // TTS state (handler stays in component due to audioRef)
  setIsSpeaking: (speaking: boolean) => void;
  setTtsLoading: (loading: boolean) => void;

  // Business logic handlers
  confirmDelete: () => Promise<void>;
  handleToggleStar: (id: string) => Promise<void>;
  handleExportToDrive: (item: ArchiveItem) => Promise<void>;
  handleShare: (item: ArchiveItem) => Promise<void>;
  handleShareTo: (platform: string, item: ArchiveItem) => Promise<void>;
  handleStartEdit: () => void;
  handleSaveEdit: () => Promise<void>;
  handleTogglePin: () => Promise<void>;
  handleAddToCollectionTool: (collectionId: string) => Promise<void>;
  handleAddTag: () => Promise<void>;
  handleRemoveTag: (tagToRemove: string) => Promise<void>;
  handleSummarize: () => Promise<void>;
  handleExtractActions: () => Promise<void>;
  handleFindRelated: () => Promise<void>;
  handleTranslate: (targetLanguage: string) => Promise<void>;
  handleSendToEmail: () => void;
  handleCreateTask: () => Promise<void>;
  handleAddToCalendar: () => Promise<void>;
  handleLinkToContact: (contactId: string) => Promise<void>;
  handlePrint: () => void;
  handleFullscreen: () => void;
  handleShowHistory: () => Promise<void>;
  handleRestoreVersion: (version: VersionHistoryItem) => Promise<void>;
  handleBulkExport: () => Promise<void>;
  handleSelectItem: (id: string) => void;
  handleSelectAll: () => void;
  handleAddToCollection: (collectionId: string) => Promise<void>;
  handleCreateCollection: () => Promise<void>;
  handleCreateSmartFolder: () => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleBulkTag: () => Promise<void>;
  handleBulkAddToCollection: (collectionId: string) => Promise<void>;
}

const defaultModals: ArchiveModals = {
  share: false,
  tags: false,
  collectionPicker: false,
  contactPicker: false,
  translate: false,
  history: false,
  createCollection: false,
  createSmartFolder: false,
  deleteConfirm: null,
  actionItemsResult: null,
  bulkTag: false,
  bulkCollection: false,
};

/** Flash a success message for 2 seconds */
const flashSuccess = (set: (partial: Partial<ArchiveState>) => void, message: string) => {
  set({ shareSuccess: message });
  setTimeout(() => set({ shareSuccess: null }), 2000);
};

export const useArchiveStore = create<ArchiveState>()(
  subscribeWithSelector((set, get) => ({
    // --- Initial state ---
    items: [],
    collections: [],
    smartFolders: [],
    timelineEvents: [],
    relatedItems: [],
    contacts: [],
    contactNames: {},
    versionHistory: [],
    demoMode: false,
    demoItems: null,

    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 0,
    exporting: false,
    aiProcessing: null,
    ttsLoading: false,
    restoringVersion: null,

    query: '',
    activeFilter: 'all',
    activeCollectionId: null,
    activeSmartFolderId: null,
    viewMode: 'list',
    sidebarMode: 'filters',

    selectedItem: null,
    hoveredItem: null,
    selectedItems: new Set<string>(),

    driveConnected: false,
    exportProgress: null,

    isEditing: false,
    editTitle: '',
    editContent: '',

    newCollectionName: '',
    newCollectionColor: '#ef4444',
    newCollectionIcon: 'fa-folder',
    newFolderName: '',
    newFolderRules: [{ field: 'type', operator: 'equals', value: '' }],
    newFolderOperator: 'and',
    contactSearch: '',
    newTag: '',
    bulkTagValue: '',

    isSpeaking: false,
    isFullscreen: false,
    shareSuccess: null,

    modals: { ...defaultModals },

    // --- Data loading ---

    loadData: async () => {
      set({ loading: true });
      try {
        const [collectionsData, smartFoldersData] = await Promise.all([
          archiveService.getCollections(),
          archiveService.getSmartFolders(),
        ]);
        set({ collections: collectionsData, smartFolders: smartFoldersData });
        await get().refreshData();
      } finally {
        set({ loading: false });
      }
    },

    refreshData: async () => {
      const PAGE_SIZE = 50;
      const { activeSmartFolderId, activeCollectionId, activeFilter, query, demoMode, demoItems } = get();

      // Demo mode: filter the in-memory seed locally without touching the DB.
      if (demoMode && demoItems) {
        let data = demoItems;
        if (activeFilter === 'starred') {
          data = data.filter(i => i.starred);
        } else if (activeFilter !== 'all') {
          data = data.filter(i => i.type === activeFilter);
        }
        if (query) {
          const q = query.toLowerCase();
          data = data.filter(i =>
            i.title.toLowerCase().includes(q) ||
            i.content.toLowerCase().includes(q) ||
            (i.tags || []).some(t => t.toLowerCase().includes(q)) ||
            (i.aiTags || []).some(t => t.toLowerCase().includes(q))
          );
        }
        // Sort newest first
        data = [...data].sort((a, b) => {
          const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
          const db = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
          return db - da;
        });
        set({ items: data, page: 0, hasMore: false });
        return;
      }

      let data: ArchiveItem[] = [];

      if (activeSmartFolderId) {
        data = await archiveService.getSmartFolderItems(activeSmartFolderId);
      } else if (activeCollectionId) {
        data = await archiveService.getArchives({ collectionId: activeCollectionId, limit: PAGE_SIZE, offset: 0 });
      } else if (activeFilter === 'starred') {
        data = await archiveService.getArchives({ starred: true, limit: PAGE_SIZE, offset: 0 });
      } else if (activeFilter !== 'all') {
        data = await archiveService.getArchives({ type: activeFilter as ArchiveType, limit: PAGE_SIZE, offset: 0 });
      } else if (query) {
        const result = await archiveService.searchArchives(query, { limit: PAGE_SIZE });
        data = result.items;
      } else {
        data = await archiveService.getArchives({ limit: PAGE_SIZE, offset: 0 });
      }

      set({ items: data, page: 0, hasMore: data.length >= PAGE_SIZE });
      // Fire-and-forget: name any CRM-linked contacts in the new page.
      get().resolveContactNames();
    },

    seedDemoData: async () => {
      const { generateDemoMemoryItems, generateDemoContacts } = await import('../components/Archives/memoryDemoSeed');
      const items = generateDemoMemoryItems();
      const demoContacts = generateDemoContacts();
      set({
        demoMode: true,
        demoItems: items,
        items,
        contacts: demoContacts,
        loading: false,
        hasMore: false,
        page: 0,
        // Reset filters so the seed shows up immediately
        activeFilter: 'all',
        activeCollectionId: null,
        activeSmartFolderId: null,
        query: '',
      });
    },

    clearDemoData: async () => {
      set({ demoMode: false, demoItems: null, items: [], loading: true });
      await get().loadData();
    },

    loadMore: async () => {
      const PAGE_SIZE = 50;
      const { loadingMore, hasMore, items, activeSmartFolderId, activeCollectionId, activeFilter, query, page } = get();
      if (loadingMore || !hasMore) return;

      set({ loadingMore: true });
      try {
        const nextPage = page + 1;
        const offset = nextPage * PAGE_SIZE;
        let data: ArchiveItem[] = [];

        // Smart folders don't support pagination (client-side filtering)
        if (activeSmartFolderId) {
          set({ hasMore: false });
          return;
        } else if (activeCollectionId) {
          data = await archiveService.getArchives({ collectionId: activeCollectionId, limit: PAGE_SIZE, offset });
        } else if (activeFilter === 'starred') {
          data = await archiveService.getArchives({ starred: true, limit: PAGE_SIZE, offset });
        } else if (activeFilter !== 'all') {
          data = await archiveService.getArchives({ type: activeFilter as ArchiveType, limit: PAGE_SIZE, offset });
        } else if (query) {
          const result = await archiveService.searchArchives(query, { limit: PAGE_SIZE });
          data = result.items;
        } else {
          data = await archiveService.getArchives({ limit: PAGE_SIZE, offset });
        }

        set({
          items: [...items, ...data],
          page: nextPage,
          hasMore: data.length >= PAGE_SIZE,
        });
        get().resolveContactNames();
      } finally {
        set({ loadingMore: false });
      }
    },

    loadTimelineEvents: async () => {
      const events = await archiveService.getTimelineEvents({ limit: 100 });
      set({ timelineEvents: events });
    },

    loadRelatedItems: async (archiveId: string) => {
      const related = await archiveService.getRelatedItems(archiveId);
      set({ relatedItems: related });
    },

    loadContacts: async () => {
      const { contactSearch } = get();
      try {
        const contacts = await userContactService.getAllPulseUsers({
          searchQuery: contactSearch,
          limit: 20,
          excludeBlocked: true,
        });
        set({ contacts });
      } catch {
        set({ contacts: [] });
      }
    },

    // Resolve CRM contact names for the related_contact_ids present in the
    // current items that aren't already cached. Best-effort: failures and
    // demo mode fall back to the Pulse-users `contacts` array / stub label.
    resolveContactNames: async () => {
      const { items, contactNames, demoMode } = get();
      if (demoMode) return;
      const ids = Array.from(
        new Set(items.map(i => i.relatedContactId).filter(Boolean)),
      ) as string[];
      const missing = ids.filter(id => !(id in contactNames));
      if (missing.length === 0) return;
      try {
        const names = await archiveService.getContactNames(missing);
        if (Object.keys(names).length === 0) return;
        set({ contactNames: { ...get().contactNames, ...names } });
      } catch {
        // best-effort; pivots fall back gracefully
      }
    },

    // One-time repair: link already-archived emails to a CRM contact by
    // sender address. Idempotent; refreshes + re-resolves names only if it
    // actually linked anything.
    backfillContactLinks: async () => {
      if (get().demoMode) return;
      try {
        const { linked } = await backfillEmailContactLinks();
        if (linked > 0) {
          await get().refreshData();
          await get().resolveContactNames();
        }
      } catch (err) {
        console.warn('[archiveStore] contact-link backfill failed:', err);
      }
    },

    checkDriveConnection: async () => {
      const connected = await googleDriveService.isConnected();
      set({ driveConnected: connected });
    },

    // --- Simple setters ---

    setQuery: (query) => set({ query }),
    setActiveFilter: (filter) => set({ activeFilter: filter }),
    setActiveCollectionId: (id) => set({ activeCollectionId: id }),
    setActiveSmartFolderId: (id) => set({ activeSmartFolderId: id }),
    setViewMode: (mode) => set({ viewMode: mode }),
    setSidebarMode: (mode) => set({ sidebarMode: mode }),
    setSelectedItem: (item) => set({ selectedItem: item }),
    setHoveredItem: (item) => set({ hoveredItem: item }),

    toggleSelectItem: (id) => {
      const newSelected = new Set(get().selectedItems);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      set({ selectedItems: newSelected });
    },

    selectAll: () => {
      const { selectedItems, items } = get();
      if (selectedItems.size === items.length) {
        set({ selectedItems: new Set() });
      } else {
        set({ selectedItems: new Set(items.map(i => i.id)) });
      }
    },

    clearSelection: () => set({ selectedItems: new Set() }),

    // --- Modal control ---

    openModal: (name, value?) => {
      const modals = { ...get().modals };
      if (name === 'deleteConfirm') {
        modals.deleteConfirm = value ?? null;
      } else if (name === 'actionItemsResult') {
        modals.actionItemsResult = value ?? null;
      } else {
        (modals as any)[name] = value !== undefined ? value : true;
      }
      set({ modals });
    },

    closeModal: (name) => {
      const modals = { ...get().modals };
      if (name === 'deleteConfirm') {
        modals.deleteConfirm = null;
      } else if (name === 'actionItemsResult') {
        modals.actionItemsResult = null;
      } else {
        (modals as any)[name] = false;
      }
      set({ modals });
    },

    // --- Form setters ---

    setEditTitle: (title) => set({ editTitle: title }),
    setEditContent: (content) => set({ editContent: content }),
    setNewCollectionName: (name) => set({ newCollectionName: name }),
    setNewCollectionColor: (color) => set({ newCollectionColor: color }),
    setNewCollectionIcon: (icon) => set({ newCollectionIcon: icon }),
    setNewFolderName: (name) => set({ newFolderName: name }),
    setNewFolderRules: (rules) => set({ newFolderRules: rules }),
    setNewFolderOperator: (op) => set({ newFolderOperator: op }),
    setContactSearch: (search) => set({ contactSearch: search }),
    setNewTag: (tag) => set({ newTag: tag }),
    setBulkTagValue: (value) => set({ bulkTagValue: value }),
    setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
    setTtsLoading: (loading) => set({ ttsLoading: loading }),

    // --- Business logic handlers ---

    confirmDelete: async () => {
      const { modals, selectedItem } = get();
      const deleteId = modals.deleteConfirm;
      if (!deleteId) return;

      // Soft delete (sets deleted_at timestamp, item disappears from queries)
      await archiveService.deleteArchive(deleteId);
      await get().refreshData();
      if (selectedItem?.id === deleteId) {
        set({ selectedItem: null });
      }
      set({ modals: { ...get().modals, deleteConfirm: null } });

      // Schedule permanent hard delete after 5 seconds
      let undone = false;
      const timer = setTimeout(async () => {
        if (!undone) {
          await archiveService.permanentlyDeleteArchive(deleteId);
        }
      }, 5500);

      // Show undo toast
      toast(
        (t) => `Item deleted. Tap to undo.`,
        {
          duration: 5000,
          style: { cursor: 'pointer' },
          onClick: async () => {
            undone = true;
            clearTimeout(timer);
            toast.dismiss();
            await archiveService.restoreArchive(deleteId);
            await get().refreshData();
            toast.success('Item restored!', { duration: 2000 });
          },
        } as any
      );
    },

    handleToggleStar: async (id: string) => {
      await archiveService.toggleStar(id);
      await get().refreshData();
    },

    handleExportToDrive: async (item: ArchiveItem) => {
      const { driveConnected, exporting } = get();
      if (!driveConnected) {
        alert('Please connect your Google account first in Settings.');
        return;
      }
      if (exporting) return;

      set({ exporting: true });
      try {
        const result = await googleDriveService.exportArchiveItem(item);
        if (result.success) {
          alert('Successfully exported to Google Drive!');
          await get().refreshData();
        } else {
          alert(`Export failed: ${result.error}`);
        }
      } finally {
        set({ exporting: false });
      }
    },

    handleShare: async (item: ArchiveItem) => {
      const shareData = {
        title: item.title,
        text: item.content.substring(0, 500) + (item.content.length > 500 ? '...' : ''),
      };

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          flashSuccess(set, 'Shared successfully!');
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            set({ modals: { ...get().modals, share: true } });
          }
        }
      } else {
        set({ modals: { ...get().modals, share: true } });
      }
    },

    handleShareTo: async (platform: string, item: ArchiveItem) => {
      const text = encodeURIComponent(item.title + '\n\n' + item.content.substring(0, 280));
      const title = encodeURIComponent(item.title);

      let shareUrl = '';

      switch (platform) {
        case 'email':
          shareUrl = `mailto:?subject=${title}&body=${text}`;
          break;
        case 'twitter':
          shareUrl = `https://twitter.com/intent/tweet?text=${text}`;
          break;
        case 'linkedin':
          shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${text}`;
          break;
        case 'facebook':
          shareUrl = `https://www.facebook.com/sharer/sharer.php?quote=${text}`;
          break;
        case 'whatsapp':
          shareUrl = `https://wa.me/?text=${text}`;
          break;
        case 'telegram':
          shareUrl = `https://t.me/share/url?text=${text}`;
          break;
        case 'sms':
          shareUrl = `sms:?body=${text}`;
          break;
        case 'copy':
          await navigator.clipboard.writeText(item.title + '\n\n' + item.content);
          flashSuccess(set, 'Copied to clipboard!');
          set({ modals: { ...get().modals, share: false } });
          return;
        case 'download': {
          const blob = new Blob([item.title + '\n\n' + item.content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${item.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          flashSuccess(set, 'Downloaded!');
          set({ modals: { ...get().modals, share: false } });
          return;
        }
      }

      if (shareUrl) {
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
        set({ modals: { ...get().modals, share: false } });
      }
    },

    handleStartEdit: () => {
      const { selectedItem } = get();
      if (!selectedItem) return;
      set({
        editTitle: selectedItem.title,
        editContent: selectedItem.content,
        isEditing: true,
      });
    },

    handleSaveEdit: async () => {
      const { selectedItem, editTitle, editContent } = get();
      if (!selectedItem) return;
      try {
        await archiveService.updateArchive(selectedItem.id, {
          title: editTitle,
          content: editContent,
        });
        set({ isEditing: false });
        flashSuccess(set, 'Changes saved!');
        await get().refreshData();
        set({ selectedItem: { ...selectedItem, title: editTitle, content: editContent } });
      } catch (error) {
        console.error('Failed to save:', error);
        alert('Failed to save changes');
      }
    },

    handleTogglePin: async () => {
      const { selectedItem } = get();
      if (!selectedItem) return;
      try {
        await archiveService.togglePin(selectedItem.id);
        flashSuccess(set, selectedItem.pinned ? 'Unpinned!' : 'Pinned!');
        await get().refreshData();
      } catch (error) {
        console.error('Failed to toggle pin:', error);
      }
    },

    handleAddToCollectionTool: async (collectionId: string) => {
      const { selectedItem } = get();
      if (!selectedItem) return;
      try {
        await archiveService.addToCollection(selectedItem.id, collectionId);
        set({ modals: { ...get().modals, collectionPicker: false } });
        flashSuccess(set, 'Added to collection!');
        await get().refreshData();
      } catch (error) {
        console.error('Failed to add to collection:', error);
      }
    },

    handleAddTag: async () => {
      const { selectedItem, newTag } = get();
      if (!selectedItem || !newTag.trim()) return;
      try {
        const updatedTags = [...(selectedItem.tags || []), newTag.trim()];
        await archiveService.updateArchive(selectedItem.id, { tags: updatedTags });
        set({ newTag: '' });
        flashSuccess(set, 'Tag added!');
        await get().refreshData();
        set({ selectedItem: { ...selectedItem, tags: updatedTags } });
      } catch (error) {
        console.error('Failed to add tag:', error);
      }
    },

    handleRemoveTag: async (tagToRemove: string) => {
      const { selectedItem } = get();
      if (!selectedItem) return;
      try {
        const updatedTags = (selectedItem.tags || []).filter(t => t !== tagToRemove);
        await archiveService.updateArchive(selectedItem.id, { tags: updatedTags });
        flashSuccess(set, 'Tag removed!');
        await get().refreshData();
        set({ selectedItem: { ...selectedItem, tags: updatedTags } });
      } catch (error) {
        console.error('Failed to remove tag:', error);
      }
    },

    handleSummarize: async () => {
      const { selectedItem } = get();
      if (!selectedItem) return;
      set({ aiProcessing: 'summarize' });
      try {
        const summary = await archiveService.generateSummary(selectedItem.id);
        await get().refreshData();
        set({ selectedItem: { ...selectedItem, aiSummary: summary } });
        flashSuccess(set, 'Summary generated!');
      } catch (error) {
        console.error('Failed to summarize:', error);
        alert('Failed to generate summary');
      } finally {
        set({ aiProcessing: null });
      }
    },

    handleExtractActions: async () => {
      const { selectedItem } = get();
      if (!selectedItem) return;
      set({ aiProcessing: 'actions' });
      try {
        const actions = await archiveService.extractActionItems(selectedItem.id);
        flashSuccess(set, `Extracted ${actions.length} action items!`);
        set({ modals: { ...get().modals, actionItemsResult: actions } });
      } catch (error) {
        console.error('Failed to extract actions:', error);
        alert('Failed to extract action items');
      } finally {
        set({ aiProcessing: null });
      }
    },

    handleFindRelated: async () => {
      const { selectedItem } = get();
      if (!selectedItem) return;
      set({ aiProcessing: 'related' });
      try {
        const related = await archiveService.getRelatedItems(selectedItem.id);
        set({ relatedItems: related });
        flashSuccess(set, `Found ${related.length} related items!`);
      } catch (error) {
        console.error('Failed to find related:', error);
      } finally {
        set({ aiProcessing: null });
      }
    },

    handleTranslate: async (targetLanguage: string) => {
      const { selectedItem } = get();
      if (!selectedItem) return;
      set({ aiProcessing: 'translate', modals: { ...get().modals, translate: false } });
      try {
        const translated = await archiveService.translateContent(selectedItem.id, targetLanguage);
        flashSuccess(set, 'Translation complete!');
        alert(`Translated content:\n\n${translated}`);
      } catch (error) {
        console.error('Failed to translate:', error);
        alert('Failed to translate content');
      } finally {
        set({ aiProcessing: null });
      }
    },

    handleSendToEmail: () => {
      const { selectedItem } = get();
      if (!selectedItem) return;
      const subject = encodeURIComponent(selectedItem.title);
      const body = encodeURIComponent(selectedItem.content);
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    },

    handleCreateTask: async () => {
      const { selectedItem } = get();
      if (!selectedItem) return;
      try {
        await archiveService.createTaskFromArchive(selectedItem.id);
        flashSuccess(set, 'Task created!');
      } catch (error) {
        console.error('Failed to create task:', error);
        const taskText = `[ ] ${selectedItem.title}\n\nFrom archive: ${selectedItem.date.toLocaleDateString()}`;
        await navigator.clipboard.writeText(taskText);
        flashSuccess(set, 'Task copied to clipboard!');
      }
    },

    handleAddToCalendar: async () => {
      const { selectedItem } = get();
      if (!selectedItem) return;

      try {
        const isConnected = await googleCalendarService.isConnected();

        if (isConnected) {
          const startDate = new Date();
          startDate.setHours(startDate.getHours() + 1, 0, 0, 0);
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

          const event = await googleCalendarService.createEvent({
            title: selectedItem.title,
            description: selectedItem.content.substring(0, 2000),
            start: startDate,
            end: endDate,
            allDay: false,
          });

          flashSuccess(set, 'Added to your Pulse Calendar!');
          console.log('[Archives] Calendar event created:', event.id);
        } else {
          const title = encodeURIComponent(selectedItem.title);
          const details = encodeURIComponent(selectedItem.content.substring(0, 500));
          const date = selectedItem.date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          const endDateStr = new Date(selectedItem.date.getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${date}/${endDateStr}`;
          window.open(googleCalUrl, '_blank');
          flashSuccess(set, 'Opening Google Calendar...');
        }
      } catch (error) {
        console.error('[Archives] Failed to add to calendar:', error);
        const title = encodeURIComponent(selectedItem.title);
        const details = encodeURIComponent(selectedItem.content.substring(0, 500));
        const date = selectedItem.date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const endDateStr = new Date(selectedItem.date.getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${date}/${endDateStr}`;
        window.open(googleCalUrl, '_blank');
      }
    },

    handleLinkToContact: async (contactId: string) => {
      const { selectedItem } = get();
      if (!selectedItem) return;
      try {
        await archiveService.linkToContact(selectedItem.id, contactId);
        set({ modals: { ...get().modals, contactPicker: false } });
        flashSuccess(set, 'Linked to contact!');
        await get().refreshData();
      } catch (error) {
        console.error('Failed to link to contact:', error);
      }
    },

    handlePrint: () => {
      window.print();
    },

    handleFullscreen: () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
        set({ isFullscreen: true });
      } else {
        document.exitFullscreen?.();
        set({ isFullscreen: false });
      }
    },

    handleShowHistory: async () => {
      const { selectedItem } = get();
      if (!selectedItem) return;

      try {
        const history = await archiveService.getVersionHistory(selectedItem.id);
        set({ versionHistory: history });
      } catch (error) {
        console.error('[Archives] Failed to load version history:', error);
        set({
          versionHistory: [
            {
              id: 'current',
              date: new Date(),
              action: 'Current version',
              user: 'You',
              content: selectedItem.content,
              title: selectedItem.title,
            },
            {
              id: 'created',
              date: selectedItem.date,
              action: 'Created',
              user: 'System',
              content: selectedItem.content,
              title: selectedItem.title,
            },
          ],
        });
      }
      set({ modals: { ...get().modals, history: true } });
    },

    handleRestoreVersion: async (version: VersionHistoryItem) => {
      const { selectedItem } = get();
      if (!selectedItem || !version.content) return;

      set({ restoringVersion: version.id });
      try {
        await archiveService.updateArchive(selectedItem.id, {
          title: version.title || selectedItem.title,
          content: version.content,
        });

        flashSuccess(set, 'Version restored!');
        await get().refreshData();

        set({
          selectedItem: {
            ...selectedItem,
            title: version.title || selectedItem.title,
            content: version.content,
          },
          modals: { ...get().modals, history: false },
        });
      } catch (error) {
        console.error('[Archives] Failed to restore version:', error);
      } finally {
        set({ restoringVersion: null });
      }
    },

    handleBulkExport: async () => {
      const { selectedItems, items } = get();
      if (selectedItems.size === 0) return;

      const _itemsToExport = items.filter(i => selectedItems.has(i.id));
      set({ exportProgress: { current: 0, total: _itemsToExport.length } });

      const result = await archiveService.bulkExportToDrive(
        Array.from(selectedItems),
        (current, total) => set({ exportProgress: { current, total } })
      );

      set({ exportProgress: null, selectedItems: new Set() });
      alert(`Exported ${result.success} items. ${result.failed} failed.`);
      await get().refreshData();
    },

    handleSelectItem: (id: string) => {
      const newSelected = new Set(get().selectedItems);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      set({ selectedItems: newSelected });
    },

    handleSelectAll: () => {
      const { selectedItems, items } = get();
      if (selectedItems.size === items.length) {
        set({ selectedItems: new Set() });
      } else {
        set({ selectedItems: new Set(items.map(i => i.id)) });
      }
    },

    handleAddToCollection: async (collectionId: string) => {
      const { selectedItems } = get();
      if (selectedItems.size === 0) return;
      await archiveService.bulkAddToCollection(Array.from(selectedItems), collectionId);
      set({ selectedItems: new Set() });
      await get().refreshData();
    },

    handleCreateCollection: async () => {
      const { newCollectionName, newCollectionColor, newCollectionIcon } = get();
      if (!newCollectionName.trim()) return;
      await archiveService.createCollection({
        name: newCollectionName.trim(),
        description: '',
        color: newCollectionColor,
        icon: newCollectionIcon,
      });
      await get().loadData();
      set({
        modals: { ...get().modals, createCollection: false },
        newCollectionName: '',
        newCollectionColor: '#ef4444',
        newCollectionIcon: 'fa-folder',
      });
    },

    handleCreateSmartFolder: async () => {
      const { newFolderName, newFolderRules, newFolderOperator } = get();
      if (!newFolderName.trim()) return;
      const validRules = newFolderRules.filter(r => r.value !== '');
      if (validRules.length === 0) return;
      await archiveService.createSmartFolder({
        name: newFolderName.trim(),
        description: '',
        color: '#3b82f6',
        icon: 'fa-wand-magic-sparkles',
        rules: validRules,
        ruleOperator: newFolderOperator,
      });
      await get().loadData();
      set({
        modals: { ...get().modals, createSmartFolder: false },
        newFolderName: '',
        newFolderRules: [{ field: 'type', operator: 'equals', value: '' }],
        newFolderOperator: 'and',
      });
    },

    /**
     * Bulk-delete with deferred commit: optimistically remove the items, return a
     * snapshot + commit/undo handles. The UI layer renders a toast with "Undo"
     * and decides when to commit. After 5s of no undo, the UI calls commit.
     */
    handleBulkDelete: async () => {
      const { selectedItems, items, demoMode, demoItems } = get();
      if (selectedItems.size === 0) return;
      const ids = Array.from(selectedItems);

      const snapshotItems = items.filter(i => ids.includes(i.id));
      const snapshotDemo = demoMode && demoItems ? demoItems.filter(i => ids.includes(i.id)) : null;
      const remainingItems = items.filter(i => !ids.includes(i.id));
      const remainingDemo = demoMode && demoItems ? demoItems.filter(i => !ids.includes(i.id)) : null;

      // Optimistic removal
      set({
        items: remainingItems,
        ...(remainingDemo !== null ? { demoItems: remainingDemo } : {}),
        selectedItems: new Set(),
      });

      let committed = false;
      const undo = () => {
        if (committed) return false;
        committed = true;
        const sortByDate = (a: ArchiveItem, b: ArchiveItem) => {
          const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
          const db = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
          return db - da;
        };
        set({
          items: [...remainingItems, ...snapshotItems].sort(sortByDate),
          ...(snapshotDemo ? { demoItems: [...(remainingDemo || []), ...snapshotDemo].sort(sortByDate) } : {}),
        });
        return true;
      };

      const commit = async () => {
        if (committed) return;
        committed = true;
        if (demoMode) return;
        try {
          await archiveService.bulkDelete(ids);
        } catch (err) {
          // Restore on failure
          set({ items: [...remainingItems, ...snapshotItems] });
          throw err;
        }
      };

      // Stash on a global so the UI layer can pick them up. Cleared on next bulk delete.
      (window as any).__pulseMemoryBulkDelete = { count: ids.length, undo, commit };
    },

    handleBulkTag: async () => {
      const { bulkTagValue, selectedItems } = get();
      if (!bulkTagValue.trim() || selectedItems.size === 0) return;
      await archiveService.bulkAddTags(Array.from(selectedItems), [bulkTagValue.trim()]);
      set({
        bulkTagValue: '',
        modals: { ...get().modals, bulkTag: false },
        selectedItems: new Set(),
      });
      await get().refreshData();
    },

    handleBulkAddToCollection: async (collectionId: string) => {
      const { selectedItems } = get();
      if (selectedItems.size === 0) return;
      await archiveService.bulkAddToCollection(Array.from(selectedItems), collectionId);
      set({
        modals: { ...get().modals, bulkCollection: false },
        selectedItems: new Set(),
      });
      await get().refreshData();
    },
  }))
);
