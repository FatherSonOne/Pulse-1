# 🤖 Claude Code Instructions: AI Orchestration for Software Development

**Logos Vision Development Guidelines Based on AI Orchestration Best Practices**

---

## 📋 Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [AI Orchestration Maturity Model](#ai-orchestration-maturity-model)
3. [Development Workflow Architecture](#development-workflow-architecture)
4. [Agent-Style Task Organization](#agent-style-task-organization)
5. [Communication Protocol Standards](#communication-protocol-standards)
6. [Code Quality Guardrails](#code-quality-guardrails)
7. [Context Management System](#context-management-system)
8. [Error Handling & Recovery](#error-handling--recovery)
9. [Documentation Standards](#documentation-standards)
10. [Continuous Improvement Loop](#continuous-improvement-loop)

---

## Core Philosophy

### From Automation to Orchestration

**Old Way (Simple Automation):**
- "Write code for this feature"
- Single isolated tasks
- No connection between requests

**New Way (AI Orchestration):**
- Connected end-to-end workflows
- Context flows between development phases
- Intelligent routing of tasks based on complexity
- Learning and adapting from outcomes

### The Orchestra Analogy

Think of your development workflow like an orchestra:

| Component | Orchestra | Development |
|-----------|-----------|-------------|
| Conductor | AI Orchestration Platform | Claude + Your Direction |
| Strings | Core functionality | React Components |
| Woodwinds | Supporting features | Services & Utilities |
| Percussion | Foundation | Database & Backend |
| Sheet Music | Requirements | Documentation & Specs |

**Without orchestration**: Each musician plays independently → chaos  
**With orchestration**: All parts work together → harmony

---

## AI Orchestration Maturity Model

### Stage 1: LLMs (Experimentation)
**Where you started:**
- Using Claude for research and questions
- Copy/paste code snippets
- Disconnected from your actual codebase

### Stage 2: AI-Powered Workflows (Automation)
**Current state:**
- Claude generates complete features
- Systematic step-by-step guides
- Documentation alongside code

### Stage 3: Agentic Workflows (Target State)
**Where we're heading:**
- Claude understands your entire tech stack
- Automatic context from past conversations
- Proactive suggestions based on patterns
- Connected decision-making across features

### Stage 4: Scaled Orchestration (Future Vision)
**Long-term goal:**
- Multiple AI tools working together
- Automated testing and deployment triggers
- Self-healing code suggestions
- Predictive maintenance recommendations

---

## Development Workflow Architecture

### The Orchestrated Development Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST CLASSIFICATION                        │
│  (What type of task is this?)                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │  SIMPLE  │        │  MEDIUM  │        │ COMPLEX  │
   │  TASK    │        │  FEATURE │        │ SYSTEM   │
   └──────────┘        └──────────┘        └──────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   Quick Fix            Feature Build        Architecture
   Bug Patch            Component Add        Multi-file Change
   Style Tweak          Service Update       Database Schema
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION PHASE                          │
│  1. Context Gathering → 2. Planning → 3. Building → 4. Testing  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT WORKFLOW                           │
│  Git Stage → Commit → Push → Verify Deployment → Test Live      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FEEDBACK LOOP                                 │
│  Document learnings → Update patterns → Improve next iteration  │
└─────────────────────────────────────────────────────────────────┘
```

### Task Classification Guide

**SIMPLE Tasks (Quick turnaround):**
- Fix a typo or CSS issue
- Add a simple button or link
- Update static text content
- Minor styling adjustments

**MEDIUM Tasks (Feature-level):**
- Add a new component
- Create a service function
- Implement a form with validation
- Add a new page or view

**COMPLEX Tasks (System-level):**
- Database schema changes
- Authentication updates
- Multi-component features
- Architecture modifications

---

## Agent-Style Task Organization

### Specialized Agent Roles

Based on AI orchestration principles, think of different "agent" mindsets for different tasks:

#### 🎨 UI/UX Agent
**Specialization:** Visual components, styling, user interactions

**Triggers:**
- "Make it look better"
- "Update the design"
- "Add animation"
- "Fix the layout"

**Approach:**
1. Understand current visual state
2. Apply glassmorphism and modern patterns
3. Ensure responsive design
4. Test in light/dark themes

#### ⚙️ Logic Agent
**Specialization:** Business logic, data processing, algorithms

**Triggers:**
- "Calculate..."
- "Process..."
- "Transform..."
- "Filter/Sort..."

**Approach:**
1. Understand data structures
2. Write type-safe functions
3. Handle edge cases
4. Add error boundaries

#### 🗄️ Database Agent
**Specialization:** Supabase, PostgreSQL, data persistence

**Triggers:**
- "Store..."
- "Save to database"
- "Create a table"
- "Update RLS policies"

**Approach:**
1. Review current schema
2. Plan migration strategy
3. Write SQL with RLS
4. Test queries locally first

#### 🔌 Integration Agent
**Specialization:** APIs, external services, connections

**Triggers:**
- "Connect to..."
- "Integrate with..."
- "Call the API"
- "Add authentication"

**Approach:**
1. Review API documentation
2. Create service wrapper
3. Handle authentication
4. Implement error handling

#### 🧪 Testing Agent
**Specialization:** Quality assurance, edge cases, validation

**Triggers:**
- "Test this"
- "Make sure it works"
- "Check for bugs"
- "Verify the feature"

**Approach:**
1. Identify test scenarios
2. Check happy path
3. Test edge cases
4. Verify error states

---

## Communication Protocol Standards

### Request Format Template

When making requests, use this structure for best results:

```
## CONTEXT
What project? (CRM / PULSE)
What feature area? (Dashboard / Chat / Settings)
What's the current state?

## GOAL
What should it do when finished?
What problem does this solve?

## CONSTRAINTS
Time sensitivity: (Now / This week / Backlog)
Technical limitations: (Any specific requirements?)
Dependencies: (What needs to work first?)

## SUCCESS CRITERIA
How will we know it's done?
What should we test?
```

### Response Protocol

Claude should respond with:

```
## UNDERSTANDING
[Restate the request to confirm understanding]

## PLAN
[Step-by-step approach]

## PRIORITY CHECK
[Is this the most important thing right now?]

## IMPLEMENTATION
[The actual code/solution]

## NEXT STEPS
[What to do after this]

## DEPLOYMENT COMMANDS
[Exact commands to run]
```

---

## Code Quality Guardrails

### Pre-Implementation Checklist

Before writing any code, verify:

- [ ] **Context loaded** - Do I understand the current state?
- [ ] **Priority confirmed** - Is this the right task right now?
- [ ] **Dependencies checked** - What does this depend on?
- [ ] **Impact assessed** - What else might this affect?
- [ ] **Type definitions ready** - Are types.ts updated?

### Implementation Standards

**TypeScript Requirements:**
```typescript
// ✅ GOOD: Explicit types, clear naming
interface ProjectFormData {
  name: string;
  clientId: string;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
}

const createProject = async (data: ProjectFormData): Promise<Project> => {
  // Implementation
};

// ❌ BAD: Implicit types, unclear naming
const create = async (d) => {
  // Implementation
};
```

**Component Structure:**
```typescript
// ✅ GOOD: Clear structure, props interface, JSDoc
/**
 * Displays project card with summary information
 * @param project - The project to display
 * @param onEdit - Callback when edit is clicked
 */
interface ProjectCardProps {
  project: Project;
  onEdit: (id: string) => void;
  isLoading?: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onEdit,
  isLoading = false
}) => {
  // Component logic
};
```

**Service Layer:**
```typescript
// ✅ GOOD: Error handling, type safety, logging
export const projectService = {
  async getById(id: string): Promise<Project | null> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Failed to fetch project:', error);
        return null;
      }
      
      return data;
    } catch (err) {
      console.error('Unexpected error fetching project:', err);
      return null;
    }
  }
};
```

### Post-Implementation Checklist

After writing code, verify:

- [ ] **TypeScript compiles** - No type errors
- [ ] **Code formatted** - Consistent style
- [ ] **No console.log** - Remove debug statements
- [ ] **Error handling** - All errors caught
- [ ] **Edge cases** - Null/undefined handled
- [ ] **Responsive** - Works on mobile

---

## Context Management System

### Project Context Files

Always reference these before development:

| File | Purpose | When to Reference |
|------|---------|-------------------|
| `TECH_STACK_REFERENCE.md` | Tech stack overview | Starting new features |
| `types.ts` | Type definitions | Creating components/services |
| `sampleData.ts` | Data structure examples | Understanding data shapes |
| Current component | Existing patterns | Extending features |

### Context Loading Protocol

**Step 1: Identify the scope**
```
Am I working on:
□ CRM (logos-vision-crm)
□ PULSE (pulse-app)
□ Both
□ New project
```

**Step 2: Load relevant context**
```
For CRM features:
- Review TECH_STACK_REFERENCE.md
- Check types.ts for existing types
- Look at similar components

For PULSE features:
- Review existing chat components
- Check AI integration patterns
- Review theme system
```

**Step 3: Confirm understanding**
```
Before implementing, state:
- What files will be modified
- What new files will be created
- What types/interfaces needed
- What services involved
```

---

## Error Handling & Recovery

### When Things Go Wrong

**Build Errors:**
```bash
# Step 1: Check the error message
npm run build 2>&1 | head -50

# Step 2: If TypeScript error
npx tsc --noEmit

# Step 3: Clear cache and retry
rm -rf node_modules/.vite
npm run build
```

**Runtime Errors:**
```bash
# Step 1: Check browser console
# Step 2: Check terminal output
# Step 3: Add console.log for debugging
# Step 4: Remove console.log after fixing
```

**Deployment Errors:**
```bash
# Step 1: Check Vercel build logs
# Step 2: Verify environment variables
# Step 3: Check for missing dependencies
# Step 4: Test production build locally
npm run build && npm run preview
```

### Recovery Patterns

**Undo Last Change:**
```bash
# View recent changes
git diff HEAD~1

# Undo last commit (keep changes staged)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1
```

**Fix Broken Deployment:**
```bash
# Quick rollback
git revert HEAD
git push origin main

# Or restore specific version
git checkout <commit-hash> -- <file>
git commit -m "Restore working version of <file>"
git push origin main
```

---

## Documentation Standards

### Code Comments

**When to Comment:**
- Complex business logic
- Non-obvious implementations
- API integration details
- Workarounds for known issues

**Comment Format:**
```typescript
// ============================================
// PROJECT SUMMARY GENERATION
// Uses Gemini AI to create executive summaries
// ============================================

/**
 * Generates an AI-powered summary for a project
 * 
 * @param project - The project to summarize
 * @param includeMetrics - Whether to include performance metrics
 * @returns Promise<string> - The generated summary
 * 
 * @example
 * const summary = await generateSummary(project, true);
 */
```

### Feature Documentation

For each major feature, document:

```markdown
## Feature: [Name]

### Purpose
What problem does this solve?

### How It Works
1. Step one
2. Step two
3. Step three

### Files Involved
- `ComponentName.tsx` - UI component
- `serviceFile.ts` - Business logic
- `types.ts` - Type definitions

### Dependencies
- Supabase table: `table_name`
- API: Google Gemini
- Environment: `VITE_API_KEY`

### Testing
- How to test manually
- Edge cases to verify
```

---

## Continuous Improvement Loop

### After Every Development Session

**Quick Retrospective:**
1. What worked well?
2. What was challenging?
3. What pattern should I reuse?
4. What should I avoid next time?

### Learning Capture Template

```markdown
## Session: [Date] - [Feature/Task]

### What Was Built
Brief description of the work completed

### Patterns Used
- Pattern 1: [Description]
- Pattern 2: [Description]

### Challenges Encountered
- Challenge 1: [How it was solved]
- Challenge 2: [How it was solved]

### Improvements for Next Time
- [ ] Improvement 1
- [ ] Improvement 2

### Reusable Code
[Code snippet that can be reused]
```

### Metrics to Track

| Metric | How to Measure | Goal |
|--------|----------------|------|
| Time to implement | Start to working feature | Reduce over time |
| Bugs introduced | Errors after deployment | Minimize |
| Code reuse | Similar patterns applied | Maximize |
| Documentation | Features documented | 100% |

---

## Quick Reference Commands

### Daily Workflow Commands

```bash
# Start development
cd ~/logos-vision-crm  # or ~/pulse-app
npm run dev

# Check for issues
npm run build

# Deploy workflow
git add .
git commit -m "feat: [description]"
git push origin main

# Verify deployment
# Check Vercel dashboard or live URL
```

### Git Commit Message Format

```
type(scope): description

Types:
- feat: New feature
- fix: Bug fix
- style: UI/CSS changes
- refactor: Code restructure
- docs: Documentation
- chore: Maintenance

Examples:
- feat(dashboard): add project summary cards
- fix(auth): resolve login redirect issue
- style(sidebar): update glassmorphism effects
```

---

## Priority Reminders

### Before Starting Any Task

**Ask yourself:**
1. Is this the most important thing right now?
2. Does something else need to be finished first?
3. Will this break anything currently working?
4. Do I have all the context I need?

### Task Priority Order

```
🔴 CRITICAL
├── Breaking bugs in production
├── Security issues
└── Data loss prevention

🟠 HIGH
├── Core features incomplete
├── User-facing bugs
└── Performance issues

🟡 MEDIUM
├── New features
├── UI improvements
└── Code refactoring

🟢 LOW
├── Nice-to-have features
├── Documentation updates
└── Code cleanup
```

---

## Summary

This guide implements AI orchestration best practices by:

1. **Specializing tasks** - Different "agent" approaches for different work
2. **Scaling intelligently** - Right-sized responses for task complexity
3. **Maintaining context** - Connected workflows that learn and adapt
4. **Building guardrails** - Quality checks at every stage
5. **Enabling continuous improvement** - Feedback loops that make each session better

**Remember:** The goal isn't just to write code—it's to build systems that work together intelligently, just like an orchestra playing in harmony.

---

**Last Updated:** December 2024  
**For:** Logos Vision CRM & PULSE Development
