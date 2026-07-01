import React, { useMemo, useState } from 'react';
import './Login.css';

import { ArrowLeft, Eye, EyeOff, Loader2, Lock, ShieldHalf } from 'lucide-react';
import { PulseMark, PulseWordmark } from './brand/PulseMark';
import { friendlyAuthError } from '../utils/authErrors';
import { getLastAuthMethod } from '../services/authService';

// Help escape hatch: reuse the product status URL if configured, else the
// public contact page (both real destinations — no invented route).
const HELP_URL = import.meta.env.VITE_STATUS_URL || 'https://qntmecos.com/contact';

interface LoginProps {
  onLogin: () => void;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string, name: string) => Promise<void>;
  onMicrosoftLogin: () => void;
  onPasswordReset: (email: string) => Promise<void>;
}

const Login: React.FC<LoginProps> = ({ onLogin, onEmailLogin, onSignup, onMicrosoftLogin, onPasswordReset }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'google' | 'microsoft' | 'email' | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  // Password-reset request sub-view (enter email → we email a recovery link).
  const [showResetForm, setShowResetForm] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  // Sign-up vs sign-in mode is seeded from the URL: the landing page sends new users
  // here with ?mode=signup (Get Started) and returning users without it (Log In).
  const [isSignupMode, setIsSignupMode] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('mode') === 'signup'; }
    catch { return false; }
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Recognition-over-recall: badge and float the method this returning user last
  // signed in with. Read once on mount; suppressed in signup mode (a brand-new
  // account has no "last used" method to speak of). Null when unknown.
  const lastMethodRaw = useMemo(() => getLastAuthMethod(), []);
  const lastMethod = isSignupMode ? null : lastMethodRaw;

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginMethod('google');
    setError(null);
    try {
      await onLogin();
    } catch (e: any) {
      setError(e?.message ? friendlyAuthError(e.message) : 'Could not connect to Google. Please try again.');
      setIsLoggingIn(false);
      setLoginMethod(null);
    }
  };

  const handleMicrosoftLogin = async () => {
    setIsLoggingIn(true);
    setLoginMethod('microsoft');
    setError(null);
    try {
      await onMicrosoftLogin();
    } catch (e: any) {
      setError(e?.message ? friendlyAuthError(e.message) : 'Could not connect to Microsoft. Please try again.');
      setIsLoggingIn(false);
      setLoginMethod(null);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setIsSendingReset(true);
    try {
      await onPasswordReset(email);
      // Neutral confirmation (we never reveal whether the email is registered).
      // Land back on the method chooser, not the password form — the "check your
      // inbox" copy would contradict a sign-in field sitting right below it.
      setNotice(`If ${email} has an account, a reset link is on its way. Check your inbox.`);
      setShowResetForm(false);
      setShowEmailForm(false);
    } catch (err: any) {
      setError(err?.message ? friendlyAuthError(err.message) : 'Could not send the reset link. Try again.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    // Client-side guards run before the spinner so a caught typo doesn't read
    // as a server round-trip. Confirm-password only exists in signup mode.
    if (isSignupMode) {
      if (!name.trim()) {
        setError('Please enter your name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsLoggingIn(true);
    setLoginMethod('email');

    try {
      if (isSignupMode) {
        await onSignup(email, password, name);
        // Session returned → AuthContext will swap us out of the Login screen.
      } else {
        await onEmailLogin(email, password);
      }
    } catch (err: any) {
      // Email confirmation pending (or email already registered): not a failure.
      // Stop the spinner and tell the user to check their inbox; otherwise the
      // button hangs on "Creating account…" forever. Matched by name to avoid a
      // cross-module import of the error class.
      if (err?.name === 'EmailConfirmationRequiredError') {
        setNotice(
          `Check ${email} to confirm your account, then sign in. ` +
          `If you already have an account, just sign in instead.`
        );
        setIsSignupMode(false);
        setIsLoggingIn(false);
        setLoginMethod(null);
        return;
      }
      setError(friendlyAuthError(err?.message));
      setIsLoggingIn(false);
      setLoginMethod(null);
    }
  };

  // Small "Last used" pill floated on a chooser button's top edge.
  const lastUsedBadge = <span className="login-last-used-badge">Last used</span>;

  const googleButton = (
    <button
      key="google"
      onClick={handleGoogleLogin}
      disabled={isLoggingIn}
      className={`login-social-btn${lastMethod === 'google' ? ' login-btn--last' : ''}`}
    >
      {lastMethod === 'google' && lastUsedBadge}
      {isLoggingIn && loginMethod === 'google' ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          <span>Connecting to Google…</span>
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l3.56-2.77.01-.54z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Continue with Google</span>
        </>
      )}
    </button>
  );

  const microsoftButton = (
    <button
      key="microsoft"
      onClick={handleMicrosoftLogin}
      disabled={isLoggingIn}
      className={`login-social-btn${lastMethod === 'microsoft' ? ' login-btn--last' : ''}`}
    >
      {lastMethod === 'microsoft' && lastUsedBadge}
      {isLoggingIn && loginMethod === 'microsoft' ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          <span>Connecting to Microsoft…</span>
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 23 23">
            <path fill="#f35325" d="M1 1h10v10H1z"/>
            <path fill="#81bc06" d="M12 1h10v10H12z"/>
            <path fill="#05a6f0" d="M1 12h10v10H1z"/>
            <path fill="#ffba08" d="M12 12h10v10H12z"/>
          </svg>
          <span>Continue with Microsoft</span>
        </>
      )}
    </button>
  );

  // Float the last-used social method to the top of the chooser; default order
  // (Google, Microsoft) otherwise.
  const socialButtons = lastMethod === 'microsoft'
    ? [microsoftButton, googleButton]
    : [googleButton, microsoftButton];

  return (
    <div className="login-screen">

      {/* LEFT BRAND PANEL */}
      <div className="login-left">

        {/* Top: Globe·Solid mark + PULSE wordmark (canonical lockup) */}
        <div className="login-logo-row">
          <PulseMark size={34} title="Pulse" />
          <PulseWordmark className="login-wordmark" />
        </div>

        {/* Center: Copy block — stripped to the brand statement */}
        <div className="login-copy-block">
          <h1 className="login-headline">
            Your comms,<br/>
            <span className="login-headline-accent">fully unified.</span>
          </h1>

          <p className="login-subtext">
            Every signal in one inbox. Pulse drafts the replies. You ship them.
          </p>
        </div>

        {/* Bottom: Product info */}
        <div className="login-social-proof">
          <div className="login-social-proof-text">
            <p className="login-proof-label">A product by Quantum Ecosystems LLC</p>
          </div>
        </div>
      </div>

      {/* RIGHT AUTH PANEL */}
      <div className="login-right">
        <a href="/" className="login-back-nav">
          <ArrowLeft size={14} /> Back to Home
        </a>

        <div className="login-card">
          <div className="login-card-header">
            <h2 className="login-card-title">
              {showResetForm ? 'Reset password' : isSignupMode ? 'Create your account' : 'Sign in'}
            </h2>
            <p className="login-card-subtitle">
              {showResetForm
                ? 'We will email you a link to set a new one.'
                : isSignupMode
                ? 'A few details and you are in.'
                : 'Pick how you want to continue.'}
            </p>
          </div>

          {error && (
            <div className="login-error" role="alert">{error}</div>
          )}

          {notice && (
            <div className="login-notice" role="status" aria-live="polite">{notice}</div>
          )}

          {showResetForm ? (
            <form onSubmit={handleResetSubmit} className="login-btn-group">
              <div className="login-field">
                <label className="login-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="login-input"
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>

              <button type="submit" disabled={isSendingReset} className="login-submit-btn">
                {isSendingReset ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending link…
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>

              <div className="login-form-nav">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetForm(false);
                    setShowEmailForm(true);
                    setError(null);
                    setNotice(null);
                  }}
                  className="login-back-btn"
                >
                  <ArrowLeft size={14} /> Back to sign in
                </button>
              </div>
            </form>
          ) : !showEmailForm ? (
            <div className="login-btn-group">
              {socialButtons}

              <div className="login-divider"><span>or</span></div>

              <button
                onClick={() => setShowEmailForm(true)}
                disabled={isLoggingIn}
                className={`login-email-cta${lastMethod === 'email' ? ' login-btn--last' : ''}`}
              >
                {lastMethod === 'email' && lastUsedBadge}
                Sign in with Email
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="login-btn-group">
              {isSignupMode && (
                <div className="login-field">
                  <label className="login-label">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="login-input"
                    required={isSignupMode}
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="login-field">
                <label className="login-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="login-input"
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>

              <div className="login-field">
                <div className="login-label-row">
                  <label className="login-label">Password</label>
                  {!isSignupMode && (
                    <button
                      type="button"
                      className="login-forgot"
                      onClick={() => {
                        setShowEmailForm(false);
                        setShowResetForm(true);
                        setError(null);
                        setNotice(null);
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="login-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="login-input"
                    required
                    minLength={6}
                    autoComplete={isSignupMode ? 'new-password' : 'current-password'}
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
                {isSignupMode && (
                  <p className="login-hint">At least 6 characters.</p>
                )}
              </div>

              {isSignupMode && (
                <div className="login-field">
                  <label className="login-label">Confirm password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="login-input"
                    required={isSignupMode}
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="login-submit-btn"
              >
                {isLoggingIn && loginMethod === 'email' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {isSignupMode ? 'Creating account…' : 'Signing in…'}
                  </>
                ) : (
                  isSignupMode ? 'Create account' : 'Sign in'
                )}
              </button>

              <div className="login-form-nav">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailForm(false);
                    setError(null);
                    setNotice(null);
                  }}
                  className="login-back-btn"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignupMode(!isSignupMode);
                    setError(null);
                    setNotice(null);
                  }}
                  className="login-toggle-btn"
                >
                  {isSignupMode ? 'Already have an account?' : 'Create an account'}
                </button>
              </div>
            </form>
          )}

          <div className="login-help">
            <a href={HELP_URL} target="_blank" rel="noopener noreferrer" className="login-help-link">
              Trouble signing in?
            </a>
          </div>

          <div className="login-terms">
            <p>
              By continuing, you agree to our{' '}
              <a href="/terms">Terms of Service</a> and{' '}
              <a href="/privacy">Privacy Policy</a>.
            </p>
          </div>
        </div>

        <div className="login-security-badges">
          <div className="login-security-badge">
            <ShieldHalf size={13} /> Secure Encryption
          </div>
          <a href="/privacy" className="login-security-badge">
            <Lock size={13} /> Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
