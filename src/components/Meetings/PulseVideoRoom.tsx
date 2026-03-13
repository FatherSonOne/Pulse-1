/**
 * PulseVideoRoom.tsx
 * Full-featured video meeting room powered by Daily.co.
 * Uses @daily-co/daily-react for hooks + DailyVideo for rendering.
 *
 * Features: video grid, audio/video controls, screen share,
 * cloud recording, live transcription, in-meeting chat, participants panel.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import DailyIframe, { DailyCall, DailyEventObjectParticipant } from '@daily-co/daily-js';
import {
  DailyProvider,
  useDaily,
  useDailyEvent,
  useLocalSessionId,
  useParticipantIds,
  useParticipant,
  DailyVideo,
  DailyAudio,
} from '@daily-co/daily-react';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  Circle, Square, MessageSquare, Users, PhoneOff,
  Copy, ChevronDown, Loader2, Wand2, X,
} from 'lucide-react';
import {
  getMeetingToken,
  markRoomActive,
  markRoomEnded,
  notifyRecordingStarted,
  notifyRecordingStopped,
  saveTranscript,
  pollForRecording,
} from '../../services/pulseVideoService';
import { supabase } from '../../services/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MeetingEndSummary {
  durationSeconds: number;
  participantCount: number;
  transcript: string;
  summary: string;
  recordingStarted: boolean;
}

interface PulseVideoRoomProps {
  roomUrl: string;
  roomName: string;
  meetingTitle?: string;
  isHost?: boolean;
  onLeave: (summary?: MeetingEndSummary) => void;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: Date;
  isLocal: boolean;
}

interface TranscriptLine {
  speaker: string;
  text: string;
  isFinal: boolean;
}

// ── Participant tile ───────────────────────────────────────────────────────────

const ParticipantTile: React.FC<{ sessionId: string; isLocal?: boolean }> = ({ sessionId, isLocal }) => {
  const participant = useParticipant(sessionId);
  const videoOff = isLocal
    ? !participant?.local || participant?.tracks?.video?.state === 'off'
    : participant?.tracks?.video?.state === 'off' || participant?.tracks?.video?.state === 'blocked';

  const initials = (participant?.user_name ?? 'G')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Color from name hash
  const hue = (participant?.user_name ?? 'G')
    .split('')
    .reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-black/60 border border-white/10">
      {videoOff ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: `hsl(${hue}, 45%, 18%)` }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white"
            style={{ background: `hsl(${hue}, 65%, 40%)` }}
          >
            {initials}
          </div>
        </div>
      ) : (
        <DailyVideo
          sessionId={sessionId}
          type="video"
          mirror={isLocal}
          className="w-full h-full object-cover"
        />
      )}

      {/* Name label */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
        <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm truncate">
          {participant?.user_name ?? 'Guest'}{isLocal ? ' (You)' : ''}
        </span>
        {participant?.tracks?.audio?.state === 'off' && (
          <span className="bg-rose-500/80 rounded-full p-0.5">
            <MicOff size={10} className="text-white" />
          </span>
        )}
      </div>
    </div>
  );
};

// ── Inner meeting room (must be inside DailyProvider) ─────────────────────────

