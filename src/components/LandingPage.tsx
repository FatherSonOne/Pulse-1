import React, { useState, useEffect, useRef, useId, lazy, Suspense } from 'react';
import './LandingPage.css';

import { Apple, ArrowDown, Battery, Bell, Book, BookOpen, Calendar, Check, ChevronDown, ChevronUp, Download, ExternalLink, Eye, Gavel, Heart, HeartPulse, HelpCircle, Home, Info, Keyboard, Layers, LayoutGrid, MapPin, MessageSquare, Mic, Network, Play, Radar, Rocket, Search, Signal, Smartphone, Tag, User, Users, Video, Wand2, Wifi, X } from 'lucide-react';
import { FAQ_DATA, SHORTCUT_GROUPS, PULSE_SOLO_FEATURES, PULSE_SOLO_PRICING, PULSE_TEAM_FEATURES, PULSE_TEAM_PRICING, PULSE_GROWTH_FEATURES, PULSE_GROWTH_PRICING, PULSE_PLAN_MATRIX, CAPABILITY_CELLS } from './LandingPage/landingData';

// Lazy-load the guide — guideData.ts is 26k lines and must NOT land in the main bundle
const UsersGuide = lazy(() => import('./UsersGuide/UsersGuide'));

// /features sliding-gallery journey (replaces the downward feature stack). Lazy
// so its CSS/visuals never land in the quiet-home bundle.
const FeaturesJourney = lazy(() => import('./LandingPage/featuresJourney/FeaturesJourney'));

interface LandingPageProps {
  /** 'home' = quiet landing; 'features' = deep showcase route (/features). */
  variant?: 'home' | 'features' | 'demo';
  /** New users: routes to the auth screen in sign-up mode. */
  onGetStarted: () => void;
  /** Returning users: routes to the auth screen in sign-in mode. Falls back to onGetStarted. */
  onSignIn?: () => void;
}

// Pulse Globe — the sole brand mark. A rose→pink disc with the heartbeat knocked out
// (a real transparent gap, so the pulse reads as whatever surface sits behind the mark).
const QntmEcosIcon = ({ size = 28 }: { size?: number }) => {
  const uid = useId();
  const g = `pgGlobe-${uid}`, m = `pgCut-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f43f5e" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <mask id={m}>
          <rect width="100" height="100" fill="#fff" />
          <path d="M6 50 H38 L44 32 L52 68 L58 50 H94" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        </mask>
      </defs>
      <circle cx="50" cy="50" r="43" fill={`url(#${g})`} mask={`url(#${m})`} />
    </svg>
  );
};

// Quantum Ecosystems brand mark — the studio behind Pulse. The abstract "Q":
// a rose→pink gradient ring with a tail, a soft inner glow, and a quantum dot.
// Mirrors the canonical mark on qntmecos.com (src/components/Logo.tsx).
const QuantumEcosMark = ({ size = 28 }: { size?: number }) => {
  const uid = useId();
  const g = `qe-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f43f5e" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {/* Abstract Q — ring + tail */}
      <path d="M 40 15 A 25 25 0 1 1 40 65 L 55 75 Z" fill="none" stroke={`url(#${g})`} strokeWidth="4" strokeLinecap="round" />
      {/* Soft inner glow */}
      <circle cx="40" cy="40" r="15" fill={`url(#${g})`} opacity="0.2" />
      {/* Quantum dot */}
      <circle cx="40" cy="40" r="4" fill="#ec4899" />
    </svg>
  );
};

