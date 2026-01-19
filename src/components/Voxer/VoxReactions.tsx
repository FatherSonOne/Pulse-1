// Vox Reactions Component
// Quick voice emoji reactions to messages

import React, { useState, useRef, useCallback } from 'react';
import { VoxReaction, ReactionType, REACTION_EMOJIS, REACTION_SOUNDS } from '../../services/voxer/advancedVoxerTypes';

// ============================================
// TYPES
// ============================================

interface VoxReactionsProps {
  voxId: string;
  reactions: VoxReaction[];
  currentUserId: string;
  currentUserName: string;
  onAddReaction: (reaction: Omit<VoxReaction, 'id' | 'timestamp'>) => void;
  onRemoveReaction: (reactionId: string) => void;
  compact?: boolean;
}

interface ReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: ReactionType, audioBlob?: Blob) => void;
  position: { x: number; y: number };
}

// ============================================
// REACTION PICKER COMPONENT
// ============================================

const ReactionPicker: React.FC<ReactionPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  position,
}) => {
  const [isRecordingCustom, setIsRecordingCustom] = useState(false);
  const [customRecording, setCustomRecording] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startCustomRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setCustomRecording(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      // Auto-stop after 2 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          setIsRecordingCustom(false);
        }
      }, 2000);

      mediaRecorder.start();
      setIsRecordingCustom(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopCustomRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecordingCustom(false);
    }
  };

  const handleSelectCustom = () => {
    if (customRecording) {
      onSelect('custom', customRecording);
      setCustomRecording(null);
    }
  };

  if (!isOpen) return null;

  const reactions: ReactionType[] = ['laugh', 'wow', 'agree', 'disagree', 'love', 'think', 'question', 'celebrate'];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
        onMouseDown={(e) => e.stopPropagation()}
      />
      
      {/* Picker */}
      <div 
        className="fixed z-50 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-3 animate-scaleIn"
        style={{ 
          left: Math.min(position.x - 160, window.innerWidth - 320),
          top: Math.min(position.y - 80, window.innerHeight - 200),
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-semibold text-zinc-500 mb-2 px-1">Quick Reactions</div>
        
        {/* Preset Reactions */}
        <div className="flex flex-wrap gap-1 mb-3">
          {reactions.map(type => (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className="group relative w-12 h-12 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex flex-col items-center justify-center transition transform hover:scale-110"
              title={REACTION_SOUNDS[type]}
            >
              <span className="text-2xl">{REACTION_EMOJIS[type]}</span>
              <span className="text-[8px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
                {REACTION_SOUNDS[type]}
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-200 dark:border-zinc-700 my-2" />

        {/* Custom Voice Reaction */}
        <div className="px-1">
          <div className="text-xs font-semibold text-zinc-500 mb-2">Custom Voice Reaction</div>
          
          {customRecording ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-xs text-emerald-600 dark:text-emerald-400">
                <i className="fa-solid fa-check mr-1"></i> Recorded!
              </div>
              <button
                onClick={handleSelectCustom}
                className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition"
              >
                Send
              </button>
              <button
                onClick={() => setCustomRecording(null)}
                className="px-3 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-lg text-xs transition"
              >
                <i className="fa-solid fa-redo"></i>
              </button>
            </div>
          ) : (
            <button
              onMouseDown={startCustomRecording}
              onMouseUp={stopCustomRecording}
              onMouseLeave={stopCustomRecording}
              onTouchStart={startCustomRecording}
              onTouchEnd={stopCustomRecording}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${
                isRecordingCustom 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <i className={`fa-solid ${isRecordingCustom ? 'fa-stop' : 'fa-microphone'}`}></i>
              {isRecordingCustom ? 'Recording... (release to stop)' : 'Hold to Record (2s max)'}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// ============================================
// REACTION DISPLAY COMPONENT
// ============================================

interface ReactionDisplayProps {
  reactions: VoxReaction[];
  onPlayReaction: (reaction: VoxReaction) => void;
  compact?: boolean;
}

const ReactionDisplay: React.FC<ReactionDisplayProps> = ({ reactions, onPlayReaction, compact }) => {
  // Group reactions by type
  const grouped = reactions.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<ReactionType, VoxReaction[]>);

  if (reactions.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${compact ? '' : 'mt-2'}`}>
      {Object.entries(grouped).map(([type, reacts]) => (
        <button
          key={type}
          onClick={() => {
            const customReact = reacts.find(r => r.audioUrl);
            if (customReact) onPlayReaction(customReact);
          }}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition ${
            compact ? 'text-xs' : 'text-sm'
          }`}
          title={reacts.map(r => r.userName).join(', ')}
        >
          <span>{REACTION_EMOJIS[type as ReactionType]}</span>
          {reacts.length > 1 && (
            <span className="text-zinc-500 text-xs">{reacts.length}</span>
          )}
          {type === 'custom' && (
            <i className="fa-solid fa-volume-high text-[10px] text-zinc-400"></i>
          )}
        </button>
      ))}
    </div>
  );
};

// ============================================
// MAIN VOX REACTIONS COMPONENT
// ============================================

export const VoxReactions: React.FC<VoxReactionsProps> = ({
  voxId,
  reactions,
  currentUserId,
  currentUserName,
  onAddReaction,
  onRemoveReaction,
  compact = false,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleOpenPicker = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPickerPosition({ x: rect.left + rect.width / 2, y: rect.top });
    }
    setShowPicker(true);
  }, []);

  const handleSelectReaction = useCallback((type: ReactionType, audioBlob?: Blob) => {
    // Check if user already reacted with this type
    const existingReaction = reactions.find(r => r.userId === currentUserId && r.type === type);
    
    if (existingReaction && type !== 'custom') {
      // Remove existing reaction
      onRemoveReaction(existingReaction.id);
    } else {
      // Add new reaction
      let audioUrl: string | undefined;
      let audioDuration: number | undefined;
      
      if (audioBlob) {
        audioUrl = URL.createObjectURL(audioBlob);
        audioDuration = 2; // Max 2 seconds
      }

      onAddReaction({
        voxId,
        userId: currentUserId,
        userName: currentUserName,
        type,
        audioUrl,
        audioDuration,
        emoji: REACTION_EMOJIS[type],
      });
    }
    
    setShowPicker(false);
  }, [voxId, currentUserId, currentUserName, reactions, onAddReaction, onRemoveReaction]);

  const handlePlayReaction = useCallback((reaction: VoxReaction) => {
    if (reaction.audioUrl && audioRef.current) {
      audioRef.current.src = reaction.audioUrl;
      audioRef.current.play();
    }
  }, []);

  // Check if current user has reacted
  const userReaction = reactions.find(r => r.userId === currentUserId);

  return (
    <div className="flex items-center gap-2">
      {/* Hidden audio element for playing reactions */}
      <audio ref={audioRef} className="hidden" />
      
      {/* Reaction Display */}
      <ReactionDisplay 
        reactions={reactions} 
        onPlayReaction={handlePlayReaction}
        compact={compact}
      />
      
      {/* Add Reaction Button */}
      <button
        ref={buttonRef}
        onClick={handleOpenPicker}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={`flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition relative z-10 ${
          compact ? 'w-7 h-7' : 'w-8 h-8'
        } ${userReaction ? 'ring-2 ring-orange-500 text-orange-500' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        title="Add reaction"
        type="button"
      >
        <i className={`fa-solid fa-smile ${compact ? 'text-sm' : 'text-base'}`}></i>
      </button>

      {/* Reaction Picker */}
      <ReactionPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleSelectReaction}
        position={pickerPosition}
      />
    </div>
  );
};

// ============================================
// QUICK REACTION BAR (for swipe gestures)
// ============================================

interface QuickReactionBarProps {
  voxId: string;
  onReact: (type: ReactionType) => void;
}

export const QuickReactionBar: React.FC<QuickReactionBarProps> = ({ voxId, onReact }) => {
  const quickReactions: ReactionType[] = ['agree', 'love', 'laugh', 'wow'];

  return (
    <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 rounded-full shadow-lg border border-zinc-200 dark:border-zinc-800 p-1 animate-slide-up">
      {quickReactions.map(type => (
        <button
          key={type}
          onClick={() => onReact(type)}
          className="w-10 h-10 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-xl transition transform hover:scale-125 active:scale-95"
        >
          {REACTION_EMOJIS[type]}
        </button>
      ))}
    </div>
  );
};

export default VoxReactions;
