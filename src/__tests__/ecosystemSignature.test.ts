import { createHmac, webcrypto } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signBridgeRequest } from '../../supabase/functions/_shared/ecosystemSignature';

// The expected value below was produced by Entomate's own verifier
// (entomate supabase/functions/ecosystem-inbound/signature.ts at 7ffc877),
// which returned { ok: true, signed: true } for it. If this test fails,
// Entomate will refuse Pulse's events once require_signature is on.
const secret = 'test-secret-not-a-real-token';
const timestamp = '1763900000';
const eventId = '0b9a3c1e-0000-4000-8000-000000000001';
const rawBody = JSON.stringify({ id: eventId, source: 'pulse', eventType: 'eai08.probe', data: { n: 'é ✓' } });
const ENTOMATE_VECTOR = 'v1=f45ade4d7d7a19afd609f38054aad576b88d1baf38a03e23c66df305017e1b94';

describe('ecosystem bridge signature (EAI-08)', () => {
  // src/test/setup.ts mocks crypto.subtle globally; this test needs the real one.
  let mockedSubtle: SubtleCrypto;
  beforeAll(() => {
    mockedSubtle = globalThis.crypto.subtle;
    Object.assign(globalThis.crypto, { subtle: webcrypto.subtle });
  });
  afterAll(() => {
    Object.assign(globalThis.crypto, { subtle: mockedSubtle });
  });

  it('matches the signature Entomate accepts', async () => {
    expect(await signBridgeRequest(secret, timestamp, eventId, rawBody)).toBe(ENTOMATE_VECTOR);
  });

  it('is HMAC-SHA256 over `${ts}.${eventId}.${rawBody}`', async () => {
    const hex = createHmac('sha256', secret).update(`${timestamp}.${eventId}.${rawBody}`).digest('hex');
    expect(await signBridgeRequest(secret, timestamp, eventId, rawBody)).toBe(`v1=${hex}`);
  });

  it('changes when the body changes', async () => {
    expect(await signBridgeRequest(secret, timestamp, eventId, rawBody + ' ')).not.toBe(ENTOMATE_VECTOR);
  });
});
