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

  // Slack DM send from a contact (contactsHybrid Phase 8). OFF by default → the
  // Contacts ChannelRow Slack button stays disabled ("Link Slack") even for a
  // linked contact. ON → enabled inline DM composer in FocusColumn. System-wide
  // kill-switch for the send capability; per-contact identity is separate data
  // (contact.slackUserId). Consumer gate + Settings toggle land in Phase 8 · 8f.
  // See docs/SLACK_PHASE8_SCOPE_2026-06-05.md (decision D-F).
  slackSend: boolean;

  // Slack-Grounded Messages master switch (slackMessagesGrounding). OFF by
  // default → no external (Slack-backed) conversations render, and no Slack
  // user-OAuth / Events ingest / send-as-you path is active. Additive over
  // Messages Path D; preserves the Pulse-DM surface unchanged.
  // See docs/SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md (P0–P6).
  slackMessagesGrounding: boolean;

  // Slack Channels grounding master switch (Integration C). OFF by default → no
  // Slack *channel* threads ingest or render, and the channel reply-as-you path
  // is inactive. Sibling of slackMessagesGrounding (which is 1:1 DMs only); lands
  // channel threads in a net-new owner-scoped store, never the DM tables.
  // See docs/SLACK_CHANNELS_GROUNDING_SCOPE_2026-06-08.md (P0–P8).
  slackChannelsGrounding: boolean;

  // Logos Vision sync master switch (CRM bidirectional sync). OFF by default →
  // no Pulse→Logos case-log/activity writes fire and no Logos→Pulse records flow
  // back. Privileged Logos access runs server-side (server.js /api/logos/*); this
  // flag only gates whether the send-side hooks POST. Additive; single-tenant.
  // See docs/LOGOS_VISION_SYNC_BUILD_HANDOFF_2026-06-13.md (P0–P7).
  logosVisionSync: boolean;

  // MapLibre renderer master switch (Path B — fully de-Google'd map). OFF by
  // default. P0 = flag scaffold only — NO consumer yet (the map still renders
  // on Google). Later phases branch the renderer/tiles/geocoding on this flag,
  // keeping the working Google path as the fallback until MapLibre reaches
  // parity. Note the legal coupling: a non-Google base map may only ship once
  // the geocoding/directions data layer is also off Google.
  // See docs/MAP_MAPLIBRE_REBRAND_HANDOFF_2026-06-14.md (P0–P5).
  mapLibreRenderer: boolean;

  // Map "Horizon" redesign master switch (Direction D). OFF by default → the
  // Map renders exactly as today (TODAY/WEEK/ATLAS tabs, Sat/Terr/Hybrid picker,
  // AiStrip band, sheets/pills). ON → the new Horizon UX: time-horizon scrubber
  // + Atlas-mode toggle, renderer-real base-style switch, neutral chrome, the
  // Routes/Live/Geofences drawers, geosearch "I'm at…", and cross-entity markers.
  // Assumes mapLibreRenderer ON (the renderer-coupled pieces target the MapLibre
  // branch); on the Google fallback it falls back to the legacy tabs/picker.
  // Graduating OFF→ON later REQUIRES a FLAGS_VERSION bump (see migration block).
  // See docs/MAP_HORIZON_REDESIGN_HANDOFF_2026-06-15.md (P0–P13).
  mapHorizon: boolean;

  // Map Horizon — Floating Chrome (Tier-3 §8B rebuild). OFF by default
  // (dark-launch); double-gated on mapHorizon. ON → the Map chrome becomes
  // floating glass islands over a full-bleed map (the Direction-D mockup)
  // instead of the stacked bands; OFF keeps the banded Horizon byte-identical.
  mapHorizonFloat: boolean;

  // Relay "Live" (Voice Rooms) master switch. OFF by default → the Live rail
  // entry is hidden and the Live view renders a "coming soon" placeholder
  // instead of VoiceRooms. VoiceRooms is a LOCAL mic preview with no WebRTC
  // peer transport yet (VoiceRooms.tsx header), so users must not be able to
  // "join" a silent room in GA. Launch blocker S0-2 (relay-launch-readiness
  // 2026-06-14). Deliberately NOT surfaced in FEATURE_CATEGORIES — flip via
  // localStorage `pulse_feature_flags` to keep developing VoiceRooms; the real
  // unlock is WebRTC transport (Sprint 4 S4-1), which re-enables it for users.
  relayLiveRooms: boolean;
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

  // Slack send OFF by default (dark-launch); flip on once the 8f wiring ships.
  slackSend: false,

  // Slack-Grounded Messages OFF by default (dark-launch); P0 = schema only.
  slackMessagesGrounding: false,

  // Slack Channels grounding OFF by default (dark-launch); P0 = flag scaffold only.
  slackChannelsGrounding: false,

  // Logos Vision sync OFF by default (dark-launch); P0 = connection + flag scaffold.
  logosVisionSync: false,

  // MapLibre renderer ON by default — graduated 2026-06-15 once the legal gate
  // closed (geocode/route/directions/distance moved off Google to Stadia, so a
  // non-Google base map no longer shows Google-derived geocodes/routes). The Map
  // section itself is still gated by experimentalEnabled; this only decides which
  // renderer the Map uses. Persisted-blob masking is handled by FLAGS_VERSION.
  mapLibreRenderer: true,

  // Map Horizon redesign ON by default — graduated 2026-06-16 (P13). The Horizon
  // UX (time-horizon scrubber + Atlas mode, base-style switch, neutral chrome,
  // Live/Geofences drawers) is now the default Map. Rides the MapLibre branch
  // (mapLibreRenderer already default-ON). Per-user opt-out remains in Settings →
  // Features & Labs. Persisted-blob masking is handled by the FLAGS_VERSION bump.
  mapHorizon: true,

  // Map Horizon Floating Chrome ON by default — graduated 2026-06-16 (F6) after a
  // live eyeball. The Map chrome is floating glass islands over a full-bleed map
  // (Direction-D: scrubber pill, AI card, Routes/Live/Fences cluster). Double-gated
  // on mapHorizon. Per-user opt-out in Settings → Features & Labs. Persisted-blob
  // masking handled by the FLAGS_VERSION bump (v3).
  mapHorizonFloat: true,

  // Relay Live (Voice Rooms) OFF by default — no peer audio transport yet (S0-2).
  relayLiveRooms: false,
};

