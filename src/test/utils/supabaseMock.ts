// src/test/utils/supabaseMock.ts
// Reusable Supabase mock utility for test suites
// Handles chainable Supabase query patterns (.from().select().eq(), etc.)

import { vi } from 'vitest';

export interface SupabaseMockConfig<T = any> {
  table: string;
  data?: T[];
  error?: any;
  single?: boolean;
}

/**
 * Creates a chainable Supabase mock that returns data properly
 * Handles all common Supabase query patterns
 */
export function createSupabaseMock<T = any>(config: SupabaseMockConfig<T>) {
  const mockData = config.data || [];
  const mockError = config.error || null;

  // Prepare response based on single flag
  const mockResponse = {
    data: config.single ? (mockData[0] || null) : mockData,
    error: mockError,
  };

  // Create chainable mock with all Supabase methods
  const chainMock: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockResponse),
    maybeSingle: vi.fn().mockResolvedValue(mockResponse),
  };

  // Make all methods return a promise-like object that resolves to mockResponse
  Object.keys(chainMock).forEach((key) => {
    if (!['single', 'maybeSingle'].includes(key)) {
      const originalFn = chainMock[key];
      chainMock[key] = vi.fn((...args: any[]) => {
        // Call original to maintain call tracking
        if (originalFn && typeof originalFn.getMockImplementation === 'function') {
          originalFn(...args);
        }

        // Return chain that can be awaited or continued
        const chainable = {
          ...chainMock,
          then: (resolve: (value: any) => void) => {
            resolve(mockResponse);
            return Promise.resolve(mockResponse);
          },
          catch: (reject: (error: any) => void) => {
            if (mockError) {
              reject(mockError);
            }
            return Promise.resolve(mockResponse);
          },
        };

        return chainable;
      });
    }
  });

  return {
    from: vi.fn().mockReturnValue(chainMock),
    chainMock,
    mockResponse,
  };
}

/**
 * Creates a complete Supabase client mock with multiple table configurations
 */
export function mockSupabaseClient(tables: Record<string, ReturnType<typeof createSupabaseMock>>) {
  return {
    from: vi.fn((tableName: string) => {
      if (tables[tableName]) {
        return tables[tableName].chainMock;
      }
      // Return a default empty mock if table not configured
      console.warn(`No mock configured for table: ${tableName}`);
      return createSupabaseMock({ table: tableName, data: [] }).chainMock;
    }),
  };
}

/**
 * Helper to create a mock that handles insert().select().single() pattern
 */
export function createInsertMock<T = any>(data: T, error: any = null) {
  const mockResponse = {
    data,
    error,
  };

  const singleMock = vi.fn().mockResolvedValue(mockResponse);
  const selectMock = vi.fn().mockReturnValue({
    single: singleMock,
  });
  const insertMock = vi.fn().mockReturnValue({
    select: selectMock,
  });

  return {
    insert: insertMock,
    mockResponse,
  };
}

/**
 * Helper to create a mock that handles update().eq() pattern
 */
export function createUpdateMock(error: any = null) {
  const mockResponse = {
    data: null,
    error,
  };

  const eqMock = vi.fn().mockResolvedValue(mockResponse);
  const updateMock = vi.fn().mockReturnValue({
    eq: eqMock,
  });

  return {
    update: updateMock,
    mockResponse,
  };
}

/**
 * Helper to create a mock that handles delete().eq() pattern
 */
export function createDeleteMock(error: any = null) {
  const mockResponse = {
    data: null,
    error,
  };

  const eqMock = vi.fn().mockResolvedValue(mockResponse);
  const deleteMock = vi.fn().mockReturnValue({
    eq: eqMock,
  });

  return {
    delete: deleteMock,
    mockResponse,
  };
}
