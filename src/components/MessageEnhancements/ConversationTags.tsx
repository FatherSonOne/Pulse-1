import React, { useState, useMemo, useCallback } from 'react';

// Types
interface Tag {
  id: string;
  name: string;
  color: string;
  icon?: string;
  count: number;
  createdAt: Date;
}

interface Label {
  id: string;
  name: string;
  color: string;
  description?: string;
  isSystem?: boolean;
}

interface ConversationTag {
  conversationId: string;
  tagIds: string[];
  labelId?: string;
}

interface ConversationTagsProps {
  conversationId?: string;
  tags?: Tag[];
  labels?: Label[];
  conversationTags?: ConversationTag[];
  onTagCreate?: (name: string, color: string) => void;
  onTagDelete?: (tagId: string) => void;
  onTagAssign?: (conversationId: string, tagId: string) => void;
  onTagRemove?: (conversationId: string, tagId: string) => void;
  onLabelCreate?: (name: string, color: string, description?: string) => void;
  onLabelAssign?: (conversationId: string, labelId: string) => void;
  onClose?: () => void;
}

// Predefined colors
const TAG_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E',
];

// Default labels
const DEFAULT_LABELS: Label[] = [
  { id: 'personal', name: 'Personal', color: '#3B82F6', description: 'Personal conversations', isSystem: true },
  { id: 'work', name: 'Work', color: '#10B981', description: 'Work-related conversations', isSystem: true },
  { id: 'important', name: 'Important', color: '#EF4444', description: 'High priority', isSystem: true },
  { id: 'archive', name: 'Archive', color: '#6B7280', description: 'Archived conversations', isSystem: true },
];

// Mock data
const generateMockTags = (): Tag[] => [
  { id: 'tag-1', name: 'project-alpha', color: '#8B5CF6', count: 12, createdAt: new Date() },
  { id: 'tag-2', name: 'follow-up', color: '#F59E0B', count: 8, createdAt: new Date() },
  { id: 'tag-3', name: 'urgent', color: '#EF4444', count: 5, createdAt: new Date() },
  { id: 'tag-4', name: 'meeting', color: '#3B82F6', count: 15, createdAt: new Date() },
  { id: 'tag-5', name: 'ideas', color: '#10B981', count: 7, createdAt: new Date() },
  { id: 'tag-6', name: 'feedback', color: '#EC4899', count: 4, createdAt: new Date() },
  { id: 'tag-7', name: 'review', color: '#06B6D4', count: 9, createdAt: new Date() },
  { id: 'tag-8', name: 'design', color: '#D946EF', count: 6, createdAt: new Date() },
];

