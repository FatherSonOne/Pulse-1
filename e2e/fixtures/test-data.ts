// ============================================
// E2E TEST DATA FIXTURES
// Shared test data for Playwright tests
// ============================================

export const testUsers = {
  standard: {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
  },
  admin: {
    email: 'admin@example.com',
    password: 'admin123',
    name: 'Admin User',
  },
  guest: {
    email: 'guest@example.com',
    password: 'guest123',
    name: 'Guest User',
  },
};

export const testChannels = [
  {
    id: 'channel-1',
    name: 'general',
    type: 'public',
    description: 'General team discussion',
  },
  {
    id: 'channel-2',
    name: 'development',
    type: 'public',
    description: 'Development team channel',
  },
  {
    id: 'channel-3',
    name: 'private-project',
    type: 'private',
    description: 'Private project discussion',
  },
];

export const testMessages = [
  {
    id: 'msg-1',
    content: 'Hello team, how is everyone doing?',
    sender: 'Test User',
    timestamp: new Date('2026-01-19T10:00:00Z'),
  },
  {
    id: 'msg-2',
    content: 'Great! Working on the new features.',
    sender: 'Developer',
    timestamp: new Date('2026-01-19T10:05:00Z'),
  },
  {
    id: 'msg-3',
    content: 'Can we schedule a sync meeting?',
    sender: 'Project Manager',
    timestamp: new Date('2026-01-19T10:10:00Z'),
  },
];

export const testBrainstormTopics = [
  'Product Features',
  'Marketing Strategy',
  'User Experience Improvements',
  'Technical Architecture',
  'Team Collaboration',
];

export const testIdeas = [
  'Real-time collaboration features',
  'AI-powered search and discovery',
  'Mobile app development',
  'Advanced analytics dashboard',
  'Third-party integrations',
  'Customizable workflows',
  'Better notification system',
  'Video conferencing integration',
];

// Helper function to generate test file
export function generateTestFile(name: string, size: number = 1024) {
  const content = 'x'.repeat(size);
  return {
    name,
    mimeType: name.endsWith('.txt') ? 'text/plain' : 'application/octet-stream',
    buffer: Buffer.from(content),
  };
}

// Helper function to wait for specific text
export async function waitForText(page: any, text: string, timeout = 5000) {
  await page.waitForSelector(`text=${text}`, { timeout });
}

// Helper function for login
export async function login(page: any, userType: 'standard' | 'admin' | 'guest' = 'standard') {
  const user = testUsers[userType];
  await page.fill('[data-testid="email-input"]', user.email);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

// Helper function to navigate to messages
export async function navigateToMessages(page: any, channelIndex: number = 0) {
  await page.click('[data-testid="messages-nav"]');
  await page.waitForURL('**/messages');
  const channels = page.locator('[data-testid="channel-item"]');
  await channels.nth(channelIndex).click();
  await page.waitForSelector('[data-testid="message-list"]');
}

// Helper function to send message
export async function sendMessage(page: any, content: string) {
  await page.fill('[data-testid="message-input"]', content);
  await page.click('[data-testid="send-button"]');
  await page.waitForSelector(`text=${content}`, { timeout: 5000 });
}
