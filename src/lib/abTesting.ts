// ============================================
// A/B TESTING INFRASTRUCTURE
// Experiment management and variant assignment
// ============================================

import { trackEvent } from './monitoring/analytics';
import { getFeatureFlag } from './monitoring/analytics';

export interface Experiment {
  id: string;
  name: string;
  description: string;
  variants: ExperimentVariant[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate: Date;
  endDate?: Date;
  targetUsers?: string[];
  successMetric: string;
  minimumSampleSize: number;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-100
  isControl: boolean;
}

export interface ExperimentAssignment {
  experimentId: string;
  variantId: string;
  userId: string;
  timestamp: Date;
}

// Active experiments
const experiments: Record<string, Experiment> = {
  'split_view_layout_test': {
    id: 'split_view_layout_test',
    name: 'Split View Layout A/B Test',
    description: 'Test split view vs traditional layout for message engagement',
    variants: [
      {
        id: 'control',
        name: 'Traditional Layout',
        description: 'Original single-column message layout',
        weight: 50,
        isControl: true
      },
      {
        id: 'split_view',
        name: 'Split View Layout',
        description: 'New split view with threads',
        weight: 50,
        isControl: false
      }
    ],
    status: 'running',
    startDate: new Date('2025-01-20'),
    targetUsers: ['all'],
    successMetric: 'message_engagement_rate',
    minimumSampleSize: 1000
  },

  'ai_summary_style_test': {
    id: 'ai_summary_style_test',
    name: 'AI Summary Style Test',
    description: 'Test different AI summary styles for user preference',
    variants: [
      {
        id: 'control',
        name: 'Bullet Points',
        description: 'Summarize as bullet points',
        weight: 33,
        isControl: true
      },
      {
        id: 'paragraph',
        name: 'Paragraph Style',
        description: 'Summarize as cohesive paragraph',
        weight: 33,
        isControl: false
      },
      {
        id: 'executive',
        name: 'Executive Summary',
        description: 'Brief executive summary style',
        weight: 34,
        isControl: false
      }
    ],
    status: 'draft',
    startDate: new Date('2025-02-01'),
    targetUsers: ['beta-testers'],
    successMetric: 'summary_satisfaction_rate',
    minimumSampleSize: 500
  },

  'focus_mode_ui_test': {
    id: 'focus_mode_ui_test',
    name: 'Focus Mode UI Test',
    description: 'Test different focus mode UI designs',
    variants: [
      {
        id: 'control',
        name: 'Minimal UI',
        description: 'Hide all UI elements',
        weight: 50,
        isControl: true
      },
      {
        id: 'contextual',
        name: 'Contextual UI',
        description: 'Show only relevant UI elements',
        weight: 50,
        isControl: false
      }
    ],
    status: 'draft',
    startDate: new Date('2025-02-15'),
    targetUsers: ['all'],
    successMetric: 'focus_mode_duration',
    minimumSampleSize: 800
  }
};

// Store user assignments in memory (would use database in production)
const userAssignments = new Map<string, Map<string, string>>();

// Get variant for user in experiment
export function getExperimentVariant(
  experimentId: string,
  userId: string
): string | null {
  const experiment = experiments[experimentId];

  if (!experiment) {
    console.warn(`Experiment "${experimentId}" not found`);
    return null;
  }

  // Check if experiment is running
  if (experiment.status !== 'running') {
    return null;
  }

  // Check if user is in target group
  if (experiment.targetUsers && !experiment.targetUsers.includes('all')) {
    if (!experiment.targetUsers.includes(userId)) {
      return null;
    }
  }

  // Check if user already has an assignment
  if (!userAssignments.has(userId)) {
    userAssignments.set(userId, new Map());
  }

  const userExperiments = userAssignments.get(userId)!;

  if (userExperiments.has(experimentId)) {
    return userExperiments.get(experimentId)!;
  }

  // Assign variant using weighted random selection
  const variant = assignVariant(experiment, userId);

  // Store assignment
  userExperiments.set(experimentId, variant.id);

  // Track assignment
  trackExperimentAssignment(experimentId, variant.id, userId);

  return variant.id;
}

// Assign variant to user
function assignVariant(
  experiment: Experiment,
  userId: string
): ExperimentVariant {
  // Use deterministic assignment based on user ID hash
  // This ensures the same user always gets the same variant
  const hash = hashUserId(userId, experiment.id);
  const normalizedHash = hash % 100;

  let cumulativeWeight = 0;

  for (const variant of experiment.variants) {
    cumulativeWeight += variant.weight;

    if (normalizedHash < cumulativeWeight) {
      return variant;
    }
  }

  // Fallback to control variant
  return experiment.variants.find(v => v.isControl) || experiment.variants[0];
}

// Hash user ID for deterministic variant assignment
function hashUserId(userId: string, experimentId: string): number {
  const str = `${userId}:${experimentId}`;
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash);
}

