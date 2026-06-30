import React, { useEffect, useRef } from 'react';
import { FEATURE_CLUSTERS, CLUSTER_ACCENTS, type JourneyFeature } from '../landingData';

// Desktop breadcrumb spine: clusters 01–04 as groups, features as rows with a
// dot + a left progress connector that fills (in each cluster's accent) as you
// move through the journey. Clicking a row jumps to that feature.

interface FeatureSpineProps {
  features: JourneyFeature[];
  activeIndex: number;
  onJump: (index: number) => void;
}

const FeatureSpine: React.FC<FeatureSpineProps> = ({ features, activeIndex, onJump }) => {
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the active row visible within the (scrollable) spine.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const activeCluster = features[activeIndex]?.cluster;

  return (
    <nav className="fj-spine" aria-label="Feature navigation">
      <div className="fj-spine-eyebrow">Everything Pulse does</div>
      {FEATURE_CLUSTERS.map(cl => {
        const accent = CLUSTER_ACCENTS[cl.key];
        const rows = features
          .map((f, idx) => ({ f, idx }))
          .filter(x => x.f.cluster === cl.key);
        return (
          <div
            key={cl.key}
            className={`fj-sg${activeCluster === cl.key ? ' fj-active' : ''}`}
            style={{ ['--sg-accent' as string]: accent.accent }}
          >
            <div className="fj-sg-head"><span className="fj-n">{accent.num}</span>{cl.label}</div>
            {rows.map(({ f, idx }) => {
              const state = idx === activeIndex ? ' fj-cur' : idx < activeIndex ? ' fj-done' : '';
              return (
                <button
                  key={f.id}
                  type="button"
                  ref={idx === activeIndex ? activeRef : undefined}
                  className={`fj-sf${state}`}
                  style={{ ['--sf-accent' as string]: accent.accent }}
                  aria-current={idx === activeIndex ? 'true' : undefined}
                  onClick={() => onJump(idx)}
                >
                  <span className="fj-sdot" />{f.eyebrow}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
};

export default FeatureSpine;
