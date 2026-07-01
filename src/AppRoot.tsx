import { LoadingProvider } from './contexts/LoadingContext';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';

/**
 * AppRoot — the authenticated-app root, lazy-loaded by main.tsx.
 *
 * The providers live HERE rather than in main.tsx on purpose: AuthProvider's
 * static import tree is AuthContext -> authService -> dataService -> the entire
 * messaging / email / calendar / AI / office service+feature graph. Keeping the
 * providers in this lazy chunk means none of that is reachable from the entry
 * module, so a cold marketing visitor (served the provider-free PublicApp) never
 * downloads it. A returning authenticated user loads this chunk on demand.
 */
export default function AppRoot() {
  return (
    <LoadingProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LoadingProvider>
  );
}
