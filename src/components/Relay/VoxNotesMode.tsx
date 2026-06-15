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
  Mail,
  Calendar,
  CheckSquare,
  User,
  StickyNote,
  Trash2,
  Copy,
  X,
  Check,
  Download,
  Archive,
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  Pencil,
  AlignLeft,
  CheckCheck,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
import RecordButton from './RecordButton';
import VoxRecordArea from './VoxRecordArea';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { toastMicError } from '../../utils/micErrors';
import { voxModeService } from '../../services/relay/voxModeService';
// analyticsCollector loaded dynamically to avoid svc-crm-analytics chunk TDZ
import { type VoxNote, type LinkedItem } from '../../services/relay/voxModeTypes';
import toast from 'react-hot-toast';
import './Relay.css';

// Phase 2: Selection Mode
import { useVoxSelection, VoxSelectionItem } from '../../hooks/useVoxSelection';
import { VoxSelectToolbar } from './VoxSelectToolbar';
import VoxMessageMenu from './VoxMessageMenu';
import VoxDownloadModal from './VoxDownloadModal';
import { archiveRelayConversation } from '../../services/relay/relayArchiveService';

// Phase 5: AI Enhancements
import { MessageAIPanel } from './index';
import { summarizeConversation } from '../../services/relay/relayAIService';
import type { ConversationSummary } from '../../services/relay/relayAIService';

// Phase 6: Final Polish
import { useRelayKeyboardShortcuts } from '../../hooks/useRelayKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from './VoxKeyboardShortcutsHelp';
import { PlaybackSpeedControl } from './PlaybackSpeedControl';
import { useRelayStudio, useRelayModeRecorder, StudioMasthead, StudioMessageCard } from './studio';
import { VoxEmptyState } from './VoxEmptyState';
import { getEmptyStateConfig } from './voxEmptyStates';

// Relay brand accent (rose-500) — per-mode colors retired in 2.1d.1.
const MODE_COLOR = '#f43f5e';

