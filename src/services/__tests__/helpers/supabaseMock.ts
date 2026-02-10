/**
 * Supabase Mock Helper
 *
 * Provides a reusable mock for Supabase client that properly handles query chaining
 */

import { vi } from 'vitest';

export interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  like: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  containedBy: ReturnType<typeof vi.fn>;
  rangeGt: ReturnType<typeof vi.fn>;
  rangeGte: ReturnType<typeof vi.fn>;
  rangeLt: ReturnType<typeof vi.fn>;
  rangeLte: ReturnType<typeof vi.fn>;
  rangeAdjacent: ReturnType<typeof vi.fn>;
  overlaps: ReturnType<typeof vi.fn>;
  textSearch: ReturnType<typeof vi.fn>;
  match: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  filter: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock query builder that properly chains methods
 * and returns the expected { data, error } response at the end
 */
export function createMockQueryBuilder(mockResponse?: { data?: any; error?: any }): MockQueryBuilder {
  const defaultResponse = { data: mockResponse?.data ?? null, error: mockResponse?.error ?? null };

  const queryBuilder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
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
    rangeGt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    // Terminal methods that return promises
    single: vi.fn().mockResolvedValue(defaultResponse),
    maybeSingle: vi.fn().mockResolvedValue(defaultResponse),
  };

  // Make all chainable methods also resolve to the response when awaited
  // This handles cases where the query is awaited without calling single()
  const makeThenable = (obj: any) => {
    obj.then = (resolve: any) => Promise.resolve(defaultResponse).then(resolve);
    obj.catch = (reject: any) => Promise.resolve(defaultResponse).catch(reject);
    return obj;
  };

  return makeThenable(queryBuilder);
}

/**
 * Creates a mock Supabase client
 */
export function createMockSupabase() {
  const mockQueryBuilder = createMockQueryBuilder();

  return {
    from: vi.fn(() => mockQueryBuilder),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
  };
}

/**
 * Sets up a mock response for a specific table query
 */
export function setupMockResponse(
  supabase: any,
  table: string,
  response: { data?: any; error?: any }
) {
  const mockQueryBuilder = createMockQueryBuilder(response);
  supabase.from.mockImplementation((tableName: string) => {
    if (tableName === table) {
      return mockQueryBuilder;
    }
    return createMockQueryBuilder();
  });
  return mockQueryBuilder;
}
