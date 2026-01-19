// Live Collaborators Component - Typing indicators, presence, and activity
import React, { useState, useEffect, useMemo } from 'react';
import type { LiveCollaborator } from '../../types/messageEnhancements';

interface LiveCollaboratorsProps {
  collaborators: LiveCollaborator[];
  currentUserId?: string;
  compact?: boolean;
}

// Typing indicator dots animation
const TypingDots: React.FC<{ color?: string }> = ({ color = 'bg-zinc-400' }) => {
  return (
    <div className="flex items-center gap-0.5">
      <span className={`w-1.5 h-1.5 rounded-full ${color} animate-bounce`} style={{ animationDelay: '0ms' }} />
      <span className={`w-1.5 h-1.5 rounded-full ${color} animate-bounce`} style={{ animationDelay: '150ms' }} />
      <span className={`w-1.5 h-1.5 rounded-full ${color} animate-bounce`} style={{ animationDelay: '300ms' }} />
    </div>
  );
};

// Avatar with activity indicator
const CollaboratorAvatar: React.FC<{
  collaborator: LiveCollaborator;
  size?: 'sm' | 'md' | 'lg';
}> = ({ collaborator, size = 'sm' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm'
  };

  const activityColors = {
    typing: 'ring-2 ring-blue-500 ring-offset-1',
    reading: 'ring-2 ring-emerald-500 ring-offset-1',
    mentioned: 'ring-2 ring-amber-500 ring-offset-1 animate-pulse'
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${collaborator.avatarColor || 'bg-blue-500'}
        ${activityColors[collaborator.activity]}
        rounded-full flex items-center justify-center text-white font-medium
        transition-all duration-300
      `}
      title={`${collaborator.userName} is ${collaborator.activity}`}
    >
      {collaborator.userName.charAt(0).toUpperCase()}
    </div>
  );
};

// Single typing indicator bubble
const TypingBubble: React.FC<{
  collaborator: LiveCollaborator;
}> = ({ collaborator }) => {
  return (
    <div className="flex items-center gap-2 animate-fade-in">
      <CollaboratorAvatar collaborator={collaborator} size="sm" />
      <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm border border-zinc-200 dark:border-zinc-700">
        <TypingDots color="bg-zinc-500 dark:bg-zinc-400" />
      </div>
    </div>
  );
};

// Grouped typing indicator
const GroupedTypingIndicator: React.FC<{
  collaborators: LiveCollaborator[];
}> = ({ collaborators }) => {
  const typingUsers = collaborators.filter(c => c.activity === 'typing');

  if (typingUsers.length === 0) return null;

  const getText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].userName} is typing`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing`;
    } else {
      return `${typingUsers[0].userName} and ${typingUsers.length - 1} others are typing`;
    }
  };

  return (
    <div className="flex items-center gap-3 py-2 animate-slide-up">
      {/* Stacked avatars */}
      <div className="flex -space-x-2">
        {typingUsers.slice(0, 3).map((collab, idx) => (
          <div
            key={collab.userId}
            className="relative"
            style={{ zIndex: typingUsers.length - idx }}
          >
            <CollaboratorAvatar collaborator={collab} size="sm" />
          </div>
        ))}
        {typingUsers.length > 3 && (
          <div className="w-6 h-6 rounded-full bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center text-[10px] text-zinc-600 dark:text-zinc-300 font-medium">
            +{typingUsers.length - 3}
          </div>
        )}
      </div>

      {/* Typing text with dots */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{getText()}</span>
        <TypingDots />
      </div>
    </div>
  );
};

// Live presence strip (shows who's viewing the conversation)
const PresenceStrip: React.FC<{
  collaborators: LiveCollaborator[];
  maxVisible?: number;
}> = ({ collaborators, maxVisible = 5 }) => {
  const activeCollaborators = collaborators.filter(c =>
    c.activity === 'reading' || c.activity === 'mentioned'
  );

  if (activeCollaborators.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-full border border-zinc-200 dark:border-zinc-700">
      <div className="flex -space-x-1.5">
        {activeCollaborators.slice(0, maxVisible).map((collab, idx) => (
          <CollaboratorAvatar
            key={collab.userId}
            collaborator={collab}
            size="sm"
          />
        ))}
        {activeCollaborators.length > maxVisible && (
          <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-600 dark:text-zinc-400 font-medium border-2 border-white dark:border-zinc-900">
            +{activeCollaborators.length - maxVisible}
          </div>
        )}
      </div>
      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
        {activeCollaborators.length === 1
          ? 'viewing'
          : `${activeCollaborators.length} viewing`
        }
      </span>
    </div>
  );
};

// Activity indicator for thread list
export const ThreadActivityIndicator: React.FC<{
  collaborators: LiveCollaborator[];
}> = ({ collaborators }) => {
  const typingCount = collaborators.filter(c => c.activity === 'typing').length;
  const readingCount = collaborators.filter(c => c.activity === 'reading').length;

  if (typingCount === 0 && readingCount === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {typingCount > 0 && (
        <div className="flex items-center gap-1 text-blue-500">
          <TypingDots color="bg-blue-500" />
          {typingCount > 1 && (
            <span className="text-[10px] font-medium">{typingCount}</span>
          )}
        </div>
      )}
      {readingCount > 0 && (
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title={`${readingCount} viewing`} />
      )}
    </div>
  );
};

// Main Component
export const LiveCollaborators: React.FC<LiveCollaboratorsProps> = ({
  collaborators,
  currentUserId,
  compact = false
}) => {
  // Filter out current user
  const otherCollaborators = useMemo(() =>
    collaborators.filter(c => c.userId !== currentUserId),
    [collaborators, currentUserId]
  );

  const typingCollaborators = useMemo(() =>
    otherCollaborators.filter(c => c.activity === 'typing'),
    [otherCollaborators]
  );

  const activeCollaborators = useMemo(() =>
    otherCollaborators.filter(c => c.activity !== 'typing'),
    [otherCollaborators]
  );

  if (otherCollaborators.length === 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {typingCollaborators.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <TypingDots color="bg-zinc-400" />
          </div>
        )}
        <PresenceStrip collaborators={activeCollaborators} maxVisible={3} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Presence strip at top */}
      {activeCollaborators.length > 0 && (
        <div className="flex justify-start">
          <PresenceStrip collaborators={activeCollaborators} />
        </div>
      )}

      {/* Typing indicators */}
      {typingCollaborators.length > 0 && (
        typingCollaborators.length === 1 ? (
          <TypingBubble collaborator={typingCollaborators[0]} />
        ) : (
          <GroupedTypingIndicator collaborators={typingCollaborators} />
        )
      )}
    </div>
  );
};

// Hook to simulate typing indicators (for demo/testing)
export const useTypingSimulation = (
  contactName: string,
  avatarColor: string = 'bg-blue-500'
): LiveCollaborator | null => {
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Randomly start typing after some delay
    const startDelay = Math.random() * 10000 + 5000; // 5-15 seconds
    const typingDuration = Math.random() * 3000 + 2000; // 2-5 seconds

    const startTimer = setTimeout(() => {
      setIsTyping(true);

      const stopTimer = setTimeout(() => {
        setIsTyping(false);
      }, typingDuration);

      return () => clearTimeout(stopTimer);
    }, startDelay);

    return () => clearTimeout(startTimer);
  }, []);

  if (!isTyping) return null;

  return {
    userId: 'simulated-' + contactName,
    userName: contactName,
    avatarColor,
    activity: 'typing',
    timestamp: new Date()
  };
};

export default LiveCollaborators;
