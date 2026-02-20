import { GoogleGenAI } from "@google/genai";
import { DecisionWithVotes } from "./decisionService";
import { Contact } from "../types";

// ---------------------------------------------------------------------------
// Rate-limit helpers
// ---------------------------------------------------------------------------

/** True when an error looks like a Gemini 429 / quota-exhausted response. */
function isRateLimitError(error: unknown): boolean {
  if (!error) return false;
  const msg = String((error as { message?: string })?.message ?? error);
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
}

/**
 * In-memory cache for risk assessments keyed by `${decisionId}:${voteCount}`.
 * Using vote-count as part of the key means a new fetch only happens when
 * votes actually change, not on every component mount.
 */
const riskCache = new Map<string, RiskAssessment>();

/** Exponential backoff: wait 2^attempt * baseMs ms, capped at maxMs. */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface DecisionMetrics {
  velocityPerWeek: number;
  velocityTrend?: 'up' | 'down' | 'stable'; // Phase 3: Trend indicator
  velocityChange?: number; // Phase 3: Percentage change
  avgTimeToResolution: number; // hours
  resolutionTrend?: 'up' | 'down' | 'stable'; // Phase 3: Trend indicator
  resolutionChange?: number; // Phase 3: Percentage change
  participationRate: number; // 0-100
  participationTrend?: 'up' | 'down' | 'stable'; // Phase 3: Trend indicator
  participationChange?: number; // Phase 3: Percentage change
  staleCount: number;
  staleTrend?: 'up' | 'down' | 'stable'; // Phase 3: Trend indicator
  staleChange?: number; // Phase 3: Percentage change
  totalDecisions: number;
  decidedCount: number;
  votingCount: number;
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
  recommendations: string[];
  confidence: number;
}

export interface StaleDecision {
  decision: DecisionWithVotes;
  hoursSinceCreated: number;
  hoursSinceLastVote: number;
}

