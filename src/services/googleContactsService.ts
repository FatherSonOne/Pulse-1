/**
 * Google Contacts Service
 * Handles fetching contacts via Google People API
 */

import { supabase } from './supabase';
import { Contact, ContactType } from '../types';

export class WorkspaceNotBootstrappedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceNotBootstrappedError';
  }
}

const GOOGLE_PEOPLE_API = 'https://people.googleapis.com/v1';

// Google People API response types
export interface GooglePerson {
  resourceName: string;
  etag?: string;
  names?: Array<{
    displayName: string;
    givenName?: string;
    familyName?: string;
    metadata?: { primary?: boolean };
  }>;
  emailAddresses?: Array<{
    value: string;
    type?: string;
    metadata?: { primary?: boolean };
  }>;
  phoneNumbers?: Array<{
    value: string;
    type?: string;
    formattedType?: string;
    metadata?: { primary?: boolean };
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
    department?: string;
    metadata?: { primary?: boolean };
  }>;
  photos?: Array<{
    url: string;
    default?: boolean;
    metadata?: { primary?: boolean };
  }>;
  addresses?: Array<{
    formattedValue?: string;
    type?: string;
    streetAddress?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    metadata?: { primary?: boolean };
  }>;
  birthdays?: Array<{
    date?: {
      year?: number;
      month?: number;
      day?: number;
    };
    text?: string;
    metadata?: { primary?: boolean };
  }>;
  biographies?: Array<{
    value: string;
    contentType?: string;
    metadata?: { primary?: boolean };
  }>;
  urls?: Array<{
    value: string;
    type?: string;
    metadata?: { primary?: boolean };
  }>;
  memberships?: Array<{
    contactGroupMembership?: {
      contactGroupId: string;
      contactGroupResourceName: string;
    };
  }>;
}

interface PeopleConnectionsResponse {
  connections?: GooglePerson[];
  nextPageToken?: string;
  totalPeople?: number;
  totalItems?: number;
}

export interface ImportSelectedLabelsResult {
  imported: number;
  skipped: number;
  rejectedFilteredOut: number;
}

// Avatar color palette
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

