// Settings Service - Persistent user settings with cross-device sync
// Stores settings in localStorage (web) and Capacitor Preferences (native)
// Also syncs to Supabase for cross-device persistence

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { supabase } from './supabase';

// All Pulse settings with their default values
export interface PulseSettings {
  // Appearance
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  customColor: string | null;
  sidebarCollapsed: boolean;
  compactMode: boolean;

  // Notifications
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  desktopNotifications: boolean;
  notificationFrequency: 'instant' | 'hourly' | 'daily';

  // Privacy
  showOnlineStatus: boolean;
  readReceipts: boolean;
  typingIndicators: boolean;
  profileVisibility: 'public' | 'contacts' | 'private';

  // Messages
  enterToSend: boolean;
  messagePreview: boolean;
  autoDownloadMedia: boolean;
  messageFontSize: 'small' | 'medium' | 'large';

  // Voice (Vox) - Basic
  autoTranscribe: boolean;
  voiceActivation: boolean;
  microphoneGain: number;
  speakerVolume: number;
  noiseReduction: boolean;

  // Relay Audio Settings
  voxMicrophoneDeviceId: string;
  voxSpeakerDeviceId: string;
  voxAudioQuality: 'voice_hd' | 'voice_balanced' | 'voice_low';
  voxNoiseReduction: boolean;
  voxAutoGainControl: boolean;
  voxEchoCancellation: boolean;

  // Relay Video Settings
  voxCameraDeviceId: string;
  voxVideoQuality: '480p' | '720p' | '1080p';
  voxVideoPreviewEnabled: boolean;
  voxVideoMirror: boolean;

  // Relay Storage Settings
  voxDownloadFolder: string;
  voxAutoDownload: boolean;
  voxKeepRecordingsDays: number;

  // Relay General Settings
  // Landing view when the user opens /relay with no deep-link override.
  // 'triage' is the default; the rest are the five audience peers.
  relayDefaultView: 'triage' | 'direct' | 'channel' | 'broadcast' | 'notes' | 'live';
  /** @deprecated kept for cloud-sync back-compat; the Default landing view dropdown now writes `relayDefaultView`. */
  voxDefaultMode: string | null;
  voxNotificationsEnabled: boolean;
  voxAutoPlayIncoming: boolean;
  voxHapticsEnabled: boolean;

  // Calendar
  defaultCalendarView: 'day' | 'week' | 'month';
  weekStartsOn: 0 | 1 | 6; // 0=Sunday, 1=Monday, 6=Saturday
  showWeekNumbers: boolean;
  defaultEventDuration: number; // minutes

  // AI Features
  aiSuggestionsEnabled: boolean;
  smartRepliesEnabled: boolean;
  aiAnalysisEnabled: boolean;
  aiVoiceEnabled: boolean;

  // AI Intelligence (panel-level)
  primaryAIModel: string;
  enableAdvancedReasoning: boolean;
  agentVoice: string;
  turnDetectionMode: 'semantic' | 'server';
  voiceActivityEagerness: 'low' | 'medium' | 'high';
  interactionMode: 'vad' | 'ptt';
  defaultSearchScope: string;
  autoAnalyzeDocs: boolean;

  // Notifications (section-level)
  enableAllNotifications: boolean;
  notifSound: boolean;
  notifDesktop: boolean;
  notifEmail: boolean;

  // Quiet hours — suppress non-urgent notifications during the configured window.
  quietHoursEnabled: boolean;
  quietHoursStart: string;        // "HH:mm" 24h
  quietHoursEnd: string;          // "HH:mm" 24h
  quietHoursDays: number[];       // 0=Sun ... 6=Sat

  // Digest schedule — periodic summary email.
  digestSchedule: 'off' | 'daily' | 'weekly';
  digestTime: string;             // "HH:mm" 24h
  digestDayOfWeek: number;        // 0=Sun ... 6=Sat (used when schedule='weekly')

  // Per-channel routing — which delivery modes fire for each notification type.
  notificationRouting: Record<string, { email: boolean; push: boolean; inApp: boolean }>;

