/**
 * FeatureContext - Progressive Disclosure System
 * Phase 3: Feature Refinements - Task 4
 *
 * Features:
 * - Feature toggle system for advanced features
 * - User preference persistence (localStorage)
 * - Priority features always visible
 * - Discovery hints for hidden features
 * - Settings panel integration
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface FeatureFlags {
  // Priority — wired in MessageInput + MessageEnhancements
  voiceInput: boolean;
  moodBadges: boolean;

  // Advanced — wired in MessageInput / Relay / MessageEnhancements
  aiComposer: boolean;
  smartReplies: boolean;
  toneAnalysis: boolean;
  scheduledMessages: boolean;

  // Surface 2 (message context-menu) shipped GA 2026-05-31 — the
  // MessageContextMenu is now unconditional; flag removed.

  // PR 1 — Messages Tools Redesign · Surface 1 (compose bar).
  // Gates the new PulseComposer (attach sheet, Smart Compose ghost-text,
  // format-on-selection popover, /t templates + / generic slash autocomplete,
  // Tools menu opener). Legacy `MessageInput` renders when off. Voice and
  // schedule send are deliberately deferred to follow-up PRs.
  pulseComposerV2: boolean;

  // PR 3a — Messages Tools Redesign · Surface 3 (slim Tools menu shell).
  // Gates the new ToolsMenuV2 (search box + Thread Audit tile + Translate
  // Settings tile). Renders ToolsMenuPlaceholder when off. Thread Summary
  // and Insights tiles ship in PR 3b — not visible in PR 3a even when on.
  // Carries ZERO coral; coral budget is reserved for PR 3b.
  toolsMenuV2: boolean;

  // Email section master switch. OFF by default → the Email nav item shows a
  // red "feature not available" caption and ALL Gmail fetch / token use is gated
  // off (src/lib/emailFeature.ts → gmailService.getAccessToken + emailSyncService
  // + EmailClientWrapper). Turn ON in Settings → Features & Labs to develop/test
  // the Email surface. Read by non-React code via isEmailEnabled().
  emailEnabled: boolean;

  // Experimental section master switch (sidebar: Summit / Map / War Room). OFF
  // by default → the section header note reads "features disabled" in red and
  // the items are greyed out + non-clickable. Turn ON in Settings → Features &
  // Labs to use them. Gated in Sidebar.tsx.
  experimentalEnabled: boolean;

  // Contacts Hybrid redesign (Path D) master switch. ON by default as of
  // Phase 11. OFF → the People tab renders the legacy ContactsRedesigned
  // layout. ON → the new 3-pane hybrid People view (Browse / Focus / Co-pilot) under
  // src/components/contacts/hybrid/. Gated in ContactsShell.tsx on the People
  // body only; the Today tab is unchanged either way. See
  // docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md.
  contactsHybrid: boolean;

  // Slack DM send from a contact (contactsHybrid Phase 8). OFF by default → the
  // Contacts ChannelRow Slack button stays disabled ("Link Slack") even for a
  // linked contact. ON → enabled inline DM composer in FocusColumn. System-wide
  // kill-switch for the send capability; per-contact identity is separate data
  // (contact.slackUserId). Consumer gate + Settings toggle land in Phase 8 · 8f.
  // See docs/SLACK_PHASE8_SCOPE_2026-06-05.md (decision D-F).
  slackSend: boolean;
}

export interface FeatureDiscovery {
  featureId: string;
  shown: boolean;
  dismissedAt?: Date;
}

interface FeatureContextValue {
  features: FeatureFlags;
  toggleFeature: (featureId: keyof FeatureFlags, enabled?: boolean) => void;
  resetFeatures: () => void;
  isFeatureEnabled: (featureId: keyof FeatureFlags) => boolean;
  discoveryHints: FeatureDiscovery[];
  dismissHint: (featureId: string) => void;
  advancedMode: boolean;
  setAdvancedMode: (enabled: boolean) => void;
}

const FeatureContext = createContext<FeatureContextValue | null>(null);

const DEFAULT_FEATURES: FeatureFlags = {
  // Priority — visible by default
  voiceInput: true,
  moodBadges: true,

  // Advanced — opt-in
  aiComposer: false,
  smartReplies: false,
  toneAnalysis: false,
  scheduledMessages: false,

  // PR 1 — default off until rollout
  pulseComposerV2: false,

  // PR 3a — default off until rollout
  toolsMenuV2: false,

  // Email section OFF by default ("feature not available"); flip on for dev/test.
  emailEnabled: false,

  // Experimental section OFF by default ("features disabled"); flip on for dev/test.
  experimentalEnabled: false,

  // Contacts Hybrid (Path D) is the DEFAULT as of Phase 11. New 3-pane People
  // view; existing users keep their persisted choice (localStorage merge), so
  // this only changes fresh loads. Legacy stays the fallback (flag still
  // toggleable) until Phase 12 removes ContactsRedesigned.
  contactsHybrid: true,

  // Slack send OFF by default (dark-launch); flip on once the 8f wiring ships.
  slackSend: false,
};

const STORAGE_KEY = 'pulse_feature_flags';
const DISCOVERY_STORAGE_KEY = 'pulse_feature_discovery';

export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [features, setFeatures] = useState<FeatureFlags>(() => {
    // Load from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_FEATURES, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Failed to load feature flags:', error);
    }
    return DEFAULT_FEATURES;
  });

  const [discoveryHints, setDiscoveryHints] = useState<FeatureDiscovery[]>(() => {
    try {
      const saved = localStorage.getItem(DISCOVERY_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load discovery hints:', error);
    }
    return [];
  });

  const [advancedMode, setAdvancedMode] = useState(() => {
    try {
      const saved = localStorage.getItem('pulse_advanced_mode');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  // Save features to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
    } catch (error) {
      console.error('Failed to save feature flags:', error);
    }
  }, [features]);

  // Save discovery hints to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(discoveryHints));
    } catch (error) {
      console.error('Failed to save discovery hints:', error);
    }
  }, [discoveryHints]);

  // Save advanced mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pulse_advanced_mode', String(advancedMode));
    } catch (error) {
      console.error('Failed to save advanced mode:', error);
    }
  }, [advancedMode]);

  const toggleFeature = useCallback((featureId: keyof FeatureFlags, enabled?: boolean) => {
    setFeatures(prev => ({
      ...prev,
      [featureId]: enabled !== undefined ? enabled : !prev[featureId]
    }));

    // Track feature activation for discovery hints
    if (enabled !== false) {
      setDiscoveryHints(prev => {
        const existing = prev.find(h => h.featureId === featureId);
        if (existing) {
          return prev.map(h =>
            h.featureId === featureId
              ? { ...h, shown: true, dismissedAt: new Date() }
              : h
          );
        }
        return [...prev, { featureId, shown: true, dismissedAt: new Date() }];
      });
    }
  }, []);

  const resetFeatures = useCallback(() => {
    setFeatures(DEFAULT_FEATURES);
    setDiscoveryHints([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DISCOVERY_STORAGE_KEY);
  }, []);

  const isFeatureEnabled = useCallback((featureId: keyof FeatureFlags) => {
    return features[featureId];
  }, [features]);

  const dismissHint = useCallback((featureId: string) => {
    setDiscoveryHints(prev =>
      prev.map(h =>
        h.featureId === featureId
          ? { ...h, dismissedAt: new Date() }
          : h
      )
    );
  }, []);

  const value: FeatureContextValue = {
    features,
    toggleFeature,
    resetFeatures,
    isFeatureEnabled,
    discoveryHints,
    dismissHint,
    advancedMode,
    setAdvancedMode
  };

  return <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>;
};

export const useFeatures = () => {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error('useFeatures must be used within a FeatureProvider');
  }
  return context;
};

/**
 * Feature categories for settings panel.
 *
 * Only includes features with real consumer code (a useFeatures()/isFeatureEnabled()
 * gate at the render site). Adding a flag here without a consumer creates a
 * dead toggle — re-add when the feature ships its gate.
 */
