// ============================================
// SETTINGS PANEL COMPONENT
// App configuration and preferences
// ============================================

import React, { useState } from 'react';

interface SettingsPanelProps {
  userId: string;
}

interface AppSettings {
  // General
  autoSync: boolean;
  syncInterval: number;
  darkMode: boolean;
  compactView: boolean;

  // Notifications
  enableNotifications: boolean;
  notificationSound: boolean;
  emailDigest: boolean;
  digestFrequency: 'daily' | 'weekly' | 'never';

  // Voice
  autoTranscribe: boolean;
  transcriptionProvider: 'gemini' | 'whisper' | 'aws';
  extractTasks: boolean;
  extractDecisions: boolean;

  // Privacy
  analyticsEnabled: boolean;
  crashReporting: boolean;
  shareUsageData: boolean;

  // API
  apiRateLimit: number;
  cacheEnabled: boolean;
  cacheDuration: number;
}

/**
 * SettingsPanel Component
 * Configure application settings and preferences
 */
const SettingsPanel: React.FC<SettingsPanelProps> = ({ userId }) => {
  const [settings, setSettings] = useState<AppSettings>({
    autoSync: true,
    syncInterval: 30,
    darkMode: true,
    compactView: false,
    enableNotifications: true,
    notificationSound: true,
    emailDigest: false,
    digestFrequency: 'weekly',
    autoTranscribe: true,
    transcriptionProvider: 'gemini',
    extractTasks: true,
    extractDecisions: true,
    analyticsEnabled: true,
    crashReporting: true,
    shareUsageData: false,
    apiRateLimit: 100,
    cacheEnabled: true,
    cacheDuration: 15,
  });

  const [saved, setSaved] = useState(false);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    // Save to localStorage or backend
    localStorage.setItem(`pulse_settings_${userId}`, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pulse-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      localStorage.removeItem(`pulse_settings_${userId}`);
      window.location.reload();
    }
  };

  const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
    <div
      className={`toggle-switch ${value ? 'active' : ''}`}
      onClick={() => onChange(!value)}
    />
  );

  return (
    <div className="settings-panel">
      {/* General Settings */}
      <div className="settings-section">
        <h3>⚙️ General</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>Auto Sync</span>
            <small>Automatically sync messages from connected platforms</small>
          </div>
          <Toggle
            value={settings.autoSync}
            onChange={(v) => updateSetting('autoSync', v)}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Sync Interval (minutes)</span>
            <small>How often to check for new messages</small>
          </div>
          <input
            type="number"
            className="settings-input"
            value={settings.syncInterval}
            onChange={(e) => updateSetting('syncInterval', parseInt(e.target.value) || 30)}
            min={5}
            max={120}
            style={{ width: '80px' }}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Dark Mode</span>
            <small>Use dark theme throughout the app</small>
          </div>
          <Toggle
            value={settings.darkMode}
            onChange={(v) => updateSetting('darkMode', v)}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Compact View</span>
            <small>Show more content with smaller UI elements</small>
          </div>
          <Toggle
            value={settings.compactView}
            onChange={(v) => updateSetting('compactView', v)}
          />
        </div>
      </div>

      {/* Notification Settings */}
      <div className="settings-section">
        <h3>🔔 Notifications</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>Enable Notifications</span>
            <small>Show in-app notifications</small>
          </div>
          <Toggle
            value={settings.enableNotifications}
            onChange={(v) => updateSetting('enableNotifications', v)}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Notification Sound</span>
            <small>Play sound for new notifications</small>
          </div>
          <Toggle
            value={settings.notificationSound}
            onChange={(v) => updateSetting('notificationSound', v)}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Email Digest</span>
            <small>Receive summary emails</small>
          </div>
          <Toggle
            value={settings.emailDigest}
            onChange={(v) => updateSetting('emailDigest', v)}
          />
        </div>

        {settings.emailDigest && (
          <div className="setting-row">
            <div className="setting-label">
              <span>Digest Frequency</span>
              <small>How often to receive email summaries</small>
            </div>
            <select
              className="settings-input"
              value={settings.digestFrequency}
              onChange={(e) => updateSetting('digestFrequency', e.target.value as any)}
              style={{ width: '120px' }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="never">Never</option>
            </select>
          </div>
        )}
      </div>

      {/* Voice Settings */}
      <div className="settings-section">
        <h3>🎤 Voice & Transcription</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>Auto Transcribe</span>
            <small>Automatically transcribe voice messages</small>
          </div>
          <Toggle
            value={settings.autoTranscribe}
            onChange={(v) => updateSetting('autoTranscribe', v)}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Transcription Provider</span>
            <small>Service to use for voice transcription</small>
          </div>
          <select
            className="settings-input"
            value={settings.transcriptionProvider}
            onChange={(e) => updateSetting('transcriptionProvider', e.target.value as any)}
            style={{ width: '120px' }}
          >
            <option value="gemini">Gemini</option>
            <option value="whisper">Whisper</option>
            <option value="aws">AWS Transcribe</option>
          </select>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Extract Tasks</span>
            <small>Automatically extract tasks from transcriptions</small>
          </div>
          <Toggle
            value={settings.extractTasks}
            onChange={(v) => updateSetting('extractTasks', v)}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Extract Decisions</span>
            <small>Automatically extract decisions from transcriptions</small>
          </div>
          <Toggle
            value={settings.extractDecisions}
            onChange={(v) => updateSetting('extractDecisions', v)}
          />
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="settings-section">
        <h3>🔒 Privacy</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>Analytics</span>
            <small>Help improve Pulse by sharing anonymous usage data</small>
          </div>
          <Toggle
            value={settings.analyticsEnabled}
            onChange={(v) => updateSetting('analyticsEnabled', v)}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Crash Reporting</span>
            <small>Automatically report crashes to help fix bugs</small>
          </div>
          <Toggle
            value={settings.crashReporting}
            onChange={(v) => updateSetting('crashReporting', v)}
          />
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="settings-section">
        <h3>🔧 Advanced</h3>

        <div className="setting-row">
          <div className="setting-label">
            <span>API Rate Limit</span>
            <small>Max requests per minute</small>
          </div>
          <input
            type="number"
            className="settings-input"
            value={settings.apiRateLimit}
            onChange={(e) => updateSetting('apiRateLimit', parseInt(e.target.value) || 100)}
            min={10}
            max={500}
            style={{ width: '80px' }}
          />
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span>Enable Cache</span>
            <small>Cache API responses for faster loading</small>
          </div>
          <Toggle
            value={settings.cacheEnabled}
            onChange={(v) => updateSetting('cacheEnabled', v)}
          />
        </div>

        {settings.cacheEnabled && (
          <div className="setting-row">
            <div className="setting-label">
              <span>Cache Duration (minutes)</span>
              <small>How long to keep cached data</small>
            </div>
            <input
              type="number"
              className="settings-input"
              value={settings.cacheDuration}
              onChange={(e) => updateSetting('cacheDuration', parseInt(e.target.value) || 15)}
              min={1}
              max={60}
              style={{ width: '80px' }}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        <button className="btn-primary" onClick={handleSave}>
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
        <button className="btn-secondary" onClick={handleExportSettings}>
          Export Settings
        </button>
        <button
          className="btn-secondary"
          onClick={handleResetSettings}
          style={{ borderColor: '#ef4444', color: '#ef4444' }}
        >
          Reset to Defaults
        </button>
      </div>

      {/* User Info */}
      <div className="settings-section" style={{ marginTop: '24px' }}>
        <h3>👤 Account</h3>
        <div className="setting-row">
          <div className="setting-label">
            <span>User ID</span>
            <small>Your unique identifier</small>
          </div>
          <code style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            {userId}
          </code>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
