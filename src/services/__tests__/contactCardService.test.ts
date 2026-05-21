// contactCardService.test.ts
// Phase C — service-wrapper unit tests. Happy-path + 1 error variant
// per method. Mocks supabase.functions.invoke + supabase.auth.getUser
// + supabase.from. No real network calls.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '../supabase';
import contactCardService from '../contactCardService';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('contactCardService', () => {
  const mockUserId = 'user-abc-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: mockUserId } as any },
      error: null,
    });
  });

  // ── createCard ─────────────────────────────────────────────────────

  describe('createCard', () => {
    it('returns share_url + recipient_user_id on success', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          id: 'card-1',
          share_url: 'https://go.pulse.logosvision.org/c/card-1',
          recipient_user_id: 'user-recipient',
          email_sent: true,
        },
        error: null,
      } as any);

      const result = await contactCardService.createCard({
        contact_id: 'contact-1',
        recipient_hint: 'alice@example.com',
        intro_note: 'Meet Bob',
      });

      expect(result.id).toBe('card-1');
      expect(result.share_url).toContain('card-1');
      expect(result.email_sent).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'create-contact-card',
        expect.objectContaining({
          body: expect.objectContaining({
            contact_id: 'contact-1',
            recipient_hint: 'alice@example.com',
          }),
        }),
      );
    });

    it('throws on rate_limit_exceeded (403)', async () => {
      const fakeResponse = new Response(
        JSON.stringify({
          error: 'rate_limit_exceeded',
          retry_after_seconds: 86400,
        }),
        { status: 403 },
      );
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: Object.assign(new Error('FunctionsHttpError'), {
          context: fakeResponse,
        }),
      } as any);

      await expect(
        contactCardService.createCard({
          contact_id: 'contact-1',
          recipient_hint: 'alice@example.com',
        }),
      ).rejects.toThrow(/rate_limit_exceeded/);
    });

    it('forwards Idempotency-Key header when provided', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          id: 'card-2',
          share_url: 'https://go.pulse.logosvision.org/c/card-2',
          recipient_user_id: null,
          email_sent: false,
        },
        error: null,
      } as any);

      await contactCardService.createCard(
        { contact_id: 'c', recipient_hint: 'r@x.com' },
        { idempotencyKey: 'dedup-1' },
      );

      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'create-contact-card',
        expect.objectContaining({
          headers: { 'Idempotency-Key': 'dedup-1' },
        }),
      );
    });
  });

  // ── createBundle ───────────────────────────────────────────────────

  describe('createBundle', () => {
    it('returns share_urls array on success', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          bundle_id: 'bundle-1',
          cards_created: 2,
          share_urls: [
            {
              contact_id: 'c1',
              recipient_hint: 'a@x.com',
              card_id: 'card-a',
              share_url: 'https://go.pulse.logosvision.org/c/card-a',
            },
            {
              contact_id: 'c2',
              recipient_hint: 'a@x.com',
              card_id: 'card-b',
              share_url: 'https://go.pulse.logosvision.org/c/card-b',
            },
          ],
        },
        error: null,
      } as any);

      const result = await contactCardService.createBundle({
        contact_ids: ['c1', 'c2'],
        recipient_hints: ['a@x.com'],
      });

      expect(result.cards_created).toBe(2);
      expect(result.share_urls).toHaveLength(2);
    });

    it('throws on bundle_size_exceeded (400)', async () => {
      const fakeResponse = new Response(
        JSON.stringify({ error: 'bundle_size_exceeded', max: 100 }),
        { status: 400 },
      );
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: Object.assign(new Error('FunctionsHttpError'), {
          context: fakeResponse,
        }),
      } as any);

      await expect(
        contactCardService.createBundle({
          contact_ids: new Array(101).fill('c'),
          recipient_hints: ['a@x.com'],
        }),
      ).rejects.toThrow(/bundle_size_exceeded/);
    });
  });

  // ── fetchReceived ──────────────────────────────────────────────────

  describe('fetchReceived', () => {
    it('returns cards where recipient_user_id = current user', async () => {
      const sample = [
        {
          id: 'r1',
          sender_user_id: 'other',
          recipient_hint: 'me@x.com',
          recipient_user_id: mockUserId,
          card_snapshot: { name: 'Bob' },
          intro_note: null,
          token_policy: 'multi_use',
          is_forwardable: true,
          forwarded_from_card_id: null,
          expires_at: null,
          revoked_at: null,
          consumed_at: null,
          view_count: 0,
          created_at: '2026-05-19T00:00:00Z',
        },
      ];
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: sample, error: null }),
      } as any);

      const result = await contactCardService.fetchReceived();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('r1');
    });

    it('throws when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      await expect(contactCardService.fetchReceived()).rejects.toThrow(
        /Not authenticated/,
      );
    });
  });

  // ── fetchSent ──────────────────────────────────────────────────────

  describe('fetchSent', () => {
    it('returns cards where sender_user_id = current user', async () => {
      const sample = [
        {
          id: 's1',
          sender_user_id: mockUserId,
          recipient_hint: 'them@x.com',
          recipient_user_id: null,
          card_snapshot: { name: 'Alice' },
          intro_note: null,
          token_policy: 'multi_use',
          is_forwardable: true,
          forwarded_from_card_id: null,
          expires_at: null,
          revoked_at: null,
          consumed_at: null,
          view_count: 5,
          created_at: '2026-05-19T00:00:00Z',
        },
      ];
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: sample, error: null }),
      } as any);

      const result = await contactCardService.fetchSent();
      expect(result).toHaveLength(1);
      expect(result[0].view_count).toBe(5);
    });

    it('throws when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      await expect(contactCardService.fetchSent()).rejects.toThrow(
        /Not authenticated/,
      );
    });
  });

  // ── acceptCard ─────────────────────────────────────────────────────

  describe('acceptCard', () => {
    it('returns BulkAcceptResult with added=1 on happy path', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          added: 1,
          linked: 0,
          skipped: 0,
          per_card: [
            { card_id: 'c1', outcome: 'added', new_contact_id: 'contact-x' },
          ],
        },
        error: null,
      } as any);

      const result = await contactCardService.acceptCard('c1', {
        connectWithSender: true,
      });

      expect(result.added).toBe(1);
      expect(result.per_card[0].outcome).toBe('added');
    });

    it('throws when card is already consumed (410)', async () => {
      const fakeResponse = new Response(JSON.stringify({ error: 'gone' }), {
        status: 410,
      });
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: Object.assign(new Error('FunctionsHttpError'), {
          context: fakeResponse,
        }),
      } as any);

      await expect(
        contactCardService.acceptCard('consumed-card', {
          connectWithSender: false,
        }),
      ).rejects.toThrow(/gone/);
    });
  });

  // ── declineCard ────────────────────────────────────────────────────

  describe('declineCard', () => {
    it('returns ok on happy path', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { ok: true },
        error: null,
      } as any);

      const result = await contactCardService.declineCard('c1');
      expect(result.ok).toBe(true);
    });

    it('throws when card not found (404)', async () => {
      const fakeResponse = new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
      });
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: Object.assign(new Error('FunctionsHttpError'), {
          context: fakeResponse,
        }),
      } as any);

      await expect(contactCardService.declineCard('missing')).rejects.toThrow(
        /not_found/,
      );
    });
  });

  // ── revokeCard ─────────────────────────────────────────────────────

  describe('revokeCard', () => {
    it('returns cascade_count on happy path', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { ok: true, cascade_count: 3 },
        error: null,
      } as any);

      const result = await contactCardService.revokeCard('root-card');
      expect(result.cascade_count).toBe(3);
    });

    it('throws when card already revoked (410)', async () => {
      const fakeResponse = new Response(JSON.stringify({ error: 'gone' }), {
        status: 410,
      });
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: Object.assign(new Error('FunctionsHttpError'), {
          context: fakeResponse,
        }),
      } as any);

      await expect(contactCardService.revokeCard('already-revoked')).rejects.toThrow(
        /gone/,
      );
    });
  });

  // ── forwardCard ────────────────────────────────────────────────────

  describe('forwardCard', () => {
    it('returns new card id when parent is forwardable', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          id: 'forward-1',
          share_url: 'https://go.pulse.logosvision.org/c/forward-1',
          recipient_user_id: null,
          email_sent: false,
        },
        error: null,
      } as any);

      const result = await contactCardService.forwardCard({
        parent_card_id: 'parent',
        recipient_hint: 'next@x.com',
      });
      expect(result.id).toBe('forward-1');
    });

    it('throws card_not_forwardable when parent locks forwarding (403)', async () => {
      const fakeResponse = new Response(
        JSON.stringify({
          error: 'card_not_forwardable',
          forwarded_from_card_id: 'parent',
        }),
        { status: 403 },
      );
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: Object.assign(new Error('FunctionsHttpError'), {
          context: fakeResponse,
        }),
      } as any);

      await expect(
        contactCardService.forwardCard({
          parent_card_id: 'parent',
          recipient_hint: 'next@x.com',
        }),
      ).rejects.toThrow(/card_not_forwardable/);
    });
  });
});
