import React, { useState, useEffect, useCallback } from 'react';
import { saveTestResult, loadTestResults, saveTesterName, clearTestResults, TestStatus } from '../services/testMatrixService';
import { getSessionUserSync } from '../services/authService';

import { Check, ClipboardCheck, Download, Loader2, RotateCcw, StickyNote } from 'lucide-react';

interface TestCase {
  id: string;
  name: string;
  steps: string[];
  expected: string;
  status: TestStatus;
  notes: string;
}

interface TestSection {
  id: string;
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tests: TestCase[];
}

const initialTestData: TestSection[] = [
  // ── AUTHENTICATION ───────────────────────────────────────────────────────
  {
    id: 'auth',
    title: 'Authentication',
    priority: 'critical',
    tests: [
      { id: 'auth-1', name: 'Google OAuth Login', steps: ['Click "Continue with Google"', 'Complete Google auth'], expected: 'User redirected back, logged in, Dashboard shown', status: 'pending', notes: '' },
      { id: 'auth-2', name: 'Microsoft OAuth Login', steps: ['Click "Continue with Microsoft"', 'Complete MS auth'], expected: 'User redirected back, logged in, Dashboard shown', status: 'pending', notes: '' },
      { id: 'auth-3', name: 'Email Signup', steps: ['Click "Sign in with Email"', 'Click "Create an account"', 'Fill form, submit'], expected: 'Account created, user logged in', status: 'pending', notes: '' },
      { id: 'auth-4', name: 'Email Login', steps: ['Click "Sign in with Email"', 'Enter credentials, submit'], expected: 'User logged in, Dashboard shown', status: 'pending', notes: '' },
      { id: 'auth-5', name: 'Invalid Email Login', steps: ['Enter wrong password'], expected: 'Error message displayed', status: 'pending', notes: '' },
      { id: 'auth-6', name: 'Session Persistence', steps: ['Login', 'Refresh page'], expected: 'User remains logged in', status: 'pending', notes: '' },
      { id: 'auth-7', name: 'Logout', steps: ['Go to Settings', 'Logout'], expected: 'User logged out, Login screen shown', status: 'pending', notes: '' },
    ]
  },
  // ── DASHBOARD ────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    title: 'Dashboard',
    priority: 'high',
    tests: [
      { id: 'dash-1', name: 'Dashboard Load', steps: ['Navigate to Dashboard (G→D)'], expected: 'Dashboard loads with all widgets', status: 'pending', notes: '' },
      { id: 'dash-2', name: 'Daily Overview Briefing', steps: ['Open Dashboard', 'View Daily Overview at top'], expected: 'AI greeting, summary, key highlights, action items, focus recommendation shown', status: 'pending', notes: '' },
      { id: 'dash-3', name: 'Key Highlight Click', steps: ['Click any Key Highlight card in Daily Overview'], expected: 'Navigates directly to that item', status: 'pending', notes: '' },
      { id: 'dash-4', name: 'Focus Recommendation', steps: ['Click Focus Recommendation in Daily Overview'], expected: 'Jumps to the most important item', status: 'pending', notes: '' },
      { id: 'dash-5', name: 'AI Web Search Bar', steps: ['Type a question in the web search bar', 'Press Enter'], expected: 'AI summary with source links displayed', status: 'pending', notes: '' },
      { id: 'dash-6', name: 'Mini Pulse AI Widget', steps: ['Tap a quick chip or type a question'], expected: 'Inline AI response appears; "Open Pulse AI" link works', status: 'pending', notes: '' },
      { id: 'dash-7', name: 'Upcoming Events Widget', steps: ['View upcoming events section'], expected: 'Next 3 calendar events with live countdown badges', status: 'pending', notes: '' },
      { id: 'dash-8', name: 'Unread Pulse Widget', steps: ['View unread counts section'], expected: 'Unread Messages, Email, Vox as tappable rows; click navigates', status: 'pending', notes: '' },
      { id: 'dash-9', name: 'Quick Scheduler', steps: ['Click + Schedule', 'Enter title, date, time, guests', 'Click Create'], expected: 'Event created on calendar, guests receive invites', status: 'pending', notes: '' },
      { id: 'dash-10', name: 'AI Nudges', steps: ['Trigger overdue task or stalled decision'], expected: 'Nudge banner appears with action button; Dismiss works', status: 'pending', notes: '' },
      { id: 'dash-11', name: 'Daily Overview Refresh', steps: ['Click refresh icon on Daily Overview'], expected: 'Briefing regenerates with updated data', status: 'pending', notes: '' },
    ]
  },
  // ── UNIFIED MESSAGING ────────────────────────────────────────────────────
  {
    id: 'messages',
    title: 'Unified Messaging',
    priority: 'high',
    tests: [
      { id: 'msg-1', name: 'View Messages', steps: ['Navigate to Messages (G→M)'], expected: 'Conversations sorted by most recent, unread blue dot', status: 'pending', notes: '' },
      { id: 'msg-2', name: 'Open Thread', steps: ['Click a conversation'], expected: 'Messages shown in reading panel', status: 'pending', notes: '' },
      { id: 'msg-3', name: 'Send Message', steps: ['Type message', 'Press Enter'], expected: 'Message appears in thread', status: 'pending', notes: '' },
      { id: 'msg-4', name: 'Real-time Receive', steps: ['Receive message from another user'], expected: 'Message appears immediately without refresh', status: 'pending', notes: '' },
      { id: 'msg-5', name: 'Compose New Message', steps: ['Click Compose (pencil icon)', 'Enter recipient', 'Send'], expected: 'New conversation created', status: 'pending', notes: '' },
      { id: 'msg-6', name: 'Inline Tools (/ Menu)', steps: ['Press / in message box'], expected: 'Menu appears: GIF, file, task, poll, reminder', status: 'pending', notes: '' },
      { id: 'msg-7', name: 'Emoji Reactions', steps: ['Hover over message', 'Click emoji reaction'], expected: 'Reaction appears on message', status: 'pending', notes: '' },
      { id: 'msg-8', name: 'Pin Message', steps: ['Hover message', 'Click pin icon'], expected: 'Message pinned; View Pinned shows it', status: 'pending', notes: '' },
      { id: 'msg-9', name: 'Reply in Thread', steps: ['Click Reply in Thread on a message'], expected: 'Thread panel opens; replies visible in sidebar', status: 'pending', notes: '' },
      { id: 'msg-10', name: 'Bookmark Message', steps: ['Click bookmark icon on a message'], expected: 'Message saved to Bookmarks panel', status: 'pending', notes: '' },
      { id: 'msg-11', name: 'Schedule Message', steps: ['Click clock icon next to send', 'Pick date/time'], expected: 'Message queued for scheduled delivery', status: 'pending', notes: '' },
      { id: 'msg-12', name: 'Smart Folders', steps: ['Click Priority, Team, Follow-ups, Archived folders'], expected: 'Correct filtered messages shown per folder', status: 'pending', notes: '' },
      { id: 'msg-13', name: 'Conversation Highlights', steps: ['Click Highlights on a conversation'], expected: 'AI-extracted decisions, action items, commitments shown', status: 'pending', notes: '' },
      { id: 'msg-14', name: 'Sentiment Timeline', steps: ['Click Insights → Sentiment Timeline'], expected: 'Graph of conversation tone over time', status: 'pending', notes: '' },
      { id: 'msg-15', name: 'Natural Language Search', steps: ['Search "messages from David last week about the proposal"'], expected: 'Relevant messages found', status: 'pending', notes: '' },
      { id: 'msg-16', name: 'Bulk Actions', steps: ['Select multiple conversations', 'Archive/Mark Read/Delete/Label'], expected: 'Bulk action applied to all selected', status: 'pending', notes: '' },
      { id: 'msg-17', name: 'Ecosystem Bot Messages', steps: ['Trigger bot card from Entomate/Logos Vision'], expected: 'Rich bot card displayed with action buttons', status: 'pending', notes: '' },
      { id: 'msg-18', name: '@mention', steps: ['Type @ in message', 'Select teammate'], expected: 'Mention formatted; teammate notified', status: 'pending', notes: '' },
    ]
  },
  // ── EMAIL ────────────────────────────────────────────────────────────────
  {
    id: 'email',
    title: 'Email',
    priority: 'high',
    tests: [
      { id: 'email-1', name: 'View Email Inbox', steps: ['Navigate to Email'], expected: 'Inbox displayed with emails sorted by date', status: 'pending', notes: '' },
      { id: 'email-2', name: 'Read Email', steps: ['Click an email'], expected: 'Email content shown in reading pane', status: 'pending', notes: '' },
      { id: 'email-3', name: 'Compose & Send', steps: ['Click Compose', 'Fill fields', 'Click Send'], expected: 'Email sent successfully', status: 'pending', notes: '' },
      { id: 'email-4', name: 'AI Daily Briefing', steps: ['Open Email inbox'], expected: 'AI briefing at top: priority emails, action items, important senders', status: 'pending', notes: '' },
      { id: 'email-5', name: 'Star / Flag Email', steps: ['Click star icon on email'], expected: 'Email starred, persists on refresh', status: 'pending', notes: '' },
      { id: 'email-6', name: 'Folder Navigation', steps: ['Click Inbox, Sent, Drafts, Starred, Spam folders'], expected: 'Correct emails shown per folder', status: 'pending', notes: '' },
      { id: 'email-7', name: 'Email Templates', steps: ['Click Templates icon while composing', 'Select template'], expected: 'Template inserted with variables ({{first_name}}, etc.)', status: 'pending', notes: '' },
      { id: 'email-8', name: 'Schedule Email', steps: ['Click clock icon next to Send', 'Pick time'], expected: 'Email queued; appears in Scheduled folder; can cancel', status: 'pending', notes: '' },
      { id: 'email-9', name: 'Email Filters', steps: ['Settings → Email Filters → New Filter', 'Set conditions/actions', 'Save'], expected: 'Filter runs on matching emails automatically', status: 'pending', notes: '' },
      { id: 'email-10', name: 'Follow-up Reminders', steps: ['Click Set Follow-up Reminder on email', 'Pick time'], expected: 'Reminder fires if thread has no reply by set time', status: 'pending', notes: '' },
      { id: 'email-11', name: 'Extract Action Items', steps: ['Click Extract Action Items on email thread'], expected: 'Tasks extracted with source context; Add to Tasks works', status: 'pending', notes: '' },
      { id: 'email-12', name: 'Snooze Email', steps: ['Right-click email → Snooze → pick time'], expected: 'Email hidden; reappears at top of inbox at chosen time', status: 'pending', notes: '' },
      { id: 'email-13', name: 'AI Smart Compose', steps: ['Click AI icon in composer'], expected: 'AI auto-completes draft based on context', status: 'pending', notes: '' },
      { id: 'email-14', name: 'Email Campaigns', steps: ['Email → Campaigns → New Campaign', 'Setup, Compose, Review & Send'], expected: 'Campaign sent to audience segment; dashboard shows status', status: 'pending', notes: '' },
      { id: 'email-15', name: 'Audience Segments', steps: ['In Campaign Setup → select segment or create custom'], expected: 'Recipient list auto-populated from segment; preview count works', status: 'pending', notes: '' },
      { id: 'email-16', name: 'Campaign AI Draft', steps: ['In Campaign Compose → click AI Draft → describe topic'], expected: 'AI generates campaign email draft', status: 'pending', notes: '' },
    ]
  },
  // ── SMS ──────────────────────────────────────────────────────────────────
  {
    id: 'sms',
    title: 'SMS',
    priority: 'high',
    tests: [
      { id: 'sms-1', name: 'View SMS Conversations', steps: ['Navigate to SMS (G→S)'], expected: 'Text conversations sorted by most recent', status: 'pending', notes: '' },
      { id: 'sms-2', name: 'Send SMS', steps: ['Click New Message', 'Enter phone/contact', 'Type and send'], expected: 'SMS sent and appears in thread', status: 'pending', notes: '' },
      { id: 'sms-3', name: 'Receive SMS', steps: ['Have someone text your connected number'], expected: 'Incoming SMS appears in real-time', status: 'pending', notes: '' },
      { id: 'sms-4', name: 'SMS Templates', steps: ['Click Template icon while composing', 'Select template'], expected: 'Template inserted with variables', status: 'pending', notes: '' },
      { id: 'sms-5', name: 'Schedule SMS', steps: ['Click clock icon next to Send', 'Pick date/time'], expected: 'SMS queued in Scheduled folder', status: 'pending', notes: '' },
      { id: 'sms-6', name: 'Search SMS History', steps: ['Type in search bar at top of SMS panel'], expected: 'All matching text history shown', status: 'pending', notes: '' },
      { id: 'sms-7', name: 'Smart SMS Suggestions', steps: ['Start composing SMS to a frequent contact'], expected: 'AI suggests completions based on patterns', status: 'pending', notes: '' },
    ]
  },
  // ── VOXER ────────────────────────────────────────────────────────────────
  {
    id: 'voxer',
    title: 'Voxer — Voice Messaging',
    priority: 'high',
    tests: [
      { id: 'vox-1', name: 'Open Voxer Hub', steps: ['Navigate to Voxer (G→V)'], expected: 'Voxer hub loads with mode toolbar', status: 'pending', notes: '' },
      { id: 'vox-2', name: 'Classic Voxer (Key 1)', steps: ['Press 1 or select Classic', 'Record, preview, send'], expected: 'Recording previewed, then sent to recipient', status: 'pending', notes: '' },
      { id: 'vox-3', name: 'Pulse Radio (Key 2)', steps: ['Press 2', 'Select audience', 'Record', 'Click Broadcast'], expected: 'Each recipient receives the message individually', status: 'pending', notes: '' },
      { id: 'vox-4', name: 'Voice Threads (Key 3)', steps: ['Press 3', 'Open/start thread', 'Record reply'], expected: 'Reply added chronologically; AI summary updates', status: 'pending', notes: '' },
      { id: 'vox-5', name: 'Team Vox (Key 4)', steps: ['Press 4', 'Choose/create channel', 'Record and send'], expected: 'All channel members receive message; @mentions work', status: 'pending', notes: '' },
      { id: 'vox-6', name: 'Vox Notes (Key 5)', steps: ['Press 5', 'Record note'], expected: 'Saved to personal library (not sent); transcribed and searchable', status: 'pending', notes: '' },
      { id: 'vox-7', name: 'Quick Vox (Key 6)', steps: ['Press 6', 'Choose recipient', 'Hold record, release to send'], expected: 'Voice note sent instantly (no preview step)', status: 'pending', notes: '' },
      { id: 'vox-8', name: 'Vox Drop (Key 7)', steps: ['Press 7', 'Record', 'Schedule delivery date/time'], expected: 'Message auto-sends at scheduled time; cancel works', status: 'pending', notes: '' },
      { id: 'vox-9', name: 'Video Vox (Key 8)', steps: ['Press 8', 'Allow camera', 'Record video, review, send'], expected: 'Video message sent to recipient', status: 'pending', notes: '' },
      { id: 'vox-10', name: 'Time Capsule Vox', steps: ['Select Time Capsule', 'Record', 'Set unlock date', 'Send'], expected: 'Message locked until unlock date; recipient sees locked state', status: 'pending', notes: '' },
      { id: 'vox-11', name: 'AI Transcription', steps: ['Send or receive a voice message'], expected: 'AI transcript appears below audio player', status: 'pending', notes: '' },
      { id: 'vox-12', name: 'AI Summarize (Ctrl+S)', steps: ['Open a conversation', 'Press Ctrl+S or click Summarize'], expected: 'Written summary of the full conversation generated', status: 'pending', notes: '' },
      { id: 'vox-13', name: 'Smart Replies', steps: ['Click Smart Replies in AI toolbar'], expected: '3 quick voice reply suggestions shown', status: 'pending', notes: '' },
      { id: 'vox-14', name: 'Playback Speed', steps: ['Play a message', 'Change speed to 1.5x or 2x'], expected: 'Playback speed changes correctly', status: 'pending', notes: '' },
      { id: 'vox-15', name: 'Bulk Select & Archive', steps: ['Press Ctrl+A or click Select', 'Select messages', 'Archive/Download'], expected: 'Bulk operation applied to selected messages', status: 'pending', notes: '' },
    ]
  },
  // ── MEETINGS HUB ─────────────────────────────────────────────────────────
  {
    id: 'meetings',
    title: 'Meetings Hub',
    priority: 'high',
    tests: [
      { id: 'meet-1', name: 'Open Meetings Dashboard', steps: ['Navigate to Meetings (G→N)'], expected: 'Meetings dashboard loads', status: 'pending', notes: '' },
      { id: 'meet-2', name: 'Start New Meeting', steps: ['Click New Meeting'], expected: 'Pulse Video call starts; meeting code generated', status: 'pending', notes: '' },
      { id: 'meet-3', name: 'Join Meeting by Code', steps: ['Paste code or link', 'Click Join'], expected: 'Successfully joins the meeting', status: 'pending', notes: '' },
      { id: 'meet-4', name: 'Meeting Templates', steps: ['Click Meeting Templates', 'Select Standup/1:1/Sprint/Brainstorm'], expected: 'Agenda pre-populated from template', status: 'pending', notes: '' },
      { id: 'meet-5', name: 'Agenda Builder', steps: ['Click Agenda Builder', 'Add items with title, duration, presenter'], expected: 'Agenda created; shareable with participants', status: 'pending', notes: '' },
      { id: 'meet-6', name: 'Meeting Action Items', steps: ['Click Action Items during/after meeting', 'Add item with assignee/due date'], expected: 'Items sync to Decisions & Tasks', status: 'pending', notes: '' },
      { id: 'meet-7', name: 'Recordings & Transcripts', steps: ['Click Recordings', 'Browse/search past meetings'], expected: 'Video, transcript, AI summary, and action items shown', status: 'pending', notes: '' },
      { id: 'meet-8', name: 'Breakout Rooms', steps: ['During Pulse Video meeting', 'Click Breakout Rooms', 'Assign/randomize', 'Open rooms'], expected: 'Participants move to breakout rooms; timer and broadcast work', status: 'pending', notes: '' },
      { id: 'meet-9', name: 'Meeting Analytics', steps: ['Click Meeting Analytics'], expected: 'Total meetings, avg duration, frequency, attendance rates shown', status: 'pending', notes: '' },
      { id: 'meet-10', name: 'Meeting Briefing Cards', steps: ['Have a meeting approaching', 'Check Messages or Meetings Dashboard'], expected: 'Briefing card shows participants, past context, open action items', status: 'pending', notes: '' },
      { id: 'meet-11', name: 'Meeting Recap Cards', steps: ['End a Pulse Video meeting', 'Check Messages feed'], expected: 'Recap card with MIP summary, sentiment, decisions, action items', status: 'pending', notes: '' },
      { id: 'meet-12', name: 'Auto-Export to Entomate', steps: ['Enable in Meeting Settings', 'End a meeting'], expected: 'Recording and data exported to Entomate automatically', status: 'pending', notes: '' },
    ]
  },
  // ── CALENDAR & SCHEDULING ────────────────────────────────────────────────
  {
    id: 'calendar',
    title: 'Calendar & Scheduling',
    priority: 'high',
    tests: [
      { id: 'cal-1', name: 'View Calendar', steps: ['Navigate to Calendar (G→C)'], expected: 'Calendar displayed with events', status: 'pending', notes: '' },
      { id: 'cal-2', name: 'Create Event', steps: ['Click empty time slot', 'Fill form (title, date, time, guests)', 'Save'], expected: 'Event appears on calendar; guests receive invites', status: 'pending', notes: '' },
      { id: 'cal-3', name: 'Edit Event', steps: ['Click event', 'Modify fields', 'Save'], expected: 'Changes persisted; attendees notified', status: 'pending', notes: '' },
      { id: 'cal-4', name: 'Delete Event', steps: ['Delete an event'], expected: 'Event removed from calendar', status: 'pending', notes: '' },
      { id: 'cal-5', name: 'View Switching', steps: ['Toggle Day, Week, Month, Timeline views'], expected: 'Calendar renders correctly in each view', status: 'pending', notes: '' },
      { id: 'cal-6', name: 'Drag & Drop Reschedule', steps: ['Drag an event to a new time slot'], expected: 'Event rescheduled; attendees notified', status: 'pending', notes: '' },
      { id: 'cal-7', name: 'Recurring Events', steps: ['Create event', 'Set recurrence (daily/weekly/monthly)'], expected: 'Future occurrences generated; edit-one vs edit-all works', status: 'pending', notes: '' },
      { id: 'cal-8', name: 'Event Comments', steps: ['Open event', 'Click Comments tab', 'Post a comment'], expected: 'Comment visible to all attendees', status: 'pending', notes: '' },
      { id: 'cal-9', name: 'Booking Pages', steps: ['Calendar → Booking Pages → Create', 'Set availability', 'Save'], expected: 'Shareable booking link generated; external users can book', status: 'pending', notes: '' },
      { id: 'cal-10', name: 'Meeting Deflector', steps: ['Open an event', 'Click Meeting Deflector'], expected: 'AI analysis + recommendation (Attend/Delegate/Decline); draft decline message', status: 'pending', notes: '' },
      { id: 'cal-11', name: 'Smart Scheduling (Find Time)', steps: ['Create event with attendees', 'Click Find Time'], expected: '3 available time slots suggested based on attendee calendars', status: 'pending', notes: '' },
      { id: 'cal-12', name: 'Reminders', steps: ['Create/edit event', 'Add reminder (5m, 15m, 1h, 1d)'], expected: 'Reminder fires at chosen time (in-app + push on mobile)', status: 'pending', notes: '' },
      { id: 'cal-13', name: 'Calendar Sync', steps: ['Settings → Connected Accounts → Connect Calendar'], expected: 'Google/Microsoft calendar events sync into Pulse', status: 'pending', notes: '' },
    ]
  },
  // ── CONTACTS & RELATIONSHIPS ─────────────────────────────────────────────
  {
    id: 'contacts',
    title: 'Contacts & Relationships',
    priority: 'high',
    tests: [
      { id: 'cont-1', name: 'View Contacts', steps: ['Navigate to Contacts (G→P)'], expected: 'Contact list displayed from all connected accounts', status: 'pending', notes: '' },
      { id: 'cont-2', name: 'Create Contact', steps: ['Click Add', 'Fill form', 'Save'], expected: 'New contact appears in list', status: 'pending', notes: '' },
      { id: 'cont-3', name: 'Edit Contact', steps: ['Click contact', 'Edit fields', 'Save'], expected: 'Changes persisted', status: 'pending', notes: '' },
      { id: 'cont-4', name: 'Delete Contact', steps: ['Delete a contact'], expected: 'Contact removed from list', status: 'pending', notes: '' },
      { id: 'cont-5', name: 'Search Contacts', steps: ['Type in search bar'], expected: 'Filtered results shown', status: 'pending', notes: '' },
      { id: 'cont-6', name: 'Contact Profile', steps: ['Click contact to open profile'], expected: 'Shows history, CRM data, notes, goals, relationship score', status: 'pending', notes: '' },
      { id: 'cont-7', name: 'AI Contact Insights', steps: ['Open contact profile', 'View AI insights'], expected: 'Talking points, relationship score, communication patterns, sentiment', status: 'pending', notes: '' },
      { id: 'cont-8', name: 'Contact Map', steps: ['Click Map View at top of Contacts'], expected: 'Google Maps with contact pins; filter by Circle/Category; radius rings', status: 'pending', notes: '' },
      { id: 'cont-9', name: 'Contact Circles', steps: ['Click New Circle', 'Name it', 'Add contacts'], expected: 'Circle created; bubble chart visualization works', status: 'pending', notes: '' },
      { id: 'cont-10', name: 'Relationship Autopilot', steps: ['Open contact', 'Toggle Autopilot on', 'Set frequency'], expected: 'Contact appears in Today Feed at set interval', status: 'pending', notes: '' },
      { id: 'cont-11', name: 'Today Feed', steps: ['Click Today Feed view in Contacts'], expected: 'Shows cold contacts, birthdays, follow-ups, autopilot reminders', status: 'pending', notes: '' },
      { id: 'cont-12', name: 'Network View', steps: ['Click Network View'], expected: 'Visual connection map with bridges and gaps', status: 'pending', notes: '' },
      { id: 'cont-13', name: 'Meeting Prep Cards', steps: ['Click attendee name before a meeting'], expected: 'Key facts, recent exchanges, pending tasks, AI talking points', status: 'pending', notes: '' },
      { id: 'cont-14', name: 'Smart Contact Lists', steps: ['Click New List', 'Set dynamic filters', 'Save'], expected: 'List auto-updates as contacts change', status: 'pending', notes: '' },
      { id: 'cont-15', name: 'Merge Duplicates', steps: ['Contacts → Tools → Find Duplicates', 'Click Merge'], expected: 'Duplicate merged; data from both preserved', status: 'pending', notes: '' },
      { id: 'cont-16', name: 'Categories', steps: ['Assign contact to Team/Clients/Volunteers/Vendors'], expected: 'Category applied; filterable', status: 'pending', notes: '' },
    ]
  },
  // ── DECISIONS & TASKS ────────────────────────────────────────────────────
  {
    id: 'decisions-tasks',
    title: 'Decisions & Tasks',
    priority: 'high',
    tests: [
      { id: 'dec-1', name: 'Create Decision', steps: ['Click New Decision', 'Enter question title, description, deadline'], expected: 'Decision created; team members can vote', status: 'pending', notes: '' },
      { id: 'dec-2', name: 'Vote on Decision', steps: ['Open a decision', 'Vote Yes/No/Abstain with optional comment'], expected: 'Vote tallies update in real-time', status: 'pending', notes: '' },
      { id: 'dec-3', name: 'Decision Templates', steps: ['New Decision → Use Template (Pros/Cons, Priority Matrix, Go/No-Go, RACI)'], expected: 'Template structure applied to decision', status: 'pending', notes: '' },
      { id: 'dec-4', name: 'AI Decompose', steps: ['Open complex decision', 'Click Decompose'], expected: 'Sub-decisions created with dependencies', status: 'pending', notes: '' },
      { id: 'dec-5', name: 'Convert Decision to Tasks', steps: ['Finalize decision', 'Click Convert to Tasks'], expected: 'Tasks created with context and suggested assignees', status: 'pending', notes: '' },
      { id: 'task-1', name: 'Create Task', steps: ['Click New Task', 'Set title, assignee, priority, deadline, subtasks'], expected: 'Task appears; assignee notified', status: 'pending', notes: '' },
      { id: 'task-2', name: 'Complete Task', steps: ['Check/uncheck task'], expected: 'Status updates, persists on refresh', status: 'pending', notes: '' },
      { id: 'task-3', name: 'Edit Task', steps: ['Click task', 'Modify fields', 'Save'], expected: 'Changes persisted', status: 'pending', notes: '' },
      { id: 'task-4', name: 'Delete Task', steps: ['Delete a task'], expected: 'Task removed', status: 'pending', notes: '' },
      { id: 'task-5', name: 'Board View (Kanban)', steps: ['Click Board View', 'Drag tasks between To Do / In Progress / Done'], expected: 'Status updates on drag; filter by assignee/tag works', status: 'pending', notes: '' },
      { id: 'task-6', name: 'Workload Heatmap', steps: ['Click Heatmap View'], expected: 'Color-coded grid per person per day; click cell shows tasks; drag reassigns', status: 'pending', notes: '' },
      { id: 'task-7', name: 'AI Task Prioritization', steps: ['Click AI Prioritize'], expected: 'Suggested task order with explanations', status: 'pending', notes: '' },
      { id: 'task-8', name: 'Proactive Nudges', steps: ['Let tasks go overdue or decisions stall'], expected: 'Nudges appear: overdue, unresolved votes, overloaded, stale decision', status: 'pending', notes: '' },
      { id: 'task-9', name: 'In-Context AI Assistant', steps: ['Click Bot button', 'Ask "Which tasks are overdue?" or give action'], expected: 'AI responds with awareness of workspace decisions/tasks', status: 'pending', notes: '' },
    ]
  },
  // ── AI FEATURES ──────────────────────────────────────────────────────────
  {
    id: 'ai',
    title: 'AI Features',
    priority: 'high',
    tests: [
      { id: 'ai-1', name: 'Pulse AI Assistant (Ctrl+/)', steps: ['Press Ctrl+/ or click ECG icon'], expected: 'AI assistant opens; loads current section context', status: 'pending', notes: '' },
      { id: 'ai-2', name: 'AI Context Awareness', steps: ['Open AI in Messages', 'Ask about messages', 'Switch to Tasks', 'Ask about tasks'], expected: 'AI loads relevant data per section; chat history preserved', status: 'pending', notes: '' },
      { id: 'ai-3', name: 'AI Actions', steps: ['Tell AI: "Create a task for Sarah to review proposal by Friday"'], expected: 'Task created with correct details', status: 'pending', notes: '' },
      { id: 'ai-4', name: 'Smart Compose', steps: ['Start typing in message/email composer', 'Click AI sparkle icon'], expected: 'AI auto-completes draft; Accept/Reject works', status: 'pending', notes: '' },
      { id: 'ai-5', name: 'Tone Analysis', steps: ['Type a message', 'View tone indicator below text box'], expected: 'Shows Friendly/Formal/Neutral/Aggressive; click for suggestions', status: 'pending', notes: '' },
      { id: 'ai-6', name: 'Translation (90+ Languages)', steps: ['Hover message', 'Click globe icon', 'Choose language'], expected: 'Translated text appears below original', status: 'pending', notes: '' },
      { id: 'ai-7', name: 'Thread Summarize', steps: ['Open long thread', 'Click Summarize'], expected: '2-4 sentence written summary generated', status: 'pending', notes: '' },
      { id: 'ai-8', name: 'Action Item Extraction', steps: ['Click Extract Action Items on email/message'], expected: 'Tasks extracted with source context; Add to Tasks button works', status: 'pending', notes: '' },
      { id: 'ai-9', name: 'Voice Commands', steps: ['Click microphone icon', 'Hold spacebar and speak command', 'Release'], expected: 'Visual feedback (Listening/Processing/Speaking); command executed', status: 'pending', notes: '' },
      { id: 'ai-10', name: 'AI Lab Workspaces', steps: ['Open Tools → AI Lab', 'Try each workspace (Studio, Mission Control, Intelligence Hub, Quick Actions, Proposal Builder, Channel Digest, Stand-up Briefing)'], expected: 'Each workspace loads and functions correctly', status: 'pending', notes: '' },
      { id: 'ai-11', name: 'Proactive AI Badge', steps: ['Wait for AI to detect a suggestion'], expected: 'Badge appears on ECG button; click opens suggestion', status: 'pending', notes: '' },
    ]
  },
  // ── PULSE STUDIO ─────────────────────────────────────────────────────────
  {
    id: 'studio',
    title: 'Pulse Studio',
    priority: 'high',
    tests: [
      { id: 'studio-1', name: 'Open Studio', steps: ['Click Studio in sidebar'], expected: 'Studio workspace loads with onboarding or last session', status: 'pending', notes: '' },
      { id: 'studio-2', name: 'Upload Sources', steps: ['Upload documents/PDFs in left panel'], expected: 'Files processed and available as context', status: 'pending', notes: '' },
      { id: 'studio-3', name: 'Natural Conversation', steps: ['Type questions in center canvas'], expected: 'AI responds with relevant, context-aware answers', status: 'pending', notes: '' },
      { id: 'studio-4', name: 'Slash Commands', steps: ['Type /brainstorm, /decide, /analyze, /summarize, /plan, /debrief, /risks, /compare'], expected: 'Each produces structured output (ideas, pros/cons, analysis, etc.)', status: 'pending', notes: '' },
      { id: 'studio-5', name: 'AI Personalities', steps: ['Type @skeptic, @scribe, or @deep-diver'], expected: 'AI personality changes mid-conversation', status: 'pending', notes: '' },
      { id: 'studio-6', name: 'Artifact Cards', steps: ['Generate structured content'], expected: 'Interactive Artifact cards auto-rendered; pinnable to right panel', status: 'pending', notes: '' },
      { id: 'studio-7', name: 'Focus Timer', steps: ['Start Focus Timer'], expected: 'Pomodoro timer runs; can chat while timer active', status: 'pending', notes: '' },
      { id: 'studio-8', name: 'Action Palette (Ctrl+K)', steps: ['Press Ctrl+K in Studio'], expected: 'Quick command palette opens', status: 'pending', notes: '' },
      { id: 'studio-9', name: 'Real-time Collaboration', steps: ['Have teammate join same session'], expected: 'Avatar indicators show; both can contribute', status: 'pending', notes: '' },
    ]
  },
  // ── ANALYTICS ────────────────────────────────────────────────────────────
  {
    id: 'analytics',
    title: 'Analytics',
    priority: 'medium',
    tests: [
      { id: 'anlyt-1', name: 'Open Analytics', steps: ['Navigate to Analytics (G→A)'], expected: 'Analytics dashboard loads', status: 'pending', notes: '' },
      { id: 'anlyt-2', name: 'Analytics Modes', steps: ['Switch between Overview, Velocity, Sentiment, Network, Relationships, Conflicts, Kudos, Predictions'], expected: 'Each mode renders with correct data', status: 'pending', notes: '' },
      { id: 'anlyt-3', name: 'Time Range Selector', steps: ['Select 7d, 30d, 90d, 365d'], expected: 'Data updates for selected range', status: 'pending', notes: '' },
      { id: 'anlyt-4', name: 'Message Analytics', steps: ['View message volume, response time, busiest hours'], expected: 'Charts and metrics display correctly', status: 'pending', notes: '' },
      { id: 'anlyt-5', name: 'Relationship Health', steps: ['View relationship scores across network'], expected: 'Declining engagements and top relationships shown', status: 'pending', notes: '' },
      { id: 'anlyt-6', name: 'Team Communication Health', steps: ['View team message volume and cross-team patterns'], expected: 'Collaboration density visualization renders', status: 'pending', notes: '' },
      { id: 'anlyt-7', name: 'AI Predictions & Burnout', steps: ['View Predictions mode'], expected: 'Churn risk, optimal timing, engagement forecast, burnout indicator with confidence levels', status: 'pending', notes: '' },
      { id: 'anlyt-8', name: 'Conflicts View', steps: ['View Conflicts mode'], expected: 'Active conflicts with severity, hot topics, resolution tracking', status: 'pending', notes: '' },
      { id: 'anlyt-9', name: 'Kudos View', steps: ['View Kudos mode'], expected: 'Recognition events, appreciation score, reciprocity, wins tracker', status: 'pending', notes: '' },
      { id: 'anlyt-10', name: 'Export Report', steps: ['Click Export button', 'Choose PDF/CSV/Excel'], expected: 'Report downloads in chosen format', status: 'pending', notes: '' },
    ]
  },
  // ── ARCHIVES ─────────────────────────────────────────────────────────────
  {
    id: 'archives',
    title: 'Archives',
    priority: 'medium',
    tests: [
      { id: 'arch-1', name: 'Open Archives', steps: ['Click Archives in sidebar'], expected: 'Archives view loads with content', status: 'pending', notes: '' },
      { id: 'arch-2', name: 'Filter by Type', steps: ['Filter by Studio Sessions, Transcripts, Meeting Notes, Decision Logs, etc.'], expected: 'Only selected type shown', status: 'pending', notes: '' },
      { id: 'arch-3', name: 'View Modes', steps: ['Switch between List, Grid, and Timeline views'], expected: 'Each view renders correctly', status: 'pending', notes: '' },
      { id: 'arch-4', name: 'Create Collection', steps: ['Create collection with custom color and icon'], expected: 'Collection created; items can be added to it', status: 'pending', notes: '' },
      { id: 'arch-5', name: 'Smart Folders', steps: ['Create Smart Folder with filter rules'], expected: 'Folder auto-updates as new matching items are archived', status: 'pending', notes: '' },
      { id: 'arch-6', name: 'Star / Favorite', steps: ['Star an archived item'], expected: 'Item appears in Starred filter', status: 'pending', notes: '' },
      { id: 'arch-7', name: 'Version History', steps: ['Open an archived item', 'View Version History'], expected: 'Previous versions shown; restore works', status: 'pending', notes: '' },
      { id: 'arch-8', name: 'Bulk Operations', steps: ['Select multiple items', 'Tag/Move/Share/Export/Delete'], expected: 'Bulk action applied to all selected', status: 'pending', notes: '' },
      { id: 'arch-9', name: 'Export Archive', steps: ['Export item as Markdown, PDF, or CSV'], expected: 'File downloads in chosen format', status: 'pending', notes: '' },
      { id: 'arch-10', name: 'Share Archive', steps: ['Share via email, Slack, or URL'], expected: 'Recipient can access shared content', status: 'pending', notes: '' },
    ]
  },
  // ── CRM INTEGRATIONS ─────────────────────────────────────────────────────
  {
    id: 'crm',
    title: 'CRM Integrations',
    priority: 'medium',
    tests: [
      { id: 'crm-1', name: 'Connect CRM', steps: ['Settings → Connected Accounts → CRM → Connect HubSpot/Salesforce/Pipedrive/Zoho'], expected: 'CRM connected; initial sync runs', status: 'pending', notes: '' },
      { id: 'crm-2', name: 'Two-Way Sync', steps: ['Create contact in CRM', 'Check Pulse; create task in Pulse', 'Check CRM'], expected: 'Changes flow both ways automatically', status: 'pending', notes: '' },
      { id: 'crm-3', name: 'CRM Data in Contact Profile', steps: ['Open a CRM-linked contact in Pulse'], expected: 'Deals, pipeline stage, activity history shown', status: 'pending', notes: '' },
      { id: 'crm-4', name: 'Sync Settings', steps: ['Settings → CRM → Sync Settings', 'Toggle data types and frequency'], expected: 'Sync respects configured settings', status: 'pending', notes: '' },
      { id: 'crm-5', name: 'Force Sync', steps: ['Click Sync Now'], expected: 'Immediate sync runs; errors shown in sync panel', status: 'pending', notes: '' },
    ]
  },
  // ── TOOLS ────────────────────────────────────────────────────────────────
  {
    id: 'tools',
    title: 'Tools & Automation',
    priority: 'medium',
    tests: [
      { id: 'tool-1', name: 'Automation Rules', steps: ['Tools → Automation Rules → New Rule', 'Set trigger and actions', 'Save'], expected: 'Rule fires automatically on trigger events', status: 'pending', notes: '' },
      { id: 'tool-2', name: 'Webhook Manager', steps: ['Tools → Webhook Manager → New Webhook', 'Enter URL, select events', 'Save', 'Click Test'], expected: 'Webhook fires on events; test payload received', status: 'pending', notes: '' },
      { id: 'tool-3', name: 'Bulk Operations', steps: ['Select multiple messages/contacts', 'Apply bulk action'], expected: 'Action applied to all selected items', status: 'pending', notes: '' },
    ]
  },
  // ── UNIFIED SEARCH ───────────────────────────────────────────────────────
  {
    id: 'search',
    title: 'Unified Search',
    priority: 'medium',
    tests: [
      { id: 'srch-1', name: 'Open Search (Ctrl+K)', steps: ['Press Ctrl+K from anywhere'], expected: 'Search modal opens', status: 'pending', notes: '' },
      { id: 'srch-2', name: 'Cross-Channel Results', steps: ['Search a keyword'], expected: 'Results from messages, email, contacts, tasks, calendar, Voxer transcripts', status: 'pending', notes: '' },
      { id: 'srch-3', name: 'Advanced Syntax', steps: ['Search: from:John type:email after:2026-01-01 has:attachment'], expected: 'Filtered results matching syntax', status: 'pending', notes: '' },
      { id: 'srch-4', name: 'Natural Language Search', steps: ['Search: "emails from David last week about the proposal"'], expected: 'AI understands intent; relevant results shown', status: 'pending', notes: '' },
      { id: 'srch-5', name: 'Saved Searches', steps: ['Run search', 'Click Save Search', 'Name it'], expected: 'Saved search appears in dropdown for quick access', status: 'pending', notes: '' },
      { id: 'srch-6', name: 'Search Alerts', steps: ['Click Set Alert on a search', 'Choose delivery frequency'], expected: 'Notified when new matching results appear', status: 'pending', notes: '' },
    ]
  },
  // ── SETTINGS ─────────────────────────────────────────────────────────────
  {
    id: 'settings',
    title: 'Settings & Customization',
    priority: 'medium',
    tests: [
      { id: 'set-1', name: 'Theme Toggle (Dark/Light)', steps: ['Settings → Appearance → Toggle Dark Mode'], expected: 'Theme changes immediately across entire app; persists on refresh', status: 'pending', notes: '' },
      { id: 'set-2', name: 'Accent Color', steps: ['Settings → Appearance → Choose from 7 presets or custom hex'], expected: 'Accent color applied throughout UI', status: 'pending', notes: '' },
      { id: 'set-3', name: 'Font Size', steps: ['Settings → Appearance → Change to Small/Default/Large'], expected: 'Font size adjusts app-wide', status: 'pending', notes: '' },
      { id: 'set-4', name: 'High Contrast / Reduced Motion', steps: ['Toggle High Contrast and Reduced Motion'], expected: 'Sharper text / animations minimized respectively', status: 'pending', notes: '' },
      { id: 'set-5', name: 'AI Model Configuration', steps: ['Settings → AI & Intelligence → Choose model, toggle Advanced Reasoning'], expected: 'AI behavior changes per configuration', status: 'pending', notes: '' },
      { id: 'set-6', name: 'Voice Agent Config', steps: ['Settings → AI & Intelligence → Configure voice character, turn detection, eagerness'], expected: 'Voice agent behavior matches settings', status: 'pending', notes: '' },
      { id: 'set-7', name: 'Studio Settings', steps: ['Settings → Studio → Set AI Depth, Token Streaming, Thinking Panel, Annotations'], expected: 'Studio behavior matches configured settings', status: 'pending', notes: '' },
      { id: 'set-8', name: 'Notification Preferences', steps: ['Settings → Notifications → Configure per-channel preferences and Quiet Hours'], expected: 'Notifications respect configured preferences', status: 'pending', notes: '' },
      { id: 'set-9', name: 'Connected Accounts', steps: ['Settings → Connected Accounts → Connect/disconnect Google, Microsoft, SMS, CRM'], expected: 'Accounts connect/disconnect; status badges update', status: 'pending', notes: '' },
      { id: 'set-10', name: 'Ecosystem Bridge', steps: ['Settings → Ecosystem Bridge → Connect Entomate/Logos Vision', 'Generate tokens', 'Test'], expected: 'Connection established; test succeeds; bot channels created', status: 'pending', notes: '' },
      { id: 'set-11', name: 'Features & Labs', steps: ['Settings → Features & Labs → Toggle Advanced Mode and individual features'], expected: 'Features enable/disable immediately', status: 'pending', notes: '' },
      { id: 'set-12', name: 'Workspace Management', steps: ['Settings → Workspace → Edit name, invite/remove members, change roles'], expected: 'Changes persisted; member receives invite/role change', status: 'pending', notes: '' },
      { id: 'set-13', name: 'Privacy Controls', steps: ['Settings → Privacy → Toggle online status, read receipts, data retention'], expected: 'Privacy settings applied', status: 'pending', notes: '' },
      { id: 'set-14', name: 'Data Export', steps: ['Settings → Data Management → Export My Data → Choose format → Download'], expected: 'Export file available within 24 hours', status: 'pending', notes: '' },
      { id: 'set-15', name: 'API Keys', steps: ['Settings → API Keys → Generate New Key → Set name and permissions'], expected: 'Key generated (shown once); revoke works', status: 'pending', notes: '' },
    ]
  },
  // ── BILLING & PLANS ──────────────────────────────────────────────────────
  {
    id: 'billing',
    title: 'Billing & Plans',
    priority: 'medium',
    tests: [
      { id: 'bill-1', name: 'View Billing Page', steps: ['Settings → Billing'], expected: 'Current plan, subscription status, and usage gauges shown', status: 'pending', notes: '' },
      { id: 'bill-2', name: 'Plan Comparison', steps: ['Toggle Monthly/Yearly', 'View plan cards'], expected: 'All tiers shown with pricing; yearly discount visible', status: 'pending', notes: '' },
      { id: 'bill-3', name: 'Upgrade Plan', steps: ['Click Upgrade on a plan card'], expected: 'Stripe checkout opens; on success, new plan active immediately', status: 'pending', notes: '' },
      { id: 'bill-4', name: 'Manage Subscription', steps: ['Click Manage Subscription'], expected: 'Stripe Customer Portal opens for downgrade/cancel/payment changes', status: 'pending', notes: '' },
      { id: 'bill-5', name: 'Usage Tracking', steps: ['Check usage gauges (AI Messages, SMS, Storage, Contacts, Voxer Minutes)'], expected: 'Gauges reflect actual usage; warning at 80%', status: 'pending', notes: '' },
      { id: 'bill-6', name: 'Feature Gating', steps: ['Try to use a feature above current plan'], expected: 'Upgrade prompt shown with one-click upgrade button', status: 'pending', notes: '' },
      { id: 'bill-7', name: 'Invoice History', steps: ['View Invoice History section'], expected: 'Past invoices with amount, status, and PDF download', status: 'pending', notes: '' },
    ]
  },
  // ── ADMIN DASHBOARD ──────────────────────────────────────────────────────
  {
    id: 'admin',
    title: 'Admin Dashboard',
    priority: 'medium',
    tests: [
      { id: 'adm-1', name: 'Admin Access Control', steps: ['Login as non-admin', 'Try to access Admin Dashboard'], expected: 'Access denied or hidden; only Admin/Owner roles can access', status: 'pending', notes: '' },
      { id: 'adm-2', name: 'Activity Monitor', steps: ['Settings → Admin Dashboard → Activity tab'], expected: 'KPIs, live presence, recent signups, message leaderboard, event feed shown', status: 'pending', notes: '' },
      { id: 'adm-3', name: 'Live Presence', steps: ['View user list in Activity Monitor'], expected: 'Users sorted by status (online first); updates every 30s', status: 'pending', notes: '' },
      { id: 'adm-4', name: 'Message Leaderboard', steps: ['View leaderboard in Activity Monitor'], expected: 'Users ranked by messages sent (7-day) with visual bar chart', status: 'pending', notes: '' },
      { id: 'adm-5', name: 'Member Management', steps: ['Invite new member', 'Change role', 'Remove member'], expected: 'Invite sent; role changed; member removed', status: 'pending', notes: '' },
      { id: 'adm-6', name: 'Workspace Deletion', steps: ['Settings → Workspace → Delete Permanently → Type name'], expected: 'Workspace and all data permanently deleted', status: 'pending', notes: '' },
    ]
  },
  // ── MOBILE & DESKTOP ─────────────────────────────────────────────────────
  {
    id: 'mobile',
    title: 'Mobile & Desktop Apps',
    priority: 'medium',
    tests: [
      { id: 'mob-1', name: 'Responsive Layout', steps: ['View on mobile device/narrow viewport'], expected: 'Layout adapts correctly; sidebar collapses', status: 'pending', notes: '' },
      { id: 'mob-2', name: 'Android App Install', steps: ['Install from Google Play Store'], expected: 'App installs and opens to login', status: 'pending', notes: '' },
      { id: 'mob-3', name: 'Windows Desktop App', steps: ['Download and install .exe from website'], expected: 'App runs natively with persistent notifications', status: 'pending', notes: '' },
      { id: 'mob-4', name: 'Push Notifications (Mobile)', steps: ['Enable notifications', 'Trigger event'], expected: 'Notification received even when app is closed', status: 'pending', notes: '' },
      { id: 'mob-5', name: 'Biometric Login', steps: ['Settings → Security → Enable Biometric Login'], expected: 'Fingerprint/face ID works for login', status: 'pending', notes: '' },
      { id: 'mob-6', name: 'Business Card Scanner', steps: ['Contacts → Camera icon → Scan card'], expected: 'Contact created from card data', status: 'pending', notes: '' },
      { id: 'mob-7', name: 'Offline Mode', steps: ['Go offline', 'View cached messages/contacts/tasks'], expected: 'Cached content accessible; drafts queue for send on reconnect', status: 'pending', notes: '' },
      { id: 'mob-8', name: 'Home Screen Widget', steps: ['Add Pulse widget on Android home screen'], expected: 'Quick stats, unread count, message preview displayed', status: 'pending', notes: '' },
      { id: 'mob-9', name: 'Quick Reply from Notification', steps: ['Receive Pulse notification', 'Reply from notification shade'], expected: 'Reply sent without opening app', status: 'pending', notes: '' },
      { id: 'mob-10', name: 'Mobile Navigation', steps: ['Use bottom nav bar on mobile'], expected: 'All main sections accessible', status: 'pending', notes: '' },
    ]
  },
  // ── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    priority: 'low',
    tests: [
      { id: 'kb-1', name: 'Go-To Shortcuts (G+letter)', steps: ['Press G→D, G→M, G→E, G→S, G→V, G→C, G→N, G→P, G→T, G→A'], expected: 'Each navigates to correct section', status: 'pending', notes: '' },
      { id: 'kb-2', name: 'Search (Ctrl+K)', steps: ['Press Ctrl+K'], expected: 'Search modal opens from any section', status: 'pending', notes: '' },
      { id: 'kb-3', name: 'AI Assistant (Ctrl+/)', steps: ['Press Ctrl+/'], expected: 'AI assistant toggles open/closed', status: 'pending', notes: '' },
      { id: 'kb-4', name: 'Command Palette (Ctrl+Shift+P)', steps: ['Press Ctrl+Shift+P'], expected: 'Quick Actions Command Palette opens', status: 'pending', notes: '' },
      { id: 'kb-5', name: 'Voxer Mode Keys (1-8)', steps: ['Open Voxer', 'Press 1 through 8'], expected: 'Each key switches to correct Voxer mode', status: 'pending', notes: '' },
      { id: 'kb-6', name: 'Contextual Help (?)', steps: ['Press ? in any section'], expected: 'Context-specific keyboard shortcuts shown', status: 'pending', notes: '' },
    ]
  },
  // ── PERFORMANCE ──────────────────────────────────────────────────────────
  {
    id: 'performance',
    title: 'Performance',
    priority: 'low',
    tests: [
      { id: 'perf-1', name: 'Initial Load Time', steps: ['Clear cache', 'Load app'], expected: 'App loads in < 3 seconds', status: 'pending', notes: '' },
      { id: 'perf-2', name: 'Section Switching Speed', steps: ['Navigate between all main sections rapidly'], expected: 'Each section renders within 500ms', status: 'pending', notes: '' },
      { id: 'perf-3', name: 'Large Conversation Scroll', steps: ['Open conversation with 500+ messages', 'Scroll'], expected: 'Smooth scrolling, no lag', status: 'pending', notes: '' },
      { id: 'perf-4', name: 'Search Performance', steps: ['Search across all channels with common keyword'], expected: 'Results appear within 2 seconds', status: 'pending', notes: '' },
      { id: 'perf-5', name: 'AI Response Latency', steps: ['Send prompt to Pulse AI'], expected: 'Response begins streaming < 3 seconds', status: 'pending', notes: '' },
      { id: 'perf-6', name: 'Memory Usage', steps: ['Use app for 30+ minutes across multiple sections'], expected: 'Memory stable, no leaks observed in DevTools', status: 'pending', notes: '' },
    ]
  },
];

