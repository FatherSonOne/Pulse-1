import React, { useState, useCallback, useRef } from 'react';

// Types
interface FormattingOption {
  id: string;
  icon: string;
  label: string;
  shortcut?: string;
  format: string;
  type: 'wrap' | 'prefix' | 'block';
}

interface TextSelection {
  start: number;
  end: number;
  text: string;
}

interface FormattingToolbarProps {
  onFormat?: (format: string, selection: TextSelection) => string;
  onInsertEmoji?: (emoji: string) => void;
  onInsertMention?: (mention: string) => void;
  onInsertLink?: (url: string, text: string) => void;
  compact?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

// Formatting options
const formattingOptions: FormattingOption[] = [
  { id: 'bold', icon: 'fa-bold', label: 'Bold', shortcut: 'Ctrl+B', format: '**', type: 'wrap' },
  { id: 'italic', icon: 'fa-italic', label: 'Italic', shortcut: 'Ctrl+I', format: '_', type: 'wrap' },
  { id: 'strikethrough', icon: 'fa-strikethrough', label: 'Strikethrough', shortcut: 'Ctrl+Shift+S', format: '~~', type: 'wrap' },
  { id: 'code', icon: 'fa-code', label: 'Code', shortcut: 'Ctrl+E', format: '`', type: 'wrap' },
  { id: 'codeblock', icon: 'fa-file-code', label: 'Code Block', shortcut: 'Ctrl+Shift+C', format: '```', type: 'block' },
  { id: 'quote', icon: 'fa-quote-left', label: 'Quote', shortcut: 'Ctrl+Shift+Q', format: '> ', type: 'prefix' },
  { id: 'heading', icon: 'fa-heading', label: 'Heading', format: '# ', type: 'prefix' },
  { id: 'bullet', icon: 'fa-list-ul', label: 'Bullet List', format: '- ', type: 'prefix' },
  { id: 'numbered', icon: 'fa-list-ol', label: 'Numbered List', format: '1. ', type: 'prefix' },
  { id: 'task', icon: 'fa-square-check', label: 'Task List', format: '- [ ] ', type: 'prefix' }
];

// Quick emojis
const quickEmojis = ['😊', '👍', '❤️', '🎉', '🔥', '✨', '👏', '🚀'];

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    flexWrap: 'wrap' as const
  },
  toolbarCompact: {
    padding: '4px 8px',
    gap: '2px'
  },
  toolGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px'
  },
  divider: {
    width: '1px',
    height: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    margin: '0 6px'
  },
  button: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    transition: 'all 0.15s ease',
    position: 'relative' as const
  },
  buttonCompact: {
    width: '28px',
    height: '28px',
    fontSize: '12px'
  },
  buttonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa'
  },
  tooltip: {
    position: 'absolute' as const,
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '6px 10px',
    borderRadius: '6px',
    backgroundColor: '#1a1a24',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '11px',
    color: '#e2e8f0',
    whiteSpace: 'nowrap' as const,
    marginBottom: '6px',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
  },
  shortcut: {
    marginLeft: '8px',
    color: '#64748b',
    fontSize: '10px'
  },
  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: '0',
    marginTop: '4px',
    backgroundColor: '#1a1a24',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    zIndex: 100,
    overflow: 'hidden',
    minWidth: '200px'
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#e2e8f0',
    transition: 'background-color 0.15s ease'
  },
  emojiBar: {
    display: 'flex',
    gap: '4px'
  },
  emojiButton: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease'
  },
  linkModal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  linkModalContent: {
    backgroundColor: '#1a1a24',
    borderRadius: '12px',
    padding: '20px',
    width: '90%',
    maxWidth: '400px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
    marginBottom: '12px'
  },
  modalButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px'
  },
  cancelButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '13px'
  },
  insertButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#8B5CF6',
    color: 'white',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500
  },
  colorPicker: {
    display: 'flex',
    gap: '4px',
    padding: '8px'
  },
  colorSwatch: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  }
};

// Text colors
const textColors = [
  '#f87171', // red
  '#fb923c', // orange
  '#fbbf24', // amber
  '#a3e635', // lime
  '#34d399', // emerald
  '#22d3ee', // cyan
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#f472b6', // pink
  '#e2e8f0'  // default
];

// Formatting Toolbar Button Component
const ToolbarButton: React.FC<{
  option: FormattingOption;
  isActive?: boolean;
  compact?: boolean;
  onClick: () => void;
}> = ({ option, isActive = false, compact = false, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <button
      style={{
        ...styles.button,
        ...(compact ? styles.buttonCompact : {}),
        ...(isActive ? styles.buttonActive : {})
      }}
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <i className={`fa-solid ${option.icon}`} />
      {showTooltip && (
        <div style={styles.tooltip}>
          {option.label}
          {option.shortcut && <span style={styles.shortcut}>{option.shortcut}</span>}
        </div>
      )}
    </button>
  );
};