// Refresh Google access token using the backend endpoint (secure with client_secret)
const refreshGoogleAccessToken = async (refreshToken: string): Promise<string | null> => {
  if (!refreshToken) {
    console.warn('[Google Contacts] Missing refresh token for Google token refresh');
    return null;
  }

  try {
    // Get Supabase session for authentication with backend
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn('[Google Contacts] No Supabase session available for backend authentication');
      return null;
    }

    // ✅ Call backend endpoint with client secret (secure)
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';
    const response = await fetch(`${backendUrl}/api/google/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Google Contacts] Backend token refresh failed:', errorData);

      // Check if re-authentication is required
      if (errorData.requiresReauth || errorData.code === 'INVALID_GRANT') {
        const error = new Error('Your Google session has expired. Please reconnect your Google account.');
        (error as any).code = 'GOOGLE_CONTACTS_SESSION_EXPIRED';
        (error as any).requiresReauth = true;
        throw error;
      }

      return null;
    }

    const data = await response.json();
    if (data.access_token) {
      console.log('[Google Contacts] Successfully refreshed Google access token via backend');
      return data.access_token;
    }

    return null;
  } catch (error) {
    // Re-throw auth errors so they can be caught by UI
    if ((error as any).requiresReauth) {
      throw error;
    }
    console.error('[Google Contacts] Error refreshing Google token:', error);
    return null;
  }
};

// Get Google access token from Supabase session
const getGoogleAccessToken = async (): Promise<string | null> => {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    // Use debug-level - this is expected when user isn't logged in
    console.debug('[Google Contacts Debug] No session found (expected when not authenticated)');
    return null;
  }

  if (session.provider_token) {
    return session.provider_token;
  }

  const refreshToken = (session as any)?.provider_refresh_token;
  if (refreshToken) {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    if (refreshed) {
      return refreshed;
    }
  }

  // Use debug-level - this is expected when user hasn't connected Google
  console.debug('[Google Contacts Debug] No provider_token in session (expected when not connected to Google)');
  return null;
};

// Refresh token if needed
const refreshTokenIfNeeded = async (): Promise<string | null> => {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    // Use debug-level - this is expected when user isn't logged in
    console.debug('[Google Contacts Debug] No session found (expected when not authenticated)');
    return null;
  }

  if (session.provider_token) {
    return session.provider_token;
  }

  const refreshToken = (session as any)?.provider_refresh_token;
  if (refreshToken) {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    if (refreshed) {
      return refreshed;
    }
  }

  const refreshResult = await supabase.auth.refreshSession();
  if (refreshResult.error) {
    console.error('[Google Contacts] Failed to refresh session:', refreshResult.error);
    return null;
  }

  return refreshResult.data.session?.provider_token || null;
};

// Generate consistent avatar color from email
const getAvatarColor = (email: string): string => {
  const colorIndex = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[colorIndex];
};

const stripContactGroupPrefix = (labelId: string): string => labelId.replace(/^contactGroups\//, '');

const getPersonContactGroupIds = (person: GooglePerson): string[] => {
  const ids = person.memberships
    ?.map(membership => membership.contactGroupMembership?.contactGroupId)
    .filter((id): id is string => Boolean(id))
    .map(stripContactGroupPrefix) ?? [];

  return Array.from(new Set(ids));
};

// Convert Google Person to Contact
const googlePersonToContact = (person: GooglePerson): Contact => {
  // Get primary or first name
  const nameEntry = person.names?.find(n => n.metadata?.primary) || person.names?.[0];
  const name = nameEntry?.displayName || 'Unknown';

  // Get primary or first email
  const emailEntry = person.emailAddresses?.find(e => e.metadata?.primary) || person.emailAddresses?.[0];
  const email = emailEntry?.value || '';

  // Get primary or first phone
  const phoneEntry = person.phoneNumbers?.find(p => p.metadata?.primary) || person.phoneNumbers?.[0];
  const phone = phoneEntry?.value;

  // Get primary or first organization
  const orgEntry = person.organizations?.find(o => o.metadata?.primary) || person.organizations?.[0];
  const company = orgEntry?.name;
  const role = orgEntry?.title || '';

  // Get primary or first address
  const addressEntry = person.addresses?.find(a => a.metadata?.primary) || person.addresses?.[0];
  const address = addressEntry?.formattedValue;

  // Get biography/notes
  const bioEntry = person.biographies?.find(b => b.metadata?.primary) || person.biographies?.[0];
  const notes = bioEntry?.value;

  // Get birthday
  const birthdayEntry = person.birthdays?.find(b => b.metadata?.primary) || person.birthdays?.[0];
  let birthday: string | undefined;
  if (birthdayEntry?.date) {
    const { year, month, day } = birthdayEntry.date;
    if (month && day) {
      birthday = year
        ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Get website
  const urlEntry = person.urls?.find(u => u.metadata?.primary) || person.urls?.[0];
  const website = urlEntry?.value;

  // Extract resource ID for stable ID
  const resourceId = person.resourceName.replace('people/', '');

  return {
    id: `google_${resourceId}`,
    name,
    email,
    phone,
    company,
    role,
    address,
    notes,
    birthday,
    website,
    avatarColor: getAvatarColor(email || name),
    status: 'offline',
    source: 'google',
    lastSynced: new Date(),
    groups: getPersonContactGroupIds(person),
  };
};

class GoogleContactsService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  // Get valid token (cached or refreshed)
  private async getValidToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Try to get token from session
    let token = await getGoogleAccessToken();

    if (!token) {
      // Try refreshing the session
      token = await refreshTokenIfNeeded();
    }

    if (!token) {
      const error = new Error('GOOGLE_CONTACTS_NOT_CONNECTED');
      (error as any).code = 'GOOGLE_CONTACTS_NOT_CONNECTED';
      (error as any).userMessage = 'Click "Connect" to enable Google Contacts sync';
      throw error;
    }

    this.accessToken = token;
    // Cache for 50 minutes (tokens typically expire in 1 hour)
    this.tokenExpiry = Date.now() + 50 * 60 * 1000;

    return token;
  }

  // Make authenticated API request
  private async apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getValidToken();

    const response = await fetch(`${GOOGLE_PEOPLE_API}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google People API error:', errorData);

      if (response.status === 401) {
        // Token expired, clear cache and retry once
        this.accessToken = null;
        this.tokenExpiry = 0;
        const newToken = await refreshTokenIfNeeded();
        if (newToken) {
          return this.apiRequest(endpoint, options);
        }
      }

      if (response.status === 403) {
        const error = new Error('Google Contacts access not granted. Please re-authenticate to grant contacts permission.');
        (error as any).code = 'GOOGLE_CONTACTS_PERMISSION_DENIED';
        throw error;
      }

      throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
    }

    return response.json();
  }

  // Check if user has Google Contacts connected
  async isConnected(): Promise<boolean> {
    try {
      const token = await getGoogleAccessToken();
      return !!token;
    } catch {
      return false;
    }
  }

  // Get contacts with pagination
  async getContacts(pageSize: number = 100, pageToken?: string): Promise<{ contacts: Contact[]; nextPageToken?: string }> {
    const personFields = [
      'names',
      'emailAddresses',
      'phoneNumbers',
      'organizations',
      'photos',
      'addresses',
      'birthdays',
      'biographies',
      'urls',
      'memberships',
    ].join(',');

    let url = `/people/me/connections?personFields=${personFields}&pageSize=${pageSize}&sortOrder=LAST_MODIFIED_DESCENDING`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await this.apiRequest<PeopleConnectionsResponse>(url);

    const contacts = (response.connections || [])
      .filter(person => person.names && person.names.length > 0) // Only contacts with names
      .map(googlePersonToContact);

    return {
      contacts,
      nextPageToken: response.nextPageToken,
    };
  }

  // Get all contacts (handles pagination automatically)
  async getAllContacts(): Promise<Contact[]> {
    const allContacts: Contact[] = [];
    let pageToken: string | undefined;

    do {
      const { contacts, nextPageToken } = await this.getContacts(1000, pageToken);
      allContacts.push(...contacts);
      pageToken = nextPageToken;
    } while (pageToken);

    return allContacts;
  }

  // Search contacts by name or email
  async searchContacts(query: string): Promise<Contact[]> {
    const personFields = [
      'names',
      'emailAddresses',
      'phoneNumbers',
      'organizations',
    ].join(',');

    try {
      const response = await this.apiRequest<{ results?: Array<{ person: GooglePerson }> }>(
        `/people:searchContacts?query=${encodeURIComponent(query)}&readMask=${personFields}&pageSize=30`
      );

      return (response.results || [])
        .filter(r => r.person.names && r.person.names.length > 0)
        .map(r => googlePersonToContact(r.person));
    } catch (error) {
      console.error('Contact search failed:', error);
      return [];
    }
  }

  /**
   * Get contact groups (labels).
   *
   * Google returns full resource names (`contactGroups/<id>`), but Pulse stores
   * and compares the bare `<id>` form everywhere downstream, including
   * `rejected_import_labels.label_id`.
   */
  async getContactGroups(): Promise<Array<{ id: string; name: string; memberCount: number }>> {
    try {
      const response = await this.apiRequest<{
        contactGroups?: Array<{
          resourceName: string;
          name: string;
          memberCount?: number;
          groupType?: string;
        }>;
      }>('/contactGroups?pageSize=100');

      return (response.contactGroups || [])
        .filter(g => g.groupType === 'USER_CONTACT_GROUP')
        .map(g => ({
          id: g.resourceName.replace('contactGroups/', ''),
          name: g.name,
          memberCount: g.memberCount || 0,
        }));
    } catch (error) {
      console.error('Failed to fetch contact groups:', error);
      return [];
    }
  }

  // Clear cached token (for logout/reconnect)
  clearCache(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
  }
}

