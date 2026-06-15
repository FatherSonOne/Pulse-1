// ─────────────────────────────────────────────────────────────────────────────
// SpiderLines — coral SVG tethers from the spider anchor to each leg's
// final offset. Rendered as a sibling OverlayView at the anchor's lat/lng;
// the SVG canvas is sized to span the spider's diameter + a small bleed
// and translated so its center sits over the anchor.
//
// Animation: each line fades 0 → 0.4 opacity over 220ms with the same
// stagger as its corresponding leg (see useSpiderAnimation). When the
// spider collapses the parent unmounts this component — the leg unmount
// animation carries the exit; lines simply disappear.
//
// Reduced-motion: parent suppresses this component entirely. The lines
// exist to choreograph the fan; without animation they're just chrome.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { OverlayView } from '@react-google-maps/api';
import type { ActiveSpider } from '../hooks/useSpiderAnimation';

interface SpiderLinesProps {
  /** Anchor position — feeds the OverlayView. */
  lat: number;
  lng: number;
  spider: ActiveSpider;
}

const LINE_COLOR = 'rgba(244, 63, 94, 0.4)';
const LINE_WIDTH = 1.5;
const ENTER_DURATION_MS = 220;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

// The tether SVG, decoupled from its positioning wrapper — wrapped in
// OverlayView (Google) or MapMarkerPortal (MapLibre).
export const SpiderLinesBody: React.FC<{ spider: ActiveSpider }> = ({ spider }) => {
  // Compute the SVG canvas size from the legs' max radius + a small
  // bleed for the line stroke. Diameter is 2 × max-radius so the canvas
  // fully contains every leg endpoint.
  const { canvasSize, lines } = useMemo(() => {
    let maxR = 0;
    for (const leg of spider.legs) {
      const r = Math.sqrt(leg.offsetX * leg.offsetX + leg.offsetY * leg.offsetY);
      if (r > maxR) maxR = r;
    }
    const pad = LINE_WIDTH * 2 + 2;
    const size = Math.max(2 * (maxR + pad), 16);
    const center = size / 2;
    return {
      canvasSize: size,
      lines: spider.legs.map(leg => ({
        key: leg.key,
        x2: center + leg.offsetX,
        y2: center + leg.offsetY,
        delayMs: leg.delayMs,
      })),
    };
  }, [spider]);

  const center = canvasSize / 2;

  return (
    <svg
      aria-hidden="true"
        width={canvasSize}
        height={canvasSize}
        viewBox={`0 0 ${canvasSize} ${canvasSize}`}
        style={{
          // Center the SVG over the anchor's projected position. OverlayView
          // anchors at top-left of the child by default.
          transform: `translate(-${center}px, -${center}px)`,
          pointerEvents: 'none',
        }}
      >
        <style>{`
          @keyframes spider-line-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          .spider-line {
            opacity: 0;
            animation: spider-line-in ${ENTER_DURATION_MS}ms ${EASE} forwards;
            will-change: opacity;
          }
        `}</style>
        {lines.map(line => (
          <line
            key={line.key}
            x1={center}
            y1={center}
            x2={line.x2}
            y2={line.y2}
            stroke={LINE_COLOR}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            className="spider-line"
            style={{ animationDelay: `${line.delayMs}ms` }}
          />
        ))}
      </svg>
  );
};

// Google-renderer wrapper: positions the tether SVG via OverlayView.
const SpiderLines: React.FC<SpiderLinesProps> = ({ lat, lng, spider }) => (
  <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.OVERLAY_LAYER}>
    <SpiderLinesBody spider={spider} />
  </OverlayView>
);

export default SpiderLines;
