/**
 * Test Utilities
 * Custom render functions and test helpers
 */

import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock Supabase Client
export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    }),
    signInWithOAuth: vi.fn().mockResolvedValue({
      data: { url: 'https://oauth.url' },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({
      error: null,
    }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }),
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  }),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      download: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://storage.url/file.jpg' },
      }),
    }),
  },
};

// Custom render with providers
interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  return <BrowserRouter>{children}</BrowserRouter>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Helper to wait for async updates
export const waitForAsync = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

// Helper to create mock user
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: 'https://avatar.url/test.jpg',
  googleConnected: false,
  connectedProviders: {
    google: false,
    microsoft: false,
    icloud: false,
  },
  role: 'user' as const,
  isAdmin: false,
  ...overrides,
});

// Helper to create mock session
export const createMockSession = (overrides = {}) => ({
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_at: Date.now() / 1000 + 3600,
  user: createMockUser(),
  ...overrides,
});

// Helper to mock successful Supabase response
export const mockSupabaseSuccess = (data: any) => ({
  data,
  error: null,
});

// Helper to mock Supabase error
export const mockSupabaseError = (message: string, code?: string) => ({
  data: null,
  error: {
    message,
    code: code || 'UNKNOWN_ERROR',
    details: '',
    hint: '',
  },
});

// Helper to mock fetch responses
export const mockFetchSuccess = (data: any) => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
};

export const mockFetchError = (status: number, message: string) => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: message }),
    text: async () => message,
  });
};

// Helper to create mock messages
export const createMockMessage = (overrides = {}) => ({
  id: 'msg-123',
  channelId: 'channel-123',
  userId: 'user-123',
  content: 'Test message',
  timestamp: new Date(),
  reactions: [],
  threadCount: 0,
  ...overrides,
});

// Helper to create mock decisions
export const createMockDecision = (overrides = {}) => ({
  id: 'decision-123',
  title: 'Test Decision',
  description: 'Test description',
  options: [
    { id: 'opt-1', text: 'Option 1', votes: 0 },
    { id: 'opt-2', text: 'Option 2', votes: 0 },
  ],
  createdBy: 'user-123',
  createdAt: new Date(),
  deadline: new Date(Date.now() + 86400000),
  status: 'active' as const,
  ...overrides,
});

// Helper to create mock tasks
export const createMockTask = (overrides = {}) => ({
  id: 'task-123',
  title: 'Test Task',
  description: 'Test description',
  status: 'todo' as const,
  priority: 'medium' as const,
  assignedTo: 'user-123',
  createdBy: 'user-123',
  createdAt: new Date(),
  dueDate: new Date(Date.now() + 86400000),
  ...overrides,
});
