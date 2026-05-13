import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Play } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { AppView } from '../../../types';
import { useStripHighlight } from './useStripHighlight';
import { makeStripRowClick } from './stripNavigation';
import { useEverHadData } from './useEverHadData';

interface RelayUnheardStripProps {
  workspaceId: string | null | undefined;
  authUserId: string | null | undefined;
  setView: (view: AppView) => void;
}

interface UnheardRow {
  id: string;
  senderName: string;
  duration: number;
  audioUrl: string;
  createdAt: string;
}

const formatDuration = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatAge = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'NOW';
  if (m < 60) return `${m}M`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H`;
  const d = Math.floor(h / 24);
  return `${d}D`;
};

const RelayUnheardStrip: React.FC<RelayUnheardStripProps> = ({ workspaceId, authUserId, setView }) => {
  const [rows, setRows] = useState<UnheardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioEl] = useState<HTMLAudioElement>(() => new Audio());
  const [everSeen, markSeen] = useEverHadData(workspaceId ? `relay:${workspaceId}` : null);

  const load = useCallback(async () => {
    if (!workspaceId || !authUserId) return;

    const pulseUser = await supabase
      .from('pulse_users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    const pulseUserId = pulseUser.data?.id;
    if (!pulseUserId) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('quick_vox_messages')
      .select('id, audio_url, duration, created_at, sender_id')
      .eq('workspace_id', workspaceId)
      .eq('recipient_id', pulseUserId)
      .is('played_at', null)
      .order('created_at', { ascending: false })
      .limit(6);

    if (error || !data || data.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const senderIds = Array.from(new Set(data.map(r => r.sender_id)));
    const senders = await supabase
      .from('pulse_users')
      .select('id, display_name')
      .in('id', senderIds);

    const nameMap = new Map<string, string>();
    (senders.data || []).forEach(s => nameMap.set(s.id, s.display_name || 'Unknown'));

    const mapped = data.map(r => ({
      id: r.id,
      senderName: nameMap.get(r.sender_id) || 'Unknown',
      duration: r.duration,
      audioUrl: r.audio_url,
      createdAt: r.created_at,
    }));
    if (mapped.length > 0) markSeen();
    setRows(mapped);
    setLoading(false);
  }, [workspaceId, authUserId, markSeen]);

  useEffect(() => {
    if (!workspaceId || !authUserId) {
      setLoading(false);
      return;
    }
    void load();

    const channel = supabase
      .channel(`dashboard:relay:${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quick_vox_messages', filter: `workspace_id=eq.${workspaceId}` },
        () => { void load(); },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      audioEl.pause();
    };
  }, [workspaceId, authUserId, load, audioEl]);

  const handlePlay = useCallback(async (row: UnheardRow) => {
    if (playingId === row.id) {
      audioEl.pause();
      setPlayingId(null);
      return;
    }
    audioEl.pause();
    audioEl.src = row.audioUrl;
    setPlayingId(row.id);
    try {
      await audioEl.play();
      await supabase
        .from('quick_vox_messages')
        .update({ played_at: new Date().toISOString() })
        .eq('id', row.id);
    } catch (err) {
      console.warn('[RelayUnheardStrip] play failed', err);
      setPlayingId(null);
    }
  }, [audioEl, playingId]);

  useEffect(() => {
    const onEnd = () => setPlayingId(null);
    audioEl.addEventListener('ended', onEnd);
    return () => audioEl.removeEventListener('ended', onEnd);
  }, [audioEl]);

  const ids = useMemo(() => rows.map(r => r.id), [rows]);
  const highlight = useStripHighlight(ids);

  if (loading) return null;

  if (rows.length === 0) {
    if (!everSeen) return null;
    return (
      <section aria-labelledby="strip-relay-empty-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="strip-relay-empty-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
            RELAY · CAUGHT UP
          </h2>
        </div>
        <p className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          No voice messages waiting.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="strip-relay-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="strip-relay-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
          RELAY · {rows.length} UNHEARD
        </h2>
        <button
          onClick={() => setView(AppView.RELAY)}
          className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
        >
          OPEN RELAY
        </button>
      </div>
      <ul className="space-y-px">
        {rows.map(r => {
          const isPlaying = playingId === r.id;
          const isNew = highlight.has(r.id);
          return (
            <li key={r.id}>
              <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 group">
                <button
                  aria-label={isPlaying ? `Pause vox from ${r.senderName}` : `Play vox from ${r.senderName}`}
                  onClick={() => handlePlay(r)}
                  className={`
                    w-7 h-7 rounded-full shrink-0 flex items-center justify-center transition-colors duration-150
                    ${isPlaying
                      ? 'bg-rose-500 text-white'
                      : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-200 hover:bg-rose-500 hover:text-white'}
                    ${isNew ? 'pulse-heartbeat-once' : ''}
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40
                  `}
                >
                  <Play className={`w-3 h-3 ${isPlaying ? '' : 'ml-px'}`} fill="currentColor" />
                </button>
                <button
                  data-strip-row
                  onClick={makeStripRowClick(() => setView(AppView.RELAY))}
                  className="flex items-baseline gap-2 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 shrink-0">
                    {r.senderName}
                  </span>
                  <span className="pulse-label text-zinc-500 dark:text-zinc-400 shrink-0">
                    QUICK · {formatDuration(r.duration)}
                  </span>
                </button>
                <span className="pulse-label text-zinc-500 dark:text-zinc-400 shrink-0 min-w-[2.5rem] text-right">
                  {formatAge(r.createdAt)}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors shrink-0" />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default RelayUnheardStrip;
