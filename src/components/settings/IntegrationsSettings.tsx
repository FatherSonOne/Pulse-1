import React, { useState } from 'react';
import type { User } from '../../types';
import { UnifiedMessage } from '../../types/index';
import { SlackService } from '../../services/slackService';
import { GmailService } from '../../services/gmailService';
import { TwilioService } from '../../services/twilioService';
import { unifiedInboxDb } from '../../services/unifiedInboxDb';
import { dataService } from '../../services/dataService';
import { supabase } from '../../services/supabase';
import { loginWithGoogle, loginWithMicrosoft, revokeGoogleAccess, disconnectGoogleAccount } from '../../services/authService';
import {
  RefreshCw, Check, AlertTriangle, Info, Plug, Mail,
  Phone, Shield, Unlink, Server, X,
  Lock, Loader2, Download, Rocket, Ban,
} from 'lucide-react';

interface IntegrationsSettingsProps {
  user?: User | null;
  userId: string;
}

export const IntegrationsSettings: React.FC<IntegrationsSettingsProps> = ({ user, userId }) => {
  // Slack state
  const [slackToken, setSlackToken] = useState(import.meta.env.VITE_SLACK_BOT_TOKEN || '');
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackStatus, setSlackStatus] = useState<{ success: boolean; workspace?: string; error?: string } | null>(null);
  const [slackMessages, setSlackMessages] = useState<UnifiedMessage[]>([]);
  const [slackChannels, setSlackChannels] = useState<Array<{ id: string; name: string }>>([]);

  // Gmail state
  const [gmailToken, setGmailToken] = useState('');
  const [gmailTesting, setGmailTesting] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<{ success: boolean; email?: string; error?: string } | null>(null);
  const [gmailMessages, setGmailMessages] = useState<UnifiedMessage[]>([]);

  // Twilio state
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioTesting, setTwilioTesting] = useState(false);
  const [twilioStatus, setTwilioStatus] = useState<{ success: boolean; phoneNumber?: string; error?: string } | null>(null);
  const [twilioMessages, setTwilioMessages] = useState<UnifiedMessage[]>([]);

  // Calendar state
  const [calendarTesting, setCalendarTesting] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<{ success: boolean; email?: string; calendarCount?: number; error?: string } | null>(null);
  const [userCalendars, setUserCalendars] = useState<Array<{ id: string; name: string; primary: boolean }>>([]);

  // Contacts state
  const [contactsTesting, setContactsTesting] = useState(false);
  const [contactsStatus, setContactsStatus] = useState<{ success: boolean; contactCount?: number; error?: string } | null>(null);

  // Maps state
  const [mapsApiKey, setMapsApiKey] = useState(() => localStorage.getItem('google_maps_api_key') || '');
  const [mapsTesting, setMapsTesting] = useState(false);
  const [mapsStatus, setMapsStatus] = useState<{ success: boolean; error?: string } | null>(null);

  // Slack Integration Handlers
  const testSlackConnection = async () => {
    if (!slackToken) {
      setSlackStatus({ success: false, error: 'Please enter a Slack bot token' });
      return;
    }

    setSlackTesting(true);
    setSlackStatus(null);

    try {
      const slackService = new SlackService(slackToken);
      const result = await slackService.testConnection();
      setSlackStatus(result);

      if (result.success) {
        // Fetch channels if connection successful
        const channels = await slackService.getChannels();
        setSlackChannels(channels);
      }
    } catch (error: any) {
      setSlackStatus({ success: false, error: error.message || 'Unknown error' });
    } finally {
      setSlackTesting(false);
    }
  };

  const fetchSlackMessages = async () => {
    if (!slackToken) return;

    // Use mock user ID for testing if no user is logged in
    // Generate a valid UUID format for Supabase
    const effectiveUserId = user?.id || '00000000-0000-0000-0000-000000000001';

    setSlackTesting(true);
    try {
      // Update sync state to 'syncing'
      await unifiedInboxDb.updateSyncState(effectiveUserId, 'slack', {
        syncStatus: 'syncing'
      });

      const slackService = new SlackService(slackToken);
      const messages = await slackService.getAllMessages(20);

      // Persist messages to database
      const storedCount = await unifiedInboxDb.storeMessages(effectiveUserId, messages);
      console.log(`Stored ${storedCount} Slack messages to database`);

      // Update sync state to 'completed'
      await unifiedInboxDb.updateSyncState(effectiveUserId, 'slack', {
        syncStatus: 'completed',
        lastMessageTimestamp: messages.length > 0 ? messages[0].timestamp : undefined
      });

      // Load messages from database to display
      const dbMessages = await unifiedInboxDb.getMessages(effectiveUserId, {
        platform: 'slack',
        limit: 50
      });

      // Convert database messages to UnifiedMessage format for display
      setSlackMessages(messages);

      if (messages.length === 0) {
        setSlackStatus({
          success: true,
          workspace: slackStatus?.workspace,
          error: 'No messages found. Make sure your bot is added to at least one channel.'
        });
      } else {
        setSlackStatus({
          success: true,
          workspace: slackStatus?.workspace,
          error: `Successfully synced ${storedCount} messages to database`
        });
      }
    } catch (error) {
      console.error('Error fetching Slack messages:', error);

      // Update sync state to 'failed'
      await unifiedInboxDb.updateSyncState(effectiveUserId, 'slack', {
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      setSlackStatus({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages'
      });
    } finally {
      setSlackTesting(false);
    }
  };

  // Gmail Integration Handlers
  const testGmailConnection = async () => {
    if (!gmailToken) {
      setGmailStatus({ success: false, error: 'Please enter a Gmail access token' });
      return;
    }

    setGmailTesting(true);
    setGmailStatus(null);

    try {
      const gmailService = new GmailService(gmailToken);
      const result = await gmailService.testConnection();
      setGmailStatus(result);
    } catch (error: any) {
      setGmailStatus({ success: false, error: error.message || 'Unknown error' });
    } finally {
      setGmailTesting(false);
    }
  };

  const fetchGmailMessages = async () => {
    if (!gmailToken) return;

    const effectiveUserId = user?.id || '00000000-0000-0000-0000-000000000001';

    setGmailTesting(true);
    try {
      await unifiedInboxDb.updateSyncState(effectiveUserId, 'email', {
        syncStatus: 'syncing'
      });

      const gmailService = new GmailService(gmailToken);
      const messages = await gmailService.getMessages(20);

      const storedCount = await unifiedInboxDb.storeMessages(effectiveUserId, messages);
      console.log(`Stored ${storedCount} Gmail messages to database`);

      await unifiedInboxDb.updateSyncState(effectiveUserId, 'email', {
        syncStatus: 'completed',
        lastMessageTimestamp: messages.length > 0 ? messages[0].timestamp : undefined
      });

      setGmailMessages(messages);

      if (messages.length === 0) {
        setGmailStatus({
          success: true,
          email: gmailStatus?.email,
          error: 'No messages found in inbox.'
        });
      } else {
        setGmailStatus({
          success: true,
          email: gmailStatus?.email,
          error: `✅ Successfully synced ${storedCount} messages to database`
        });
      }
    } catch (error) {
      console.error('Error fetching Gmail messages:', error);

      await unifiedInboxDb.updateSyncState(effectiveUserId, 'email', {
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      setGmailStatus({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages'
      });
    } finally {
      setGmailTesting(false);
    }
  };

  // Twilio SMS Integration Handlers
  const testTwilioConnection = async () => {
    if (!twilioAccountSid || !twilioAuthToken) {
      setTwilioStatus({ success: false, error: 'Please enter Twilio credentials' });
      return;
    }

    setTwilioTesting(true);
    setTwilioStatus(null);

    try {
      const twilioService = new TwilioService(twilioAccountSid, twilioAuthToken);
      const result = await twilioService.testConnection();
      setTwilioStatus(result);
    } catch (error: any) {
      setTwilioStatus({ success: false, error: error.message || 'Unknown error' });
    } finally {
      setTwilioTesting(false);
    }
  };

  const fetchTwilioMessages = async () => {
    if (!twilioAccountSid || !twilioAuthToken) return;

    const effectiveUserId = user?.id || '00000000-0000-0000-0000-000000000001';

    setTwilioTesting(true);
    try {
      await unifiedInboxDb.updateSyncState(effectiveUserId, 'sms', {
        syncStatus: 'syncing'
      });

      const twilioService = new TwilioService(twilioAccountSid, twilioAuthToken);
      const messages = await twilioService.getMessages(20);

      const storedCount = await unifiedInboxDb.storeMessages(effectiveUserId, messages);
      console.log(`Stored ${storedCount} SMS messages to database`);

      await unifiedInboxDb.updateSyncState(effectiveUserId, 'sms', {
        syncStatus: 'completed',
        lastMessageTimestamp: messages.length > 0 ? messages[0].timestamp : undefined
      });

      setTwilioMessages(messages);

      if (messages.length === 0) {
        setTwilioStatus({
          success: true,
          phoneNumber: twilioStatus?.phoneNumber,
          error: 'No messages found.'
        });
      } else {
        setTwilioStatus({
          success: true,
          phoneNumber: twilioStatus?.phoneNumber,
          error: `✅ Successfully synced ${storedCount} messages to database`
        });
      }
    } catch (error) {
      console.error('Error fetching Twilio messages:', error);

      await unifiedInboxDb.updateSyncState(effectiveUserId, 'sms', {
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      setTwilioStatus({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages'
      });
    } finally {
      setTwilioTesting(false);
    }
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3>
          <Plug /> Platform Integrations
        </h3>
        <p>
          Connect your accounts to sync data across all your platforms. Messages, calendars, and contacts will be unified in one place.
        </p>
      </div>

      {/* Sync Preferences (New) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
              <RefreshCw /> Sync Preferences
          </h4>
          <div className="space-y-4">
              <div className="flex items-center justify-between">
                  <div>
                      <p className="text-sm font-medium dark:text-white text-zinc-900">Sync Frequency</p>
                      <p className="text-xs text-zinc-500">How often Pulse checks for new data in background</p>
                  </div>
                  <select aria-label="Sync Frequency" className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm dark:text-white text-zinc-900 focus:outline-none">
                      <option>Real-time (Instant)</option>
                      <option>Every 15 minutes</option>
                      <option>Every hour</option>
                      <option>Manual only</option>
                  </select>
              </div>
              <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>
              <div className="flex items-center justify-between">
                  <div>
                      <p className="text-sm font-medium dark:text-white text-zinc-900">Slack Channels</p>
                      <p className="text-xs text-zinc-500">Select which channels to import</p>
                  </div>
                  <button className="text-sm text-blue-500 hover:underline">Manage (All)</button>
              </div>
          </div>
      </div>

      {/* ==================== GOOGLE SERVICES SECTION ==================== */}
      <div className="section-header">
        <h3>
          <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google Services
        </h3>
        <p>
          Connect your Google account to sync Calendar, Contacts, Gmail, and Maps. All services use a single Google sign-in.
        </p>
      </div>

      {/* Google Account Connection Card */}
      <div className="integration-card" style={{ borderColor: user?.connectedProviders.google ? 'rgba(16, 185, 129, 0.3)' : undefined }}>
        <div className="integration-header">
          <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          <div className="integration-info" style={{ flex: 1 }}>
            <h4>Google Account</h4>
            <p>Connect once to enable all Google services</p>
          </div>
          {user?.connectedProviders.google && (
            <span className="connected-badge">
              Connected
            </span>
          )}
        </div>

        <div className="space-y-3">
          {user?.connectedProviders.google ? (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">Google Account Connected</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-500">{user?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4">
                <div className="flex flex-col items-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#EA4335" d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20m0-2H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                  </svg>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Gmail</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#4285F4" d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V1m-1 11h-5v5h5v-5z"/>
                  </svg>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Calendar</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#1A73E8" d="M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z"/>
                  </svg>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Contacts</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#34A853" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                  </svg>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Maps</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="text-amber-500" />
                </div>
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-400">Google Account Not Connected</p>
                  <p className="text-sm text-amber-600 dark:text-amber-500">Sign in with Google to enable all services</p>
                </div>
              </div>
            </div>
          )}

          <div className="nothing-info-box" style={{ marginTop: '16px' }}>
            <p className="info-title">
              <Info />
              Google API Permissions Requested:
            </p>
            <ul>
              <li><code>calendar.readonly</code> Read calendar events</li>
              <li><code>calendar.events</code> Create and modify events</li>
              <li><code>gmail.readonly</code> Read email messages</li>
              <li><code>gmail.send</code> Send emails</li>
              <li><code>contacts.readonly</code> Read your contacts</li>
            </ul>
            <p style={{ marginTop: '12px', opacity: 0.8 }}>
              Your data is handled securely and never shared with third parties.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {!user?.connectedProviders.google ? (
              <button
                onClick={async () => {
                  try {
                    await loginWithGoogle();
                  } catch (error) {
                    console.error('Failed to connect Google:', error);
                  }
                }}
                className="nothing-btn nothing-btn-primary"
              >
                <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', marginRight: '6px' }}>
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect Google Account
              </button>
            ) : (
              <>
                <button
                  onClick={async () => {
                    if (confirm('This will disconnect your Google account from Pulse. You can reconnect at any time.')) {
                      try {
                        await disconnectGoogleAccount();
                      } catch (error) {
                        console.error('Failed to disconnect Google:', error);
                      }
                    }
                  }}
                  className="nothing-btn nothing-btn-secondary"
                >
                  <Unlink />
                  Disconnect
                </button>
                <button
                  onClick={async () => {
                    if (confirm('This will completely revoke Pulse\'s access to your Google account. You\'ll need to re-authorize all permissions to reconnect.')) {
                      try {
                        await revokeGoogleAccess();
                      } catch (error) {
                        console.error('Failed to revoke Google access:', error);
                      }
                    }
                  }}
                  className="nothing-btn"
                  style={{ color: '#ef4444' }}
                >
                  <Ban />
                  Revoke Access
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Gmail Integration */}
      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
              <path fill="#4285F4" d="M22 6V4H2v2l10 6 10-6z"/>
              <path fill="#EA4335" d="M22 8l-10 6L2 8v10h20V8z"/>
              <path fill="#FBBC05" d="M2 4v4l10 6V6L2 4z"/>
              <path fill="#34A853" d="M22 4l-10 2v8l10-6V4z"/>
            </svg>
          </div>
          <div className="integration-info" style={{ flex: 1 }}>
            <h4>Gmail</h4>
            <p>Pull in email conversations</p>
          </div>
          {(gmailStatus?.success || user?.connectedProviders.google) && (
            <span className="connected-badge">
              Connected
            </span>
          )}
        </div>

        <div className="space-y-3">
          {user?.connectedProviders.google ? (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">Gmail Connected</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-500">{user?.email}</p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Gmail integration is active through your Google sign-in. Your emails are accessible in the Email section.
              </p>
            </div>
          ) : (
            <div className="bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-center">
              <Lock className="text-zinc-400 text-2xl mb-2" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Connect your Google account above to enable Gmail</p>
            </div>
          )}

          <div className="nothing-info-box" style={{ marginTop: '16px' }}>
            <p className="info-title">
              <Info />
              Gmail API Permissions:
            </p>
            <ul>
              <li><code>gmail.readonly</code> Read email messages</li>
              <li><code>gmail.send</code> Send emails on your behalf</li>
              <li><code>gmail.modify</code> Mark as read, archive, delete</li>
            </ul>
          </div>

          {user?.connectedProviders.google && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={async () => {
                  setGmailTesting(true);
                  setGmailStatus(null);
                  try {
                    const { getGmailService } = await import('../../services/gmailService');
                    const gmailService = getGmailService();
                    const result = await gmailService.testConnection();
                    setGmailStatus(result);
                  } catch (error: any) {
                    setGmailStatus({ success: false, error: error.message || 'Connection failed' });
                  } finally {
                    setGmailTesting(false);
                  }
                }}
                disabled={gmailTesting}
                className="nothing-btn nothing-btn-primary"
              >
                {gmailTesting ? (
                  <>
                    <Loader2 className="spinner-icon" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Plug />
                    Test Connection
                  </>
                )}
              </button>

              {gmailStatus?.success && (
                <button
                  onClick={async () => {
                    setGmailTesting(true);
                    try {
                      const { getGmailService } = await import('../../services/gmailService');
                      const gmailService = getGmailService();
                      const messages = await gmailService.getMessages(10);
                      setGmailMessages(messages);
                      setGmailStatus({
                        success: true,
                        email: gmailStatus?.email,
                        error: `Fetched ${messages.length} recent emails`
                      });
                    } catch (error: any) {
                      setGmailStatus({ success: false, error: error.message });
                    } finally {
                      setGmailTesting(false);
                    }
                  }}
                  disabled={gmailTesting}
                  className="nothing-btn nothing-btn-secondary"
                >
                  <Download />
                  Fetch Messages
                </button>
              )}
            </div>
          )}

          {gmailStatus && (
            <div className={`status-display ${gmailStatus.success ? 'success' : 'error'}`}>
              <i className={`fa-solid ${gmailStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
              <span>{gmailStatus.success ? `Connected to ${gmailStatus.email}` : `Error: ${gmailStatus.error}`}</span>
            </div>
          )}

          {gmailMessages.length > 0 && (
            <div className="message-preview">
              <div className="message-preview-title">
                Recent Emails ({gmailMessages.length})
              </div>
              <div>
                {gmailMessages.slice(0, 5).map((msg) => (
                  <div key={msg.id} className="preview-message">
                    <div className="preview-message-sender">
                      {msg.senderName} <span style={{ opacity: 0.5 }}>• {msg.senderEmail}</span>
                    </div>
                    <div className="preview-message-content">{msg.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Google Calendar Integration */}
      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
              <path fill="#4285F4" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
              <path fill="#fff" d="M5 10h14v10H5z"/>
              <path fill="#EA4335" d="M9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/>
            </svg>
          </div>
          <div className="integration-info" style={{ flex: 1 }}>
            <h4>Google Calendar</h4>
            <p>Sync events and schedule meetings</p>
          </div>
          {user?.connectedProviders.google && calendarStatus?.success && (
            <span className="connected-badge">
              Connected
            </span>
          )}
        </div>

        <div className="space-y-3">
          {user?.connectedProviders.google ? (
            <>
              <div className="nothing-info-box">
                <p className="info-title">
                  <Info />
                  Calendar Features:
                </p>
                <ul>
                  <li>View and sync all your calendars</li>
                  <li>Create events with Google Meet links</li>
                  <li>AI-powered scheduling suggestions</li>
                  <li>Two-way sync with local events</li>
                </ul>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={async () => {
                    setCalendarTesting(true);
                    setCalendarStatus(null);
                    try {
                      const { googleCalendarService } = await import('../../services/googleCalendarService');
                      const calendars = await googleCalendarService.getCalendars();
                      setUserCalendars(calendars.map(c => ({ id: c.id, name: c.summary, primary: c.primary || false })));
                      setCalendarStatus({
                        success: true,
                        email: user?.email,
                        calendarCount: calendars.length
                      });
                    } catch (error: any) {
                      setCalendarStatus({ success: false, error: error.message || 'Connection failed' });
                    } finally {
                      setCalendarTesting(false);
                    }
                  }}
                  disabled={calendarTesting}
                  className="nothing-btn nothing-btn-primary"
                >
                  {calendarTesting ? (
                    <>
                      <Loader2 className="spinner-icon" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Plug />
                      Test Connection
                    </>
                  )}
                </button>
              </div>

              {calendarStatus && (
                <div className={`status-display ${calendarStatus.success ? 'success' : 'error'}`}>
                  <i className={`fa-solid ${calendarStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
                  <span>{calendarStatus.success ? `Found ${calendarStatus.calendarCount} calendars` : `Error: ${calendarStatus.error}`}</span>
                </div>
              )}

              {userCalendars.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    Your Calendars ({userCalendars.length})
                  </h5>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {userCalendars.map((cal) => (
                      <div key={cal.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                        <i className={`fa-solid fa-calendar text-blue-500 ${cal.primary ? 'text-blue-600' : 'text-zinc-400'}`}></i>
                        <span className="dark:text-white text-zinc-900 truncate">{cal.name}</span>
                        {cal.primary && <span className="text-[9px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">Primary</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-center">
              <Lock className="text-zinc-400 text-2xl mb-2" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Connect your Google account above to enable Calendar sync</p>
            </div>
          )}
        </div>
      </div>

      {/* Google Contacts Integration */}
      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
              <path fill="#1A73E8" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <div className="integration-info" style={{ flex: 1 }}>
            <h4>Google Contacts</h4>
            <p>Sync your contacts and connections</p>
          </div>
          {user?.connectedProviders.google && contactsStatus?.success && (
            <span className="connected-badge">
              Connected
            </span>
          )}
        </div>

        <div className="space-y-3">
          {user?.connectedProviders.google ? (
            <>
              <div className="nothing-info-box">
                <p className="info-title">
                  <Info />
                  Contacts Features:
                </p>
                <ul>
                  <li>Import contacts from Google</li>
                  <li>Access contact details and photos</li>
                  <li>Use contacts for scheduling and messaging</li>
                  <li>Keep contacts in sync automatically</li>
                </ul>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={async () => {
                    setContactsTesting(true);
                    setContactsStatus(null);
                    try {
                      const { googleContactsService } = await import('../../services/googleContactsService');
                      const contacts = await googleContactsService.getAllContacts();
                      setContactsStatus({
                        success: true,
                        contactCount: contacts.length
                      });
                    } catch (error: any) {
                      setContactsStatus({ success: false, error: error.message || 'Connection failed' });
                    } finally {
                      setContactsTesting(false);
                    }
                  }}
                  disabled={contactsTesting}
                  className="nothing-btn nothing-btn-primary"
                >
                  {contactsTesting ? (
                    <>
                      <Loader2 className="spinner-icon" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Plug />
                      Test Connection
                    </>
                  )}
                </button>
              </div>

              {contactsStatus && (
                <div className={`status-display ${contactsStatus.success ? 'success' : 'error'}`}>
                  <i className={`fa-solid ${contactsStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
                  <span>{contactsStatus.success ? `Found ${contactsStatus.contactCount} contacts` : `Error: ${contactsStatus.error}`}</span>
                </div>
              )}
            </>
          ) : (
            <div className="bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-center">
              <Lock className="text-zinc-400 text-2xl mb-2" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Connect your Google account above to enable Contacts sync</p>
            </div>
          )}
        </div>
      </div>

      {/* Google Maps Integration */}
      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
              <path fill="#34A853" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle fill="#fff" cx="12" cy="9" r="2.5"/>
              <path fill="#4285F4" d="M12 2C8.13 2 5 5.13 5 9c0 1.74.5 3.37 1.41 4.84.95 1.54 2.2 2.86 3.16 4.4.47.75.81 1.45 1.17 2.26L12 24"/>
              <path fill="#FBBC05" d="M12 2c3.87 0 7 3.13 7 7 0 1.74-.5 3.37-1.41 4.84-.95 1.54-2.2 2.86-3.16 4.4-.47.75-.81 1.45-1.17 2.26L12 24"/>
            </svg>
          </div>
          <div className="integration-info" style={{ flex: 1 }}>
            <h4>Google Maps</h4>
            <p>Location services and directions</p>
          </div>
          {mapsStatus?.success && (
            <span className="connected-badge">
              Connected
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div className="nothing-info-box">
            <p className="info-title">
              <Info />
              Maps Features:
            </p>
            <ul>
              <li>Add locations to calendar events</li>
              <li>Get directions to meetings</li>
              <li>Calculate travel time between events</li>
              <li>Location suggestions for scheduling</li>
            </ul>
          </div>

          <div>
            <label className="nothing-input-label">
              Google Maps API Key (Optional)
            </label>
            <input
              type="password"
              value={mapsApiKey}
              onChange={(e) => {
                setMapsApiKey(e.target.value);
                localStorage.setItem('google_maps_api_key', e.target.value);
              }}
              placeholder="AIza..."
              className="nothing-input"
            />
            <p className="text-xs text-zinc-500 mt-2">
              For enhanced location features. Get an API key from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google Cloud Console</a>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                setMapsTesting(true);
                setMapsStatus(null);
                try {
                  if (mapsApiKey) {
                    const response = await fetch(
                      `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${mapsApiKey}`
                    );
                    const data = await response.json();
                    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
                      setMapsStatus({ success: true });
                    } else if (data.error_message) {
                      setMapsStatus({ success: false, error: data.error_message });
                    } else {
                      setMapsStatus({ success: false, error: `API returned status: ${data.status}` });
                    }
                  } else {
                    setMapsStatus({ success: true });
                  }
                } catch (error: any) {
                  setMapsStatus({ success: false, error: error.message || 'Connection failed' });
                } finally {
                  setMapsTesting(false);
                }
              }}
              disabled={mapsTesting}
              className="nothing-btn nothing-btn-primary"
            >
              {mapsTesting ? (
                <>
                  <Loader2 className="spinner-icon" />
                  Testing...
                </>
              ) : (
                <>
                  <Plug />
                  Test Connection
                </>
              )}
            </button>
          </div>

          {mapsStatus && (
            <div className={`status-display ${mapsStatus.success ? 'success' : 'error'}`}>
              <i className={`fa-solid ${mapsStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
              <span>{mapsStatus.success ? 'Maps API is ready' : `Error: ${mapsStatus.error}`}</span>
            </div>
          )}
        </div>
      </div>

      {/* ==================== OTHER INTEGRATIONS SECTION ==================== */}
      <div className="section-header" style={{ marginTop: '48px' }}>
        <h3>
          <Plug /> Other Integrations
        </h3>
        <p>
          Connect additional platforms to aggregate all your messages in one unified inbox.
        </p>
      </div>

      {/* Slack Integration */}
      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon" style={{ background: '#4A154B' }}>
            <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
              <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
              <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
              <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.521 2.522v6.312z"/>
              <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.521-2.522v-2.522h2.521zm0-1.27a2.527 2.527 0 0 1-2.521-2.522 2.527 2.527 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z"/>
            </svg>
          </div>
          <div className="integration-info" style={{ flex: 1 }}>
            <h4>Slack</h4>
            <p>Aggregate messages from Slack channels</p>
          </div>
          {slackStatus?.success && (
            <span className="connected-badge">
              Connected
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="nothing-input-label">
              Slack Bot Token
            </label>
            <input
              type="password"
              value={slackToken}
              onChange={(e) => setSlackToken(e.target.value)}
              placeholder="xoxb-your-slack-bot-token"
              className="nothing-input"
            />
            <div className="nothing-info-box">
              <p className="info-title">
                <Info />
                Required Slack Bot Scopes:
              </p>
              <ul>
                <li><code>channels:history</code> Read public channel messages</li>
                <li><code>channels:read</code> View public channels</li>
                <li><code>groups:history</code> Read private channel messages</li>
                <li><code>groups:read</code> View private channels</li>
                <li><code>im:history</code> Read DM messages</li>
                <li><code>im:read</code> View DMs</li>
                <li><code>users:read</code> View user info</li>
              </ul>
              <p style={{ marginTop: '12px' }}>
                Configure at <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">Slack API Dashboard</a> → OAuth &amp; Permissions → Scopes
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={testSlackConnection}
              disabled={slackTesting || !slackToken}
              className="nothing-btn nothing-btn-primary"
            >
              {slackTesting ? (
                <>
                  <Loader2 className="spinner-icon" />
                  Testing...
                </>
              ) : (
                <>
                  <Plug />
                  Test Connection
                </>
              )}
            </button>

            {slackStatus?.success && (
              <button
                onClick={fetchSlackMessages}
                disabled={slackTesting}
                className="nothing-btn nothing-btn-secondary"
              >
                <Download />
                Fetch Messages
              </button>
            )}

          </div>

          {slackStatus && (
            <div className={`status-display ${slackStatus.success ? 'success' : 'error'}`}>
              <i className={`fa-solid ${slackStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
              <span>{slackStatus.success ? `Connected to ${slackStatus.workspace}` : `Error: ${slackStatus.error}`}</span>
            </div>
          )}

          {slackChannels.length > 0 && (
            <div className="mt-4">
              <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Available Channels ({slackChannels.length})
              </h5>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {slackChannels.slice(0, 10).map((channel) => (
                  <div key={channel.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs">
                    <span className="text-zinc-500">#</span>
                    <span className="dark:text-white text-zinc-900">{channel.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slackMessages.length > 0 && (
            <div className="message-preview">
              <div className="message-preview-title">
                Recent Messages ({slackMessages.length})
              </div>
              <div>
                {slackMessages.slice(0, 5).map((msg) => (
                  <div key={msg.id} className="preview-message">
                    <div className="preview-message-sender">
                      {msg.senderName} <span style={{ opacity: 0.5 }}>• #{msg.channelName}</span>
                    </div>
                    <div className="preview-message-content">{msg.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Twilio SMS Integration */}
      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon" style={{ background: '#F22F46' }}>
            <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
              <path fill="#fff" d="M12 0C5.381 0 0 5.381 0 12s5.381 12 12 12 12-5.381 12-12S18.619 0 12 0zm0 20.4c-4.639 0-8.4-3.761-8.4-8.4S7.361 3.6 12 3.6s8.4 3.761 8.4 8.4-3.761 8.4-8.4 8.4zm3.6-8.4c0 .994-.806 1.8-1.8 1.8s-1.8-.806-1.8-1.8.806-1.8 1.8-1.8 1.8.806 1.8 1.8zm-5.4 0c0 .994-.806 1.8-1.8 1.8S6.6 12.994 6.6 12s.806-1.8 1.8-1.8 1.8.806 1.8 1.8z"/>
            </svg>
          </div>
          <div className="integration-info" style={{ flex: 1 }}>
            <h4>Twilio SMS</h4>
            <p>Include SMS messages</p>
          </div>
          {twilioStatus?.success && (
            <span className="connected-badge">
              Connected
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="nothing-input-label">
              Twilio Account SID
            </label>
            <input
              type="text"
              value={twilioAccountSid}
              onChange={(e) => setTwilioAccountSid(e.target.value)}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="nothing-input"
            />
          </div>

          <div>
            <label className="nothing-input-label">
              Twilio Auth Token
            </label>
            <input
              type="password"
              value={twilioAuthToken}
              onChange={(e) => setTwilioAuthToken(e.target.value)}
              placeholder="********************************"
              className="nothing-input"
            />
            <div className="nothing-info-box">
              <p className="info-title">
                <Info />
                Twilio API Credentials:
              </p>
              <ul>
                <li>Find your Account SID and Auth Token in the Twilio Console</li>
                <li>Ensure your Twilio number has SMS capabilities enabled</li>
              </ul>
              <p style={{ marginTop: '12px' }}>
                Get credentials at <a href="https://console.twilio.com/" target="_blank" rel="noopener noreferrer">Twilio Console</a>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={testTwilioConnection}
              disabled={twilioTesting || !twilioAccountSid || !twilioAuthToken}
              className="nothing-btn nothing-btn-primary"
            >
              {twilioTesting ? (
                <>
                  <Loader2 className="spinner-icon" />
                  Testing...
                </>
              ) : (
                <>
                  <Plug />
                  Test Connection
                </>
              )}
            </button>

            {twilioStatus?.success && (
              <button
                onClick={fetchTwilioMessages}
                disabled={twilioTesting}
                className="nothing-btn nothing-btn-secondary"
              >
                <Download />
                Fetch Messages
              </button>
            )}

          </div>

          {twilioStatus && (
            <div className={`status-display ${twilioStatus.success ? 'success' : 'error'}`}>
              <i className={`fa-solid ${twilioStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
              <span>{twilioStatus.success ? `Connected to ${twilioStatus.phoneNumber}` : `Error: ${twilioStatus.error}`}</span>
            </div>
          )}

          {twilioMessages.length > 0 && (
            <div className="message-preview">
              <div className="message-preview-title">
                Recent SMS ({twilioMessages.length})
              </div>
              <div>
                {twilioMessages.slice(0, 5).map((msg) => (
                  <div key={msg.id} className="preview-message">
                    <div className="preview-message-sender">
                      {msg.senderName} <span style={{ opacity: 0.5 }}>• {(msg.metadata as Record<string, unknown>)?.formattedPhone as string}</span>
                    </div>
                    <div className="preview-message-content">{msg.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Microsoft 365 Integration */}
      <div className="section-header" style={{ marginTop: '48px' }}>
        <h3>
          <svg viewBox="0 0 23 23" style={{ width: '16px', height: '16px', display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }}>
            <path fill="#f35325" d="M1 1h10v10H1z"/>
            <path fill="#81bc06" d="M12 1h10v10H12z"/>
            <path fill="#05a6f0" d="M1 12h10v10H1z"/>
            <path fill="#ffba08" d="M12 12h10v10H12z"/>
          </svg>
          Microsoft 365
        </h3>
        <p>
          Connect your Microsoft account to sync Outlook Mail, Calendar, and Contacts.
        </p>
      </div>

      <div className="integration-card" style={{ borderColor: user?.connectedProviders?.microsoft ? 'rgba(16, 185, 129, 0.3)' : undefined }}>
        <div className="integration-header">
          <div className="integration-icon" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <svg viewBox="0 0 23 23" style={{ width: '32px', height: '32px' }}>
              <path fill="#f35325" d="M1 1h10v10H1z"/>
              <path fill="#81bc06" d="M12 1h10v10H12z"/>
              <path fill="#05a6f0" d="M1 12h10v10H1z"/>
              <path fill="#ffba08" d="M12 12h10v10H12z"/>
            </svg>
          </div>
          <div className="integration-info" style={{ flex: 1 }}>
            <h4>Microsoft Account</h4>
            <p>Connect once to enable all Microsoft services</p>
          </div>
          {user?.connectedProviders?.microsoft && (
            <span className="connected-badge">Connected</span>
          )}
        </div>

        <div className="space-y-3">
          {user?.connectedProviders?.microsoft ? (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">Microsoft Account Connected</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-500">{user?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="flex flex-col items-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#0078D4" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Outlook</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#0078D4" d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V1m-1 11h-5v5h5v-5z"/>
                  </svg>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Calendar</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white/50 dark:bg-zinc-800/50 rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#0078D4" d="M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z"/>
                  </svg>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Contacts</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="text-amber-500" />
                </div>
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-400">Microsoft Account Not Connected</p>
                  <p className="text-sm text-amber-600 dark:text-amber-500">Sign in with Microsoft to enable Outlook, Calendar &amp; Contacts</p>
                </div>
              </div>
            </div>
          )}

          <div className="nothing-info-box" style={{ marginTop: '16px' }}>
            <p className="info-title">
              <Info />
              Microsoft API Permissions Requested:
            </p>
            <ul>
              <li><code>Mail.Read / Mail.ReadWrite</code> Read &amp; manage email</li>
              <li><code>Mail.Send</code> Send emails from Outlook</li>
              <li><code>Calendars.Read / Calendars.ReadWrite</code> Read &amp; manage calendar</li>
              <li><code>Contacts.Read</code> Read your contacts</li>
              <li><code>User.Read</code> Basic profile info</li>
            </ul>
            <p style={{ marginTop: '12px', opacity: 0.8 }}>
              Your data is handled securely and never shared with third parties.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {!user?.connectedProviders?.microsoft ? (
              <button
                onClick={async () => {
                  try {
                    await loginWithMicrosoft();
                  } catch (error) {
                    console.error('Failed to connect Microsoft:', error);
                  }
                }}
                className="nothing-btn nothing-btn-primary"
              >
                <svg viewBox="0 0 23 23" style={{ width: '16px', height: '16px' }}>
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
                Connect Microsoft Account
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (confirm('Disconnect your Microsoft account? This will remove access to Outlook, Calendar and Contacts.')) {
                    try {
                      await supabase.auth.signOut();
                      window.location.reload();
                    } catch (error) {
                      console.error('Failed to disconnect Microsoft:', error);
                    }
                  }
                }}
                className="nothing-btn"
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                <Unlink />
                Disconnect Microsoft
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Future Integrations Teaser */}
      <div className="section-header" style={{ marginTop: '48px' }}>
        <h3>
          <Rocket /> Coming Soon
        </h3>
        <p>
          More integrations are on the way to help you sync all your data in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="integration-card" style={{ opacity: 0.6, pointerEvents: 'none' }}>
          <div className="integration-header">
            <div className="integration-icon" style={{ background: '#000000' }}>
              <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                <path fill="#fff" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
            </div>
            <div className="integration-info">
              <h4>Apple iCloud</h4>
              <p>Calendar, Contacts, Reminders</p>
            </div>
          </div>
          <div className="text-center py-4">
            <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded-full">Coming Soon</span>
          </div>
        </div>

        <div className="integration-card" style={{ opacity: 0.6, pointerEvents: 'none' }}>
          <div className="integration-header">
            <div className="integration-icon" style={{ background: '#0A66C2' }}>
              <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px' }}>
                <path fill="#fff" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </div>
            <div className="integration-info">
              <h4>LinkedIn</h4>
              <p>Messages, Connections</p>
            </div>
          </div>
          <div className="text-center py-4">
            <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded-full">Coming Soon</span>
          </div>
        </div>
      </div>
    </div>
  );
};
