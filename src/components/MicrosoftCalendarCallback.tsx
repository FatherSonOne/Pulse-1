import React, { useEffect, useRef, useState } from 'react';
import { outlookCalendarService } from '../services/outlookCalendarService';

import { Check, X } from 'lucide-react';

type Status = 'processing' | 'success' | 'error';

export const MicrosoftCalendarCallback: React.FC = () => {
  const [status, setStatus] = useState<Status>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    // Guard against StrictMode double-invoke
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.search);
    const code  = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    // Microsoft returned an error (e.g. user cancelled)
    if (error) {
      setErrorMessage(errorDescription || error);
      setStatus('error');
      return;
    }

    if (!code || !state) {
      setErrorMessage('Missing code or state parameter in callback URL.');
      setStatus('error');
      return;
    }

    outlookCalendarService
      .handleCallback(code, state)
      .then(() => {
        setStatus('success');
        // Small delay so the user sees the success message, then navigate home
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      })
      .catch((err: Error) => {
        setErrorMessage(err.message || 'Token exchange failed.');
        setStatus('error');
      });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">

        {status === 'processing' && (
          <>
            <div className="w-12 h-12 border-4 border-zinc-200 dark:border-zinc-700 border-t-rose-500 rounded-full animate-spin mx-auto" />
            <p className="text-zinc-600 dark:text-zinc-400 font-medium">
              Connecting your Outlook calendar…
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <Check className="text-green-600 dark:text-green-400 text-xl" />
            </div>
            <p className="text-zinc-800 dark:text-zinc-100 font-semibold text-lg">
              Outlook calendar connected!
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Redirecting you back to Pulse…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto">
              <X className="text-rose-600 dark:text-rose-400 text-xl" />
            </div>
            <p className="text-zinc-800 dark:text-zinc-100 font-semibold text-lg">
              Connection failed
            </p>
            {errorMessage && (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm break-words">
                {errorMessage}
              </p>
            )}
            <button
              onClick={() => { window.location.href = '/'; }}
              className="mt-2 px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-medium transition-colors"
            >
              Back to Pulse
            </button>
          </>
        )}

      </div>
    </div>
  );
};
