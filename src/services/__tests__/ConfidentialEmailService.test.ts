import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import confidentialEmailService from '../confidentialEmailService';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe('ConfidentialEmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'token-abc' } as any },
      error: null,
    });
    global.fetch = vi.fn();
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates confidential metadata with passcode hash', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'conf-1' } }),
    } as any);

    await confidentialEmailService.create({
      thread_id: 'thread-1',
      require_passcode: true,
      passcode: '1234',
    });

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.passcode_hash).toBe('010203');
    expect(body.require_passcode).toBe(true);
  });
});
