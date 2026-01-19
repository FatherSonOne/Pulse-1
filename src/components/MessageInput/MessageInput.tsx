// MessageInput.tsx - AI-Augmented Message Input Component
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMessagesStore } from '../../store/messageStore';

interface MessageInputProps {
  onSend: (text: string, attachments?: File[]) => void;
  onTyping?: (isTyping: boolean) => void;
  placeholder?: string;
  aiEnabled?: boolean;
  voiceEnabled?: boolean;
  maxLength?: number;
  channelId?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onTyping,
  placeholder = 'Type a message...',
  aiEnabled = true,
  voiceEnabled = true,
  maxLength = 2000,
  channelId
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showToolbar, setShowToolbar] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    draft,
    smartReplies,
    draftAnalysis,
    isAnalyzingDraft,
    isGeneratingReplies,
    setDraft,
    analyzeDraft,
    generateSmartReplies
  } = useMessagesStore();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // Debounced AI analysis
  useEffect(() => {
    if (!aiEnabled || !inputValue || inputValue.length < 10) return;

    const timer = setTimeout(() => {
      const apiKey = localStorage.getItem('gemini_api_key');
      if (apiKey && channelId) {
        analyzeDraft(apiKey);
        generateSmartReplies(apiKey, channelId);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, aiEnabled, channelId, analyzeDraft, generateSmartReplies]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setInputValue(value);
      setDraft(value);
      onTyping?.(value.length > 0);
    }
  }, [maxLength, setDraft, onTyping]);

  // Handle send
  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    onSend(trimmed, []);
    setInputValue('');
    setDraft('');
    onTyping?.(false);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, onSend, setDraft, onTyping]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    if (e.key === 'Escape') {
      setShowToolbar(false);
    }

    // Cmd/Ctrl + B for bold
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      setShowToolbar(prev => !prev);
    }
  }, [handleSend]);

  // AI active indicator
  const aiActive = aiEnabled && (isAnalyzingDraft || isGeneratingReplies || smartReplies.length > 0);

  // Character count color
  const charCountColor = inputValue.length > maxLength * 0.9 ? 'text-red-500' :
                        inputValue.length > maxLength * 0.7 ? 'text-yellow-500' :
                        'text-zinc-500';

  return (
    <div className="relative w-full">
      {/* AI Suggestions Overlay */}
      <AnimatePresence>
        {aiActive && smartReplies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-0 right-0 mb-2 z-50"
          >
            <div className="bg-zinc-900 border border-purple-500/30 rounded-xl p-3 shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <i className="fa-solid fa-wand-sparkles text-purple-400 text-xs" />
                </div>
                <span className="text-xs font-medium text-purple-300">AI Suggests</span>
              </div>
              <div className="space-y-2">
                {smartReplies.slice(0, 3).map((reply, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setInputValue(reply.text);
                      setDraft(reply.text);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition text-sm text-zinc-300 border border-transparent hover:border-purple-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex-1">{reply.text}</span>
                      {reply.confidence && (
                        <span className={`text-xs ml-2 ${
                          reply.confidence > 0.8 ? 'text-green-400' :
                          reply.confidence > 0.5 ? 'text-yellow-400' :
                          'text-zinc-500'
                        }`}>
                          {Math.round(reply.confidence * 100)}%
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Container */}
      <div className={`
        relative rounded-xl border transition-all duration-200
        ${aiActive ? 'border-purple-500 shadow-[0_0_20px_rgba(139,92,246,0.2)]' : 'border-zinc-700'}
        ${isFocused ? 'bg-zinc-800' : 'bg-zinc-900'}
      `}>
        {/* AI Processing Indicator */}
        {aiActive && (
          <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden rounded-t-xl">
            <motion.div
              className="h-full bg-gradient-to-r from-transparent via-purple-500 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-transparent text-white placeholder-zinc-500
                   focus:outline-none resize-none text-sm transition"
          style={{ minHeight: '44px', maxHeight: '120px' }}
          rows={1}
        />

        {/* Toolbar */}
        <AnimatePresence>
          {showToolbar && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-zinc-700 px-4 py-2"
            >
              <div className="flex items-center gap-2">
                <button className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white">
                  <i className="fa-solid fa-bold text-xs" />
                </button>
                <button className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white">
                  <i className="fa-solid fa-italic text-xs" />
                </button>
                <button className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white">
                  <i className="fa-solid fa-code text-xs" />
                </button>
                <button className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white">
                  <i className="fa-solid fa-link text-xs" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-700">
          {/* Left Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowToolbar(prev => !prev)}
              className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
              title="Formatting (Ctrl+B)"
            >
              <i className="fa-solid fa-text text-xs" />
            </button>

            <button className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition">
              <i className="fa-solid fa-paperclip text-xs" />
            </button>

            <button className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition">
              <i className="fa-solid fa-face-smile text-xs" />
            </button>

            {voiceEnabled && (
              <button className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition">
                <i className="fa-solid fa-microphone text-xs" />
              </button>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Character Count */}
            <span className={`text-xs ${charCountColor}`}>
              {inputValue.length}/{maxLength}
            </span>

            {/* AI Badge */}
            {aiActive && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-[10px] text-purple-400">AI</span>
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className={`
                px-4 py-1.5 rounded-lg font-medium text-sm transition
                ${inputValue.trim()
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'}
              `}
            >
              <i className="fa-solid fa-paper-plane text-xs" />
            </button>
          </div>
        </div>
      </div>

      {/* Tone Analysis (if available) */}
      {draftAnalysis && (
        <div className="mt-2 text-xs text-zinc-500">
          Tone: {draftAnalysis.tone || 'Neutral'}
        </div>
      )}
    </div>
  );
};
