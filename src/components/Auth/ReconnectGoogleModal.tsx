// ReconnectGoogleModal.tsx - Seamless Google Re-Authentication Modal
// Allows users to reconnect Google account without full logout/login

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface ReconnectGoogleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  message?: string;
}

export const ReconnectGoogleModal: React.FC<ReconnectGoogleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  message = 'Your Google session has expired. Please reconnect to continue using email features.'
}) => {
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleReconnect = async () => {
    setIsReconnecting(true);

    try {
      // Trigger Google OAuth with explicit scopes
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes: 'email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/contacts.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent' // Force consent to get refresh token
          }
        }
      });

      if (error) {
        console.error('[ReconnectGoogle] OAuth error:', error);
        toast.error('Failed to reconnect Google. Please try again.');
        setIsReconnecting(false);
        return;
      }

      // OAuth flow initiated - user will be redirected
      toast.success('Redirecting to Google...');

      // Note: After successful OAuth, user will be redirected back
      // The onSuccess callback will be triggered after redirect
    } catch (error) {
      console.error('[ReconnectGoogle] Error:', error);
      toast.error('Failed to initiate Google reconnection');
      setIsReconnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-zinc-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-yellow-500"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            Reconnect Google Account
          </h2>

          {/* Message */}
          <p className="text-zinc-400 text-center mb-6">
            {message}
          </p>

          {/* Why this happened */}
          <div className="bg-zinc-800/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-zinc-400">
              <span className="text-zinc-300 font-semibold">Why did this happen?</span>
              <br />
              Google access tokens expire periodically for security. Reconnecting refreshes your access without losing your work.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isReconnecting}
              className="flex-1 px-4 py-3 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Later
            </button>
            <button
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              {isReconnecting ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Reconnect Google</span>
                </>
              )}
            </button>
          </div>

          {/* Help text */}
          <p className="text-xs text-zinc-500 text-center mt-4">
            You'll be redirected to Google to reconnect your account securely
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
