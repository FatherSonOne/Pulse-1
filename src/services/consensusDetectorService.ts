import { DecisionWithVotes } from './decisionService';

/**
 * Consensus Detector Service
 * Analyzes voting patterns to determine if consensus has been reached
 * Phase 2: Decision-to-Task Pipeline
 */

export interface ConsensusResult {
  reached: boolean;
  confidence: number; // 0.0 to 1.0
  winning_choice: string | null;
  vote_distribution: {
    [choice: string]: {
      count: number;
      percentage: number;
    };
  };
  threshold_met: boolean;
  participation_rate: number; // Percentage of expected voters who voted
  reasoning: string;
}

export interface ConsensusConfig {
  // Minimum percentage of votes for a single choice to be considered consensus
  majority_threshold?: number; // Default: 0.67 (67%)

  // Minimum number of votes required
  minimum_votes?: number; // Default: 3

  // Expected number of voters (if known)
  expected_voters?: number;

  // Minimum participation rate (if expected_voters is set)
  minimum_participation?: number; // Default: 0.60 (60%)

  // Decision type influences consensus rules
  decision_type?: 'consensus' | 'majority_vote' | 'unanimous' | 'advisory';

  // Allow 'abstain' votes to not count against consensus
  ignore_abstentions?: boolean; // Default: true
}

