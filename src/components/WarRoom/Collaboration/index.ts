/**
 * Collaboration Components
 * Sharing, activity feed, and collaboration features
 */

export { ShareModal, default as ShareModalDefault } from './ShareModal';
export { PresenceAvatars } from './PresenceAvatars';
// ActivityFeed + SharedWithMe cut for v1 (D1, solo-first lane) — orphaned UI,
// never rendered in either shell. Their collaborationService functions
// (getActivityFeed/clearActivityFeed/getSharedWithMe) stay dormant for a
// future multiplayer re-wire.
