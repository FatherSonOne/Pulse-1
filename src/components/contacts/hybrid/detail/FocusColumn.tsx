// ============================================
// FocusColumn — Col 2 of the hybrid People view.
// Composes the contact's detail INLINE in the centre column (Path D folds the
// legacy right-side slide-over into the pane). Reuses ContactDetail's importable
// sub-components (ContactAIInsightsTab, RelationshipAutopilotToggle via
// CadenceSpine, MapPreview, Lead badges, ProvenanceChip, ContactGoalModal) and
// faithfully ports the thin section wrappers (info / notes / delete). The legacy
// ContactDetail stays intact until Phase 12.
//
// NEW vs legacy detail: IdBadge (Pulse vs external) + the coral AI-context strip
// (invariant 2 — one of the two at-rest coral regions in the People view) +
// a groups/tags row.
//
// NOT carried (documented, not silent):
//   • RelationshipHealthCard / MeetingPrepCard components exist but are NOT
//     rendered by ContactDetail today; health shows via the quick-stats line +
//     ContactAIInsightsTab. Adding those cards would be net-new, out of scope.
//   • EditableAvatar (upload) is Phase 5; this uses the plain initial avatar.
//   • CardSourceChip + the "Send as card" header button (Phase C cards, gated by
//     VITE_CONTACTS_PHASE_C_ENABLED) → Phase 7 preserve-and-port (cards).
//   • The email section's workspace-audit entries (listWorkspaceContacts
//     "shared by/at") → Phase 7 (workspace share).
//   • Refresh-insights header button → minor; ContactAIInsightsTab renders from
//     cache, so manual refresh is deferred (insights stay visible).
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md §4.3 + §4.9.
// ============================================

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Cake,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Pen,
  Phone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Contact } from '../../../../types';
import {
  RelationshipProfile,
  LeadScore,
  getRelationshipHealthColor,
  getTrendIcon,
  getTrendColor,
  formatLastInteraction,
} from '../../../../types/relationshipTypes';
import { supabase } from '../../../../services/supabase';
import { ContactAIInsightsTab } from '../../ContactAIInsightsTab';
import { LeadGradeBadge, LeadStatusBadge } from '../../LeadScoreIndicator';
import { ProvenanceChip, type ContactProvenanceSource } from '../../ProvenanceChip';
import MapPreview from '../../../map/MapPreview';
import { ChannelRow } from '../channels/ChannelRow';
import { sendSlackDm, resolveSlackUser } from '../channels/actions';
import { CadenceSpine } from './CadenceSpine';
import { InteractionTimeline } from './InteractionTimeline';
import { useFeatures } from '../../../../contexts/FeatureContext';

const CHANNEL_ICON: Record<string, string> = {
  email: 'fa-solid fa-envelope',
  calendar: 'fa-solid fa-calendar',
  slack: 'fa-brands fa-slack',
  sms: 'fa-solid fa-comment-sms',
  mixed: 'fa-solid fa-shuffle',
};

function ringClassFor(score: number): string {
  if (score >= 70) return 'ring-2 ring-emerald-400 dark:ring-emerald-500';
  if (score >= 40) return 'ring-2 ring-amber-400 dark:ring-amber-500';
  return 'ring-2 ring-rose-400 dark:ring-rose-500';
}