export const consensusDetectorService = {
  /**
   * Detect if consensus has been reached on a decision
   */
  detectConsensus(
    decision: DecisionWithVotes,
    config: ConsensusConfig = {}
  ): ConsensusResult {
    const {
      majority_threshold = 0.67,
      minimum_votes = 3,
      expected_voters,
      minimum_participation = 0.60,
      decision_type = decision.decision_type || 'consensus',
      ignore_abstentions = true
    } = config;

    const votes = decision.votes || [];
    const total_votes = votes.length;

    // Calculate vote distribution
    const vote_counts: { [choice: string]: number } = {};
    let non_abstain_votes = 0;

    votes.forEach(vote => {
      const choice = vote.choice;
      vote_counts[choice] = (vote_counts[choice] || 0) + 1;
      if (choice !== 'abstain') {
        non_abstain_votes++;
      }
    });

    // Build distribution object
    const vote_distribution: ConsensusResult['vote_distribution'] = {};
    const base_count = ignore_abstentions ? non_abstain_votes : total_votes;

    Object.entries(vote_counts).forEach(([choice, count]) => {
      vote_distribution[choice] = {
        count,
        percentage: base_count > 0 ? Math.round((count / base_count) * 100) / 100 : 0
      };
    });

    // Calculate participation rate
    let participation_rate = 1.0;
    if (expected_voters && expected_voters > 0) {
      participation_rate = Math.min(total_votes / expected_voters, 1.0);
    }

    // Find winning choice (excluding abstain if configured)
    let winning_choice: string | null = null;
    let winning_count = 0;
    let winning_percentage = 0;

    Object.entries(vote_distribution).forEach(([choice, data]) => {
      if (ignore_abstentions && choice === 'abstain') return;

      if (data.count > winning_count) {
        winning_choice = choice;
        winning_count = data.count;
        winning_percentage = data.percentage;
      }
    });

    // Apply decision-type-specific rules
    let threshold = majority_threshold;
    let threshold_met = false;
    let reasoning = '';

    switch (decision_type) {
      case 'unanimous':
        // All non-abstain votes must agree
        threshold = 1.0;
        threshold_met = winning_percentage >= threshold && non_abstain_votes >= minimum_votes;
        reasoning = threshold_met
          ? `Unanimous consensus reached: ${winning_choice} (${winning_count}/${non_abstain_votes} votes)`
          : `Unanimous consensus requires all ${non_abstain_votes} votes to agree (currently ${winning_percentage * 100}%)`;
        break;

      case 'majority_vote':
        // Simple majority (>50%)
        threshold = 0.51;
        threshold_met = winning_percentage > threshold && total_votes >= minimum_votes;
        reasoning = threshold_met
          ? `Majority vote consensus: ${winning_choice} (${(winning_percentage * 100).toFixed(0)}% of ${total_votes} votes)`
          : `Majority requires >50% agreement (currently ${(winning_percentage * 100).toFixed(0)}%)`;
        break;

      case 'consensus':
        // Strong majority (default 67%)
        threshold_met = winning_percentage >= threshold && total_votes >= minimum_votes;
        reasoning = threshold_met
          ? `Strong consensus reached: ${winning_choice} (${(winning_percentage * 100).toFixed(0)}% of ${base_count} votes exceeds ${(threshold * 100).toFixed(0)}% threshold)`
          : `Consensus requires ${(threshold * 100).toFixed(0)}% agreement (currently ${(winning_percentage * 100).toFixed(0)}%)`;
        break;

      case 'advisory':
        // Advisory votes just need minimum participation
        threshold = 0.40; // Lower threshold for advisory
        threshold_met = total_votes >= minimum_votes;
        reasoning = threshold_met
          ? `Advisory consensus: ${winning_choice} leads with ${(winning_percentage * 100).toFixed(0)}% (${winning_count} votes)`
          : `Advisory vote needs at least ${minimum_votes} votes (currently ${total_votes})`;
        break;
    }

    // Check participation requirement
    const participation_met = expected_voters
      ? participation_rate >= minimum_participation
      : true;

    if (!participation_met) {
      reasoning += ` | Low participation: ${(participation_rate * 100).toFixed(0)}% (need ${(minimum_participation * 100).toFixed(0)}%)`;
    }

    // Final consensus determination
    const reached = threshold_met && participation_met && total_votes >= minimum_votes;

    // Calculate confidence score
    let confidence = 0.0;
    if (total_votes >= minimum_votes) {
      // Base confidence on how much the winning percentage exceeds the threshold
      const threshold_excess = Math.max(0, winning_percentage - threshold);
      const participation_factor = participation_met ? 1.0 : participation_rate / minimum_participation;
      const vote_count_factor = Math.min(total_votes / (minimum_votes * 2), 1.0);

      confidence = Math.min(
        (threshold_excess / (1.0 - threshold)) * 0.6 + // 60% weight on exceeding threshold
        participation_factor * 0.25 + // 25% weight on participation
        vote_count_factor * 0.15, // 15% weight on vote count
        1.0
      );
    }

    return {
      reached,
      confidence,
      winning_choice,
      vote_distribution,
      threshold_met,
      participation_rate,
      reasoning
    };
  },

  /**
   * Get recommended action based on consensus state
   */
  getRecommendedAction(result: ConsensusResult): {
    action: 'approve' | 'continue_voting' | 'revise' | 'no_action';
    message: string;
  } {
    if (result.reached && result.confidence > 0.8) {
      return {
        action: 'approve',
        message: `Strong consensus detected for "${result.winning_choice}". Consider marking decision as approved.`
      };
    }

    if (result.reached && result.confidence > 0.6) {
      return {
        action: 'approve',
        message: `Consensus reached for "${result.winning_choice}". Review and approve if appropriate.`
      };
    }

    if (result.threshold_met && result.participation_rate < 0.6) {
      return {
        action: 'continue_voting',
        message: `Voting is trending toward "${result.winning_choice}", but participation is low (${(result.participation_rate * 100).toFixed(0)}%). Send reminders to increase participation.`
      };
    }

    if (!result.threshold_met && result.vote_distribution) {
      const votes = Object.values(result.vote_distribution).map(v => v.count);
      const max_votes = Math.max(...votes);
      const tied_choices = Object.entries(result.vote_distribution)
        .filter(([_, data]) => data.count === max_votes)
        .map(([choice]) => choice);

      if (tied_choices.length > 1) {
        return {
          action: 'revise',
          message: `Votes are split between ${tied_choices.join(' and ')}. Consider revising the decision or options.`
        };
      }

      return {
        action: 'continue_voting',
        message: `No clear consensus yet. "${result.winning_choice}" is leading with ${(result.vote_distribution[result.winning_choice!]?.percentage * 100 || 0).toFixed(0)}%. Continue gathering votes.`
      };
    }

    return {
      action: 'no_action',
      message: result.reasoning
    };
  },

  /**
   * Auto-update decision status based on consensus
   * Returns true if decision should be marked as approved
   */
  shouldAutoApprove(
    decision: DecisionWithVotes,
    config: ConsensusConfig = {}
  ): boolean {
    // Only auto-approve if decision is in voting status
    if (decision.status !== 'voting') return false;

    const result = this.detectConsensus(decision, config);
    const action = this.getRecommendedAction(result);

    // Auto-approve only on strong consensus
    return action.action === 'approve' && result.confidence > 0.75;
  },

  /**
   * Get human-readable consensus status
   */
  getConsensusStatus(decision: DecisionWithVotes): {
    label: string;
    color: string;
    description: string;
  } {
    const result = this.detectConsensus(decision);

    if (result.reached) {
      return {
        label: 'Consensus Reached',
        color: '#10b981', // green
        description: result.reasoning
      };
    }

    if (result.threshold_met && result.participation_rate < 0.6) {
      return {
        label: 'Trending',
        color: '#f59e0b', // amber
        description: `${result.winning_choice} is leading, but needs more votes`
      };
    }

    if (result.confidence > 0.5) {
      return {
        label: 'Building Consensus',
        color: '#3b82f6', // blue
        description: `${result.winning_choice} is emerging as preferred choice`
      };
    }

    return {
      label: 'No Consensus',
      color: '#6b7280', // gray
      description: 'Votes are still being collected'
    };
  }
};
