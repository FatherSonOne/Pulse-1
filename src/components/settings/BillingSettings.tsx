import React, { useState, useEffect } from 'react';
import billingService, { type UserPlan } from '../../services/billingService';

export const BillingSettings: React.FC = () => {
  const [currentPlan, setCurrentPlan] = useState<UserPlan | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    setBillingLoading(true);
    billingService.getCurrentPlan()
      .then(plan => { setCurrentPlan(plan); setBillingLoading(false); })
      .catch(() => setBillingLoading(false));
  }, []);

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3>
          {/* Receipt / billing SVG */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--set-primary)' }}>
            <path d="M4 2h16a1 1 0 0 1 1 1v18l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 0 1 1-1z"/>
            <line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/>
          </svg>
          Plan &amp; Billing
        </h3>
        <p>Manage your subscription and team settings.</p>
      </div>

      {/* Current Plan Banner */}
      <div style={{ background: 'linear-gradient(135deg, var(--set-primary-softer), rgba(236,72,153,0.04))', border: '1px solid var(--set-primary-soft)', borderLeft: '3px solid var(--set-primary)' }} className="rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-5">
          {/* User / plan icon */}
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/25 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xl font-bold dark:text-white text-zinc-900">
                {billingLoading ? 'Loading...' : (currentPlan?.planName || 'Free')} Plan
              </h4>
              <span className="px-2 py-0.5 text-white text-xs font-bold rounded-full" style={{ background: 'var(--set-primary)', fontSize: '10px', letterSpacing: '0.06em' }}>ACTIVE</span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--set-text-muted)' }}>
              {currentPlan?.currentPeriodEnd
                ? `Renews ${new Date(currentPlan.currentPeriodEnd).toLocaleDateString()}`
                : 'Free forever for personal use'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {['Unlimited conversations', 'Voice & video calls', 'AI-powered inbox', 'Email & calendar sync'].map((feat) => (
            <div key={feat} className="flex items-center gap-2" style={{ color: 'var(--set-text-secondary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--set-primary)', flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>{feat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team Plan — blue/cyan */}
        <div className="rounded-2xl p-6 cursor-default" style={{ background: 'var(--set-surface)', border: '1px solid var(--set-border)', borderLeft: '2px solid transparent', transition: 'all 150ms cubic-bezier(0.16,1,0.3,1)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = '#3b82f6'; (e.currentTarget as HTMLElement).style.background = 'var(--set-surface-raised)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(59,130,246,0.12)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent'; (e.currentTarget as HTMLElement).style.background = 'var(--set-surface)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', boxShadow: '0 4px 12px rgba(59,130,246,0.30)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="3"/><path d="M3 20c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5"/>
                <circle cx="17" cy="7" r="3"/><path d="M21 20c0-3-2.7-5.5-6-5.5"/>
              </svg>
            </div>
            <div>
              <h4 className="text-base font-semibold" style={{ color: 'var(--set-text-main)', letterSpacing: '-0.01em' }}>Team</h4>
              <p className="text-xs mt-0.5" style={{ color: 'var(--set-text-muted)' }}>Up to 10 members</p>
            </div>
          </div>

          <p className="text-sm mb-4" style={{ color: 'var(--set-text-secondary)', lineHeight: '1.6' }}>
            Perfect for small teams who want to collaborate with shared context.
          </p>

          <div className="space-y-2 mb-6">
            {['Everything in Individual', 'Shared team database', 'Team knowledge base', 'Shared conversation history', 'Document collaboration', 'Team analytics dashboard'].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-sm" style={{ color: 'var(--set-text-secondary)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: '#3b82f6', flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>{feat}</span>
              </div>
            ))}
          </div>

          <button onClick={() => window.open(billingService.getUpgradeUrl())} className="w-full py-3 px-4 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', boxShadow: '0 4px 12px rgba(59,130,246,0.30)', fontSize: '14px' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(59,130,246,0.42)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(59,130,246,0.30)'; }}
          >
            <span>Learn More</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>

        {/* Enterprise Plan — purple/violet */}
        <div className="rounded-2xl p-6 cursor-default relative overflow-hidden" style={{ background: 'var(--set-surface)', border: '1px solid var(--set-border)', borderLeft: '2px solid transparent', transition: 'all 150ms cubic-bezier(0.16,1,0.3,1)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = '#8b5cf6'; (e.currentTarget as HTMLElement).style.background = 'var(--set-surface-raised)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(139,92,246,0.12)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent'; (e.currentTarget as HTMLElement).style.background = 'var(--set-surface)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
        >
          {/* Dot-grid decoration */}
          <div aria-hidden style={{ position: 'absolute', top: 0, right: 0, width: 160, height: '100%', backgroundImage: 'radial-gradient(circle, rgba(139,92,246,0.08) 1px, transparent 1px)', backgroundSize: '14px 14px', opacity: 0.7, pointerEvents: 'none' }} />

          <div className="flex items-center gap-3 mb-4 relative">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', boxShadow: '0 4px 12px rgba(124,58,237,0.35)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="9" width="13" height="13" rx="1"/><path d="M8 22V9"/><path d="M16 9V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v5"/>
                <rect x="16" y="13" width="5" height="9" rx="1"/><line x1="10" y1="13" x2="10" y2="13.01"/><line x1="13" y1="13" x2="13" y2="13.01"/><line x1="10" y1="17" x2="10" y2="17.01"/><line x1="13" y1="17" x2="13" y2="17.01"/>
              </svg>
            </div>
            <div>
              <h4 className="text-base font-semibold relative" style={{ color: 'var(--set-text-main)', letterSpacing: '-0.01em' }}>Enterprise</h4>
              <p className="text-xs mt-0.5" style={{ color: 'var(--set-text-muted)' }}>10+ members</p>
            </div>
          </div>

          <p className="text-sm mb-4 relative" style={{ color: 'var(--set-text-secondary)', lineHeight: '1.6' }}>
            For larger organizations with advanced security and customization needs.
          </p>

          <div className="space-y-2 mb-6 relative">
            {['Everything in Team', 'Unlimited team members', 'SSO & advanced security', 'Custom integrations', 'Dedicated support', 'On-premise deployment option'].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-sm" style={{ color: 'var(--set-text-secondary)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: '#8b5cf6', flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>{feat}</span>
              </div>
            ))}
          </div>

          <button onClick={() => window.open(billingService.getUpgradeUrl())} className="w-full py-3 px-4 text-white font-semibold rounded-xl flex items-center justify-center gap-2 relative transition-all" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', boxShadow: '0 4px 12px rgba(124,58,237,0.30)', fontSize: '14px' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(124,58,237,0.42)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(124,58,237,0.30)'; }}
          >
            <span>Contact Sales</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>

      {/* Billing Info */}
      <div className="rounded-xl p-6" style={{ background: 'var(--set-surface)', border: '1px solid var(--set-border)' }}>
        <h4 className="mb-4" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--set-text-muted)' }}>Billing Information</h4>
        {[
          { label: 'Current Plan', value: currentPlan?.planName ? `${currentPlan.planName}` : 'Individual (Free)', isLast: false },
          { label: 'Billing Cycle', value: currentPlan?.billingInterval || 'N/A', isLast: false },
          { label: 'Next Invoice', value: currentPlan?.currentPeriodEnd ? new Date(currentPlan.currentPeriodEnd).toLocaleDateString() : 'N/A', isLast: true },
        ].map(({ label, value, isLast }) => (
          <div key={label} className="flex items-center justify-between py-3" style={{ borderBottom: isLast ? 'none' : '1px solid var(--set-border)' }}>
            <span className="text-sm" style={{ color: 'var(--set-text-secondary)' }}>{label}</span>
            <span className="text-sm font-medium" style={{ color: 'var(--set-text-main)' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
