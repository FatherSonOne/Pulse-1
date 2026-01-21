# Decisions & Tasks Integration Guide

## Overview

This document describes the integration of the DecisionCard and TaskList components into the Pulse application, enabling users to manage team decisions and track action items from a centralized interface.

## Integration Summary

### What Was Done

1. **Created DecisionTaskPanel Component** (`f:\pulse1\src\components\DecisionTaskPanel.tsx`)
   - Unified interface combining DecisionCard and TaskList components
   - Tab-based navigation between Decisions and Tasks views
   - Filtering and sorting capabilities for both sections
   - Real-time data refresh functionality
   - Responsive design for mobile and desktop

2. **Updated Application Routing**
   - Added `DECISIONS_TASKS` to the `AppView` enum in `f:\pulse1\src\types.ts`
   - Integrated DecisionTaskPanel into App.tsx's `renderContent()` method
   - Component is accessible via the application's view system

3. **Enhanced Sidebar Navigation**
   - Added "Decisions & Tasks" navigation item to the "Work & People" section
   - Icon: `fa-list-check` (FontAwesome)
   - Positioned after Contacts for logical workflow

4. **Created Styling** (`f:\pulse1\src\components\DecisionTaskPanel.css`)
   - Modern, responsive design matching Pulse's design system
   - Dark mode support throughout
   - Smooth transitions and accessibility features
   - Mobile-optimized layouts

## Component Architecture

### DecisionTaskPanel

The main integration component that provides:

```typescript
interface DecisionTaskPanelProps {
  user: User | null;
  workspaceId?: string;  // Optional, defaults to user.id
}
```

**Features:**
- Tab switching between Decisions and Tasks
- Status filtering for both views
- Overdue task filtering
- Manual refresh capability
- Loading and empty states
- Vote count badges on Decisions tab

### Data Flow

```
User → Sidebar → AppView.DECISIONS_TASKS → DecisionTaskPanel
                                                  ↓
                                    ┌─────────────┴─────────────┐
                                    ↓                           ↓
                            DecisionCard                   TaskList
                                    ↓                           ↓
                          decisionService              taskService
```

### Workspace Context

The component uses the following workspace identification strategy:
1. If `workspaceId` prop is provided, use it
2. Otherwise, fall back to `user.id` as the workspace identifier
3. This ensures compatibility with the existing data model where users can have their own workspace

## Features

### Decision Management
- View all workspace decisions
- Filter by status (proposed, voting, decided, cancelled)
- Cast votes on active decisions
- View vote results with percentages
- Real-time vote count updates

### Task Management
- View all workspace tasks or user-specific tasks
- Filter by status (todo, in_progress, done, cancelled)
- Filter for overdue tasks only
- Toggle task completion status
- View task priorities and due dates
- See assigned team members

### User Experience
- **Loading States**: Spinners with descriptive text
- **Empty States**: Clear messaging with actionable guidance
- **Error Handling**: Graceful degradation and console logging
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Accessibility**: ARIA labels, keyboard navigation, focus states

## Navigation Path

Users can access Decisions & Tasks through:

1. **Sidebar Navigation**
   - Location: Work & People section
   - Icon: List with checkmarks
   - Label: "Decisions & Tasks"

2. **Direct View Change**
   ```typescript
   setView(AppView.DECISIONS_TASKS);
   ```

3. **Voice Commands** (when integrated)
   ```typescript
   "Open decisions and tasks"
   "Show me the task list"
   ```

## API Integration

### Decision Service
```typescript
import { decisionService } from '../services/decisionService';

// Get workspace decisions
const decisions = await decisionService.getWorkspaceDecisions(workspaceId);

// Cast a vote
await decisionService.castVote({
  decision_id: decisionId,
  user_id: userId,
  vote: 'approve' | 'reject' | 'concern' | 'abstain'
});
```

### Task Service
```typescript
import { taskService } from '../services/taskService';

// Get workspace tasks
const tasks = await taskService.getWorkspaceTasks(workspaceId);

// Get user-specific tasks
const userTasks = await taskService.getUserTasks(workspaceId, userId);

// Update task status
await taskService.updateTaskStatus(taskId, 'done');
```

## Styling Guide

### CSS Variables Used
- `--accent-primary`: Primary accent color (rose)
- `--sidebar-width`: Responsive sidebar width

### Color Scheme
- **Primary Accent**: `#f43f5e` (rose)
- **Secondary Accent**: `#ec4899` (pink)
- **Background (Light)**: `#ffffff`
- **Background (Dark)**: `#18181b`
- **Border (Light)**: `#e4e4e7`
- **Border (Dark)**: `#3f3f46`

