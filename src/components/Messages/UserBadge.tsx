/**
 * UserBadge Component
 * Displays role badges for users (Admin, Member, Guest, Bot)
 * Supports multiple sizes and customizable styling
 *
 * Version: 1.0
 * Date: 2026-02-08
 */

import React from 'react';

export type UserRole = 'admin' | 'member' | 'guest' | 'bot' | 'moderator' | 'owner';

interface UserBadgeProps {
  role: UserRole;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

interface BadgeConfig {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const BADGE_CONFIGS: Record<UserRole, BadgeConfig> = {
  owner: {
    icon: '👑',
    label: 'Owner',
    color: '#f43f5e',
    bgColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  admin: {
    icon: '⭐',
    label: 'Admin',
    color: '#f43f5e',
    bgColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: 'rgba(244, 63, 94, 0.2)',
  },
  moderator: {
    icon: '🛡️',
    label: 'Mod',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  member: {
    icon: '✓',
    label: 'Member',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  guest: {
    icon: '👤',
    label: 'Guest',
    color: '#71717a',
    bgColor: 'rgba(113, 113, 122, 0.1)',
    borderColor: 'rgba(113, 113, 122, 0.2)',
  },
  bot: {
    icon: '🤖',
    label: 'Bot',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
};

const SIZE_STYLES = {
  xs: {
    padding: '1px 4px',
    fontSize: '9px',
    iconSize: '10px',
  },
  sm: {
    padding: '2px 6px',
    fontSize: '10px',
    iconSize: '11px',
  },
  md: {
    padding: '3px 8px',
    fontSize: '11px',
    iconSize: '12px',
  },
  lg: {
    padding: '4px 10px',
    fontSize: '12px',
    iconSize: '14px',
  },
};

export const UserBadge: React.FC<UserBadgeProps> = ({
  role,
  size = 'sm',
  showIcon = true,
  showLabel = true,
  className = '',
}) => {
  const badge = BADGE_CONFIGS[role];
  const sizeStyle = SIZE_STYLES[size];

  if (!badge) {
    console.warn(`UserBadge: Unknown role "${role}"`);
    return null;
  }

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: showIcon && showLabel ? '3px' : '0',
    padding: sizeStyle.padding,
    backgroundColor: badge.bgColor,
    color: badge.color,
    border: `1px solid ${badge.borderColor}`,
    borderRadius: '10px',
    fontSize: sizeStyle.fontSize,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: sizeStyle.iconSize,
    lineHeight: 1,
  };

  return (
    <span className={`user-badge user-badge-${role} user-badge-${size} ${className}`} style={style} title={badge.label}>
      {showIcon && <span className="user-badge-icon" style={iconStyle}>{badge.icon}</span>}
      {showLabel && <span className="user-badge-text">{badge.label}</span>}
    </span>
  );
};

/**
 * Icon-only badge (compact)
 */
export const UserBadgeIcon: React.FC<Omit<UserBadgeProps, 'showLabel' | 'showIcon'>> = (props) => {
  return <UserBadge {...props} showIcon={true} showLabel={false} />;
};

/**
 * Text-only badge (no icon)
 */
export const UserBadgeText: React.FC<Omit<UserBadgeProps, 'showLabel' | 'showIcon'>> = (props) => {
  return <UserBadge {...props} showIcon={false} showLabel={true} />;
};

/**
 * Get badge color for a role
 */
export function getRoleBadgeColor(role: UserRole): string {
  return BADGE_CONFIGS[role]?.color || '#71717a';
}

/**
 * Check if user has elevated privileges
 */
export function isElevatedRole(role: UserRole): boolean {
  return ['owner', 'admin', 'moderator'].includes(role);
}

/**
 * Get role hierarchy level (higher = more privileges)
 */
export function getRoleLevel(role: UserRole): number {
  const levels: Record<UserRole, number> = {
    owner: 5,
    admin: 4,
    moderator: 3,
    member: 2,
    guest: 1,
    bot: 0,
  };
  return levels[role] || 0;
}

export default UserBadge;
