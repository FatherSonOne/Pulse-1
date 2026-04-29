// Priority Vox / Emergency Broadcast Component
// Urgent messages with special handling

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PriorityVox as PriorityVoxType, PriorityLevel, PRIORITY_CONFIG } from '../../services/relay/advancedRelayTypes';

import { Bell, Check, CheckCircle, CircleDot, Minus, Plus, X } from 'lucide-react';

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
    <div className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-scaleIn">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
            <Bell className="text-orange-500" />
            Priority Level
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition">
            <X />
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
                    <Check className="text-white text-xs" />
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
                  <Minus className="text-xs" />
                </button>
                <span className="w-8 text-center font-bold dark:text-white">{options.repeatCount}</span>
                <button
                  onClick={() => setOptions(prev => ({ ...prev, repeatCount: Math.min(5, prev.repeatCount + 1) }))}
                  className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center"
                >
                  <Plus className="text-xs" />
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

  // Auto-replay alert sound up to repeatCount times. The banner's animate-ping
  // dot carries the visual urgency; we no longer flash the document body.
  useEffect(() => {
    if (playCount >= vox.repeatCount) return;
    const interval = setInterval(() => {
      setPlayCount((prev) => (prev < vox.repeatCount ? prev + 1 : prev));
    }, 3000);
    return () => clearInterval(interval);
  }, [playCount, vox.repeatCount]);

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
    onPlay();
  };

  // Stage 4: demoted from a full-bleed red overlay to a top-pinned coral banner.
  // Same urgency signal (coral solid + animate-pulse dot + auto-replay alert),
  // none of the modal-as-first-thought ban violation. Sits inside the app shell
  // so the user retains context.
  const label = vox.priorityLevel === 'emergency' ? 'EMERGENCY' : 'URGENT MESSAGE';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 inset-x-0 z-[100] bg-rose-500 text-white shadow-lg shadow-rose-500/40 animate-fadeIn"
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
        </span>

        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] font-bold leading-none">
            {label}
          </div>
          <div className="text-sm font-semibold truncate mt-0.5">
            From {senderName}
          </div>
        </div>

        <button
          type="button"
          onClick={handlePlay}
          className="px-3 py-1.5 rounded-md bg-white text-rose-700 font-mono text-[11px] uppercase tracking-[0.1em] font-bold hover:bg-zinc-100 transition flex items-center gap-1.5"
          aria-label={isPlaying ? 'Playing alert' : 'Play alert'}
        >
          <CircleDot className="w-3.5 h-3.5" />
          {isPlaying ? 'Playing' : 'Play'}
        </button>

        {vox.requiresAcknowledgment ? (
          <button
            type="button"
            onClick={onAcknowledge}
            className="px-3 py-1.5 rounded-md bg-white text-rose-700 font-mono text-[11px] uppercase tracking-[0.1em] font-bold hover:bg-zinc-100 transition flex items-center gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Acknowledge
          </button>
        ) : (
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white font-mono text-[11px] uppercase tracking-[0.1em] font-bold transition"
          >
            Dismiss
          </button>
        )}

        <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
      </div>
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
