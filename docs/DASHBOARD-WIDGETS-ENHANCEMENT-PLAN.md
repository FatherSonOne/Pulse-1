# Dashboard Widgets Enhancement Plan
## Weekly Goals & Team Activity Transformation

## Overview

This document outlines the enhancement of two key Dashboard widgets:
1. **Weekly Goals Widget** - Transform into a customizable goal tracking system
2. **Team Activity Widget** - Transform into a team dashboard with team builder

---

## 1. Weekly Goals Widget Enhancement

### Current State
- Shows 4 hardcoded goals (Weekly Tasks, Response Time, Focus Hours, Meetings Limit)
- Goals are either from Outcomes or fallback to defaults
- Limited editing capability (only progress adjustment)

### Target State
Users can create **custom goals** by selecting data sources from anywhere in Pulse and defining tracking metrics.

### Creative Data Sources for Goals

#### 1. **Task-Based Goals**
- Complete X tasks this week
- Complete X tasks in category Y
- Complete X tasks assigned to project Z
- Average task completion time < X minutes

#### 2. **Message/Communication Goals**
- Response time < X minutes
- Send X messages this week
- Reply to X% of messages
- Message X unique contacts
- Reduce message volume by X%

#### 3. **Meeting Goals**
- Attend < X meetings per week
- Attend > X hours of meetings
- Schedule X one-on-ones
- Keep meetings < X minutes average

#### 4. **Focus/Time Goals**
- Focus hours > X per week
- Focus sessions > X per week
- No meetings during focus blocks
- Complete X deep work sessions

#### 5. **Outcome/Project Goals**
- Complete X outcomes this week
- Achieve X% progress on outcome Y
- Create X new outcomes
- Close X outcomes

#### 6. **Decision/Vote Goals**
- Participate in X decisions
- Vote on X proposals
- Create X decisions
- Reach consensus on X decisions

#### 7. **Contact/Relationship Goals**
- Message X team members
- Have conversations with X new contacts
- Respond to X% of team messages
- Check in with X contacts

#### 8. **Custom Metrics**
- Any calculated metric from analytics
- Combined metrics (e.g., tasks + messages)
- Ratio goals (e.g., tasks/messages ratio)
- Time-based goals (e.g., morning productivity)

### Implementation Architecture

#### Database Schema
```sql
-- Custom Goals Table
CREATE TABLE user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Data Source Configuration
  data_source_type TEXT NOT NULL, -- 'tasks', 'messages', 'meetings', 'outcomes', 'decisions', 'focus_time', 'custom'
  data_source_config JSONB NOT NULL, -- Filter criteria, aggregation rules
  
  -- Goal Configuration
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  unit TEXT NOT NULL, -- 'tasks', 'hours', 'minutes', 'percent', 'count'
  period TEXT NOT NULL DEFAULT 'week', -- 'day', 'week', 'month'
  
  -- Tracking
  trend TEXT DEFAULT 'stable', -- 'up', 'down', 'stable'
  last_calculated_at TIMESTAMPTZ,
  
  -- Display
  color TEXT DEFAULT 'rose',
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX idx_user_goals_active ON user_goals(user_id, is_active);
```

#### Data Source Configuration Examples

**Task Goal:**
```json
{
  "type": "tasks",
  "filter": {
    "completed": true,
    "category": "work",
    "project_id": "optional-project-id"
  },
  "aggregation": "count",
  "date_field": "completed_at"
}
```

**Response Time Goal:**
```json
{
  "type": "messages",
  "filter": {
    "is_outgoing": true
  },
  "aggregation": "average_response_time",
  "date_field": "timestamp"
}
```

**Custom Metric Goal:**
```json
{
  "type": "custom",
  "formula": "(completed_tasks * 2) + (messages_sent * 0.5)",
  "components": [
    {"source": "tasks", "filter": {"completed": true}, "weight": 2},
    {"source": "messages", "filter": {"is_outgoing": true}, "weight": 0.5}
  ]
}
```

#### UI Components

1. **Goal Builder Modal**
   - Step 1: Select data source type
   - Step 2: Configure filters (visual filter builder)
   - Step 3: Set target and unit
   - Step 4: Customize display (title, color, icon)

2. **Data Source Selector**
   - Visual cards for each data source type
   - Preview of available data
   - Quick templates (e.g., "Complete 10 tasks", "Respond in < 15 min")

3. **Goal Editor**
   - Enhanced editor with data source configuration
   - Real-time preview of current value
   - Historical trend visualization

---

## 2. Team Activity Widget Enhancement

### Current State
- Shows all contacts (up to 10)
- Displays online status and unread count
- Links to Messages view

### Target State
**Team Dashboard** with:
- Multiple user-created teams
- Team switching
- Team communication health metrics
- Team votes/projects/decisions overview
- Team builder with Pulse users + non-Pulse contacts

### Database Schema

