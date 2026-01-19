// src/components/MessageInput/MessageInput.tsx
// AI-Augmented Message Input Component

import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMessageStore } from '../../store/messageStore';
import FormattingToolbar from './FormattingToolbar';
import ToneAnalyzer from './ToneAnalyzer';
import AttachmentPreview from './AttachmentPreview';
import './MessageInput.css';
import type {
  MessageInputProps,
  AttachmentFile,
  DraftState,
  FormattingAction,
  AISuggestion,
  ToneAnalysis,
} from './types';

// Lazy load AI components for better performance
const AIComposer = lazy(() => import('./AIComposer'));

const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onTyping,
  placeholder = 'Type your message...',
  aiEnabled = false,
  voiceEnabled = false,
  maxLength = 2000,
  channelId,
  disabled = false,
  initialValue = '',
}) => {
  // State
  const [content, setContent] = useState(initialValue);
  const [showAI, setShowAI] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<DraftState>({
    text: '',
    lastSaved: new Date(),
    status: 'saved',
  });

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const draftTimeoutRef = useRef<NodeJS.Timeout>();

  // Store
  const messageStore = useMessageStore();
  const aiSuggestions = (messageStore.smartReplies || []) as unknown as AISuggestion[];
  const toneAnalysis = messageStore.draftAnalysis as unknown as ToneAnalysis | null;
  const isGeneratingAI = messageStore.isGeneratingReplies;
  const isAnalyzingTone = messageStore.isAnalyzingDraft;

  // Auto-save draft
  useEffect(() => {
    if (!content || content === draft.text) return;

    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
    }

    setDraft((prev) => ({ ...prev, status: 'saving' }));

    draftTimeoutRef.current = setTimeout(() => {
      // Save draft logic here
      setDraft({
        text: content,
        lastSaved: new Date(),
        status: 'saved',
      });
    }, 1000);

    return () => {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
    };
  }, [content, draft.text]);

  // Typing indicator
  useEffect(() => {
    if (!onTyping) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (content) {
      onTyping(true);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 1000);
    } else {
      onTyping(false);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [content, onTyping]);

  // AI suggestions
  useEffect(() => {
    if (!aiEnabled || !showAI || content.length < 10) return;

    const timeoutId = setTimeout(() => {
      messageStore.generateSmartReplies(channelId || '', content);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [content, showAI, aiEnabled, channelId, messageStore]);

  // Tone analysis
  useEffect(() => {
    if (!aiEnabled || content.length < 5) return;

    const timeoutId = setTimeout(() => {
      messageStore.analyzeDraft(content);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [content, aiEnabled, messageStore]);

  // Handle content change
  const handleContentChange = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.textContent || '';
    if (text.length <= maxLength) {
      setContent(text);
    } else {
      // Truncate and update
      const truncated = text.slice(0, maxLength);
      e.currentTarget.textContent = truncated;
      setContent(truncated);
    }
  }, [maxLength]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Send message on Cmd/Ctrl + Enter
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage();
        return;
      }

      // Toggle AI on Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowAI((prev) => !prev);
        return;
      }

      // Bold on Cmd/Ctrl + B
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        applyFormat({ type: 'bold' });
        return;
      }

      // Italic on Cmd/Ctrl + I
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        applyFormat({ type: 'italic' });
        return;
      }

      // Code on Cmd/Ctrl + E
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        applyFormat({ type: 'code' });
        return;
      }
    },
    [content]
  );

  // Format text
  const applyFormat = useCallback((action: FormattingAction) => {
    document.execCommand(action.type, false, undefined);
    setActiveFormats((prev) => {
      const newFormats = new Set(prev);
      if (newFormats.has(action.type)) {
        newFormats.delete(action.type);
      } else {
        newFormats.add(action.type);
      }
      return newFormats;
    });
  }, []);

  // Send message
  const handleSendMessage = useCallback(() => {
    if (!content.trim() || disabled) return;

    onSend(content);
    setContent('');
    if (editorRef.current) {
      editorRef.current.textContent = '';
    }
    setAttachments([]);
    setShowAI(false);
  }, [content, disabled, onSend]);

  // Accept AI suggestion
  const handleAcceptSuggestion = useCallback((suggestion: AISuggestion) => {
    setContent(suggestion.text);
    if (editorRef.current) {
      editorRef.current.textContent = suggestion.text;
    }
    setShowAI(false);
  }, []);

  // Dismiss AI suggestion
  const handleDismissSuggestion = useCallback((suggestionId: string) => {
    // Logic to remove specific suggestion
    messageStore.clearSmartReplies();
  }, [messageStore]);

  // Add attachment
  const handleAttachmentAdd = useCallback((files: FileList) => {
    const newAttachments: AttachmentFile[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
        ? 'audio'
        : 'document',
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  // Remove attachment
  const handleAttachmentRemove = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Character count
  const characterCount = content.length;
  const isNearLimit = characterCount > maxLength * 0.9;
  const isOverLimit = characterCount > maxLength;

  // Draft status text
  const getDraftStatusText = () => {
    if (draft.status === 'saving') return 'Saving draft...';
    if (draft.status === 'saved') {
      const seconds = Math.floor((Date.now() - draft.lastSaved.getTime()) / 1000);
      if (seconds < 5) return 'Draft saved';
      if (seconds < 60) return `Saved ${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      return `Saved ${minutes}m ago`;
    }
    if (draft.status === 'error') return 'Failed to save';
    return '';
  };

  return (
    <div className="message-input-wrapper">
      {/* AI Suggestions Overlay */}
      <AnimatePresence>
        {showAI && aiEnabled && aiSuggestions.length > 0 && (
          <Suspense fallback={<div className="ai-loading">Loading AI...</div>}>
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

      <div className={`message-input-container ${showAI ? 'ai-active' : ''}`}>
        {/* Formatting Toolbar */}
        <FormattingToolbar
          onFormat={applyFormat}
          activeFormats={activeFormats}
          onEmojiClick={() => {}}
          onAttachmentClick={() => document.getElementById('file-input')?.click()}
          onAIAssist={() => setShowAI(!showAI)}
          aiEnabled={aiEnabled}
        />

        {/* Tone Analyzer Badge */}
        {aiEnabled && toneAnalysis && (
          <ToneAnalyzer analysis={toneAnalysis} isAnalyzing={isAnalyzingTone} />
        )}

        {/* Text Input Area */}
        <div
          ref={editorRef}
          className="message-input-area"
          contentEditable={!disabled}
          onInput={handleContentChange}
          onKeyDown={handleKeyDown}
          data-placeholder={placeholder}
          role="textbox"
          aria-multiline="true"
          aria-label="Message text"
          aria-describedby="character-counter draft-indicator"
        />

        {/* Attachment Preview */}
        {attachments.length > 0 && (
          <AttachmentPreview attachments={attachments} onRemove={handleAttachmentRemove} />
        )}

        {/* Draft Indicator */}
        {content && (
          <div
            id="draft-indicator"
            className={`draft-indicator ${draft.status}`}
            role="status"
            aria-live="polite"
          >
            <span className="draft-icon">
              {draft.status === 'saving' ? '⏳' : draft.status === 'saved' ? '✓' : '⚠'}
            </span>
            <span className="draft-timestamp">{getDraftStatusText()}</span>
          </div>
        )}

        {/* Character Counter */}
        <div
          id="character-counter"
          className={`character-counter ${isNearLimit ? 'warning' : ''} ${isOverLimit ? 'error' : ''}`}
          role="status"
          aria-live="polite"
        >
          {characterCount} / {maxLength}
        </div>

        {/* Action Bar */}
        <div className="message-action-bar">
          <div className="action-bar-left">
            {voiceEnabled && (
              <button
                className={`voice-input-button ${isRecording ? 'recording' : ''}`}
                onClick={() => setIsRecording(!isRecording)}
                aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                aria-pressed={isRecording}
              >
                <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'}`} />
              </button>
            )}

            {aiEnabled && (
              <button
                className={`ai-toggle-button ${showAI ? 'active' : ''}`}
                onClick={() => setShowAI(!showAI)}
                aria-label="Toggle AI suggestions"
                aria-pressed={showAI}
              >
                <i className="fa-solid fa-wand-magic-sparkles ai-toggle-icon" />
                <span className="ai-toggle-label">AI</span>
              </button>
            )}
          </div>

          <button
            className="send-button"
            onClick={handleSendMessage}
            disabled={!content.trim() || disabled || isOverLimit}
            aria-label="Send message"
          >
            <i className="fa-solid fa-arrow-up" />
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        id="file-input"
        multiple
        onChange={(e) => e.target.files && handleAttachmentAdd(e.target.files)}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default MessageInput;
