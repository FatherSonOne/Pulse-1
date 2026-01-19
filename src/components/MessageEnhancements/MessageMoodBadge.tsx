// Message Mood Badge Component
import React from 'react';
import type { MessageMood } from '../../types/messageEnhancements';

interface MessageMoodBadgeProps {
  mood: MessageMood;
  size?: 'small' | 'medium' | 'large';
}

export const MessageMoodBadge: React.FC<MessageMoodBadgeProps> = ({ mood, size = 'small' }) => {
  const sizeClasses = {
    small: 'text-[10px] px-1.5 py-0.5',
    medium: 'text-xs px-2 py-1',
    large: 'text-sm px-3 py-1.5'
  };
  
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${mood.color}20`,
        color: mood.color,
        border: `1px solid ${mood.color}40`
      }}
      title={`${mood.label} (${Math.round(mood.confidence * 100)}% confidence)`}
    >
      <span>{mood.emoji}</span>
      <span>{mood.label}</span>
    </div>
  );
};
