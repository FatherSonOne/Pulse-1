import React, { useState, useMemo, useCallback } from 'react';

// Types
interface Bookmark {
  id: string;
  messageId: string;
  conversationId: string;
  messagePreview: string;
  sender: string;
  senderAvatar?: string;
  timestamp: Date;
  createdAt: Date;
  note?: string;
  color?: string;
  collection?: string;
  tags: string[];
}

interface BookmarkCollection {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
}

interface MessageBookmarksProps {
  bookmarks?: Bookmark[];
  collections?: BookmarkCollection[];
  onBookmarkClick?: (bookmark: Bookmark) => void;
  onBookmarkDelete?: (bookmarkId: string) => void;
  onBookmarkUpdate?: (bookmark: Bookmark) => void;
  onCollectionCreate?: (name: string, icon: string, color: string) => void;
  onCollectionDelete?: (collectionId: string) => void;
  onClose?: () => void;
}

// Default collections
const DEFAULT_COLLECTIONS: BookmarkCollection[] = [
  { id: 'important', name: 'Important', icon: '⭐', color: '#FFD700', count: 0 },
  { id: 'follow-up', name: 'Follow Up', icon: '📌', color: '#FF6B6B', count: 0 },
  { id: 'reference', name: 'Reference', icon: '📚', color: '#4ECDC4', count: 0 },
  { id: 'ideas', name: 'Ideas', icon: '💡', color: '#FFE66D', count: 0 },
];

// Mock data generator
const generateMockBookmarks = (): Bookmark[] => {
  const senders = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
  const messages = [
    'Let me know when the proposal is ready for review',
    'Great idea! We should definitely explore this further',
    'The meeting has been rescheduled to 3pm',
    'Here are the design specs you asked for',
    'Remember to update the documentation',
    'Thanks for the quick turnaround on this',
    'Can we discuss this in our next standup?',
    'The API endpoint should be /api/v2/users',
    'Budget approved for Q2 marketing campaign',
    'New feature request from the client',
  ];
  const collections = ['important', 'follow-up', 'reference', 'ideas', undefined];
  const tags = ['work', 'urgent', 'project-x', 'meeting', 'design', 'code', 'review'];

  return Array.from({ length: 15 }, (_, i) => ({
    id: `bookmark-${i}`,
    messageId: `msg-${i}`,
    conversationId: `conv-${Math.floor(Math.random() * 5)}`,
    messagePreview: messages[Math.floor(Math.random() * messages.length)],
    sender: senders[Math.floor(Math.random() * senders.length)],
    timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    note: Math.random() > 0.5 ? 'Added a note about this message' : undefined,
    collection: collections[Math.floor(Math.random() * collections.length)],
    tags: tags.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3)),
  }));
};

