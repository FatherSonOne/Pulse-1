/**
 * Pulse Notification Center
 * Dropdown panel showing all notifications with actions
 */

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNotificationStore, useUnreadCount } from '../store/notificationStore';
import { PulseNotification, NotificationCategory } from '../types/notifications';
import { playNotificationSound } from '../utils/soundGenerator';

// Icons for notification categories
const CategoryIcons: Record<NotificationCategory, string> = {
  message: 'fa-comment',
  email: 'fa-envelope',
  task: 'fa-check-circle',
  calendar: 'fa-calendar',
  ai: 'fa-robot',
  voice: 'fa-microphone',
  decision: 'fa-gavel',
  crm: 'fa-handshake',
  system: 'fa-cog',
};

// Colors for notification categories
const CategoryColors: Record<NotificationCategory, string> = {
  message: 'bg-blue-500',
  email: 'bg-rose-500',
  task: 'bg-emerald-500',
  calendar: 'bg-purple-500',
  ai: 'bg-cyan-500',
  voice: 'bg-orange-500',
  decision: 'bg-amber-500',
  crm: 'bg-indigo-500',
  system: 'bg-zinc-500',
};

interface NotificationCenterProps {
  className?: string;
  onOpenSettings?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className = '', onOpenSettings }) => {
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    permissionStatus,
    requestPermission,
    testSound,
  } = useNotificationStore();

  const unreadCount = useUnreadCount();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<NotificationCategory | 'all'>('all');
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });
  // Use local state instead of global to prevent multiple panels from opening
  const [isOpen, setIsOpen] = useState(false);

  // Calculate panel position when opening - position to the right of the button
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const panelWidth = 384; // w-96 = 24rem = 384px
      const panelMaxHeight = window.innerHeight * 0.7; // max-h-[70vh]

      // Position panel to the right of the button, or to the left if not enough space
      let left = rect.right + 8; // 8px to the right of the button

      // If panel would go off-screen on the right, position it to fit
      if (left + panelWidth > window.innerWidth - 16) {
        // Try positioning from the right edge of viewport
        left = window.innerWidth - panelWidth - 16;
      }

      // Ensure it doesn't go off-screen on the left
      left = Math.max(16, left);

      // Calculate vertical position - try to align with button, but ensure panel stays in viewport
      let top = rect.top;

      // Ensure panel doesn't go off-screen at the bottom
      if (top + panelMaxHeight > window.innerHeight - 16) {
        top = window.innerHeight - panelMaxHeight - 16;
      }

      // Ensure panel doesn't go off-screen at the top
      top = Math.max(16, top);

      setPanelPosition({
        top: top,
        left: left,
      });
    }
  }, [isOpen]);

  // Close panel when pressing Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    if (n.dismissed) return false;
    if (filter === 'all') return true;
    return n.category === filter;
  });

  // Format relative time
  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  // Handle notification click
  const handleNotificationClick = (notification: PulseNotification) => {
    markAsRead(notification.id);
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Notifications"
      >
        <i className="fa-solid fa-bell text-lg text-zinc-600 dark:text-zinc-400"></i>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel - Rendered via Portal to escape stacking context */}
      {isOpen && ReactDOM.createPortal(
        <>
          {/* Backdrop to catch clicks */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 99998 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            ref={panelRef}
            className="fixed w-96 max-h-[70vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-slide-down"
            style={{
              top: panelPosition.top,
              left: panelPosition.left,
              zIndex: 99999,
            }}
          >
          {/* Header */}
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold dark:text-white text-zinc-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  title="Clear all"
                >
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>

            {/* Permission Banner */}
            {permissionStatus === 'default' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <i className="fa-solid fa-bell-slash text-blue-500 mt-0.5"></i>
                  <div className="flex-1">
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                      Enable desktop notifications
                    </p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                      Get notified about important updates even when the app is in the background.
                    </p>
                    <button
                      onClick={requestPermission}
                      className="mt-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-md transition"
                    >
                      Enable Notifications
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1 pb-1">
              <FilterChip
                label="All"
                active={filter === 'all'}
                onClick={() => setFilter('all')}
              />
              <FilterChip
                label="Messages"
                icon="fa-comment"
                active={filter === 'message'}
                onClick={() => setFilter('message')}
              />
              <FilterChip
                label="Email"
                icon="fa-envelope"
                active={filter === 'email'}
                onClick={() => setFilter('email')}
              />
              <FilterChip
                label="Tasks"
                icon="fa-check-circle"
                active={filter === 'task'}
                onClick={() => setFilter('task')}
              />
              <FilterChip
                label="Calendar"
                icon="fa-calendar"
                active={filter === 'calendar'}
                onClick={() => setFilter('calendar')}
              />
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[calc(70vh-140px)]">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <i className="fa-solid fa-bell-slash text-2xl text-zinc-400"></i>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">No notifications</p>
                <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">
                  You're all caught up!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                    onDismiss={() => dismissNotification(notification.id)}
                    formatTime={formatTime}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <button
                onClick={() => testSound()}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1"
              >
                <i className="fa-solid fa-volume-high"></i>
                Test Sound
              </button>
              <button
                className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1"
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenSettings) {
                    onOpenSettings();
                  }
                }}
              >
                <i className="fa-solid fa-cog"></i>
                Settings
              </button>
            </div>
          </div>
        </div>
        </>,
        document.body
      )}
    </div>
  );
};

