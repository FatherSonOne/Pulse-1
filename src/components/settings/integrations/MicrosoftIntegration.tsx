import React from 'react';
import type { User } from '../../../types';
import { loginWithMicrosoft } from '../../../services/authService';
import { supabase } from '../../../services/supabase';
import {
  Check, AlertTriangle, Info,
  Unlink,
} from 'lucide-react';
import { CollapsibleIntegrationCard } from './CollapsibleIntegrationCard';

interface MicrosoftIntegrationProps {
  user?: User | null;
}

export const MicrosoftIntegration: React.FC<MicrosoftIntegrationProps> = ({ user }) => {
  return (
    <>
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

      <CollapsibleIntegrationCard
        defaultOpen={!user?.connectedProviders?.microsoft}
        style={{ borderColor: user?.connectedProviders?.microsoft ? 'rgba(16, 185, 129, 0.3)' : undefined }}
        summary={
          <>
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
          </>
        }
        badge={user?.connectedProviders?.microsoft ? <span className="connected-badge">Connected</span> : undefined}
      >
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
                <div className="flex flex-col items-center p-2 bg-[var(--pulse-surface)] rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#0078D4" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Outlook</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-[var(--pulse-surface)] rounded-lg">
                  <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', marginBottom: '4px' }}>
                    <path fill="#0078D4" d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V1m-1 11h-5v5h5v-5z"/>
                  </svg>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Calendar</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-[var(--pulse-surface)] rounded-lg">
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
      </CollapsibleIntegrationCard>
    </>
  );
};
