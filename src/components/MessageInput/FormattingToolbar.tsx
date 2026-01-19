// src/components/MessageInput/FormattingToolbar.tsx
// Rich Text Formatting Toolbar Component

import React from 'react';
import type { FormattingToolbarProps, FormattingAction } from './types';

const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  onFormat,
  activeFormats,
  onEmojiClick,
  onAttachmentClick,
  onAIAssist,
  aiEnabled,
}) => {
  const formatButtons: Array<{
    type: FormattingAction['type'];
    icon: string;
    label: string;
    shortcut?: string;
  }> = [
    { type: 'bold', icon: 'fa-bold', label: 'Bold', shortcut: 'Cmd+B' },
    { type: 'italic', icon: 'fa-italic', label: 'Italic', shortcut: 'Cmd+I' },
    { type: 'underline', icon: 'fa-underline', label: 'Underline', shortcut: 'Cmd+U' },
    { type: 'strikethrough', icon: 'fa-strikethrough', label: 'Strikethrough', shortcut: 'Cmd+Shift+X' },
    { type: 'code', icon: 'fa-code', label: 'Code', shortcut: 'Cmd+E' },
  ];

  const structureButtons = [
    { type: 'list' as FormattingAction['type'], icon: 'fa-list-ul', label: 'Bullet List' },
    { type: 'quote' as FormattingAction['type'], icon: 'fa-quote-left', label: 'Quote' },
  ];

  return (
    <div
      className="formatting-toolbar"
      role="toolbar"
      aria-label="Text formatting options"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1, 0.25rem)',
        padding: 'var(--space-2, 0.5rem) var(--space-3, 0.75rem)',
        background: 'rgba(24, 24, 27, 0.6)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #27272A',
        borderRadius: 'var(--ai-radius-lg, 0.75rem) var(--ai-radius-lg, 0.75rem) 0 0',
      }}
    >
      {/* Text Formatting Group */}
      <div
        className="toolbar-group"
        style={{
          display: 'flex',
          gap: 'var(--space-1, 0.25rem)',
          paddingRight: 'var(--space-3, 0.75rem)',
          borderRight: '1px solid #3F3F46',
        }}
      >
        {formatButtons.map((button) => (
          <button
            key={button.type}
            type="button"
            className={`toolbar-button ${activeFormats.has(button.type) ? 'active' : ''}`}
            onClick={() => onFormat({ type: button.type, shortcut: button.shortcut })}
            aria-label={`${button.label}${button.shortcut ? ` (${button.shortcut})` : ''}`}
            data-tooltip={button.label}
            aria-pressed={activeFormats.has(button.type)}
            title={`${button.label}${button.shortcut ? ` (${button.shortcut})` : ''}`}
          >
            <i className={`fa-solid ${button.icon}`} aria-hidden="true" />
          </button>
        ))}
      </div>

      {/* Structure Group */}
      <div
        className="toolbar-group"
        style={{
          display: 'flex',
          gap: 'var(--space-1, 0.25rem)',
          paddingRight: 'var(--space-3, 0.75rem)',
          borderRight: '1px solid #3F3F46',
        }}
      >
        {structureButtons.map((button) => (
          <button
            key={button.type}
            type="button"
            className="toolbar-button"
            onClick={() => onFormat({ type: button.type })}
            aria-label={button.label}
            data-tooltip={button.label}
            title={button.label}
          >
            <i className={`fa-solid ${button.icon}`} aria-hidden="true" />
          </button>
        ))}
      </div>

      {/* Insert Group */}
      <div
        className="toolbar-group"
        style={{
          display: 'flex',
          gap: 'var(--space-1, 0.25rem)',
          paddingRight: 'var(--space-3, 0.75rem)',
          borderRight: '1px solid #3F3F46',
        }}
      >
        <button
          type="button"
          className="toolbar-button"
          onClick={onEmojiClick}
          aria-label="Insert emoji"
          data-tooltip="Emoji"
          title="Insert emoji"
        >
          <i className="fa-solid fa-face-smile" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={onAttachmentClick}
          aria-label="Attach file"
          data-tooltip="Attachment"
          title="Attach file"
        >
          <i className="fa-solid fa-paperclip" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => onFormat({ type: 'link' })}
          aria-label="Insert link"
          data-tooltip="Link"
          title="Insert link"
        >
          <i className="fa-solid fa-link" aria-hidden="true" />
        </button>
      </div>

      {/* AI Assist Group */}
      {aiEnabled && (
        <div
          className="toolbar-group"
          style={{
            display: 'flex',
            gap: 'var(--space-1, 0.25rem)',
            marginLeft: 'auto',
          }}
        >
          <button
            type="button"
            className="toolbar-button"
            onClick={onAIAssist}
            aria-label="AI suggestions (Cmd+K)"
            data-tooltip="AI Assist"
            title="AI suggestions (Cmd+K)"
            style={{
              color: 'var(--ai-active, #8B5CF6)',
            }}
          >
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

export default FormattingToolbar;
