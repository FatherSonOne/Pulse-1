
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { archiveService } from '../services/archiveService';
import { googleDriveService } from '../services/googleDriveService';
import { googleCalendarService } from '../services/googleCalendarService';
import type { ArchiveItem, ArchiveType, ArchiveCollection, SmartFolder, ArchiveTimelineEvent } from '../types';

interface VersionHistoryItem {
  id: string;
  date: Date;
  action: string;
  user: string;
  content?: string;
  title?: string;
}

type ViewMode = 'list' | 'grid' | 'timeline';
type SidebarMode = 'filters' | 'collections' | 'smart-folders';

const Archives: React.FC = () => {
  // State
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [collections, setCollections] = useState<ArchiveCollection[]>([]);
  const [smartFolders, setSmartFolders] = useState<SmartFolder[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<ArchiveTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ArchiveType | 'all' | 'starred'>('all');
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeSmartFolderId, setActiveSmartFolderId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ArchiveItem | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ArchiveItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('filters');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showSmartFolderModal, setShowSmartFolderModal] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [relatedItems, setRelatedItems] = useState<ArchiveItem[]>([]);
  const [exporting, setExporting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  // Tool states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [showTagModal, setShowTagModal] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aiProcessing, setAiProcessing] = useState<string | null>(null);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load data
  useEffect(() => {
    loadData();
    checkDriveConnection();
  }, []);

  useEffect(() => {
    refreshData();
  }, [query, activeFilter, activeCollectionId, activeSmartFolderId]);

  useEffect(() => {
    if (viewMode === 'timeline') {
      loadTimelineEvents();
    }
  }, [viewMode]);

  useEffect(() => {
    if (selectedItem) {
      loadRelatedItems(selectedItem.id);
    }
  }, [selectedItem]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [collectionsData, smartFoldersData] = await Promise.all([
        archiveService.getCollections(),
        archiveService.getSmartFolders(),
      ]);
      setCollections(collectionsData);
      setSmartFolders(smartFoldersData);
      await refreshData();
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    let data: ArchiveItem[] = [];

    if (activeSmartFolderId) {
      data = await archiveService.getSmartFolderItems(activeSmartFolderId);
    } else if (activeCollectionId) {
      data = await archiveService.getArchives({ collectionId: activeCollectionId });
    } else if (activeFilter === 'starred') {
      data = await archiveService.getArchives({ starred: true });
    } else if (activeFilter !== 'all') {
      data = await archiveService.getArchives({ type: activeFilter as ArchiveType });
    } else if (query) {
      const result = await archiveService.searchArchives(query);
      data = result.items;
    } else {
      data = await archiveService.getArchives();
    }

    setItems(data);
  };

  const loadTimelineEvents = async () => {
    const events = await archiveService.getTimelineEvents({ limit: 100 });
    setTimelineEvents(events);
  };

  const loadRelatedItems = async (archiveId: string) => {
    const related = await archiveService.getRelatedItems(archiveId);
    setRelatedItems(related);
  };

  const checkDriveConnection = async () => {
    const connected = await googleDriveService.isConnected();
    setDriveConnected(connected);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this archive item?')) {
      await archiveService.deleteArchive(id);
      await refreshData();
      if (selectedItem?.id === id) setSelectedItem(null);
    }
  };

  const handleToggleStar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await archiveService.toggleStar(id);
    await refreshData();
  };

  const handleExportToDrive = async (item: ArchiveItem) => {
    if (!driveConnected) {
      alert('Please connect your Google account first in Settings.');
      return;
    }

    if (exporting) return; // Prevent multiple clicks

    setExporting(true);
    try {
      const result = await googleDriveService.exportArchiveItem(item);
      if (result.success) {
        alert('Successfully exported to Google Drive!');
        await refreshData();
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } finally {
      setExporting(false);
    }
  };

  // Share functionality with Web Share API and fallbacks
  const handleShare = async (item: ArchiveItem) => {
    const shareData = {
      title: item.title,
      text: item.content.substring(0, 500) + (item.content.length > 500 ? '...' : ''),
      // For web apps, you'd typically share a URL to the content
      // url: `${window.location.origin}/archives/${item.id}`
    };

    // Check if Web Share API is available (works on mobile + some desktop browsers)
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setShareSuccess('Shared successfully!');
        setTimeout(() => setShareSuccess(null), 2000);
      } catch (err) {
        // User cancelled or share failed - show modal as fallback
        if ((err as Error).name !== 'AbortError') {
          setShowShareModal(true);
        }
      }
    } else {
      // Web Share API not available - show share modal with options
      setShowShareModal(true);
    }
  };

  const handleShareTo = async (platform: string, item: ArchiveItem) => {
    const text = encodeURIComponent(item.title + '\n\n' + item.content.substring(0, 280));
    const title = encodeURIComponent(item.title);
    // const url = encodeURIComponent(`${window.location.origin}/archives/${item.id}`);

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
        setShareSuccess('Copied to clipboard!');
        setTimeout(() => setShareSuccess(null), 2000);
        setShowShareModal(false);
        return;
      case 'download':
        // Download as text file
        const blob = new Blob([item.title + '\n\n' + item.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShareSuccess('Downloaded!');
        setTimeout(() => setShareSuccess(null), 2000);
        setShowShareModal(false);
        return;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
      setShowShareModal(false);
    }
  };

  // ============= TOOLBAR TOOL HANDLERS =============

  // Edit Tool
  const handleStartEdit = () => {
    if (!selectedItem) return;
    setEditTitle(selectedItem.title);
    setEditContent(selectedItem.content);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    try {
      await archiveService.updateArchive(selectedItem.id, {
        title: editTitle,
        content: editContent
      });
      setIsEditing(false);
      setShareSuccess('Changes saved!');
      setTimeout(() => setShareSuccess(null), 2000);
      await refreshData();
      setSelectedItem({ ...selectedItem, title: editTitle, content: editContent });
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save changes');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle('');
    setEditContent('');
  };

  // Pin Tool
  const handleTogglePin = async () => {
    if (!selectedItem) return;
    try {
      await archiveService.togglePin(selectedItem.id);
      setShareSuccess(selectedItem.pinned ? 'Unpinned!' : 'Pinned!');
      setTimeout(() => setShareSuccess(null), 2000);
      await refreshData();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  // Add to Collection
  const handleAddToCollectionTool = async (collectionId: string) => {
    if (!selectedItem) return;
    try {
      await archiveService.addToCollection(selectedItem.id, collectionId);
      setShowCollectionPicker(false);
      setShareSuccess('Added to collection!');
      setTimeout(() => setShareSuccess(null), 2000);
      await refreshData();
    } catch (error) {
      console.error('Failed to add to collection:', error);
    }
  };

  // Add Tag
  const handleAddTag = async () => {
    if (!selectedItem || !newTag.trim()) return;
    try {
      const updatedTags = [...(selectedItem.tags || []), newTag.trim()];
      await archiveService.updateArchive(selectedItem.id, { tags: updatedTags });
      setNewTag('');
      setShareSuccess('Tag added!');
      setTimeout(() => setShareSuccess(null), 2000);
      await refreshData();
      setSelectedItem({ ...selectedItem, tags: updatedTags });
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedItem) return;
    try {
      const updatedTags = (selectedItem.tags || []).filter(t => t !== tagToRemove);
      await archiveService.updateArchive(selectedItem.id, { tags: updatedTags });
      setShareSuccess('Tag removed!');
      setTimeout(() => setShareSuccess(null), 2000);
      await refreshData();
      setSelectedItem({ ...selectedItem, tags: updatedTags });
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  // AI Summarize
  const handleSummarize = async () => {
    if (!selectedItem) return;
    setAiProcessing('summarize');
    try {
      const summary = await archiveService.generateSummary(selectedItem.id);
      await refreshData();
      setSelectedItem({ ...selectedItem, aiSummary: summary });
      setShareSuccess('Summary generated!');
      setTimeout(() => setShareSuccess(null), 2000);
    } catch (error) {
      console.error('Failed to summarize:', error);
      alert('Failed to generate summary');
    } finally {
      setAiProcessing(null);
    }
  };

  // Extract Action Items
  const handleExtractActions = async () => {
    if (!selectedItem) return;
    setAiProcessing('actions');
    try {
      const actions = await archiveService.extractActionItems(selectedItem.id);
      setShareSuccess(`Extracted ${actions.length} action items!`);
      setTimeout(() => setShareSuccess(null), 2000);
      alert(`Extracted action items:\n${actions.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}`);
    } catch (error) {
      console.error('Failed to extract actions:', error);
      alert('Failed to extract action items');
    } finally {
      setAiProcessing(null);
    }
  };

  // Find Related
  const handleFindRelated = async () => {
    if (!selectedItem) return;
    setAiProcessing('related');
    try {
      const related = await archiveService.getRelatedItems(selectedItem.id);
      setRelatedItems(related);
      setShareSuccess(`Found ${related.length} related items!`);
      setTimeout(() => setShareSuccess(null), 2000);
    } catch (error) {
      console.error('Failed to find related:', error);
    } finally {
      setAiProcessing(null);
    }
  };

  // Translate
  const handleTranslate = async (targetLanguage: string) => {
    if (!selectedItem) return;
    setAiProcessing('translate');
    setShowTranslateModal(false);
    try {
      const translated = await archiveService.translateContent(selectedItem.id, targetLanguage);
      setShareSuccess('Translation complete!');
      setTimeout(() => setShareSuccess(null), 2000);
      alert(`Translated content:\n\n${translated}`);
    } catch (error) {
      console.error('Failed to translate:', error);
      alert('Failed to translate content');
    } finally {
      setAiProcessing(null);
    }
  };

  // Send to Email
  const handleSendToEmail = () => {
    if (!selectedItem) return;
    const subject = encodeURIComponent(selectedItem.title);
    const body = encodeURIComponent(selectedItem.content);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  // Create Task
  const handleCreateTask = async () => {
    if (!selectedItem) return;
    try {
      await archiveService.createTaskFromArchive(selectedItem.id);
      setShareSuccess('Task created!');
      setTimeout(() => setShareSuccess(null), 2000);
    } catch (error) {
      console.error('Failed to create task:', error);
      const taskText = `[ ] ${selectedItem.title}\n\nFrom archive: ${selectedItem.date.toLocaleDateString()}`;
      await navigator.clipboard.writeText(taskText);
      setShareSuccess('Task copied to clipboard!');
      setTimeout(() => setShareSuccess(null), 2000);
    }
  };

  // Add to Calendar - Uses Pulse's integrated Google Calendar
  const handleAddToCalendar = async () => {
    if (!selectedItem) return;

    try {
      // Check if Google Calendar is connected
      const isConnected = await googleCalendarService.isConnected();

      if (isConnected) {
        // Use Pulse's Google Calendar integration
        const startDate = new Date();
        startDate.setHours(startDate.getHours() + 1, 0, 0, 0); // Round to next hour
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour event

        const event = await googleCalendarService.createEvent({
          title: selectedItem.title,
          description: selectedItem.content.substring(0, 2000), // Google Calendar description limit
          start: startDate,
          end: endDate,
          allDay: false,
        });

        setShareSuccess('Added to your Pulse Calendar!');
        setTimeout(() => setShareSuccess(null), 2000);
        console.log('[Archives] Calendar event created:', event.id);
      } else {
        // Fallback to external Google Calendar URL if not connected
        const title = encodeURIComponent(selectedItem.title);
        const details = encodeURIComponent(selectedItem.content.substring(0, 500));
        const date = selectedItem.date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const endDate = new Date(selectedItem.date.getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${date}/${endDate}`;
        window.open(googleCalUrl, '_blank');
        setShareSuccess('Opening Google Calendar...');
        setTimeout(() => setShareSuccess(null), 2000);
      }
    } catch (error) {
      console.error('[Archives] Failed to add to calendar:', error);
      // Fallback to external URL on error
      const title = encodeURIComponent(selectedItem.title);
      const details = encodeURIComponent(selectedItem.content.substring(0, 500));
      const date = selectedItem.date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const endDate = new Date(selectedItem.date.getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${date}/${endDate}`;
      window.open(googleCalUrl, '_blank');
    }
  };

  // Link to Contact
  const handleLinkToContact = async (contactId: string) => {
    if (!selectedItem) return;
    try {
      await archiveService.linkToContact(selectedItem.id, contactId);
      setShowContactPicker(false);
      setShareSuccess('Linked to contact!');
      setTimeout(() => setShareSuccess(null), 2000);
      await refreshData();
    } catch (error) {
      console.error('Failed to link to contact:', error);
    }
  };

  // Print - Uses CSS print styles instead of document.write
  const handlePrint = () => {
    window.print();
  };

  // Full Screen
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Text-to-Speech - Uses OpenAI TTS API with fallback to browser speech
  const handleTextToSpeech = async () => {
    if (!selectedItem) return;

    // If already speaking, stop
    if (isSpeaking) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setTtsLoading(false);
      return;
    }

    const openaiApiKey = localStorage.getItem('openai_api_key') || '';

    // If OpenAI API key is available, use OpenAI TTS
    if (openaiApiKey) {
      setTtsLoading(true);
      try {
        const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: selectedItem.content.substring(0, 4096), // OpenAI TTS limit
            voice: 'alloy', // Options: alloy, echo, fable, onyx, nova, shimmer
            response_format: 'mp3',
          }),
        });

        if (!ttsResponse.ok) {
          throw new Error(`TTS API error: ${ttsResponse.status}`);
        }

        const audioBlob = await ttsResponse.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Clean up previous audio
        if (audioRef.current) {
          audioRef.current.pause();
          URL.revokeObjectURL(audioRef.current.src);
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
        };

        setTtsLoading(false);
        setIsSpeaking(true);
        await audio.play();
        return;
      } catch (error) {
        console.error('[Archives] OpenAI TTS failed, falling back to browser:', error);
        setTtsLoading(false);
        // Fall through to browser speech synthesis
      }
    }

    // Fallback to browser speech synthesis
    const utterance = new SpeechSynthesisUtterance(selectedItem.content);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  // Version History
  const handleShowHistory = async () => {
    if (!selectedItem) return;

    // Load version history from archiveService
    try {
      const history = await archiveService.getVersionHistory(selectedItem.id);
      setVersionHistory(history);
    } catch (error) {
      console.error('[Archives] Failed to load version history:', error);
      // Create mock history based on archive data if real history not available
      setVersionHistory([
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
      ]);
    }
    setShowHistoryModal(true);
  };

  // Restore a previous version
  const handleRestoreVersion = async (version: VersionHistoryItem) => {
    if (!selectedItem || !version.content) return;

    setRestoringVersion(version.id);
    try {
      await archiveService.updateArchive(selectedItem.id, {
        title: version.title || selectedItem.title,
        content: version.content,
      });

      setShareSuccess('Version restored!');
      setTimeout(() => setShareSuccess(null), 2000);
      await refreshData();

      // Update selected item with restored content
      setSelectedItem({
        ...selectedItem,
        title: version.title || selectedItem.title,
        content: version.content,
      });

      setShowHistoryModal(false);
    } catch (error) {
      console.error('[Archives] Failed to restore version:', error);
    } finally {
      setRestoringVersion(null);
    }
  };

  const handleBulkExport = async () => {
    if (selectedItems.size === 0) return;

    const itemsToExport = items.filter(i => selectedItems.has(i.id));
    setExportProgress({ current: 0, total: itemsToExport.length });

    const result = await archiveService.bulkExportToDrive(
      Array.from(selectedItems),
      (current, total) => setExportProgress({ current, total })
    );

    setExportProgress(null);
    setSelectedItems(new Set());
    alert(`Exported ${result.success} items. ${result.failed} failed.`);
    await refreshData();
  };

  const handleSelectItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    if (selectedItems.size === 0) return;
    await archiveService.bulkAddToCollection(Array.from(selectedItems), collectionId);
    setSelectedItems(new Set());
    await refreshData();
  };

  const getTypeConfig = (type: ArchiveType) => {
    switch (type) {
      case 'transcript':
        return { icon: 'fa-comments', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
      case 'meeting_note':
        return { icon: 'fa-handshake', color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
      case 'vox_transcript':
        return { icon: 'fa-walkie-talkie', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' };
      case 'journal':
        return { icon: 'fa-book', color: 'text-zinc-600 dark:text-zinc-500', bg: 'bg-zinc-400/10', border: 'border-zinc-400/20' };
      case 'summary':
        return { icon: 'fa-wand-magic-sparkles', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
      case 'decision_log':
        return { icon: 'fa-gavel', color: 'text-zinc-700 dark:text-zinc-300', bg: 'bg-zinc-300/10', border: 'border-zinc-300/20' };
      case 'artifact':
        return { icon: 'fa-cube', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' };
      case 'image':
        return { icon: 'fa-image', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      case 'video':
        return { icon: 'fa-video', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
      case 'document':
        return { icon: 'fa-file-lines', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      case 'war_room_session':
        return { icon: 'fa-shield-halved', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
      default:
        return { icon: 'fa-file', color: 'text-zinc-600 dark:text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
    }
  };

  const getTypeLabel = (type: ArchiveType) => type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

  const groupedItems = items.reduce((acc, item) => {
    const dateKey = item.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, ArchiveItem[]>);

  const filterOptions: Array<ArchiveType | 'all' | 'starred'> = [
    'all', 'starred', 'war_room_session', 'transcript', 'meeting_note', 'vox_transcript', 'decision_log', 'journal', 'summary', 'artifact', 'image', 'video', 'document'
  ];

  // Group timeline events by month
  const timelineByMonth = timelineEvents.reduce((acc, event) => {
    const monthKey = event.date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(event);
    return acc;
  }, {} as Record<string, ArchiveTimelineEvent[]>);

  // Calculate statistics
  const stats = React.useMemo(() => {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const byType: Record<string, number> = {};
      let starredCount = 0;
      let thisWeekCount = 0;
      let thisMonthCount = 0;
      let pinnedCount = 0;
      const allTags = new Set<string>();

      if (items && Array.isArray(items)) {
        items.forEach(item => {
          if (!item) return;
          byType[item.type] = (byType[item.type] || 0) + 1;
          if (item.starred) starredCount++;
          if (item.pinned) pinnedCount++;
          // Compare dates properly - ensure item.date is a Date object
          try {
            const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
            if (itemDate && !isNaN(itemDate.getTime())) {
              if (itemDate >= weekAgo) thisWeekCount++;
              if (itemDate >= monthAgo) thisMonthCount++;
            }
          } catch (e) {
            // Skip invalid dates
          }
          if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => allTags.add(tag));
          }
          if (item.aiTags && Array.isArray(item.aiTags)) {
            item.aiTags.forEach(tag => allTags.add(tag));
          }
        });
      }

      return {
        total: items?.length || 0,
        byType,
        starred: starredCount,
        thisWeek: thisWeekCount,
        thisMonth: thisMonthCount,
        pinned: pinnedCount,
        uniqueTags: allTags.size,
      };
    } catch (error) {
      console.error('[Archives] Error calculating stats:', error);
      return {
        total: 0,
        byType: {},
        starred: 0,
        thisWeek: 0,
        thisMonth: 0,
        pinned: 0,
        uniqueTags: 0,
      };
    }
  }, [items]);

  // Get preview item (hovered or first item)
  const previewItem = hoveredItem || (items && items.length > 0 ? items[0] : null) || null;

  return (
    <div className="h-full flex flex-col md:flex-row bg-white dark:bg-black rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in shadow-2xl">
      {/* Sidebar */}
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
                <i className="fa-solid fa-list text-xs"></i>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${viewMode === 'grid' ? 'bg-red-500 text-white' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                title="Grid view"
              >
                <i className="fa-solid fa-grip text-xs"></i>
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${viewMode === 'timeline' ? 'bg-red-500 text-white' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                title="Timeline view"
              >
                <i className="fa-solid fa-timeline text-xs"></i>
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search archives..."
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-red-500/50 transition"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-zinc-400 dark:text-zinc-600"></i>
          </div>

          {/* Sidebar Mode Tabs */}
          <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl mb-3">
            <button
              onClick={() => { setSidebarMode('filters'); setActiveCollectionId(null); setActiveSmartFolderId(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${sidebarMode === 'filters' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <i className="fa-solid fa-filter mr-1.5"></i> Filters
            </button>
            <button
              onClick={() => { setSidebarMode('collections'); setActiveFilter('all'); setActiveSmartFolderId(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${sidebarMode === 'collections' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <i className="fa-solid fa-folder mr-1.5"></i> Collections
            </button>
            <button
              onClick={() => { setSidebarMode('smart-folders'); setActiveFilter('all'); setActiveCollectionId(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${sidebarMode === 'smart-folders' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <i className="fa-solid fa-wand-magic-sparkles mr-1.5"></i> Smart
            </button>
          </div>

          {/* Filter Icon Buttons / Collections / Smart Folders */}
          {sidebarMode === 'filters' && (
            <div className="grid grid-cols-6 gap-1.5">
              {filterOptions.map(f => {
                const getFilterIcon = (filter: typeof f) => {
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
                const getFilterLabel = (filter: typeof f) => {
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
                    case 'war_room_session': return 'War Room Sessions';
                    default: return filter;
                  }
                };
                const getFilterShortLabel = (filter: typeof f) => {
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
                    case 'war_room_session': return 'War Room';
                    default: return filter;
                  }
                };
                return (
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
                );
              })}
            </div>
          )}

          {sidebarMode === 'collections' && (
            <div className="space-y-1">
              <button
                onClick={() => setActiveCollectionId(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${!activeCollectionId ? 'bg-red-500/10 text-red-500' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
              >
                <i className="fa-solid fa-inbox"></i>
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
                onClick={() => setShowCollectionModal(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              >
                <i className="fa-solid fa-plus"></i>
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
                onClick={() => setShowSmartFolderModal(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              >
                <i className="fa-solid fa-plus"></i>
                <span>New Smart Folder</span>
              </button>
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedItems.size > 0 && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
            <span className="text-xs text-red-500 font-medium">{selectedItems.size} selected</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkExport}
                className="px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 rounded transition"
                disabled={!driveConnected}
              >
                <i className="fa-brands fa-google-drive mr-1"></i> Export
              </button>
              <button
                onClick={() => setSelectedItems(new Set())}
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
            // Timeline View
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-800"></div>
              {Object.entries(timelineByMonth).map(([month, events]) => (
                <div key={month} className="mb-6">
                  <div className="relative pl-10 mb-3">
                    <div className="absolute left-2.5 w-3 h-3 rounded-full bg-red-500"></div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{month}</h3>
                  </div>
                  {events.map(event => {
                    const config = getTypeConfig(event.type);
                    return (
                      <div
                        key={event.id}
                        onClick={() => archiveService.getArchive(event.archiveId).then(setSelectedItem)}
                        className="relative pl-10 mb-2 cursor-pointer group"
                      >
                        <div className="absolute left-3 w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-red-500 transition"></div>
                        <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-red-500/30 transition">
                          <div className="flex items-center gap-2 mb-1">
                            <i className={`fa-solid ${config.icon} ${config.color} text-xs`}></i>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {event.date.toLocaleDateString()} {event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h4 className="text-sm font-medium text-zinc-900 dark:text-white">{event.title}</h4>
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{event.preview}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : viewMode === 'list' ? (
            // List View
            Object.entries(groupedItems).map(([dateLabel, groupItems]) => (
              <div key={dateLabel} className="mb-6">
                <div className="px-3 py-2 text-[10px] font-mono text-zinc-500 dark:text-zinc-600 uppercase tracking-widest sticky top-0 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm z-10 flex items-center gap-2">
                  <div className="w-1 h-1 bg-red-500 rounded-full"></div>
                  {dateLabel}
                </div>
                {(groupItems as ArchiveItem[]).map(item => {
                  const config = getTypeConfig(item.type);
                  const isSelected = selectedItems.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => { setSelectedItem(item); setHoveredItem(null); }}
                      onMouseEnter={() => setHoveredItem(item)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`p-4 rounded-xl cursor-pointer transition-all mb-2 border group ${
                        selectedItem?.id === item.id
                          ? 'bg-red-500/5 border-red-500/30'
                          : isSelected
                          ? 'bg-blue-500/5 border-blue-500/30'
                          : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Selection checkbox */}
                        <button
                          onClick={(e) => handleSelectItem(item.id, e)}
                          className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition ${
                            isSelected
                              ? 'bg-red-500 border-red-500 text-white'
                              : 'border-zinc-300 dark:border-zinc-700 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isSelected && <i className="fa-solid fa-check text-[10px]"></i>}
                        </button>
                        <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                          <i className={`fa-solid ${config.icon} ${config.color} text-sm`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-mono uppercase tracking-wider ${selectedItem?.id === item.id ? 'text-red-400' : 'text-zinc-500 dark:text-zinc-600'}`}>
                              {getTypeLabel(item.type)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {item.starred && <i className="fa-solid fa-star text-amber-500 text-[10px]"></i>}
                              {item.driveFileId && <i className="fa-brands fa-google-drive text-blue-500 text-[10px]"></i>}
                              <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono">
                                {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                          <h3 className="font-medium text-sm text-zinc-900 dark:text-white mb-1 line-clamp-1">{item.title}</h3>
                          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{item.content}</p>
                          {(item.tags?.length > 0 || item.aiTags?.length) && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {item.tags?.slice(0, 2).map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] text-zinc-500 font-mono">
                                  #{tag}
                                </span>
                              ))}
                              {item.aiTags?.slice(0, 2).map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 bg-red-500/10 rounded text-[9px] text-red-500 font-mono">
                                  <i className="fa-solid fa-wand-magic-sparkles mr-0.5"></i>{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            // Grid View
            <div className="grid grid-cols-2 gap-3">
              {items.map(item => {
                const config = getTypeConfig(item.type);
                const isSelected = selectedItems.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => { setSelectedItem(item); setHoveredItem(null); }}
                    onMouseEnter={() => setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`p-4 rounded-xl cursor-pointer transition-all border group relative ${
                      selectedItem?.id === item.id
                        ? 'bg-red-500/5 border-red-500/30'
                        : isSelected
                        ? 'bg-blue-500/5 border-blue-500/30'
                        : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <button
                      onClick={(e) => handleSelectItem(item.id, e)}
                      className={`absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center transition ${
                        isSelected
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'border-zinc-300 dark:border-zinc-700 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isSelected && <i className="fa-solid fa-check text-[10px]"></i>}
                    </button>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                        <i className={`fa-solid ${config.icon} ${config.color}`}></i>
                      </div>
                      {item.starred && <i className="fa-solid fa-star text-amber-500 text-xs"></i>}
                    </div>
                    <h3 className="font-medium text-xs text-zinc-900 dark:text-white mb-1 line-clamp-2">{item.title}</h3>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono">{item.date.toLocaleDateString()}</span>
                  </div>
                );
              })}
            </div>
          )}

          {items.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-4">
                <i className="fa-solid fa-inbox text-2xl text-zinc-400 dark:text-zinc-700"></i>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-600">No archived items</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-700 mt-1">Items will appear here automatically</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail View */}
      <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 relative">
        {selectedItem ? (
          <div className="flex flex-col h-full animate-fade-in">
            {/* Detail Header */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="text-zinc-500 mb-4 flex items-center gap-2 text-xs hover:text-zinc-900 dark:hover:text-white transition"
                    title="Back to Archives"
                  >
                    <i className="fa-solid fa-arrow-left"></i> Back to Archives
                  </button>

                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    {(() => {
                      const config = getTypeConfig(selectedItem.type);
                      return (
                        <div className={`px-2.5 py-1 rounded-lg ${config.bg} ${config.border} border flex items-center gap-1.5`}>
                          <i className={`fa-solid ${config.icon} ${config.color} text-xs`}></i>
                          <span className={`text-[10px] font-mono uppercase tracking-wider ${config.color}`}>
                            {getTypeLabel(selectedItem.type)}
                          </span>
                        </div>
                      );
                    })()}
                    {selectedItem.sentiment && (
                      <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                        selectedItem.sentiment === 'positive' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                        selectedItem.sentiment === 'negative' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                        'bg-zinc-500/10 border-zinc-500/20 text-zinc-500'
                      }`}>
                        <i className={`fa-solid ${selectedItem.sentiment === 'positive' ? 'fa-face-smile' : selectedItem.sentiment === 'negative' ? 'fa-face-frown' : 'fa-face-meh'} text-xs`}></i>
                        <span className="text-[10px] font-mono uppercase tracking-wider capitalize">{selectedItem.sentiment}</span>
                      </div>
                    )}
                    {selectedItem.driveFileId && (
                      <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-1.5">
                        <i className="fa-brands fa-google-drive text-blue-500 text-xs"></i>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-blue-500">Synced</span>
                      </div>
                    )}
                  </div>

                  <h1 className="text-2xl font-light text-zinc-900 dark:text-white tracking-tight">{selectedItem.title}</h1>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-zinc-500 text-xs font-mono">
                    {selectedItem.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <button
                    onClick={(e) => handleToggleStar(selectedItem.id, e)}
                    className={`p-2 rounded-lg transition ${selectedItem.starred ? 'text-amber-500' : 'text-zinc-400 hover:text-amber-500'}`}
                    title={selectedItem.starred ? 'Unstar' : 'Star'}
                  >
                    <i className={`fa-${selectedItem.starred ? 'solid' : 'regular'} fa-star`}></i>
                  </button>
                </div>
              </div>

              {/* Tags */}
              {(selectedItem.tags?.length > 0 || selectedItem.aiTags?.length) && (
                <div className="flex gap-2 mt-4 flex-wrap">
                  {selectedItem.tags?.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] text-zinc-500 font-mono">
                      #{tag}
                    </span>
                  ))}
                  {selectedItem.aiTags?.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-500 font-mono">
                      <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Document Toolbar */}
              <div className="flex items-center gap-1 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex-wrap">
                {/* Edit & Organize */}
                <button
                  onClick={handleStartEdit}
                  className={`p-2 rounded-lg transition-all ${isEditing ? 'bg-red-500/10 text-red-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                  title="Edit"
                >
                  <i className="fa-solid fa-pen-to-square text-sm"></i>
                </button>
                <button
                  onClick={handleTogglePin}
                  className={`p-2 rounded-lg transition-all ${selectedItem.pinned ? 'bg-amber-500/10 text-amber-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                  title={selectedItem.pinned ? 'Unpin' : 'Pin'}
                >
                  <i className={`fa-solid fa-thumbtack text-sm ${selectedItem.pinned ? '' : 'rotate-45'}`}></i>
                </button>
                <button
                  onClick={() => setShowCollectionPicker(true)}
                  className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  title="Add to Collection"
                >
                  <i className="fa-solid fa-folder-plus text-sm"></i>
                </button>
                <button
                  onClick={() => setShowTagModal(true)}
                  className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  title="Add Tags"
                >
                  <i className="fa-solid fa-tags text-sm"></i>
                </button>

                <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

                {/* AI Tools */}
                <button
                  onClick={handleSummarize}
                  disabled={aiProcessing !== null}
                  className={`p-2 rounded-lg transition-all ${aiProcessing === 'summarize' ? 'bg-purple-500/10 text-purple-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-purple-500 hover:bg-purple-500/10'}`}
                  title="AI Summarize"
                >
                  <i className={`fa-solid fa-wand-magic-sparkles text-sm ${aiProcessing === 'summarize' ? 'animate-pulse' : ''}`}></i>
                </button>
                <button
                  onClick={handleExtractActions}
                  disabled={aiProcessing !== null}
                  className={`p-2 rounded-lg transition-all ${aiProcessing === 'extract' ? 'bg-green-500/10 text-green-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-green-500 hover:bg-green-500/10'}`}
                  title="Extract Action Items"
                >
                  <i className={`fa-solid fa-list-check text-sm ${aiProcessing === 'extract' ? 'animate-pulse' : ''}`}></i>
                </button>
                <button
                  onClick={handleFindRelated}
                  disabled={aiProcessing !== null}
                  className={`p-2 rounded-lg transition-all ${aiProcessing === 'related' ? 'bg-blue-500/10 text-blue-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10'}`}
                  title="Find Related"
                >
                  <i className={`fa-solid fa-link text-sm ${aiProcessing === 'related' ? 'animate-pulse' : ''}`}></i>
                </button>
                <button
                  onClick={() => setShowTranslateModal(true)}
                  className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-cyan-500 hover:bg-cyan-500/10 transition-all"
                  title="Translate"
                >
                  <i className="fa-solid fa-language text-sm"></i>
                </button>

                <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

                {/* Export & Integration */}
                <button
                  onClick={handleSendToEmail}
                  className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  title="Send to Email"
                >
                  <i className="fa-solid fa-envelope text-sm"></i>
                </button>
                <button
                  onClick={handleCreateTask}
                  className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  title="Create Task"
                >
                  <i className="fa-solid fa-circle-check text-sm"></i>
                </button>
                <button
                  onClick={handleAddToCalendar}
                  className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  title="Add to Calendar"
                >
                  <i className="fa-solid fa-calendar-plus text-sm"></i>
                </button>
                <button
                  onClick={() => setShowContactPicker(true)}
                  className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  title="Link to Contact"
                >
                  <i className="fa-solid fa-user-tag text-sm"></i>
                </button>

                <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

                {/* Utility */}
                <button
                  onClick={handlePrint}
                  className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  title="Print"
                >
                  <i className="fa-solid fa-print text-sm"></i>
                </button>
                <button
                  onClick={handleFullscreen}
                  className={`p-2 rounded-lg transition-all ${isFullscreen ? 'bg-zinc-800 text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'} text-sm`}></i>
                </button>
                <button
                  onClick={handleTextToSpeech}
                  disabled={ttsLoading}
                  className={`p-2 rounded-lg transition-all ${ttsLoading ? 'bg-blue-500/10 text-blue-500' : isSpeaking ? 'bg-orange-500/10 text-orange-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'} disabled:opacity-50`}
                  title={ttsLoading ? 'Loading audio...' : isSpeaking ? 'Stop Speaking' : 'Read Aloud'}
                >
                  <i className={`fa-solid ${ttsLoading ? 'fa-circle-notch fa-spin' : isSpeaking ? 'fa-stop' : 'fa-volume-high'} text-sm`}></i>
                </button>
                <button
                  onClick={handleShowHistory}
                  className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  title="Version History"
                >
                  <i className="fa-solid fa-clock-rotate-left text-sm"></i>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* AI Summary */}
                {selectedItem.aiSummary && (
                  <div className="bg-gradient-to-r from-red-500/5 to-transparent border-l-2 border-red-500 p-4 rounded-r-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="fa-solid fa-wand-magic-sparkles text-red-500 text-xs"></i>
                      <span className="text-xs font-medium text-red-500">AI Summary</span>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectedItem.aiSummary}</p>
                  </div>
                )}

                {/* Main Content */}
                <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-500 to-transparent"></div>
                  <div className="prose prose-zinc dark:prose-invert max-w-none">
                    <pre className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono bg-transparent border-none p-0 m-0">
                      {selectedItem.content}
                    </pre>
                  </div>
                </div>

                {/* Related Items */}
                {relatedItems.length > 0 && (
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <i className="fa-solid fa-link text-zinc-500 text-xs"></i>
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">Related Items</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {relatedItems.map(item => {
                        const config = getTypeConfig(item.type);
                        return (
                          <button
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left"
                          >
                            <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                              <i className={`fa-solid ${config.icon} ${config.color} text-xs`}></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-zinc-900 dark:text-white truncate">{item.title}</h4>
                              <span className="text-[10px] text-zinc-500">{item.date.toLocaleDateString()}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleDelete(selectedItem.id, e)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-500 rounded-xl text-xs font-medium hover:border-red-500/50 hover:text-red-500 transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-trash-can"></i> Delete
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(selectedItem.content)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs font-medium hover:border-zinc-300 dark:hover:border-zinc-700 transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-copy"></i> Copy
                </button>
                {driveConnected && !selectedItem.driveFileId && (
                  <button
                    onClick={() => handleExportToDrive(selectedItem)}
                    disabled={exporting}
                    className={`px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium transition flex items-center gap-2 ${
                      exporting
                        ? 'text-blue-500 border-blue-500/50 cursor-not-allowed'
                        : 'text-zinc-600 dark:text-zinc-400 hover:border-blue-500/50 hover:text-blue-500'
                    }`}
                  >
                    {exporting ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin"></i> Exporting...
                      </>
                    ) : (
                      <>
                        <i className="fa-brands fa-google-drive"></i> Export to Drive
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => handleShare(selectedItem)}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-400 transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-share-nodes"></i> Share
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Hybrid Empty State: Statistics + Preview + Quick Actions
          <div className="flex-1 flex flex-col overflow-y-auto bg-zinc-50 dark:bg-zinc-950 min-h-0">
            {/* Top Section: Statistics */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <i className="fa-solid fa-chart-line text-red-500"></i>
                Archive Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-2xl font-light text-zinc-900 dark:text-white mb-1">{stats?.total ?? 0}</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono uppercase tracking-wider">Total Items</div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-2xl font-light text-amber-500 mb-1">{stats?.starred ?? 0}</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono uppercase tracking-wider">Starred</div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-2xl font-light text-blue-500 mb-1">{stats?.thisWeek ?? 0}</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono uppercase tracking-wider">This Week</div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-2xl font-light text-purple-500 mb-1">{stats?.uniqueTags ?? 0}</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono uppercase tracking-wider">Tags</div>
                </div>
              </div>

              {/* Type Breakdown */}
              {stats?.byType && Object.keys(stats.byType).length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-600 mb-2 uppercase tracking-wider">By Type</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.byType)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 8)
                      .map(([type, count]) => {
                        const config = getTypeConfig(type as ArchiveType);
                        return (
                          <button
                            key={type}
                            onClick={() => setActiveFilter(type as ArchiveType)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition hover:scale-105 ${config.bg} ${config.border}`}
                          >
                            <i className={`fa-solid ${config.icon} ${config.color} text-xs`}></i>
                            <span className={`text-[10px] font-medium ${config.color}`}>{getTypeLabel(type as ArchiveType)}</span>
                            <span className={`text-[10px] ${config.color} opacity-60`}>{count}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Middle Section: Preview */}
            {previewItem ? (
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-2xl mx-auto">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                      <i className="fa-solid fa-eye text-red-500"></i>
                      Preview {hoveredItem ? '(Hovering)' : '(Latest)'}
                    </h3>
                    <button
                      onClick={() => setSelectedItem(previewItem)}
                      className="text-xs text-red-500 hover:text-red-400 transition flex items-center gap-1"
                      title="View full item"
                    >
                      View Full <i className="fa-solid fa-arrow-right text-[10px]"></i>
                    </button>
                  </div>
                  <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 hover:border-red-500/30 transition">
                    <div className="flex items-center gap-3 mb-3">
                      {(() => {
                        const config = getTypeConfig(previewItem.type);
                        return (
                          <div className={`px-2.5 py-1 rounded-lg ${config.bg} ${config.border} border flex items-center gap-1.5`}>
                            <i className={`fa-solid ${config.icon} ${config.color} text-xs`}></i>
                            <span className={`text-[10px] font-mono uppercase tracking-wider ${config.color}`}>
                              {getTypeLabel(previewItem.type)}
                            </span>
                          </div>
                        );
                      })()}
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono">
                        {(() => {
                          try {
                            const date = previewItem.date instanceof Date ? previewItem.date : new Date(previewItem.date);
                            return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                          } catch (e) {
                            return 'Invalid date';
                          }
                        })()}
                      </span>
                      {previewItem.starred && <i className="fa-solid fa-star text-amber-500 text-xs"></i>}
                    </div>
                    <h4 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">{previewItem.title}</h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-4 leading-relaxed">{previewItem.content}</p>
                    {(previewItem.tags?.length > 0 || previewItem.aiTags?.length) && (
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        {previewItem.tags?.slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-[10px] text-zinc-500 font-mono">
                            #{tag}
                          </span>
                        ))}
                        {previewItem.aiTags?.slice(0, 2).map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-500 font-mono">
                            <i className="fa-solid fa-wand-magic-sparkles mr-1 text-[8px]"></i>{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-file-lines text-2xl text-zinc-400 dark:text-zinc-700"></i>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-600">No items to preview</p>
                </div>
              </div>
            )}

            {/* Bottom Section: Quick Actions */}
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <i className="fa-solid fa-bolt text-red-500"></i>
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => setActiveFilter('starred')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/5 transition group"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition">
                    <i className="fa-solid fa-star text-amber-500"></i>
                  </div>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Starred Items</span>
                </button>
                <button
                  onClick={() => setSidebarMode('collections')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-red-500/50 hover:bg-red-500/5 transition group"
                >
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition">
                    <i className="fa-solid fa-folder text-red-500"></i>
                  </div>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Collections</span>
                </button>
                <button
                  onClick={() => setSidebarMode('smart-folders')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50 hover:bg-purple-500/5 transition group"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition">
                    <i className="fa-solid fa-wand-magic-sparkles text-purple-500"></i>
                  </div>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Smart Folders</span>
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition">
                    <i className="fa-solid fa-timeline text-blue-500"></i>
                  </div>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Timeline View</span>
                </button>
              </div>
              {driveConnected && (
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2 text-xs text-blue-500">
                  <i className="fa-brands fa-google-drive"></i>
                  <span>Google Drive connected</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Export Progress Modal */}
      {exportProgress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-80">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <i className="fa-brands fa-google-drive text-blue-500"></i>
              </div>
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-white">Exporting to Drive</h3>
                <p className="text-xs text-zinc-500">{exportProgress.current} of {exportProgress.total}</p>
              </div>
            </div>
            <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowShareModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Share</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>

            {/* Preview */}
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 mb-4">
              <p className="text-sm font-medium text-zinc-900 dark:text-white line-clamp-1">{selectedItem.title}</p>
              <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{selectedItem.content.substring(0, 100)}...</p>
            </div>

            {/* Share Options Grid */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <button
                onClick={() => handleShareTo('email', selectedItem)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition group"
              >
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition">
                  <i className="fa-solid fa-envelope text-amber-500"></i>
                </div>
                <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Email</span>
              </button>

              <button
                onClick={() => handleShareTo('twitter', selectedItem)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition group"
              >
                <div className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center group-hover:scale-110 transition">
                  <i className="fa-brands fa-x-twitter text-sky-500"></i>
                </div>
                <span className="text-[10px] text-zinc-600 dark:text-zinc-400">X</span>
              </button>

              <button
                onClick={() => handleShareTo('linkedin', selectedItem)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition group"
              >
                <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center group-hover:scale-110 transition">
                  <i className="fa-brands fa-linkedin-in text-blue-600"></i>
                </div>
                <span className="text-[10px] text-zinc-600 dark:text-zinc-400">LinkedIn</span>
              </button>

              <button
                onClick={() => handleShareTo('facebook', selectedItem)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition group"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition">
                  <i className="fa-brands fa-facebook-f text-blue-500"></i>
                </div>
                <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Facebook</span>
              </button>

              <button
                onClick={() => handleShareTo('whatsapp', selectedItem)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition group"
              >
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition">
                  <i className="fa-brands fa-whatsapp text-green-500"></i>
                </div>
                <span className="text-[10px] text-zinc-600 dark:text-zinc-400">WhatsApp</span>
              </button>

              <button
                onClick={() => handleShareTo('telegram', selectedItem)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition group"
              >
                <div className="w-10 h-10 rounded-full bg-sky-400/10 flex items-center justify-center group-hover:scale-110 transition">
                  <i className="fa-brands fa-telegram text-sky-400"></i>
                </div>
                <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Telegram</span>
              </button>

              <button
                onClick={() => handleShareTo('sms', selectedItem)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition group"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition">
                  <i className="fa-solid fa-message text-emerald-500"></i>
                </div>
                <span className="text-[10px] text-zinc-600 dark:text-zinc-400">SMS</span>
              </button>

              <button
                onClick={() => handleShareTo('copy', selectedItem)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition group"
              >
                <div className="w-10 h-10 rounded-full bg-zinc-500/10 flex items-center justify-center group-hover:scale-110 transition">
                  <i className="fa-solid fa-copy text-zinc-500"></i>
                </div>
                <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Copy</span>
              </button>
            </div>

            {/* Download Option */}
            <button
              onClick={() => handleShareTo('download', selectedItem)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <i className="fa-solid fa-download"></i>
              <span>Download as file</span>
            </button>
          </div>
        </div>
      )}

      {/* Share Success Toast */}
      {shareSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-fade-in z-50 flex items-center gap-2">
          <i className="fa-solid fa-check"></i>
          {shareSuccess}
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsEditing(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-[600px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Edit Document</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                title="Close"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm text-zinc-500 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
                  placeholder="Document title"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-zinc-500 mb-1">Content</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-64 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white resize-none font-mono text-sm"
                  placeholder="Document content"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-400 transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tags Modal */}
      {showTagModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTagModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Manage Tags</h3>
              <button
                type="button"
                onClick={() => setShowTagModal(false)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                title="Close"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white text-sm"
                placeholder="Add a tag..."
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-400 transition"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedItem.tags?.map(tag => (
                <span key={tag} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-zinc-400 hover:text-red-500 transition"
                    title="Remove tag"
                  >
                    <i className="fa-solid fa-times text-xs"></i>
                  </button>
                </span>
              ))}
              {(!selectedItem.tags || selectedItem.tags.length === 0) && (
                <p className="text-sm text-zinc-500">No tags yet. Add some above.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collection Picker Modal */}
      {showCollectionPicker && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCollectionPicker(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Add to Collection</h3>
              <button
                type="button"
                onClick={() => setShowCollectionPicker(false)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                title="Close"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="space-y-2">
              {['Work', 'Personal', 'Projects', 'Research', 'Ideas', 'Reference'].map(collection => (
                <button
                  type="button"
                  key={collection}
                  onClick={() => handleAddToCollectionTool(collection)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <i className="fa-solid fa-folder text-red-500 text-sm"></i>
                  </div>
                  <span className="text-sm text-zinc-900 dark:text-white">{collection}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contact Picker Modal */}
      {showContactPicker && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowContactPicker(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Link to Contact</h3>
              <button
                type="button"
                onClick={() => setShowContactPicker(false)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                title="Close"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {['John Smith', 'Sarah Johnson', 'Michael Brown', 'Emily Davis', 'David Wilson'].map(contact => (
                <button
                  type="button"
                  key={contact}
                  onClick={() => handleLinkToContact(contact)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                    {contact.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="text-sm text-zinc-900 dark:text-white">{contact}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Translate Modal */}
      {showTranslateModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTranslateModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-[90vw] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Translate</h3>
              <button
                type="button"
                onClick={() => setShowTranslateModal(false)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                title="Close"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { code: 'es', name: 'Spanish', flag: '🇪🇸' },
                { code: 'fr', name: 'French', flag: '🇫🇷' },
                { code: 'de', name: 'German', flag: '🇩🇪' },
                { code: 'it', name: 'Italian', flag: '🇮🇹' },
                { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
                { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
                { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
                { code: 'ko', name: 'Korean', flag: '🇰🇷' },
              ].map(lang => (
                <button
                  type="button"
                  key={lang.code}
                  onClick={() => handleTranslate(lang.code)}
                  disabled={aiProcessing !== null}
                  className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-left disabled:opacity-50"
                >
                  <span className="text-xl">{lang.flag}</span>
                  <span className="text-sm text-zinc-900 dark:text-white">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showHistoryModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-[500px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-zinc-900 dark:text-white text-lg">Version History</h3>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                title="Close"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {versionHistory.length === 0 ? (
                <div className="text-center py-8">
                  <i className="fa-solid fa-clock-rotate-left text-3xl text-zinc-400 mb-2"></i>
                  <p className="text-sm text-zinc-500">Loading version history...</p>
                </div>
              ) : (
                versionHistory.map((version, i) => (
                  <div key={version.id} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                    <div className={`w-2 h-2 rounded-full mt-2 ${i === 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                    <div className="flex-1">
                      <p className="text-sm text-zinc-900 dark:text-white">{version.action}</p>
                      <p className="text-xs text-zinc-500">
                        {version.date.toLocaleDateString()} at {version.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {version.user}
                      </p>
                      {version.title && version.title !== selectedItem?.title && (
                        <p className="text-xs text-zinc-400 mt-1">Title: "{version.title}"</p>
                      )}
                    </div>
                    {i > 0 && version.content && (
                      <button
                        type="button"
                        onClick={() => handleRestoreVersion(version)}
                        disabled={restoringVersion !== null}
                        className="text-xs text-red-500 hover:text-red-400 transition disabled:opacity-50 flex items-center gap-1"
                      >
                        {restoringVersion === version.id ? (
                          <>
                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                            Restoring...
                          </>
                        ) : (
                          'Restore'
                        )}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Archives;
