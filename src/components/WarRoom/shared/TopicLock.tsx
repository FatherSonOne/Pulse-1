import React, { useState, useCallback, useEffect, useRef } from 'react';

import { AlertTriangle, Check, Crosshair, Info, Pen, X } from 'lucide-react';

// ============================================
// Topic matching utilities
// ============================================

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'this', 'that', 'these',
  'those', 'it', 'its', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'by', 'from', 'as', 'into', 'about', 'between', 'through', 'during',
  'before', 'after', 'above', 'below', 'and', 'or', 'but', 'not', 'no',
  'nor', 'so', 'if', 'then', 'than', 'very', 'just', 'also', 'only',
  'both', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other',
  'some', 'such', 'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
]);

/** Strip common English suffixes for rough stemming */
function stemWord(word: string): string {
  // Order matters: check longer suffixes first
  const suffixes = ['tion', 'ment', 'ness', 'ing', 'est', 'ed', 'er', 'ly', 's'];
  for (const suffix of suffixes) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

/** Extract meaningful keywords: lowercase, remove stopwords, stem */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 0 && !STOPWORDS.has(w))
    .map(stemWord);
}

export interface TopicRelevance {
  isOnTopic: boolean;
  score: number; // 0-1 fraction of topic keywords found in message
  matchedKeywords: string[];
  totalKeywords: number;
}

/** Check how relevant a message is to a topic. Returns relevance details. */
function computeRelevance(message: string, topicText: string): TopicRelevance {
  const topicKeywords = extractKeywords(topicText);
  if (topicKeywords.length === 0) {
    return { isOnTopic: true, score: 1, matchedKeywords: [], totalKeywords: 0 };
  }

  const messageKeywords = extractKeywords(message);
  const matched = topicKeywords.filter(tk =>
    messageKeywords.some(mk => mk.includes(tk) || tk.includes(mk))
  );

  const score = matched.length / topicKeywords.length;

  return {
    isOnTopic: matched.length > 0,
    score,
    matchedKeywords: matched,
    totalKeywords: topicKeywords.length,
  };
}

// Module-level checker reference (replaces window.__checkTopicLock)
let _topicLockChecker: ((message: string) => TopicRelevance) | null = null;

interface TopicLockProps {
  topic: string;
  isLocked: boolean;
  onTopicChange: (topic: string) => void;
  onLockChange: (locked: boolean) => void;
  onOffTopicAttempt?: (message: string, topic: string) => void;
  className?: string;
  compact?: boolean;
}

