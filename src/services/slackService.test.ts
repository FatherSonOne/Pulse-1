// ============================================
// SLACK SERVICE TESTS — Phase 8 send + identity
// First unit coverage for slackService. Mocks the /api/slack/proxy fetch and
// asserts: identity resolution, DM send (open -> postMessage), the upstream
// method:'POST' shape for writes, GET (no method) for reads, and error paths
// (users_not_found, missing_scope, empty text).
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlackService } from './slackService';

/** Queue one proxy response. Slack app-errors are HTTP 200 with { ok:false }. */
function mockProxyOnce(payload: any, httpOk = true, status = 200) {
  (global.fetch as any).mockResolvedValueOnce({
    ok: httpOk,
    status,
    statusText: httpOk ? 'OK' : 'Error',
    json: async () => payload,
  });
}

describe('SlackService (Phase 8 send + identity)', () => {
  let svc: SlackService;

  beforeEach(() => {
    global.fetch = vi.fn() as any;
    svc = new SlackService('xoxb-test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Parsed JSON body sent to the proxy on the Nth fetch call. */
  function bodyOf(callIndex: number) {
    const call = (global.fetch as any).mock.calls[callIndex];
    return JSON.parse(call[1].body);
  }

  describe('lookupUserByEmail', () => {
    it('returns the Slack user id on success and uses the GET (no method) read path', async () => {
      mockProxyOnce({ ok: true, user: { id: 'U123' } });

      const id = await svc.lookupUserByEmail('a@b.com');

      expect(id).toBe('U123');
      const body = bodyOf(0);
      expect(body.endpoint).toBe('users.lookupByEmail');
      expect(body.params).toEqual({ email: 'a@b.com' });
      expect(body.token).toBe('xoxb-test-token');
      expect(body.method).toBeUndefined(); // read -> proxy GET path
    });

    it('returns null when no Slack member matches (users_not_found)', async () => {
      mockProxyOnce({ ok: false, error: 'users_not_found' });
      await expect(svc.lookupUserByEmail('missing@b.com')).resolves.toBeNull();
    });

    it('throws on other Slack errors (e.g. missing_scope)', async () => {
      mockProxyOnce({ ok: false, error: 'missing_scope' });
      await expect(svc.lookupUserByEmail('a@b.com')).rejects.toThrow(/missing_scope/);
    });
  });

  describe('openDm', () => {
    it('opens a DM, returns the channel id, and sends method:POST', async () => {
      mockProxyOnce({ ok: true, channel: { id: 'D999' } });

      const ch = await svc.openDm('U123');

      expect(ch).toBe('D999');
      const body = bodyOf(0);
      expect(body.endpoint).toBe('conversations.open');
      expect(body.params).toEqual({ users: 'U123' });
      expect(body.method).toBe('POST'); // write -> proxy POST branch
    });

    it('throws when Slack returns no channel id', async () => {
      mockProxyOnce({ ok: true, channel: {} });
      await expect(svc.openDm('U123')).rejects.toThrow(/channel id/i);
    });
  });

  describe('sendMessage', () => {
    it('opens a DM then posts the trimmed text, returning ts + channel', async () => {
      mockProxyOnce({ ok: true, channel: { id: 'D999' } }); // conversations.open
      mockProxyOnce({ ok: true, ts: '1700000000.000100', channel: 'D999' }); // chat.postMessage

      const res = await svc.sendMessage('U123', '  hello  ');

      expect(res).toEqual({ ts: '1700000000.000100', channel: 'D999' });
      const post = bodyOf(1);
      expect(post.endpoint).toBe('chat.postMessage');
      expect(post.method).toBe('POST');
      expect(post.params).toEqual({ channel: 'D999', text: 'hello' }); // trimmed
    });

    it('rejects an empty message without calling the proxy', async () => {
      await expect(svc.sendMessage('U123', '   ')).rejects.toThrow(/empty/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('propagates a missing_scope error from chat.postMessage', async () => {
      mockProxyOnce({ ok: true, channel: { id: 'D999' } }); // open ok
      mockProxyOnce({ ok: false, error: 'missing_scope' }); // post fails
      await expect(svc.sendMessage('U123', 'hi')).rejects.toThrow(/missing_scope/);
    });
  });

  describe('read path stays unchanged', () => {
    it('testConnection sends no upstream method flag (GET path)', async () => {
      mockProxyOnce({ ok: true, team: 'Acme' });

      const r = await svc.testConnection();

      expect(r.success).toBe(true);
      expect(r.workspace).toBe('Acme');
      expect(bodyOf(0).method).toBeUndefined();
    });
  });
});
