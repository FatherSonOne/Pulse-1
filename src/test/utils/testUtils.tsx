// ============================================
// TEST UTILITIES
// Reusable test helpers and wrappers
// ============================================

import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

// ============================================
// CUSTOM RENDER FUNCTION
// Wraps components with common providers
// ============================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { initialRoute = '/', ...renderOptions } = options || {};

  // Set initial route
  if (initialRoute !== '/') {
    window.history.pushState({}, '', initialRoute);
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        {children}
      </BrowserRouter>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// ============================================
// MOCK FACTORIES
// Create mock data for testing
// ============================================

export function createMockMessage(overrides?: Partial<any>) {
  return {
    id: `msg-${Date.now()}`,
    content: 'Test message content',
    sender_id: 'user-1',
    sender_name: 'Test User',
    channel_id: 'channel-1',
    created_at: new Date().toISOString(),
    attachments: [],
    reactions: {},
    thread_id: null,
    edited_at: null,
    ...overrides,
  };
}

export function createMockChannel(overrides?: Partial<any>) {
  return {
    id: `channel-${Date.now()}`,
    name: 'test-channel',
    workspace_id: 'workspace-1',
    type: 'channel',
    is_private: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockUser(overrides?: Partial<any>) {
  return {
    id: `user-${Date.now()}`,
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockAIResponse(overrides?: Partial<any>) {
  return {
    id: `ai-${Date.now()}`,
    content: 'AI generated response',
    model: 'gpt-4',
    confidence: 0.85,
    tokens: { input: 100, output: 50, total: 150 },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockIdea(overrides?: Partial<any>) {
  return {
    id: `idea-${Date.now()}`,
    text: 'Test brainstorm idea',
    author: 'Test User',
    votes: 0,
    tags: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// ASYNC HELPERS
// Wait for async operations
// ============================================

export async function waitForAsync(ms: number = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

// ============================================
// STORAGE MOCKS
// Mock localStorage and sessionStorage
// ============================================

export function createStorageMock() {
  const storage = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => storage.get(key) || null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    removeItem: vi.fn((key: string) => storage.delete(key)),
    clear: vi.fn(() => storage.clear()),
    key: vi.fn((index: number) => {
      const keys = Array.from(storage.keys());
      return keys[index] || null;
    }),
    get length() {
      return storage.size;
    },
  };
}

// ============================================
// FETCH MOCKS
// Mock fetch responses
// ============================================

export function mockFetchSuccess(data: any) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
}

export function mockFetchError(status: number = 500, message: string = 'Server error') {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: message,
    json: async () => ({ error: message }),
  });
}

// ============================================
// TIMER HELPERS
// Work with fake timers
// ============================================

export function setupFakeTimers() {
  vi.useFakeTimers();
  return {
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    runAll: () => vi.runAllTimers(),
    restore: () => vi.useRealTimers(),
  };
}

// ============================================
// CONSOLE HELPERS
// Suppress console output in tests
// ============================================

export function suppressConsole() {
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeEach(() => {
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