export const ConversationTags: React.FC<ConversationTagsProps> = ({
  conversationId,
  tags: propTags,
  labels: propLabels,
  conversationTags: propConversationTags,
  onTagCreate,
  onTagDelete,
  onTagAssign,
  onTagRemove,
  onLabelCreate,
  onLabelAssign,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'tags' | 'labels' | 'manage'>('tags');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [showCreateLabel, setShowCreateLabel] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(TAG_COLORS[4]);
  const [newLabelDescription, setNewLabelDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Use provided data or mocks
  const tags = useMemo(() => propTags || generateMockTags(), [propTags]);
  const labels = useMemo(() => propLabels || DEFAULT_LABELS, [propLabels]);

  // Get current conversation's tags
  const currentConversationTags = useMemo(() => {
    if (!conversationId || !propConversationTags) return { tagIds: [], labelId: undefined };
    return propConversationTags.find(ct => ct.conversationId === conversationId) || { tagIds: [], labelId: undefined };
  }, [conversationId, propConversationTags]);

  // Filter tags by search
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const query = searchQuery.toLowerCase();
    return tags.filter(tag => tag.name.toLowerCase().includes(query));
  }, [tags, searchQuery]);

  // Sort tags by usage
  const sortedTags = useMemo(() => {
    return [...filteredTags].sort((a, b) => b.count - a.count);
  }, [filteredTags]);

  const handleCreateTag = useCallback(() => {
    if (newTagName.trim()) {
      onTagCreate?.(newTagName.trim().toLowerCase().replace(/\s+/g, '-'), newTagColor);
      setNewTagName('');
      setShowCreateTag(false);
    }
  }, [newTagName, newTagColor, onTagCreate]);

  const handleCreateLabel = useCallback(() => {
    if (newLabelName.trim()) {
      onLabelCreate?.(newLabelName.trim(), newLabelColor, newLabelDescription || undefined);
      setNewLabelName('');
      setNewLabelDescription('');
      setShowCreateLabel(false);
    }
  }, [newLabelName, newLabelColor, newLabelDescription, onLabelCreate]);

  const handleToggleTag = useCallback((tagId: string) => {
    if (!conversationId) return;

    const isAssigned = currentConversationTags.tagIds.includes(tagId);
    if (isAssigned) {
      onTagRemove?.(conversationId, tagId);
    } else {
      onTagAssign?.(conversationId, tagId);
    }
  }, [conversationId, currentConversationTags.tagIds, onTagAssign, onTagRemove]);

  const handleSelectLabel = useCallback((labelId: string) => {
    if (!conversationId) return;
    onLabelAssign?.(conversationId, labelId);
  }, [conversationId, onLabelAssign]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(20, 20, 35, 0.98))',
      borderRadius: '16px',
      padding: '24px',
      color: 'white',
      maxWidth: '550px',
      width: '100%',
      maxHeight: '80vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🏷️</span>
            Tags & Labels
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Organize your conversations
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

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
      }}>
        {[
          { id: 'tags', label: 'Tags', icon: '#️⃣' },
          { id: 'labels', label: 'Labels', icon: '📋' },
          { id: 'manage', label: 'Manage', icon: '⚙️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
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
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tags Tab */}
      {activeTab === 'tags' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Search */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
          }}>
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
                placeholder="Search or create tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim() && filteredTags.length === 0) {
                    setNewTagName(searchQuery);
                    setShowCreateTag(true);
                  }
                }}
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
            <button
              onClick={() => setShowCreateTag(true)}
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 16px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              + New
            </button>
          </div>

          {/* Tag List */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {sortedTags.map((tag) => {
              const isAssigned = currentConversationTags.tagIds.includes(tag.id);

              return (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTag(tag.id)}
                  style={{
                    background: isAssigned ? `${tag.color}30` : 'rgba(255,255,255,0.05)',
                    border: isAssigned ? `2px solid ${tag.color}` : '2px solid transparent',
                    borderRadius: '20px',
                    padding: '8px 16px',
                    color: isAssigned ? tag.color : 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: tag.color,
                  }} />
                  <span>#{tag.name}</span>
                  <span style={{
                    fontSize: '0.75rem',
                    opacity: 0.6,
                  }}>
                    {tag.count}
                  </span>
                  {isAssigned && <span>✓</span>}
                </button>
              );
            })}

            {filteredTags.length === 0 && searchQuery && (
              <div style={{
                width: '100%',
                textAlign: 'center',
                padding: '20px',
              }}>
                <p style={{ opacity: 0.6, marginBottom: '12px' }}>No tags found for "{searchQuery}"</p>
                <button
                  onClick={() => {
                    setNewTagName(searchQuery);
                    setShowCreateTag(true);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Create "#{searchQuery.toLowerCase().replace(/\s+/g, '-')}"
                </button>
              </div>
            )}
          </div>

          {/* Quick suggestions */}
          {!searchQuery && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '8px' }}>
                Suggested Tags
              </h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['todo', 'question', 'resolved', 'blocked', 'waiting'].map(suggestion => {
                  const exists = tags.some(t => t.name === suggestion);
                  if (exists) return null;

                  return (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setNewTagName(suggestion);
                        setShowCreateTag(true);
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px dashed rgba(255,255,255,0.2)',
                        borderRadius: '20px',
                        padding: '6px 12px',
                        color: 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      + #{suggestion}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Labels Tab */}
      {activeTab === 'labels' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {labels.map((label) => {
              const isSelected = currentConversationTags.labelId === label.id;

              return (
                <button
                  key={label.id}
                  onClick={() => handleSelectLabel(label.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: isSelected ? `${label.color}20` : 'rgba(255,255,255,0.05)',
                    border: isSelected ? `2px solid ${label.color}` : '2px solid transparent',
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    background: label.color,
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontWeight: 'bold' }}>{label.name}</div>
                    {label.description && (
                      <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{label.description}</div>
                    )}
                  </div>
                  {isSelected && (
                    <span style={{ color: label.color, fontSize: '1.2rem' }}>✓</span>
                  )}
                  {label.isSystem && (
                    <span style={{
                      fontSize: '0.7rem',
                      background: 'rgba(255,255,255,0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      opacity: 0.6,
                    }}>
                      System
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowCreateLabel(true)}
            style={{
              width: '100%',
              marginTop: '16px',
              background: 'rgba(255,255,255,0.05)',
              border: '2px dashed rgba(255,255,255,0.2)',
              borderRadius: '12px',
              padding: '16px',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>+</span>
            Create Custom Label
          </button>
        </div>
      )}

      {/* Manage Tab */}
      {activeTab === 'manage' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', opacity: 0.8 }}>
            All Tags ({tags.length})
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {tags.map((tag) => (
              <div
                key={tag.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                }}
              >
                <span style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: tag.color,
                }} />
                <span style={{ flex: 1, fontWeight: '500' }}>#{tag.name}</span>
                <span style={{ fontSize: '0.85rem', opacity: 0.5 }}>
                  {tag.count} conversations
                </span>
                <button
                  onClick={() => onTagDelete?.(tag.id)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    color: 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', opacity: 0.8 }}>
            All Labels ({labels.length})
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {labels.map((label) => (
              <div
                key={label.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                }}
              >
                <span style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '4px',
                  background: label.color,
                }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: '500' }}>{label.name}</span>
                  {label.isSystem && (
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '0.7rem',
                      background: 'rgba(255,255,255,0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      opacity: 0.6,
                    }}>
                      System
                    </span>
                  )}
                </div>
                {!label.isSystem && (
                  <button
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      color: 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Tag Modal */}
      {showCreateTag && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setShowCreateTag(false)}
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
            <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem' }}>Create Tag</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '8px' }}>
                Tag Name
              </label>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="tag-name"
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
              <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '4px' }}>
                Preview: #{newTagName || 'tag-name'}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '8px' }}>
                Color
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      border: newTagColor === color ? '3px solid white' : '3px solid transparent',
                      background: color,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease',
                      transform: newTagColor === color ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateTag(false)}
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
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                style={{
                  background: newTagName.trim() ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: newTagName.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                }}
              >
                Create Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Label Modal */}
      {showCreateLabel && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setShowCreateLabel(false)}
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
            <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem' }}>Create Label</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '8px' }}>
                Label Name
              </label>
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Label name"
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

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '8px' }}>
                Description (optional)
              </label>
              <input
                type="text"
                value={newLabelDescription}
                onChange={(e) => setNewLabelDescription(e.target.value)}
                placeholder="What is this label for?"
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

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '8px' }}>
                Color
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewLabelColor(color)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      border: newLabelColor === color ? '3px solid white' : '3px solid transparent',
                      background: color,
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateLabel(false)}
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
                onClick={handleCreateLabel}
                disabled={!newLabelName.trim()}
                style={{
                  background: newLabelName.trim() ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: newLabelName.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                }}
              >
                Create Label
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline tag selector
export const TagSelector: React.FC<{
  tags: Tag[];
  selectedTags: string[];
  onToggle: (tagId: string) => void;
  compact?: boolean;
}> = ({ tags, selectedTags, onToggle, compact = false }) => {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? '4px' : '6px' }}>
      {tags.slice(0, compact ? 5 : 10).map((tag) => {
        const isSelected = selectedTags.includes(tag.id);

        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id)}
            style={{
              background: isSelected ? `${tag.color}30` : 'rgba(255,255,255,0.05)',
              border: isSelected ? `1px solid ${tag.color}` : '1px solid transparent',
              borderRadius: '12px',
              padding: compact ? '2px 8px' : '4px 10px',
              color: isSelected ? tag.color : 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: compact ? '0.75rem' : '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            #{tag.name}
          </button>
        );
      })}
    </div>
  );
};

// Label badge
export const LabelBadge: React.FC<{
  label: Label;
  onClick?: () => void;
  size?: 'sm' | 'md';
}> = ({ label, onClick, size = 'md' }) => {
  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '0.7rem' },
    md: { padding: '4px 12px', fontSize: '0.8rem' },
  };

  return (
    <span
      onClick={onClick}
      style={{
        background: `${label.color}20`,
        color: label.color,
        borderRadius: '6px',
        fontWeight: '500',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        cursor: onClick ? 'pointer' : 'default',
        ...sizeStyles[size],
      }}
    >
      <span style={{
        width: size === 'sm' ? '6px' : '8px',
        height: size === 'sm' ? '6px' : '8px',
        borderRadius: '2px',
        background: label.color,
      }} />
      {label.name}
    </span>
  );
};

export default ConversationTags;
