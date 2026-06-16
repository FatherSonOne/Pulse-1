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

      {/* MapLibre renderer on/off. OFF (default) → the Map section uses the
          existing Google renderer. ON → the Map renders with the new MapLibre
          engine (parity with Google across every overlay). Requires Experimental
          Features on to reach the Map. Mirror of the ?ff_mapLibreRenderer dev
          override, but per-browser via Settings instead of a URL param.
          NOTE: a non-Google base map showing Google-geocoded pins/routes is a
          Google ToS issue — keep this for testing until the geocode/directions
          data layer moves off Google. See the P3–P5 handoff (⛔ THE LEGAL GATE). */}
      <SettingsCard>
        <ToggleItem
          label="MapLibre Map Renderer (Beta)"
          desc="When on, the Map section renders with the new MapLibre engine instead of Google Maps (light theme only for now). Requires Experimental Features on to open the Map. Off keeps the existing Google map. For testing & development."
          active={features.mapLibreRenderer}
          onToggle={() => toggleFeature('mapLibreRenderer')}
        />
      </SettingsCard>

      {/* Map "Horizon" redesign (Direction D) on/off. ON by default since
          2026-06-16 (P13 graduation) → the Map uses the Horizon UX (time-horizon
          scrubber + Atlas mode, base-style switch, neutral chrome, Live/Geofences
          drawers). Turn OFF to fall back to the classic Map (TODAY/WEEK/ATLAS tabs,
          Sat/Terr/Hybrid picker). Rides the MapLibre branch.
          See docs/MAP_HORIZON_REDESIGN_HANDOFF_2026-06-15.md (P0–P13). */}
      <SettingsCard>
        <ToggleItem
          label="Map Horizon Redesign"
          desc="On by default. The Map uses the Horizon UX: a time-horizon scrubber + Atlas mode, base-style switch, and Live/Geofences drawers. Turn off to use the classic Map (TODAY/WEEK/ATLAS tabs + Sat/Terr/Hybrid picker)."
          active={features.mapHorizon}
          onToggle={() => toggleFeature('mapHorizon')}
        />
      </SettingsCard>

      {/* Map "Horizon" Floating Chrome (Tier-3 §8B rebuild). ON by default since
          2026-06-16 (F6 graduation) → the Map chrome is floating glass islands over
          a full-bleed map (Direction-D: scrubber pill, AI card, Routes/Live/Fences
          surfaces cluster). Turn OFF to fall back to the stacked-band Horizon chrome.
          Double-gated on Map Horizon Redesign. */}
      <SettingsCard>
        <ToggleItem
          label="Map Horizon — Floating Chrome"
          desc="On by default. The Map chrome floats as glass islands over a full-bleed map (scrubber pill, AI card, Routes/Live/Fences cluster). Requires Map Horizon Redesign on. Turn off to use the stacked-band Map chrome."
          active={features.mapHorizonFloat}
          onToggle={() => toggleFeature('mapHorizonFloat')}
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
