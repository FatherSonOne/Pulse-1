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
  draftManager: boolean;
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
  draftManager: false,
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
      'scheduledMessages',
      'draftManager'
    ] as (keyof FeatureFlags)[]
  }
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
  draftManager: 'Draft Manager',
};
