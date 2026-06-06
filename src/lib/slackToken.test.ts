// Tests for the Phase 8 per-user Slack bot-token persistence helper.
// Env-agnostic: stubs a minimal in-memory localStorage so it runs under node
// or jsdom identically.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSlackBotToken, setSlackBotToken, clearSlackBotToken, hasSlackBotToken } from './slackToken';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  });
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('slackToken (Phase 8 per-user token persistence)', () => {
  it('returns empty when nothing is stored', () => {
    expect(getSlackBotToken()).toBe('');
    expect(hasSlackBotToken()).toBe(false);
  });

  it('persists and reads a token', () => {
    setSlackBotToken('xoxb-abc-123');
    expect(getSlackBotToken()).toBe('xoxb-abc-123');
    expect(hasSlackBotToken()).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    setSlackBotToken('  xoxb-trim  ');
    expect(getSlackBotToken()).toBe('xoxb-trim');
  });

  it('treats a blank value as a clear', () => {
    setSlackBotToken('xoxb-abc');
    setSlackBotToken('   ');
    expect(getSlackBotToken()).toBe('');
    expect(hasSlackBotToken()).toBe(false);
  });

  it('clearSlackBotToken removes the token', () => {
    setSlackBotToken('xoxb-abc');
    clearSlackBotToken();
    expect(getSlackBotToken()).toBe('');
  });

  it('degrades gracefully when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    });
    expect(getSlackBotToken()).toBe('');
    expect(() => setSlackBotToken('x')).not.toThrow();
    expect(hasSlackBotToken()).toBe(false);
  });
});
