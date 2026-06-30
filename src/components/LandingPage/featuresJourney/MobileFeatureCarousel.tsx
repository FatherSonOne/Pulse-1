import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FEATURE_CLUSTERS, CLUSTER_ACCENTS, type JourneyFeature } from '../landingData';
import FeaturePanel from './FeaturePanel';

// Mobile fallback: a native CSS scroll-snap-x carousel. No scroll-hijack, no
// transforms — the browser does the paging, which is touch-perfect and never
// fights vertical scroll or the dynamic browser chrome. The breadcrumb here is a
// sticky cluster chip rail (top) + a dot strip (bottom); both jump on tap.

interface MobileFeatureCarouselProps {
  features: JourneyFeature[];
  /** Feature index to open on mount (deep-link / hash target). */
  initialIndex?: number;
}

const MobileFeatureCarousel: React.FC<MobileFeatureCarouselProps> = ({ features, initialIndex = 0 }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(initialIndex);

  const accent = CLUSTER_ACCENTS[features[active]?.cluster ?? 'communicate'];

  // First index of each cluster (for chip jumps).
  const clusterFirst = useMemo(() => {
    const map: Record<string, number> = {};
    features.forEach((f, i) => { if (!(f.cluster in map)) map[f.cluster] = i; });
    return map;
  }, [features]);

  // Track active slide via IntersectionObserver on the horizontal track.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = slideRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx >= 0) setActive(idx);
          }
        });
      },
      { root: track, threshold: 0.6 },
    );
    slideRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, [features]);

  // Jump to the deep-link target on mount (no smooth — instant first paint).
  useEffect(() => {
    if (initialIndex > 0) {
      slideRefs.current[initialIndex]?.scrollIntoView({ inline: 'start', block: 'nearest' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jump = (index: number) => {
    slideRefs.current[index]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  return (
    <section
      id="features"
      className="fj-m-root"
      style={{ ['--accent' as string]: accent.accent, ['--accent-2' as string]: accent.accent2 }}
      aria-label="Pulse features"
    >
      {/* Breadcrumb — cluster chip rail */}
      <div className="fj-m-rail" role="tablist" aria-label="Feature clusters">
        {FEATURE_CLUSTERS.map(cl => {
          const ca = CLUSTER_ACCENTS[cl.key];
          const isActive = features[active]?.cluster === cl.key;
          return (
            <button
              key={cl.key}
              type="button"
              className={`fj-m-chip${isActive ? ' fj-active' : ''}`}
              style={{ ['--chip-accent' as string]: ca.accent }}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => jump(clusterFirst[cl.key] ?? 0)}
            >
              <span className="fj-n">{ca.num}</span>{cl.label}
            </button>
          );
        })}
      </div>

      {/* Swipeable track */}
      <div className="fj-m-track" ref={trackRef}>
        {features.map((f, i) => (
          <div
            key={f.id}
            id={f.id}
            className="fj-m-slide"
            ref={el => { slideRefs.current[i] = el; }}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${features.length}: ${f.eyebrow}`}
            style={{ ['--accent' as string]: CLUSTER_ACCENTS[f.cluster].accent, ['--accent-2' as string]: CLUSTER_ACCENTS[f.cluster].accent2 }}
          >
            <FeaturePanel feature={f} />
          </div>
        ))}
      </div>

      {/* Breadcrumb — dot strip + index */}
      <div className="fj-m-foot">
        <div className="fj-m-dots">
          {features.map((f, i) => (
            <button
              key={f.id}
              type="button"
              className={`fj-m-dot${i === active ? ' fj-active' : ''}`}
              aria-label={`Go to ${f.eyebrow}`}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => jump(i)}
            />
          ))}
        </div>
        <span className="fj-m-index">{String(active + 1).padStart(2, '0')} / {features.length}</span>
      </div>
    </section>
  );
};

export default MobileFeatureCarousel;
