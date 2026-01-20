// ============================================
// FEATURE FLAGS SYSTEM
// Gradual rollout and A/B testing infrastructure
// ============================================

export interface FeatureFlag {
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  targetUsers?: string[]; // User IDs or groups
  description?: string;
  version?: string;
}

export interface FeatureFlagConfig {
  [key: string]: FeatureFlag;
}

// Feature flag configuration
// This can be loaded from environment variables or remote config service
const featureFlagsConfig: FeatureFlagConfig = {
  // Core features
  splitViewLayout: {
    enabled: true,
    rolloutPercentage: 100,
    targetUsers: ['all'],
    description: 'Split view messages layout with threads',
    version: '1.0.0'
  },

  hoverReactions: {
    enabled: true,
    rolloutPercentage: 100,
    targetUsers: ['all'],
    description: 'Hover-based reactions on messages',
    version: '1.0.0'
  },

  sidebarTabs: {
    enabled: true,
    rolloutPercentage: 100,
    targetUsers: ['all'],
    description: 'Enhanced sidebar with tabs',
    version: '1.0.0'
  },

  focusMode: {
    enabled: true,
    rolloutPercentage: 100,
    targetUsers: ['all'],
    description: 'Distraction-free focus mode',
    version: '1.0.0'
  },

  // New features - gradual rollout
  aiSummarization: {
    enabled: true,
    rolloutPercentage: 50,
    targetUsers: ['beta-testers', 'internal'],
    description: 'AI-powered message summarization',
    version: '1.1.0'
  },

  smartFolders: {
    enabled: true,
    rolloutPercentage: 25,
    targetUsers: ['beta-testers'],
    description: 'Smart folder organization with AI',
    version: '1.1.0'
  },

  voiceMessages: {
    enabled: false,
    rolloutPercentage: 0,
    targetUsers: ['internal'],
    description: 'Voice message recording and playback',
    version: '1.2.0'
  },

  advancedAnalytics: {
    enabled: true,
    rolloutPercentage: 100,
    targetUsers: ['all'],
    description: 'Advanced analytics dashboard',
    version: '1.0.0'
  },

  crmIntegration: {
    enabled: true,
    rolloutPercentage: 100,
    targetUsers: ['all'],
    description: 'CRM integration (HubSpot, Salesforce, etc.)',
    version: '1.0.0'
  },

  emailTemplates: {
    enabled: true,
    rolloutPercentage: 100,
    targetUsers: ['all'],
    description: 'Email template system',
    version: '1.0.0'
  },

  toolsPanel: {
    enabled: true,
    rolloutPercentage: 100,
    targetUsers: ['all'],
    description: 'Tools panel with contextual suggestions',
    version: '1.0.0'
  }
};

// User group definitions
const userGroups: Record<string, string[]> = {
  'internal': [], // Add internal user IDs
  'beta-testers': [], // Add beta tester user IDs
  'early-adopters': [], // Add early adopter user IDs
  'all': ['*']
};

// Load feature flags from environment or remote config
export function loadFeatureFlags(): FeatureFlagConfig {
  // Check for environment variable overrides
  const envFlags: Partial<FeatureFlagConfig> = {};

  Object.keys(featureFlagsConfig).forEach(key => {
    const envKey = `VITE_FEATURE_${key.toUpperCase()}`;
    const envValue = import.meta.env[envKey];

    if (envValue !== undefined) {
      envFlags[key] = {
        ...featureFlagsConfig[key],
        enabled: envValue === 'true' || envValue === true
      };
    }
  });

  return {
    ...featureFlagsConfig,
    ...envFlags
  };
}

// Check if user is in target group
function isUserInTargetGroup(userId: string | undefined, targetUsers: string[] = []): boolean {
  if (targetUsers.includes('all') || targetUsers.includes('*')) {
    return true;
  }

  if (!userId) {
    return false;
  }

  // Check direct user ID match
  if (targetUsers.includes(userId)) {
    return true;
  }

  // Check group membership
  return targetUsers.some(group => {
    const groupUsers = userGroups[group] || [];
    return groupUsers.includes(userId) || groupUsers.includes('*');
  });
}

// Check if user is in rollout percentage
function isUserInRollout(userId: string | undefined, percentage: number): boolean {
  if (percentage >= 100) {
    return true;
  }

  if (percentage <= 0) {
    return false;
  }

  if (!userId) {
    // For anonymous users, use random rollout
    return Math.random() * 100 < percentage;
  }

  // Deterministic rollout based on user ID hash
  // This ensures the same user always gets the same result
  const hash = userId.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);

  return Math.abs(hash % 100) < percentage;
}

// Main feature flag check function
export function useFeatureFlag(
  flagName: string,
  userId?: string,
  defaultValue: boolean = false
): boolean {
  const flags = loadFeatureFlags();
  const flag = flags[flagName];

  if (!flag) {
    console.warn(`Feature flag "${flagName}" not found, using default value: ${defaultValue}`);
    return defaultValue;
  }

  // Check if feature is enabled
  if (!flag.enabled) {
    return false;
  }

  // Check if user is in target group
  if (!isUserInTargetGroup(userId, flag.targetUsers)) {
    return false;
  }

  // Check if user is in rollout percentage
  if (!isUserInRollout(userId, flag.rolloutPercentage)) {
    return false;
  }

  return true;
}

// Get all active features for a user
export function getActiveFeatures(userId?: string): string[] {
  const flags = loadFeatureFlags();

  return Object.keys(flags).filter(flagName =>
    useFeatureFlag(flagName, userId)
  );
}

// Get feature flag info
export function getFeatureFlagInfo(flagName: string): FeatureFlag | null {
  const flags = loadFeatureFlags();
  return flags[flagName] || null;
}

// Admin function to update feature flags (for dashboard)
export async function updateFeatureFlag(
  flagName: string,
  updates: Partial<FeatureFlag>
): Promise<void> {
  // This would typically update a remote config service
  // For now, it's a placeholder for future implementation
  console.log(`Updating feature flag "${flagName}":`, updates);

  // TODO: Implement remote config update via Supabase or similar
  // Example: await supabase.from('feature_flags').update(updates).eq('name', flagName);
}

// Export for testing and debugging
export function getAllFeatureFlags(): FeatureFlagConfig {
  return loadFeatureFlags();
}

// React hook for feature flags
export function useFeature(flagName: string, userId?: string): boolean {
  return useFeatureFlag(flagName, userId);
}

// Track feature flag usage for analytics
export function trackFeatureFlagUsage(
  flagName: string,
  userId: string | undefined,
  isEnabled: boolean
): void {
  // Send to analytics service
  if (typeof window !== 'undefined' && (window as any).analytics) {
    (window as any).analytics.track('Feature Flag Evaluated', {
      flagName,
      userId,
      isEnabled,
      timestamp: new Date().toISOString()
    });
  }
}
