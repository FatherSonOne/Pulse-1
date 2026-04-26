import React, { useState } from 'react';
import type { User } from '../../types';
import { Plug } from 'lucide-react';

import { SyncPreferences } from './integrations/SyncPreferences';
import { GoogleServicesIntegration } from './integrations/GoogleServicesIntegration';
import { GmailIntegration } from './integrations/GmailIntegration';
import { SlackIntegration } from './integrations/SlackIntegration';
import { TwilioIntegration } from './integrations/TwilioIntegration';
import { MicrosoftIntegration } from './integrations/MicrosoftIntegration';
import { ComingSoonIntegrations } from './integrations/ComingSoonIntegrations';
import { OrgIntegrationsCard } from './integrations/OrgIntegrationsCard';
import { MemberConnectionsCard } from './integrations/MemberConnectionsCard';

interface IntegrationsSettingsProps {
  user?: User | null;
  userId: string;
}

export const IntegrationsSettings: React.FC<IntegrationsSettingsProps> = ({ user, userId }) => {
  // Slack channels are shared between SyncPreferences and SlackIntegration
  const [slackChannels, setSlackChannels] = useState<Array<{ id: string; name: string }>>([]);

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3>
          <Plug /> Platform Integrations
        </h3>
        <p>
          Connect your accounts to sync data across all your platforms. Messages, calendars, and contacts will be unified in one place.
        </p>
      </div>

      <OrgIntegrationsCard />

      <MemberConnectionsCard />

      <SyncPreferences slackChannels={slackChannels} />

      <GoogleServicesIntegration user={user} />

      <GmailIntegration user={user} />

      {/* ==================== OTHER INTEGRATIONS SECTION ==================== */}
      <div className="section-header" style={{ marginTop: '48px' }}>
        <h3>
          <Plug /> Other Integrations
        </h3>
        <p>
          Connect additional platforms to aggregate all your messages in one unified inbox.
        </p>
      </div>

      <SlackIntegration user={user} slackChannels={slackChannels} setSlackChannels={setSlackChannels} />

      <TwilioIntegration user={user} />

      <MicrosoftIntegration user={user} />

      <ComingSoonIntegrations />
    </div>
  );
};