// Track experiment assignment
function trackExperimentAssignment(
  experimentId: string,
  variantId: string,
  userId: string
): void {
  trackEvent('Experiment Assignment', {
    experiment_id: experimentId,
    variant_id: variantId,
    user_id: userId,
    timestamp: new Date().toISOString()
  });
}

// Track experiment exposure (when user actually sees the variant)
export function trackExperimentExposure(
  experimentId: string,
  userId: string
): void {
  const variantId = getExperimentVariant(experimentId, userId);

  if (!variantId) {
    return;
  }

  trackEvent('Experiment Exposure', {
    experiment_id: experimentId,
    variant_id: variantId,
    user_id: userId,
    timestamp: new Date().toISOString()
  });
}

// Track experiment conversion (success metric achieved)
export function trackExperimentConversion(
  experimentId: string,
  userId: string,
  value?: number,
  metadata?: Record<string, any>
): void {
  const variantId = getExperimentVariant(experimentId, userId);

  if (!variantId) {
    return;
  }

  trackEvent('Experiment Conversion', {
    experiment_id: experimentId,
    variant_id: variantId,
    user_id: userId,
    value,
    ...metadata,
    timestamp: new Date().toISOString()
  });
}

// React hook for A/B testing
export function useExperiment(
  experimentId: string,
  userId?: string
): string | null {
  if (!userId) {
    return null;
  }

  return getExperimentVariant(experimentId, userId);
}

// Check if user is in variant
export function isInVariant(
  experimentId: string,
  variantId: string,
  userId?: string
): boolean {
  if (!userId) {
    return false;
  }

  const assignedVariant = getExperimentVariant(experimentId, userId);
  return assignedVariant === variantId;
}

// Get experiment info
export function getExperiment(experimentId: string): Experiment | null {
  return experiments[experimentId] || null;
}

// Get all experiments
export function getAllExperiments(): Experiment[] {
  return Object.values(experiments);
}

// Get active experiments
export function getActiveExperiments(): Experiment[] {
  return Object.values(experiments).filter(exp => exp.status === 'running');
}

// Create new experiment (admin function)
export function createExperiment(experiment: Experiment): void {
  experiments[experiment.id] = experiment;
}

// Update experiment (admin function)
export function updateExperiment(
  experimentId: string,
  updates: Partial<Experiment>
): void {
  if (experiments[experimentId]) {
    experiments[experimentId] = {
      ...experiments[experimentId],
      ...updates
    };
  }
}

// Start experiment
export function startExperiment(experimentId: string): void {
  updateExperiment(experimentId, {
    status: 'running',
    startDate: new Date()
  });
}

// Pause experiment
export function pauseExperiment(experimentId: string): void {
  updateExperiment(experimentId, { status: 'paused' });
}

// Complete experiment
export function completeExperiment(experimentId: string): void {
  updateExperiment(experimentId, {
    status: 'completed',
    endDate: new Date()
  });
}

// Get experiment results (placeholder for future implementation)
export async function getExperimentResults(
  experimentId: string
): Promise<ExperimentResults | null> {
  // This would typically fetch from analytics service
  // For now, return placeholder data
  console.log(`Fetching results for experiment: ${experimentId}`);

  return null;
}

export interface ExperimentResults {
  experimentId: string;
  variants: VariantResults[];
  winner?: string;
  confidence: number;
  sampleSize: number;
}

export interface VariantResults {
  variantId: string;
  variantName: string;
  exposures: number;
  conversions: number;
  conversionRate: number;
  averageValue: number;
}

// Calculate statistical significance (simplified)
export function calculateSignificance(
  controlConversions: number,
  controlExposures: number,
  variantConversions: number,
  variantExposures: number
): number {
  // Simplified z-test calculation
  // In production, use proper statistical library

  const p1 = controlConversions / controlExposures;
  const p2 = variantConversions / variantExposures;

  const pPool = (controlConversions + variantConversions) / (controlExposures + variantExposures);

  const se = Math.sqrt(pPool * (1 - pPool) * (1 / controlExposures + 1 / variantExposures));

  if (se === 0) {
    return 0;
  }

  const zScore = Math.abs((p2 - p1) / se);

  // Convert z-score to confidence level (approximate)
  // z > 1.96 = 95% confidence
  // z > 2.58 = 99% confidence

  if (zScore > 2.58) return 0.99;
  if (zScore > 1.96) return 0.95;
  if (zScore > 1.645) return 0.90;

  return 0;
}

// Export for testing and admin dashboard
export { experiments, userAssignments };