// Data arrays imported from ./LandingPage/landingData.ts

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionDivider = () => (
  <div className="lp-section-divider relative h-10 pointer-events-none overflow-hidden" aria-hidden="true">
    <svg viewBox="0 0 1440 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', bottom: 0, width: '100%', height: '40px' }}>
      <defs>
        <linearGradient id="div-grad" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="25%" stopColor="#f43f5e" stopOpacity="0.5" />
          <stop offset="75%" stopColor="#ec4899" stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d="M0 20 Q 360 0, 720 20 T 1440 20" stroke="url(#div-grad)" strokeWidth="1.5" fill="none" />
    </svg>
  </div>
);

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onSignIn, variant = 'home' }) => {
  // Returning users get a distinct sign-in destination; older callers that don't
  // pass onSignIn fall back to the new-user flow so nothing breaks.
  const goSignIn = onSignIn ?? onGetStarted;
  const [activeScenario, setActiveScenario] = useState<'enterprise' | 'voice'>('enterprise');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [orbitPaused, setOrbitPaused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingCycle, setPricingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [teamSeats, setTeamSeats] = useState(2); // Pulse Team is per-seat, min 2
  const [showCompare, setShowCompare] = useState(false); // feature matrix disclosure
  // Email landing section is built (emailAIService / smartCompose / Gmail sync) but Gmail is
  // currently an owner-scoped grant and emailEnabled defaults off, so it is not yet generally
  // available to public signups. Hidden from the marketing page for v1; flip to re-show.
  const SHOW_EMAIL_ON_LANDING = false;
  // Logos Vision bidirectional-sync panel — kept HIDDEN intentionally (P7 decision
  // 2026-06-13). The sync IS built (P0–P6, gated behind the in-app `logosVisionSync`
  // flag, default OFF) but is SINGLE-TENANT / owner-only (one shared Logos service-role
  // key), so it is not a public, multi-tenant offering to advertise here. The panel's
  // copy below is also stale vs. what shipped (triggers are note-save/manual + email/
  // Slack — NOT "Relay message"/automatic; F3 is confirm-before-write AI client-field
  // suggestions; F4 is a read-only case-state line, NOT a health-score change). Re-enable
  // ONLY if this becomes multi-tenant AND the copy + "Connected" badge are corrected.
  // See docs/LOGOS_VISION_SYNC_BUILD_HANDOFF_2026-06-13.md (§9 + build status).
  const SHOW_LOGOS_SYNC = false;
  // Inline "Pulse in Your Pocket" mock consolidated into the closing "Wherever you are" CTA
  // (avoid two phone mocks on one page). Flip to re-show it beside the shortcuts.
  const SHOW_INLINE_MOBILE_PREVIEW = false;
  // Enterprise scenario describes unbuilt cross-app orchestration (Logos auto-link, Entomate
  // workflow automation, email). Hidden for v1; Voice-First (all real) is the single scenario.
  const SHOW_ENTERPRISE_SCENARIO = false;
  const heroCanvasRef = useRef<HTMLCanvasElement>(null);
  const crmCanvasRef  = useRef<HTMLCanvasElement>(null);

  // ── Live transcription typewriter ──────────────────────────────────
  const liveTranscriptPhrases = [
    "I'll loop in the design team on the mockups",
    "Can we move the standup to Thursday morning?",
    "Pushing the release to next sprint, let's align",
    "Quick heads-up: client approved the proposal",
    "Flag this for review before EOD please",
  ];
  const [liveTranscriptText, setLiveTranscriptText] = useState('');
  const [liveTranscriptPhrase, setLiveTranscriptPhrase] = useState(0);

  useEffect(() => {
    const phrase = liveTranscriptPhrases[liveTranscriptPhrase];
    let charIdx = 0;
    let typingTimer: ReturnType<typeof setTimeout>;

    const typeNext = () => {
      charIdx++;
      setLiveTranscriptText(phrase.slice(0, charIdx));
      if (charIdx < phrase.length) {
        typingTimer = setTimeout(typeNext, 42 + Math.random() * 28);
      } else {
        // pause, then cycle to next phrase
        typingTimer = setTimeout(() => {
          setLiveTranscriptText('');
          setLiveTranscriptPhrase(i => (i + 1) % liveTranscriptPhrases.length);
        }, 2800);
      }
    };

    typingTimer = setTimeout(typeNext, 42);
    return () => clearTimeout(typingTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTranscriptPhrase]);

  // ── Theme toggle (dark = default, persisted to localStorage) ──
  // Marketing landing has no user theme toggle. `heroDark` styles the dark nav +
  // hero zone (always dark). `isDarkMode` drives the body: HOME is a fixed
  // dark-hero → light-body flow (false → the .lp-light wrapper renders every
  // section light). FEATURES/DEMO emit their dark classes (true) and the body
  // wrapper is dark, so sections render dark by default; alternating sections
  // get an `lp-light` class to flip back to light (dark/light rhythm).
  const heroDark = true;
  const isDarkMode = variant === 'home' ? false : true;

  // Reveal-on-scroll for section headings and divider SVGs. Picks up every
  // <h2> inside #main-content, every .lp-section-divider, and any explicit
  // [data-reveal] element. Adds .lp-revealed when the element crosses the
  // viewport so the CSS transition kicks in. Hero <h1> is unaffected — it
  // owns its own .animate-blur-reveal cascade and stays as designed.
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return;
    const targets: Element[] = [
      ...Array.from(main.querySelectorAll('h2')),
      ...Array.from(main.querySelectorAll('.lp-section-divider svg')),
      ...Array.from(main.querySelectorAll('[data-reveal]')),
    ];
    targets.forEach(el => el.classList.add('lp-reveal'));
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-revealed');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    targets.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Scroll progress bar + back-to-top visibility + mobile menu auto-close
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      setScrollProgress(scrollHeight > 0 ? scrollTop / scrollHeight : 0);
      setShowBackToTop(scrollTop > 500);
      if (mobileMenuOpen && scrollTop > 100) setMobileMenuOpen(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mobileMenuOpen]);

  // Lock body scroll when guide drawer or mobile menu is open
  useEffect(() => {
    document.body.style.overflow = (isGuideOpen || mobileMenuOpen) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isGuideOpen, mobileMenuOpen]);

  useEffect(() => {
    if (!isGuideOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsGuideOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isGuideOpen]);

  // Close mobile menu on Esc key or when viewport widens to ≥ 768px
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileMenuOpen(false); };
    const onResize = () => { if (window.innerWidth >= 768) setMobileMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [mobileMenuOpen]);

  // ── Hero "Propagation Mesh" — lazy-loaded 3D field (replaces the flat 2D wave
  //    canvas). `three` lives in its own chunk, fetched only when this mounts. ──
  useEffect(() => {
    if (variant !== 'home') return;
    const canvas = heroCanvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let mesh: import('../webgl/pulseHeroMesh').PulseHeroMesh | null = null;
    let io: IntersectionObserver | null = null;
    let cancelled = false;
    const onResize = () => mesh?.resize();

    import('../webgl/pulseHeroMesh')
      .then(({ createPulseHeroMesh }) => {
        if (cancelled || !heroCanvasRef.current) return;
        const density = window.innerWidth < 768 ? 0.45 : undefined; // lighter cloud on phones
        mesh = createPulseHeroMesh(heroCanvasRef.current, { reduced, density });
        mesh.start();
        window.addEventListener('resize', onResize);
        // pause the rAF loop while the hero is scrolled off-screen
        io = new IntersectionObserver(([entry]) => {
          if (!mesh) return;
          if (entry.isIntersecting) mesh.start(); else mesh.stop();
        }, { threshold: 0 });
        io.observe(canvas);
      })
      .catch(() => { /* three failed to load — hero falls back to the dark bg */ });

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      io?.disconnect();
      mesh?.dispose();
    };
  }, [variant]);

  // ── CRM mesh-network canvas ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = crmCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let crmVisible = true;
    const crmVisObs = new IntersectionObserver(([entry]) => { crmVisible = entry.isIntersecting; }, { threshold: 0 });
    crmVisObs.observe(canvas);

    let rafId = 0;
    let W = 0, H = 0;
    const GLOW = 0.17;
    const CONNECT_DIST = 160;

    type MeshNode = { x: number; y: number; vx: number; vy: number; r: number; color: string; alpha: number; health: number; label: string };
    const nodes: MeshNode[] = [];

    // Ping rings — recurring "activity" rings emitted from random named nodes.
    // Communicates that the network is live, not a static diagram. One named
    // node fires every 1.6-3.2s; max ~6 concurrent rings; each ring expands
    // from r to 5r over PING_LIFE_MS while fading from 0.7 to 0 alpha.
    type Ping = { nodeIdx: number; age: number; color: string };
    const pings: Ping[] = [];
    const PING_LIFE_MS = 1800;
    let lastPingTime = performance.now();
    let nextPingDelay = 1600 + Math.random() * 1600;

    const NAMED = [
      { label: 'Sarah K.',  health: 92, color: '#818cf8' },
      { label: 'Marcus T.', health: 78, color: '#818cf8' },
      { label: 'Elena R.',  health: 85, color: '#c084fc' },
      { label: 'James L.',  health: 61, color: '#c084fc' },
      { label: 'Nina W.',   health: 95, color: '#818cf8' },
    ];
    const COLORS = ['#818cf8','#c084fc','#22d3ee','#a78bfa'];

    function buildNodes() {
      nodes.length = 0;
      // Named contacts — larger, scattered across canvas
      NAMED.forEach((n, i) => {
        nodes.push({
          x: W * (0.15 + (i / NAMED.length) * 0.7),
          y: H * (0.2 + (i % 3) * 0.25 + Math.random() * 0.15),
          vx: (Math.random() - 0.5) * 0.55,
          vy: (Math.random() - 0.5) * 0.55,
          r: 7, color: n.color, alpha: 1, health: n.health, label: n.label,
        });
      });
      // Secondary mesh nodes
      for (let i = 0; i < 28; i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.65,
          vy: (Math.random() - 0.5) * 0.65,
          r: 3 + Math.random() * 2.5,
          color: COLORS[i % COLORS.length],
          alpha: 0.45 + Math.random() * 0.35,
          health: 25 + Math.random() * 70,
          label: '',
        });
      }
    }

    function resize() {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width  = W;
      canvas.height = H;
      buildNodes();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Ping scheduler — emit a new ring from a random named node.
      const now = performance.now();
      if (pings.length < 6 && now - lastPingTime > nextPingDelay) {
        lastPingTime = now;
        nextPingDelay = 1600 + Math.random() * 1600;
        const namedCount = NAMED.length;
        const nodeIdx = Math.floor(Math.random() * namedCount);
        pings.push({ nodeIdx, age: 0, color: nodes[nodeIdx]?.color ?? '#818cf8' });
      }
      // Age pings, drop expired.
      for (let i = pings.length - 1; i >= 0; i--) {
        pings[i].age += 16;
        if (pings[i].age > PING_LIFE_MS) pings.splice(i, 1);
      }

      // Drift nodes — bounce off edges
      nodes.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < n.r)     { n.x = n.r;     n.vx = Math.abs(n.vx); }
        if (n.x > W - n.r) { n.x = W - n.r; n.vx = -Math.abs(n.vx); }
        if (n.y < n.r)     { n.y = n.r;     n.vy = Math.abs(n.vy); }
        if (n.y > H - n.r) { n.y = H - n.r; n.vy = -Math.abs(n.vy); }
      });

      // Connection lines
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const a = (1 - dist / CONNECT_DIST) * 0.28 * GLOW * 6;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${a})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Pings — render under the nodes so they look like emissions, not borders.
      pings.forEach(ping => {
        const node = nodes[ping.nodeIdx];
        if (!node) return;
        const t = ping.age / PING_LIFE_MS;        // 0 -> 1
        const radius = node.r + (node.r * 5) * t; // r -> 5r
        const alpha = (1 - t) * 0.55;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `${ping.color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach(n => {
        const hp = n.health / 100;
        const hColor = hp > 0.7 ? '#34d399' : hp > 0.4 ? '#fbbf24' : '#f87171';

        // Health arc
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hp);
        ctx.strokeStyle = hColor + 'bb';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Soft glow
        if (GLOW > 0.1) {
          const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
          ng.addColorStop(0, n.color + '30');
          ng.addColorStop(1, 'transparent');
          ctx.fillStyle = ng;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = n.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Label for named contacts
        if (n.label) {
          ctx.font = 'bold 9px -apple-system, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          ctx.textAlign = 'center';
          ctx.fillText(n.label, n.x, n.y + n.r + 12);
        }
      });
    }

    function loop() { rafId = requestAnimationFrame(loop); if (crmVisible) draw(); }

    resize();
    window.addEventListener('resize', resize);
    loop();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      crmVisObs.disconnect();
    };
  }, []);

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) { element.scrollIntoView({ behavior: 'smooth' }); return; }
    // Target lives on the other route — navigate there with the hash so the
    // browser scrolls to it on load. Keeps every nav link working across variants.
    const onFeatures = ['features','section-relay','section-glimpse','section-messaging','section-warroom','section-decisions','section-analytics','section-crm','section-calendar','section-maps','section-workspaces','ecosystem','cluster-communicate','cluster-decide','cluster-relate','cluster-operate'];
    window.location.href = (onFeatures.indexOf(id) >= 0 ? '/features#' : '/#') + id;
  };

  const handleLogoClick = () => {
    window.location.href = '/';
  };

  // ── Animated SVG icons for the Relay peer cards ────────────────────────────
  // Index-aligned to RELAY_PEERS (landingData.ts): 0 Triage · 1 Direct ·
  // 2 Channel · 3 Broadcast · 4 Notes · 5 Live. The orbit/stack cards map by
  // array index, so this order must mirror RELAY_PEERS exactly — kept in sync
  // after the Voxer → Relay rebrand so each peer shows its own glyph.
  const relayPeerIcon = (idx: number): React.ReactNode => {
    const icons: React.ReactNode[] = [
      // 0 — Triage: inbox tray, the unified priority stream
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 4.5h10l2 7v3.5a1 1 0 01-1 1H4a1 1 0 01-1-1V11.5l2-7z" />
        <path d="M3 11.5h3.3l1 1.8h5.4l1-1.8H17" />
      </svg>,
      // 1 — Direct: 5-bar waveform equaliser, one-to-one voice
      <svg viewBox="0 0 20 20" width={18} height={18} fill="currentColor" aria-hidden="true">
        <rect x="1"    y="9" width="2.5" height="2"  rx="1" className="lp-bar-a" />
        <rect x="4.5"  y="6" width="2.5" height="8"  rx="1" className="lp-bar-b" />
        <rect x="8"    y="3" width="2.5" height="14" rx="1" className="lp-bar-c" />
        <rect x="11.5" y="6" width="2.5" height="8"  rx="1" className="lp-bar-d" />
        <rect x="15"   y="9" width="2.5" height="2"  rx="1" className="lp-bar-e" />
      </svg>,
      // 2 — Channel: two silhouettes, group voice thread
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
        <circle cx="7" cy="6" r="2.5" />
        <path d="M2 17a5 5 0 0110 0" />
        <circle cx="14" cy="6" r="2" opacity={0.6} />
        <path d="M12 17a4 4 0 014 0" opacity={0.6} />
      </svg>,
      // 3 — Broadcast: concentric rings, push-to-air to everyone
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="2.5" fill="currentColor" />
        <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth={1.2} className="lp-radio-a" />
        <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth={1}   className="lp-radio-b" opacity={0.55} />
      </svg>,
      // 4 — Notes: notepad, personal voice journaling
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
        <path d="M4 3h9l3 3v11a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" />
        <line x1="6" y1="8"  x2="12" y2="8" />
        <line x1="6" y1="11" x2="12" y2="11" />
        <line x1="6" y1="14" x2="9"  y2="14" />
        <polyline points="13,3 13,6 16,6" strokeWidth={1.2} />
      </svg>,
      // 5 — Live: record/on-air dot, always-on voice room
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true">
        <circle cx="10" cy="10" r="7" />
        <circle cx="10" cy="10" r="3" fill="currentColor" stroke="none" className="lp-rec-dot" />
      </svg>,
    ];
    return icons[idx] ?? null;
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 overflow-x-hidden overflow-y-auto selection:bg-rose-500/30 selection:text-rose-700">

      {/* ── Skip to main content (ADA) ── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-rose-600 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-xl focus:outline-none"
      >
        Skip to main content
      </a>

      {/* ── J: Scroll Progress Bar ── */}
      <div className="fixed top-0 left-0 right-0 z-[200] h-[3px] pointer-events-none" aria-hidden="true">
        <div
          className="h-full bg-gradient-to-r from-rose-500 via-pink-500 to-purple-500 transition-none"
          style={{ width: `${scrollProgress * 100}%`, boxShadow: '0 0 8px rgba(244,63,94,0.7)' }}
        />
      </div>

      {/* ── K: Back-to-Top Button ── */}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-6 z-[150] w-11 h-11 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/40 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 bounce-up"
          aria-label="Back to top"
        >
          <ChevronUp className="text-sm" />
        </button>
      )}

      {/* ── Guide Drawer ── */}
      {isGuideOpen && (
        <div
          className="fixed inset-0 z-[300]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-drawer-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 backdrop-blur-sm overlay-in cursor-pointer"
            style={{ background: 'rgba(8, 8, 8, 0.7)' }}
            onClick={() => setIsGuideOpen(false)}
            aria-hidden="true"
          />
          {/* Panel */}
          <div className={`absolute top-0 right-0 bottom-0 w-full max-w-3xl border-l shadow-2xl drawer-open flex flex-col ${isDarkMode ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-stone-200'}`}>
            {/* Drawer header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b backdrop-blur-sm shrink-0 ${isDarkMode ? 'border-zinc-800 bg-zinc-950/95' : 'border-stone-200 bg-white/95'}`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-center justify-center" aria-hidden="true">
                  <BookOpen className="text-rose-400 text-sm" />
                </div>
                <div>
                  <div id="guide-drawer-title" className={`font-bold ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>Pulse User Guide</div>
                  <div className={`text-xs ${isDarkMode ? 'text-zinc-500' : 'text-stone-500'}`}>Complete feature documentation</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className={`w-9 h-9 rounded-lg border hover:border-rose-500/40 transition flex items-center justify-center ${isDarkMode ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'bg-stone-100 border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-200'}`}
                aria-label="Close User Guide"
              >
                <X />
              </button>
            </div>
            {/* Guide content — loaded lazily on first drawer open */}
            <div className="flex-1 overflow-y-auto">
              <Suspense fallback={
                <div className="flex items-center justify-center h-64 gap-3 text-zinc-500">
                  <div className="w-5 h-5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin"></div>
                  <span className="text-sm">Loading guide…</span>
                </div>
              }>
                <UsersGuide isDarkMode={isDarkMode} />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-20px) scale(1.02); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes pulse-glow-slow {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.06); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes particle-float {
          0%, 100% { transform: translate(0,0) rotate(0deg); opacity: 0.2; }
          25% { transform: translate(10px,-10px) rotate(90deg); opacity: 0.4; }
          50% { transform: translate(-5px,-20px) rotate(180deg); opacity: 0.3; }
          75% { transform: translate(-15px,-10px) rotate(270deg); opacity: 0.5; }
        }
        @keyframes ecg-draw {
          0%   { stroke-dashoffset: 1; opacity: 0; }
          4%   { stroke-dashoffset: 1; opacity: 1; }
          58%  { stroke-dashoffset: 0; opacity: 1; }
          74%  { stroke-dashoffset: 0; opacity: 0.6; }
          90%  { stroke-dashoffset: 0; opacity: 0; }
          100% { stroke-dashoffset: 1; opacity: 0; }
        }
        @keyframes ecg-glow-trail {
          0%   { stroke-dashoffset: 1; opacity: 0; }
          4%   { stroke-dashoffset: 1; opacity: 0.35; }
          58%  { stroke-dashoffset: 0; opacity: 0.35; }
          74%  { stroke-dashoffset: 0; opacity: 0.15; }
          90%  { stroke-dashoffset: 0; opacity: 0; }
          100% { stroke-dashoffset: 1; opacity: 0; }
        }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        .animate-pulse-glow-slow { animation: pulse-glow-slow 4s ease-in-out infinite; }
        .animate-fade-in { animation: fade-in 0.8s ease-out forwards; opacity: 0; }
        .animation-delay-100 { animation-delay: 0.1s; }
        .animation-delay-200 { animation-delay: 0.2s; }
        .animation-delay-300 { animation-delay: 0.3s; }
        .animation-delay-400 { animation-delay: 0.4s; }
        .animation-delay-500 { animation-delay: 0.5s; }
        .card-elevated { box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .card-elevated-rose { box-shadow: 0 4px 24px rgba(244,63,94,0.22); }
        /* Solid coral — kept the class name for callsite stability, but the
           gradient-text effect was an absolute ban per impeccable + DESIGN.md.
           Renders as a single Rose Pulse instead. */
        .text-gradient-rose { color: #f43f5e; }
        /* DESIGN.md §3 The Mono-Label Rule: every uppercase tracked label uses
           JetBrains Mono. The font is preloaded in index.html; this rule
           scopes the swap to the landing page only so the rest of the app
           keeps its own typography. */
        .lp-dark .uppercase.tracking-widest,
        .lp-light .uppercase.tracking-widest,
        .lp-dark .uppercase.tracking-wide,
        .lp-light .uppercase.tracking-wide,
        .lp-dark .uppercase.tracking-\[0\.1em\],
        .lp-light .uppercase.tracking-\[0\.1em\] {
          font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
          font-weight: 500;
        }
        /* ── Reveal-on-scroll (Animate A) ──
           Section headings start opaque/blurred slightly, settle on viewport
           entry. The .lp-revealed class is added by an IntersectionObserver
           (see useEffect). Uses the same expo-out curve as the rest of the
           system per DESIGN.md §4. */
        .lp-reveal {
          opacity: 0;
          filter: blur(6px);
          transform: translateY(10px);
          transition: opacity 600ms cubic-bezier(0.16, 1, 0.3, 1),
                      filter 600ms cubic-bezier(0.16, 1, 0.3, 1),
                      transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, filter, transform;
        }
        .lp-revealed {
          opacity: 1;
          filter: blur(0);
          transform: none;
        }
        /* ── Section divider draw-in (Animate F) ──
           The decorative SVG line + dot sits on a stroke-dashoffset until the
           divider enters view. */
        .lp-section-divider svg.lp-reveal path,
        .lp-section-divider svg.lp-reveal line {
          stroke-dasharray: 1500;
          stroke-dashoffset: 1500;
          transition: stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-section-divider svg.lp-revealed path,
        .lp-section-divider svg.lp-revealed line {
          stroke-dashoffset: 0;
        }
        /* ── Card hover compliance (Animate B) ──
           DESIGN.md section 4 caps hover lift at 2px and forbids theatrical
           motion. Page-wide hover:-translate-y-2 collapsed to -translate-y-0.5
           on every card via replace-all; this rule reserves an additional
           transition for use on cards that opt in via lp-card-hover. */
        .lp-card-hover {
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 220ms cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform;
        }
        .lp-card-hover:hover {
          transform: translateY(-2px);
        }
        /* ── Primary CTA coral halo (Animate C) ──
           DESIGN.md §4 shadow vocabulary: the "alive" hover shadow reserved
           for primary CTAs and recording indicators. */
        .lp-cta-primary {
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1),
                      filter 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-cta-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 0 0 1px #f43f5e, 0 6px 28px rgba(244,63,94,0.35);
        }
        .lp-cta-primary:active {
          transform: translateY(0);
        }
        /* ── Orbit hover connector (Animate D) ──
           Each peer card carries an absolute-positioned 1px line that points
           back toward the center of the orbital diagram. The line is hidden
           by default (scaleX(0), transform-origin: 0) and draws toward center
           when the card is hovered. The keyboard shortcut badge fades in
           alongside. */
        .lp-orbit-card .lp-orbit-link {
          opacity: 0;
          transform: scaleX(0);
          transform-origin: 0 50%;
          transition: opacity 220ms cubic-bezier(0.16, 1, 0.3, 1),
                      transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-orbit-card:hover .lp-orbit-link {
          opacity: 1;
          transform: scaleX(1);
        }
        .lp-orbit-card .lp-orbit-key {
          opacity: 0;
          transform: scale(0.85);
          transition: opacity 220ms cubic-bezier(0.16, 1, 0.3, 1),
                      transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-orbit-card:hover .lp-orbit-key {
          opacity: 1;
          transform: scale(1);
        }
        /* ── Footer ECG draw-in (Animate G) ──
           The Pulse wordmark ECG path stays drawn-out until the footer mark
           enters view, then sketches itself in. The .lp-reveal/.lp-revealed
           classes are added to the wrapper by IntersectionObserver (data-reveal
           opts the wrapper in); the path inherits via descendant selector. */
        .lp-footer-mark.lp-reveal svg path {
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          transition: stroke-dashoffset 1200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-footer-mark.lp-revealed svg path {
          stroke-dashoffset: 0;
        }
        /* ── Analytics hero chart draw-in (Wave 4.1) ──
           The chart wrapper opts in via [data-reveal]; on intersection the
           descendant chart pieces animate in over a deliberate cascade:
           gridlines fade first, line traces in via stroke-dashoffset,
           area fill resolves, then the "Now" marker and floating tooltip
           settle in last. Sparkline KPI tiles share the same line-draw
           technique on their own short cycle. */
        .lp-chart .lp-chart-grid {
          opacity: 0;
          transition: opacity 600ms cubic-bezier(0.16, 1, 0.3, 1) 100ms;
        }
        .lp-chart.lp-revealed .lp-chart-grid {
          opacity: 1;
        }
        .lp-chart .lp-chart-line {
          stroke-dasharray: 1800;
          stroke-dashoffset: 1800;
          transition: stroke-dashoffset 1600ms cubic-bezier(0.16, 1, 0.3, 1) 200ms;
        }
        .lp-chart.lp-revealed .lp-chart-line {
          stroke-dashoffset: 0;
        }
        .lp-chart .lp-chart-area {
          opacity: 0;
          transition: opacity 900ms cubic-bezier(0.16, 1, 0.3, 1) 700ms;
        }
        .lp-chart.lp-revealed .lp-chart-area {
          opacity: 1;
        }
        .lp-chart .lp-chart-now,
        .lp-chart .lp-chart-tooltip {
          opacity: 0;
          transition: opacity 500ms cubic-bezier(0.16, 1, 0.3, 1) 1400ms;
        }
        .lp-chart.lp-revealed .lp-chart-now,
        .lp-chart.lp-revealed .lp-chart-tooltip {
          opacity: 1;
        }
        .lp-spark .lp-spark-line {
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          transition: stroke-dashoffset 1100ms cubic-bezier(0.16, 1, 0.3, 1) 250ms;
        }
        .lp-spark.lp-revealed .lp-spark-line {
          stroke-dashoffset: 0;
        }
        /* ── Velocity strip line draw-in (Wave 4.1 finish) ──
           Wide, slow draw to read as "this metric flows" rather than
           "this is one of four cards." Stroke length matches the path
           geometry (~840 units in the 0-800 viewBox) with a small
           cushion. Sits on the section background, no card chrome. */
        .lp-velocity .lp-velocity-line {
          stroke-dasharray: 900;
          stroke-dashoffset: 900;
          transition: stroke-dashoffset 1800ms cubic-bezier(0.16, 1, 0.3, 1) 300ms;
        }
        .lp-velocity.lp-revealed .lp-velocity-line {
          stroke-dashoffset: 0;
        }
        /* ── War Room terminal mock (Wave 4.1) ──
           Transcript lines stagger in on a 180ms cadence (driven by inline
           --lp-wr-i index), the input cursor blinks once intersected, and
           the voice-recording indicator bars throb at a Linear-IDE cadence.
           The artifact table rows reveal slightly behind the line that
           introduces them so the eye reads "command → response → table". */
        .lp-warroom .lp-wr-line {
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 420ms cubic-bezier(0.16, 1, 0.3, 1),
                      transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
          transition-delay: calc(var(--lp-wr-i, 0) * 180ms);
        }
        .lp-warroom.lp-revealed .lp-wr-line {
          opacity: 1;
          transform: none;
        }
        @keyframes lp-wr-blink {
          0%, 49%   { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .lp-warroom.lp-revealed .lp-wr-cursor {
          animation: lp-wr-blink 1s steps(2, jump-none) infinite;
          animation-delay: calc(var(--lp-wr-cursor-delay, 1400ms));
        }
        .lp-wr-cursor {
          display: inline-block;
          width: 0.5em;
          height: 1em;
          background: currentColor;
          vertical-align: -2px;
          opacity: 0;
        }
        @keyframes lp-wr-voicebar {
          0%, 100% { transform: scaleY(0.4); }
          50%      { transform: scaleY(1); }
        }
        .lp-warroom.lp-revealed .lp-wr-voicebar {
          animation: lp-wr-voicebar 1.2s ease-in-out infinite;
          transform-origin: 50% 50%;
        }
        .lp-warroom.lp-revealed .lp-wr-voicebar:nth-child(2) { animation-delay: 0.15s; }
        .lp-warroom.lp-revealed .lp-wr-voicebar:nth-child(3) { animation-delay: 0.3s; }
        .lp-wr-voicebar { transform: scaleY(0.4); }
        /* Reduced motion: clear all reveal-state offsets immediately. */
        @media (prefers-reduced-motion: reduce) {
          .lp-reveal, .lp-revealed,
          .lp-section-divider svg.lp-reveal path,
          .lp-section-divider svg.lp-reveal line,
          .lp-footer-mark.lp-reveal svg path {
            opacity: 1 !important;
            filter: none !important;
            transform: none !important;
            stroke-dashoffset: 0 !important;
            transition: none !important;
          }
          .lp-cta-primary:hover {
            transform: none !important;
            box-shadow: 0 0 0 1px #f43f5e !important;
          }
          .lp-orbit-card .lp-orbit-link,
          .lp-orbit-card .lp-orbit-key {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
          .lp-chart .lp-chart-grid,
          .lp-chart .lp-chart-line,
          .lp-chart .lp-chart-area,
          .lp-chart .lp-chart-now,
          .lp-chart .lp-chart-tooltip,
          .lp-spark .lp-spark-line,
          .lp-velocity .lp-velocity-line {
            opacity: 1 !important;
            stroke-dashoffset: 0 !important;
            transition: none !important;
          }
          .lp-warroom .lp-wr-line {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
          .lp-warroom .lp-wr-cursor,
          .lp-warroom .lp-wr-voicebar {
            animation: none !important;
          }
          .lp-warroom .lp-wr-cursor { opacity: 1 !important; }
          .lp-warroom .lp-wr-voicebar { transform: scaleY(0.7) !important; }
        }
        .particle { animation: particle-float 15s ease-in-out infinite; }
        .ecg-draw { animation: ecg-draw 5.5s ease-in-out infinite; }
        .ecg-glow-trail { animation: ecg-glow-trail 5.5s ease-in-out infinite; }
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track { animation: ticker-scroll 28s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
        @keyframes drawer-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes drawer-slide-out {
          from { transform: translateX(0);   opacity: 1; }
          to   { transform: translateX(100%); opacity: 0; }
        }
        .drawer-open  { animation: drawer-slide-in  0.35s cubic-bezier(0.22,1,0.36,1) forwards; }
        .drawer-close { animation: drawer-slide-out 0.28s ease-in forwards; }
        @keyframes fade-overlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .overlay-in { animation: fade-overlay 0.25s ease forwards; }
        /* DESIGN.md §4 motion: cubic-bezier(0.16, 1, 0.3, 1) ease-out-expo.
           Replaces the prior ease-in-out bounce (impeccable flagged it as
           bounce-easing). Same motion, decisive curve. */
        @keyframes lp-lift {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-5px); }
        }
        .bounce-up { animation: lp-lift 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
        /* Honor prefers-reduced-motion across every always-on animation. */
        @media (prefers-reduced-motion: reduce) {
          .bounce-up,
          .lp-icon-bob, .lp-icon-spin, .lp-icon-throb, .lp-icon-zap, .lp-icon-tilt, .lp-icon-stamp,
          .lp-orbit-ring, .lp-orbit-g, .lp-orbit-card,
          .lp-throb-sm, .lp-flash, .lp-rec-dot, .lp-check-draw, .lp-ecg-line,
          .lp-bar-a, .lp-bar-b, .lp-bar-c, .lp-bar-d, .lp-bar-e,
          .particle, .ecg-draw,
          .animate-blur-reveal, .animate-fade-in, .animate-ping {
            animation: none !important;
            transition: none !important;
          }
          .hero-signal-canvas { display: none; }
        }

        /* === Landing Page Icon Animations === */
        @keyframes icon-bob {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-8px) scale(1.12); }
        }
        @keyframes icon-spin-slow {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes icon-throb {
          0%,100% { transform: scale(1); filter: brightness(1); }
          50%     { transform: scale(1.28); filter: brightness(1.5); }
        }
        @keyframes icon-zap {
          0%,75%,100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
          80%         { transform: scale(1.35) rotate(-12deg); filter: brightness(2.5); }
          88%         { transform: scale(1.45) rotate(12deg); filter: brightness(3); }
          94%         { transform: scale(1.2) rotate(-5deg); filter: brightness(2); }
        }
        @keyframes icon-tilt {
          0%,100% { transform: rotate(-6deg) translateY(0); }
          50%     { transform: rotate(6deg) translateY(-7px); }
        }
        @keyframes icon-stamp {
          0%,100% { transform: scale(1) translateY(0); }
          35%     { transform: scale(1.22) translateY(-5px); }
          55%     { transform: scale(0.92) translateY(3px); }
          70%     { transform: scale(1.08) translateY(0); }
        }
        /* Resting — quiet. Per the impeccable critique, six different always-on
           icon animations across the page made the interface feel fidgety. The
           idle state now sits still and the :hover rules below carry all the
           personality — predictable for skimmers, alive on contact. */
        .lp-icon-bob,
        .lp-icon-spin,
        .lp-icon-throb,
        .lp-icon-zap,
        .lp-icon-tilt,
        .lp-icon-stamp {
          transition: filter 220ms cubic-bezier(0.16, 1, 0.3, 1),
                      transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        /* Hover — bold, fast, glowing. Animation is added on hover only (now
           that the rest-state animation is removed), runs a single iteration
           so the icon settles back rather than looping while pointer dwells. */
        .group:hover .lp-icon-bob   { animation: icon-bob       0.55s cubic-bezier(0.16, 1, 0.3, 1) 1; filter: brightness(2.5) drop-shadow(0 0 10px currentColor); }
        .group:hover .lp-icon-spin  { animation: icon-spin-slow 0.7s  cubic-bezier(0.16, 1, 0.3, 1) 1; filter: brightness(2.5) drop-shadow(0 0 12px currentColor); }
        .group:hover .lp-icon-throb { animation: icon-throb     0.55s cubic-bezier(0.16, 1, 0.3, 1) 1; filter: brightness(3)   drop-shadow(0 0 14px currentColor); }
        .group:hover .lp-icon-zap   { animation: icon-zap       0.38s cubic-bezier(0.16, 1, 0.3, 1) 1; filter: brightness(4)   drop-shadow(0 0 18px currentColor); }
        .group:hover .lp-icon-tilt  { animation: icon-tilt      0.5s  cubic-bezier(0.16, 1, 0.3, 1) 1; filter: brightness(2.5) drop-shadow(0 0 10px currentColor); }
        .group:hover .lp-icon-stamp { animation: icon-stamp     0.45s cubic-bezier(0.16, 1, 0.3, 1) 1; filter: brightness(2.5) drop-shadow(0 0 10px currentColor); }
        /* Icon container glow ring on hover */
        .group:hover .lp-icon-wrap {
          box-shadow: 0 0 22px rgba(168,85,247,0.45), 0 0 8px rgba(168,85,247,0.3) inset;
        }
        .group:hover .lp-icon-wrap-teal {
          box-shadow: 0 0 22px rgba(20,184,166,0.45), 0 0 8px rgba(20,184,166,0.3) inset;
        }
        .group:hover .lp-icon-wrap-rose {
          box-shadow: 0 0 22px rgba(244,63,94,0.45), 0 0 8px rgba(244,63,94,0.3) inset;
        }
      `}</style>

      {/* ── Navigation ── */}
      <nav aria-label="Main navigation" className={`lp-dark fixed top-0 left-0 right-0 z-[100] backdrop-blur-xl border-b ${heroDark ? 'bg-zinc-950/85 border-zinc-800/50' : 'bg-white/85 border-stone-200/60'}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 md:px-6 md:py-4 flex items-center justify-between">

          {/* Left: Pulse logo + page nav (QntmEcos credit lives in the studio band + footer, not crowding the mark) */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleLogoClick}
              className="flex items-center gap-2.5 cursor-pointer group bg-transparent border-0 p-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              aria-label="Pulse, return home"
            >
              {/* Brand Globe mark — same mark as hero, footer, favicon & asset library */}
              <span className="inline-flex group-hover:scale-[1.04] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
                <QntmEcosIcon size={36} />
              </span>
              <span
                className={heroDark ? 'text-zinc-50' : 'text-zinc-900'}
                style={{
                  fontFamily: "'Syne', 'Inter', system-ui, sans-serif",
                  fontWeight: 800,
                  fontSize: '20px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginRight: '-0.1em', /* cancel trailing tracking so the lockup reads centered */
                }}
              >Pulse</span>
            </button>

            {/* Page nav — always visible (cross-page navigation) */}
            <nav aria-label="Pages" className="flex items-center gap-0.5 sm:gap-1 ml-1 sm:ml-2">
              {([
                { label: 'Home', href: '/' },
                { label: 'Features', href: '/features' },
                // 'Demo' removed 2026-06-28: it linked to a "coming soon" placeholder,
                // which broke the implicit promise of the nav item. /demo now redirects
                // to /features (see App.tsx). Restore this entry when a real interactive
                // tour ships (the demo-variant scaffold below remains for that purpose).
              ] as const).map((item) => {
                const active = currentPath === item.href;
                return (
                  <a key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`relative px-2 sm:px-2.5 py-1.5 text-[13px] sm:text-sm font-medium rounded-md transition-colors ${active ? (heroDark ? 'text-white' : 'text-stone-900') : (heroDark ? 'text-zinc-400 hover:text-white' : 'text-stone-500 hover:text-stone-900')}`}>
                    {item.label}
                    {active && <span className="absolute -bottom-0.5 left-2 right-2 h-0.5 rounded-full bg-rose-500" aria-hidden="true" />}
                  </a>
                );
              })}
              {/* Pricing — a marketing concern, so it peers with the Pages nav rather than
                  hiding in the right-side utility cluster. scrollToSection handles cross-route. */}
              <button
                type="button"
                onClick={() => scrollToSection('pricing')}
                className={`px-2 sm:px-2.5 py-1.5 text-[13px] sm:text-sm font-medium rounded-md transition-colors ${heroDark ? 'text-zinc-400 hover:text-white' : 'text-stone-500 hover:text-stone-900'}`}
              >
                Pricing
              </button>
            </nav>
          </div>

          <div className={`hidden md:flex items-center gap-6 text-sm font-medium ${heroDark ? 'text-zinc-400' : 'text-stone-500'}`}>
            {/* Pricing moved into the left Pages nav; this cluster is now Download / Docs / auth. */}

            {/* ── Downloads dropdown ── */}
            <div
              className="relative"
              onMouseEnter={() => setDownloadsOpen(true)}
              onMouseLeave={() => setDownloadsOpen(false)}
            >
              <button
                type="button"
                onClick={() => setDownloadsOpen((o) => !o)}
                className={`flex items-center gap-1.5 transition-colors duration-150 ${downloadsOpen ? 'text-white' : 'hover:text-white'}`}
                aria-haspopup="true"
                aria-expanded={downloadsOpen}
                aria-controls="lp-download-menu"
              >
                <Download className="text-[11px]" />
                Download
                <ChevronDown size={12} className={`transition-transform duration-200 ${downloadsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {/* Dropdown panel. The outer wrapper carries a transparent pt-3 so the 12px
                  visual gap stays inside the hover region (the menu no longer drops while
                  the cursor crosses to it). `invisible` when closed keeps the links out of
                  the tab order until the menu is open. */}
              <div
                id="lp-download-menu"
                className={`absolute top-full left-1/2 -translate-x-1/2 pt-3 w-64 z-[200] transition-[opacity,transform] duration-200 ${
                  downloadsOpen ? 'opacity-100 translate-y-0 pointer-events-auto visible' : 'opacity-0 -translate-y-2 pointer-events-none invisible'
                }`}
              >
                <div className="relative bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
                {/* Arrow */}
                <div className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-900 border-l border-t border-zinc-700/80 rotate-45" />

                <div className="p-2">
                  {/* Windows PC */}
                  <a
                    href="https://github.com/FatherSonOne/Pulse-1/releases/download/v25.1.3/Pulse.Setup.25.1.3.exe"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800 group transition"
                  >
                    <span className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                      <LayoutGrid className="text-blue-400 text-sm" />
                    </span>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition">Windows PC</div>
                      <div className="text-[11px] text-zinc-500">Desktop installer · x64</div>
                    </div>
                    <ArrowDown className="text-zinc-600 text-[10px] ml-auto group-hover:text-blue-400 transition" />
                  </a>

                  {/* Android — Play Store */}
                  <a
                    href="https://play.google.com/apps/internaltest/4701381285127016770"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800 group transition"
                  >
                    <span className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0">
                      <Play className="text-green-400 text-sm" />
                    </span>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-white group-hover:text-green-400 transition">Android</div>
                      <div className="text-[11px] text-zinc-500">Google Play · early access</div>
                    </div>
                    <ExternalLink className="text-zinc-600 text-[10px] ml-auto group-hover:text-green-400 transition" />
                  </a>

                  {/* Android — APK */}
                  <a
                    href="/downloads/pulse-android.apk"
                    download
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800 group transition"
                  >
                    <span className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                      <Smartphone className="text-rose-400 text-sm" />
                    </span>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-white group-hover:text-rose-400 transition">Android APK</div>
                      <div className="text-[11px] text-zinc-500">Direct download · all devices</div>
                    </div>
                    <ArrowDown className="text-zinc-600 text-[10px] ml-auto group-hover:text-rose-400 transition" />
                  </a>

                  <div className="my-1.5 border-t border-zinc-800" />

                  {/* iOS — Coming soon */}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-45 cursor-not-allowed">
                    <span className="w-8 h-8 rounded-lg bg-zinc-700/40 flex items-center justify-center flex-shrink-0">
                      <Apple className="text-zinc-400 text-sm" />
                    </span>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-zinc-400">iOS / macOS</div>
                      <div className="text-[11px] text-zinc-600">App Store, coming soon</div>
                    </div>
                  </div>

                  <div className="my-1.5 border-t border-zinc-800" />

                  {/* All downloads anchor */}
                  <button
                    type="button"
                    onClick={() => { setDownloadsOpen(false); scrollToSection('download'); }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    <Layers className="text-[10px]" />
                    View all downloads
                  </button>
                </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <span className={`w-px h-4 ${heroDark ? 'bg-zinc-800' : 'bg-stone-300'}`} aria-hidden="true" />
            {/* Docs — product help affordance (legal links live in the footer + mobile drawer) */}
            <button type="button" onClick={() => setIsGuideOpen(true)} className={`flex items-center gap-1.5 transition ${heroDark ? 'hover:text-white' : 'hover:text-stone-900'}`}>
              <Book className="text-[11px]" />
              Docs
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only, ghost style (no rose fill per budget rule) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="lp-mobile-menu"
              className={`md:hidden w-11 h-11 flex items-center justify-center rounded-lg border transition-[color,border-color,background-color,transform] duration-200 active:scale-95 ${
                heroDark
                  ? 'border-zinc-700/70 bg-zinc-900/60 hover:border-zinc-500/50 text-zinc-400 hover:text-white'
                  : 'border-stone-300 bg-white hover:border-stone-400 text-stone-500 hover:text-stone-900'
              }`}
            >
              <svg viewBox="0 0 20 20" width={18} height={18} fill="none" aria-hidden="true" overflow="visible">
                {/* Top bar — rotates to first arm of X */}
                <line
                  x1="3" y1="5" x2="17" y2="5"
                  stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
                  style={{
                    transformOrigin: '10px 5px',
                    transform: mobileMenuOpen ? 'translateY(5px) rotate(45deg)' : 'none',
                    transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                {/* Middle bar — fades out */}
                <line
                  x1="3" y1="10" x2="17" y2="10"
                  stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
                  style={{
                    opacity: mobileMenuOpen ? 0 : 1,
                    transition: 'opacity 150ms ease',
                  }}
                />
                {/* Bottom bar — rotates to second arm of X */}
                <line
                  x1="3" y1="15" x2="17" y2="15"
                  stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
                  style={{
                    transformOrigin: '10px 15px',
                    transform: mobileMenuOpen ? 'translateY(-5px) rotate(-45deg)' : 'none',
                    transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </svg>
            </button>
            {/* Secondary action — returning users. Hidden at the narrowest width so the
                primary CTA always wins; on mobile, sign-in lives in the menu sheet. */}
            <button
              onClick={goSignIn}
              type="button"
              className={`hidden sm:block px-3 py-2 md:px-4 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition-colors duration-150 active:scale-[0.98] ${
                heroDark
                  ? 'text-zinc-300 hover:text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Log In
            </button>
            {/* Primary CTA — always visible across every breakpoint. Styling owned by
                the shared .lp-cta-primary design-system component. */}
            <button
              onClick={onGetStarted}
              type="button"
              className="lp-cta-primary px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-sm font-semibold"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile menu panel — slide-down glass, md:hidden via CSS ── */}
      <div
        id="lp-mobile-menu"
        role="navigation"
        aria-label="Mobile navigation"
        className={`lp-dark lp-mobile-menu ${mobileMenuOpen ? 'open' : 'closed'}`}
      >
        {/* Stacked nav links */}
        <a href="/" aria-current={currentPath === '/' ? 'page' : undefined} className={`lp-mobile-nav-link${currentPath === '/' ? ' text-rose-500 font-semibold' : ''}`}>Home</a>
        <a href="/features" aria-current={currentPath === '/features' ? 'page' : undefined} className={`lp-mobile-nav-link${currentPath === '/features' ? ' text-rose-500 font-semibold' : ''}`}>Features</a>
        {/* 'Demo' removed 2026-06-28 — /demo was a "coming soon" placeholder; it now redirects to /features. */}
        <button type="button" onClick={() => { setMobileMenuOpen(false); scrollToSection('pricing'); }} className="lp-mobile-nav-link">Pricing</button>
        <button type="button" onClick={() => { setMobileMenuOpen(false); scrollToSection('download'); }} className="lp-mobile-nav-link">Download</button>
        <div className="lp-mobile-divider" />
        <button type="button" onClick={() => { setMobileMenuOpen(false); setIsGuideOpen(true); }} className="lp-mobile-nav-link">Docs</button>
        <a href="/privacy" onClick={() => setMobileMenuOpen(false)} className="lp-mobile-nav-link">Privacy</a>
        <a href="/terms" onClick={() => setMobileMenuOpen(false)} className="lp-mobile-nav-link">Terms</a>
        <div className="lp-mobile-divider" />
        {/* CTAs */}
        <button onClick={onGetStarted} type="button" className="lp-mobile-cta-primary">Get Started</button>
        <button onClick={goSignIn} type="button" className="lp-mobile-cta-ghost">Log In</button>
      </div>

      {/* ── Main content landmark (ADA) ── */}
      <main id="main-content">

      {/* ── Hero Section — Asymmetric Signal ── */}
      {variant === 'home' && (
      <section
        className="lp-dark relative flex items-center min-h-screen overflow-hidden"
        style={{ background: 'var(--lp-hero-navy)' }}
      >
        {/* Signal wave canvas — right 65%, absolute positioned */}
        <canvas
          ref={heroCanvasRef}
          className="hero-signal-canvas"
          style={{ opacity: heroDark ? 1 : 0.2 }}
          aria-hidden="true"
        />

        {/* Grid overlay — radial mask, right-biased */}
        <div className="hero-asymm-grid" aria-hidden="true" />

        {/* Left gradient fade — text readable against canvas glow */}
        <div
          className="hero-asymm-fade"
          style={{
            background: heroDark
              ? 'linear-gradient(90deg, var(--lp-hero-navy) 32%, rgba(15,23,42,0.78) 55%, transparent 80%)'
              : 'linear-gradient(90deg, var(--lp-paper) 32%, rgba(250,250,249,0.78) 55%, transparent 80%)',
          }}
          aria-hidden="true"
        />

        {/* Grain texture — premium feel */}
        <div className="hero-grain-overlay" style={{ opacity: heroDark ? 0.22 : 0.05 }} aria-hidden="true" />

        {/* Text content — left column */}
        <div className="hero-asymm-content">

          {/* Logo mark */}
          <div className="flex items-center gap-3 mb-7 animate-blur-reveal blur-delay-0" aria-label="Pulse">
            <div className="hero-logo-container">
              <QntmEcosIcon size={30} />
            </div>
            <span style={{
              fontFamily: "'Syne', 'Inter', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: '17px',
              letterSpacing: '0.1em',
              color: heroDark ? '#ffffff' : '#1c1917',
              textTransform: 'uppercase',
            }}>PULSE</span>
          </div>

          {/* Badge */}
          <div className="hero-asymm-badge animate-blur-reveal blur-delay-1">
            <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            Comms + memory, one surface
          </div>

          {/* Headline — hard stop at "Every Decision." */}
          <h1
            className="hero-asymm-headline animate-blur-reveal blur-delay-2"
            style={{ color: heroDark ? '#ffffff' : '#1c1917' }}
          >
            <span className="ha-line">Every Signal.</span>
            <span className="ha-line">Every Voice.</span>
            <span className="ha-line ha-gradient">Every Decision.</span>
          </h1>

          {/* Value line — keeps the triplet, adds the plain-language "what is Pulse"
              a cold visitor needs before the CTA. Grounded in shipped features only. */}
          <p
            className="animate-blur-reveal blur-delay-3"
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 'clamp(15px, 1.4vw, 19px)',
              lineHeight: 1.5,
              maxWidth: '30rem',
              marginTop: '-14px',
              marginBottom: '34px',
              color: heroDark ? 'rgba(212,212,216,0.82)' : '#44403c',
            }}
          >
            Real-time messaging, voice notes, and async video — with AI transcription
            and CRM intelligence built into one surface.
          </p>

          {/* Single CTA */}
          <div className="animate-blur-reveal blur-delay-4">
            <button
              onClick={onGetStarted}
              className="hero-asymm-cta"
              type="button"
            >
              Launch Pulse
              <Rocket size={16} />
            </button>
          </div>

        </div>
      </section>

      )}{/* end hero (home only) */}

      {/* ── Light body zone — every section below the dark hero (Logos Vision model) ── */}
      <div className={variant === 'home' ? 'lp-light' : 'bg-[var(--lp-hero-navy)]'}>

      {/* ── Real-product proof band (home) — shows the actual shipped surface, no mockups.
           Sits right under the hero so a cold visitor sees the real app before the CTA repeats.
           Every claim here is visible in the screenshot; keep it that way (no invented proof). ── */}
      {variant === 'home' && (
      <section aria-label="See the real Pulse app" className="py-20 sm:py-24 px-6 border-b border-stone-200/60">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div>
            <div className="hero-asymm-badge mb-5">
              <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              The actual app
            </div>
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 mb-4"
              style={{ fontFamily: "'Syne', 'Inter', system-ui, sans-serif" }}
            >
              Not a mockup. This is Pulse today.
            </h2>
            <p className="text-stone-600 leading-relaxed mb-7 max-w-md">
              Email, SMS, voice and notes land in one Memory surface: searchable, filterable,
              yours. Underneath: Home, Relay, Messages, Decisions. The whole signal, one screen.
            </p>
            <ul className="space-y-3 text-sm text-stone-700">
              <li className="flex items-center gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" aria-hidden="true" />One Memory inbox across every channel</li>
              <li className="flex items-center gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" aria-hidden="true" />Filter by Email · SMS · Voice · Notes · Live</li>
              <li className="flex items-center gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" aria-hidden="true" />Installs as a PWA, already running at pulse.logosvision.org</li>
            </ul>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="relative w-[248px] rounded-[2.25rem] border border-stone-300 bg-stone-900 p-2 shadow-2xl shadow-stone-400/30">
              <div className="overflow-hidden rounded-[1.75rem] bg-white" style={{ aspectRatio: '9 / 18' }}>
                <img
                  src="/screens/pulse-mobile-memory.png"
                  alt="The Pulse app Memory view on mobile: a unified, searchable timeline of messages from every channel — email, Slack, voice and notes — with Filters, Collections and Smart-folder controls and a 50-item memory count."
                  className="w-full h-full object-cover"
                  style={{ objectPosition: '50% 5%' }}
                  loading="lazy"
                  decoding="async"
                  width={415}
                  height={895}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ── Capability strip (home) — breadth grid; deep-links into /features clusters ── */}
      {variant === 'home' && (
      <div className={`border-y ${isDarkMode ? 'bg-zinc-900/40 border-zinc-800/60' : 'bg-stone-100/60 border-stone-200/60'}`}>
        <div className="max-w-6xl mx-auto px-6 pt-4 pb-1 text-center">
          <p className={`text-sm ${isDarkMode ? 'text-zinc-500' : 'text-zinc-500'}`}>One surface. <span className="text-rose-500 font-semibold">Every signal.</span></p>
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {CAPABILITY_CELLS.map((c) => (
            <a
              key={c.name}
              href={`/features#${c.anchor}`}
              className={`group flex flex-col gap-1 px-5 py-5 border-t transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 ${isDarkMode ? 'border-zinc-800/60 hover:bg-zinc-900/60' : 'border-stone-200/70 hover:bg-white'}`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${isDarkMode ? 'bg-zinc-600 group-hover:bg-rose-500' : 'bg-stone-300 group-hover:bg-rose-500'}`} aria-hidden="true" />
                <span className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-zinc-100' : 'text-zinc-900'}`}>{c.name}</span>
              </span>
              <span className={`text-[11px] leading-snug ${isDarkMode ? 'text-zinc-500' : 'text-zinc-500'}`}>{c.blurb}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-wide transition-colors ${isDarkMode ? 'text-zinc-500 group-hover:text-rose-400' : 'text-zinc-500 group-hover:text-rose-600'}`}>{c.stat}</span>
            </a>
          ))}
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-3 pb-4 text-center">
          <a href="/features" className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${isDarkMode ? 'text-zinc-400 hover:text-rose-400' : 'text-zinc-500 hover:text-rose-600'}`}>Explore every feature <span aria-hidden="true">→</span></a>
        </div>
      </div>
      )}

      {/* ── Features-route hero + sticky cluster sub-nav (features only) ── */}
      {variant === 'features' && (
      <div>
        <section className="relative px-6 pt-32 pb-14 overflow-hidden" style={{ background: isDarkMode ? 'var(--lp-hero-navy)' : 'var(--lp-paper)' }}>
          <div className="hero-asymm-grid" aria-hidden="true" />
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="hero-asymm-badge mb-5">
              <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              Everything Pulse does
            </div>
            <h1 className={`text-4xl sm:text-6xl font-bold tracking-tight mb-4 ${isDarkMode ? 'text-white' : 'text-zinc-900'}`} style={{ letterSpacing: '-0.03em' }}>Four moves, one surface.</h1>
            <p className={`text-lg max-w-2xl ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>Communicate, decide, relate, operate. Every Pulse capability, grouped by the job it does.</p>
          </div>
        </section>
        {/* Sticky cluster tab nav removed 2026-06-29 — the journey's breadcrumb
            spine (desktop) / cluster chip rail (mobile) is now the navigator. */}
      </div>
      )}

      {/* ── Demo route placeholder (demo only) ── */}
      {variant === 'demo' && (
      <section className="relative flex items-center min-h-screen overflow-hidden px-6" style={{ background: isDarkMode ? 'var(--lp-hero-navy)' : 'var(--lp-paper)' }}>
        <div className="hero-asymm-grid" aria-hidden="true" />
        <div className="hero-grain-overlay" style={{ opacity: isDarkMode ? 0.22 : 0.05 }} aria-hidden="true" />
        <div className="max-w-3xl mx-auto text-center relative z-10 pt-24 pb-16">
          <div className="hero-asymm-badge mx-auto mb-6" style={{ width: 'fit-content' }}>
            <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            Live demo
          </div>
          <h1 className={`text-5xl sm:text-7xl font-bold tracking-tight mb-6 ${isDarkMode ? 'text-white' : 'text-zinc-900'}`} style={{ letterSpacing: '-0.03em' }}>See Pulse in motion.</h1>
          <p className={`text-lg sm:text-xl mb-10 max-w-xl mx-auto leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>An interactive, click-through demo of the full Pulse workspace is on the way. Until then, take the feature tour or jump straight into the app.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button type="button" onClick={onGetStarted} className="hero-asymm-cta">Launch Pulse <Rocket size={16} /></button>
            <a href="/features" className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border transition-colors ${isDarkMode ? 'border-zinc-700 text-zinc-200 hover:border-rose-500/60 hover:text-white' : 'border-stone-300 text-stone-700 hover:border-rose-500/60 hover:text-stone-900'}`}>Explore features <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </section>
      )}

      {/* ── Feature Showcase (features route only) ── */}
      {variant === 'features' && (<>
      {/* Feature journey — sliding gallery replaces the downward feature stack.
          Renders id="features" itself, so the deep-link anchor is preserved. See
          _design-playground/HANDOFF-features-gallery.md. */}
      <Suspense fallback={<div style={{ minHeight: '60vh' }} aria-hidden="true" />}>
        <FeaturesJourney />
      </Suspense>

{/* ── G + F: Mobile Preview + Keyboard Shortcuts ── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 50%, rgba(244,63,94,0.06) 0%, transparent 55%)' }} />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl mx-auto">

            {/* G: Mobile App Preview — consolidated into the closing "Wherever you are" CTA; SHOW_INLINE_MOBILE_PREVIEW re-enables */}
            {SHOW_INLINE_MOBILE_PREVIEW && (
            <div className="flex flex-col items-center">
              <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 text-xs font-bold uppercase tracking-widest mb-4">
                  <Smartphone className="text-zinc-400" /> Mobile App
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Pulse in Your Pocket</h2>
                <p className="text-zinc-400 text-base max-w-sm mx-auto">The full Pulse experience in your pocket. Voice messages, AI briefings, decisions, and meetings. Native on Android.</p>
              </div>
              {/* Phone frame */}
              <div className="relative" style={{ width: '260px', height: '540px' }}>
                {/* Outer shell */}
                <div className="absolute inset-0 rounded-[44px] border-[7px] border-zinc-700 bg-zinc-950 shadow-2xl" style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset' }} />
                {/* Dynamic island / notch */}
                <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[80px] h-[22px] bg-zinc-900 rounded-full z-20 border border-zinc-800" />
                {/* Screen content */}
                <div className="absolute inset-[7px] rounded-[37px] overflow-hidden bg-zinc-950 z-10">
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-5 pt-8 pb-2">
                    <span className="text-[9px] font-bold text-zinc-400">9:41</span>
                    <div className="flex items-center gap-1">
                      <Signal className="text-[8px] text-zinc-400" />
                      <Wifi className="text-[8px] text-zinc-400" />
                      <Battery className="text-[8px] text-zinc-400" />
                    </div>
                  </div>
                  {/* App header */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <svg viewBox="0 0 64 64" className="w-5 h-5">
                        <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="#f43f5e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      </svg>
                      <span className="text-xs font-bold text-white">Pulse</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center">
                        <Bell className="text-[7px] text-rose-400" />
                      </div>
                      <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center">
                        <Search className="text-[7px] text-zinc-400" />
                      </div>
                    </div>
                  </div>
                  {/* AI Briefing card */}
                  <div className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-r from-rose-500/15 to-pink-500/10 border border-rose-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Wand2 className="text-[9px] text-rose-400" />
                      <span className="text-[9px] font-bold text-rose-300">AI Briefing Ready</span>
                    </div>
                    <p className="text-[8px] text-zinc-400 leading-relaxed">3 urgent emails, 2 pending decisions, 1 meeting in 40 min</p>
                  </div>
                  {/* Message list */}
                  <div className="px-3 mt-3 space-y-2">
                    {[
                      { name: 'Sarah K.', msg: 'Direct voice · 2 min ago', time: '2m', dot: '#f43f5e', icon: Mic },
                      { name: 'Dev Team', msg: 'Sprint planning at 3 PM confirmed', time: '18m', dot: '#6366f1', icon: MessageSquare },
                      { name: 'Calendar', msg: 'Team standup in 15 min', time: '15m', dot: '#6366f1', icon: Calendar },
                    ].map((m, i) => (
                      <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${m.dot}20`, border: `1px solid ${m.dot}40` }}>
                          <m.icon size={10} style={{ color: m.dot }} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-bold text-white truncate">{m.name}</div>
                          <div className="text-[8px] text-zinc-500 truncate">{m.msg}</div>
                        </div>
                        <span className="text-[7px] text-zinc-600 shrink-0">{m.time}</span>
                      </div>
                    ))}
                  </div>
                  {/* Bottom nav */}
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-3 py-3 bg-zinc-950 border-t border-zinc-800">
                    {[
                      { icon: Home, active: false },
                      { icon: MessageSquare, active: false },
                      { icon: Mic, active: true },
                      { icon: Calendar, active: false },
                      { icon: User, active: false },
                    ].map((n, i) => (
                      <div key={i} className={`flex items-center justify-center w-8 h-8 rounded-xl ${n.active ? 'bg-rose-500' : ''}`}>
                        <n.icon size={14} className={n.active ? 'text-white' : 'text-zinc-600'} aria-hidden="true" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* F: Keyboard Shortcuts Quick-Ref */}
            <div>
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 text-xs font-bold uppercase tracking-widest mb-4">
                  <Keyboard className="text-zinc-400" /> Shortcuts
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Built for Speed</h2>
                <p className="text-zinc-400 text-base mb-6">Navigate every corner of Pulse without touching your mouse. Full shortcut coverage across all modules.</p>
                <button
                  type="button"
                  onClick={() => setShortcutsOpen(p => !p)}
                  className="flex items-center gap-2 text-sm font-semibold text-rose-400 hover:text-rose-300 transition"
                >
                  <ChevronDown size={14} className={`transition-transform duration-200 ${shortcutsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  {shortcutsOpen ? 'Collapse cheatsheet' : 'Expand full cheatsheet'}
                </button>
              </div>

              {/* Always-visible top shortcuts */}
              <div className="flex flex-wrap gap-2 mb-5">
                {[
                  { keys: ['Ctrl', 'K'], desc: 'Search' },
                  { keys: ['Ctrl', '/'], desc: 'AI Assistant' },
                  { keys: ['Ctrl', 'Shift', 'P'], desc: 'Command Palette' },
                  { keys: ['?'], desc: 'Help' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <div className="flex items-center gap-1">
                      {s.keys.map(k => (
                        <kbd key={k} className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono font-bold text-zinc-300">{k}</kbd>
                      ))}
                    </div>
                    <span className="text-xs text-zinc-500">{s.desc}</span>
                  </div>
                ))}
              </div>

              {/* Expandable full cheatsheet */}
              {shortcutsOpen && (
                <div className="grid sm:grid-cols-2 gap-4 animate-fade-in">
                  {SHORTCUT_GROUPS.map((group) => (
                    <div key={group.label} className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                      <div className="flex items-center gap-2 mb-3">
                        <group.icon size={14} className="text-rose-500 shrink-0" aria-hidden="true" />
                        <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">{group.label}</span>
                      </div>
                      <div className="space-y-2">
                        {group.shortcuts.map((s, si) => (
                          <div key={si} className="flex items-center justify-between gap-3">
                            <span className="text-[11px] text-zinc-500">{s.desc}</span>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {s.keys.map(k => (
                                <kbd key={k} className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono font-bold text-zinc-300">{k}</kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Ecosystem (Trinity) Section ── */}
      <section id="ecosystem" className="lp-light py-24 px-6 border-b border-zinc-800/50 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-3xl sm:text-5xl font-bold mb-6 text-zinc-50">The Trinity of Productivity</h2>
            <p className="text-zinc-400 text-lg max-w-3xl mx-auto">
              Pulse is live today. Two more systems are on the way — together, an ecosystem that handles communication, relationships, and meeting intelligence end to end.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Pulse Card */}
            <div className="relative group animate-fade-in animation-delay-200">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/30 to-pink-500/25 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"></div>
              <div className="relative h-full bg-zinc-950/90 backdrop-blur-sm border border-zinc-800 rounded-3xl hover:border-rose-500/60 transition-all duration-150 flex flex-col hover:-translate-y-0.5 card-elevated-rose overflow-hidden">
                <div className="flex items-center justify-center h-24 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-b border-rose-500/15 group-hover:from-rose-500/15 transition-colors duration-150">
                  {/* Pulse — Globe·Solid mark (rose→pink disc with knockout heartbeat). Canonical brand asset. */}
                  <svg viewBox="0 0 240 240" width="54" height="54" fill="none" aria-hidden="true" style={{ filter: 'drop-shadow(0 0 10px rgba(244,63,94,0.35))' }}>
                    <defs>
                      <linearGradient id="pulseGlobeGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#f43f5e"/><stop offset="1" stopColor="#ec4899"/>
                      </linearGradient>
                      <mask id="pulseGlobeCut">
                        <rect x="0" y="0" width="240" height="240" fill="#fff"/>
                        <path d="M-2.71 120 H92.96 L109.29 87.76 L128.01 152.24 L144.02 120 H242.71" fill="none" stroke="#000" strokeWidth="7.49" strokeLinecap="round" strokeLinejoin="round"/>
                      </mask>
                    </defs>
                    <circle cx="120" cy="120" r="103.99" fill="url(#pulseGlobeGrad)" mask="url(#pulseGlobeCut)"/>
                  </svg>
                </div>
                <div className="p-8 flex flex-col flex-grow">
                  <h3 className="text-2xl font-bold mb-4 text-white">Pulse</h3>
                  <div className="text-sm font-bold text-rose-500 tracking-wider uppercase mb-4">Communication and Intelligence</div>
                  <p className="text-zinc-400 mb-6 flex-grow">The voice and ears of your organisation. Real-time messaging, 5 Relay peers + Triage stream, Glimpse async video, calendar, maps, and analytics in one interface.</p>
                  <ul className="space-y-3 text-zinc-300 text-sm">
                    <li className="flex items-center gap-2"><Check className="text-rose-500" /> 5 Relay Peers + Glimpse + AI Transcription</li>
                    <li className="flex items-center gap-2"><Check className="text-rose-500" /> War Room with 8 Slash Commands</li>
                    <li className="flex items-center gap-2"><Check className="text-rose-500" /> Messaging, Calendar, Maps, Contacts</li>
                    <li className="flex items-center gap-2"><Check className="text-rose-500" /> 3 AI Providers (Gemini, Claude, OpenAI)</li>
                    <li className="flex items-center gap-2"><Check className="text-rose-500" /> Predictive Analytics Dashboard</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Logos Vision Card */}
            <div className="relative group animate-fade-in animation-delay-300">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-400/25 to-teal-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"></div>
              <div className="relative h-full bg-zinc-950/90 backdrop-blur-sm border border-zinc-800 rounded-3xl hover:border-teal-400/60 transition-all duration-150 flex flex-col hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(34,166,164,0.25)] card-elevated overflow-hidden">
                <div className="flex items-center justify-center h-24 bg-gradient-to-br from-teal-400/10 via-teal-400/5 to-transparent border-b border-teal-400/15 group-hover:from-teal-400/15 transition-colors duration-150">
                  {/* Logos Vision — Orbital Core mark (patina→terracotta ring + terracotta core). Canonical brand asset (Terracotta + Patina). */}
                  <svg viewBox="0 0 80 80" width="52" height="52" fill="none" aria-hidden="true" style={{ filter: 'drop-shadow(0 0 10px rgba(82,181,166,0.35))' }}>
                    <defs>
                      <linearGradient id="lvOrbitGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#52B5A6"/><stop offset="1" stopColor="#D4765A"/>
                      </linearGradient>
                    </defs>
                    <circle cx="40" cy="40" r="24" fill="none" stroke="url(#lvOrbitGrad)" strokeWidth="9"/>
                    <circle cx="40" cy="40" r="11" fill="#D4765A"/>
                  </svg>
                </div>
                <div className="p-8 flex flex-col flex-grow">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-2xl font-bold text-white">Logos Vision</h3>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border"
                      style={{
                        color: isDarkMode ? '#5eead4' : '#0f766e',
                        background: isDarkMode ? 'rgba(45,212,191,0.15)' : 'rgba(13,148,136,0.10)',
                        borderColor: isDarkMode ? 'rgba(45,212,191,0.30)' : 'rgba(13,148,136,0.30)',
                      }}
                    >Coming 2026</span>
                  </div>
                  <div className="text-sm font-bold text-teal-400 tracking-wider uppercase mb-4">CRM and Relationships</div>
                  <p className="text-zinc-400 mb-6 flex-grow">The memory of your organization. Deep relationship intelligence with health scoring and native CRM integrations you'll log interactions to in one click.</p>
                  <ul className="space-y-3 text-zinc-300 text-sm">
                    <li className="flex items-center gap-2"><Check className="text-teal-400" /> 0-100 Relationship Scoring</li>
                    <li className="flex items-center gap-2"><Check className="text-teal-400" /> Native CRM Integrations</li>
                    <li className="flex items-center gap-2"><Check className="text-teal-400" /> Network Visualization</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Entomate Card — brand: Void × Crimson v2.0
                Primary: Electric Crimson #FF2D6B · Secondary: Neon Mint #00F5D4 · Tertiary: Amber #FFB800 · Phosphor #A0FF32
                Subtitle uses Amber so it occupies a distinct visual slot in the Trinity row (Pulse = rose, LV = teal, Entomate = amber).
                Crimson leads the icon band + hover state where it ties to the logo's red hands. */}
            <div className="relative group animate-fade-in animation-delay-400">
              <div className="absolute inset-0 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]" style={{background: 'radial-gradient(ellipse at 50% 30%, rgba(255,45,107,0.24) 0%, rgba(255,184,0,0.12) 55%, rgba(0,245,212,0.08) 80%, transparent 100%)'}}></div>
              <div className="relative h-full bg-zinc-950/90 backdrop-blur-sm border border-zinc-800 rounded-3xl transition-all duration-150 flex flex-col hover:-translate-y-0.5 card-elevated overflow-hidden" style={{'--tw-border-opacity': '1'} as React.CSSProperties} onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,45,107,0.45)', e.currentTarget.style.boxShadow = '0 8px 32px rgba(255,45,107,0.22), 0 0 0 1px rgba(255,184,0,0.12)')} onMouseLeave={e => (e.currentTarget.style.borderColor = '', e.currentTarget.style.boxShadow = '')}>
                <div className="flex items-center justify-center h-24 border-b transition-colors duration-150 relative overflow-hidden" style={{background: 'linear-gradient(135deg, rgba(255,45,107,0.16) 0%, rgba(255,184,0,0.07) 55%, rgba(0,245,212,0.05) 100%)', borderColor: 'rgba(255,45,107,0.22)'}}>
                  {/* Brand color washes — amber + mint corners so all three brand voices register, not just crimson */}
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 12% 30%, rgba(255,184,0,0.12) 0%, transparent 40%), radial-gradient(circle at 88% 70%, rgba(0,245,212,0.10) 0%, transparent 40%)' }} aria-hidden="true" />
                  {/* Phosphor "live" pulse — hover-only so it doesn't compete at rest */}
                  <div className="absolute top-2 right-3 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" aria-hidden="true">
                    <span className="w-1 h-1 rounded-full" style={{ background: '#A0FF32', boxShadow: '0 0 6px rgba(160,255,50,0.7)' }} />
                  </div>
                  {/* Entomate — canonical circuit-E mark (crimson→pink bars + circuit traces
                      and nodes). Vector inline so the tile stays light, matching its Pulse
                      (Globe) and Logos Vision (Orbital Core) siblings. Void × Crimson v2.0. */}
                  <svg
                    viewBox="0 0 160 160" width="54" height="54" fill="none"
                    className="relative z-10"
                    style={{ filter: 'drop-shadow(0 0 10px rgba(255,45,107,0.35))' }}
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="entEGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#FF2D6B"/><stop offset="1" stopColor="#FF6699"/>
                      </linearGradient>
                    </defs>
                    <rect x="67.20" y="40.00" width="67.20" height="17.60" rx="4.00" fill="url(#entEGrad)"/>
                    <rect x="67.20" y="71.20" width="48.00" height="17.60" rx="4.00" fill="url(#entEGrad)"/>
                    <rect x="67.20" y="102.40" width="60.80" height="17.60" rx="4.00" fill="url(#entEGrad)"/>
                    <path d="M28.80 80.00 H67.20" fill="none" stroke="#FF2D6B" strokeWidth="3.84" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16.00 35.20 H48.00 V48.80 H67.20" fill="none" stroke="#FF2D6B" strokeWidth="3.84" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16.00 124.80 H48.00 V111.20 H67.20" fill="none" stroke="#FF2D6B" strokeWidth="3.84" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="16.00" cy="35.20" r="5.44" fill="none" stroke="#FF2D6B" strokeWidth="3.84"/>
                    <circle cx="28.80" cy="80.00" r="5.44" fill="none" stroke="#FF2D6B" strokeWidth="3.84"/>
                    <circle cx="16.00" cy="124.80" r="5.44" fill="none" stroke="#FF2D6B" strokeWidth="3.84"/>
                    <circle cx="48.00" cy="48.80" r="3.52" fill="#FF2D6B"/>
                    <circle cx="48.00" cy="111.20" r="3.52" fill="#FF2D6B"/>
                  </svg>
                </div>
                <div className="p-8 flex flex-col flex-grow">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-2xl font-bold text-white">Entomate</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: isDarkMode ? 'rgba(255,184,0,0.15)' : 'rgba(180,83,9,0.10)', color: isDarkMode ? '#FFD166' : '#b45309', border: `1px solid ${isDarkMode ? 'rgba(255,184,0,0.30)' : 'rgba(180,83,9,0.30)'}` }}>Coming 2027</span>
                  </div>
                  <div
                    className="text-[11px] font-semibold uppercase mb-4"
                    style={{ color: '#FFB800', fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.18em' }}
                  >
                    Meeting Intelligence and Workflows
                  </div>
                  <p className="text-zinc-400 mb-6 flex-grow leading-relaxed">
                    The intelligence layer of your organization. A bot will join your meetings, transcribe, and extract decisions and actions. Daily briefings flag blockers before standup, and visual workflows execute the follow-through across your stack.
                  </p>
                  <ul className="space-y-3 text-zinc-300 text-sm">
                    <li className="flex items-center gap-2"><Check style={{color: '#FF2D6B'}} /> Meet Mate bot · Recall.ai + Deepgram</li>
                    <li className="flex items-center gap-2"><Check style={{color: '#FFB800'}} /> Daily Briefings + Predictive Risk</li>
                    <li className="flex items-center gap-2"><Check style={{color: '#00F5D4'}} /> Visual Workflows + Cross-App Actions</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      </>)}{/* end feature showcase (features only) */}

      {/* ── Home conversion tail (home only): scenarios · download · pricing · FAQ ── */}
      {variant === 'home' && (<>
      {/* ── Use-Case Scenarios ── */}
      <section id="scenarios" className="py-24 px-6 bg-gradient-to-b from-zinc-900/20 to-zinc-950 border-b border-zinc-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-3xl sm:text-5xl font-bold mb-6 text-zinc-50">How it works.</h2>
            <p className="text-zinc-400 text-lg mb-8">Drop a voice note. Pulse transcribes, summarizes, and routes it — your recipient replies in one tap.</p>

            {/* Scenario toggle — only shown when the Enterprise flow is enabled (SHOW_ENTERPRISE_SCENARIO) */}
            {SHOW_ENTERPRISE_SCENARIO && (
            <div className="inline-flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setActiveScenario('enterprise')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition ${activeScenario === 'enterprise' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-400 hover:text-white'}`}
                type="button"
              >
                Enterprise Flow
              </button>
              <button
                onClick={() => setActiveScenario('voice')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition ${activeScenario === 'voice' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-400 hover:text-white'}`}
                type="button"
              >
                Voice-First Flow
              </button>
            </div>
            )}
          </div>

          {SHOW_ENTERPRISE_SCENARIO && activeScenario === 'enterprise' ? (
            <div className="relative">
              <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-rose-500/50 to-transparent -translate-y-1/2 z-0"></div>
              <div className="grid lg:grid-cols-4 gap-6 relative z-10">
                {[
                  { num: '1', system: 'PULSE', badgeClass: 'from-rose-500 to-pink-500', labelClass: 'text-rose-400', borderClass: 'hover:border-rose-500/40', title: 'The Signal', body: 'A high-priority email from a key client lands. Pulse flags it "Urgent", extracts requirements, and routes it to the grants channel with an AI summary.' },
                  { num: '2', system: 'LOGOS VISION', badgeClass: 'from-cyan-500 to-cyan-600', labelClass: 'text-cyan-400', borderClass: 'hover:border-cyan-500/40', title: 'The Context', body: 'The system links the message to the Client Record, pulling past grant history, success rates, and the assigned relationship manager automatically.' },
                  { num: '3', system: 'ENTOMATE', badgeClass: 'from-emerald-500 to-emerald-600', labelClass: 'text-emerald-400', borderClass: 'hover:border-emerald-500/40', title: 'The Action', body: 'An Apply workflow fires. A task is created for the Grant Writer, a kickoff meeting is scheduled based on availability, and an acknowledgment email is drafted.' },
                  { num: '4', system: 'WAR ROOM', badgeClass: 'from-rose-500 to-rose-600', labelClass: 'text-rose-400', borderClass: 'hover:border-rose-500/40', title: 'The Intelligence', body: 'The War Room researches grant requirements, compares past applications using your uploaded sources, and outputs a polished grant proposal draft in minutes.' },
                ].map((step) => (
                  <div key={step.num} className={`bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 p-7 rounded-2xl relative hover:-translate-y-0.5 transition-all duration-300 card-elevated ${step.borderClass} group animate-fade-in`}>
                    <div className={`absolute -top-4 -right-4 w-8 h-8 bg-gradient-to-br ${step.badgeClass} rounded-full flex items-center justify-center text-white font-bold shadow-lg text-sm`}>{step.num}</div>
                    <div className={`font-bold mb-2 text-xs tracking-wider ${step.labelClass}`}>{step.system}</div>
                    <h4 className="text-lg font-bold text-white mb-3">{step.title}</h4>
                    <p className="text-zinc-400 text-sm leading-relaxed">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative max-w-5xl mx-auto">
              {/* Coral spine — connects the step nodes (desktop only) */}
              <div className="hidden lg:block absolute top-8 left-[12%] right-[12%] h-px bg-gradient-to-r from-rose-500/0 via-rose-500/45 to-rose-500/0" aria-hidden="true"></div>
              <ol className="grid lg:grid-cols-3 gap-x-8 gap-y-12">
                {[
                  { kicker: 'Relay Direct', title: 'Drop and go', body: "You're driving. One tap records a Relay Direct, scheduled to deliver when your recipient is most active." },
                  { kicker: 'AI Transcription', title: 'Instant intelligence', body: 'On delivery, Pulse transcribes, summarizes, extracts action items, and scores sentiment, all before the recipient presses play.' },
                  { kicker: 'Smart Reply', title: 'One-tap response', body: 'They see the transcript and summary, pick a smart reply, and answer with a 10-second note. Full async conversation, zero context lost.' },
                ].map((step, i) => (
                  <li key={step.kicker} className="relative flex flex-col items-center text-center animate-fade-in">
                    <div className="relative z-10 mb-5 w-16 h-16 rounded-full flex items-center justify-center border-2 border-rose-500/40 bg-zinc-950">
                      <span className="text-2xl font-bold text-rose-400" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>{i + 1}</span>
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>{step.kicker}</span>
                    <h4 className="text-xl font-bold text-white mb-2.5">{step.title}</h4>
                    <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">{step.body}</p>
                    {i < 2 && <div className="lg:hidden mt-9 text-lg text-rose-500/40" aria-hidden="true">↓</div>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      {/* ── Pricing Section — single-tier Pulse Team ── */}
      <section id="pricing" className="py-24 px-6 border-t border-zinc-800/50 relative overflow-hidden">
        {/* Background glow — rose/pink brand accent */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-rose-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-fuchsia-500/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Section header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/50 text-rose-400 text-xs font-bold uppercase tracking-widest mb-4">
              <Tag size={11} aria-hidden="true" /> Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Pricing that starts with you.</h2>
            <p className="text-zinc-400 text-base max-w-xl mx-auto">
              Start solo at $20/mo. Add teammates at $15 a seat when you're ready. Nothing wasted.
            </p>
          </div>

          {/* Monthly / Yearly toggle — single coral pill slides between the
              two buttons instead of swapping per-button gradients. Tactile
              and quieter; matches the rest of the page's 220ms ease-out-expo
              motion system. */}
          <div
            className="mx-auto mb-10 relative grid grid-cols-2 items-center p-1 rounded-xl bg-zinc-900/70 border border-zinc-800"
            role="tablist"
            aria-label="Billing cycle"
            style={{ width: '320px' }}
          >
            {/* Sliding indicator — sits behind the labels, translates between
                the two grid cells. left:4px / right:4px / top:4px / bottom:4px
                respect the 1px container padding so the pill matches each
                button's hit area. */}
            <span
              aria-hidden="true"
              className="absolute top-1 bottom-1 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 shadow-lg shadow-rose-500/20"
              style={{
                left: '4px',
                width: 'calc(50% - 4px)',
                transform: pricingCycle === 'yearly' ? 'translateX(100%)' : 'translateX(0)',
                transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: 'transform',
              }}
            />
            <button
              type="button"
              role="tab"
              aria-selected={pricingCycle === 'monthly'}
              onClick={() => setPricingCycle('monthly')}
              className={`relative z-10 px-5 py-2 rounded-lg text-sm font-medium ${
                pricingCycle === 'monthly' ? 'text-white' : 'text-zinc-400 hover:text-white'
              }`}
              style={{ transition: 'color 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              Monthly
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pricingCycle === 'yearly'}
              onClick={() => setPricingCycle('yearly')}
              className={`relative z-10 px-5 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                pricingCycle === 'yearly' ? 'text-white' : 'text-zinc-400 hover:text-white'
              }`}
              style={{ transition: 'color 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              Yearly
              <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                pricingCycle === 'yearly'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
              }`} style={{ transition: 'background-color 220ms cubic-bezier(0.16, 1, 0.3, 1), color 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
                2 months free
              </span>
            </button>
          </div>

          {/* Three-tier pricing — Solo (entry/highlighted) · Team (per-seat) · Growth */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">

            {/* ─── Pulse Solo — Lane-A entry tier, highlighted ─── */}
            {/* md:order-2 centers the highlighted/recommended tier on desktop so
                visual emphasis matches position; mobile keeps it first (entry). */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-rose-500/10 flex flex-col md:order-2">
              <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-500" aria-hidden="true" />
              <div className="lp-pricing-featured bg-gradient-to-br from-zinc-950 to-zinc-900 border-x border-b border-zinc-700/60 rounded-b-2xl p-8 sm:p-10 space-y-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Pulse Solo</p>
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        Start here
                      </span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white">
                      ${pricingCycle === 'monthly' ? PULSE_SOLO_PRICING.monthly : PULSE_SOLO_PRICING.yearlyMonthlyEquiv}
                      <span className="text-base font-normal text-zinc-400">/mo</span>
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1.5">
                      {pricingCycle === 'monthly'
                        ? `1 seat · Billed monthly · ${PULSE_SOLO_PRICING.trialDays} days free`
                        : `1 seat · $${PULSE_SOLO_PRICING.yearly.toLocaleString()}/yr · 2 months free · ${PULSE_SOLO_PRICING.trialDays} days free`}
                    </p>
                  </div>
                  <div className="hidden sm:flex w-14 h-14 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 items-center justify-center flex-shrink-0 shadow-lg shadow-rose-500/30">
                    <HeartPulse size={26} className="text-white" />
                  </div>
                </div>

                <ul className="space-y-3 pt-2 flex-1">
                  {PULSE_SOLO_FEATURES.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm text-zinc-200">
                      <Check size={18} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={onGetStarted}
                  className="lp-cta-primary w-full py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-500 hover:via-pink-500 hover:to-rose-500 text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Rocket size={16} aria-hidden="true" />
                  Launch Pulse
                </button>
              </div>
            </div>

            {/* ─── Pulse Team — per-seat scale-up tier ─── */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40 flex flex-col md:order-1">
              <div className="h-1 bg-rose-700" aria-hidden="true" />
              <div className="bg-zinc-950 border-x border-b border-zinc-800 rounded-b-2xl p-8 sm:p-10 space-y-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Pulse Team</p>
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        Min 2 seats
                      </span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-zinc-50">
                      ${pricingCycle === 'monthly' ? PULSE_TEAM_PRICING.monthly : PULSE_TEAM_PRICING.yearlyMonthlyEquiv}
                      <span className="text-base font-normal text-zinc-400">/seat/mo</span>
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1.5">
                      {pricingCycle === 'monthly'
                        ? `Per seat · Billed monthly · ${PULSE_TEAM_PRICING.trialDays} days free`
                        : `$${PULSE_TEAM_PRICING.yearly.toLocaleString()}/seat/yr · 2 months free · ${PULSE_TEAM_PRICING.trialDays} days free`}
                    </p>
                  </div>
                  <div className="hidden sm:flex w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center flex-shrink-0">
                    <Users size={26} className="text-rose-500" />
                  </div>
                </div>

                {/* Seat stepper — makes the real Team cost unmissable so the
                    "$15/seat" headline can't be misread as the $30 floor. */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-medium text-zinc-400">Seats</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Remove a seat"
                        onClick={() => setTeamSeats((s) => Math.max(2, s - 1))}
                        disabled={teamSeats <= 2}
                        className="w-7 h-7 rounded-lg border border-zinc-700 text-zinc-300 flex items-center justify-center text-base leading-none transition-transform duration-150 ease-out hover:border-rose-500/50 hover:text-white active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                      >
                        &#8722;
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-zinc-50 tabular-nums" aria-live="polite">{teamSeats}</span>
                      <button
                        type="button"
                        aria-label="Add a seat"
                        onClick={() => setTeamSeats((s) => Math.min(50, s + 1))}
                        disabled={teamSeats >= 50}
                        className="w-7 h-7 rounded-lg border border-zinc-700 text-zinc-300 flex items-center justify-center text-base leading-none transition-transform duration-150 ease-out hover:border-rose-500/50 hover:text-white active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-zinc-50 tabular-nums">
                      ${((pricingCycle === 'monthly' ? PULSE_TEAM_PRICING.monthly : PULSE_TEAM_PRICING.yearlyMonthlyEquiv) * teamSeats).toLocaleString()}
                    </span>
                    <span className="text-xs text-zinc-500">/mo total</span>
                  </div>
                </div>

                <ul className="space-y-3 pt-2 flex-1">
                  {PULSE_TEAM_FEATURES.map((feat) => (
                    feat.endsWith('plus:') ? (
                      <li key={feat} className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 pb-1">
                        {feat}
                      </li>
                    ) : (
                      <li key={feat} className="flex items-start gap-3 text-sm text-zinc-200">
                        <Check size={18} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <span>{feat}</span>
                      </li>
                    )
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={onGetStarted}
                  className="w-full py-3.5 rounded-xl bg-transparent border border-rose-500/40 hover:border-rose-500 hover:bg-rose-500/10 text-rose-300 hover:text-rose-200 font-semibold text-sm transition-[color,background-color,border-color,transform] duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Rocket size={16} aria-hidden="true" />
                  Start with Team
                </button>
              </div>
            </div>

            {/* ─── Pulse Growth ─── */}
            {/* DESIGN.md §2 Coral-As-Signal: Growth differentiates from Team via
                chrome (deeper surface, mono-label tag), not a competing palette.
                Replaces the previous violet/purple/indigo gradient stack that
                detector flagged as the AI-startup anti-reference. */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40 flex flex-col md:order-3">
              <div className="h-1 bg-rose-700" aria-hidden="true" />
              <div className="bg-zinc-950 border-x border-b border-zinc-800 rounded-b-2xl p-8 sm:p-10 space-y-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Pulse Growth</p>
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        For growing orgs
                      </span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-zinc-50">
                      ${pricingCycle === 'monthly' ? PULSE_GROWTH_PRICING.monthly : PULSE_GROWTH_PRICING.yearlyMonthlyEquiv}
                      <span className="text-base font-normal text-zinc-400">/mo</span>
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1.5">
                      {pricingCycle === 'monthly'
                        ? `Billed monthly · ${PULSE_GROWTH_PRICING.trialDays} days free`
                        : `$${PULSE_GROWTH_PRICING.yearly.toLocaleString()}/yr · 2 months free · ${PULSE_GROWTH_PRICING.trialDays} days free`}
                    </p>
                  </div>
                  <div className="hidden sm:flex w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center flex-shrink-0">
                    <HeartPulse size={26} className="text-rose-500" />
                  </div>
                </div>

                <ul className="space-y-3 pt-2 flex-1">
                  {PULSE_GROWTH_FEATURES.map((feat) => {
                    if (feat.endsWith('plus:')) {
                      return (
                        <li key={feat} className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 pb-1">
                          {feat}
                        </li>
                      );
                    }
                    if (feat.includes('coming soon')) {
                      const label = feat.replace(/,?\s*coming soon/i, '');
                      return (
                        <li key={feat} className="flex items-start gap-3 text-sm text-zinc-500">
                          <span className="mt-1 w-3.5 h-3.5 rounded-full border border-dashed border-zinc-600 flex-shrink-0" aria-hidden="true" />
                          <span>
                            {label}
                            <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">Soon</span>
                          </span>
                        </li>
                      );
                    }
                    return (
                      <li key={feat} className="flex items-start gap-3 text-sm text-zinc-200">
                        <Check size={18} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <span>{feat}</span>
                      </li>
                    );
                  })}
                </ul>

                <button
                  type="button"
                  onClick={onGetStarted}
                  className="w-full py-3.5 rounded-xl bg-transparent border border-rose-500/40 hover:border-rose-500 hover:bg-rose-500/10 text-rose-300 hover:text-rose-200 font-semibold text-sm transition-[color,background-color,border-color,transform] duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Rocket size={16} aria-hidden="true" />
                  Start with Growth
                </button>
              </div>
            </div>
          </div>

          {/* Compare-all matrix — progressive disclosure. One place to scan
              every tier's limits side by side, so higher tiers don't force the
              buyer to recall a different card. Every value is verified against
              the enforced plan migrations (see PULSE_PLAN_MATRIX). */}
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setShowCompare((v) => !v)}
              aria-expanded={showCompare}
              aria-controls="plan-compare"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
            >
              {showCompare ? 'Hide comparison' : 'Compare all plans'}
              <ChevronDown size={14} className={`transition-transform duration-300 ${showCompare ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>

          {showCompare && (
            <div id="plan-compare" className="mt-4 overflow-x-auto animate-fade-in">
              <table className="w-full max-w-3xl mx-auto border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left font-medium text-zinc-500 py-3 pr-4"></th>
                    {PULSE_PLAN_MATRIX.tiers.map((t, i) => (
                      <th key={t} className={`text-center font-bold py-3 px-3 ${i === 0 ? 'text-rose-300' : 'text-zinc-200'}`}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PULSE_PLAN_MATRIX.rows.map((row) => (
                    <tr key={row.label} className="border-b border-zinc-800/60">
                      <td className="text-left text-zinc-400 py-3 pr-4">{row.label}</td>
                      {row.values.map((v, i) => (
                        <td key={i} className="text-center py-3 px-3">
                          {v === true ? (
                            <Check size={16} className="text-emerald-400 inline" aria-label="Included" />
                          ) : v === false ? (
                            <span className="text-zinc-600" aria-label="Not included">&#8212;</span>
                          ) : (
                            <span className="text-zinc-200 tabular-nums">{v}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-center text-xs text-zinc-500 mt-6 px-4 max-w-5xl mx-auto">
            No credit card required to start. Cancel anytime. Secure checkout via Stripe.
          </p>
        </div>
      </section>

      {/* ── D: FAQ Accordion ── */}
      <section className="py-20 px-6 bg-zinc-900/20 border-t border-zinc-800/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 text-xs font-bold uppercase tracking-widest mb-4">
              <HelpCircle className="text-zinc-400" /> FAQ
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Common Questions</h2>
            <p className="text-zinc-500 text-base">Quick answers. Full guide available via the Guide button in the nav.</p>
          </div>
          <div className="space-y-2">
            {FAQ_DATA.map((item, i) => (
              <div
                key={i}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${openFaq === i ? 'border-rose-500/30 bg-zinc-900/80' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'}`}
              >
                <button
                  type="button"
                  id={`faq-btn-${i}`}
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-panel-${i}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left group"
                >
                  <span className={`font-semibold text-sm transition-colors ${openFaq === i ? 'text-rose-300' : 'text-white group-hover:text-rose-300'}`}>{item.q}</span>
                  <ChevronDown size={14} className={`transition-transform duration-300 shrink-0 ${openFaq === i ? 'rotate-180 text-rose-400' : 'text-zinc-600'}`} aria-hidden="true" />
                </button>
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-btn-${i}`}
                  hidden={openFaq !== i}
                  className="px-6 pb-5 animate-fade-in"
                >
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <p className="text-zinc-500 text-sm mb-4">Still have questions? The full guide has answers for everything.</p>
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              aria-label="Open Full User Guide"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-rose-500/40 hover:bg-zinc-800 text-white text-sm font-semibold transition-all duration-300 hover:scale-105"
            >
              <BookOpen className="text-rose-400" /> Open Full User Guide
            </button>
          </div>
        </div>
      </section>

      <SectionDivider />

      </>)}{/* end home conversion tail */}

      {/* ── Mobile preview — last content block, before footer ── */}
      <section id="download" className={`py-24 sm:py-28 px-6 relative overflow-hidden${isDarkMode ? '' : ' bg-stone-50'}`}>
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDarkMode ? 1 : 0.55 }}>
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 25% 50%, rgba(244,63,94,0.10) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(251,113,133,0.06) 0%, transparent 55%)',
          }} />
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-[3fr_2fr] gap-12 lg:gap-20 items-center">
            {/* Left: typographic body */}
            <div className="order-2 lg:order-1 animate-fade-in">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-7${isDarkMode ? ' bg-rose-500/10 border border-rose-500/25 text-rose-400' : ' bg-rose-50 border border-rose-200 text-rose-600'}`}>
                <Smartphone className="w-3.5 h-3.5" /> Mobile
              </div>
              <h2 className={`text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 tracking-tight${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`} style={{ lineHeight: 1.02, letterSpacing: '-0.025em' }}>
                Wherever<br />you are.
              </h2>
              <p className={`text-lg leading-relaxed max-w-xl mb-8${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                Every conversation, decision, and signal. Synced to the device already in your hand. The full Pulse surface in your pocket. Same Memory, same Relay, same Decisions.
              </p>
              {/* Download actions — folded in from the former standalone Download section */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <a href="https://github.com/FatherSonOne/Pulse-1/releases/download/v25.1.3/Pulse.Setup.25.1.3.exe" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors">
                  <i className="fa-brands fa-windows text-[13px]" aria-hidden="true" /> Download for Windows
                </a>
                <a href="/downloads/pulse-android.apk" download className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${isDarkMode ? 'border-zinc-700 text-zinc-200 hover:border-rose-500/50 hover:text-white' : 'border-stone-300 text-stone-700 hover:border-rose-500/50 hover:text-stone-900'}`}>
                  <Smartphone className="w-4 h-4" /> Android APK
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.2em' }}>
                <span className={`uppercase font-semibold${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>PWA</span>
                <a href="https://play.google.com/apps/internaltest/4701381285127016770" target="_blank" rel="noopener noreferrer" className={`uppercase font-semibold tracking-[0.2em] transition-colors ${isDarkMode ? 'text-zinc-500 hover:text-rose-400' : 'text-zinc-500 hover:text-rose-600'}`}>Google Play · early access →</a>
                <span className={`uppercase font-semibold${isDarkMode ? ' text-zinc-600' : ' text-zinc-400'}`}>macOS · soon</span>
                <span className={`inline-flex items-center gap-2 uppercase font-semibold${isDarkMode ? ' text-rose-400' : ' text-rose-600'}`}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Live now
                </span>
                <button type="button" onClick={() => setIsGuideOpen(true)} className={`uppercase font-semibold tracking-[0.2em] transition-colors ${isDarkMode ? 'text-zinc-500 hover:text-rose-400' : 'text-zinc-500 hover:text-rose-600'}`}>Install help →</button>
              </div>
            </div>
            {/* Right: phone screenshot */}
            <div className="order-1 lg:order-2 flex justify-center lg:justify-end" data-reveal>
              <div
                className="lp-mobile-frame relative"
                style={{
                  filter: isDarkMode
                    ? 'drop-shadow(0 30px 60px rgba(0,0,0,0.55)) drop-shadow(0 8px 24px rgba(244,63,94,0.18))'
                    : 'drop-shadow(0 30px 60px rgba(0,0,0,0.12)) drop-shadow(0 8px 24px rgba(244,63,94,0.12))',
                }}
              >
                <img
                  src="/screens/pulse-user-guide.png"
                  alt="Pulse on mobile: the in-app User Guide showing 23 documented sections — Introduction, Getting Started, Dashboard and more — with searchable, version-tagged help."
                  className="block w-[260px] sm:w-[300px] lg:w-[340px] h-auto rounded-[44px]"
                  loading="lazy"
                  decoding="async"
                  width={415}
                  height={895}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      </div>{/* /lp-light body zone */}
      </main>{/* /#main-content */}

      {/* ── Studio band — Quantum Ecosystems, the studio behind Pulse ── */}
      <section aria-label="The studio behind Pulse" className="lp-dark bg-zinc-950 border-t border-zinc-800/60 py-12 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-4 text-center sm:text-left">
          <span className="inline-flex flex-shrink-0">
            <QuantumEcosMark size={52} />
          </span>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-400/80 mb-1.5">A Quantum Ecosystems product</p>
            <p className="text-zinc-300 text-sm sm:text-[15px] leading-relaxed max-w-xl">
              Pulse is built and maintained by <span className="text-white font-semibold">Quantum Ecosystems</span> — a studio crafting intelligent software that helps mission-driven teams streamline operations and amplify their impact.
            </p>
          </div>
          <a
            href="https://qntmecos.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-zinc-700/60 bg-zinc-900/60 text-sm font-medium text-zinc-300 hover:text-white hover:border-rose-500/40 hover:bg-zinc-800/60 transition-all duration-200 flex-shrink-0"
          >
            Visit QntmEcos <ExternalLink className="text-[11px]" />
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-zinc-950 border-t border-zinc-800 pt-16 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="lp-footer-mark w-8 h-8 rounded-lg bg-[var(--lp-hero-navy)] flex items-center justify-center border border-zinc-800" data-reveal>
                  <svg viewBox="0 0 64 64" className="w-5 h-5">
                    <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-nav)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <span className="text-xl font-bold text-white">Pulse</span>
              </div>
              <p className="text-zinc-400 max-w-sm mb-6">
                AI-powered messaging, Relay voice, Glimpse video, calendar, maps, CRM intelligence, research studio, and predictive analytics. One screen for the overloaded solo operator and the team they pull in.
              </p>
              <div className="flex gap-4 mb-8">
                <SocialIcon icon="fa-brands fa-github" label="Pulse on GitHub" href="https://github.com/FatherSonOne/Pulse-1" />
              </div>

              {/* QntmEcos developer credit */}
              <a
                href="https://qntmecos.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-rose-500/30 hover:bg-zinc-800/80 transition-all duration-200 group"
              >
                <QuantumEcosMark size={24} />
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors">Developed by QntmEcos</div>
                  <div className="text-[10px] text-zinc-500">Quantum Ecosystems · qntmecos.com</div>
                </div>
                <ExternalLink className="text-[10px] text-zinc-600 group-hover:text-rose-400 transition-colors ml-1" />
              </a>
            </div>

            <div>
              <h4 className="font-bold text-white mb-6">Product</h4>
              <ul className="space-y-4 text-sm text-zinc-400">
                <li>
                  <button type="button" onClick={() => scrollToSection('features')} className="hover:text-rose-500 transition text-left">Features</button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection('ecosystem')} className="hover:text-rose-500 transition text-left">Ecosystem</button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollToSection('pricing')} className="hover:text-rose-500 transition text-left">Pricing</button>
                </li>
                <li>
                  <a href="https://play.google.com/apps/internaltest/4701381285127016770" target="_blank" rel="noopener noreferrer" className="hover:text-rose-500 transition">Android App <span className="text-zinc-600">· early access</span></a>
                </li>
                <li>
                  <a href="/about" className="hover:text-rose-500 transition">About Pulse</a>
                </li>
                <li>
                  <a href="https://qntmecos.com" target="_blank" rel="noopener noreferrer" className="hover:text-rose-500 transition flex items-center gap-1">
                    About QntmEcos <ExternalLink className="text-[10px]" />
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-6">Legal and Privacy</h4>
              <ul className="space-y-4 text-sm text-zinc-400">
                <li>
                  <a href="/privacy" className="hover:text-rose-500 transition flex items-center gap-2">
                    Privacy Policy <span className="text-xs bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full">Updated</span>
                  </a>
                </li>
                <li><a href="/terms" className="hover:text-rose-500 transition">Terms of Service</a></li>
                <li>
                  <a href="https://github.com/FatherSonOne/Pulse-1" target="_blank" rel="noopener noreferrer" className="hover:text-rose-500 transition flex items-center gap-1">
                    GitHub <ExternalLink className="text-[10px]" />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">
              &copy; {new Date().getFullYear()} Quantum Ecosystems LLC. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <span>Built with</span>
              <Heart className="text-rose-900" />
              <span>by the</span>
              <a href="https://qntmecos.com" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-rose-400 transition font-medium">QntmEcos</a>
              <span>team</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ── Helper Components ──────────────────────────────────────────────────────────

const DownloadButton = ({
  icon, platform, subtext, active, href, onClick,
}: {
  icon: string; platform: string; subtext: string; active: boolean; href?: string; onClick?: () => void;
}) => {
  const Component = href ? 'a' : 'button';
  const inactive = !active && !href;
  return (
    <Component
      href={href}
      onClick={onClick}
      target={href ? '_blank' : undefined}
      rel={href ? 'noopener noreferrer' : undefined}
      disabled={inactive ? true : undefined}
      aria-disabled={inactive ? true : undefined}
      aria-label={inactive ? `${platform}, coming soon` : platform}
      className={`group p-6 rounded-2xl border transition duration-300 flex flex-col items-center justify-center gap-4 w-full ${
        active
          ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-rose-500/50 cursor-pointer'
          : 'bg-zinc-900/50 border-zinc-800 opacity-60 cursor-not-allowed'
      }`}
    >
      <i className={`${icon} text-4xl text-zinc-300 group-hover:text-white transition`} aria-hidden="true"></i>
      <div className="text-center">
        <div className="font-bold text-white group-hover:text-rose-400 transition">{platform}</div>
        <div className="text-xs text-zinc-500">{subtext}</div>
      </div>
      {inactive && <span className="px-2 py-1 bg-zinc-800 rounded text-[10px] text-zinc-500 uppercase tracking-wide">Coming Soon</span>}
    </Component>
  );
};

const SocialIcon = ({ icon, label, href = '#' }: { icon: string; label: string; href?: string }) => (
  <a href={href} target={href !== '#' ? '_blank' : undefined} rel={href !== '#' ? 'noopener noreferrer' : undefined} aria-label={label} className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:bg-rose-500 hover:text-white transition duration-300">
    <i className={icon} aria-hidden="true"></i>
  </a>
);


export default LandingPage;
