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
  },

  // ⚠️ NAMING CAVEAT (reconciled in #125): this flag does NOT gate the real
  // Decisions voting. End-user decision voting is LIVE and DB-backed — the
  // Decisions Cockpit (DecisionDetail.handleVote + CockpitHub quick-approve)
  // calls decisionService.castVote() → the public.decision_votes table
  // (RLS on, UNIQUE(decision_id, user_id), persists approve/reject/concern/
  // abstain, one vote per user). That surface ships ungated to everyone and
  // is the "Decisions + voting ✅" the Capability Matrix + landing page mean.
  //
  // `proposalMode` gates only a SEPARATE, narrower surface: the in-Messages
  // composer "proposal mode" (Ctrl+Shift+P) that turns a chat message into an
  // inline proposal whose votes are simulated client-side and NOT persisted.
  // That piece stays OFF/internal until the in-message proposal flow is wired
  // to the same decision_votes backend — see Phase 1 deep-dive issue #3.
  proposalMode: {
    enabled: false,
    rolloutPercentage: 0,
    targetUsers: ['internal'],
    description: 'In-Messages composer proposal mode (simulated client-side votes) — NOT the real Decisions voting, which ships live + DB-backed via decision_votes',
    version: '0.1.0'
  },

  // Team Settings → Groups card.
  //
  // The workspace_groups + workspace_group_members schema is real (RLS,
  // CRUD service methods, full UI), but the *read side* is absent — no
  // mention parser, no notification router, no channel ACL, no RLS
  // policy consumes workspace_group_members.  The card's promise of
  // "groups for permissions, mentions, and reporting" is fiction until
  // #42 phase 5 (group_grants table + extended user_has_permission)
  // lands a consumer.  Hidden in production to avoid promising features
  // that don't exist; dev override is `?ff_workspaceGroups=on`.
  workspaceGroups: {
    enabled: false,
    rolloutPercentage: 0,
    targetUsers: ['internal'],
    description: 'PAUSED — Groups CRUD UI; no read consumer until #42 ships group_grants',
    version: '0.1.0'
  },

  // Phase 5e — ⚠️ PAUSED as of 2026-04-27.
  //
  // The v2 entry exists as parallel-rebuild scaffolding but has a
  // multi-session feature-parity gap vs. the legacy Messages.tsx
  // (no slash commands, no smart compose, no inline reactions, no
  // context menu, no mood badges, no rich cards, no voice transcript,
  // no AI cards, etc.). See:
  //   docs/deep-dives/messages_v2_parity_backlog.md
  //
  // **Do NOT flip this to enabled: true** for production users until
  // the parity backlog is closed and a fresh smoke test passes.
  // Local dev override is fine via `?ff_pulseMessagesV2=on` URL param.
  pulseMessagesV2: {
    enabled: false,
    rolloutPercentage: 0,
    targetUsers: ['internal'],
    description: 'PAUSED — v2 Messages entry scaffolding; not production-ready. See docs/deep-dives/messages_v2_parity_backlog.md',
    version: '2.0.0'
  },

  // In-app SMS is a demo shell — smsService.isMockMode() is hard-coded true
  // and conversations live in in-memory arrays (src/services/smsService.ts).
  // Showing users a fake messaging surface erodes trust, so the whole
  // surface is hidden for v1 until it is wired to real Twilio behind A2P
  // 10DLC + TCPA consent (compliance gate: issue #109; backend deploy: #99).
  // Do NOT flip to enabled: true for production until real SMS ships.
  // Local dev override: `?ff_inAppSms=on`.
  inAppSms: {
    enabled: false,
    rolloutPercentage: 0,
    targetUsers: ['internal'],
    description: 'HIDDEN for v1 — in-app SMS is a mock shell; unhide only when real Twilio + 10DLC ships (#99/#109)',
    version: '0.1.0'
  },

  // Email → Campaigns (the bulk-send surface inside the Email client) is
  // HIDDEN for v1. What's gated: the "Campaigns" nav entry + the
  // EmailCampaignsDashboard / EmailCampaignBuilder sub-views in
  // PulseEmailClientRedesign. WHY: emailCampaignService.send() (~:166) loops
  // gmailService.sendEmail() once per recipient with NO batching, NO
  // rate-limiting, NO List-Unsubscribe header, no suppression list, and no
  // bounce handling — firing a campaign would get the connected Gmail account
  // spam-flagged. THE v1 DECISION: the feature is likely being cut, so we hide
  // the surface to make that unsafe send path unreachable rather than harden
  // it. UNHIDE CONDITION: only flip enabled: true once a compliant, batched,
  // rate-limited sender with List-Unsubscribe + suppression + bounce handling
  // actually ships. Owning issue: #105. Local dev override: `?ff_emailCampaigns=on`.
  emailCampaigns: {
    enabled: false,
    rolloutPercentage: 0,
    targetUsers: ['internal'],
    description: 'HIDDEN for v1 — email Campaigns send loop is unsafe (per-recipient, no rate-limit/unsubscribe); likely cut. Unhide only when a compliant batched sender ships (#105).',
    version: '0.1.0'
  },

  // emailHybrid flag retired in Phase 11b (2026-05-29). The Cockpit +
  // Triage + Focal Canvas / Sidecar composer surface is the only email
  // surface — the legacy PulseEmailClientRedesign was deleted alongside
  // this entry.

  // decisionsTriageCockpit flag retired (2026-05-30, Phase 12). The Triage
  // Cockpit is now the only Decisions & Tasks surface — the legacy
  // DecisionTaskHub (Active / Board / Archive) was deleted alongside this
  // entry. App.tsx renders CockpitHub directly.

  // Search "Workbench" redesign — gates the new SearchWorkbench (facet
  // cockpit + dense results table + Working Set dock) against the legacy
  // UnifiedSearchRedesign card feed. OFF for v1 while the Workbench is built
  // out phase-by-phase behind the flag; legacy stays byte-identical until the
  // flag flips. Presentation/IA rewrite only — all search services, sources,
  // and operators are ported verbatim. Spec + plan:
  // docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md. Local dev override:
  // `?ff_searchWorkbench=on`.
  searchWorkbench: {
    enabled: false,
    rolloutPercentage: 0,
    targetUsers: ['internal'],
    description: 'OFF for v1 — Search Workbench redesign; building behind the flag, legacy UnifiedSearchRedesign stays default until flip (see SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md)',
    version: '0.1.0'
  },
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

