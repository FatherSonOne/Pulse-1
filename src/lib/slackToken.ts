/**
 * Slack bot-token persistence (contactsHybrid Phase 8).
 *
 * The Slack integration is bring-your-own BOT TOKEN (xoxb-), not OAuth. Until
 * Phase 8 the token lived only in React state seeded from a build-time env var
 * (VITE_SLACK_BOT_TOKEN), so it evaporated on reload and was unreachable from
 * anywhere but the settings card. The Contacts Slack send path needs the token
 * outside React, so we persist it per-user in localStorage and expose a plain
 * (non-React) reader — mirroring src/lib/emailFeature.ts.
 *
 * Decision D-C (docs/SLACK_PHASE8_SCOPE_2026-06-05.md): per-user localStorage,
 * NOT workspace_integrations.shared_config (which is member-readable + unencrypted).
 * The token is never written to our DB; it is forwarded per-request to
 * /api/slack/proxy as a Bearer. Treat it as a secret: do not log it.
 */

export const SLACK_TOKEN_KEY = 'pulse_slack_bot_token';

/** Current persisted bot token, or '' when none / storage is unavailable. */
export function getSlackBotToken(): string {
  try {
    return localStorage.getItem(SLACK_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/** Persist a token (trimmed). An empty/blank value clears it. */
export function setSlackBotToken(token: string): void {
  try {
    const trimmed = (token || '').trim();
    if (trimmed) {
      localStorage.setItem(SLACK_TOKEN_KEY, trimmed);
    } else {
      localStorage.removeItem(SLACK_TOKEN_KEY);
    }
  } catch {
    /* storage unavailable (private mode / SSR) — token stays in memory only */
  }
}

/** Remove the persisted token (e.g. on disconnect). */
export function clearSlackBotToken(): void {
  try {
    localStorage.removeItem(SLACK_TOKEN_KEY);
  } catch {
    /* noop */
  }
}

/** True when a non-empty token is persisted (gates the Contacts send UI). */
export function hasSlackBotToken(): boolean {
  return getSlackBotToken() !== '';
}