export const FEATURE_CATEGORIES = {
  priority: {
    name: 'Priority Features',
    description: 'On by default. Turn one off to hide it.',
    features: ['moodBadges'] as (keyof FeatureFlags)[]
  },
  advanced: {
    name: 'Advanced Features',
    description: 'Opt-in productivity tools for the composer and Relay.',
    features: [
      'smartReplies',
      'scheduledMessages'
    ] as (keyof FeatureFlags)[]
  }
  // voiceInput / aiComposer / toneAnalysis removed from this surface 2026-06-05:
  // their only consumer is the *classic* MessageInput composer (lines 104-106),
  // which is retired on the Pulse-DM path. The flag keys, defaults, FEATURE_NAMES,
  // FEATURE_DESCRIPTIONS, and isFeatureEnabled() gates are intentionally retained
  // so legacy-thread behavior is unchanged — only the inert toggles are hidden.
  // Re-add a key to a `features` array to surface its control again.
  // 'Messages Tools Redesign (Beta)' category removed from the Features Labs UI
  // 2026-06-01: PulseComposer is now the unconditional Pulse-DM composer and the
  // tools menu is removed from the UX (MESSAGES_TOOLS_ENABLED gate), so the
  // `pulseComposerV2` / `toolsMenuV2` toggles no longer do anything user-visible.
  // The flag keys are retained (still referenced in code) but no longer surfaced.
};

/**
 * Feature display names
 */
export const FEATURE_NAMES: Record<keyof FeatureFlags, string> = {
  voiceInput: 'Voice Input',
  moodBadges: 'Mood Badges',
  aiComposer: 'AI Composer',
  smartReplies: 'Smart Replies',
  toneAnalysis: 'Tone Analysis',
  scheduledMessages: 'Scheduled Messages',
  pulseComposerV2: 'New Compose Bar (Beta)',
  toolsMenuV2: 'New Tools Menu (Beta)',
  emailEnabled: 'Email Section',
  experimentalEnabled: 'Experimental Features',
  contactsHybrid: 'Contacts Hybrid (Beta)',
  slackSend: 'Slack Send (Beta)',
};

/**
 * Per-feature descriptions for the settings surfaces. Grounded in each flag's
 * verified consumer (checked 2026-06-05), so the copy never promises behavior
 * the toggle doesn't deliver:
 *  - moodBadges → MessageMoodBadge, smartReplies → Relay VoxSmartReplies,
 *    scheduledMessages → MessageScheduling. These three are live.
 *  - voiceInput / aiComposer / toneAnalysis only gate the *classic* MessageInput
 *    composer (retired on the Pulse-DM path; still reachable on legacy threads),
 *    so they're described as classic-composer features rather than implying they
 *    affect the current composer.
 */
export const FEATURE_DESCRIPTIONS: Partial<Record<keyof FeatureFlags, string>> = {
  voiceInput: 'Show the voice-to-text mic in the classic composer.',
  moodBadges: 'Show an AI-inferred mood chip on incoming messages.',
  aiComposer: 'Offer AI draft suggestions in the classic composer.',
  smartReplies: 'Suggest one-tap AI replies in Relay voice threads.',
  toneAnalysis: "Analyze your draft's tone in the classic composer (Advanced Mode).",
  scheduledMessages: 'Schedule a message to send at a later time.',
  slackSend: 'Send a Slack DM to a linked contact from the People view (Phase 8).',
};
