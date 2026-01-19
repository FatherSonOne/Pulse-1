import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emailFilterService } from '../emailFilterService';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('EmailFilterService', () => {
  const mockUserId = 'user-123';
  const mockFilter = {
    id: 'filter-1',
    user_id: mockUserId,
    name: 'Important',
    enabled: true,
    execution_order: 1,
    match_type: 'all',
    conditions: [{ field: 'from', operator: 'contains', value: 'client@example.com' }],
    actions: [{ type: 'archive' }],
    emails_processed: 0,
    last_applied_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: mockUserId } as any },
      error: null,
    });
  });

  it('fetches filters for current user', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [mockFilter], error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const result = await emailFilterService.getFilters();
    expect(result).toEqual([mockFilter]);
  });

  it('creates a filter', async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockFilter, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const result = await emailFilterService.createFilter({
      name: 'Important',
      enabled: true,
      execution_order: 1,
      match_type: 'all',
      conditions: [{ field: 'from', operator: 'contains', value: 'client@example.com' }],
      actions: [{ type: 'archive' }],
    });

    expect(result).toEqual(mockFilter);
  });

  it('updates a filter', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { ...mockFilter, enabled: false }, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const result = await emailFilterService.updateFilter('filter-1', { enabled: false });
    expect(result.enabled).toBe(false);
  });

  it('deletes a filter', async () => {
    const chain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn(),
    };
    (chain.eq as any).mockImplementation((field: string) => {
      if (field === 'user_id') {
        return Promise.resolve({ error: null });
      }
      return chain;
    });
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    await expect(emailFilterService.deleteFilter('filter-1')).resolves.not.toThrow();
  });
});
