// ============================================
// CONTACT AI INSIGHTS TAB COMPONENT
// Full AI insights view for contact detail
// ============================================

import React, { useState, useEffect } from 'react';
import {
  RelationshipProfile,
  RelationshipInsights,
  HealthFactor,
  RelationshipSuggestion,
  LeadScore,
  getRelationshipHealthColor,
  getTrendIcon,
  getTrendColor,
  formatLastInteraction,
} from '../../types/relationshipTypes';
import { RelationshipHealthCard } from './RelationshipHealthCard';
import { LeadScoreCard } from './LeadScoreIndicator';
import { BriefingChip, InsightTone } from '../Briefing/inline/InlineInsight';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';

import { ArrowRight, BarChart2, ChevronDown, ChevronUp, Clock, Globe, MessageSquare, PieChart, RefreshCw, Wand2, Zap } from 'lucide-react';

function profileTransitionInsight(profile: RelationshipProfile):
  | { tone: InsightTone; label: string; title: string }
  | null {
  const score = profile.relationshipScore ?? 50;
  const trend = profile.relationshipTrend;
  if (trend === 'falling' && score < 40) {
    return { tone: 'overdue', label: 'GONE QUIET', title: 'Reply pattern dropped below baseline' };
  }
  if (trend === 'falling' && score < 60) {
    return { tone: 'warning', label: 'COOLING', title: 'Engagement trending down' };
  }
  if (trend === 'rising' && score >= 70) {
    return { tone: 'positive', label: 'WARMING UP', title: 'Engagement climbing' };
  }
  return null;
}

interface ContactAIInsightsTabProps {
  profile: RelationshipProfile | null;
  insights: RelationshipInsights | null;
  leadScore: LeadScore | null;
  isLoading?: boolean;
  onRefreshInsights: () => void;
  onSuggestedAction?: (suggestion: RelationshipSuggestion) => void;
  /** Profile-level next-action "Act" trigger (e.g. open Messages). */
  onAct?: () => void;
}

