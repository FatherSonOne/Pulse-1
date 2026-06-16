import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../types';
import { loginWithGoogle, logoutUser, revokeGoogleAccess, disconnectGoogleAccount } from '../services/authService';
import { pulseService } from '../services/pulseService';
import { AccountSettingsModal, PrivacyDashboard, HelpSupportModal } from './Account';
import './GoogleAccountSelector.css';

import { AlertTriangle, Ban, ChevronDown, ChevronRight, ExternalLink, HelpCircle, LogOut, Repeat, Settings, ShieldHalf, Unlink, UserPlus, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';

type DangerAction = {
  kind: 'disconnect' | 'revoke';
  title: string;
  body: string;
  confirmLabel: string;
  run: () => Promise<void>;
};

interface GoogleAccountSelectorProps {
  user: User | null;
  onUserChange: (user: User | null) => void;
  isSidebarCollapsed: boolean;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  onOpenFullSettings?: (section?: string) => void;
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

let gsiInitializedForClientId: string | null = null;

const GoogleAccountSelector: React.FC<GoogleAccountSelectorProps> = ({
  user,
  onUserChange,
  isSidebarCollapsed,
  isDarkMode,
  onToggleTheme,
  onOpenFullSettings,
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [imageError, setImageError] = useState(false);
  // Avatar set on the Pulse profile (Settings → My Account). When present this
  // takes priority over the OAuth provider picture so the image the user
  // uploads in Pulse actually shows on the account chip. Null until loaded /
  // when the user has never set one — then we fall back to user.avatarUrl
  // (Google `picture` / Microsoft `avatar_url` / ui-avatars generated fallback).
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modal states
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showPrivacyDashboard, setShowPrivacyDashboard] = useState(false);
  const [showHelpSupport, setShowHelpSupport] = useState(false);
  const [pendingDanger, setPendingDanger] = useState<DangerAction | null>(null);
  const [dangerBusy, setDangerBusy] = useState(false);

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

      // Skip re-initialization if already done for this client ID (e.g. StrictMode double-mount)
      if (gsiInitializedForClientId === GOOGLE_CLIENT_ID) {
        setIsInitialized(true);
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

        gsiInitializedForClientId = GOOGLE_CLIENT_ID;
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

  // Prefer the Pulse profile avatar (Settings → My Account) over the OAuth
  // provider picture. Fetched once per signed-in account; re-fetched on account
  // switch via the user.id dependency. A `pulse:profile-updated` CustomEvent
  // (dispatched by AccountSettings on upload/save) keeps the chip live without a
  // reload. Failures are swallowed — we simply fall back to user.avatarUrl.
  useEffect(() => {
    if (!user) {
      setProfileAvatarUrl(null);
      return;
    }

    let cancelled = false;
    const applyAvatar = (url: string | null) => {
      if (cancelled) return;
      if (url) {
        setImageError(false);
        setProfileAvatarUrl(url);
      } else {
        setProfileAvatarUrl(null);
      }
    };

    pulseService
      .getCurrentProfile()
      .then((profile) => applyAvatar(profile?.avatar_url || null))
      .catch((error) => console.error('Error loading Pulse profile avatar:', error));

    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ avatarUrl?: string | null }>).detail;
      if (detail && 'avatarUrl' in detail) applyAvatar(detail.avatarUrl ?? null);
    };
    window.addEventListener('pulse:profile-updated', handleProfileUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('pulse:profile-updated', handleProfileUpdated);
    };
  }, [user?.id]);

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

  const handleDisconnectGoogle = () => {
    setShowAccountMenu(false);
    setPendingDanger({
      kind: 'disconnect',
      title: 'Disconnect Google account?',
      body: "Pulse will lose access to Gmail, Calendar, and Drive. You'll be signed out and can reconnect any time.",
      confirmLabel: 'Disconnect',
      run: async () => {
        await disconnectGoogleAccount();
        onUserChange(null);
      },
    });
  };

  const handleRevokeAccess = () => {
    setShowAccountMenu(false);
    setPendingDanger({
      kind: 'revoke',
      title: 'Revoke all access?',
      body: "This fully removes Pulse from your Google Account permissions. You'll be signed out and will need to grant access again from scratch.",
      confirmLabel: 'Revoke access',
      run: async () => {
        await revokeGoogleAccess();
        onUserChange(null);
      },
    });
  };

  const runPendingDanger = useCallback(async () => {
    if (!pendingDanger) return;
    setDangerBusy(true);
    try {
      await pendingDanger.run();
      setPendingDanger(null);
    } catch (error) {
      console.error(`Error during ${pendingDanger.kind}:`, error);
      const fallback = pendingDanger.kind === 'disconnect'
        ? "Couldn't disconnect. Try again, or disconnect from Google Account settings."
        : "Couldn't revoke access. Try again, or revoke from Google Account settings.";
      toast.error(fallback);
    } finally {
      setDangerBusy(false);
    }
  }, [pendingDanger]);

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

  // Global hotkey: Cmd+, (mac) / Ctrl+, (win/linux) opens the quick-settings
  // launcher. Only active while the user is signed in. Skip when focus is in
  // an editable field so we don't steal a literal "," keystroke.
  useEffect(() => {
    if (!user) return;

    const handleHotkey = (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier || event.key !== ',') return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      setShowAccountMenu(false);
      setShowAccountSettings(true);
    };

    document.addEventListener('keydown', handleHotkey);
    return () => document.removeEventListener('keydown', handleHotkey);
  }, [user]);

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

  // Keyboard navigation: Esc closes (refocus trigger), Arrow/Home/End walks menuitems.
  useEffect(() => {
    if (!showAccountMenu) return;

    const getItems = (): HTMLElement[] => {
      if (!menuRef.current) return [];
      return Array.from(
        menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')
      );
    };

    const handleKey = (event: KeyboardEvent) => {
      const items = getItems();
      if (items.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const currentIndex = active ? items.indexOf(active) : -1;

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          setShowAccountMenu(false);
          toggleButtonRef.current?.focus();
          break;
        case 'ArrowDown':
          event.preventDefault();
          items[(currentIndex + 1 + items.length) % items.length]?.focus();
          break;
        case 'ArrowUp':
          event.preventDefault();
          items[(currentIndex - 1 + items.length) % items.length]?.focus();
          break;
        case 'Home':
          event.preventDefault();
          items[0]?.focus();
          break;
        case 'End':
          event.preventDefault();
          items[items.length - 1]?.focus();
          break;
        case 'Tab':
          // Let Tab close the menu so focus continues into the page.
          setShowAccountMenu(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKey);

    // Focus first item on open (next tick so DOM is mounted).
    const focusTimer = window.setTimeout(() => {
      const items = getItems();
      items[0]?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKey);
      window.clearTimeout(focusTimer);
    };
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
          <button
            type="button"
            className="pulse-account-menu__signin-collapsed"
            onClick={() => {
              if (window.google?.accounts?.id && isInitialized) {
                window.google.accounts.id.prompt();
              } else {
                loginWithGoogle().then(onUserChange).catch(console.error);
              }
            }}
            aria-label="Sign in with Google"
            title="Sign in with Google"
          >
            <UserIcon size={16} aria-hidden="true" />
          </button>
        ) : (
          <div ref={buttonRef} className="w-full flex justify-center">
            {!isInitialized && (
              <button
                type="button"
                onClick={() => loginWithGoogle().then(onUserChange).catch(console.error)}
                className="pulse-account-menu__signin"
              >
                <UserIcon size={16} aria-hidden="true" />
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  // Pulse profile avatar wins; OAuth picture / ui-avatars fallback is the backstop.
  const displayAvatarUrl = profileAvatarUrl || user.avatarUrl;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform);
  const hotkeyHint = isMac ? '⌘,' : 'Ctrl+,';

  // Show account menu when logged in
  return (
      <div className="relative w-full">
        <button
          ref={toggleButtonRef}
          type="button"
          id="account-menu-button"
          onClick={(e) => {
            e.stopPropagation();
            setShowAccountMenu(!showAccountMenu);
          }}
          aria-expanded={showAccountMenu}
          aria-haspopup="menu"
          aria-label="Account menu"
          className={`pulse-account-menu__trigger ${isSidebarCollapsed ? 'pulse-account-menu__trigger--collapsed' : ''}`}
          title="Account menu"
        >
          <div className="pulse-account-menu__trigger-avatar">
            {displayAvatarUrl && !imageError ? (
              <img
                src={displayAvatarUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <span aria-hidden="true">{initials}</span>
            )}
          </div>
          {!isSidebarCollapsed && (
            <>
              <div className="pulse-account-menu__trigger-text">
                <span className="pulse-account-menu__trigger-name">
                  {user.name}
                </span>
                <span className="pulse-account-menu__trigger-email">
                  {user.email}
                </span>
              </div>
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={`pulse-account-menu__trigger-caret ${showAccountMenu ? 'is-open' : ''}`}
              />
            </>
          )}
        </button>

        {/* Account Menu Dropdown */}
        {showAccountMenu && (
          <div
            ref={menuRef}
            role="menu"
            aria-labelledby="account-menu-button"
            aria-orientation="vertical"
            className={`pulse-account-menu__panel ${isSidebarCollapsed ? 'pulse-account-menu__panel--collapsed' : 'pulse-account-menu__panel--inline'}`}
          >
            {/* Header — the signature coral moment */}
            <div className="pulse-account-menu__header">
              <div className="pulse-account-menu__header-avatar">
                {displayAvatarUrl && !imageError ? (
                  <img
                    src={displayAvatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <span aria-hidden="true">{initials}</span>
                )}
              </div>
              <div className="pulse-account-menu__header-text">
                <div className="pulse-account-menu__header-name">
                  {user.name}
                </div>
                <div className="pulse-account-menu__header-email">
                  {user.email}
                </div>
              </div>
            </div>

            {/* Scrollable middle (groups) */}
            <div className="pulse-account-menu__scroll">
              {/* Account group */}
              <div className="pulse-account-menu__group">
                <div className="pulse-label pulse-account-menu__group-label">Account</div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSwitchAccount}
                  className="pulse-account-menu__item"
                >
                  <Repeat size={16} aria-hidden="true" className="pulse-account-menu__item-icon" />
                  <span className="pulse-account-menu__item-label">Switch account</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleAddAccount}
                  className="pulse-account-menu__item"
                >
                  <UserPlus size={16} aria-hidden="true" className="pulse-account-menu__item-icon" />
                  <span className="pulse-account-menu__item-label">Add account</span>
                </button>
              </div>

              {/* Pulse group */}
              <div className="pulse-account-menu__group">
                <div className="pulse-label pulse-account-menu__group-label">Pulse</div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowAccountSettings(true);
                    setShowAccountMenu(false);
                  }}
                  className="pulse-account-menu__item"
                >
                  <Settings size={16} aria-hidden="true" className="pulse-account-menu__item-icon" />
                  <span className="pulse-account-menu__item-label">Account settings</span>
                  <kbd className="pulse-account-menu__item-kbd" aria-hidden="true">
                    {hotkeyHint}
                  </kbd>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowPrivacyDashboard(true);
                    setShowAccountMenu(false);
                  }}
                  className="pulse-account-menu__item"
                >
                  <ShieldHalf size={16} aria-hidden="true" className="pulse-account-menu__item-icon" />
                  <span className="pulse-account-menu__item-label">Privacy &amp; connected services</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowHelpSupport(true);
                    setShowAccountMenu(false);
                  }}
                  className="pulse-account-menu__item"
                >
                  <HelpCircle size={16} aria-hidden="true" className="pulse-account-menu__item-icon" />
                  <span className="pulse-account-menu__item-label">Help &amp; support</span>
                </button>
              </div>

              {/* Google group */}
              {user.googleConnected && (
                <div className="pulse-account-menu__group">
                  <div className="pulse-label pulse-account-menu__group-label">Google</div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleManageGoogleAccount}
                    className="pulse-account-menu__item"
                  >
                    <UserIcon size={16} aria-hidden="true" className="pulse-account-menu__item-icon" />
                    <span className="pulse-account-menu__item-label">Manage Google Account</span>
                    <ExternalLink size={12} aria-hidden="true" className="pulse-account-menu__item-trailing" />
                  </button>
                </div>
              )}

              {/* Advanced — collapsed by default */}
              {user.googleConnected && (
                <details className="pulse-account-menu__advanced">
                  <summary className="pulse-label pulse-account-menu__advanced-summary">
                    <ChevronRight size={12} aria-hidden="true" className="pulse-account-menu__advanced-caret" />
                    <span>Advanced</span>
                  </summary>
                  <div className="pulse-account-menu__advanced-body">
                    <div className="pulse-account-menu__advanced-warn">
                      <AlertTriangle size={14} aria-hidden="true" />
                      <span>These actions sign you out and can&rsquo;t be quickly undone.</span>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleDisconnectGoogle}
                      className="pulse-account-menu__item pulse-account-menu__item--warning"
                    >
                      <Unlink size={16} aria-hidden="true" className="pulse-account-menu__item-icon" />
                      <span className="pulse-account-menu__item-label">Disconnect Google account</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleRevokeAccess}
                      className="pulse-account-menu__item pulse-account-menu__item--danger"
                    >
                      <Ban size={16} aria-hidden="true" className="pulse-account-menu__item-icon" />
                      <span className="pulse-account-menu__item-label">Revoke all access</span>
                    </button>
                  </div>
                </details>
              )}
            </div>

            {/* Sign Out — pinned outside the scroll */}
            <div className="pulse-account-menu__footer">
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="pulse-account-menu__item pulse-account-menu__item--danger"
              >
                <LogOut size={16} aria-hidden="true" className="pulse-account-menu__item-icon" />
                <span className="pulse-account-menu__item-label">Sign out</span>
              </button>
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
            avatarUrl={displayAvatarUrl}
            isDarkMode={isDarkMode}
            onToggleTheme={onToggleTheme}
            onOpenFullSettings={(section) => {
              setShowAccountSettings(false);
              onOpenFullSettings?.(section);
            }}
            returnFocusRef={toggleButtonRef}
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

        {/* Danger confirmation (Disconnect / Revoke) */}
        {pendingDanger && createPortal(
          <DangerConfirmModal
            action={pendingDanger}
            busy={dangerBusy}
            onCancel={() => !dangerBusy && setPendingDanger(null)}
            onConfirm={runPendingDanger}
          />,
          document.body
        )}
      </div>
    );
};

interface DangerConfirmModalProps {
  action: DangerAction;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DangerConfirmModal: React.FC<DangerConfirmModalProps> = ({ action, busy, onCancel, onConfirm }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [busy, onCancel]);

  return (
    <div
      className="pulse-danger-modal__scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-labelledby="pulse-danger-title"
        aria-describedby="pulse-danger-body"
        className="pulse-danger-modal"
      >
        <div className="pulse-danger-modal__icon" aria-hidden="true">
          <AlertTriangle size={20} />
        </div>
        <h2 id="pulse-danger-title" className="pulse-danger-modal__title">
          {action.title}
        </h2>
        <p id="pulse-danger-body" className="pulse-danger-modal__body">
          {action.body}
        </p>
        <div className="pulse-danger-modal__actions">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="pulse-danger-modal__cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="pulse-danger-modal__confirm"
          >
            {busy ? 'Working…' : action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoogleAccountSelector;
