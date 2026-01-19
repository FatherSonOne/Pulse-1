// Priority Vox / Emergency Broadcast Component
// Urgent messages with special handling

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PriorityVox as PriorityVoxType, PriorityLevel, PRIORITY_CONFIG } from '../../services/voxer/advancedVoxerTypes';

// ============================================
// TYPES
// ============================================

interface PriorityVoxSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (priority: PriorityLevel, options: PriorityOptions) => void;
  currentPriority?: PriorityLevel;
}

interface PriorityOptions {
  requiresAcknowledgment: boolean;
  bypassSilentMode: boolean;
  repeatCount: number;
  expiresIn?: number; // Minutes
}

interface EmergencyAlertProps {
  vox: PriorityVoxType;
  senderName: string;
  audioUrl: string;
  onAcknowledge: () => void;
  onDismiss: () => void;
  onPlay: () => void;
}

interface PriorityBadgeProps {
  level: PriorityLevel;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

// ============================================
// PRIORITY BADGE COMPONENT
// ============================================

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ 
  level, 
  size = 'sm',
  showLabel = false 
}) => {
  const config = PRIORITY_CONFIG[level];
  
  if (level === 'normal') return null;

  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  const colorClasses = {
    important: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    urgent: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    emergency: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold uppercase ${sizeClasses[size]} ${colorClasses[level as keyof typeof colorClasses]}`}>
      <i className={`fa-solid ${config.icon}`}></i>
      {showLabel && <span>{level}</span>}
    </span>
  );
};

// ============================================
// PRIORITY VOX SELECTOR COMPONENT
// ============================================

export const PriorityVoxSelector: React.FC<PriorityVoxSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentPriority = 'normal',
}) => {
  const [selectedLevel, setSelectedLevel] = useState<PriorityLevel>(currentPriority);
  const [options, setOptions] = useState<PriorityOptions>({
    requiresAcknowledgment: false,
    bypassSilentMode: false,
    repeatCount: 1,
    expiresIn: undefined,
  });

  // Update options based on priority level defaults
  useEffect(() => {
    const config = PRIORITY_CONFIG[selectedLevel];
    setOptions(prev => ({
      ...prev,
      requiresAcknowledgment: config.requiresAck,
      bypassSilentMode: config.bypassSilent,
    }));
  }, [selectedLevel]);

  if (!isOpen) return null;

  const priorities: PriorityLevel[] = ['normal', 'important', 'urgent', 'emergency'];

  const handleConfirm = () => {
    onSelect(selectedLevel, options);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-scaleIn">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-bell text-orange-500"></i>
            Priority Level
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        {/* Priority Selection */}
        <div className="p-4 space-y-3">
          {priorities.map(level => {
            const config = PRIORITY_CONFIG[level];
            const isSelected = selectedLevel === level;
            
            return (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`w-full p-4 rounded-xl border-2 transition flex items-center gap-4 ${
                  isSelected 
                    ? `border-${config.color}-500 bg-${config.color}-50 dark:bg-${config.color}-900/20`
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  level === 'normal' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500' :
                  level === 'important' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500' :
                  level === 'urgent' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-500' :
                  'bg-red-100 dark:bg-red-900/30 text-red-500'
                } ${level === 'emergency' ? 'animate-pulse' : ''}`}>
                  <i className={`fa-solid ${config.icon} text-xl`}></i>
                </div>
                <div className="flex-1 text-left">
                  <div className={`font-semibold capitalize ${isSelected ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {level}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {level === 'normal' && 'Standard message delivery'}
                    {level === 'important' && 'Highlighted with sound notification'}
                    {level === 'urgent' && 'Requires acknowledgment, bypasses silent'}
                    {level === 'emergency' && 'Immediate alert, max priority'}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <i className="fa-solid fa-check text-white text-xs"></i>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Options (for urgent/emergency) */}
        {(selectedLevel === 'urgent' || selectedLevel === 'emergency') && (
          <div className="px-4 pb-4 space-y-3">
            <div className="text-xs font-semibold text-zinc-500 uppercase">Options</div>
            
            {/* Acknowledgment Required */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium dark:text-white">Require Acknowledgment</div>
                <div className="text-xs text-zinc-500">Recipients must confirm they received it</div>
              </div>
              <button
                onClick={() => setOptions(prev => ({ ...prev, requiresAcknowledgment: !prev.requiresAcknowledgment }))}
                className={`w-12 h-6 rounded-full transition ${options.requiresAcknowledgment ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${options.requiresAcknowledgment ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Bypass Silent Mode */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium dark:text-white">Bypass Silent Mode</div>
                <div className="text-xs text-zinc-500">Play even when recipient is on silent</div>
              </div>
              <button
                onClick={() => setOptions(prev => ({ ...prev, bypassSilentMode: !prev.bypassSilentMode }))}
                className={`w-12 h-6 rounded-full transition ${options.bypassSilentMode ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition ${options.bypassSilentMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Repeat Count */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium dark:text-white">Repeat Alert</div>
                <div className="text-xs text-zinc-500">How many times to play alert sound</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOptions(prev => ({ ...prev, repeatCount: Math.max(1, prev.repeatCount - 1) }))}
                  className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center"
                >
                  <i className="fa-solid fa-minus text-xs"></i>
                </button>
                <span className="w-8 text-center font-bold dark:text-white">{options.repeatCount}</span>
                <button
                  onClick={() => setOptions(prev => ({ ...prev, repeatCount: Math.min(5, prev.repeatCount + 1) }))}
                  className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center"
                >
                  <i className="fa-solid fa-plus text-xs"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-semibold text-zinc-700 dark:text-zinc-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 py-3 rounded-xl font-semibold text-white transition ${
              selectedLevel === 'emergency' ? 'bg-red-500 hover:bg-red-600' :
              selectedLevel === 'urgent' ? 'bg-orange-500 hover:bg-orange-600' :
              selectedLevel === 'important' ? 'bg-blue-500 hover:bg-blue-600' :
              'bg-zinc-500 hover:bg-zinc-600'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// EMERGENCY ALERT COMPONENT
// ============================================

export const EmergencyAlert: React.FC<EmergencyAlertProps> = ({
  vox,
  senderName,
  audioUrl,
  onAcknowledge,
  onDismiss,
  onPlay,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const alertSoundRef = useRef<HTMLAudioElement>(null);

  const config = PRIORITY_CONFIG[vox.priorityLevel];

  // Auto-play alert sound
  useEffect(() => {
    const playAlert = () => {
      if (playCount < vox.repeatCount) {
        // Play alert sound (would normally be an actual sound file)
        setPlayCount(prev => prev + 1);
        
        // Flash the screen
        document.body.style.animation = 'flash-red 0.5s ease-in-out';
        setTimeout(() => {
          document.body.style.animation = '';
        }, 500);
      }
    };

    playAlert();
    const interval = setInterval(playAlert, 3000);
    
    return () => clearInterval(interval);
  }, [playCount, vox.repeatCount]);

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
    onPlay();
  };

  return (
    <div className="fixed inset-0 bg-red-900/90 backdrop-blur-lg flex items-center justify-center z-[100] animate-fadeIn">
      {/* Pulsing Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-red-900 animate-pulse" />
      
      {/* Alert Content */}
      <div className="relative z-10 max-w-md w-full mx-4">
        {/* Alert Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
            <i className="fa-solid fa-circle-radiation text-5xl text-white"></i>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-black text-white text-center mb-2 uppercase tracking-wider">
          {vox.priorityLevel === 'emergency' ? 'EMERGENCY' : 'URGENT MESSAGE'}
        </h1>
        
        <p className="text-xl text-white/80 text-center mb-8">
          From <span className="font-bold text-white">{senderName}</span>
        </p>

        {/* Play Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handlePlay}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition transform hover:scale-110 ${
              isPlaying 
                ? 'bg-white text-red-600' 
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <i className={`fa-solid ${isPlaying ? 'fa-volume-high' : 'fa-play'}`}></i>
          </button>
        </div>

        {/* Hidden Audio */}
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          onEnded={() => setIsPlaying(false)}
        />

        {/* Action Buttons */}
        <div className="space-y-3">
          {vox.requiresAcknowledgment && (
            <button
              onClick={onAcknowledge}
              className="w-full py-4 bg-white text-red-600 rounded-2xl font-bold text-lg uppercase tracking-wider hover:bg-zinc-100 transition flex items-center justify-center gap-3"
            >
              <i className="fa-solid fa-check-circle"></i>
              Acknowledge
            </button>
          )}
          
          {!vox.requiresAcknowledgment && (
            <button
              onClick={onDismiss}
              className="w-full py-4 bg-white/20 text-white rounded-2xl font-semibold hover:bg-white/30 transition"
            >
              Dismiss
            </button>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-center text-white/50 text-sm mt-6">
          Received at {new Date(vox.createdAt).toLocaleTimeString()}
        </p>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes flash-red {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(220, 38, 38, 0.3); }
        }
      `}</style>
    </div>
  );
};

// ============================================
// ACKNOWLEDGED LIST COMPONENT
// ============================================

interface AcknowledgedListProps {
  acknowledgedBy: PriorityVoxType['acknowledgedBy'];
  totalRecipients: number;
}

export const AcknowledgedList: React.FC<AcknowledgedListProps> = ({
  acknowledgedBy,
  totalRecipients,
}) => {
  const percentage = Math.round((acknowledgedBy.length / totalRecipients) * 100);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-500">Acknowledgments</span>
        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
          {acknowledgedBy.length}/{totalRecipients} ({percentage}%)
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-3">
        <div 
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Acknowledged Users */}
      {acknowledgedBy.length > 0 && (
        <div className="space-y-2">
          {acknowledgedBy.map(ack => (
            <div key={ack.userId} className="flex items-center justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">{ack.userName}</span>
              <span className="text-zinc-400">
                {new Date(ack.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PriorityVoxSelector;