// Export singleton instance
export const googleContactsService = new GoogleContactsService();

export const importSelectedLabels = async (
  labelIds: string[],
  workspaceId: string
): Promise<ImportSelectedLabelsResult> => {
  const canonicalLabelIds = Array.from(new Set(labelIds.map(stripContactGroupPrefix)));
  if (canonicalLabelIds.length === 0) {
    return { imported: 0, skipped: 0, rejectedFilteredOut: 0 };
  }

  const { data: hasAccess, error: accessError } = await supabase.rpc('user_has_workspace_access', {
    ws_id: workspaceId,
  });

  if (accessError) {
    throw accessError;
  }

  if (!hasAccess) {
    throw new WorkspaceNotBootstrappedError(
      `Workspace not bootstrapped or user not a member: ${workspaceId}`
    );
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error('Cannot import Google contacts without an authenticated user');
  }

  const { data: rejectedRows, error: rejectedError } = await supabase
    .from('rejected_import_labels')
    .select('label_id')
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .eq('source', 'google');

  if (rejectedError) {
    throw rejectedError;
  }

  const rejectedLabelIds = new Set((rejectedRows ?? []).map(row => row.label_id));
  const survivingLabelIds = canonicalLabelIds.filter(labelId => !rejectedLabelIds.has(labelId));
  const rejectedFilteredOut = canonicalLabelIds.length - survivingLabelIds.length;

  if (survivingLabelIds.length === 0) {
    return { imported: 0, skipped: 0, rejectedFilteredOut };
  }

  const survivingLabelSet = new Set(survivingLabelIds);
  const allContacts = await googleContactsService.getAllContacts();
  const matchingContacts = allContacts
    .map(contact => ({
      contact,
      importLabels: (contact.groups ?? []).filter(groupId => survivingLabelSet.has(groupId)),
    }))
    .filter(({ importLabels }) => importLabels.length > 0);

  if (matchingContacts.length === 0) {
    return { imported: 0, skipped: allContacts.length, rejectedFilteredOut };
  }

  const rows = matchingContacts.map(({ contact, importLabels }) => ({
    user_id: user.id,
    platform: 'google',
    external_id: contact.id.replace(/^google_/, ''),
    name: contact.name,
    role: contact.role || 'Contact',
    company: contact.company,
    avatar_color: contact.avatarColor,
    status: contact.status,
    email: contact.email,
    phone: contact.phone,
    address: contact.address,
    notes: contact.notes,
    website: contact.website,
    birthday: contact.birthday,
    groups: contact.groups ?? [],
    source: 'google',
    last_synced: new Date().toISOString(),
    import_source: 'google',
    import_label: importLabels,
  }));

  const { error: upsertError } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'user_id,platform,external_id' });

  if (upsertError) {
    throw upsertError;
  }

  return {
    imported: rows.length,
    skipped: allContacts.length - rows.length,
    rejectedFilteredOut,
  };
};

