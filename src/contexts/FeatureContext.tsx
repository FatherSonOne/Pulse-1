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
  // Priority Features (always visible)
  voiceInput: boolean;
  analytics: boolean;
  moodBadges: boolean;
  reactions: boolean;

  // Advanced Features (progressive disclosure)
  aiComposer: boolean;
  slashCommands: boolean;
  formatting: boolean;
  attachments: boolean;
  smartReplies: boolean;
  toneAnalysis: boolean;
  templates: boolean;
  scheduledMessages: boolean;
  draftManager: boolean;
  searchFilter: boolean;
  pinning: boolean;
  threading: boolean;
  readReceipts: boolean;
  translation: boolean;
  codeStudio: boolean;
  videoAnalyst: boolean;
  visionLab: boolean;
  deepSearch: boolean;
  meetingIntel: boolean;
  videoStudio: boolean;
  voiceStudio: boolean;
  routePlanner: boolean;

  // Experimental Features (hidden by default)
  experimentalAI: boolean;
  experimentalCollaboration: boolean;
  experimentalMedia: boolean;
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
  // Priority features (enabled by default)
  voiceInput: true,
  analytics: true,
  moodBadges: true,
  reactions: true,

  // Advanced features (disabled by default for progressive disclosure)
  aiComposer: false,
  slashCommands: true, // Keep this enabled as it's core functionality
  formatting: true, // Basic formatting should be available
  attachments: true, // Core feature
  smartReplies: false,
  toneAnalysis: false,
  templates: false,
  scheduledMessages: false,
  draftManager: false,
  searchFilter: true, // Core feature
  pinning: false,
  threading: false,
  readReceipts: true, // Core feature
  translation: false,
  codeStudio: false,
  videoAnalyst: false,
  visionLab: false,
  deepSearch: false,
  meetingIntel: false,
  videoStudio: false,
  voiceStudio: false,
  routePlanner: false,

  // Experimental (disabled by default)
  experimentalAI: false,
  experimentalCollaboration: false,
  experimentalMedia: false
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
 * Feature categories for settings panel
 */
export const FEATURE_CATEGORIES = {
  priority: {
    name: 'Priority Features',
    description: 'Always accessible core features',
    features: ['voiceInput', 'analytics', 'moodBadges', 'reactions'] as (keyof FeatureFlags)[]
  },
  advanced: {
    name: 'Advanced Features',
    description: 'Powerful tools for enhanced productivity',
    features: [
      'aiComposer',
      'smartReplies',
      'toneAnalysis',
      'templates',
      'scheduledMessages',
      'draftManager'
    ] as (keyof FeatureFlags)[]
  },
  collaboration: {
    name: 'Collaboration Tools',
    description: 'Features for team communication',
    features: [
      'pinning',
      'threading',
      'readReceipts',
      'translation'
    ] as (keyof FeatureFlags)[]
  },
  media: {
    name: 'Media & Creation',
    description: 'Content creation and analysis tools',
    features: [
      'codeStudio',
      'videoAnalyst',
      'visionLab',
      'videoStudio',
      'voiceStudio'
    ] as (keyof FeatureFlags)[]
  },
  intelligence: {
    name: 'Intelligence & Research',
    description: 'AI-powered analysis and search',
    features: [
      'deepSearch',
      'meetingIntel',
      'routePlanner'
    ] as (keyof FeatureFlags)[]
  },
  experimental: {
    name: 'Experimental',
    description: 'Beta features in development',
    features: [
      'experimentalAI',
      'experimentalCollaboration',
      'experimentalMedia'
    ] as (keyof FeatureFlags)[]
  }
};

/**
 * Feature display names
 */
export const FEATURE_NAMES: Record<keyof FeatureFlags, string> = {
  voiceInput: 'Voice Input',
  analytics: 'Analytics Dashboard',
  moodBadges: 'Mood Badges',
  reactions: 'Message Reactions',
  aiComposer: 'AI Composer',
  slashCommands: 'Slash Commands',
  formatting: 'Text Formatting',
  attachments: 'File Attachments',
  smartReplies: 'Smart Replies',
  toneAnalysis: 'Tone Analysis',
  templates: 'Message Templates',
  scheduledMessages: 'Scheduled Messages',
  draftManager: 'Draft Manager',
  searchFilter: 'Search & Filter',
  pinning: 'Message Pinning',
  threading: 'Message Threading',
  readReceipts: 'Read Receipts',
  translation: 'Translation',
  codeStudio: 'Code Studio',
  videoAnalyst: 'Video Analyst',
  visionLab: 'Vision Lab',
  deepSearch: 'Deep Search',
  meetingIntel: 'Meeting Intel',
  videoStudio: 'Video Studio',
  voiceStudio: 'Voice Studio',
  routePlanner: 'Route Planner',
  experimentalAI: 'Experimental AI',
  experimentalCollaboration: 'Experimental Collaboration',
  experimentalMedia: 'Experimental Media'
};
