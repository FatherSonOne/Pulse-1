import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

// Types
interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

interface EmojiReactionsProps {
  messageId: string;
  reactions: Reaction[];
  onReact?: (emoji: string) => void;
  onRemoveReaction?: (emoji: string) => void;
  compact?: boolean;
}

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  position?: { x: number; y: number };
  recentEmojis?: string[];
}

// Emoji categories
const emojiCategories: EmojiCategory[] = [
  {
    id: 'recent',
    name: 'Recent',
    icon: '🕐',
    emojis: []
  },
  {
    id: 'smileys',
    name: 'Smileys',
    icon: '😀',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐']
  },
  {
    id: 'gestures',
    name: 'Gestures',
    icon: '👋',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶']
  },
  {
    id: 'hearts',
    name: 'Hearts',
    icon: '❤️',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️']
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: '🎁',
    emojis: ['🎁', '🎈', '🎉', '🎊', '🎀', '🎗️', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🎮', '🕹️', '🎲', '🧩', '🎯', '🎨', '🖼️', '🎭', '🎪', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻']
  },
  {
    id: 'animals',
    name: 'Animals',
    icon: '🐱',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️']
  },
  {
    id: 'food',
    name: 'Food',
    icon: '🍕',
    emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕']
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: '💯',
    emojis: ['💯', '💢', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '💮', '♨️', '💈', '🛑', '🕛', '🕧', '🕐', '🕜', '🕑', '🕝', '🕒', '🕞', '🕓', '✨', '⭐', '🌟', '💫', '⚡', '🔥', '💥', '☄️', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌊', '💧', '💦', '☔']
  }
];

// Quick reactions
const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

// Styles
const styles = {
  container: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    alignItems: 'center'
  },
  reaction: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: '14px'
  },
  reactionActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: 'rgba(139, 92, 246, 0.4)'
  },
  reactionCount: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#94a3b8'
  },
  addButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '1px dashed rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    transition: 'all 0.2s ease'
  },
  picker: {
    position: 'fixed' as const,
    backgroundColor: '#1a1a24',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    width: '320px',
    maxHeight: '400px',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    zIndex: 1000
  },
  pickerHeader: {
    padding: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none'
  },
  quickBar: {
    display: 'flex',
    gap: '4px',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
  },
  quickEmoji: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  },
  categoryTabs: {
    display: 'flex',
    gap: '2px',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    overflowX: 'auto' as const
  },
  categoryTab: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    flexShrink: 0
  },
  categoryTabActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)'
  },
  emojiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: '4px',
    padding: '12px',
    overflowY: 'auto' as const,
    flex: 1,
    maxHeight: '250px'
  },
  emojiButton: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease'
  },
  categoryTitle: {
    gridColumn: '1 / -1',
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    padding: '8px 0 4px'
  },
  tooltip: {
    position: 'absolute' as const,
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: '#1a1a24',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '11px',
    color: '#94a3b8',
    whiteSpace: 'nowrap' as const,
    marginBottom: '4px',
    zIndex: 10
  }
};

