/**
 * Mock Data for Testing
 * Centralized mock data for consistent testing
 */

import { User, Contact, CalendarEvent } from '../../types';

// Mock Users
export const mockUsers: User[] = [
  {
    id: 'user-1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    avatarUrl: 'https://avatar.url/alice.jpg',
    googleConnected: true,
    connectedProviders: {
      google: true,
      microsoft: false,
      icloud: false,
    },
    role: 'admin',
    isAdmin: true,
  },
  {
    id: 'user-2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    avatarUrl: 'https://avatar.url/bob.jpg',
    googleConnected: false,
    connectedProviders: {
      google: false,
      microsoft: true,
      icloud: false,
    },
    role: 'user',
    isAdmin: false,
  },
  {
    id: 'user-3',
    name: 'Charlie Davis',
    email: 'charlie@example.com',
    googleConnected: false,
    connectedProviders: {
      google: false,
      microsoft: false,
      icloud: false,
    },
    role: 'moderator',
    isAdmin: false,
  },
];

// Mock Contacts
export const mockContacts: Contact[] = [
  {
    id: 'contact-1',
    name: 'David Wilson',
    role: 'CTO',
    company: 'Tech Corp',
    avatarColor: '#3b82f6',
    status: 'online',
    email: 'david@techcorp.com',
    phone: '+1-555-0101',
    source: 'google',
    contactType: 'client',
    lastSynced: new Date(),
  },
  {
    id: 'contact-2',
    name: 'Emma Brown',
    role: 'Product Manager',
    company: 'Startup Inc',
    avatarColor: '#10b981',
    status: 'away',
    email: 'emma@startup.com',
    phone: '+1-555-0102',
    source: 'local',
    contactType: 'team',
    isTeamMember: true,
  },
  {
    id: 'contact-3',
    name: 'Frank Miller',
    role: 'Designer',
    company: 'Creative Agency',
    avatarColor: '#f59e0b',
    status: 'offline',
    email: 'frank@creative.com',
    source: 'vision',
    contactType: 'vendor',
  },
];

// Mock Messages
export const mockMessages = [
  {
    id: 'msg-1',
    channelId: 'channel-1',
    userId: 'user-1',
    content: 'Hello team! Ready for the sprint planning?',
    timestamp: new Date('2026-01-20T09:00:00'),
    reactions: [
      { emoji: '👍', userId: 'user-2', timestamp: new Date('2026-01-20T09:01:00') },
      { emoji: '🎯', userId: 'user-3', timestamp: new Date('2026-01-20T09:02:00') },
    ],
    threadCount: 2,
  },
  {
    id: 'msg-2',
    channelId: 'channel-1',
    userId: 'user-2',
    content: 'Yes, I have the requirements ready.',
    timestamp: new Date('2026-01-20T09:05:00'),
    reactions: [],
    threadCount: 0,
  },
  {
    id: 'msg-3',
    channelId: 'channel-2',
    userId: 'user-3',
    content: 'Design mockups are in Figma.',
    timestamp: new Date('2026-01-20T09:10:00'),
    reactions: [
      { emoji: '✨', userId: 'user-1', timestamp: new Date('2026-01-20T09:11:00') },
    ],
    threadCount: 1,
  },
];

// Mock Channels
export const mockChannels = [
  {
    id: 'channel-1',
    name: 'general',
    description: 'General team discussions',
    type: 'public',
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00'),
    memberCount: 25,
  },
  {
    id: 'channel-2',
    name: 'design',
    description: 'Design team workspace',
    type: 'private',
    createdBy: 'user-3',
    createdAt: new Date('2026-01-05T00:00:00'),
    memberCount: 8,
  },
  {
    id: 'channel-3',
    name: 'engineering',
    description: 'Engineering discussions',
    type: 'public',
    createdBy: 'user-2',
    createdAt: new Date('2026-01-10T00:00:00'),
    memberCount: 15,
  },
];

// Mock Decisions
export const mockDecisions = [
  {
    id: 'decision-1',
    title: 'Choose cloud provider',
    description: 'We need to decide on our cloud infrastructure provider',
    options: [
      { id: 'opt-1', text: 'AWS', votes: 12 },
      { id: 'opt-2', text: 'Google Cloud', votes: 8 },
      { id: 'opt-3', text: 'Azure', votes: 5 },
    ],
    createdBy: 'user-1',
    createdAt: new Date('2026-01-15T00:00:00'),
    deadline: new Date('2026-01-25T23:59:59'),
    status: 'active',
    totalVotes: 25,
  },
  {
    id: 'decision-2',
    title: 'Office reopening policy',
    description: 'Decide on hybrid work schedule',
    options: [
      { id: 'opt-4', text: '3 days in office', votes: 15 },
      { id: 'opt-5', text: '2 days in office', votes: 18 },
      { id: 'opt-6', text: 'Fully remote', votes: 10 },
    ],
    createdBy: 'user-1',
    createdAt: new Date('2026-01-10T00:00:00'),
    deadline: new Date('2026-01-20T23:59:59'),
    status: 'completed',
    totalVotes: 43,
    winningOption: 'opt-5',
  },
];

