// Tier-2 "Claude watched your inbox" cross-glimpse synthesis (#122).
//
// This hook layers an AI-written headline ON TOP of the always-on Tier-1
// deterministic briefing card. It is flag-gated (glimpseInboxDigest, OFF for
// v1) and SERVER-SIDE ONLY: the model call goes through the existing ai-router
// edge function via invokeAIJson('glimpse_inbox_digest', …). There is no client
// API key and no direct model SDK call. Whenever the flag is off, the digest is
// loading, there's nothing worth synthesizing, no workspace, or anything
// throws, the consumer degrades gracefully to Tier-1.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GlimpseConversation } from './glimpseTypes';
import { invokeAIJson } from '../ai/aiService';
import { getCurrentWorkspaceId } from '../ai/getWorkspaceId';

export interface GlimpseInboxDigest {
  /** ≤2 sentences, grounded in the provided summaries. */
  headline: string;
  /** 0–3 optional callouts, each referencing a real conversation id. */
  highlights: Array<{ conversationId: string; note: string }>;
}

export type GlimpseDigestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; digest: GlimpseInboxDigest }
  | { status: 'error' };

// Cap how many conversations we hand the model — keeps the prompt small/cheap.
const MAX_CONVERSATIONS = 12;

const SYSTEM_PROMPT = `You are an inbox-triage assistant for "Glimpse", a tool for asynchronous video messages. You will be given a JSON array of the user's conversations that currently need attention. Each entry has: id, name (who the conversation is with), summary (an AI summary or caption of the latest video message — may be empty), unread (unread count), actions (number of open action items), durationSec (length of the latest video), and status (processing status of the latest message).

Write a concise, FACTUAL synthesis of what is waiting and what matters most, grounded ONLY in the data provided. Output STRICT JSON and nothing else, in exactly this shape:
{"headline": string, "highlights": [{"conversationId": string, "note": string}]}

Rules:
- "headline": at most 2 sentences telling the user what's waiting and what to prioritize. Ground it strictly in the provided summaries — do NOT invent details, names, topics, or specifics that are not present in the input. If summaries are sparse or empty, stay appropriately general (e.g. "3 glimpses are waiting on you, 2 with open action items") rather than fabricating specifics.
- "highlights": 0 to 3 entries, each referencing a real "conversationId" from the input with a short, factual "note". Omit highlights entirely (empty array) if nothing specific can be said.
- Never claim or restate exact counts you are unsure of; the app shows the user the precise numbers separately, so prefer qualitative emphasis over inventing figures.
- Output ONLY the JSON object. No prose, no markdown, no code fences.`;

interface DigestInputEntry {
  id: string;
  name: string;
  summary: string;
  unread: number;
  actions: number;
  durationSec: number;
  status: string;
}

/** Stable signature of the inbox so the effect only refires when the inbox
 *  materially changes (not on every render). */
function inboxSignature(conversations: GlimpseConversation[]): string {
  return [...conversations]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      c =>
        `${c.id}|${c.lastMessageId ?? ''}|${c.unreadCount ?? 0}|${
          c.lastMessageActionCount ?? 0
        }|${c.lastMessageProcessingStatus ?? ''}`,
    )
    .join('~');
}

export function useGlimpseInboxDigest(args: {
  enabled: boolean;
  conversations: GlimpseConversation[];
  currentUserId: string;
}): GlimpseDigestState {
  const { enabled, conversations, currentUserId } = args;

  // Conversations that warrant attention. If none, Tier-1 already says "all
  // caught up" honestly — don't spend a token to say nothing.
  const needs = useMemo(
    () =>
      conversations.filter(
        c => (c.unreadCount ?? 0) > 0 || (c.lastMessageActionCount ?? 0) > 0,
      ),
    [conversations],
  );

  const signature = useMemo(() => inboxSignature(conversations), [conversations]);

  const [state, setState] = useState<GlimpseDigestState>({ status: 'idle' });
  // Signature we last kicked a fetch for — dedupes re-renders with same inbox.
  const fetchedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    // Gate 1: flag off → never call the router.
    if (!enabled) {
      fetchedSignatureRef.current = null;
      setState({ status: 'idle' });
      return;
    }

    // Gate 2: nothing needs the user → Tier-1 is the honest answer.
    if (needs.length === 0) {
      fetchedSignatureRef.current = null;
      setState({ status: 'idle' });
      return;
    }

    // Gate 3: no active workspace → can't (and shouldn't) call ai-router.
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      fetchedSignatureRef.current = null;
      setState({ status: 'idle' });
      return;
    }

    // Dedupe: same inbox we already fetched for → leave current state alone.
    if (fetchedSignatureRef.current === signature) {
      return;
    }
    fetchedSignatureRef.current = signature;

    const controller = new AbortController();
    let cancelled = false;

    // Build the prompt input: needs first, then most-recent by lastMessageAt,
    // capped at MAX_CONVERSATIONS.
    const needsIds = new Set(needs.map(c => c.id));
    const rest = conversations
      .filter(c => !needsIds.has(c.id))
      .sort(
        (a, b) =>
          (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0),
      );
    const ordered = [...needs, ...rest].slice(0, MAX_CONVERSATIONS);

    const nameOf = (c: GlimpseConversation): string => {
      const others = c.participants.filter(p => p.id !== currentUserId);
      return c.title || others.map(p => p.name).join(', ') || 'Video Chat';
    };

    const input: DigestInputEntry[] = ordered.map(c => ({
      id: c.id,
      name: nameOf(c),
      summary: c.lastMessageSummary || c.lastMessageCaption || '',
      unread: c.unreadCount ?? 0,
      actions: c.lastMessageActionCount ?? 0,
      durationSec: c.lastMessageDuration ?? 0,
      status: c.lastMessageProcessingStatus ?? 'complete',
    }));

    const validIds = new Set(ordered.map(c => c.id));

    setState({ status: 'loading' });

    invokeAIJson<GlimpseInboxDigest>(
      'glimpse_inbox_digest',
      JSON.stringify(input),
      {
        workspaceId,
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.3,
        signal: controller.signal,
      },
    )
      .then(raw => {
        if (cancelled || controller.signal.aborted) return;

        // Defensive coercion: headline must be a non-empty string; highlights
        // must be an array of {conversationId, note} whose conversationId
        // exists in the conversations we sent — drop any that don't.
        const headline =
          typeof raw?.headline === 'string' ? raw.headline.trim() : '';
        if (!headline) {
          setState({ status: 'error' });
          return;
        }

        const highlights = Array.isArray(raw?.highlights)
          ? raw.highlights
              .filter(
                (h): h is { conversationId: string; note: string } =>
                  !!h &&
                  typeof h.conversationId === 'string' &&
                  typeof h.note === 'string' &&
                  h.note.trim().length > 0 &&
                  validIds.has(h.conversationId),
              )
              .map(h => ({
                conversationId: h.conversationId,
                note: h.note.trim(),
              }))
              .slice(0, 3)
          : [];

        setState({ status: 'ready', digest: { headline, highlights } });
      })
      .catch(err => {
        if (cancelled || controller.signal.aborted) return;
        // Ignore aborted-request rejections (signature change / unmount).
        if (err?.name === 'AbortError') return;
        // Any other throw (invalid_task on an un-redeployed router,
        // cap-exceeded, parse failure, transport) → fall back to Tier-1.
        setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // currentUserId/needs/conversations are folded into the stable signature;
    // depending on the signature (plus enabled) keeps this from refiring every
    // render. needs.length is read inside the effect via the live closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signature, needs.length]);

  return state;
}
