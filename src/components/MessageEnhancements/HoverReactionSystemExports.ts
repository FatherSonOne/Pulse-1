/**
 * Hover Reaction System - Exports
 *
 * Centralized exports for the Phase 3 Hover Reaction System.
 * Import from this file for clean, organized imports.
 */

// Core Hook
export { useHoverWithDelay } from '../../hooks/useHoverWithDelay';
export type { UseHoverWithDelayOptions, UseHoverWithDelayReturn } from '../../hooks/useHoverWithDelay';

// Core Components
export { HoverReactionTrigger } from './HoverReactionTrigger';
export type { HoverReactionTriggerProps } from './HoverReactionTrigger';

export {
  AnimatedReactions,
  QuickReactionBar,
  default as AnimatedReactionsDefault
} from './AnimatedReactions';

// Examples
export {
  MessageWithHoverReactions,
  MessageThreadExample,
  AdvancedHoverReactionExample
} from './HoverReactionExample';

/**
 * Quick Start Example:
 *
 * ```tsx
 * import {
 *   HoverReactionTrigger,
 *   QuickReactionBar,
 *   AnimatedReactions
 * } from './MessageEnhancements/HoverReactionSystemExports';
 *
 * function Message({ message }) {
 *   return (
 *     <HoverReactionTrigger
 *       messageId={message.id}
 *       onReact={handleReaction}
 *       renderReactionBar={(props) => <QuickReactionBar {...props} />}
 *     >
 *       <div>{message.content}</div>
 *     </HoverReactionTrigger>
 *   );
 * }
 * ```
 */
