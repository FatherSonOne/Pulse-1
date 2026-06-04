import React, { useState } from 'react';
import { AppView } from '../../../types';
import type { User } from '../../../types';
import { loginWithGoogle, revokeGoogleAccess, disconnectGoogleAccount } from '../../../services/authService';
import {
  Check, AlertTriangle, Info, Plug,
  Lock, Loader2, Unlink, Ban,
} from 'lucide-react';

interface GoogleServicesIntegrationProps {
  user?: User | null;
}

export const GoogleServicesIntegration: React.FC<GoogleServicesIntegrationProps> = ({ user }) => {
  // Calendar state
  const [calendarTesting, setCalendarTesting] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<{ success: boolean; email?: string; calendarCount?: number; error?: string } | null>(null);
  const [userCalendars, setUserCalendars] = useState<Array<{ id: string; name: string; primary: boolean }>>([]);

  // Contacts state
  const [contactsTesting, setContactsTesting] = useState(false);
  const [contactsStatus, setContactsStatus] = useState<{ success: boolean; error?: string } | null>(null);
  const [contactsWiping, setContactsWiping] = useState(false);
  const [contactsWipeResult, setContactsWipeResult] = useState<{ deleted: number } | null>(null);

  // Maps state
  const [mapsApiKey, setMapsApiKey] = useState(() => localStorage.getItem('google_maps_api_key') || '');
  const [mapsTesting, setMapsTesting] = useState(false);
  const [mapsStatus, setMapsStatus] = useState<{ success: boolean; error?: string } | null>(null);

  return (
    <>
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
                <div className="flex flex-col items-center p-2 bg-[var(--pulse-surface)] rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#EA4335" d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20m0-2H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                  </svg>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Gmail</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-[var(--pulse-surface)] rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#4285F4" d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V1m-1 11h-5v5h5v-5z"/>
                  </svg>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Calendar</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-[var(--pulse-surface)] rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#1A73E8" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Contacts</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-[var(--pulse-surface)] rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#EA4335" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
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
                      const { googleCalendarService } = await import('../../../services/googleCalendarService');
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
                      <div key={cal.id} className="bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                        <i className={`fa-solid fa-calendar ${cal.primary ? 'text-rose-500' : 'text-zinc-400'}`}></i>
                        <span className="dark:text-white text-zinc-900 truncate">{cal.name}</span>
                        {cal.primary && <span className="text-[9px] bg-rose-500/10 text-rose-500 dark:text-rose-400 px-1.5 py-0.5 rounded">Primary</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[var(--pulse-surface-raised)] border border-[var(--pulse-border)] rounded-xl p-4 text-center">
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
              <path fill="#1A73E8" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
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
                  onClick={() => {
                    // Navigate to Contacts (AppView.CONTACTS, uppercase
                    // enum value) and open the import wizard on arrival.
                    // ContactsShell listens for both events.
                    window.dispatchEvent(new CustomEvent('pulse:navigate', { detail: { view: AppView.CONTACTS } }));
                    window.setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('pulse:contacts:open-connect-modal'));
                    }, 150);
                  }}
                  className="nothing-btn nothing-btn-primary"
                >
                  <Plug />
                  Manage Contacts Import
                </button>
                <button
                  onClick={async () => {
                    setContactsTesting(true);
                    setContactsStatus(null);
                    try {
                      const { googleContactsService } = await import('../../../services/googleContactsService');
                      const connected = await googleContactsService.isConnected();
                      setContactsStatus({ success: connected, error: connected ? undefined : 'Contacts scope not granted' });
                    } catch (error: any) {
                      setContactsStatus({ success: false, error: error.message || 'Connection failed' });
                    } finally {
                      setContactsTesting(false);
                    }
                  }}
                  disabled={contactsTesting}
                  className="nothing-btn"
                >
                  {contactsTesting ? (
                    <>
                      <Loader2 className="spinner-icon" />
                      Testing...
                    </>
                  ) : (
                    <>Test Connection</>
                  )}
                </button>
              </div>

              {contactsStatus && (
                <div className={`status-display ${contactsStatus.success ? 'success' : 'error'}`}>
                  <i className={`fa-solid ${contactsStatus.success ? 'fa-circle-check' : 'fa-circle-xmark'} status-icon`}></i>
                  <span>{contactsStatus.success ? 'Contacts scope granted. Import contacts from Contacts > Connect.' : `Error: ${contactsStatus.error}`}</span>
                </div>
              )}

              <div
                className="mt-4 rounded-xl border border-rose-200 dark:border-rose-900/40 p-3"
                style={{ background: 'var(--pulse-tone-overdue-soft)' }}
              >
                <p
                  className="text-[11px] uppercase tracking-[0.1em] font-semibold mb-1"
                  style={{
                    color: 'var(--pulse-tone-overdue)',
                    fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
                  }}
                >
                  Start Over
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-2">
                  Pulse imported contacts in bulk before. Wipe them and re-import selectively with the new picker. Only Google-sourced contacts are removed; manual and Logos Vision contacts stay.
                </p>
                {contactsWipeResult && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
                    Removed {contactsWipeResult.deleted} Google contact{contactsWipeResult.deleted === 1 ? '' : 's'}.
                  </p>
                )}
                <button
                  onClick={async () => {
                    if (!window.confirm('Delete all Google-imported contacts from Pulse? Manual and Logos Vision contacts are unaffected. You can re-import via Connect Contacts.')) {
                      return;
                    }
                    setContactsWiping(true);
                    setContactsWipeResult(null);
                    try {
                      const { wipeGoogleImportedContacts } = await import('../../../services/googleContactsService');
                      const result = await wipeGoogleImportedContacts();
                      setContactsWipeResult(result);
                    } catch (error: any) {
                      setContactsStatus({ success: false, error: error.message || 'Reset failed' });
                    } finally {
                      setContactsWiping(false);
                    }
                  }}
                  disabled={contactsWiping}
                  className="nothing-btn"
                  style={{
                    color: 'var(--pulse-tone-overdue)',
                    borderColor: 'var(--pulse-tone-overdue)',
                  }}
                >
                  {contactsWiping ? (
                    <>
                      <Loader2 className="spinner-icon" />
                      Wiping...
                    </>
                  ) : (
                    <>Wipe Google contacts</>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="bg-[var(--pulse-surface-raised)] border border-[var(--pulse-border)] rounded-xl p-4 text-center">
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
              <path fill="#EA4335" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle fill="#ffffff" cx="12" cy="9" r="2.5"/>
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
              For enhanced location features. Get an API key from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-rose-500 hover:text-rose-600 hover:underline">Google Cloud Console</a>
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
    </>
  );
};