export const TopicLock: React.FC<TopicLockProps> = ({
  topic,
  isLocked,
  onTopicChange,
  onLockChange,
  onOffTopicAttempt,
  className = '',
  compact = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(topic);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    setEditValue(topic);
  }, [topic]);

  const handleSave = () => {
    if (editValue.trim()) {
      onTopicChange(editValue.trim());
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(topic);
      setIsEditing(false);
    }
  };

  const toggleLock = () => {
    if (!topic.trim()) {
      setIsEditing(true);
      return;
    }
    onLockChange(!isLocked);
  };

  // Function to check if a message is on-topic (with relevance scoring)
  const checkOnTopic = useCallback((message: string): TopicRelevance => {
    if (!isLocked || !topic) {
      return { isOnTopic: true, score: 1, matchedKeywords: [], totalKeywords: 0 };
    }
    return computeRelevance(message, topic);
  }, [isLocked, topic]);

  // Store the checker in a ref so the hook can access it without globals
  const checkerRef = useRef<(message: string) => TopicRelevance>(checkOnTopic);
  const onOffTopicRef = useRef(onOffTopicAttempt);
  const showWarningRef = useRef(setShowWarning);

  useEffect(() => {
    checkerRef.current = checkOnTopic;
    onOffTopicRef.current = onOffTopicAttempt;
    showWarningRef.current = setShowWarning;
  }, [checkOnTopic, onOffTopicAttempt]);

  // Publish checker via a stable module-level ref (no window global)
  useEffect(() => {
    _topicLockChecker = (message: string): TopicRelevance => {
      const result = checkerRef.current(message);
      if (!result.isOnTopic) {
        showWarningRef.current(true);
        setTimeout(() => showWarningRef.current(false), 3000);
        onOffTopicRef.current?.(message, topic);
      }
      return result;
    };
    return () => {
      _topicLockChecker = null;
    };
  }, [topic]);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder="Enter focus topic..."
            className="war-room-input text-sm py-1 px-2 w-40"
            autoFocus
          />
        ) : (
          <>
            {topic && (
              <button
                onClick={() => !isLocked && setIsEditing(true)}
                className={`text-sm truncate max-w-[150px] ${
                  isLocked ? 'war-room-text-primary font-medium' : 'war-room-text-secondary hover:underline'
                }`}
                disabled={isLocked}
              >
                {topic}
              </button>
            )}

            <button
              onClick={toggleLock}
              className={`war-room-btn war-room-btn-icon-sm ${
                isLocked ? 'bg-rose-500/20 text-rose-400' : ''
              }`}
              title={isLocked ? 'Unlock topic' : 'Lock topic'}
            >
              <i className={`fa ${isLocked ? 'fa-lock' : 'fa-lock-open'} text-xs`}></i>
            </button>
          </>
        )}

        {showWarning && (
          <span className="text-xs text-amber-400 animate-pulse">
            Off-topic!
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`war-room-panel p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold war-room-text-primary flex items-center gap-2">
          <Crosshair className="fa" />
          Focus Topic
        </h3>

        <button
          onClick={toggleLock}
          className={`war-room-btn px-3 py-1 text-xs ${
            isLocked
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              : 'hover:bg-white/5'
          }`}
        >
          <i className={`fa ${isLocked ? 'fa-lock' : 'fa-lock-open'} mr-1`}></i>
          {isLocked ? 'Locked' : 'Unlocked'}
        </button>
      </div>

      {isEditing ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What are you focusing on?"
            className="war-room-input flex-1 text-sm"
            autoFocus
          />
          <button
            onClick={handleSave}
            className="war-room-btn war-room-btn-primary war-room-btn-icon-sm"
            aria-label="Save topic"
          >
            <Check className="fa" />
          </button>
          <button
            onClick={() => {
              setEditValue(topic);
              setIsEditing(false);
            }}
            className="war-room-btn war-room-btn-icon-sm"
            aria-label="Cancel editing"
          >
            <X className="fa" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => !isLocked && setIsEditing(true)}
          className={`p-3 rounded-lg ${
            isLocked
              ? 'bg-rose-500/10 border border-rose-500/30'
              : 'war-room-panel-inset cursor-pointer hover:bg-white/5'
          }`}
        >
          {topic ? (
            <div className="flex items-center justify-between">
              <span className={`${isLocked ? 'text-rose-300 font-medium' : 'war-room-text-primary'}`}>
                {topic}
              </span>
              {!isLocked && (
                <Pen className="fa text-xs war-room-text-secondary" />
              )}
            </div>
          ) : (
            <span className="war-room-text-secondary text-sm">
              Click to set a focus topic...
            </span>
          )}
        </div>
      )}

      {/* Warning Overlay */}
      {showWarning && (
        <div className="mt-3 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg animate-pulse">
          <div className="flex items-center gap-2 text-amber-300 text-sm">
            <AlertTriangle className="fa" />
            <span>That seems off-topic. Stay focused on: <strong>{topic}</strong></span>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="mt-3 text-xs war-room-text-secondary">
          <Info className="fa mr-1" />
          Topic is locked. AI will gently redirect off-topic conversations.
        </div>
      )}
    </div>
  );
};

// Hook for components to check topic compliance
export const useTopicLock = () => {
  const checkMessage = useCallback((message: string): boolean => {
    if (!_topicLockChecker) return true;
    return _topicLockChecker(message).isOnTopic;
  }, []);

  const checkRelevance = useCallback((message: string): TopicRelevance => {
    if (!_topicLockChecker) {
      return { isOnTopic: true, score: 1, matchedKeywords: [], totalKeywords: 0 };
    }
    return _topicLockChecker(message);
  }, []);

  return { checkMessage, checkRelevance };
};