interface VoxNotesModeProps {
  apiKey?: string;
  onBack: () => void;
  isDarkMode?: boolean;
  /** Note id to select on mount (e.g. from a triage row deep-link). */
  initialNoteId?: string;
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
  initialNoteId,
}) => {
  const [notes, setNotes] = useState<VoxNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<VoxNote | null>(null);
  // Playback flows through the shared Voice Studio transport. Active-note
  // state derives from studio.nowPlaying / studio.isPlaying / studio.progress.
  const studio = useRelayStudio();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadItem, setDownloadItem] = useState<VoxSelectionItem | null>(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  // Real contact picker for linking (replaces the old placeholder-link creator).
  const [linkContacts, setLinkContacts] = useState<Array<{ id: string; name: string; handle: string }>>([]);
  const [linkSearch, setLinkSearch] = useState('');


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
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Phase 6: Final Polish States
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
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

  // Tier 2 (unify trigger): the studio shell's FloatingMic + footer RECORDING
  // surface drive this mode's own capture pipeline; the in-pane record block
  // is retired. Preview → send still happens in-pane (below).
  useRelayModeRecorder({
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
    recording: recordingState === 'recording',
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
        toast.error('AI summarizer unavailable. Try again later.');
      }
    } catch (error: any) {
      console.error('Summarization error:', error);
      const msg = error?.message || '';
      if (msg.includes('API key') || msg.includes('API_KEY') || msg.includes('invalid') || msg.includes('unauthorized')) {
        toast.error('AI features require API configuration');
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
        toast.error('Network error. Please try again.');
      } else {
        toast.error('AI summarizer unavailable (beta)');
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
      if (recordingState === 'idle') startRecording().catch(toastMicError);
      else if (recordingState === 'recording') stopRecording();
    },
    onStopRecording: () => {
      // Priority 1: close any open modal/overlay first
      if (showMessageMenu) { setShowMessageMenu(null); return; }
      if (showSummary) { setShowSummary(false); return; }
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
      startRecording().catch(toastMicError);
    }
  };

  // Load notes on mount
  useEffect(() => {
    loadNotes();
  }, []);

  // Reload notes when search changes — including when cleared, so emptying the
  // box restores the full list instead of leaving the last filtered results.
  useEffect(() => {
    loadNotes();
    // loadNotes reads searchQuery; re-run whenever it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Auto-open a note ONLY when a triage deep-link hands us a matching
  // initialNoteId. Otherwise land on the timeline — PathC makes the
  // single-column timeline the surface, not a default-selected note.
  useEffect(() => {
    if (notes.length === 0 || selectedNote || !initialNoteId) return;
    const match = notes.find((n) => n.id === initialNoteId);
    if (match) setSelectedNote(match);
  }, [notes, initialNoteId]);

  useEffect(() => {
    const tags = new Set<string>();
    notes.forEach(note => note.tags.forEach(tag => tags.add(tag)));
    setAllTags(Array.from(tags));
  }, [notes]);

  // Load real contacts when the link picker opens.
  useEffect(() => {
    if (!showLinkModal) return;
    let cancelled = false;
    voxModeService.getPulseUsersAsContacts().then((cs) => {
      if (!cancelled) setLinkContacts(cs.map((c) => ({ id: c.id, name: c.name, handle: c.handle })));
    });
    return () => { cancelled = true; };
  }, [showLinkModal]);

  const loadNotes = async () => {
    try {
      const data = await voxModeService.getMyVoxNotes(searchQuery || undefined);
      setNotes(data);
    } catch (error) {
      console.error('Error loading Vox Notes:', error);
    }
  };

  // Play any note via the shared studio transport (toggles if already loaded).
  // Used by the timeline cards (inline play) and the detail player.
  const playNote = (note: VoxNote) => {
    if (studio.nowPlaying?.id === note.id) {
      studio.togglePlay();
      return;
    }
    studio.play({
      id: note.id,
      sender: note.title || 'Voice note',
      dur: formatDuration(note.duration),
      type: 'NOTE',
      transcript: note.transcript ?? null,
      source: 'notes',
      audioUrl: note.audioUrl,
    });
  };

  const handlePlayNote = () => {
    if (!selectedNote) return;
    playNote(selectedNote);
  };

  // Open a note in the detail editor (tags / linked-items / full transcript).
  const openNoteDetail = (note: VoxNote) => {
    setSelectedNote(note);
    studio.stop();
  };

  const handleSeek = (position: number) => {
    studio.seek(position);
  };

  // Selected-note playback state, derived from the shared studio transport.
  const notePlaying = !!selectedNote && studio.nowPlaying?.id === selectedNote.id && studio.isPlaying;
  const noteProgress = selectedNote && studio.nowPlaying?.id === selectedNote.id ? studio.progress : 0;

  const handleToggleFavorite = async (note: VoxNote) => {
    const next = !note.isFavorite;
    // Optimistic — then persist (the star + the Favorites filter both depend on
    // this surviving reload; it was previously local-only).
    setNotes((prev) => prev.map(n => n.id === note.id ? { ...n, isFavorite: next } : n));
    if (selectedNote?.id === note.id) setSelectedNote((s) => s ? { ...s, isFavorite: next } : s);

    const ok = await voxModeService.updateVoxNote(note.id, { is_favorite: next });
    if (!ok) {
      setNotes((prev) => prev.map(n => n.id === note.id ? { ...n, isFavorite: !next } : n));
      if (selectedNote?.id === note.id) setSelectedNote((s) => s ? { ...s, isFavorite: !next } : s);
      toast.error('Could not update favorite');
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

  // Link a real contact to the note (replaces the old fake placeholder-link
  // creator that minted dead "Email Item" entries pointing at nothing).
  const handleLinkContact = async (contact: { id: string; name: string }) => {
    if (!selectedNote) return;

    const success = await voxModeService.linkNoteToItem(
      selectedNote.id,
      'contact',
      contact.id,
      contact.name,
    );

    if (success) {
      const updatedNote = {
        ...selectedNote,
        linkedItems: [
          ...(selectedNote.linkedItems || []),
          { type: 'contact' as const, id: contact.id, title: contact.name, linkedAt: new Date() },
        ],
      };
      setSelectedNote(updatedNote);
      setNotes((prev) => prev.map(n => n.id === selectedNote.id ? updatedNote : n));
      setShowLinkModal(false);
      setLinkSearch('');
      toast.success(`Linked to ${contact.name}`);
    } else {
      toast.error('Failed to link contact');
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
    // Backgrounds (Pulse brand surfaces — translucent over true-black in dark)
    pageBg: isDarkMode
      ? 'bg-black'
      : 'bg-[#f8f8f8]',
    panelBg: isDarkMode
      ? 'bg-[rgba(255,255,255,0.03)]'
      : 'bg-white',
    cardBg: isDarkMode
      ? 'bg-[rgba(255,255,255,0.055)]'
      : 'bg-white',
    inputBg: isDarkMode
      ? 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.10)]'
      : 'bg-white border-[rgba(0,0,0,0.08)]',
    hoverBg: isDarkMode
      ? 'hover:bg-[rgba(255,255,255,0.055)]'
      : 'hover:bg-[#f2f2f2]',
    activeBg: isDarkMode
      ? 'bg-[rgba(244,63,94,0.12)]'
      : 'bg-[rgba(244,63,94,0.08)]',

    // Borders
    border: isDarkMode ? 'border-[rgba(255,255,255,0.06)]' : 'border-[rgba(0,0,0,0.08)]',
    borderAccent: 'border-[#f43f5e]',

    // Text
    text: isDarkMode ? 'text-[#fafafa]' : 'text-[#0f0f0f]',
    textSecondary: isDarkMode ? 'text-[#b4b4b8]' : 'text-[#52525b]',
    textMuted: 'text-[#6b7280]',
    textAccent: 'text-[#f43f5e]',

    // Buttons
    btnPrimary: 'btn-brand-primary',
    btnSecondary: isDarkMode
      ? 'bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.055)] text-[#fafafa] border border-[rgba(255,255,255,0.10)]'
      : 'bg-white hover:bg-[#f2f2f2] text-[#0f0f0f] border border-[rgba(0,0,0,0.08)]',
    btnGhost: isDarkMode
      ? 'hover:bg-[rgba(255,255,255,0.055)] text-[#b4b4b8] hover:text-[#fafafa]'
      : 'hover:bg-[#f2f2f2] text-[#52525b] hover:text-[#0f0f0f]',

    // Modal
    modalOverlay: 'pulse-modal-scrim',
    modalBg: isDarkMode
      ? 'bg-[#0a0a0a] border-[rgba(255,255,255,0.06)]'
      : 'bg-white border-[rgba(0,0,0,0.08)]',
  };

  // TODO(impeccable phase 3 task 6 — RelayVoiceMessage migration):
  // Notes list rows + detail-panel audio render should migrate to
  // <RelayVoiceMessage /> from `./RelayVoiceMessage` (sender always 'me',
  // senderName "My note"). Surface slots needed: tag-chip row and
  // linked-items button slot in footerExtras. Do this after the
  // surface-migration API gap noted at the top of RelayVoiceMessage.tsx
  // is filled.
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
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl ${tc.inputBg} ${tc.text} text-sm border focus:outline-none focus:ring-2 focus:ring-[#f43f5e]/50 transition-[box-shadow,border-color] ease-pulse`}
          />
        </div>

        {/* Chip vocabulary mirrors the Relay shell + Settings tabs: rounded-md
            pill, mono uppercase, coral-fill active state, no border. */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] uppercase tracking-[0.1em] transition ${
              showFavoritesOnly
                ? 'bg-[rgba(244,63,94,0.10)] text-[#e11d48] dark:text-[#fb7185]'
                : `${tc.textSecondary} ${tc.hoverBg}`
            }`}
          >
            <Star className="w-3 h-3" />
            Favorites
          </button>

          {allTags.slice(0, 4).map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] uppercase tracking-[0.1em] transition ${
                filterTag === tag
                  ? 'bg-[rgba(244,63,94,0.10)] text-[#e11d48] dark:text-[#fb7185]'
                  : `${tc.textSecondary} ${tc.hoverBg}`
              }`}
            >
              <Tag className="w-3 h-3" />
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Notes timeline — a single column of flat studio cards (PathCNotes):
          edit-icon tile + title + when·dur + play + waveform + transcript +
          #TAG chips. Replaces the bubble rows; the detail editor stays
          reachable by clicking a card. */}
      <div className="flex-1 overflow-y-auto px-7 pt-2 pb-6">
        {Object.entries(groupedNotes).map(([dateKey, dateNotes]) => (
          <div key={dateKey} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
                {new Date(dateKey).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--pulse-border)' }} />
            </div>
            <div className="space-y-3">
              {dateNotes.map((note) => {
                const active = studio.nowPlaying?.id === note.id;
                return (
                  <React.Fragment key={note.id}>
                    <StudioMessageCard
                      active={active}
                      isPlaying={active && studio.isPlaying}
                      progress={active ? studio.progress : 0}
                      canPlay={!!note.audioUrl}
                      onPlay={() => playNote(note)}
                      onClick={() => openNoteDetail(note)}
                      leadingNode={
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                          <Pencil className="w-4 h-4" />
                        </div>
                      }
                      title={note.title || 'Untitled Note'}
                      meta={`${new Date(note.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${formatDuration(note.duration)}`}
                      waveSeed={note.id}
                      waveCount={60}
                      bodyIndent={48}
                      selectionCheckbox={isSelectionMode ? (
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
                          className={`w-7 h-7 shrink-0 self-center rounded-lg flex items-center justify-center transition-colors ease-pulse ${
                            isSelected(note.id)
                              ? 'bg-[#f43f5e] border-2 border-[#e11d48]'
                              : 'bg-white dark:bg-gray-700 border-2 border-gray-400 dark:border-gray-500'
                          }`}
                          aria-label={isSelected(note.id) ? 'Deselect note' : 'Select note'}
                        >
                          {isSelected(note.id) && <Check className="w-4 h-4 text-white" />}
                        </button>
                      ) : undefined}
                      actions={!isSelectionMode ? (
                        <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(note); }}
                            className={`p-1.5 rounded-md transition ${
                              note.isFavorite
                                ? 'text-amber-500'
                                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                            aria-label={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star className="w-3.5 h-3.5" fill={note.isFavorite ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuAnchorRect(rect);
                              setShowMessageMenu(showMessageMenu === note.id ? null : note.id);
                            }}
                            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                            aria-label="More actions"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : undefined}
                    >
                      {note.transcript && (
                        <div className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-3">
                          {note.transcript}
                        </div>
                      )}
                      {(note.tags.length > 0 || note.linkedItems.length > 0) && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {note.tags.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-[0.1em] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                            >
                              #{t}
                            </span>
                          ))}
                          {note.linkedItems.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                              <Link2 className="w-3 h-3" />
                              {note.linkedItems.length}
                            </span>
                          )}
                        </div>
                      )}
                    </StudioMessageCard>

                    {/* Note menu — anchored overlay (fixed position via rect) */}
                    {!isSelectionMode && showMessageMenu === note.id && menuAnchorRect && (
                      <VoxMessageMenu
                        isDarkMode={isDarkMode}
                        accentColor="#f43f5e"
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
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ))}

        {filteredNotes.length === 0 && (
          <div className="py-12">
            <VoxEmptyState
              {...emptyConfig}
              eyebrow="Notes"
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
      {/* Masthead — Path C "Voice notes". AI + selection actions ride the
          right slot; hidden while a note's detail editor is open (it carries
          its own header). */}
      {!selectedNote && (
        <div className="px-7 pt-6">
          <StudioMasthead
            eyebrow="Personal notes"
            title="Voice notes"
            subtitle="Personal · never shared · auto-transcribed"
            right={
              notes.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={handleSummarizeNotes}
                    disabled={isGeneratingAI}
                    className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-[0.12em] text-rose-700 dark:text-rose-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40 transition"
                    title="AI summarize"
                  >
                    {isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlignLeft className="w-3 h-3" />}
                    <span className="hidden sm:inline">Summarize</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => (isSelectionMode ? exitSelectionMode() : enterSelectionMode())}
                    title={isSelectionMode ? 'Exit selection' : 'Select notes'}
                    aria-label={isSelectionMode ? 'Exit selection' : 'Select notes'}
                    className={`p-2 rounded-md transition ${
                      isSelectionMode
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowShortcutsHelp(true)}
                    title="Keyboard shortcuts"
                    className="p-2 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition md:hidden"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </>
              ) : undefined
            }
          />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Notes timeline (master) — single column. Full-width by default;
            hidden once a note opens (the detail editor takes over with a back
            affordance). PathC: the timeline IS the surface, not a side list. */}
        <div className={`flex flex-col flex-1 min-w-0 ${selectedNote ? 'hidden' : ''}`}>
          {renderNotesList()}
        </div>

        {/* Note detail editor — full-width when a note is open, else hidden. */}
        <div className={`flex-1 flex flex-col overflow-hidden ${
          !selectedNote ? 'hidden' : ''
        }`}>
          {selectedNote ? (
            <>
              {/* Note Header */}
              <div className={`px-4 md:px-6 py-4 border-b ${tc.border} ${tc.cardBg}`}>
                <div className="flex items-start justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedNote(null)}
                    className={`shrink-0 -ml-1 mt-0.5 p-1.5 rounded-lg ${tc.btnGhost}`}
                    aria-label="Back to notes list"
                    title="Back to notes"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className={`text-xl font-bold rounded-xl px-3 py-1 ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-[#f43f5e]/50`}
                          autoFocus
                        />
                        <button
                          onClick={handleUpdateTitle}
                          className={`p-2 rounded-xl text-[#f43f5e] ${tc.hoverBg}`}
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
                        className={`text-lg md:text-xl font-bold cursor-pointer hover:text-[#f43f5e] transition-colors truncate ${tc.text}`}
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
                      className={`p-2 rounded-xl transition-colors duration-200 ease-pulse ${
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
                    className="w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 ease-pulse bg-rose-500 hover:bg-rose-600"
                    aria-label={notePlaying ? 'Pause' : 'Play'}
                  >
                    {notePlaying ? (
                      <Pause className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    ) : (
                      <Play className="w-5 h-5 md:w-6 md:h-6 text-white ml-1" />
                    )}
                  </button>
                  <div className="flex-1">
                    <VoxAudioVisualizer
                      analyser={null}
                      isActive={false}
                      isPlaying={notePlaying}
                      playbackProgress={noteProgress}
                      mode="waveform"
                      color={MODE_COLOR}
                      height={56}
                      isDarkMode={isDarkMode}
                      onSeek={handleSeek}
                    />
                  </div>
                  {/* Phase 6: Playback Speed Control */}
                  <PlaybackSpeedControl
                    speed={studio.playbackRate}
                    onSpeedChange={studio.setPlaybackRate}
                    compact
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>

              {/* Note Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {/* AI Summary — provenance chip replaces the prior coral-text
                    heading so the artifact is recognizably AI-attributed,
                    consistent with the section's other AI surfaces. */}
                {selectedNote.summary && (
                  <div className={`p-4 rounded-xl border ${tc.cardBg} ${tc.border}`}>
                    <div className="mb-2">
                      <AIProvenanceChip vendor="PULSE AI" type="SUMMARY" />
                    </div>
                    <p className={`text-sm leading-relaxed ${tc.textSecondary}`}>
                      {selectedNote.summary}
                    </p>
                  </div>
                )}

                {/* Transcript — labeled as a machine artifact. The transcript
                    text itself is user-bound data, but its existence is a
                    Pulse AI side-effect of recording. */}
                <div>
                  <div className="mb-3">
                    <AIProvenanceChip vendor="PULSE AI" type="TRANSCRIPT" />
                  </div>
                  <div className={`p-4 rounded-xl ${tc.cardBg} border ${tc.border}`}>
                    <p className={`leading-relaxed whitespace-pre-wrap ${tc.textSecondary}`}>
                      {selectedNote.transcript || 'No transcript available'}
                    </p>
                  </div>
                </div>

                {/* Tags — neutral chips. Coral is reserved for state (active
                    filter in the sidebar), not taxonomy on the artifact itself. */}
                <div>
                  <h3 className={`text-sm font-semibold mb-3 ${tc.textSecondary}`}>Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedNote.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2 py-1 rounded font-mono text-[11px] uppercase tracking-[0.1em] ${tc.cardBg} border ${tc.border} ${tc.textSecondary}`}
                      >
                        {tag}
                      </span>
                    ))}
                    <button
                      onClick={() => setShowTagInput(!showTagInput)}
                      className={`px-2 py-1 rounded font-mono text-[11px] uppercase tracking-[0.1em] transition flex items-center gap-1 ${tc.cardBg} border ${tc.border} ${tc.textSecondary} ${tc.hoverBg}`}
                    >
                      <Plus className="w-3 h-3" />
                      Add tag
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
                        className="p-1 rounded-lg transition-colors ease-pulse"
                        style={{ color: MODE_COLOR }}
                        aria-label="Confirm tag"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setShowTagInput(false); setNewTagText(''); }}
                        className={`p-1 rounded-lg transition-colors ease-pulse ${tc.textMuted}`}
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
                        className={`flex items-center gap-3 p-3 rounded-xl ${tc.cardBg} border ${tc.border}`}
                      >
                        <div className={`shrink-0 ${tc.textMuted}`}>
                          {LINK_TYPE_ICONS[item.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${tc.text}`}>{item.title}</p>
                          <p className={`text-xs capitalize ${tc.textMuted}`}>{item.type}</p>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => setShowLinkModal(true)}
                      className={`w-full p-3 rounded-xl text-sm transition-colors ease-pulse flex items-center justify-center gap-2 ${tc.cardBg} border ${tc.border} ${tc.textSecondary} ${tc.hoverBg} hover:text-[#f43f5e]`}
                    >
                      <Link2 className="w-4 h-4" />
                      Link a contact
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className={`flex-1 flex items-center justify-center ${tc.textMuted}`}>
              <div className="text-center p-6">
                <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center border ${tc.border} ${isDarkMode ? 'bg-white/[0.03]' : 'bg-zinc-100'}`}>
                  <FileText className={`w-7 h-7 ${tc.textMuted}`} />
                </div>
                <p className={`text-lg ${tc.text}`}>Select a note to view</p>
                <p className={`text-sm mt-1 ${tc.textSecondary}`}>or record a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview → send. The in-pane record trigger is retired (Tier 2:
          the FloatingMic + StudioFooter RECORDING surface drive capture via
          the studio recorder); the review-before-send step stays here. */}
      {recordingState === 'preview' && recordingData && (
        <div className={`px-4 md:px-6 py-4 border-t ${tc.border}`}>
          <RecordingPreview
            recordingData={recordingData}
            onSend={handleSendRecording}
            onCancel={cancelRecording}
            onRetry={() => {
              cancelRecording();
              setTimeout(() => startRecording(), 100);
            }}
            isDarkMode={isDarkMode}
          />
        </div>
      )}

      {/* Audio playback is owned by the shared RelayStudioProvider (single
          <audio>) — no local element here. */}

      {/* Link Modal — single-line list pattern; description rows + coral icon tiles were tautological */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className={tc.modalOverlay} onClick={() => setShowLinkModal(false)} />
          <div className={`relative w-full max-w-sm rounded-2xl border ${tc.modalBg} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-[11px] font-mono uppercase tracking-[0.1em] ${tc.textSecondary}`}>Link a contact</h3>
              <button
                onClick={() => { setShowLinkModal(false); setLinkSearch(''); }}
                className={`p-1 rounded-md ${tc.btnGhost}`}
                type="button"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${tc.textMuted}`} />
              <input
                type="text"
                placeholder="Search contacts..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                autoFocus
                className={`w-full pl-10 pr-3 py-2 rounded-lg text-sm border ${tc.border} ${tc.cardBg} ${tc.text} focus:outline-none focus:ring-2 focus:ring-[#f43f5e]/50`}
              />
            </div>

            <div className="space-y-0.5 max-h-64 overflow-y-auto">
              {linkContacts
                .filter((c) => c.name.toLowerCase().includes(linkSearch.toLowerCase()))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleLinkContact(c)}
                    className={`w-full px-3 py-2.5 rounded-lg text-left transition-colors flex items-center gap-3 ${tc.hoverBg}`}
                    type="button"
                  >
                    <User className={`w-4 h-4 shrink-0 ${tc.textMuted}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${tc.text}`}>{c.name}</p>
                      {c.handle && <p className={`text-xs truncate ${tc.textMuted}`}>@{c.handle}</p>}
                    </div>
                    <ChevronRight className={`w-4 h-4 ${tc.textMuted}`} />
                  </button>
                ))}
              {linkContacts.filter((c) => c.name.toLowerCase().includes(linkSearch.toLowerCase())).length === 0 && (
                <p className={`text-center py-4 text-sm ${tc.textMuted}`}>No contacts found</p>
              )}
            </div>
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
          accentColor="#f43f5e"
          allSelected={selectionCount === filteredNotes.length && filteredNotes.length > 0}
        />
      )}

      {/* Phase 5: AI Enhancement Modals */}

      {/* Conversation Summary Modal */}
      {conversationSummary && showSummary && (
        <div className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <MessageAIPanel
              summary={conversationSummary}
              isDarkMode={isDarkMode}
              onClose={() => setShowSummary(false)}
            />
          </div>
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
          accentColor="#f43f5e"
        />
      )}
    </div>
  );
};

export default VoxNotesMode;
