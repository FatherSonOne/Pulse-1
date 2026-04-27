import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Mic,
  Play,
  Pause,
  Search,
  Plus,
  Star,
  Tag,
  Link2,
  Clock,
  Sparkles,
  Mail,
  Calendar,
  CheckSquare,
  User,
  StickyNote,
  Trash2,
  Copy,
  ExternalLink,
  X,
  Check,
  Menu,
  Download,
  Archive,
  MoreVertical,
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
import RecordButton from './RecordButton';
import VoxModeHeader from './VoxModeHeader';
import VoxModeToolbar from './VoxModeToolbar';
import VoxRecordArea from './VoxRecordArea';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { voxModeService } from '../../services/relay/voxModeService';
// analyticsCollector loaded dynamically to avoid svc-crm-analytics chunk TDZ
import { VOX_MODES, type VoxNote, type LinkedItem } from '../../services/relay/voxModeTypes';
import toast from 'react-hot-toast';
import './Relay.css';

// Phase 2: Selection Mode
import { useVoxSelection, VoxSelectionItem } from '../../hooks/useVoxSelection';
import { VoxSelectToolbar } from './VoxSelectToolbar';
import VoxMessageMenu from './VoxMessageMenu';
import VoxDownloadModal from './VoxDownloadModal';
import { archiveRelayConversation } from '../../services/relay/relayArchiveService';

// Phase 5: AI Enhancements
import { VoxConversationSummary, VoxSmartReplies } from './index';
import { summarizeConversation, generateSmartReplies } from '../../services/relay/relayAIService';
import type { ConversationSummary, SmartReply } from '../../services/relay/relayAIService';

// Phase 6: Final Polish
import { useRelayKeyboardShortcuts } from '../../hooks/useRelayKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './VoxKeyboardShortcutsHelp';
import { usePlaybackSpeed } from '../../hooks/usePlaybackSpeed';
import { PlaybackSpeedControl } from './PlaybackSpeedControl';
import { VoxEmptyState } from './VoxEmptyState';
import { getEmptyStateConfig } from './voxEmptyStates';

// Mode color from shared palette
const MODE_COLOR = VOX_MODES.vox_notes.color;

interface VoxNotesModeProps {
  apiKey?: string;
  onBack: () => void;
  isDarkMode?: boolean;
}

const LINK_TYPE_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="w-3 h-3" />,
  meeting: <Calendar className="w-3 h-3" />,
  task: <CheckSquare className="w-3 h-3" />,
  contact: <User className="w-3 h-3" />,
  note: <StickyNote className="w-3 h-3" />,
};

