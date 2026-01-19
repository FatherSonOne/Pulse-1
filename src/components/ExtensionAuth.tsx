/**
 * Extension Authentication Components
 * Handles browser extension login flow with secure token exchange
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { getSessionUser } from '../services/authService';

/**
 * ExtensionLogin - Initiates login for browser extension
 * Route: /auth/extension-login
 *
 * This page is opened by the extension when user clicks "Sign in".
 * It uses the existing Supabase auth session or initiates Google OAuth.
 */
export const ExtensionLogin: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'redirecting' | 'login' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSessionAndRedirect();
  }, []);

  const checkSessionAndRedirect = async () => {
    try {
      // Check if user already has a valid session
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user && session.access_token) {
        // User is already logged in - redirect to callback with token
        setStatus('redirecting');
        redirectToCallback(session.access_token, session.user);
      } else {
        // No session - show login button
        setStatus('login');
      }
    } catch (err) {
      console.error('Session check error:', err);
      setStatus('login');
    }
  };

  const redirectToCallback = (token: string, user: any) => {
    const userInfo = {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata
    };

    const callbackUrl = `/auth/extension-callback?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(userInfo))}`;
    window.location.href = callbackUrl;
  };

  const handleGoogleLogin = async () => {
    setStatus('redirecting');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/extension-oauth-callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        }
      });

      if (error) {
        throw error;
      }
      // OAuth will redirect, so we don't need to do anything else
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 mb-4">
            <svg viewBox="0 0 64 64" className="w-10 h-10">
              <defs>
                <linearGradient id="pulse-grad-ext" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f43f5e"/>
                  <stop offset="100%" stopColor="#ec4899"/>
                </linearGradient>
              </defs>
              <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-ext)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Pulse Extension</h1>
          <p className="text-zinc-400">Sign in to capture content to your projects</p>
        </div>

        {/* Status Content */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8">
          {status === 'checking' && (
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-zinc-400">Checking session...</p>
            </div>
          )}

          {status === 'redirecting' && (
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-zinc-400">Redirecting to extension...</p>
            </div>
          )}

          {status === 'login' && (
            <div className="space-y-4">
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold rounded-xl transition"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-zinc-900 text-zinc-500">or</span>
                </div>
              </div>

              <a
                href="/"
                className="block w-full text-center px-6 py-3 border border-zinc-700 hover:border-zinc-600 text-zinc-300 font-medium rounded-xl transition"
              >
                Open Pulse App
              </a>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => setStatus('login')}
                className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600 mt-6">
          By signing in, you agree to our{' '}
          <a href="/privacy" className="text-rose-500 hover:underline">Privacy Policy</a>
          {' '}and{' '}
          <a href="/terms" className="text-rose-500 hover:underline">Terms of Service</a>
        </p>
      </div>
    </div>
  );
};

/**
 * ExtensionOAuthCallback - Handles OAuth redirect after Google login
 * Route: /auth/extension-oauth-callback
 *
 * This is where Supabase redirects after Google OAuth.
 * We extract the session and redirect to the final callback.
 */
export const ExtensionOAuthCallback: React.FC = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      // Supabase handles the OAuth callback automatically
      // Wait for session to be available
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (session?.user && session.access_token) {
        const userInfo = {
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata
        };

        // Redirect to final callback that extension is listening to
        window.location.href = `/auth/extension-callback?token=${encodeURIComponent(session.access_token)}&user=${encodeURIComponent(JSON.stringify(userInfo))}`;
      } else {
        throw new Error('No session after OAuth');
      }
    } catch (err: any) {
      console.error('OAuth callback error:', err);
      setError(err.message);
      // Redirect to error page
      window.location.href = `/auth/extension-error?error=${encodeURIComponent(err.message)}`;
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-zinc-400">Completing sign in...</p>
      </div>
    </div>
  );
};

/**
 * ExtensionCallback - Final callback page that extension reads
 * Route: /auth/extension-callback
 *
 * The extension listens for navigation to this URL and extracts
 * the token and user info from the query parameters.
 */
export const ExtensionCallback: React.FC = () => {
  const [status, setStatus] = useState<'success' | 'error'>('success');

  useEffect(() => {
    // Check if we have the required params
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const user = params.get('user');

    if (!token || !user) {
      setStatus('error');
    }

    // Close the tab after a short delay (extension should have captured the data)
    const timer = setTimeout(() => {
      window.close();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center">
        {status === 'success' ? (
          <>
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Signed In!</h2>
            <p className="text-zinc-400 mb-4">You can close this tab and return to the extension.</p>
            <p className="text-zinc-600 text-sm">This tab will close automatically...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Sign In Failed</h2>
            <p className="text-zinc-400">Please try again from the extension.</p>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * ExtensionError - Error page for failed auth
 * Route: /auth/extension-error
 */
export const ExtensionError: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error') || 'An unknown error occurred';

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Authentication Error</h2>
        <p className="text-zinc-400 mb-6">{error}</p>
        <div className="space-y-3">
          <a
            href="/auth/extension-login"
            className="block w-full px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition"
          >
            Try Again
          </a>
          <button
            onClick={() => window.close()}
            className="block w-full px-6 py-3 border border-zinc-700 hover:border-zinc-600 text-zinc-300 font-medium rounded-xl transition"
          >
            Close Tab
          </button>
        </div>
      </div>
    </div>
  );
};

export default {
  ExtensionLogin,
  ExtensionOAuthCallback,
  ExtensionCallback,
  ExtensionError
};
