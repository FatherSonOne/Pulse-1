import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Send, X as XIcon, ChevronDown, Loader2 } from 'lucide-react';
import { useVoxRecording } from '../../hooks/useVoxRecording';
import { useVoxCaptureSettings } from '../../hooks/useVoxCaptureSettings';
import { toastMicError } from '../../utils/micErrors';
import { voxModeService } from '../../services/relay/voxModeService';
import { sendQuickVoxDurable } from '../../services/relay/relayOutboxProcessor';
import { LiveWaveBars } from '../Relay/studio/LiveWaveBars';
import { useFeatureFlag } from '../../lib/featureFlags';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { AppView } from '../../types';

interface RelayQuickRecorderStripProps {
  workspaceId: string | null | undefined;
  authUserId: string | null | undefined;
  setView: (view: AppView) => void;
}

interface TodayStats {
  sent: number;
  received: number;
  listenedMin: number;
}

interface Recipient {
  id: string;
  name: string;
  handle?: string;
}

const LAST_RECIPIENT_KEY = 'pulse_last_relay_recipient';

const formatDuration = (seconds: number): string => {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

// Full-width Relay recording surface — lives below the tile grid. Replaces the
// old RelayPulseTile's narrow slot. At rest it surfaces today's IN/OUT counts
// + a recipient picker. During recording it shows the shared real-mic waveform
// (LiveWaveBars). Capture honors the Audio I/O settings; send routes through
// the durable outbox (offline-safe) — the same canonical path as the studio.
const RelayQuickRecorderStrip: React.FC<RelayQuickRecorderStripProps> = ({
  workspaceId,
  authUserId,
  setView,
}) => {
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Close the recipient picker on outside click and on Escape. Cheap behavior
  // expected of any inline dropdown.
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  const capture = useVoxCaptureSettings();
  const durableOutbox = useFeatureFlag('relayDurableOutbox');
  const {
    state: recordingState,
    duration,
    analyser,
    recordingData,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoxRecording({
    qualityPreset: capture.qualityPreset,
    deviceId: capture.deviceId,
    customAudioConstraints: capture.customAudioConstraints,
    maxDuration: 180,
  });

  // Load today's stats + Pulse users for the recipient picker. The stats
  // logic mirrors what the old RelayPulseTile had, lifted in so the tile can
  // retire from the 4-col grid.
  useEffect(() => {
    if (!workspaceId || !authUserId) return;
    let active = true;

    const load = async () => {
      const { data: pulseUserRow } = await supabase
        .from('pulse_users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      const pulseUserId = pulseUserRow?.id;
      if (!pulseUserId || !active) return;

      const sinceIso = (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
      })();

      const { data: messages } = await supabase
        .from('quick_vox_messages')
        .select('sender_id, recipient_id, played_at, duration')
        .eq('workspace_id', workspaceId)
        .or(`sender_id.eq.${pulseUserId},recipient_id.eq.${pulseUserId}`)
        .gte('created_at', sinceIso);

      if (!active) return;
      let sent = 0;
      let received = 0;
      let listenedSec = 0;
      (messages || []).forEach(m => {
        if (m.sender_id === pulseUserId) sent++;
        else if (m.recipient_id === pulseUserId) {
          received++;
          if (m.played_at) listenedSec += m.duration || 0;
        }
      });
      setStats({ sent, received, listenedMin: Math.round(listenedSec / 60) });

      const list = await voxModeService.getPulseUsersAsContacts();
      if (!active) return;
      // Exclude self from the recipient list.
      const others = list.filter(u => u.id !== pulseUserId).map(u => ({
        id: u.id,
        name: u.name,
        handle: u.handle,
      }));
      setRecipients(others);

      const lastId = localStorage.getItem(LAST_RECIPIENT_KEY);
      if (lastId && others.some(o => o.id === lastId)) {
        setSelectedRecipientId(lastId);
      }
    };

    void load();
    return () => { active = false; };
  }, [workspaceId, authUserId]);

  const selectedRecipient = useMemo(
    () => recipients.find(r => r.id === selectedRecipientId) ?? null,
    [recipients, selectedRecipientId],
  );

  const handleStart = async () => {
    try {
      await startRecording();
    } catch (err) {
      console.error('[RelayQuickRecorderStrip] start failed', err);
      toastMicError(err);
    }
  };

  const handleSend = async () => {
    if (!recordingData) {
      toast.error('No recording to send');
      return;
    }
    if (!selectedRecipientId) {
      toast.error('Pick a recipient first');
      setPickerOpen(true);
      return;
    }
    setSending(true);
    try {
      // Durable path (offline-safe, survives refresh) when the outbox is on;
      // otherwise the direct upload+send. Both persist the recipient + reset.
      const ok = durableOutbox
        ? (await sendQuickVoxDurable({
            recipientId: selectedRecipientId,
            blob: recordingData.blob,
            duration: recordingData.duration,
          })).status === 'queued'
        : !!(await voxModeService.uploadAndSendQuickVox(
            selectedRecipientId,
            recordingData.blob,
            recordingData.duration,
          ));
      if (ok) {
        localStorage.setItem(LAST_RECIPIENT_KEY, selectedRecipientId);
        toast.success(`Sending to ${selectedRecipient?.name ?? 'recipient'}`);
        // Reset to idle by cancelling the preview state.
        cancelRecording();
        if (stats) setStats({ ...stats, sent: stats.sent + 1 });
      } else {
        toast.error('Send failed');
      }
    } catch (err) {
      console.error('[RelayQuickRecorderStrip] send failed', err);
      toast.error('Send failed');
    } finally {
      setSending(false);
    }
  };

  const statsLine = (() => {
    if (!stats) return null;
    // Quiet idle header when there's been no activity today — `IN 0 · OUT 0`
    // reads like fake instrumentation. Suppress it so the strip just says
    // RELAY, matching the glance-tile law of "return null when zero."
    if (stats.received === 0 && stats.sent === 0) return null;
    const segs: string[] = [];
    if (stats.received > 0) segs.push(`IN ${stats.received}`);
    if (stats.sent > 0) segs.push(`OUT ${stats.sent}`);
    if (stats.listenedMin > 0) segs.push(`${stats.listenedMin}M LISTENED`);
    return segs.join(' · ');
  })();

  const isRecording = recordingState === 'recording';

  return (
    <section aria-labelledby="strip-relay-recorder-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="strip-relay-recorder-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
          {isRecording ? (
            <span className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-rose-500 pulse-heartbeat-once"
                style={{ animationIterationCount: 'infinite', animationDuration: '1.4s' }}
                aria-hidden="true"
              />
              <span className="text-rose-600 dark:text-rose-400">RELAY · LIVE</span>
              <span className="text-zinc-400 dark:text-zinc-500">· {formatDuration(duration)}</span>
            </span>
          ) : recordingState === 'preview' ? (
            <span className="flex items-center gap-2">
              <span>RELAY · PREVIEW</span>
              <span className="text-zinc-400 dark:text-zinc-500">
                · {formatDuration(recordingData?.duration ?? 0)}
              </span>
            </span>
          ) : (
            <span>RELAY{statsLine ? ` · ${statsLine}` : ''}</span>
          )}
        </h2>
        <button
          onClick={() => setView(AppView.RELAY)}
          disabled={isRecording}
          // Navigating away mid-recording unmounts the hook and discards audio.
          // Disable until the user stops or sends.
          className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-zinc-400 dark:disabled:hover:text-zinc-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
        >
          OPEN RELAY
        </button>
      </div>

      <div className="flex items-center gap-3 px-3 py-2.5 rounded bg-zinc-50/60 dark:bg-white/[0.03]">
        {/* Recipient picker — pill that opens an inline list */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setPickerOpen(o => !o)}
            disabled={isRecording}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] text-zinc-700 dark:text-zinc-200 hover:border-rose-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
          >
            <span className="pulse-label text-zinc-400 dark:text-zinc-500">TO</span>
            <span className="truncate max-w-[8rem]">
              {selectedRecipient ? selectedRecipient.name : 'Pick…'}
            </span>
            <ChevronDown className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
          </button>
          {pickerOpen && (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 left-0 min-w-[12rem] max-h-56 overflow-y-auto rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.08] shadow-lg py-1"
            >
              {recipients.length === 0 ? (
                <li className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                  No Pulse users yet
                </li>
              ) : (
                recipients.map(r => (
                  <li key={r.id}>
                    <button
                      onClick={() => {
                        setSelectedRecipientId(r.id);
                        setPickerOpen(false);
                      }}
                      role="option"
                      aria-selected={selectedRecipientId === r.id}
                      className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors ${
                        selectedRecipientId === r.id
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-zinc-700 dark:text-zinc-200'
                      }`}
                    >
                      <span className="truncate flex-1">{r.name}</span>
                      {r.handle && (
                        <span className="pulse-label text-zinc-400 dark:text-zinc-500">@{r.handle}</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {/* Live mic-reactive waveform during recording; spacer at rest. Shared
            LiveWaveBars (fill mode) — same engine as the studio footer/modal. */}
        {isRecording ? (
          <div
            className="flex-1 flex items-end gap-px h-8"
            aria-label="Recording in progress"
            role="img"
          >
            <LiveWaveBars analyser={analyser} fill barCount={30} color="#f43f5e" baseline={8} />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Action button — context-sensitive */}
        <div className="flex items-center gap-2">
          {recordingState === 'idle' && (
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
              aria-label="Start recording"
            >
              <Mic className="w-3.5 h-3.5" />
              RECORD
            </button>
          )}
          {isRecording && (
            <button
              onClick={stopRecording}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              aria-label="Stop recording"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              STOP
            </button>
          )}
          {recordingState === 'preview' && (
            <>
              <button
                onClick={() => cancelRecording()}
                disabled={sending}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                aria-label="Discard recording"
              >
                <XIcon className="w-3.5 h-3.5" />
                CANCEL
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !selectedRecipientId}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-500 hover:bg-rose-600 active:bg-rose-700 disabled:bg-zinc-300 dark:disabled:bg-white/[0.08] disabled:cursor-not-allowed text-white disabled:text-zinc-500 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                aria-label="Send recording"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                SEND
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default RelayQuickRecorderStrip;
