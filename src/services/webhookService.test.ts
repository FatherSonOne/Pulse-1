// ============================================
// WEBHOOK SERVICE TESTS
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookService, WebhookSource } from './webhookService';

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(() => {
    service = new WebhookService();
    vi.clearAllMocks();
  });

  describe('registerWebhook', () => {
    it('should register a webhook configuration', () => {
      service.registerWebhook({
        source: 'slack',
        enabled: true,
        endpoint: '/api/webhooks/slack',
        events: ['message'],
      });

      const config = service.getConfig('slack');
      expect(config).toBeDefined();
      expect(config?.enabled).toBe(true);
      expect(config?.endpoint).toBe('/api/webhooks/slack');
    });
  });

  describe('setEnabled', () => {
    it('should enable/disable a webhook', () => {
      service.registerWebhook({
        source: 'slack',
        enabled: true,
        endpoint: '/api/webhooks/slack',
        events: ['message'],
      });

      service.setEnabled('slack', false);

      const config = service.getConfig('slack');
      expect(config?.enabled).toBe(false);
    });
  });

  describe('registerHandler', () => {
    it('should register a custom event handler', async () => {
      const handler = vi.fn();
      service.registerHandler('custom', 'test_event', handler);

      await service.processWebhook('custom', 'test_event', { data: 'test' });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('processWebhook', () => {
    it('should process incoming webhook and create event', async () => {
      const event = await service.processWebhook('slack', 'message', {
        text: 'Hello',
        channel: 'C123',
      });

      expect(event).toBeDefined();
      expect(event.id).toMatch(/^webhook-/);
      expect(event.source).toBe('slack');
      expect(event.eventType).toBe('message');
      expect(event.payload.text).toBe('Hello');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should mark event as verified when no secret required', async () => {
      const event = await service.processWebhook('github', 'push', {
        commits: [],
      });

      expect(event.verified).toBe(true);
    });

    it('should throw error when webhook is disabled', async () => {
      service.registerWebhook({
        source: 'slack',
        enabled: false,
        endpoint: '/api/webhooks/slack',
        events: ['message'],
      });

      await expect(
        service.processWebhook('slack', 'message', {})
      ).rejects.toThrow('Webhook for slack is disabled');
    });

    it('should execute registered handler', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      service.registerHandler('custom', 'test', handler);

      await service.processWebhook('custom', 'test', { data: 'test' });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'custom',
          eventType: 'test',
          payload: { data: 'test' },
        })
      );
    });

    it('should log event after processing', async () => {
      await service.processWebhook('slack', 'message', { text: 'test' });

      const logs = service.getLogs({ limit: 1 });
      expect(logs.length).toBe(1);
      expect(logs[0].source).toBe('slack');
      expect(logs[0].eventType).toBe('message');
    });
  });

  describe('getLogs', () => {
    it('should return recent logs', async () => {
      await service.processWebhook('slack', 'msg1', {});
      await service.processWebhook('gmail', 'msg2', {});
      await service.processWebhook('twilio', 'msg3', {});

      const logs = service.getLogs();
      expect(logs.length).toBe(3);
    });

    it('should filter logs by source', async () => {
      await service.processWebhook('slack', 'msg1', {});
      await service.processWebhook('gmail', 'msg2', {});
      await service.processWebhook('slack', 'msg3', {});

      const slackLogs = service.getLogs({ source: 'slack' });
      expect(slackLogs.length).toBe(2);
      expect(slackLogs.every((l) => l.source === 'slack')).toBe(true);
    });

    it('should filter logs by status', async () => {
      // Process a webhook that will be logged as 'received'
      await service.processWebhook('custom', 'no_handler', {});

      const receivedLogs = service.getLogs({ status: 'received' });
      expect(receivedLogs.length).toBeGreaterThan(0);
    });

    it('should limit number of logs returned', async () => {
      await service.processWebhook('slack', 'msg1', {});
      await service.processWebhook('slack', 'msg2', {});
      await service.processWebhook('slack', 'msg3', {});

      const limitedLogs = service.getLogs({ limit: 2 });
      expect(limitedLogs.length).toBe(2);
    });

    it('should sort logs by timestamp descending', async () => {
      await service.processWebhook('slack', 'first', {});
      await new Promise((r) => setTimeout(r, 10));
      await service.processWebhook('slack', 'second', {});

      const logs = service.getLogs();
      expect(logs[0].eventType).toBe('second');
      expect(logs[1].eventType).toBe('first');
    });
  });

  describe('getStats', () => {
    it('should return webhook statistics', async () => {
      await service.processWebhook('slack', 'msg1', {});
      await service.processWebhook('gmail', 'msg2', {});

      const stats = service.getStats();

      expect(stats.totalReceived).toBeGreaterThanOrEqual(0);
      expect(stats.totalProcessed).toBeGreaterThanOrEqual(0);
      expect(typeof stats.avgProcessingTime).toBe('number');
      expect(stats.bySource).toBeDefined();
    });

    it('should track stats by source', async () => {
      await service.processWebhook('slack', 'msg1', {});
      await service.processWebhook('slack', 'msg2', {});
      await service.processWebhook('gmail', 'msg3', {});

      const stats = service.getStats();

      expect(stats.bySource['slack']).toBe(2);
      expect(stats.bySource['gmail']).toBe(1);
    });
  });

  describe('generateWebhookUrl', () => {
    it('should generate correct webhook URL', () => {
      const url = service.generateWebhookUrl('slack', 'https://api.example.com');
      expect(url).toBe('https://api.example.com/api/webhooks/slack');
    });

    it('should work with different sources', () => {
      const sources: WebhookSource[] = ['slack', 'gmail', 'twilio', 'entomate', 'github', 'custom'];

      sources.forEach((source) => {
        const url = service.generateWebhookUrl(source, 'https://api.example.com');
        expect(url).toBe(`https://api.example.com/api/webhooks/${source}`);
      });
    });
  });

  describe('generateSecret', () => {
    it('should generate a random secret string', () => {
      const secret1 = service.generateSecret();
      const secret2 = service.generateSecret();

      expect(secret1).toBeTruthy();
      expect(secret1.length).toBe(64); // 32 bytes = 64 hex chars
      expect(secret1).not.toBe(secret2);
    });

    it('should generate hex string', () => {
      const secret = service.generateSecret();
      expect(secret).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('testWebhook', () => {
    it('should return true for successful test', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
      } as Response);

      const result = await service.testWebhook(
        'https://api.example.com/webhook',
        'slack',
        'message'
      );

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Test': 'true',
          }),
        })
      );
    });

    it('should return false for failed test', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
      } as Response);

      const result = await service.testWebhook(
        'https://api.example.com/webhook',
        'slack',
        'message'
      );

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const result = await service.testWebhook(
        'https://api.example.com/webhook',
        'slack',
        'message'
      );

      expect(result).toBe(false);
    });
  });
});