const STORAGE_KEY = 'pulse_feature_flags';
// Bumped when a flag graduates and its new DEFAULT_FEATURES value MUST override a
// stale persisted value — saved flags otherwise win the merge in the loader, so a
// bare default flip never reaches a browser that's already run the app. The loader
// resets the listed flags once per bump.
const FLAGS_VERSION = 3;
const FLAGS_VERSION_KEY = 'pulse_feature_flags_version';
const DISCOVERY_STORAGE_KEY = 'pulse_feature_discovery';

export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [features, setFeatures] = useState<FeatureFlags>(() => {
    // Load from localStorage, then run one-time default-graduation migrations.
    // A persisted blob would otherwise MASK a changed DEFAULT_FEATURES value
    // (saved flags win the merge) — the FLAGS_VERSION bump is what lets a flipped
    // default actually reach a browser that's already persisted the old value.
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed: Partial<FeatureFlags> = saved ? JSON.parse(saved) : {};
      const merged: FeatureFlags = { ...DEFAULT_FEATURES, ...parsed };
      const storedVersion = Number(localStorage.getItem(FLAGS_VERSION_KEY) ?? '0');
      if (storedVersion < FLAGS_VERSION) {
        // v1 (2026-06-15): MapLibre renderer graduated to default-ON — force the
        // new default over any stale persisted `false`.
        merged.mapLibreRenderer = DEFAULT_FEATURES.mapLibreRenderer;
        // v2 (2026-06-16): Map Horizon redesign (P13) graduated to default-ON —
        // force the new default over any stale persisted `false`.
        merged.mapHorizon = DEFAULT_FEATURES.mapHorizon;
        // v3 (2026-06-16): Map Horizon Floating Chrome (F6) graduated to default-ON —
        // force the new default over any stale persisted `false`.
        merged.mapHorizonFloat = DEFAULT_FEATURES.mapHorizonFloat;
        try { localStorage.setItem(FLAGS_VERSION_KEY, String(FLAGS_VERSION)); } catch { /* storage blocked */ }
      }
      return merged;
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
  },
  integrations: {
    name: 'Integrations (Beta)',
    description: 'Connect external services into Pulse. Off by default.',
    features: [
      'slackMessagesGrounding',
      'slackChannelsGrounding',
      'logosVisionSync'
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
  slackSend: 'Slack Send (Beta)',
  slackMessagesGrounding: 'Slack in Messages (Beta)',
  slackChannelsGrounding: 'Slack Channels (Beta)',
  logosVisionSync: 'Logos Vision Sync (Beta)',
  mapLibreRenderer: 'MapLibre Map Renderer (Beta)',
  mapHorizon: 'Map Horizon Redesign (Alpha)',
  mapHorizonFloat: 'Map Horizon — Floating Chrome',
  relayLiveRooms: 'Live Voice Rooms (Coming Soon)',
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
  slackMessagesGrounding: 'Bring your Slack DMs into Messages: connect Slack to send as you and mirror 1:1 threads. Backend + inbound still rolling out.',
  slackChannelsGrounding: 'Mirror your Slack channels into Pulse (read-only for now; replying from Pulse arrives soon). Invite the Slack bot to a channel to start.',
  logosVisionSync: 'Two-way sync with Logos Vision CRM: log Pulse conversations to the case timeline and surface case updates back in Pulse. Single-tenant; backend rolling out.',
};
