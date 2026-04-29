// src/components/MessageInput/MessageInput.tsx
// AI-Augmented Message Input Component

import React, { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import useMessagesStore from '../../store/messageStore';
import FormattingToolbar from './FormattingToolbar';
import ToneAnalyzer from './ToneAnalyzer';
import AttachmentPreview from './AttachmentPreview';
import SlashCommandDropdown from './SlashCommandDropdown';
import InlineToolsMenu from './InlineToolsMenu';
import { useSlashCommands } from '../../hooks/useSlashCommands';
import { getToolOverlayType, saveRecentTool } from '../../services/toolRegistry';
import './MessageInput.css';
import {
  ArrowUp,
  CheckCircle2,
  Loader2,
  AlertCircle,
  LayoutGrid,
  Mic,
  Paperclip,
  Smile,
  Sliders,
  Square,
  Wand2,
} from 'lucide-react';
import type {
  MessageInputProps,
  AttachmentFile,
  DraftState,
  FormattingAction,
  AISuggestion,
  ToneAnalysis,
} from './types';

const AIComposer = lazy(() => import('./AIComposer'));

const DEFAULT_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB
const DRAFT_DEBOUNCE_MS = 800;
const DRAFT_STORAGE_PREFIX = 'pulse_msg_draft_v1:';
const FORMATTABLE: ReadonlyArray<FormattingAction['type']> = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
];

