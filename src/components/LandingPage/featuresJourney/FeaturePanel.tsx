import React from 'react';
import type { JourneyFeature } from '../landingData';
import FeatureVisual from './featureVisuals';
import OriginalVisual, { ORIGINAL_VISUAL_IDS } from './originalVisuals';

// One feature, re-housed into a one-viewport composition: copy column + signature
// visual. Shared by the desktop journey, the mobile carousel, and the reduced-
// motion stack so copy/visuals are never duplicated.

interface FeaturePanelProps {
  feature: JourneyFeature;
  /** Heading ref target so spine/keyboard focus can land on the title. */
  headingId?: string;
}

const FeaturePanel: React.FC<FeaturePanelProps> = ({ feature, headingId }) => (
  <>
    <div className="fj-copy">
      <span className="fj-eyebrow"><span className="fj-d" />{feature.eyebrow}</span>
      <h2 className="fj-title" id={headingId} tabIndex={-1}>{feature.title}</h2>
      <p className="fj-blurb">{feature.blurb}</p>
      <div className="fj-bullets">
        {feature.bullets.map(b => <span key={b}>{b}</span>)}
      </div>
      <div className="fj-stat"><b>◆</b> {feature.stat}</div>
    </div>
    <div className="fj-vis">
      {ORIGINAL_VISUAL_IDS.has(feature.id)
        ? <OriginalVisual feature={feature} />
        : <FeatureVisual feature={feature} />}
    </div>
  </>
);

export default FeaturePanel;