// Emoji Picker Component
export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  position,
  recentEmojis = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const pickerRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const cats = [...emojiCategories];
    if (recentEmojis.length > 0) {
      cats[0] = { ...cats[0], emojis: recentEmojis.slice(0, 16) };
    }
    return cats;
  }, [recentEmojis]);

  const filteredEmojis = useMemo(() => {
    if (!searchQuery) return null;
    const query = searchQuery.toLowerCase();
    const allEmojis = categories.flatMap(c => c.emojis);
    return allEmojis.filter(emoji => emoji.includes(query));
  }, [searchQuery, categories]);

  const handleSelect = useCallback((emoji: string) => {
    onSelect(emoji);
    onClose();
  }, [onSelect, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pickerStyle: React.CSSProperties = {
    ...styles.picker,
    ...(position ? { top: position.y, left: position.x } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
  };

  return (
    <div ref={pickerRef} style={pickerStyle}>
      <div style={styles.pickerHeader}>
        <input
          type="text"
          placeholder="Search emoji..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={styles.searchInput}
          autoFocus
        />
      </div>

      <div style={styles.quickBar}>
        {quickReactions.map(emoji => (
          <button
            key={emoji}
            style={styles.quickEmoji}
            onClick={() => handleSelect(emoji)}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              (e.target as HTMLButtonElement).style.transform = 'scale(1.2)';
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
              (e.target as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            {emoji}
          </button>
        ))}
      </div>

      {!searchQuery && (
        <div style={styles.categoryTabs}>
          {categories.filter(c => c.emojis.length > 0 || c.id !== 'recent').map(category => (
            <button
              key={category.id}
              style={{
                ...styles.categoryTab,
                ...(activeCategory === category.id ? styles.categoryTabActive : {})
              }}
              onClick={() => setActiveCategory(category.id)}
              title={category.name}
            >
              {category.icon}
            </button>
          ))}
        </div>
      )}

      <div style={styles.emojiGrid}>
        {searchQuery ? (
          filteredEmojis && filteredEmojis.length > 0 ? (
            filteredEmojis.map(emoji => (
              <button
                key={emoji}
                style={styles.emojiButton}
                onClick={() => handleSelect(emoji)}
                onMouseEnter={e => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={e => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                {emoji}
              </button>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#64748b' }}>
              No emojis found
            </div>
          )
        ) : (
          categories
            .filter(c => c.id === activeCategory && c.emojis.length > 0)
            .map(category => (
              <React.Fragment key={category.id}>
                <div style={styles.categoryTitle}>{category.name}</div>
                {category.emojis.map(emoji => (
                  <button
                    key={emoji}
                    style={styles.emojiButton}
                    onClick={() => handleSelect(emoji)}
                    onMouseEnter={e => {
                      (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseLeave={e => {
                      (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </React.Fragment>
            ))
        )}
      </div>
    </div>
  );
};

// Reaction with tooltip
const ReactionButton: React.FC<{
  reaction: Reaction;
  onClick: () => void;
}> = ({ reaction, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      {showTooltip && reaction.users.length > 0 && (
        <div style={styles.tooltip}>
          {reaction.users.slice(0, 5).join(', ')}
          {reaction.users.length > 5 && ` +${reaction.users.length - 5} more`}
        </div>
      )}
      <button
        style={{
          ...styles.reaction,
          ...(reaction.hasReacted ? styles.reactionActive : {})
        }}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span>{reaction.emoji}</span>
        <span style={styles.reactionCount}>{reaction.count}</span>
      </button>
    </div>
  );
};

// Main Emoji Reactions Component
export const EmojiReactions: React.FC<EmojiReactionsProps> = ({
  messageId,
  reactions,
  onReact,
  onRemoveReaction,
  compact = false
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<{ x: number; y: number } | undefined>();
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const handleAddClick = useCallback(() => {
    if (addButtonRef.current) {
      const rect = addButtonRef.current.getBoundingClientRect();
      setPickerPosition({
        x: Math.min(rect.left, window.innerWidth - 340),
        y: Math.min(rect.bottom + 8, window.innerHeight - 420)
      });
    }
    setShowPicker(true);
  }, []);

  const handleReactionClick = useCallback((reaction: Reaction) => {
    if (reaction.hasReacted) {
      onRemoveReaction?.(reaction.emoji);
    } else {
      onReact?.(reaction.emoji);
    }
  }, [onReact, onRemoveReaction]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    onReact?.(emoji);
  }, [onReact]);

  if (compact && (!reactions || reactions.length === 0)) {
    return null;
  }

  return (
    <div style={styles.container}>
      {(reactions || []).map(reaction => (
        <ReactionButton
          key={reaction.emoji}
          reaction={reaction}
          onClick={() => handleReactionClick(reaction)}
        />
      ))}

      <button
        ref={addButtonRef}
        style={styles.addButton}
        onClick={handleAddClick}
        onMouseEnter={e => {
          (e.target as HTMLButtonElement).style.borderColor = 'rgba(139, 92, 246, 0.4)';
          (e.target as HTMLButtonElement).style.color = '#a78bfa';
        }}
        onMouseLeave={e => {
          (e.target as HTMLButtonElement).style.borderColor = 'rgba(255, 255, 255, 0.2)';
          (e.target as HTMLButtonElement).style.color = '#64748b';
        }}
      >
        <i className="fa-solid fa-plus" />
      </button>

      <EmojiPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleEmojiSelect}
        position={pickerPosition}
      />
    </div>
  );
};

// Quick Reaction Bar (for hover state on messages)
export const QuickReactionBar: React.FC<{
  onReact: (emoji: string) => void;
  existingReactions?: string[];
}> = ({ onReact, existingReactions = [] }) => {
  return (
    <div style={{
      display: 'flex',
      gap: '2px',
      padding: '4px',
      borderRadius: '8px',
      backgroundColor: 'rgba(26, 26, 36, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    }}>
      {quickReactions.map(emoji => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: existingReactions.includes(emoji) ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            (e.target as HTMLButtonElement).style.transform = 'scale(1.2)';
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.backgroundColor = existingReactions.includes(emoji) ? 'rgba(139, 92, 246, 0.2)' : 'transparent';
            (e.target as HTMLButtonElement).style.transform = 'scale(1)';
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default EmojiReactions;
