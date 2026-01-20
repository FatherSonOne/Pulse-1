/**
 * Re-export useAuth hook for convenient importing
 *
 * Usage:
 * ```tsx
 * import { useAuth } from '../hooks/useAuth';
 *
 * const MyComponent = () => {
 *   const { user, isAuthenticated, loginWithGoogle } = useAuth();
 *
 *   return (
 *     <div>
 *       {isAuthenticated ? (
 *         <p>Welcome, {user?.name}!</p>
 *       ) : (
 *         <button onClick={loginWithGoogle}>Login with Google</button>
 *       )}
 *     </div>
 *   );
 * };
 * ```
 */
export { useAuth, withAuth } from '../contexts/AuthContext';
