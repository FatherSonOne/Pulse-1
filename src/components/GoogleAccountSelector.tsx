import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../types';
import { loginWithGoogle, logoutUser, revokeGoogleAccess, disconnectGoogleAccount } from '../services/authService';
import { AccountSettingsModal, PrivacyDashboard, HelpSupportModal } from './Account';

interface GoogleAccountSelectorProps {
  user: User | null;
  onUserChange: (user: User | null) => void;
  isSidebarCollapsed: boolean;
}

// Extend Window interface for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            itp_support?: boolean;
          }) => void;
          prompt: (momentNotification?: (notification: { getNotDisplayedReason: () => string; getSkippedReason: () => string; getDismissedReason: () => string }) => void) => void;
          renderButton: (element: HTMLElement, config: {
            type?: 'standard' | 'icon';
            theme?: 'outline' | 'filled_blue' | 'filled_black';
            size?: 'large' | 'medium' | 'small';
            text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
            logo_alignment?: 'left' | 'center';
            width?: string | number;
            locale?: string;
          }) => void;
          disableAutoSelect: () => void;
          storeCredential: (credentials: { id: string; password: string }, callback?: () => void) => void;
          cancel: () => void;
          onGoogleLibraryLoad: () => void;
          revoke: (accessToken: string, done: () => void) => void;
        };
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string; expires_in: number; scope: string; token_type: string; error?: string }) => void;
            error_callback?: (error: { type: string; message: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string; state?: string }) => void;
          };
        };
      };
    };
  }
}

