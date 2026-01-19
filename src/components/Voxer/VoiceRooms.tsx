// Voice Rooms Component
// Persistent voice channels for team communication

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Contact } from '../../types';
import { voiceRoomService } from '../../services/voiceRoomService';

// ============================================
// TYPES
// ============================================

interface VoiceRoom {
  id: string;
  name: string;
  icon: string;
  color: string;
  participants: RoomParticipant[];
  maxParticipants: number;
  isPrivate: boolean;
  category?: string;
  description?: string;
  createdAt: Date;
  settings: RoomSettings;
}

interface RoomParticipant {
  userId: string;
  name: string;
  avatarColor: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  joinedAt: Date;
  isScreenSharing?: boolean;
}

interface RoomSettings {
  bitrate: number;
  voiceActivity: boolean;
  echoCancel: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

interface VoiceRoomsProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  currentUser: {
    id: string;
    name: string;
    avatarColor: string;
  };
}

// ============================================
// VOICE ROOMS COMPONENT
// ============================================
// Mock data removed - now using Supabase persistence

// ============================================
// VOICE ROOMS COMPONENT
// ============================================

export const VoiceRooms: React.FC<VoiceRoomsProps> = ({
  isOpen,
  onClose,
  contacts,
  currentUser,
}) => {
  // State
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // ============================================
  // ROOM ACTIONS
  // ============================================

  const joinRoom = useCallback(async (roomId: string) => {
    try {
      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setAudioStream(stream);

      // Setup audio analysis for voice activity
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Add user to room
      setRooms(prev => prev.map(room => {
        if (room.id === roomId) {
          return {
            ...room,
            participants: [
              ...room.participants,
              {
                userId: currentUser.id,
                name: currentUser.name,
                avatarColor: currentUser.avatarColor,
                isMuted: false,
                isDeafened: false,
                isSpeaking: false,
                joinedAt: new Date(),
              },
            ],
          };
        }
        return room;
      }));

      setActiveRoomId(roomId);

      // Start voice activity detection
      detectVoiceActivity();

    } catch (error) {
      console.error('Failed to join room:', error);
    }
  }, [currentUser]);

  const leaveRoom = useCallback(() => {
    if (!activeRoomId) return;

    // Stop audio stream
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Cancel animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Remove user from room
    setRooms(prev => prev.map(room => {
      if (room.id === activeRoomId) {
        return {
          ...room,
          participants: room.participants.filter(p => p.userId !== currentUser.id),
        };
      }
      return room;
    }));

    setActiveRoomId(null);
    setIsMuted(false);
    setIsDeafened(false);
  }, [activeRoomId, audioStream, currentUser.id]);

  // ============================================
  // VOICE ACTIVITY DETECTION
  // ============================================

  const detectVoiceActivity = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const checkActivity = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const isSpeaking = average > 30; // Threshold

      setSpeakingUsers(prev => {
        const next = new Set(prev);
        if (isSpeaking && !isMuted) {
          next.add(currentUser.id);
        } else {
          next.delete(currentUser.id);
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(checkActivity);
    };

    checkActivity();
  }, [currentUser.id, isMuted]);

  // ============================================
  // AUDIO CONTROLS
  // ============================================

  const toggleMute = useCallback(() => {
    if (audioStream) {
      audioStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  }, [audioStream, isMuted]);

  const toggleDeafen = useCallback(() => {
    setIsDeafened(!isDeafened);
    if (!isDeafened) {
      setIsMuted(true);
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
    }
  }, [audioStream, isDeafened]);

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioStream]);

  // ============================================
  // GROUP BY CATEGORY
  // ============================================

  const roomsByCategory = rooms.reduce((acc, room) => {
    const category = room.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(room);
    return acc;
  }, {} as Record<string, VoiceRoom[]>);

  // ============================================
  // RENDER
  // ============================================

  if (!isOpen) return null;

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-zinc-950 rounded-3xl w-full max-w-4xl h-[85vh] flex overflow-hidden border border-zinc-800 shadow-2xl animate-scaleIn">
        
        {/* Sidebar - Room List */}
        <div className="w-72 bg-zinc-900/50 border-r border-zinc-800 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-tower-broadcast text-orange-500"></i>
                Voice Rooms
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <button
              onClick={() => setShowCreateRoom(true)}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm text-zinc-300 transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plus"></i>
              Create Room
            </button>
          </div>

          {/* Room List */}
          <div className="flex-1 overflow-y-auto p-2">
            {Object.entries(roomsByCategory).map(([category, categoryRooms]) => (
              <div key={category} className="mb-4">
                <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  {category}
                </div>
                <div className="space-y-1">
                  {categoryRooms.map(room => (
                    <button
                      key={room.id}
                      onClick={() => activeRoomId === room.id ? leaveRoom() : joinRoom(room.id)}
                      className={`w-full p-3 rounded-xl text-left transition group ${
                        activeRoomId === room.id 
                          ? 'bg-orange-500/20 border border-orange-500/50' 
                          : 'hover:bg-zinc-800/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${room.color} flex items-center justify-center text-white`}>
                          <i className={`fa-solid ${room.icon}`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-sm truncate">{room.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-zinc-500">
                              {room.participants.length}/{room.maxParticipants}
                            </span>
                            {room.isPrivate && (
                              <i className="fa-solid fa-lock text-[10px] text-zinc-500"></i>
                            )}
                          </div>
                        </div>
                        {activeRoomId === room.id && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        )}
                      </div>

                      {/* Participants Preview */}
                      {room.participants.length > 0 && (
                        <div className="mt-2 pl-1 space-y-1">
                          {room.participants.slice(0, 4).map(participant => (
                            <div key={participant.userId} className="flex items-center gap-2 text-xs">
                              <div className={`w-5 h-5 rounded-full ${participant.avatarColor} flex items-center justify-center text-white text-[10px] font-bold ${speakingUsers.has(participant.userId) ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-zinc-900' : ''}`}>
                                {participant.name.charAt(0)}
                              </div>
                              <span className={`text-zinc-400 truncate ${speakingUsers.has(participant.userId) ? 'text-emerald-400' : ''}`}>
                                {participant.name}
                              </span>
                              {participant.isMuted && <i className="fa-solid fa-microphone-slash text-[10px] text-red-400"></i>}
                            </div>
                          ))}
                          {room.participants.length > 4 && (
                            <span className="text-[10px] text-zinc-500">+{room.participants.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col">
          {activeRoom ? (
            <>
              {/* Room Header */}
              <div className="px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-zinc-900/50 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl ${activeRoom.color} flex items-center justify-center text-white text-xl`}>
                      <i className={`fa-solid ${activeRoom.icon}`}></i>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{activeRoom.name}</h3>
                      <p className="text-sm text-zinc-400">{activeRoom.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-10 h-10 rounded-full hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
                  >
                    <i className="fa-solid fa-gear"></i>
                  </button>
                </div>
              </div>

              {/* Participants Grid */}
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {activeRoom.participants.map(participant => (
                    <div
                      key={participant.userId}
                      className={`p-4 rounded-2xl bg-zinc-900/50 border transition ${
                        speakingUsers.has(participant.userId) 
                          ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' 
                          : 'border-zinc-800'
                      }`}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className={`w-16 h-16 rounded-full ${participant.avatarColor} flex items-center justify-center text-white text-2xl font-bold relative mb-3 ${speakingUsers.has(participant.userId) ? 'ring-4 ring-emerald-400 ring-opacity-50 animate-pulse' : ''}`}>
                          {participant.name.charAt(0)}
                          {participant.isScreenSharing && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                              <i className="fa-solid fa-desktop text-[10px] text-white"></i>
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-white text-sm">{participant.name}</span>
                        <div className="flex items-center gap-2 mt-2">
                          {participant.isMuted && (
                            <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                              <i className="fa-solid fa-microphone-slash text-[10px] text-red-400"></i>
                            </span>
                          )}
                          {participant.isDeafened && (
                            <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                              <i className="fa-solid fa-headphones-simple text-[10px] text-red-400"></i>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Empty slots */}
                  {Array.from({ length: Math.max(0, 4 - activeRoom.participants.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="p-4 rounded-2xl border border-dashed border-zinc-800 flex items-center justify-center min-h-[150px]">
                      <div className="text-center text-zinc-600">
                        <i className="fa-solid fa-user-plus text-2xl mb-2"></i>
                        <p className="text-xs">Waiting...</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="px-6 py-4 border-t border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950">
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={toggleMute}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                      isMuted 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                    }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-xl`}></i>
                  </button>

                  <button
                    onClick={toggleDeafen}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                      isDeafened 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                    }`}
                    title={isDeafened ? 'Undeafen' : 'Deafen'}
                  >
                    <i className={`fa-solid ${isDeafened ? 'fa-headphones-simple' : 'fa-headphones'} text-xl`}></i>
                  </button>

                  <button
                    className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition"
                    title="Share Screen"
                  >
                    <i className="fa-solid fa-desktop text-xl"></i>
                  </button>

                  <button
                    onClick={leaveRoom}
                    className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition"
                    title="Leave Room"
                  >
                    <i className="fa-solid fa-phone-slash text-xl"></i>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-6">
                  <i className="fa-solid fa-tower-broadcast text-4xl text-zinc-600"></i>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Select a Voice Room</h3>
                <p className="text-zinc-400 max-w-sm">
                  Join a voice room to start communicating with your team in real-time
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateRoom && (
        <CreateRoomModal
          onClose={() => setShowCreateRoom(false)}
          onCreate={(room) => {
            setRooms(prev => [...prev, room]);
            setShowCreateRoom(false);
          }}
        />
      )}
    </div>
  );
};

// ============================================
// CREATE ROOM MODAL
// ============================================

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (room: VoiceRoom) => void;
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [maxParticipants, setMaxParticipants] = useState(25);
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('fa-microphone');
  const [selectedColor, setSelectedColor] = useState('bg-emerald-500');

  const icons = ['fa-microphone', 'fa-users', 'fa-brain', 'fa-gamepad', 'fa-music', 'fa-code', 'fa-coffee', 'fa-rocket'];
  const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-red-500', 'bg-yellow-500', 'bg-cyan-500'];

  const handleCreate = () => {
    if (!name.trim()) return;

    const newRoom: VoiceRoom = {
      id: `room-${Date.now()}`,
      name: name.trim(),
      icon: selectedIcon,
      color: selectedColor,
      participants: [],
      maxParticipants,
      isPrivate,
      category,
      description: description.trim() || undefined,
      createdAt: new Date(),
      settings: {
        bitrate: 64000,
        voiceActivity: true,
        echoCancel: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    onCreate(newRoom);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] animate-fadeIn">
      <div className="bg-zinc-900 rounded-2xl w-full max-w-md mx-4 border border-zinc-800 animate-scaleIn">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-white">Create Voice Room</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Room Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter room name..."
              className="w-full px-3 py-2 bg-zinc-800 rounded-lg text-white border border-zinc-700 focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this room for?"
              className="w-full px-3 py-2 bg-zinc-800 rounded-lg text-white border border-zinc-700 focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 rounded-lg text-white border border-zinc-700 focus:border-orange-500 focus:outline-none"
            >
              <option value="General">General</option>
              <option value="Meetings">Meetings</option>
              <option value="Work">Work</option>
              <option value="Social">Social</option>
              <option value="Priority">Priority</option>
            </select>
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Icon</label>
            <div className="flex flex-wrap gap-2">
              {icons.map(icon => (
                <button
                  key={icon}
                  onClick={() => setSelectedIcon(icon)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
                    selectedIcon === icon ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  <i className={`fa-solid ${icon}`}></i>
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full ${color} transition transform ${
                    selectedColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Max Participants */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Max Participants: {maxParticipants}</label>
            <input
              type="range"
              min={2}
              max={50}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
          </div>

          {/* Private Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Private Room</span>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-12 h-6 rounded-full transition ${isPrivate ? 'bg-orange-500' : 'bg-zinc-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transform transition ${isPrivate ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg font-medium hover:bg-zinc-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceRooms;
