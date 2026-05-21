import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  loadVoiceSessions,
  loadVoiceSessionsRemote,
  type VoiceSessionRecord,
  type SessionArtifact,
} from '../../Summit/voiceSessionStore';
import { makeStripRowClick } from './stripNavigation';
import { useEverHadData } from './useEverHadData';

interface SummitLastCaptureStripProps {
  onResume: () => void;
}

interface CapturedItem {
  id: string;
  kind: SessionArtifact['kind'];
  content: string;
}

const KIND_TOKEN: Record<SessionArtifact['kind'], { label: string; pill: string }> = {
  decision: { label: 'DECISION', pill: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  task:     { label: 'TASK',     pill: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  question: { label: 'QUESTION', pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  reference:{ label: 'REFERENCE',pill: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
};

const formatAge = (ms: number): string => {
  const delta = Date.now() - ms;
  const m = Math.floor(delta / 60_000);
  if (m < 1) return 'JUST NOW';
  if (m < 60) return `${m}M AGO`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H AGO`;
  const d = Math.floor(h / 24);
  return `${d}D AGO`;
};

const SummitLastCaptureStrip: React.FC<SummitLastCaptureStripProps> = ({ onResume }) => {
  const [session, setSession] = useState<VoiceSessionRecord | null>(null);
  const [items, setItems] = useState<CapturedItem[]>([]);
  const [everSeen, markSeen] = useEverHadData('summit:global');

  useEffect(() => {
    let active = true;

    const load = async () => {
      let sessions = loadVoiceSessions();
      try {
        const remote = await loadVoiceSessionsRemote();
        if (remote && remote.length) sessions = remote;
      } catch {
        // remote unavailable; fall back to local cache
      }
      if (!active) return;

      const latest = sessions[0];
      if (!latest) return;

      const a = latest.artifacts;
      const collected: CapturedItem[] = [];
      const push = (kind: SessionArtifact['kind'], list?: SessionArtifact[]) => {
        (list || []).forEach(x => collected.push({ id: x.id, kind, content: x.content }));
      };
      if (a) {
        push('decision', a.decisions);
        push('task', a.tasks);
        push('question', a.questions);
        push('reference', a.references);
      }

      if (collected.length > 0) markSeen();
      setSession(latest);
      setItems(collected.slice(0, 5));
    };

    void load();
    return () => { active = false; };
  }, [markSeen]);

  if (!session || items.length === 0) {
    if (!everSeen) return null;
    return (
      <section aria-labelledby="strip-summit-empty-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="strip-summit-empty-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
            SUMMIT · NO RECENT CAPTURE
          </h2>
          <button
            onClick={onResume}
            className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
          >
            START SESSION
          </button>
        </div>
        <p className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          Open a Summit to capture decisions, tasks, and questions in flow.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="strip-summit-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="strip-summit-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
          SUMMIT · {formatAge(session.endedAt)} · {items.length} CAPTURED
        </h2>
        <button
          onClick={onResume}
          className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
        >
          RESUME
        </button>
      </div>
      <ul className="space-y-px">
        {items.map(item => {
          const t = KIND_TOKEN[item.kind];
          return (
            <li key={item.id}>
              <button
                data-strip-row
                onClick={makeStripRowClick(onResume)}
                className="w-full text-left flex items-baseline gap-3 px-3 py-2.5 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 group"
              >
                <span className={`pulse-label px-1.5 py-0.5 rounded shrink-0 ${t.pill}`}>{t.label}</span>
                <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate flex-1">
                  {item.content}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default SummitLastCaptureStrip;
