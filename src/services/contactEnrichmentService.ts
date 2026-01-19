// ============================================
// CONTACT ENRICHMENT SERVICE
// Email signature parsing, duplicate detection, auto-tagging
// ============================================

import { supabase } from './supabase';
import { askAI } from './unifiedAIService';
import {
  RelationshipProfile,
  ExtractedSignature,
  DuplicateGroup,
  DuplicateContact,
} from '../types/relationshipTypes';

// ==================== SIGNATURE PARSING ====================

export interface ParsedSignature {
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
  address?: string;
  linkedin?: string;
  twitter?: string;
  confidence: number;
}

/**
 * Parse an email signature to extract contact information
 */
export async function parseEmailSignature(rawSignature: string): Promise<ParsedSignature> {
  if (!rawSignature || rawSignature.trim().length < 10) {
    return { confidence: 0 };
  }

  // Try regex-based extraction first (faster)
  const regexResult = extractWithRegex(rawSignature);

  // If regex found good data, return it
  if (regexResult.confidence >= 0.7) {
    return regexResult;
  }

  // Fall back to AI extraction for complex signatures
  try {
    const prompt = `Extract contact information from this email signature. Return JSON only:

${rawSignature}

Return this exact JSON structure:
{
  "name": "Full Name or null",
  "title": "Job Title or null",
  "company": "Company Name or null",
  "email": "email@example.com or null",
  "phone": "Phone number or null",
  "mobile": "Mobile number or null",
  "website": "URL or null",
  "address": "Address or null",
  "linkedin": "LinkedIn URL or null",
  "twitter": "Twitter handle or null"
}`;

    const response = await askAI(prompt);
    if (response) {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        ...parsed,
        confidence: 0.85
      };
    }
  } catch (error) {
    console.error('Error parsing signature with AI:', error);
  }

  return regexResult;
}

function extractWithRegex(text: string): ParsedSignature {
  const result: ParsedSignature = { confidence: 0 };
  let matches = 0;

  // Email pattern
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  if (emailMatch) {
    result.email = emailMatch[0];
    matches++;
  }

  // Phone patterns (various formats)
  const phonePatterns = [
    /(?:Phone|Tel|P|T)[:\s]*([+\d\s()-]{10,})/i,
    /(?:Mobile|Cell|M|C)[:\s]*([+\d\s()-]{10,})/i,
    /\b([+]?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})\b/
  ];

  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.phone = match[1]?.trim() || match[0].trim();
      matches++;
      break;
    }
  }

  // Website pattern
  const websiteMatch = text.match(/(?:https?:\/\/)?(?:www\.)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?/i);
  if (websiteMatch && !websiteMatch[0].includes('@')) {
    result.website = websiteMatch[0];
    matches++;
  }

  // LinkedIn pattern
  const linkedinMatch = text.match(/(?:linkedin\.com\/in\/[\w-]+)/i);
  if (linkedinMatch) {
    result.linkedin = `https://${linkedinMatch[0]}`;
    matches++;
  }

  // Twitter pattern
  const twitterMatch = text.match(/@[\w]{1,15}\b/);
  if (twitterMatch) {
    result.twitter = twitterMatch[0];
    matches++;
  }

  // Try to extract name (usually first line, all caps or title case)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.length < 50 && !firstLine.includes('@') && !firstLine.match(/^\d/)) {
      result.name = firstLine;
      matches++;
    }
  }

  // Try to extract title (often second line or contains common title words)
  const titleKeywords = /\b(manager|director|engineer|developer|president|ceo|cto|cfo|vp|head|lead|senior|junior|associate|consultant|analyst|specialist|coordinator)\b/i;
  for (const line of lines.slice(0, 5)) {
    if (titleKeywords.test(line) && line.length < 100) {
      result.title = line;
      matches++;
      break;
    }
  }

  // Try to extract company
  const companyKeywords = /\b(inc|llc|ltd|corp|co\.|company|group|solutions|services|technologies|consulting)\b/i;
  for (const line of lines.slice(0, 5)) {
    if (companyKeywords.test(line) && line.length < 100) {
      result.company = line.replace(/[|,].*$/, '').trim();
      matches++;
      break;
    }
  }

  result.confidence = Math.min(matches / 5, 1);
  return result;
}

// ==================== DUPLICATE DETECTION ====================