const VoxNotesMode: React.FC<VoxNotesModeProps> = ({
  apiKey,
  onBack,
  isDarkMode = false,
}) => {
  const [notes, setNotes] = useState<VoxNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<VoxNote | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadItem, setDownloadItem] = useState<VoxSelectionItem | null>(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagText, setNewTagText] = useState('');

  const audioRef = useRef<HTMLAudioElement>(null);

  // Phase 2: Selection Mode State
  const {
    isSelectionMode,
    selectedItems,
    selectionCount,
    toggleSelection,
    selectAll,
    deselectAll,
    enterSelectionMode,
    exitSelectionMode,
    isSelected,
    getTotalDuration,
  } = useVoxSelection();

  // Phase 5: AI Enhancement States
  const [showSummary, setShowSummary] = useState(false);
  const [conversationSummary, setConversationSummary] = useState<ConversationSummary | null>(null);
  const [showSmartReplies, setShowSmartReplies] = useState(false);
  const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Phase 6: Final Polish States
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { playbackSpeed: globalPlaybackSpeed, setPlaybackSpeed: setGlobalPlaybackSpeed, applyToElement } = usePlaybackSpeed();
  const emptyConfig = getEmptyStateConfig('vox_notes');

  // Use the recording hook for click-to-record with preview
  const {
    state: recordingState,
    duration: recordingDuration,
    analyser,
    recordingData,
    recordingMode,
    setRecordingMode,
    startRecording,
    stopRecording,
    cancelRecording,
    sendRecording,
    handlePointerDown,
    handlePointerUp,
    handleToggleRecording,
  } = useVoxRecording({
    onRecordingComplete: async (_data) => {
      // Recording complete - ready for preview
    },
  });

  // Phase 5: AI Handler Functions (defined before keyboard shortcuts to avoid TDZ)
  const handleSummarizeNotes = async () => {
    if (notes.length === 0) {
      toast.error('No notes to summarize');
      return;
    }

    if (!apiKey) {
      toast.error('Gemini API key not configured');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const noteData = notes.slice(0, 10).map(note => ({
        id: note.id,
        transcription: note.transcript || '',
        sender: 'me' as const,
        senderName: 'Me',
        timestamp: note.createdAt,
        duration: note.duration,
      }));

      const summary = await summarizeConversation(apiKey, noteData);
      if (summary) {
        setConversationSummary(summary);
        setShowSummary(true);
        toast.success('Notes summarized!');
      } else {
        toast.error('AI summarizer unavailable — try again later');
      }
    } catch (error: any) {
      console.error('Summarization error:', error);
      const msg = error?.message || '';
      if (msg.includes('API key') || msg.includes('API_KEY') || msg.includes('invalid') || msg.includes('unauthorized')) {
        toast.error('AI features require API configuration');
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
        toast.error('Network error — please try again');
      } else {
        toast.error('AI summarizer unavailable (beta)');
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGenerateSmartReplies = async () => {
    const recentNotes = notes.slice(0, 5);
    if (recentNotes.length === 0) {
      toast.error('No notes to analyze');
      return;
    }

    if (!apiKey) {
      toast.error('Gemini API key not configured');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const lastNote = recentNotes[0];
      const context = recentNotes.map(note => ({
        id: note.id,
        transcription: note.transcript || '',
        sender: 'me' as const,
        senderName: 'Me',
        timestamp: note.createdAt,
        duration: note.duration,
      }));

      const replies = await generateSmartReplies(apiKey, {
        id: lastNote.id,
        transcription: lastNote.transcript || '',
        sender: 'me' as const,
        senderName: 'Me',
        timestamp: lastNote.createdAt,
        duration: lastNote.duration,
      }, context);

      if (replies.length > 0) {
        setSmartReplies(replies);
        setShowSmartReplies(true);
        toast.success('Smart replies generated!');
      } else {
        toast.error('Smart replies unavailable — try again later');
      }
    } catch (error: any) {
      console.error('Smart replies error:', error);
      const msg = error?.message || '';
      if (msg.includes('API key') || msg.includes('API_KEY') || msg.includes('invalid') || msg.includes('unauthorized')) {
        toast.error('AI features require API configuration');
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
        toast.error('Network error — please try again');
      } else {
        toast.error('Smart replies unavailable (beta)');
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSelectAllNotes = () => {
    const allItems: VoxSelectionItem[] = filteredNotes.map(note => ({
      id: note.id,
      type: 'audio' as const,
      url: note.audioUrl,
      duration: note.duration,
      timestamp: note.createdAt,
      sender: 'me' as const,
      transcript: note.transcript,
      mode: 'vox_notes' as const,
      contactId: 'personal',
      contactName: 'My Notes',
    }));
    selectAll(allItems);
  };

  // Phase 6: Keyboard Shortcuts (after handler functions are defined)
  useRelayKeyboardShortcuts({
    onToggleRecording: () => {
      if (recordingState === 'idle') startRecording();
      else if (recordingState === 'recording') stopRecording();
    },
    onStopRecording: () => {
      // Priority 1: close any open modal/overlay first
      if (showMessageMenu) { setShowMessageMenu(null); return; }
      if (showSummary) { setShowSummary(false); return; }
      if (showSmartReplies) { setShowSmartReplies(false); return; }
      if (showDownloadModal) { setShowDownloadModal(false); return; }
      if (showLinkModal) { setShowLinkModal(false); return; }
      // Priority 2: discard active recording
      if (recordingState === 'recording') { stopRecording(); return; }
      // Priority 3: exit selection mode
      if (isSelectionMode) { exitSelectionMode(); return; }
      // Priority 4: go back
      if (selectedNote) { setSelectedNote(null); return; }
      onBack();
    },
    onGoBack: () => {
      if (selectedNote) setSelectedNote(null);
      else onBack();
    },
    onSwitchMode: (_mode) => {
      // Mode switch handled by parent
    },
    onDownload: () => {
      if (isSelectionMode && selectionCount > 0) {
        // Download handled by selection toolbar
      }
    },
    onArchive: () => {
      if (isSelectionMode && selectionCount > 0) {
        (async () => {
          try {
            await archiveRelayConversation(Array.from(selectedItems), 'My Notes');
            exitSelectionMode();
            toast.success(`Archived ${selectionCount} message${selectionCount > 1 ? 's' : ''}`);
          } catch {
            toast.error('Failed to archive');
          }
        })();
      } else {
        toast.error('Select messages first (click selection button)');
      }
    },
    onSummarize: handleSummarizeNotes,
    onShowHelp: () => setShowShortcutsHelp(true),
  }, true);

  // Phase 6: Apply playback speed to audio elements
  useEffect(() => {
    if (audioRef.current) {
      applyToElement(audioRef.current);
    }
  }, [globalPlaybackSpeed, applyToElement]);

  // Save recording as a new note
  const handleSendRecording = async () => {
    if (!recordingData) {
      console.error('Cannot save note: no recording data');
      return;
    }

    const note = await voxModeService.createVoxNote(
      recordingData.blob,
      recordingData.duration,
      `Note ${new Date().toLocaleDateString()}`
    );

    if (note) {
      setNotes(prev => [note, ...prev]);
      setSelectedNote(note);

      const userId = voxModeService.getUserId();
      import('../../services/analyticsCollector').then(({ default: ac }) => {
        ac.trackMessageEvent({
          id: note.id,
          channel: 'voxer',
          contactIdentifier: userId || 'self',
          contactName: 'Personal Note',
          isSent: true,
          timestamp: new Date(),
          content: note.title || '[Vox Note]',
          duration: recordingData.duration,
          messageType: 'vox_note'
        }).catch(err => console.error('Analytics tracking failed:', err));
      }).catch(() => {});

      // Reload notes to confirm persistence
      setTimeout(() => loadNotes(), 500);
    }

    sendRecording();
  };

  // Toggle recording
  const handleRecordToggle = () => {
    if (recordingState === 'recording') {
      stopRecording();
    } else if (recordingState === 'idle') {
      startRecording();
    }
  };

  // Load notes on mount
  useEffect(() => {
    loadNotes();
  }, []);

  // Reload notes when search changes
  useEffect(() => {
    if (searchQuery !== '') {
      loadNotes();
    }
  }, [searchQuery]);

  // Auto-select first note when notes load (if none selected)
  useEffect(() => {
    if (notes.length > 0 && !selectedNote) {
      setSelectedNote(notes[0]);
    }
  }, [notes]);

  useEffect(() => {
    const tags = new Set<string>();
    notes.forEach(note => note.tags.forEach(tag => tags.add(tag)));
    setAllTags(Array.from(tags));
  }, [notes]);

  const loadNotes = async () => {
    try {
      const data = await voxModeService.getMyVoxNotes(searchQuery || undefined);
      setNotes(data);
    } catch (error) {
      console.error('Error loading Vox Notes:', error);
    }
  };

  const handlePlayNote = () => {
    if (!selectedNote || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = selectedNote.audioUrl;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (position: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = position * audioRef.current.duration;
    }
  };

  const handleToggleFavorite = async (note: VoxNote) => {
    const updatedNote = { ...note, isFavorite: !note.isFavorite };
    setNotes(notes.map(n => n.id === note.id ? updatedNote : n));
    if (selectedNote?.id === note.id) {
      setSelectedNote(updatedNote);
    }
  };

  const handleDeleteNote = async (note: VoxNote) => {
    if (!window.confirm('Delete this note?')) return;
    const success = await voxModeService.deleteVoxNote(note.id);
    if (success) {
      setNotes(prev => prev.filter(n => n.id !== note.id));
      if (selectedNote?.id === note.id) {
        setSelectedNote(null);
      }
      toast.success('Note deleted');
    } else {
      toast.error('Failed to delete note');
    }
  };

  const handleCopyTranscript = async (note: VoxNote) => {
    try {
      await navigator.clipboard.writeText(note.transcript || '');
      toast.success('Transcript copied to clipboard');
    } catch {
      toast.error('Failed to copy transcript');
    }
  };

  const handleAddTag = async (note: VoxNote) => {
    const tag = newTagText.trim();
    if (!tag) return;
    const updatedTags = [...(note.tags || []), tag];
    const success = await voxModeService.updateVoxNote(note.id, { tags: updatedTags });
    if (success) {
      const updatedNote = { ...note, tags: updatedTags };
      setNotes(prev => prev.map(n => n.id === note.id ? updatedNote : n));
      if (selectedNote?.id === note.id) {
        setSelectedNote(updatedNote);
      }
      setNewTagText('');
      setShowTagInput(false);
      toast.success(`Tag "${tag}" added`);
    } else {
      toast.error('Failed to add tag');
    }
  };

  const handleUpdateTitle = async () => {
    if (!selectedNote || !editTitle.trim()) return;

    const success = await voxModeService.updateVoxNote(selectedNote.id, { title: editTitle });
    if (success) {
      const updatedNote = { ...selectedNote, title: editTitle };
      setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
      setSelectedNote(updatedNote);
    } else {
      toast.error('Failed to update title');
    }
    setIsEditing(false);
  };

  const handleLinkToItem = async (itemType: 'email' | 'meeting' | 'task' | 'contact' | 'note') => {
    if (!selectedNote) {
      console.error('No note selected for linking');
      return;
    }

    // For now, create a placeholder link - in production, this would open a picker modal
    const itemId = `${itemType}-${Date.now()}`;
    const itemTitle = `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} Item`;

    const success = await voxModeService.linkNoteToItem(
      selectedNote.id,
      itemType,
      itemId,
      itemTitle
    );

    if (success) {
      // Update local state
      const updatedNote = {
        ...selectedNote,
        linkedItems: [
          ...(selectedNote.linkedItems || []),
          { type: itemType, id: itemId, title: itemTitle }
        ]
      };
      setSelectedNote(updatedNote);
      setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
      setShowLinkModal(false);
      toast.success(`Linked to ${itemType}!`);
    } else {
      toast.error(`Failed to link to ${itemType}`);
    }
  };

  const handleArchiveNote = async (note: any) => {
    const item: VoxSelectionItem = {
      id: note.id,
      type: 'audio',
      url: note.audioUrl || '',
      duration: note.duration || 0,
      timestamp: note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt || Date.now()),
      mode: 'vox_notes',
      transcript: note.transcript,
    };
    try {
      await archiveRelayConversation([item], note.title || 'Vox Note');
      toast.success('Archived to Pulse Archives');
    } catch {
      toast.error('Failed to archive');
    }
  };

  const handleDownloadNote = (note: any) => {
    const item: VoxSelectionItem = {
      id: note.id,
      type: 'audio',
      url: note.audioUrl || '',
      duration: note.duration || 0,
      timestamp: note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt || Date.now()),
      mode: 'vox_notes',
      transcript: note.transcript,
    };
    setDownloadItem(item);
    setShowDownloadModal(true);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const filteredNotes = notes.filter(note => {
    if (showFavoritesOnly && !note.isFavorite) return false;
    if (filterTag && !note.tags.includes(filterTag)) return false;
    return true;
  });

  const groupedNotes = filteredNotes.reduce((acc, note) => {
    const dateKey = note.createdAt.toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(note);
    return acc;
  }, {} as Record<string, VoxNote[]>);

  // Theme classes for consistent styling
  const tc = {
    // Backgrounds
    pageBg: isDarkMode
      ? 'bg-gradient-to-br from-gray-900 via-pink-900/10 to-gray-900'
      : 'bg-gradient-to-br from-slate-50 via-pink-50/30 to-white',
    panelBg: isDarkMode
      ? 'bg-gray-900/60 backdrop-blur-xl'
      : 'bg-white/80 backdrop-blur-xl',
    cardBg: isDarkMode
      ? 'bg-gray-800/40 backdrop-blur-sm'
      : 'bg-white/60 backdrop-blur-sm',
    inputBg: isDarkMode
      ? 'bg-gray-800/60 border-gray-700/50'
      : 'bg-white/80 border-gray-200/60',
    hoverBg: isDarkMode
      ? 'hover:bg-gray-800/60'
      : 'hover:bg-gray-100/80',
    activeBg: isDarkMode
      ? 'bg-pink-500/20'
      : 'bg-pink-500/10',

    // Borders
    border: isDarkMode ? 'border-gray-800/60' : 'border-gray-200/60',
    borderAccent: isDarkMode ? 'border-pink-500/30' : 'border-pink-400/40',

    // Text
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    textAccent: 'text-pink-500',

    // Buttons
    btnPrimary: 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-lg shadow-pink-500/25',
    btnSecondary: isDarkMode
      ? 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 border border-gray-700/50'
      : 'bg-white/80 hover:bg-gray-100/80 text-gray-700 border border-gray-200/60',
    btnGhost: isDarkMode
      ? 'hover:bg-gray-800/60 text-gray-400 hover:text-white'
      : 'hover:bg-gray-100/80 text-gray-500 hover:text-gray-900',

    // Modal
    modalOverlay: 'bg-black/60 backdrop-blur-sm',
    modalBg: isDarkMode
      ? 'bg-gray-900/95 backdrop-blur-xl border-gray-800/60'
      : 'bg-white/95 backdrop-blur-xl border-gray-200/60',
  };

  // Render notes list (shared between mobile and desktop)
  const renderNotesList = () => (
    <>
      {/* Search & Filters */}
      <div className={`p-4 space-y-3 border-b ${tc.border}`}>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${tc.textMuted}`} />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl ${tc.inputBg} ${tc.text} text-sm border focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all`}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              showFavoritesOnly
                ? `${tc.activeBg} text-pink-500 border ${tc.borderAccent}`
                : `${tc.cardBg} ${tc.textSecondary} border ${tc.border} ${tc.hoverBg}`
            }`}
          >
            <Star className="w-3 h-3" />
            Favorites
          </button>

          {allTags.slice(0, 4).map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterTag === tag
                  ? `${tc.activeBg} text-pink-500 border ${tc.borderAccent}`
                  : `${tc.cardBg} ${tc.textSecondary} border ${tc.border} ${tc.hoverBg}`
              }`}
            >
              <Tag className="w-3 h-3" />
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedNotes).map(([dateKey, dateNotes]) => (
          <div key={dateKey}>
            <div className={`px-4 py-2 sticky top-0 ${tc.panelBg}`}>
              <span className={`text-xs font-medium ${tc.textMuted}`}>
                {new Date(dateKey).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            </div>
            {dateNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => {
                  if (!isSelectionMode) {
                    setSelectedNote(note);
                    setIsPlaying(false);
                    setPlaybackProgress(0);
                    setShowMobileSidebar(false);
                  }
                }}
                className={`w-full p-4 text-left border-b ${tc.border} transition-all relative cursor-pointer ${
                  selectedNote?.id === note.id ? tc.activeBg : tc.hoverBg
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!isSelectionMode) {
                      setSelectedNote(note);
                      setIsPlaying(false);
                      setPlaybackProgress(0);
                      setShowMobileSidebar(false);
                    }
                  }
                }}
              >
                {/* Phase 2: Selection Checkbox */}
                {isSelectionMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const selectionItem: VoxSelectionItem = {
                        id: note.id,
                        type: 'audio' as const,
                        url: note.audioUrl,
                        duration: note.duration,
                        timestamp: note.createdAt,
                        sender: 'me' as const,
                        transcript: note.transcript,
                        mode: 'vox_notes' as const,
                        contactId: 'personal',
                        contactName: 'My Notes',
                      };
                      toggleSelection(selectionItem);
                    }}
                    className={`absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-lg hover:scale-110 active:scale-95 z-10 ${
                      isSelected(note.id)
                        ? 'bg-pink-500 border-2 border-pink-600'
                        : 'bg-white dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-500'
                    }`}
                    style={{
                      boxShadow: isSelected(note.id)
                        ? '0 4px 12px rgba(236, 72, 153, 0.4)'
                        : '0 2px 8px rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    {isSelected(note.id) && <Check className="w-5 h-5 text-white font-bold" />}
                  </button>
                )}

                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${MODE_COLOR}20 0%, ${MODE_COLOR}10 100%)`,
                      border: `1px solid ${MODE_COLOR}30`
                    }}
                  >
                    <FileText className="w-5 h-5" style={{ color: MODE_COLOR }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium truncate ${tc.text}`}>
                        {note.title || 'Untitled Note'}
                      </span>
                      {note.isFavorite && (
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />
                      )}
                    </div>
                    <p className={`text-sm line-clamp-1 mt-0.5 ${tc.textSecondary}`}>
                      {note.transcript || 'No transcript'}
                    </p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className={`flex items-center gap-1 text-xs ${tc.textMuted}`}>
                        <Clock className="w-3 h-3" />
                        {formatDuration(note.duration)}
                      </span>
                      {note.tags.length > 0 && (
                        <span className={`flex items-center gap-1 text-xs ${tc.textMuted}`}>
                          <Tag className="w-3 h-3" />
                          {note.tags[0]}
                          {note.tags.length > 1 && `+${note.tags.length - 1}`}
                        </span>
                      )}
                      {note.linkedItems.length > 0 && (
                        <span className={`flex items-center gap-1 text-xs ${tc.textMuted}`}>
                          <Link2 className="w-3 h-3" />
                          {note.linkedItems.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* More Actions Menu */}
                  {!isSelectionMode && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          setMenuAnchorRect(rect);
                          setShowMessageMenu(showMessageMenu === note.id ? null : note.id);
                        }}
                        className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                        title="More actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {showMessageMenu === note.id && menuAnchorRect && (
                        <VoxMessageMenu
                          isDarkMode={isDarkMode}
                          accentColor={MODE_COLOR}
                          anchorRect={menuAnchorRect}
                          onArchive={() => handleArchiveNote(note)}
                          onDownload={() => handleDownloadNote(note)}
                          onDelete={() => {
                            setShowMessageMenu(null);
                            handleDeleteNote(note);
                          }}
                          onClose={() => setShowMessageMenu(null)}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {filteredNotes.length === 0 && (
          <div className="py-12">
            <VoxEmptyState
              {...emptyConfig}
              isDarkMode={isDarkMode}
              action={{ label: 'Start Recording', onClick: () => { if (recordingState === 'idle') startRecording(); } }}
            />
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={`h-full flex flex-col ${tc.pageBg}`}>
      {/* Header */}
      <VoxModeToolbar
        onBack={onBack}
        modeIcon={<FileText className="w-5 h-5" />}
        modeTitle="Vox Notes"
        modeSubtitle="Your Voice, Organized"
        accentColor={MODE_COLOR}
        isDarkMode={isDarkMode}
        showAI={notes.length > 0}
        onSummarize={handleSummarizeNotes}
        onSmartReplies={handleGenerateSmartReplies}
        isSummarizing={isGeneratingAI}
        isGeneratingReplies={isGeneratingAI}
        hasContent={notes.length > 0}
        isSelectionMode={isSelectionMode}
        onToggleSelection={() => isSelectionMode ? exitSelectionMode() : enterSelectionMode()}
        onShowHelp={() => setShowShortcutsHelp(true)}
        customActions={[
          {
            icon: <span className="md:hidden"><Menu className="w-5 h-5" /></span>,
            title: 'Show notes list',
            onClick: () => setShowMobileSidebar(true),
          },
        ]}
      />

      {/* Recording Preview Panel */}
      {recordingState === 'preview' && recordingData && (
        <div className={`px-4 md:px-6 py-4 border-b ${tc.border}`}>
          <RecordingPreview
            recordingData={recordingData}
            onSend={handleSendRecording}
            onCancel={cancelRecording}
            onRetry={() => {
              cancelRecording();
              setTimeout(() => startRecording(), 100);
            }}
            isDarkMode={isDarkMode}
            modeColor={MODE_COLOR}
          />
        </div>
      )}

      {/* VoxRecordArea - unified recording interface with Hold/Tap toggle */}
      {recordingState !== 'preview' && (
        <div className={`px-4 md:px-6 py-4 border-b ${tc.border}`}>
          <VoxRecordArea
            modeColor={MODE_COLOR}
            isDarkMode={isDarkMode}
            isRecording={recordingState === 'recording'}
            isPreviewing={false}
            recordingMode={recordingMode}
            onToggleRecordingMode={() => setRecordingMode(prev => prev === 'hold' ? 'tap' : 'hold')}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onToggleRecording={handleToggleRecording}
            recordingDuration={recordingDuration}
            recordingState={recordingState}
          >
            {recordingState === 'recording' && (
              <VoxAudioVisualizer
                analyser={analyser}
                isActive={true}
                mode="waveform"
                color={MODE_COLOR}
                height={48}
                isDarkMode={isDarkMode}
              />
            )}
          </VoxRecordArea>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {showMobileSidebar && (
          <div className="md:hidden fixed inset-0 z-40">
            <div
              className={tc.modalOverlay}
              onClick={() => setShowMobileSidebar(false)}
            />
            <div className={`absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] ${tc.panelBg} border-r ${tc.border} flex flex-col animate-slide-in`}>
              <div className={`p-4 border-b ${tc.border} flex items-center justify-between`}>
                <h2 className={`font-semibold ${tc.text}`}>Notes</h2>
                <button
                  onClick={() => setShowMobileSidebar(false)}
                  className={`p-2 rounded-lg ${tc.btnGhost}`}
                  type="button"
                  aria-label="Close sidebar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderNotesList()}
            </div>
          </div>
        )}

        {/* Desktop Notes List Sidebar - Always visible, use responsive width */}
        <div className={`flex w-80 lg:w-96 border-r ${tc.border} flex-col ${tc.panelBg}`}>
          {renderNotesList()}
        </div>

        {/* Note Detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedNote ? (
            <>
              {/* Note Header */}
              <div className={`px-4 md:px-6 py-4 border-b ${tc.border} ${tc.cardBg}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className={`text-xl font-bold rounded-xl px-3 py-1 ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-pink-500/50`}
                          autoFocus
                        />
                        <button
                          onClick={handleUpdateTitle}
                          className={`p-2 rounded-xl text-pink-500 ${tc.hoverBg}`}
                          aria-label="Save"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className={`p-2 rounded-xl ${tc.btnGhost}`}
                          aria-label="Cancel"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <h2
                        onClick={() => {
                          setEditTitle(selectedNote.title || '');
                          setIsEditing(true);
                        }}
                        className={`text-lg md:text-xl font-bold cursor-pointer hover:text-pink-500 transition-colors truncate ${tc.text}`}
                      >
                        {selectedNote.title || 'Untitled Note'}
                      </h2>
                    )}
                    <p className={`text-sm mt-1 ${tc.textSecondary}`}>
                      {formatDate(selectedNote.createdAt)} • {formatDuration(selectedNote.duration)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 md:gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleFavorite(selectedNote)}
                      className={`p-2 rounded-xl transition-all duration-200 ${
                        selectedNote.isFavorite
                          ? 'text-yellow-400'
                          : `${tc.btnGhost}`
                      }`}
                      aria-label={selectedNote.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star className={`w-5 h-5 ${selectedNote.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleCopyTranscript(selectedNote)}
                      className={`p-2 rounded-xl ${tc.btnGhost}`}
                      aria-label="Copy"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(selectedNote)}
                      className={`p-2 rounded-xl ${tc.btnGhost}`}
                      aria-label="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Audio Player */}
              <div className={`px-4 md:px-6 py-4 md:py-6 border-b ${tc.border} ${tc.panelBg}`}>
                <div className="flex items-center gap-3 md:gap-4">
                  <button
                    onClick={handlePlayNote}
                    className="w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
                    style={{
                      background: isPlaying
                        ? MODE_COLOR
                        : `linear-gradient(135deg, ${MODE_COLOR} 0%, #e11d48 100%)`,
                      boxShadow: `0 8px 24px ${MODE_COLOR}40`
                    }}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    ) : (
                      <Play className="w-5 h-5 md:w-6 md:h-6 text-white ml-1" />
                    )}
                  </button>
                  <div className="flex-1">
                    <VoxAudioVisualizer
                      analyser={null}
                      isActive={false}
                      isPlaying={isPlaying}
                      playbackProgress={playbackProgress}
                      mode="waveform"
                      color={MODE_COLOR}
                      height={56}
                      isDarkMode={isDarkMode}
                      onSeek={handleSeek}
                    />
                  </div>
                  {/* Phase 6: Playback Speed Control */}
                  <PlaybackSpeedControl
                    speed={globalPlaybackSpeed}
                    onSpeedChange={(newSpeed) => {
                      setGlobalPlaybackSpeed(newSpeed);
                      if (audioRef.current) audioRef.current.playbackRate = newSpeed;
                    }}
                    mode="compact"
                    isDarkMode={isDarkMode}
                    accentColor={MODE_COLOR}
                  />
                </div>
              </div>

              {/* Note Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {/* AI Summary */}
                {selectedNote.summary && (
                  <div
                    className="p-4 rounded-xl border"
                    style={{
                      background: `linear-gradient(135deg, ${MODE_COLOR}10 0%, ${MODE_COLOR}05 100%)`,
                      borderColor: `${MODE_COLOR}30`
                    }}
                  >
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: MODE_COLOR }}>
                      <Sparkles className="w-4 h-4" />
                      AI Summary
                    </h3>
                    <p className={`text-sm leading-relaxed ${tc.textSecondary}`}>
                      {selectedNote.summary}
                    </p>
                  </div>
                )}

                {/* Transcript */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${tc.textSecondary}`}>Transcript</h3>
                  <div className={`p-4 rounded-xl ${tc.cardBg} border ${tc.border}`}>
                    <p className={`leading-relaxed whitespace-pre-wrap ${tc.textSecondary}`}>
                      {selectedNote.transcript || 'No transcript available'}
                    </p>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${tc.textSecondary}`}>Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedNote.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full text-sm"
                        style={{ background: `${MODE_COLOR}20`, color: MODE_COLOR }}
                      >
                        {tag}
                      </span>
                    ))}
                    <button
                      onClick={() => setShowTagInput(!showTagInput)}
                      className={`px-3 py-1 rounded-full text-sm transition-all flex items-center gap-1 ${tc.cardBg} border ${tc.border} ${tc.textSecondary} ${tc.hoverBg}`}
                    >
                      <Plus className="w-3 h-3" />
                      Add Tag
                    </button>
                  </div>
                  {showTagInput && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        value={newTagText}
                        onChange={(e) => setNewTagText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTag(selectedNote);
                          if (e.key === 'Escape') { setShowTagInput(false); setNewTagText(''); }
                        }}
                        placeholder="Enter tag name..."
                        aria-label="New tag name"
                        autoFocus
                        className={`px-3 py-1 rounded-lg text-sm border ${tc.border} ${tc.cardBg} ${tc.text} focus:outline-none focus:ring-2`}
                        style={{ focusRingColor: MODE_COLOR } as React.CSSProperties}
                      />
                      <button
                        onClick={() => handleAddTag(selectedNote)}
                        className="p-1 rounded-lg transition-all"
                        style={{ color: MODE_COLOR }}
                        aria-label="Confirm tag"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setShowTagInput(false); setNewTagText(''); }}
                        className={`p-1 rounded-lg transition-all ${tc.textMuted}`}
                        aria-label="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Linked Items */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${tc.textSecondary}`}>Linked Items</h3>
                  <div className="space-y-2">
                    {selectedNote.linkedItems.map((item, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer group ${tc.cardBg} border ${tc.border} ${tc.hoverBg}`}
                      >
                        <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-200'}`}>
                          {LINK_TYPE_ICONS[item.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${tc.text}`}>{item.title}</p>
                          <p className={`text-xs capitalize ${tc.textMuted}`}>{item.type}</p>
                        </div>
                        <ExternalLink className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${tc.textMuted}`} />
                      </div>
                    ))}

                    <button
                      onClick={() => setShowLinkModal(true)}
                      className={`w-full p-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 ${tc.cardBg} border ${tc.border} ${tc.textSecondary} ${tc.hoverBg} hover:text-pink-500`}
                    >
                      <Link2 className="w-4 h-4" />
                      Link to Email, Meeting, or Task
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className={`flex-1 flex items-center justify-center ${tc.textMuted}`}>
              <div className="text-center p-6">
                <div
                  className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${MODE_COLOR}20 0%, ${MODE_COLOR}10 100%)`,
                    border: `1px solid ${MODE_COLOR}30`
                  }}
                >
                  <FileText className="w-10 h-10" style={{ color: MODE_COLOR, opacity: 0.6 }} />
                </div>
                <p className={`text-lg ${tc.text}`}>Select a note to view</p>
                <p className={`text-sm mt-1 ${tc.textSecondary}`}>or record a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => {
          const audio = e.target as HTMLAudioElement;
          setPlaybackProgress(audio.currentTime / audio.duration);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setPlaybackProgress(0);
        }}
      />

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={tc.modalOverlay} onClick={() => setShowLinkModal(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border ${tc.modalBg} p-6`}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="p-2 rounded-xl"
                style={{ background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #e11d48 100%)` }}
              >
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <h3 className={`text-xl font-bold ${tc.text}`}>Link to Item</h3>
            </div>

            <div className="space-y-2">
              {(['email', 'meeting', 'task', 'contact', 'note'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleLinkToItem(type)}
                  className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-3 ${tc.cardBg} border ${tc.border} ${tc.hoverBg} hover:border-pink-500/50`}
                  type="button"
                >
                  <div className="p-2 rounded-lg" style={{ background: `${MODE_COLOR}20` }}>
                    <span style={{ color: MODE_COLOR }}>{LINK_TYPE_ICONS[type]}</span>
                  </div>
                  <div>
                    <p className={`font-medium capitalize ${tc.text}`}>Link to {type}</p>
                    <p className={`text-xs ${tc.textSecondary}`}>
                      Connect this note to a {type}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowLinkModal(false)}
              className={`w-full mt-6 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnSecondary}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Phase 2: Selection Toolbar */}
      {isSelectionMode && (
        <VoxSelectToolbar
          selectedItems={selectedItems}
          selectionCount={selectionCount}
          totalDuration={getTotalDuration()}
          onSelectAll={handleSelectAllNotes}
          onDeselectAll={deselectAll}
          onExitSelection={exitSelectionMode}
          contactName="My Notes"
          isDarkMode={isDarkMode}
          accentColor={MODE_COLOR}
          allSelected={selectionCount === filteredNotes.length && filteredNotes.length > 0}
        />
      )}

      {/* Phase 5: AI Enhancement Modals */}

      {/* Conversation Summary Modal */}
      {conversationSummary && showSummary && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <VoxConversationSummary
              summary={conversationSummary}
              isDarkMode={isDarkMode}
              accentColor={MODE_COLOR}
              onClose={() => setShowSummary(false)}
            />
          </div>
        </div>
      )}

      {/* Smart Replies Panel */}
      {smartReplies.length > 0 && showSmartReplies && (
        <div className="fixed bottom-20 right-4 z-40 w-96">
          <VoxSmartReplies
            replies={smartReplies}
            onSelectReply={(reply) => {
              navigator.clipboard.writeText(reply.text);
              toast.success('Smart reply copied! Use it in your next note.');
              setSmartReplies([]);
              setShowSmartReplies(false);
            }}
            onClose={() => setShowSmartReplies(false)}
            isDarkMode={isDarkMode}
            accentColor={MODE_COLOR}
          />
        </div>
      )}

      {/* Phase 6: Keyboard Shortcuts Help Modal */}
      <VoxKeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        isDarkMode={isDarkMode}
      />

      {/* Download Modal */}
      {showDownloadModal && downloadItem && (
        <VoxDownloadModal
          isOpen={showDownloadModal}
          onClose={() => { setShowDownloadModal(false); setDownloadItem(null); }}
          items={[downloadItem]}
          isDarkMode={isDarkMode}
          accentColor={MODE_COLOR}
        />
      )}
    </div>
  );
};

export default VoxNotesMode;