/** Generate a collision-resistant attachment id; falls back if crypto missing. */
function makeAttachmentId(): string {
  const c = (typeof crypto !== 'undefined' ? crypto : null) as Crypto | null;
  if (c?.randomUUID) return c.randomUUID();
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function classifyAttachment(file: File): AttachmentFile['type'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onTyping,
  placeholder,
  aiEnabled = false,
  voiceEnabled = false,
  maxLength = 2000,
  maxAttachmentBytes = DEFAULT_MAX_ATTACHMENT_BYTES,
  channelId,
  apiKey,
  disabled = false,
  initialValue = '',
  setActiveToolOverlay,
}) => {
  const { t: tr } = useTranslation();
  const placeholderText = placeholder ?? tr('messages.input.placeholder', 'Type your message...');
  const draftStorageKey = useMemo(
    () => (channelId ? `${DRAFT_STORAGE_PREFIX}${channelId}` : null),
    [channelId],
  );

  const initialContent = useMemo(() => {
    if (initialValue) return initialValue;
    if (!draftStorageKey || typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem(draftStorageKey) || '';
    } catch {
      return '';
    }
  }, [draftStorageKey, initialValue]);

  const [content, setContent] = useState(initialContent);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [draftTick, setDraftTick] = useState(0);
  const [draft, setDraft] = useState<DraftState>(() => ({
    text: initialContent,
    lastSaved: new Date(),
    status: initialContent ? 'saved' : 'idle',
  }));

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draftTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Narrow Zustand selectors — avoid re-rendering on unrelated store updates.
  const aiSuggestions = useMessagesStore(
    (s) => (s.smartReplies || []) as unknown as AISuggestion[],
  );
  const toneAnalysis = useMessagesStore(
    (s) => s.draftAnalysis as unknown as ToneAnalysis | null,
  );
  const isGeneratingAI = useMessagesStore((s) => s.isGeneratingReplies);
  const isAnalyzingTone = useMessagesStore((s) => s.isAnalyzingDraft);
  const generateSmartReplies = useMessagesStore((s) => s.generateSmartReplies);
  const analyzeDraft = useMessagesStore((s) => s.analyzeDraft);
  const setStoreDraft = useMessagesStore((s) => s.setDraft);

  // Hydrate the editor with the restored draft on mount.
  useEffect(() => {
    if (initialContent && editorRef.current && !editorRef.current.textContent) {
      editorRef.current.textContent = initialContent;
    }
    // mount-only — restored value never re-applies after the user types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToolLaunch = useCallback(
    (toolId: string) => {
      const overlayType = getToolOverlayType(toolId);
      if (overlayType && setActiveToolOverlay) {
        setActiveToolOverlay(overlayType);
      }
      saveRecentTool(toolId);
      setContent('');
      if (editorRef.current) {
        editorRef.current.textContent = '';
      }
    },
    [setActiveToolOverlay],
  );

  const slashCommands = useSlashCommands(content, editorRef, handleToolLaunch);

  // Persist draft to localStorage (debounced).
  useEffect(() => {
    if (!draftStorageKey || typeof window === 'undefined') return;
    if (content === draft.text) return;

    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
    }

    setDraft((prev) => ({ ...prev, status: 'saving' }));

    draftTimeoutRef.current = setTimeout(() => {
      try {
        if (content) {
          window.localStorage.setItem(draftStorageKey, content);
        } else {
          window.localStorage.removeItem(draftStorageKey);
        }
        setDraft({ text: content, lastSaved: new Date(), status: 'saved' });
      } catch {
        setDraft((prev) => ({ ...prev, status: 'error' }));
      }
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
    };
  }, [content, draft.text, draftStorageKey]);

  // Tick the "saved Ns ago" indicator without depending on keystrokes.
  useEffect(() => {
    if (draft.status !== 'saved') return;
    const id = setInterval(() => setDraftTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, [draft.status]);

  // Typing indicator
  useEffect(() => {
    if (!onTyping) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (content) {
      onTyping(true);
      typingTimeoutRef.current = setTimeout(() => onTyping(false), 1000);
    } else {
      onTyping(false);
    }

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [content, onTyping]);

  // The store actions read `state.draft` and `state.selectedChannelId` internally
  // and accept the API key as their argument — keep the store's draft in sync
  // with the editor so suggestions and tone analysis target the right text.
  useEffect(() => {
    setStoreDraft(content);
  }, [content, setStoreDraft]);

  // AI suggestions — only fire when we have a real API key.
  useEffect(() => {
    if (!aiEnabled || !showAI || !apiKey || content.length < 10) return;
    const timeoutId = setTimeout(() => {
      generateSmartReplies(apiKey);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [content, showAI, aiEnabled, apiKey, generateSmartReplies]);

  // Tone analysis — same gate.
  useEffect(() => {
    if (!aiEnabled || !apiKey || content.length < 5) return;
    const timeoutId = setTimeout(() => analyzeDraft(apiKey), 500);
    return () => clearTimeout(timeoutId);
  }, [content, aiEnabled, apiKey, analyzeDraft]);

  // Sync activeFormats from real selection state instead of toggle guesses.
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = typeof document !== 'undefined' ? document.getSelection() : null;
      if (!sel || !editorRef.current) return;
      if (!editorRef.current.contains(sel.anchorNode)) return;

      const next = new Set<string>();
      for (const cmd of FORMATTABLE) {
        try {
          if (document.queryCommandState(cmd)) next.add(cmd);
        } catch {
          // ignore — execCommand is deprecated and may throw in some browsers.
        }
      }
      setActiveFormats((prev) => {
        if (prev.size === next.size && [...next].every((v) => prev.has(v))) return prev;
        return next;
      });
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // ─── Content + formatting ───
  const handleContentChange = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      const text = e.currentTarget.textContent || '';
      // Track length without mutating the DOM mid-input (mutation resets the cursor).
      setContent(text.length <= maxLength ? text : text.slice(0, maxLength));
    },
    [maxLength],
  );

  // Enforce maxLength at the input boundary so the contenteditable cursor stays intact.
  const handleBeforeInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      const native = e.nativeEvent as InputEvent;
      if (!native || typeof native.data !== 'string' || native.data === '') return;
      const current = e.currentTarget.textContent?.length ?? 0;
      if (current + native.data.length > maxLength) {
        e.preventDefault();
      }
    },
    [maxLength],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      // Always strip rich formatting on paste — keeps the editor a plain-text surface.
      const text = e.clipboardData?.getData('text/plain') ?? '';
      e.preventDefault();
      const current = e.currentTarget.textContent?.length ?? 0;
      const room = Math.max(0, maxLength - current);
      const safe = text.slice(0, room);
      if (safe) {
        document.execCommand('insertText', false, safe);
      }
    },
    [maxLength],
  );

  const applyFormat = useCallback((action: FormattingAction) => {
    if (action.type === 'link') {
      const url = window.prompt(tr('messages.input.linkPrompt', 'Enter URL:'));
      if (!url) return;
      try {
        document.execCommand('createLink', false, url);
      } catch {
        /* no-op */
      }
      return;
    }

    try {
      document.execCommand(action.type, false, undefined);
    } catch {
      /* no-op — browsers may reject deprecated commands */
    }

    // Re-read the actual selection state instead of toggling our cached set.
    try {
      setActiveFormats((prev) => {
        const next = new Set<string>(prev);
        if (FORMATTABLE.includes(action.type as FormattingAction['type'])) {
          if (document.queryCommandState(action.type)) next.add(action.type);
          else next.delete(action.type);
        }
        return next;
      });
    } catch {
      /* no-op */
    }
  }, []);

  const handleSendMessage = useCallback(() => {
    const trimmed = content.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    if (content.length > maxLength) return;

    onSend(trimmed, attachments.length > 0 ? attachments : undefined);

    setContent('');
    if (editorRef.current) {
      editorRef.current.textContent = '';
    }
    setAttachments([]);
    setShowAI(false);
    setActiveFormats(new Set());

    if (draftStorageKey && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        /* no-op */
      }
    }
    setDraft({ text: '', lastSaved: new Date(), status: 'idle' });
  }, [content, attachments, disabled, maxLength, onSend, draftStorageKey]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (slashCommands.state.isActive) {
        const handled = slashCommands.handlers.handleKeyDown(e);
        if (handled) return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (aiEnabled) setShowAI((prev) => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        applyFormat({ type: 'bold' });
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        applyFormat({ type: 'italic' });
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        applyFormat({ type: 'code' });
        return;
      }
    },
    [slashCommands, handleSendMessage, applyFormat, aiEnabled],
  );

  const handleAcceptSuggestion = useCallback((suggestion: AISuggestion) => {
    setContent(suggestion.text);
    if (editorRef.current) {
      editorRef.current.textContent = suggestion.text;
    }
    setShowAI(false);
  }, []);

  // The store does not expose a per-suggestion dismiss action. Closing the AI
  // panel matches the typical "dismiss" semantic; suggestions are regenerated
  // on the next prompt.
  const handleDismissSuggestion = useCallback(() => {
    setShowAI(false);
  }, []);

  // ─── Attachments ───
  const acceptFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      const tooLarge = list.find((f) => f.size > maxAttachmentBytes);
      if (tooLarge) {
        setAttachmentError(
          tr('messages.input.attachmentTooLarge', {
            name: tooLarge.name,
            size: formatBytes(tooLarge.size),
            limit: formatBytes(maxAttachmentBytes),
            defaultValue: '{{name}} is {{size}} — over the {{limit}} limit.',
          }),
        );
        return;
      }
      setAttachmentError(null);

      const next: AttachmentFile[] = list.map((file) => ({
        id: makeAttachmentId(),
        file,
        name: file.name,
        size: file.size,
        type: classifyAttachment(file),
      }));
      setAttachments((prev) => [...prev, ...next]);
    },
    [maxAttachmentBytes],
  );

  const handleAttachmentRemove = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.preview) {
        try {
          URL.revokeObjectURL(removed.preview);
        } catch {
          /* no-op */
        }
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // Free any preview blob URLs on unmount.
  useEffect(() => {
    return () => {
      for (const a of attachments) {
        if (a.preview) {
          try {
            URL.revokeObjectURL(a.preview);
          } catch {
            /* no-op */
          }
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      e.preventDefault();
      acceptFiles(files);
    },
    [acceptFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
    }
  }, []);

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);

  // ─── Derived ───
  const characterCount = content.length;
  const isNearLimit = characterCount > maxLength * 0.9;
  const isOverLimit = characterCount > maxLength;
  const canSend = !disabled && !isOverLimit && (!!content.trim() || attachments.length > 0);

  const draftStatusText = useMemo(() => {
    if (draft.status === 'saving') return tr('messages.input.draftSaving', 'Saving draft...');
    if (draft.status === 'error') return tr('messages.input.draftError', 'Failed to save draft');
    if (draft.status === 'idle') return '';
    const seconds = Math.floor((Date.now() - draft.lastSaved.getTime()) / 1000);
    if (seconds < 5) return tr('messages.input.draftSaved', 'Draft saved');
    const ago = (value: string) =>
      tr('messages.input.draftSavedAgo', { value, defaultValue: 'Saved {{value}} ago' });
    if (seconds < 60) return ago(`${seconds}s`);
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return ago(`${minutes}m`);
    const hours = Math.floor(minutes / 60);
    return ago(`${hours}h`);
    // draftTick is intentionally a dependency so this re-evaluates on the interval.
  }, [draft.status, draft.lastSaved, draftTick, tr]);

  const DraftIcon =
    draft.status === 'saving' ? Loader2 : draft.status === 'error' ? AlertCircle : CheckCircle2;

  return (
    <div className="message-input-wrapper">
      {/* AI Suggestions Overlay */}
      <AnimatePresence>
        {showAI && aiEnabled && aiSuggestions.length > 0 && (
          <Suspense
            fallback={<div className="ai-loading">{tr('messages.input.aiLoading', 'Loading AI...')}</div>}
          >
            <AIComposer
              suggestions={aiSuggestions}
              isLoading={isGeneratingAI}
              onAcceptSuggestion={handleAcceptSuggestion}
              onDismissSuggestion={handleDismissSuggestion}
              onClose={() => setShowAI(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <div
        className={`message-input-container ${showAI ? 'ai-active' : ''} ${disabled ? 'is-disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <AnimatePresence>
          {slashCommands.state.isActive && (
            <SlashCommandDropdown
              matches={slashCommands.state.matches}
              selectedIndex={slashCommands.state.selectedIndex}
              query={slashCommands.state.query}
              onSelect={slashCommands.handlers.handleSelect}
              onClose={slashCommands.handlers.handleDismiss}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showToolsMenu && (
            <InlineToolsMenu
              onClose={() => setShowToolsMenu(false)}
              setActiveToolOverlay={setActiveToolOverlay}
            />
          )}
        </AnimatePresence>

        {/* Mode toggle */}
        <div className="message-input-mode-row">
          <button
            type="button"
            onClick={() => setAdvancedMode((v) => !v)}
            className="mode-toggle-button"
            aria-pressed={advancedMode}
            title={
              advancedMode
                ? tr('messages.input.modeSwitchToSimple', 'Switch to simple mode')
                : tr('messages.input.modeSwitchToAdvanced', 'Switch to advanced mode')
            }
          >
            <Sliders size={11} aria-hidden="true" />
            <span>
              {advancedMode
                ? tr('messages.input.modeAdvanced', 'Advanced Mode')
                : tr('messages.input.modeSimple', 'Simple Mode')}
            </span>
          </button>
          {advancedMode && draft.status === 'saved' && draftStatusText && (
            <span className="mode-row-draft-hint">{draftStatusText}</span>
          )}
        </div>

        {advancedMode && (
          <FormattingToolbar
            onFormat={applyFormat}
            activeFormats={activeFormats}
            onEmojiClick={() => {
              /* delegated to host; intentional no-op here */
            }}
            onAttachmentClick={openFilePicker}
            onAIAssist={() => setShowAI((v) => !v)}
            aiEnabled={aiEnabled}
          />
        )}

        {advancedMode && aiEnabled && toneAnalysis && (
          <ToneAnalyzer analysis={toneAnalysis} isAnalyzing={isAnalyzingTone} />
        )}

        <div
          ref={editorRef}
          className="message-input-area"
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleContentChange}
          onBeforeInput={handleBeforeInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          data-placeholder={placeholderText}
          role="textbox"
          aria-multiline="true"
          aria-label={tr('messages.input.ariaLabel', 'Message text')}
          aria-describedby="character-counter draft-indicator"
          aria-disabled={disabled || undefined}
          spellCheck
        />

        {attachments.length > 0 && (
          <AttachmentPreview attachments={attachments} onRemove={handleAttachmentRemove} />
        )}

        {attachmentError && (
          <div className="attachment-error" role="alert">
            <AlertCircle size={12} aria-hidden="true" />
            <span>{attachmentError}</span>
            <button
              type="button"
              className="attachment-error-dismiss"
              onClick={() => setAttachmentError(null)}
              aria-label={tr('messages.input.attachmentDismiss', 'Dismiss')}
            >
              ×
            </button>
          </div>
        )}

        {content && (draft.status === 'saving' || draft.status === 'saved' || draft.status === 'error') && (
          <div
            id="draft-indicator"
            className={`draft-indicator ${draft.status}`}
            role="status"
            aria-live="polite"
          >
            <DraftIcon size={12} className="draft-icon" aria-hidden="true" />
            <span className="draft-timestamp">{draftStatusText}</span>
          </div>
        )}

        <div
          id="character-counter"
          className={`character-counter ${isNearLimit ? 'warning' : ''} ${isOverLimit ? 'error' : ''}`}
          role="status"
          aria-live="polite"
        >
          {characterCount} / {maxLength}
        </div>

        <div className="message-action-bar">
          <div className="action-bar-left">
            {!advancedMode && (
              <>
                <button
                  type="button"
                  className="simple-action-button"
                  onClick={openFilePicker}
                  aria-label={tr('messages.input.attach', 'Attach file')}
                  title={tr('messages.input.attach', 'Attach file')}
                  disabled={disabled}
                >
                  <Paperclip size={16} />
                </button>
                <button
                  type="button"
                  className="simple-action-button"
                  onClick={() => {
                    /* host wires emoji picker via setActiveToolOverlay */
                  }}
                  aria-label={tr('messages.input.emoji', 'Add emoji')}
                  title={tr('messages.input.emoji', 'Add emoji')}
                  disabled={disabled}
                >
                  <Smile size={16} />
                </button>
                {voiceEnabled && (
                  <button
                    type="button"
                    className={`simple-action-button ${isRecording ? 'recording' : ''}`}
                    onClick={() => setIsRecording((v) => !v)}
                    aria-label={
                      isRecording
                        ? tr('messages.input.voiceStop', 'Stop recording')
                        : tr('messages.input.voiceStart', 'Start voice input')
                    }
                    aria-pressed={isRecording}
                    disabled={disabled}
                  >
                    {isRecording ? <Square size={16} /> : <Mic size={16} />}
                  </button>
                )}
              </>
            )}

            {advancedMode && (
              <>
                {voiceEnabled && (
                  <button
                    type="button"
                    className={`voice-input-button ${isRecording ? 'recording' : ''}`}
                    onClick={() => setIsRecording((v) => !v)}
                    aria-label={
                      isRecording
                        ? tr('messages.input.voiceStop', 'Stop recording')
                        : tr('messages.input.voiceStart', 'Start voice input')
                    }
                    aria-pressed={isRecording}
                    disabled={disabled}
                  >
                    {isRecording ? <Square size={16} /> : <Mic size={16} />}
                  </button>
                )}

                {aiEnabled && (
                  <button
                    type="button"
                    className={`ai-toggle-button ${showAI ? 'active' : ''}`}
                    onClick={() => setShowAI((v) => !v)}
                    aria-label={tr('messages.input.aiToggle', 'Toggle AI suggestions')}
                    aria-pressed={showAI}
                    disabled={disabled}
                  >
                    <Wand2 className="ai-toggle-icon" size={16} />
                    <span className="ai-toggle-label">{tr('messages.input.ai', 'AI')}</span>
                  </button>
                )}

                <button
                  type="button"
                  ref={toolsButtonRef}
                  className={`tools-menu-button ${showToolsMenu ? 'active' : ''}`}
                  onClick={() => setShowToolsMenu((v) => !v)}
                  aria-label={tr('messages.input.toolsOpen', 'Open tools menu')}
                  aria-pressed={showToolsMenu}
                  disabled={disabled}
                >
                  <LayoutGrid size={14} />
                  <span className="tools-menu-label">{tr('messages.input.tools', 'Tools')}</span>
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className="send-button"
            onClick={handleSendMessage}
            disabled={!canSend}
            aria-label={tr('messages.input.send', 'Send message')}
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => {
          if (e.target.files) acceptFiles(e.target.files);
          // Allow re-selecting the same file twice in a row.
          e.target.value = '';
        }}
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
};

export default MessageInput;
