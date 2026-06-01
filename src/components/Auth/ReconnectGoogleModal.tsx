// ReconnectGoogleModal.tsx - Seamless Google Re-Authentication Modal
// Allows users to reconnect Google account without full logout/login

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface ReconnectGoogleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  message?: string;
  title?: string;
  whyText?: string;
  invalidGrantReason?: 'revoked' | 'expired';
}

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const ReconnectGoogleModal: React.FC<ReconnectGoogleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  message = 'Your Google session has expired. Please reconnect to continue using email features.',
  title = 'Reconnect Google Account',
  whyText = 'Google access tokens expire periodically for security. Reconnecting refreshes your access without losing your work.',
  invalidGrantReason,
}) => {
  const { t } = useTranslation();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const laterButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    window.setTimeout(() => laterButtonRef.current?.focus(), 0);
  }, [isOpen]);

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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onClose();
      return;
    }

    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) return null;

  const monoFont = "'JetBrains Mono', 'SF Mono', Consolas, monospace";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={handleKeyDown}
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reconnect-google-title"
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="w-full max-w-md rounded-xl border overflow-hidden"
          style={{
            background: 'var(--pulse-surface)',
            borderColor: 'var(--pulse-border)',
            boxShadow: 'var(--pulse-shadow-md)',
            color: 'var(--pulse-ink)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            {/* Brand medallion — rose-soft, matching the import wizard header */}
            <div className="flex justify-center mb-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'var(--pulse-rose-soft)' }}
              >
                <ShieldAlert className="w-7 h-7" style={{ color: 'var(--pulse-rose)' }} aria-hidden="true" />
              </div>
            </div>

            {/* Title */}
            <h2 id="reconnect-google-title" className="text-xl font-semibold text-center mb-2">
              {title}
            </h2>

            {/* Message */}
            <p className="text-sm leading-6 text-center mb-5" style={{ color: 'var(--pulse-ink-2)' }}>
              {message}
            </p>

            {/* Revoked-grant alert — full hairline border + warning tint, no side-stripe */}
            {invalidGrantReason === 'revoked' && (
              <div
                role="alert"
                className="flex items-start gap-3 p-3 rounded-lg border mb-4"
                style={{
                  background: 'var(--pulse-tone-warning-soft)',
                  borderColor: 'var(--pulse-border)',
                  color: 'var(--pulse-ink)',
                }}
              >
                <ShieldAlert
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  style={{ color: 'var(--pulse-tone-warning)' }}
                  aria-hidden="true"
                />
                <div className="flex-1 text-sm leading-5">
                  <div className="font-semibold">{t('contacts.invalidGrantBanner.headline')}</div>
                  <p className="mt-0.5" style={{ color: 'var(--pulse-ink-2)' }}>
                    {t('contacts.invalidGrantBanner.body')}
                  </p>
                </div>
              </div>
            )}

            {/* Why this happened — quiet info block, mono eyebrow */}
            <div
              className="rounded-lg p-3.5 mb-6"
              style={{ background: 'var(--pulse-canvas)' }}
            >
              <div
                className="text-[11px] uppercase tracking-[0.1em] mb-1"
                style={{ color: 'var(--pulse-ink-3)', fontFamily: monoFont, fontWeight: 600 }}
              >
                {t('contacts.reconnectModal.why_label')}
              </div>
              <p className="text-sm leading-6" style={{ color: 'var(--pulse-ink-2)' }}>
                {whyText}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                ref={laterButtonRef}
                onClick={onClose}
                disabled={isReconnecting}
                className="flex-1 min-h-[44px] px-4 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: 'var(--pulse-ink-2)', border: '1px solid var(--pulse-border)' }}
              >
                {t('contacts.reconnectModal.later')}
              </button>
              <button
                onClick={handleReconnect}
                disabled={isReconnecting}
                className="flex-1 min-h-[44px] px-4 py-3 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: 'var(--pulse-rose)' }}
              >
                {isReconnecting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('contacts.reconnectModal.connecting')}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>{t('contacts.reconnectModal.cta')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Help text */}
            <p className="text-xs text-center mt-4" style={{ color: 'var(--pulse-ink-3)' }}>
              {t('contacts.reconnectModal.help')}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
