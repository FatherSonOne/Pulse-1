import { describe, it, expect, beforeEach, vi } from 'vitest';
import vacationResponderService from '../vacationResponderService';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('VacationResponderService', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: mockUserId, email: 'me@example.com' } as any },
      error: null,
    });
  });

  it('returns null when config is missing', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    } as any);

    const result = await vacationResponderService.getConfig();
    expect(result).toBeNull();
  });

  it('saves config via upsert', async () => {
    const mockConfig = {
      id: 'vr-1',
      user_id: mockUserId,
      enabled: true,
      start_date: '2026-01-14',
      end_date: '2026-01-20',
      subject: 'Out of office',
      message_html: 'OOO',
      message_text: 'OOO',
      only_contacts: false,
      only_first_email: true,
      last_sent_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.mocked(supabase.from).mockReturnValue({
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockConfig, error: null }),
    } as any);

    const result = await vacationResponderService.saveConfig({
      enabled: true,
      start_date: '2026-01-14',
      end_date: '2026-01-20',
      subject: 'Out of office',
      message_html: 'OOO',
      message_text: 'OOO',
      only_contacts: false,
      only_first_email: true,
    });

    expect(result.id).toBe('vr-1');
  });
});
