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

  // Voxer Audio Settings
  voxMicrophoneDeviceId: string;
  voxSpeakerDeviceId: string;
  voxAudioQuality: 'voice_hd' | 'voice_balanced' | 'voice_low';
  voxNoiseReduction: boolean;
  voxAutoGainControl: boolean;
  voxEchoCancellation: boolean;

  // Voxer Video Settings
  voxCameraDeviceId: string;
  voxVideoQuality: '480p' | '720p' | '1080p';
  voxVideoPreviewEnabled: boolean;
  voxVideoMirror: boolean;

  // Voxer Storage Settings
  voxDownloadFolder: string;
  voxAutoDownload: boolean;
  voxKeepRecordingsDays: number;

  // Voxer General Settings
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

  // Email (Phase 4)
  emailNotificationBundling: boolean;
  emailAutoArchiveDays: number;
  emailDriveQuickAttach: boolean;

  // API Keys (encrypted/hashed in sync)
  openaiApiKey: string;
  claudeApiKey: string;
  assemblyaiApiKey: string;
  elevenlabsApiKey: string;
  perplexityApiKey: string;
  mapboxApiKey: string;

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

  // Voxer Audio Settings
  voxMicrophoneDeviceId: '',
  voxSpeakerDeviceId: '',
  voxAudioQuality: 'voice_hd',
  voxNoiseReduction: false,
  voxAutoGainControl: false,
  voxEchoCancellation: true,

  // Voxer Video Settings
  voxCameraDeviceId: '',
  voxVideoQuality: '720p',
  voxVideoPreviewEnabled: true,
  voxVideoMirror: true,

  // Voxer Storage Settings
  voxDownloadFolder: '',
  voxAutoDownload: false,
  voxKeepRecordingsDays: 30,

  // Voxer General Settings
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

  // Email (Phase 4)
  emailNotificationBundling: true,
  emailAutoArchiveDays: 0,
  emailDriveQuickAttach: true,

  // API Keys
  openaiApiKey: '',
  claudeApiKey: '',
  assemblyaiApiKey: '',
  elevenlabsApiKey: '',
  perplexityApiKey: '',
  mapboxApiKey: '',

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
        .single();

      // If table doesn't exist (406) or schema error, disable cloud sync
      if (error) {
        if (error.code === 'PGRST204' || error.code === 'PGRST116' || error.message?.includes('406')) {
          console.warn('[Settings] Cloud sync disabled - user_settings table not available');
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
      // Disable cloud sync on 406 errors to prevent spam
      if (error?.status === 406 || error?.code === 'PGRST204') {
        console.warn('[Settings] Cloud sync disabled - table schema mismatch');
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
      delete (safeSettings as any).claudeApiKey;
      delete (safeSettings as any).assemblyaiApiKey;
      delete (safeSettings as any).elevenlabsApiKey;
      delete (safeSettings as any).perplexityApiKey;
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
        console.warn('[Settings] Cloud sync disabled - table not available');
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
    settings.claudeApiKey = localStorage.getItem('claude_api_key') || '';
    settings.assemblyaiApiKey = localStorage.getItem('assemblyai_api_key') || '';
    settings.elevenlabsApiKey = localStorage.getItem('elevenlabs_api_key') || '';
    settings.perplexityApiKey = localStorage.getItem('perplexity_api_key') || '';
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
      claudeApiKey: 'claude_api_key',
      assemblyaiApiKey: 'assemblyai_api_key',
      elevenlabsApiKey: 'elevenlabs_api_key',
      perplexityApiKey: 'perplexity_api_key',
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
