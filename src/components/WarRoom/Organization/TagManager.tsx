/**
 * Tag Manager Component
 * Allows users to create, edit, and assign tags to documents
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  DocumentTag,
  TAG_COLORS,
  TAG_ICONS,
  CreateTagPayload,
} from '../../../types/organization';
import {
  getUserTags,
  createTag,
  updateTag,
  deleteTag,
  getDocumentTags,
  addTagToDocument,
  removeTagFromDocument,
} from '../../../services/organizationService';

interface TagManagerProps {
  userId: string;
  docId?: string; // If provided, shows tag assignment mode
  onTagsChange?: (tags: DocumentTag[]) => void;
  compact?: boolean;
}

export const TagManager: React.FC<TagManagerProps> = ({
  userId,
  docId,
  onTagsChange,
  compact = false,
}) => {
  const [allTags, setAllTags] = useState<DocumentTag[]>([]);
  const [docTags, setDocTags] = useState<DocumentTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTag, setEditingTag] = useState<DocumentTag | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // New tag form state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0].value);
  const [newTagIcon, setNewTagIcon] = useState(TAG_ICONS[0].value);
  const [newTagDescription, setNewTagDescription] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Load tags
  useEffect(() => {
    loadTags();
  }, [userId]);

  // Load document tags if docId provided
  useEffect(() => {
    if (docId) {
      loadDocumentTags();
    }
  }, [docId]);

  const loadTags = async () => {
    try {
      const tags = await getUserTags(userId);
      setAllTags(tags);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentTags = async () => {
    if (!docId) return;
    try {
      const tags = await getDocumentTags(docId);
      setDocTags(tags);
      onTagsChange?.(tags);
    } catch (error) {
      console.error('Error loading document tags:', error);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const payload: CreateTagPayload = {
        name: newTagName.trim(),
        color: newTagColor,
        icon: newTagIcon,
        description: newTagDescription.trim() || undefined,
      };
      const newTag = await createTag(userId, payload);
      setAllTags([...allTags, newTag]);
      resetForm();
      setShowCreate(false);
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !newTagName.trim()) return;

    try {
      const updated = await updateTag(editingTag.id, {
        name: newTagName.trim(),
        color: newTagColor,
        icon: newTagIcon,
        description: newTagDescription.trim() || undefined,
      });
      setAllTags(allTags.map(t => (t.id === updated.id ? updated : t)));
      resetForm();
      setEditingTag(null);
    } catch (error) {
      console.error('Error updating tag:', error);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Delete this tag? It will be removed from all documents.')) return;

    try {
      await deleteTag(tagId);
      setAllTags(allTags.filter(t => t.id !== tagId));
      setDocTags(docTags.filter(t => t.id !== tagId));
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  const handleToggleDocTag = async (tag: DocumentTag) => {
    if (!docId) return;

    const isAssigned = docTags.some(t => t.id === tag.id);

    try {
      if (isAssigned) {
        await removeTagFromDocument(docId, tag.id);
        const newDocTags = docTags.filter(t => t.id !== tag.id);
        setDocTags(newDocTags);
        onTagsChange?.(newDocTags);
      } else {
        await addTagToDocument(docId, tag.id);
        const newDocTags = [...docTags, tag];
        setDocTags(newDocTags);
        onTagsChange?.(newDocTags);
      }
    } catch (error) {
      console.error('Error toggling tag:', error);
    }
  };

  const resetForm = () => {
    setNewTagName('');
    setNewTagColor(TAG_COLORS[0].value);
    setNewTagIcon(TAG_ICONS[0].value);
    setNewTagDescription('');
  };

  const startEditing = (tag: DocumentTag) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
    setNewTagIcon(tag.icon);
    setNewTagDescription(tag.description || '');
    setShowCreate(true);
  };

  const filteredTags = allTags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <i className="fa fa-spinner fa-spin text-gray-400"></i>
      </div>
    );
  }

  // Compact mode for inline tag display
  if (compact && docId) {
    return (
      <div className="flex flex-wrap gap-1">
        {docTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
          >
            <i className={`fa ${tag.icon} text-[10px]`}></i>
            {tag.name}
          </span>
        ))}
        {docTags.length === 0 && (
          <span className="text-xs text-gray-400">No tags</span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            <i className="fa fa-tags mr-2 text-rose-500"></i>
            {docId ? 'Document Tags' : 'Manage Tags'}
          </h3>
          <button
            onClick={() => {
              resetForm();
              setEditingTag(null);
              setShowCreate(!showCreate);
            }}
            className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
          >
            <i className={`fa ${showCreate ? 'fa-times' : 'fa-plus'}`}></i>
          </button>
        </div>

        {/* Search */}
        {allTags.length > 5 && (
          <div className="mt-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tags..."
              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:border-rose-500 focus:outline-none text-gray-900 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Create/Edit Form */}
      {showCreate && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-rose-50/50 dark:bg-rose-900/10 space-y-3">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {editingTag ? 'Edit Tag' : 'Create New Tag'}
          </div>

          {/* Name */}
          <input
            ref={inputRef}
            type="text"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            placeholder="Tag name..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:border-rose-500 focus:outline-none text-gray-900 dark:text-white"
            autoFocus
          />

          {/* Color picker */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              Color
            </label>
            <div className="flex flex-wrap gap-1">
              {TAG_COLORS.map(color => (
                <button
                  key={color.value}
                  onClick={() => setNewTagColor(color.value)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    newTagColor === color.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              Icon
            </label>
            <div className="flex flex-wrap gap-1">
              {TAG_ICONS.map(icon => (
                <button
                  key={icon.value}
                  onClick={() => setNewTagIcon(icon.value)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    newTagIcon === icon.value
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                  title={icon.name}
                >
                  <i className={`fa ${icon.value}`}></i>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <input
            type="text"
            value={newTagDescription}
            onChange={e => setNewTagDescription(e.target.value)}
            placeholder="Description (optional)..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:border-rose-500 focus:outline-none text-gray-900 dark:text-white"
          />

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                resetForm();
                setEditingTag(null);
                setShowCreate(false);
              }}
              className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={editingTag ? handleUpdateTag : handleCreateTag}
              disabled={!newTagName.trim()}
              className="flex-1 py-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all"
            >
              {editingTag ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Tag List */}
      <div className="max-h-64 overflow-y-auto">
        {filteredTags.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-400">
            {searchQuery ? 'No matching tags' : 'No tags yet. Create one!'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {filteredTags.map(tag => {
              const isAssigned = docId && docTags.some(t => t.id === tag.id);
              return (
                <div
                  key={tag.id}
                  className={`flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                    isAssigned ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''
                  }`}
                >
                  {/* Tag assignment checkbox (if docId provided) */}
                  {docId && (
                    <button
                      onClick={() => handleToggleDocTag(tag)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isAssigned
                          ? 'border-rose-500 bg-rose-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 hover:border-rose-400'
                      }`}
                    >
                      {isAssigned && <i className="fa fa-check text-xs"></i>}
                    </button>
                  )}

                  {/* Tag display */}
                  <div
                    className="flex-1 flex items-center gap-2 cursor-pointer"
                    onClick={() => docId && handleToggleDocTag(tag)}
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                      style={{ backgroundColor: tag.color }}
                    >
                      <i className={`fa ${tag.icon}`}></i>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {tag.name}
                      </div>
                      {tag.description && (
                        <div className="text-xs text-gray-400 truncate">
                          {tag.description}
                        </div>
                      )}
                    </div>
                    {tag.doc_count !== undefined && (
                      <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        {tag.doc_count}
                      </span>
                    )}
                  </div>

                  {/* Actions (only in manage mode) */}
                  {!docId && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditing(tag)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      >
                        <i className="fa fa-pencil text-xs"></i>
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      >
                        <i className="fa fa-trash text-xs"></i>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagManager;
