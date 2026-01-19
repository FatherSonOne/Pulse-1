// src/services/messageAutoResponseService.ts
// Auto-Response Service for Message System
// Provides rule-based auto-responses with AI customization

import { supabase } from './supabase';
import { processWithModel } from './geminiService';
import { ChannelMessage } from '../types/messages';

// ==================== Types ====================

export interface AutoResponseRule {
  id: string;
  user_id: string;
  rule_type: 'smart_reply' | 'rule_based' | 'out_of_office' | 'template';
  enabled: boolean;
  trigger_conditions: TriggerConditions;
  response_template: string;
  ai_customize: boolean;
  priority: number;
  times_triggered: number;
  last_triggered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TriggerConditions {
  keywords?: string[];
  senders?: string[];
  channels?: string[];
  timeRange?: {
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
}

export interface AutoResponseLog {
  id: string;
  rule_id: string;
  message_id: string;
  channel_id: string;
  sender_id: string;
  response_sent: string;
  ai_customized: boolean;
  triggered_at: string;
}

// ==================== Rate Limiting ====================

const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_RESPONSES_PER_MINUTE = 10;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimiter.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimiter.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= MAX_RESPONSES_PER_MINUTE) {
    return false;
  }

  userLimit.count++;
  return true;
}

// ==================== Service Class ====================