// Filter chip component
const FilterChip: React.FC<{
  label: string;
  icon?: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
      active
        ? 'bg-blue-500 text-white'
        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
    }`}
  >
    {icon && <i className={`fa-solid ${icon} text-[10px]`}></i>}
    {label}
  </button>
);

// Individual notification item
const NotificationItem: React.FC<{
  notification: PulseNotification;
  onClick: () => void;
  onDismiss: () => void;
  formatTime: (date: Date) => string;
}> = ({ notification, onClick, onDismiss, formatTime }) => {
  return (
    <div
      className={`group p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition ${
        !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex gap-3">
        {/* Category Icon */}
        <div
          className={`w-10 h-10 rounded-full ${CategoryColors[notification.category]} flex items-center justify-center flex-shrink-0`}
        >
          {notification.senderAvatar ? (
            <img
              src={notification.senderAvatar}
              alt={notification.senderName || ''}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <i
              className={`fa-solid ${CategoryIcons[notification.category]} text-white text-sm`}
            ></i>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm ${
                notification.read
                  ? 'text-zinc-600 dark:text-zinc-400'
                  : 'text-zinc-900 dark:text-white font-medium'
              }`}
            >
              {notification.title}
            </p>
            <span className="text-[10px] text-zinc-400 whitespace-nowrap flex-shrink-0">
              {formatTime(notification.timestamp)}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
            {notification.body}
          </p>

          {/* Priority indicator for urgent */}
          {notification.priority === 'urgent' && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold rounded-full">
              <i className="fa-solid fa-exclamation-circle"></i>
              Urgent
            </span>
          )}

          {/* Source badge */}
          {notification.source !== 'pulse' && (
            <span className="inline-flex items-center gap-1 mt-1.5 ml-1 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[10px] rounded-full capitalize">
              {notification.source}
            </span>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition"
          title="Dismiss"
        >
          <i className="fa-solid fa-xmark text-xs text-zinc-400"></i>
        </button>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full"></div>
      )}
    </div>
  );
};

// Compact notification bell for navbar
export const NotificationBell: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { toggleNotificationCenter } = useNotificationStore();
  const unreadCount = useUnreadCount();

  return (
    <button
      onClick={toggleNotificationCenter}
      className={`relative p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${className}`}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <i className="fa-solid fa-bell text-lg text-zinc-600 dark:text-zinc-400"></i>
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationCenter;
