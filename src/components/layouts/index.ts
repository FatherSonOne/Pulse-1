/**
 * Layouts Module
 *
 * Export all layout components for the Pulse Messages application.
 *
 * @module layouts
 */

// NOTE: MessagesLayout was removed 2026-05-31 with the v2 Messages rebuild.
// The live Messages surface is the legacy `Messages.tsx` (mounted directly by
// App), not a split-view layout. This barrel now only re-exports sidebar bits.

// Re-export sidebar components for convenience
export { SidebarTabs } from '../Sidebar/SidebarTabs';
export type { SidebarTabType } from '../Sidebar/SidebarTabs';
export { SidebarCollapsedIcons } from '../Sidebar/SidebarCollapsedIcons';
