# AI-Enhanced Decisions & Tasks Page - Handoff Document

**Created:** 2026-01-21
**Status:** Sprint 2 In Progress - Navigation Layout Issue
**Next Chat Continuation:** Use this document to resume work

---

## Executive Summary

The AI-Enhanced Decisions & Tasks page redesign is 40% complete (Sprints 1-2 of 7 total). The foundation is solid with all core services implemented, database migrations applied, and the main UI structure in place. However, a critical navigation UX issue needs resolution before proceeding to Sprint 3.

**Current State:**
- ✅ Foundation complete (services, database, routing)
- ✅ AI Insights Dashboard implemented and functional
- ✅ Proactive Suggestions & Nudges implemented
- ✅ Brand palette updated (rose/pink #f43f5e, #ec4899)
- ✅ Light/dark mode optimized for readability
- ✅ Viewport scrolling fixed
- ❌ **CRITICAL:** Navigation layout causes tabs to shift position when switching between Decisions/Tasks views

---

## Current Critical Issue: Navigation Layout Confusion

### Problem Description
When switching between Decisions and Tasks tabs, the layout shifts dramatically:

1. **Decisions View:** Insights → Nudges → Tabs → Decisions grid (proper layout)
2. **Tasks View (broken):** Insights → Nudges appear without tabs visible, or tabs appear in different vertical position
3. **User Experience:** User must search for tabs in a different location to navigate back, causing confusion

### Root Cause
The component structure renders insights/nudges panels conditionally BEFORE the main content area. When content height changes or when there's minimal content, the tabs appear to shift vertically or become less visible, creating a disorienting navigation experience.

### Recommended Fix

**Option 1: Sticky Tab Bar (Recommended)**
Make the tab bar sticky so it's always visible at the same position regardless of scrolling:

```css
.hub-tabs {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--hub-card-bg);
  padding: 1rem 0;
  margin-bottom: 1rem;
}
```

**Option 2: Unified Layout Container**
Ensure insights/nudges are always inside a fixed-height container that doesn't affect tab position:

```jsx
<div className="decision-task-hub">
  <header />

  <div className="hub-body">
    <div className="hub-insights-area">
      {/* Insights and nudges - scrollable if needed */}
      {metrics && <AIInsightsDashboard />}
      {nudges.length > 0 && showNudges && <ProactiveSuggestions />}
    </div>

    <div className="hub-main-content">
      {/* This section ALWAYS in same position */}
      <div className="view-selector">{...}</div>
      <div className="hub-tabs">{...}</div>
      <div className="filter-bar">{...}</div>
      <div className="hub-content-area">{...}</div>
    </div>
  </div>
</div>
```

**Option 3: Collapse Insights When Switching Tabs**
Auto-collapse insights/nudges when switching to Tasks view to maintain consistent tab position:

```typescript
const handleTabChange = (tab: 'decisions' | 'tasks') => {
  setActiveTab(tab);

  // Auto-collapse insights when switching to maintain consistent layout
  if (tab === 'tasks') {
    setShowInsights(false);
  }
};
```

### Testing Steps
1. Navigate to Decisions & Tasks page
2. Click between Decisions and Tasks tabs multiple times
3. Verify tabs stay in same vertical position
4. Verify insights/nudges visibility doesn't affect tab position
5. Test with insights expanded/collapsed
6. Test with nudges present/dismissed

---

## Technical Architecture

### Component Hierarchy

```
DecisionTaskHub (Main Component)
├── Header (always visible)
│   ├── Title
│   └── Action Buttons (AI Assistant, Create Decision)
├── AIInsightsDashboard (conditional: {metrics && ...})
│   ├── Metrics Grid
│   │   ├── Decision Velocity
│   │   ├── Avg Resolution Time
│   │   ├── Participation Rate
│   │   └── Stale Count
│   └── Attention Needed Section
├── ProactiveSuggestions (conditional: {nudges.length > 0 && showNudges && ...})
│   ├── Urgent Nudges (red)
│   ├── Important Nudges (amber)
│   └── Suggestion Nudges (green)
└── MainContent (always visible)
    ├── ViewSelector (List/Kanban/Timeline)
    ├── TabNavigation (Decisions/Tasks)
    ├── FilterBar (status, sort, filters)
    └── ContentArea
        ├── DecisionsSection (activeTab === 'decisions')
        │   └── EnhancedDecisionCard[] (grid layout)
        └── TasksSection (activeTab === 'tasks')
            └── EnhancedTaskCard[] (list layout)
```

### File Structure

**Core Component Files:**
- `src/components/decisions/DecisionTaskHub.tsx` (720 lines) - Main component
- `src/components/decisions/DecisionTaskHub.css` (932 lines) - All styling
- `src/components/decisions/EnhancedDecisionCard.tsx` (230 lines) - Decision cards with AI insights
- `src/components/tasks/EnhancedTaskCard.tsx` (185 lines) - Task cards with AI features

**Service Files (All Complete):**
- `src/services/decisionAnalyticsService.ts` (187 lines) - Metrics calculation
- `src/services/proactiveSuggestionsService.ts` (217 lines) - Nudge generation
- `src/services/taskIntelligenceService.ts` (265 lines) - AI task prioritization
- `src/services/conversationalAIService.ts` (198 lines) - Chat assistant (not yet integrated in UI)

**Database Files:**
- `docs/database_migration_FINAL.sql` (242 lines) - ✅ Applied successfully
- `docs/fix_workspace_simple.sql` (104 lines) - ✅ Applied successfully
- `docs/sample_data_WORKING.sql` (419 lines) - ✅ Loaded successfully

---

## Implementation Status by Sprint

### ✅ Sprint 1: Foundation (COMPLETE)
- [x] Created all 4 service files (analytics, suggestions, task intelligence, conversational AI)
- [x] Database schema updates (AI columns for decisions and tasks)
- [x] Basic component structure for DecisionTaskHub
- [x] Routing updated in App.tsx
- [x] Sample data loaded (4 decisions, 8 tasks)

### 🔄 Sprint 2: AI Insights Dashboard (IN PROGRESS - 80% Complete)
- [x] AIInsightsDashboard component implemented
- [x] Decision velocity calculations working
- [x] Task completion metrics working
- [x] Bottleneck detection logic implemented
- [x] Gemini API integration for trend analysis
- [x] Proactive Suggestions panel implemented
- [x] Nudge generation working (urgent/important/suggestions)
- [x] Brand palette updated (rose/pink)
- [x] Light/dark mode optimized
- [x] Viewport scrolling fixed
- [ ] **BLOCKED:** Navigation layout issue must be resolved

### ⏳ Sprint 3: Enhanced Decisions (NOT STARTED)
- [ ] Create EnhancedDecisionCard with AI insights badges
- [ ] Integrate Decision Mission modal (already exists, needs integration)
- [ ] Implement AI risk assessment
- [ ] Add stakeholder suggestions
- [ ] "Send Reminder" and "Generate Tasks" actions

### ⏳ Sprint 4: Intelligent Tasks (NOT STARTED)
- [ ] Implement AITaskPrioritizer component
- [ ] Create EnhancedTaskCard with dependency indicators
- [ ] Dependency detection logic
- [ ] Task Kanban board (TaskKanban.tsx)
- [ ] AI-powered task suggestions

### ⏳ Sprint 5: Conversational AI (NOT STARTED)
- [ ] Build ConversationalAssistant sidebar component
- [ ] Implement query routing and parsing
- [ ] Context-aware responses
- [ ] Quick action templates
- [ ] Action execution (create decision, update task)

### ⏳ Sprint 6: Proactive Features Enhancement (NOT STARTED)
- [ ] Real-time updates via Supabase subscriptions
- [ ] Dismissible notifications with persistence
- [ ] Action handling for nudges (send reminder, reassign, etc.)
- [ ] Integration with contact matching for stakeholder suggestions

### ⏳ Sprint 7: Polish & Testing (NOT STARTED)
- [ ] UI/UX refinements
- [ ] Responsive design for mobile/tablet
- [ ] Performance optimization
- [ ] Loading states and error handling
- [ ] Comprehensive testing

---

## Database Schema

### Added AI Columns to `decisions` table:
```sql
ALTER TABLE decisions
ADD COLUMN ai_risk_level TEXT DEFAULT 'low',
ADD COLUMN ai_predicted_completion TIMESTAMP,
ADD COLUMN ai_suggested_stakeholders TEXT[],
ADD COLUMN ai_insights JSONB DEFAULT '{}';
```

### Added AI Columns to `tasks` table:
```sql
ALTER TABLE tasks
ADD COLUMN ai_priority_score DECIMAL,
ADD COLUMN ai_suggested_assignee TEXT,
ADD COLUMN ai_predicted_duration TEXT,
ADD COLUMN blocks_task_ids UUID[],
ADD COLUMN blocked_by_task_ids UUID[];
```

### New `task_dependencies` table:
```sql
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'blocks',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Brand Palette & Theme

### Color System

**Primary Brand Colors:**
- Rose: `#f43f5e` (Pulse Heartbeat Coral)
- Pink: `#ec4899` (Secondary accent)

**Light Mode:**
```css
--hub-bg-start: #fafaf9;          /* stone-50 */
--hub-bg-end: #f5f4f1;            /* Warm off-white */
--hub-text: #1c1917;              /* stone-900 - high contrast */
--hub-text-secondary: #57534e;    /* stone-600 - readable */
--hub-border: #e7e5e4;            /* stone-200 */
--hub-card-bg: #ffffff;
--hub-card-hover: #fef7f4;        /* Rose-tinted hover */
--hub-accent-start: #f43f5e;      /* Pulse rose */
--hub-accent-end: #ec4899;        /* Pulse pink */
```

**Dark Mode:**
```css
--hub-bg-start: #000000;
--hub-bg-end: #0a0a0a;
--hub-text: #fafafa;
--hub-text-secondary: #d4d4d4;
--hub-border: #262626;
--hub-card-bg: #171717;
--hub-card-hover: #262626;
--hub-accent-start: #f43f5e;      /* Pulse rose */
--hub-accent-end: #ec4899;        /* Pulse pink */
```

### Status Colors
- Green: `#10b981` (decided, done)
- Amber: `#f59e0b` (voting, in progress)
- Red: `#ef4444` (urgent, overdue)
- Gray: `#6b7280` (proposed, todo)

---

## Key Services API Reference

### `decisionAnalyticsService`

```typescript
interface DecisionMetrics {
  velocityPerWeek: number;
  avgTimeToResolution: number;
  participationRate: number;
  staleCount: number;
  totalDecisions: number;
  decidedCount: number;
  votingCount: number;
}

// Calculate metrics from decisions array
async calculateDecisionVelocity(decisions: Decision[]): Promise<DecisionMetrics>

// Detect stalled decisions (no activity in 24h+)
async detectStaleDecisions(decisions: Decision[]): Promise<Decision[]>

// AI-powered risk assessment (uses Gemini)
async assessDecisionRisk(
  decision: Decision,
  apiKey: string
): Promise<{
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
  recommendations: string[];
}>

// Identify suggested stakeholders (uses Gemini + contact matching)
async identifyStakeholders(
  decision: Decision,
  contacts: Contact[],
  apiKey: string
): Promise<string[]>
```

### `proactiveSuggestionsService`

```typescript
interface Nudge {
  id: string;
  type: 'decision_stale' | 'task_deadline' | 'blocker' | 'suggestion' | 'workload';
  priority: 'urgent' | 'important' | 'suggestion';
  message: string;
  action?: string;
  actionType?: 'send_reminder' | 'review' | 'reassign' | 'extend_deadline';
  relatedId?: string;
  relatedTitle?: string;
}

// Generate all nudges (uses Gemini for complex analysis)
async generateNudges(
  decisions: Decision[],
  tasks: Task[],
  user: User,
  apiKey: string
): Promise<Nudge[]>
```

**Nudge Generation Logic:**
1. Stale decisions (no votes in 24h+) → "important" priority
2. Overdue tasks → "urgent" priority
3. Blocked tasks (5+ tasks blocked by one) → "important" priority
4. Workload imbalance (user with 12+ tasks) → "suggestion" priority
5. AI-generated insights from Gemini → various priorities

### `taskIntelligenceService`

```typescript
interface AITaskPriority {
  taskId: string;
  aiScore: number; // 0-100
  reasoning: string;
  blocksOthers: boolean;
  suggestedAssignee?: string;
  predictedDuration?: string;
}

// Generate AI priority scores (uses Gemini)
async intelligentPrioritization(
  tasks: Task[],
  apiKey: string
): Promise<AITaskPriority[]>

// Detect task dependencies (which tasks block others)
async detectDependencies(tasks: Task[]): Promise<{
  taskId: string;
  blocks: string[];
  blockedBy: string[];
}[]>

// Extract tasks from finalized decision (uses Gemini)
async extractTasksFromDecision(
  decision: Decision,
  apiKey: string
): Promise<Partial<Task>[]>

// Suggest assignee based on task content (uses Gemini + contacts)
async suggestAssignee(
  task: Task,
  contacts: Contact[],
  apiKey: string
): Promise<string>
```

### `conversationalAIService`

**Status:** Service complete, UI integration NOT YET IMPLEMENTED

```typescript
// Answer natural language queries (uses Gemini)
async answerQuery(
  query: string,
  context: {
    decisions: Decision[];
    tasks: Task[];
    user: User;
  },
  apiKey: string
): Promise<string>

// Generate summary of pending items (uses Gemini)
async summarizePending(
  decisions: Decision[],
  tasks: Task[],
  apiKey: string
): Promise<{
  summary: string;
  highlights: string[];
  recommendations: string[];
}>

// Identify blockers in workflow (uses Gemini)
async identifyBlockers(
  tasks: Task[],
  decisions: Decision[],
  apiKey: string
): Promise<{
  type: 'task' | 'decision';
  item: Task | Decision;
  blocking: string[];
  recommendation: string;
}[]>
```

---

## Component State Management

### `DecisionTaskHub` State Variables

```typescript
// Core data
const [decisions, setDecisions] = useState<Decision[]>([]);
const [tasks, setTasks] = useState<Task[]>([]);
const [metrics, setMetrics] = useState<DecisionMetrics | null>(null);
const [nudges, setNudges] = useState<Nudge[]>([]);

// UI state
const [activeView, setActiveView] = useState<'list' | 'kanban' | 'timeline'>('list');
const [activeTab, setActiveTab] = useState<'decisions' | 'tasks'>('decisions');
const [showInsights, setShowInsights] = useState(true);
const [showNudges, setShowNudges] = useState(true);
const [showAssistant, setShowAssistant] = useState(false);
const [showDecisionMission, setShowDecisionMission] = useState(false);

// Filters
const [decisionStatusFilter, setDecisionStatusFilter] = useState<string | undefined>();
const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>();
const [sortBy, setSortBy] = useState<'created' | 'due_date' | 'priority' | 'ai_score'>('created');
const [showOverdueOnly, setShowOverdueOnly] = useState(false);

// Loading states
const [decisionsLoading, setDecisionsLoading] = useState(true);
const [tasksLoading, setTasksLoading] = useState(true);

// Dismissed nudges (persisted in state)
const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(new Set());
```

### Data Loading Flow

```typescript
useEffect(() => {
  loadDecisions();
  loadTasks();
}, [user?.id]);

useEffect(() => {
  if (decisions.length > 0) {
    generateMetrics();
  }
}, [decisions]);

useEffect(() => {
  if (decisions.length > 0 || tasks.length > 0) {
    generateNudges();
  }
}, [decisions, tasks]);
```

---

## Debug Information

### Console Logging (Currently Active)

The component includes debug logging to track metrics and nudges generation:

```typescript
// In generateMetrics()
console.log('🔢 Generating metrics from decisions:', decisions.length);
console.log('📊 Metrics generated:', calculatedMetrics);

// In generateNudges()
console.log('🔔 Generating nudges from:', decisions.length, 'decisions and', tasks.length, 'tasks');
console.log('📌 Generated nudges:', generatedNudges.length);
console.log('✅ Active nudges after filtering:', activeNudges.length);

// In render
console.log('🎨 Render state:', {
  metrics,
  nudgesCount: nudges.length,
  decisionsCount: decisions.length,
  tasksCount: tasks.length,
  showInsights,
  showNudges
});
```

**To verify data is loading:**
1. Open browser console (F12)
2. Navigate to Decisions & Tasks page
3. Look for emoji-prefixed log messages
4. Verify metrics and nudges are being generated

---

## Known Issues & Limitations

### Critical Issues
1. **Navigation Layout Confusion** (current blocker) - Tabs shift position when switching between Decisions/Tasks views

### Minor Issues
2. Kanban and Timeline views are disabled (marked "Coming soon")
3. AI Assistant sidebar is not yet implemented in UI (service exists)
4. Decision Mission modal integration is basic (needs styling)
5. EnhancedDecisionCard and EnhancedTaskCard don't yet show AI insights badges

### Future Enhancements (Post-Sprint 7)
- Real-time Supabase subscriptions for live updates
- Slack/email integration for decision voting notifications
- Task dependency visualization (graph view)
- Historical analytics and trend forecasting
- Mobile-optimized responsive design
- Keyboard shortcuts for power users

---

## Testing Checklist

### Current Features to Test

**✅ AI Insights Dashboard:**
- [ ] Metrics calculate correctly from decisions
- [ ] Decision velocity shows per-week rate
- [ ] Average resolution time calculates from decided decisions
- [ ] Participation rate based on vote counts
- [ ] Stale count identifies decisions with no activity in 24h+
- [ ] Collapse/expand functionality works
- [ ] Refresh button regenerates metrics

**✅ Proactive Suggestions & Nudges:**
- [ ] Urgent nudges appear for overdue tasks
- [ ] Important nudges appear for stale decisions
- [ ] Suggestion nudges appear for workload imbalance
- [ ] Nudges can be dismissed individually
- [ ] Dismiss all button works
- [ ] Nudges are categorized correctly (red/amber/green)

**✅ Decisions View:**
- [ ] Decisions load from Supabase
- [ ] Filter by status works (all/proposed/voting/decided/cancelled)
- [ ] Decisions display in grid layout
- [ ] Empty state shows when no decisions
- [ ] Loading state shows during fetch

**✅ Tasks View:**
- [ ] Tasks load from Supabase
- [ ] Filter by status works (all/todo/in_progress/done/cancelled)
- [ ] Sort by works (created/due_date/priority/ai_score)
- [ ] "Overdue only" checkbox filters correctly
- [ ] Tasks display in list layout
- [ ] Empty state shows when no tasks
- [ ] Loading state shows during fetch

**✅ Theme & Styling:**
- [ ] Light mode text is readable (high contrast)
- [ ] Dark mode uses proper black background
- [ ] Brand palette (rose/pink) used throughout
- [ ] Page is fully scrollable
- [ ] Cards have proper hover effects
- [ ] Responsive design works on mobile

**❌ Known Broken Features:**
- [ ] **Navigation layout** - Tabs shift position (BLOCKER)
- [ ] Kanban view (disabled)
- [ ] Timeline view (disabled)
- [ ] AI Assistant sidebar (not implemented in UI)
- [ ] Decision Mission modal (basic integration, needs styling)

---

## Next Steps for Continuation

### Immediate (Next Session)

1. **Fix Navigation Layout Issue** (CRITICAL - blocks Sprint 2 completion)
   - Implement one of the 3 recommended solutions (sticky tabs, unified container, or auto-collapse)
   - Test navigation between Decisions/Tasks tabs
   - Verify tabs stay in consistent vertical position
   - Verify insights/nudges don't affect tab position

2. **Verify Debug Logging Output**
   - Check console for metrics and nudges generation logs
   - Confirm data is loading correctly
   - Identify any API errors or data issues

3. **Complete Sprint 2 Testing**
   - Run through full testing checklist
   - Document any additional issues
   - Mark Sprint 2 as complete

### Short-term (Next 1-2 Sessions)

4. **Begin Sprint 3: Enhanced Decisions**
   - Add AI insights badges to DecisionCard
   - Integrate Decision Mission modal with proper styling
   - Implement "Send Reminder" action
   - Implement "Generate Tasks from Decision" action

5. **Decision Mission Integration**
   - Style modal to match hub design
   - Connect decision creation flow
   - Test end-to-end decision creation
   - Verify AI-generated options work

### Medium-term (Next 3-5 Sessions)

6. **Complete Sprint 4: Intelligent Tasks**
   - Build AITaskPrioritizer component
   - Add AI badges to task cards
   - Implement dependency indicators
   - Create Task Kanban board

7. **Complete Sprint 5: Conversational AI**
   - Build ConversationalAssistant sidebar UI
   - Integrate conversationalAIService
   - Implement query routing
   - Add quick action templates

### Long-term (Next 6+ Sessions)

8. **Complete Sprint 6 & 7**
   - Real-time Supabase subscriptions
   - Comprehensive testing
   - Performance optimization
   - Polish and refinement

---

## Files Changed in This Session

### Modified Files:
1. `src/components/decisions/DecisionTaskHub.tsx`
   - Added debug logging for metrics and nudges
   - Added render state logging
   - No structural changes (issue not yet fixed)

2. `src/components/decisions/DecisionTaskHub.css`
   - Updated all theme variables to use brand palette (rose/pink)
   - Changed light mode text colors for readability
   - Fixed viewport scrolling (min-height: 100vh, overflow-y: auto)
   - Removed flex constraints preventing proper scrolling
   - Updated 40+ color references from cyan/purple to rose/pink

### Files to Modify Next Session:
1. `src/components/decisions/DecisionTaskHub.tsx` - Fix navigation layout
2. `src/components/decisions/DecisionTaskHub.css` - Add sticky tabs or unified container styles

---

## Questions for User (Next Session)

1. Which navigation fix approach do you prefer?
   - Option 1: Sticky tab bar (tabs stay visible at top)
   - Option 2: Unified layout container (insights in fixed area)
   - Option 3: Auto-collapse insights when switching tabs

2. Should the AI Assistant sidebar be a high priority, or focus on Enhanced Decision/Task cards first?

3. Do you want Decision Mission modal to match the hub's design, or keep War Room styling?

4. Should we add real-time Supabase subscriptions now, or wait until Sprint 6?

---

## Code Snippets for Quick Reference

### How to Add a New Metric to Dashboard

```typescript
// 1. Update interface in decisionAnalyticsService.ts
export interface DecisionMetrics {
  // ... existing metrics
  newMetric: number;
}

// 2. Calculate in calculateDecisionVelocity()
newMetric: calculateNewMetric(decisions),

// 3. Add card in DecisionTaskHub.tsx
<div className="metric-card">
  <div className="metric-label">New Metric</div>
  <div className="metric-value">{metrics.newMetric}</div>
</div>
```

### How to Add a New Nudge Type

```typescript
// 1. Update type in proactiveSuggestionsService.ts
export interface Nudge {
  type: 'decision_stale' | 'task_deadline' | 'blocker' | 'suggestion' | 'workload' | 'new_type';
  // ... rest of interface
}

// 2. Add generation logic in generateNudges()
// Check for condition
if (someCondition) {
  nudges.push({
    id: crypto.randomUUID(),
    type: 'new_type',
    priority: 'important',
    message: 'Your message here',
    action: 'Action button text'
  });
}

// 3. Nudges automatically render in ProactiveSuggestions panel
```

### How to Add a New Filter

```typescript
// 1. Add state variable
const [newFilter, setNewFilter] = useState<string | undefined>();

// 2. Add to filter bar
<select
  className="filter-select"
  value={newFilter || ''}
  onChange={(e) => setNewFilter(e.target.value || undefined)}
>
  <option value="">All</option>
  <option value="option1">Option 1</option>
</select>

// 3. Update filteredData logic
const filteredData = data.filter(item => {
  if (newFilter && item.field !== newFilter) return false;
  // ... other filters
  return true;
});
```

---

## Resources & References

### Existing Components to Reference
- `src/components/WarRoom/missions/DecisionMission.tsx` - Decision creation flow
- `src/components/DecisionCard.tsx` - Base decision card component
- `src/components/TaskList.tsx` - Base task list component
- `src/components/WarRoom/WarRoom.tsx` - Similar AI-enhanced layout

### Services Used
- `src/services/geminiService.ts` - Gemini API integration
- `src/services/decisionService.ts` - Decision CRUD operations
- `src/services/taskService.ts` - Task CRUD operations
- `src/services/supabase.ts` - Supabase client

### Database Tables
- `decisions` - Decision data with AI columns
- `tasks` - Task data with AI columns
- `task_dependencies` - Task blocking relationships
- `decision_votes` - Vote tracking
- `contacts` - Contact data for stakeholder suggestions

---

## Success Criteria for Sprint 2 Completion

- [x] AI Insights Dashboard displays metrics correctly
- [x] Proactive Suggestions panel shows nudges
- [x] Brand palette matches Pulse design (rose/pink)
- [x] Light mode text is readable
- [x] Dark mode optimized
- [x] Page is fully scrollable
- [ ] **Navigation layout is intuitive and consistent** (BLOCKER)

**Once navigation is fixed, Sprint 2 is COMPLETE and ready for Sprint 3.**

---

## Contact & Continuation

**To continue this work in a new chat:**
1. Reference this handoff document: `docs/DECISIONS_TASKS_HANDOFF.md`
2. Start with: "Continue work on AI-Enhanced Decisions & Tasks page - see DECISIONS_TASKS_HANDOFF.md"
3. First task: Fix navigation layout confusion (see "Recommended Fix" section)

**Original Plan Document:** `C:\Users\Aegis{FM}\.claude\plans\zesty-twirling-newt.md`

**Git Status:** Multiple files modified (see git status for exact changes)

---

*Document created: 2026-01-21*
*Last updated: 2026-01-21*
*Version: 1.0*