interface FocusColumnProps {
  contact: Contact;
  userId?: string;
  relationshipProfile?: RelationshipProfile | null;
  leadScore?: LeadScore | null;
  emailEnabled: boolean;
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onUpdateContact?: (updatedContact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete?: () => Promise<void>;
}

const Section: React.FC<{ label: string; action?: React.ReactNode; children: React.ReactNode }> = ({
  label,
  action,
  children,
}) => (
  <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
    <div className="flex items-center justify-between mb-3">
      <span
        className="text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500"
        style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
      >
        {label}
      </span>
      {action}
    </div>
    {children}
  </div>
);

export const FocusColumn: React.FC<FocusColumnProps> = ({
  contact,
  userId,
  relationshipProfile,
  leadScore,
  emailEnabled,
  onAction,
  onUpdateContact,
  onEdit,
  onDelete,
}) => {
  const [notesEditing, setNotesEditing] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Phase 8 — Slack inline DM (Direction A) + "Link Slack" resolver.
  const { features } = useFeatures();
  const [slackOpen, setSlackOpen] = useState(false);
  const [slackBusy, setSlackBusy] = useState(false);
  const [slackSent, setSlackSent] = useState(false);
  const [slackErr, setSlackErr] = useState<string | null>(null);
  const slackRef = useRef<HTMLTextAreaElement>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  const profile = relationshipProfile;
  const score = profile?.relationshipScore;
  const trend = profile?.relationshipTrend;
  const healthColor = score !== undefined ? getRelationshipHealthColor(score) : '#6b7280';
  const trendIcon = trend ? getTrendIcon(trend) : null;
  const trendColor = trend ? getTrendColor(trend) : '#6b7280';
  const provenanceSource = ((contact as Contact & { import_source?: ContactProvenanceSource }).import_source ??
    (contact.source === 'google' ? 'google' : contact.source === 'local' ? 'manual' : 'legacy')) as ContactProvenanceSource;

  const aiContext = profile?.aiRelationshipSummary || profile?.aiNextActionSuggestion;

  const saveNotes = async () => {
    if (notesEditing && notesRef.current) {
      const newNotes = notesRef.current.value.trim();
      if (newNotes !== (contact.notes ?? '').trim()) {
        try {
          await supabase.from('contacts').update({ notes: newNotes || null }).eq('id', contact.id);
          onUpdateContact?.({ ...contact, notes: newNotes || undefined });
          toast.success('Notes saved');
        } catch {
          toast.error('Failed to save notes');
        }
      }
    }
    setNotesEditing((v) => !v);
  };

  const handleSlackSend = async () => {
    const text = slackRef.current?.value.trim() ?? '';
    if (!text) { setSlackErr('Write a message first.'); return; }
    setSlackBusy(true);
    setSlackErr(null);
    try {
      await sendSlackDm(contact, text);
      setSlackSent(true);
      setTimeout(() => { setSlackOpen(false); setSlackSent(false); }, 1600);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'send failed';
      setSlackErr(
        msg === 'NO_TOKEN' ? 'Connect Slack in Settings first.'
          : /missing_scope/.test(msg) ? 'Token needs chat:write — reinstall in Settings.'
          : `Couldn't send: ${msg}`,
      );
    } finally {
      setSlackBusy(false);
    }
  };

  const handleLinkSlack = async () => {
    setLinkBusy(true);
    setLinkMsg(null);
    try {
      const id = await resolveSlackUser(contact);
      if (!id) { setLinkMsg('No Slack member uses this email.'); return; }
      await supabase.from('contacts').update({ slack_user_id: id }).eq('id', contact.id);
      onUpdateContact?.({ ...contact, slackUserId: id });
      toast.success('Linked to Slack');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'lookup failed';
      setLinkMsg(
        msg === 'NO_TOKEN' ? 'Connect Slack in Settings first.'
          : /missing_scope/.test(msg) ? 'Token needs users:read.email — reinstall in Settings.'
          : `Couldn't link: ${msg}`,
      );
    } finally {
      setLinkBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {contact.avatarUrl ? (
              <img
                src={contact.avatarUrl}
                alt={contact.name}
                className={`w-16 h-16 rounded-full object-cover shrink-0 ring-offset-2 ring-offset-white dark:ring-offset-black ${
                  score !== undefined ? ringClassFor(score) : ''
                }`}
              />
            ) : (
              <span
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0 ring-offset-2 ring-offset-white dark:ring-offset-black ${
                  score !== undefined ? ringClassFor(score) : ''
                }`}
                style={{ backgroundColor: contact.avatarColor || '#6366f1' }}
              >
                {contact.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white truncate">{contact.name}</h2>
                {/* IdBadge — Pulse vs external (NEW) */}
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.08em] font-semibold ${
                    contact.pulseUserId
                      ? 'bg-[var(--pulse-rose-soft)] text-[var(--pulse-rose)]'
                      : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400'
                  }`}
                  style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
                >
                  {contact.pulseUserId ? 'On Pulse' : 'External'}
                </span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{contact.role || 'Contact'}</p>
              {contact.company && (
                <p className="text-sm text-rose-600 dark:text-rose-400 font-medium truncate">{contact.company}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <ProvenanceChip
                  variant="chip"
                  source={provenanceSource}
                  addedAt={(contact as Contact & { created_at?: string }).created_at}
                />
                {leadScore && (
                  <>
                    <LeadGradeBadge grade={leadScore.leadGrade} size="md" />
                    <LeadStatusBadge status={leadScore.leadStatus} />
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => onEdit(contact)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition shrink-0"
            title="Edit contact"
          >
            <Pen className="w-4 h-4" />
          </button>
        </div>

        {/* Quick-stats health line */}
        {profile && (
          <div
            className="flex items-center gap-2.5 mt-4 text-[11px] uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400 flex-wrap"
            style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
          >
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold" style={{ color: healthColor }}>
                Score {score ?? '—'}
              </span>
              {trendIcon && <i className={`${trendIcon} text-[10px]`} style={{ color: trendColor }} />}
            </span>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden="true">·</span>
            <span>Last {formatLastInteraction(profile.lastInteractionAt)}</span>
            {profile.preferredChannel && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <i className={`${CHANNEL_ICON[profile.preferredChannel] ?? 'fa-solid fa-message'} text-[10px]`} />
                  <span>Prefers {profile.preferredChannel}</span>
                </span>
              </>
            )}
          </div>
        )}

        {/* ── Your next touch — the adaptive ChannelRow (Phase 1) ── */}
        <div className="mt-5">
          <ChannelRow
            contact={contact}
            emailEnabled={emailEnabled}
            onAction={onAction}
            onNote={() => setNotesEditing(true)}
            slackLinked={!!contact.slackUserId}
            slackSendEnabled={features.slackSend}
            onSlack={() => { setSlackOpen(true); setSlackSent(false); setSlackErr(null); }}
          />

          {/* Phase 8 · Link Slack — external, unlinked, send-on: resolve email → Slack id */}
          {features.slackSend && !contact.pulseUserId && !contact.slackUserId && contact.email && (
            <div
              className="mt-2.5 flex items-center gap-2 rounded-xl border p-2.5"
              style={{ borderColor: 'var(--pulse-border)', background: 'var(--pulse-surface-raised)' }}
            >
              <i className="fa-brands fa-slack text-sm" style={{ color: 'var(--ch-slack, #6d28d9)' }} aria-hidden="true" />
              <span className="text-xs" style={{ color: 'var(--pulse-ink-2)' }}>
                {linkMsg ?? 'Link this contact to Slack to DM them.'}
              </span>
              <button
                type="button"
                onClick={handleLinkSlack}
                disabled={linkBusy}
                className="ml-auto text-xs font-medium px-2.5 py-1 rounded-lg disabled:opacity-50"
                style={{ background: 'var(--pulse-rose)', color: '#fff' }}
              >
                {linkBusy ? 'Linking…' : 'Link Slack'}
              </button>
            </div>
          )}

          {/* Phase 8 · inline Slack DM composer (Direction A — _design-playground/slack-redesign.html) */}
          {slackOpen && contact.slackUserId && (
            <div
              className="mt-2.5 rounded-xl border p-3"
              style={{ borderColor: 'var(--pulse-border-strong)', background: 'var(--pulse-surface)' }}
            >
              {slackSent ? (
                <div className="flex items-center gap-2 text-sm">
                  <i className="fa-solid fa-circle-check" style={{ color: 'var(--pulse-tone-positive, #22c55e)' }} aria-hidden="true" />
                  <span style={{ color: 'var(--pulse-ink-2)' }}>
                    Sent on Slack · <span style={{ color: 'var(--pulse-ink-3)' }}>via Pulse</span>
                  </span>
                </div>
              ) : (
                <>
                  <div
                    className="flex items-center gap-1.5 mb-2 text-[11px] uppercase tracking-[0.08em]"
                    style={{ color: 'var(--ch-slack, #6d28d9)', fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
                  >
                    <i className="fa-brands fa-slack" aria-hidden="true" /> Slack DM · {contact.name}
                  </div>
                  <textarea
                    ref={slackRef}
                    rows={2}
                    placeholder={`Message ${contact.name} on Slack…`}
                    disabled={slackBusy}
                    onChange={() => slackErr && setSlackErr(null)}
                    className="w-full text-sm bg-transparent resize-none focus:outline-none"
                    style={{ color: 'var(--pulse-ink)' }}
                  />
                  <div
                    className="flex items-center justify-between mt-2 pt-2 border-t"
                    style={{ borderColor: 'var(--pulse-border)' }}
                  >
                    <span
                      className="text-[11px]"
                      style={{ color: slackErr ? 'var(--pulse-tone-overdue, #ef4444)' : 'var(--pulse-ink-3)' }}
                    >
                      {slackErr ?? 'Posts as the Pulse bot'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setSlackOpen(false); setSlackErr(null); }}
                        disabled={slackBusy}
                        className="text-xs px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                        style={{ color: 'var(--pulse-ink-3)' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSlackSend}
                        disabled={slackBusy}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                        style={{ background: 'var(--pulse-rose)', color: '#fff' }}
                      >
                        {slackBusy ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── AI context strip (coral — invariant 2) ── */}
      {aiContext && (
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
          <div
            className="rounded-xl p-3 border"
            style={{
              background: 'var(--pulse-coral-bg-08)',
              borderColor: 'var(--pulse-rose-soft)',
            }}
          >
            <div
              className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-[0.1em]"
              style={{ color: 'var(--pulse-coral-fg)', fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
            >
              <Sparkles className="w-3 h-3" />
              AI context
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--pulse-ink-2)' }}>
              {aiContext}
            </p>
          </div>
        </div>
      )}

      {/* ── AI insights (reused tab) ── */}
      {(profile || leadScore) && (
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
          <ContactAIInsightsTab
            profile={profile ?? null}
            insights={null}
            leadScore={leadScore ?? null}
            isLoading={false}
            onRefreshInsights={() => {}}
            onAct={() => onAction('message', contact.id)}
          />
        </div>
      )}

      {/* ── Cadence spine ── */}
      <Section label="Cadence">
        <CadenceSpine contact={contact} userId={userId} />
      </Section>

      {/* ── Contact info ── */}
      <Section label="Contact info">
        <div className="space-y-2.5">
          {contact.email && (
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 flex-shrink-0">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <span className="text-zinc-700 dark:text-zinc-300 select-all truncate">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 flex-shrink-0">
                <Phone className="w-3.5 h-3.5" />
              </div>
              <span className="text-zinc-700 dark:text-zinc-300 select-all">{contact.phone}</span>
            </div>
          )}
          {contact.address && (
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 flex-shrink-0">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <span className="text-zinc-700 dark:text-zinc-300">{contact.address}</span>
            </div>
          )}
          {contact.homeLat != null && contact.homeLng != null ? (
            <MapPreview
              lat={contact.homeLat}
              lng={contact.homeLng}
              addressOverride={contact.homeAddress ?? contact.address ?? undefined}
              isDarkMode={typeof document !== 'undefined' && document.documentElement.classList.contains('dark')}
              height={140}
              className="mt-1"
            />
          ) : contact.workLat != null && contact.workLng != null ? (
            <MapPreview
              lat={contact.workLat}
              lng={contact.workLng}
              addressOverride={contact.workAddress ?? undefined}
              isDarkMode={typeof document !== 'undefined' && document.documentElement.classList.contains('dark')}
              height={140}
              className="mt-1"
            />
          ) : null}
          {contact.website && (
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 flex-shrink-0">
                <Globe className="w-3.5 h-3.5" />
              </div>
              <a
                href={contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-600 dark:text-rose-400 hover:underline truncate"
              >
                {contact.website}
              </a>
            </div>
          )}
          {contact.birthday && (
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 flex-shrink-0">
                <Cake className="w-3.5 h-3.5" />
              </div>
              <span className="text-zinc-700 dark:text-zinc-300">{contact.birthday}</span>
            </div>
          )}
        </div>
      </Section>

      {/* ── Groups / tags (NEW) ── */}
      {contact.groups && contact.groups.length > 0 && (
        <Section label="Groups">
          <div className="flex flex-wrap gap-1.5">
            {contact.groups.map((g) => (
              <span
                key={g}
                className="px-2.5 py-1 rounded-full text-xs border text-zinc-600 dark:text-zinc-300"
                style={{ borderColor: 'var(--pulse-border)', background: 'var(--pulse-surface-raised)' }}
              >
                {g}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ── Notes ── */}
      <Section
        label="Notes"
        action={
          <button
            onClick={saveNotes}
            className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 font-medium"
          >
            {notesEditing ? 'Done' : 'Edit'}
          </button>
        }
      >
        {notesEditing ? (
          <textarea
            ref={notesRef}
            defaultValue={contact.notes ?? ''}
            className="w-full min-h-[80px] text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
            placeholder="Add notes about this contact..."
          />
        ) : (
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 min-h-[60px]">
            {contact.notes || <span className="text-zinc-400 italic">No notes added.</span>}
          </div>
        )}
      </Section>

      {/* ── Interaction timeline ── */}
      <Section label="Timeline">
        <InteractionTimeline contact={contact} userId={userId} />
      </Section>

      {/* ── Danger zone ── */}
      {onDelete && (
        <div className="px-6 py-4">
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmText('');
              setShowDeleteConfirm(true);
            }}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete contact
          </button>
        </div>
      )}

      {/* Typed-confirm delete modal (ported from ContactDetail) */}
      {showDeleteConfirm && onDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => {
            if (!isDeleting) setShowDeleteConfirm(false);
          }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-white/[0.06] max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Delete {contact.name}?</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 mb-4">
                This removes the contact from your network. Notes, relationship history, and AI insights
                go with it. The action cannot be undone.
              </p>
              <label className="block">
                <span
                  className="block mb-1.5 text-[11px] uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400"
                  style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
                >
                  Type <span className="text-rose-600 dark:text-rose-400">DELETE</span> to confirm
                </span>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  autoFocus
                  disabled={isDeleting}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-zinc-900 dark:text-white text-sm focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 disabled:opacity-50"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-zinc-50 dark:bg-white/[0.02] border-t border-zinc-200 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (deleteConfirmText !== 'DELETE') return;
                  setIsDeleting(true);
                  try {
                    await onDelete();
                    toast.success(`Deleted ${contact.name}`, { duration: 5000 });
                    setShowDeleteConfirm(false);
                  } catch {
                    toast.error('Failed to delete contact');
                    setIsDeleting(false);
                  }
                }}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FocusColumn;
