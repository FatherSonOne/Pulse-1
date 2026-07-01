import LandingPage from './components/LandingPage';
import About from './components/About';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';

// Both CTAs send the visitor into the authenticated shell via the ?signin
// handoff. main.tsx routes any ?signin URL to the full App (which owns the Login
// screen), so the heavy app graph downloads only when sign-in is actually
// intended — never just to read the marketing or legal pages.
const goSignup = () => { window.location.href = '/?signin&mode=signup'; };
const goSignin = () => { window.location.href = '/?signin'; };
const goHome = () => { window.location.href = '/'; };

/**
 * PublicApp — the marketing/legal shell for logged-out visitors.
 *
 * It imports ONLY the four context-free public components (LandingPage + the
 * legal/about pages) and nothing from App.tsx, so a cold marketing visitor never
 * downloads the authenticated app graph (LiveSession, Summit, messaging, AI
 * providers, office processors, the full service/provider tree). main.tsx is the
 * router: it mounts this shell only when there is no Supabase session token and
 * the path is a pure-marketing route (see PUBLIC_MARKETING_PATHS there). Every
 * other path — auth, app, the transactional public routes — falls through to the
 * lazily-loaded App. Keep this list in sync with the marketing branch of App's
 * public-route cascade (App.tsx ~L660-690), which still serves these paths when
 * the heavy app is the one mounted (e.g. a logged-in user navigating to them).
 */
export default function PublicApp() {
  const path = window.location.pathname;

  if (path === '/privacy') return <PrivacyPolicy onBack={goHome} />;
  if (path === '/terms') return <TermsOfService onBack={goHome} />;
  if (path === '/about') return <About onBack={goHome} />;

  if (path === '/features') {
    return <LandingPage variant="features" onGetStarted={goSignup} onSignIn={goSignin} />;
  }

  // /demo resolves to the live feature showcase. Rewrite to the canonical
  // /features via the History API (no second full document load), preserving the
  // hash for deep links — mirrors the App-side handler.
  if (path === '/demo') {
    window.history.replaceState(null, '', '/features' + window.location.hash);
    return <LandingPage variant="features" onGetStarted={goSignup} onSignIn={goSignin} />;
  }

  // Default: the quiet marketing home at /.
  return <LandingPage onGetStarted={goSignup} onSignIn={goSignin} />;
}
