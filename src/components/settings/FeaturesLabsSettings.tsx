import React from 'react';
import { FlaskConical } from 'lucide-react';
import { useFeatures, FEATURE_CATEGORIES, FEATURE_NAMES, FEATURE_DESCRIPTIONS } from '../../contexts/FeatureContext';
import { ToggleItem } from './shared/ToggleItem';
import { SettingsCard } from './shared/SettingsCard';
import { MonoLabel } from './shared/MonoLabel';

export const FeaturesLabsSettings: React.FC = () => {
  const { features, toggleFeature } = useFeatures();

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3><FlaskConical /> Features &amp; Labs</h3>
        <p>Enable or disable individual features. Changes apply immediately.</p>
      </div>

      {/* Experimental section on/off (sidebar: Summit / Map / War Room). When
          off, the section shows a red "features disabled" note and its items are
          greyed out + non-clickable. */}
      <SettingsCard>
        <ToggleItem
          label="Experimental Features"
          desc="When off, the Experimental section in the sidebar shows “features disabled” and its items (Summit, Map, War Room) are greyed out. Turn on for testing & development."
          active={features.experimentalEnabled}
          onToggle={() => toggleFeature('experimentalEnabled')}
        />
      </SettingsCard>

      {/* Email section on/off. OFF (default) shows a red "feature not available"
          caption under Email in the sidebar and disables all Gmail fetch/token
          use. Turn ON for testing/development. */}
      <SettingsCard>
        <ToggleItem
          label="Email Section"
          desc="When off, the Email tab shows “feature not available” and Gmail syncing/token access is disabled. Turn on for testing & development."
          active={features.emailEnabled}
          onToggle={() => toggleFeature('emailEnabled')}
        />
      </SettingsCard>

      {/* Slack Send (Phase 8) on/off. OFF (default) → the ChannelRow Slack button
          stays disabled even for a linked contact. ON → an inline DM composer in
          the People → Focus column. Needs a connected Slack bot token (chat:write)
          + a contact with a resolved slack_user_id. */}
      <SettingsCard>
        <ToggleItem
          label="Slack Send (Beta)"
          desc="When on, you can DM a linked contact on Slack from the People → Focus column. Needs a connected Slack bot token with chat:write / users:read.email (Settings → Integrations → Slack). Off keeps the Slack channel disabled. Messages post as the Pulse bot."
          active={features.slackSend}
          onToggle={() => toggleFeature('slackSend')}
        />
      </SettingsCard>

      {/* Feature categories */}
      {Object.entries(FEATURE_CATEGORIES).map(([catKey, cat]) => (
        <SettingsCard key={catKey} className="space-y-4">
          <div>
            <MonoLabel>{cat.name}</MonoLabel>
            <p className="text-xs text-zinc-400 mt-0.5">{cat.description}</p>
          </div>
          <div className="space-y-3">
            {cat.features.map((featureId) => (
              <ToggleItem
                key={featureId}
                label={FEATURE_NAMES[featureId] || featureId}
                desc={FEATURE_DESCRIPTIONS[featureId] || ''}
                active={features[featureId]}
                onToggle={() => toggleFeature(featureId)}
              />
            ))}
          </div>
        </SettingsCard>
      ))}
    </div>
  );
};
