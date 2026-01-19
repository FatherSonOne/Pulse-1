import { describe, it, expect, beforeEach, vi } from 'vitest';
import blockedSendersService from '../blockedSendersService';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('BlockedSendersService', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: mockUserId } as any },
      error: null,
    });
  });

  it('blocks an email address', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'block-1',
          user_id: mockUserId,
          email_address: 'test@example.com',
          domain: null,
          reason: null,
          auto_delete: false,
          blocked_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
    } as any);

    const result = await blockedSendersService.blockEmail('test@example.com');
    expect(result.email_address).toBe('test@example.com');
  });

  it('checks if sender is blocked', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ auto_delete: true }], error: null }),
    } as any);

    const result = await blockedSendersService.isBlocked('spam@example.com');
    expect(result.blocked).toBe(true);
    expect(result.autoDelete).toBe(true);
  });
});