```sql
-- Teams Table
CREATE TABLE user_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_color TEXT DEFAULT '#6366f1',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, name)
);

-- Team Members Table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES user_teams(id) ON DELETE CASCADE,
  member_type TEXT NOT NULL, -- 'pulse_user', 'contact'
  member_id TEXT NOT NULL, -- pulse_user_id or contact_id
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member'
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(team_id, member_type, member_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(member_type, member_id);
```

### Team Dashboard Features

#### 1. **Team Selector/Builder**
- Dropdown to switch between teams
- "Create Team" button
- Team builder modal with:
  - Search Pulse users (primary)
  - Search contacts (non-Pulse users)
  - "Invite to Pulse" option for non-Pulse contacts
  - Add/remove members
  - Team name and description

#### 2. **Team Metrics Dashboard**

**Communication Health:**
- Average response time
- Message volume (sent/received)
- Active conversations
- Unread message count
- Engagement score

**Votes/Decisions:**
- Active decisions
- Pending votes
- Consensus rate
- Decision velocity

**Projects/Outcomes:**
- Active outcomes
- Completion rate
- Progress metrics
- Upcoming deadlines

**Activity Summary:**
- Recent activity feed
- Top contributors
- Collaboration patterns

#### 3. **Team Member Cards**
- Enhanced cards showing:
  - Online status
  - Unread messages
  - Recent activity indicator
  - Quick actions (message, call)
  - Role badge (if admin/owner)

### Implementation Components

#### 1. Team Service (`teamService.ts`)
```typescript
interface Team {
  id: string;
  userId: string;
  name: string;
  description?: string;
  avatarColor: string;
  members: TeamMember[];
  createdAt: Date;
  updatedAt: Date;
}

interface TeamMember {
  id: string;
  teamId: string;
  memberType: 'pulse_user' | 'contact';
  memberId: string;
  role: 'owner' | 'admin' | 'member';
  // Resolved data
  name?: string;
  avatarColor?: string;
  status?: 'online' | 'offline' | 'busy' | 'away';
  isPulseUser?: boolean;
}

class TeamService {
  async createTeam(userId: string, name: string, memberIds: string[]): Promise<Team>
  async getTeams(userId: string): Promise<Team[]>
  async getTeam(teamId: string): Promise<Team | null>
  async updateTeam(teamId: string, updates: Partial<Team>): Promise<Team>
  async deleteTeam(teamId: string): Promise<void>
  async addMember(teamId: string, memberType: 'pulse_user' | 'contact', memberId: string): Promise<void>
  async removeMember(teamId: string, memberId: string): Promise<void>
  async getTeamMetrics(teamId: string, timeRange: 'day' | 'week' | 'month'): Promise<TeamMetrics>
}
```

#### 2. Team Metrics Service
```typescript
interface TeamMetrics {
  communicationHealth: {
    avgResponseTime: number;
    messageVolume: { sent: number; received: number };
    activeConversations: number;
    unreadCount: number;
    engagementScore: number; // 0-100
  };
  votes: {
    activeDecisions: number;
    pendingVotes: number;
    consensusRate: number;
  };
  projects: {
    activeOutcomes: number;
    completionRate: number;
    avgProgress: number;
  };
  activity: {
    recentActivity: ActivityItem[];
    topContributors: Contributor[];
  };
}
```

#### 3. Team Builder Component
- Modal with two tabs: "Pulse Users" and "Contacts"
- Search functionality for both
- Selected members list
- "Invite to Pulse" button for non-Pulse contacts
- Team configuration (name, description, color)

---

## Implementation Phases

### Phase 1: Database & Services (2-3 days)
1. Create database migrations
2. Implement TeamService
3. Implement GoalService (for custom goals)
4. Create metrics calculation services

### Phase 2: Team Builder UI (2-3 days)
1. Team selector component
2. Team builder modal
3. Pulse user search integration
4. Contact search integration
5. "Invite to Pulse" flow

### Phase 3: Team Dashboard (3-4 days)
1. Team metrics calculation
2. Communication health visualization
3. Votes/projects overview
4. Activity feed
5. Enhanced team member cards

### Phase 4: Custom Goals UI (3-4 days)
1. Goal builder modal
2. Data source selector
3. Filter configuration UI
4. Goal editor enhancements
5. Goal calculation engine

### Phase 5: Integration & Polish (1-2 days)
1. Wire everything together
2. Update Dashboard component
3. Testing and bug fixes
4. Performance optimization

**Total Estimated Time: 11-16 days**

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 1 (Database & Services)
3. Iterate based on feedback
4. Deploy incrementally

---

## Questions to Consider

1. **Goals:**
   - Maximum number of goals per user?
   - Should goals sync across devices?
   - Real-time updates or periodic calculation?

2. **Teams:**
   - Maximum team size?
   - Team sharing/collaboration?
   - Team templates?
   - Export team data?

3. **Performance:**
   - Cache metrics calculations?
   - Batch updates?
   - Real-time vs. periodic refresh?
