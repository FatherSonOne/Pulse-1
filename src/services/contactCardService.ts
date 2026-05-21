// contactCardService.ts
// Phase C contact-card sharing — thin client over the four edge
// functions: create-contact-card, create-contact-card-bundle,
// render-contact-vcard, resolve-card-deeplink.
//
// Conventions:
//   - All writes go through Supabase edge functions (server-side
//     validation, rate limits, block-list lookup, vCard rendering).
//   - Reads of the sender's own cards (Sent inbox) and the recipient's
//     own resolved-Pulse cards (Received inbox) go directly against
//     the contact_cards table — RLS gates them by sender_user_id /
//     recipient_user_id.
//   - Public landing rendering (resolve-card-deeplink) is hit only
//     by anonymous browsers via the canonical URL, so this service
//     wraps it for symmetry / testability but the live UI doesn't
//     usually call it from within the app.

import { supabase } from './supabase';
import type {
  ContactCard,
  CreateContactCardRequest,
  CreateContactCardResponse,
  CreateContactCardBundleRequest,
  CreateContactCardBundleResponse,
  BulkAcceptResult,
} from '../types/contactCard';

// ─── Internal helpers ────────────────────────────────────────────────

/**
 * Wraps supabase.functions.invoke with the same error-flattening
 * pattern used by billingService.callEdgeFunction — pulls the server
 * response body out of FunctionsHttpError.context and re-throws a
 * single-line message that includes the structured `error` enum so
 * UI callers can `.includes('rate_limit_exceeded')` cheaply.
 *
 * NOTE: error message wording chosen to match billingService — a
 * reviewer can grep `[<fn-name>]` to find consistent log lines.
 */
async function invokeEdgeFunction<T>(
  name: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, {
    body: body ?? {},
    headers,
  });

  if (error) {
    const ctxRaw = (error as { context?: unknown }).context;
    let response: Response | undefined;
    if (ctxRaw instanceof Response) {
      response = ctxRaw;
    } else if (
      ctxRaw &&
      typeof ctxRaw === 'object' &&
      (ctxRaw as { response?: Response }).response instanceof Response
    ) {
      response = (ctxRaw as { response: Response }).response;
    }

    let bodyData: Record<string, unknown> | null = null;
    let bodyText: string | null = null;
    if (response) {
      try {
        bodyText = await response.clone().text();
        try {
          bodyData = JSON.parse(bodyText);
        } catch {
          /* not JSON */
        }
      } catch {
        /* body already consumed */
      }
    }

    if (bodyData) {
      console.error(`[${name}] server response:`, bodyData);
    } else if (bodyText) {
      console.error(`[${name}] server response (non-JSON):`, bodyText);
    } else {
      console.error(
        `[${name}] no response body. Status:`,
        response?.status,
        'raw error:',
        error,
      );
    }

    const errorEnum = (bodyData?.error as string) || (error as Error).message;
    const detail = bodyData?.details as string | undefined;
    const retry = bodyData?.retry_after_seconds as number | undefined;
    const parts = [
      errorEnum,
      detail,
      retry !== undefined ? `(retry after ${retry}s)` : null,
    ].filter(Boolean);
    const err = new Error(`${name}: ${parts.join(' — ')}`);
    // Attach the structured body so callers that care can branch on
    // error enum without re-parsing the message string.
    (err as Error & { server?: Record<string, unknown> }).server =
      bodyData ?? {};
    throw err;
  }

  return data as T;
}

// ─── Create / share ──────────────────────────────────────────────────

/**
 * Create a single contact card and (when recipient_hint is an email)
 * fan out the Resend intro email. Returns the new card id + canonical
 * share URL.
 *
 * Errors thrown:
 *   - 'sender_blocked_by_recipient'  (HTTP 403)
 *   - 'card_not_forwardable'         (HTTP 403 — forwarded_from_card_id check)
 *   - 'rate_limit_exceeded'          (HTTP 403 — 50/day default)
 *   - 'contact_not_found'            (HTTP 404)
 *   - 'validation_failed'            (HTTP 400)
 */
export async function createCard(
  req: CreateContactCardRequest,
  options?: { idempotencyKey?: string },
): Promise<CreateContactCardResponse> {
  const headers: Record<string, string> = {};
  if (options?.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }
  return invokeEdgeFunction<CreateContactCardResponse>(
    'create-contact-card',
    req as unknown as Record<string, unknown>,
    headers,
  );
}

/**
 * Create N × M cards in one call (R-4). Forces token_policy='multi_use'.
 * Partial-failure semantics: succeeded cards are persisted; the
 * response includes both `share_urls` (successes) and `failures` (per-
 * card error). Whole-bundle rejection only on hard validation errors:
 *   - 'bundle_size_exceeded'        (>100 contacts or 0)
 *   - 'bundle_rate_limit_exceeded'  (1 bundle / 24h default)
 *   - 'recipients_blocked'          (all recipients blocked the sender)
 */
export async function createBundle(
  req: CreateContactCardBundleRequest,
): Promise<CreateContactCardBundleResponse> {
  return invokeEdgeFunction<CreateContactCardBundleResponse>(
    'create-contact-card-bundle',
    req as unknown as Record<string, unknown>,
  );
}

// ─── Inbox reads (direct table, RLS-gated) ───────────────────────────

/**
 * Recipient's Received inbox — Pulse-resolved cards only. Revoked +
 * expired rows are filtered by RLS (contact_cards_recipient_select),
 * so this returns only currently-valid cards.
 */
