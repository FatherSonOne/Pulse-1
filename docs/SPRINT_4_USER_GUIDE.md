# Sprint 4: Intelligent Task Cards - User Guide

**Date:** 2026-01-21
**Version:** 1.0

---

## Overview

Sprint 4 adds powerful AI-enhanced task management features to Pulse, including intelligent task cards, AI-powered prioritization, and a Kanban board with drag-and-drop support.

---

## New Features

### 1. Enhanced Task Cards with AI Insights

Every task now displays rich AI-powered insights to help you work smarter.

**What You'll See:**

- **AI Priority Score** (0-100): A lightning bolt badge showing how urgent the task is
  - 🔴 Red (80-100): Critical priority
  - 🟠 Amber (60-79): High priority
  - 🟢 Green (40-59): Medium priority
  - ⚪ Gray (0-39): Low priority

- **AI Suggested Assignee**: When a task has no assignee, AI recommends the best person based on task content

- **Predicted Duration**: AI estimates how long the task will take (e.g., "2-3 days")

- **Dependency Indicators**:
  - 🔗 **Blocks N tasks**: This task is blocking other work
  - ⚠️ **Blocked by N tasks**: This task is waiting on other work

**Example:**
```
✅ Implement authentication system
   🏷️ High    ⚡85 (Critical)

   📝 Add OAuth2 support with Google and GitHub providers

   🤖 AI Features:
   👤 AI suggests: John Doe
   ⏱️ Est: 2-3 days
   🔗 Blocks 3 tasks

   👤 Assigned to: Sarah Chen
   📅 Due: Tomorrow
```

### 2. AI Task Prioritization

Analyze all your tasks at once to find what needs attention first.

**How to Use:**

1. Navigate to **Decisions & Tasks** page
2. Click the **Tasks** tab
3. Click the **🤖 AI Prioritize** button in the view selector
4. Click **Prioritize Tasks** to start AI analysis

**What You Get:**

- **Summary Statistics**:
  - Critical tasks count (80-100 priority)
  - High priority tasks (60-79)
  - Medium priority tasks (40-59)
  - Low priority tasks (0-39)
  - Tasks blocking others

- **Ranked Task List**:
  - Tasks ordered by AI priority score
  - Reasoning for each score
  - Predicted duration estimates
  - Suggested assignees
  - Blocking status indicators

**Example Output:**
```
AI Task Prioritization Results

📊 Summary:
[5] Critical  [8] High  [12] Medium  [3] Low  [4] Blocking Others

🏆 Top Priority Tasks:

#1 Fix production authentication bug
   ⚡ 95 (Critical)
   💬 High impact, blocks 4 tasks, overdue by 2 days
   ⏱️ Est: 4-6 hours
   ⚠️ Blocks other tasks

#2 Deploy security patch
   ⚡ 88 (Critical)
   💬 Security vulnerability, due today, high complexity
   ⏱️ Est: 1-2 hours

#3 Review PR #234
   ⚡ 72 (High)
   💬 Blocks team progress, due soon
   ⏱️ Est: 30 minutes
```

### 3. Kanban Board View

Visualize and manage tasks with drag-and-drop columns.

**How to Use:**

1. Navigate to **Decisions & Tasks** page
2. Click the **Tasks** tab
3. Click the **📊 Kanban** button in the view selector

**Three Columns:**

- **📋 To Do**: Tasks that haven't started
- **🔄 In Progress**: Tasks currently being worked on
- **✅ Done**: Completed tasks

**Drag and Drop:**

1. Click and hold a task card
2. Drag to another column
3. Release to drop
4. Status automatically updates

**Column Statistics:**

Each column header shows:
- Total task count
- High priority tasks badge (🟠)
- Overdue tasks badge (🔴)

**Example:**
```
┌─────────────────┬─────────────────┬─────────────────┐
│ 📋 To Do (12)   │ 🔄 In Progress  │ ✅ Done (28)    │
│ 🟠 5  🔴 2      │ (8) 🟠 3        │                 │
├─────────────────┼─────────────────┼─────────────────┤
│ [Task Card 1]   │ [Task Card 5]   │ [Task Card 9]   │
│ [Task Card 2]   │ [Task Card 6]   │ [Task Card 10]  │
│ [Task Card 3]   │ [Task Card 7]   │ [Task Card 11]  │
│ [Task Card 4]   │ [Task Card 8]   │     ...         │
└─────────────────┴─────────────────┴─────────────────┘
```

### 4. View Modes

Switch between different task views based on your workflow:

**List View** (Default):
- Vertical list of task cards
- Best for detailed review
- Shows all AI features
- Easy scanning

**Kanban View**:
- Three-column board
- Best for workflow management
- Drag-and-drop status changes
- Visual progress tracking

**Toggle Views:**
- Click **📄 List** or **📊 Kanban** in the view selector
- Your preference is remembered

---

## Task Actions

### Quick Actions on Task Cards

**Hover over any task card to see action buttons:**

- **✏️ Edit**: Modify task details (coming soon)
- **🗑️ Delete**: Remove the task (confirms before deleting)

**Click the checkbox to:**
- Mark task as done (✅)
- Mark task as todo (☐)

**Status Dropdown (for in-progress tasks):**
- Change to: To Do | In Progress | Cancelled | Done