  // AI per-user overrides. Members can opt OUT of providers the org allows
  // (cannot opt IN to a blocked provider) and can voluntarily enable PII
  // masking even when the org doesn't enforce it.
  aiProviderOverrides: { openai?: boolean; anthropic?: boolean; google?: boolean };
  aiPiiMaskingEnabled: boolean;

  // Multi-provider model preferences — see `aiPreferencesService`. Stored
  // here as an opaque blob so the dial/tier-models/task-overrides shape
  // can evolve without a settings migration.
  aiModelPreferences: {
    dial?: 'auto' | 'fast' | 'balanced' | 'premium';
    tierModels?: Record<string, string>;
    taskOverrides?: Record<string, string>;
  };

  // Email (Phase 4)
  emailNotificationBundling: boolean;
  emailAutoArchiveDays: number;
  emailDriveQuickAttach: boolean;

  // Data Retention & Privacy
  dataRetentionEnabled: boolean;
  emailsRetentionDays: number;
  calendarRetentionDays: number;
  contactsRetentionDays: number;
  messagesRetentionDays: number;
  voxesRetentionDays: number;

  // API Keys (encrypted/hashed in sync)
  openaiApiKey: string;
  geminiApiKey: string;
  claudeApiKey: string;
  assemblyaiApiKey: string;
  elevenlabsApiKey: string;
  mapboxApiKey: string;

  // Accessibility
  highContrast: boolean;
  reducedMotion: boolean;
  colorBlindMode: 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';
  alwaysFocusRings: boolean;
  underlineLinks: boolean;
  largeTouchTargets: boolean;

  // Analytics
  analyticsTracking: boolean;

  // Nudge frequency (hours): 24 / 72 / 168 / -1 (never)
  nudgeFrequencyHours: number;

  // War Room
  warRoomDefaultMode: string;
  warRoomAIDepth: 'fast' | 'balanced' | 'deep';
  warRoomTokenStreaming: boolean;
  warRoomThinkingPanel: boolean;
  warRoomAnnotations: boolean;

  // Activity Monitor
  activityMonitorPresenceVisible: boolean;
  activityMonitorLeaderboard: boolean;
  activityMonitorRetentionDays: number;

  // Desktop App (Electron)
  desktopRememberWindowPosition: boolean;
  desktopMinimizeToTray: boolean;
  desktopAutoLaunch: boolean;
  desktopNotificationStyle: 'native' | 'in-app';

  // Live Dashboard
  liveBoardSelectedAgent: string;

  // Decisions and Tasks accordion state — persisted per-mode so the operator
  // can have one set of sections expanded in Active and a different set in
  // Board. Keyed by section_id (lowercase, snake_case) to boolean (true =
  // expanded). Cross-device sync via user_settings JSONB.
  decisionsHubAccordionActive: Record<string, boolean>;
  decisionsHubAccordionBoard: Record<string, boolean>;

  // Sync metadata
  lastSyncedAt: string | null;
  settingsVersion: number;
}