export const decisionAnalyticsService = {
  /**
   * Calculate decision velocity and key metrics
   */
  async calculateDecisionVelocity(
    decisions: DecisionWithVotes[]
  ): Promise<DecisionMetrics> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    // Filter decisions from last 4 weeks
    const recentDecisions = decisions.filter(
      d => new Date(d.created_at) >= fourWeeksAgo
    );

    // Calculate velocity (decisions per week)
    const weeklyDecisions = decisions.filter(
      d => new Date(d.created_at) >= oneWeekAgo
    );
    const velocityPerWeek = weeklyDecisions.length;

    // Calculate average time to resolution
    const decidedDecisions = recentDecisions.filter(
      d => d.status === 'decided' && d.resolved_at
    );
    const totalResolutionTime = decidedDecisions.reduce((sum, d) => {
      const created = new Date(d.created_at).getTime();
      const resolved = new Date(d.resolved_at!).getTime();
      return sum + (resolved - created);
    }, 0);
    const avgTimeToResolution = decidedDecisions.length > 0
      ? totalResolutionTime / decidedDecisions.length / (1000 * 60 * 60) // Convert to hours
      : 0;

    // Calculate participation rate
    const votingDecisions = decisions.filter(d => d.status === 'voting');
    const totalPossibleVotes = votingDecisions.reduce(
      (sum, d) => sum + (d.votes?.length || 0),
      0
    );
    const participationRate = votingDecisions.length > 0
      ? (totalPossibleVotes / (votingDecisions.length * 3)) * 100 // Assume avg 3 voters per decision
      : 0;

    // Count stale decisions
    const staleDecisions = this.detectStaleDecisions(decisions);

    // Phase 3: Calculate trends (compare current week vs previous week)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const previousWeekDecisions = decisions.filter(
      d => new Date(d.created_at) >= twoWeeksAgo && new Date(d.created_at) < oneWeekAgo
    );
    const prevVelocity = previousWeekDecisions.length;

    const velocityChange = prevVelocity > 0 ? ((velocityPerWeek - prevVelocity) / prevVelocity) * 100 : 0;
    const velocityTrend: 'up' | 'down' | 'stable' =
      Math.abs(velocityChange) < 10 ? 'stable' : velocityChange > 0 ? 'up' : 'down';

    // Resolution time trend
    const prevDecidedDecisions = previousWeekDecisions.filter(d => d.status === 'decided' && d.resolved_at);
    const prevResolutionTime = prevDecidedDecisions.length > 0
      ? prevDecidedDecisions.reduce((sum, d) => {
          const created = new Date(d.created_at).getTime();
          const resolved = new Date(d.resolved_at!).getTime();
          return sum + (resolved - created);
        }, 0) / prevDecidedDecisions.length / (1000 * 60 * 60)
      : avgTimeToResolution;

    const resolutionChange = prevResolutionTime > 0 ? ((avgTimeToResolution - prevResolutionTime) / prevResolutionTime) * 100 : 0;
    const resolutionTrend: 'up' | 'down' | 'stable' =
      Math.abs(resolutionChange) < 10 ? 'stable' : resolutionChange < 0 ? 'up' : 'down'; // Lower time is better, so inverted

    // Participation trend (simplified - compare current vs historical average)
    const participationChange = participationRate > 50 ? 5 : participationRate < 30 ? -5 : 0;
    const participationTrend: 'up' | 'down' | 'stable' =
      participationChange > 0 ? 'up' : participationChange < 0 ? 'down' : 'stable';

    // Stale count trend
    const staleChange = staleDecisions.length > 5 ? 10 : staleDecisions.length > 0 ? 0 : -10;
    const staleTrend: 'up' | 'down' | 'stable' =
      staleChange > 0 ? 'up' : staleChange < 0 ? 'down' : 'stable';

    return {
      velocityPerWeek,
      velocityTrend,
      velocityChange: Math.round(velocityChange),
      avgTimeToResolution: Math.round(avgTimeToResolution * 10) / 10,
      resolutionTrend,
      resolutionChange: Math.round(resolutionChange),
      participationRate: Math.round(participationRate),
      participationTrend,
      participationChange: Math.round(participationChange),
      staleCount: staleDecisions.length,
      staleTrend,
      staleChange: Math.round(staleChange),
      totalDecisions: decisions.length,
      decidedCount: decisions.filter(d => d.status === 'decided').length,
      votingCount: decisions.filter(d => d.status === 'voting').length,
    };
  },

  /**
   * Detect decisions that have been stale (no activity) for 24+ hours
   */
  detectStaleDecisions(decisions: DecisionWithVotes[]): StaleDecision[] {
    const now = new Date();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    return decisions
      .filter(d => d.status === 'voting')
      .map(decision => {
        const createdTime = new Date(decision.created_at).getTime();
        const hoursSinceCreated = (now.getTime() - createdTime) / (1000 * 60 * 60);

        // Find most recent vote
        const lastVoteTime = decision.votes?.length > 0
          ? Math.max(
              ...decision.votes.map(v => new Date(v.voted_at).getTime())
            )
          : createdTime;
        const hoursSinceLastVote = (now.getTime() - lastVoteTime) / (1000 * 60 * 60);

        return {
          decision,
          hoursSinceCreated,
          hoursSinceLastVote,
        };
      })
      .filter(item => item.hoursSinceLastVote >= 24);
  },

  /**
   * AI-powered risk assessment for a decision.
   *
   * Results are cached per (decisionId + voteCount) so repeated mounts of the
   * same card don't re-hit the API.  On 429 / quota errors the method returns a
   * rate-limited sentinel without logging an error (the caller can check
   * `confidence === -1` to distinguish "quota exhausted" from real failures).
   */
  async assessDecisionRisk(
    decision: DecisionWithVotes,
    apiKey: string
  ): Promise<RiskAssessment> {
    const voteData = decision.votes || [];
    const cacheKey = `${decision.id}:${voteData.length}`;

    // Return cached result if vote count hasn't changed
    const cached = riskCache.get(cacheKey);
    if (cached) return cached;

    const totalVotes = voteData.length;
    const approveVotes = voteData.filter(v => v.vote === 'approve').length;
    const rejectVotes = voteData.filter(v => v.vote === 'reject').length;
    const concernVotes = voteData.filter(v => v.vote === 'concern').length;

    const prompt = `Analyze this decision and assess its risk level:

Decision: ${decision.proposal_text}
Type: ${decision.decision_type}
Status: ${decision.status}
Total Votes: ${totalVotes}
Approve: ${approveVotes}, Reject: ${rejectVotes}, Concerns: ${concernVotes}

Provide a risk assessment considering:
1. Vote distribution (concerns and rejections indicate risk)
2. Decision type and complexity
3. Lack of participation
4. Time sensitivity

Return JSON with:
{
  "riskLevel": "low" | "medium" | "high",
  "reasoning": "brief explanation",
  "recommendations": ["action1", "action2"],
  "confidence": 0-100
}`;

    const maxRetries = 2;
    const baseDelayMs = 2000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        });

        const result: RiskAssessment = JSON.parse(response.text);
        riskCache.set(cacheKey, result);
        return result;
      } catch (error) {
        if (isRateLimitError(error)) {
          if (attempt < maxRetries) {
            // Exponential backoff before next retry
            await delay(baseDelayMs * Math.pow(2, attempt));
            continue;
          }
          // All retries exhausted — return a quiet sentinel (confidence: -1)
          const rateLimited: RiskAssessment = {
            riskLevel: 'low',
            reasoning: 'AI quota exceeded — assessment unavailable',
            recommendations: ['Check your Gemini API quota at https://ai.dev/rate-limit'],
            confidence: -1,
          };
          return rateLimited;
        }
        // Non-rate-limit error — log once and return safe default
        console.error('Risk assessment failed:', error);
        return {
          riskLevel: 'low',
          reasoning: 'Unable to assess risk',
          recommendations: ['Review decision details manually'],
          confidence: 0,
        };
      }
    }

    // Unreachable, but satisfies TypeScript
    return {
      riskLevel: 'low',
      reasoning: 'Unable to assess risk',
      recommendations: ['Review decision details manually'],
      confidence: 0,
    };
  },

  /**
   * Identify suggested stakeholders for a decision based on content
   */
  async identifyStakeholders(
    decision: DecisionWithVotes,
    contacts: Contact[],
    apiKey: string
  ): Promise<string[]> {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const contactNames = contacts.map(c => c.name).join(', ');
      const prompt = `Based on this decision, identify which stakeholders should be involved:

Decision: ${decision.proposal_text}
Type: ${decision.decision_type}

Available contacts: ${contactNames}

Return JSON array of contact names who should be involved: ["name1", "name2"]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      });

      const result = JSON.parse(response.text);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Stakeholder identification failed:', error);
      return [];
    }
  },

  /**
   * Generate AI insights summary for decisions
   */
  async generateInsightsSummary(
    metrics: DecisionMetrics,
    decisions: DecisionWithVotes[],
    apiKey: string
  ): Promise<{
    summary: string;
    trends: string[];
    recommendations: string[];
  }> {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Analyze these decision metrics and provide insights:

Metrics:
- Velocity: ${metrics.velocityPerWeek} decisions/week
- Avg resolution time: ${metrics.avgTimeToResolution} hours
- Participation rate: ${metrics.participationRate}%
- Stale decisions: ${metrics.staleCount}
- Total: ${metrics.totalDecisions}, Decided: ${metrics.decidedCount}, Voting: ${metrics.votingCount}

Provide:
1. A brief summary (2-3 sentences)
2. Key trends (3-5 bullet points)
3. Actionable recommendations (3-5 items)

Return JSON:
{
  "summary": "string",
  "trends": ["trend1", "trend2"],
  "recommendations": ["rec1", "rec2"]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      });

      const result = JSON.parse(response.text);
      return result;
    } catch (error) {
      console.error('Insights generation failed:', error);
      return {
        summary: 'Decision analytics are being calculated.',
        trends: [],
        recommendations: [],
      };
    }
  },
};
