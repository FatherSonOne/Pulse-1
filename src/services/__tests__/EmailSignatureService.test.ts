import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emailSignatureService } from '../emailSignatureService';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('EmailSignatureService', () => {
  const mockUserId = 'user-123';
  const mockSignature = {
    id: 'sig-1',
    user_id: mockUserId,
    name: 'Work',
    content_html: '<p>Best</p>',
    content_text: 'Best',
    is_default: true,
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

  it('fetches signatures for current user', async () => {
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn() };
    chain.order.mockImplementationOnce(() => chain);
    chain.order.mockResolvedValueOnce({ data: [mockSignature], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const result = await emailSignatureService.getSignatures();
    expect(result).toEqual([mockSignature]);
    expect(supabase.from).toHaveBeenCalledWith('email_signatures');
  });

  it('creates a signature', async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockSignature, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const result = await emailSignatureService.createSignature({
      name: 'Work',
      content_html: '<p>Best</p>',
      content_text: 'Best',
      is_default: true,
    });

    expect(result).toEqual(mockSignature);
  });

  it('deletes a signature', async () => {
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

    await expect(emailSignatureService.deleteSignature('sig-1')).resolves.not.toThrow();
  });
});