// Default settings
const DEFAULT_SETTINGS: PulseSettings = {
  // Appearance
  theme: 'light',
  accentColor: 'rose',
  customColor: null,
  sidebarCollapsed: false,
  compactMode: false,

  // Notifications
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  emailNotifications: true,
  pushNotifications: true,
  desktopNotifications: true,
  notificationFrequency: 'instant',

  // Privacy
  showOnlineStatus: true,
  readReceipts: true,
  typingIndicators: true,
  profileVisibility: 'public',

  // Messages
  enterToSend: true,
  messagePreview: true,
  autoDownloadMedia: true,
  messageFontSize: 'medium',

  // Voice (Vox) - Basic
  autoTranscribe: true,
  voiceActivation: false,
  microphoneGain: 100,
  speakerVolume: 100,
  noiseReduction: true,

  // Relay Audio Settings
  voxMicrophoneDeviceId: '',
  voxSpeakerDeviceId: '',
  voxAudioQuality: 'voice_hd',
  voxNoiseReduction: false,
  voxAutoGainControl: false,
  voxEchoCancellation: true,

  // Relay Video Settings
  voxCameraDeviceId: '',
  voxVideoQuality: '720p',
  voxVideoPreviewEnabled: true,
  voxVideoMirror: true,

  // Relay Storage Settings
  voxDownloadFolder: '',
  voxAutoDownload: false,
  voxKeepRecordingsDays: 30,

  // Relay General Settings
  relayDefaultView: 'triage',
  voxDefaultMode: null,
  voxNotificationsEnabled: true,
  voxAutoPlayIncoming: false,
  voxHapticsEnabled: true,

  // Calendar
  defaultCalendarView: 'week',
  weekStartsOn: 0,
  showWeekNumbers: false,
  defaultEventDuration: 30,

  // AI Features
  aiSuggestionsEnabled: true,
  smartRepliesEnabled: true,
  aiAnalysisEnabled: true,
  aiVoiceEnabled: true,

  // AI Intelligence (panel-level)
  primaryAIModel: 'gemini-2.5-flash',
  enableAdvancedReasoning: false,
  agentVoice: 'nova',
  turnDetectionMode: 'semantic',
  voiceActivityEagerness: 'medium',
  interactionMode: 'vad',
  defaultSearchScope: 'current_project',
  autoAnalyzeDocs: true,

  // Notifications (section-level)
  enableAllNotifications: true,
  notifSound: true,
  notifDesktop: true,
  notifEmail: false,

  // Quiet hours — off by default; sensible 22:00–07:00 window pre-filled.
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  quietHoursDays: [0, 1, 2, 3, 4, 5, 6],

  // Digest — off by default; weekly at 09:00 Monday when enabled.
  digestSchedule: 'off',
  digestTime: '09:00',
  digestDayOfWeek: 1,

  // AI overrides default to empty / off — org policy applies until the user opts in.
  aiProviderOverrides: {},
  aiPiiMaskingEnabled: false,
  aiModelPreferences: {},

  // Per-channel routing — defaults pick reasonable modes per channel.
  notificationRouting: {
    mentions:        { email: true,  push: true,  inApp: true  },
    directMessages:  { email: true,  push: true,  inApp: true  },
    voxes:           { email: false, push: true,  inApp: true  },
    taskAssignments: { email: true,  push: true,  inApp: true  },
    decisions:       { email: true,  push: false, inApp: true  },
    calendarEvents:  { email: false, push: true,  inApp: true  },
    billing:         { email: true,  push: false, inApp: true  },
    securityAlerts:  { email: true,  push: true,  inApp: true  },
  },

  // Email (Phase 4)
  emailNotificationBundling: true,
  emailAutoArchiveDays: 0,
  emailDriveQuickAttach: true,

  // Nudge frequency
  nudgeFrequencyHours: 24,

  // Data Retention & Privacy
  dataRetentionEnabled: false,
  emailsRetentionDays: 90,
  calendarRetentionDays: 365,
  contactsRetentionDays: -1,
  messagesRetentionDays: 180,
  voxesRetentionDays: 90,

  // API Keys
  openaiApiKey: '',
  geminiApiKey: '',
  claudeApiKey: '',
  assemblyaiApiKey: '',
  elevenlabsApiKey: '',
  mapboxApiKey: '',

  // Accessibility
  highContrast: false,
  reducedMotion: false,
  colorBlindMode: 'off',
  alwaysFocusRings: false,
  underlineLinks: false,
  largeTouchTargets: false,

  // Analytics
  analyticsTracking: true,

  // War Room
  warRoomDefaultMode: 'command-center',
  warRoomAIDepth: 'balanced',
  warRoomTokenStreaming: true,
  warRoomThinkingPanel: true,
  warRoomAnnotations: true,

  // Activity Monitor
  activityMonitorPresenceVisible: true,
  activityMonitorLeaderboard: true,
  activityMonitorRetentionDays: 90,

  // Desktop App (Electron)
  desktopRememberWindowPosition: true,
  desktopMinimizeToTray: false,
  desktopAutoLaunch: false,
  desktopNotificationStyle: 'native',

  // Live Dashboard
  liveBoardSelectedAgent: 'general',

  // Decisions and Tasks accordion defaults. High-attention sections start
  // expanded; low-attention sections start collapsed. The operator can
  // override via the section header chevron, and the override syncs across
  // devices.
  decisionsHubAccordionActive: {
    needs_vote: true,
    overdue: true,
    blocked: true,
    in_review: true,
    in_progress: true,
    todo: false,
    recently_done: false,
    proposed: false,
  },
  decisionsHubAccordionBoard: {
    proposed: false,
    voting: true,
    decided: false,
    todo: false,
    in_progress: true,
    in_review: true,
    blocked: true,
    done: false,
  },

  // Sync metadata
  lastSyncedAt: null,
  settingsVersion: 1,
};

