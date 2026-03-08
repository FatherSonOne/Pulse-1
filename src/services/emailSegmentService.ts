// src/services/emailSegmentService.ts
import { supabase } from './supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SegmentRuleType =
  | 'all'
  | 'last_contacted_days'
  | 'relationship_strength_min'
  | 'is_important';

export interface SegmentRule {
  type: SegmentRuleType;
  value?: number; // days (last_contacted_days) or 0–100 (relationship_strength_min)
}

export interface EmailSegment {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  filter_rules: SegmentRule[];
  contact_count: number;
  created_at: string;
  updated_at: string;
}

export type SegmentInput = Pick<EmailSegment, 'name' | 'filter_rules'> & {
  description?: string | null;
};

// ─── Default segments seeded on first access ─────────────────────────────────

const DEFAULT_SEGMENTS: SegmentInput[] = [
  { name: 'All Contacts',       filter_rules: [{ type: 'all' }],                               description: 'Every contact you have emailed' },
  { name: 'Recent (30 days)',   filter_rules: [{ type: 'last_contacted_days', value: 30 }],     description: 'Contacts active in the last 30 days' },
  { name: 'VIP Contacts',       filter_rules: [{ type: 'relationship_strength_min', value: 75 }], description: 'Relationship strength ≥ 75' },
  { name: 'Important Contacts', filter_rules: [{ type: 'is_important' }],                       description: 'Contacts marked as Important' },
];

// ─── Service ─────────────────────────────────────────────────────────────────

class EmailSegmentService {
  private segmentCache: { data: EmailSegment[]; expires: number } | null = null;
  private readonly CACHE_TTL = 60_000; // 60 seconds

  invalidateCache(): void {
    this.segmentCache = null;
  }

  private async getUserId(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Not authenticated');
    return user.id;
  }

  /** List user's segments, seeding 4 defaults if none exist yet. */
  async list(): Promise<EmailSegment[]> {
    const userId = await this.getUserId();

    if (this.segmentCache && Date.now() < this.segmentCache.expires) {
      return this.segmentCache.data;
    }

    const { data, error } = await supabase
      .from('email_segments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const result = (data && data.length > 0)
      ? data as EmailSegment[]
      : await this.seedDefaults(userId);
    this.segmentCache = { data: result, expires: Date.now() + this.CACHE_TTL };
    return result;
  }

  private async seedDefaults(userId: string): Promise<EmailSegment[]> {
    const rows = DEFAULT_SEGMENTS.map((s) => ({
      user_id: userId,
      name: s.name,
      description: s.description ?? null,
      filter_rules: s.filter_rules,
    }));
    const { data, error } = await supabase
      .from('email_segments')
      .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true })
      .select();
    if (error) throw error;
    return (data ?? []) as EmailSegment[];
  }

  async getById(id: string): Promise<EmailSegment> {
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from('email_segments')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data as EmailSegment;
  }

  async create(input: SegmentInput): Promise<EmailSegment> {
    this.invalidateCache();
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from('email_segments')
      .insert({ user_id: userId, ...input })
      .select()
      .single();
    if (error) throw error;
    return data as EmailSegment;
  }

  async update(id: string, input: Partial<SegmentInput>): Promise<EmailSegment> {
    this.invalidateCache();
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from('email_segments')
      .update(input)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as EmailSegment;
  }

  async delete(id: string): Promise<void> {
    this.invalidateCache();
    const userId = await this.getUserId();
    const { error } = await supabase
      .from('email_segments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  }

  /**
   * Resolve a segment's filter_rules to a list of matching contact email addresses.
   * Always excludes is_blocked=true contacts.
   */
  async resolveRecipients(segmentId: string): Promise<string[]> {
    const userId = await this.getUserId();
    const segment = await this.getById(segmentId);
    return this.applyRules(userId, segment.filter_rules);
  }

  /** Update the cached contact_count on a segment. */
  async refreshCount(segmentId: string): Promise<number> {
    this.invalidateCache();
    const userId = await this.getUserId();
    const segment = await this.getById(segmentId);
    const emails = await this.applyRules(userId, segment.filter_rules);
    const count = emails.length;
    const { error: updateError } = await supabase
      .from('email_segments')
      .update({ contact_count: count })
      .eq('id', segmentId)
      .eq('user_id', userId);
    if (updateError) {
      console.warn('[emailSegmentService] Failed to persist contact_count:', updateError);
    }
    return count;
  }

  /**
   * Evaluate rules against email_contacts for a given userId.
   * Public so SegmentBuilder can call it for live previews before saving.
   */
  async applyRules(userId: string, rules: SegmentRule[]): Promise<string[]> {
    const safeRules = rules ?? [];
    const hasAllRule = safeRules.length === 0 || safeRules.some((r) => r.type === 'all');

    let query = supabase
      .from('email_contacts')
      .select('email')
      .eq('user_id', userId)
      .eq('is_blocked', false);

    if (!hasAllRule) {
      for (const rule of safeRules) {
        if (rule.type === 'last_contacted_days' && rule.value != null) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - rule.value);
          query = query.gte('last_contacted_at', cutoff.toISOString());
        } else if (rule.type === 'relationship_strength_min' && rule.value != null) {
          query = query.gte('relationship_strength', rule.value);
        } else if (rule.type === 'is_important') {
          query = query.eq('is_important', true);
        }
      }
    }

    const { data, error } = await query.limit(1000);
    if (error) throw error;
    return (data ?? []).map((row: { email: string }) => row.email).filter(Boolean);
  }
}

export const emailSegmentService = new EmailSegmentService();
