// ============================================
// Logos Vision contact↔client mapping (P1).
//
// All calls route through the Pulse Express backend (`server.js` /api/logos/*),
// NOT a direct Supabase client: `logos_pulse_mappings` has RLS enabled with no
// policies (browser is denied) and the Logos service-role key lives server-side
// only. Mirrors the slackService / googleContactsService backend-fetch pattern.
// ============================================

import { supabase } from './supabase';
import { BACKEND_URL } from '../config/backend';
import { invokeAIJson } from './ai/aiService';
import { getCurrentWorkspaceId } from './ai/getWorkspaceId';

export interface LogosClientLite {
  id: string;
  name: string;
  email?: string | null;
  contact_person?: string | null;
}

export interface LogosContactMapping {
  id: string;
  pulse_entity_id: string; // Pulse contacts.id
  logos_entity_id: string; // Logos clients.id
  logos_client_name?: string | null; // enriched server-side for display
  sync_status?: string | null;
  last_sync_at?: string | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parse(res: Response): Promise<Record<string, unknown>> {
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.ok === false) {
    throw new Error((json.error as string) || `Request failed: ${res.status}`);
  }
  return json;
}

/** Search/list Logos clients for the link picker (max 50, name-filtered). */
export async function listLogosClients(q = ''): Promise<LogosClientLite[]> {
  const url = `${BACKEND_URL}/api/logos/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  const res = await fetch(url, { headers: await authHeaders() });
  const json = await parse(res);
  return (json.clients as LogosClientLite[]) || [];
}

/** All contact→client mappings (enriched with the Logos client name). */
export async function getLogosMappings(): Promise<LogosContactMapping[]> {
  const res = await fetch(`${BACKEND_URL}/api/logos/mappings`, { headers: await authHeaders() });
  const json = await parse(res);
  return (json.mappings as LogosContactMapping[]) || [];
}

/** Link a Pulse contact to a Logos client (replaces any existing link). */
export async function linkContactToLogos(
  pulseContactId: string,
  logosClientId: string,
): Promise<LogosContactMapping> {
  const res = await fetch(`${BACKEND_URL}/api/logos/mappings`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ pulseContactId, logosClientId }),
  });
  const json = await parse(res);
  return json.mapping as LogosContactMapping;
}

/** Remove a Pulse contact's Logos client link. */
export async function unlinkContactFromLogos(pulseContactId: string): Promise<void> {
  const res = await fetch(
    `${BACKEND_URL}/api/logos/mappings?pulseContactId=${encodeURIComponent(pulseContactId)}`,
    { method: 'DELETE', headers: await authHeaders() },
  );
  await parse(res);
}

export interface LogToLogosInput {
  pulseContactId?: string; // direct contact id (note / manual / slack)
  recipientEmail?: string; // resolved server-side to a contact (email touchpoint)
  kind: 'note' | 'manual' | 'slack' | 'email';
  content: string;
  sourceId: string; // dedup key; identical sourceId logs at most once (server ledger)
}

/**
 * Log a Pulse touchpoint to the linked Logos client's activity timeline (P3/F1).
 * No-ops server-side when the contact is unmapped or the sync is unconfigured.
 * Fire-and-forget friendly — callers should `void` it and never block on it.
 */
export async function logToLogos(input: LogToLogosInput): Promise<{ skipped?: string; activityId?: string }> {
  const res = await fetch(`${BACKEND_URL}/api/logos/case-log`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  const json = await parse(res);
  return { skipped: json.skipped as string | undefined, activityId: json.activityId as string | undefined };
}

// ── P5 · AI field population ─────────────────────────────────────────────────

export interface LogosClientFields {
  id: string;
  name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
  employer?: string | null;
  communication_notes?: string | null;
  donor_stage?: string | null;
  preferred_contact_method?: string | null;
}

export interface LogosFieldSuggestion {
  field: string;
  current: string | null;
  suggested: string;
  confidence: number;
  rationale?: string;
  isReplace: boolean; // true when this overwrites a NON-empty Logos value (vs filling a blank)
}

const SUGGESTABLE_FIELDS = ['contact_person', 'email', 'phone', 'location', 'address', 'website', 'notes', 'employer'] as const;

/** Fetch a mapped Logos client's current editable fields. */
export async function getLogosClient(id: string): Promise<LogosClientFields | null> {
  const res = await fetch(`${BACKEND_URL}/api/logos/client?id=${encodeURIComponent(id)}`, { headers: await authHeaders() });
  const json = await parse(res);
  return (json.client as LogosClientFields) || null;
}

/** Write accepted field updates to a Logos client (server whitelists + guards). */
export async function updateLogosClientFields(logosClientId: string, fields: Record<string, string>): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/logos/client-fields`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ logosClientId, fields }),
  });
  await parse(res);
}

