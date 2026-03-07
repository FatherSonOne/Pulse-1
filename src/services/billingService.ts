// billingService.ts — User subscription and billing queries
import { supabase } from './supabase';

export interface UserPlan {
  planId: string;
  planName: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  currentPeriodEnd: string | null;
}

const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  individual: 'Individual',
  pro: 'Pro',
  team: 'Team',
  enterprise: 'Enterprise',
};

const billingService = {
  async getCurrentPlan(): Promise<UserPlan> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return billingService._defaultPlan();

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('plan_id, status, current_period_end')
        .eq('user_id', user.id)
        .single();

      if (error || !data) return billingService._defaultPlan();

      return {
        planId: data.plan_id,
        planName: PLAN_NAMES[data.plan_id] || data.plan_id,
        status: data.status as UserPlan['status'],
        currentPeriodEnd: data.current_period_end,
      };
    } catch {
      return billingService._defaultPlan();
    }
  },

  _defaultPlan(): UserPlan {
    return { planId: 'free', planName: 'Free', status: 'active', currentPeriodEnd: null };
  },

  getUpgradeUrl(): string {
    // Replace with Stripe customer portal URL or billing page when available
    return '/billing';
  },
};

export default billingService;
