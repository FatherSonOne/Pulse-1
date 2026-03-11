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
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

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

    try {
      if (isSignupMode) {
        if (!name.trim()) {
          throw new Error('Please enter your name');
        }
        await onSignup(email, password, name);
      } else {
        await onEmailLogin(email, password);
      }
    } catch (err: any) {
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
            AI-Native Communication
          </div>

          <h1 className="login-headline">
            Your comms,<br/>
            <span className="login-headline-accent">fully unified.</span>
          </h1>

          <p className="login-subtext">
            The AI-native dashboard for messaging, calls, and team collaboration — built for the way you actually work.
          </p>

          <ul className="login-bullets">
            <li className="login-bullet">Real-time AI briefings across all your channels</li>
            <li className="login-bullet">Voice, video, and messaging in one place</li>
            <li className="login-bullet">Works with Slack, Gmail, Teams, and more</li>
          </ul>
        </div>

        {/* Bottom: Social proof */}
        <div className="login-social-proof">
          <div className="login-avatars">
            <div className="login-avatar">A</div>
            <div className="login-avatar">B</div>
            <div className="login-avatar">C</div>
            <div className="login-avatar">D</div>
          </div>
          <div className="login-social-proof-text">
            <div className="login-stars">★★★★★</div>
            <p className="login-proof-label">Trusted by growing teams</p>
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
            <h2 className="login-card-title">Welcome Back</h2>
            <p className="login-card-subtitle">Sign in to continue to Pulse</p>
          </div>

          {error && (
            <div className="login-error">{error}</div>
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
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="G" width="18" height="18" />
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
