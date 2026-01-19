// Vox Threads Component
// Nested conversation replies to specific moments

import React, { useState, useRef, useCallback } from 'react';
import { VoxThread, VoxThreadReply } from '../../services/voxer/advancedVoxerTypes';

// ============================================
// TYPES
// ============================================

interface VoxThreadsProps {
  thread: VoxThread | null;
  parentVoxDuration: number;
  parentVoxTranscription?: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatarColor: string;
  onCreateThread: (timestamp?: number) => void;
  onAddReply: (threadId: string, audioBlob: Blob, parentReplyId?: string) => void;
  onClose: () => void;
}

interface ThreadReplyProps {
  reply: VoxThreadReply;
  onPlay: (url: string) => void;
  onReply: (replyId: string) => void;
  isPlaying: boolean;
  depth?: number;
}

interface ThreadTimestampPickerProps {
  duration: number;
  transcription?: string;
  onSelect: (timestamp: number | undefined) => void;
  onCancel: () => void;
}

// ============================================
// THREAD TIMESTAMP PICKER
// ============================================

const ThreadTimestampPicker: React.FC<ThreadTimestampPickerProps> = ({
  duration,
  transcription,
  onSelect,
  onCancel,
}) => {
  const [selectedTime, setSelectedTime] = useState<number | undefined>(undefined);
  const [scrubPosition, setScrubPosition] = useState(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = Math.round(percentage * duration);
    setSelectedTime(time);
    setScrubPosition(percentage * 100);
  };

  return (
    <div className="p-4 space-y-4">
      <h4 className="font-semibold text-zinc-700 dark:text-zinc-300">
        Reply to a specific moment?
      </h4>

      {/* Timeline Scrubber */}
      <div 
        className="relative h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl cursor-crosshair"
        onClick={handleScrub}
      >
        {/* Waveform Placeholder */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl">
          <div className="flex items-end gap-0.5 h-full py-2 w-full px-2">
            {Array.from({ length: 50 }).map((_, i) => (
              <div 
                key={i} 
                className="flex-1 bg-orange-500/30 rounded-full"
                style={{ height: `${20 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        </div>

        {/* Selected Position Marker */}
        {selectedTime !== undefined && (
          <div 
            className="absolute top-0 bottom-0 w-1 bg-orange-500 rounded-full"
            style={{ left: `${scrubPosition}%` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-1 bg-orange-500 text-white text-xs rounded font-mono">
              {formatTime(selectedTime)}
            </div>
          </div>
        )}

        {/* Timeline Labels */}
        <div className="absolute bottom-0 left-2 text-[10px] text-zinc-400">0:00</div>
        <div className="absolute bottom-0 right-2 text-[10px] text-zinc-400">{formatTime(duration)}</div>
      </div>

      {/* Transcription Context */}
      {transcription && selectedTime !== undefined && (
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
          <div className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-1">
            Context at {formatTime(selectedTime)}:
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 italic line-clamp-2">
            "...{transcription.substring(
              Math.max(0, Math.floor((selectedTime / duration) * transcription.length) - 50),
              Math.floor((selectedTime / duration) * transcription.length) + 50
            )}..."
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
        >
          Cancel
        </button>
        <button
          onClick={() => onSelect(undefined)}
          className="flex-1 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition"
        >
          Reply to All
        </button>
        <button
          onClick={() => onSelect(selectedTime)}
          disabled={selectedTime === undefined}
          className="flex-1 py-2 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reply Here
        </button>
      </div>
    </div>
  );
};

// ============================================
// THREAD REPLY COMPONENT
// ============================================

const ThreadReply: React.FC<ThreadReplyProps> = ({
  reply,
  onPlay,
  onReply,
  isPlaying,
  depth = 0,
}) => {
  const maxDepth = 3;
  const indent = Math.min(depth, maxDepth) * 24;

  return (
    <div 
      className="animate-slide-up"
      style={{ marginLeft: `${indent}px` }}
    >
      {/* Connector Line */}
      {depth > 0 && (
        <div className="absolute -left-3 top-0 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-700" />
      )}

      <div className="flex gap-3 py-2">
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full ${reply.userAvatarColor} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
          {reply.userName.charAt(0)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-sm dark:text-white">{reply.userName}</span>
            <span className="text-[10px] text-zinc-400">
              {reply.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Audio Player */}
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-2 flex items-center gap-2">
            <button
              onClick={() => onPlay(reply.audioUrl)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition ${
                isPlaying ? 'bg-orange-500' : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xs`}></i>
            </button>
            
            {/* Mini Waveform */}
            <div className="flex-1 flex items-center gap-0.5 h-6">
              {Array.from({ length: 20 }).map((_, i) => (
                <div 
                  key={i}
                  className={`flex-1 rounded-full ${isPlaying ? 'bg-orange-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                  style={{ height: `${30 + Math.random() * 70}%` }}
                />
              ))}
            </div>

            <span className="text-xs text-zinc-500 font-mono">{reply.duration.toFixed(0)}s</span>
          </div>

          {/* Transcription */}
          {reply.transcription && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
              {reply.transcription}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={() => onReply(reply.id)}
              className="text-[10px] text-zinc-400 hover:text-orange-500 transition"
            >
              <i className="fa-solid fa-reply mr-1"></i>Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// THREAD RECORDER COMPONENT
// ============================================

interface ThreadRecorderProps {
  onRecord: (blob: Blob) => void;
  onCancel: () => void;
  replyingTo?: string;
}

const ThreadRecorder: React.FC<ThreadRecorderProps> = ({
  onRecord,
  onCancel,
  replyingTo,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 100);

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSend = () => {
    if (recordedBlob) {
      onRecord(recordedBlob);
      setRecordedBlob(null);
      setDuration(0);
    }
  };

  const handleReset = () => {
    setRecordedBlob(null);
    setDuration(0);
  };

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 p-4">
      {replyingTo && (
        <div className="text-xs text-orange-500 mb-2">
          <i className="fa-solid fa-reply mr-1"></i>
          Replying to thread
        </div>
      )}

      {recordedBlob ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 flex items-center gap-2">
            <i className="fa-solid fa-check-circle text-emerald-500"></i>
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Recorded {duration}s
            </span>
          </div>
          <button
            onClick={handleReset}
            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition"
          >
            <i className="fa-solid fa-redo text-zinc-500"></i>
          </button>
          <button
            onClick={handleSend}
            className="w-10 h-10 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition"
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
          >
            Cancel
          </button>
          <div className="flex-1 flex justify-center">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition transform hover:scale-105 ${
                isRecording 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
            >
              <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
            </button>
          </div>
          {isRecording && (
            <span className="text-sm font-mono text-red-500 animate-pulse">{duration}s</span>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN VOX THREADS COMPONENT
// ============================================

export const VoxThreads: React.FC<VoxThreadsProps> = ({
  thread,
  parentVoxDuration,
  parentVoxTranscription,
  currentUserId,
  currentUserName,
  currentUserAvatarColor,
  onCreateThread,
  onAddReply,
  onClose,
}) => {
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleSelectTimestamp = (timestamp: number | undefined) => {
    onCreateThread(timestamp);
    setIsCreatingThread(false);
    setIsRecording(true);
  };

  const handlePlay = useCallback((url: string) => {
    if (audioRef.current) {
      if (playingUrl === url) {
        audioRef.current.pause();
        setPlayingUrl(null);
      } else {
        audioRef.current.src = url;
        audioRef.current.play();
        setPlayingUrl(url);
      }
    }
  }, [playingUrl]);

  const handleRecordComplete = (blob: Blob) => {
    if (thread) {
      onAddReply(thread.id, blob, replyingToId || undefined);
    }
    setIsRecording(false);
    setReplyingToId(null);
  };

  // Render nested replies recursively
  const renderReplies = (replies: VoxThreadReply[], parentId?: string, depth = 0) => {
    return replies
      .filter(r => r.parentReplyId === parentId)
      .map(reply => (
        <div key={reply.id} className="relative">
          <ThreadReply
            reply={reply}
            onPlay={handlePlay}
            onReply={(id) => { setReplyingToId(id); setIsRecording(true); }}
            isPlaying={playingUrl === reply.audioUrl}
            depth={depth}
          />
          {renderReplies(replies, reply.id, depth + 1)}
        </div>
      ));
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xl max-w-md w-full mx-4">
      {/* Hidden Audio Player */}
      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingUrl(null)}
        className="hidden"
      />

      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-comments text-orange-500"></i>
          <h3 className="font-semibold dark:text-white">
            {thread ? `Thread (${thread.replies.length} replies)` : 'Start Thread'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition"
        >
          <i className="fa-solid fa-times"></i>
        </button>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto p-4">
        {isCreatingThread ? (
          <ThreadTimestampPicker
            duration={parentVoxDuration}
            transcription={parentVoxTranscription}
            onSelect={handleSelectTimestamp}
            onCancel={() => setIsCreatingThread(false)}
          />
        ) : thread ? (
          <div className="space-y-1">
            {thread.parentTimestamp !== undefined && (
              <div className="text-xs text-orange-500 mb-3 flex items-center gap-1">
                <i className="fa-solid fa-clock"></i>
                Replying to moment at {Math.floor(thread.parentTimestamp / 60)}:{(thread.parentTimestamp % 60).toString().padStart(2, '0')}
              </div>
            )}
            {thread.replies.length > 0 ? (
              renderReplies(thread.replies)
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <i className="fa-solid fa-comments text-3xl mb-2 opacity-50"></i>
                <p className="text-sm">No replies yet</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-reply text-2xl text-orange-500"></i>
            </div>
            <h4 className="font-semibold dark:text-white mb-2">Start a Thread</h4>
            <p className="text-sm text-zinc-500 mb-4">
              Reply to a specific moment or the entire vox
            </p>
            <button
              onClick={() => setIsCreatingThread(true)}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition"
            >
              Create Thread
            </button>
          </div>
        )}
      </div>

      {/* Recorder */}
      {(thread || isRecording) && !isCreatingThread && (
        <ThreadRecorder
          onRecord={handleRecordComplete}
          onCancel={() => { setIsRecording(false); setReplyingToId(null); }}
          replyingTo={replyingToId || undefined}
        />
      )}
    </div>
  );
};

// ============================================
// THREAD INDICATOR (shows on vox bubble)
// ============================================

interface ThreadIndicatorProps {
  replyCount: number;
  onClick: () => void;
}

export const ThreadIndicator: React.FC<ThreadIndicatorProps> = ({
  replyCount,
  onClick,
}) => {
  if (replyCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 transition mt-2"
    >
      <i className="fa-solid fa-comments"></i>
      <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
    </button>
  );
};

export default VoxThreads;
