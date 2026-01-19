import { describe, it, expect, beforeEach, vi } from 'vitest';
import emailAccountsService from '../emailAccountsService';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe('EmailAccountsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'token-123' } as any },
      error: null,
    });
    global.fetch = vi.fn();
  });

  it('lists accounts via API', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'acc-1' }] }),
    } as any);

    const result = await emailAccountsService.list();

    expect(global.fetch).toHaveBeenCalledWith('/api/email/accounts', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer token-123',
      }),
    }));
    expect(result).toEqual([{ id: 'acc-1' }]);
  });

  it('creates an account with lowercased email', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'acc-2' } }),
    } as any);

    await emailAccountsService.create({
      provider: 'google',
      email_address: 'TEST@EXAMPLE.COM',
      display_name: 'Test',
      is_primary: false,
      sync_enabled: true,
      integration_id: null,
    });

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.email_address).toBe('test@example.com');
    expect(options?.method).toBe('POST');
  });
});
