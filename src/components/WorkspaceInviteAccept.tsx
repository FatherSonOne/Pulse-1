import React, { useEffect, useState } from 'react';
import { workspaceService } from '../services/workspaceService';
import { supabase } from '../services/supabase';
import { CheckCircle2, LogIn, XCircle, Loader2 } from 'lucide-react';

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

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      sessionStorage.setItem(PENDING_INVITE_KEY, token);
      setStatus('login');
      return;
    }

    try {
      const workspaceId = await workspaceService.acceptInvite(token);
      localStorage.setItem('pulse_active_workspace', workspaceId);
      setStatus('success');
      setTimeout(() => { window.location.href = '/'; }, 1800);
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message.replace('[workspaceService] acceptInvite: ', '') : 'Something went wrong.';
      setMessage(msg);
    }
  }

  function goToLogin() {
    window.location.href = '/';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-pink-50 dark:from-zinc-950 dark:to-zinc-900 px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-2xl border border-zinc-200 dark:border-zinc-800 p-10 max-w-[380px] w-full flex flex-col items-center gap-4 text-center">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-2">
          <svg viewBox="0 0 64 64" className="w-9 h-9">
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
          <span className="text-[22px] font-bold text-zinc-900 dark:text-white tracking-tight">Pulse</span>
        </div>

        {status === 'loading' && (
          <>
            <Loader2 className="w-9 h-9 text-rose-500 animate-spin" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Accepting invite...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">You're in!</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Workspace joined. Taking you there now...</p>
          </>
        )}

        {status === 'login' && (
          <>
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <LogIn className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Sign in to join</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Your invite is saved. Sign in or create a Pulse account to accept it.</p>
            <button
              type="button"
              onClick={goToLogin}
              className="mt-1 px-6 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-semibold hover:from-rose-600 hover:to-pink-600 transition"
            >
              Go to sign in
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Invite issue</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="mt-1 px-6 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-semibold hover:from-rose-600 hover:to-pink-600 transition"
            >
              Go to Pulse
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default WorkspaceInviteAccept;
