/**
 * Base URL of the Pulse auxiliary Express backend (server.js).
 * Handles Slack/Twilio proxying, Gmail token refresh, and CRM OAuth callbacks.
 * Set VITE_BACKEND_URL to the deployed backend origin (no trailing slash) in production;
 * defaults to the local dev server.
 */
export const BACKEND_URL: string =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';
