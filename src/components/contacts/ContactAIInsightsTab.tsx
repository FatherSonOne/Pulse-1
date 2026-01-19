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

interface ContactAIInsightsTabProps {
  profile: RelationshipProfile;
  insights: RelationshipInsights | null;
  leadScore: LeadScore | null;
  isLoading?: boolean;
  onRefreshInsights: () => void;
  onSuggestedAction?: (suggestion: RelationshipSuggestion) => void;
}

export const ContactAIInsightsTab: React.FC<ContactAIInsightsTabProps> = ({
  profile,
  insights,
  leadScore,
  isLoading = false,
  onRefreshInsights,
  onSuggestedAction,
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'factors' | 'leads'>('overview');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm text-zinc-500">Analyzing relationship...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <RelationshipHealthCard
            profile={profile}
            showTrend={true}
            showLastInteraction={true}
          />

          {/* AI Summary */}
          {insights?.profile.aiRelationshipSummary && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-900/30">
              <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                AI Summary
              </h3>
              <p className="text-sm text-purple-800 dark:text-purple-200">
                {insights.profile.aiRelationshipSummary}
              </p>
            </div>
          )}

          {/* Talking Points */}
          {insights && insights.talkingPoints.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                Talking Points
              </h3>
              <ul className="space-y-2">
                {insights.talkingPoints.map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800"
                  >
                    <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
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
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                Suggested Actions
              </h3>
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
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-purple-400'
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
                      <i className="fa-solid fa-arrow-right text-zinc-300 group-hover:text-purple-500 transition"></i>
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
            className="w-full py-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition"
          >
            <i className="fa-solid fa-rotate mr-2"></i>
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
              <i className="fa-solid fa-chart-pie text-2xl mb-2"></i>
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
                        className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg"
                      >
                        <i className="fa-solid fa-bolt text-purple-500"></i>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-purple-900 dark:text-purple-200 capitalize">
                            {signal.signal.replace(/_/g, ' ')}
                          </div>
                          {signal.details && (
                            <div className="text-xs text-purple-600 dark:text-purple-400">
                              {signal.details}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-purple-500 dark:text-purple-400">
                          {Math.round(signal.confidence * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Predictions */}
              {leadScore.aiNextActionPrediction && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900/30">
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2 flex items-center gap-2">
                    <i className="fa-solid fa-crystal-ball"></i>
                    AI Prediction
                  </h3>
                  <p className="text-sm text-indigo-800 dark:text-indigo-200">
                    {leadScore.aiNextActionPrediction}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-zinc-400">
              <i className="fa-solid fa-chart-simple text-2xl mb-2"></i>
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
