import { describe, it, expect, beforeEach, vi } from 'vitest';
import notificationRuleService from '../notificationRuleService';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('NotificationRuleService', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: mockUserId } as any },
      error: null,
    });
  });

  it('returns no notification when no rules', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any);

    const result = await notificationRuleService.shouldNotify({
      id: 'email-1',
      thread_id: 't1',
      user_id: mockUserId,
      gmail_id: 'g1',
      from_email: 'a@example.com',
      from_name: null,
      to_emails: [],
      cc_emails: [],
      bcc_emails: [],
      subject: 'Test',
      snippet: '',
      body_text: '',
      body_html: '',
      labels: [],
      is_read: false,
      is_starred: false,
      is_important: false,
      is_draft: false,
      is_sent: false,
      is_archived: false,
      is_trashed: false,
      has_attachments: false,
      attachments: [],
      ai_summary: null,
      ai_category: null,
      ai_priority_score: 50,
      ai_action_items: [],
      ai_sentiment: null,
      ai_suggested_replies: [],
      ai_entities: {},
      received_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
      analyzed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(result.notify).toBe(false);
  });

  it('respects quiet hours', async () => {
    const rule = {
      id: 'rule-1',
      user_id: mockUserId,
      name: 'Quiet',
      enabled: true,
      conditions: [],
      notify_desktop: true,
      notify_mobile: true,
      notify_email: false,
      notify_sound: null,
      respect_quiet_hours: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      priority: 'normal' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [rule], error: null }),
    } as any);

    const email = {
      id: 'email-1',
      thread_id: 't1',
      user_id: mockUserId,
      gmail_id: 'g1',
      from_email: 'a@example.com',
      from_name: null,
      to_emails: [],
      cc_emails: [],
      bcc_emails: [],
      subject: 'Test',
      snippet: '',
      body_text: '',
      body_html: '',
      labels: [],
      is_read: false,
      is_starred: false,
      is_important: false,
      is_draft: false,
      is_sent: false,
      is_archived: false,
      is_trashed: false,
      has_attachments: false,
      attachments: [],
      ai_summary: null,
      ai_category: null,
      ai_priority_score: 50,
      ai_action_items: [],
      ai_sentiment: null,
      ai_suggested_replies: [],
      ai_entities: {},
      received_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
      analyzed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = await notificationRuleService.shouldNotify(email, new Date('2026-01-14T23:00:00'));
    expect(result.notify).toBe(false);
    expect(result.reason).toContain('Quiet hours');
  });
});
