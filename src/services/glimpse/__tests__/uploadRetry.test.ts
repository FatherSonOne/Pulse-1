// Upload retry behavior for glimpseService.uploadWithProgress.
// Verifies the retry-with-backoff added to handle transient Supabase
// Storage failures (notably status 544 DatabaseTimeout).
//
// We exercise the private uploadWithProgress via bracket notation — JS does
// not enforce `private`, and this avoids gutting the public API just to test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { glimpseService } from '../glimpseService';

// ── Mock XHR ──────────────────────────────────────────────────────────────
// Each test seeds an array of {status,responseText} for sequential calls;
// the constructor pops the next response and invokes onload microtask-soon.

interface FakeResponse {
  status: number;
  responseText?: string;
  /** If true, fire onerror instead of onload (simulates a network failure). */
  networkError?: boolean;
}

let responseQueue: FakeResponse[] = [];
let attemptCount = 0;
let progressEvents: number[] = [];

class FakeXHR {
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = '';
  open = vi.fn();
  setRequestHeader = vi.fn();

  send() {
    attemptCount++;
    const next = responseQueue.shift() ?? { status: 200 };

    // Fire one synthetic progress event so the reset-on-retry path is observable.
    setTimeout(() => {
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 50,
        total: 100,
      } as ProgressEvent);

      if (next.networkError) {
        this.onerror?.();
        return;
      }

      this.status = next.status;
      this.responseText = next.responseText ?? '';
      this.onload?.();
    }, 0);
  }
}

// Inject minimal env so the upload helper doesn't bail before XHR.
const ORIGINAL_ENV = { ...import.meta.env };

beforeEach(() => {
  responseQueue = [];
  attemptCount = 0;
  progressEvents = [];

  // @ts-expect-error — test override of read-only env shape
  import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  // @ts-expect-error
  import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';

  // @ts-expect-error — global stub
  globalThis.XMLHttpRequest = FakeXHR;

  // Tighter backoff base so tests don't take 4+ seconds. We override the
  // internal constant via spy: the retry path uses setTimeout — fake timers
  // let us advance it without waiting real wall-clock.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error
  import.meta.env.VITE_SUPABASE_URL = ORIGINAL_ENV.VITE_SUPABASE_URL;
  // @ts-expect-error
  import.meta.env.VITE_SUPABASE_ANON_KEY = ORIGINAL_ENV.VITE_SUPABASE_ANON_KEY;
});

// Type-erased accessor for the private method.
const upload = (blob: Blob, onProgress?: (n: number) => void) =>
  (glimpseService as unknown as {
    uploadWithProgress: (
      bucket: string,
      path: string,
      blob: Blob,
      contentType: string,
      onProgress?: (n: number) => void,
    ) => Promise<{ error: Error | null }>;
  }).uploadWithProgress(
    'relay',
    'video_vox/test.webm',
    blob,
    'video/webm',
    onProgress,
  );

describe('glimpseService.uploadWithProgress retry behavior', () => {
  it('succeeds on first attempt without retry', async () => {
    responseQueue = [{ status: 200 }];
    const blob = new Blob(['video-bytes'], { type: 'video/webm' });

    const promise = upload(blob, (p) => progressEvents.push(p));
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toBeNull();
    expect(attemptCount).toBe(1);
  });

  it('retries on 544 DatabaseTimeout and eventually succeeds', async () => {
    responseQueue = [
      { status: 544, responseText: '{"error":"DatabaseTimeout"}' },
      { status: 544, responseText: '{"error":"DatabaseTimeout"}' },
      { status: 200 },
    ];
    const blob = new Blob(['video-bytes'], { type: 'video/webm' });

    const promise = upload(blob, (p) => progressEvents.push(p));
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toBeNull();
    expect(attemptCount).toBe(3);
    // Progress should have reset to 0 between retries (twice).
    expect(progressEvents.filter((p) => p === 0).length).toBeGreaterThanOrEqual(2);
  });

  it('retries on 503 Service Unavailable', async () => {
    responseQueue = [{ status: 503 }, { status: 200 }];
    const blob = new Blob(['video-bytes'], { type: 'video/webm' });

    const promise = upload(blob);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toBeNull();
    expect(attemptCount).toBe(2);
  });

  it('retries on 429 Too Many Requests', async () => {
    responseQueue = [{ status: 429 }, { status: 200 }];
    const blob = new Blob(['video-bytes'], { type: 'video/webm' });

    const promise = upload(blob);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toBeNull();
    expect(attemptCount).toBe(2);
  });

  it('retries on network error (status 0)', async () => {
    responseQueue = [{ status: 0, networkError: true }, { status: 200 }];
    const blob = new Blob(['video-bytes'], { type: 'video/webm' });

    const promise = upload(blob);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toBeNull();
    expect(attemptCount).toBe(2);
  });

  it('does NOT retry on 401 Unauthorized', async () => {
    responseQueue = [{ status: 401, responseText: '{"error":"unauthorized"}' }];
    const blob = new Blob(['video-bytes'], { type: 'video/webm' });

    const promise = upload(blob);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).not.toBeNull();
    expect(attemptCount).toBe(1);
  });

  it('does NOT retry on 403 Forbidden', async () => {
    responseQueue = [{ status: 403 }];
    const blob = new Blob(['video-bytes'], { type: 'video/webm' });

    const promise = upload(blob);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).not.toBeNull();
    expect(attemptCount).toBe(1);
  });

  it('does NOT retry on 400 Bad Request (object name collision)', async () => {
    responseQueue = [{ status: 400, responseText: '{"error":"Duplicate"}' }];
    const blob = new Blob(['video-bytes'], { type: 'video/webm' });

    const promise = upload(blob);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).not.toBeNull();
    expect(attemptCount).toBe(1);
  });

  it('gives up after 3 attempts when 544 keeps failing', async () => {
    responseQueue = [
      { status: 544, responseText: '{"error":"DatabaseTimeout"}' },
      { status: 544, responseText: '{"error":"DatabaseTimeout"}' },
      { status: 544, responseText: '{"error":"DatabaseTimeout"}' },
      // 4th would succeed but should never be called
      { status: 200 },
    ];
    const blob = new Blob(['video-bytes'], { type: 'video/webm' });

    const promise = upload(blob);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).not.toBeNull();
    expect(result.error?.message).toContain('544');
    expect(attemptCount).toBe(3);
  });
});
