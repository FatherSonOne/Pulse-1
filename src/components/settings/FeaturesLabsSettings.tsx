import React from 'react';
import { FlaskConical } from 'lucide-react';
import { useFeatures, FEATURE_CATEGORIES, FEATURE_NAMES } from '../../contexts/FeatureContext';
import { ToggleItem } from './shared/ToggleItem';

export const FeaturesLabsSettings: React.FC = () => {
  const { features, toggleFeature, advancedMode, setAdvancedMode } = useFeatures();

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3><FlaskConical /> Features &amp; Labs</h3>
        <p>Enable or disable individual features. Changes apply immediately.</p>
      </div>

      {/* Advanced Mode Master Toggle */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <ToggleItem
          label="Advanced Mode"
          desc="Unlock all advanced and experimental features at once"
          active={advancedMode}
          onToggle={() => setAdvancedMode(!advancedMode)}
        />
      </div>

      {/* Feature categories */}
      {Object.entries(FEATURE_CATEGORIES).map(([catKey, cat]) => (
        <div key={catKey} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500">{cat.name}</h4>
            <p className="text-xs text-zinc-400 mt-0.5">{cat.description}</p>
          </div>
          <div className="space-y-3">
            {cat.features.map((featureId) => (
              <ToggleItem
                key={featureId}
                label={FEATURE_NAMES[featureId] || featureId}
                desc=""
                active={features[featureId]}
                onToggle={() => toggleFeature(featureId)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