const statusColors: Record<TestStatus, { bg: string; text: string; icon: string }> = {
  pass: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: 'fa-check-circle' },
  fail: { bg: 'bg-red-500/20', text: 'text-red-400', icon: 'fa-times-circle' },
  pending: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', icon: 'fa-clock' },
  blocked: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: 'fa-exclamation-triangle' },
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const TestMatrix: React.FC = () => {
  const [testData, setTestData] = useState<TestSection[]>(initialTestData);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['auth']));
  const [selectedTest, setSelectedTest] = useState<TestCase | null>(null);
  const [filterStatus, setFilterStatus] = useState<TestStatus | 'all'>('all');
  const [testerName, setTesterName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const user = getSessionUserSync();
  const userId = user?.id || 'anonymous';

  // Load saved test results on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const savedData = await loadTestResults(userId);

        if (savedData.tester_name) {
          setTesterName(savedData.tester_name);
        }

        // Apply saved results to initial test data
        if (Object.keys(savedData.results).length > 0) {
          setTestData(prev => prev.map(section => ({
            ...section,
            tests: section.tests.map(test => {
              const saved = savedData.results[test.id];
              if (saved) {
                return { ...test, status: saved.status, notes: saved.notes };
              }
              return test;
            })
          })));
        }
      } catch (error) {
        console.error('Failed to load test results:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // Save a single test result with debounce
  const saveResult = useCallback(async (testId: string, status: TestStatus, notes: string) => {
    setIsSaving(true);
    try {
      await saveTestResult(testId, status, notes, testerName, userId);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save test result:', error);
    } finally {
      setIsSaving(false);
    }
  }, [testerName, userId]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const updateTestStatus = (sectionId: string, testId: string, status: TestStatus) => {
    let currentNotes = '';
    setTestData(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          tests: section.tests.map(test => {
            if (test.id === testId) {
              currentNotes = test.notes;
              return { ...test, status };
            }
            return test;
          })
        };
      }
      return section;
    }));
    // Save to Supabase
    saveResult(testId, status, currentNotes);
  };

  const updateTestNotes = (sectionId: string, testId: string, notes: string) => {
    let currentStatus: TestStatus = 'pending';
    setTestData(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          tests: section.tests.map(test => {
            if (test.id === testId) {
              currentStatus = test.status;
              return { ...test, notes };
            }
            return test;
          })
        };
      }
      return section;
    }));
    // Save to Supabase
    saveResult(testId, currentStatus, notes);
  };

  // Handle tester name change with debounced save
  const handleTesterNameChange = (name: string) => {
    setTesterName(name);
  };

  // Save tester name when input loses focus
  const handleTesterNameBlur = async () => {
    if (testerName) {
      try {
        await saveTesterName(testerName, userId);
      } catch (error) {
        console.error('Failed to save tester name:', error);
      }
    }
  };

  // Reset all test results
  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset all test results? This cannot be undone.')) {
      try {
        await clearTestResults(userId);
        setTestData(initialTestData);
        setTesterName('');
        setLastSaved(null);
      } catch (error) {
        console.error('Failed to reset test results:', error);
      }
    }
  };

  const getStats = () => {
    const allTests = testData.flatMap(s => s.tests);
    return {
      total: allTests.length,
      pass: allTests.filter(t => t.status === 'pass').length,
      fail: allTests.filter(t => t.status === 'fail').length,
      pending: allTests.filter(t => t.status === 'pending').length,
      blocked: allTests.filter(t => t.status === 'blocked').length,
    };
  };

  const stats = getStats();
  const passRate = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;

  const filteredData = testData.map(section => ({
    ...section,
    tests: filterStatus === 'all'
      ? section.tests
      : section.tests.filter(t => t.status === filterStatus)
  })).filter(section => section.tests.length > 0);

  const exportResults = () => {
    const results = {
      tester: testerName,
      date: new Date().toISOString(),
      stats,
      sections: testData.map(s => ({
        title: s.title,
        tests: s.tests.map(t => ({
          name: t.name,
          status: t.status,
          notes: t.notes
        }))
      }))
    };
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-test-results-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
          <ClipboardCheck className="text-white text-2xl" />
        </div>
        <div className="text-lg font-medium text-zinc-900 dark:text-white mb-2">Loading Test Matrix...</div>
        <div className="text-sm text-zinc-500">Retrieving your saved progress</div>
        <Loader2 className="text-blue-500 text-xl mt-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <ClipboardCheck className="text-white" />
              </div>
              Test Matrix
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Pulse App Pre-Launch Testing Checklist</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Save Status Indicator */}
            {isSaving && (
              <span className="text-sm text-blue-500 flex items-center gap-2">
                <Loader2 className="animate-spin" />
                Saving...
              </span>
            )}
            {!isSaving && lastSaved && (
              <span className="text-sm text-emerald-500 flex items-center gap-2">
                <Check />
                Saved
              </span>
            )}
            <input
              type="text"
              placeholder="Tester Name"
              value={testerName}
              onChange={(e) => handleTesterNameChange(e.target.value)}
              onBlur={handleTesterNameBlur}
              className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition flex items-center gap-2"
              title="Reset all test results"
            >
              <RotateCcw />
              Reset
            </button>
            <button
              onClick={exportResults}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition flex items-center gap-2"
            >
              <Download />
              Export Results
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.total}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Total Tests</div>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-emerald-500">{stats.pass}</div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Passed</div>
          </div>
          <div className="bg-red-500/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-red-500">{stats.fail}</div>
            <div className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide">Failed</div>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-500">{stats.blocked}</div>
            <div className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide">Blocked</div>
          </div>
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{passRate}%</div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Pass Rate</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 transition-all" style={{ width: `${(stats.pass / stats.total) * 100}%` }}></div>
          <div className="bg-red-500 transition-all" style={{ width: `${(stats.fail / stats.total) * 100}%` }}></div>
          <div className="bg-amber-500 transition-all" style={{ width: `${(stats.blocked / stats.total) * 100}%` }}></div>
        </div>

        {/* Filter Buttons */}
        <div className="mt-4 flex gap-2 flex-wrap">
          {(['all', 'pending', 'pass', 'fail', 'blocked'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && ` (${stats[status]})`}
            </button>
          ))}
        </div>
      </div>

      {/* Test Sections */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4 max-w-6xl mx-auto">
          {filteredData.map(section => (
            <div key={section.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
              >
                <div className="flex items-center gap-4">
                  <span className={`w-3 h-3 rounded-full ${priorityColors[section.priority]}`}></span>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{section.title}</h2>
                  <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase">
                    {section.priority}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {section.tests.filter(t => t.status === 'pass').length}/{section.tests.length} passed
                  </span>
                </div>
                <i className={`fa-solid fa-chevron-${expandedSections.has(section.id) ? 'up' : 'down'} text-zinc-400`}></i>
              </button>

              {/* Section Content */}
              {expandedSections.has(section.id) && (
                <div className="border-t border-zinc-200 dark:border-zinc-800">
                  <table className="w-full">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Test Case</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Steps</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Expected</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider w-40">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {section.tests.map(test => (
                        <tr key={test.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
                          <td className="px-6 py-4">
                            <div className="font-medium text-zinc-900 dark:text-white">{test.name}</div>
                            {test.notes && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                <StickyNote className="mr-1" />
                                {test.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell">
                            <ol className="text-sm text-zinc-600 dark:text-zinc-400 list-decimal list-inside space-y-1">
                              {test.steps.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400 hidden lg:table-cell">
                            {test.expected}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-1">
                              {(['pass', 'fail', 'blocked', 'pending'] as TestStatus[]).map(status => (
                                <button
                                  key={status}
                                  onClick={() => updateTestStatus(section.id, test.id, status)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                                    test.status === status
                                      ? statusColors[status].bg + ' ' + statusColors[status].text
                                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                  }`}
                                  title={status.charAt(0).toUpperCase() + status.slice(1)}
                                >
                                  <i className={`fa-solid ${statusColors[status].icon} text-sm`}></i>
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => setSelectedTest(test)}
                              className="mt-2 text-xs text-blue-500 hover:text-blue-400 transition w-full"
                            >
                              Add Notes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 max-w-6xl mx-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Critical Priority</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">High Priority</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Medium Priority</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Low Priority</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors.pass.bg} ${statusColors.pass.text}`}>
                  <i className={`fa-solid ${statusColors.pass.icon}`}></i>
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Passed</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors.fail.bg} ${statusColors.fail.text}`}>
                  <i className={`fa-solid ${statusColors.fail.icon}`}></i>
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Failed</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors.blocked.bg} ${statusColors.blocked.text}`}>
                  <i className={`fa-solid ${statusColors.blocked.icon}`}></i>
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Blocked</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors.pending.bg} ${statusColors.pending.text}`}>
                  <i className={`fa-solid ${statusColors.pending.icon}`}></i>
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes Modal */}
      {selectedTest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">{selectedTest.name}</h3>
            <p className="text-sm text-zinc-500 mb-4">Add notes about this test case</p>
            <textarea
              value={selectedTest.notes}
              onChange={(e) => {
                const sectionId = testData.find(s => s.tests.some(t => t.id === selectedTest.id))?.id;
                if (sectionId) {
                  updateTestNotes(sectionId, selectedTest.id, e.target.value);
                  setSelectedTest({ ...selectedTest, notes: e.target.value });
                }
              }}
              placeholder="Enter test notes, bugs found, observations..."
              className="w-full h-32 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setSelectedTest(null)}
                className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestMatrix;
