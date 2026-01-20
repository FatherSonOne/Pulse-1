import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import {
  getSessionUser,
  getSessionUserSync,
  onAuthStateChange,
  loginWithGoogle,
  loginWithMicrosoft,
  loginWithEmail,
  signUpWithEmail,
  logoutUser,
  connectProvider,
  syncGoogleContacts,
  revokeGoogleAccess,
  disconnectGoogleAccount,
  forceRefreshSession,
  isSessionValid,
} from '../services/authService';

/**
 * Authentication Context Interface
 * Provides user authentication state and methods throughout the application
 */
interface AuthContextType {
  // Current user state
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Authentication methods
  loginWithGoogle: () => Promise<User>;
  loginWithMicrosoft: () => Promise<User>;
  loginWithEmail: (email: string, password: string) => Promise<User>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<User>;
  logout: () => Promise<void>;

  // Provider connection
  connectProvider: (provider: 'google' | 'microsoft' | 'icloud') => Promise<boolean>;
  disconnectGoogle: () => Promise<void>;
  revokeGoogleAccess: () => Promise<void>;

  // Session management
  refreshSession: () => Promise<boolean>;
  checkSessionValid: () => Promise<boolean>;

  // Data sync
  syncContacts: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 * Manages authentication state and provides auth methods to the application
 *
 * Features:
 * - Automatic session restoration on mount
 * - Real-time auth state updates via Supabase subscriptions
 * - Proactive session refresh
 * - Multi-provider OAuth support (Google, Microsoft)
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize authentication state on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to get cached user synchronously for faster initial render
        const cachedUser = getSessionUserSync();
        if (cachedUser) {
          setUser(cachedUser);
        }

        // Then validate session asynchronously
        const sessionUser = await getSessionUser();
        setUser(sessionUser);
      } catch (error) {
        console.error('[AuthProvider] Failed to initialize auth:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((newUser) => {
      console.log('[AuthProvider] Auth state changed:', newUser?.email || 'logged out');
      setUser(newUser);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Session refresh on visibility change (user returns to app)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && user) {
        const isValid = await isSessionValid();
        if (!isValid) {
          console.log('[AuthProvider] Session expired, refreshing...');
          const refreshed = await forceRefreshSession();
          if (!refreshed) {
            console.warn('[AuthProvider] Session refresh failed, user may need to re-authenticate');
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Wrap auth methods with error handling and loading states
  const handleLogin = async (
    loginFn: () => Promise<User>,
    providerName: string
  ): Promise<User> => {
    try {
      setIsLoading(true);
      const loggedInUser = await loginFn();
      setUser(loggedInUser);
      return loggedInUser;
    } catch (error: any) {
      console.error(`[AuthProvider] ${providerName} login failed:`, error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await logoutUser();
      setUser(null);
    } catch (error) {
      console.error('[AuthProvider] Logout failed:', error);
      // Even if logout fails, clear local state
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectProvider = async (
    provider: 'google' | 'microsoft' | 'icloud'
  ): Promise<boolean> => {
    try {
      const success = await connectProvider(provider);
      if (success) {
        // Refresh user data after connecting provider
        const updatedUser = await getSessionUser();
        setUser(updatedUser);
      }
      return success;
    } catch (error) {
      console.error('[AuthProvider] Connect provider failed:', error);
      return false;
    }
  };

  const handleSyncContacts = async (): Promise<void> => {
    try {
      await syncGoogleContacts();
    } catch (error) {
      console.error('[AuthProvider] Sync contacts failed:', error);
      throw error;
    }
  };

  const handleDisconnectGoogle = async (): Promise<void> => {
    try {
      await disconnectGoogleAccount();
      setUser(null);
    } catch (error) {
      console.error('[AuthProvider] Disconnect Google failed:', error);
      // Clear user anyway
      setUser(null);
    }
  };

  const handleRevokeGoogleAccess = async (): Promise<void> => {
    try {
      await revokeGoogleAccess();
      setUser(null);
    } catch (error) {
      console.error('[AuthProvider] Revoke Google access failed:', error);
      // Clear user anyway
      setUser(null);
    }
  };

  const handleRefreshSession = async (): Promise<boolean> => {
    try {
      return await forceRefreshSession();
    } catch (error) {
      console.error('[AuthProvider] Refresh session failed:', error);
      return false;
    }
  };

  const handleCheckSessionValid = async (): Promise<boolean> => {
    try {
      return await isSessionValid();
    } catch (error) {
      console.error('[AuthProvider] Check session valid failed:', error);
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    loginWithGoogle: () => handleLogin(loginWithGoogle, 'Google'),
    loginWithMicrosoft: () => handleLogin(loginWithMicrosoft, 'Microsoft'),
    loginWithEmail: (email: string, password: string) =>
      handleLogin(() => loginWithEmail(email, password), 'Email'),
    signUpWithEmail: (email: string, password: string, name: string) =>
      handleLogin(() => signUpWithEmail(email, password, name), 'Email Signup'),
    logout: handleLogout,
    connectProvider: handleConnectProvider,
    disconnectGoogle: handleDisconnectGoogle,
    revokeGoogleAccess: handleRevokeGoogleAccess,
    refreshSession: handleRefreshSession,
    checkSessionValid: handleCheckSessionValid,
    syncContacts: handleSyncContacts,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to access authentication context
 *
 * Usage:
 * ```tsx
 * const { user, isAuthenticated, loginWithGoogle } = useAuth();
 * ```
 *
 * @throws {Error} If used outside of AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * HOC to require authentication for a component
 *
 * Usage:
 * ```tsx
 * export default withAuth(MyProtectedComponent);
 * ```
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return (props: P) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Authentication Required
            </h1>
            <p className="text-gray-600">Please log in to access this page.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