export const ContactAIInsightsTab: React.FC<ContactAIInsightsTabProps> = ({
  profile,
  insights,
  leadScore,
  isLoading = false,
  onRefreshInsights,
  onSuggestedAction,
  onAct,
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'factors' | 'leads'>('overview');
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm text-zinc-500">Analyzing relationship...</p>
        </div>
      </div>
    );
  }

  const transitionChip = profile ? profileTransitionInsight(profile) : null;

  return (
    <div className="space-y-6">
      {/* Inline transition chip — appears only when state crossed a threshold */}
      {transitionChip && (
        <div className="flex items-center gap-2 -mt-2 mb-1">
          <BriefingChip
            tone={transitionChip.tone}
            label={transitionChip.label}
            title={transitionChip.title}
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{transitionChip.title}</span>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
        {(['overview', 'factors', 'leads'] as const).map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
              activeSection === section
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {section === 'overview' && 'Overview'}
            {section === 'factors' && 'Health Factors'}
            {section === 'leads' && 'Lead Score'}
          </button>
        ))}
      </div>

      {/* Overview Section */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Relationship Health Card */}
          {profile && (
            <RelationshipHealthCard
              profile={profile}
              showTrend={true}
              showLastInteraction={true}
            />
          )}

          {/* AI Summary (collapsible) with provenance */}
          {profile?.aiRelationshipSummary && (
            <div
              className="rounded-xl p-3.5 border"
              style={{ background: 'var(--pulse-coral-bg-08)', borderColor: 'var(--pulse-coral-bg-12)' }}
            >
              <button
                onClick={() => setSummaryExpanded(v => !v)}
                className="w-full flex items-center justify-between text-left mb-1.5"
              >
                <AIProvenanceChip vendor="PULSE AI" type="SUMMARY" />
                {summaryExpanded
                  ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--pulse-coral-fg)' }} />
                  : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--pulse-coral-fg)' }} />}
              </button>
              {summaryExpanded && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--pulse-coral-fg)' }}>
                  {profile.aiRelationshipSummary}
                </p>
              )}
            </div>
          )}

          {/* Suggested next action + Act (profile-level) */}
          {profile?.aiNextActionSuggestion && (
            <div
              className="p-3 rounded-xl border"
              style={{ background: 'var(--pulse-coral-bg-08)', borderColor: 'var(--pulse-coral-bg-12)' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <AIProvenanceChip vendor="PULSE AI" type="SUGGESTION" />
                {onAct && (
                  <button
                    onClick={onAct}
                    className="flex-shrink-0 px-2.5 py-1 text-white text-xs font-medium rounded-lg transition"
                    style={{ background: 'var(--pulse-rose)' }}
                  >
                    Act
                  </button>
                )}
              </div>
              <p className="text-sm" style={{ color: 'var(--pulse-coral-fg)' }}>
                {profile.aiNextActionSuggestion}
              </p>
            </div>
          )}

          {/* Communication style + avg reply */}
          {profile && (profile.aiCommunicationStyle || profile.avgResponseTimeHours !== undefined) && (
            <div className="flex gap-2">
              {profile.aiCommunicationStyle && (
                <div className="flex-1 flex items-center gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                  <div>
                    <div className="text-xs text-zinc-400">Style</div>
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 capitalize">{profile.aiCommunicationStyle}</div>
                  </div>
                </div>
              )}
              {profile.avgResponseTimeHours !== undefined && (
                <div className="flex-1 flex items-center gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
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
          )}

          {/* Topics */}
          {profile?.aiTopics && profile.aiTopics.length > 0 && (
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

          {/* Talking Points */}
          {insights && insights.talkingPoints.length > 0 && (
            <div>
              <div className="mb-3">
                <AIProvenanceChip vendor="PULSE AI" type="TALKING POINTS" />
              </div>
              <ul className="space-y-2">
                {insights.talkingPoints.map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800"
                  >
                    <span className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested Actions */}
          {insights && insights.suggestions.length > 0 && (
            <div>
              <div className="mb-3">
                <AIProvenanceChip vendor="PULSE AI" type="INSIGHTS" />
              </div>
              <div className="space-y-2">
                {insights.suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSuggestedAction?.(suggestion)}
                    className={`w-full p-4 text-left rounded-xl border transition group hover:shadow-md ${
                      suggestion.type === 'warning'
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                        : suggestion.type === 'insight'
                        ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-rose-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold ${
                        suggestion.type === 'warning'
                          ? 'text-red-800 dark:text-red-300'
                          : suggestion.type === 'insight'
                          ? 'text-blue-800 dark:text-blue-300'
                          : 'text-zinc-800 dark:text-zinc-200'
                      }`}>
                        {suggestion.title}
                      </span>
                      <ArrowRight className="text-zinc-300 group-hover:text-rose-500 transition" />
                    </div>
                    <p className={`text-xs ${
                      suggestion.type === 'warning'
                        ? 'text-red-600 dark:text-red-400'
                        : suggestion.type === 'insight'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-zinc-500'
                    }`}>
                      {suggestion.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={onRefreshInsights}
            className="w-full py-2 text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium transition"
          >
            <RefreshCw className="mr-2" />
            Refresh Insights
          </button>
        </div>
      )}

      {/* Health Factors Section */}
      {activeSection === 'factors' && (
        <div className="space-y-4">
          {insights?.healthFactors.map((factor, idx) => (
            <HealthFactorCard key={idx} factor={factor} />
          ))}

          {(!insights || insights.healthFactors.length === 0) && (
            <div className="text-center py-8 text-zinc-400">
              <PieChart className="text-2xl mb-2" />
              <p className="text-sm">No health factors available yet</p>
              <p className="text-xs mt-1">More data needed for analysis</p>
            </div>
          )}
        </div>
      )}

      {/* Lead Score Section */}
      {activeSection === 'leads' && (
        <div className="space-y-6">
          {leadScore ? (
            <>
              <LeadScoreCard
                score={leadScore.leadScore}
                grade={leadScore.leadGrade}
                status={leadScore.leadStatus}
                buyingSignals={leadScore.buyingSignalCount}
                conversionProbability={leadScore.aiConversionProbability}
                churnRisk={leadScore.aiChurnRisk}
              />

              {/* Buying Signals */}
              {leadScore.buyingSignals.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                    Buying Signals
                  </h3>
                  <div className="space-y-2">
                    {leadScore.buyingSignals.slice(0, 5).map((signal, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-rose-50 dark:bg-rose-900/10 rounded-lg"
                      >
                        <Zap className="text-rose-500" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-rose-900 dark:text-rose-200 capitalize">
                            {signal.signal.replace(/_/g, ' ')}
                          </div>
                          {signal.details && (
                            <div className="text-xs text-rose-600 dark:text-rose-400">
                              {signal.details}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-rose-500 dark:text-rose-400">
                          {Math.round(signal.confidence * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Predictions */}
              {leadScore.aiNextActionPrediction && (
                <div className="bg-rose-50/60 dark:bg-rose-900/20 rounded-xl p-4 border border-rose-100 dark:border-rose-900/30">
                  <h3 className="font-semibold text-rose-900 dark:text-rose-300 mb-2 flex items-center gap-2">
                    <Globe />
                    AI Prediction
                  </h3>
                  <p className="text-sm text-rose-800 dark:text-rose-200">
                    {leadScore.aiNextActionPrediction}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-zinc-400">
              <BarChart2 className="text-2xl mb-2" />
              <p className="text-sm">No lead score available</p>
              <p className="text-xs mt-1">Contact needs more interaction data</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Health factor card component
interface HealthFactorCardProps {
  factor: HealthFactor;
}

const HealthFactorCard: React.FC<HealthFactorCardProps> = ({ factor }) => {
  const impactColor = factor.impact === 'positive'
    ? 'text-green-600 dark:text-green-400'
    : factor.impact === 'negative'
    ? 'text-red-600 dark:text-red-400'
    : 'text-zinc-600 dark:text-zinc-400';

  const barColor = factor.impact === 'positive'
    ? 'bg-green-500'
    : factor.impact === 'negative'
    ? 'bg-red-500'
    : 'bg-zinc-400';

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-zinc-900 dark:text-white">
          {factor.factor}
        </span>
        <span className={`text-sm font-bold ${impactColor}`}>
          {factor.score}%
        </span>
      </div>

      <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${factor.score}%` }}
        />
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {factor.description}
      </p>
    </div>
  );
};

export default ContactAIInsightsTab;
