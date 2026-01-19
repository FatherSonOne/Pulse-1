// Vox Playlists Component
// Create and manage collections of voice messages

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { VoxPlaylist, VoxPlaylistItem, SmartPlaylistCriteria, DEFAULT_PLAYLISTS } from '../../services/voxer/advancedVoxerTypes';

// ============================================
// TYPES
// ============================================

interface VoxPlaylistsProps {
  playlists: VoxPlaylist[];
  onCreatePlaylist: (playlist: Omit<VoxPlaylist, 'id' | 'createdAt' | 'updatedAt' | 'totalDuration'>) => void;
  onUpdatePlaylist: (id: string, updates: Partial<VoxPlaylist>) => void;
  onDeletePlaylist: (id: string) => void;
  onAddToPlaylist: (playlistId: string, voxId: string) => void;
  onRemoveFromPlaylist: (playlistId: string, itemId: string) => void;
  onPlayPlaylist: (playlistId: string) => void;
  currentUserId: string;
}

interface PlaylistEditorProps {
  isOpen: boolean;
  onClose: () => void;
  playlist?: VoxPlaylist;
  onSave: (data: {
    name: string;
    description?: string;
    coverColor: string;
    icon: string;
    isPublic: boolean;
    isSmartPlaylist: boolean;
    smartCriteria?: SmartPlaylistCriteria;
  }) => void;
}

interface PlaylistCardProps {
  playlist: VoxPlaylist;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isPlaying?: boolean;
}

// ============================================
// PLAYLIST COLORS & ICONS
// ============================================

const PLAYLIST_COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
];

const PLAYLIST_ICONS = [
  'fa-music', 'fa-star', 'fa-heart', 'fa-fire',
  'fa-bolt', 'fa-rocket', 'fa-gem', 'fa-crown',
  'fa-flag', 'fa-bookmark', 'fa-folder', 'fa-briefcase',
  'fa-graduation-cap', 'fa-lightbulb', 'fa-bell', 'fa-calendar',
];

// ============================================
// FORMAT DURATION HELPER
// ============================================

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
};

// ============================================
// PLAYLIST EDITOR COMPONENT
// ============================================

