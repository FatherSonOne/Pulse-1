// src/components/PulseComposer/PulseComposer.tsx
// PR 1 - Messages Tools Redesign - Surface 1 - Compose bar.
//
// Scope (per docs/messages-tools-redesign.md section 1.x):
//   IN:  role="toolbar" compose bar (mobile + desktop), attach (+) sheet
//        with 3 actions, Smart Compose ghost-text with debounced live
//        region, format popover on text selection, /t template +
//        / generic slash autocomplete (listbox), send button (Cmd+Enter),
//        tools menu opener (Cmd+Shift+P, placeholder modal).
//   OUT: voice recording (separate PR), schedule send (separate PR),
//        tone chip (separate PR), real Smart Compose backend (stub),
//        real template management (stub).
//
// Coral budget: ZERO. Surface 1 has no coral surfaces. Reject any PR
// that adds coral here.

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Paperclip, Send, Sparkles } from 'lucide-react';
import AttachSheet from './AttachSheet';
import FormatPopover, { applyFormat } from './FormatPopover';
import SlashAutocomplete from './SlashAutocomplete';
import ToolsMenuPlaceholder from './ToolsMenuPlaceholder';
import { VoiceTextButton } from '../shared/VoiceTextButton';
import { useSmartCompose } from './useSmartCompose';
import { useTextSelection } from './useTextSelection';
import {
  filterSlashItems,
  STUB_SLASH_COMMANDS,
  STUB_TEMPLATES,
} from './templates';
import type {
  ComposerAttachment,
  FormatActionId,
  PulseComposerProps,
  SlashItem,
  SlashState,
} from './types';
import { DESKTOP_BREAKPOINT, TOUCH_TARGET_PX } from './types';
import './PulseComposer.css';

const MAX_LENGTH_DEFAULT = 2000;

function useIsMobile(forceMobile?: boolean): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof forceMobile === 'boolean') return forceMobile;
    if (typeof window === 'undefined') return false;
    return window.innerWidth < DESKTOP_BREAKPOINT;
  });
  useEffect(() => {
    if (typeof forceMobile === 'boolean') {
      setIsMobile(forceMobile);
      return;
    }
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobile(window.innerWidth < DESKTOP_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [forceMobile]);
  return isMobile;
}

function useIsDarkMode(override?: boolean): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof override === 'boolean') return override;
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });
  useEffect(() => {
    if (typeof override === 'boolean') {
      setIsDark(override);
      return;
    }
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [override]);
  return isDark;
}

/** Detect a slash trigger immediately before the caret. */
function detectSlashTrigger(value: string, caret: number): SlashState | null {
  if (caret <= 0) return null;
  // Walk back to the nearest line break or start of string.
  let scanStart = caret;
  while (scanStart > 0 && value[scanStart - 1] !== '\n') {
    scanStart -= 1;
  }
  const lineBeforeCaret = value.slice(scanStart, caret);
  // `/t fri` form (template trigger).
  const tmplMatch = /^\/t(?:\s+([^\n]*))?$/.exec(lineBeforeCaret);
  if (tmplMatch) {
    return {
      source: 'templates',
      query: tmplMatch[1] ?? '',
      triggerStart: scanStart,
      triggerEnd: caret,
    };
  }
  // Generic `/cmd` form - `/` at the start of the line, no spaces yet.
  const cmdMatch = /^\/([a-zA-Z][a-zA-Z0-9]*)?$/.exec(lineBeforeCaret);
  if (cmdMatch) {
    return {
      source: 'commands',
      query: cmdMatch[1] ?? '',
      triggerStart: scanStart,
      triggerEnd: caret,
    };
  }
  return null;
}

// Draft persistence key prefix — shared with the legacy MessageInput composer
// (`pulse_msg_draft_v1:`) so a draft survives a swap between the two on the
// same conversation.
const DRAFT_STORAGE_PREFIX = 'pulse_msg_draft_v1:';

