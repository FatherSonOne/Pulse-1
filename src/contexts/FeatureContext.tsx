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
    description: 'Always-on by default. Toggle off to hide the affordance.',
    features: ['voiceInput', 'moodBadges'] as (keyof FeatureFlags)[]
  },
  advanced: {
    name: 'Advanced Features',
    description: 'Opt-in productivity tools across MessageInput and Relay.',
    features: [
      'aiComposer',
      'smartReplies',
      'toneAnalysis',
      'scheduledMessages'
    ] as (keyof FeatureFlags)[]
  }
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
};
