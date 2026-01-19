import React, { useState, useCallback, useEffect } from 'react';

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

  // Function to check if a message is on-topic
  const checkOnTopic = useCallback((message: string): boolean => {
    if (!isLocked || !topic) return true;

    const topicWords = topic.toLowerCase().split(/\s+/);
    const messageWords = message.toLowerCase().split(/\s+/);

    // Check for topic keywords in message
    const hasTopicKeyword = topicWords.some(tw =>
      messageWords.some(mw => mw.includes(tw) || tw.includes(mw))
    );

    return hasTopicKeyword;
  }, [isLocked, topic]);

  // Expose check function via window for other components to use
  useEffect(() => {
    (window as any).__checkTopicLock = (message: string): boolean => {
      if (!isLocked || !topic) return true;

      const isOnTopic = checkOnTopic(message);

      if (!isOnTopic) {
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 3000);
        onOffTopicAttempt?.(message, topic);
      }

      return isOnTopic;
    };

    return () => {
      delete (window as any).__checkTopicLock;
    };
  }, [isLocked, topic, checkOnTopic, onOffTopicAttempt]);

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
          <i className="fa fa-crosshairs"></i>
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
          >
            <i className="fa fa-check"></i>
          </button>
          <button
            onClick={() => {
              setEditValue(topic);
              setIsEditing(false);
            }}
            className="war-room-btn war-room-btn-icon-sm"
          >
            <i className="fa fa-times"></i>
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
                <i className="fa fa-pen text-xs war-room-text-secondary"></i>
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
            <i className="fa fa-triangle-exclamation"></i>
            <span>That seems off-topic. Stay focused on: <strong>{topic}</strong></span>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="mt-3 text-xs war-room-text-secondary">
          <i className="fa fa-info-circle mr-1"></i>
          Topic is locked. AI will gently redirect off-topic conversations.
        </div>
      )}
    </div>
  );
};

// Hook for components to check topic compliance
export const useTopicLock = () => {
  const checkMessage = useCallback((message: string): boolean => {
    const checker = (window as any).__checkTopicLock;
    return checker ? checker(message) : true;
  }, []);

  return { checkMessage };
};