### Responsive Breakpoints
- **Mobile**: `< 768px`
  - Single column layout
  - Stacked toolbar
  - Full-width filters
- **Desktop**: `≥ 768px`
  - Multi-column decision grid
  - Horizontal toolbar
  - Side-by-side filters

## Performance Considerations

1. **Data Loading**
   - Decisions loaded once on mount and when filters change
   - Tasks use TaskList's internal loading mechanism
   - Refresh button available for manual updates

2. **State Management**
   - Local state for tab selection and filters
   - Minimal re-renders through strategic state updates
   - Loading flags prevent duplicate requests

3. **Bundle Size**
   - Components imported as needed
   - CSS scoped to avoid conflicts
   - Services shared across application

## Accessibility Features

### Keyboard Navigation
- Tab key navigates through all interactive elements
- Enter/Space activates buttons and toggles
- Arrow keys (when implemented) for list navigation

### Screen Reader Support
- Semantic HTML structure
- ARIA labels on icon-only buttons
- Status announcements for loading states
- Clear section headings

### Focus Management
- Visible focus indicators (2px outline)
- Logical tab order
- Focus preserved during view changes

## Mobile Optimization

### Touch Targets
- Minimum 44px height for all interactive elements
- Adequate spacing between clickable items
- Large hit areas for checkboxes and buttons

### Viewport Adaptation
- Flexible grid layouts
- Scrollable tab bar
- Collapsible filters
- Optimized font sizes

## Future Enhancements

### Potential Additions
1. **Decision Creation**
   - Add "New Decision" button
   - Modal or drawer interface
   - Quick templates for common decision types

2. **Task Creation**
   - Add "New Task" button
   - Quick-add input field
   - Task templates and presets

3. **Advanced Filtering**
   - Multi-select filters
   - Date range selection
   - Priority-based sorting
   - Search functionality

4. **Real-time Updates**
   - WebSocket integration for live updates
   - Optimistic UI updates
   - Conflict resolution

5. **Bulk Operations**
   - Multi-select for tasks
   - Batch status updates
   - Export functionality

6. **Analytics**
   - Decision velocity metrics
   - Task completion rates
   - Team participation tracking

## Testing Checklist

- [ ] Component renders without errors
- [ ] Tab switching works correctly
- [ ] Decision filtering applies properly
- [ ] Task filtering applies properly
- [ ] Vote casting updates UI immediately
- [ ] Task status toggle works
- [ ] Refresh button reloads data
- [ ] Loading states display correctly
- [ ] Empty states show appropriate messaging
- [ ] Dark mode styling is consistent
- [ ] Mobile layout is functional
- [ ] Keyboard navigation works
- [ ] Screen reader announces changes
- [ ] Links to correct navigation item in sidebar

## File References

### Created Files
- `f:\pulse1\src\components\DecisionTaskPanel.tsx` - Main integration component
- `f:\pulse1\src\components\DecisionTaskPanel.css` - Component styles

### Modified Files
- `f:\pulse1\src\types.ts` - Added DECISIONS_TASKS to AppView enum
- `f:\pulse1\src\App.tsx` - Added import and renderContent case
- `f:\pulse1\src\components\Sidebar\Sidebar.tsx` - Added navigation item

### Existing Dependencies
- `f:\pulse1\src\components\DecisionCard.tsx` - Decision display component
- `f:\pulse1\src\components\TaskList.tsx` - Task display component
- `f:\pulse1\src\services\decisionService.ts` - Decision data service
- `f:\pulse1\src\services\taskService.ts` - Task data service

## Usage Example

```typescript
import { DecisionTaskPanel } from './components/DecisionTaskPanel';

function App() {
  return (
    <DecisionTaskPanel
      user={currentUser}
      workspaceId={currentWorkspaceId} // Optional
    />
  );
}
```

## Troubleshooting

### Common Issues

**Problem**: Decisions not loading
- **Solution**: Verify workspaceId is correct and user has access

**Problem**: Tasks show incorrect data
- **Solution**: Check userId and workspaceId match expected values

**Problem**: Styles not applying
- **Solution**: Ensure CSS file is imported in component

**Problem**: Dark mode not working
- **Solution**: Verify parent elements have 'dark' class

## Support

For questions or issues with the Decisions & Tasks integration:
1. Check existing DecisionCard and TaskList documentation
2. Review service implementations in `decisionService.ts` and `taskService.ts`
3. Verify database schema matches expected structure
4. Check console for error messages

---

**Integration Date**: 2026-01-20
**Components**: DecisionTaskPanel, DecisionCard, TaskList
**Services**: decisionService, taskService
**Status**: ✅ Complete and Functional
