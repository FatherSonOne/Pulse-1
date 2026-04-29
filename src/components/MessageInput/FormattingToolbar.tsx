// src/components/MessageInput/FormattingToolbar.tsx
// Rich Text Formatting Toolbar Component
// Enhanced: spacing, animated tooltips, spring physics & glow hover, light/dark

import React, { useState, useEffect, useMemo } from 'react';
import type { FormattingToolbarProps, FormattingAction } from './types';

import { Link, Paperclip, Smile, Wand2 } from 'lucide-react';

/** Detect dark mode from <html class="dark"> */
function useIsDark() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  onFormat,
  activeFormats,
  onEmojiClick,
  onAttachmentClick,
  onAIAssist,
  aiEnabled,
}) => {
  const isDark = useIsDark();

  const theme = useMemo(() => {
    if (isDark) {
      return {
        toolbarBg: 'rgba(24, 24, 27, 0.6)',
        toolbarBorder: '#27272A',
        divider: 'rgba(63, 63, 70, 0.6)',
        btnIdle: '#a1a1aa',
        btnHover: '#e4e4e7',
        btnHoverBg: 'rgba(255, 255, 255, 0.08)',
        btnHoverBorder: 'rgba(255, 255, 255, 0.15)',
        tooltipBg: '#18181b',
        tooltipBorder: '#3f3f46',
        tooltipText: '#e4e4e7',
        tooltipShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      };
    }
    // Light mode — neutral surface, coral reserved for hover/active state only.
    return {
      toolbarBg: 'rgba(0, 0, 0, 0.02)',
      toolbarBorder: 'rgba(0, 0, 0, 0.08)',
      divider: 'rgba(0, 0, 0, 0.08)',
      btnIdle: '#78716c',
      btnHover: '#e11d48',
      btnHoverBg: 'rgba(244, 63, 94, 0.06)',
      btnHoverBorder: 'rgba(244, 63, 94, 0.18)',
      tooltipBg: '#ffffff',
      tooltipBorder: 'rgba(0, 0, 0, 0.1)',
      tooltipText: '#27272a',
      tooltipShadow: '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
    };
  }, [isDark]);

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
    { type: 'quote' as FormattingAction['type'], icon: 'fa-quote-left', label: 'Block Quote' },
  ];

  return (
    <div
      className="formatting-toolbar"
      role="toolbar"
      aria-label="Text formatting options"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 14px',
        background: theme.toolbarBg,
        backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${theme.toolbarBorder}`,
        borderRadius: '0.75rem 0.75rem 0 0',
      }}
    >
      {/* Text Formatting Group */}
      <div
        className="toolbar-group"
        style={{
          display: 'flex',
          gap: '6px',
          paddingRight: '12px',
          borderRight: `1px solid ${theme.divider}`,
        }}
      >
        {formatButtons.map((button) => (
          <ToolbarButton
            key={button.type}
            label={button.label}
            shortcut={button.shortcut}
            isActive={activeFormats.has(button.type)}
            onClick={() => onFormat({ type: button.type, shortcut: button.shortcut })}
            ariaPressed={activeFormats.has(button.type)}
            theme={theme}
          >
            <i className={`fa-solid ${button.icon}`} aria-hidden="true" style={{ fontSize: '13px' }} />
          </ToolbarButton>
        ))}
      </div>

      {/* Structure Group */}
      <div
        className="toolbar-group"
        style={{
          display: 'flex',
          gap: '6px',
          padding: '0 12px',
          borderRight: `1px solid ${theme.divider}`,
        }}
      >
        {structureButtons.map((button) => (
          <ToolbarButton
            key={button.type}
            label={button.label}
            onClick={() => onFormat({ type: button.type })}
            theme={theme}
          >
            <i className={`fa-solid ${button.icon}`} aria-hidden="true" style={{ fontSize: '13px' }} />
          </ToolbarButton>
        ))}
      </div>

      {/* Insert Group */}
      <div
        className="toolbar-group"
        style={{
          display: 'flex',
          gap: '6px',
          paddingLeft: '4px',
          paddingRight: aiEnabled ? '12px' : '0',
          borderRight: aiEnabled ? `1px solid ${theme.divider}` : 'none',
        }}
      >
        <ToolbarButton label="Emoji" onClick={onEmojiClick} theme={theme}>
          <Smile size={15} />
        </ToolbarButton>
        <ToolbarButton label="Attach File" onClick={onAttachmentClick} theme={theme}>
          <Paperclip size={15} />
        </ToolbarButton>
        <ToolbarButton label="Insert Link" onClick={() => onFormat({ type: 'link' })} theme={theme}>
          <Link size={15} />
        </ToolbarButton>
      </div>

      {/* AI Assist Group */}
      {aiEnabled && (
        <div
          className="toolbar-group"
          style={{
            display: 'flex',
            gap: '6px',
            marginLeft: 'auto',
          }}
        >
          <ToolbarButton
            label="AI Assist"
            shortcut="Cmd+K"
            onClick={onAIAssist}
            theme={theme}
          >
            <Wand2 size={15} />
          </ToolbarButton>
        </div>
      )}
    </div>
  );
};

/* ─── Individual Toolbar Button with tooltip + spring + glow ─── */

interface ToolbarTheme {
  btnIdle: string;
  btnHover: string;
  btnHoverBg: string;
  btnHoverBorder: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipShadow: string;
}

interface ToolbarButtonProps {
  label: string;
  shortcut?: string;
  isActive?: boolean;
  ariaPressed?: boolean;
  accentColor?: string;
  onClick?: () => void;
  children: React.ReactNode;
  theme: ToolbarTheme;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  label,
  shortcut,
  isActive,
  ariaPressed,
  accentColor,
  onClick,
  children,
  theme,
}) => {
  const [hovered, setHovered] = useState(false);

  const tooltipText = shortcut ? `${label}  (${shortcut})` : label;
  const activeColor = accentColor || '#f43f5e';

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="fmt-toolbar-btn"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label={tooltipText}
        aria-pressed={ariaPressed || undefined}
        style={{
          width: '34px',
          height: '34px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isActive
            ? `${activeColor}22`
            : hovered
            ? theme.btnHoverBg
            : 'transparent',
          border: '1px solid',
          borderColor: isActive
            ? `${activeColor}66`
            : hovered
            ? theme.btnHoverBorder
            : 'transparent',
          borderRadius: '8px',
          color: isActive
            ? activeColor
            : hovered
            ? theme.btnHover
            : theme.btnIdle,
          cursor: 'pointer',
          // Spring physics via CSS transform
          transform: hovered ? 'scale(1.12)' : 'scale(1)',
          transitionProperty: 'transform, color, background, border-color, box-shadow',
          transitionDuration: hovered ? '280ms' : '400ms',
          transitionTimingFunction: hovered
            ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' // spring overshoot
            : 'cubic-bezier(0.22, 0.61, 0.36, 1)', // smooth settle-back
          // Glow on hover
          boxShadow: hovered
            ? `0 0 12px ${activeColor}40, 0 0 4px ${activeColor}20`
            : isActive
            ? `0 0 8px ${activeColor}25`
            : 'none',
          position: 'relative',
        }}
      >
        {children}
      </button>

      {/* Animated tooltip */}
      <div
        role="tooltip"
        style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: hovered
            ? 'translateX(-50%) translateY(-8px) scale(1)'
            : 'translateX(-50%) translateY(-4px) scale(0.9)',
          opacity: hovered ? 1 : 0,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          padding: '5px 10px',
          borderRadius: '6px',
          background: theme.tooltipBg,
          border: `1px solid ${theme.tooltipBorder}`,
          color: theme.tooltipText,
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          boxShadow: theme.tooltipShadow,
          transition: 'opacity 180ms ease, transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: 50,
        }}
      >
        {label}
        {shortcut && (
          <span style={{ marginLeft: '6px', opacity: 0.5, fontSize: '10px' }}>
            {shortcut}
          </span>
        )}
        {/* Tooltip arrow */}
        <div
          style={{
            position: 'absolute',
            bottom: '-4px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: '8px',
            height: '8px',
            background: theme.tooltipBg,
            borderRight: `1px solid ${theme.tooltipBorder}`,
            borderBottom: `1px solid ${theme.tooltipBorder}`,
          }}
        />
      </div>
    </div>
  );
};

export default FormattingToolbar;