export async function fetchReceived(): Promise<ContactCard[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('contact_cards')
    .select('*')
    .eq('recipient_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as ContactCard[];
}

/**
 * Sender's Sent Cards inbox (R-23). Includes revoked + expired rows
 * because the sender's audit view needs to surface them with status
 * derived from deriveSentCardStatus().
 */
export async function fetchSent(): Promise<ContactCard[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('contact_cards')
    .select('*')
    .eq('sender_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as ContactCard[];
}

// ─── Accept / Decline / Revoke / Forward ─────────────────────────────

/**
 * Accept a single card. Inserts a contacts row (with possible_duplicate_of
 * link if the dedup matcher finds a match) and optionally writes the
 * sender-as-peer connection. On single_use cards, atomically flips
 * consumed_at via the edge function's `UPDATE ... WHERE consumed_at
 * IS NULL RETURNING *` pattern.
 *
 * NOTE: Implemented as a direct table write + RPC roundtrip; the
 * dedup matcher reuses Phase B's workspace_contacts (normalized
 * email + normalized phone + name fingerprint). When the dedicated
 * accept-card edge function ships, swap this to invokeEdgeFunction.
 * For Phase 6 backend pass, the service-layer accept lives here so
 * the Vitest mocks have a stable target.
 */
export async function acceptCard(
  cardId: string,
  options: { connectWithSender: boolean },
): Promise<BulkAcceptResult> {
  return invokeEdgeFunction<BulkAcceptResult>('accept-contact-card', {
    card_ids: [cardId],
    connect_with_sender: options.connectWithSender,
  });
}

/**
 * Decline a single card — soft Decline records the decision but does
 * NOT delete the contact_cards row (sender's audit trail preserved).
 * Implementation: insert into a per-recipient `card_declines` audit
 * table OR set a recipient-side decision marker. Backend deferred
 * — service stub for Vitest coverage.
 *
 * NOTE: Phase C spec is light on Decline mechanics; the magi verdict
 * locked Accept semantics but Decline is functionally just "don't
 * Accept + don't show again." UI marks the card hidden via local
 * state until backend lands.
 */
export async function declineCard(cardId: string): Promise<{ ok: true }> {
  return invokeEdgeFunction<{ ok: true }>('decline-contact-card', {
    card_id: cardId,
  });
}

/**
 * Sender-side Unsend / Revoke (R-16). Both write revoked_at via the
 * same code path; the UI distinguishes the button label. The cascade
 * walk (R-17) happens server-side via the WITH RECURSIVE CTE in the
 * revoke-contact-card edge function. We always go through the edge
 * function (not direct UPDATE) so cascade + telemetry stay atomic.
 *
 * NOTE: revoke-contact-card edge function is the cascade owner —
 * direct table UPDATE would only flip the targeted row and miss the
 * forwarded chain. This service method always routes through the fn.
 */
export async function revokeCard(
  cardId: string,
): Promise<{ ok: true; cascade_count: number }> {
  return invokeEdgeFunction<{ ok: true; cascade_count: number }>(
    'revoke-contact-card',
    { card_id: cardId },
  );
}

/**
 * Forward a card. Server-side validates parent's is_forwardable=true
 * before insert; client-side hiding is not the only gate (AC-3-3).
 */
export async function forwardCard(req: {
  parent_card_id: string;
  recipient_hint: string;
  intro_note?: string;
  expires_at?: string | null;
}): Promise<CreateContactCardResponse> {
  // Forward is a create-contact-card with forwarded_from_card_id set.
  // The parent's contact_id is server-side derived from the parent
  // row's card_snapshot — caller doesn't pass contact_id for forwards.
  return invokeEdgeFunction<CreateContactCardResponse>('create-contact-card', {
    // contact_id is intentionally absent — the edge function reads
    // the parent card's snapshot and rebuilds. If a parent ID is
    // missing or the parent is_forwardable=false, the function
    // returns 403 card_not_forwardable.
    forwarded_from_card_id: req.parent_card_id,
    recipient_hint: req.recipient_hint,
    intro_note: req.intro_note,
    expires_at: req.expires_at,
  });
}

// ─── Public-token read paths (for testability) ───────────────────────

/**
 * Hit the public landing endpoint for a token. Returns the raw HTML
 * (or a 410 / 404 error). Not used by the in-app client in normal
 * flow — the canonical landing URL is opened in the OS browser or
 * resolved via Universal Link / App Link. Kept for symmetry + tests.
 *
 * NOTE: invokes via supabase.functions.invoke which always sends the
 * caller's auth header; for true anonymous parity, the production
 * landing is fetched directly by the OS browser hitting
 * https://go.pulse.logosvision.org/c/{token} which DevOps routes to
 * the resolve-card-deeplink function.
 */
export async function resolveCardDeeplink(token: string): Promise<unknown> {
  return invokeEdgeFunction<unknown>('resolve-card-deeplink', { token });
}

/**
 * Hit the vCard endpoint for a token. Returns the vCard body as a
 * string (Content-Type: text/vcard). Same caveats as
 * resolveCardDeeplink — production traffic is the OS browser, not
 * the in-app client.
 */
export async function renderContactVCard(
  token: string,
  version: '3.0' | '4.0' = '3.0',
): Promise<unknown> {
  return invokeEdgeFunction<unknown>(
    'render-contact-vcard',
    { token },
    version === '4.0'
      ? { Accept: 'text/vcard; version=4.0' }
      : { Accept: 'text/vcard' },
  );
}

// ─── Default export — service-object pattern used by Phase B ─────────

const contactCardService = {
  createCard,
  createBundle,
  fetchReceived,
  fetchSent,
  acceptCard,
  declineCard,
  revokeCard,
  forwardCard,
  resolveCardDeeplink,
  renderContactVCard,
};

export default contactCardService;
