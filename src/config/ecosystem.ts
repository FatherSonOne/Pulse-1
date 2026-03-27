// =====================================================
// ECOSYSTEM BRIDGE — Canonical App Registry
// Single source of truth for all three app URLs and metadata.
// Update this file if any Supabase project URL changes.
// =====================================================

export const ECOSYSTEM_APPS = {
  pulse: {
    name: 'Pulse',
    tagline: 'Team communications',
    brandColor: '#f43f5e',
    inboundUrl: 'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-inbound',
    botUrl:     'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-bot',
    isCurrentApp: true,
  },
  entomate: {
    name: 'Entomate',
    tagline: 'Meeting intelligence & automation',
    brandColor: '#FF2D6B',
    inboundUrl: 'https://epftmicjaxrthmpyoguy.supabase.co/functions/v1/ecosystem-inbound',
    botUrl:     null,
    isCurrentApp: false,
  },
  logos_vision: {
    name: 'Logos Vision',
    tagline: 'Nonprofit CRM',
    brandColor: '#0dcfba',
    inboundUrl: 'https://psjgmdnrehcwvppbeqjy.supabase.co/functions/v1/ecosystem-inbound',
    botUrl:     null,
    isCurrentApp: false,
  },
} as const;

/** Display order: Pulse (current app) first */
export const ECOSYSTEM_APP_ORDER: EcosystemAppName[] = ['pulse', 'entomate', 'logos_vision'];

export type EcosystemAppName = keyof typeof ECOSYSTEM_APPS;

/** Returns the inbound URL for a given app — what THIS app calls to send events TO that app */
export function getInboundUrl(app: EcosystemAppName): string {
  return ECOSYSTEM_APPS[app].inboundUrl;
}

/** The URL other apps use to reach Pulse's ecosystem-inbound */
export const PULSE_INBOUND_URL = ECOSYSTEM_APPS.pulse.inboundUrl;
