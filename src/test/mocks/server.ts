// ============================================
// MSW Server Setup
// Mock server for Node.js testing environment
// ============================================

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create mock server with default handlers
export const server = setupServer(...handlers);

// Enable API mocking before tests
export function setupMockServer() {
  server.listen({ onUnhandledRequest: 'warn' });
}

// Reset handlers between tests
export function resetMockServer() {
  server.resetHandlers();
}

// Disable API mocking after tests
export function teardownMockServer() {
  server.close();
}