const PlaylistEditor: React.FC<PlaylistEditorProps> = ({
  isOpen,
  onClose,
  playlist,
  onSave,
}) => {
  const [name, setName] = useState(playlist?.name || '');
  const [description, setDescription] = useState(playlist?.description || '');
  const [coverColor, setCoverColor] = useState(playlist?.coverColor || 'bg-blue-500');
  const [icon, setIcon] = useState(playlist?.icon || 'fa-music');
  const [isPublic, setIsPublic] = useState(playlist?.isPublic || false);
  const [isSmartPlaylist, setIsSmartPlaylist] = useState(playlist?.isSmartPlaylist || false);
  const [smartCriteria, setSmartCriteria] = useState<SmartPlaylistCriteria>(
    playlist?.smartCriteria || {}
  );

  const handleSave = () => {
    if (name.trim()) {
      onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        coverColor,
        icon,
        isPublic,
        isSmartPlaylist,
        smartCriteria: isSmartPlaylist ? smartCriteria : undefined,
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-scaleIn flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold dark:text-white">
            {playlist ? 'Edit Playlist' : 'Create Playlist'}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Preview */}
          <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <div className={`w-16 h-16 rounded-xl ${coverColor} flex items-center justify-center text-white text-2xl`}>
              <i className={`fa-solid ${icon}`}></i>
            </div>
            <div>
              <div className="font-bold dark:text-white">{name || 'Playlist Name'}</div>
              <div className="text-xs text-zinc-500">{description || 'No description'}</div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter playlist name..."
              className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-orange-500 dark:text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-orange-500 dark:text-white"
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">Color</label>
            <div className="grid grid-cols-8 gap-2">
              {PLAYLIST_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setCoverColor(color)}
                  className={`w-8 h-8 rounded-lg ${color} transition transform ${
                    coverColor === color ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 ring-zinc-400 scale-110' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">Icon</label>
            <div className="grid grid-cols-8 gap-2">
              {PLAYLIST_ICONS.map(ic => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                    icon === ic
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <i className={`fa-solid ${ic} text-sm`}></i>
                </button>
              ))}
            </div>
          </div>

          {/* Smart Playlist Toggle */}
          <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <div>
              <div className="font-medium text-sm dark:text-white">Smart Playlist</div>
              <div className="text-xs text-zinc-500">Auto-populate based on criteria</div>
            </div>
            <button
              onClick={() => setIsSmartPlaylist(!isSmartPlaylist)}
              className={`w-12 h-6 rounded-full transition ${isSmartPlaylist ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${isSmartPlaylist ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Smart Criteria */}
          {isSmartPlaylist && (
            <div className="space-y-3 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl">
              <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase">Smart Criteria</div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smartCriteria.includeStarred || false}
                  onChange={(e) => setSmartCriteria({ ...smartCriteria, includeStarred: e.target.checked })}
                  className="rounded text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm dark:text-white">Include starred voxes</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smartCriteria.includeWithActions || false}
                  onChange={(e) => setSmartCriteria({ ...smartCriteria, includeWithActions: e.target.checked })}
                  className="rounded text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm dark:text-white">Include voxes with action items</span>
              </label>

              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Min duration (seconds)</label>
                <input
                  type="number"
                  value={smartCriteria.minDuration || ''}
                  onChange={(e) => setSmartCriteria({ ...smartCriteria, minDuration: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="No minimum"
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-orange-500 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Public Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm dark:text-white">Public</div>
              <div className="text-xs text-zinc-500">Allow others to view this playlist</div>
            </div>
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`w-12 h-6 rounded-full transition ${isPublic ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${isPublic ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-medium text-zinc-700 dark:text-zinc-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {playlist ? 'Save Changes' : 'Create Playlist'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// PLAYLIST CARD COMPONENT
// ============================================

const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  onPlay,
  onEdit,
  onDelete,
  isPlaying = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="group relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-lg transition">
      {/* Cover */}
      <div className={`h-24 ${playlist.coverColor} relative`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <i className={`fa-solid ${playlist.icon} text-4xl text-white/30`}></i>
        </div>
        
        {/* Play Button Overlay */}
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className={`absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition ${
            isPlaying ? 'bg-black/30' : ''
          }`}
        >
          <div className={`w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg transform transition ${
            isPlaying ? 'scale-100' : 'scale-0 group-hover:scale-100'
          }`}>
            <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-zinc-900`}></i>
          </div>
        </button>

        {/* Smart Badge */}
        {playlist.isSmartPlaylist && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded-full text-[10px] text-white font-medium">
            <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
            Smart
          </div>
        )}

        {/* Menu Button */}
        <div className="absolute top-2 right-2">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
          >
            <i className="fa-solid fa-ellipsis-v"></i>
          </button>
          
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden z-20 min-w-[120px]">
                <button
                  onClick={() => { onEdit(); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                >
                  <i className="fa-solid fa-pen mr-2 text-zinc-400"></i>
                  Edit
                </button>
                <button
                  onClick={() => { onDelete(); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  <i className="fa-solid fa-trash mr-2"></i>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h4 className="font-bold dark:text-white truncate">{playlist.name}</h4>
        {playlist.description && (
          <p className="text-xs text-zinc-500 mt-1 truncate">{playlist.description}</p>
        )}
        <div className="flex items-center gap-3 mt-3 text-xs text-zinc-400">
          <span>
            <i className="fa-solid fa-list mr-1"></i>
            {playlist.items.length} voxes
          </span>
          <span>
            <i className="fa-solid fa-clock mr-1"></i>
            {formatDuration(playlist.totalDuration)}
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN VOX PLAYLISTS COMPONENT
// ============================================

export const VoxPlaylists: React.FC<VoxPlaylistsProps> = ({
  playlists,
  onCreatePlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onPlayPlaylist,
  currentUserId,
}) => {
  const [showEditor, setShowEditor] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<VoxPlaylist | null>(null);
  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPlaylists = useMemo(() => {
    if (!searchQuery) return playlists;
    const query = searchQuery.toLowerCase();
    return playlists.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  }, [playlists, searchQuery]);

  const handleCreateNew = () => {
    setEditingPlaylist(null);
    setShowEditor(true);
  };

  const handleEdit = (playlist: VoxPlaylist) => {
    setEditingPlaylist(playlist);
    setShowEditor(true);
  };

  const handleSave = (data: any) => {
    if (editingPlaylist) {
      onUpdatePlaylist(editingPlaylist.id, data);
    } else {
      onCreatePlaylist({
        ...data,
        items: [],
        createdBy: currentUserId,
      });
    }
  };

  const handlePlay = (playlistId: string) => {
    if (playingPlaylistId === playlistId) {
      setPlayingPlaylistId(null);
    } else {
      setPlayingPlaylistId(playlistId);
      onPlayPlaylist(playlistId);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-rectangle-list text-orange-500"></i>
            Playlists
          </h3>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition"
          >
            <i className="fa-solid fa-plus mr-2"></i>
            New
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search playlists..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-orange-500 dark:text-white text-sm"
          />
          <i className="fa-solid fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm"></i>
        </div>
      </div>

      {/* Playlists Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredPlaylists.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-rectangle-list text-3xl text-zinc-400"></i>
            </div>
            <h4 className="font-semibold dark:text-white mb-2">
              {searchQuery ? 'No playlists found' : 'No playlists yet'}
            </h4>
            <p className="text-sm text-zinc-500 max-w-xs mx-auto">
              {searchQuery 
                ? 'Try a different search term' 
                : 'Create a playlist to organize your favorite voxes'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateNew}
                className="mt-4 px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition"
              >
                Create Playlist
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredPlaylists.map(playlist => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onPlay={() => handlePlay(playlist.id)}
                onEdit={() => handleEdit(playlist)}
                onDelete={() => onDeletePlaylist(playlist.id)}
                isPlaying={playingPlaylistId === playlist.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      <PlaylistEditor
        isOpen={showEditor}
        onClose={() => { setShowEditor(false); setEditingPlaylist(null); }}
        playlist={editingPlaylist || undefined}
        onSave={handleSave}
      />
    </div>
  );
};

// ============================================
// ADD TO PLAYLIST MODAL
// ============================================

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: VoxPlaylist[];
  voxId: string;
  onAdd: (playlistId: string) => void;
  onCreate: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  playlists,
  voxId,
  onAdd,
  onCreate,
}) => {
  if (!isOpen) return null;

  const manualPlaylists = playlists.filter(p => !p.isSmartPlaylist);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-scaleIn">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold dark:text-white">Add to Playlist</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        {/* Playlists */}
        <div className="max-h-64 overflow-y-auto p-2">
          {manualPlaylists.length === 0 ? (
            <div className="text-center py-6 text-zinc-500">
              <p className="text-sm mb-2">No playlists yet</p>
            </div>
          ) : (
            manualPlaylists.map(playlist => {
              const alreadyInPlaylist = playlist.items.some(i => i.voxId === voxId);
              return (
                <button
                  key={playlist.id}
                  onClick={() => !alreadyInPlaylist && onAdd(playlist.id)}
                  disabled={alreadyInPlaylist}
                  className={`w-full p-3 rounded-xl flex items-center gap-3 transition ${
                    alreadyInPlaylist
                      ? 'bg-zinc-100 dark:bg-zinc-800 opacity-50 cursor-not-allowed'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg ${playlist.coverColor} flex items-center justify-center text-white`}>
                    <i className={`fa-solid ${playlist.icon}`}></i>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium dark:text-white">{playlist.name}</div>
                    <div className="text-xs text-zinc-500">{playlist.items.length} voxes</div>
                  </div>
                  {alreadyInPlaylist && (
                    <span className="text-xs text-emerald-500">
                      <i className="fa-solid fa-check"></i>
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Create New */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onCreate}
            className="w-full py-2.5 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-500 hover:border-orange-500 hover:text-orange-500 transition"
          >
            <i className="fa-solid fa-plus mr-2"></i>
            Create new playlist
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoxPlaylists;
