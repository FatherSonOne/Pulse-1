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

import toast from 'react-hot-toast';
import { ArrowRight, Cake, Check, Clock, Globe, Lightbulb, Loader2, Mail, MailOpen, MapPin, MessageSquare, Pen, Phone, Radio, Sparkles, Star, Target, Trash2, Video, X } from 'lucide-react';
import MapPreview from '../map/MapPreview';

// ==================== TYPES ====================

interface ContactDetailProps {
  contact: Contact | null;
  userId?: string;
  onClose: () => void;
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onEdit: (contact: Contact) => void;
  onDelete?: () => Promise<void>;
  relationshipProfile?: RelationshipProfile | null;
  insights?: RelationshipInsights | null;
  leadScore?: LeadScore | null;
  isLoadingInsights?: boolean;
  onRefreshInsights?: () => void;
  onSuggestedAction?: (suggestion: RelationshipSuggestion) => void;
}

// ==================== HELPERS ====================

function getRelationshipRingClass(score: number): string {
  if (score >= 70) return 'ring-4 ring-emerald-400 dark:ring-emerald-500';
  if (score >= 40) return 'ring-4 ring-amber-400 dark:ring-amber-500';
  return 'ring-4 ring-rose-400 dark:ring-rose-500';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Weak';
  return 'At Risk';
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
  relationshipProfile,
  insights,
  leadScore,
  isLoadingInsights = false,
  onRefreshInsights,
  onSuggestedAction,
}) => {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspaceData();
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [notesEditing, setNotesEditing] = useState(false);
  const [goal, setGoal] = useState<ContactGoal | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
        </div>
        <div className="flex gap-1">
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
              {/* VIP star */}
              {profile?.isVip && (
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
                  <Star className="text-xs text-white" />
                </div>
              )}
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

          {/* Quick stats row */}
          {profile && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {/* Connection strength */}
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-lg font-bold" style={{ color: healthColor }}>{score}</span>
                  {trendIcon && (
                    <i className={`${trendIcon} text-xs`} style={{ color: trendColor }} />
                  )}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {score !== undefined ? getScoreLabel(score) : 'No data'}
                </div>
                {/* Mini bar */}
                <div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${score ?? 0}%`, backgroundColor: healthColor }}
                  />
                </div>
              </div>

              {/* Last interaction */}
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
                <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-0.5 leading-tight">
                  {formatLastInteraction(profile.lastInteractionAt)}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Last contact</div>
              </div>

              {/* Preferred channel */}
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 text-center border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-center mb-0.5">
                  <i className={`${CHANNEL_ICON[profile.preferredChannel] ?? 'fa-solid fa-message'} text-rose-500 text-sm`} />
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                  {profile.preferredChannel ?? 'Unknown'}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onAction('message', contact.id)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
            >
              <MessageSquare className="text-lg" />
              <span className="text-xs font-bold uppercase">Message</span>
            </button>
            <button
              onClick={() => onAction('vox', contact.id)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition"
            >
              <Radio className="text-lg" />
              <span className="text-xs font-bold uppercase">Vox</span>
            </button>
            <button
              onClick={() => onAction('meet', contact.id)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition"
            >
              <Video className="text-lg" />
              <span className="text-xs font-bold uppercase">Meet</span>
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
                  <div className="bg-gradient-to-br from-rose-50 to-rose-50 dark:from-rose-900/15 dark:to-rose-900/15 rounded-xl p-3.5 border border-rose-100 dark:border-rose-900/30">
                    <button
                      onClick={() => setSummaryExpanded(v => !v)}
                      className="w-full flex items-center justify-between text-left mb-1.5"
                    >
                      <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                        <Sparkles className="text-xs" />
                        AI Summary
                      </span>
                      <i className={`fa-solid fa-chevron-${summaryExpanded ? 'up' : 'down'} text-xs text-rose-400`} />
                    </button>
                    {summaryExpanded && (
                      <p className="text-sm text-rose-800 dark:text-rose-200 leading-relaxed">
                        {profile.aiRelationshipSummary}
                      </p>
                    )}
                  </div>
                )}

                {/* Suggested next action */}
                {profile.aiNextActionSuggestion && (
                  <div className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-rose-900/15 rounded-xl border border-rose-100 dark:border-rose-900/30">
                    <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Lightbulb className="text-xs text-rose-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-0.5">Suggested next step</p>
                      <p className="text-sm text-rose-800 dark:text-rose-200">{profile.aiNextActionSuggestion}</p>
                    </div>
                    <button
                      onClick={() => onAction('message', contact.id)}
                      className="flex-shrink-0 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg transition"
                    >
                      Act
                    </button>
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
                    <p className="text-xs text-zinc-400 mb-1.5">Talking points</p>
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
                Mark as done — schedule next
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
                      contact.notes = newNotes || undefined;
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
              onClick={async () => {
                if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) return;
                setIsDeleting(true);
                try {
                  await onDelete();
                  toast.success('Contact deleted');
                } catch {
                  toast.error('Failed to delete contact');
                  setIsDeleting(false);
                }
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
    </>
  );
};

export default ContactDetail;
