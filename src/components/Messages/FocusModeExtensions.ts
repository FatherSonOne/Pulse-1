/**
 * Focus Mode Extensions - Component Exports
 *
 * This file exports all Focus Mode visual completion components:
 * - FocusDigestCard: Shows messages received during focus session
 * - DistractionBlockingOverlay: Semi-transparent overlay during focus
 * - SessionCompletionCelebration: Celebration animation on session complete
 * - FocusStatsDashboard: Statistics dashboard for focus sessions
 *
 * Import the CSS file separately:
 * import './FocusModeComponents.css';
 */

// Component Exports
export { FocusDigestCard } from './FocusDigestCard';
export type { DigestMessage, DigestGroup } from './FocusDigestCard';

export { DistractionBlockingOverlay } from './DistractionBlockingOverlay';

export { SessionCompletionCelebration } from './SessionCompletionCelebration';

export { FocusStatsDashboard } from './FocusStatsDashboard';

// Re-export existing components for convenience
export { FocusMode } from './FocusMode';
export { FocusTimer } from './FocusTimer';
export { FocusControls } from './FocusControls';

/**
 * Component Integration Guide
 * ===========================
 *
 * 1. FocusDigestCard
 *    Shows messages that arrived during focus session
 *
 *    Usage:
 *    ```tsx
 *    <FocusDigestCard
 *      isVisible={showDigest}
 *      messages={blockedMessages}
 *      sessionDuration={25}
 *      onReply={(threadId, messageId) => handleReply(threadId, messageId)}
 *      onDismiss={(messageId) => dismissMessage(messageId)}
 *      onSnooze={(messageId, minutes) => snoozeMessage(messageId, minutes)}
 *      onDismissAll={() => dismissAllMessages()}
 *      onViewThread={(threadId) => navigateToThread(threadId)}
 *      onClose={() => setShowDigest(false)}
 *    />
 *    ```
 *
 * 2. DistractionBlockingOverlay
 *    Displays during active focus sessions
 *
 *    Usage:
 *    ```tsx
 *    <DistractionBlockingOverlay
 *      isActive={isFocusModeActive}
 *      mode={currentMode} // 'work' | 'break'
 *      timeRemaining={timeRemainingSeconds}
 *      totalTime={totalTimeSeconds}
 *      breakCount={completedBreaks}
 *      sessionGoal="Complete project documentation"
 *      onEmergencyEnd={() => endFocusSession()}
 *      blockedNotifications={5}
 *    />
 *    ```
 *
 * 3. SessionCompletionCelebration
 *    Shows when a focus session completes successfully
 *
 *    Usage:
 *    ```tsx
 *    <SessionCompletionCelebration
 *      isVisible={showCelebration}
 *      stats={{
 *        duration: 25,
 *        messagesBlocked: 12,
 *        breaksTaken: 1,
 *        focusScore: 92
 *      }}
 *      streak={{
 *        currentStreak: 5,
 *        isNewRecord: false,
 *        longestStreak: 7
 *      }}
 *      onStartAnother={() => startNewSession()}
 *      onClose={() => setShowCelebration(false)}
 *      onViewStats={() => openStatsModal()}
 *    />
 *    ```
 *
 * 4. FocusStatsDashboard
 *    Comprehensive statistics view
 *
 *    Usage:
 *    ```tsx
 *    <FocusStatsDashboard
 *      isVisible={showStats}
 *      stats={focusSessionStats}
 *      dailyData={last30DaysData}
 *      onClose={() => setShowStats(false)}
 *      userId={currentUserId}
 *    />
 *    ```
 *
 * Animation Specifications (Framer Motion)
 * ========================================
 *
 * All components use consistent animation patterns:
 *
 * Entry Animations:
 * - Container: opacity 0->1, scale 0.95->1, y 20->0 (duration: 400ms)
 * - Items: Staggered children with 100ms delay
 * - Spring physics: stiffness 300, damping 25
 *
 * Exit Animations:
 * - Container: opacity 1->0, scale 1->0.95, y 0->-20 (duration: 300ms)
 * - Faster exit for responsive feel
 *
 * Interactive States:
 * - Hover: scale 1.02, slight shadow increase
 * - Tap: scale 0.98
 * - Focus: 2px blue outline with 2px offset
 *
 * Micro-interactions:
 * - Progress bars: width transition 500ms ease-out
 * - Counters: Animated counting with easing
 * - Icons: Rotation and scale on state change
 * - Confetti: Canvas-based particle system
 */
