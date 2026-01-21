import { GoogleGenAI } from "@google/genai";
import { DecisionWithVotes } from "./decisionService";
import { Contact } from "../types";

export interface DecisionMetrics {
  velocityPerWeek: number;
  avgTimeToResolution: number; // hours
  participationRate: number; // 0-100
  staleCount: number;
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

    return {
      velocityPerWeek,
      avgTimeToResolution: Math.round(avgTimeToResolution * 10) / 10,
      participationRate: Math.round(participationRate),
      staleCount: staleDecisions.length,
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
   * AI-powered risk assessment for a decision
   */
  async assessDecisionRisk(
    decision: DecisionWithVotes,
    apiKey: string
  ): Promise<RiskAssessment> {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const voteData = decision.votes || [];
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

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      });

      const result = JSON.parse(response.text);
      return result;
    } catch (error) {
      console.error('Risk assessment failed:', error);
      // Return safe default
      return {
        riskLevel: 'low',
        reasoning: 'Unable to assess risk',
        recommendations: ['Review decision details manually'],
        confidence: 0,
      };
    }
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
