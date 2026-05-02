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
} from '../../services/pulseVideoService';
import { supabase } from '../../services/supabaseClient';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';

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
  /** Start with mic muted */
  initialMicOff?: boolean;
  /** Start with camera off */
  initialCameraOff?: boolean;
  /** Auto-start cloud recording (host only) */
  autoRecord?: boolean;
  /** Auto-start live transcription */
  autoTranscribe?: boolean;
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

// ── Identity palette ──────────────────────────────────────────────────────────
// Six tinted-neutral identity colors, desaturated enough to never compete
// with coral signal. Stable-mapped from a name hash so the same person gets
// the same color across sessions.
const IDENTITY_PALETTE = [
  { tile: 'oklch(0.30 0.04 220)', avatar: 'oklch(0.50 0.08 220)' }, // slate
  { tile: 'oklch(0.30 0.03 160)', avatar: 'oklch(0.48 0.07 160)' }, // sage
  { tile: 'oklch(0.30 0.04 30)',  avatar: 'oklch(0.50 0.07 30)' },  // terracotta
  { tile: 'oklch(0.30 0.04 280)', avatar: 'oklch(0.50 0.07 280)' }, // plum
  { tile: 'oklch(0.30 0.04 80)',  avatar: 'oklch(0.50 0.07 80)' },  // amber-mute
  { tile: 'oklch(0.30 0.04 200)', avatar: 'oklch(0.50 0.07 200)' }, // ocean
] as const;

const identityColor = (name: string) => {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return IDENTITY_PALETTE[hash % IDENTITY_PALETTE.length];
};

// ── Participant tile ───────────────────────────────────────────────────────────

const ParticipantTile: React.FC<{ sessionId: string; isLocal?: boolean }> = ({ sessionId, isLocal }) => {
  const participant = useParticipant(sessionId);
  const videoOff = isLocal
    ? !participant?.local || participant?.tracks?.video?.state === 'off'
    : participant?.tracks?.video?.state === 'off' || participant?.tracks?.video?.state === 'blocked';

  const name = participant?.user_name ?? 'Guest';
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const color = identityColor(name);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.08]">
      {videoOff ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: color.tile }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white"
            style={{ background: color.avatar }}
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

      {/* Name label — mono uppercase tracked per Coral Cockpit */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
        <span className="bg-black/60 text-white/90 font-mono uppercase tracking-[0.1em] text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm truncate">
          {participant?.user_name ?? 'Guest'}{isLocal ? ' · YOU' : ''}
        </span>
        {participant?.tracks?.audio?.state === 'off' && (
          <span className="bg-rose-500/80 rounded-full p-0.5" aria-label="Muted">
            <MicOff size={10} className="text-white" />
          </span>
        )}
      </div>
    </div>
  );
};

// ── Waiting-for-participants empty state ──────────────────────────────────────
// When the host (or anyone) is alone in the room, replace the giant grey
// camera-off panel with a quiet centered moment: mono caption, timer as
// centerpiece, copy-link affordance pulled up from the Lobby. Self-preview
// only appears as a small corner tile when the camera is on.

