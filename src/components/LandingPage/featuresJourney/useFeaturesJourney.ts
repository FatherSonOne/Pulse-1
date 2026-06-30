import { useCallback, useEffect, useRef, useState } from 'react';

// ── Desktop journey controller — scroll-driven pin ──────────────────────────
// NOT a wheel-hijack (the prototype's wheel listener was demo-only). Native
// vertical scroll stays fully in control: scrollbar, trackpad, Page Up/Down,
// Space, find-in-page and screen readers all just work. We only *read* the scroll
// position to derive a continuous progress (drives the horizontal translate) and a
// rounded active index (drives spine / accent / copy reveal).
//
// We pin with a JS-managed `position: fixed` 3-state, NOT CSS `position: sticky`.
// Reason: the Pulse app shell wraps every page in a non-scrolling
// `overflow-y:auto` container (plus `overflow-x:hidden` on body/#root). CSS sticky
// binds to that nearest overflow ancestor — which never scrolls — so it would
// never pin. `fixed` is immune to ancestor overflow (only broken by an ancestor
// `transform`, of which there are none in the chain). See HANDOFF §10 sticky kill
// switches.

type PinPhase = 'before' | 'fixed' | 'after';

interface JourneyState {
  progress: number;     // 0 → 1 across the pinned range
  activeIndex: number;  // rounded current feature
  phase: PinPhase;
  left: number;         // viewport-left of the section (for the fixed stage)
  width: number;
}

interface JourneyController {
  sectionRef: React.RefObject<HTMLElement>;
  stageRef: React.RefObject<HTMLDivElement>;
  progress: number;
  activeIndex: number;
  /** Inline style for the stage, reflecting the 3-state pin. */
  stageStyle: React.CSSProperties;
  /** Scroll so that `index` becomes the active feature (smooth by default). */
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const scroller = () => document.scrollingElement || document.documentElement;

export function useFeaturesJourney(count: number, enabled: boolean): JourneyController {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<JourneyState>({ progress: 0, activeIndex: 0, phase: 'before', left: 0, width: 0 });
  const rafRef = useRef<number | null>(null);

  const viewportH = useCallback(() => window.innerHeight, []);

  // Pinned travel range = total section height minus one viewport.
  const range = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return 1;
    return Math.max(1, section.offsetHeight - viewportH());
  }, [viewportH]);

  const measure = useCallback(() => {
    rafRef.current = null;
    const section = sectionRef.current;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const vh = viewportH();
    const p = clamp(-rect.top / range(), 0, 1);
    const phase: PinPhase = rect.top > 0 ? 'before' : rect.bottom <= vh ? 'after' : 'fixed';
    setState(prev => {
      const next: JourneyState = {
        progress: p,
        activeIndex: count > 1 ? Math.round(p * (count - 1)) : 0,
        phase,
        left: Math.round(rect.left),
        width: Math.round(rect.width),
      };
      // Skip the re-render if nothing meaningful changed (avoids churn at rest).
      if (
        prev.phase === next.phase &&
        prev.activeIndex === next.activeIndex &&
        Math.abs(prev.progress - next.progress) < 0.0005 &&
        prev.left === next.left &&
        prev.width === next.width
      ) return prev;
      return next;
    });
  }, [count, range, viewportH]);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const section = sectionRef.current;
      if (!section || count <= 1) return;
      const i = clamp(index, 0, count - 1);
      const top = scroller().scrollTop + section.getBoundingClientRect().top + (i / (count - 1)) * range();
      window.scrollTo({ top, behavior });
    },
    [count, range],
  );

  // Scroll / resize → recompute (rAF-throttled).
  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('orientationchange', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('orientationchange', onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, measure]);

  // Keyboard: discrete stepping while the journey is pinned.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (state.phase !== 'fixed') return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) {
        e.preventDefault();
        scrollToIndex(state.activeIndex + 1);
      } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        scrollToIndex(state.activeIndex - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        scrollToIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollToIndex(count - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, state.phase, state.activeIndex, count, scrollToIndex]);

  const stageStyle: React.CSSProperties =
    state.phase === 'fixed'
      ? { position: 'fixed', top: 0, left: state.left, width: state.width }
      : state.phase === 'after'
        ? { position: 'absolute', bottom: 0, left: 0, width: '100%' }
        : { position: 'absolute', top: 0, left: 0, width: '100%' };

  return {
    sectionRef,
    stageRef,
    progress: state.progress,
    activeIndex: state.activeIndex,
    stageStyle,
    scrollToIndex,
  };
}
