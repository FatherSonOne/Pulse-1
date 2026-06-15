/**
 * Microsoft Contacts Service
 * Fetches contacts via the Microsoft Graph API (/me/contacts) and imports a
 * selected set into public.contacts. Mirror of googleContactsService.ts.
 *
 * Token model: the durable refresh path is server-side (server.js ->
 * /api/microsoft/refresh-token + public.user_microsoft_tokens), exactly like
 * Google. The session's provider_token is used as a fast path ONLY when the
 * active Supabase provider is azure (so a Google-login session's provider_token
 * is never mistaken for a Graph token).
 */

import { supabase } from './supabase';
import { Contact, ContactType } from './../types';
import {
  refreshMicrosoftProviderToken,
  MicrosoftReauthRequiredError,
} from './microsoft/microsoftTokenRefresh';

export class WorkspaceNotBootstrappedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceNotBootstrappedError';
  }
}

const GRAPH_API = 'https://graph.microsoft.com/v1.0';

// Microsoft Graph contact resource (subset we $select).
export interface GraphContact {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  emailAddresses?: Array<{ name?: string; address?: string }>;
  mobilePhone?: string;
  businessPhones?: string[];
  homePhones?: string[];
  companyName?: string;
  jobTitle?: string;
  department?: string;
  personalNotes?: string;
  birthday?: string; // DateTimeOffset (ISO)
  categories?: string[];
  businessAddress?: GraphPhysicalAddress;
  homeAddress?: GraphPhysicalAddress;
}

interface GraphPhysicalAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryOrRegion?: string;
}

interface GraphContactsResponse {
  value?: GraphContact[];
  '@odata.nextLink'?: string;
}

export interface ImportSelectedLabelsResult {
  imported: number;
  skipped: number;
  rejectedFilteredOut: number;
}

// Avatar color palette (parity with googleContactsService).
const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-teal-500',
];

const getAvatarColor = (email: string): string => {
  const colorIndex = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[colorIndex];
};

const formatAddress = (addr?: GraphPhysicalAddress): string | undefined => {
  if (!addr) return undefined;
  const line = [
    addr.street,
    addr.city,
    [addr.state, addr.postalCode].filter(Boolean).join(' '),
    addr.countryOrRegion,
  ]
    .map(part => (part ?? '').trim())
    .filter(Boolean)
    .join(', ');
  return line || undefined;
};

const parseBirthday = (value?: string): string | undefined => {
  if (!value) return undefined;
  // Graph returns e.g. "1990-04-12T00:00:00Z" (or a zeroed sentinel year for
  // "no year" birthdays). Keep YYYY-MM-DD; downstream stores it as text.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  // Microsoft uses 1604 as the "year unknown" sentinel.
  return year === '1604' ? `${month}-${day}` : `${year}-${month}-${day}`;
};

// Convert a Graph contact to a Pulse Contact.
const graphContactToContact = (c: GraphContact): Contact => {
  const primaryEmail = c.emailAddresses?.find(e => e.address)?.address || '';
  const name =
    c.displayName?.trim() ||
    [c.givenName, c.surname].filter(Boolean).join(' ').trim() ||
    primaryEmail ||
    'Unknown';
  const phone = c.mobilePhone || c.businessPhones?.[0] || c.homePhones?.[0];

  return {
    id: `microsoft_${c.id}`,
    name,
    email: primaryEmail,
    phone: phone || undefined,
    company: c.companyName || undefined,
    role: c.jobTitle || '',
    address: formatAddress(c.businessAddress) || formatAddress(c.homeAddress),
    notes: c.personalNotes || undefined,
    birthday: parseBirthday(c.birthday),
    avatarColor: getAvatarColor(primaryEmail || name),
    status: 'offline',
    source: 'microsoft',
    lastSynced: new Date(),
    // Outlook "categories" are the closest analog to Google labels: a contact
    // can carry several, so they bucket the wizard's Stage step. Users with no
    // categories land everything in the "Uncategorized" bucket (handled by the
    // wizard's orphan logic), which is fine.
    groups: c.categories ?? [],
  };
};