/**
 * Ask the AI (server-routed `contact_enrichment` task) to suggest Logos client
 * field updates by comparing the Pulse contact to the current Logos record.
 * Additive intent: only proposes where Pulse is more complete; never invents data.
 * Throws 'NO_WORKSPACE' if no active workspace. Returns [] when nothing to change.
 */
export async function suggestLogosClientUpdates(
  pulseContact: { name?: string; email?: string; phone?: string; company?: string; address?: string; website?: string; notes?: string },
  client: LogosClientFields,
): Promise<LogosFieldSuggestion[]> {
  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) throw new Error('NO_WORKSPACE');
  const current = {
    contact_person: client.contact_person, email: client.email, phone: client.phone,
    location: client.location, address: client.address, website: client.website,
    notes: client.notes, employer: client.employer,
  };
  const prompt = [
    'You help keep a CRM in sync. Compare the Pulse contact to the current Logos client record. STRONGLY PREFER suggesting a value only for a Logos field that is currently empty/null. Only suggest REPLACING a non-empty Logos value if the Pulse value is clearly a correction of an obvious error (e.g. a typo of the SAME value); never replace a non-empty value just because it differs, and when you do, set confidence at or below 0.4. Be especially conservative with email and phone: do not replace a non-empty email or phone unless it is plainly a typo of the same address/number. Never invent data not present in the Pulse contact.',
    '',
    `Pulse contact: ${JSON.stringify(pulseContact)}`,
    `Current Logos client: ${JSON.stringify(current)}`,
    '',
    `Return ONLY a JSON array (possibly empty). Each item: {"field": one of [${SUGGESTABLE_FIELDS.join(', ')}], "suggested": string, "confidence": number between 0 and 1, "rationale": short string}. Return [] if nothing should change.`,
  ].join('\n');

  const raw = await invokeAIJson<unknown>('contact_enrichment', prompt, { workspaceId, temperature: 0.2 });
  const list = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object' && Array.isArray((raw as { suggestions?: unknown[] }).suggestions)
        ? (raw as { suggestions: unknown[] }).suggestions
        : []);
  const allow = new Set<string>(SUGGESTABLE_FIELDS);
  return (list as Array<Record<string, unknown>>)
    .filter((s) => s && typeof s.field === 'string' && allow.has(s.field) && typeof s.suggested === 'string' && String(s.suggested).trim())
    .map((s) => {
      const current = (client[s.field as keyof LogosClientFields] as string | null | undefined) ?? null;
      return {
        field: s.field as string,
        current,
        suggested: String(s.suggested).trim(),
        confidence: typeof s.confidence === 'number' ? s.confidence : 0.5,
        rationale: s.rationale ? String(s.rationale) : undefined,
        isReplace: !!(current && String(current).trim()),
      };
    })
    .filter((s) => s.suggested !== (s.current ?? ''));
}

// ── P6 · F4 Records Flow Back (read the linked client's case state) ──────────

export interface LogosCaseState {
  case_status?: string | null;
  current_stage?: string | null;
  risk_level?: string | null;
  engagement_score?: number | null;
  updated_at?: string | null;
}

/** Read the linked Logos client's current case/journey state (null if none). */
export async function getLogosCaseState(logosClientId: string): Promise<LogosCaseState | null> {
  const res = await fetch(`${BACKEND_URL}/api/logos/case-state?clientId=${encodeURIComponent(logosClientId)}`, { headers: await authHeaders() });
  const json = await parse(res);
  return (json.state as LogosCaseState) || null;
}
