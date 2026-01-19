/**
 * Collection Manager Component
 * Allows users to create and manage document collections (manual and smart)
 */

import React, { useState, useEffect } from 'react';
import {
  DocumentCollection,
  COLLECTION_ICONS,
  TAG_COLORS,
  CreateCollectionPayload,
  SmartCollectionRules,
} from '../../../types/organization';
import {
  getUserCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  getCollectionDocuments,
  getSmartCollectionDocuments,
  addDocumentToCollection,
  removeDocumentFromCollection,
} from '../../../services/organizationService';

interface CollectionManagerProps {
  userId: string;
  docId?: string; // If provided, shows collection assignment mode
  onCollectionSelect?: (collectionId: string, docIds: string[]) => void;
  onCollectionsChange?: (collections: DocumentCollection[]) => void;
}

export const CollectionManager: React.FC<CollectionManagerProps> = ({
  userId,
  docId,
  onCollectionSelect,
  onCollectionsChange,
}) => {
  const [collections, setCollections] = useState<DocumentCollection[]>([]);
  const [docCollections, setDocCollections] = useState<string[]>([]); // Collection IDs containing doc
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCollection, setEditingCollection] = useState<DocumentCollection | null>(null);
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  const [collectionDocs, setCollectionDocs] = useState<Record<string, string[]>>({});

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<'manual' | 'smart'>('manual');
  const [formIcon, setFormIcon] = useState(COLLECTION_ICONS[0].value);
  const [formColor, setFormColor] = useState(TAG_COLORS[0].value);
  const [formRules, setFormRules] = useState<SmartCollectionRules>({});

  // Load collections
  useEffect(() => {
    loadCollections();
  }, [userId]);

  // Determine which collections contain the document
  useEffect(() => {
    if (docId && collections.length > 0) {
      findDocCollections();
    }
  }, [docId, collections]);

  const loadCollections = async () => {
    try {
      const cols = await getUserCollections(userId);
      setCollections(cols);
      onCollectionsChange?.(cols);
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const findDocCollections = async () => {
    if (!docId) return;
    const containingCollections: string[] = [];

    for (const col of collections) {
      try {
        const docIds = col.type === 'smart'
          ? await getSmartCollectionDocuments(col.id)
          : await getCollectionDocuments(col.id);

        setCollectionDocs(prev => ({ ...prev, [col.id]: docIds }));

        if (docIds.includes(docId)) {
          containingCollections.push(col.id);
        }
      } catch (error) {
        console.error('Error checking collection:', error);
      }
    }

    setDocCollections(containingCollections);
  };

  const loadCollectionDocs = async (collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;

    try {
      const docIds = collection.type === 'smart'
        ? await getSmartCollectionDocuments(collectionId)
        : await getCollectionDocuments(collectionId);

      setCollectionDocs(prev => ({ ...prev, [collectionId]: docIds }));
    } catch (error) {
      console.error('Error loading collection docs:', error);
    }
  };

  const handleCreateCollection = async () => {
    if (!formName.trim()) return;

    try {
      const payload: CreateCollectionPayload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        type: formType,
        icon: formIcon,
        color: formColor,
        rules: formType === 'smart' ? formRules : undefined,
      };
      const newCollection = await createCollection(userId, payload);
      setCollections([...collections, newCollection]);
      onCollectionsChange?.([...collections, newCollection]);
      resetForm();
      setShowCreate(false);
    } catch (error) {
      console.error('Error creating collection:', error);
    }
  };

  const handleUpdateCollection = async () => {
    if (!editingCollection || !formName.trim()) return;

    try {
      const updated = await updateCollection(editingCollection.id, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        icon: formIcon,
        color: formColor,
        rules: formType === 'smart' ? formRules : undefined,
      });
      const newCollections = collections.map(c => (c.id === updated.id ? updated : c));
      setCollections(newCollections);
      onCollectionsChange?.(newCollections);
      resetForm();
      setEditingCollection(null);
    } catch (error) {
      console.error('Error updating collection:', error);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('Delete this collection? Documents will not be deleted.')) return;

    try {
      await deleteCollection(collectionId);
      const newCollections = collections.filter(c => c.id !== collectionId);
      setCollections(newCollections);
      onCollectionsChange?.(newCollections);
    } catch (error) {
      console.error('Error deleting collection:', error);
    }
  };

  const handleToggleDocInCollection = async (collectionId: string) => {
    if (!docId) return;

    const collection = collections.find(c => c.id === collectionId);
    if (!collection || collection.type === 'smart') return; // Can't manually add to smart collections

    const isInCollection = docCollections.includes(collectionId);

    try {
      if (isInCollection) {
        await removeDocumentFromCollection(collectionId, docId);
        setDocCollections(docCollections.filter(id => id !== collectionId));
      } else {
        await addDocumentToCollection(collectionId, docId);
        setDocCollections([...docCollections, collectionId]);
      }
    } catch (error) {
      console.error('Error toggling doc in collection:', error);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormType('manual');
    setFormIcon(COLLECTION_ICONS[0].value);
    setFormColor(TAG_COLORS[0].value);
    setFormRules({});
  };

  const startEditing = (collection: DocumentCollection) => {
    setEditingCollection(collection);
    setFormName(collection.name);
    setFormDescription(collection.description || '');
    setFormType(collection.type);
    setFormIcon(collection.icon);
    setFormColor(collection.color);
    setFormRules(collection.rules || {});
    setShowCreate(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <i className="fa fa-spinner fa-spin text-gray-400"></i>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            <i className="fa fa-folder-open mr-2 text-blue-500"></i>
            {docId ? 'Add to Collection' : 'Collections'}
          </h3>
          <button
            onClick={() => {
              resetForm();
              setEditingCollection(null);
              setShowCreate(!showCreate);
            }}
            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <i className={`fa ${showCreate ? 'fa-times' : 'fa-plus'}`}></i>
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showCreate && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50/50 dark:bg-blue-900/10 space-y-3">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {editingCollection ? 'Edit Collection' : 'Create New Collection'}
          </div>

          {/* Type selector (only for new collections) */}
          {!editingCollection && (
            <div className="flex gap-2">
              <button
                onClick={() => setFormType('manual')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  formType === 'manual'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                <i className="fa fa-hand-pointer-o"></i>
                Manual
              </button>
              <button
                onClick={() => setFormType('smart')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  formType === 'smart'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                <i className="fa fa-magic"></i>
                Smart
              </button>
            </div>
          )}

          {/* Name */}
          <input
            type="text"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="Collection name..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white"
            autoFocus
          />

          {/* Description */}
          <input
            type="text"
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            placeholder="Description (optional)..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white"
          />

          {/* Icon and Color row */}
          <div className="flex gap-3">
            {/* Icon picker */}
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                Icon
              </label>
              <div className="flex flex-wrap gap-1">
                {COLLECTION_ICONS.slice(0, 8).map(icon => (
                  <button
                    key={icon.value}
                    onClick={() => setFormIcon(icon.value)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      formIcon === icon.value
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`}
                    title={icon.name}
                  >
                    <i className={`fa ${icon.value} text-sm`}></i>
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                Color
              </label>
              <div className="flex flex-wrap gap-1">
                {TAG_COLORS.slice(0, 8).map(color => (
                  <button
                    key={color.value}
                    onClick={() => setFormColor(color.value)}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      formColor === color.value ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Smart collection rules */}
          {formType === 'smart' && (
            <div className="space-y-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-xs font-medium text-purple-700 dark:text-purple-300">
                <i className="fa fa-magic mr-1"></i>
                Smart Rules
              </div>

              {/* Keywords */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  Keywords (comma separated)
                </label>
                <input
                  type="text"
                  value={formRules.keywords?.join(', ') || ''}
                  onChange={e => setFormRules({
                    ...formRules,
                    keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean),
                  })}
                  placeholder="e.g., budget, finance, report"
                  className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded focus:border-purple-500 focus:outline-none text-gray-900 dark:text-white"
                />
              </div>

              {/* File types */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  File Types
                </label>
                <div className="flex flex-wrap gap-1">
                  {['pdf', 'docx', 'xlsx', 'txt', 'md'].map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        const current = formRules.fileTypes || [];
                        setFormRules({
                          ...formRules,
                          fileTypes: current.includes(type)
                            ? current.filter(t => t !== type)
                            : [...current, type],
                        });
                      }}
                      className={`px-2 py-1 text-xs rounded transition-all ${
                        formRules.fileTypes?.includes(type)
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      .{type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                resetForm();
                setEditingCollection(null);
                setShowCreate(false);
              }}
              className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={editingCollection ? handleUpdateCollection : handleCreateCollection}
              disabled={!formName.trim()}
              className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all"
            >
              {editingCollection ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Collection List */}
      <div className="max-h-72 overflow-y-auto">
        {collections.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-400">
            No collections yet. Create one!
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {collections.map(collection => {
              const isInCollection = docCollections.includes(collection.id);
              const isExpanded = expandedCollection === collection.id;
              const docCount = collectionDocs[collection.id]?.length ?? collection.doc_count;

              return (
                <div key={collection.id}>
                  <div
                    className={`flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                      isInCollection ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    {/* Collection assignment checkbox (if docId provided and manual) */}
                    {docId && collection.type === 'manual' && (
                      <button
                        onClick={() => handleToggleDocInCollection(collection.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          isInCollection
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                      >
                        {isInCollection && <i className="fa fa-check text-xs"></i>}
                      </button>
                    )}

                    {/* Smart collection indicator */}
                    {docId && collection.type === 'smart' && (
                      <div className="w-5 h-5 flex items-center justify-center">
                        {isInCollection ? (
                          <i className="fa fa-check text-purple-500 text-xs"></i>
                        ) : (
                          <i className="fa fa-magic text-purple-400 text-xs"></i>
                        )}
                      </div>
                    )}

                    {/* Collection display */}
                    <div
                      className="flex-1 flex items-center gap-2 cursor-pointer"
                      onClick={() => {
                        if (docId && collection.type === 'manual') {
                          handleToggleDocInCollection(collection.id);
                        } else {
                          if (isExpanded) {
                            setExpandedCollection(null);
                          } else {
                            setExpandedCollection(collection.id);
                            loadCollectionDocs(collection.id);
                          }
                        }
                      }}
                    >
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm"
                        style={{ backgroundColor: collection.color }}
                      >
                        <i className={`fa ${collection.icon}`}></i>
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                            {collection.name}
                          </span>
                          {collection.type === 'smart' && (
                            <i className="fa fa-magic text-purple-400 text-[10px]" title="Smart Collection"></i>
                          )}
                        </div>
                        {collection.description && (
                          <div className="text-xs text-gray-400 truncate">
                            {collection.description}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        {docCount ?? 0}
                      </span>
                    </div>

                    {/* Actions (in manage mode) */}
                    {!docId && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedCollection(null);
                            } else {
                              setExpandedCollection(collection.id);
                              loadCollectionDocs(collection.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        >
                          <i className={`fa fa-chevron-${isExpanded ? 'up' : 'down'} text-xs`}></i>
                        </button>
                        <button
                          onClick={() => startEditing(collection)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        >
                          <i className="fa fa-pencil text-xs"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteCollection(collection.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <i className="fa fa-trash text-xs"></i>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expanded document list */}
                  {isExpanded && collectionDocs[collection.id] && (
                    <div className="pl-10 pr-2 pb-2 bg-gray-50/50 dark:bg-gray-900/30">
                      {collectionDocs[collection.id].length === 0 ? (
                        <div className="text-xs text-gray-400 py-2">No documents in this collection</div>
                      ) : (
                        <div className="space-y-1">
                          {collectionDocs[collection.id].slice(0, 5).map(docId => (
                            <div
                              key={docId}
                              className="text-xs text-gray-500 dark:text-gray-400 py-1 px-2 bg-white dark:bg-gray-800 rounded truncate cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => onCollectionSelect?.(collection.id, [docId])}
                            >
                              <i className="fa fa-file-text-o mr-2"></i>
                              {docId.slice(0, 8)}...
                            </div>
                          ))}
                          {collectionDocs[collection.id].length > 5 && (
                            <div className="text-xs text-gray-400 py-1">
                              +{collectionDocs[collection.id].length - 5} more
                            </div>
                          )}
                        </div>
                      )}
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

export default CollectionManager;
