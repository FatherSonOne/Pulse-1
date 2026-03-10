// AccountSettingsModal.tsx - Pulse-specific account preferences
import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';
import toast from 'react-hot-toast';

import { Bell, Loader2, Palette, Settings, Sliders, User, X } from 'lucide-react';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  userName,
  userEmail,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'notifications' | 'appearance'>('profile');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile settings
  const [displayName, setDisplayName] = useState(userName);
  const [timezone, setTimezone] = useState('America/New_York');
  const [language, setLanguage] = useState('en');

  // Preferences
  const [emailSignature, setEmailSignature] = useState('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState(true);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);
  const [autoPlayVoice, setAutoPlayVoice] = useState(false);

  // Notifications
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [messagePreview, setMessagePreview] = useState(true);
  const [notificationSound, setNotificationSound] = useState('default');

  // Appearance
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [accentColor, setAccentColor] = useState('rose');
  const [compactMode, setCompactMode] = useState(false);
  const [fontSize, setFontSize] = useState('medium');

  useEffect(() => {
    if (!isOpen) return;
    loadSettings();
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [
        themeValue,
        accentValue,
        compactValue,
        fontSizeValue,
        autoSaveValue,
        keyboardShortcutsValue,
        soundEffectsValue,
        autoPlayVoiceValue,
        desktopNotifValue,
        emailNotifValue,
        messagePreviewValue,
        notificationSoundValue,
        timezoneValue,
        languageValue,
        emailSignatureValue,
      ] = await Promise.all([
        settingsService.get('theme'),
        settingsService.get('accentColor'),
        settingsService.get('compactMode'),
        settingsService.get('fontSize'),
        settingsService.get('autoSaveEnabled'),
        settingsService.get('keyboardShortcutsEnabled'),
        settingsService.get('soundEffectsEnabled'),
        settingsService.get('autoPlayVoice'),
        settingsService.get('desktopNotifications'),
        settingsService.get('emailNotifications'),
        settingsService.get('messagePreview'),
        settingsService.get('notificationSound'),
        settingsService.get('timezone'),
        settingsService.get('language'),
        settingsService.get('emailSignature'),
      ]);

      setTheme(themeValue || 'system');
      setAccentColor(accentValue || 'rose');
      setCompactMode(compactValue ?? false);
      setFontSize(fontSizeValue || 'medium');
      setAutoSaveEnabled(autoSaveValue ?? true);
      setKeyboardShortcutsEnabled(keyboardShortcutsValue ?? true);
      setSoundEffectsEnabled(soundEffectsValue ?? true);
      setAutoPlayVoice(autoPlayVoiceValue ?? false);
      setDesktopNotifications(desktopNotifValue ?? true);
      setEmailNotifications(emailNotifValue ?? true);
      setMessagePreview(messagePreviewValue ?? true);
      setNotificationSound(notificationSoundValue || 'default');
      setTimezone(timezoneValue || 'America/New_York');
      setLanguage(languageValue || 'en');
      setEmailSignature(emailSignatureValue || '');
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSetting = async <T,>(key: string, value: T, setter: (val: T) => void) => {
    setter(value);
    setSaving(true);
    try {
      await settingsService.set(key as any, value as any);
      toast.success('Setting saved');
    } catch (error) {
      console.error('Error saving setting:', error);
      toast.error('Failed to save setting');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-end z-[9999] animate-fadeIn p-0">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl h-screen rounded-l-2xl shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 overflow-hidden animate-slideInFromRight">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-rose-500/10 to-pink-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
              <Settings className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Account Settings</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition"
            title="Close"
          >
            <X />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-x-auto scrollbar-thin">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap flex-shrink-0 ${
              activeTab === 'profile'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <User className="text-xs" />
            <span>Profile</span>
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap flex-shrink-0 ${
              activeTab === 'preferences'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="text-xs" />
            <span>Preferences</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap flex-shrink-0 ${
              activeTab === 'notifications'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Bell className="text-xs" />
            <span>Notifications</span>
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap flex-shrink-0 ${
              activeTab === 'appearance'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Palette className="text-xs" />
            <span>Appearance</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="text-3xl text-rose-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Profile Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          onBlur={() => handleSaveSetting('displayName', displayName, setDisplayName)}
                          className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                          placeholder="Your display name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={userEmail}
                          disabled
                          className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          Email address is managed by your Google Account
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Timezone
                        </label>
                        <select
                          value={timezone}
                          onChange={(e) => handleSaveSetting('timezone', e.target.value, setTimezone)}
                          className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                        >
                          <option value="America/New_York">Eastern Time (ET)</option>
                          <option value="America/Chicago">Central Time (CT)</option>
                          <option value="America/Denver">Mountain Time (MT)</option>
                          <option value="America/Los_Angeles">Pacific Time (PT)</option>
                          <option value="Europe/London">London (GMT)</option>
                          <option value="Europe/Paris">Paris (CET)</option>
                          <option value="Asia/Tokyo">Tokyo (JST)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Language
                        </label>
                        <select
                          value={language}
                          onChange={(e) => handleSaveSetting('language', e.target.value, setLanguage)}
                          className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                        >
                          <option value="en">English</option>
                          <option value="es">Español</option>
                          <option value="fr">Français</option>
                          <option value="de">Deutsch</option>
                          <option value="ja">日本語</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Email Signature
                        </label>
                        <textarea
                          value={emailSignature}
                          onChange={(e) => setEmailSignature(e.target.value)}
                          onBlur={() => handleSaveSetting('emailSignature', emailSignature, setEmailSignature)}
                          rows={4}
                          className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                          placeholder="Best regards,&#10;Your Name"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">General Preferences</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-white">Auto-save</div>
                          <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            Automatically save drafts and unsent messages
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveSetting('autoSaveEnabled', !autoSaveEnabled, setAutoSaveEnabled)}
                          className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                            autoSaveEnabled ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`inline-block w-5 h-5 bg-white rounded-full transform transition ${
                              autoSaveEnabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-white">Keyboard Shortcuts</div>
                          <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            Enable keyboard shortcuts for faster navigation
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveSetting('keyboardShortcutsEnabled', !keyboardShortcutsEnabled, setKeyboardShortcutsEnabled)}
                          className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                            keyboardShortcutsEnabled ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`inline-block w-5 h-5 bg-white rounded-full transform transition ${
                              keyboardShortcutsEnabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-white">Sound Effects</div>
                          <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            Play sounds for button clicks and actions
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveSetting('soundEffectsEnabled', !soundEffectsEnabled, setSoundEffectsEnabled)}
                          className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                            soundEffectsEnabled ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`inline-block w-5 h-5 bg-white rounded-full transform transition ${
                              soundEffectsEnabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-white">Auto-play Voice Messages</div>
                          <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            Automatically play voice messages when opened
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveSetting('autoPlayVoice', !autoPlayVoice, setAutoPlayVoice)}
                          className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                            autoPlayVoice ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`inline-block w-5 h-5 bg-white rounded-full transform transition ${
                              autoPlayVoice ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Notification Preferences</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-white">Desktop Notifications</div>
                          <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            Show notifications on your desktop
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveSetting('desktopNotifications', !desktopNotifications, setDesktopNotifications)}
                          className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                            desktopNotifications ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`inline-block w-5 h-5 bg-white rounded-full transform transition ${
                              desktopNotifications ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-white">Email Notifications</div>
                          <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            Receive email notifications for important updates
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveSetting('emailNotifications', !emailNotifications, setEmailNotifications)}
                          className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                            emailNotifications ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`inline-block w-5 h-5 bg-white rounded-full transform transition ${
                              emailNotifications ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-white">Message Preview</div>
                          <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            Show message content in notifications
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveSetting('messagePreview', !messagePreview, setMessagePreview)}
                          className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                            messagePreview ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`inline-block w-5 h-5 bg-white rounded-full transform transition ${
                              messagePreview ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Notification Sound
                        </label>
                        <select
                          value={notificationSound}
                          onChange={(e) => handleSaveSetting('notificationSound', e.target.value, setNotificationSound)}
                          className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                        >
                          <option value="default">Default</option>
                          <option value="chime">Chime</option>
                          <option value="bell">Bell</option>
                          <option value="pop">Pop</option>
                          <option value="none">Silent</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Appearance Settings</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Theme
                        </label>
                        <select
                          value={theme}
                          onChange={(e) => handleSaveSetting('theme', e.target.value as typeof theme, setTheme)}
                          className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="system">System</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Accent Color
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                          {['rose', 'blue', 'green', 'purple', 'amber'].map((color) => (
                            <button
                              key={color}
                              onClick={() => handleSaveSetting('accentColor', color, setAccentColor)}
                              className={`h-12 rounded-lg border-2 transition ${
                                accentColor === color
                                  ? 'border-zinc-900 dark:border-white scale-105'
                                  : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'
                              } bg-${color}-500`}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Font Size
                        </label>
                        <select
                          value={fontSize}
                          onChange={(e) => handleSaveSetting('fontSize', e.target.value, setFontSize)}
                          className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-white">Compact Mode</div>
                          <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            Reduce spacing for a more compact interface
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveSetting('compactMode', !compactMode, setCompactMode)}
                          className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                            compactMode ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`inline-block w-5 h-5 bg-white rounded-full transform transition ${
                              compactMode ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
          >
            Close
          </button>
          {saving && (
            <div className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <Loader2 className="animate-spin" />
              Saving...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsModal;
