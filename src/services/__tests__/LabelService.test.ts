import { describe, it, expect, beforeEach, vi } from 'vitest';
import { labelService } from '../labelService';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('../gmailService', () => ({
  getGmailService: () => ({
    createLabel: vi.fn().mockResolvedValue({ id: 'gmail-1' }),
    updateLabel: vi.fn(),
    deleteLabel: vi.fn(),
    listLabels: vi.fn().mockResolvedValue([]),
    applyLabel: vi.fn(),
    removeLabel: vi.fn(),
  }),
}));

describe('LabelService', () => {
  const mockUserId = 'user-123';
  const mockLabel = {
    id: 'label-1',
    user_id: mockUserId,
    name: 'Important',
    color: '#ef4444',
    parent_label_id: null,
    gmail_label_id: 'gmail-1',
    display_order: 0,
    is_system: false,
    message_count: 0,
    unread_count: 0,
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

  it('fetches labels for current user', async () => {
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn() };
    chain.order.mockImplementationOnce(() => chain);
    chain.order.mockResolvedValueOnce({ data: [mockLabel], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const result = await labelService.getLabels();
    expect(result).toEqual([mockLabel]);
  });

  it('creates a label with valid color', async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockLabel, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const result = await labelService.createLabel({
      name: 'Important',
      color: '#ef4444',
      parent_label_id: null,
      gmail_label_id: null,
      display_order: 0,
    });

    expect(result).toEqual(mockLabel);
  });
});