const SETTINGS_KEY = 'pulse_settings';
const SETTINGS_VERSION = 1;

class SettingsService {
  private cache: PulseSettings | null = null;
  private isNative = Capacitor.isNativePlatform();
  private cloudSyncDisabled = false; // Disable if table doesn't exist

  /**
   * Get a single setting value
   */
  async get<K extends keyof PulseSettings>(key: K): Promise<PulseSettings[K]> {
    const settings = await this.getAll();
    return settings[key];
  }

  /**
   * Set a single setting value
   */
  async set<K extends keyof PulseSettings>(key: K, value: PulseSettings[K]): Promise<void> {
    const settings = await this.getAll();
    settings[key] = value;
    await this.saveAll(settings);

    // Also update legacy localStorage keys for backwards compatibility
    this.updateLegacyKey(key, value);
  }

  /**
   * Get all settings
   */
  async getAll(): Promise<PulseSettings> {
    if (this.cache) {
      return this.cache;
    }

    let settings: PulseSettings;

    try {
      const stored = this.isNative
        ? (await Preferences.get({ key: SETTINGS_KEY })).value
        : localStorage.getItem(SETTINGS_KEY);

      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new settings added in updates
        settings = { ...DEFAULT_SETTINGS, ...parsed };
      } else {
        // First time - migrate from legacy localStorage keys
        settings = await this.migrateFromLegacy();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      settings = { ...DEFAULT_SETTINGS };
    }

    this.cache = settings;
    return settings;
  }

  /**
   * Save all settings
   */
  async saveAll(settings: PulseSettings): Promise<void> {
    settings.lastSyncedAt = new Date().toISOString();
    settings.settingsVersion = SETTINGS_VERSION;

    const serialized = JSON.stringify(settings);

    if (this.isNative) {
      await Preferences.set({ key: SETTINGS_KEY, value: serialized });
    } else {
      localStorage.setItem(SETTINGS_KEY, serialized);
    }

    this.cache = settings;

    // Sync to Supabase for cross-device sync (non-blocking)
    this.syncToCloud(settings).catch(console.error);
  }

  /**
   * Reset all settings to defaults
   */
  async reset(): Promise<PulseSettings> {
    const defaults = { ...DEFAULT_SETTINGS };
    await this.saveAll(defaults);
    return defaults;
  }

  /**
   * Sync settings from cloud (on login)
   */
  async syncFromCloud(): Promise<void> {
    if (this.cloudSyncDisabled) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('settings, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST204' || error.code === 'PGRST116' || error.message?.includes('406')) {
          console.debug('[Settings Debug] Cloud sync disabled - user_settings table not available (expected during initial setup)');
          this.cloudSyncDisabled = true;
        }
        return;
      }

      if (!data) return;

      const cloudSettings = data.settings as Partial<PulseSettings>;
      const localSettings = await this.getAll();

      // Use cloud settings if they're newer
      const cloudDate = new Date(data.updated_at);
      const localDate = localSettings.lastSyncedAt ? new Date(localSettings.lastSyncedAt) : new Date(0);

