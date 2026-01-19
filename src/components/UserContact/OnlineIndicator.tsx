// OnlineIndicator Component
// Shows online/offline status and last active time for users

import React from 'react';
import { useUserPresence } from '../../hooks/usePresence';
import './OnlineIndicator.css';

interface OnlineIndicatorProps {
  userId: string | null | undefined;
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const OnlineIndicator: React.FC<OnlineIndicatorProps> = ({
  userId,
  showText = false,
  size = 'medium',
  className = ''
}) => {
  const { isOnline, lastActive, loading } = useUserPresence(userId);
  
  if (loading || !userId) {
    return null;
  }
  
  return (
    <div className={`online-indicator ${className}`}>
      <span className={`status-dot status-dot-${size} ${isOnline ? 'online' : 'offline'}`}></span>
      {showText && (
        <span className="status-text">
          {isOnline ? 'Active now' : lastActive.text}
        </span>
      )}
    </div>
  );
};

interface OnlineStatusBadgeProps {
  userId: string | null | undefined;
  className?: string;
}

export const OnlineStatusBadge: React.FC<OnlineStatusBadgeProps> = ({
  userId,
  className = ''
}) => {
  const { isOnline, lastActive } = useUserPresence(userId);
  
  if (!userId) {
    return null;
  }
  
  return (
    <div className={`online-status-badge ${isOnline ? 'badge-online' : 'badge-offline'} ${className}`}>
      <i className={`fa-solid fa-circle ${isOnline ? 'pulse-icon' : ''}`}></i>
      <span>{isOnline ? 'Active now' : lastActive.text}</span>
    </div>
  );
};
