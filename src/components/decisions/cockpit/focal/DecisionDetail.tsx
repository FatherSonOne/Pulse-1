/**
 * DecisionDetail — the focal pane for a decision. Subsumes EnhancedDecisionCard:
 * status/type/source/ID header, description, a PostHog property table, the
 * vote tally + cast-vote footer (with already-voted state), the AI intelligence
 * block (risk + consensus, hidden on quota), Generate Tasks → DecisionDecomposer,
 * Send Reminder, and the PlacePicker venue. Vote/risk/consensus logic is ported
 * from EnhancedDecisionCard, reusing the same services.
 *
 * Coral budget (CLAUDE.md §4): coral only in the AI intelligence block. Status
 * uses the decision-status palette; vote chips use the vote-choice palette.
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Bell, ListTodo, CheckCircle, ThumbsUp, ThumbsDown, AlertTriangle, MinusCircle } from 'lucide-react';
import { decisionService, type DecisionWithVotes, type DecisionVote } from '../../../../services/decisionService';
import { decisionAnalyticsService, type RiskAssessment } from '../../../../services/decisionAnalyticsService';
import { consensusDetectorService } from '../../../../services/consensusDetectorService';
import { notificationService } from '../../../../services/notificationService';
import type { User } from '../../../../types';
import PlacePicker from '../../../map/PlacePicker';
import { Prop, PropertyTable } from './PropertyTable';
import { FocalScaffold, ActBtn } from './FocalActions';
import { ActivityLog } from './ActivityLog';
import { CommentsSection } from './CommentsSection';
import { resolveSource, SourceTag } from '../sources';

export interface DecisionActions {
  currentUserId: string;
  workspaceId: string;
  members: User[];
  linkedTaskCounts: Record<string, number>;
  onVoted: () => void;
  onGenerateTasks: (decision: DecisionWithVotes) => void;
}

interface DecisionDetailProps extends DecisionActions {
  decision: DecisionWithVotes;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'var(--dt-status-proposed)' },
  voting: { label: 'Voting', color: 'var(--dt-status-voting)' },
  decided: { label: 'Decided', color: 'var(--dt-status-decided)' },
  cancelled: { label: 'Cancelled', color: 'var(--dt-status-cancelled)' },
};

type Choice = 'approve' | 'reject' | 'concern' | 'abstain';
const VOTE_META: { choice: Choice; label: string; color: string; Icon: typeof ThumbsUp }[] = [
  { choice: 'approve', label: 'Approve', color: 'var(--dt-status-decided)', Icon: ThumbsUp },
  { choice: 'reject', label: 'Reject', color: 'var(--dt-status-overdue)', Icon: ThumbsDown },
  { choice: 'concern', label: 'Concern', color: 'var(--dt-status-voting)', Icon: AlertTriangle },
  { choice: 'abstain', label: 'Abstain', color: 'var(--dt-status-todo)', Icon: MinusCircle },
];
const RISK_COLOR: Record<string, string> = {
  low: 'var(--dt-status-done)', medium: 'var(--dt-status-voting)', high: 'var(--dt-status-overdue)',
};

export function DecisionDetail({
  decision, currentUserId, members, linkedTaskCounts, onVoted, onGenerateTasks,
}: DecisionDetailProps) {
  const [userVote, setUserVote] = useState<DecisionVote | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [consensus, setConsensus] =
    useState<{ reached: boolean; winning_choice: string | null; reasoning: string } | null>(null);

  const votes = decision.votes || [];
  const voteCounts = useMemo(() => decisionService.calculateVoteCounts(votes), [votes]);
  const totalVotes = useMemo(() => Object.values(voteCounts).reduce((s, n) => s + n, 0), [voteCounts]);

  // Resolve who voted / proposed to display names where possible.
  const nameOf = (id?: string) =>
    id === currentUserId ? 'You' : members.find((m) => m.id === id)?.name || (id ? id.slice(0, 8) : '—');

  useEffect(() => {
    const mine = votes.find((v) => v.user_id === currentUserId) || null;
    setUserVote(mine);
    setHasVoted(!!mine);
  }, [votes, currentUserId]);

  // AI insights — risk (voting/proposed) + consensus (≥3 votes). Service caches
  // + backs off internally; confidence === -1 means quota exhausted → hide.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (decision.status === 'voting' || decision.status === 'proposed') {
        try {
          const r = await decisionAnalyticsService.assessDecisionRisk(decision, '');
          if (!cancelled) setRisk(r);
        } catch { /* non-critical */ }
      }
      if (decision.status === 'voting' && votes.length >= 3) {
        try {
          const c = consensusDetectorService.detectConsensus(decision);
          if (!cancelled) setConsensus({ reached: c.reached, winning_choice: c.winning_choice, reasoning: c.reasoning });
        } catch { /* non-critical */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision.id, votes.length]);

  const handleVote = async (choice: Choice) => {
    try {
      await decisionService.castVote({ decision_id: decision.id, user_id: currentUserId, choice });
      setHasVoted(true);
      toast.success(`Voted: ${choice}`);
      onVoted();
    } catch (error) {
      console.error('Failed to vote:', error);
      toast.error('Could not record vote');
    }
  };

  const handleSendReminder = async () => {
    try {
      await notificationService.notifyDecisionEvent({
        type: 'new_vote',
        decisionTitle: decision.title,
        actionUrl: `/decisions?id=${decision.id}`,
      });
      toast.success('Reminder sent');
    } catch (error) {
      console.error('Failed to send reminder:', error);
      toast.error('Could not send reminder');
    }
  };

  const statusMeta = STATUS_META[decision.status] ?? STATUS_META.proposed;
  const source = decision.metadata?.source as string | undefined;
  const resolvedSource = resolveSource(source);
  const linkedCount = linkedTaskCounts[decision.id] ?? 0;
  const isDecided = decision.status === 'decided';
  const showRiskBadge = risk && risk.confidence !== -1 && (decision.status === 'voting' || decision.status === 'proposed');

  const footer = (
    <>
      {decision.status === 'voting' && !hasVoted && (
        <>
          <span className="ck-vote-label">Cast vote</span>
          {VOTE_META.map((v) => (
            <button
              key={v.choice}
              type="button"
              className="ck-vote-btn"
              style={{ color: v.color, background: `color-mix(in oklab, ${v.color} 12%, transparent)` }}
              onClick={() => handleVote(v.choice)}
            >
              <v.Icon size={14} /> {v.label}
            </button>
          ))}
        </>
      )}
      {decision.status === 'voting' && hasVoted && (
        <span className="ck-voted-indicator">
          <CheckCircle size={15} /> You voted: <strong>{userVote?.choice}</strong>
        </span>
      )}
      {(decision.status === 'decided' || (decision.status as string) === 'approved') && (
        <ActBtn
          icon={ListTodo}
          label={linkedCount > 0 ? `Generate tasks · ${linkedCount}` : 'Generate tasks'}
          primary
          onClick={() => onGenerateTasks(decision)}
        />
      )}
      <div style={{ flex: 1 }} />
      {decision.status === 'voting' && <ActBtn icon={Bell} label="Remind" onClick={handleSendReminder} />}
    </>
  );

  return (
    <FocalScaffold footer={footer}>
      <div className="ck-focal-pad">
        <div className="ck-focal-strip">
          <span className="ck-status-pill" style={{ color: statusMeta.color, background: 'color-mix(in oklab, ' + statusMeta.color + ' 12%, transparent)' }}>
            {statusMeta.label}
          </span>
          <span className="ck-focal-type">{decision.decision_type}</span>
          {resolvedSource && <SourceTag source={source} />}
          <span className="ck-focal-id">{decision.id.slice(0, 8).toUpperCase()}</span>
        </div>

        <h2 className="ck-focal-h2">{decision.title}</h2>
        {decision.description && <p className="ck-focal-desc">{decision.description}</p>}

        <PropertyTable>
          <Prop label="Type">{decision.decision_type}</Prop>
          {resolvedSource && (
            <Prop label="Source"><SourceTag source={source} /></Prop>
          )}
          <Prop label="Votes"><span className="ck-mono-num">{totalVotes} cast</span></Prop>
          <Prop label="Proposed by">{nameOf(decision.proposed_by)}</Prop>
          {isDecided && decision.final_decision && (
            <Prop label="Decision">{decision.final_decision}</Prop>
          )}
        </PropertyTable>

        {/* Tally */}
        {totalVotes > 0 && (
          <div className="ck-tally">
            <div className="ck-tally-head">
              <span className="ck-focal-section-label" style={{ margin: 0 }}>Tally</span>
              <span className="ck-mono-num ck-tally-total">{totalVotes} votes</span>
            </div>
            {(['approve', 'concern', 'reject', 'abstain'] as Choice[]).map((choice) => {
              const count = voteCounts[choice] || 0;
              if (count === 0) return null;
              const meta = VOTE_META.find((v) => v.choice === choice)!;
              return (
                <div key={choice} className="ck-tally-row">
                  <div className="ck-tally-row-head">
                    <span style={{ color: meta.color }}>{meta.label}</span>
                    <span className="ck-mono-num">{count} ({Math.round((count / totalVotes) * 100)}%)</span>
                  </div>
                  <div className="ck-tally-bar">
                    <div className="ck-tally-fill" style={{ width: `${(count / totalVotes) * 100}%`, background: meta.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* AI intelligence (coral — AI-output surface) */}
        {(showRiskBadge || consensus) && (
          <div className="ck-ai-block">
            <div className="ck-ai-block-head">
              <span className="ck-ai-chip">Pulse AI</span>
              <span className="ck-ai-block-title">Decision intelligence</span>
              {showRiskBadge && (
                <span className="ck-risk-badge" style={{ color: RISK_COLOR[risk!.riskLevel], background: `color-mix(in oklab, ${RISK_COLOR[risk!.riskLevel]} 14%, transparent)` }}>
                  {risk!.riskLevel} risk
                </span>
              )}
            </div>
            {showRiskBadge && <p className="ck-ai-note">{risk!.reasoning}</p>}
            {showRiskBadge && risk!.riskLevel !== 'low' && risk!.recommendations.length > 0 && (
              <ul className="ck-ai-recs">
                {risk!.recommendations.slice(0, 2).map((rec, i) => <li key={i}>{rec}</li>)}
              </ul>
            )}
            {consensus && (
              <p className="ck-ai-note">
                {consensus.reached
                  ? <><strong>Consensus toward {consensus.winning_choice}.</strong> {consensus.reasoning}</>
                  : <><strong>No consensus yet.</strong> {consensus.reasoning}</>}
              </p>
            )}
          </div>
        )}

        {/* Venue / geofence */}
        <div className="ck-focal-section-label">Venue</div>
        <div style={{ maxWidth: 360, marginBottom: 8 }}>
          <PlacePicker entityType="decision" entityId={decision.id} role="venue" />
        </div>

        <ActivityLog source="decision" itemId={decision.id} members={members} />
        <CommentsSection
          source="decision"
          itemId={decision.id}
          workspaceId={decision.workspace_id}
          currentUserId={currentUserId}
          members={members}
        />
      </div>
    </FocalScaffold>
  );
}