// Resolve a Graph access token, fast-pathing the azure session token and
// falling back to the server-side refresh (stored refresh token).
const getMicrosoftAccessToken = async (): Promise<string | null> => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    console.debug('[MS Contacts] No Supabase session (expected when not authenticated)');
    return null;
  }

  const activeProvider = (session.user?.app_metadata as { provider?: string } | undefined)?.provider;

  // Fast path: only trust provider_token when the session was actually
  // authenticated via azure -- otherwise it is a different provider's token.
  if (activeProvider === 'azure' && session.provider_token) {
    return session.provider_token;
  }

  // Durable path: backend refresh. Pass the session's azure refresh token when
  // present; otherwise the backend uses the per-user stored token.
  const refreshToken =
    activeProvider === 'azure'
      ? (session as { provider_refresh_token?: string }).provider_refresh_token
      : undefined;
  return refreshMicrosoftProviderToken(refreshToken, 'MICROSOFT_CONTACTS_SESSION_EXPIRED');
};

class MicrosoftContactsService {
  private accessToken: string | null = null;
  private tokenExpiry = 0;
  private inFlightRefresh: Promise<string | null> | null = null;
  // Dedup the single underlying /me/contacts fetch so getAllContacts +
  // getContactGroups (fired in parallel by the wizard's Promise.all) share one
  // network round trip instead of paging the mailbox twice.
  private inFlightRaw: Promise<GraphContact[]> | null = null;

  private async resolveFreshToken(): Promise<string | null> {
    if (this.inFlightRefresh) return this.inFlightRefresh;
    this.inFlightRefresh = (async () => {
      try {
        return await getMicrosoftAccessToken();
      } finally {
        this.inFlightRefresh = null;
      }
    })();
    return this.inFlightRefresh;
  }

  private async getValidToken(): Promise<string> {
    const SAFETY_MS = 5 * 60 * 1000;
    if (this.accessToken && Date.now() < this.tokenExpiry - SAFETY_MS) {
      return this.accessToken;
    }

    let token: string | null;
    try {
      token = await this.resolveFreshToken();
    } catch (err) {
      if (err instanceof MicrosoftReauthRequiredError) {
        const error = new Error('Microsoft Contacts session expired. Reconnect to continue.');
        (error as { code?: string }).code = 'MICROSOFT_CONTACTS_SESSION_EXPIRED';
        (error as { requiresReauth?: boolean }).requiresReauth = true;
        throw error;
      }
      throw err;
    }

    if (!token) {
      const error = new Error('MICROSOFT_CONTACTS_NOT_CONNECTED');
      (error as { code?: string }).code = 'MICROSOFT_CONTACTS_NOT_CONNECTED';
      (error as { userMessage?: string }).userMessage = 'Reconnect Microsoft in Settings.';
      throw error;
    }

    this.accessToken = token;
    // Graph access tokens live ~60-75 min; cache 55 min with the 5-min margin.
    this.tokenExpiry = Date.now() + 55 * 60 * 1000;
    return token;
  }

  invalidateTokenCache(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
    this.inFlightRefresh = null;
    this.inFlightRaw = null;
  }

  // Authenticated Graph request. `pathOrUrl` may be a relative path
  // (`/me/contacts?...`) or an absolute @odata.nextLink URL.
  private async apiRequest<T>(pathOrUrl: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getValidToken();
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${GRAPH_API}${pathOrUrl}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Microsoft Graph API error:', errorData);

      if (response.status === 401) {
        const alreadyRetried = (options as RequestInit & { __retried?: boolean }).__retried;
        if (alreadyRetried) {
          const error = new Error('Microsoft Contacts session expired. Reconnect to continue.');
          (error as { code?: string }).code = 'MICROSOFT_CONTACTS_SESSION_EXPIRED';
          throw error;
        }
        this.invalidateTokenCache();
        return this.apiRequest(pathOrUrl, { ...options, __retried: true } as RequestInit);
      }

      if (response.status === 403) {
        const error = new Error('Microsoft Contacts access not granted. Please re-authenticate to grant contacts permission.');
        (error as { code?: string }).code = 'MICROSOFT_CONTACTS_PERMISSION_DENIED';
        throw error;
      }

      const message =
        (errorData as { error?: { message?: string } }).error?.message ||
        `API request failed: ${response.status}`;
      throw new Error(message);
    }

