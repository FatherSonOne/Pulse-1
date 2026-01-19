import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bulkOperationsService } from '../bulkOperationsService';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('BulkOperationsService', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: mockUserId } as any },
      error: null,
    });
  });

  it('executes mark_read bulk action', async () => {
    const update = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const inFn = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockReturnValue({
      update,
      eq,
      in: inFn,
    } as any);

    const result = await bulkOperationsService.execute({
      action: 'mark_read',
      emailIds: ['email-1', 'email-2'],
    });

    expect(result.success).toBe(2);
    expect(supabase.from).toHaveBeenCalledWith('cached_emails');
    expect(update).toHaveBeenCalledWith({ is_read: true });
  });

  it('throws when not authenticated', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(bulkOperationsService.execute({
      action: 'mark_read',
      emailIds: ['email-1'],
    })).rejects.toThrow('Not authenticated');
  });

  it('requires labelId for apply_label', async () => {
    const result = await bulkOperationsService.execute({
      action: 'apply_label',
      emailIds: ['email-1'],
      params: {},
    });

    expect(result.failed).toBe(1);
    expect(result.errors[0]?.error).toContain('labelId parameter required');
  });
});