const MeetingRoom: React.FC<{
  roomUrl: string;
  roomName: string;
  meetingTitle: string;
  isHost: boolean;
  token: string;
  onLeave: (summary?: MeetingEndSummary) => void;
}> = ({ roomUrl, roomName, meetingTitle, isHost, token, onLeave }) => {
  const daily = useDaily();
  const localId = useLocalSessionId();
  const remoteIds = useParticipantIds({ filter: 'remote' });

  const [isJoined, setIsJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sidePanel, setSidePanel] = useState<'none' | 'chat' | 'participants'>('none');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [transcriptEnabled, setTranscriptEnabled] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const allParticipants = localId ? [localId, ...remoteIds] : remoteIds;

  // ── Join room on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!daily || !roomUrl || !token) return;
    daily.join({ url: roomUrl, token }).then(() => {
      setIsJoined(true);
      markRoomActive(roomName);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      daily.leave().catch(() => {});
    };
  }, [daily, roomUrl, token, roomName]);

  // ── Daily events ────────────────────────────────────────────────────────────
  useDailyEvent('recording-started', useCallback(() => {
    setIsRecording(true);
    notifyRecordingStarted(roomName);
  }, [roomName]));

  useDailyEvent('recording-stopped', useCallback(() => {
    setIsRecording(false);
    notifyRecordingStopped(roomName);
  }, [roomName]));

  useDailyEvent('app-message', useCallback((evt: { data?: { type?: string; text?: string; sender?: string } }) => {
    if (evt?.data?.type === 'chat') {
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        sender: evt.data?.sender ?? 'Guest',
        text: evt.data?.text ?? '',
        time: new Date(),
        isLocal: false,
      }]);
    }
  }, []));

  useDailyEvent('transcription-message', useCallback((evt: { text?: string; is_final?: boolean; session_id?: string }) => {
    const participant = daily?.participants()?.[evt?.session_id ?? ''];
    setTranscriptLines(prev => {
      const last = prev[prev.length - 1];
      if (last && !last.isFinal) {
        return [...prev.slice(0, -1), {
          speaker: participant?.user_name ?? 'Guest',
          text: evt?.text ?? '',
          isFinal: evt?.is_final ?? false,
        }];
      }
      return [...prev, {
        speaker: participant?.user_name ?? 'Guest',
        text: evt?.text ?? '',
        isFinal: evt?.is_final ?? false,
      }];
    });
  }, [daily]));

  // ── Controls ────────────────────────────────────────────────────────────────
  const toggleMic = () => {
    daily?.setLocalAudio(!micOn);
    setMicOn(v => !v);
  };

  const toggleCamera = () => {
    daily?.setLocalVideo(!cameraOn);
    setCameraOn(v => !v);
  };

  const toggleScreenShare = async () => {
    if (!daily) return;
    if (screenSharing) {
      await daily.stopScreenShare();
      setScreenSharing(false);
    } else {
      await daily.startScreenShare();
      setScreenSharing(true);
    }
  };

  const toggleRecording = async () => {
    if (!daily || !isHost) return;
    if (isRecording) {
      daily.stopRecording();
    } else {
      daily.startRecording();
    }
  };

  const toggleTranscription = async () => {
    if (!daily || !isHost) return;
    if (transcriptEnabled) {
      daily.stopTranscription();
      setTranscriptEnabled(false);
    } else {
      daily.startTranscription({ language: 'en' });
      setTranscriptEnabled(true);
    }
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !daily) return;
    const text = chatInput.trim();
    const senderName = daily.participants()?.local?.user_name ?? 'You';
    daily.sendAppMessage({ type: 'chat', text, sender: senderName }, '*');
    setChatMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      sender: 'You',
      text,
      time: new Date(),
      isLocal: true,
    }]);
    setChatInput('');
  };

  const handleLeave = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    if (transcriptLines.length > 0) {
      setIsSummarizing(true);
      const fullTranscript = transcriptLines
        .filter(l => l.isFinal)
        .map(l => `${l.speaker}: ${l.text}`)
        .join('\n');

      let summary = '';
      try {
        // Use Gemini to summarize if available
        const { generateSummary } = await import('../../services/geminiService');
        summary = await generateSummary(fullTranscript);
      } catch {
        summary = `Meeting lasted ${Math.floor(duration / 60)} minutes with ${allParticipants.length} participant(s).`;
      }

      await saveTranscript(roomName, fullTranscript, summary);
      await markRoomEnded(roomName, duration);
      setIsSummarizing(false);

      onLeave({
        durationSeconds: duration,
        participantCount: allParticipants.length,
        transcript: fullTranscript,
        summary,
        recordingStarted: isRecording,
      });
    } else {
      await markRoomEnded(roomName, duration);
      onLeave({ durationSeconds: duration, participantCount: allParticipants.length, transcript: '', summary: '', recordingStarted: isRecording });
    }
  };

  // ── Format timer ────────────────────────────────────────────────────────────
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ── Video grid layout ────────────────────────────────────────────────────────
  const totalTiles = allParticipants.length;
  const gridCols = totalTiles <= 1 ? 1 : totalTiles <= 4 ? 2 : totalTiles <= 9 ? 3 : 4;

  if (!isJoined) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-rose-500" />
          <p className="text-sm text-white/60">Connecting to {meetingTitle}…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black text-white select-none">
      {/* ── DailyAudio handles all remote audio automatically */}
      <DailyAudio />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/80 border-b border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="font-semibold text-sm truncate max-w-xs">{meetingTitle}</span>
          {isRecording && (
            <span className="flex items-center gap-1 bg-rose-500/20 text-rose-400 text-xs px-2 py-0.5 rounded-full border border-rose-500/30">
              <Circle size={6} className="fill-rose-400" /> REC
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-white/50">
          <span>{formatTime(elapsed)}</span>
          <span>{allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 p-3 overflow-hidden">
          <div
            className="w-full h-full grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              gridAutoRows: `minmax(0, 1fr)`,
            }}
          >
            {localId && <ParticipantTile sessionId={localId} isLocal />}
            {remoteIds.map(id => <ParticipantTile key={id} sessionId={id} />)}
          </div>
        </div>

        {/* Side panel */}
        {sidePanel !== 'none' && (
          <div className="w-72 bg-zinc-900/90 border-l border-white/10 flex flex-col backdrop-blur-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="font-medium text-sm capitalize">{sidePanel}</span>
              <button type="button" aria-label="Close panel" onClick={() => setSidePanel('none')} className="text-white/40 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {sidePanel === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {chatMessages.length === 0 && (
                    <p className="text-white/30 text-xs text-center pt-4">No messages yet</p>
                  )}
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.isLocal ? 'items-end' : 'items-start'}`}>
                      <span className="text-white/40 text-xs mb-0.5">{msg.sender}</span>
                      <div className={`px-3 py-1.5 rounded-xl text-sm max-w-[90%] ${
                        msg.isLocal ? 'bg-rose-500/20 text-rose-100' : 'bg-white/10 text-white'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-white/10">
                  <form onSubmit={e => { e.preventDefault(); sendChatMessage(); }} className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Message…"
                      className="flex-1 bg-white/10 text-white text-sm px-3 py-1.5 rounded-lg outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-500/50"
                    />
                    <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">
                      Send
                    </button>
                  </form>
                </div>
              </>
            )}

            {sidePanel === 'participants' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {allParticipants.map(id => {
                  const isLocal = id === localId;
                  return (
                    <ParticipantRow key={id} sessionId={id} isLocal={isLocal} />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Live transcript ─────────────────────────────────────────────────── */}
      {transcriptEnabled && transcriptLines.length > 0 && (
        <div className="px-4 pb-2 max-h-20 overflow-y-auto">
          {transcriptLines.slice(-3).map((line, i) => (
            <p key={i} className={`text-xs ${line.isFinal ? 'text-white/70' : 'text-white/40 italic'}`}>
              <span className="text-rose-400 font-medium">{line.speaker}:</span> {line.text}
            </p>
          ))}
        </div>
      )}

      {/* ── Controls bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 px-6 py-4 bg-zinc-900/80 border-t border-white/10 backdrop-blur-sm">
        {/* Mic */}
        <ControlButton active={micOn} onClick={toggleMic} activeIcon={<Mic size={18} />} inactiveIcon={<MicOff size={18} />} label="Mic" danger={!micOn} />

        {/* Camera */}
        <ControlButton active={cameraOn} onClick={toggleCamera} activeIcon={<Video size={18} />} inactiveIcon={<VideoOff size={18} />} label="Camera" danger={!cameraOn} />

        {/* Screen share */}
        <ControlButton active={!screenSharing} onClick={toggleScreenShare} activeIcon={<Monitor size={18} />} inactiveIcon={<MonitorOff size={18} />} label="Share" highlight={screenSharing} />

        {/* Record (host only) */}
        {isHost && (
          <ControlButton
            active={!isRecording}
            onClick={toggleRecording}
            activeIcon={<Circle size={18} />}
            inactiveIcon={<Square size={18} />}
            label={isRecording ? 'Stop Rec' : 'Record'}
            danger={isRecording}
          />
        )}

        {/* Transcription (host only) */}
        {isHost && (
          <ControlButton
            active={!transcriptEnabled}
            onClick={toggleTranscription}
            activeIcon={<Wand2 size={18} />}
            inactiveIcon={<Wand2 size={18} />}
            label={transcriptEnabled ? 'Stop AI' : 'AI Notes'}
            highlight={transcriptEnabled}
          />
        )}

        {/* Chat */}
        <ControlButton
          active={sidePanel !== 'chat'}
          onClick={() => setSidePanel(p => p === 'chat' ? 'none' : 'chat')}
          activeIcon={<MessageSquare size={18} />}
          inactiveIcon={<MessageSquare size={18} />}
          label="Chat"
          highlight={sidePanel === 'chat'}
        />

        {/* Participants */}
        <ControlButton
          active={sidePanel !== 'participants'}
          onClick={() => setSidePanel(p => p === 'participants' ? 'none' : 'participants')}
          activeIcon={<Users size={18} />}
          inactiveIcon={<Users size={18} />}
          label={`People (${allParticipants.length})`}
          highlight={sidePanel === 'participants'}
        />

        {/* Leave */}
        <button
          type="button"
          onClick={() => setShowEndConfirm(true)}
          className="flex flex-col items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white px-5 py-2 rounded-xl transition-colors ml-4"
        >
          <PhoneOff size={18} />
          <span className="text-[10px] font-medium">Leave</span>
        </button>
      </div>

      {/* ── End call confirmation ────────────────────────────────────────────── */}
      {showEndConfirm && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-80 text-center space-y-4">
            {isSummarizing ? (
              <>
                <Loader2 size={28} className="animate-spin text-rose-500 mx-auto" />
                <p className="text-white font-medium">Generating AI summary…</p>
                <p className="text-white/50 text-sm">This takes a few seconds</p>
              </>
            ) : (
              <>
                <PhoneOff size={28} className="text-rose-500 mx-auto" />
                <p className="text-white font-semibold">Leave the meeting?</p>
                {transcriptLines.filter(l => l.isFinal).length > 0 && (
                  <p className="text-white/50 text-sm">We'll generate an AI summary from the transcript.</p>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowEndConfirm(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl transition-colors text-sm">
                    Stay
                  </button>
                  <button type="button" onClick={handleLeave} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-xl transition-colors text-sm font-medium">
                    Leave
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Participant row for side panel ─────────────────────────────────────────────

const ParticipantRow: React.FC<{ sessionId: string; isLocal: boolean }> = ({ sessionId, isLocal }) => {
  const participant = useParticipant(sessionId);
  const name = participant?.user_name ?? 'Guest';
  const hue = name.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360;
  const isMuted = participant?.tracks?.audio?.state === 'off';
  const isVideoOff = participant?.tracks?.video?.state === 'off';

  return (
    <div className="flex items-center gap-2 py-1">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ background: `hsl(${hue}, 65%, 40%)` }}
      >
        {name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
      </div>
      <span className="flex-1 text-sm text-white/90 truncate">{name}{isLocal ? ' (You)' : ''}</span>
      {isMuted && <MicOff size={12} className="text-rose-400 shrink-0" />}
      {isVideoOff && <VideoOff size={12} className="text-white/30 shrink-0" />}
    </div>
  );
};

// ── Control button ─────────────────────────────────────────────────────────────

const ControlButton: React.FC<{
  active: boolean;
  onClick: () => void;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  label: string;
  danger?: boolean;
  highlight?: boolean;
}> = ({ active, onClick, activeIcon, inactiveIcon, label, danger, highlight }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
      danger
        ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
        : highlight
        ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
        : 'bg-white/10 text-white/80 hover:bg-white/20'
    }`}
  >
    {active ? activeIcon : inactiveIcon}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

// ── Lobby (pre-join) ───────────────────────────────────────────────────────────

const Lobby: React.FC<{
  meetingTitle: string;
  roomUrl: string;
  onJoin: () => void;
  onCancel: () => void;
}> = ({ meetingTitle, roomUrl, onJoin, onCancel }) => {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/meet/${roomUrl.split('/').pop()}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center h-full bg-black text-white">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
            <Video size={24} className="text-rose-400" />
          </div>
          <h2 className="text-xl font-semibold">{meetingTitle}</h2>
          <p className="text-white/50 text-sm">Ready to join?</p>
        </div>

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <span className="flex-1 text-xs text-white/40 truncate">
            {window.location.origin}/meet/{roomUrl.split('/').pop()}
          </span>
          <button type="button" aria-label="Copy meeting link" onClick={copyLink} className="text-white/40 hover:text-rose-400 transition-colors shrink-0">
            <Copy size={14} />
          </button>
          {copied && <span className="text-rose-400 text-xs">Copied!</span>}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl transition-colors text-sm">
            Cancel
          </button>
          <button type="button" onClick={onJoin} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl transition-colors text-sm font-semibold">
            Join Now
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Root component ─────────────────────────────────────────────────────────────

const PulseVideoRoom: React.FC<PulseVideoRoomProps> = ({
  roomUrl,
  roomName,
  meetingTitle = 'Pulse Meeting',
  isHost = false,
  onLeave,
}) => {
  const [stage, setStage] = useState<'lobby' | 'joining' | 'active'>('lobby');
  const [token, setToken] = useState('');
  const [callObject, setCallObject] = useState<DailyCall | null>(null);

  const handleJoin = async () => {
    setStage('joining');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const displayName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Guest';
      const tok = await getMeetingToken(roomName, isHost, displayName);
      setToken(tok);

      const co = DailyIframe.createCallObject({ url: roomUrl, token: tok });
      setCallObject(co);
      setStage('active');
    } catch (err) {
      console.error('[PulseVideoRoom] Join failed:', err);
      setStage('lobby');
    }
  };

  const handleLeave = (summary?: MeetingEndSummary) => {
    callObject?.destroy();
    setCallObject(null);
    onLeave(summary);
  };

  if (stage === 'lobby') {
    return <Lobby meetingTitle={meetingTitle} roomUrl={roomUrl} onJoin={handleJoin} onCancel={() => onLeave()} />;
  }

  if (stage === 'joining' || !callObject) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <Loader2 size={28} className="animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <MeetingRoom
        roomUrl={roomUrl}
        roomName={roomName}
        meetingTitle={meetingTitle}
        isHost={isHost}
        token={token}
        onLeave={handleLeave}
      />
    </DailyProvider>
  );
};

export default PulseVideoRoom;
