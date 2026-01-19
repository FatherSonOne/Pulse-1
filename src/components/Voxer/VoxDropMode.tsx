import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Mic,
  Play,
  Pause,
  Plus,
  Calendar,
  ChevronLeft,
  Users,
  Gift,
  Trash2,
  Edit3,
  Send,
  X,
  Check,
  Repeat,
  MapPin,
  Lock,
  Timer,
  Square
} from 'lucide-react';
import VoxAudioVisualizer from './VoxAudioVisualizer';
import RecordingPreview from './RecordingPreview';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { voxModeService } from '../../services/voxer/voxModeService';
import type { VoxDrop } from '../../services/voxer/voxModeTypes';
import './Voxer.css';

// Mode color for Vox Drop
const MODE_COLOR = '#EF4444';

interface VoxDropModeProps {
  contacts?: any[];
  apiKey?: string;
  onBack: () => void;
  isDarkMode?: boolean;
}

const VoxDropMode: React.FC<VoxDropModeProps> = ({
  contacts = [],
  apiKey,
  onBack,
  isDarkMode = false,
}) => {
  const [scheduledDrops, setScheduledDrops] = useState<VoxDrop[]>([]);
  const [receivedDrops, setReceivedDrops] = useState<VoxDrop[]>([]);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'received'>('scheduled');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingDropId, setPlayingDropId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [showNewDrop, setShowNewDrop] = useState(false);
  const [pulseContacts, setPulseContacts] = useState<any[]>([]);

  // New drop form state
  const [dropTitle, setDropTitle] = useState('');
  const [dropMessage, setDropMessage] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('yearly');
  const [revealType, setRevealType] = useState<'date' | 'location' | 'custom' | null>(null);
  const [revealValue, setRevealValue] = useState('');

  const audioRef = useRef<HTMLAudioElement>(null);

  // Use the recording hook for click-to-record with preview
  const {
    state: recordingState,
    duration: recordingDuration,
    analyser,
    recordingData,
    startRecording,
    stopRecording,
    cancelRecording,
    sendRecording,
  } = useVoxRecording({
    onRecordingComplete: (data) => {
      console.log('Vox Drop recording complete:', data.duration, 'seconds');
    },
  });

  const handleRecordToggle = () => {
    if (recordingState === 'recording') {
      stopRecording();
    } else if (recordingState === 'idle') {
      startRecording();
    }
  };

  useEffect(() => {
    loadDrops();
    loadPulseContacts();
  }, []);

  const loadPulseContacts = async () => {
    const pulseUsers = await voxModeService.getPulseUsersAsContacts();
    setPulseContacts(pulseUsers);
  };

  const loadDrops = async () => {
    const [scheduled, received] = await Promise.all([
      voxModeService.getMyScheduledDrops(),
      voxModeService.getReceivedDrops(),
    ]);
    setScheduledDrops(scheduled);
    setReceivedDrops(received);
  };

  const handlePlayDrop = (drop: VoxDrop) => {
    if (playingDropId === drop.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.src = drop.audioUrl;
        audioRef.current.play();
        setPlayingDropId(drop.id);
        setIsPlaying(true);
      }
    }
  };

  const handleCancelDrop = async (dropId: string) => {
    const success = await voxModeService.cancelVoxDrop(dropId);
    if (success) {
      setScheduledDrops(scheduledDrops.filter(d => d.id !== dropId));
    }
  };

  const handleScheduleDrop = async () => {
    if (!recordingData || selectedRecipients.length === 0 || !scheduledDate || !scheduledTime) {
      return;
    }

    const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);

    const drop = await voxModeService.uploadAndScheduleVoxDrop(
      selectedRecipients,
      recordingData.blob,
      recordingData.duration,
      scheduledFor,
      dropTitle || undefined,
      dropMessage || undefined
    );

    if (drop) {
      setScheduledDrops([drop, ...scheduledDrops]);
      resetForm();
    }
  };

  const resetForm = () => {
    setShowNewDrop(false);
    setDropTitle('');
    setDropMessage('');
    setSelectedRecipients([]);
    setScheduledDate('');
    setScheduledTime('');
    setIsRecurring(false);
    setRevealType(null);
    setRevealValue('');
    cancelRecording();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatScheduledDate = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 0) return 'Overdue';
    if (hours < 1) return 'Less than an hour';
    if (hours < 24) return `In ${hours} hours`;
    if (days === 1) return 'Tomorrow';
    if (days < 7) return `In ${days} days`;
    if (days < 30) return `In ${Math.floor(days / 7)} weeks`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'text-blue-400 bg-blue-500/20';
      case 'delivered': return 'text-green-400 bg-green-500/20';
      case 'opened': return 'text-purple-400 bg-purple-500/20';
      case 'expired': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getMinDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // Theme classes for consistent styling
  const tc = {
    // Backgrounds
    pageBg: isDarkMode
      ? 'bg-gradient-to-br from-gray-900 via-red-900/10 to-gray-900'
      : 'bg-gradient-to-br from-slate-50 via-red-50/30 to-white',
    panelBg: isDarkMode
      ? 'bg-gray-900/60 backdrop-blur-xl'
      : 'bg-white/80 backdrop-blur-xl',
    cardBg: isDarkMode
      ? 'bg-gray-800/40 backdrop-blur-sm'
      : 'bg-white/60 backdrop-blur-sm',
    inputBg: isDarkMode
      ? 'bg-gray-800/60 border-gray-700/50'
      : 'bg-white/80 border-gray-200/60',
    hoverBg: isDarkMode
      ? 'hover:bg-gray-800/60'
      : 'hover:bg-gray-100/80',
    activeBg: isDarkMode
      ? 'bg-red-500/20'
      : 'bg-red-500/10',

    // Borders
    border: isDarkMode ? 'border-gray-800/60' : 'border-gray-200/60',
    borderAccent: isDarkMode ? 'border-red-500/30' : 'border-red-400/40',

    // Text
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    textAccent: 'text-red-500',

    // Buttons
    btnPrimary: 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg shadow-red-500/25',
    btnSecondary: isDarkMode
      ? 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 border border-gray-700/50'
      : 'bg-white/80 hover:bg-gray-100/80 text-gray-700 border border-gray-200/60',
    btnGhost: isDarkMode
      ? 'hover:bg-gray-800/60 text-gray-400 hover:text-white'
      : 'hover:bg-gray-100/80 text-gray-500 hover:text-gray-900',

    // Modal
    modalOverlay: 'bg-black/60 backdrop-blur-sm',
    modalBg: isDarkMode
      ? 'bg-gray-900/95 backdrop-blur-xl border-gray-800/60'
      : 'bg-white/95 backdrop-blur-xl border-gray-200/60',
  };

  return (
    <div className={`h-full flex flex-col ${tc.pageBg}`}>
      {/* Header */}
      <div
        className={`px-4 md:px-6 py-4 border-b ${tc.border} ${tc.panelBg}`}
        style={{
          background: isDarkMode
            ? `linear-gradient(135deg, rgba(239,68,68,0.15) 0%, transparent 50%)`
            : `linear-gradient(135deg, rgba(239,68,68,0.1) 0%, transparent 50%)`
        }}
      >
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={onBack}
            className={`p-2 rounded-xl ${tc.btnGhost} transition-all duration-200`}
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div
            className="p-2.5 rounded-xl shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #ec4899 100%)`,
              boxShadow: `0 8px 24px ${MODE_COLOR}40`
            }}
          >
            <Clock className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className={`text-lg md:text-xl font-bold ${tc.text}`}>Vox Drop</h1>
            <p className={`text-xs md:text-sm ${tc.textSecondary} hidden sm:block`}>Messages From the Future</p>
          </div>

          <button
            onClick={() => setShowNewDrop(true)}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${tc.btnPrimary}`}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Schedule Drop</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`px-4 md:px-6 py-3 border-b ${tc.border} ${tc.cardBg}`}>
        <div className={`flex gap-1 rounded-xl p-1 w-fit ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/80'}`}>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'scheduled'
                ? `${tc.btnPrimary}`
                : `${tc.textSecondary} ${tc.hoverBg}`
            }`}
          >
            <Send className="w-4 h-4 inline mr-2" />
            Scheduled ({scheduledDrops.length})
          </button>
          <button
            onClick={() => setActiveTab('received')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'received'
                ? `${tc.btnPrimary}`
                : `${tc.textSecondary} ${tc.hoverBg}`
            }`}
          >
            <Gift className="w-4 h-4 inline mr-2" />
            Received ({receivedDrops.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === 'scheduled' ? (
          <div className="space-y-4">
            {scheduledDrops.map((drop) => (
              <div
                key={drop.id}
                className={`p-4 rounded-2xl border transition-all group ${tc.cardBg} ${tc.border} hover:border-red-500/30`}
              >
                <div className="flex items-start gap-3 md:gap-4">
                  {/* Play Button */}
                  <button
                    onClick={() => handlePlayDrop(drop)}
                    className="w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
                    style={{
                      background: playingDropId === drop.id && isPlaying
                        ? MODE_COLOR
                        : isDarkMode ? 'rgba(55,65,81,0.5)' : 'rgba(229,231,235,0.8)',
                      boxShadow: playingDropId === drop.id && isPlaying ? `0 4px 12px ${MODE_COLOR}50` : 'none'
                    }}
                    aria-label={playingDropId === drop.id && isPlaying ? 'Pause' : 'Play'}
                  >
                    {playingDropId === drop.id && isPlaying ? (
                      <Pause className="w-5 h-5 text-white" />
                    ) : (
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* Title & Status */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className={`font-semibold truncate ${tc.text}`}>
                        {drop.title || 'Untitled Drop'}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(drop.status)}`}>
                        {drop.status}
                      </span>
                      {drop.isRecurring && (
                        <Repeat className={`w-4 h-4 ${tc.textMuted}`} />
                      )}
                    </div>

                    {/* Recipients */}
                    <div className="flex items-center gap-2 mb-2">
                      <Users className={`w-4 h-4 ${tc.textMuted}`} />
                      <span className={`text-sm ${tc.textSecondary}`}>
                        {drop.recipientIds.length} recipient{drop.recipientIds.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Scheduled Time */}
                    <div className="flex items-center gap-3 md:gap-4 text-sm flex-wrap">
                      <span className="flex items-center gap-1" style={{ color: MODE_COLOR }}>
                        <Calendar className="w-4 h-4" />
                        {formatScheduledDate(drop.scheduledFor)}
                      </span>
                      <span className={tc.textMuted}>
                        {drop.scheduledFor.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`flex items-center gap-1 ${tc.textMuted}`}>
                        <Timer className="w-3 h-3" />
                        {formatDuration(drop.duration)}
                      </span>
                    </div>

                    {/* Reveal Condition */}
                    {drop.revealCondition && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-purple-400">
                        <Lock className="w-3 h-3" />
                        {drop.revealCondition.description}
                      </div>
                    )}

                    {/* Message */}
                    {drop.message && (
                      <p className={`mt-2 text-sm line-clamp-2 ${tc.textSecondary}`}>
                        {drop.message}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button className={`p-2 rounded-xl ${tc.btnGhost}`} aria-label="Edit">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCancelDrop(drop.id)}
                      className={`p-2 rounded-xl ${tc.btnGhost} hover:text-red-400`}
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Waveform for playing */}
                {playingDropId === drop.id && (
                  <div className="mt-4">
                    <VoxAudioVisualizer
                      analyser={null}
                      isActive={false}
                      isPlaying={isPlaying}
                      playbackProgress={playbackProgress}
                      mode="waveform"
                      color={MODE_COLOR}
                      height={40}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                )}
              </div>
            ))}

            {scheduledDrops.length === 0 && (
              <div className={`text-center py-12 ${tc.textMuted}`}>
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${MODE_COLOR}20 0%, ${MODE_COLOR}10 100%)`,
                    border: `1px solid ${MODE_COLOR}30`
                  }}
                >
                  <Clock className="w-8 h-8" style={{ color: MODE_COLOR, opacity: 0.6 }} />
                </div>
                <p className={tc.text}>No scheduled drops</p>
                <p className={`text-sm mt-1 ${tc.textSecondary}`}>Create a time capsule for someone special</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {receivedDrops.map((drop) => (
              <div
                key={drop.id}
                className="p-4 rounded-2xl border transition-all group"
                style={{
                  background: `linear-gradient(135deg, ${MODE_COLOR}10 0%, rgba(236,72,153,0.1) 100%)`,
                  borderColor: `${MODE_COLOR}30`
                }}
              >
                <div className="flex items-start gap-3 md:gap-4">
                  {/* Gift Icon / Play */}
                  <button
                    onClick={() => handlePlayDrop(drop)}
                    className="w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
                    style={{
                      background: playingDropId === drop.id && isPlaying
                        ? MODE_COLOR
                        : `${MODE_COLOR}30`,
                      boxShadow: playingDropId === drop.id && isPlaying ? `0 4px 12px ${MODE_COLOR}50` : 'none'
                    }}
                    aria-label={playingDropId === drop.id && isPlaying ? 'Pause' : 'Play'}
                  >
                    {drop.status === 'delivered' ? (
                      <Gift className="w-5 h-5" style={{ color: MODE_COLOR }} />
                    ) : playingDropId === drop.id && isPlaying ? (
                      <Pause className="w-5 h-5 text-white" />
                    ) : (
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold mb-1 ${tc.text}`}>
                      {drop.title || 'A message for you'}
                    </h3>
                    <p className={`text-sm mb-2 ${tc.textSecondary}`}>
                      Delivered {drop.deliveredAt?.toLocaleDateString()}
                    </p>
                    {drop.message && (
                      <p className={`text-sm ${tc.textSecondary}`}>{drop.message}</p>
                    )}
                  </div>
                </div>

                {playingDropId === drop.id && (
                  <div className="mt-4">
                    <VoxAudioVisualizer
                      analyser={null}
                      isActive={false}
                      isPlaying={isPlaying}
                      playbackProgress={playbackProgress}
                      mode="waveform"
                      color={MODE_COLOR}
                      height={40}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                )}
              </div>
            ))}

            {receivedDrops.length === 0 && (
              <div className={`text-center py-12 ${tc.textMuted}`}>
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${MODE_COLOR}20 0%, ${MODE_COLOR}10 100%)`,
                    border: `1px solid ${MODE_COLOR}30`
                  }}
                >
                  <Gift className="w-8 h-8" style={{ color: MODE_COLOR, opacity: 0.6 }} />
                </div>
                <p className={tc.text}>No received drops yet</p>
                <p className={`text-sm mt-1 ${tc.textSecondary}`}>Time capsules from others will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => {
          const audio = e.target as HTMLAudioElement;
          setPlaybackProgress(audio.currentTime / audio.duration);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setPlaybackProgress(0);
        }}
      />

      {/* New Drop Modal */}
      {showNewDrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className={tc.modalOverlay} onClick={resetForm} />
          <div className={`relative w-full max-w-lg rounded-2xl border ${tc.modalBg} p-6 my-8`}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="p-2 rounded-xl"
                style={{ background: `linear-gradient(135deg, ${MODE_COLOR} 0%, #ec4899 100%)` }}
              >
                <Clock className="w-5 h-5 text-white" />
              </div>
              <h3 className={`text-xl font-bold ${tc.text}`}>Schedule a Vox Drop</h3>
            </div>

            <div className="space-y-5">
              {/* Recording Section */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${tc.textSecondary}`}>
                  Record Your Message
                </label>
                <div className={`p-4 rounded-xl ${tc.cardBg} border ${tc.border}`}>
                  {recordingState === 'preview' && recordingData ? (
                    <RecordingPreview
                      recordingData={recordingData}
                      onSend={() => sendRecording()}
                      onCancel={cancelRecording}
                      onRetry={() => {
                        cancelRecording();
                        setTimeout(() => startRecording(), 100);
                      }}
                      isDarkMode={isDarkMode}
                      modeColor={MODE_COLOR}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <button
                        onClick={handleRecordToggle}
                        className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:scale-105 active:scale-95"
                        style={{
                          background: recordingState === 'recording'
                            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                            : `linear-gradient(135deg, ${MODE_COLOR} 0%, #ec4899 100%)`,
                          boxShadow: recordingState === 'recording'
                            ? '0 8px 32px rgba(239,68,68,0.5)'
                            : `0 8px 32px ${MODE_COLOR}40`
                        }}
                        aria-label={recordingState === 'recording' ? 'Stop recording' : 'Start recording'}
                      >
                        {recordingState === 'recording' && (
                          <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-40" />
                        )}
                        <span className="relative z-10">
                          {recordingState === 'recording' ? (
                            <Square className="w-6 h-6 text-white" />
                          ) : (
                            <Mic className="w-6 h-6 text-white" />
                          )}
                        </span>
                      </button>

                      {recordingState === 'recording' ? (
                        <span className="text-sm font-mono" style={{ color: MODE_COLOR }}>
                          {formatDuration(recordingDuration)}
                        </span>
                      ) : (
                        <p className={`text-xs ${tc.textMuted}`}>Click to record</p>
                      )}

                      {recordingState === 'recording' && (
                        <div className="w-full">
                          <VoxAudioVisualizer
                            analyser={analyser}
                            isActive={true}
                            mode="waveform"
                            color={MODE_COLOR}
                            height={40}
                            isDarkMode={isDarkMode}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${tc.textSecondary}`}>
                  Title (Optional)
                </label>
                <input
                  type="text"
                  value={dropTitle}
                  onChange={(e) => setDropTitle(e.target.value)}
                  placeholder="Birthday Surprise, Future Self Note..."
                  className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all`}
                />
              </div>

              {/* Message */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${tc.textSecondary}`}>
                  Message (Optional)
                </label>
                <textarea
                  value={dropMessage}
                  onChange={(e) => setDropMessage(e.target.value)}
                  placeholder="Add a text note to accompany your vox..."
                  rows={2}
                  className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all resize-none`}
                />
              </div>

              {/* Recipients */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${tc.textSecondary}`}>
                  Recipients
                </label>
                <div className={`max-h-32 overflow-y-auto space-y-1 rounded-xl p-2 ${tc.cardBg} border ${tc.border}`}>
                  {pulseContacts.slice(0, 10).map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => {
                        if (selectedRecipients.includes(contact.id)) {
                          setSelectedRecipients(selectedRecipients.filter(id => id !== contact.id));
                        } else {
                          setSelectedRecipients([...selectedRecipients, contact.id]);
                        }
                      }}
                      className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${
                        selectedRecipients.includes(contact.id)
                          ? `${tc.activeBg} border ${tc.borderAccent}`
                          : tc.hoverBg
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: contact.avatarColor }}
                      >
                        {contact.name.charAt(0)}
                      </div>
                      <span className={`text-sm flex-1 text-left ${tc.text}`}>{contact.name}</span>
                      {selectedRecipients.includes(contact.id) && (
                        <Check className="w-4 h-4" style={{ color: MODE_COLOR }} />
                      )}
                    </button>
                  ))}
                  {pulseContacts.length === 0 && (
                    <p className={`text-center py-4 text-sm ${tc.textMuted}`}>No Pulse users found</p>
                  )}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${tc.textSecondary}`}>
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={getMinDate()}
                    className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${tc.textSecondary}`}>
                    Delivery Time
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl ${tc.inputBg} ${tc.text} border focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all`}
                  />
                </div>
              </div>

              {/* Recurring Option */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
                    isRecurring
                      ? `${tc.activeBg} border ${tc.borderAccent}`
                      : `${tc.cardBg} border ${tc.border} ${tc.textSecondary}`
                  }`}
                  style={isRecurring ? { color: MODE_COLOR } : undefined}
                >
                  <Repeat className="w-4 h-4" />
                  Recurring
                </button>

                {isRecurring && (
                  <select
                    value={recurringFrequency}
                    onChange={(e) => setRecurringFrequency(e.target.value as any)}
                    className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 ${tc.inputBg} ${tc.text} border`}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                )}
              </div>

              {/* Special Reveal Conditions */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${tc.textSecondary}`}>
                  Special Reveal Condition (Optional)
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setRevealType(revealType === 'location' ? null : 'location')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${
                      revealType === 'location'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : `${tc.cardBg} border ${tc.border} ${tc.textSecondary}`
                    }`}
                  >
                    <MapPin className="w-3 h-3" />
                    Location
                  </button>
                  <button
                    onClick={() => setRevealType(revealType === 'custom' ? null : 'custom')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${
                      revealType === 'custom'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : `${tc.cardBg} border ${tc.border} ${tc.textSecondary}`
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    Custom
                  </button>
                </div>
                {revealType && (
                  <input
                    type="text"
                    value={revealValue}
                    onChange={(e) => setRevealValue(e.target.value)}
                    placeholder={
                      revealType === 'location'
                        ? 'Enter location name...'
                        : 'Enter reveal condition...'
                    }
                    className={`w-full mt-2 px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${tc.inputBg} ${tc.text} border`}
                  />
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={resetForm}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnSecondary}`}
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleDrop}
                disabled={!recordingData || selectedRecipients.length === 0 || !scheduledDate || !scheduledTime}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${tc.btnPrimary} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                <Clock className="w-4 h-4" />
                Schedule Drop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoxDropMode;
