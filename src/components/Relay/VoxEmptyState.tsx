// VoxEmptyState - Beautiful empty state for Relay modes
// Shows mode-specific message when there are no conversations/messages

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface VoxEmptyStateProps {
  mode: string;
  color: string;
  icon: LucideIcon;
  title: string;
  description: string;
  isDarkMode?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const VoxEmptyState: React.FC<VoxEmptyStateProps> = ({
  mode,
  color,
  icon: Icon,
  title,
  description,
  isDarkMode = false,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 min-h-[400px]">
      {/* Animated icon with pulsing rings */}
      <div className="relative mb-6">
        {/* Pulsing rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="absolute w-32 h-32 rounded-full animate-ping-slow opacity-20"
            style={{ background: color }}
          />
          <div
            className="absolute w-24 h-24 rounded-full animate-ping-slower opacity-30"
            style={{ background: color }}
          />
        </div>

        {/* Icon */}
        <div
          className="relative w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${color}40, ${color}20)`,
            border: `2px solid ${color}60`,
          }}
        >
          <Icon
            className="w-10 h-10"
            style={{ color }}
          />
        </div>
      </div>

      {/* Title */}
      <h3
        className="text-xl font-bold mb-2"
        style={{ color: isDarkMode ? '#f9fafb' : '#111827' }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className="text-sm max-w-xs mb-6 leading-relaxed"
        style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
      >
        {description}
      </p>

      {/* Optional action button */}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
          }}
        >
          {action.label}
        </button>
      )}

      <style>{`
        @keyframes ping-slow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.1;
          }
        }
        @keyframes ping-slower {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.15;
          }
        }
        .animate-ping-slow {
          animation: ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .animate-ping-slower {
          animation: ping-slower 4s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
};

export default React.memo(VoxEmptyState);
