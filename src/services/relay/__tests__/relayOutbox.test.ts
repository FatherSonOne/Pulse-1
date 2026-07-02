/**
 * Relay durable send outbox tests (app-dev sweep #1).
 *
 * Verifies the store persists/reads/removes entries and that the processor
 * delivers on success, backs off + parks on repeated failure, respects the
 * auto-retry ceiling, and honours a manual retry — all against the repo's
 * in-memory IndexedDB mock (no browser needed).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
// CRITICAL: install the IndexedDB mock before importing the store (the store
// instantiates on import).
import { setupIndexedDBMock } from '../../../test/utils/indexedDBMock';
setupIndexedDBMock();

// Mock the send orchestrator so we control success/failure deterministically.
const uploadAndSendQuickVox = vi.fn();
vi.mock('../voxModeService', () => ({
  voxModeService: {
    uploadAndSendQuickVox: (...args: any[]) => uploadAndSendQuickVox(...args),
  },
}));

// Mock the auth client the processor reads for the current user id.
// NOTE: the processor imports '../supabase' from src/services/relay/, which
// resolves to src/services/supabase — i.e. '../../supabase' from this test file.
const getUser = vi.fn(async () => ({ data: { user: { id: 'sender-1' } } }));
vi.mock('../../supabase', () => ({
  supabase: { auth: { getUser: () => getUser() } },
}));

import { relayOutbox, RelayOutboxEntry } from '../relayOutbox';
import {
  processOutbox,
  retryOutboxEntry,
  onOutboxEvent,
  OutboxEvent,
} from '../relayOutboxProcessor';

function makeEntry(overrides: Partial<RelayOutboxEntry> = {}): RelayOutboxEntry {
  return {
    id: overrides.id ?? `rec-${Math.floor(Math.random() * 1e9)}`,
    senderId: 'sender-1',
    recipientId: 'recipient-1',
    blob: new Blob(['audio'], { type: 'audio/webm' }),
    duration: 3,
    createdAt: Date.now(),
    status: 'pending',
    attempts: 0,
    nextAttemptAt: Date.now(),
    ...overrides,
  };
}

async function clearOutbox() {
  const all = await relayOutbox.getAll();
  await Promise.all(all.map((e) => relayOutbox.remove(e.id)));
}

describe('relayOutbox store', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'sender-1' } } });
    await clearOutbox();
  });

  it('persists an entry including its blob and reads it back', async () => {
    const entry = makeEntry({ id: 'a' });
    await relayOutbox.enqueue(entry);

    const back = await relayOutbox.get('a');
    expect(back).not.toBeNull();
    expect(back!.recipientId).toBe('recipient-1');
    expect(back!.blob).toBeInstanceOf(Blob);
    expect(back!.duration).toBe(3);
  });

  it('scopes getAll to the sender and sorts newest first', async () => {
    await relayOutbox.enqueue(makeEntry({ id: 'old', createdAt: 1000 }));
    await relayOutbox.enqueue(makeEntry({ id: 'new', createdAt: 2000 }));
    await relayOutbox.enqueue(
      makeEntry({ id: 'other', senderId: 'sender-2', createdAt: 3000 }),
    );

    const mine = await relayOutbox.getAll('sender-1');
    expect(mine.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('update merges a patch; remove deletes', async () => {
    await relayOutbox.enqueue(makeEntry({ id: 'a' }));
    await relayOutbox.update('a', { status: 'failed', attempts: 2 });

    let back = await relayOutbox.get('a');
    expect(back!.status).toBe('failed');
    expect(back!.attempts).toBe(2);

    await relayOutbox.remove('a');
    back = await relayOutbox.get('a');
    expect(back).toBeNull();
  });
});

describe('relayOutbox processor', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'sender-1' } } });
    await clearOutbox();
  });

  it('sends a pending entry and removes it on success', async () => {
    uploadAndSendQuickVox.mockResolvedValue({ id: 'real-1' });
    const events: OutboxEvent[] = [];
    const off = onOutboxEvent((e) => events.push(e));

    await relayOutbox.enqueue(makeEntry({ id: 'a' }));
    await processOutbox();
    off();

    expect(uploadAndSendQuickVox).toHaveBeenCalledTimes(1);
    expect(await relayOutbox.get('a')).toBeNull(); // removed on success
    expect(events.some((e) => e.type === 'sending' && e.id === 'a')).toBe(true);
    expect(
      events.some((e) => e.type === 'sent' && e.id === 'a'),
    ).toBe(true);
  });

  it('keeps the entry, increments attempts, and backs off on failure', async () => {
    uploadAndSendQuickVox.mockResolvedValue(null); // send failed
    const events: OutboxEvent[] = [];
    const off = onOutboxEvent((e) => events.push(e));

    await relayOutbox.enqueue(makeEntry({ id: 'a' }));
    await processOutbox();
    off();

    const back = await relayOutbox.get('a');
    expect(back).not.toBeNull(); // NOT dropped — the whole point
    expect(back!.attempts).toBe(1);
    expect(back!.status).toBe('pending'); // still in the auto-retry lane
    expect(back!.nextAttemptAt).toBeGreaterThan(Date.now()); // backoff scheduled
    expect(events.some((e) => e.type === 'failed' && e.id === 'a')).toBe(true);
  });

  it('parks in "failed" after the auto-retry ceiling', async () => {
    uploadAndSendQuickVox.mockResolvedValue(null);
    // One attempt below the ceiling (5). This failure makes attempts = 5 → parked.
    await relayOutbox.enqueue(makeEntry({ id: 'a', attempts: 4, nextAttemptAt: 0 }));

    await processOutbox();

    const back = await relayOutbox.get('a');
    expect(back!.attempts).toBe(5);
    expect(back!.status).toBe('failed'); // parked, no more auto-retry
  });

  it('does not touch entries whose backoff window is still in the future', async () => {
    uploadAndSendQuickVox.mockResolvedValue({ id: 'real-1' });
    await relayOutbox.enqueue(
      makeEntry({ id: 'a', nextAttemptAt: Date.now() + 60_000 }),
    );

    await processOutbox();

    expect(uploadAndSendQuickVox).not.toHaveBeenCalled();
    expect(await relayOutbox.get('a')).not.toBeNull();
  });

  it('manual retry resets a parked entry and re-sends it', async () => {
    uploadAndSendQuickVox.mockResolvedValue({ id: 'real-1' });
    await relayOutbox.enqueue(
      makeEntry({ id: 'a', status: 'failed', attempts: 5, nextAttemptAt: 0 }),
    );

    await retryOutboxEntry('a');
    // retryOutboxEntry fire-and-forgets the drain (the UI doesn't await it), so
    // flush the macrotask queue before asserting the send landed.
    await new Promise((r) => setTimeout(r, 0));

    expect(uploadAndSendQuickVox).toHaveBeenCalledTimes(1);
    expect(await relayOutbox.get('a')).toBeNull(); // resent + removed
  });

  it('skips work and leaves the queue intact when signed out', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    uploadAndSendQuickVox.mockResolvedValue({ id: 'real-1' });
    await relayOutbox.enqueue(makeEntry({ id: 'a' }));

    await processOutbox();

    expect(uploadAndSendQuickVox).not.toHaveBeenCalled();
    expect(await relayOutbox.get('a')).not.toBeNull();
  });
});
