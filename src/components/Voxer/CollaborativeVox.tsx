// Collaborative Vox Component
// Multiple people recording one message together

import React, { useState, useRef, useCallback } from 'react';
import { 
  CollaborativeVox as CollabVoxType, 
  CollabVoxSegment, 
  CollabParticipant,
  CollabInvite 
} from '../../services/voxer/advancedVoxerTypes';
import { Contact } from '../../types';

// ============================================
// TYPES
// ============================================

interface CollaborativeVoxProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  currentUser: {
    id: string;
    name: string;
    avatarColor: string;
  };
  onCreateCollab: (collab: Omit<CollabVoxType, 'id' | 'createdAt'>) => void;
  onAddSegment: (collabId: string, segment: Omit<CollabVoxSegment, 'id' | 'order'>) => void;
  onRemoveSegment: (collabId: string, segmentId: string) => void;
  onReorderSegments: (collabId: string, segmentIds: string[]) => void;
  onSendCollab: (collabId: string, recipientIds: string[]) => void;
}

interface CollabSessionProps {
  collab: CollabVoxType;
  currentUserId: string;
  onAddSegment: (audioBlob: Blob, transcription?: string) => void;
  onRemoveSegment: (segmentId: string) => void;
  onReorder: (segmentIds: string[]) => void;
  onSend: () => void;
  onClose: () => void;
}

// ============================================
// SEGMENT CARD COMPONENT
// ============================================

interface SegmentCardProps {
  segment: CollabVoxSegment;
  isCurrentUser: boolean;
  onRemove: () => void;
  onPlay: () => void;
  isPlaying: boolean;
  index: number;
}

