/**
 * Layouts Module
 *
 * Export all layout components for the Pulse Messages application.
 *
 * @module layouts
 */

// Main Layout Component
export { MessagesLayout } from './MessagesLayout';
export type { default as MessagesLayoutDefault } from './MessagesLayout';

// Re-export sidebar components for convenience
export { SidebarTabs } from '../Sidebar/SidebarTabs';
export type { SidebarTabType } from '../Sidebar/SidebarTabs';
export { SidebarCollapsedIcons } from '../Sidebar/SidebarCollapsedIcons';
