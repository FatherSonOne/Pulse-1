// Phase 3: Analytics & Engagement Features Bundle
// This bundle contains analytics, engagement tracking, and proactive insights
// Lazy loaded when analytics features are accessed

import { ConversationHealthWidget } from './ConversationHealthWidget';
import { AchievementToast, AchievementProgress } from './AchievementToast';
import { MessageImpactVisualization } from './MessageImpactVisualization';
import { ProactiveInsights } from './ProactiveInsights';
import { MessageAnalyticsDashboard } from './MessageAnalyticsDashboard';
import { NetworkGraph } from './NetworkGraph';
import { ResponseTimeTracker, ResponseTimeBadge } from './ResponseTimeTracker';
import { EngagementScoring, EngagementBadge } from './EngagementScoring';
import { ConversationFlowViz } from './ConversationFlowViz';
import { AchievementSystemEnhanced, AchievementBadge } from './AchievementSystemEnhanced';
import { ProactiveInsightsEnhanced, InsightIndicator } from './ProactiveInsightsEnhanced';

// Export as default object for lazy loading
export default {
  ConversationHealthWidget,
  AchievementToast,
  AchievementProgress,
  MessageImpactVisualization,
  ProactiveInsights,
  MessageAnalyticsDashboard,
  NetworkGraph,
  ResponseTimeTracker,
  ResponseTimeBadge,
  EngagementScoring,
  EngagementBadge,
  ConversationFlowViz,
  AchievementSystemEnhanced,
  AchievementBadge,
  ProactiveInsightsEnhanced,
  InsightIndicator,
};