    return response.json();
  }

  private async fetchAllRaw(): Promise<GraphContact[]> {
    if (this.inFlightRaw) return this.inFlightRaw;
    this.inFlightRaw = (async () => {
      try {
        const select = [
          'id',
          'displayName',
          'givenName',
          'surname',
          'emailAddresses',
          'mobilePhone',
          'businessPhones',
          'homePhones',
          'companyName',
          'jobTitle',
          'department',
          'personalNotes',
          'birthday',
          'categories',
          'businessAddress',
          'homeAddress',
        ].join(',');

        const all: GraphContact[] = [];
        let next: string | undefined = `/me/contacts?$top=100&$select=${select}`;
        let guard = 0;
        while (next && guard < 200) {
          guard += 1;
          const resp: GraphContactsResponse = await this.apiRequest<GraphContactsResponse>(next);
          all.push(...(resp.value ?? []));
          next = resp['@odata.nextLink'];
        }
        return all;
      } finally {
        // Clear once resolved so a later wizard re-open re-fetches fresh.
        this.inFlightRaw = null;
      }
    })();
    return this.inFlightRaw;
  }

  async isConnected(): Promise<boolean> {
    try {
      const token = await getMicrosoftAccessToken();
      return !!token;
    } catch {
      return false;
    }
  }

  // All contacts (handles Graph pagination automatically). Only contacts with a
  // name or email survive, matching the Google service's filter intent.
  async getAllContacts(): Promise<Contact[]> {
    const raw = await this.fetchAllRaw();
    return raw
      .filter(c => c.displayName || c.givenName || c.surname || c.emailAddresses?.length)
      .map(graphContactToContact);
  }

  // "Groups" derived from Outlook categories present on the fetched contacts.
  // Shares fetchAllRaw() with getAllContacts() (single network round trip).
  async getContactGroups(): Promise<Array<{ id: string; name: string; memberCount: number }>> {
    try {
      const raw = await this.fetchAllRaw();
      const counts = new Map<string, number>();
      raw.forEach(c => {
        (c.categories ?? []).forEach(cat => {
          const trimmed = cat.trim();
          if (trimmed) counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
        });
      });
      return Array.from(counts.entries()).map(([name, memberCount]) => ({
        id: name,
        name,
        memberCount,
      }));
    } catch (error) {
      console.error('Failed to derive Microsoft contact groups:', error);
      return [];
    }
  }

  clearCache(): void {
    this.invalidateTokenCache();
  }
}

export const microsoftContactsService = new MicrosoftContactsService();

export interface ContactImportAssignment {
  contact: Contact;
  contactType: ContactType;
}

/**
 * Import a pre-staged, per-contact-tagged set of Microsoft contacts into
 * public.contacts. Mirror of googleContactsService.importSelectedContacts, with
 * platform/source = 'microsoft'. NOT-NULL columns (name/role/email/avatar_color/
 * status/platform/external_id/source) are always populated.
 */
export const importSelectedContacts = async (
  assignments: ContactImportAssignment[],
  workspaceId: string
): Promise<ImportSelectedLabelsResult> => {
  if (assignments.length === 0) {
    return { imported: 0, skipped: 0, rejectedFilteredOut: 0 };
  }

  const { data: hasAccess, error: accessError } = await supabase.rpc('user_has_workspace_access', {
    ws_id: workspaceId,
  });
  if (accessError) throw accessError;
  if (!hasAccess) {
    throw new WorkspaceNotBootstrappedError(
      `Workspace not bootstrapped or user not a member: ${workspaceId}`
    );
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) {
    throw new Error('Cannot import Microsoft contacts without an authenticated user');
  }

  const rows = assignments.map(({ contact, contactType }) => ({
    user_id: user.id,
    platform: 'microsoft',
    external_id: contact.id.replace(/^microsoft_/, ''),
    name: contact.name,
    role: contact.role || 'Contact',
    company: contact.company,
    avatar_color: contact.avatarColor,
    status: contact.status,
    email: contact.email || '',
    phone: contact.phone,
    address: contact.address,
    notes: contact.notes,
    website: contact.website,
    birthday: contact.birthday,
    groups: contact.groups ?? [],
    source: 'microsoft',
    last_synced: new Date().toISOString(),
    import_source: 'microsoft',
    import_label: contact.groups ?? [],
    contact_type: contactType,
  }));

  const { error: upsertError } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'user_id,platform,external_id' });

  if (upsertError) throw upsertError;

  return {
    imported: rows.length,
    skipped: 0,
    rejectedFilteredOut: 0,
  };
};

/**
 * Hard-delete every contact row whose source = 'microsoft' for the current user.
 * Parity with wipeGoogleImportedContacts for a start-over re-import.
 */
export const wipeMicrosoftImportedContacts = async (): Promise<{ deleted: number }> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { count, error } = await supabase
    .from('contacts')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .eq('source', 'microsoft');

  if (error) throw error;

  return { deleted: count ?? 0 };
};