export const PulseComposer: React.FC<PulseComposerProps> = ({
  onSend,
  onTyping,
  placeholder = 'Message...',
  maxLength = MAX_LENGTH_DEFAULT,
  disabled = false,
  initialValue = '',
  suggestionProvider,
  isDarkMode: isDarkModeProp,
  forceMobile,
  threadId,
  messageCount,
  toolsEnabled = true,
  enterToSend = false,
  sendTypingIndicators = true,
}) => {
  const isMobile = useIsMobile(forceMobile);
  const isDarkMode = useIsDarkMode(isDarkModeProp);

  // Core textarea state.
  // Draft key for the active conversation; null when no thread is active.
  const draftKey = useMemo(
    () => (threadId ? `${DRAFT_STORAGE_PREFIX}${threadId}` : null),
    [threadId],
  );
  const [value, setValue] = useState<string>(() => {
    if (threadId && typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${threadId}`);
        if (saved) return saved;
      } catch { /* ignore */ }
    }
    return initialValue;
  });
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);

  // Load the new conversation's draft when the thread changes (PulseComposer is
  // not remounted on conversation switch). Skips the initial render — the lazy
  // initializer above already seeded the first draft.
  const prevDraftKey = useRef(draftKey);
  useEffect(() => {
    if (prevDraftKey.current === draftKey) return;
    prevDraftKey.current = draftKey;
    if (!draftKey || typeof window === 'undefined') { setValue(''); return; }
    try {
      setValue(window.localStorage.getItem(draftKey) || '');
    } catch { setValue(''); }
  }, [draftKey]);

  // Persist the draft to localStorage (debounced); clear the key when empty.
  useEffect(() => {
    if (!draftKey || typeof window === 'undefined') return;
    const id = setTimeout(() => {
      try {
        if (value) window.localStorage.setItem(draftKey, value);
        else window.localStorage.removeItem(draftKey);
      } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(id);
  }, [value, draftKey]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const attachBtnRef = useRef<HTMLButtonElement>(null);

  // Sub-surface state.
  const [attachOpen, setAttachOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Slash autocomplete state.
  const [slash, setSlash] = useState<SlashState>({
    source: null,
    query: '',
    triggerStart: 0,
    triggerEnd: 0,
  });
  const [slashActiveIdx, setSlashActiveIdx] = useState(0);

  const slashItems: ReadonlyArray<SlashItem> = useMemo(() => {
    if (slash.source === 'templates') {
      return filterSlashItems(STUB_TEMPLATES, slash.query);
    }
    if (slash.source === 'commands') {
      return filterSlashItems(STUB_SLASH_COMMANDS, slash.query);
    }
    return [];
  }, [slash.source, slash.query]);

  // Reset active index when the candidate list changes.
  useEffect(() => {
    setSlashActiveIdx(0);
  }, [slash.source, slash.query]);

  // Smart Compose.
  const trimmed = value.trim();
  const smartEnabled = !slash.source && trimmed.length > 0 && !disabled;
  const smart = useSmartCompose(value, suggestionProvider, smartEnabled);

  // Text-selection-anchored format popover.
  const selectionAnchor = useTextSelection(textareaRef);
  const formatPopoverOpen =
    !!selectionAnchor && selectionAnchor.length >= 1 && !slash.source && !disabled;

  // --- Auto-grow textarea -----------------------------------------
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, isMobile ? 160 : 200);
    el.style.height = `${next}px`;
  }, [value, isMobile]);

  // --- Typing indicator -------------------------------------------
  // Suppressed when the user disables typing indicators in Message Settings.
  useEffect(() => {
    if (!onTyping) return;
    if (!sendTypingIndicators) {
      onTyping(false);
      return;
    }
    if (!value) {
      onTyping(false);
      return;
    }
    onTyping(true);
    const t = setTimeout(() => onTyping(false), 1500);
    return () => clearTimeout(t);
  }, [value, onTyping, sendTypingIndicators]);

  // --- Slash detection on every value/caret change ----------------
  const refreshSlash = useCallback((nextValue: string, caret: number) => {
    const detected = detectSlashTrigger(nextValue, caret);
    setSlash((prev) => {
      if (!detected) {
        if (prev.source === null) return prev;
        return { source: null, query: '', triggerStart: 0, triggerEnd: 0 };
      }
      if (
        prev.source === detected.source &&
        prev.query === detected.query &&
        prev.triggerStart === detected.triggerStart &&
        prev.triggerEnd === detected.triggerEnd
      ) {
        return prev;
      }
      return detected;
    });
  }, []);

  const onTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      setValue(next);
      refreshSlash(next, e.target.selectionStart ?? next.length);
    },
    [refreshSlash],
  );

  const onTextareaSelect = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      refreshSlash(el.value, el.selectionStart ?? el.value.length);
    },
    [refreshSlash],
  );

  // --- Slash insertion --------------------------------------------
  const insertSlashItem = useCallback(
    (item: SlashItem) => {
      const el = textareaRef.current;
      const caret = el?.selectionEnd ?? slash.triggerEnd;
      const before = value.slice(0, slash.triggerStart);
      const after = value.slice(Math.max(caret, slash.triggerEnd));
      const inserted = `${before}${item.body}${after}`;
      setValue(inserted);
      setSlash({ source: null, query: '', triggerStart: 0, triggerEnd: 0 });
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = before.length + item.body.length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      });
    },
    [slash.triggerStart, slash.triggerEnd, value],
  );

  // --- Format application -----------------------------------------
  const applyFormatAction = useCallback(
    (action: FormatActionId) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      if (end <= start) return;
      const result = applyFormat(value, start, end, action);
      setValue(result.value);
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    },
    [value],
  );

  // --- Send -------------------------------------------------------
  const handleSend = useCallback(() => {
    if (disabled) return;
    const text = value.trim();
    if (!text && attachments.length === 0) return;
    onSend({ text, attachments });
    setValue('');
    setAttachments([]);
    smart.dismiss();
    if (draftKey && typeof window !== 'undefined') {
      try { window.localStorage.removeItem(draftKey); } catch { /* ignore */ }
    }
  }, [disabled, value, attachments, onSend, smart, draftKey]);

  // Append voice-dictated text to the draft (real speech-to-text via the
  // shared VoiceTextButton — Web Speech API / OpenAI fallback). Replaces the
  // PR-1 disabled mic placeholder to reach parity with the legacy composer.
  const handleVoiceTranscript = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    setValue((prev) => {
      const sep = prev && !/\s$/.test(prev) ? ' ' : '';
      return (prev + sep + t).slice(0, maxLength);
    });
  }, [maxLength]);

  // --- Attach pickers ---------------------------------------------
  const handlePickAttachment = useCallback(
    (kind: ComposerAttachment['kind'], file: File) => {
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const preview =
        kind !== 'file' && file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined;
      setAttachments((prev) => [...prev, { id, file, kind, preview }]);
    },
    [],
  );

  // --- Keyboard shortcuts on the textarea -------------------------
  const onTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const meta = e.metaKey || e.ctrlKey;
      const ta = e.currentTarget;

      // Slash autocomplete keys take priority when open + has matches.
      if (slash.source && slashItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlashActiveIdx((i) => (i + 1) % slashItems.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlashActiveIdx(
            (i) => (i - 1 + slashItems.length) % slashItems.length,
          );
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const pick = slashItems[slashActiveIdx];
          if (pick) insertSlashItem(pick);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setSlash({ source: null, query: '', triggerStart: 0, triggerEnd: 0 });
          return;
        }
      }

      // Smart Compose acceptance keys.
      if (smart.suggestion) {
        if (e.key === 'Tab' && !e.shiftKey && !meta) {
          e.preventDefault();
          const next = smart.acceptFull(value, setValue);
          if (next !== null) {
            requestAnimationFrame(() => {
              const t = textareaRef.current;
              if (t) {
                t.focus();
                t.setSelectionRange(next.length, next.length);
              }
            });
          }
          return;
        }
        if (e.key === 'ArrowRight') {
          const caret = ta.selectionStart ?? 0;
          if (caret === value.length && !e.shiftKey && !meta) {
            e.preventDefault();
            const next = smart.acceptWord(value, setValue);
            if (next !== null) {
              requestAnimationFrame(() => {
                const t = textareaRef.current;
                if (t) {
                  t.focus();
                  t.setSelectionRange(next.length, next.length);
                }
              });
            }
            return;
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          smart.dismiss();
          return;
        }
      }

      // Send: Cmd/Ctrl + Enter (always available).
      if (meta && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
        return;
      }

      // Enter-to-send mode (Message Settings): plain Enter sends, Shift+Enter
      // inserts a newline. Slash/smart-compose handlers above already consumed
      // Enter when their surfaces are active, so this only fires for normal text.
      if (enterToSend && e.key === 'Enter' && !e.shiftKey && !meta) {
        e.preventDefault();
        handleSend();
        return;
      }

      // Format shortcuts when selection >= 1 char.
      if (meta) {
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;
        const hasSelection = end > start;
        if (hasSelection) {
          const key = e.key.toLowerCase();
          if (!e.shiftKey && key === 'b') {
            e.preventDefault();
            applyFormatAction('bold');
            return;
          }
          if (!e.shiftKey && key === 'i') {
            e.preventDefault();
            applyFormatAction('italic');
            return;
          }
          if (!e.shiftKey && key === 'e') {
            e.preventDefault();
            applyFormatAction('code');
            return;
          }
          if (!e.shiftKey && key === 'k') {
            e.preventDefault();
            applyFormatAction('link');
            return;
          }
          if (e.shiftKey && (e.key === '7' || e.code === 'Digit7')) {
            e.preventDefault();
            applyFormatAction('list');
            return;
          }
          if (e.shiftKey && (e.key === '8' || e.code === 'Digit8')) {
            e.preventDefault();
            applyFormatAction('list');
            return;
          }
        }
      }

      // Tools menu opener: Cmd+Shift+P. Gated off while the tools surface is
      // removed from the UX (toolsEnabled=false).
      if (toolsEnabled && meta && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setToolsOpen(true);
        return;
      }

      // Alt+A -> attach sheet.
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setAttachOpen(true);
        return;
      }
    },
    [
      slash.source,
      slashItems,
      slashActiveIdx,
      insertSlashItem,
      smart,
      value,
      handleSend,
      applyFormatAction,
      enterToSend,
      toolsEnabled,
    ],
  );

  // --- Ghost-text mirror text -------------------------------------
  const ghostFragment =
    smart.suggestion && !slash.source ? smart.suggestion.completion : '';

  // --- Anchor measurement for desktop attach popover --------------
  const attachAnchor = useMemo(() => {
    if (!attachOpen || isMobile) return null;
    const el = attachBtnRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { top: rect.top, left: rect.left, height: rect.height };
  }, [attachOpen, isMobile]);

  // --- Slash listbox footer hint ----------------------------------
  const slashFooter = useMemo(() => {
    if (!slash.source) return '';
    const total =
      slash.source === 'templates'
        ? STUB_TEMPLATES.length
        : STUB_SLASH_COMMANDS.length;
    const labelNoun = slash.source === 'templates' ? 'templates' : 'commands';
    return `${slashItems.length} of ${total} ${labelNoun} - up/down navigate - Esc close`;
  }, [slash.source, slashItems.length]);

  const slashLabel =
    slash.source === 'templates' ? 'Template suggestions' : 'Slash commands';

  // --- Mic vs send swap (PR 1: mic is a passive placeholder) ------
  const showMic = value.trim().length === 0 && attachments.length === 0;

  const surfaceClasses = isDarkMode
    ? 'bg-zinc-900/95 border border-white/10 text-zinc-100'
    : 'bg-white border border-black/10 text-zinc-900';

  return (
    <>
      {/* Visually-hidden live region for Smart Compose announcements. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {smart.announcement}
      </div>

      <div
        ref={containerRef}
        role="toolbar"
        aria-label="Message composer"
        className={[
          'relative w-full rounded-2xl px-2 py-2 shadow-sm',
          surfaceClasses,
        ].join(' ')}
      >
        {/* Attachment chips (minimal - full UX is out of PR 1 scope) */}
        {attachments.length > 0 ? (
          <ul
            aria-label="Attached files"
            className="flex flex-wrap gap-1.5 px-1.5 pt-1 pb-2"
          >
            {attachments.map((att) => (
              <li
                key={att.id}
                className={[
                  'flex items-center gap-2 text-xs rounded-full px-2.5 py-1',
                  isDarkMode ? 'bg-white/10 text-zinc-200' : 'bg-black/5 text-zinc-700',
                ].join(' ')}
              >
                <span className="truncate max-w-[160px]">{att.file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${att.file.name}`}
                  onClick={() =>
                    setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                  }
                  className={[
                    'text-xs leading-none px-1 rounded',
                    isDarkMode ? 'hover:bg-white/15' : 'hover:bg-black/10',
                  ].join(' ')}
                >
                  x
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-end gap-1.5">
          {/* Attach group */}
          <div role="group" aria-label="Attach options" className="flex items-end">
            <button
              ref={attachBtnRef}
              type="button"
              aria-label="Attach"
              aria-haspopup="menu"
              aria-expanded={attachOpen}
              onClick={() => setAttachOpen(true)}
              disabled={disabled}
              className={[
                'flex items-center justify-center rounded-xl',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isDarkMode ? 'hover:bg-white/10 text-zinc-200' : 'hover:bg-black/5 text-zinc-700',
              ].join(' ')}
              style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
            >
              <Paperclip size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Textarea + ghost-text mirror */}
          <div className="flex-1 min-w-0 pulse-composer-textarea-stack px-1 py-1.5">
            <pre
              aria-hidden="true"
              className="pulse-composer-ghost text-[15px] leading-[1.4] px-2.5 py-2 m-0 font-sans"
              style={{
                fontFamily: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
              }}
            >
              <span className="pulse-composer-ghost-prefix">{value}</span>
              {ghostFragment}
            </pre>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={onTextareaChange}
              onSelect={onTextareaSelect}
              onKeyDown={onTextareaKeyDown}
              placeholder={placeholder}
              maxLength={maxLength}
              disabled={disabled}
              rows={1}
              aria-label="Message text"
              aria-describedby={smart.suggestion ? 'pulse-composer-suggestion-hint' : undefined}
              className={[
                'pulse-composer-textarea relative w-full bg-transparent border-0 outline-none',
                'text-[15px] leading-[1.4] px-2.5 py-2',
                'placeholder:opacity-50',
                isDarkMode ? 'text-zinc-100' : 'text-zinc-900',
              ].join(' ')}
            />
            {smart.suggestion ? (
              <span id="pulse-composer-suggestion-hint" className="sr-only">
                Tab to accept suggestion. Right arrow to accept word. Escape to dismiss.
              </span>
            ) : null}
          </div>

          {/* Send group */}
          <div role="group" aria-label="Send options" className="flex items-end gap-1">
            {toolsEnabled && (
            <button
              type="button"
              aria-label="AI tools"
              aria-haspopup="dialog"
              title="Tools (Cmd+Shift+P)"
              onClick={() => setToolsOpen(true)}
              disabled={disabled}
              className={[
                'flex items-center justify-center rounded-xl',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isDarkMode ? 'hover:bg-white/10 text-zinc-200' : 'hover:bg-black/5 text-zinc-700',
              ].join(' ')}
              style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
            >
              <Sparkles size={18} aria-hidden="true" />
            </button>
            )}

            {showMic ? (
              <VoiceTextButton
                onTranscript={handleVoiceTranscript}
                onError={(err) => console.error('[PulseComposer] voice error:', err)}
                disabled={disabled}
                size="md"
                className={[
                  'flex items-center justify-center rounded-xl',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                  isDarkMode ? 'hover:bg-white/10 text-zinc-200' : 'hover:bg-black/5 text-zinc-700',
                ].join(' ')}
              />
            ) : (
              <button
                type="button"
                aria-label={
                  value.trim() ? 'Send message' : 'Send attachments'
                }
                title="Send (Cmd+Enter)"
                onClick={handleSend}
                disabled={disabled || (!value.trim() && attachments.length === 0)}
                className={[
                  'flex items-center justify-center rounded-xl pulse-btn-primary text-white',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                ].join(' ')}
                style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
              >
                <Send size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Slash autocomplete - anchored above (mobile) / below (desktop) input */}
        {slash.source ? (
          <div
            className={
              isMobile
                ? 'absolute left-2 right-2 bottom-full mb-2 z-30'
                : 'absolute left-12 right-auto top-full mt-2 z-30'
            }
          >
            <SlashAutocomplete
              open
              isMobile={isMobile}
              isDarkMode={isDarkMode}
              items={slashItems}
              activeIndex={slashActiveIdx}
              listLabel={slashLabel}
              footerHint={slashFooter}
              onActiveIndexChange={setSlashActiveIdx}
              onAccept={insertSlashItem}
              onClose={() =>
                setSlash({ source: null, query: '', triggerStart: 0, triggerEnd: 0 })
              }
            />
          </div>
        ) : null}
      </div>

      {/* Selection-anchored format popover (renders in a viewport-fixed layer) */}
      <FormatPopover
        open={formatPopoverOpen}
        anchor={selectionAnchor}
        isDarkMode={isDarkMode}
        onApply={applyFormatAction}
      />

      {/* Attach sheet / popover */}
      <AttachSheet
        open={attachOpen}
        isMobile={isMobile}
        isDarkMode={isDarkMode}
        anchor={attachAnchor}
        onClose={() => setAttachOpen(false)}
        onPick={handlePickAttachment}
      />

      {/* Tools menu placeholder — when toolsMenuV2 flag is on, swaps to
          the real slim menu. threadId + messageCount drive the
          tile-visibility state machine (Summary / Insights / Audit). */}
      {toolsEnabled && (
      <ToolsMenuPlaceholder
        open={toolsOpen}
        isDarkMode={isDarkMode}
        onClose={() => setToolsOpen(false)}
        threadId={threadId}
        messageCount={messageCount}
      />
      )}
    </>
  );
};

export default PulseComposer;