class MessageAutoResponseService {
  /**
   * Check if any auto-response rules match the incoming message
   * Returns the generated response or null if no match
   */
  async checkAutoResponse(
    message: ChannelMessage,
    channelId: string,
    userId: string
  ): Promise<string | null> {
    try {
      // Check rate limiting
      if (!checkRateLimit(userId)) {
        console.warn(`[AutoResponse] Rate limit exceeded for user ${userId}`);
        return null;
      }

      // Get enabled rules sorted by priority
      const { data: rules, error } = await supabase
        .from('message_auto_responses')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .order('priority', { ascending: false });

      if (error) {
        console.error('[AutoResponse] Error fetching rules:', error);
        return null;
      }

      if (!rules || rules.length === 0) {
        return null;
      }

      // Check each rule in priority order
      for (const rule of rules) {
        if (await this.matchesRule(message, channelId, rule as AutoResponseRule)) {
          const response = await this.generateResponse(message, rule as AutoResponseRule);

          if (response) {
            // Log the trigger
            await this.logResponse(rule.id, message, response, rule.ai_customize);
            return response;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[AutoResponse] Error in checkAutoResponse:', error);
      return null;
    }
  }

  /**
   * Check if a message matches a rule's trigger conditions
   */
  private async matchesRule(
    message: ChannelMessage,
    channelId: string,
    rule: AutoResponseRule
  ): Promise<boolean> {
    const conditions = rule.trigger_conditions;

    // Check time range (for out-of-office)
    if (conditions.timeRange) {
      if (!this.isWithinTimeRange(conditions.timeRange)) {
        return false;
      }
    }

    // Check keywords
    if (conditions.keywords && conditions.keywords.length > 0) {
      const content = message.content.toLowerCase();
      const hasKeyword = conditions.keywords.some((keyword) =>
        content.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }

    // Check senders
    if (conditions.senders && conditions.senders.length > 0) {
      if (!conditions.senders.includes(message.sender_id)) {
        return false;
      }
    }

    // Check channels
    if (conditions.channels && conditions.channels.length > 0) {
      if (!conditions.channels.includes(channelId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if current time is within the specified range
   */
  private isWithinTimeRange(timeRange: { start: string; end: string }): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHours, startMinutes] = timeRange.start.split(':').map(Number);
    const [endHours, endMinutes] = timeRange.end.split(':').map(Number);

    const startTime = startHours * 60 + startMinutes;
    const endTime = endHours * 60 + endMinutes;

    // Handle overnight ranges (e.g., 18:00 to 09:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    }

    return currentTime >= startTime && currentTime < endTime;
  }

  /**
   * Generate response from template with optional AI customization
   */
  private async generateResponse(
    message: ChannelMessage,
    rule: AutoResponseRule
  ): Promise<string | null> {
    try {
      let response = rule.response_template;

      // AI customization if enabled
      if (rule.ai_customize) {
        const apiKey = await this.getApiKey();
        if (apiKey) {
          const customized = await this.customizeWithAI(message, response, apiKey);
          if (customized) {
            response = customized;
          }
        }
      }

      // Variable substitution
      response = this.substituteVariables(response, message);

      return response;
    } catch (error) {
      console.error('[AutoResponse] Error generating response:', error);
      return rule.response_template; // Fallback to template
    }
  }

  /**
   * Use AI to customize the response based on message context
   */
  private async customizeWithAI(
    message: ChannelMessage,
    template: string,
    apiKey: string
  ): Promise<string | null> {
    try {
      const prompt = `Customize this auto-response template to make it more personal and contextual.

Incoming Message: "${message.content}"
Sender: ${message.sender_name || 'Unknown'}
Response Template: "${template}"

Instructions:
1. Keep the same general meaning as the template
2. Make it feel personal and contextual, not automated
3. Keep it concise (1-2 sentences maximum)
4. Match the tone of the incoming message
5. Return ONLY the customized response text, nothing else

Customized Response:`;

      const customized = await processWithModel(apiKey, prompt, 'gemini-2.5-flash-lite');

      if (customized && customized.length > 0 && customized.length < 500) {
        return customized.trim();
      }

      return null;
    } catch (error) {
      console.error('[AutoResponse] AI customization failed:', error);
      return null;
    }
  }

  /**
   * Substitute variables in template
   */
  private substituteVariables(template: string, message: ChannelMessage): string {
    const now = new Date();

    return template
      .replace(/{sender_name}/g, message.sender_name || 'there')
      .replace(/{date}/g, now.toLocaleDateString())
      .replace(/{time}/g, now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      .replace(/{day}/g, now.toLocaleDateString('en-US', { weekday: 'long' }));
  }

  /**
   * Get Gemini API key from localStorage
   */
  private async getApiKey(): Promise<string | null> {
    try {
      const apiKey = localStorage.getItem('gemini_api_key');
      return apiKey || null;
    } catch {
      return null;
    }
  }

  /**
   * Log auto-response trigger
   */
  private async logResponse(
    ruleId: string,
    message: ChannelMessage,
    response: string,
    aiCustomized: boolean
  ): Promise<void> {
    try {
      await supabase.from('message_auto_response_log').insert({
        rule_id: ruleId,
        message_id: message.id,
        channel_id: message.channel_id,
        sender_id: message.sender_id,
        response_sent: response,
        ai_customized: aiCustomized,
      });
    } catch (error) {
      console.error('[AutoResponse] Error logging response:', error);
      // Non-critical, don't throw
    }
  }

  // ==================== Rule Management ====================

  /**
   * Get all auto-response rules for a user
   */
  async getRules(userId: string): Promise<AutoResponseRule[]> {
    const { data, error } = await supabase
      .from('message_auto_responses')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: false });

    if (error) {
      console.error('[AutoResponse] Error fetching rules:', error);
      return [];
    }

    return (data as AutoResponseRule[]) || [];
  }

  /**
   * Create a new auto-response rule
   */
  async createRule(
    userId: string,
    ruleData: Omit<AutoResponseRule, 'id' | 'user_id' | 'times_triggered' | 'created_at' | 'updated_at' | 'last_triggered_at'>
  ): Promise<AutoResponseRule | null> {
    try {
      const { data, error } = await supabase
        .from('message_auto_responses')
        .insert({
          user_id: userId,
          ...ruleData,
        })
        .select()
        .single();

      if (error) throw error;
      return data as AutoResponseRule;
    } catch (error) {
      console.error('[AutoResponse] Error creating rule:', error);
      return null;
    }
  }

  /**
   * Update an existing rule
   */
  async updateRule(
    ruleId: string,
    updates: Partial<Omit<AutoResponseRule, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<AutoResponseRule | null> {
    try {
      const { data, error } = await supabase
        .from('message_auto_responses')
        .update(updates)
        .eq('id', ruleId)
        .select()
        .single();

      if (error) throw error;
      return data as AutoResponseRule;
    } catch (error) {
      console.error('[AutoResponse] Error updating rule:', error);
      return null;
    }
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('message_auto_responses')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[AutoResponse] Error deleting rule:', error);
      return false;
    }
  }

  /**
   * Toggle rule enabled status
   */
  async toggleRule(ruleId: string, enabled: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('message_auto_responses')
        .update({ enabled })
        .eq('id', ruleId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[AutoResponse] Error toggling rule:', error);
      return false;
    }
  }

  /**
   * Get auto-response analytics
   */
  async getAnalytics(userId: string, days: number = 30): Promise<{
    totalResponses: number;
    responsesByRule: Record<string, number>;
    aiCustomizationRate: number;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get rules for user
      const { data: rules } = await supabase
        .from('message_auto_responses')
        .select('id')
        .eq('user_id', userId);

      if (!rules || rules.length === 0) {
        return { totalResponses: 0, responsesByRule: {}, aiCustomizationRate: 0 };
      }

      const ruleIds = rules.map((r) => r.id);

      // Get logs
      const { data: logs } = await supabase
        .from('message_auto_response_log')
        .select('rule_id, ai_customized')
        .in('rule_id', ruleIds)
        .gte('triggered_at', startDate.toISOString());

      if (!logs || logs.length === 0) {
        return { totalResponses: 0, responsesByRule: {}, aiCustomizationRate: 0 };
      }

      const responsesByRule: Record<string, number> = {};
      let aiCustomizedCount = 0;

      for (const log of logs) {
        responsesByRule[log.rule_id] = (responsesByRule[log.rule_id] || 0) + 1;
        if (log.ai_customized) {
          aiCustomizedCount++;
        }
      }

      return {
        totalResponses: logs.length,
        responsesByRule,
        aiCustomizationRate: logs.length > 0 ? aiCustomizedCount / logs.length : 0,
      };
    } catch (error) {
      console.error('[AutoResponse] Error fetching analytics:', error);
      return { totalResponses: 0, responsesByRule: {}, aiCustomizationRate: 0 };
    }
  }
}

// Export singleton instance
export const messageAutoResponseService = new MessageAutoResponseService();
export default messageAutoResponseService;
