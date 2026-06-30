import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './featuresJourney.css';
import { FEATURE_JOURNEY, FEATURE_CLUSTERS, CLUSTER_ACCENTS } from '../landingData';
import FeaturePanel from './FeaturePanel';
import FeatureSpine from './FeatureSpine';
import MobileFeatureCarousel from './MobileFeatureCarousel';
import { useFeaturesJourney } from './useFeaturesJourney';

// ── /features sliding gallery — orchestrator ────────────────────────────────
// Picks one of three render modes and renders only that one (their scroll models
// are incompatible), while keeping all 10 features in the DOM in every mode for
// SEO. Shared slide content lives in <FeaturePanel> so copy/visuals never fork.
//   • desktop  — sticky-pin horizontal journey + breadcrumb spine
//   • mobile   — native scroll-snap-x carousel + cluster rail + dot strip
//   • reduced  — plain vertical stack (prefers-reduced-motion / no-JS / SSR)

const clusterLabel = (key: string) => FEATURE_CLUSTERS.find(c => c.key === key)?.label ?? '';

type Mode = 'desktop' | 'mobile' | 'reduced';

function resolveMode(): Mode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'reduced';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced';
  if (window.matchMedia('(min-width: 920px) and (pointer: fine)').matches) return 'desktop';
  return 'mobile';
}

/** Feature index for a `section-<id>` hash, or 0. */
function indexFromHash(): number {
  if (typeof window === 'undefined') return 0;
  const id = window.location.hash.replace(/^#/, '');
  const i = FEATURE_JOURNEY.findIndex(f => f.id === id);
  return i >= 0 ? i : 0;
}

const FeaturesJourney: React.FC = () => {
  // Default to 'reduced' so the very first (pre-effect) render is the SEO-safe,
  // always-valid vertical stack; upgrade to desktop/mobile after mount.
  const [mode, setMode] = useState<Mode>('reduced');

  useLayoutEffect(() => {
    const apply = () => setMode(resolveMode());
    apply();
    const mqs = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(min-width: 920px) and (pointer: fine)'),
    ];
    mqs.forEach(mq => mq.addEventListener('change', apply));
    return () => mqs.forEach(mq => mq.removeEventListener('change', apply));
  }, []);

  if (mode === 'desktop') return <DesktopJourney />;
  if (mode === 'mobile') return <MobileFeatureCarousel features={FEATURE_JOURNEY} initialIndex={indexFromHash()} />;
  return <ReducedStack />;
};

// ── Desktop: sticky-pin journey ─────────────────────────────────────────────
const DesktopJourney: React.FC = () => {
  const count = FEATURE_JOURNEY.length;
  const { sectionRef, stageRef, progress, activeIndex, stageStyle, scrollToIndex } = useFeaturesJourney(count, true);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const active = FEATURE_JOURNEY[activeIndex];
  const accent = CLUSTER_ACCENTS[active.cluster];

  // inert + aria-hidden on the off-screen panels (kept in DOM for crawlers, but
  // out of tab order / AT for the current feature only).
  useEffect(() => {
    panelRefs.current.forEach((el, i) => {
      if (!el) return;
      const off = i !== activeIndex;
      (el as HTMLDivElement & { inert: boolean }).inert = off;
      el.setAttribute('aria-hidden', off ? 'true' : 'false');
    });
  }, [activeIndex]);

  // Deep-link: jump to the hash target once after first layout (instant).
  useEffect(() => {
    const i = indexFromHash();
    if (i > 0) requestAnimationFrame(() => scrollToIndex(i, 'auto'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Proximity scroll-snap so the journey settles on a whole feature (no resting
  // mid-slide). Snap points are the 100svh blocks below; proximity (not mandatory)
  // keeps momentum scroll on the rest of the page healthy. Scoped to the document
  // scroller only while the desktop journey is mounted.
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.scrollSnapType;
    el.style.scrollSnapType = 'y proximity';
    return () => { el.style.scrollSnapType = prev; };
  }, []);

  return (
    <section
      id="features"
      className="fj-root"
      ref={sectionRef}
      style={{
        ['--accent' as string]: accent.accent,
        ['--accent-2' as string]: accent.accent2,
      }}
      aria-label="Pulse features"
    >
      {/* In-flow snap blocks establish the section height (N × 100svh) and place a
          snap point at each feature offset. The stage overlays them. */}
      <div className="fj-snaps" aria-hidden="true">
        {FEATURE_JOURNEY.map(f => <div key={f.id} className="fj-snap" />)}
      </div>
      <div className="fj-stage" ref={stageRef} style={stageStyle}>
        <div className="fj-glow" />
        <div className="fj-grain" />
        <div className="fj-wrap">
          <FeatureSpine features={FEATURE_JOURNEY} activeIndex={activeIndex} onJump={scrollToIndex} />
          <div className="fj-main">
            <div className="fj-topbar"><b className="fj-prog" style={{ width: `${((activeIndex + 1) / count) * 100}%` }} /></div>
            <div className="fj-track" style={{ transform: `translateX(-${progress * (count - 1) * 100}%)` }}>
              {FEATURE_JOURNEY.map((f, i) => (
                <div
                  key={f.id}
                  id={f.id}
                  className={`fj-panel${i === activeIndex ? ' fj-live' : ''}`}
                  ref={el => { panelRefs.current[i] = el; }}
                  style={{ ['--accent' as string]: CLUSTER_ACCENTS[f.cluster].accent, ['--accent-2' as string]: CLUSTER_ACCENTS[f.cluster].accent2 }}
                >
                  <FeaturePanel feature={f} headingId={`${f.id}-title`} />
                </div>
              ))}
            </div>
            <div className="fj-foot">
              <div className="fj-bignum">{String(activeIndex + 1).padStart(2, '0')}<small> / {count}</small></div>
              <div className="fj-foot-label">{clusterLabel(active.cluster)} — {active.eyebrow}</div>
            </div>
            <div className="fj-navbtns">
              <button type="button" aria-label="Previous feature" disabled={activeIndex === 0} onClick={() => scrollToIndex(activeIndex - 1)}>↑</button>
              <button type="button" aria-label="Next feature" disabled={activeIndex === count - 1} onClick={() => scrollToIndex(activeIndex + 1)}>↓</button>
            </div>
            <div className="fj-hint"><span>scroll · <kbd>↑</kbd><kbd>↓</kbd> · click the spine to jump</span></div>
            <p className="fj-sr" aria-live="polite">
              Feature {activeIndex + 1} of {count}, {active.eyebrow}, {clusterLabel(active.cluster)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

// ── Reduced-motion / no-JS / SSR: plain vertical stack ──────────────────────
const ReducedStack: React.FC = () => {
  const grouped = useMemo(
    () => FEATURE_CLUSTERS.map(cl => ({
      cluster: cl,
      accent: CLUSTER_ACCENTS[cl.key],
      items: FEATURE_JOURNEY.filter(f => f.cluster === cl.key),
    })),
    [],
  );
  return (
    <section id="features" className="fj-stack" aria-label="Pulse features">
      {grouped.map(g =>
        g.items.map(f => (
          <div
            key={f.id}
            id={f.id}
            className="fj-stack-item"
            style={{ ['--accent' as string]: g.accent.accent, ['--accent-2' as string]: g.accent.accent2 }}
          >
            <FeaturePanel feature={f} />
          </div>
        )),
      )}
    </section>
  );
};

export default FeaturesJourney;
