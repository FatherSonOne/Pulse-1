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
  ChevronLeft,
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
  Square,
  Check,
  Menu
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { voxModeService } from '../../services/voxer/voxModeService';
import analyticsCollector from '../../services/analyticsCollector';
import type { VoxNote, LinkedItem } from '../../services/voxer/voxModeTypes';
import './Voxer.css';

// Mode color for Vox Notes
const MODE_COLOR = '#EC4899';

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

  const audioRef = useRef<HTMLAudioElement>(null);

  // Use the recording hook for click-to-record with preview
  const {
    state: recordingState,
    duration: recordingDuration,
    analyser,
    recordingData,
    startRecording,
    stopRecording,
    cancelRecording,
    sendRecording,
  } = useVoxRecording({
    onRecordingComplete: async (data) => {
      console.log('Recording complete:', data.duration, 'seconds');
    },
  });

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
      analyticsCollector.trackMessageEvent({
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

  useEffect(() => {
    loadNotes();
  }, [searchQuery]);

  useEffect(() => {
    const tags = new Set<string>();
    notes.forEach(note => note.tags.forEach(tag => tags.add(tag)));
    setAllTags(Array.from(tags));
  }, [notes]);

  const loadNotes = async () => {
    const data = await voxModeService.getMyVoxNotes(searchQuery || undefined);
    setNotes(data);
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

  const handleUpdateTitle = async () => {
    if (!selectedNote || !editTitle.trim()) return;

    const updatedNote = { ...selectedNote, title: editTitle };
    setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
    setSelectedNote(updatedNote);
    setIsEditing(false);
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
              <button
                key={note.id}
                onClick={() => {
                  setSelectedNote(note);
                  setIsPlaying(false);
                  setPlaybackProgress(0);
                  setShowMobileSidebar(false);
                }}
                className={`w-full p-4 text-left border-b ${tc.border} transition-all ${
                  selectedNote?.id === note.id ? tc.activeBg : tc.hoverBg
                }`}
              >
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
                </div>
              </button>
            ))}
          </div>
        ))}

        {filteredNotes.length === 0 && (
          <div className={`text-center py-12 ${tc.textMuted}`}>
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No notes found</p>
            <p className="text-xs mt-1">Record your first voice note</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={`h-full flex flex-col ${tc.pageBg}`}>
      {/* Header */}
      <div
        className={`px-4 md:px-6 py-4 border-b ${tc.border} ${tc.panelBg}`}
        style={{
          background: isDarkMode
            ? `linear-gradient(135deg, rgba(236,72,153,0.15) 0%, transparent 50%)`
            : `linear-gradient(135deg, rgba(236,72,153,0.1) 0%, transparent 50%)`
        }}
      >
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={onBack}
            className={`p-2 rounded-xl ${tc.btnGhost} transition-all duration-200`}
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div
            className="p-2.5 rounded-xl shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #e11d48 100%)`,
              boxShadow: `0 8px 24px ${MODE_COLOR}40`
            }}
          >
            <FileText className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className={`text-lg md:text-xl font-bold ${tc.text}`}>Vox Notes</h1>
            <p className={`text-xs md:text-sm ${tc.textSecondary} hidden sm:block`}>Your Voice, Organized</p>
          </div>

          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setShowMobileSidebar(true)}
            className={`md:hidden p-2 rounded-xl ${tc.btnGhost} transition-all`}
            aria-label="Show notes list"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Quick Record Button */}
          <button
            onClick={handleRecordToggle}
            disabled={recordingState === 'preview'}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
              recordingState === 'recording'
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                : tc.btnPrimary
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={recordingState === 'recording' ? 'Stop recording' : 'Start recording'}
          >
            {recordingState === 'recording' && (
              <span className="absolute inset-0 rounded-xl animate-ping bg-red-400 opacity-30" />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {recordingState === 'recording' ? (
                <>
                  <Square className="w-4 h-4" />
                  <span className="hidden sm:inline">Stop</span>
                  <span className="font-mono text-xs">{Math.floor(recordingDuration / 60)}:{Math.floor(recordingDuration % 60).toString().padStart(2, '0')}</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span className="hidden sm:inline">New Note</span>
                </>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Recording Banner */}
      {recordingState === 'recording' && (
        <div className={`px-4 md:px-6 py-4 border-b border-red-500/30 ${isDarkMode ? 'bg-red-500/10' : 'bg-red-50'}`}>
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-red-500 font-medium">
                Recording... {Math.floor(recordingDuration / 60)}:{Math.floor(recordingDuration % 60).toString().padStart(2, '0')}
              </span>
              <button
                onClick={stopRecording}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-xl transition-all"
              >
                Stop
              </button>
            </div>
            <div className="w-full max-w-lg">
              <VoxAudioVisualizer
                analyser={analyser}
                isActive={true}
                mode="waveform"
                color={MODE_COLOR}
                height={48}
                isDarkMode={isDarkMode}
              />
            </div>
          </div>
        </div>
      )}

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

        {/* Desktop Notes List Sidebar */}
        <div className={`hidden md:flex w-96 border-r ${tc.border} flex-col ${tc.panelBg}`}>
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
                    <button className={`p-2 rounded-xl ${tc.btnGhost}`} aria-label="Copy">
                      <Copy className="w-5 h-5" />
                    </button>
                    <button className={`p-2 rounded-xl ${tc.btnGhost}`} aria-label="Delete">
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
                    <button className={`px-3 py-1 rounded-full text-sm transition-all flex items-center gap-1 ${tc.cardBg} border ${tc.border} ${tc.textSecondary} ${tc.hoverBg}`}>
                      <Plus className="w-3 h-3" />
                      Add Tag
                    </button>
                  </div>
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
                  className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-3 ${tc.cardBg} border ${tc.border} ${tc.hoverBg}`}
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
    </div>
  );
};

export default VoxNotesMode;
