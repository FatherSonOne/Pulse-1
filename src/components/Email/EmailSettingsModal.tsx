// EmailSettingsModal.tsx - Email settings modal with Gmail settings access
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { getGmailService } from '../../services/gmailService';
import { settingsService } from '../../services/settingsService';
import { vacationResponderService, VacationResponderConfig } from '../../services/vacationResponderService';
import { blockedSendersService, BlockedSender } from '../../services/blockedSendersService';
import { notificationRuleService, NotificationRule } from '../../services/notificationRuleService';
import { emailAccountsService, EmailAccount, EmailAccountInput } from '../../services/emailAccountsService';

interface EmailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export const EmailSettingsModal: React.FC<EmailSettingsModalProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  type NotificationRuleDraft = Omit<NotificationRule, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string };
  const [activeTab, setActiveTab] = useState<'general' | 'gmail' | 'sync' | 'automation' | 'accounts'>('general');
  const [gmailProfile, setGmailProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [accentColor, setAccentColor] = useState('rose');
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [notificationBundling, setNotificationBundling] = useState(true);
  const [autoArchiveDays, setAutoArchiveDays] = useState(0);
  const [driveQuickAttach, setDriveQuickAttach] = useState(true);

  // Accounts
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState<EmailAccountInput>({
    provider: 'google',
    email_address: '',
    display_name: '',
    is_primary: false,
    sync_enabled: true,
    integration_id: null,
  });

  // Automation settings
  const [vacationConfig, setVacationConfig] = useState<VacationResponderConfig | null>(null);
  const [vacationEnabled, setVacationEnabled] = useState(false);
  const [vacationStart, setVacationStart] = useState('');
  const [vacationEnd, setVacationEnd] = useState('');
  const [vacationSubject, setVacationSubject] = useState('Out of office');
  const [vacationMessage, setVacationMessage] = useState('Thanks for your email. I am currently out of office and will respond when I return.');
  const [vacationOnlyContacts, setVacationOnlyContacts] = useState(false);
  const [vacationOnlyFirst, setVacationOnlyFirst] = useState(true);
  const [vacationSaving, setVacationSaving] = useState(false);

  const [blockedSenders, setBlockedSenders] = useState<BlockedSender[]>([]);
  const [blockedInput, setBlockedInput] = useState('');
  const [blockedReason, setBlockedReason] = useState('');
  const [blockedAutoDelete, setBlockedAutoDelete] = useState(false);
  const [blockedSaving, setBlockedSaving] = useState(false);

  const [notificationRule, setNotificationRule] = useState<NotificationRuleDraft | null>(null);
  const [notificationSaving, setNotificationSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'gmail') {
      loadGmailProfile();
    }
    if (activeTab === 'automation') {
      loadAutomationSettings();
    }
    if (activeTab === 'accounts') {
      loadAccounts();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    loadGeneralSettings();
  }, [isOpen]);

  const loadGmailProfile = async () => {
    setLoading(true);
    try {
      const gmail = getGmailService();
      // Get user profile from Gmail API
      const profile = await (gmail as any).gmailRequest?.('users/me/profile') || null;
      setGmailProfile(profile);
    } catch (error) {
      console.error('Error loading Gmail profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const openGmailSettings = () => {
    window.open('https://mail.google.com/mail/u/0/#settings', '_blank');
  };

  const openGmailFilters = () => {
    window.open('https://mail.google.com/mail/u/0/#settings/filters', '_blank');
  };

  const openGmailForwarding = () => {
    window.open('https://mail.google.com/mail/u/0/#settings/fwdandpop', '_blank');
  };

  const openGmailLabels = () => {
    window.open('https://mail.google.com/mail/u/0/#settings/labels', '_blank');
  };

  const openGmailSignature = () => {
    window.open('https://mail.google.com/mail/u/0/#settings/general', '_blank');
  };

  const loadGeneralSettings = async () => {
    try {
      const [
        aiEnabled,
        themeValue,
        accentValue,
        customColorValue,
        bundlingValue,
        autoArchiveValue,
        driveAttachValue,
      ] = await Promise.all([
        settingsService.get('aiSuggestionsEnabled'),
        settingsService.get('theme'),
        settingsService.get('accentColor'),
        settingsService.get('customColor'),
        settingsService.get('emailNotificationBundling'),
        settingsService.get('emailAutoArchiveDays'),
        settingsService.get('emailDriveQuickAttach'),
      ]);
      setAiSuggestionsEnabled(aiEnabled);
      setTheme(themeValue);
      setAccentColor(accentValue);
      setCustomColor(customColorValue);
      setNotificationBundling(bundlingValue);
      setAutoArchiveDays(autoArchiveValue);
      setDriveQuickAttach(driveAttachValue);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleToggleAiSuggestions = async () => {
    const next = !aiSuggestionsEnabled;
    setAiSuggestionsEnabled(next);
    setSavingSettings(true);
    try {
      await settingsService.set('aiSuggestionsEnabled', next);
    } catch (error) {
      console.error('Error saving AI settings:', error);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSettingUpdate = async <T,>(
    value: T,
    setter: (next: T) => void,
    key: Parameters<typeof settingsService.set>[0],
  ) => {
    setter(value);
    setSavingSettings(true);
    try {
      await settingsService.set(key, value as any);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSavingSettings(false);
    }
  };

  const loadAccounts = async () => {
    setAccountsLoading(true);
    setAccountError(null);
    try {
      const data = await emailAccountsService.list();
      setEmailAccounts(data);
    } catch (error) {
      console.error('Error loading email accounts:', error);
      setAccountError('Unable to load accounts.');
    } finally {
      setAccountsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccount.email_address.trim()) {
      setAccountError('Please enter an email address.');
      return;
    }
    setAccountsLoading(true);
    setAccountError(null);
    try {
      await emailAccountsService.create(newAccount);
      setNewAccount({
        provider: 'google',
        email_address: '',
        display_name: '',
        is_primary: false,
        sync_enabled: true,
        integration_id: null,
      });
      await loadAccounts();
    } catch (error) {
      console.error('Error creating account:', error);
      setAccountError('Unable to add account.');
    } finally {
      setAccountsLoading(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    setAccountsLoading(true);
    setAccountError(null);
    try {
      await emailAccountsService.delete(id);
      await loadAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      setAccountError('Unable to remove account.');
    } finally {
      setAccountsLoading(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    setAccountsLoading(true);
    setAccountError(null);
    try {
      await emailAccountsService.setPrimary(id);
      await loadAccounts();
    } catch (error) {
      console.error('Error setting primary account:', error);
      setAccountError('Unable to set primary account.');
    } finally {
      setAccountsLoading(false);
    }
  };

  const handleToggleSync = async (id: string, enabled: boolean) => {
    setAccountsLoading(true);
    setAccountError(null);
    try {
      await emailAccountsService.setSyncEnabled(id, enabled);
      await loadAccounts();
    } catch (error) {
      console.error('Error updating sync settings:', error);
      setAccountError('Unable to update sync.');
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadAutomationSettings = async () => {
    try {
      const [vacation, blocked, rules] = await Promise.all([
        vacationResponderService.getConfig(),
        blockedSendersService.list(),
        notificationRuleService.getRules(),
      ]);

      if (vacation) {
        setVacationConfig(vacation);
        setVacationEnabled(vacation.enabled);
        setVacationStart(vacation.start_date);
        setVacationEnd(vacation.end_date);
        setVacationSubject(vacation.subject);
        setVacationMessage(vacation.message_text);
        setVacationOnlyContacts(vacation.only_contacts);
        setVacationOnlyFirst(vacation.only_first_email);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        setVacationStart(today);
        setVacationEnd(today);
      }

      setBlockedSenders(blocked);
      if (rules[0]) {
        setNotificationRule(rules[0]);
      } else {
        setNotificationRule({
          name: 'Email Alerts',
          enabled: true,
          conditions: [],
          notify_desktop: true,
          notify_mobile: true,
          notify_email: false,
          notify_sound: null,
          respect_quiet_hours: false,
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00',
          priority: 'normal',
        });
      }
    } catch (error) {
      console.error('Error loading automation settings:', error);
    }
  };

  const handleSaveVacation = async () => {
    if (!vacationStart || !vacationEnd) return;
    setVacationSaving(true);
    try {
      const saved = await vacationResponderService.saveConfig({
        enabled: vacationEnabled,
        start_date: vacationStart,
        end_date: vacationEnd,
        subject: vacationSubject,
        message_text: vacationMessage,
        message_html: vacationMessage.replace(/\n/g, '<br />'),
        only_contacts: vacationOnlyContacts,
        only_first_email: vacationOnlyFirst,
      });
      setVacationConfig(saved);
    } catch (error) {
      console.error('Error saving vacation responder:', error);
    } finally {
      setVacationSaving(false);
    }
  };

  const handleBlockSender = async () => {
    if (!blockedInput.trim()) return;
    setBlockedSaving(true);
    try {
      const value = blockedInput.trim().toLowerCase();
      if (value.includes('@')) {
        await blockedSendersService.blockEmail(value, {
          reason: blockedReason || undefined,
          autoDelete: blockedAutoDelete,
        });
      } else {
        await blockedSendersService.blockDomain(value, {
          reason: blockedReason || undefined,
          autoDelete: blockedAutoDelete,
        });
      }
      const updated = await blockedSendersService.list();
      setBlockedSenders(updated);
      setBlockedInput('');
      setBlockedReason('');
      setBlockedAutoDelete(false);
    } catch (error) {
      console.error('Error blocking sender:', error);
    } finally {
      setBlockedSaving(false);
    }
  };

  const handleUnblockSender = async (id: string) => {
    try {
      await blockedSendersService.unblock(id);
      const updated = await blockedSendersService.list();
      setBlockedSenders(updated);
    } catch (error) {
      console.error('Error unblocking sender:', error);
    }
  };

  const handleSaveNotificationRule = async () => {
    if (!notificationRule) {
      return;
    }
    setNotificationSaving(true);
    try {
      const rulePayload = {
        name: notificationRule.name,
        enabled: notificationRule.enabled,
        conditions: notificationRule.conditions || [],
        notify_desktop: notificationRule.notify_desktop,
        notify_mobile: notificationRule.notify_mobile,
        notify_email: notificationRule.notify_email,
        notify_sound: notificationRule.notify_sound || null,
        respect_quiet_hours: notificationRule.respect_quiet_hours,
        quiet_hours_start: notificationRule.quiet_hours_start || null,
        quiet_hours_end: notificationRule.quiet_hours_end || null,
        priority: notificationRule.priority,
      };

      if (notificationRule.id) {
        const updated = await notificationRuleService.updateRule(notificationRule.id, rulePayload);
        setNotificationRule(updated);
      } else {
        const created = await notificationRuleService.createRule(rulePayload);
        setNotificationRule(created);
      }
    } catch (error) {
      console.error('Error saving notification rule:', error);
    } finally {
      setNotificationSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col animate-scaleIn border border-stone-200 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-zinc-800 bg-gradient-to-r from-rose-500/10 to-orange-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
              <i className="fa-solid fa-gear text-white"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-white">Email Settings</h2>
              <p className="text-sm text-stone-500 dark:text-zinc-400">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-white transition"
            title="Close"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'general'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <i className="fa-solid fa-sliders-h mr-2"></i>
            General
          </button>
          <button
            onClick={() => setActiveTab('gmail')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'gmail'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <i className="fa-brands fa-google mr-2"></i>
            Gmail Settings
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'sync'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <i className="fa-solid fa-arrows-rotate mr-2"></i>
            Sync
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'accounts'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <i className="fa-solid fa-user-circle mr-2"></i>
            Accounts
          </button>
          <button
            onClick={() => setActiveTab('automation')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'automation'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <i className="fa-solid fa-bolt mr-2"></i>
            Automation
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">General Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                    <div>
                      <div className="font-medium text-stone-900 dark:text-white">Auto-sync</div>
                      <div className="text-sm text-stone-500 dark:text-zinc-400">Automatically sync emails in the background</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-stone-300 dark:bg-zinc-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                    <div>
                      <div className="font-medium text-stone-900 dark:text-white">Email Notifications</div>
                      <div className="text-sm text-stone-500 dark:text-zinc-400">Get notified of new emails</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-stone-300 dark:bg-zinc-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                    </label>
                  </div>

                  <div className="p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                    <div className="font-medium text-stone-900 dark:text-white mb-2">Sync Frequency</div>
                    <select className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-stone-900 dark:text-white text-sm focus:outline-none focus:border-rose-500">
                      <option>Every 5 minutes</option>
                      <option>Every 15 minutes</option>
                      <option>Every 30 minutes</option>
                      <option>Every hour</option>
                      <option>Manual only</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Appearance</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                    <div className="font-medium text-stone-900 dark:text-white mb-2">Theme</div>
                    <select
                      value={theme}
                      onChange={(e) => handleSettingUpdate(e.target.value as typeof theme, setTheme, 'theme')}
                      disabled={savingSettings}
                      className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-stone-900 dark:text-white text-sm focus:outline-none focus:border-rose-500"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                  <div className="p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                    <div className="font-medium text-stone-900 dark:text-white mb-2">Accent Color</div>
                    <select
                      value={accentColor}
                      onChange={(e) => handleSettingUpdate(e.target.value, setAccentColor, 'accentColor')}
                      disabled={savingSettings}
                      className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-stone-900 dark:text-white text-sm focus:outline-none focus:border-rose-500"
                    >
                      <option value="rose">Rose</option>
                      <option value="indigo">Indigo</option>
                      <option value="emerald">Emerald</option>
                      <option value="amber">Amber</option>
                      <option value="sky">Sky</option>
                    </select>
                  </div>
                  <div className="p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                    <div className="font-medium text-stone-900 dark:text-white mb-2">Custom Accent</div>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={customColor || '#f43f5e'}
                        onChange={(e) => handleSettingUpdate(e.target.value, (value) => setCustomColor(value), 'customColor')}
                        className="h-10 w-14 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                      />
                      <button
                        onClick={() => handleSettingUpdate(null, setCustomColor, 'customColor')}
                        disabled={savingSettings}
                        className="px-3 py-2 rounded-lg text-sm bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-zinc-200 hover:bg-stone-300 dark:hover:bg-zinc-700 transition"
                      >
                        Reset
                      </button>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-zinc-500 mt-2">Overrides the default accent color.</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">AI Writing</h3>
                <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                  <div>
                    <div className="font-medium text-stone-900 dark:text-white">Smart Compose</div>
                    <div className="text-sm text-stone-500 dark:text-zinc-400">AI inline suggestions while typing</div>
                  </div>
                  <button
                    onClick={handleToggleAiSuggestions}
                    disabled={savingSettings}
                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                      aiSuggestionsEnabled ? 'bg-rose-500' : 'bg-stone-300 dark:bg-zinc-700'
                    }`}
                    aria-label="Toggle smart compose"
                  >
                    <span
                      className={`inline-block w-5 h-5 bg-white rounded-full transform transition ${
                        aiSuggestionsEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Inbox Optimization</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                    <div>
                      <div className="font-medium text-stone-900 dark:text-white">Notification Bundling</div>
                      <div className="text-sm text-stone-500 dark:text-zinc-400">Group multiple notifications into a single digest</div>
                    </div>
                    <button
                      onClick={() => handleSettingUpdate(!notificationBundling, setNotificationBundling, 'emailNotificationBundling')}
                      disabled={savingSettings}
                      className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                        notificationBundling ? 'bg-rose-500' : 'bg-stone-300 dark:bg-zinc-700'
                      }`}
                      aria-label="Toggle notification bundling"
                    >
                      <span className={`inline-block w-5 h-5 transform bg-white rounded-full transition ${
                        notificationBundling ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  <div className="p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                    <div className="font-medium text-stone-900 dark:text-white mb-2">Auto-Archive</div>
                    <select
                      value={autoArchiveDays}
                      onChange={(e) => handleSettingUpdate(Number(e.target.value), setAutoArchiveDays, 'emailAutoArchiveDays')}
                      disabled={savingSettings}
                      className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-stone-900 dark:text-white text-sm focus:outline-none focus:border-rose-500"
                    >
                      <option value={0}>Disabled</option>
                      <option value={7}>After 7 days</option>
                      <option value={14}>After 14 days</option>
                      <option value={30}>After 30 days</option>
                    </select>
                    <p className="text-xs text-stone-500 dark:text-zinc-500 mt-2">Applies to emails you’ve already read.</p>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                    <div>
                      <div className="font-medium text-stone-900 dark:text-white">Drive Quick Attach</div>
                      <div className="text-sm text-stone-500 dark:text-zinc-400">Show Drive shortcuts inside the composer</div>
                    </div>
                    <button
                      onClick={() => handleSettingUpdate(!driveQuickAttach, setDriveQuickAttach, 'emailDriveQuickAttach')}
                      disabled={savingSettings}
                      className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                        driveQuickAttach ? 'bg-rose-500' : 'bg-stone-300 dark:bg-zinc-700'
                      }`}
                      aria-label="Toggle Drive quick attach"
                    >
                      <span className={`inline-block w-5 h-5 transform bg-white rounded-full transition ${
                        driveQuickAttach ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gmail' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Gmail Settings</h3>
                <p className="text-sm text-stone-500 dark:text-zinc-400 mb-6">
                  Manage your Gmail settings directly from Gmail. Click any option below to open it in a new tab.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={openGmailSettings}
                    className="flex items-start gap-4 p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800 hover:border-rose-500/50 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition">
                      <i className="fa-solid fa-gear text-white"></i>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-stone-900 dark:text-white mb-1">General Settings</div>
                      <div className="text-xs text-stone-500 dark:text-zinc-400">Account, signature, and preferences</div>
                    </div>
                    <i className="fa-solid fa-external-link text-stone-400 ml-auto mt-1"></i>
                  </button>

                  <button
                    onClick={openGmailFilters}
                    className="flex items-start gap-4 p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800 hover:border-rose-500/50 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition">
                      <i className="fa-solid fa-filter text-white"></i>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-stone-900 dark:text-white mb-1">Filters & Blocked Addresses</div>
                      <div className="text-xs text-stone-500 dark:text-zinc-400">Manage email filters and blocked senders</div>
                    </div>
                    <i className="fa-solid fa-external-link text-stone-400 ml-auto mt-1"></i>
                  </button>

                  <button
                    onClick={openGmailForwarding}
                    className="flex items-start gap-4 p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800 hover:border-rose-500/50 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition">
                      <i className="fa-solid fa-forward text-white"></i>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-stone-900 dark:text-white mb-1">Forwarding & POP/IMAP</div>
                      <div className="text-xs text-stone-500 dark:text-zinc-400">Email forwarding and access settings</div>
                    </div>
                    <i className="fa-solid fa-external-link text-stone-400 ml-auto mt-1"></i>
                  </button>

                  <button
                    onClick={openGmailLabels}
                    className="flex items-start gap-4 p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800 hover:border-rose-500/50 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition">
                      <i className="fa-solid fa-tags text-white"></i>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-stone-900 dark:text-white mb-1">Labels</div>
                      <div className="text-xs text-stone-500 dark:text-zinc-400">Create and manage email labels</div>
                    </div>
                    <i className="fa-solid fa-external-link text-stone-400 ml-auto mt-1"></i>
                  </button>

                  <button
                    onClick={openGmailSignature}
                    className="flex items-start gap-4 p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800 hover:border-rose-500/50 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition">
                      <i className="fa-solid fa-pen text-white"></i>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-stone-900 dark:text-white mb-1">Signature</div>
                      <div className="text-xs text-stone-500 dark:text-zinc-400">Edit your email signature</div>
                    </div>
                    <i className="fa-solid fa-external-link text-stone-400 ml-auto mt-1"></i>
                  </button>

                  <button
                    onClick={openGmailSettings}
                    className="flex items-start gap-4 p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800 hover:border-rose-500/50 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition">
                      <i className="fa-solid fa-list text-white"></i>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-stone-900 dark:text-white mb-1">All Settings</div>
                      <div className="text-xs text-stone-500 dark:text-zinc-400">View all Gmail settings</div>
                    </div>
                    <i className="fa-solid fa-external-link text-stone-400 ml-auto mt-1"></i>
                  </button>
                </div>

                {gmailProfile && (
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3 mb-2">
                      <i className="fa-solid fa-info-circle text-blue-500"></i>
                      <span className="font-medium text-blue-900 dark:text-blue-100">Gmail Account Info</span>
                    </div>
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <div>Email Address: {gmailProfile.emailAddress}</div>
                      {gmailProfile.messagesTotal && (
                        <div>Total Messages: {gmailProfile.messagesTotal.toLocaleString()}</div>
                      )}
                      {gmailProfile.threadsTotal && (
                        <div>Total Threads: {gmailProfile.threadsTotal.toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Sync Settings</h3>
                
                <div className="space-y-4">
                  <div className="p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                    <div className="font-medium text-stone-900 dark:text-white mb-2">Last Sync</div>
                    <div className="text-sm text-stone-500 dark:text-zinc-400">Never synced</div>
                  </div>

                  <div className="p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                    <div className="font-medium text-stone-900 dark:text-white mb-2">Sync Status</div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-sm text-stone-600 dark:text-zinc-400">Connected to Gmail</span>
                    </div>
                  </div>

                  <button className="w-full px-4 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-medium rounded-lg transition">
                    <i className="fa-solid fa-arrows-rotate mr-2"></i>
                    Sync Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Connected Accounts</h3>
                {accountError && (
                  <div className="mb-3 text-sm text-red-600 dark:text-red-400">{accountError}</div>
                )}
                {accountsLoading ? (
                  <div className="text-sm text-stone-500 dark:text-zinc-400">Loading accounts...</div>
                ) : (
                  <div className="space-y-3">
                    {emailAccounts.length === 0 && (
                      <div className="text-sm text-stone-500 dark:text-zinc-400">No accounts connected yet.</div>
                    )}
                    {emailAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex flex-wrap items-center justify-between gap-4 p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800"
                      >
                        <div>
                          <div className="font-medium text-stone-900 dark:text-white">
                            {account.display_name || account.email_address}
                          </div>
                          <div className="text-sm text-stone-500 dark:text-zinc-400">
                            {account.provider.toUpperCase()} • {account.email_address}
                          </div>
                          {account.is_primary && (
                            <span className="inline-flex items-center text-xs text-rose-600 dark:text-rose-400 mt-1">
                              <i className="fa-solid fa-star mr-1"></i>
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {!account.is_primary && (
                            <button
                              onClick={() => handleSetPrimary(account.id)}
                              disabled={accountsLoading}
                              className="px-3 py-2 rounded-lg text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-200 hover:border-rose-300 transition"
                            >
                              Set primary
                            </button>
                          )}
                          <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-zinc-400">
                            <input
                              type="checkbox"
                              checked={account.sync_enabled}
                              onChange={(e) => handleToggleSync(account.id, e.target.checked)}
                            />
                            Sync
                          </label>
                          <button
                            onClick={() => handleDeleteAccount(account.id)}
                            disabled={accountsLoading}
                            className="px-3 py-2 rounded-lg text-xs bg-red-500/10 text-red-600 hover:bg-red-500/20 transition"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Add Account</h3>
                <div className="space-y-3 p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-stone-500 dark:text-zinc-400 mb-1">Provider</div>
                      <select
                        value={newAccount.provider}
                        onChange={(e) =>
                          setNewAccount((prev) => ({ ...prev, provider: e.target.value as EmailAccountInput['provider'] }))
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm"
                      >
                        <option value="google">Google</option>
                        <option value="microsoft">Microsoft</option>
                        <option value="imap">IMAP</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-xs text-stone-500 dark:text-zinc-400 mb-1">Display name</div>
                      <input
                        type="text"
                        value={newAccount.display_name || ''}
                        onChange={(e) => setNewAccount((prev) => ({ ...prev, display_name: e.target.value }))}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-stone-500 dark:text-zinc-400 mb-1">Email address</div>
                    <input
                      type="email"
                      value={newAccount.email_address}
                      onChange={(e) => setNewAccount((prev) => ({ ...prev, email_address: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600 dark:text-zinc-400">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newAccount.is_primary ?? false}
                        onChange={(e) => setNewAccount((prev) => ({ ...prev, is_primary: e.target.checked }))}
                      />
                      Set as primary
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newAccount.sync_enabled ?? true}
                        onChange={(e) => setNewAccount((prev) => ({ ...prev, sync_enabled: e.target.checked }))}
                      />
                      Enable sync
                    </label>
                  </div>
                  <button
                    onClick={handleCreateAccount}
                    disabled={accountsLoading}
                    className="w-full px-4 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-medium rounded-lg transition"
                  >
                    <i className="fa-solid fa-plus mr-2"></i>
                    Add account
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'automation' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Vacation Responder</h3>
                <div className="space-y-4 p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-stone-900 dark:text-white">Enable auto-replies</div>
                      <div className="text-sm text-stone-500 dark:text-zinc-400">Send out-of-office responses</div>
                    </div>
                    <button
                      onClick={() => setVacationEnabled(!vacationEnabled)}
                      className={`relative inline-flex items-center h-6 w-11 rounded-full transition ${
                        vacationEnabled ? 'bg-rose-500' : 'bg-stone-300 dark:bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`inline-block w-5 h-5 bg-white rounded-full transform transition ${
                          vacationEnabled ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-stone-500 dark:text-zinc-400 mb-1">Start date</div>
                      <input
                        type="date"
                        value={vacationStart}
                        onChange={(e) => setVacationStart(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-stone-500 dark:text-zinc-400 mb-1">End date</div>
                      <input
                        type="date"
                        value={vacationEnd}
                        onChange={(e) => setVacationEnd(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-stone-500 dark:text-zinc-400 mb-1">Subject</div>
                    <input
                      type="text"
                      value={vacationSubject}
                      onChange={(e) => setVacationSubject(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-stone-500 dark:text-zinc-400 mb-1">Message</div>
                    <textarea
                      value={vacationMessage}
                      onChange={(e) => setVacationMessage(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-zinc-400">
                      <input
                        type="checkbox"
                        checked={vacationOnlyContacts}
                        onChange={(e) => setVacationOnlyContacts(e.target.checked)}
                      />
                      Only send to contacts
                    </label>
                    <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-zinc-400">
                      <input
                        type="checkbox"
                        checked={vacationOnlyFirst}
                        onChange={(e) => setVacationOnlyFirst(e.target.checked)}
                      />
                      Only first email per sender
                    </label>
                  </div>
                  <button
                    onClick={handleSaveVacation}
                    disabled={vacationSaving}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium"
                  >
                    {vacationSaving ? 'Saving...' : 'Save Vacation Responder'}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Blocked Senders</h3>
                <div className="space-y-3 p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={blockedInput}
                      onChange={(e) => setBlockedInput(e.target.value)}
                      placeholder="email@example.com or domain.com"
                      className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm"
                    />
                    <button
                      onClick={handleBlockSender}
                      disabled={blockedSaving}
                      className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm"
                    >
                      Block
                    </button>
                  </div>
                  <input
                    type="text"
                    value={blockedReason}
                    onChange={(e) => setBlockedReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={blockedAutoDelete}
                      onChange={(e) => setBlockedAutoDelete(e.target.checked)}
                    />
                    Auto-delete emails from this sender
                  </label>
                  <div className="divide-y divide-stone-200 dark:divide-zinc-800">
                    {blockedSenders.length === 0 && (
                      <div className="py-3 text-sm text-stone-500 dark:text-zinc-500">No blocked senders yet.</div>
                    )}
                    {blockedSenders.map((sender) => (
                      <div key={sender.id} className="py-2 flex items-center justify-between">
                        <div className="text-sm text-stone-700 dark:text-zinc-300">
                          {sender.email_address || sender.domain}
                          {sender.auto_delete && <span className="ml-2 text-xs text-red-500">auto-delete</span>}
                        </div>
                        <button
                          onClick={() => handleUnblockSender(sender.id)}
                          className="text-xs text-stone-500 hover:text-red-500"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Notification Rules</h3>
                <div className="space-y-3 p-4 bg-stone-50 dark:bg-zinc-900/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                  {notificationRule ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-stone-900 dark:text-white">Enable rule</div>
                        <input
                          type="checkbox"
                          checked={notificationRule.enabled}
                          onChange={(e) => setNotificationRule({ ...notificationRule, enabled: e.target.checked })}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-zinc-400">
                          <input
                            type="checkbox"
                            checked={notificationRule.notify_desktop}
                            onChange={(e) => setNotificationRule({ ...notificationRule, notify_desktop: e.target.checked })}
                          />
                          Desktop
                        </label>
                        <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-zinc-400">
                          <input
                            type="checkbox"
                            checked={notificationRule.notify_mobile}
                            onChange={(e) => setNotificationRule({ ...notificationRule, notify_mobile: e.target.checked })}
                          />
                          Mobile
                        </label>
                        <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-zinc-400">
                          <input
                            type="checkbox"
                            checked={notificationRule.notify_email}
                            onChange={(e) => setNotificationRule({ ...notificationRule, notify_email: e.target.checked })}
                          />
                          Email
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={notificationRule.respect_quiet_hours}
                          onChange={(e) => setNotificationRule({ ...notificationRule, respect_quiet_hours: e.target.checked })}
                        />
                        <span className="text-sm text-stone-600 dark:text-zinc-400">Respect quiet hours</span>
                      </div>
                      {notificationRule.respect_quiet_hours && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="time"
                            value={notificationRule.quiet_hours_start || ''}
                            onChange={(e) => setNotificationRule({ ...notificationRule, quiet_hours_start: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm"
                          />
                          <input
                            type="time"
                            value={notificationRule.quiet_hours_end || ''}
                            onChange={(e) => setNotificationRule({ ...notificationRule, quiet_hours_end: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm"
                          />
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-stone-500 dark:text-zinc-400 mb-1">Priority</div>
                        <select
                          value={notificationRule.priority}
                          onChange={(e) => setNotificationRule({ ...notificationRule, priority: e.target.value as NotificationRule['priority'] })}
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm"
                        >
                          <option value="low">Low</option>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-stone-500 dark:text-zinc-500">
                      No rules found. Create one to control email alerts.
                    </div>
                  )}
                  <button
                    onClick={handleSaveNotificationRule}
                    disabled={notificationSaving || !notificationRule}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium"
                  >
                    {notificationSaving ? 'Saving...' : 'Save Notification Rule'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white transition"
          >
            Close
          </button>
          <div className="text-xs text-stone-500 dark:text-zinc-500">
            Some settings are managed through Gmail
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailSettingsModal;