---

## Filters and Sorting

**Filter Tasks:**
- **Status**: All | To Do | In Progress | Done | Cancelled
- **Overdue Only**: Show only overdue tasks

**Sort Tasks:**
- **Created Date**: Newest first
- **Due Date**: Earliest first
- **Manual Priority**: Urgent → High → Medium → Low
- **🤖 AI Priority**: Highest AI score first (recommended)

**Tip:** AI Priority sort is the most intelligent - it considers due dates, dependencies, and complexity.

---

## AI Features Setup

### Required: Gemini API Key

All AI features require a Gemini API key:

1. Go to **Settings**
2. Find **AI Configuration**
3. Add your **Gemini API Key**
4. Save

**Without API Key:**
- AI Prioritization won't work
- Task cards still show existing AI data
- Kanban board works normally

### Generating AI Priority Scores

**Automatic:** AI scores are generated when:
- Creating tasks from decisions
- Using AI Prioritization feature

**Manual Trigger:**
1. Click **Tasks** tab
2. Click **🤖 AI Prioritize**
3. Click **Prioritize Tasks**
4. Scores update in real-time

**What AI Considers:**
- Due date urgency
- Task dependencies (blocks others)
- Manual priority level
- Task complexity (from description)
- Current status

---

## Dependency Management

### Understanding Dependencies

**Blocks Tasks:**
- This task must be completed before others can start
- Shown as: 🔗 Blocks 3 tasks
- Increases AI priority score

**Blocked By Tasks:**
- This task is waiting on other tasks
- Shown as: ⚠️ Blocked by 2 tasks
- May lower AI priority score (can't start yet)

### How Dependencies Are Detected

AI looks for keywords in task titles and descriptions:
- "after [task name]"
- "depends on [task name]"
- "blocked by [task name]"
- "waiting for [task name]"

**Example:**
```
Task 1: "Set up database schema"

Task 2: "Implement user authentication after database schema"
        → This task is blocked by Task 1
        → Task 1 blocks this task
```

---

## Best Practices

### 1. Use AI Prioritization Weekly

Run AI prioritization at the start of each week to:
- Identify critical bottlenecks
- Reorder your work queue
- Surface overdue tasks

### 2. Review Dependency Indicators

Pay attention to:
- 🔗 **Blocking tasks**: Complete these first to unblock team
- ⚠️ **Blocked tasks**: Check if dependencies are progressing

### 3. Leverage Kanban for Daily Workflow

- Start each day in Kanban view
- Drag tasks from To Do → In Progress as you work
- Drag to Done when complete
- Visual progress is motivating

### 4. Trust the AI Score

When overwhelmed, sort by AI Priority and work top-down:
1. AI considers more factors than manual review
2. Balances urgency, impact, and dependencies
3. Adapts to your task load

### 5. Keep Task Descriptions Detailed

More detail = better AI insights:
- AI suggests better assignees
- Duration predictions are more accurate
- Dependency detection works better

---

## Keyboard Shortcuts

### Task Cards
- **Tab**: Navigate between tasks
- **Enter**: Toggle checkbox (when focused)
- **Space**: Toggle checkbox (when focused)

### Kanban Board
- **Arrow Keys**: Navigate between columns
- **Drag with Mouse**: Move tasks

---

## Mobile Experience

All Sprint 4 features are fully responsive:

**Task Cards:**
- Action buttons always visible (not just on hover)
- Badges stack vertically
- Easy touch targets

**Kanban Board:**
- Columns stack vertically on mobile
- Swipe to scroll between sections
- Tap and hold to drag tasks

**AI Prioritization:**
- Statistics grid adapts to screen size
- Results list optimized for mobile

---

## Troubleshooting

### "AI Prioritization Failed"

**Problem:** Error message when clicking Prioritize Tasks

**Solutions:**
1. Check Gemini API key is set in Settings
2. Verify API key has quota remaining
3. Check internet connection
4. Try again in a few seconds

**Fallback:** If AI fails, basic prioritization uses manual priority + due dates

### Tasks Not Showing AI Scores

**Problem:** AI score badges not appearing

**Causes:**
1. Tasks created before AI prioritization ran
2. No API key configured
3. AI prioritization hasn't been run yet

**Solution:** Run AI Prioritization to generate scores

### Drag and Drop Not Working

**Problem:** Can't drag tasks in Kanban

**Solutions:**
1. Check browser supports HTML5 drag-and-drop (all modern browsers)
2. Try refreshing the page
3. Check for JavaScript errors in console

### Dependencies Not Detected

**Problem:** Task relationships not showing

**Causes:**
1. Tasks don't reference each other by name
2. Keywords not matching (use "depends on", "blocked by")

**Solution:** Add clear dependency keywords in task descriptions

---

## What's Next (Sprint 5)

Coming features:
- **Conversational AI Assistant**: Ask questions like "What should I work on next?"
- **Task Edit Modal**: Full inline editing with rich features
- **Dependency Graph**: Visual diagram of task relationships
- **Real-time Updates**: See changes instantly across devices

---

## Feedback

Found a bug or have a suggestion?
- Check console for errors (F12)
- Note steps to reproduce
- Share with your team lead

---

**Enjoy more intelligent task management with Sprint 4!**

*Guide Version 1.0 - 2026-01-21*
