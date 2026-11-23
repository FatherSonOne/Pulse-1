// Bridge request signing (EAI-08). Web Crypto only, so vitest can run it.
// Must match Entomate's supabase/functions/ecosystem-inbound/signature.ts:
//   X-Ecosystem-Timestamp  unix seconds when it was sent
//   X-Ecosystem-Signature  v1=<hex HMAC-SHA256(secret, `${timestamp}.${eventId}.${rawBody}`)>
// The secret is the token sent as X-Ecosystem-Token (the receiver's inbound_token).

const enc = new TextEncoder();

export async function signBridgeRequest(secret: string, timestamp: string, eventId: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${eventId}.${rawBody}`));
  return 'v1=' + Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
}
