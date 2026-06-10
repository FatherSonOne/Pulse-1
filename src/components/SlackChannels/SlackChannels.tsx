// Slack Channels Grounding (Integration C) · P5 — read surface.
//
// A dedicated two-pane surface (channel list + thread reader) for the Slack
// channel mirror. Read-only in v1 — reply-as-you (a composer wired to
// POST /api/slack/channel-send) lands in P6. Neutral chrome consuming
// --pulse-* tokens; the only accent is the plum "via Slack" provenance chip
// (reused verbatim from Messages.tsx). Coral is deliberately NOT used — it is
// reserved for AI-output surfaces (CLAUDE.md §4).
//
// Gated by the slackChannelsGrounding flag at the App.tsx render seam.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Lock, RefreshCw, MessageSquare, Send, Slack as SlackIcon, History, Sparkles, X } from 'lucide-react';
import { StudioMasthead } from '../Relay/studio';
import { hasSlackBotToken } from '../../lib/slackToken';
import { useFeatures } from '../../contexts/FeatureContext';
import {
  slackChannelsService,
  type SlackChannelThread,
  type SlackChannelMessage,
} from '../../services/slackChannelsService';
import type { ConversationSummary } from '../../services/relay/relayAIService';

// ── small local presentation helpers ──────────────────────────────────────
function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}
function fmtRelDay(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return fmtTime(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// "via Slack" provenance chip — plum, reused verbatim from Messages.tsx. NOT coral.
const ViaSlackChip: React.FC = () => (
  <span
    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 dark:bg-purple-500/15 text-purple-600 dark:text-purple-300 normal-case tracking-normal text-xs"
    title="Messages in this channel are mirrored from Slack"
  >
    via Slack
  </span>
);

// A Slack thread = one root message plus the replies nested under it.
interface ThreadGroup {
  root: SlackChannelMessage;
  replies: SlackChannelMessage[];
}

// One message bubble — the exact markup the flat P5 list used, factored out so a
// thread root and its replies render identically. Per-message in/out alignment,
// avatar, and neutral --pulse-* tokens are preserved verbatim (no coral).
const MessageRow: React.FC<{ m: SlackChannelMessage }> = ({ m }) => {
  const out = m.is_outgoing;
  const deleted = !!m.deleted_at;
  return (
    <div className={`flex items-start gap-2.5 ${out ? 'flex-row-reverse' : ''}`}>
      <div
        className="shrink-0 flex items-center justify-center rounded-full"
        style={{ width: 32, height: 32, background: colorForId(out ? 'you' : m.sender_slack_id || m.sender_name), color: '#fff', fontSize: 12, fontWeight: 700 }}
      >
        {out ? 'You' : initials(m.sender_name)}
      </div>
      <div className={`flex-1 min-w-0 ${out ? 'text-right' : ''}`}>
        <div className={`flex items-baseline gap-2 ${out ? 'justify-end' : ''}`}>
          <span style={{ color: 'var(--pulse-ink)', fontWeight: 600, fontSize: 13.5 }}>{out ? 'You' : m.sender_name}</span>
          <span style={{ color: 'var(--pulse-ink-3)', fontSize: 11 }}>{fmtTime(m.created_at)}</span>
          {m.edited_at && !deleted && (
            <span style={{ color: 'var(--pulse-ink-3)', fontSize: 11 }} title="Edited in Slack">(edited)</span>
          )}
        </div>
        <div
          style={{
            color: deleted ? 'var(--pulse-ink-3)' : 'var(--pulse-ink)',
            fontStyle: deleted ? 'italic' : 'normal',
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {deleted ? 'message deleted' : m.content}
        </div>
      </div>
    </div>
  );
};

// A coral AI-provenance list (P8 §4) — Key Points / Decisions / Action Items inside the channel
// summary card. Coral is correct HERE (AI output) per CLAUDE.md §4; channel chrome stays neutral.
const CoralList: React.FC<{ label: string; items: string[] }> = ({ label, items }) => (
  <div style={{ marginTop: 10 }}>
    <div style={{ color: 'var(--pulse-coral-fg)', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 6 }}>
      {label}
    </div>
    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'flex', gap: 8, color: 'var(--pulse-ink)', fontSize: 13, lineHeight: 1.5, marginBottom: 4 }}>
          <span aria-hidden style={{ marginTop: 7, flexShrink: 0, width: 5, height: 5, borderRadius: 999, background: 'var(--pulse-coral)' }} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  </div>
);

const SlackChannels: React.FC = () => {
  const { features } = useFeatures();
  const [threads, setThreads] = useState<SlackChannelThread[]>([]);
  const [nameById, setNameById] = useState<Map<string, string>>(new Map());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SlackChannelMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillNote, setBackfillNote] = useState<string | null>(null);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const hasToken = hasSlackBotToken();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const channelLabel = useCallback(
    (t: SlackChannelThread): string => nameById.get(t.slack_channel_id) || t.channel_name || t.slack_channel_id,
    [nameById],
  );

  // ── threads: initial load + resolve names + keep the selection valid ──────
  const loadThreads = useCallback(async () => {
    const rows = await slackChannelsService.getThreads();
    setThreads(rows);
    setLoadingThreads(false);
    setActiveThreadId((prev) => prev ?? (rows[0]?.id ?? null));
  }, []);

  useEffect(() => {
    void loadThreads();
    void slackChannelsService.resolveChannelNames().then(setNameById);
    const unsub = slackChannelsService.subscribeToThreads(() => { void loadThreads(); });
    return unsub;
  }, [loadThreads]);

  // ── messages: load + subscribe whenever the active thread changes ─────────
  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setBackfillNote(null); // a result note belongs to the channel it was run on
    setSummary(null); // a summary belongs to the channel it was generated from
    setSummaryError(null);
    setLoadingMessages(true);
    void slackChannelsService.getMessages(activeThreadId).then((rows) => {
      if (cancelled) return;
      setMessages(rows);
      setLoadingMessages(false);
    });
    const unsub = slackChannelsService.subscribeToMessages(
      activeThreadId,
      (m) => {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      },
      (m) => {
        // edit/delete (P8 §1.2) — replace the row in place (new content + edited_at/deleted_at).
        setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [activeThreadId]);

  // keep the thread scrolled to the latest message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Group the flat mirror into Slack threads at render time. A reply
  // (slack_thread_ts set and ≠ its own ts) nests under the root whose slack_ts it
  // points to; a reply whose parent isn't in our mirror (e.g. posted before the
  // bot joined) is promoted to its own root so nothing is ever hidden. Pure
  // derivation — load / realtime / scroll / send paths are untouched.
  const threadGroups = useMemo<ThreadGroup[]>(() => {
    const isReply = (m: SlackChannelMessage) =>
      m.slack_thread_ts != null && m.slack_thread_ts !== m.slack_ts;
    const rootByTs = new Map<string, ThreadGroup>();
    const groups: ThreadGroup[] = [];
    for (const m of messages) {
      if (isReply(m)) continue;
      const g: ThreadGroup = { root: m, replies: [] };
      groups.push(g);
      if (m.slack_ts) rootByTs.set(m.slack_ts, g);
    }
    for (const m of messages) {
      if (!isReply(m)) continue;
      const parent = m.slack_thread_ts ? rootByTs.get(m.slack_thread_ts) : undefined;
      if (parent) parent.replies.push(m);
      else groups.push({ root: m, replies: [] }); // orphan → its own root, never dropped
    }
    groups.sort((a, b) => a.root.created_at.localeCompare(b.root.created_at));
    return groups;
  }, [messages]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;

  const handleSend = async () => {
    if (!activeThread || sending) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setSendError(null);
    const res = await slackChannelsService.sendChannelMessage(activeThread.slack_channel_id, text);
    setSending(false);
    if (!res.ok) {
      setSendError(
        res.code === 'RECONNECT_REQUIRED'
          ? 'Slack disconnected — reconnect in Settings → Integrations.'
          : res.error || 'Failed to send',
      );
      return;
    }
    setDraft('');
    if (res.message) {
      setMessages((prev) => (prev.some((x) => x.id === res.message!.id) ? prev : [...prev, res.message!]));
    }
  };

  // Import the channel's recent history from Slack (P8 §3). One-shot + idempotent: the server
  // dedups on slack_ts, so re-running only fills the gap before go-forward ingest started. On
  // success we refetch (imported rows carry their real Slack created_at, so they slot into the
  // thread in chronological order rather than at the bottom).
  const handleBackfill = async () => {
    if (!activeThread || backfilling) return;
    setBackfilling(true);
    setBackfillNote(null);
    const res = await slackChannelsService.backfillChannel(
      activeThread.slack_channel_id,
      nameById.get(activeThread.slack_channel_id) ?? null,
      activeThread.is_private,
    );
    if (res.ok) {
      const rows = await slackChannelsService.getMessages(activeThread.id);
      setMessages(rows);
      const n = res.inserted ?? 0;
      setBackfillNote(
        n > 0
          ? `Imported ${n} earlier message${n === 1 ? '' : 's'}.`
          : 'Already up to date — no earlier messages to import.',
      );
    } else {
      setBackfillNote(
        res.code === 'RECONNECT_REQUIRED'
          ? 'Slack token invalid — reconnect in Settings → Integrations.'
          : res.error || 'Import failed.',
      );
    }
    setBackfilling(false);
  };

  // Summarize the open thread via the EXISTING server-side AI summarizer (P8 §4) — routed through
  // the ai-router edge fn (no client AI calls). Rendered as a coral provenance card (the one place
  // coral is correct). The summarizer is workspace-scoped, so it throws when no workspace is active.
  const handleSummarize = async () => {
    if (!activeThread || summarizing) return;
    setSummarizing(true);
    setSummaryError(null);
    try {
      const result = await slackChannelsService.summarizeThread(messages);
      if (result) setSummary(result);
      else setSummaryError('Nothing to summarize in this channel yet.');
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : 'Summary failed.');
    }
    setSummarizing(false);
  };

  // Self-gate: render nothing unless the flag is on. App.tsx can't gate this
  // (it's mounted outside FeatureProvider); all hooks above run unconditionally
  // so this conditional return is rules-of-hooks-safe.
  if (!features.slackChannelsGrounding) return null;

  // ── empty / cold states ───────────────────────────────────────────────────
  if (!hasToken) {
    return (
      <div className="h-full flex flex-col" style={{ background: 'var(--pulse-canvas)' }}>
        <div style={{ padding: '24px 28px 0' }}>
          <StudioMasthead eyebrow="Slack · Channels" title="Channels" subtitle="Mirrored from your Slack workspace" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm px-6">
            <SlackIcon className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--pulse-ink-3)' }} />
            <p style={{ color: 'var(--pulse-ink)', fontWeight: 600, marginBottom: 6 }}>Connect Slack first</p>
            <p style={{ color: 'var(--pulse-ink-3)', fontSize: 14, lineHeight: 1.5 }}>
              Add your Slack bot token in Settings → Integrations, then invite the bot to a channel to start
              mirroring its messages here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--pulse-canvas)' }}>
      <div style={{ padding: '24px 28px 12px' }}>
        <StudioMasthead
          eyebrow="Slack · Channels"
          title="Channels"
          subtitle="Mirrored from your Slack workspace"
          right={
            <button
              onClick={() => { void loadThreads(); void slackChannelsService.resolveChannelNames().then(setNameById); }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
              style={{ color: 'var(--pulse-ink-2)', border: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)' }}
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          }
        />
      </div>

      <div className="flex-1 min-h-0 flex" style={{ borderTop: '1px solid var(--pulse-border)' }}>
        {/* ── channel list ── */}
        <aside
          className="shrink-0 overflow-y-auto"
          style={{ width: 280, borderRight: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)' }}
        >
          {loadingThreads ? (
            <div style={{ padding: 16, color: 'var(--pulse-ink-3)', fontSize: 13 }}>Loading channels…</div>
          ) : threads.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--pulse-ink-3)', fontSize: 13, lineHeight: 1.5 }}>
              No channel activity yet. Invite the Slack bot to a channel — new messages will appear here.
            </div>
          ) : (
            threads.map((t) => {
              const isActive = t.id === activeThreadId;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveThreadId(t.id)}
                  className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5"
                  style={{
                    background: isActive ? 'var(--pulse-surface-raised)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--pulse-rose)' : '2px solid transparent',
                  }}
                >
                  {t.is_private ? (
                    <Lock className="w-4 h-4 shrink-0" style={{ color: 'var(--pulse-ink-3)' }} />
                  ) : (
                    <Hash className="w-4 h-4 shrink-0" style={{ color: 'var(--pulse-ink-3)' }} />
                  )}
                  <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--pulse-ink)', fontSize: 14, fontWeight: isActive ? 600 : 500 }}>
                    {channelLabel(t)}
                  </span>
                  <span className="shrink-0" style={{ color: 'var(--pulse-ink-3)', fontSize: 11 }}>
                    {fmtRelDay(t.last_message_at)}
                  </span>
                </button>
              );
            })
          )}
        </aside>

        {/* ── thread ── */}
        <section className="flex-1 min-w-0 flex flex-col">
          {!activeThread ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center" style={{ color: 'var(--pulse-ink-3)' }}>
                <MessageSquare className="w-7 h-7 mx-auto mb-2" />
                <p style={{ fontSize: 14 }}>Select a channel to read its mirror.</p>
              </div>
            </div>
          ) : (
            <>
              <header
                className="shrink-0 flex items-center gap-2 px-5 py-3"
                style={{ borderBottom: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)' }}
              >
                {activeThread.is_private ? (
                  <Lock className="w-4 h-4" style={{ color: 'var(--pulse-ink-2)' }} />
                ) : (
                  <Hash className="w-4 h-4" style={{ color: 'var(--pulse-ink-2)' }} />
                )}
                <span style={{ color: 'var(--pulse-ink)', fontWeight: 600, fontSize: 15 }}>{channelLabel(activeThread)}</span>
                <ViaSlackChip />
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={() => void handleSummarize()}
                    disabled={summarizing || messages.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                    style={{
                      color: 'var(--pulse-coral-fg)',
                      border: '1px solid var(--pulse-coral-bg-12)',
                      background: 'var(--pulse-coral-bg-08)',
                      cursor: summarizing || messages.length === 0 ? 'default' : 'pointer',
                      opacity: messages.length === 0 ? 0.5 : 1,
                    }}
                    title="Summarize this channel with AI"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${summarizing ? 'animate-pulse' : ''}`} />
                    {summarizing ? 'Summarizing…' : 'Summarize'}
                  </button>
                  <button
                    onClick={() => void handleBackfill()}
                    disabled={backfilling}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                    style={{
                      color: 'var(--pulse-ink-2)',
                      border: '1px solid var(--pulse-border)',
                      background: 'var(--pulse-surface)',
                      cursor: backfilling ? 'default' : 'pointer',
                    }}
                    title="Import this channel's recent history from Slack"
                  >
                    <History className={`w-3.5 h-3.5 ${backfilling ? 'animate-pulse' : ''}`} />
                    {backfilling ? 'Importing…' : 'Import history'}
                  </button>
                </div>
              </header>

              {backfillNote && (
                <div
                  className="shrink-0 px-5 py-2"
                  style={{
                    borderBottom: '1px solid var(--pulse-border)',
                    background: 'var(--pulse-surface)',
                    color: 'var(--pulse-ink-3)',
                    fontSize: 12,
                  }}
                >
                  {backfillNote}
                </div>
              )}

              {summaryError && !summary && (
                <div className="shrink-0 px-5 py-2" style={{ color: 'var(--pulse-tone-overdue, #ef4444)', fontSize: 12 }}>
                  {summaryError}
                </div>
              )}

              {summary && (
                <div
                  className="shrink-0 mx-5 mt-3 rounded-xl"
                  style={{ background: 'var(--pulse-coral-bg-08)', border: '1px solid var(--pulse-coral-bg-12)', padding: '14px 16px' }}
                >
                  <div className="flex items-start justify-between gap-3" style={{ marginBottom: 8 }}>
                    <div className="inline-flex items-center gap-1.5" style={{ color: 'var(--pulse-coral-fg)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
                      <Sparkles className="w-3.5 h-3.5" /> AI SUMMARY · via Gemini
                    </div>
                    <button onClick={() => setSummary(null)} title="Dismiss summary" style={{ color: 'var(--pulse-ink-3)', lineHeight: 0 }}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p style={{ color: 'var(--pulse-ink)', fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{summary.overview}</p>
                  {summary.keyPoints.length > 0 && <CoralList label="KEY POINTS" items={summary.keyPoints} />}
                  {summary.keyDecisions && summary.keyDecisions.length > 0 && <CoralList label="DECISIONS" items={summary.keyDecisions} />}
                  {summary.actionItems.length > 0 && <CoralList label="ACTION ITEMS" items={summary.actionItems} />}
                </div>
              )}

              <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto" style={{ padding: '16px 20px' }}>
                {loadingMessages ? (
                  <div style={{ color: 'var(--pulse-ink-3)', fontSize: 13 }}>Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div style={{ color: 'var(--pulse-ink-3)', fontSize: 13 }}>No messages mirrored yet.</div>
                ) : (
                  threadGroups.map((g) => (
                    <div key={g.root.id} style={{ marginBottom: 14 }}>
                      <MessageRow m={g.root} />
                      {g.replies.length > 0 && (
                        <div style={{ marginLeft: 16, paddingLeft: 18, borderLeft: '2px solid var(--pulse-border)', marginTop: 10 }}>
                          <div className="inline-flex items-center gap-1.5" style={{ color: 'var(--pulse-ink-3)', fontSize: 11, fontWeight: 600, marginBottom: 10 }}>
                            <MessageSquare className="w-3 h-3" />
                            {g.replies.length === 1 ? '1 reply' : `${g.replies.length} replies`}
                          </div>
                          {g.replies.map((r, i) => (
                            <div key={r.id} style={{ marginTop: i === 0 ? 0 : 12 }}>
                              <MessageRow m={r} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Reply-as-you composer (P6) — posts via POST /api/slack/channel-send. */}
              <footer
                className="shrink-0 px-4 py-3"
                style={{ borderTop: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)' }}
              >
                {sendError && (
                  <div style={{ color: 'var(--pulse-tone-overdue, #ef4444)', fontSize: 12, marginBottom: 6 }}>{sendError}</div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={`Message #${channelLabel(activeThread)} as you…`}
                    rows={1}
                    className="flex-1 resize-none rounded-lg px-3 py-2"
                    style={{ background: 'var(--pulse-canvas)', border: '1px solid var(--pulse-border)', color: 'var(--pulse-ink)', fontSize: 14, maxHeight: 120 }}
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={sending || !draft.trim()}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium"
                    style={{
                      background: sending || !draft.trim() ? 'var(--pulse-surface-raised)' : 'var(--pulse-ink)',
                      color: sending || !draft.trim() ? 'var(--pulse-ink-3)' : 'var(--pulse-canvas)',
                      cursor: sending || !draft.trim() ? 'default' : 'pointer',
                    }}
                  >
                    <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
                <div style={{ color: 'var(--pulse-ink-3)', fontSize: 11, marginTop: 6 }}>
                  Posts to Slack as you · Enter to send, Shift+Enter for a new line
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default SlackChannels;
