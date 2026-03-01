import React, { useEffect, useState } from 'react';
import { workspaceService } from '../services/workspaceService';
import { supabase } from '../services/supabase';

/**
 * Standalone invite-acceptance page rendered at /invite?token=xxx.
 * Works for both authenticated and unauthenticated users:
 *   - Authenticated  → accept invite, switch workspace, redirect to app
 *   - Unauthenticated → save token to sessionStorage, redirect to login
 *
 * After a successful accept the target workspace_id is written to
 * localStorage so WorkspaceContext auto-selects it on next load.
 */

const PENDING_INVITE_KEY = 'pulse_pending_invite_token';

export const WorkspaceInviteAccept: React.FC = () => {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'login'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No invite token found in the URL.');
      return;
    }
    accept();
  }, [token]);

  async function accept() {
    setStatus('loading');

    // Check auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Store token so we can auto-accept after login
      sessionStorage.setItem(PENDING_INVITE_KEY, token);
      setStatus('login');
      return;
    }

    try {
      const workspaceId = await workspaceService.acceptInvite(token);
      // Tell WorkspaceContext to switch to this workspace on next load
      localStorage.setItem('pulse_active_workspace', workspaceId);
      setStatus('success');
      // Brief pause so the user sees the success state, then go to app
      setTimeout(() => { window.location.href = '/'; }, 1800);
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message?.replace('[workspaceService] acceptInvite: ', '') ?? 'Something went wrong.');
    }
  }

  function goToLogin() {
    // The PENDING_INVITE_KEY is already saved; landing page auth will call
    // checkPendingInvite() after a successful sign-in.
    window.location.href = '/';
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <svg viewBox="0 0 64 64" style={{ width: 36, height: 36 }}>
            <defs>
              <linearGradient id="inv-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <path
              d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32"
              stroke="url(#inv-grad)" strokeWidth="5"
              strokeLinecap="round" strokeLinejoin="round" fill="none"
            />
          </svg>
          <span style={styles.logoText}>Pulse</span>
        </div>

        {status === 'loading' && (
          <>
            <div style={styles.spinner} />
            <p style={styles.body}>Accepting invite…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={styles.iconCircle('#dcfce7', '#16a34a')}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={styles.heading}>You're in!</h2>
            <p style={styles.body}>Workspace joined. Taking you there now…</p>
          </>
        )}

        {status === 'login' && (
          <>
            <div style={styles.iconCircle('#fef3c7', '#d97706')}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>
            <h2 style={styles.heading}>Sign in to join</h2>
            <p style={styles.body}>Your invite is saved. Sign in or create a Pulse account to accept it.</p>
            <button style={styles.btn} onClick={goToLogin}>
              Go to sign in
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={styles.iconCircle('#fee2e2', '#dc2626')}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 style={styles.heading}>Invite issue</h2>
            <p style={styles.body}>{message}</p>
            <button style={styles.btn} onClick={() => window.location.href = '/'}>
              Go to Pulse
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Inline styles (no CSS file dependency) ──────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #fff1f2 0%, #fdf2f8 100%)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,

  card: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
    padding: '40px 32px',
    maxWidth: 380,
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 16,
    textAlign: 'center' as const,
  },

  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  } as React.CSSProperties,

  logoText: {
    fontSize: 22,
    fontWeight: 700,
    color: '#18181b',
    letterSpacing: '-0.02em',
  } as React.CSSProperties,

  heading: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: '#18181b',
  } as React.CSSProperties,

  body: {
    margin: 0,
    fontSize: 14,
    color: '#71717a',
    lineHeight: 1.5,
  } as React.CSSProperties,

  btn: {
    marginTop: 4,
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #f43f5e, #ec4899)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  spinner: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '3px solid #fce7f3',
    borderTopColor: '#f43f5e',
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,

  iconCircle: (bg: string, fg: string) => ({
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }) as React.CSSProperties,
} as const;

// Inject spinner keyframes once
if (typeof document !== 'undefined' && !document.getElementById('ws-invite-spin')) {
  const style = document.createElement('style');
  style.id = 'ws-invite-spin';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}

export default WorkspaceInviteAccept;
