import React, { useEffect, useRef, useState } from 'react';
import './Login.css';

import { ArrowLeft, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { PulseMark, PulseWordmark } from './brand/PulseMark';
import { friendlyAuthError } from '../utils/authErrors';

interface ResetPasswordProps {
  /** Called after the password is successfully set (session is now valid). */
  onComplete: () => void;
  /** Called when the user backs out — should sign out and return to login. */
  onCancel: () => void;
  /** Applies the new password to the active recovery session. */
  onUpdatePassword: (newPassword: string) => Promise<void>;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onComplete, onCancel, onUpdatePassword }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True only when the failure was the recovery link/session itself (expired,
  // reused, invalid) — that's the case where "request a new link" is the fix.
  const [linkExpired, setLinkExpired] = useState(false);
  const [done, setDone] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single completion path: fires once whether via the auto-redirect timer or
  // the manual "Continue to Pulse" button, so onComplete never runs twice.
  const finish = () => {
    if (redirectTimer.current) {
      clearTimeout(redirectTimer.current);
      redirectTimer.current = null;
    }
    onComplete();
  };

  // Don't leave a pending redirect firing after unmount.
  useEffect(() => () => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLinkExpired(false);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdatePassword(password);
      setDone(true);
      // Brief confirmation, then hand back to the app (session is valid).
      redirectTimer.current = setTimeout(finish, 1200);
    } catch (err: any) {
      setError(err?.message ? friendlyAuthError(err.message) : 'Could not update your password. Your reset link may have expired.');
      setLinkExpired(true);
      setIsSaving(false);
    }
  };

  return (
    <div className="login-screen login-screen--solo">
      <div className="login-right login-right--solo">
        <button type="button" onClick={onCancel} className="login-back-nav">
          <ArrowLeft size={14} /> Back to sign in
        </button>

        <div className="login-card">
          <div className="login-reset-logo">
            <PulseMark size={34} title="Pulse" />
            <PulseWordmark className="login-wordmark login-wordmark--dark" />
          </div>

          <div className="login-card-header">
            <h2 className="login-card-title">Set a new password</h2>
            <p className="login-card-subtitle">
              {done ? 'Password updated. Taking you in.' : 'Pick something only you would know.'}
            </p>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
              {linkExpired && (
                <button type="button" onClick={onCancel} className="login-error-action">
                  Request a new link
                </button>
              )}
            </div>
          )}

          {done ? (
            <div className="login-notice" role="status" aria-live="polite">
              You are all set. Redirecting to Pulse.
              <button type="button" onClick={finish} className="login-notice-action">
                Continue to Pulse
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-btn-group">
              <div className="login-field">
                <label className="login-label">New password</label>
                <div className="login-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="login-input"
                    required
                    minLength={6}
                    autoFocus
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="login-input-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="login-hint">At least 6 characters.</p>
              </div>

              <div className="login-field">
                <label className="login-label">Confirm password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="login-input"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" disabled={isSaving} className="login-submit-btn">
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Update password'
                )}
              </button>
            </form>
          )}
        </div>

        <div className="login-security-badges">
          <div className="login-security-badge">
            <Lock size={13} /> Secure Encryption
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
