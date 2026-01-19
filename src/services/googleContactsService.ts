/**
 * Google Contacts Service
 * Handles fetching contacts via Google People API
 */

import { supabase } from './supabase';
import { Contact } from '../types';

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

// Refresh Google access token using the refresh token
const refreshGoogleAccessToken = async (refreshToken: string): Promise<string | null> => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId || !refreshToken) {
    console.warn('[Google Contacts] Missing client ID or refresh token for Google token refresh');
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Google Contacts] Google token refresh failed:', errorData);
      return null;
    }

    const data = await response.json();
    if (data.access_token) {
      console.log('[Google Contacts] Successfully refreshed Google access token');
      return data.access_token;
    }

    return null;
  } catch (error) {
    console.error('[Google Contacts] Error refreshing Google token:', error);
    return null;
  }
};

// Get Google access token from Supabase session
const getGoogleAccessToken = async (): Promise<string | null> => {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    console.error('[Google Contacts] No session found:', error);
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

  console.warn('[Google Contacts] No provider_token in session. User may need to re-authenticate with Google.');
  return null;
};

// Refresh token if needed
const refreshTokenIfNeeded = async (): Promise<string | null> => {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    console.error('[Google Contacts] Failed to load session:', error);
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
    groups: [],
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

  // Get contact groups (labels)
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
