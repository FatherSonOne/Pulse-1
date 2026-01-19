// Voice Bookmarks Component
// Mark specific moments in voxes for quick reference

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceBookmark, BookmarkCollection } from '../../services/voxer/advancedVoxerTypes';

// ============================================
// TYPES
// ============================================

interface VoiceBookmarksProps {
  voxId: string;
  duration: number;
  audioUrl: string;
  bookmarks: VoiceBookmark[];
  onAddBookmark: (bookmark: Omit<VoiceBookmark, 'id' | 'createdAt'>) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
  onUpdateBookmark: (bookmarkId: string, updates: Partial<VoiceBookmark>) => void;
  currentUserId: string;
}

interface BookmarkEditorProps {
  isOpen: boolean;
  timestamp: number;
  duration: number;
  existingBookmark?: VoiceBookmark;
  onSave: (label: string, color: string, note?: string, tags?: string[]) => void;
  onDelete?: () => void;
  onClose: () => void;
}

interface BookmarkTimelineProps {
  bookmarks: VoiceBookmark[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  onEdit: (bookmark: VoiceBookmark) => void;
}

// ============================================
// BOOKMARK COLORS
// ============================================

const BOOKMARK_COLORS = [
  { id: 'red', class: 'bg-red-500', light: 'bg-red-100 dark:bg-red-900/30' },
  { id: 'orange', class: 'bg-orange-500', light: 'bg-orange-100 dark:bg-orange-900/30' },
  { id: 'yellow', class: 'bg-yellow-500', light: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { id: 'green', class: 'bg-emerald-500', light: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { id: 'blue', class: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-900/30' },
  { id: 'purple', class: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-900/30' },
  { id: 'pink', class: 'bg-pink-500', light: 'bg-pink-100 dark:bg-pink-900/30' },
];

const QUICK_LABELS = [
  'Important',
  'Action Item',
  'Question',
  'Decision',
  'Follow Up',
  'Key Point',
  'Quote',
  'Reference',
];

// ============================================
// FORMAT TIME HELPER
// ============================================

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ============================================
// BOOKMARK EDITOR COMPONENT
// ============================================

const BookmarkEditor: React.FC<BookmarkEditorProps> = ({
  isOpen,
  timestamp,
  duration,
  existingBookmark,
  onSave,
  onDelete,
  onClose,
}) => {
  const [label, setLabel] = useState(existingBookmark?.label || '');
  const [selectedColor, setSelectedColor] = useState(existingBookmark?.color || 'bg-blue-500');
  const [note, setNote] = useState(existingBookmark?.note || '');
  const [tags, setTags] = useState<string[]>(existingBookmark?.tags || []);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (existingBookmark) {
      setLabel(existingBookmark.label);
      setSelectedColor(existingBookmark.color);
      setNote(existingBookmark.note || '');
      setTags(existingBookmark.tags || []);
    } else {
      setLabel('');
      setSelectedColor('bg-blue-500');
      setNote('');
      setTags([]);
    }
  }, [existingBookmark, isOpen]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = () => {
    if (label.trim()) {
      onSave(label.trim(), selectedColor, note.trim() || undefined, tags.length > 0 ? tags : undefined);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-scaleIn">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-bookmark text-orange-500"></i>
            <h3 className="font-bold dark:text-white">
              {existingBookmark ? 'Edit Bookmark' : 'Add Bookmark'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500 font-mono">@ {formatTime(timestamp)}</span>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition">
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Quick Labels */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">Quick Labels</label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_LABELS.map(quickLabel => (
                <button
                  key={quickLabel}
                  onClick={() => setLabel(quickLabel)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    label === quickLabel
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {quickLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Label */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter bookmark label..."
              className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-orange-500 dark:text-white"
            />
          </div>

          {/* Color Selection */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">Color</label>
            <div className="flex gap-2">
              {BOOKMARK_COLORS.map(color => (
                <button
                  key={color.id}
                  onClick={() => setSelectedColor(color.class)}
                  className={`w-8 h-8 rounded-full ${color.class} transition transform ${
                    selectedColor === color.class ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 ring-zinc-400 scale-110' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this moment..."
              rows={2}
              className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-orange-500 dark:text-white resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-zinc-400 hover:text-red-500"
                  >
                    <i className="fa-solid fa-times text-[10px]"></i>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Add tag..."
                className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm border-0 focus:ring-2 focus:ring-orange-500 dark:text-white"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-lg text-sm transition"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
          {existingBookmark && onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium transition"
            >
              <i className="fa-solid fa-trash mr-1"></i>
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-medium text-zinc-700 dark:text-zinc-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// BOOKMARK TIMELINE COMPONENT
// ============================================

const BookmarkTimeline: React.FC<BookmarkTimelineProps> = ({
  bookmarks,
  duration,
  currentTime,
  onSeek,
  onEdit,
}) => {
  return (
    <div className="relative h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-visible">
      {/* Progress */}
      <div 
        className="absolute top-0 left-0 h-full bg-orange-500 rounded-full transition-all duration-100"
        style={{ width: `${(currentTime / duration) * 100}%` }}
      />
      
      {/* Bookmark Markers */}
      {bookmarks.map(bookmark => {
        const position = (bookmark.timestamp / duration) * 100;
        const colorClass = bookmark.color || 'bg-blue-500';
        
        return (
          <div
            key={bookmark.id}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group cursor-pointer"
            style={{ left: `${position}%` }}
            onClick={() => onSeek(bookmark.timestamp)}
          >
            {/* Marker */}
            <div className={`w-3 h-3 rounded-full ${colorClass} ring-2 ring-white dark:ring-zinc-900 transition group-hover:scale-125`} />
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition pointer-events-none">
              <div className="bg-zinc-900 dark:bg-zinc-700 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap shadow-lg">
                <div className="font-medium">{bookmark.label}</div>
                <div className="text-zinc-400 text-[10px]">{formatTime(bookmark.timestamp)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// BOOKMARKS LIST COMPONENT
// ============================================

interface BookmarksListProps {
  bookmarks: VoiceBookmark[];
  onSeek: (time: number) => void;
  onEdit: (bookmark: VoiceBookmark) => void;
  onRemove: (id: string) => void;
}

const BookmarksList: React.FC<BookmarksListProps> = ({
  bookmarks,
  onSeek,
  onEdit,
  onRemove,
}) => {
  const sortedBookmarks = [...bookmarks].sort((a, b) => a.timestamp - b.timestamp);

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-6 text-zinc-500">
        <i className="fa-solid fa-bookmark text-2xl mb-2 opacity-50"></i>
        <p className="text-sm">No bookmarks yet</p>
        <p className="text-xs mt-1">Click on the timeline to add one</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {sortedBookmarks.map(bookmark => (
        <div
          key={bookmark.id}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition group"
        >
          <button
            onClick={() => onSeek(bookmark.timestamp)}
            className={`w-8 h-8 rounded-full ${bookmark.color} flex items-center justify-center text-white text-xs hover:scale-110 transition`}
          >
            <i className="fa-solid fa-play"></i>
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm dark:text-white truncate">{bookmark.label}</span>
              <span className="text-xs text-zinc-400 font-mono">{formatTime(bookmark.timestamp)}</span>
            </div>
            {bookmark.note && (
              <p className="text-xs text-zinc-500 truncate">{bookmark.note}</p>
            )}
            {bookmark.tags && bookmark.tags.length > 0 && (
              <div className="flex gap-1 mt-1">
                {bookmark.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">
                    {tag}
                  </span>
                ))}
                {bookmark.tags.length > 3 && (
                  <span className="text-[9px] text-zinc-400">+{bookmark.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => onEdit(bookmark)}
              className="w-7 h-7 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
            >
              <i className="fa-solid fa-pen text-[10px]"></i>
            </button>
            <button
              onClick={() => onRemove(bookmark.id)}
              className="w-7 h-7 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-zinc-400 hover:text-red-500"
            >
              <i className="fa-solid fa-trash text-[10px]"></i>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// MAIN VOICE BOOKMARKS COMPONENT
// ============================================

export const VoiceBookmarks: React.FC<VoiceBookmarksProps> = ({
  voxId,
  duration,
  audioUrl,
  bookmarks,
  onAddBookmark,
  onRemoveBookmark,
  onUpdateBookmark,
  currentUserId,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<VoiceBookmark | null>(null);
  const [selectedTimestamp, setSelectedTimestamp] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = Math.round(percentage * duration);
    setSelectedTimestamp(time);
    setEditingBookmark(null);
    setShowEditor(true);
  };

  // Handle seek
  const handleSeek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  }, [isPlaying]);

  // Handle edit
  const handleEdit = (bookmark: VoiceBookmark) => {
    setEditingBookmark(bookmark);
    setSelectedTimestamp(bookmark.timestamp);
    setShowEditor(true);
  };

  // Handle save
  const handleSave = (label: string, color: string, note?: string, tags?: string[]) => {
    if (editingBookmark) {
      onUpdateBookmark(editingBookmark.id, { label, color, note, tags });
    } else {
      onAddBookmark({
        voxId,
        userId: currentUserId,
        timestamp: selectedTimestamp,
        label,
        color,
        note,
        tags,
      });
    }
    setShowEditor(false);
    setEditingBookmark(null);
  };

  // Handle delete
  const handleDelete = () => {
    if (editingBookmark) {
      onRemoveBookmark(editingBookmark.id);
      setShowEditor(false);
      setEditingBookmark(null);
    }
  };

  // Update current time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl overflow-hidden">
      {/* Hidden Audio */}
      <audio ref={audioRef} src={audioUrl} className="hidden" />

      {/* Compact View */}
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-orange-500 transition"
          >
            <i className={`fa-solid fa-bookmark text-orange-500`}></i>
            <span>Bookmarks ({bookmarks.length})</span>
            <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-xs text-zinc-400`}></i>
          </button>
          
          <button
            onClick={() => { setEditingBookmark(null); setSelectedTimestamp(currentTime); setShowEditor(true); }}
            className="text-xs text-orange-500 hover:text-orange-600 font-medium"
          >
            <i className="fa-solid fa-plus mr-1"></i>
            Add
          </button>
        </div>

        {/* Timeline */}
        <div className="cursor-crosshair" onClick={handleTimelineClick}>
          <BookmarkTimeline
            bookmarks={bookmarks}
            duration={duration}
            currentTime={currentTime}
            onSeek={handleSeek}
            onEdit={handleEdit}
          />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-zinc-200 dark:border-zinc-700 pt-3">
          <BookmarksList
            bookmarks={bookmarks}
            onSeek={handleSeek}
            onEdit={handleEdit}
            onRemove={onRemoveBookmark}
          />
        </div>
      )}

      {/* Editor Modal */}
      <BookmarkEditor
        isOpen={showEditor}
        timestamp={selectedTimestamp}
        duration={duration}
        existingBookmark={editingBookmark || undefined}
        onSave={handleSave}
        onDelete={editingBookmark ? handleDelete : undefined}
        onClose={() => { setShowEditor(false); setEditingBookmark(null); }}
      />
    </div>
  );
};

export default VoiceBookmarks;
