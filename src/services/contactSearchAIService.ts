// ============================================
// CONTACT SEARCH AI SERVICE
// Natural language contact search powered by AI.
// Parses NL queries into structured filters, applies them
// against contacts + relationship profiles, and returns results.
// ============================================

import { Contact } from '../types';
import { RelationshipProfile } from '../types/relationshipTypes';
import { askAI } from './unifiedAIService';
import { supabase } from './supabase';
import { relationshipIntelligenceService } from './relationshipIntelligenceService';

// ==================== TYPES ====================

export interface ContactSearchResult {
  contacts: Contact[];
  explanation: string;
  isNLQuery: boolean;    // true if AI parsing was used
}

// Structured filter extracted from NL query
interface ParsedFilter {
  minScore?: number;
  maxScore?: number;
  trend?: 'rising' | 'falling' | 'stable';
  daysInactive?: number;          // contacts not interacted with in X days
  company?: string;
  nameContains?: string;
  emailContains?: string;
  isVip?: boolean;
  hasHighLeadScore?: boolean;
  communicationFrequency?: string;
  keywords?: string[];            // free-form keywords to match name/role/company
}

// Patterns that indicate a natural language query
const NL_INDICATORS = [
  "who", "people", "contacts", "find", "show me", "haven't", "i know",
  "talked", "spoke", "met", "been", "days", "weeks", "months", "ago",
  "warm", "cold", "hot", "leads", "active", "inactive", "strong", "weak",
  "industry", "company", "location", "city", "connected", "relationship"
];

function isNaturalLanguageQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return NL_INDICATORS.some(indicator => lower.includes(indicator));
}

// ==================== AI QUERY PARSER ====================

async function parseNLQuery(query: string): Promise<{ filter: ParsedFilter; explanation: string }> {
  const prompt = `You are a contact search assistant. Parse this natural language search query into a JSON filter object.

Query: "${query}"

Return a JSON object with only the relevant fields:
{
  "minScore": number (0-100, minimum relationship score),
  "maxScore": number (0-100, maximum relationship score),
  "trend": "rising" | "falling" | "stable",
  "daysInactive": number (not interacted with in X days),
  "company": string (company name fragment),
  "nameContains": string (name fragment),
  "emailContains": string (email fragment),
  "isVip": boolean,
  "hasHighLeadScore": boolean,
  "keywords": string[] (keywords to match against name/role/company),
  "explanation": string (brief human-readable explanation of what you're finding)
}

Examples:
- "people I haven't talked to in a month" → { "daysInactive": 30, "explanation": "Contacts with no interaction in 30+ days" }
- "warm leads" → { "minScore": 50, "maxScore": 75, "explanation": "Contacts with moderate relationship scores (50-75)" }
- "my strongest relationships" → { "minScore": 75, "explanation": "Your highest-scored contacts" }
- "contacts at Acme Corp" → { "company": "Acme", "explanation": "Contacts at Acme Corp" }
- "VIP contacts" → { "isVip": true, "explanation": "Your VIP contacts" }

Return only valid JSON, no markdown:`;

  try {
    const response = await askAI(prompt, {});
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const explanation = parsed.explanation || `Found contacts matching: "${query}"`;
    delete parsed.explanation;
    return { filter: parsed as ParsedFilter, explanation };
  } catch {
    // Fallback: treat as keyword search
    return {
      filter: { keywords: query.split(' ').filter(w => w.length > 2) },
      explanation: `Showing contacts matching "${query}"`,
    };
  }
}

// ==================== FILTER APPLICATION ====================

function applyFiltersToContacts(
  contacts: Contact[],
  profiles: RelationshipProfile[],
  filter: ParsedFilter
): Contact[] {
  const profileMap = new Map<string, RelationshipProfile>();
  for (const p of profiles) {
    profileMap.set(p.contactEmail.toLowerCase(), p);
  }

  const now = Date.now();

  return contacts.filter(contact => {
    const profile = profileMap.get(contact.email?.toLowerCase() ?? '');

    // Score filter
    if (filter.minScore !== undefined && profile) {
      if (profile.relationshipScore < filter.minScore) return false;
    }
    if (filter.maxScore !== undefined && profile) {
      if (profile.relationshipScore > filter.maxScore) return false;
    }

    // Trend filter
    if (filter.trend && profile) {
      if (profile.relationshipTrend !== filter.trend) return false;
    }

    // Days inactive filter
    if (filter.daysInactive !== undefined && profile?.lastInteractionAt) {
      const daysSince = (now - new Date(profile.lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < filter.daysInactive) return false;
    }

    // Company filter
    if (filter.company) {
      const companyLower = filter.company.toLowerCase();
      const contactCompany = (contact.company || profile?.company || '').toLowerCase();
      if (!contactCompany.includes(companyLower)) return false;
    }

    // Name filter
    if (filter.nameContains) {
      if (!contact.name.toLowerCase().includes(filter.nameContains.toLowerCase())) return false;
    }

    // Email filter
    if (filter.emailContains) {
      if (!contact.email?.toLowerCase().includes(filter.emailContains.toLowerCase())) return false;
    }

    // VIP filter
    if (filter.isVip === true && profile) {
      if (!profile.isVip) return false;
    }

    // Keywords filter — match against name, role, company
    if (filter.keywords && filter.keywords.length > 0) {
      const haystack = `${contact.name} ${contact.role} ${contact.company ?? ''} ${contact.email ?? ''}`.toLowerCase();
      const hasMatch = filter.keywords.some(kw => haystack.includes(kw.toLowerCase()));
      if (!hasMatch) return false;
    }

    return true;
  });
}

// Simple string search (fallback for non-NL queries)
function simpleSearch(contacts: Contact[], query: string): Contact[] {
  const q = query.toLowerCase().trim();
  if (!q) return contacts;
  return contacts.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.email?.toLowerCase().includes(q) ||
    c.company?.toLowerCase().includes(q) ||
    c.role?.toLowerCase().includes(q)
  );
}

// ==================== PUBLIC API ====================

/**
 * Search contacts using natural language or plain text.
 * Detects whether the query is NL or simple string and routes accordingly.
 */
export async function searchContactsNL(
  query: string,
  contacts: Contact[],
  userId: string
): Promise<ContactSearchResult> {
  const trimmed = query.trim();

  if (!trimmed) {
    return { contacts, explanation: '', isNLQuery: false };
  }

  // Short or simple queries → string search (fast)
  if (!isNaturalLanguageQuery(trimmed) || trimmed.length < 10) {
    return {
      contacts: simpleSearch(contacts, trimmed),
      explanation: '',
      isNLQuery: false,
    };
  }

  // Natural language → AI parsing + profile filtering
  try {
    // Fetch relationship profiles for this user
    let profiles: RelationshipProfile[] = [];
    try {
      profiles = await relationshipIntelligenceService.getProfiles({ userId });
    } catch {
      // profiles stay empty — filter will skip profile-based conditions
    }

    const { filter, explanation } = await parseNLQuery(trimmed);
    const filtered = applyFiltersToContacts(contacts, profiles, filter);

    return {
      contacts: filtered,
      explanation,
      isNLQuery: true,
    };
  } catch {
    // AI failed — fall back to string search
    return {
      contacts: simpleSearch(contacts, trimmed),
      explanation: '',
      isNLQuery: false,
    };
  }
}
