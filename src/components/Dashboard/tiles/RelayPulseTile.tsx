import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase';
import GlanceTileShell from './GlanceTileShell';

interface RelayPulseTileProps {
  workspaceId: string | null | undefined;
  authUserId: string | null | undefined;
  onClick?: () => void;
}

interface Stats {
  sent: number;
  received: number;
  listened: number;
}

/** Five synthetic waveform bars, each on its own delay so the row never reads
 *  as mechanical. CSS-only — no mic stream needed. */
const WAVE_DELAYS = ['0ms', '120ms', '60ms', '180ms', '90ms'];

const LiveWaveform: React.FC = () => (
  <div
    className="flex items-end gap-1 h-6"
    role="img"
    aria-label="Recording in progress"
  >
    {WAVE_DELAYS.map((delay, i) => (
      <div
        key={i}
        className="flex-1 h-full flex items-center justify-center"
      >
        <span
          className="pulse-wave-bar block w-full h-full rounded-sm bg-rose-500"
          style={{ animationDelay: delay }}
        />
      </div>
    ))}
  </div>
);

const startOfDay = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const RelayPulseTile: React.FC<RelayPulseTileProps> = ({ workspaceId, authUserId, onClick }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  // Live recording state — when this user toggles to recording via any Relay mode,
  // `quick_vox_status.is_recording` flips and the tile swaps to a synthetic waveform.
  useEffect(() => {
    if (!authUserId) return;

    let active = true;

    const fetchInitial = async () => {
      const { data } = await supabase
        .from('quick_vox_status')
        .select('is_recording')
        .eq('user_id', authUserId)
        .maybeSingle();
      if (active) setIsRecording(Boolean(data?.is_recording));
    };
    void fetchInitial();

    const channel = supabase
      .channel(`dashboard:relay-status:${authUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quick_vox_status', filter: `user_id=eq.${authUserId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { is_recording?: boolean } | null;
          if (active && row) setIsRecording(Boolean(row.is_recording));
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [authUserId]);

  useEffect(() => {
    if (!workspaceId || !authUserId) {
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      const pulseUser = await supabase
        .from('pulse_users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      const pulseUserId = pulseUser.data?.id;
      if (!pulseUserId) {
        setLoading(false);
        return;
      }

      const since = startOfDay();
      const { data, error } = await supabase
        .from('quick_vox_messages')
        .select('sender_id, recipient_id, played_at, duration')
        .eq('workspace_id', workspaceId)
        .or(`sender_id.eq.${pulseUserId},recipient_id.eq.${pulseUserId}`)
        .gte('created_at', since);

      if (!active) return;
      if (error || !data) {
        setStats(null);
        setLoading(false);
        return;
      }

      let sent = 0;
      let received = 0;
      let listened = 0;
      data.forEach(r => {
        if (r.sender_id === pulseUserId) sent++;
        else if (r.recipient_id === pulseUserId) {
          received++;
          if (r.played_at) listened += (r.duration || 0);
        }
      });
      setStats({ sent, received, listened });
      setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [workspaceId, authUserId]);

  // Live-recording state takes precedence — surface it even if today's stats are empty.
  if (isRecording) {
    return (
      <GlanceTileShell
        label="RELAY · RECORDING"
        ariaLabel="Recording in progress"
        onClick={onClick}
        headline={
          <span className="flex items-baseline gap-2">
            <span className="text-rose-600 dark:text-rose-400">LIVE</span>
            <span className="pulse-label text-zinc-400 dark:text-zinc-500">CAPTURING</span>
          </span>
        }
      >
        <LiveWaveform />
      </GlanceTileShell>
    );
  }

  if (loading || !stats || (stats.sent === 0 && stats.received === 0)) return null;

  const listenedMin = Math.round(stats.listened / 60);
  const bars = [
    { key: 'received', count: stats.received, className: 'bg-rose-500' },
    { key: 'sent',     count: stats.sent,     className: 'bg-pink-500' },
  ];
  const max = Math.max(stats.received, stats.sent, 1);

  return (
    <GlanceTileShell
      label="RELAY · TODAY"
      ariaLabel={`Relay today: ${stats.received} received, ${stats.sent} sent, ${listenedMin} minutes listened`}
      onClick={onClick}
      headline={
        <span className="flex items-baseline gap-2">
          <span>{stats.received + stats.sent}</span>
          <span className="pulse-label text-zinc-400 dark:text-zinc-500">VOX</span>
          {listenedMin > 0 && (
            <>
              <span className="pulse-label text-zinc-300 dark:text-zinc-600">·</span>
              <span className="pulse-label text-zinc-500 dark:text-zinc-400">{listenedMin}M LISTENED</span>
            </>
          )}
        </span>
      }
    >
      <div className="flex items-end gap-1 h-6">
        {bars.map(b => (
          <div key={b.key} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-sm ${b.className}`}
              style={{ height: `${Math.max(8, (b.count / max) * 100)}%` }}
              title={`${b.key}: ${b.count}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-1">
        <span className="pulse-label text-zinc-500 dark:text-zinc-400 flex-1 text-center">IN · {stats.received}</span>
        <span className="pulse-label text-zinc-500 dark:text-zinc-400 flex-1 text-center">OUT · {stats.sent}</span>
      </div>
    </GlanceTileShell>
  );
};

export default RelayPulseTile;