const GoogleAccountSelector: React.FC<GoogleAccountSelectorProps> = ({
  user,
  onUserChange,
  isSidebarCollapsed,
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [imageError, setImageError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modal states
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showPrivacyDashboard, setShowPrivacyDashboard] = useState(false);
  const [showHelpSupport, setShowHelpSupport] = useState(false);

  // Get Google Client ID from environment or use a default for development
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    // Initialize Google Identity Services when the library loads
    const initializeGSI = () => {
      if (!window.google?.accounts?.id) {
        return;
      }

      if (!GOOGLE_CLIENT_ID) {
        console.warn('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file');
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
        });

        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing Google Identity Services:', error);
      }
    };

    // Check if Google library is already loaded
    if (window.google?.accounts?.id) {
      initializeGSI();
    } else {
      // Wait for the library to load
      const checkInterval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(checkInterval);
          initializeGSI();
        }
      }, 100);

      // Cleanup after 10 seconds
      setTimeout(() => clearInterval(checkInterval), 10000);
    }
  }, [GOOGLE_CLIENT_ID]);

  const handleCredentialResponse = async (response: { credential: string }) => {
    try {
      // The credential is a JWT ID token from Google
      // We need to exchange it with Supabase for a session
      // For now, trigger the OAuth flow which will handle authentication
      // In a production setup, you'd verify the JWT and exchange it with Supabase
      const newUser = await loginWithGoogle();
      onUserChange(newUser);
      setShowAccountMenu(false);
    } catch (error) {
      console.error('Error during Google sign-in:', error);
      // If OAuth flow fails, try to use the credential directly
      // This would require backend support to verify the JWT
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
      onUserChange(null);
      setShowAccountMenu(false);
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account? This will revoke Pulse\'s access to your Google account and sign you out.')) {
      return;
    }

    try {
      await disconnectGoogleAccount();
      onUserChange(null);
      setShowAccountMenu(false);
    } catch (error) {
      console.error('Error disconnecting Google account:', error);
      alert('Failed to disconnect Google account. Please try again or disconnect manually from your Google Account settings.');
    }
  };

  const handleRevokeAccess = async () => {
    if (!confirm('This will completely revoke Pulse\'s access to your Google account and sign you out. You will need to reconnect if you want to use Google features again. Continue?')) {
      return;
    }

    try {
      await revokeGoogleAccess();
      onUserChange(null);
      setShowAccountMenu(false);
    } catch (error) {
      console.error('Error revoking Google access:', error);
      alert('Failed to revoke access. Please try again or disconnect manually from your Google Account settings.');
    }
  };

  const handleAddAccount = async () => {
    // Use direct OAuth flow instead of unreliable prompt()
    // This triggers the Google consent screen with account selection
    try {
      const newUser = await loginWithGoogle();
      onUserChange(newUser);
      setShowAccountMenu(false);
    } catch (error) {
      console.error('Error adding account:', error);
    }
  };

  const handleSwitchAccount = async () => {
    // Use direct OAuth flow with prompt=select_account
    // This is more reliable than window.google.accounts.id.prompt()
    try {
      const newUser = await loginWithGoogle();
      onUserChange(newUser);
      setShowAccountMenu(false);
    } catch (error) {
      console.error('Error switching account:', error);
    }
  };

  const handleManageGoogleAccount = () => {
    // Open Google Account management page in a new tab
    window.open('https://myaccount.google.com', '_blank', 'noopener,noreferrer');
    setShowAccountMenu(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Don't close if clicking on the toggle button (let the toggle handle it)
      if (toggleButtonRef.current && toggleButtonRef.current.contains(target)) {
        return;
      }
      // Close if clicking outside both the menu and the button
      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowAccountMenu(false);
      }
    };

    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAccountMenu]);

  // Render Google sign-in button when library is ready
  useEffect(() => {
    if (!user && isInitialized && buttonRef.current && window.google?.accounts?.id) {
      // Clear any existing content
      if (buttonRef.current) {
        buttonRef.current.innerHTML = '';
      }
      
      try {
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
          size: isSidebarCollapsed ? 'medium' : 'large',
          text: 'signin_with',
          width: isSidebarCollapsed ? '36' : '100%',
          shape: 'rectangular',
        });
      } catch (error) {
        console.error('Error rendering Google button:', error);
      }
    }
  }, [user, isInitialized, isSidebarCollapsed]);

  // Render Google account selector button when user is logged in (optional - for full Google UI)
  useEffect(() => {
    if (user && isInitialized && accountButtonRef.current && window.google?.accounts?.id && user.googleConnected) {
      // This renders the official Google account selector button
      // It provides the full account switching UI
      try {
        // Clear any existing content
        if (accountButtonRef.current) {
          accountButtonRef.current.innerHTML = '';
        }
        
        // Note: Google Identity Services doesn't have a direct "account selector" button
        // The account selector appears when you call prompt() or when users interact with the sign-in button
        // For logged-in users, we use our custom UI with the prompt() method
      } catch (error) {
        console.error('Error rendering Google account selector:', error);
      }
    }
  }, [user, isInitialized, user?.googleConnected]);

  if (!user) {
    // Show sign-in button when not logged in
    return (
      <div className="w-full">
        {isSidebarCollapsed ? (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
            onClick={() => {
              if (window.google?.accounts?.id && isInitialized) {
                window.google.accounts.id.prompt();
              } else {
                // Fallback to direct login
                loginWithGoogle().then(onUserChange).catch(console.error);
              }
            }}
            title="Sign in with Google"
          >
            <i className="fa-brands fa-google text-zinc-600 dark:text-zinc-300"></i>
          </div>
        ) : (
          <div ref={buttonRef} className="w-full flex justify-center">
            {!isInitialized && (
              <button
                onClick={() => loginWithGoogle().then(onUserChange).catch(console.error)}
                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition flex items-center justify-center gap-2"
              >
                <i className="fa-brands fa-google"></i>
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Show account menu when logged in
  return (
      <div className="relative w-full">
        <button
          ref={toggleButtonRef}
          id="account-menu-button"
          onClick={(e) => {
            e.stopPropagation();
            setShowAccountMenu(!showAccountMenu);
          }}
          aria-expanded={showAccountMenu}
          aria-haspopup="menu"
          aria-label={`Account menu for ${user.name}. Press Enter to open.`}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:translate-x-1 ${isSidebarCollapsed ? 'justify-center' : ''}`}
          title="Account menu"
        >
          <div className="w-9 h-9 min-w-[2.25rem] rounded-full overflow-hidden bg-gradient-to-br from-rose-500 to-pink-500 flex-shrink-0 border border-zinc-200 dark:border-zinc-800 ring-2 ring-transparent group-hover:ring-zinc-200 dark:group-hover:ring-zinc-800 transition-all flex items-center justify-center">
            {user.avatarUrl && !imageError ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <span className="text-white text-xs font-bold">
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            )}
          </div>
          {!isSidebarCollapsed && (
            <>
              <div className="flex flex-col text-left min-w-0 flex-1">
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white transition truncate tracking-wide">
                  {user.name}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-500 truncate font-medium">
                  {user.email}
                </span>
              </div>
              <i className={`fa-solid fa-chevron-down text-zinc-400 text-xs transition-transform duration-300 ${showAccountMenu ? 'rotate-180' : ''} group-hover:text-zinc-600 dark:group-hover:text-zinc-300`}></i>
            </>
          )}
        </button>

        {/* Account Menu Dropdown - Hybrid Google + Microsoft Design */}
        {showAccountMenu && (
          <div
            ref={menuRef}
            role="menu"
            aria-labelledby="account-menu-button"
            aria-orientation="vertical"
            className={`absolute ${isSidebarCollapsed ? 'left-full ml-2 top-0' : 'bottom-full mb-2 left-0 right-0'} bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden min-w-[280px]`}
          >
            {/* Current Account Info Card */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-zinc-100/50 dark:from-zinc-900/50 dark:to-zinc-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-rose-500 to-pink-500 flex-shrink-0 ring-2 ring-white/50 dark:ring-zinc-700/50 flex items-center justify-center">
                  {user.avatarUrl && !imageError ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <span className="text-white text-sm font-bold">
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {user.name}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {user.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Groups */}
            <div className="py-2 max-h-[60vh] overflow-y-auto">
              {/* Account Actions Group */}
              <div className="px-2 py-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">
                  Account Actions
                </div>
                <div className="space-y-0.5">
                  <button
                    role="menuitem"
                    onClick={handleSwitchAccount}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left group"
                    aria-label="Switch to a different Google account"
                  >
                    <i className="fa-solid fa-repeat w-5 flex-shrink-0 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"></i>
                    <span className="flex-1 text-left">Switch account</span>
                  </button>

                  <button
                    role="menuitem"
                    onClick={handleAddAccount}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left group"
                    aria-label="Add another Google account"
                  >
                    <i className="fa-solid fa-user-plus w-5 flex-shrink-0 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"></i>
                    <span className="flex-1 text-left">Add account</span>
                  </button>
                </div>
              </div>

              {/* Pulse Settings Group */}
              <div className="px-2 py-1 mt-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">
                  Pulse Settings
                </div>
                <div className="space-y-0.5">
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowAccountSettings(true);
                      setShowAccountMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left group"
                    aria-label="Manage Pulse account settings"
                  >
                    <i className="fa-solid fa-gear w-5 flex-shrink-0 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"></i>
                    <span className="flex-1 text-left">Account settings</span>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowPrivacyDashboard(true);
                      setShowAccountMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left group"
                    aria-label="View privacy and connected services"
                  >
                    <i className="fa-solid fa-shield-halved w-5 flex-shrink-0 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"></i>
                    <span className="flex-1 text-left">Privacy & connected services</span>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowHelpSupport(true);
                      setShowAccountMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left group"
                    aria-label="Get help and support"
                  >
                    <i className="fa-solid fa-circle-question w-5 flex-shrink-0 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"></i>
                    <span className="flex-1 text-left">Help & support</span>
                  </button>
                </div>
              </div>

              {/* Google Account Group */}
              {user.googleConnected && (
                <div className="px-2 py-1 mt-1">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">
                    Google Account
                  </div>
                  <div className="space-y-0.5">
                    <button
                      role="menuitem"
                      onClick={handleManageGoogleAccount}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors text-left group"
                      aria-label="Manage your Google Account"
                    >
                      <i className="fa-brands fa-google w-5 flex-shrink-0 text-blue-500 dark:text-blue-400"></i>
                      <span className="flex-1 text-left">Manage your Google Account</span>
                      <i className="fa-solid fa-external-link text-[10px] text-zinc-400"></i>
                    </button>
                  </div>
                </div>
              )}

              {/* Advanced Options - Collapsed (Microsoft-style) */}
              {user.googleConnected && (
                <details className="px-2 py-1 mt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 pt-2">
                  <summary className="px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg transition-colors flex items-center gap-2 select-none">
                    <i className="fa-solid fa-chevron-right text-[10px] transition-transform duration-200 [details[open]_&]:rotate-90"></i>
                    <span>Advanced options</span>
                    <span className="ml-auto text-[10px] px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded-full normal-case tracking-normal font-medium">
                      For power users
                    </span>
                  </summary>

                  <div className="mt-1 space-y-0.5 px-1">
                    <div className="px-3 py-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-2 mb-2">
                      <i className="fa-solid fa-triangle-exclamation flex-shrink-0 mt-0.5"></i>
                      <span className="text-[11px] leading-relaxed">
                        These actions are for advanced users and cannot be easily undone.
                      </span>
                    </div>

                    <button
                      role="menuitem"
                      onClick={handleDisconnectGoogle}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors text-left group"
                      aria-label="Disconnect your Google account"
                    >
                      <i className="fa-solid fa-unlink w-5 flex-shrink-0"></i>
                      <span className="flex-1 text-left">Disconnect Google Account</span>
                    </button>

                    <button
                      role="menuitem"
                      onClick={handleRevokeAccess}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left group"
                      aria-label="Revoke all access and sign out"
                    >
                      <i className="fa-solid fa-ban w-5 flex-shrink-0"></i>
                      <span className="flex-1 text-left">Revoke all access</span>
                    </button>
                  </div>
                </details>
              )}

              {/* Sign Out - Prominent */}
              <div className="border-t border-zinc-200 dark:border-zinc-800 mt-2 pt-2 px-2 pb-1">
                <button
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left group"
                  aria-label="Sign out of Pulse"
                >
                  <i className="fa-solid fa-right-from-bracket w-5 flex-shrink-0"></i>
                  <span className="flex-1 text-left">Sign out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Settings Modal */}
        {showAccountSettings && createPortal(
          <AccountSettingsModal
            isOpen={showAccountSettings}
            onClose={() => setShowAccountSettings(false)}
            userName={user.name}
            userEmail={user.email}
          />,
          document.body
        )}

        {/* Privacy Dashboard */}
        {showPrivacyDashboard && createPortal(
          <PrivacyDashboard
            isOpen={showPrivacyDashboard}
            onClose={() => setShowPrivacyDashboard(false)}
            userEmail={user.email}
          />,
          document.body
        )}

        {/* Help & Support Modal */}
        {showHelpSupport && createPortal(
          <HelpSupportModal
            isOpen={showHelpSupport}
            onClose={() => setShowHelpSupport(false)}
          />,
          document.body
        )}
      </div>
    );
};

export default GoogleAccountSelector;