export const MessageBookmarks: React.FC<MessageBookmarksProps> = ({
  bookmarks: propBookmarks,
  collections: propCollections,
  onBookmarkClick,
  onBookmarkDelete,
  onBookmarkUpdate,
  onCollectionCreate,
  onCollectionDelete,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'collections' | 'tags'>('all');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'created' | 'sender'>('recent');
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionIcon, setNewCollectionIcon] = useState('📁');

  // Use provided data or mock
  const bookmarks = useMemo(() => propBookmarks || generateMockBookmarks(), [propBookmarks]);

  // Calculate collection counts
  const collections = useMemo(() => {
    const base = propCollections || DEFAULT_COLLECTIONS;
    return base.map(col => ({
      ...col,
      count: bookmarks.filter(b => b.collection === col.id).length,
    }));
  }, [propCollections, bookmarks]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagCounts = new Map<string, number>();
    bookmarks.forEach(b => {
      b.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [bookmarks]);

  // Filter and sort bookmarks
  const filteredBookmarks = useMemo(() => {
    let result = [...bookmarks];

    // Filter by collection
    if (selectedCollection) {
      result = result.filter(b => b.collection === selectedCollection);
    }

    // Filter by tag
    if (selectedTag) {
      result = result.filter(b => b.tags.includes(selectedTag));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(b =>
        b.messagePreview.toLowerCase().includes(query) ||
        b.sender.toLowerCase().includes(query) ||
        b.note?.toLowerCase().includes(query) ||
        b.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case 'recent':
        result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        break;
      case 'created':
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'sender':
        result.sort((a, b) => a.sender.localeCompare(b.sender));
        break;
    }

    return result;
  }, [bookmarks, selectedCollection, selectedTag, searchQuery, sortBy]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const handleAddCollection = useCallback(() => {
    if (newCollectionName.trim()) {
      onCollectionCreate?.(newCollectionName, newCollectionIcon, '#8b5cf6');
      setNewCollectionName('');
      setNewCollectionIcon('📁');
      setShowAddCollection(false);
    }
  }, [newCollectionName, newCollectionIcon, onCollectionCreate]);

  const handleUpdateNote = useCallback((bookmark: Bookmark, note: string) => {
    const updated = { ...bookmark, note };
    onBookmarkUpdate?.(updated);
    setEditingBookmark(null);
  }, [onBookmarkUpdate]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(20, 20, 35, 0.98))',
      borderRadius: '16px',
      padding: '24px',
      color: 'white',
      maxWidth: '700px',
      width: '100%',
      maxHeight: '85vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🔖</span>
            Message Bookmarks
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            {bookmarks.length} saved messages
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Search and Sort */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
          padding: '10px 14px',
        }}>
          <span style={{ opacity: 0.5 }}>🔍</span>
          <input
            type="text"
            placeholder="Search bookmarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          <option value="recent">Most Recent</option>
          <option value="created">Date Added</option>
          <option value="sender">By Sender</option>
        </select>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
      }}>
        {[
          { id: 'all', label: 'All', icon: '📑', count: bookmarks.length },
          { id: 'collections', label: 'Collections', icon: '📁', count: collections.length },
          { id: 'tags', label: 'Tags', icon: '🏷️', count: allTags.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as typeof activeTab);
              setSelectedCollection(null);
              setSelectedTag(null);
            }}
            style={{
              background: activeTab === tab.id ? 'rgba(138, 43, 226, 0.3)' : 'rgba(255,255,255,0.05)',
              border: activeTab === tab.id ? '1px solid rgba(138, 43, 226, 0.5)' : '1px solid transparent',
              borderRadius: '8px',
              padding: '8px 16px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
            <span style={{
              fontSize: '0.75rem',
              background: 'rgba(255,255,255,0.1)',
              padding: '2px 6px',
              borderRadius: '10px',
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Collections View */}
        {activeTab === 'collections' && !selectedCollection && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {collections.map((collection) => (
              <button
                key={collection.id}
                onClick={() => setSelectedCollection(collection.id)}
                style={{
                  background: `linear-gradient(135deg, ${collection.color}20, ${collection.color}10)`,
                  border: `1px solid ${collection.color}40`,
                  borderRadius: '12px',
                  padding: '20px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span style={{ fontSize: '2rem' }}>{collection.icon}</span>
                <div>
                  <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1rem' }}>
                    {collection.name}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                    {collection.count} bookmarks
                  </div>
                </div>
              </button>
            ))}

            {/* Add Collection Button */}
            <button
              onClick={() => setShowAddCollection(true)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '2px dashed rgba(255,255,255,0.2)',
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>+</span>
              <span>New Collection</span>
            </button>
          </div>
        )}

        {/* Tags View */}
        {activeTab === 'tags' && !selectedTag && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {allTags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '20px',
                  padding: '8px 16px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>#{tag}</span>
                <span style={{
                  fontSize: '0.75rem',
                  background: 'rgba(255,255,255,0.1)',
                  padding: '2px 6px',
                  borderRadius: '10px',
                }}>
                  {count}
                </span>
              </button>
            ))}

            {allTags.length === 0 && (
              <div style={{
                width: '100%',
                textAlign: 'center',
                padding: '40px',
                opacity: 0.5,
              }}>
                No tags yet. Add tags to your bookmarks to organize them.
              </div>
            )}
          </div>
        )}

        {/* Bookmarks List */}
        {(activeTab === 'all' || selectedCollection || selectedTag) && (
          <>
            {/* Back button for collection/tag view */}
            {(selectedCollection || selectedTag) && (
              <button
                onClick={() => {
                  setSelectedCollection(null);
                  setSelectedTag(null);
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: 'white',
                  cursor: 'pointer',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                ← Back to {selectedCollection ? 'Collections' : 'Tags'}
              </button>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredBookmarks.map((bookmark) => {
                const collection = collections.find(c => c.id === bookmark.collection);

                return (
                  <div
                    key={bookmark.id}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '12px',
                      padding: '16px',
                      borderLeft: collection ? `3px solid ${collection.color}` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      {/* Avatar */}
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        flexShrink: 0,
                      }}>
                        {bookmark.sender.charAt(0)}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 'bold' }}>{bookmark.sender}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                            {formatDate(bookmark.timestamp)}
                          </span>
                        </div>

                        <p
                          onClick={() => onBookmarkClick?.(bookmark)}
                          style={{
                            margin: '0 0 8px',
                            fontSize: '0.9rem',
                            opacity: 0.9,
                            cursor: 'pointer',
                            lineHeight: 1.4,
                          }}
                        >
                          {bookmark.messagePreview}
                        </p>

                        {/* Note */}
                        {bookmark.note && (
                          <div style={{
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '0.8rem',
                            opacity: 0.7,
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}>
                            <span>📝</span>
                            {bookmark.note}
                          </div>
                        )}

                        {/* Tags and Actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {collection && (
                              <span style={{
                                fontSize: '0.75rem',
                                background: `${collection.color}30`,
                                color: collection.color,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}>
                                {collection.icon} {collection.name}
                              </span>
                            )}
                            {bookmark.tags.map(tag => (
                              <span
                                key={tag}
                                onClick={() => setSelectedTag(tag)}
                                style={{
                                  fontSize: '0.75rem',
                                  background: 'rgba(138, 43, 226, 0.2)',
                                  color: '#a78bfa',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                }}
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={() => setEditingBookmark(bookmark)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '4px',
                              }}
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => onBookmarkDelete?.(bookmark.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '4px',
                              }}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredBookmarks.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  opacity: 0.5,
                }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>🔖</span>
                  <p>No bookmarks found</p>
                  {searchQuery && <p style={{ fontSize: '0.85rem' }}>Try a different search term</p>}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Collection Modal */}
      {showAddCollection && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setShowAddCollection(false)}
        >
          <div
            style={{
              background: 'rgba(30, 30, 50, 0.98)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem' }}>Create Collection</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '8px' }}>
                Icon
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['📁', '⭐', '📌', '💡', '📚', '🎯', '🔥', '💎', '🎨', '🚀'].map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewCollectionIcon(icon)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      border: newCollectionIcon === icon ? '2px solid #8b5cf6' : '2px solid transparent',
                      background: newCollectionIcon === icon ? 'rgba(138, 43, 226, 0.2)' : 'rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '8px' }}>
                Name
              </label>
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Collection name..."
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddCollection(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddCollection}
                disabled={!newCollectionName.trim()}
                style={{
                  background: newCollectionName.trim() ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: newCollectionName.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bookmark Modal */}
      {editingBookmark && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setEditingBookmark(null)}
        >
          <div
            style={{
              background: 'rgba(30, 30, 50, 0.98)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '450px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem' }}>Edit Bookmark</h3>

            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '0.9rem',
              opacity: 0.8,
            }}>
              "{editingBookmark.messagePreview}"
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '8px' }}>
                Note
              </label>
              <textarea
                defaultValue={editingBookmark.note || ''}
                placeholder="Add a note..."
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none',
                  resize: 'none',
                }}
                id="bookmark-note-input"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '8px' }}>
                Collection
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {collections.map(col => (
                  <button
                    key={col.id}
                    onClick={() => {
                      const updated = { ...editingBookmark, collection: col.id };
                      setEditingBookmark(updated);
                    }}
                    style={{
                      background: editingBookmark.collection === col.id
                        ? `${col.color}30`
                        : 'rgba(255,255,255,0.05)',
                      border: editingBookmark.collection === col.id
                        ? `1px solid ${col.color}`
                        : '1px solid transparent',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.85rem',
                    }}
                  >
                    {col.icon} {col.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingBookmark(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const noteInput = document.getElementById('bookmark-note-input') as HTMLTextAreaElement;
                  handleUpdateNote(editingBookmark, noteInput?.value || '');
                }}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Bookmark button component
export const BookmarkButton: React.FC<{
  isBookmarked?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}> = ({ isBookmarked = false, onClick, size = 'md' }) => {
  const sizeMap = {
    sm: { padding: '4px 8px', fontSize: '0.9rem' },
    md: { padding: '6px 12px', fontSize: '1rem' },
    lg: { padding: '8px 16px', fontSize: '1.2rem' },
  };

  return (
    <button
      onClick={onClick}
      style={{
        background: isBookmarked ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)',
        border: isBookmarked ? '1px solid rgba(255, 215, 0, 0.5)' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: isBookmarked ? '#FFD700' : 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ...sizeMap[size],
      }}
      title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
      {isBookmarked ? '🔖' : '🏷️'}
    </button>
  );
};

export default MessageBookmarks;
