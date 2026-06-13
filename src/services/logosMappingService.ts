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