export interface ContactImportAssignment {
  contact: Contact;
  contactType: ContactType;
}

/**
 * Phase D import path. Caller supplies a pre-staged set of Google contacts
 * each tagged with the Pulse-taxonomy contactType the operator picked in the
 * Tag step of ConnectContactsModal. Bypasses label-based filtering entirely.
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
    throw new Error('Cannot import Google contacts without an authenticated user');
  }

  const rows = assignments.map(({ contact, contactType }) => ({
    user_id: user.id,
    platform: 'google',
    external_id: contact.id.replace(/^google_/, ''),
    name: contact.name,
    role: contact.role || 'Contact',
    company: contact.company,
    avatar_color: contact.avatarColor,
    status: contact.status,
    email: contact.email,
    phone: contact.phone,
    address: contact.address,
    notes: contact.notes,
    website: contact.website,
    birthday: contact.birthday,
    groups: contact.groups ?? [],
    source: 'google',
    last_synced: new Date().toISOString(),
    import_source: 'google',
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
 * Phase D start-over path. Hard-deletes every contact row whose
 * source = 'google' for the current user. Intended for the operator
 * who landed in Pulse with a pre-Phase-D bulk import and wants to
 * re-import selectively via ConnectContactsModal. Manual ('local')
 * and Logos Vision ('vision') rows are untouched.
 */
export const wipeGoogleImportedContacts = async (): Promise<{ deleted: number }> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { count, error } = await supabase
    .from('contacts')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .eq('source', 'google');

  if (error) throw error;

  return { deleted: count ?? 0 };
};
