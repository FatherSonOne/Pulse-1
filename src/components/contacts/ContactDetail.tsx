import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Contact } from '../../types';
import { LeadGradeBadge, LeadStatusBadge } from './LeadScoreIndicator';
import { LeadScoreCard } from './LeadScoreIndicator';
import {
  RelationshipProfile,
  RelationshipInsights,
  LeadScore,
  RelationshipSuggestion,
  getRelationshipHealthColor,
  getTrendIcon,
  getTrendColor,
  formatLastInteraction,
} from '../../types/relationshipTypes';
import { ContactGoal, GoalFrequency, getGoalStatus, formatNextActionDate } from '../../types/contactGoalTypes';
import { getGoalForContact, upsertGoal, deleteGoal, markActionComplete } from '../../services/contactGoalService';
import { ContactGoalModal } from './ContactGoalModal';
import { RelationshipAutopilotToggle } from './RelationshipAutopilotToggle';
import { supabase } from '../../services/supabase';
import { useWorkspaceData } from '../../contexts/WorkspaceContext';
import { listWorkspaceContacts, type WorkspaceSharedContact } from '../../services/workspaceContactsService';
import { ProvenanceChip, type ContactProvenanceSource } from './ProvenanceChip';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
import { CardSourceChip } from './cards/CardSourceChip';

import toast from 'react-hot-toast';
import { ArrowRight, Cake, Check, Clock, Globe, Lightbulb, Loader2, Mail, MailOpen, MapPin, MessageSquare, Pen, Phone, Radio, Send, Sparkles, Target, Trash2, Video, X } from 'lucide-react';
import MapPreview from '../map/MapPreview';

// ==================== TYPES ====================

interface ContactDetailProps {
  contact: Contact | null;
  userId?: string;
  onClose: () => void;
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onEdit: (contact: Contact) => void;
  onDelete?: () => Promise<void>;
  /**
   * Phase C: opens ShareCardModal with this contact as subject. When
   * omitted, the "Send as card" header button does not render — keeps
   * Phase B flag-off behavior byte-identical.
   */
  onSendAsCard?: (contact: Contact) => void;
  relationshipProfile?: RelationshipProfile | null;
  insights?: RelationshipInsights | null;
  leadScore?: LeadScore | null;
  isLoadingInsights?: boolean;
  onRefreshInsights?: () => void;
  onSuggestedAction?: (suggestion: RelationshipSuggestion) => void;
  /** Propagate a contact mutation (e.g. notes edit) up to parent state. */
  onUpdateContact?: (updatedContact: Contact) => void;
}

// ==================== HELPERS ====================

function getRelationshipRingClass(score: number): string {
  if (score >= 70) return 'ring-2 ring-emerald-400 dark:ring-emerald-500';
  if (score >= 40) return 'ring-2 ring-amber-400 dark:ring-amber-500';
  return 'ring-2 ring-rose-400 dark:ring-rose-500';
}

const CHANNEL_ICON: Record<string, string> = {
  email:    'fa-solid fa-envelope',
  calendar: 'fa-solid fa-calendar',
  slack:    'fa-brands fa-slack',
  sms:      'fa-solid fa-comment-sms',
  mixed:    'fa-solid fa-shuffle',
};

const STYLE_ICON: Record<string, string> = {
  formal:   'fa-solid fa-briefcase',
  casual:   'fa-solid fa-face-smile',
  brief:    'fa-solid fa-bolt',
  detailed: 'fa-solid fa-bars-staggered',
};

// ==================== SECTION HEADER ====================

const SectionHeader: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <div className="flex items-center gap-2 mb-3">
    <i className={`${icon} text-xs text-zinc-400`} />
    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
      {label}
    </span>
  </div>
);

interface EmailHistoryItem {
  id: string;
  thread_id: string;
  subject: string;
  snippet: string;
  received_at: string;
  is_sent: boolean;
  is_read: boolean;
  from_email: string;
  from_name: string | null;
}

// ==================== MAIN COMPONENT ====================

