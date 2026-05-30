/**
 * Decisions Components - Public API
 *
 * The legacy hub surface (DecisionTaskHub / ActiveView / BoardView /
 * ArchiveView / EnhancedDecisionCard / HubHeader) was removed in Phase 12 of
 * the Triage Cockpit redesign. The cockpit lives in `./cockpit/` (CockpitHub).
 */

// Triage Cockpit (the Decisions & Tasks surface)
export { CockpitHub } from './cockpit/CockpitHub';

// Decision components
export { DecisionDecomposer } from './DecisionDecomposer';
export { DecisionTemplates } from './DecisionTemplates';
export { ConversationalAssistant } from './ConversationalAssistant';

// Task management
export { ReassignTaskModal } from './ReassignTaskModal';
export { ExtendDeadlineDialog } from './ExtendDeadlineDialog';
export { SubtaskList } from './SubtaskList';
export { default as TaskActivityFeed } from './TaskActivityFeed';

// UI elements (FilterBar still consumed by Messages + the cockpit's FilterState)
export { FilterBar } from './FilterBar';
export { AlertsPanel } from './AlertsPanel';
export { RealTimeIndicator } from './RealTimeIndicator';
export { AIFeatureErrorBoundary } from './AIFeatureErrorBoundary';
export { SkeletonDecisionCard } from './SkeletonDecisionCard';
