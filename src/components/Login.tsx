import React, { useState } from 'react';

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
    <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center relative overflow-hidden font-sans">

      {/* Background Ambience - Pulse brand colors - hidden on mobile for performance */}
      <div className="hidden md:block absolute top-0 left-0 w-full h-full overflow-hidden z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-rose-500/10 rounded-full blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="z-10 w-full max-w-md p-8">
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl animate-scale-in">

          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-[#0f172a] rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-rose-500/20 mb-6">
              <svg viewBox="0 0 64 64" className="w-10 h-10">
                <defs>
                  <linearGradient id="pulse-grad-login" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e"/>
                    <stop offset="100%" stopColor="#ec4899"/>
                  </linearGradient>
                </defs>
                <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-login)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome to <span className="bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">Pulse</span></h1>
            <p className="text-zinc-400 text-sm">The AI-native communication dashboard.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {!showEmailForm ? (
            <div className="space-y-4">
              {/* Google Login */}
              <button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full bg-white hover:bg-zinc-200 text-zinc-900 font-medium py-3 rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn && loginMethod === 'google' ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-zinc-500"></i>
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="G" className="w-5 h-5" />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Microsoft Login */}
              <button
                onClick={handleMicrosoftLogin}
                disabled={isLoggingIn}
                className="w-full bg-[#2F2F2F] hover:bg-[#3F3F3F] text-white font-medium py-3 rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn && loginMethod === 'microsoft' ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-zinc-400"></i>
                    <span>Connecting to Microsoft...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 23 23">
                      <path fill="#f35325" d="M1 1h10v10H1z"/>
                      <path fill="#81bc06" d="M12 1h10v10H12z"/>
                      <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                      <path fill="#ffba08" d="M12 12h10v10H12z"/>
                    </svg>
                    <span>Continue with Microsoft</span>
                  </>
                )}
              </button>

              <div className="relative py-4">
                 <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
                 <div className="relative flex justify-center text-xs uppercase"><span className="bg-zinc-900 px-2 text-zinc-500">or</span></div>
              </div>

              <button
                onClick={() => setShowEmailForm(true)}
                disabled={isLoggingIn}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-3 rounded-xl transition border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                 Sign in with Email
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {isSignupMode && (
                <div>
                  <label className="block text-zinc-400 text-sm mb-2">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition"
                    required={isSignupMode}
                  />
                </div>
              )}

              <div>
                <label className="block text-zinc-400 text-sm mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-sm mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold py-3 rounded-xl transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn && loginMethod === 'email' ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>
                    {isSignupMode ? 'Creating account...' : 'Signing in...'}
                  </>
                ) : (
                  isSignupMode ? 'Create Account' : 'Sign In'
                )}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailForm(false);
                    setError(null);
                  }}
                  className="text-zinc-500 hover:text-zinc-300 transition"
                >
                  <i className="fa-solid fa-arrow-left mr-1"></i> Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignupMode(!isSignupMode);
                    setError(null);
                  }}
                  className="text-rose-400 hover:text-rose-300 transition"
                >
                  {isSignupMode ? 'Already have an account?' : 'Create an account'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 text-center">
            <p className="text-xs text-zinc-500">
              By continuing, you agree to our <a href="/terms" className="underline hover:text-zinc-400">Terms of Service</a> and <a href="/privacy" className="underline hover:text-zinc-400">Privacy Policy</a>.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-6 text-zinc-600 animate-slide-up delay-200">
           <div className="flex items-center gap-2 text-xs"><i className="fa-solid fa-shield-halved"></i> Secure Encryption</div>
           <a href="/privacy" className="flex items-center gap-2 text-xs hover:text-zinc-400 transition"><i className="fa-solid fa-lock"></i> Privacy Policy</a>
        </div>
      </div>
    </div>
  );
};

export default Login;