import React, { useState } from 'react';
import './Login.css';

import { ArrowLeft, Loader2, Lock, ShieldHalf } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string, name: string) => Promise<void>;
  onMicrosoftLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onEmailLogin, onSignup, onMicrosoftLogin }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'google' | 'microsoft' | 'email' | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  // Sign-up vs sign-in mode is seeded from the URL: the landing page sends new users
  // here with ?mode=signup (Get Started) and returning users without it (Log In).
  const [isSignupMode, setIsSignupMode] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('mode') === 'signup'; }
    catch { return false; }
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginMethod('google');
    setError(null);
    try {
      await onLogin();
    } catch (e: any) {
      setError(e.message || 'Google login failed');
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
      setError(e.message || 'Microsoft login failed');
      setIsLoggingIn(false);
      setLoginMethod(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginMethod('email');
    setError(null);
    setNotice(null);

    try {
      if (isSignupMode) {
        if (!name.trim()) {
          throw new Error('Please enter your name');
        }
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
      setError(err.message || 'Authentication failed');
      setIsLoggingIn(false);
      setLoginMethod(null);
    }
  };

  return (
    <div className="login-screen">

      {/* LEFT BRAND PANEL */}
      <div className="login-left">

        {/* Top: Logo + brand name */}
        <div className="login-logo-row">
          <div className="login-logo-icon">
            <svg viewBox="0 0 64 64" width="22" height="22">
              <defs>
                <linearGradient id="pulse-grad-left" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f43f5e"/>
                  <stop offset="100%" stopColor="#ec4899"/>
                </linearGradient>
              </defs>
              <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-left)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <span className="login-logo-name">Pulse</span>
        </div>

        {/* Center: Copy block */}
        <div className="login-copy-block">
          <div className="login-brand-badge">
            <span className="login-badge-dot"></span>
            Communication and Intelligence
          </div>

          <h1 className="login-headline">
            Your comms,<br/>
            <span className="login-headline-accent">fully unified.</span>
          </h1>

          <p className="login-subtext">
            Every signal in one inbox. Pulse drafts the replies. You ship them.
          </p>

          <ul className="login-bullets">
            <li className="login-bullet">Triage stream + 5 Relay peers + Glimpse async video</li>
            <li className="login-bullet">Email, messaging, calendar, decisions, and maps in one place</li>
            <li className="login-bullet">War Room with 8 slash commands and 4 AI personas</li>
            <li className="login-bullet">Gmail, Slack, Teams, Outlook, and 4 native CRMs</li>
          </ul>
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
            <h2 className="login-card-title">Sign in</h2>
            <p className="login-card-subtitle">Pick how you want to continue.</p>
          </div>

          {error && (
            <div className="login-error">{error}</div>
          )}

          {notice && (
            <div className="login-notice">{notice}</div>
          )}

          {!showEmailForm ? (
            <div className="login-btn-group">
              {/* Google Login */}
              <button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="login-social-btn"
              >
                {isLoggingIn && loginMethod === 'google' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Connecting to Google...</span>
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

              {/* Microsoft Login */}
              <button
                onClick={handleMicrosoftLogin}
                disabled={isLoggingIn}
                className="login-social-btn"
              >
                {isLoggingIn && loginMethod === 'microsoft' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Connecting to Microsoft...</span>
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

              <div className="login-divider"><span>or</span></div>

              <button
                onClick={() => setShowEmailForm(true)}
                disabled={isLoggingIn}
                className="login-email-cta"
              >
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
                    placeholder="John Doe"
                    className="login-input"
                    required={isSignupMode}
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
                />
              </div>

              <div className="login-field">
                <label className="login-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="login-input"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="login-submit-btn"
              >
                {isLoggingIn && loginMethod === 'email' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {isSignupMode ? 'Creating account...' : 'Signing in...'}
                  </>
                ) : (
                  isSignupMode ? 'Create Account' : 'Sign In'
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
