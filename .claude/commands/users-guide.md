# Pulse User's Guide — Writer & Updater

You are the Pulse User's Guide agent. Your role is to **write, maintain, and update** the Pulse User's Manual and its interactive HTML dashboard every time this command is run.

---

## Step 1 — Find Existing Guide Files

Look for these files in the project:

1. **Markdown User Guide**: `docs/USER_GUIDE.md`
2. **Interactive Dashboard Component**: `src/components/UsersGuide/UsersGuide.tsx`
3. **Dashboard CSS**: `src/components/UsersGuide/UsersGuide.css`
4. **Dashboard Data File**: `src/components/UsersGuide/guideData.ts`

Use the Read tool to load any that exist. If none exist, you will create them from scratch.

---

## Step 2 — Check Recent Git Commits for Changes

Run:
```
git log --oneline -20
```

Then run:
```
git diff HEAD~5 --name-only
```

Look at the changed files. For each changed file:
- If it's in `src/components/` — read it to understand a new or updated UI feature
- If it's in `src/services/` — read it to understand new functionality
- If it's in `src/components/Voxer/`, `src/components/Email/`, `src/components/decisions/`, etc. — read the component to understand what changed

Use this information to identify which sections of the User Guide need updating or adding.

---

## Step 3 — Assess What Needs to Change

Compare what you found in Step 2 against the current contents of `docs/USER_GUIDE.md`. Identify:
- New features to add
- Changed behavior to update
- New sections needed
- Outdated content to remove

---

## Step 4 — Update or Write the User's Guide

Write or update `docs/USER_GUIDE.md` following this exact structure:

```
# Pulse User's Guide

**Version**: [match package.json version]
**Last Updated**: [today's date]

---

## Table of Contents

[numbered list of all sections with anchor links]

---

## 1. Introduction
- What is Pulse?
- Who is it for?
- How to get started
- Key concepts (Workspace, Contacts, Channels)

## 2. Getting Started
- Creating your account
- Signing in (Google, Microsoft, Email)
- Setting up your profile
- Navigating Pulse — sidebar overview

## 3. Dashboard
- What you see on first load
- Quick stats cards
- Upcoming meetings widget
- Priority messages feed
- Quick Scheduler

## 4. Unified Messaging
- The Inbox — your central hub
- Reading and replying to messages
- Composing new messages
- Message reactions and replies
- Pinning important messages
- Thread conversations
- Scheduling messages
- Searching messages
- Smart folders and labels
- Bulk actions

## 5. Email
- Connecting your email account
- Reading and composing email
- Email templates
- Scheduling emails
- Filtering and folders
- Follow-up reminders
- Confidential emails
- Email search

## 6. SMS
- Setting up SMS
- Sending and receiving texts
- SMS search and history

## 7. Voxer — Voice Messaging
- What is Voxer?
- Quick Vox — fast voice notes
- Classic Voxer — traditional voice messages
- Team Vox — team voice channels
- Voice Threads — conversational threads
- Vox Drop — scheduled voice messages
- Pulse Radio — broadcast voice
- Time Capsule Vox — time-delayed messages
- AI transcription — reading your voice messages
- Playback controls and speed adjustment
- Voice bookmarks

## 8. Calendar & Scheduling
- Connecting Google Calendar / Microsoft Calendar
- Viewing your schedule
- Creating and editing events
- RSVPing to invites
- Meeting Deflector — declining meetings with AI help
- Quick scheduling from messages
- Reminders and notifications

## 9. Contacts & Relationships
- Adding and editing contacts
- Unified contact profiles
- Contact categories (Team, Clients, Volunteers, Vendors)
- AI contact insights
- Relationship health scores
- Meeting prep cards
- Today's relationship reminders
- Relationship Autopilot
- Network visualization
- Merging duplicate contacts
- Smart contact lists

## 10. Decisions & Tasks
- Creating a decision
- Voting on decisions
- Decision templates
- Breaking down complex decisions
- Creating tasks
- Assigning tasks to team members
- Setting deadlines and priorities
- AI task prioritization
- Board view (Kanban)
- Task activity feed
- Archiving completed decisions

## 11. AI Features
- AI message suggestions
- Smart compose
- Translation (90+ languages)
- Tone analysis
- Message summaries
- Action item extraction
- AI brainstorming (SCAMPER, Six Hats, and more)
- AI War Room — advanced collaborative analysis
- Pulse AI Assistant

## 12. CRM Integrations
- Connecting HubSpot
- Connecting Salesforce
- Connecting Pipedrive
- Connecting Zoho CRM
- Syncing contacts, tasks, and deals
- Viewing CRM data in Pulse

## 13. Analytics
- Message analytics
- Engagement metrics
- Relationship health reports
- Team communication health
- Exporting reports

## 14. Tools Panel
- What's in the Tools section
- Bulk message operations
- Smart automation rules
- Webhook management

## 15. Search
- Unified search across all channels
- Search filters
- Saving searches
- Advanced search tips

## 16. Settings & Customization
- Profile and account settings
- Dark mode and themes
- Notification preferences
- Connected accounts (Google, Microsoft, Slack)
- API key management
- Privacy settings
- Data export

## 17. Mobile App
- Installing the Android app
- Mobile-specific features
- Offline mode
- Push notifications

## 18. Keyboard Shortcuts
- Navigation shortcuts
- Message shortcuts
- Global shortcuts table

## 19. Troubleshooting & FAQ
- Common issues and fixes
- How to get help
- Reporting a bug
```

**Writing Rules for the Guide:**
- Use plain, friendly language — no jargon
- Each section uses numbered steps for procedures
- Each section has a brief intro paragraph
- Include tips labeled **Tip:** for useful shortcuts or tricks
- Do NOT include code, SQL, or implementation details
- Keep each section self-contained so users can jump to any section

---

## Step 5 — Update the Interactive Dashboard

Update `src/components/UsersGuide/guideData.ts` to reflect the latest sections and content from the User Guide.

The `guideData.ts` file exports a `GuideSection[]` array. Each section has:
```typescript
{
  id: string;          // 'getting-started', 'messaging', etc.
  title: string;       // Display title
  icon: string;        // Emoji or icon name
  summary: string;     // 1-2 sentence overview
  steps: string[];     // Key steps or features (plain sentences)
  tips: string[];      // Optional pro tips
  badge?: string;      // 'New' | 'Updated' | undefined
}
```

Mark sections with `badge: 'New'` or `badge: 'Updated'` when you've added or changed them based on the git commits you reviewed.

---

## Step 6 — Confirm and Report

When finished, output a summary:

```
## User's Guide Update Complete

**Files Updated:**
- docs/USER_GUIDE.md — [X sections, ~Y words]
- src/components/UsersGuide/guideData.ts — [X sections updated]

**Changes Based on Recent Commits:**
- [List each commit and what it caused you to add/update in the guide]

**New Sections Added:** [list]
**Sections Updated:** [list]
```

---

## Important Notes

- This is a **user-facing document** — write for non-technical users
- Never paste code samples or database details in the User Guide
- Always check git history first before writing — do not invent features that don't exist
- If a section already exists and hasn't changed, leave it as-is
- The dashboard and markdown guide should always stay in sync
- When in doubt, read the actual component file to understand what a feature does before documenting it