      if (cloudDate > localDate) {
        console.log('[Settings] Syncing from cloud (cloud is newer)');
        const merged = { ...localSettings, ...cloudSettings };
        await this.saveAll(merged);
      }
    } catch (error: any) {
      // Silently handle AbortError (expected during component unmount)
      if (error?.name === 'AbortError' || error?.message?.includes('AbortError') || error?.message?.includes('aborted')) {
        console.debug('[Settings] Cloud sync aborted (expected during cleanup)');
        return;
      }

      // Disable cloud sync on 406 errors to prevent spam
      if (error?.status === 406 || error?.code === 'PGRST204') {
        // Use debug-level - this is expected if table hasn't been created yet
        console.debug('[Settings Debug] Cloud sync disabled - table schema mismatch (expected during initial setup)');
        this.cloudSyncDisabled = true;
      } else {
        console.error('Error syncing settings from cloud:', error);
      }
    }
  }

  /**
   * Sync settings to cloud
   */
  private async syncToCloud(settings: PulseSettings): Promise<void> {
    if (this.cloudSyncDisabled) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Don't sync API keys to cloud (security)
      const safeSettings = { ...settings };
      delete (safeSettings as any).openaiApiKey;
      delete (safeSettings as any).geminiApiKey;
      delete (safeSettings as any).claudeApiKey;
      delete (safeSettings as any).assemblyaiApiKey;
      delete (safeSettings as any).elevenlabsApiKey;
      delete (safeSettings as any).mapboxApiKey;

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings: safeSettings,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      // Disable cloud sync if table doesn't exist
      if (error && (error.code === 'PGRST204' || error.message?.includes('406'))) {
        // Use debug-level - this is expected if table hasn't been created yet
        console.debug('[Settings Debug] Cloud sync disabled - table not available (expected during initial setup)');
        this.cloudSyncDisabled = true;
      }
    } catch (error: any) {
      if (error?.status === 406) {
        this.cloudSyncDisabled = true;
      } else {
        console.error('Error syncing settings to cloud:', error);
      }
    }
  }

  /**
   * Migrate from legacy localStorage keys
   */
  private async migrateFromLegacy(): Promise<PulseSettings> {
    const settings = { ...DEFAULT_SETTINGS };

    // Theme
    if (localStorage.theme) {
      settings.theme = localStorage.theme as 'light' | 'dark';
    }

    // Accent color
    const accentColor = localStorage.getItem('accentColor');
    if (accentColor) {
      settings.accentColor = accentColor;
    }

    const customColor = localStorage.getItem('customColor');
    if (customColor) {
      settings.customColor = customColor;
    }

    // API Keys
    settings.openaiApiKey = localStorage.getItem('openai_api_key') || '';
    settings.geminiApiKey = localStorage.getItem('gemini_api_key') || '';
    settings.claudeApiKey = localStorage.getItem('claude_api_key') || '';
    settings.assemblyaiApiKey = localStorage.getItem('assemblyai_api_key') || '';
    settings.elevenlabsApiKey = localStorage.getItem('elevenlabs_api_key') || '';
    settings.mapboxApiKey = localStorage.getItem('mapbox_api_key') || '';

    // Save migrated settings
    await this.saveAll(settings);

    console.log('[Settings] Migrated from legacy localStorage keys');
    return settings;
  }

  /**
   * Update legacy localStorage keys for backwards compatibility
   */
  private updateLegacyKey<K extends keyof PulseSettings>(key: K, value: PulseSettings[K]): void {
    const keyMap: Partial<Record<keyof PulseSettings, string>> = {
      theme: 'theme',
      accentColor: 'accentColor',
      customColor: 'customColor',
      openaiApiKey: 'openai_api_key',
      geminiApiKey: 'gemini_api_key',
      claudeApiKey: 'claude_api_key',
      assemblyaiApiKey: 'assemblyai_api_key',
      elevenlabsApiKey: 'elevenlabs_api_key',
      mapboxApiKey: 'mapbox_api_key',
    };

    const legacyKey = keyMap[key];
    if (legacyKey && value !== undefined && value !== null) {
      localStorage.setItem(legacyKey, String(value));

      // Special case for theme
      if (key === 'theme') {
        localStorage.theme = value;
      }
    }
  }

  /**
   * Clear cache (useful when switching users)
   */
  clearCache(): void {
    this.cache = null;
  }
}

export const settingsService = new SettingsService();
export default settingsService;