export const ContactDetail: React.FC<ContactDetailProps> = ({
  contact,
  userId,
  onClose,
  onAction,
  onEdit,
  onDelete,
  onSendAsCard,
  relationshipProfile,
  insights,
  leadScore,
  isLoadingInsights = false,
  onRefreshInsights,
  onSuggestedAction,
  onUpdateContact,
}) => {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspaceData();
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [notesEditing, setNotesEditing] = useState(false);
  const [goal, setGoal] = useState<ContactGoal | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Delete-confirmation modal state. Replaces the previous native
  // `confirm()` dialog which broke visual continuity at the
  // highest-stakes moment in the section. Typed-confirmation
  // ("DELETE") prevents misclicks; real undo would need backend
  // soft-delete plumbing in the parent (future enhancement).
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // ----- Email history (Phase 3) -----
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  const [emailHistoryLoading, setEmailHistoryLoading] = useState(false);
  const [workspaceAuditEntries, setWorkspaceAuditEntries] = useState<WorkspaceSharedContact[]>([]);

  // Load goal for this contact
  useEffect(() => {
    if (!contact || !userId) return;
    getGoalForContact(userId, contact.id)
      .then(g => setGoal(g))
      .catch(() => setGoal(null));
  }, [contact?.id, userId]);

  useEffect(() => {
    if (!contact?.email || !userId) return;
    let cancelled = false;
    setEmailHistoryLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('cached_emails')
          .select('id, thread_id, subject, snippet, received_at, is_sent, is_read, from_email, from_name')
          .eq('user_id', userId)
          .or(`from_email.eq.${contact.email},to_emails.cs.["${contact.email}"]`)
          .order('received_at', { ascending: false })
          .limit(10);
        if (!cancelled) setEmailHistory(data ?? []);
      } catch (err) {
        if (!cancelled) {
          console.warn('[ContactDetail] Email history fetch failed:', err);
        }
      } finally {
        if (!cancelled) setEmailHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contact?.email, userId]);

  useEffect(() => {
    if (!contact?.id || !currentWorkspace?.id) {
      setWorkspaceAuditEntries([]);
      return;
    }
    let cancelled = false;
    listWorkspaceContacts(currentWorkspace.id)
      .then(entries => {
        if (!cancelled) setWorkspaceAuditEntries(entries.filter(entry => entry.id === contact.id));
      })
      .catch(error => console.warn('[ContactDetail] workspace audit fetch failed:', error));
    return () => { cancelled = true; };
  }, [contact?.id, currentWorkspace?.id]);

  if (!contact) return null;

  const profile = relationshipProfile;
  const score = profile?.relationshipScore;
  const trend = profile?.relationshipTrend;
  const healthColor = score !== undefined ? getRelationshipHealthColor(score) : '#6b7280';
  const trendIcon = trend ? getTrendIcon(trend) : null;
  const trendColor = trend ? getTrendColor(trend) : '#6b7280';
  const ringClass = score !== undefined ? getRelationshipRingClass(score) : '';
  const provenanceSource = ((contact as Contact & { import_source?: ContactProvenanceSource }).import_source
    ?? (contact.source === 'google' ? 'google' : contact.source === 'local' ? 'manual' : 'legacy')) as ContactProvenanceSource;

  // Phase C: detect whether this contact originated from an accepted card.
  // TODO(phase-6-review): the schema spec did not pin a definitive column
  // for the indicator (it added `possible_duplicate_of` but not a
  // `from_card_sender` column). Defensible defaults until backend lands:
  //   1. import_source === 'card' (if a future migration adopts this)
  //   2. an as-yet-unnamed `from_card_sender_name` field on Contact
  // Both are nullable; if neither resolves, the chip is hidden silently.
  const cardSourceSenderName = ((contact as Contact & { from_card_sender_name?: string | null }).from_card_sender_name) ?? null;
  const cameFromCard = provenanceSource === 'card' || Boolean(cardSourceSenderName);

  return (
    <>
    <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 flex flex-col">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition"
          >
            <X />
          </button>
          <span className="font-semibold text-zinc-900 dark:text-white text-sm">Contact Details</span>
          <ProvenanceChip
            variant="chip"
            source={provenanceSource}
            addedAt={(contact as Contact & { created_at?: string }).created_at}
          />
          {cameFromCard && (
            <CardSourceChip
              senderName={cardSourceSenderName ?? 'Pulse user'}
              sentAt={(contact as Contact & { created_at?: string }).created_at}
            />
          )}
        </div>
        <div className="flex gap-1">
          {onSendAsCard && (
            <button
              onClick={() => onSendAsCard(contact)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition"
              title={t('contacts.cards.contactDetail.send_as_card_cta')}
              aria-label={t('contacts.cards.contactDetail.send_as_card_aria_format', { name: contact.name })}
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <Send className="text-sm" />
            </button>
          )}
          <button
            onClick={() => onEdit(contact)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition"
            title="Edit contact"
          >
            <Pen className="text-sm" />
          </button>
          {onRefreshInsights && (
            <button
              onClick={onRefreshInsights}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition"
              title="Refresh AI insights"
            >
              <i className={`fa-solid fa-rotate text-sm ${isLoadingInsights ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Hero: Avatar + Name + Quick Stats ── */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="flex flex-col items-center text-center mb-5">
            {/* Avatar with relationship ring */}
            <div className="relative mb-3">
              <div
                className={`
                  w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-md
                  ring-offset-2 ring-offset-white dark:ring-offset-zinc-950
                  ${profile && score !== undefined ? ringClass : ''}
                `}
                style={{ backgroundColor: contact.avatarColor || '#6366f1' }}
              >
                {contact.name.charAt(0)}
              </div>
              {/* VIP star removed — VIP status is already exposed via the
                  "VIP Contacts" smart list filter. The per-card gold-amber
                  badge was decorative redundancy. */}
            </div>

            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{contact.name}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{contact.role}</p>
            {contact.company && (
              <p className="text-sm text-rose-600 dark:text-rose-400 font-medium mt-0.5">{contact.company}</p>
            )}

            {/* Lead badges */}
            {leadScore && (
              <div className="flex items-center gap-2 mt-2">
                <LeadGradeBadge grade={leadScore.leadGrade} size="md" />
                <LeadStatusBadge status={leadScore.leadStatus} />
              </div>
            )}
          </div>

          {/* Quick stats — inline mono summary instead of the previous
              3-up hero-metric grid. Hero-metric (big number + small label,
              repeated three times) is the forbidden template per the
              impeccable critique; the three facts stay visible but no
              longer compete as identical card chrome. */}
          {profile && (
            <div
              className="flex items-center justify-center gap-2.5 mb-4 text-[11px] uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400 flex-wrap"
              style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
            >
              {/* Score + trend */}
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold" style={{ color: healthColor }}>
                  Score {score ?? '—'}
                </span>
                {trendIcon && (
                  <i className={`${trendIcon} text-[10px]`} style={{ color: trendColor }} />
                )}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600" aria-hidden="true">·</span>
              {/* Last contact */}
              <span>
                Last {formatLastInteraction(profile.lastInteractionAt)}
              </span>
              {profile.preferredChannel && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600" aria-hidden="true">·</span>
                  {/* Preferred channel */}
                  <span className="inline-flex items-center gap-1">
                    <i className={`${CHANNEL_ICON[profile.preferredChannel] ?? 'fa-solid fa-message'} text-[10px]`} />
                    <span>Prefers {profile.preferredChannel}</span>
                  </span>
                </>
              )}
            </div>
          )}

          {/* Action buttons — neutral cluster. Previously Message=blue,
              Vox=orange, Meet=green, which blew the coral budget on
              routes (not state) and read like Salesforce-in-coral-wrapper.
              These three actions are channels, not signal — they share
              one chrome treatment and inherit coral only via hover.
              When unread state lands (future PR), the relevant channel
              can adopt rose-soft to actually signal urgency. */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onAction('message', contact.id)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/[0.06] hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-500/30 transition"
            >
              <MessageSquare className="text-lg" />
              <span className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>Message</span>
            </button>
            <button
              onClick={() => onAction('vox', contact.id)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/[0.06] hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-500/30 transition"
            >
              <Radio className="text-lg" />
              <span className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>Vox</span>
            </button>
            <button
              onClick={() => onAction('meet', contact.id)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/[0.06] hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-500/30 transition"
            >
              <Video className="text-lg" />
              <span className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>Meet</span>
            </button>
          </div>
        </div>

        {/* ── AI Intelligence Card ── */}
        {profile && (
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
            <SectionHeader icon="fa-solid fa-wand-magic-sparkles" label="AI Intelligence" />

            {isLoadingInsights ? (
              <div className="flex items-center gap-3 py-4">
                <div className="animate-spin w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full" />
                <span className="text-sm text-zinc-500">Analyzing relationship...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* AI Summary (collapsible) */}
                {profile.aiRelationshipSummary && (
                  <div
                    className="rounded-xl p-3.5 border"
                    style={{ background: 'var(--pulse-coral-bg-08)', borderColor: 'var(--pulse-coral-bg-12)' }}
                  >
                    <button
                      onClick={() => setSummaryExpanded(v => !v)}
                      className="w-full flex items-center justify-between text-left mb-1.5"
                    >
                      <AIProvenanceChip vendor="PULSE AI" type="SUMMARY" />
                      <i
                        className={`fa-solid fa-chevron-${summaryExpanded ? 'up' : 'down'} text-xs`}
                        style={{ color: 'var(--pulse-coral-fg)' }}
                      />
                    </button>
                    {summaryExpanded && (
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--pulse-coral-fg)' }}>
                        {profile.aiRelationshipSummary}
                      </p>
                    )}
                  </div>
                )}

                {/* Suggested next action */}
                {profile.aiNextActionSuggestion && (
                  <div
                    className="p-3 rounded-xl border"
                    style={{ background: 'var(--pulse-coral-bg-08)', borderColor: 'var(--pulse-coral-bg-12)' }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <AIProvenanceChip vendor="PULSE AI" type="SUGGESTION" />
                      <button
                        onClick={() => onAction('message', contact.id)}
                        className="flex-shrink-0 px-2.5 py-1 text-white text-xs font-medium rounded-lg transition"
                        style={{ background: 'var(--pulse-rose)' }}
                      >
                        Act
                      </button>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--pulse-coral-fg)' }}>{profile.aiNextActionSuggestion}</p>
                  </div>
                )}

                {/* Communication style + avg reply */}
                <div className="flex gap-2">
                  {profile.aiCommunicationStyle && (
                    <div className="flex-1 flex items-center gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      <i className={`${STYLE_ICON[profile.aiCommunicationStyle] ?? 'fa-solid fa-comment'} text-xs text-zinc-400`} />
                      <div>
                        <div className="text-xs text-zinc-400">Style</div>
                        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 capitalize">{profile.aiCommunicationStyle}</div>
                      </div>
                    </div>
                  )}
                  {profile.avgResponseTimeHours !== undefined && (
                    <div className="flex-1 flex items-center gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      <Clock className="text-xs text-zinc-400" />
                      <div>
                        <div className="text-xs text-zinc-400">Avg reply</div>
                        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          {profile.avgResponseTimeHours < 1
                            ? '< 1hr'
                            : profile.avgResponseTimeHours < 24
                            ? `${Math.round(profile.avgResponseTimeHours)}hr`
                            : `${Math.round(profile.avgResponseTimeHours / 24)}d`}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Topics */}
                {profile.aiTopics && profile.aiTopics.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-400 mb-1.5">Topics</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.aiTopics.slice(0, 6).map(topic => (
                        <span
                          key={topic}
                          className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs rounded-full"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Talking points */}
                {insights && insights.talkingPoints.length > 0 && (
                  <div>
                    <div className="mb-1.5">
                      <AIProvenanceChip vendor="PULSE AI" type="TALKING POINTS" />
                    </div>
                    <ul className="space-y-1.5">
                      {insights.talkingPoints.slice(0, 3).map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                          <span className="w-4 h-4 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggested actions from insights */}
                {insights && insights.suggestions.length > 0 && (
                  <div>
                    <div className="mb-1.5">
                      <AIProvenanceChip vendor="PULSE AI" type="INSIGHTS" />
                    </div>
                    <div className="space-y-1.5">
                    {insights.suggestions.slice(0, 2).map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSuggestedAction?.(suggestion)}
                        className={`w-full p-3 text-left rounded-xl border transition group hover:shadow-sm text-sm ${
                          suggestion.type === 'warning'
                            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                            : suggestion.type === 'insight'
                            ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-rose-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-medium text-sm ${
                            suggestion.type === 'warning' ? 'text-red-800 dark:text-red-300'
                            : suggestion.type === 'insight' ? 'text-blue-800 dark:text-blue-300'
                            : 'text-zinc-800 dark:text-zinc-200'
                          }`}>
                            {suggestion.title}
                          </span>
                          <ArrowRight className="text-zinc-300 group-hover:text-rose-500 transition text-xs" />
                        </div>
                        <p className={`text-xs mt-0.5 ${
                          suggestion.type === 'warning' ? 'text-red-600 dark:text-red-400'
                          : suggestion.type === 'insight' ? 'text-blue-600 dark:text-blue-400'
                          : 'text-zinc-500'
                        }`}>
                          {suggestion.description}
                        </p>
                      </button>
                    ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Keep-in-Touch Goal ── */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon="fa-solid fa-bullseye" label="Keep-in-Touch Goal" />
            <button
              onClick={() => setGoalModalOpen(true)}
              className="text-xs font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition"
            >
              {goal ? 'Edit' : '+ Set goal'}
            </button>
          </div>

          {goal ? (
            <div className="space-y-2">
              {/* Goal summary chip */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  getGoalStatus(goal) === 'overdue'
                    ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'
                    : getGoalStatus(goal) === 'due_soon'
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                }`}>
                  <i className={`fa-solid ${
                    getGoalStatus(goal) === 'overdue' ? 'fa-circle-exclamation' :
                    getGoalStatus(goal) === 'due_soon' ? 'fa-clock' : 'fa-circle-check'
                  } text-[10px]`} />
                  {formatNextActionDate(goal.nextActionAt)}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 capitalize">
                  {goal.frequency.replace('biweekly', 'bi-weekly')} · {goal.channel === 'any' ? 'any channel' : goal.channel}
                </span>
              </div>

              {/* Reminder note */}
              {goal.notes && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                  "{goal.notes}"
                </p>
              )}

              {/* Autopilot toggle */}
              {userId && (
                <RelationshipAutopilotToggle
                  goal={goal}
                  userId={userId}
                  onGoalUpdated={setGoal}
                />
              )}

              {/* Mark done button */}
              <button
                onClick={async () => {
                  if (!userId) return;
                  await markActionComplete(goal.id, userId, goal.frequency);
                  const updated = await getGoalForContact(userId, contact.id);
                  setGoal(updated);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-xl border border-emerald-100 dark:border-emerald-800/40 transition"
              >
                <Check />
                Mark done, schedule next
              </button>
            </div>
          ) : (
            <button
              onClick={() => setGoalModalOpen(true)}
              className="w-full flex flex-col items-center justify-center gap-1.5 py-5 text-zinc-400 dark:text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-500 dark:hover:text-rose-400 transition group"
            >
              <Target className="text-xl group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium">Set a keep-in-touch goal</span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Get reminded when it's time to reach out</span>
            </button>
          )}
        </div>

        {/* ── Lead Score (if applicable) ── */}
        {leadScore && (
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
            <SectionHeader icon="fa-solid fa-chart-line" label="Lead Score" />
            <LeadScoreCard
              score={leadScore.leadScore}
              grade={leadScore.leadGrade}
              status={leadScore.leadStatus}
              buyingSignals={leadScore.buyingSignalCount}
              conversionProbability={leadScore.aiConversionProbability}
              churnRisk={leadScore.aiChurnRisk}
            />
          </div>
        )}

        {/* ── Contact Info ── */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
          <SectionHeader icon="fa-solid fa-address-card" label="Contact Info" />
          <div className="space-y-2.5">
            {contact.email && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 flex-shrink-0">
                  <Mail className="text-xs" />
                </div>
                <span className="text-zinc-700 dark:text-zinc-300 select-all truncate">{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 flex-shrink-0">
                  <Phone className="text-xs" />
                </div>
                <span className="text-zinc-700 dark:text-zinc-300 select-all">{contact.phone}</span>
              </div>
            )}
            {contact.address && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 flex-shrink-0">
                  <MapPin className="text-xs" />
                </div>
                <span className="text-zinc-700 dark:text-zinc-300">{contact.address}</span>
              </div>
            )}

            {/* Embedded map preview — shows when the contact has any geocoded
                location. Tap routes back to the Map tab. First cross-section
                consumer of <MapPreview> + the universal Place schema. */}
            {(contact.homeLat != null && contact.homeLng != null) ? (
              <MapPreview
                lat={contact.homeLat}
                lng={contact.homeLng}
                addressOverride={contact.homeAddress ?? contact.address ?? undefined}
                isDarkMode={typeof document !== 'undefined' && document.documentElement.classList.contains('dark')}
                height={140}
                className="mt-1"
              />
            ) : (contact.workLat != null && contact.workLng != null) ? (
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
                  <Globe className="text-xs" />
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
                  <Cake className="text-xs" />
                </div>
                <span className="text-zinc-700 dark:text-zinc-300">{contact.birthday}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Notes ── */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon="fa-solid fa-note-sticky" label="Notes" />
            <button
              onClick={async () => {
                if (notesEditing && notesRef.current && contact) {
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
                setNotesEditing(v => !v);
              }}
              className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 font-medium"
            >
              {notesEditing ? 'Done' : 'Edit'}
            </button>
          </div>
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
        </div>

        {/* ── Email History (Phase 3) ── */}
        <div className="px-6 py-4">
          <SectionHeader icon="fa-solid fa-envelope-clock" label="Email History" />
          {workspaceAuditEntries.length > 0 && (
            <div
              className="mb-4 rounded-xl border p-3"
              style={{ background: 'var(--pulse-surface-raised)', borderColor: 'var(--pulse-border)' }}
            >
              <p
                className="mb-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--pulse-ink-3)' }}
              >
                {t('contacts.workspaceShare.audit_title')}
              </p>
              <div className="space-y-2">
                {workspaceAuditEntries.map(entry => {
                  const sharedBy = entry.shared_by
                    ? t('contacts.workspaceShare.audit_shared_by', { user: entry.shared_by })
                    : ` ${t('contacts.workspaceShare.shared_by_former_user')}`;
                  return (
                    <div
                      key={`${entry.id}-${entry.shared_at}`}
                      className="text-xs"
                      style={{ color: 'var(--pulse-ink-2)' }}
                    >
                      {t('contacts.workspaceShare.audit_shared_with', {
                        workspace: currentWorkspace?.name ?? '',
                        date: new Date(entry.shared_at).toLocaleDateString(),
                        by: sharedBy,
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {emailHistoryLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="animate-spin text-rose-500" />
            </div>
          ) : emailHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-zinc-400">
              <MailOpen className="text-2xl mb-2" />
              <p className="text-sm">No emails found</p>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {emailHistory.map((email) => (
                <div
                  key={email.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
                >
                  {/* Direction indicator */}
                  <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    email.is_sent
                      ? 'bg-rose-500/10 text-rose-500'
                      : 'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    <i className={`fa-solid text-xs ${email.is_sent ? 'fa-paper-plane' : 'fa-inbox'}`} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-semibold truncate ${
                        !email.is_read ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {email.subject || '(no subject)'}
                      </p>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                        {email.received_at ? new Date(email.received_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 truncate mt-0.5">
                      {email.snippet}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Danger Zone ── */}
        {onDelete && (
          <div className="px-6 py-4 border-t border-red-100 dark:border-red-900/30">
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmText('');
                setShowDeleteConfirm(true);
              }}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="animate-spin text-sm" /> : <Trash2 className="text-sm" />}
              Delete Contact
            </button>
          </div>
        )}

      </div>
    </div>

    {/* ── Goal Modal ── */}
    {goalModalOpen && userId && (
      <ContactGoalModal
        contact={{ ...contact, pulseUserId: userId }}
        existingGoal={goal}
        onSave={async (goalData) => {
          const saved = await upsertGoal({ ...goalData, userId });
          setGoal(saved);
        }}
        onDelete={async (goalId) => {
          await deleteGoal(goalId, userId);
          setGoal(null);
        }}
        onClose={() => setGoalModalOpen(false)}
      />
    )}

    {/* ── Delete Confirmation Modal ──
        Typed-confirmation pattern: user must type DELETE before the
        button activates. Replaces the previous native `confirm()` which
        popped OS chrome on top of the dark canvas at the highest-stakes
        moment in the section. */}
    {showDeleteConfirm && onDelete && (
      <div
        className="pulse-modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
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
          aria-labelledby="delete-contact-heading"
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-md flex-shrink-0"
                style={{ backgroundColor: contact.avatarColor || '#6366f1' }}
              >
                {contact.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  id="delete-contact-heading"
                  className="text-base font-semibold text-zinc-900 dark:text-white truncate"
                >
                  Delete {contact.name}?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {contact.role || 'Contact'}
                  {contact.company ? ` · ${contact.company}` : ''}
                </p>
              </div>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
              This removes the contact from your network. Notes,
              relationship history, and AI insights for this person
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
                aria-label="Type DELETE to confirm"
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
              {isDeleting ? <Loader2 className="animate-spin text-sm" /> : <Trash2 className="text-sm" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default ContactDetail;
