// src/services/emailCampaignService.ts
import { supabase } from './supabase';
import { getGmailService } from './gmailService';

export interface EmailCampaign {
  id: string;
  user_id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused';
  subject: string | null;
  subject_b: string | null;
  body_html: string | null;
  body_text: string | null;
  preview_text: string | null;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  segment_name: string;
  schedule_at: string | null;
  sent_at: string | null;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
  created_at: string;
  updated_at: string;
}

export type CampaignInput = Partial<
  Omit<EmailCampaign, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'stats'>
>;

class EmailCampaignService {
  private async getUserId(): Promise<string> {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Not authenticated');
    return user.id;
  }

  async list(): Promise<EmailCampaign[]> {
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as EmailCampaign[];
  }

  async getById(id: string): Promise<EmailCampaign> {
    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as EmailCampaign;
  }

  async create(input: CampaignInput = {}): Promise<EmailCampaign> {
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from('email_campaigns')
      .insert({
        user_id: userId,
        name: input.name ?? 'Untitled Campaign',
        status: 'draft',
        ...input,
      })
      .select()
      .single();

    if (error) throw error;
    return data as EmailCampaign;
  }

  async update(id: string, input: CampaignInput): Promise<EmailCampaign> {
    const { data, error } = await supabase
      .from('email_campaigns')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as EmailCampaign;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('email_campaigns')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async duplicate(id: string): Promise<EmailCampaign> {
    const original = await this.getById(id);
    const { id: _id, user_id: _uid, created_at: _ca, updated_at: _ua, stats: _stats, sent_at: _sa, ...rest } = original;
    return this.create({
      ...rest,
      name: `Copy of ${original.name}`,
      status: 'draft',
      schedule_at: null,
    });
  }

  /**
   * Send campaign immediately via Gmail API.
   * recipientEmails: list of address strings to send to.
   */
  async send(id: string, recipientEmails: string[]): Promise<void> {
    if (recipientEmails.length === 0) throw new Error('No recipients specified');

    const campaign = await this.getById(id);
    if (!campaign.subject) throw new Error('Campaign has no subject line');
    if (!campaign.body_html && !campaign.body_text)
      throw new Error('Campaign has no body content');

    await this.update(id, { status: 'sending' });

    try {
      const gmail = getGmailService();
      let sent = 0;

      for (const email of recipientEmails) {
        await gmail.sendEmail({
          to: [email],
          subject: campaign.subject,
          body: campaign.body_html ?? campaign.body_text ?? '',
          isHtml: !!campaign.body_html,
        });
        sent++;
      }

      await this.update(id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      await supabase
        .from('email_campaigns')
        .update({
          stats: {
            sent,
            delivered: sent,
            opened: 0,
            clicked: 0,
            bounced: 0,
            unsubscribed: 0,
          },
        })
        .eq('id', id);
    } catch (error) {
      // Rollback to draft on failure
      await this.update(id, { status: 'draft' });
      throw error;
    }
  }

  async schedule(id: string, scheduleAt: Date): Promise<EmailCampaign> {
    return this.update(id, {
      status: 'scheduled',
      schedule_at: scheduleAt.toISOString(),
    });
  }
}

export const emailCampaignService = new EmailCampaignService();