// Dev-mode URL/localStorage override — lets you flip a flag on/off
// without editing config or restarting Vite. Tries:
//   1. URL query param  ?ff_<flagName>=on|off
//   2. localStorage      key  ff_<flagName>  value  on|off
// Returns null if no override is set; the normal flag evaluation runs.
function readDevOverride(flagName: string): boolean | null {
  if (typeof window === 'undefined') return null;
  const queryKey = `ff_${flagName}`;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get(queryKey);
    if (fromQuery === 'on' || fromQuery === '1' || fromQuery === 'true') {
      // Persist so subsequent navigations within the SPA stay overridden.
      window.localStorage.setItem(queryKey, 'on');
      return true;
    }
    if (fromQuery === 'off' || fromQuery === '0' || fromQuery === 'false') {
      window.localStorage.setItem(queryKey, 'off');
      return false;
    }
    const fromStorage = window.localStorage.getItem(queryKey);
    if (fromStorage === 'on') return true;
    if (fromStorage === 'off') return false;
  } catch {
    // Private browsing / sandboxed contexts may block storage.
  }
  return null;
}

// Main feature flag check function
export function useFeatureFlag(
  flagName: string,
  userId?: string,
  defaultValue: boolean = false
): boolean {
  // Dev override takes precedence — useful for smoke-testing a flag
  // on your own session without bumping rollout percentages.
  const override = readDevOverride(flagName);
  if (override !== null) return override;

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