const SegmentCard: React.FC<SegmentCardProps> = ({
  segment,
  isCurrentUser,
  onRemove,
  onPlay,
  isPlaying,
  index,
}) => {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition ${
      isPlaying ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-zinc-50 dark:bg-zinc-800/50'
    }`}>
      {/* Order Number */}
      <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400">
        {index + 1}
      </div>

      {/* User Avatar */}
      <div className={`w-8 h-8 rounded-full ${segment.userAvatarColor} flex items-center justify-center text-white text-sm font-bold`}>
        {segment.userName.charAt(0)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm dark:text-white">{segment.userName}</span>
          <span className="text-xs text-zinc-400">{segment.duration.toFixed(1)}s</span>
        </div>
        {segment.transcription && (
          <p className="text-xs text-zinc-500 truncate">{segment.transcription}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onPlay}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
            isPlaying 
              ? 'bg-orange-500 text-white' 
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'
          }`}
        >
          <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xs`}></i>
        </button>
        {isCurrentUser && (
          <button
            onClick={onRemove}
            className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-600 dark:text-zinc-300 hover:text-red-500 flex items-center justify-center transition"
          >
            <i className="fa-solid fa-trash text-xs"></i>
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================
// RECORDING COMPONENT
// ============================================

interface SegmentRecorderProps {
  onRecord: (blob: Blob, duration: number) => void;
  onCancel: () => void;
}

const SegmentRecorder: React.FC<SegmentRecorderProps> = ({ onRecord, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
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
        const finalDuration = (Date.now() - startTimeRef.current) / 1000;
        onRecord(blob, finalDuration);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 100);

    } catch (error) {
      console.error('Recording failed:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    onCancel();
  };

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      {isRecording ? (
        <>
          <button
            onClick={cancelRecording}
            className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-600 dark:text-zinc-300 transition"
          >
            <i className="fa-solid fa-times"></i>
          </button>
          <div className="flex flex-col items-center">
            <div className="text-2xl font-mono font-bold text-red-500 animate-pulse">{duration}s</div>
            <div className="text-xs text-zinc-500">Recording...</div>
          </div>
          <button
            onClick={stopRecording}
            className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition animate-pulse"
          >
            <i className="fa-solid fa-stop"></i>
          </button>
        </>
      ) : (
        <button
          onClick={startRecording}
          className="w-16 h-16 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition transform hover:scale-105"
        >
          <i className="fa-solid fa-microphone text-2xl"></i>
        </button>
      )}
    </div>
  );
};

// ============================================
// COLLAB SESSION COMPONENT
// ============================================

const CollabSession: React.FC<CollabSessionProps> = ({
  collab,
  currentUserId,
  onAddSegment,
  onRemoveSegment,
  onReorder,
  onSend,
  onClose,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleRecord = (blob: Blob, duration: number) => {
    onAddSegment(blob, undefined);
    setIsRecording(false);
  };

  const handlePlay = (segment: CollabVoxSegment) => {
    if (audioRef.current) {
      if (playingSegmentId === segment.id) {
        audioRef.current.pause();
        setPlayingSegmentId(null);
      } else {
        audioRef.current.src = segment.audioUrl;
        audioRef.current.play();
        setPlayingSegmentId(segment.id);
      }
    }
  };

  const playAll = () => {
    // Play all segments in order
    const sortedSegments = [...collab.segments].sort((a, b) => a.order - b.order);
    let currentIndex = 0;

    const playNext = () => {
      if (currentIndex < sortedSegments.length) {
        const segment = sortedSegments[currentIndex];
        setPlayingSegmentId(segment.id);
        if (audioRef.current) {
          audioRef.current.src = segment.audioUrl;
          audioRef.current.play();
        }
        currentIndex++;
      } else {
        setPlayingSegmentId(null);
      }
    };

    if (audioRef.current) {
      audioRef.current.onended = playNext;
    }
    playNext();
  };

  const totalDuration = collab.segments.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Hidden Audio */}
      <audio ref={audioRef} onEnded={() => setPlayingSegmentId(null)} className="hidden" />

      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold dark:text-white">{collab.title || 'Untitled Collab'}</h3>
          <p className="text-xs text-zinc-500">
            {collab.participants.length} participants • {collab.segments.length} segments • {totalDuration.toFixed(1)}s
          </p>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
          <i className="fa-solid fa-times"></i>
        </button>
      </div>

      {/* Participants */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Participants:</span>
          <div className="flex -space-x-2">
            {collab.participants.map(p => (
              <div
                key={p.userId}
                className={`w-7 h-7 rounded-full ${p.userAvatarColor} flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-zinc-900`}
                title={p.userName}
              >
                {p.userName.charAt(0)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Segments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {collab.segments.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <i className="fa-solid fa-microphone text-3xl mb-2 opacity-50"></i>
            <p className="text-sm">No segments yet</p>
            <p className="text-xs mt-1">Be the first to add your part!</p>
          </div>
        ) : (
          collab.segments
            .sort((a, b) => a.order - b.order)
            .map((segment, index) => (
              <SegmentCard
                key={segment.id}
                segment={segment}
                isCurrentUser={segment.userId === currentUserId}
                onRemove={() => onRemoveSegment(segment.id)}
                onPlay={() => handlePlay(segment)}
                isPlaying={playingSegmentId === segment.id}
                index={index}
              />
            ))
        )}
      </div>

      {/* Recording Area */}
      {isRecording ? (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <SegmentRecorder
            onRecord={handleRecord}
            onCancel={() => setIsRecording(false)}
          />
        </div>
      ) : (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
          {/* Preview & Record Buttons */}
          <div className="flex gap-3">
            {collab.segments.length > 0 && (
              <button
                onClick={playAll}
                className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-semibold text-zinc-700 dark:text-zinc-300 transition"
              >
                <i className="fa-solid fa-play mr-2"></i>
                Preview All
              </button>
            )}
            <button
              onClick={() => setIsRecording(true)}
              className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition"
            >
              <i className="fa-solid fa-microphone mr-2"></i>
              Add Your Part
            </button>
          </div>

          {/* Send Button */}
          {collab.segments.length > 0 && (
            <button
              onClick={onSend}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition"
            >
              <i className="fa-solid fa-paper-plane mr-2"></i>
              Send Collaborative Vox
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COLLABORATIVE VOX COMPONENT
// ============================================

export const CollaborativeVox: React.FC<CollaborativeVoxProps> = ({
  isOpen,
  onClose,
  contacts,
  currentUser,
  onCreateCollab,
  onAddSegment,
  onRemoveSegment,
  onReorderSegments,
  onSendCollab,
}) => {
  const [step, setStep] = useState<'create' | 'invite' | 'session'>('create');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [activeCollab, setActiveCollab] = useState<CollabVoxType | null>(null);

  const resetForm = () => {
    setStep('create');
    setTitle('');
    setDescription('');
    setSelectedContacts([]);
    setActiveCollab(null);
  };

  const handleCreate = () => {
    const newCollab: Omit<CollabVoxType, 'id' | 'createdAt'> = {
      title: title.trim() || 'Collaborative Vox',
      description: description.trim() || undefined,
      status: 'recording',
      segments: [],
      participants: [
        {
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatarColor: currentUser.avatarColor,
          role: 'creator',
          hasRecorded: false,
          segmentCount: 0,
          joinedAt: new Date(),
        },
        ...selectedContacts.map(id => {
          const contact = contacts.find(c => c.id === id)!;
          return {
            userId: contact.id,
            userName: contact.name,
            userAvatarColor: contact.avatarColor,
            role: 'contributor' as const,
            hasRecorded: false,
            segmentCount: 0,
            joinedAt: new Date(),
          };
        }),
      ],
      recipientIds: [],
      totalDuration: 0,
      createdBy: currentUser.id,
    };

    onCreateCollab(newCollab);
    
    // Simulate setting active collab (in real app, this would come from onCreateCollab)
    setActiveCollab({
      ...newCollab,
      id: `collab-${Date.now()}`,
      createdAt: new Date(),
    } as CollabVoxType);
    
    setStep('session');
  };

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleAddSegment = (audioBlob: Blob, transcription?: string) => {
    if (activeCollab) {
      const newSegment: Omit<CollabVoxSegment, 'id' | 'order'> = {
        collabVoxId: activeCollab.id,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatarColor: currentUser.avatarColor,
        audioUrl: URL.createObjectURL(audioBlob),
        duration: 5, // Would be calculated from actual audio
        status: 'recorded',
        transcription,
        recordedAt: new Date(),
      };
      
      // Add segment to local state (in real app, this would update via callback)
      setActiveCollab(prev => prev ? {
        ...prev,
        segments: [...prev.segments, {
          ...newSegment,
          id: `segment-${Date.now()}`,
          order: prev.segments.length,
        } as CollabVoxSegment],
      } : null);
    }
  };

  const handleSend = () => {
    if (activeCollab) {
      // Show recipient selection or send to participants
      onSendCollab(activeCollab.id, activeCollab.participants.map(p => p.userId));
      resetForm();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-scaleIn flex flex-col">
        
        {step === 'session' && activeCollab ? (
          <CollabSession
            collab={activeCollab}
            currentUserId={currentUser.id}
            onAddSegment={handleAddSegment}
            onRemoveSegment={(segmentId) => {
              setActiveCollab(prev => prev ? {
                ...prev,
                segments: prev.segments.filter(s => s.id !== segmentId),
              } : null);
            }}
            onReorder={() => {}}
            onSend={handleSend}
            onClose={() => { resetForm(); onClose(); }}
          />
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white">
                    <i className="fa-solid fa-users-rectangle"></i>
                  </div>
                  <div>
                    <h2 className="font-bold text-lg dark:text-white">Collaborative Vox</h2>
                    <p className="text-xs text-zinc-500">Record together as a team</p>
                  </div>
                </div>
                <button
                  onClick={() => { resetForm(); onClose(); }}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Title & Description */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Team Update, Weekly Sync..."
                    className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-cyan-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">Description (optional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's this collab about?"
                    className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-0 focus:ring-2 focus:ring-cyan-500 dark:text-white"
                  />
                </div>
              </div>

              {/* Invite Collaborators */}
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase mb-2 block">
                  Invite Collaborators
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {contacts.map(contact => (
                    <button
                      key={contact.id}
                      onClick={() => toggleContact(contact.id)}
                      className={`w-full p-3 rounded-xl flex items-center gap-3 transition ${
                        selectedContacts.includes(contact.id)
                          ? 'bg-cyan-50 dark:bg-cyan-900/20 border-2 border-cyan-500'
                          : 'bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-2 border-transparent'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full ${contact.avatarColor} flex items-center justify-center text-white font-bold`}>
                        {contact.name.charAt(0)}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium dark:text-white">{contact.name}</div>
                        <div className="text-xs text-zinc-500">{contact.role}</div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedContacts.includes(contact.id)
                          ? 'bg-cyan-500 border-cyan-500 text-white'
                          : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {selectedContacts.includes(contact.id) && (
                          <i className="fa-solid fa-check text-xs"></i>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Summary */}
              {selectedContacts.length > 0 && (
                <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-xl p-3 text-sm text-cyan-600 dark:text-cyan-400">
                  <i className="fa-solid fa-users mr-2"></i>
                  {selectedContacts.length + 1} people will collaborate (including you)
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
              <button
                onClick={() => { resetForm(); onClose(); }}
                className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl font-semibold text-zinc-700 dark:text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl font-semibold transition"
              >
                <i className="fa-solid fa-play mr-2"></i>
                Start Recording
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CollaborativeVox;