/**
 * Find potential duplicate contacts for a user
 */
export async function findDuplicates(userId: string): Promise<DuplicateGroup[]> {
  const { data: profiles, error } = await supabase
    .from('relationship_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('is_merged', false);

  if (error || !profiles) {
    console.error('Error fetching profiles for duplicate detection:', error);
    return [];
  }

  // Build profile map for quick lookup
  const profileMap = new Map<string, any>();
  profiles.forEach(p => profileMap.set(p.id, p));

  // Convert raw profile to RelationshipProfile shape for UI
  const toRelationshipProfile = (raw: any): RelationshipProfile => ({
    id: raw.id,
    userId: raw.user_id,
    contactEmail: raw.contact_email,
    contactName: raw.contact_name,
    canonicalEmail: raw.canonical_email,
    source: raw.source,
    company: raw.company,
    title: raw.title,
    phone: raw.phone,
    relationshipScore: raw.relationship_score || 0,
    relationshipTrend: raw.relationship_trend || 'stable',
    relationshipType: raw.relationship_type || 'unknown',
    communicationFrequency: raw.communication_frequency || 'unknown',
    totalEmailsSent: raw.total_emails_sent || 0,
    totalEmailsReceived: raw.total_emails_received || 0,
    totalMeetings: raw.total_meetings || 0,
    totalCalls: raw.total_calls || 0,
    firstInteractionAt: raw.first_interaction_at ? new Date(raw.first_interaction_at) : undefined,
    lastInteractionAt: raw.last_interaction_at ? new Date(raw.last_interaction_at) : undefined,
    isVip: raw.is_vip || false,
    isFavorite: raw.is_favorite || false,
    isBlocked: raw.is_blocked || false,
    isMerged: raw.is_merged || false,
    customTags: raw.custom_tags || [],
    customNotes: raw.custom_notes,
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
  });

  const duplicateGroups: Map<string, DuplicateContact[]> = new Map();
  const processed: Set<string> = new Set();

  for (let i = 0; i < profiles.length; i++) {
    if (processed.has(profiles[i].id)) continue;

    const profile = profiles[i];
    const matches: DuplicateContact[] = [];

    for (let j = i + 1; j < profiles.length; j++) {
      if (processed.has(profiles[j].id)) continue;

      const other = profiles[j];
      const matchResult = checkDuplicateMatch(profile, other);

      if (matchResult.confidence >= 0.7) {
        matches.push({
          id: '',
          userId,
          groupId: profile.id,
          profileId: other.id,
          matchConfidence: matchResult.confidence,
          matchReasons: matchResult.reasons,
          status: 'pending',
          createdAt: new Date(),
          profile: toRelationshipProfile(other),
        });
        processed.add(other.id);
      }
    }

    if (matches.length > 0) {
      // Add the original profile to the group
      matches.unshift({
        id: '',
        userId,
        groupId: profile.id,
        profileId: profile.id,
        matchConfidence: 1,
        matchReasons: ['primary'],
        status: 'pending',
        createdAt: new Date(),
        profile: toRelationshipProfile(profile),
      });
      processed.add(profile.id);
      duplicateGroups.set(profile.id, matches);
    }
  }

  // Convert to DuplicateGroup array
  const result: DuplicateGroup[] = [];
  for (const [groupId, contacts] of duplicateGroups) {
    result.push({
      groupId,
      profiles: contacts,
      suggestedPrimary: groupId,
      avgConfidence: contacts.reduce((sum, c) => sum + c.matchConfidence, 0) / contacts.length,
    });
  }

  return result;
}

interface MatchResult {
  confidence: number;
  reasons: string[];
}

function checkDuplicateMatch(
  a: { contact_email: string; contact_name?: string; canonical_email?: string; company?: string; phone?: string },
  b: { contact_email: string; contact_name?: string; canonical_email?: string; company?: string; phone?: string }
): MatchResult {
  const reasons: string[] = [];
  let score = 0;

  // Same canonical email (highest confidence)
  if (a.canonical_email && a.canonical_email === b.canonical_email) {
    reasons.push('same_canonical_email');
    score += 0.9;
  }

  // Similar name (fuzzy match)
  if (a.contact_name && b.contact_name) {
    const similarity = calculateNameSimilarity(a.contact_name, b.contact_name);
    if (similarity >= 0.85) {
      reasons.push('very_similar_name');
      score += 0.7;
    } else if (similarity >= 0.7) {
      reasons.push('similar_name');
      score += 0.4;
    }
  }

  // Same company (supports name match)
  if (a.company && b.company && a.company.toLowerCase() === b.company.toLowerCase()) {
    reasons.push('same_company');
    score += 0.2;
  }

  // Same phone number
  if (a.phone && b.phone) {
    const phoneA = a.phone.replace(/\D/g, '');
    const phoneB = b.phone.replace(/\D/g, '');
    if (phoneA.length >= 10 && phoneA === phoneB) {
      reasons.push('same_phone');
      score += 0.5;
    }
  }

  // Email local part similarity
  const localA = a.contact_email.split('@')[0].toLowerCase();
  const localB = b.contact_email.split('@')[0].toLowerCase();
  if (localA === localB && a.contact_email !== b.contact_email) {
    reasons.push('same_email_local_part');
    score += 0.3;
  }

  return {
    confidence: Math.min(score, 1),
    reasons
  };
}

function calculateNameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return 1;

  // Check if one contains the other
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  // Levenshtein distance-based similarity
  const distance = levenshteinDistance(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - (distance / maxLen);
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Merge duplicate profiles into a primary profile
 */
export async function mergeProfiles(
  userId: string,
  primaryId: string,
  duplicateIds: string[]
): Promise<boolean> {
  if (duplicateIds.length === 0) return false;

  try {
    // Get all profiles
    const { data: profiles } = await supabase
      .from('relationship_profiles')
      .select('*')
      .in('id', [primaryId, ...duplicateIds])
      .eq('user_id', userId);

    if (!profiles || profiles.length === 0) return false;

    const primary = profiles.find(p => p.id === primaryId);
    if (!primary) return false;

    const duplicates = profiles.filter(p => p.id !== primaryId);

    // Merge data from duplicates into primary
    const mergedData: any = {
      // Combine totals
      total_emails_sent: duplicates.reduce((sum, d) => sum + (d.total_emails_sent || 0), primary.total_emails_sent || 0),
      total_emails_received: duplicates.reduce((sum, d) => sum + (d.total_emails_received || 0), primary.total_emails_received || 0),
      total_meetings: duplicates.reduce((sum, d) => sum + (d.total_meetings || 0), primary.total_meetings || 0),
      total_calls: duplicates.reduce((sum, d) => sum + (d.total_calls || 0), primary.total_calls || 0),

      // Take earliest first interaction
      first_interaction_at: [primary.first_interaction_at, ...duplicates.map(d => d.first_interaction_at)]
        .filter(Boolean)
        .sort()[0],

      // Take latest last interaction
      last_interaction_at: [primary.last_interaction_at, ...duplicates.map(d => d.last_interaction_at)]
        .filter(Boolean)
        .sort()
        .reverse()[0],

      // Merge tags
      custom_tags: [...new Set([
        ...(primary.custom_tags || []),
        ...duplicates.flatMap(d => d.custom_tags || [])
      ])],

      // Merge notes
      custom_notes: [primary.custom_notes, ...duplicates.map(d => d.custom_notes)]
        .filter(Boolean)
        .join('\n---\n'),

      // Track merged emails
      merged_from: [
        ...(primary.merged_from || []),
        ...duplicates.map(d => d.contact_email)
      ],

      // Fill in missing enrichment data
      company: primary.company || duplicates.find(d => d.company)?.company,
      title: primary.title || duplicates.find(d => d.title)?.title,
      phone: primary.phone || duplicates.find(d => d.phone)?.phone,
      linkedin_url: primary.linkedin_url || duplicates.find(d => d.linkedin_url)?.linkedin_url,

      // VIP/Favorite if any was
      is_vip: primary.is_vip || duplicates.some(d => d.is_vip),
      is_favorite: primary.is_favorite || duplicates.some(d => d.is_favorite),
    };

    // Update primary profile
    await supabase
      .from('relationship_profiles')
      .update(mergedData)
      .eq('id', primaryId);

    // Move interactions from duplicates to primary
    for (const duplicate of duplicates) {
      await supabase
        .from('contact_interactions')
        .update({ profile_id: primaryId })
        .eq('profile_id', duplicate.id);
    }

    // Mark duplicates as merged
    await supabase
      .from('relationship_profiles')
      .update({ is_merged: true })
      .in('id', duplicateIds);

    // Update duplicate_contacts status
    await supabase
      .from('duplicate_contacts')
      .update({
        status: 'merged',
        merged_into_id: primaryId,
        reviewed_at: new Date().toISOString()
      })
      .in('profile_id', duplicateIds);

    return true;
  } catch (error) {
    console.error('Error merging profiles:', error);
    return false;
  }
}

// ==================== AUTO-TAGGING ====================

/**
 * Suggest tags for a contact based on their data and interactions
 */
export async function suggestTags(userId: string, profileId: string): Promise<string[]> {
  const { data: profile } = await supabase
    .from('relationship_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single();

  if (!profile) return [];

  const suggestedTags: string[] = [];

  // Company-based tags
  if (profile.company) {
    const companyTag = profile.company.toLowerCase().replace(/[^a-z0-9]/g, '-');
    suggestedTags.push(companyTag);
  }

  // Role-based tags
  if (profile.title) {
    const title = profile.title.toLowerCase();
    if (title.includes('ceo') || title.includes('founder') || title.includes('president')) {
      suggestedTags.push('executive');
    } else if (title.includes('director') || title.includes('vp') || title.includes('head')) {
      suggestedTags.push('leadership');
    } else if (title.includes('manager')) {
      suggestedTags.push('management');
    } else if (title.includes('engineer') || title.includes('developer')) {
      suggestedTags.push('technical');
    } else if (title.includes('sales')) {
      suggestedTags.push('sales');
    } else if (title.includes('marketing')) {
      suggestedTags.push('marketing');
    }
  }

  // Engagement-based tags
  if (profile.relationship_score >= 80) {
    suggestedTags.push('high-engagement');
  } else if (profile.relationship_score <= 30) {
    suggestedTags.push('low-engagement');
  }

  // Frequency-based tags
  if (profile.communication_frequency === 'daily' || profile.communication_frequency === 'weekly') {
    suggestedTags.push('frequent-contact');
  }

  // Source-based tags
  if (profile.source === 'google_contacts') {
    suggestedTags.push('google-contact');
  }

  return [...new Set(suggestedTags)];
}

/**
 * Auto-tag all contacts for a user
 */
export async function autoTagAllContacts(userId: string): Promise<number> {
  const { data: profiles } = await supabase
    .from('relationship_profiles')
    .select('id, custom_tags')
    .eq('user_id', userId)
    .eq('is_merged', false);

  if (!profiles) return 0;

  let updated = 0;

  for (const profile of profiles) {
    const suggestions = await suggestTags(userId, profile.id);
    const existingTags = profile.custom_tags || [];
    const newTags = suggestions.filter(t => !existingTags.includes(t));

    if (newTags.length > 0) {
      await supabase
        .from('relationship_profiles')
        .update({
          custom_tags: [...existingTags, ...newTags]
        })
        .eq('id', profile.id);
      updated++;
    }
  }

  return updated;
}

// ==================== ENRICHMENT FROM EMAIL ====================

/**
 * Enrich a profile from email data
 */
export async function enrichFromEmail(
  userId: string,
  profileId: string,
  signatureText: string
): Promise<boolean> {
  const parsed = await parseEmailSignature(signatureText);

  if (parsed.confidence < 0.5) return false;

  const updates: any = {};

  if (parsed.name && !parsed.name.includes('@')) {
    updates.contact_name = parsed.name;
  }
  if (parsed.title) {
    updates.title = parsed.title;
  }
  if (parsed.company) {
    updates.company = parsed.company;
  }
  if (parsed.phone) {
    updates.phone = parsed.phone;
  }
  if (parsed.linkedin) {
    updates.linkedin_url = parsed.linkedin;
  }
  if (parsed.twitter) {
    updates.twitter_handle = parsed.twitter;
  }

  updates.extracted_signature = {
    ...parsed,
    extractedAt: new Date().toISOString()
  };

  if (Object.keys(updates).length === 1) return false; // Only has extracted_signature

  const { error } = await supabase
    .from('relationship_profiles')
    .update(updates)
    .eq('id', profileId)
    .eq('user_id', userId);

  return !error;
}

// Export service object
export const contactEnrichmentService = {
  parseEmailSignature,
  findDuplicates,
  mergeProfiles,
  suggestTags,
  autoTagAllContacts,
  enrichFromEmail,
};