const WaitingForParticipants: React.FC<{
  roomName: string;
  elapsed: number;
  formatTime: (s: number) => string;
  localId: string | undefined;
  cameraOn: boolean;
}> = ({ roomName, elapsed, formatTime, localId, cameraOn }) => {
  const meetingLink = `${window.location.origin}/meet/${roomName}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center text-center bg-white/[0.02] border border-white/[0.06] rounded-xl">
      <div className="space-y-6 max-w-md px-8">
        <div className="space-y-2">
          <p className="font-mono uppercase tracking-[0.1em] text-[11px] text-white/40">
            WAITING FOR PARTICIPANTS
          </p>
          <p
            className="font-mono text-2xl text-white/85"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatTime(elapsed)}
          </p>
        </div>

        <p className="text-sm text-white/55">Share the link to invite someone.</p>

        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.10] rounded-xl px-3 py-2">
          <span
            className="flex-1 font-mono text-[11px] text-white/55 truncate text-left"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {meetingLink}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy meeting link"
            className="text-white/50 hover:text-rose-400 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded p-1"
          >
            <Copy size={14} />
          </button>
          {copied && (
            <span className="font-mono uppercase tracking-[0.1em] text-[10px] text-rose-400">
              COPIED
            </span>
          )}
        </div>
      </div>

      {/* Self-preview corner-tile — only when camera is on */}
      {cameraOn && localId && (
        <div className="absolute bottom-4 right-4 w-40 h-28 rounded-lg overflow-hidden border border-white/[0.10] shadow-lg">
          <ParticipantTile sessionId={localId} isLocal />
        </div>
      )}
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
  initialMicOff: boolean;
  initialCameraOff: boolean;
  autoRecord: boolean;
  autoTranscribe: boolean;
}> = ({ roomUrl, roomName, meetingTitle, isHost, token, onLeave, initialMicOff, initialCameraOff, autoRecord, autoTranscribe }) => {
  const daily = useDaily();
  const localId = useLocalSessionId();
  const remoteIds = useParticipantIds({ filter: 'remote' });

  const [isJoined, setIsJoined] = useState(false);
  const [micOn, setMicOn] = useState(!initialMicOff);
  const [cameraOn, setCameraOn] = useState(!initialCameraOff);
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

      // Apply initial device states from meeting settings
      if (initialMicOff) daily.setLocalAudio(false);
      if (initialCameraOff) daily.setLocalVideo(false);

      // Auto-start recording if enabled (host only).
      // Daily SDK's startRecording/startTranscription return void — errors come
      // back via 'error' / 'recording-error' events, not via promise rejection.
      // Wrap in try/catch only for synchronous throws (e.g. invalid args).
      if (autoRecord && isHost) {
        try { daily.startRecording(); }
        catch (err) { console.warn('[PulseVideoRoom] Auto-record failed:', err); }
      }

      if (autoTranscribe && isHost) {
        try { daily.startTranscription({ language: 'en' }); }
        catch (err) { console.warn('[PulseVideoRoom] Auto-transcribe failed:', err); }
        setTranscriptEnabled(true);
      }
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
        // Use Gemini to summarize if available. The apiKey arg is unused by
        // the service (auth is workspace-derived) but is still in the signature.
        const { generateSummary } = await import('../../services/geminiService');
        summary = (await generateSummary('', fullTranscript)) ?? '';
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
          <Loader2 size={32} className="animate-spin motion-reduce:animate-none text-white/40" />
          <p className="font-mono uppercase tracking-[0.1em] text-[11px] text-white/55">CONNECTING</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* ── DailyAudio handles all remote audio automatically */}
      <DailyAudio />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/80 border-b border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse motion-reduce:animate-none" />
          <span className="font-semibold text-sm truncate max-w-xs">{meetingTitle}</span>
          {isRecording && (
            <span className="flex items-center gap-1 bg-rose-500/15 text-rose-400 font-mono uppercase tracking-[0.1em] text-[10px] px-2 py-0.5 rounded-full border border-rose-500/30">
              <Circle size={6} className="fill-rose-400" /> REC
            </span>
          )}
        </div>
        {/* Timer is the typographic centerpiece — large mono tabular-num */}
        <div className="flex items-center gap-4">
          <span
            className="font-mono text-base text-white/85 tabular-nums leading-none"
            style={{ fontVariantNumeric: 'tabular-nums' }}
            aria-label="Elapsed time"
          >
            {formatTime(elapsed)}
          </span>
          <span className="font-mono uppercase tracking-[0.1em] text-[10px] text-white/40">
            {allParticipants.length} {allParticipants.length === 1 ? 'PARTICIPANT' : 'PARTICIPANTS'}
          </span>
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video grid — or sole-participant waiting state */}
        <div className="flex-1 p-3 overflow-hidden">
          {allParticipants.length <= 1 ? (
            <WaitingForParticipants
              roomName={roomName}
              elapsed={elapsed}
              formatTime={formatTime}
              localId={localId}
              cameraOn={cameraOn}
            />
          ) : (
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
          )}
        </div>

        {/* Side panel */}
        {sidePanel !== 'none' && (
          <div className="w-72 bg-white/[0.03] border-l border-white/[0.06] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="font-mono uppercase tracking-[0.1em] text-[11px] text-white/70">{sidePanel}</span>
              <button type="button" aria-label="Close panel" onClick={() => setSidePanel('none')} className="text-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded">
                <X size={16} />
              </button>
            </div>

            {sidePanel === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {chatMessages.length === 0 && (
                    <p className="text-white/30 font-mono uppercase tracking-[0.1em] text-[10px] text-center pt-4">NO MESSAGES YET</p>
                  )}
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.isLocal ? 'items-end' : 'items-start'}`}>
                      <span className="text-white/40 font-mono uppercase tracking-[0.1em] text-[10px] mb-0.5">{msg.sender}</span>
                      <div className={`px-3 py-1.5 rounded-xl text-sm max-w-[90%] ${
                        msg.isLocal ? 'bg-white/[0.08] text-white' : 'bg-white/[0.04] text-white/90'
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
      {transcriptEnabled && (
        <div className="px-4 pt-2 pb-2 max-h-28 overflow-y-auto border-t border-white/[0.04]">
          <div className="mb-1.5">
            <AIProvenanceChip vendor="DEEPGRAM" type="LIVE" fresh={transcriptLines.length > 0} />
          </div>
          {transcriptLines.length === 0 ? (
            <p className="font-mono uppercase tracking-[0.1em] text-[10px] text-white/30">
              LISTENING
            </p>
          ) : (
            transcriptLines.slice(-3).map((line, i) => (
              <p key={i} className={`text-xs leading-snug ${line.isFinal ? 'text-white/70' : 'text-white/40 italic'}`}>
                <span className="font-mono uppercase tracking-[0.1em] text-[10px] text-rose-400">{line.speaker}</span>{' '}
                <span className="font-sans">{line.text}</span>
              </p>
            ))
          )}
        </div>
      )}

      {/* ── Controls bar ──────────────────────────────────────────────────────
           Three tiers: primary (Mic, Camera) elevated in a tinted group;
           secondary (Share, Record, Transcribe) flat; tertiary (Chat,
           People) icon-only. Leave isolated on the far right. */}
      <div className="flex items-center justify-center gap-3 px-6 py-3 bg-white/[0.03] border-t border-white/[0.06]">
        {/* Primary — elevated group */}
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1">
          <ControlButton active={micOn} onClick={toggleMic} activeIcon={<Mic size={20} />} inactiveIcon={<MicOff size={20} />} label="Mic" danger={!micOn} />
          <ControlButton active={cameraOn} onClick={toggleCamera} activeIcon={<Video size={20} />} inactiveIcon={<VideoOff size={20} />} label="Camera" danger={!cameraOn} />
        </div>

        <div className="h-7 w-px bg-white/[0.08]" aria-hidden="true" />

        {/* Secondary — flat group */}
        <div className="flex items-center gap-1">
          <ControlButton active={!screenSharing} onClick={toggleScreenShare} activeIcon={<Monitor size={18} />} inactiveIcon={<MonitorOff size={18} />} label="Share" highlight={screenSharing} />
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
          {isHost && (
            <ControlButton
              active={!transcriptEnabled}
              onClick={toggleTranscription}
              activeIcon={<Wand2 size={18} />}
              inactiveIcon={<Wand2 size={18} />}
              label={transcriptEnabled ? 'Stop' : 'Transcribe'}
              highlight={transcriptEnabled}
            />
          )}
        </div>

        <div className="h-7 w-px bg-white/[0.08]" aria-hidden="true" />

        {/* Tertiary — icon-only */}
        <div className="flex items-center gap-1">
          <ControlButton
            active={sidePanel !== 'chat'}
            onClick={() => setSidePanel(p => p === 'chat' ? 'none' : 'chat')}
            activeIcon={<MessageSquare size={18} />}
            inactiveIcon={<MessageSquare size={18} />}
            label="Chat"
            highlight={sidePanel === 'chat'}
            iconOnly
          />
          <ControlButton
            active={sidePanel !== 'participants'}
            onClick={() => setSidePanel(p => p === 'participants' ? 'none' : 'participants')}
            activeIcon={<Users size={18} />}
            inactiveIcon={<Users size={18} />}
            label={`People (${allParticipants.length})`}
            highlight={sidePanel === 'participants'}
            iconOnly
          />
        </div>

        {/* Leave — isolated */}
        <button
          type="button"
          onClick={() => setShowEndConfirm(true)}
          aria-label="Leave meeting"
          className="flex flex-col items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl transition-colors ml-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
        >
          <PhoneOff size={18} />
          <span className="font-mono uppercase tracking-[0.1em] text-[10px]">LEAVE</span>
        </button>
      </div>

      {/* ── End call confirmation ────────────────────────────────────────────── */}
      {showEndConfirm && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white/[0.04] border border-white/[0.10] rounded-2xl p-6 w-80 text-center space-y-4 backdrop-blur-xl">
            {isSummarizing ? (
              <>
                <Loader2 size={28} className="animate-spin motion-reduce:animate-none text-white/50 mx-auto" />
                <div className="flex justify-center">
                  <AIProvenanceChip vendor="GEMINI" type="SUMMARY" fresh />
                </div>
                <p className="text-white font-mono uppercase tracking-[0.1em] text-[11px]">GENERATING</p>
              </>
            ) : (
              <>
                <PhoneOff size={28} className="text-rose-400 mx-auto" />
                <p className="text-white font-semibold text-base">Leave the meeting?</p>
                {transcriptLines.filter(l => l.isFinal).length > 0 && (
                  <div className="flex flex-col items-center gap-2">
                    <AIProvenanceChip vendor="GEMINI" type="SUMMARY" />
                    <p className="text-white/55 text-sm">A summary will be generated from the transcript.</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEndConfirm(false)}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl transition-colors font-mono uppercase tracking-[0.1em] text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                  >
                    STAY
                  </button>
                  <button
                    type="button"
                    onClick={handleLeave}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-xl transition-colors font-mono uppercase tracking-[0.1em] text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                  >
                    LEAVE
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
  const color = identityColor(name);
  const isMuted = participant?.tracks?.audio?.state === 'off';
  const isVideoOff = participant?.tracks?.video?.state === 'off';

  return (
    <div className="flex items-center gap-2 py-1">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ background: color.avatar }}
      >
        {name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
      </div>
      <span className="flex-1 text-sm text-white/90 truncate">
        {name}
        {isLocal && <span className="font-mono uppercase tracking-[0.1em] text-[10px] text-white/40 ml-1.5">YOU</span>}
      </span>
      {isMuted && <MicOff size={12} className="text-rose-400 shrink-0" aria-label="Muted" />}
      {isVideoOff && <VideoOff size={12} className="text-white/30 shrink-0" aria-label="Camera off" />}
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
  iconOnly?: boolean;
}> = ({ active, onClick, activeIcon, inactiveIcon, label, danger, highlight, iconOnly }) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={highlight ?? false}
    title={iconOnly ? label : undefined}
    onClick={onClick}
    className={`flex flex-col items-center gap-1 ${iconOnly ? 'px-2.5 py-2' : 'px-3 py-2'} rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
      danger
        ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
        : highlight
        ? 'bg-white/10 text-rose-400 hover:bg-white/15'
        : 'bg-white/[0.06] text-white/80 hover:bg-white/[0.12]'
    }`}
  >
    {active ? activeIcon : inactiveIcon}
    {!iconOnly && (
      <span className="font-mono uppercase tracking-[0.1em] text-[10px]">{label}</span>
    )}
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
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-4">
            <Video size={24} className="text-rose-400" />
          </div>
          <p className="font-mono uppercase tracking-[0.1em] text-[10px] text-white/40">PULSE MEETING</p>
          <h2 className="text-xl font-semibold">{meetingTitle}</h2>
        </div>

        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2">
          <span className="flex-1 font-mono text-[11px] text-white/55 truncate" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {window.location.origin}/meet/{roomUrl.split('/').pop()}
          </span>
          <button
            type="button"
            aria-label="Copy meeting link"
            onClick={copyLink}
            className="text-white/40 hover:text-rose-400 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
          >
            <Copy size={14} />
          </button>
          {copied && (
            <span className="font-mono uppercase tracking-[0.1em] text-[10px] text-rose-400">COPIED</span>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-white/10 hover:bg-white/15 text-white py-3 rounded-xl transition-colors font-mono uppercase tracking-[0.1em] text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={onJoin}
            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl transition-colors font-mono uppercase tracking-[0.1em] text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            JOIN NOW
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
  initialMicOff = false,
  initialCameraOff = false,
  autoRecord = false,
  autoTranscribe = false,
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
      <div className="flex flex-col items-center justify-center h-full bg-black text-white gap-3">
        <Loader2 size={28} className="animate-spin motion-reduce:animate-none text-white/40" />
        <p className="font-mono uppercase tracking-[0.1em] text-[10px] text-white/40">JOINING</p>
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
        initialMicOff={initialMicOff}
        initialCameraOff={initialCameraOff}
        autoRecord={autoRecord}
        autoTranscribe={autoTranscribe}
      />
    </DailyProvider>
  );
};

export default PulseVideoRoom;
