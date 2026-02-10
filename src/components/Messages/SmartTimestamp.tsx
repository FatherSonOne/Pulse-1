/**
 * SmartTimestamp Component
 * Displays relative time for recent messages (< 15 min) and absolute time for older messages
 * Updates automatically every 30 seconds
 *
 * Version: 1.0
 * Date: 2026-02-08
 */

import React, { useState, useEffect } from 'react';

interface SmartTimestampProps {
  time: string | Date;
  alwaysAbsolute?: boolean;
  format?: 'short' | 'long';
  className?: string;
}

export const SmartTimestamp: React.FC<SmartTimestampProps> = ({
  time,
  alwaysAbsolute = false,
  format = 'short',
  className = '',
}) => {
  const [displayTime, setDisplayTime] = useState('');
  const [fullTimestamp, setFullTimestamp] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const messageTime = new Date(time);
      const diffMs = now.getTime() - messageTime.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      // Always generate full timestamp for tooltip
      setFullTimestamp(
        messageTime.toLocaleString([], {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );

      // Determine display format
      if (alwaysAbsolute || diffMins > 15) {
        // Show absolute time
        const isToday = messageTime.toDateString() === now.toDateString();

        if (isToday) {
          // Today: just show time
          setDisplayTime(
            messageTime.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          );
        } else {
          // Check if yesterday
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const isYesterday =
            messageTime.toDateString() === yesterday.toDateString();

          if (isYesterday) {
            const timeStr = messageTime.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            setDisplayTime(
              format === 'short' ? `Yesterday ${timeStr}` : `Yesterday at ${timeStr}`
            );
          } else {
            // Check if this week
            const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (daysDiff < 7) {
              // Show day of week
              const dayName = messageTime.toLocaleDateString([], {
                weekday: format === 'short' ? 'short' : 'long',
              });
              const timeStr = messageTime.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              setDisplayTime(
                format === 'short' ? `${dayName} ${timeStr}` : `${dayName} at ${timeStr}`
              );
            } else {
              // Show full date
              const dateStr = messageTime.toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              });
              const timeStr = messageTime.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              setDisplayTime(
                format === 'short' ? `${dateStr} ${timeStr}` : `${dateStr} at ${timeStr}`
              );
            }
          }
        }
      } else if (diffMins < 1) {
        // Less than 1 minute ago
        setDisplayTime('just now');
      } else {
        // Show relative time (1-15 minutes)
        setDisplayTime(`${diffMins}m ago`);
      }
    };

    // Initial update
    updateTime();

    // Update every 30 seconds
    const interval = setInterval(updateTime, 30000);

    return () => clearInterval(interval);
  }, [time, alwaysAbsolute, format]);

  return (
    <span
      className={`message-timestamp ${className}`}
      title={fullTimestamp}
      style={{
        fontSize: 'var(--font-size-timestamp)',
        fontWeight: 'var(--font-weight-timestamp)',
        color: 'var(--text-tertiary)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {displayTime}
    </span>
  );
};

/**
 * Compact version for space-constrained UIs
 */
export const SmartTimestampCompact: React.FC<
  Omit<SmartTimestampProps, 'format'>
> = (props) => {
  return <SmartTimestamp {...props} format="short" />;
};

/**
 * Always show relative time (for threading/replies)
 */
export const RelativeTimestamp: React.FC<
  Omit<SmartTimestampProps, 'alwaysAbsolute'>
> = (props) => {
  return <SmartTimestamp {...props} alwaysAbsolute={false} />;
};

/**
 * Always show absolute time (for message history/archives)
 */
export const AbsoluteTimestamp: React.FC<
  Omit<SmartTimestampProps, 'alwaysAbsolute'>
> = (props) => {
  return <SmartTimestamp {...props} alwaysAbsolute={true} />;
};

export default SmartTimestamp;