// Mock Tasks
export const mockTasks = [
  {
    id: 'task-1',
    title: 'Implement authentication',
    description: 'Add OAuth 2.0 authentication with Google and Microsoft',
    status: 'in_progress',
    priority: 'high',
    assignedTo: 'user-2',
    createdBy: 'user-1',
    createdAt: new Date('2026-01-15T00:00:00'),
    dueDate: new Date('2026-01-22T00:00:00'),
    tags: ['backend', 'security'],
  },
  {
    id: 'task-2',
    title: 'Design user dashboard',
    description: 'Create wireframes for the new dashboard layout',
    status: 'completed',
    priority: 'medium',
    assignedTo: 'user-3',
    createdBy: 'user-1',
    createdAt: new Date('2026-01-12T00:00:00'),
    completedAt: new Date('2026-01-18T00:00:00'),
    dueDate: new Date('2026-01-20T00:00:00'),
    tags: ['design', 'ui'],
  },
  {
    id: 'task-3',
    title: 'Write API documentation',
    description: 'Document all REST API endpoints',
    status: 'todo',
    priority: 'low',
    assignedTo: 'user-2',
    createdBy: 'user-1',
    createdAt: new Date('2026-01-18T00:00:00'),
    dueDate: new Date('2026-01-30T00:00:00'),
    tags: ['documentation'],
  },
];

// Mock Calendar Events
export const mockCalendarEvents: CalendarEvent[] = [
  {
    id: 'event-1',
    title: 'Sprint Planning',
    start: new Date('2026-01-21T10:00:00'),
    end: new Date('2026-01-21T11:30:00'),
    description: 'Plan next sprint tasks',
    location: 'Conference Room A',
    attendees: [
      { email: 'alice@example.com', displayName: 'Alice Johnson', responseStatus: 'accepted' },
      { email: 'bob@example.com', displayName: 'Bob Smith', responseStatus: 'accepted' },
    ],
    calendarId: 'primary',
    isAllDay: false,
  },
  {
    id: 'event-2',
    title: 'Design Review',
    start: new Date('2026-01-21T14:00:00'),
    end: new Date('2026-01-21T15:00:00'),
    description: 'Review latest design mockups',
    attendees: [
      { email: 'alice@example.com', displayName: 'Alice Johnson', responseStatus: 'accepted' },
      { email: 'charlie@example.com', displayName: 'Charlie Davis', responseStatus: 'tentative' },
    ],
    calendarId: 'primary',
    isAllDay: false,
  },
];

// Mock Analytics Data
export const mockAnalyticsData = {
  messageStats: {
    total: 1247,
    today: 45,
    thisWeek: 312,
    thisMonth: 1247,
    averagePerDay: 41.5,
  },
  userActivity: [
    { userId: 'user-1', messageCount: 425, lastActive: new Date('2026-01-20T09:00:00') },
    { userId: 'user-2', messageCount: 398, lastActive: new Date('2026-01-20T08:45:00') },
    { userId: 'user-3', messageCount: 424, lastActive: new Date('2026-01-20T09:10:00') },
  ],
  channelActivity: [
    { channelId: 'channel-1', messageCount: 687, memberCount: 25 },
    { channelId: 'channel-2', messageCount: 342, memberCount: 8 },
    { channelId: 'channel-3', messageCount: 218, memberCount: 15 },
  ],
};

// Mock File Uploads
export const mockFileUploads = [
  {
    id: 'file-1',
    name: 'presentation.pdf',
    size: 2457600, // 2.4 MB
    type: 'application/pdf',
    uploadedBy: 'user-1',
    uploadedAt: new Date('2026-01-20T08:00:00'),
    url: 'https://storage.url/presentation.pdf',
  },
  {
    id: 'file-2',
    name: 'screenshot.png',
    size: 1048576, // 1 MB
    type: 'image/png',
    uploadedBy: 'user-3',
    uploadedAt: new Date('2026-01-20T09:00:00'),
    url: 'https://storage.url/screenshot.png',
  },
];

// Mock OAuth Tokens
export const mockOAuthTokens = {
  google: {
    access_token: 'ya29.mock-google-access-token',
    refresh_token: 'mock-google-refresh-token',
    expires_at: Date.now() + 3600000,
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
  },
  microsoft: {
    access_token: 'EwAoA-mock-microsoft-access-token',
    refresh_token: 'mock-microsoft-refresh-token',
    expires_at: Date.now() + 3600000,
    token_type: 'Bearer',
    scope: 'Mail.Read User.Read',
  },
};

// Mock API Responses
export const mockApiResponses = {
  rateLimitExceeded: {
    error: 'Rate limit exceeded',
    retryAfter: 60,
    limit: 100,
    remaining: 0,
  },
  unauthorized: {
    error: 'Unauthorized',
    message: 'Invalid or expired token',
  },
  validationError: {
    error: 'Validation failed',
    fields: {
      email: 'Invalid email format',
      password: 'Password must be at least 8 characters',
    },
  },
};