// Main Component
export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  onFormat,
  onInsertEmoji,
  onInsertMention,
  onInsertLink,
  compact = false,
  inputRef
}) => {
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);

  const handleFormat = useCallback((option: FormattingOption) => {
    if (!inputRef?.current) return;

    const textarea = inputRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    const selection: TextSelection = { start, end, text: selectedText };

    if (onFormat) {
      onFormat(option.format, selection);
    }
  }, [inputRef, onFormat]);

  const handleInsertLink = useCallback(() => {
    if (onInsertLink && linkUrl) {
      onInsertLink(linkUrl, linkText || linkUrl);
      setLinkUrl('');
      setLinkText('');
      setShowLinkModal(false);
    }
  }, [onInsertLink, linkUrl, linkText]);

  const mainOptions = formattingOptions.slice(0, 6);
  const moreOptions = formattingOptions.slice(6);

  return (
    <div style={styles.container}>
      <div style={{ ...styles.toolbar, ...(compact ? styles.toolbarCompact : {}) }}>
        {/* Main formatting options */}
        <div style={styles.toolGroup}>
          {mainOptions.map(option => (
            <ToolbarButton
              key={option.id}
              option={option}
              compact={compact}
              onClick={() => handleFormat(option)}
            />
          ))}
        </div>

        <div style={styles.divider} />

        {/* More options dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            ref={moreButtonRef}
            style={{
              ...styles.button,
              ...(compact ? styles.buttonCompact : {}),
              ...(showMoreOptions ? styles.buttonActive : {})
            }}
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            title="More options"
          >
            <i className="fa-solid fa-ellipsis" />
          </button>
          {showMoreOptions && (
            <div style={styles.dropdown}>
              {moreOptions.map(option => (
                <div
                  key={option.id}
                  style={styles.dropdownItem}
                  onClick={() => {
                    handleFormat(option);
                    setShowMoreOptions(false);
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLDivElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLDivElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <i className={`fa-solid ${option.icon}`} style={{ width: '16px', color: '#94a3b8' }} />
                  <span>{option.label}</span>
                  {option.shortcut && (
                    <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '11px' }}>
                      {option.shortcut}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.divider} />

        {/* Link button */}
        <button
          style={{
            ...styles.button,
            ...(compact ? styles.buttonCompact : {})
          }}
          onClick={() => setShowLinkModal(true)}
          title="Insert link"
        >
          <i className="fa-solid fa-link" />
        </button>

        {/* Color picker */}
        <div style={{ position: 'relative' }}>
          <button
            ref={colorButtonRef}
            style={{
              ...styles.button,
              ...(compact ? styles.buttonCompact : {}),
              ...(showColorPicker ? styles.buttonActive : {})
            }}
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Text color"
          >
            <i className="fa-solid fa-palette" />
          </button>
          {showColorPicker && (
            <div style={{ ...styles.dropdown, minWidth: 'auto' }}>
              <div style={styles.colorPicker}>
                {textColors.map(color => (
                  <div
                    key={color}
                    style={{
                      ...styles.colorSwatch,
                      backgroundColor: color
                    }}
                    onClick={() => {
                      // Handle color selection
                      setShowColorPicker(false);
                    }}
                    onMouseEnter={e => {
                      (e.target as HTMLDivElement).style.borderColor = 'white';
                      (e.target as HTMLDivElement).style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={e => {
                      (e.target as HTMLDivElement).style.borderColor = 'transparent';
                      (e.target as HTMLDivElement).style.transform = 'scale(1)';
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mention button */}
        <button
          style={{
            ...styles.button,
            ...(compact ? styles.buttonCompact : {})
          }}
          onClick={() => onInsertMention?.('@')}
          title="Mention someone"
        >
          <i className="fa-solid fa-at" />
        </button>

        <div style={styles.divider} />

        {/* Quick emojis */}
        <div style={styles.emojiBar}>
          {quickEmojis.slice(0, compact ? 4 : 8).map(emoji => (
            <button
              key={emoji}
              style={styles.emojiButton}
              onClick={() => onInsertEmoji?.(emoji)}
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
      </div>

      {/* Link insertion modal */}
      {showLinkModal && (
        <div style={styles.linkModal} onClick={() => setShowLinkModal(false)}>
          <div style={styles.linkModalContent} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', marginBottom: '16px' }}>
              Insert Link
            </div>
            <input
              type="text"
              placeholder="Display text (optional)"
              value={linkText}
              onChange={e => setLinkText(e.target.value)}
              style={styles.input}
            />
            <input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              style={styles.input}
              autoFocus
            />
            <div style={styles.modalButtons}>
              <button style={styles.cancelButton} onClick={() => setShowLinkModal(false)}>
                Cancel
              </button>
              <button style={styles.insertButton} onClick={handleInsertLink}>
                Insert Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact inline toolbar (appears on text selection)
export const InlineFormattingBar: React.FC<{
  position: { x: number; y: number };
  onFormat: (format: string) => void;
  onClose: () => void;
}> = ({ position, onFormat, onClose }) => {
  const quickFormats = formattingOptions.slice(0, 5);

  return (
    <div
      style={{
        position: 'fixed',
        top: position.y - 44,
        left: position.x,
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '2px',
        padding: '6px',
        backgroundColor: '#1a1a24',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        zIndex: 1000
      }}
    >
      {quickFormats.map(option => (
        <button
          key={option.id}
          onClick={() => {
            onFormat(option.format);
            onClose();
          }}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px'
          }}
          title={option.label}
        >
          <i className={`fa-solid ${option.icon}`} />
        </button>
      ))}
    </div>
  );
};

export default FormattingToolbar;
