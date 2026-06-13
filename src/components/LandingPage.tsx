import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import './LandingPage.css';

import { Apple, ArrowDown, Battery, Bell, Book, BookOpen, Check, ChevronUp, Download, ExternalLink, Eye, Gavel, Heart, HeartPulse, HelpCircle, Info, Keyboard, Layers, LayoutGrid, MapPin, Mic, Network, Play, Radar, Rocket, Search, ShieldHalf, Signal, Smartphone, Users, Video, Wand2, Wifi, X } from 'lucide-react';
import { RELAY_PEERS, FAQ_DATA, SHORTCUT_GROUPS, PULSE_SOLO_FEATURES, PULSE_SOLO_PRICING, PULSE_TEAM_FEATURES, PULSE_TEAM_PRICING, PULSE_GROWTH_FEATURES, PULSE_GROWTH_PRICING } from './LandingPage/landingData';

// Lazy-load the guide — guideData.ts is 26k lines and must NOT land in the main bundle
const UsersGuide = lazy(() => import('./UsersGuide/UsersGuide'));

interface LandingPageProps {
  onGetStarted: () => void;
}

// QntmEcos Abstract Q Logo — solid rose #f43f5e
const QntmEcosIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M 40 10 A 28 28 0 1 1 40 68" stroke="#f43f5e" strokeWidth="5" strokeLinecap="round" fill="none" />
    <line x1="54" y1="56" x2="68" y2="72" stroke="#f43f5e" strokeWidth="5" strokeLinecap="round" />
    <circle cx="40" cy="40" r="5" fill="#f43f5e" />
  </svg>
);

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

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [activeScenario, setActiveScenario] = useState<'enterprise' | 'voice'>('enterprise');
  const [sectionVis, setSectionVis] = useState<Record<string, number>>({});
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [orbitPaused, setOrbitPaused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingCycle, setPricingCycle] = useState<'monthly' | 'yearly'>('monthly');
  // Email landing section is built (emailAIService / smartCompose / Gmail sync) but Gmail is
  // currently an owner-scoped grant and emailEnabled defaults off, so it is not yet generally
  // available to public signups. Hidden from the marketing page for v1; flip to re-show.
  const SHOW_EMAIL_ON_LANDING = false;
  // Logos Vision bidirectional-sync panel: the integration is unbuilt (the client lib exists
  // but has zero call sites). Hidden until built. See docs/LOGOS_VISION_SYNC_HANDOFF_2026-06-13.md.
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
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('lp-theme');
      if (stored === 'light') return false;
      if (stored === 'dark')  return true;
    } catch { /* private browsing */ }
    return true;
  });
  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      try { localStorage.setItem('lp-theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  };

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

  // Scroll-triggered section backgrounds — fade in/out as user scrolls through each section
  useEffect(() => {
    const ids = ['section-relay', 'section-decisions', 'section-crm'];
    const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          setSectionVis(prev => ({ ...prev, [entry.target.id]: entry.intersectionRatio }));
        });
      },
      { threshold: thresholds }
    );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
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

  // ── Hero signal-wave canvas animation ──────────────────────────────────────
  useEffect(() => {
    const canvas = heroCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isVisible = true;
    const visObs = new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting; }, { threshold: 0 });
    visObs.observe(canvas);

    // Settings locked from playground: glow 92%, speed 47%, particles 100%
    const GLOW     = 0.92;
    const SPD_BASE = 0.18 + (47 / 100) * 2.6; // ≈ 1.40
    const N_PARTS  = 90;

    const pal = ['#f43f5e','#ec4899','#fb7185','#f97316','#ef4444','#e11d48','#db2777'];
    const waves = Array.from({ length: 7 }, (_, i) => ({
      yFrac:     0.08 + i * 0.13,
      freq:      0.0022 + i * 0.0007,
      amp:       10 + i * 4,
      phase:     (i * 0.9) % (Math.PI * 2),
      speedMul:  0.35 + i * 0.15,
      color:     pal[i % pal.length],
      opacity:   0.14 + i * 0.06,
      lw:        0.7 + (i % 3) * 0.8,
      ecgTimer:  i * 40,
      ecgCool:   180 + i * 40,
      ecgActive: false,
      ecgProg:   0,
    }));

    type Pt = { x: number; wi: number; speed: number; size: number; opacity: number; phase: number };
    const parts: Pt[] = [];
    let W = canvas.offsetWidth;
    let H = canvas.offsetHeight;
    let time = 0;
    let rafId = 0;

    const makePt = (): Pt => ({
      x:       Math.random() * W,
      wi:      Math.floor(Math.random() * 7),
      speed:   0.3 + Math.random() * 1.8,
      size:    0.8 + Math.random() * 2.2,
      opacity: 0.35 + Math.random() * 0.65,
      phase:   Math.random() * Math.PI * 2,
    });

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
    };

    const ecgShape = (t: number): number => {
      if (t < 0.12) return t * 0.6;
      if (t < 0.22) return 0.072 - (t - 0.12) * 0.72;
      if (t < 0.33) return -(t - 0.22) * 1.8;
      if (t < 0.44) return -0.198 + (t - 0.33) * 13;
      if (t < 0.55) return 1.23 - (t - 0.44) * 15;
      if (t < 0.66) return -0.42 + (t - 0.55) * 4.8;
      return 0;
    };

    const strokeWave = (w: (typeof waves)[0], y: number) => {
      ctx.beginPath();
      let first = true;
      for (let x = 0; x <= W; x += 2) {
        let wy: number;
        if (w.ecgActive && x < w.ecgProg) {
          const rel = (w.ecgProg - x) / 90;
          wy = rel < 1
            ? y + ecgShape(rel) * w.amp * 2.8
            : y + Math.sin(x * w.freq + w.phase + time * w.speedMul) * w.amp;
        } else {
          wy = y + Math.sin(x * w.freq + w.phase + time * w.speedMul) * w.amp;
        }
        const fy = y + (wy - y) * (1 - (x / W) * 0.45);
        if (first) { ctx.moveTo(x, fy); first = false; } else ctx.lineTo(x, fy);
      }
      ctx.stroke();
    };

    const loop = () => {
      rafId = requestAnimationFrame(loop);
      if (!isVisible) return;
      ctx.clearRect(0, 0, W, H);
      time += SPD_BASE * 0.016;

      waves.forEach(w => {
        const y = w.yFrac * H;
        w.ecgTimer += SPD_BASE * 0.45;
        if (w.ecgTimer > w.ecgCool && !w.ecgActive) { w.ecgActive = true; w.ecgProg = 0; w.ecgTimer = 0; }
        if (w.ecgActive) { w.ecgProg += SPD_BASE * 3.5; if (w.ecgProg > W) { w.ecgActive = false; w.ecgProg = 0; } }

        ctx.save();
        ctx.shadowColor = w.color; ctx.shadowBlur = 18 * GLOW;
        ctx.strokeStyle = w.color; ctx.lineWidth = w.lw + 2.5;
        ctx.globalAlpha = w.opacity * 0.35 * GLOW;
        strokeWave(w, y);
        ctx.shadowBlur = 0; ctx.globalAlpha = w.opacity; ctx.lineWidth = w.lw;
        strokeWave(w, y);
        ctx.restore();
      });

      parts.forEach(p => {
        p.x += p.speed * SPD_BASE * 0.75;
        if (p.x > W) { p.x = 0; p.wi = Math.floor(Math.random() * waves.length); }
        const w = waves[p.wi];
        if (!w) return;
        const baseY = w.yFrac * H;
        const wy = baseY + Math.sin(p.x * w.freq + w.phase + time * w.speedMul + p.phase) * w.amp;
        const fy = baseY + (wy - baseY) * (1 - (p.x / W) * 0.45);
        ctx.beginPath();
        ctx.arc(p.x, fy, p.size, 0, Math.PI * 2);
        ctx.fillStyle = w.color;
        ctx.globalAlpha = p.opacity * (0.35 + 0.65 * GLOW);
        ctx.shadowColor = w.color; ctx.shadowBlur = 9 * GLOW;
        ctx.fill(); ctx.shadowBlur = 0;
      });

      const cx = W * 0.65, cy = H * 0.5;
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.52);
      gr.addColorStop(0,   `rgba(244,63,94,${(0.2 * GLOW).toFixed(2)})`);
      gr.addColorStop(0.4, `rgba(236,72,153,${(0.09 * GLOW).toFixed(2)})`);
      gr.addColorStop(1,   'rgba(244,63,94,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, W * 0.52, 0, Math.PI * 2);
      ctx.fillStyle = gr; ctx.globalAlpha = 1;
      ctx.fill();
    };

    resize();
    for (let i = 0; i < N_PARTS; i++) parts.push(makePt());
    window.addEventListener('resize', resize);
    loop();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      visObs.disconnect();
    };
  }, []);

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

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogoClick = () => {
    window.location.href = '/?signin';
  };

  // ── Animated SVG icons for Relay mode cards ────────────────────────────────
  const voxSvg = (idx: number): React.ReactNode => {
    const icons: React.ReactNode[] = [
      // 0 — Classic: 5-bar waveform equaliser
      <svg viewBox="0 0 20 20" width={18} height={18} fill="currentColor" aria-hidden="true">
        <rect x="1"    y="9" width="2.5" height="2"  rx="1" className="lp-bar-a" />
        <rect x="4.5"  y="6" width="2.5" height="8"  rx="1" className="lp-bar-b" />
        <rect x="8"    y="3" width="2.5" height="14" rx="1" className="lp-bar-c" />
        <rect x="11.5" y="6" width="2.5" height="8"  rx="1" className="lp-bar-d" />
        <rect x="15"   y="9" width="2.5" height="2"  rx="1" className="lp-bar-e" />
      </svg>,
      // 1 — Quick Vox: lightning bolt flash
      <svg viewBox="0 0 20 20" width={18} height={18} fill="currentColor" aria-hidden="true">
        <path d="M11 2L4 12h6l-1 6 7-10h-6z" className="lp-flash" />
      </svg>,
      // 2 — Team Vox: two silhouettes
      <svg viewBox="0 0 20 20" width={18} height={18} fill="currentColor" aria-hidden="true">
        <circle cx="7" cy="6" r="2.5" />
        <path d="M2 17a5 5 0 0110 0" />
        <circle cx="14" cy="6" r="2" opacity={0.6} />
        <path d="M12 17a4 4 0 014 0" opacity={0.6} />
      </svg>,
      // 3 — Vox Drop: clock with spinning hands
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
        <circle cx="10" cy="10" r="7" />
        <line x1="10" y1="10" x2="10" y2="5.5" className="lp-clock-sec" />
        <line x1="10" y1="10" x2="13" y2="11"  className="lp-clock-min" />
      </svg>,
      // 4 — Vox Notes: notepad
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
        <path d="M4 3h9l3 3v11a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" />
        <line x1="6" y1="8"  x2="12" y2="8" />
        <line x1="6" y1="11" x2="12" y2="11" />
        <line x1="6" y1="14" x2="9"  y2="14" />
        <polyline points="13,3 13,6 16,6" strokeWidth={1.2} />
      </svg>,
      // 5 — Video Vox: camera with pulsing record dot
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
        <rect x="1" y="6" width="11" height="9" rx="2" fill="currentColor" fillOpacity={0.15} />
        <path d="M12 9l5.5-3v8L12 11" strokeLinejoin="round" />
        <circle cx="17.5" cy="4" r="1.5" fill="#f43f5e" stroke="none" className="lp-rec-dot" />
      </svg>,
      // 6 — Pulse Radio: two expanding concentric rings
      <svg viewBox="0 0 20 20" width={18} height={18} fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="2.5" fill="currentColor" />
        <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth={1.2} className="lp-radio-a" />
        <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth={1}   className="lp-radio-b" opacity={0.55} />
      </svg>,
      // 7 — Voice Threads: stacked speech bubbles
      <svg viewBox="0 0 20 20" width={18} height={18} fill="currentColor" aria-hidden="true">
        <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v5a2 2 0 01-2 2H8L5 14v-3H4a2 2 0 01-2-2V4z" opacity={0.5} />
        <path d="M7 8a2 2 0 012-2h6a2 2 0 012 2v4a2 2 0 01-2 2h-1v2l-2.5-2H9a2 2 0 01-2-2V8z" />
      </svg>,
    ];
    return icons[idx] ?? null;
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-zinc-950 lp-dark text-white selection:text-rose-200' : 'bg-stone-50 lp-light text-stone-900 selection:text-rose-700'} overflow-x-hidden overflow-y-auto selection:bg-rose-500/30`}>

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
      <nav aria-label="Main navigation" className={`fixed top-0 left-0 right-0 z-[100] backdrop-blur-xl border-b ${isDarkMode ? 'bg-zinc-950/85 border-zinc-800/50' : 'bg-white/85 border-stone-200/60'}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 md:px-6 md:py-4 flex items-center justify-between">

          {/* Left: Pulse logo + QntmEcos badge */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleLogoClick}
              className="flex items-center gap-3 cursor-pointer group bg-transparent border-0 p-0"
              aria-label="Pulse, return to sign in"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border border-zinc-800 group-hover:scale-110 transition-transform duration-300 ${isDarkMode ? 'bg-[#0f172a]' : 'bg-stone-100'}`}>
                <svg viewBox="0 0 64 64" className="w-6 h-6" aria-hidden="true">
                  <defs>
                    <linearGradient id="pulse-grad-nav" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f43f5e"/>
                      <stop offset="100%" stopColor="#ec4899"/>
                    </linearGradient>
                  </defs>
                  <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-nav)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <span className={`text-xl font-bold ${isDarkMode ? 'text-zinc-50' : 'text-zinc-900'}`}>Pulse</span>
            </button>

            {/* QntmEcos badge */}
            <a
              href="https://qntmecos.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-700/60 bg-zinc-900/60 hover:border-rose-500/40 hover:bg-zinc-800/60 transition-all duration-200 group"
              title="Quantum Ecosystems, the studio behind Pulse"
              aria-label="QntmEcos: Quantum Ecosystems, the studio behind Pulse (opens in new tab)"
            >
              <QntmEcosIcon size={16} />
              <span className="text-[11px] font-medium text-zinc-400 group-hover:text-rose-400 transition-colors">QntmEcos</span>
            </a>
          </div>

          <div className={`hidden md:flex items-center gap-6 text-sm font-medium ${isDarkMode ? 'text-zinc-400' : 'text-stone-500'}`}>
            {/* Primary nav */}
            <button type="button" onClick={() => scrollToSection('features')} className={`transition ${isDarkMode ? 'hover:text-white' : 'hover:text-stone-900'}`}>Features</button>
            <button type="button" onClick={() => scrollToSection('ecosystem')} className={`transition ${isDarkMode ? 'hover:text-white' : 'hover:text-stone-900'}`}>Ecosystem</button>
            <button type="button" onClick={() => scrollToSection('scenarios')} className={`transition ${isDarkMode ? 'hover:text-white' : 'hover:text-stone-900'}`}>Scenarios</button>
            <button type="button" onClick={() => scrollToSection('pricing')} className={`transition ${isDarkMode ? 'hover:text-white' : 'hover:text-stone-900'}`}>Pricing</button>

            {/* ── Downloads dropdown ── */}
            <div
              className="relative"
              onMouseEnter={() => setDownloadsOpen(true)}
              onMouseLeave={() => setDownloadsOpen(false)}
            >
              <button
                type="button"
                onClick={() => scrollToSection('download')}
                className={`flex items-center gap-1.5 transition ${downloadsOpen ? 'text-white' : 'hover:text-white'}`}
                aria-haspopup="true"
                aria-expanded={downloadsOpen}
              >
                <Download className="text-[11px]" />
                Download
                <i className={`fa-solid fa-chevron-down text-[9px] transition-transform duration-200 ${downloadsOpen ? 'rotate-180' : ''}`} aria-hidden="true"></i>
              </button>

              {/* Dropdown panel */}
              <div
                className={`absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden transition-all duration-200 z-[200] ${
                  downloadsOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
                }`}
              >
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
                      <div className="text-[11px] text-zinc-500">Google Play Store</div>
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
                      <div className="text-[11px] text-zinc-500">Sideload · direct download</div>
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

            {/* Divider */}
            <span className={`w-px h-4 ${isDarkMode ? 'bg-zinc-800' : 'bg-stone-300'}`} aria-hidden="true" />
            {/* Docs & legal */}
            <button type="button" onClick={() => setIsGuideOpen(true)} className={`flex items-center gap-1.5 transition ${isDarkMode ? 'hover:text-white' : 'hover:text-stone-900'}`}>
              <Book className="text-[11px]" />
              Docs
            </button>
            <a href="/privacy" className={`flex items-center gap-1.5 transition ${isDarkMode ? 'hover:text-white' : 'hover:text-stone-900'}`}>
              <ShieldHalf className="text-[11px]" />
              Privacy
            </a>
            <a href="/terms" className={`flex items-center gap-1.5 transition ${isDarkMode ? 'hover:text-white' : 'hover:text-stone-900'}`}>
              <Gavel className="text-[11px]" />
              Terms
            </a>
          </div>

          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only, ghost style (no rose fill per budget rule) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="lp-mobile-menu"
              className={`md:hidden w-11 h-11 flex items-center justify-center rounded-lg border transition-all duration-200 hover:scale-105 active:scale-95 ${
                isDarkMode
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
            {/* Theme toggle — sun (dark→light) / moon (light→dark) */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all duration-200 hover:scale-105 active:scale-95 ${
                isDarkMode
                  ? 'border-zinc-700/70 bg-zinc-900/60 hover:border-amber-400/50 text-zinc-400 hover:text-amber-400'
                  : 'border-stone-300 bg-white hover:border-rose-400/50 text-stone-500 hover:text-rose-500'
              }`}
            >
              {isDarkMode ? (
                /* Sun — click to go light */
                <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zm4.95 2.636a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 11-1.06-1.06l1.06-1.061a.75.75 0 011.06 0zM10 6a4 4 0 100 8 4 4 0 000-8zm-8 4a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 012 10zm13.5 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm-2.636 4.95a.75.75 0 010-1.061l1.06-1.06a.75.75 0 111.061 1.06l-1.06 1.06a.75.75 0 01-1.061 0zm-8.84 0a.75.75 0 01-1.061 0l-1.06-1.06a.75.75 0 011.06-1.061l1.061 1.06a.75.75 0 010 1.061zM10 16.5a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                </svg>
              ) : (
                /* Moon — click to go dark */
                <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            {/* User Guide button — always visible */}
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              aria-label="Open User Guide"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-zinc-700/70 bg-zinc-900/60 hover:border-rose-500/50 hover:bg-zinc-800/80 text-zinc-400 hover:text-rose-400 text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <BookOpen className="text-[13px]" />
              <span className="hidden sm:inline" aria-hidden="true">User Guide</span>
            </button>
            {/* Plans — always visible, jumps to pricing */}
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              aria-label="Jump to pricing plans"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 ${
                isDarkMode
                  ? 'border-zinc-700/70 bg-zinc-900/60 hover:border-rose-500/50 hover:bg-zinc-800/80 text-zinc-400 hover:text-rose-400'
                  : 'border-stone-300 bg-white hover:border-rose-400/50 hover:bg-stone-100 text-stone-600 hover:text-rose-600'
              }`}
            >
              <i className="fa-solid fa-tag text-[11px]" aria-hidden="true" />
              <span className="hidden sm:inline">Plans</span>
            </button>
            <button
              onClick={onGetStarted}
              type="button"
              className="px-3 py-2 md:px-5 md:py-2.5 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700/80 hover:border-rose-500/50 text-zinc-100 hover:text-white rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-zinc-700/90 hover:shadow-lg hover:shadow-rose-500/10"
            >
              Log In
            </button>
            <button
              onClick={onGetStarted}
              type="button"
              className="lp-cta-primary hidden sm:block px-5 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 rounded-lg text-sm font-semibold text-white"
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
        className={`lp-mobile-menu ${mobileMenuOpen ? 'open' : 'closed'}`}
      >
        {/* Stacked nav links */}
        <button type="button" onClick={() => { setMobileMenuOpen(false); scrollToSection('features'); }} className="lp-mobile-nav-link">Features</button>
        <button type="button" onClick={() => { setMobileMenuOpen(false); scrollToSection('ecosystem'); }} className="lp-mobile-nav-link">Ecosystem</button>
        <button type="button" onClick={() => { setMobileMenuOpen(false); scrollToSection('scenarios'); }} className="lp-mobile-nav-link">Scenarios</button>
        <button type="button" onClick={() => { setMobileMenuOpen(false); scrollToSection('pricing'); }} className="lp-mobile-nav-link">Pricing</button>
        <button type="button" onClick={() => { setMobileMenuOpen(false); scrollToSection('download'); }} className="lp-mobile-nav-link">Download</button>
        <div className="lp-mobile-divider" />
        <button type="button" onClick={() => { setMobileMenuOpen(false); setIsGuideOpen(true); }} className="lp-mobile-nav-link">Docs</button>
        <a href="/privacy" onClick={() => setMobileMenuOpen(false)} className="lp-mobile-nav-link">Privacy</a>
        <a href="/terms" onClick={() => setMobileMenuOpen(false)} className="lp-mobile-nav-link">Terms</a>
        <div className="lp-mobile-divider" />
        {/* CTAs */}
        <button onClick={onGetStarted} type="button" className="lp-mobile-cta-primary">Get Started</button>
        <button onClick={onGetStarted} type="button" className="lp-mobile-cta-ghost">Log In</button>
      </div>

      {/* ── Main content landmark (ADA) ── */}
      <main id="main-content">

      {/* ── Hero Section — Asymmetric Signal ── */}
      <section
        className="relative flex items-center min-h-screen overflow-hidden"
        style={{ background: isDarkMode ? '#0f172a' : '#fafaf9' }}
      >
        {/* Signal wave canvas — right 65%, absolute positioned */}
        <canvas
          ref={heroCanvasRef}
          className="hero-signal-canvas"
          style={{ opacity: isDarkMode ? 1 : 0.2 }}
          aria-hidden="true"
        />

        {/* Grid overlay — radial mask, right-biased */}
        <div className="hero-asymm-grid" aria-hidden="true" />

        {/* Left gradient fade — text readable against canvas glow */}
        <div
          className="hero-asymm-fade"
          style={{
            background: isDarkMode
              ? 'linear-gradient(90deg, #0f172a 32%, rgba(15,23,42,0.78) 55%, transparent 80%)'
              : 'linear-gradient(90deg, #fafaf9 32%, rgba(250,250,249,0.78) 55%, transparent 80%)',
          }}
          aria-hidden="true"
        />

        {/* Grain texture — premium feel */}
        <div className="hero-grain-overlay" style={{ opacity: isDarkMode ? 0.22 : 0.05 }} aria-hidden="true" />

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
              color: isDarkMode ? '#ffffff' : '#1c1917',
              textTransform: 'uppercase',
            }}>PULSE</span>
          </div>

          {/* Badge */}
          <div className="hero-asymm-badge animate-blur-reveal blur-delay-1">
            <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            Every channel, one surface
          </div>

          {/* Headline — hard stop at "Every Decision." */}
          <h1
            className="hero-asymm-headline animate-blur-reveal blur-delay-2"
            style={{ color: isDarkMode ? '#ffffff' : '#1c1917' }}
          >
            <span className="ha-line">Every Signal.</span>
            <span className="ha-line">Every Voice.</span>
            <span className="ha-line ha-gradient">Every Decision.</span>
          </h1>

          {/* Single CTA */}
          <div className="animate-blur-reveal blur-delay-3">
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

      {/* ── Index strip ── one decisive sentence in place of the seven-cell
          hero-metric template flagged by impeccable's slop test.
          Same five facts, no grid scaffolding. */}
      <div className={`border-y py-6 ${isDarkMode ? 'bg-zinc-900/40 border-zinc-800/60' : 'bg-stone-100/60 border-stone-200/60'}`}>
        <p className={`max-w-5xl mx-auto px-6 text-center text-base sm:text-lg leading-relaxed ${isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>
          5 Relay peers + Triage stream &middot; Glimpse video &middot; War Room with 8 slash commands &middot; 4 native CRMs &middot; Maps and ETA share. <span className="text-rose-500 font-semibold">One surface.</span>
        </p>
      </div>

      {/* ── I: Platform Badge Ticker ── hidden for now */}

      {/* ── Feature Showcase ── */}
      <div id="features">

        {/* Section A — Voice-First Communication */}
        <section id="section-relay" className={`py-24 px-6 relative overflow-hidden${isDarkMode ? '' : ' bg-stone-50'}`}>
          {/* Relay "Sonic Pulse" themed bg — indigo + pink, fades in with scroll */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-700"
            style={{ opacity: Math.min(sectionVis['section-relay'] ?? 0, 1) * (isDarkMode ? 1 : 0.55) }}
          >
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 15% 50%, rgba(244,63,94,0.13) 0%, transparent 55%), radial-gradient(ellipse at 85% 30%, rgba(236,72,153,0.09) 0%, transparent 50%), radial-gradient(ellipse at 50% 90%, rgba(244,63,94,0.06) 0%, transparent 45%)',
            }}></div>
            {/* Sonic rings — concentric indigo arcs like Relay's waveform visualizer */}
            <div className="absolute left-[-80px] top-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-rose-500/10" style={{ boxShadow: 'inset 0 0 60px rgba(244,63,94,0.06)' }}></div>
            <div className="absolute left-[-40px] top-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full border border-rose-400/10"></div>
            <div className="absolute left-[20px] top-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full border border-pink-500/10"></div>
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-14 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-bold uppercase tracking-widest mb-4">
                <Mic /> Relay
              </div>
              <h2 className={`text-4xl sm:text-6xl font-bold mb-4${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`}>
                Five peers, one stream.
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl">
                Voice messaging, reimagined as triage. Direct, Channel, Broadcast, Notes, Live. Every Relay message lands in a single Triage stream with AI transcription, summary, and next action attached.
              </p>
            </div>

            {/* ── Desktop: radial orbital layout (hidden below 768px via .lp-relay-orbit CSS — orbit can't fit a phone) ── */}
            <div className="relative flex items-center justify-center overflow-visible lp-relay-orbit" style={{ height: '960px' }}>
              {/* Orbital ring decorations — centered via inset-0 m-auto */}
              <div className="absolute inset-0 m-auto rounded-full border border-rose-500/10 pointer-events-none" style={{ width: '860px', height: '860px' }} />
              <div className="absolute inset-0 m-auto rounded-full border border-rose-500/10 pointer-events-none" style={{ width: '560px', height: '560px' }} />
              {/* Ambient center glow */}
              <div className="absolute inset-0 m-auto rounded-full pointer-events-none" style={{ width: '420px', height: '420px', background: 'radial-gradient(circle, rgba(244,63,94,0.09) 0%, transparent 70%)' }} />

              {/* Center: Live Recording Panel */}
              <div className="absolute z-10" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '360px' }}>
                <div className="rounded-2xl overflow-hidden border border-zinc-800/80" aria-hidden="true" style={{ background: isDarkMode ? 'rgba(10,10,14,0.98)' : 'rgba(255,255,255,0.97)', boxShadow: '0 0 60px rgba(244,63,94,0.14)' }}>
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-800/50" style={{ background: isDarkMode ? 'rgba(14,14,18,0.99)' : 'rgba(245,244,241,0.99)' }}>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                    <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Live Recording · Real-Time Transcription</span>
                  </div>
                  <div className="px-4 pt-5 pb-3">
                    <svg viewBox="0 0 280 70" className="w-full" style={{ height: '58px' }}>
                      {[14,24,38,54,68,78,70,56,38,22,14,32,54,72,80,76,60,42,26,16,34,58,76,80,68,50,32,18].map((h, idx) => (
                        <rect
                          key={idx}
                          x={idx * 10 + 1}
                          y={(70 - h * 0.75) / 2}
                          width={7}
                          height={h * 0.75}
                          rx={3.5}
                          fill="#f43f5e"
                          fillOpacity={Math.min(0.95, 0.55 + h / 160)}
                          className={(['lp-bar-a','lp-bar-b','lp-bar-c','lp-bar-d','lp-bar-e'])[idx % 5]}
                        />
                      ))}
                    </svg>
                  </div>
                  <div className="mx-4 mb-3 px-3 py-2.5 rounded-xl border border-zinc-700/30" style={{ background: isDarkMode ? 'rgba(20,20,26,0.8)' : 'rgba(245,244,241,0.8)' }}>
                    <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Transcription</div>
                    <p className="text-[11px] text-zinc-300 font-medium leading-relaxed min-h-[2.5em]">
                      {liveTranscriptText}
                      <span className="inline-block w-0.5 h-3 bg-rose-400 ml-0.5 align-middle lp-rec-dot"></span>
                    </p>
                  </div>
                  <div className="pb-4 flex items-center justify-center gap-3">
                    <button type="button" title="Pause" className="w-9 h-9 rounded-full flex items-center justify-center border border-zinc-700/60 text-zinc-400" style={{ background: isDarkMode ? 'rgba(28,28,34,0.8)' : 'rgba(241,240,238,0.8)' }}>
                      <svg viewBox="0 0 20 20" width={13} height={13} fill="currentColor"><rect x="5" y="4" width="3" height="12" rx="1"/><rect x="12" y="4" width="3" height="12" rx="1"/></svg>
                    </button>
                    <button type="button" title="Record" className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f43f5e,#ec4899)', boxShadow: '0 0 22px rgba(244,63,94,0.5)' }}>
                      <Mic className="text-white w-5 h-5" />
                    </button>
                    <button type="button" title="AI Analysis" className="w-9 h-9 rounded-full flex items-center justify-center border border-purple-500/30 text-purple-400" style={{ background: 'rgba(139,92,246,0.08)' }}>
                      <svg viewBox="0 0 20 20" width={13} height={13} fill="currentColor"><path d="M11 2L4 12h6l-1 6 7-10h-6z" className="lp-flash"/></svg>
                    </button>
                  </div>
                  <div className="pb-4 px-3 flex items-center justify-center gap-1.5 flex-wrap">
                    {[
                      { label: 'Noise Reduction', color: '#f43f5e' },
                      { label: 'AI Analysis',     color: '#8b5cf6' },
                      { label: '90+ Languages',   color: '#22c55e' },
                    ].map(tag => (
                      <span key={tag.label} className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide border" style={{ color: tag.color, borderColor: `${tag.color}40`, background: `${tag.color}0f` }}>
                        {tag.label} ✓
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Orbit ring — rotates, carrying the 7 mode cards with it */}
              <div
                className={`lp-orbit-ring${orbitPaused ? ' paused' : ''}`}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5 }}
              >
                {RELAY_PEERS.map((mode, i) => {
                  const angleDeg = (360 / RELAY_PEERS.length) * i - 90;
                  const angleRad = angleDeg * (Math.PI / 180);
                  const orbitR = 410;
                  const cx = Math.round(Math.cos(angleRad) * orbitR);
                  const cy = Math.round(Math.sin(angleRad) * orbitR);
                  // Connector line angle: card sits at (cx,cy) from orbit
                  // center, so the line drawn from the card's center back
                  // toward the orbit center has angle = angleDeg + 180.
                  // It's anchored at the card's center (via top/left 50% with
                  // transform-origin: 0 50%) and rotated so the line points
                  // straight at the orbit center.
                  const linkLength = orbitR - 95; // stop short of the centre card frame
                  return (
                    <div
                      key={mode.name}
                      className="lp-orbit-card group p-5 rounded-2xl border border-zinc-700/60 hover:border-rose-500/60 transition-colors cursor-default"
                      style={{
                        position: 'absolute',
                        left: `calc(50% + ${cx}px)`,
                        top: `calc(50% + ${cy}px)`,
                        width: '190px',
                        background: isDarkMode ? 'rgba(18,18,26,0.96)' : 'rgba(255,255,255,0.96)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: isDarkMode ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 16px rgba(120,53,15,0.08)',
                      }}
                      onMouseEnter={() => setOrbitPaused(true)}
                      onMouseLeave={() => setOrbitPaused(false)}
                    >
                      {/* Connector — 1px coral line that draws toward the
                          centre transcription panel when this card is hovered. */}
                      <span
                        className="lp-orbit-link"
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: `${linkLength}px`,
                          height: '1px',
                          background: 'linear-gradient(to right, rgba(244,63,94,0.85), rgba(244,63,94,0))',
                          transformOrigin: '0 50%',
                          transform: `rotate(${angleDeg + 180}deg) scaleX(0)`,
                          pointerEvents: 'none',
                          zIndex: -1,
                        }}
                      />
                      {/* Keyboard shortcut badge — JetBrains Mono per the
                          DESIGN.md Mono-Label Rule. Fades in on card hover. */}
                      <span
                        className="lp-orbit-key uppercase tracking-widest"
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(244,63,94,0.12)',
                          color: '#fda4af',
                          fontSize: '10px',
                          letterSpacing: '0.1em',
                          fontWeight: 500,
                          border: '1px solid rgba(244,63,94,0.25)',
                        }}
                      >{mode.key}</span>
                      <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center mb-3 group-hover:bg-rose-500/20 transition-colors">
                        <span className="text-rose-500">{voxSvg(i)}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mb-1.5 leading-tight">{mode.name}</h3>
                      <p className="text-zinc-400 text-[11px] leading-relaxed">{mode.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Mobile: stacked layout (Option B) — shown below 768px via .lp-relay-mobile CSS ── */}
            <div className="lp-relay-mobile flex-col gap-5">
              {/* Live recording panel — compact, full-width */}
              <div className="rounded-2xl overflow-hidden border border-zinc-800/80" aria-hidden="true" style={{ background: isDarkMode ? 'rgba(10,10,14,0.98)' : 'rgba(255,255,255,0.97)', boxShadow: '0 0 40px rgba(244,63,94,0.12)' }}>
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-800/50" style={{ background: isDarkMode ? 'rgba(14,14,18,0.99)' : 'rgba(245,244,241,0.99)' }}>
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Live Recording · Real-Time Transcription</span>
                </div>
                <div className="px-4 py-3.5">
                  <p className="text-[12px] text-zinc-300 font-medium leading-relaxed min-h-[2.5em]">
                    {liveTranscriptText}
                    <span className="inline-block w-0.5 h-3 bg-rose-400 ml-0.5 align-middle lp-rec-dot"></span>
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: 'Noise Reduction', color: '#f43f5e' },
                      { label: 'AI Analysis',     color: '#8b5cf6' },
                      { label: '90+ Languages',   color: '#22c55e' },
                    ].map(tag => (
                      <span key={tag.label} className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide border" style={{ color: tag.color, borderColor: `${tag.color}40`, background: `${tag.color}0f` }}>
                        {tag.label} ✓
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Peer cards — single-column stack, no rotation */}
              <div className="grid grid-cols-1 gap-3">
                {RELAY_PEERS.map((mode, i) => (
                  <div
                    key={mode.name}
                    className="relative p-4 rounded-2xl border border-zinc-700/60"
                    style={{ background: isDarkMode ? 'rgba(18,18,26,0.96)' : 'rgba(255,255,255,0.96)' }}
                  >
                    <span
                      className="absolute top-3 right-3 uppercase tracking-widest"
                      aria-hidden="true"
                      style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(244,63,94,0.12)', color: '#fda4af', fontSize: '10px', letterSpacing: '0.1em', fontWeight: 500, border: '1px solid rgba(244,63,94,0.25)', fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
                    >{mode.key}</span>
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center mb-3">
                      <span className="text-rose-500">{voxSvg(i)}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1.5 leading-tight">{mode.name}</h3>
                    <p className="text-zinc-400 text-[12px] leading-relaxed pr-10">{mode.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        <SectionDivider />

        {/* Section A2 — Glimpse (video-player mock, Wave 4.1) */}
        <section id="section-glimpse" className={`py-24 px-6 relative overflow-hidden${isDarkMode ? '' : ' bg-stone-50'}`}>
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDarkMode ? 1 : 0.55 }}>
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 70% 40%, rgba(244,63,94,0.10) 0%, transparent 55%), radial-gradient(ellipse at 25% 70%, rgba(236,72,153,0.06) 0%, transparent 50%)',
            }} />
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-12 animate-fade-in max-w-3xl">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5${isDarkMode ? ' bg-rose-500/10 border border-rose-500/25 text-rose-300' : ' bg-rose-50 border border-rose-200 text-rose-600'}`}>
                <Video size={12} aria-hidden="true" /> Glimpse
              </div>
              <h2 className={`text-4xl sm:text-6xl font-bold mb-4 tracking-tight${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`}>
                30-second video replaces a 30-minute call.
              </h2>
              <p className={`text-lg leading-relaxed${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                Face-cam, screen, or both. AI transcripts make every clip searchable. Reply with another Glimpse. Full async video conversation, zero context lost.
              </p>
            </div>

            {/* Video player mock */}
            <div
              data-reveal
              className={`lp-glimpse mx-auto max-w-4xl rounded-2xl border overflow-hidden lp-card-hover${isDarkMode ? ' bg-zinc-950 border-zinc-800' : ' bg-white border-stone-200 shadow-sm'}`}
            >
              {/* Player frame */}
              <div
                className="relative aspect-[16/9] overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #0f0f17 60%, #1c1117 100%)',
                }}
              >
                {/* Mock screen-capture content underneath */}
                <div className="absolute inset-0 p-6 sm:p-10 flex flex-col gap-3 opacity-90" aria-hidden="true">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500/70" />
                    <span className="w-2 h-2 rounded-full bg-amber-500/70" />
                    <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
                    <span className="ml-3 text-[10px] uppercase tracking-widest text-zinc-500" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>q3-roadmap.fig</span>
                  </div>
                  {/* Faux Figma frames */}
                  <div className="flex gap-3">
                    <div className="w-1/3 h-12 rounded bg-white/[0.04] border border-white/[0.05]" />
                    <div className="w-1/3 h-12 rounded bg-white/[0.04] border border-white/[0.05]" />
                    <div className="w-1/3 h-12 rounded bg-rose-500/[0.10] border border-rose-500/25" />
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1/4 h-20 rounded bg-white/[0.03] border border-white/[0.05]" />
                    <div className="w-1/4 h-20 rounded bg-white/[0.03] border border-white/[0.05]" />
                    <div className="w-1/4 h-20 rounded bg-rose-500/[0.08] border border-rose-500/20" />
                    <div className="w-1/4 h-20 rounded bg-white/[0.03] border border-white/[0.05]" />
                  </div>
                  <div className="mt-2 h-1 w-2/3 rounded-full bg-white/[0.05]" />
                  <div className="h-1 w-1/2 rounded-full bg-white/[0.05]" />
                </div>

                {/* Face-cam bubble (top-right corner) */}
                <div className="absolute top-4 right-4 w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-white/15 overflow-hidden shadow-lg" style={{ background: 'radial-gradient(circle at 35% 30%, #fb7185 0%, #f43f5e 45%, #881337 100%)' }} aria-hidden="true">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white/90 text-lg sm:text-xl font-semibold tracking-wide" style={{ fontFamily: 'Inter, sans-serif' }}>SL</span>
                  </div>
                </div>

                {/* Recording indicator (top-left) */}
                <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-950/50 backdrop-blur-sm border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" aria-hidden="true" />
                  <span className="text-[10px] uppercase font-semibold text-white/90" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.15em' }}>REC · Screen + Cam</span>
                </div>

                {/* Bottom scrubber */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                  <div className="flex items-center gap-3">
                    <button type="button" className="w-9 h-9 rounded-full bg-white/95 text-zinc-900 flex items-center justify-center shadow-md" aria-label="Play">
                      <i className="fa-solid fa-play text-[12px] translate-x-px" aria-hidden="true" />
                    </button>
                    <div className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: '78%' }} />
                    </div>
                    <span className="text-[11px] tabular-nums font-medium text-white/90" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>00:34 / 00:42</span>
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 text-[9px] uppercase font-semibold text-white/80" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.15em' }}>
                      Direct · Channel · Broadcast
                    </span>
                  </div>
                </div>
              </div>

              {/* Transcript + reply rail */}
              <div className={`grid grid-cols-1 md:grid-cols-[1.4fr_1fr] divide-y md:divide-y-0 md:divide-x${isDarkMode ? ' divide-zinc-800/80' : ' divide-stone-200'}`}>
                {/* Transcript scroll-along */}
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[9px] uppercase font-semibold${isDarkMode ? ' bg-rose-500/10 text-rose-400' : ' bg-rose-50 text-rose-600'}`}
                      style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.1em' }}
                    >
                      <Wand2 size={10} /> Pulse AI · Transcript
                    </span>
                    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] flex-1 sm:flex-none min-w-0 max-w-xs ml-auto border${isDarkMode ? ' border-zinc-800 bg-zinc-900/60 text-zinc-400' : ' border-stone-200 bg-stone-50 text-zinc-500'}`}>
                      <Search size={11} className="shrink-0" />
                      <span className="truncate">&ldquo;Q3 deck&rdquo;</span>
                      <span className={`text-[9px] uppercase tracking-widest shrink-0${isDarkMode ? ' text-rose-400' : ' text-rose-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>00:31</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-[12px] sm:text-[13px] leading-relaxed">
                    <div className={`flex gap-3${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>
                      <span className="tabular-nums shrink-0" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>00:18</span>
                      <span>so I pulled in the variant you flagged last week,</span>
                    </div>
                    <div className={`flex gap-3 -mx-2 px-2 py-1 rounded${isDarkMode ? ' bg-rose-500/[0.06] text-zinc-100' : ' bg-rose-50/60 text-zinc-900'}`}>
                      <span className={`tabular-nums shrink-0 font-semibold${isDarkMode ? ' text-rose-400' : ' text-rose-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>00:31</span>
                      <span><mark className={`bg-transparent font-semibold${isDarkMode ? ' text-rose-300' : ' text-rose-700'}`}>Q3 deck</mark> picks up the rose accent and tightens the type pairing.</span>
                    </div>
                    <div className={`flex gap-3${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>
                      <span className="tabular-nums shrink-0" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>00:42</span>
                      <span>let me know if it&rsquo;s the direction or I&rsquo;ll regroup.</span>
                    </div>
                  </div>
                </div>

                {/* Reply rail */}
                <div className={`p-5 sm:p-6${isDarkMode ? ' bg-zinc-900/40' : ' bg-stone-50/40'}`}>
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[9px] uppercase font-semibold${isDarkMode ? ' bg-rose-500/10 text-rose-400' : ' bg-rose-50 text-rose-600'}`}
                      style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.1em' }}
                    >
                      <Wand2 size={10} /> Pulse AI · Reply draft
                    </span>
                    <div className="inline-flex items-center gap-1.5">
                      {['👍', '👀', '🔥'].map((e, i) => (
                        <span key={i} className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] border${isDarkMode ? ' border-zinc-800 bg-zinc-900/60' : ' border-stone-200 bg-white'}`}>{e}</span>
                      ))}
                    </div>
                  </div>
                  <p className={`text-[12px] sm:text-[13px] leading-relaxed mb-3${isDarkMode ? ' text-zinc-300' : ' text-zinc-700'}`}>
                    Direction&rsquo;s right. Keep the rose pairing, tighten the H1 leading, and ship the variant by EOD. I&rsquo;ll send a 20s Glimpse approving it.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-500 text-white hover:bg-rose-600">
                      <i className="fa-solid fa-circle text-[8px]" aria-hidden="true" /> Record reply
                    </button>
                    <button type="button" className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border${isDarkMode ? ' border-zinc-700 text-zinc-300 hover:bg-zinc-800' : ' border-stone-200 text-zinc-700 hover:bg-stone-100'}`}>Edit script</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Inline feature chips — replaces the 6 cards */}
            <div className="mt-8 flex items-center justify-center flex-wrap gap-x-5 gap-y-2 text-[10px] uppercase font-semibold" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.2em' }}>
              {['Face-cam + Screen', 'AI Transcripts', 'Threaded', 'AI Drafts', 'Full-text Search', 'Direct · Channel · Broadcast'].map((label, i) => (
                <span key={i} className={`${isDarkMode ? 'text-zinc-500' : 'text-zinc-500'}`}>{label}</span>
              ))}
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* Section B — War Room (terminal-mock layout, Wave 4.1) */}
        <section className={`py-24 px-6 relative overflow-hidden${isDarkMode ? '' : ' bg-stone-50'}`}>
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDarkMode ? 1 : 0.55 }}>
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 30% 40%, rgba(244,63,94,0.08) 0%, transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(236,72,153,0.05) 0%, transparent 50%)',
            }} />
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-12 animate-fade-in">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4${isDarkMode ? ' bg-purple-500/10 border border-purple-500/25 text-purple-400' : ' bg-purple-50 border border-purple-200 text-purple-600'}`}>
                <Radar size={12} /> War Room
              </div>
              <h2 className={`text-4xl sm:text-6xl font-bold mb-4${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`}>
                Your AI War Room
              </h2>
              <p className={`text-lg max-w-2xl${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                Eight slash commands, four agent personas, RAG-grounded answers, and a realtime voice agent. Research-grade AI for high-stakes decisions.
              </p>
            </div>

            {/* Terminal mock */}
            <div
              data-reveal
              className={`lp-warroom rounded-2xl border overflow-hidden lp-card-hover${isDarkMode ? ' bg-zinc-950 border-zinc-800' : ' bg-white border-stone-200 shadow-sm'}`}
              style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
            >
              {/* Top bar */}
              <div className={`flex items-center justify-between px-5 py-3 border-b${isDarkMode ? ' border-zinc-800/80 bg-zinc-950' : ' border-stone-200 bg-stone-50/60'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f43f5e' }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#10b981' }} />
                  </div>
                  <div className={`text-[11px] font-medium${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>Q2 Strategy Session</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest${isDarkMode ? ' text-purple-400' : ' text-purple-600'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />@general
                  </div>
                  <div className={`hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-widest${isDarkMode ? ' text-rose-400' : ' text-rose-600'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />Live
                  </div>
                </div>
              </div>

              {/* Body: sidebar + transcript */}
              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr]">
                {/* Sidebar */}
                <div className={`hidden md:block border-r p-4 text-[11px] space-y-5${isDarkMode ? ' border-zinc-800/80 bg-zinc-900/40' : ' border-stone-200 bg-stone-50/40'}`}>
                  <div>
                    <div className={`text-[9px] uppercase tracking-widest mb-2 font-semibold${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>Personas</div>
                    <ul className="space-y-1.5">
                      {[
                        { name: '@general',    active: true  },
                        { name: '@skeptic',    active: false },
                        { name: '@scribe',     active: false },
                        { name: '@deep-diver', active: false },
                      ].map(p => (
                        <li key={p.name} className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full${p.active ? ' bg-rose-500' : (isDarkMode ? ' bg-zinc-700' : ' bg-stone-300')}`} />
                          <span className={p.active
                            ? (isDarkMode ? 'text-rose-400 font-medium' : 'text-rose-600 font-medium')
                            : (isDarkMode ? 'text-zinc-400' : 'text-zinc-600')}>{p.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className={`text-[9px] uppercase tracking-widest mb-2 font-semibold${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>RAG Sources</div>
                    <ul className="space-y-1.5">
                      {[
                        { name: 'Q1-OKR.pdf', icon: 'fa-regular fa-file-pdf'   },
                        { name: 'Hires.csv',  icon: 'fa-regular fa-file-lines' },
                        { name: 'Exits.csv',  icon: 'fa-regular fa-file-lines' },
                      ].map(s => (
                        <li key={s.name} className={`flex items-center gap-2${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                          <i className={`${s.icon} text-[10px] ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`} aria-hidden="true" />
                          <span className="truncate">{s.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className={`text-[9px] uppercase tracking-widest mb-2 font-semibold${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>Voice Agent</div>
                    <div className={`flex items-center gap-2${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                      <div className="flex items-end gap-0.5 h-4">
                        <span className="lp-wr-voicebar inline-block w-0.5 h-full bg-rose-500" />
                        <span className="lp-wr-voicebar inline-block w-0.5 h-full bg-rose-500" />
                        <span className="lp-wr-voicebar inline-block w-0.5 h-full bg-rose-500" />
                      </div>
                      <span className="text-[10px]">Listening</span>
                    </div>
                  </div>
                </div>

                {/* Transcript */}
                <div className={`p-5 sm:p-6 text-[12px] sm:text-[13px] leading-relaxed${isDarkMode ? ' text-zinc-300' : ' text-zinc-700'}`}>
                  <div className="lp-wr-line" style={{ '--lp-wr-i': 0 } as React.CSSProperties}>
                    <span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>10:42</span>
                    <span className={`mx-2${isDarkMode ? ' text-rose-400' : ' text-rose-600'}`}>&gt;</span>
                    <span className={isDarkMode ? 'text-rose-400' : 'text-rose-600'}>/analyze</span>
                    <span> Q2 attrition vs hiring velocity</span>
                  </div>

                  <div className="lp-wr-line mt-3" style={{ '--lp-wr-i': 1 } as React.CSSProperties}>
                    <span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>10:42</span>
                    <span className={`ml-3${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>
                      Searching 12 sources · vector match complete
                    </span>
                  </div>

                  <div className="lp-wr-line mt-4" style={{ '--lp-wr-i': 2 } as React.CSSProperties}>
                    <div className={`text-[9px] uppercase tracking-widest mb-2${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>
                      ── Artifact · table ──
                    </div>
                    <div className={`rounded-lg border overflow-hidden${isDarkMode ? ' border-zinc-800 bg-zinc-900/60' : ' border-stone-200 bg-stone-50'}`}>
                      <table className="w-full text-[11px] sm:text-[12px]">
                        <thead>
                          <tr>
                            <th className={`text-left font-semibold px-3 py-2 uppercase tracking-wider text-[9px]${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>Region</th>
                            <th className={`text-right font-semibold px-3 py-2 uppercase tracking-wider text-[9px]${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>Attrition</th>
                            <th className={`text-right font-semibold px-3 py-2 uppercase tracking-wider text-[9px]${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>Hiring</th>
                            <th className={`text-right font-semibold px-3 py-2 uppercase tracking-wider text-[9px]${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { region: 'NAMER', attr: '4.2%', hire: '+18', net: '+12', tone: 'emerald' as const },
                            { region: 'EMEA',  attr: '6.8%', hire: '+9',  net: '−3',  tone: 'rose'    as const },
                            { region: 'APAC',  attr: '3.1%', hire: '+14', net: '+11', tone: 'emerald' as const },
                          ].map(r => {
                            const netCls = r.tone === 'emerald'
                              ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')
                              : (isDarkMode ? 'text-rose-400' : 'text-rose-500');
                            return (
                              <tr key={r.region} className={`border-t${isDarkMode ? ' border-zinc-800/60' : ' border-stone-200/80'}`}>
                                <td className={`px-3 py-2 ${isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>{r.region}</td>
                                <td className={`px-3 py-2 text-right tabular-nums ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>{r.attr}</td>
                                <td className={`px-3 py-2 text-right tabular-nums ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>{r.hire}</td>
                                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${netCls}`}>{r.net}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="lp-wr-line mt-4" style={{ '--lp-wr-i': 3 } as React.CSSProperties}>
                    <span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>10:43</span>
                    <span className="ml-3">EMEA shows net-negative for 2 quarters. Flag for review.</span>
                  </div>

                  <div className="lp-wr-line mt-3" style={{ '--lp-wr-i': 4 } as React.CSSProperties}>
                    <span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>10:44</span>
                    <span className={`mx-2${isDarkMode ? ' text-rose-400' : ' text-rose-600'}`}>&gt;</span>
                    <span className={isDarkMode ? 'text-rose-400' : 'text-rose-600'}>/risks</span>
                    <span className={`lp-wr-cursor ml-1${isDarkMode ? ' text-rose-400' : ' text-rose-600'}`} aria-hidden="true" />
                  </div>
                </div>
              </div>

              {/* Command palette footer */}
              <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 border-t text-[10px] uppercase tracking-widest${isDarkMode ? ' border-zinc-800/80 bg-zinc-950 text-zinc-500' : ' border-stone-200 bg-stone-50/60 text-zinc-500'}`}>
                <span className={`text-[9px] font-semibold mr-2${isDarkMode ? ' text-zinc-600' : ' text-zinc-400'}`}>Commands</span>
                {['/analyze', '/brainstorm', '/decide', '/risks', '/plan', '/compare', '/summarize', '/debrief'].map((c, i) => (
                  <span
                    key={c}
                    className={(i === 0 || i === 3)
                      ? (isDarkMode ? 'text-rose-400 font-semibold' : 'text-rose-600 font-semibold')
                      : ''}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* Section B2 — Email (inbox-mock layout, Wave 4.1) — hidden for v1 via SHOW_EMAIL_ON_LANDING */}
        {SHOW_EMAIL_ON_LANDING && (<>
        <section className={`py-24 px-6 relative overflow-hidden${isDarkMode ? '' : ' bg-stone-50'}`}>
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDarkMode ? 1 : 0.55 }}>
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 70% 30%, rgba(244,63,94,0.08) 0%, transparent 55%), radial-gradient(ellipse at 30% 70%, rgba(236,72,153,0.05) 0%, transparent 50%)',
            }} />
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-12 animate-fade-in max-w-3xl">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5${isDarkMode ? ' bg-blue-500/10 border border-blue-500/25 text-blue-400' : ' bg-blue-50 border border-blue-200 text-blue-600'}`}>
                <i className="fa-solid fa-envelope text-xs" aria-hidden="true"></i> Email
              </div>
              <h2 className={`text-4xl sm:text-6xl font-bold mb-4 tracking-tight${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`}>
                Email, reimagined.
              </h2>
              <p className={`text-lg leading-relaxed${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                Gmail in one pane, AI in the other. The threads that need you, surfaced. The ones going cold, flagged. The reply, drafted.
              </p>
            </div>

            {/* Inbox split-pane mock */}
            <div
              data-reveal
              className={`lp-inbox rounded-2xl border overflow-hidden lp-card-hover${isDarkMode ? ' bg-zinc-950 border-zinc-800' : ' bg-white border-stone-200 shadow-sm'}`}
            >
              {/* Top bar */}
              <div className={`flex items-center justify-between px-5 py-3 border-b${isDarkMode ? ' border-zinc-800/80 bg-zinc-950' : ' border-stone-200 bg-stone-50/60'}`}>
                <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold${isDarkMode ? ' text-blue-400' : ' text-blue-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                  <i className="fa-brands fa-google text-[11px]" aria-hidden="true" /> Gmail · Synced 2s ago
                </div>
                <div className={`hidden sm:flex items-center gap-3 text-[10px] uppercase tracking-widest${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                  <span>Inbox · 47</span>
                  <span className={isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}>·</span>
                  <span className={isDarkMode ? 'text-rose-400' : 'text-rose-600'}>3 need you</span>
                </div>
              </div>

              {/* Body: thread list + expanded thread */}
              <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr]">
                {/* Thread list */}
                <div className={`border-b lg:border-b-0 lg:border-r${isDarkMode ? ' border-zinc-800/80 bg-zinc-900/40' : ' border-stone-200 bg-stone-50/40'}`}>
                  {[
                    { from: 'Anya Patel',  subject: 'Re: Q2 Strategy + budget questions',   snippet: 'On board with the EMEA pause. Two follow-ups before we …', time: '11m', chip: 'AI Brief',     chipTone: 'rose',      selected: true,  unread: false },
                    { from: 'Sarah Lin',   subject: 'Beta launch sequence ready',            snippet: '5-touch sequence loaded. Sign-off on segment 2 before …', time: '23m', chip: 'Campaign',     chipTone: 'blue',      selected: false, unread: true  },
                    { from: 'Marcus Webb', subject: 'When can we sync on the hiring plan?',  snippet: 'Hey, circling back on the convo from two weeks ago …',   time: '3d',  chip: 'Going cold',   chipTone: 'rose-warn', selected: false, unread: false },
                    { from: 'PostHog',     subject: 'Your weekly product report',            snippet: 'Activation is up 12%. Three experiments wrapped …',       time: '1h',  chip: 'Digest',       chipTone: 'zinc',      selected: false, unread: false },
                    { from: 'Stripe',      subject: 'Action required · invoice #4428',       snippet: 'Card on file failed for $1,240. Auto-retry in 3 days …', time: '2h',  chip: 'Urgent',       chipTone: 'amber',     selected: false, unread: true  },
                  ].map((t, i) => {
                    const chipCls =
                      t.chipTone === 'rose'      ? (isDarkMode ? 'bg-rose-500/10 text-rose-400'   : 'bg-rose-50 text-rose-600') :
                      t.chipTone === 'rose-warn' ? (isDarkMode ? 'bg-rose-500/10 text-rose-300 border border-rose-500/25' : 'bg-rose-50 text-rose-600 border border-rose-200') :
                      t.chipTone === 'blue'      ? (isDarkMode ? 'bg-blue-500/10 text-blue-400'   : 'bg-blue-50 text-blue-600') :
                      t.chipTone === 'amber'     ? (isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600') :
                                                   (isDarkMode ? 'bg-zinc-800 text-zinc-400'      : 'bg-stone-100 text-zinc-600');
                    return (
                      <div
                        key={i}
                        className={`relative px-4 py-3 border-b transition-colors${
                          isDarkMode ? ' border-zinc-800/60' : ' border-stone-200/80'
                        }${
                          t.selected
                            ? (isDarkMode ? ' bg-rose-500/[0.04]' : ' bg-rose-50/40')
                            : (isDarkMode ? ' hover:bg-zinc-900/60' : ' hover:bg-stone-100/60')
                        }`}
                      >
                        {t.selected && <span className="absolute left-0 top-0 bottom-0 w-px bg-rose-500" aria-hidden="true" />}
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className={`text-[12px] truncate${t.unread ? ' font-semibold' : ' font-medium'}${isDarkMode ? ' text-zinc-100' : ' text-zinc-900'}`}>{t.from}</span>
                          <span className={`text-[10px] tabular-nums shrink-0${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>{t.time}</span>
                        </div>
                        <div className={`text-[12px] truncate mb-1${t.unread ? ' font-medium' : ''}${isDarkMode ? ' text-zinc-300' : ' text-zinc-700'}`}>{t.subject}</div>
                        <div className={`text-[11px] truncate mb-2${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>{t.snippet}</div>
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] uppercase font-semibold ${chipCls}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.1em' }}>{t.chip}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Expanded thread */}
                <div className="p-5 sm:p-7">
                  <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                    <div className="min-w-0">
                      <div className={`text-base sm:text-lg font-semibold mb-1 leading-snug${isDarkMode ? ' text-zinc-100' : ' text-zinc-900'}`}>
                        Re: Q2 Strategy + budget questions
                      </div>
                      <div className={`text-[12px]${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>
                        Anya Patel <span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>&lt;anya@quantumecos.com&gt;</span> · 11 min ago
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[9px] uppercase font-semibold${isDarkMode ? ' bg-rose-500/10 text-rose-400' : ' bg-rose-50 text-rose-600'}`}
                      style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.1em' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Pulse AI · Brief
                    </span>
                  </div>

                  {/* AI briefing block */}
                  <div className={`rounded-xl border p-4 mb-5${isDarkMode ? ' border-rose-500/20 bg-rose-500/[0.04]' : ' border-rose-200 bg-rose-50/40'}`}>
                    <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2${isDarkMode ? ' text-rose-400' : ' text-rose-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                      What you need to know
                    </div>
                    <ul className={`text-[13px] space-y-1.5 leading-relaxed${isDarkMode ? ' text-zinc-300' : ' text-zinc-700'}`}>
                      <li className="flex gap-2"><span className={isDarkMode ? 'text-rose-400' : 'text-rose-500'}>·</span> Anya agrees with the EMEA pause, asks for net-hire revisit by Friday.</li>
                      <li className="flex gap-2"><span className={isDarkMode ? 'text-rose-400' : 'text-rose-500'}>·</span> Two budget line items still unresolved: tooling ($18k) and contractor coverage.</li>
                      <li className="flex gap-2"><span className={isDarkMode ? 'text-rose-400' : 'text-rose-500'}>·</span> Decision needed before her board update Tuesday 10am.</li>
                    </ul>
                  </div>

                  {/* Action items */}
                  <div className="mb-5">
                    <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                      Action items · auto-extracted
                    </div>
                    <ul className="space-y-1.5">
                      {[
                        { txt: 'Send revised net-hire plan',            due: 'Fri' },
                        { txt: 'Approve $18k tooling line',              due: 'Mon' },
                        { txt: 'Reply with contractor coverage answer',  due: 'Today' },
                      ].map((a, i) => (
                        <li key={i} className={`flex items-center justify-between gap-3 text-[12px] px-3 py-2 rounded-lg${isDarkMode ? ' bg-zinc-900/60' : ' bg-stone-50'}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-3.5 h-3.5 rounded border shrink-0${isDarkMode ? ' border-zinc-700' : ' border-zinc-300'}`} />
                            <span className={`truncate${isDarkMode ? ' text-zinc-300' : ' text-zinc-700'}`}>{a.txt}</span>
                          </div>
                          <span className={`text-[10px] uppercase tracking-widest shrink-0${a.due === 'Today' ? (isDarkMode ? ' text-rose-400' : ' text-rose-600') : (isDarkMode ? ' text-zinc-500' : ' text-zinc-500')}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>{a.due}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* AI draft reply */}
                  <div className={`rounded-xl border p-4${isDarkMode ? ' border-zinc-800 bg-zinc-900/40' : ' border-stone-200 bg-stone-50/60'}`}>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[9px] uppercase font-semibold${isDarkMode ? ' bg-rose-500/10 text-rose-400' : ' bg-rose-50 text-rose-600'}`}
                        style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.1em' }}
                      >
                        <Wand2 size={10} /> Pulse AI · Draft
                      </span>
                      <span className={`text-[10px] uppercase tracking-widest${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                        Tone · Direct
                      </span>
                    </div>
                    <p className={`text-[13px] leading-relaxed mb-3${isDarkMode ? ' text-zinc-300' : ' text-zinc-700'}`}>
                      Anya, agreed on the pause. Sending revised hire plan Friday and the contractor answer today. I'll greenlight the $18k tooling line by Monday so we're clean for the board update.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" className="px-3 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 bg-rose-500 text-white hover:bg-rose-600">
                        Send <i className="fa-solid fa-paper-plane text-[10px]" aria-hidden="true" />
                      </button>
                      <button type="button" className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border${isDarkMode ? ' border-zinc-700 text-zinc-300 hover:bg-zinc-800' : ' border-stone-200 text-zinc-700 hover:bg-stone-100'}`}>Edit</button>
                      <button type="button" className={`px-3 py-1.5 rounded-lg text-[11px] font-medium${isDarkMode ? ' text-zinc-500 hover:text-zinc-300' : ' text-zinc-500 hover:text-zinc-700'}`}>Regenerate</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SectionDivider />
        </>)}

        {/* Section B3 — Messaging (channel-mock layout, Wave 4.1) */}
        <section className={`py-24 px-6 relative overflow-hidden${isDarkMode ? '' : ' bg-stone-50'}`}>
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDarkMode ? 1 : 0.55 }}>
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 50% 40%, rgba(244,63,94,0.08) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(236,72,153,0.05) 0%, transparent 50%)',
            }} />
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-12 animate-fade-in max-w-3xl">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5${isDarkMode ? ' bg-indigo-500/10 border border-indigo-500/25 text-indigo-400' : ' bg-indigo-50 border border-indigo-200 text-indigo-600'}`}>
                <i className="fa-solid fa-comments text-xs" aria-hidden="true"></i> Messaging
              </div>
              <h2 className={`text-4xl sm:text-6xl font-bold mb-4 tracking-tight${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`}>
                Conversations that convert.
              </h2>
              <p className={`text-lg leading-relaxed${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                Pulse channels, threads, and DMs in one surface, with Slack as an opt-in connector. Walk away for an hour. Pulse summarizes the thread before you reopen it.
              </p>
            </div>

            {/* Channel mock — side rail + thread view with AI Summary pinned */}
            <div
              data-reveal
              className={`lp-channel rounded-2xl border overflow-hidden lp-card-hover${isDarkMode ? ' bg-zinc-950 border-zinc-800' : ' bg-white border-stone-200 shadow-sm'}`}
            >
              {/* Top bar: channel + focus + member presence */}
              <div className={`flex items-center justify-between px-5 py-3 border-b gap-3 flex-wrap${isDarkMode ? ' border-zinc-800/80 bg-zinc-950' : ' border-stone-200 bg-stone-50/60'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[14px] font-semibold truncate${isDarkMode ? ' text-zinc-100' : ' text-zinc-900'}`}>
                    <span className={isDarkMode ? 'text-zinc-500 mr-1' : 'text-zinc-400 mr-1'}>#</span>strategy
                  </span>
                  <span className={`text-[10px] uppercase tracking-widest${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>4 members</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase font-semibold${isDarkMode ? ' bg-rose-500/10 text-rose-400' : ' bg-rose-50 text-rose-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.1em' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> Focus · 18:42
                  </span>
                  <div className="hidden sm:flex items-center -space-x-1.5">
                    {['#f43f5e', '#f59e0b', '#3b82f6', '#10b981'].map((c, i) => (
                      <span key={i} className={`inline-block w-5 h-5 rounded-full ring-2${isDarkMode ? ' ring-zinc-950' : ' ring-white'}`} style={{ background: c }} aria-hidden="true" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Inline channel strip — replaces the side rail. Robust at every viewport. */}
              <div className={`flex items-center gap-x-4 gap-y-2 flex-wrap px-5 py-2.5 border-b text-[10px] uppercase tracking-widest font-semibold${isDarkMode ? ' border-zinc-800/80 bg-zinc-900/40 text-zinc-500' : ' border-stone-200 bg-stone-50/40 text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                <span className="inline-flex items-center gap-1.5">
                  <span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>Unified</span>
                  <i className="fa-brands fa-slack text-[11px]" aria-hidden="true" />
                </span>
                <span className={isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}>·</span>
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>Channels</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded${isDarkMode ? ' bg-rose-500/10 text-rose-400' : ' bg-rose-50 text-rose-600'}`}><span className={isDarkMode ? 'text-rose-400/60' : 'text-rose-500/60'}>#</span>strategy</span>
                  <span className="hidden sm:inline-flex items-center gap-1"><span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>#</span>launches <span className={`px-1 rounded tabular-nums normal-case${isDarkMode ? ' bg-zinc-800 text-zinc-300' : ' bg-zinc-200 text-zinc-700'}`}>3</span></span>
                  <span className="hidden md:inline-flex items-center gap-1"><span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>#</span>design</span>
                  <span className="hidden md:inline-flex items-center gap-1"><span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>#</span>engineering <span className={`px-1 rounded tabular-nums normal-case${isDarkMode ? ' bg-zinc-800 text-zinc-300' : ' bg-zinc-200 text-zinc-700'}`}>12</span></span>
                </span>
                <span className={`hidden sm:inline ${isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}`}>·</span>
                <span className="hidden sm:inline-flex items-center gap-2 flex-wrap">
                  <span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>DMs</span>
                  <span className="inline-flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />Anya</span>
                  <span className={isDarkMode ? 'text-zinc-500' : 'text-zinc-500'}>Marcus · Sarah</span>
                </span>
              </div>

              {/* Thread pane — always full width */}
              <div className="p-5 sm:p-6">
                  {/* Pinned AI Summary */}
                  <div className={`relative rounded-xl border p-4 mb-5${isDarkMode ? ' border-rose-500/25 bg-rose-500/[0.05]' : ' border-rose-200 bg-rose-50/50'}`}>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[9px] uppercase font-semibold${isDarkMode ? ' bg-rose-500/15 text-rose-300' : ' bg-rose-100 text-rose-700'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.1em' }}>
                        <i className="fa-solid fa-thumbtack text-[9px]" aria-hidden="true" /> Pinned · Pulse AI Summary
                      </span>
                      <span className={`text-[10px] uppercase tracking-widest${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>32 msgs · 1h</span>
                    </div>
                    <p className={`text-[13px] leading-relaxed mb-2${isDarkMode ? ' text-zinc-200' : ' text-zinc-800'}`}>
                      Team aligned on shipping the EMEA pause. Two open questions: tooling budget and contractor coverage. Marcus wants the hiring plan revisit before Friday.
                    </p>
                    <div className="flex items-center gap-3 flex-wrap text-[10px] uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                      <span className={isDarkMode ? 'text-rose-400' : 'text-rose-600'}>3 decisions</span>
                      <span className={isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}>·</span>
                      <span className={isDarkMode ? 'text-rose-400' : 'text-rose-600'}>5 actions</span>
                      <span className={isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}>·</span>
                      <span className={isDarkMode ? 'text-zinc-500' : 'text-zinc-500'}>2 owners flagged</span>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="space-y-4">
                    {[
                      { name: 'Anya Patel',  color: '#f43f5e', time: '10:42', body: 'Re: hiring revisit, let me know which roles you want me to pull from EMEA pipeline so I can repoint Marcus.', reactions: [['👀', 2], ['🙏', 1]] as Array<[string, number]>, mentions: false, highlight: false },
                      { name: 'Sarah Lin',   color: '#3b82f6', time: '10:44', body: 'Pulled together a `compare-segments.md` for the campaign rebuild. Anyone want to pair on it before EOD?', reactions: [['✅', 3]] as Array<[string, number]>, mentions: false, highlight: false, code: true },
                      { name: 'Marcus Webb', color: '#10b981', time: '10:46', body: '@you, I can take the contractor coverage answer if you handle the tooling line. Saves a round-trip.', reactions: [] as Array<[string, number]>, mentions: true, highlight: true },
                    ].map((m, i) => (
                      <div key={i} className={`flex gap-3 ${m.highlight ? '-mx-2 px-2 py-2 rounded-lg ' + (isDarkMode ? 'bg-amber-500/[0.05]' : 'bg-amber-50/50') : ''}`}>
                        <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: m.color }} aria-hidden="true">{m.name.split(' ').map(n => n[0]).join('')}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className={`text-[13px] font-semibold${isDarkMode ? ' text-zinc-100' : ' text-zinc-900'}`}>{m.name}</span>
                            <span className={`text-[10px] tabular-nums${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>{m.time}</span>
                            {m.mentions && (
                              <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded${isDarkMode ? ' bg-amber-500/15 text-amber-400' : ' bg-amber-100 text-amber-700'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>Mention</span>
                            )}
                          </div>
                          <p className={`text-[13px] leading-relaxed mb-1.5${isDarkMode ? ' text-zinc-300' : ' text-zinc-700'}`}>
                            {m.code ? (
                              <>Pulled together a <code className={`px-1.5 py-0.5 rounded text-[12px]${isDarkMode ? ' bg-zinc-800 text-rose-300' : ' bg-stone-100 text-rose-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>compare-segments.md</code> for the campaign rebuild. Anyone want to pair on it before EOD?</>
                            ) : (
                              m.body
                            )}
                          </p>
                          {m.reactions.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {m.reactions.map(([emoji, count], j) => (
                                <span key={j} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border${isDarkMode ? ' border-zinc-800 bg-zinc-900/60 text-zinc-300' : ' border-stone-200 bg-stone-50 text-zinc-700'}`}>
                                  <span>{emoji}</span><span className="tabular-nums text-[10px]">{count}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {m.highlight && (
                            <div className={`mt-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold${isDarkMode ? ' text-rose-400' : ' text-rose-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                              <Wand2 size={10} /> Pulse AI · Quick Reply ready
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Compose area */}
                  <div className={`mt-6 rounded-xl border p-3 flex items-center gap-2 flex-wrap${isDarkMode ? ' border-zinc-800 bg-zinc-900/40' : ' border-stone-200 bg-stone-50/60'}`}>
                    <span className={`text-[11px] flex-1 min-w-0${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>Message #strategy …</span>
                    <div className={`flex items-center gap-2 text-[11px]${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>
                      <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }} className="text-[10px] uppercase tracking-widest">B  I  &lt;/&gt;  @</span>
                    </div>
                  </div>
              </div>
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* Section B4 — Calendar (agenda-strip layout, Wave 4.1) */}
        <section className={`py-24 px-6 relative overflow-hidden${isDarkMode ? '' : ' bg-stone-50'}`}>
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDarkMode ? 1 : 0.55 }}>
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 40% 30%, rgba(244,63,94,0.08) 0%, transparent 55%), radial-gradient(ellipse at 60% 70%, rgba(236,72,153,0.05) 0%, transparent 50%)',
            }} />
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-12 animate-fade-in max-w-3xl">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5${isDarkMode ? ' bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' : ' bg-emerald-50 border border-emerald-200 text-emerald-600'}`}>
                <i className="fa-solid fa-calendar text-xs" aria-hidden="true"></i> Calendar
              </div>
              <h2 className={`text-4xl sm:text-6xl font-bold mb-4 tracking-tight${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`}>
                Time, orchestrated.
              </h2>
              <p className={`text-lg leading-relaxed${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                Google and Outlook side by side. Conflicts flagged before they happen. Meeting briefs ready before you walk in.
              </p>
            </div>

            {/* Flat agenda strip — no internal cards, hairline rows */}
            <div
              data-reveal
              className={`lp-agenda rounded-2xl border overflow-hidden lp-card-hover max-w-5xl${isDarkMode ? ' bg-zinc-950 border-zinc-800' : ' bg-white border-stone-200 shadow-sm'}`}
            >
              {/* Top bar */}
              <div className={`flex items-center justify-between px-5 py-3 border-b gap-3 flex-wrap${isDarkMode ? ' border-zinc-800/80 bg-zinc-950' : ' border-stone-200 bg-stone-50/60'}`}>
                <div className="min-w-0">
                  <div className={`text-[10px] uppercase tracking-widest mb-0.5${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>Thursday</div>
                  <div className={`text-base font-semibold${isDarkMode ? ' text-zinc-100' : ' text-zinc-900'}`}>May 16 · Today</div>
                </div>
                <div className={`flex items-center gap-3 text-[10px] uppercase tracking-widest${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                  <span className="inline-flex items-center gap-1.5"><i className="fa-brands fa-google text-[10px]" aria-hidden="true" /> Google</span>
                  <span className="inline-flex items-center gap-1.5"><i className="fa-brands fa-microsoft text-[10px]" aria-hidden="true" /> Outlook</span>
                  <span className={isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}>·</span>
                  <span className={isDarkMode ? 'text-rose-400' : 'text-rose-600'}>1 conflict</span>
                  <span className={isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}>·</span>
                  <span className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}>1 open slot</span>
                </div>
              </div>

              {/* Agenda rows */}
              <ul>
                {[
                  { time: '09:00', dur: '60m', title: 'Q2 Strategy Review',           source: 'google',  attendees: '6 attendees · Google Meet',           status: 'past',     flag: null,        prep: null },
                  { time: '10:30', dur: '60m', title: '1:1 · Anya Patel',              source: 'pulse',   attendees: 'Pulse Meet · prep ready',             status: 'now',      flag: 'Now',       prep: 'Send-ahead brief drafted · 3 talking points' },
                  { time: '12:00', dur: '90m', title: 'Focus Block',                   source: 'pulse',   attendees: 'Notifications off · DND on',          status: 'upcoming', flag: null,        prep: null },
                  { time: '13:30', dur: '60m', title: 'Design Sync',                   source: 'google',  attendees: 'Sarah, Marcus + 2',                   status: 'upcoming', flag: 'Conflict',  prep: 'Overlaps 14:00 Customer Call · resolve?' },
                  { time: '14:00', dur: '60m', title: 'Customer Call · Acme Corp',     source: 'outlook', attendees: 'Acme team · agenda attached',         status: 'upcoming', flag: 'Conflict',  prep: null },
                  { time: '16:00', dur: '60m', title: 'Open · Bookable slot',          source: 'pulse',   attendees: 'Share booking link',                  status: 'open',     flag: 'Open',      prep: null },
                ].map((e, i) => {
                  const isNow      = e.status === 'now';
                  const isConflict = e.flag    === 'Conflict';
                  const isOpen     = e.status  === 'open';
                  const isPast     = e.status  === 'past';

                  const sourceDot =
                    e.source === 'google'  ? 'bg-blue-500'   :
                    e.source === 'outlook' ? 'bg-sky-500'    :
                                             'bg-rose-500';

                  return (
                    <li
                      key={i}
                      className={`relative px-5 py-4 border-b last:border-b-0 grid grid-cols-[68px_1fr_auto] sm:grid-cols-[80px_1fr_auto] gap-x-4 items-start transition-colors${
                        isDarkMode ? ' border-zinc-800/60' : ' border-stone-200/80'
                      }${
                        isNow      ? (isDarkMode ? ' bg-rose-500/[0.04]'   : ' bg-rose-50/40')   :
                        isConflict ? (isDarkMode ? ' bg-amber-500/[0.04]'  : ' bg-amber-50/40')  :
                        isOpen     ? (isDarkMode ? ' bg-emerald-500/[0.04]': ' bg-emerald-50/30'): ''
                      }`}
                    >
                      {isNow      && <span className="absolute left-0 top-0 bottom-0 w-px bg-rose-500" aria-hidden="true" />}
                      {isConflict && <span className="absolute left-0 top-0 bottom-0 w-px bg-amber-500" aria-hidden="true" />}
                      {isOpen     && <span className="absolute left-0 top-0 bottom-0 w-px bg-emerald-500" aria-hidden="true" />}

                      {/* Time column */}
                      <div className="text-right">
                        <div className={`text-[13px] tabular-nums font-semibold${isPast ? (isDarkMode ? ' text-zinc-600' : ' text-zinc-400') : (isDarkMode ? ' text-zinc-200' : ' text-zinc-800')}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>{e.time}</div>
                        <div className={`text-[10px] uppercase tracking-widest mt-0.5${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>{e.dur}</div>
                      </div>

                      {/* Event details */}
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${sourceDot}`} aria-hidden="true" />
                          <span className={`text-[14px] font-semibold truncate${isPast ? (isDarkMode ? ' text-zinc-500 line-through' : ' text-zinc-400 line-through') : (isDarkMode ? ' text-zinc-100' : ' text-zinc-900')}`}>{e.title}</span>
                          {e.flag && (
                            <span
                              className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded${
                                e.flag === 'Now'      ? (isDarkMode ? ' bg-rose-500/15 text-rose-300'    : ' bg-rose-100 text-rose-700')  :
                                e.flag === 'Conflict' ? (isDarkMode ? ' bg-amber-500/15 text-amber-300'  : ' bg-amber-100 text-amber-700'):
                                                        (isDarkMode ? ' bg-emerald-500/15 text-emerald-300' : ' bg-emerald-100 text-emerald-700')
                              }`}
                              style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.1em' }}
                            >
                              {e.flag === 'Now' && <span className="inline-block w-1 h-1 rounded-full bg-rose-500 mr-1 align-middle animate-pulse" aria-hidden="true" />}
                              {e.flag}
                            </span>
                          )}
                        </div>
                        <div className={`text-[12px] truncate${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>{e.attendees}</div>
                        {e.prep && (
                          <div className={`mt-1.5 inline-flex items-center gap-1.5 text-[11px]${
                            e.flag === 'Conflict' ? (isDarkMode ? ' text-amber-400' : ' text-amber-600') :
                                                    (isDarkMode ? ' text-rose-400'  : ' text-rose-600')
                          }`}>
                            <Wand2 size={10} />
                            <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }} className="uppercase tracking-widest text-[9px] font-semibold mr-0.5">Pulse AI</span>
                            <span className={`${isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>{e.prep}</span>
                          </div>
                        )}
                      </div>

                      {/* Trailing affordance */}
                      <div className={`text-[10px] uppercase tracking-widest hidden sm:flex items-center gap-1.5${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                        {isOpen ? (
                          <>
                            <i className="fa-solid fa-link text-[10px]" aria-hidden="true" />
                            <span className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}>Share</span>
                          </>
                        ) : isConflict ? (
                          <span className={isDarkMode ? 'text-amber-400' : 'text-amber-600'}>Resolve →</span>
                        ) : isNow ? (
                          <span className={isDarkMode ? 'text-rose-400' : 'text-rose-600'}>Join →</span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Footer NLP input */}
              <div className={`flex items-center gap-3 px-5 py-3 border-t${isDarkMode ? ' border-zinc-800/80 bg-zinc-950' : ' border-stone-200 bg-stone-50/60'}`}>
                <Wand2 size={12} className={isDarkMode ? 'text-rose-400' : 'text-rose-500'} />
                <span className={`text-[12px] flex-1 truncate${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                  <span className={`uppercase text-[9px] tracking-widest font-semibold mr-2${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>Ask Pulse</span>
                  &ldquo;Find 30 min with Anya before Friday&rdquo;
                </span>
                <span className={`text-[10px] uppercase tracking-widest hidden sm:inline${isDarkMode ? ' text-zinc-600' : ' text-zinc-400'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>↵</span>
              </div>
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* Section B5 — Analytics (hero-chart layout, Wave 4.1) */}
        <section className={`py-24 px-6 relative overflow-hidden${isDarkMode ? '' : ' bg-stone-50'}`}>
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDarkMode ? 1 : 0.55 }}>
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 50% 50%, rgba(244,63,94,0.08) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, rgba(236,72,153,0.05) 0%, transparent 50%)',
            }} />
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            {/* Asymmetric hero row: heading left, chart right (Linear-style) */}
            <div className="grid lg:grid-cols-[2fr_3fr] gap-10 lg:gap-14 items-start">
              <div className="animate-fade-in lg:pt-6">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-7${isDarkMode ? ' bg-amber-500/10 border border-amber-500/25 text-amber-400' : ' bg-amber-50 border border-amber-200 text-amber-600'}`}>
                  <i className="fa-solid fa-chart-line text-xs" aria-hidden="true"></i> Analytics
                </div>
                <h2 className={`text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 tracking-tight${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`} style={{ lineHeight: 1.02, letterSpacing: '-0.025em' }}>
                  See<br />everything.
                </h2>
                <p className={`text-lg leading-relaxed max-w-md${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                  Eight views. One stream. Every signal traced back to the conversation that made it.
                </p>
              </div>

              {/* Hero chart card */}
              <div
                data-reveal
                className={`lp-chart relative p-6 sm:p-8 rounded-2xl border lp-card-hover${isDarkMode ? ' bg-zinc-900/80 border-zinc-800' : ' bg-white border-stone-200 shadow-sm'}`}
              >
              {/* Chart header */}
              <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
                <div>
                  <div className={`text-[10px] uppercase tracking-widest mb-1.5${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>
                    Pulse Health · Last 30 days
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className={`text-4xl font-bold tabular-nums${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`}>87</span>
                    <span className={`text-sm font-medium${isDarkMode ? ' text-emerald-400' : ' text-emerald-600'}`}>+5.2% vs avg</span>
                  </div>
                </div>
                <div className={`inline-flex items-center rounded-full p-1 text-[11px] font-semibold tracking-wide${isDarkMode ? ' bg-zinc-800/80' : ' bg-stone-100'}`}>
                  <span className={`px-3 py-1 rounded-full${isDarkMode ? ' text-zinc-400' : ' text-zinc-500'}`}>7D</span>
                  <span className={`px-3 py-1 rounded-full${isDarkMode ? ' bg-zinc-900 text-amber-400 shadow-inner' : ' bg-white text-amber-600 shadow-sm'}`}>30D</span>
                  <span className={`px-3 py-1 rounded-full${isDarkMode ? ' text-zinc-400' : ' text-zinc-500'}`}>90D</span>
                </div>
              </div>

              {/* Chart canvas */}
              <div className="relative">
                <svg viewBox="0 0 1200 360" preserveAspectRatio="none" className="w-full h-[240px] sm:h-[320px]" aria-hidden="true">
                  <defs>
                    <linearGradient id="lpAnalyticsArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#f43f5e" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="lpAnalyticsLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#f43f5e" />
                      <stop offset="100%" stopColor="#fb7185" />
                    </linearGradient>
                  </defs>

                  {/* Gridlines */}
                  <g className="lp-chart-grid" stroke={isDarkMode ? '#3f3f46' : '#e7e5e4'} strokeWidth="1" strokeDasharray="2 4">
                    <line x1="60" y1="80"  x2="1180" y2="80"  />
                    <line x1="60" y1="140" x2="1180" y2="140" />
                    <line x1="60" y1="200" x2="1180" y2="200" />
                    <line x1="60" y1="260" x2="1180" y2="260" />
                  </g>
                  {/* Y-axis labels */}
                  <g className="lp-chart-grid" fill={isDarkMode ? '#71717a' : '#a8a29e'} fontFamily="'JetBrains Mono', monospace" fontSize="10">
                    <text x="48" y="84"  textAnchor="end">100</text>
                    <text x="48" y="144" textAnchor="end">75</text>
                    <text x="48" y="204" textAnchor="end">50</text>
                    <text x="48" y="264" textAnchor="end">25</text>
                  </g>
                  {/* X-axis labels */}
                  <g className="lp-chart-grid" fill={isDarkMode ? '#71717a' : '#a8a29e'} fontFamily="'JetBrains Mono', monospace" fontSize="10">
                    <text x="60"   y="340" textAnchor="middle">May 1</text>
                    <text x="480"  y="340" textAnchor="middle">May 10</text>
                    <text x="900"  y="340" textAnchor="middle">Today</text>
                    <text x="1180" y="340" textAnchor="middle">+5d</text>
                  </g>

                  {/* Area under historical curve */}
                  <path
                    className="lp-chart-area"
                    d="M 60 192.4 L 200 156 L 340 170 L 480 136.4 L 620 147.6 L 760 108.4 L 900 86 L 900 310 L 60 310 Z"
                    fill="url(#lpAnalyticsArea)"
                  />

                  {/* Historical line (solid, rose gradient) */}
                  <path
                    className="lp-chart-line"
                    d="M 60 192.4 L 200 156 L 340 170 L 480 136.4 L 620 147.6 L 760 108.4 L 900 86"
                    fill="none"
                    stroke="url(#lpAnalyticsLine)"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {/* Predicted line (dashed, amber) */}
                  <path
                    className="lp-chart-line"
                    d="M 900 86 L 1040 91.6 L 1180 72"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray="6 5"
                    opacity="0.85"
                  />

                  {/* "Now" vertical marker */}
                  <g className="lp-chart-now">
                    <line x1="900" y1="30" x2="900" y2="310" stroke={isDarkMode ? '#52525b' : '#d6d3d1'} strokeWidth="1" strokeDasharray="3 4" />
                    <text x="900" y="22" textAnchor="middle" fill={isDarkMode ? '#a1a1aa' : '#78716c'} fontFamily="'JetBrains Mono', monospace" fontSize="9" letterSpacing="2">NOW</text>
                  </g>

                  {/* Highlighted "today" data point */}
                  <g className="lp-chart-tooltip">
                    <circle cx="900" cy="86" r="11" fill="#f43f5e" opacity="0.15" />
                    <circle cx="900" cy="86" r="5"  fill="#f43f5e" />
                  </g>
                </svg>

                {/* Floating tooltip (HTML overlay, desktop only) */}
                <div className="lp-chart-tooltip pointer-events-none absolute hidden sm:block" style={{ left: '74%', top: '12%' }}>
                  <div className={`px-3 py-2 rounded-lg text-xs${isDarkMode ? ' bg-zinc-950/95 border border-zinc-800 text-zinc-200' : ' bg-white border border-stone-200 text-zinc-700'}`} style={{ boxShadow: isDarkMode ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.08)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span className={`text-[9px] uppercase tracking-widest font-semibold${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>Today</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold tabular-nums text-sm">87</span>
                      <span className={`text-[10px] font-medium${isDarkMode ? ' text-emerald-400' : ' text-emerald-600'}`}>↑ 5</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
                <div className={`flex items-center gap-2${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                  <span className="inline-block w-6 h-px bg-rose-500" />
                  <span className="uppercase tracking-widest">Historical</span>
                </div>
                <div className={`flex items-center gap-2${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                  <span className="inline-flex items-center gap-0.5">
                    <span className="inline-block h-px w-1.5 bg-amber-500" />
                    <span className="inline-block h-px w-1.5 bg-amber-500" />
                    <span className="inline-block h-px w-1.5 bg-amber-500" />
                  </span>
                  <span className="uppercase tracking-widest">Predicted</span>
                </div>
                <div className={`flex items-center gap-2 ml-auto${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>
                  <span className="uppercase tracking-widest">8 views available</span>
                  <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
                </div>
              </div>
            </div>

            </div>
            {/* /Asymmetric hero row */}

            {/* Velocity strip — one sparkline + one sentence replaces the four-card KPI grid */}
            <div
              data-reveal
              className="lp-velocity mt-20 sm:mt-24"
            >
              <div className={`h-px w-full mb-8${isDarkMode ? ' bg-zinc-800/70' : ' bg-stone-200'}`} aria-hidden="true" />
              <div className="flex items-baseline justify-between gap-6 flex-wrap mb-5">
                <span
                  className={`text-[11px] uppercase font-semibold${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}
                  style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.2em' }}
                >
                  Velocity · 30D
                </span>
                <div className="flex items-baseline gap-3">
                  <span className={`text-4xl sm:text-5xl font-bold tabular-nums${isDarkMode ? ' text-emerald-400' : ' text-emerald-600'}`}>+14%</span>
                  <span className={`text-xs uppercase tracking-widest${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>vs prior 30d</span>
                </div>
              </div>
              <svg viewBox="0 0 800 60" preserveAspectRatio="none" className="w-full h-14 sm:h-20 mb-6" aria-hidden="true">
                <defs>
                  <linearGradient id="lpVelocityLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#fb7185" />
                  </linearGradient>
                </defs>
                <path
                  className="lp-velocity-line"
                  d="M 0 50 L 60 48 L 120 44 L 180 40 L 240 38 L 300 34 L 360 30 L 420 26 L 480 22 L 540 18 L 600 14 L 660 12 L 720 8 L 800 4"
                  fill="none"
                  stroke="url(#lpVelocityLine)"
                  strokeWidth="2.25"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
              <p className={`text-base sm:text-lg leading-relaxed max-w-2xl${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                Throughput is the leading indicator. When Pulse takes a layer of triage off your stack, this is what moves first.
              </p>
              <div className={`h-px w-full mt-10${isDarkMode ? ' bg-zinc-800/70' : ' bg-stone-200'}`} aria-hidden="true" />
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* Section C — Decisions and Execution */}
        <section id="section-decisions" className={`py-24 px-6 relative${isDarkMode ? '' : ' bg-stone-50'}`}>
          {/* Decision hub themed bg — rose radial glow + pure dark, from DecisionTaskHub.css */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-700"
            style={{ opacity: Math.min(sectionVis['section-decisions'] ?? 0, 1) * (isDarkMode ? 1 : 0.55) }}
          >
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 50% 40%, rgba(244,63,94,0.13) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(236,72,153,0.08) 0%, transparent 45%), radial-gradient(ellipse at 80% 70%, rgba(244,63,94,0.06) 0%, transparent 40%)',
            }}></div>
            {/* Rose pulse ring — central glow radiating from center like the decision health score */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-rose-500/8" style={{ boxShadow: '0 0 120px rgba(244,63,94,0.06) inset' }}></div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-rose-500/6"></div>
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-12 animate-fade-in max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-400 text-xs font-bold uppercase tracking-widest mb-5">
                <Gavel /> Decisions and Tasks
              </div>
              <h2 className={`text-4xl sm:text-6xl font-bold mb-4 tracking-tight${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`}>
                From signal to action.
              </h2>
              <p className={`text-lg leading-relaxed${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                Discussions become decisions, decisions become tasks, tasks track themselves back to the meeting they came from. Health score watches the load.
              </p>
            </div>

            {/* Kanban mock — 4 columns, sample decision cards */}
            <div
              data-reveal
              className={`lp-kanban rounded-2xl border overflow-hidden lp-card-hover${isDarkMode ? ' bg-zinc-950 border-zinc-800' : ' bg-white border-stone-200 shadow-sm'}`}
            >
              {/* Top bar with team health */}
              <div className={`flex items-center justify-between px-5 py-3 border-b gap-3 flex-wrap${isDarkMode ? ' border-zinc-800/80 bg-zinc-950' : ' border-stone-200 bg-stone-50/60'}`}>
                <div className={`text-[10px] uppercase tracking-widest font-semibold${isDarkMode ? ' text-teal-400' : ' text-teal-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                  Q2 · 7 active decisions
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Team Health indicator (compact) */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] uppercase tracking-widest${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>Team Health</span>
                    <span className={`text-[13px] font-bold tabular-nums${isDarkMode ? ' text-emerald-400' : ' text-emerald-600'}`}>87</span>
                    <span className={`w-16 h-1 rounded-full overflow-hidden${isDarkMode ? ' bg-zinc-800' : ' bg-stone-200'}`}>
                      <span className="block h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: '87%' }} />
                    </span>
                  </div>
                  <span className={`hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                    <i className="fa-solid fa-file-audio text-[10px]" aria-hidden="true" /> 4 meetings mined
                  </span>
                </div>
              </div>

              {/* Columns */}
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0" style={{
                borderColor: isDarkMode ? 'rgba(63,63,70,0.5)' : 'rgba(231,229,228,0.8)',
              }}>
                {[
                  {
                    label: 'Proposed',
                    color: '#8b5cf6',
                    bg:    isDarkMode ? 'rgba(139,92,246,0.04)' : 'rgba(139,92,246,0.03)',
                    cards: [
                      { title: 'Move standup to async-only',          priority: 65, source: 'mtg',   meta: 'From Mon strategy',   avatar: '#3b82f6' },
                      { title: 'Sunset legacy auth middleware',        priority: 71, source: 'task',  meta: 'Legal-flagged',       avatar: '#a855f7' },
                      { title: 'Approve $18k tooling budget',          priority: 84, source: 'email', meta: 'Anya · due Mon',      avatar: '#f43f5e' },
                    ],
                  },
                  {
                    label: 'Voting',
                    color: '#f59e0b',
                    bg:    isDarkMode ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.04)',
                    cards: [
                      { title: 'Switch Mixpanel → PostHog',            priority: 92, source: 'mtg',   meta: '3 / 4 voted',          avatar: '#10b981', voting: true },
                      { title: 'Hire Senior IC vs Manager',            priority: 78, source: 'task',  meta: '2 / 4 voted',          avatar: '#f43f5e', voting: true },
                    ],
                  },
                  {
                    label: 'Decided',
                    color: '#10b981',
                    bg:    isDarkMode ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.04)',
                    cards: [
                      { title: 'EMEA hiring pause through Q2',         priority: 87, source: 'mtg',   meta: 'Logged · audit trail', avatar: '#f43f5e', decided: true },
                    ],
                  },
                  {
                    label: 'Done',
                    color: '#22c55e',
                    bg:    isDarkMode ? 'rgba(34,197,94,0.04)' : 'rgba(34,197,94,0.03)',
                    cards: [
                      { title: 'Q1 OKR retrospective',                 priority: null, source: 'mtg', meta: 'Archived',             avatar: '#3b82f6', done: true },
                    ],
                    archived: 12,
                  },
                ].map((col, ci) => (
                  <div key={col.label} className="p-4" style={{ backgroundColor: col.bg }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: col.color }} aria-hidden="true" />
                        <span
                          className={`text-[10px] uppercase font-semibold${isDarkMode ? ' text-zinc-300' : ' text-zinc-700'}`}
                          style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.15em' }}
                        >
                          {col.label}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded${isDarkMode ? ' bg-zinc-800 text-zinc-400' : ' bg-stone-200 text-zinc-600'}`}
                        style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
                      >
                        {col.cards.length}{col.archived ? ` · +${col.archived}` : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {col.cards.map((c: any, i) => (
                        <div
                          key={i}
                          className={`rounded-lg border p-3 text-[12px] leading-snug transition-colors${
                            isDarkMode ? ' bg-zinc-900/70 border-zinc-800 hover:border-zinc-700' : ' bg-white border-stone-200 hover:border-stone-300'
                          }${c.done ? (isDarkMode ? ' opacity-60' : ' opacity-70') : ''}`}
                        >
                          <div className={`font-semibold mb-2${isDarkMode ? ' text-zinc-100' : ' text-zinc-900'}${c.done ? ' line-through' : ''}`}>{c.title}</div>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {c.priority != null && (
                                <span
                                  className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded${
                                    c.priority >= 85 ? (isDarkMode ? ' bg-rose-500/15 text-rose-400'   : ' bg-rose-100 text-rose-700')   :
                                    c.priority >= 70 ? (isDarkMode ? ' bg-amber-500/15 text-amber-400' : ' bg-amber-100 text-amber-700') :
                                                       (isDarkMode ? ' bg-zinc-800 text-zinc-400'      : ' bg-stone-100 text-zinc-600')
                                  }`}
                                  style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.05em' }}
                                >
                                  P {c.priority}
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-widest${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}
                                style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
                              >
                                {c.source === 'mtg'   && <i className="fa-solid fa-microphone text-[9px]" aria-hidden="true" />}
                                {c.source === 'email' && <i className="fa-solid fa-envelope text-[9px]" aria-hidden="true" />}
                                {c.source === 'task'  && <i className="fa-solid fa-list-check text-[9px]" aria-hidden="true" />}
                              </span>
                            </div>
                            <span className={`inline-block w-4 h-4 rounded-full shrink-0`} style={{ background: c.avatar }} aria-hidden="true" />
                          </div>
                          <div className={`mt-1.5 text-[10px] uppercase tracking-widest truncate${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                            {c.voting && <span className={isDarkMode ? 'text-amber-400 mr-1' : 'text-amber-600 mr-1'}>●</span>}
                            {c.decided && <span className={isDarkMode ? 'text-emerald-400 mr-1' : 'text-emerald-600 mr-1'}>✓</span>}
                            {c.meta}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* Section D — Relationship Intelligence */}
        <section id="section-crm" className={`py-24 px-6 border-y relative overflow-hidden${isDarkMode ? ' bg-zinc-950/60 border-zinc-800/40' : ' bg-stone-50 border-stone-200/60'}`}>
          {/* Indigo space background */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-700"
            style={{ opacity: Math.min(sectionVis['section-crm'] ?? 0, 1) * (isDarkMode ? 1 : 0.55) }}
          >
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 20% 30%, rgba(244,63,94,0.13) 0%, transparent 52%), radial-gradient(ellipse at 80% 70%, rgba(236,72,153,0.09) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(244,63,94,0.05) 0%, transparent 70%)',
            }} />
            {/* Grid dot overlay — always visible */}
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.22) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }} />
          </div>

          <div className="max-w-7xl mx-auto relative z-10">

            {/* ── Header (centered) ── */}
            <div className="text-center mb-14 animate-fade-in">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4${isDarkMode ? ' bg-indigo-500/10 border border-indigo-500/25 text-indigo-400' : ' bg-indigo-50 border border-indigo-200 text-indigo-600'}`}>
                <Network size={12} /> Relationships and CRM
              </div>
              <h2 className={`text-5xl sm:text-8xl font-bold mb-5${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`}>
                Know your network.
              </h2>
              <p className={`text-lg max-w-2xl mx-auto leading-relaxed${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
                Deep relationship intelligence with 0–100 health scoring, contact circles, and network analytics. Know which relationships need you before they go cold.
              </p>
            </div>

            {/* ── Contact Mesh Canvas — no card, floats over section bg ── */}
            <div className="relative mb-12" style={{ height: '380px' }}>
              <canvas
                ref={crmCanvasRef}
                className="absolute inset-0 w-full h-full"
              />
              {/* Edge fades so nodes dissolve into section background */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: isDarkMode
                  ? 'linear-gradient(to bottom, rgba(3,3,15,0.55) 0%, transparent 18%, transparent 82%, rgba(3,3,15,0.55) 100%), linear-gradient(to right, rgba(3,3,15,0.5) 0%, transparent 14%, transparent 86%, rgba(3,3,15,0.5) 100%)'
                  : 'linear-gradient(to bottom, rgba(249,249,252,0.55) 0%, transparent 18%, transparent 82%, rgba(249,249,252,0.55) 100%), linear-gradient(to right, rgba(249,249,252,0.5) 0%, transparent 14%, transparent 86%, rgba(249,249,252,0.5) 100%)',
              }} />
              {/* Legend */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-4 pointer-events-none">
                {[
                  { color: '#34d399', label: 'Healthy' },
                  { color: '#fbbf24', label: 'Cooling' },
                  { color: '#f87171', label: 'At Risk' },
                ].map(l => (
                  <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: l.color }}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Feature cards — 3 col ── */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {[
                {
                  color: '#818cf8', bgColor: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)',
                  hoverBorder: 'rgba(99,102,241,0.45)',
                  title: 'Relationship Health Score',
                  desc: '0–100 score computed from interaction frequency, sentiment, and response time. Get alerts before relationships go cold.',
                  icon: (
                    <svg viewBox="0 0 20 20" width={16} height={16} fill="#818cf8" aria-hidden="true">
                      <path d="M10 17S3 12 3 7a3.5 3.5 0 017-1.3A3.5 3.5 0 0117 7c0 5-7 10-7 10z" className="lp-throb-sm" />
                    </svg>
                  ),
                },
                {
                  color: '#c084fc', bgColor: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.2)',
                  hoverBorder: 'rgba(168,85,247,0.45)',
                  title: 'Contact Circles',
                  desc: 'Bubble-chart visualization showing your network by proximity, value, and engagement depth.',
                  icon: (
                    <svg viewBox="0 0 20 20" width={16} height={16} fill="#c084fc" aria-hidden="true">
                      <circle cx="10" cy="10" r="3" />
                      <circle cx="10" cy="10" r="7" fill="none" stroke="#c084fc" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.4} />
                      <g className="lp-orbit-g"><circle cx="10" cy="3" r="1.5" /></g>
                    </svg>
                  ),
                },
                {
                  color: '#22d3ee', bgColor: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.2)',
                  hoverBorder: 'rgba(6,182,212,0.45)',
                  title: 'Network Analytics',
                  desc: 'Communication pattern analysis, interaction heatmaps, and predictive engagement recommendations.',
                  icon: (
                    <svg viewBox="0 0 20 20" width={16} height={16} fill="#22d3ee" aria-hidden="true">
                      <rect x="1.5"  y="14" width="3" height="4"  rx="1" className="lp-bar-a" />
                      <rect x="6.5"  y="10" width="3" height="8"  rx="1" className="lp-bar-b" />
                      <rect x="11.5" y="6"  width="3" height="12" rx="1" className="lp-bar-c" />
                      <rect x="16.5" y="8"  width="2" height="10" rx="1" className="lp-bar-d" />
                    </svg>
                  ),
                },
              ].map(card => (
                <div
                  key={card.title}
                  className="group flex gap-4 p-5 rounded-2xl transition-all duration-300 cursor-default"
                  style={{
                    background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.75)',
                    backdropFilter: 'blur(16px)',
                    border: `1px solid ${isDarkMode ? card.borderColor : card.borderColor.replace(/0\.\d+\)/, '0.4)')}`,
                    boxShadow: isDarkMode ? '0 4px 24px rgba(0,0,0,0.25)' : '0 4px 20px rgba(0,0,0,0.05)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = card.hoverBorder; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = isDarkMode ? card.borderColor : card.borderColor.replace(/0\.\d+\)/, '0.4)'); }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
                    style={{ background: card.bgColor, border: `1px solid ${card.borderColor}` }}>
                    {card.icon}
                  </div>
                  <div>
                    <h3 className={`font-bold mb-1.5 text-sm${isDarkMode ? ' text-white' : ' text-zinc-900'}`}>{card.title}</h3>
                    <p className={`text-xs leading-relaxed${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Logos Vision sync panel — hidden via SHOW_LOGOS_SYNC until bidirectional sync is built (docs/LOGOS_VISION_SYNC_HANDOFF_2026-06-13.md) ── */}
            {SHOW_LOGOS_SYNC && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(20px)',
                border: isDarkMode ? '1px solid rgba(99,102,241,0.15)' : '1px solid rgba(99,102,241,0.2)',
                boxShadow: isDarkMode ? '0 4px 40px rgba(99,102,241,0.08)' : '0 4px 24px rgba(99,102,241,0.06)',
              }}
            >
              {/* Panel header */}
              <div className={`flex items-center gap-3 px-6 py-4${isDarkMode ? ' border-b border-white/5' : ' border-b border-indigo-100/60'}`}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
                  <Eye className="text-white" size={15} />
                </div>
                <div>
                  <h3 className={`text-sm font-bold${isDarkMode ? ' text-white' : ' text-zinc-900'}`}>Logos Vision</h3>
                  <span className="text-xs text-indigo-400">Bidirectional sync · live</span>
                </div>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Connected
                </span>
              </div>

              {/* 2×2 sync items */}
              <div className="grid sm:grid-cols-2 gap-px p-px" style={{ background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.06)' }}>
                {[
                  {
                    color: '#818cf8', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.12)',
                    label: 'Conversation → Case Log',
                    desc: 'Send a Relay message in Pulse, a case log entry is automatically created in Logos Vision.',
                    icon: (
                      <svg viewBox="0 0 20 20" width={13} height={13} fill="#818cf8" aria-hidden="true">
                        <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v5a2 2 0 01-2 2H8L5 14v-3H4a2 2 0 01-2-2V4z" />
                        <path d="M8 8a2 2 0 012-2h5a2 2 0 012 2v3a2 2 0 01-2 2h-1v2l-2-2h-2a2 2 0 01-2-2" opacity={0.5} />
                      </svg>
                    ),
                  },
                  {
                    color: '#c084fc', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.12)',
                    label: 'Activity Feed Sync',
                    desc: 'Every touchpoint (calls, messages, notes) surfaces instantly in the Logos Vision activity timeline.',
                    icon: (
                      <svg viewBox="0 0 20 20" width={13} height={13} fill="#c084fc" aria-hidden="true">
                        <path d="M11 2L4 12h6l-1 6 7-10h-6z" className="lp-flash" />
                      </svg>
                    ),
                  },
                  {
                    color: '#f472b6', bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.12)',
                    label: 'AI Field Population',
                    desc: 'Pulse pools conversation data to auto-fill contact fields, case details, and relationship context.',
                    icon: (
                      <svg viewBox="0 0 20 20" width={13} height={13} fill="none" stroke="#f472b6" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
                        <line x1="4" y1="16" x2="13" y2="7" />
                        <path d="M13 3l2 2-7 7-2-2z" fill="#f472b6" fillOpacity={0.35} strokeWidth={1} />
                        <circle cx="16" cy="4" r="1" fill="#f472b6" stroke="none" className="lp-rec-dot" />
                        <line x1="16" y1="1" x2="16" y2="2.5" /><line x1="16" y1="5.5" x2="16" y2="7" />
                        <line x1="18.5" y1="4" x2="17" y2="4" /><line x1="15" y1="4" x2="13.5" y2="4" />
                      </svg>
                    ),
                  },
                  {
                    color: '#22d3ee', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.12)',
                    label: 'Records Flow Back',
                    desc: 'Case outcomes and status updates in Logos Vision surface in your Pulse relationship feed and health score.',
                    icon: (
                      <svg viewBox="0 0 20 20" width={13} height={13} fill="none" stroke="#22d3ee" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17 10a7 7 0 11-7-7" className="lp-flash" />
                        <polyline points="13,3 17,3 17,7" />
                      </svg>
                    ),
                  },
                ].map((item, i) => (
                  <div
                    key={item.label}
                    className="group flex gap-3 p-5 transition-all duration-250 cursor-default"
                    style={{ background: isDarkMode ? 'rgba(4,4,20,0.5)' : 'rgba(255,255,255,0.9)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = isDarkMode ? item.bg : `${item.bg.replace('0.08','0.12')}`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isDarkMode ? 'rgba(4,4,20,0.5)' : 'rgba(255,255,255,0.9)'; }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold mb-1${isDarkMode ? ' text-white' : ' text-zinc-900'}`}>{item.label}</p>
                      <p className={`text-xs leading-relaxed${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>{item.desc}</p>
                      {/* Sync flow dots */}
                      <div className="flex items-center gap-1 mt-2">
                        {[0,1,2].map(d => (
                          <span key={d} className="inline-block w-1 h-1 rounded-full" style={{ background: item.color, opacity: 0, animation: `lp-sync-dot 1.8s ease-in-out ${d * 0.3}s infinite` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

          </div>
        </section>
      </div>

      {/* ── Section E — Maps & Field Operations (map-mock layout, Wave 4.1) ── */}
      <section id="section-maps" className={`py-24 px-6 relative overflow-hidden${isDarkMode ? ' bg-zinc-950/40' : ' bg-stone-50'}`}>
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDarkMode ? 1 : 0.55 }}>
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 25% 35%, rgba(244,63,94,0.08) 0%, transparent 55%), radial-gradient(ellipse at 75% 65%, rgba(236,72,153,0.05) 0%, transparent 50%)',
          }} />
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="mb-12 animate-fade-in max-w-3xl">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5${isDarkMode ? ' bg-emerald-500/10 border border-emerald-500/25 text-emerald-300' : ' bg-emerald-50 border border-emerald-200 text-emerald-600'}`}>
              <MapPin size={12} aria-hidden="true" /> Maps and Field Ops
            </div>
            <h2 className={`text-4xl sm:text-6xl font-bold mb-4 tracking-tight${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`}>
              Pulse, in the real world.
            </h2>
            <p className={`text-lg leading-relaxed${isDarkMode ? ' text-zinc-400' : ' text-zinc-600'}`}>
              Your contacts on a map. Live ETA share with a one-tap link. Geofence alerts that log every arrival. Travel buffers padded into your calendar so meetings never run late on traffic.
            </p>
          </div>

          {/* Map fragment mock */}
          <div
            data-reveal
            className={`lp-map rounded-2xl border overflow-hidden lp-card-hover${isDarkMode ? ' bg-zinc-950 border-zinc-800' : ' bg-white border-stone-200 shadow-sm'}`}
          >
            {/* Top bar */}
            <div className={`flex items-center justify-between px-5 py-3 border-b gap-3 flex-wrap${isDarkMode ? ' border-zinc-800/80 bg-zinc-950' : ' border-stone-200 bg-stone-50/60'}`}>
              <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold${isDarkMode ? ' text-emerald-400' : ' text-emerald-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                <MapPin size={11} /> 14 contacts mapped · Brooklyn
              </div>
              <div className={`hidden sm:flex items-center gap-3 text-[10px] uppercase tracking-widest${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>
                <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />Live broadcast on</span>
                <span className={isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}>·</span>
                <span>2 saved geofences</span>
                <span className={isDarkMode ? 'text-zinc-700' : 'text-zinc-300'}>·</span>
                <span className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}>Route ready · 4 stops</span>
              </div>
            </div>

            {/* Map canvas */}
            <div className={`relative w-full ${isDarkMode ? 'bg-zinc-900' : 'bg-stone-100'}`} style={{ aspectRatio: '16 / 9', minHeight: 360 }}>
              {/* Abstract map base (SVG) */}
              <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
                <defs>
                  <pattern id="lpMapGrid" width="80" height="80" patternUnits="userSpaceOnUse">
                    <path d="M 80 0 L 0 0 0 80" fill="none" stroke={isDarkMode ? '#27272a' : '#e7e5e4'} strokeWidth="0.5" />
                  </pattern>
                  <linearGradient id="lpMapRiver" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%"   stopColor={isDarkMode ? '#1e3a4a' : '#bae6fd'} stopOpacity="0.6" />
                    <stop offset="100%" stopColor={isDarkMode ? '#0c2030' : '#7dd3fc'} stopOpacity="0.45" />
                  </linearGradient>
                </defs>

                {/* Grid */}
                <rect width="1600" height="900" fill="url(#lpMapGrid)" />

                {/* Park / green space */}
                <path
                  d="M 180 120 Q 260 80 360 110 L 430 200 Q 470 280 420 360 L 280 410 Q 180 380 150 280 Z"
                  fill={isDarkMode ? '#14532d' : '#bbf7d0'}
                  fillOpacity={isDarkMode ? 0.18 : 0.55}
                />
                {/* River / water */}
                <path
                  d="M 1100 0 Q 1180 150 1140 300 Q 1080 460 1180 600 Q 1280 760 1240 900 L 1600 900 L 1600 0 Z"
                  fill="url(#lpMapRiver)"
                />

                {/* Road grid — major arteries */}
                <g stroke={isDarkMode ? '#3f3f46' : '#d6d3d1'} strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.85">
                  <line x1="0"    y1="260" x2="1100" y2="260" />
                  <line x1="0"    y1="560" x2="1240" y2="560" />
                  <line x1="0"    y1="780" x2="1600" y2="780" />
                  <line x1="400"  y1="0"   x2="400"  y2="900" />
                  <line x1="780"  y1="0"   x2="780"  y2="900" />
                </g>
                {/* Road grid — minor */}
                <g stroke={isDarkMode ? '#3f3f46' : '#d6d3d1'} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.55">
                  <line x1="0"   y1="140" x2="1100" y2="140" />
                  <line x1="0"   y1="400" x2="1100" y2="400" />
                  <line x1="0"   y1="680" x2="1240" y2="680" />
                  <line x1="180" y1="0"   x2="180"  y2="900" />
                  <line x1="600" y1="0"   x2="600"  y2="900" />
                  <line x1="980" y1="0"   x2="980"  y2="900" />
                </g>

                {/* Building blocks for texture */}
                <g fill={isDarkMode ? '#27272a' : '#e7e5e4'} opacity="0.7">
                  <rect x="200" y="290" width="60"  height="40" rx="2" />
                  <rect x="280" y="290" width="90"  height="40" rx="2" />
                  <rect x="410" y="280" width="120" height="60" rx="2" />
                  <rect x="560" y="290" width="60"  height="50" rx="2" />
                  <rect x="200" y="430" width="90"  height="50" rx="2" />
                  <rect x="320" y="430" width="60"  height="50" rx="2" />
                  <rect x="200" y="600" width="120" height="40" rx="2" />
                  <rect x="660" y="600" width="80"  height="60" rx="2" />
                  <rect x="820" y="280" width="90"  height="50" rx="2" />
                  <rect x="820" y="600" width="120" height="50" rx="2" />
                </g>

                {/* Route line — dashed, animated draw */}
                <path
                  className="lp-map-route"
                  d="M 240 200 Q 380 250 470 350 Q 560 460 700 470 Q 820 480 940 600"
                  stroke="#f43f5e"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="10 6"
                  fill="none"
                  opacity="0.95"
                />

                {/* Geofence radius — dashed circle around pin #3 */}
                <circle cx="940" cy="600" r="86" fill="rgba(16,185,129,0.10)" stroke="#10b981" strokeWidth="1.5" strokeDasharray="6 5" />
                <circle cx="940" cy="600" r="42" fill="rgba(16,185,129,0.18)" stroke="#10b981" strokeWidth="1" strokeOpacity="0.45" strokeDasharray="3 4" />
                <text x="940" y="514" textAnchor="middle" fontSize="13" fill={isDarkMode ? '#34d399' : '#059669'} fontFamily="'JetBrains Mono', monospace" letterSpacing="2">2× APPROACH</text>

                {/* Pins */}
                {/* Pin 1 — start */}
                <g>
                  <circle cx="240" cy="200" r="14" fill="#f43f5e" />
                  <circle cx="240" cy="200" r="22" fill="#f43f5e" opacity="0.18" />
                  <text x="240" y="205" textAnchor="middle" fontSize="13" fill="#fff" fontWeight="700" fontFamily="Inter">1</text>
                </g>
                {/* Pin 2 — mid */}
                <g>
                  <circle cx="470" cy="350" r="14" fill="#f43f5e" />
                  <text x="470" y="355" textAnchor="middle" fontSize="13" fill="#fff" fontWeight="700" fontFamily="Inter">2</text>
                </g>
                {/* Cluster pin */}
                <g>
                  <circle cx="700" cy="470" r="20" fill="#f43f5e" />
                  <circle cx="700" cy="470" r="32" fill="#f43f5e" opacity="0.14" />
                  <text x="700" y="476" textAnchor="middle" fontSize="14" fill="#fff" fontWeight="700" fontFamily="Inter">+3</text>
                </g>
                {/* Pin 3 — geofenced */}
                <g>
                  <circle cx="940" cy="600" r="14" fill="#10b981" />
                  <text x="940" y="605" textAnchor="middle" fontSize="13" fill="#fff" fontWeight="700" fontFamily="Inter">3</text>
                </g>
                {/* Pin 4 — last stop */}
                <g>
                  <circle cx="1180" cy="780" r="14" fill="#f43f5e" />
                  <text x="1180" y="785" textAnchor="middle" fontSize="13" fill="#fff" fontWeight="700" fontFamily="Inter">4</text>
                </g>

                {/* Far-off contact pins (zinc) */}
                <g fill={isDarkMode ? '#71717a' : '#a8a29e'}>
                  <circle cx="320" cy="700" r="6" />
                  <circle cx="560" cy="160" r="6" />
                  <circle cx="860" cy="200" r="6" />
                  <circle cx="1380" cy="340" r="6" />
                </g>

                {/* You-are-here (live broadcast) */}
                <g>
                  <circle cx="320" cy="240" r="22" fill="#fb7185" opacity="0.18" className="lp-map-pulse-a" />
                  <circle cx="320" cy="240" r="14" fill="#fb7185" opacity="0.30" className="lp-map-pulse-b" />
                  <circle cx="320" cy="240" r="8"  fill="#f43f5e" stroke="#fff" strokeWidth="2.5" />
                </g>
              </svg>

              {/* Floating UI overlays */}

              {/* ETA Share modal — top right */}
              <div className={`absolute top-4 right-4 sm:top-6 sm:right-6 rounded-xl border p-3 sm:p-3.5 text-[12px] w-[230px] sm:w-[260px] shadow-lg backdrop-blur-md${isDarkMode ? ' bg-zinc-950/85 border-zinc-800 text-zinc-200' : ' bg-white/90 border-stone-200 text-zinc-800'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-flex items-center gap-1.5 text-[9px] uppercase font-semibold${isDarkMode ? ' text-rose-400' : ' text-rose-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.12em' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> Live ETA · share
                  </span>
                  <span className={`text-[9px] uppercase tracking-widest${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>No app</span>
                </div>
                <div className="mb-2">
                  <div className={`font-semibold${isDarkMode ? ' text-zinc-100' : ' text-zinc-900'}`}>To Anya Patel</div>
                  <div className={`text-[11px]${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>pulse.link/eta/9k4t · auto-expires 30 min</div>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>Arrives</div>
                    <div className={`text-lg font-bold tabular-nums${isDarkMode ? ' text-zinc-50' : ' text-zinc-900'}`}>4:42 PM</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[10px] uppercase tracking-widest${isDarkMode ? ' text-emerald-400' : ' text-emerald-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>12 min</div>
                    <div className={`text-[10px]${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>3.4 mi</div>
                  </div>
                </div>
              </div>

              {/* Travel buffer banner — bottom left */}
              <div className={`absolute bottom-4 left-4 sm:bottom-6 sm:left-6 rounded-xl border p-2.5 sm:p-3 text-[12px] w-[230px] sm:w-[280px] shadow-lg backdrop-blur-md${isDarkMode ? ' bg-zinc-950/85 border-zinc-800 text-zinc-200' : ' bg-white/90 border-stone-200 text-zinc-800'}`}>
                <div className={`inline-flex items-center gap-1.5 text-[9px] uppercase font-semibold mb-1.5${isDarkMode ? ' text-emerald-400' : ' text-emerald-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.12em' }}>
                  <Wand2 size={10} /> Pulse AI · Travel buffer
                </div>
                <div className={`text-[12px] leading-snug${isDarkMode ? ' text-zinc-200' : ' text-zinc-800'}`}>
                  Padded <span className={isDarkMode ? 'text-emerald-400 font-semibold' : 'text-emerald-600 font-semibold'}>18 min</span> before your <span className="font-medium">5:00 PM Customer Call</span>.
                </div>
              </div>

              {/* Geofence event toast — bottom right */}
              <div className={`absolute bottom-4 right-4 sm:bottom-6 sm:right-6 rounded-xl border p-2.5 sm:p-3 text-[12px] w-[210px] sm:w-[240px] shadow-lg backdrop-blur-md${isDarkMode ? ' bg-zinc-950/85 border-zinc-800 text-zinc-200' : ' bg-white/90 border-stone-200 text-zinc-800'}`}>
                <div className={`inline-flex items-center gap-1.5 text-[9px] uppercase font-semibold mb-1.5${isDarkMode ? ' text-emerald-400' : ' text-emerald-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.12em' }}>
                  <MapPin size={10} /> Geofence · approach
                </div>
                <div className={`text-[12px] leading-snug${isDarkMode ? ' text-zinc-200' : ' text-zinc-800'}`}>
                  Stop 3 in 2× radius. Auto-log <span className={isDarkMode ? 'text-emerald-400 font-semibold' : 'text-emerald-600 font-semibold'}>queued</span>.
                </div>
              </div>
            </div>

            {/* Footer feature chips */}
            <div className={`flex items-center justify-center flex-wrap gap-x-5 gap-y-2 px-5 py-3 border-t text-[10px] uppercase font-semibold${isDarkMode ? ' border-zinc-800/80 bg-zinc-950 text-zinc-500' : ' border-stone-200 bg-stone-50/60 text-zinc-500'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.2em' }}>
              <span>Contact map</span>
              <span>ETA share</span>
              <span>Geofence alerts</span>
              <span>Travel buffers</span>
              <span>Live broadcast</span>
              <span>Multi-stop routes</span>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ── Section F — Workspaces (compact band, no card grid) ── */}
      <section id="section-workspaces" className={`py-16 px-6 relative${isDarkMode ? '' : ' bg-stone-50'}`}>
        <div className="max-w-5xl mx-auto">
          <div className={`flex flex-col md:flex-row gap-8 md:gap-12 items-start md:items-center p-8 md:p-10 rounded-2xl border${isDarkMode ? ' bg-zinc-900/60 border-zinc-800' : ' bg-white border-stone-200 shadow-sm'}`}>
            <div className="flex-shrink-0 flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center${isDarkMode ? ' bg-rose-500/15 border border-rose-500/25' : ' bg-rose-50 border border-rose-200'}`}>
                <Users size={22} className={isDarkMode ? 'text-rose-300' : 'text-rose-600'} aria-hidden="true" />
              </div>
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.1em] mb-0.5${isDarkMode ? ' text-rose-300' : ' text-rose-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>Workspaces</p>
                <p className={`text-xs${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>Multi-tenant by design</p>
              </div>
            </div>
            <div className="flex-1">
              <p className={`text-base md:text-lg leading-relaxed${isDarkMode ? ' text-zinc-300' : ' text-zinc-700'}`}>
                Pulse is built around workspaces, not user accounts. Invite the team, assign roles, bill once per org, and keep every signal scoped to the room where it belongs. Switch workspaces without re-logging in; data stays where it should.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {['Workspace switcher', 'Role permissions', 'Bulk invites', 'Audit trail', 'Per-org billing'].map(tag => (
                  <span key={tag} className={`px-2 py-0.5 rounded text-[10px] font-medium${isDarkMode ? ' bg-zinc-800 border border-zinc-700 text-zinc-300' : ' bg-stone-100 border border-stone-200 text-zinc-600'}`} style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── B: Integration Logo Wall — hidden until integrations ship ── */}
      {/* TODO: Re-enable this section once platform integrations are live */}
      {/* <section className="py-20 px-6 bg-zinc-900/20 border-y border-zinc-800/30 relative overflow-hidden">
        ...
      </section> */}

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
                      { name: 'Sarah K.', msg: 'Vox Drop from 2 min ago', time: '2m', dot: '#f43f5e', icon: 'fa-solid fa-microphone' },
                      { name: 'Dev Team', msg: 'Sprint planning at 3 PM confirmed', time: '18m', dot: '#6366f1', icon: 'fa-brands fa-slack' },
                      { name: 'Calendar', msg: 'Team standup in 15 min', time: '15m', dot: '#6366f1', icon: 'fa-solid fa-calendar' },
                    ].map((m, i) => (
                      <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${m.dot}20`, border: `1px solid ${m.dot}40` }}>
                          <i className={`${m.icon} text-[8px]`} style={{ color: m.dot }}></i>
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
                      { icon: 'fa-solid fa-house', active: false },
                      { icon: 'fa-solid fa-message', active: false },
                      { icon: 'fa-solid fa-microphone', active: true },
                      { icon: 'fa-solid fa-calendar', active: false },
                      { icon: 'fa-solid fa-user', active: false },
                    ].map((n, i) => (
                      <div key={i} className={`flex items-center justify-center w-8 h-8 rounded-xl ${n.active ? 'bg-rose-500' : ''}`}>
                        <i className={`${n.icon} text-[11px] ${n.active ? 'text-white' : 'text-zinc-600'}`}></i>
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
                  <i className={`fa-solid fa-chevron-${shortcutsOpen ? 'up' : 'down'} text-xs`}></i>
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
                        <i className={`${group.icon} text-rose-500 text-xs`}></i>
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
      <section id="ecosystem" className="py-24 px-6 border-b border-zinc-800/50 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-3xl sm:text-5xl font-bold mb-6 text-zinc-50">The Trinity of Productivity</h2>
            <p className="text-zinc-400 text-lg max-w-3xl mx-auto">
              Three powerful systems working in perfect harmony to handle every aspect of your business operations.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Pulse Card */}
            <div className="relative group animate-fade-in animation-delay-200">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/30 to-pink-500/25 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"></div>
              <div className="relative h-full bg-zinc-950/90 backdrop-blur-sm border border-zinc-800 rounded-3xl hover:border-rose-500/60 transition-all duration-150 flex flex-col hover:-translate-y-0.5 card-elevated-rose overflow-hidden">
                <div className="flex items-center justify-center h-24 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-b border-rose-500/15 group-hover:from-rose-500/15 transition-colors duration-150">
                  <svg viewBox="0 0 64 64" width="52" height="52" fill="none">
                    <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
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
                  <svg viewBox="0 0 80 80" width="52" height="52" fill="none">
                    <circle cx="40" cy="40" r="38" fill="none" stroke="#b2f5ea" strokeWidth="1.2" opacity="0.35"/>
                    <circle cx="40" cy="40" r="30" fill="none" stroke="#6ee7d4" strokeWidth="1.6" opacity="0.55"/>
                    <circle cx="40" cy="40" r="22" fill="none" stroke="#22d3b8" strokeWidth="2"   opacity="0.75"/>
                    <circle cx="40" cy="40" r="14" fill="none" stroke="#0d9488" strokeWidth="2.5" opacity="0.90"/>
                    <circle cx="40" cy="40" r="9"  fill="rgba(0,200,255,0.25)"/>
                    <circle cx="40" cy="40" r="5"  fill="#00c8ff"/>
                  </svg>
                </div>
                <div className="p-8 flex flex-col flex-grow">
                  <h3 className="text-2xl font-bold mb-4 text-white">Logos Vision</h3>
                  <div className="text-sm font-bold text-teal-400 tracking-wider uppercase mb-4">CRM and Relationships</div>
                  <p className="text-zinc-400 mb-6 flex-grow">The memory of your organization. Deep relationship intelligence with health scoring and 4 native CRM integrations you can log interactions to in one click.</p>
                  <ul className="space-y-3 text-zinc-300 text-sm">
                    <li className="flex items-center gap-2"><Check className="text-teal-400" /> 0-100 Relationship Scoring</li>
                    <li className="flex items-center gap-2"><Check className="text-teal-400" /> 4 CRM Integrations</li>
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
                  {/* Actual Entomate logo — red hands holding phosphor (the catalyst mark) */}
                  <img
                    src="/brand/entomate-logo.png"
                    alt="Entomate"
                    className="relative z-10 w-14 h-14 object-contain"
                    style={{ filter: 'drop-shadow(0 0 12px rgba(255,45,107,0.30)) drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="p-8 flex flex-col flex-grow">
                  <h3 className="text-2xl font-bold mb-2 text-white">Entomate</h3>
                  <div
                    className="text-[11px] font-semibold uppercase mb-4"
                    style={{ color: '#FFB800', fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.18em' }}
                  >
                    Meeting Intelligence and Workflows
                  </div>
                  <p className="text-zinc-400 mb-6 flex-grow leading-relaxed">
                    The intelligence layer of your organization. A bot joins your meetings, transcribes, and extracts decisions and actions. Daily briefings flag blockers before standup. Visual workflows execute the follow-through across your stack.
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

      {/* ── Use-Case Scenarios ── */}
      <section id="scenarios" className="py-24 px-6 bg-gradient-to-b from-zinc-900/20 to-zinc-950 border-b border-zinc-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-3xl sm:text-5xl font-bold mb-6 text-zinc-50">See it in action.</h2>
            <p className="text-zinc-400 text-lg mb-8">Real-world workflows powered by the Pulse ecosystem.</p>

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
            <div className="relative">
              <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-rose-500/50 to-transparent -translate-y-1/2 z-0"></div>
              <div className="grid lg:grid-cols-3 gap-6 relative z-10">
                {[
                  { num: '1', system: 'RELAY DIRECT', badgeClass: 'from-rose-500 to-pink-500', labelClass: 'text-rose-400', borderClass: 'hover:border-rose-500/40', title: 'Drop and Go', body: "You're driving. One tap and you're recording a Relay Direct, scheduled to deliver when your recipient is most active." },
                  { num: '2', system: 'AI TRANSCRIPTION', badgeClass: 'from-cyan-500 to-cyan-600', labelClass: 'text-cyan-400', borderClass: 'hover:border-cyan-500/40', title: 'Instant Intelligence', body: 'On delivery, Pulse transcribes the message, generates a summary, extracts action items, and scores sentiment, all before the recipient presses play.' },
                  { num: '3', system: 'SMART REPLY', badgeClass: 'from-emerald-500 to-emerald-600', labelClass: 'text-emerald-400', borderClass: 'hover:border-emerald-500/40', title: 'One-tap response', body: 'The recipient sees the transcript and summary, picks a smart reply suggestion, and responds with their own 10-second voice note. Full async conversation, zero context lost.' },
                ].map((step) => (
                  <div key={step.num} className={`bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 p-8 rounded-2xl relative hover:-translate-y-0.5 transition-all duration-300 card-elevated ${step.borderClass} group animate-fade-in`}>
                    <div className={`absolute -top-4 -right-4 w-8 h-8 bg-gradient-to-br ${step.badgeClass} rounded-full flex items-center justify-center text-white font-bold shadow-lg text-sm`}>{step.num}</div>
                    <div className={`font-bold mb-2 text-xs tracking-wider ${step.labelClass}`}>{step.system}</div>
                    <h4 className="text-xl font-bold text-white mb-3">{step.title}</h4>
                    <p className="text-zinc-400 text-sm leading-relaxed">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Download Section ── */}
      <section id="download" className="py-24 px-6 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-bold mb-8 animate-fade-in text-zinc-50">Available everywhere.</h2>
          <p className="text-zinc-400 text-lg mb-12 animate-fade-in animation-delay-200">
            Seamlessly sync your team across all devices. Download the app for your preferred platform.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <DownloadButton icon="fa-brands fa-windows" platform="Windows PC" subtext="Desktop Installer · x64" active={true} href="https://github.com/FatherSonOne/Pulse-1/releases/download/v25.1.3/Pulse.Setup.25.1.3.exe" />
            <DownloadButton icon="fa-brands fa-apple" platform="macOS / iOS" subtext="Universal" active={false} />

            {/* Android Card */}
            <div className="group p-6 rounded-2xl border bg-zinc-800 border-zinc-700 hover:border-rose-500/50 transition duration-300 flex flex-col items-center justify-center gap-4 w-full">
              <Smartphone className="text-4xl text-zinc-300 group-hover:text-white transition" />
              <div className="text-center">
                <div className="font-bold text-white group-hover:text-rose-400 transition">Android</div>
                <div className="text-xs text-zinc-500">Early access and APK</div>
              </div>
              <div className="flex gap-2 w-full mt-2">
                <a
                  href="https://play.google.com/apps/internaltest/4701381285127016770"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3 py-2 bg-zinc-900 rounded-lg border border-zinc-600 hover:bg-zinc-700 hover:border-green-500/50 text-xs font-medium text-center text-zinc-300 hover:text-white transition flex items-center justify-center gap-2"
                  title="Download from Play Store"
                >
                  <Play /> Store
                </a>
                <a
                  href="/downloads/pulse-android.apk"
                  download
                  onClick={() => { const el = document.getElementById('android-instructions'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
                  className="flex-1 px-3 py-2 bg-zinc-900 rounded-lg border border-zinc-600 hover:bg-zinc-700 hover:border-rose-500/50 text-xs font-medium text-center text-zinc-300 hover:text-white transition flex items-center justify-center gap-2"
                  title="Download APK Package"
                >
                  <Download /> APK
                </a>
              </div>
            </div>
          </div>

          {/* Android Instructions */}
          <div id="android-instructions" className="mt-16 max-w-2xl mx-auto bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-left">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
              <Smartphone className="text-rose-500" />
              How to Install on Android
            </h3>
            <div className="mb-8 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
              <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                <Play className="text-green-500" /> Play Store (Early Access)
              </h4>
              <p className="text-sm text-zinc-400 mb-3">Pulse is in closed testing on Google Play. Opt into the test program first, then updates arrive in-place. Not a public listing yet.</p>
              <a href="https://play.google.com/apps/internaltest/4701381285127016770" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300 font-medium">
                Join the test program <ExternalLink className="text-xs" />
              </a>
            </div>
            <h4 className="font-bold text-white mb-4">Manual APK Installation</h4>
            <ol className="space-y-4 text-zinc-400 relative border-l border-zinc-800 ml-3 pl-8">
              <li className="relative">
                <span className="absolute -left-[41px] w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white">1</span>
                <strong className="text-white block mb-1">Download the APK</strong>
                Click the "APK" button above to download the{' '}
                <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-rose-400 text-xs">pulse-android.apk</code> file.
              </li>
              <li className="relative">
                <span className="absolute -left-[41px] w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white">2</span>
                <strong className="text-white block mb-1">Allow Installation</strong>
                Open the file. You may see a security warning. Go to Settings and allow installing apps from this source.
              </li>
              <li className="relative">
                <span className="absolute -left-[41px] w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white">3</span>
                <strong className="text-white block mb-1">Install and Launch</strong>
                Tap "Install" and wait. Once finished, open the Pulse app and log in!
              </li>
            </ol>
            <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-200">
              <Info className="mr-2" />
              This is a preview release. You may need to disable "Play Protect" if it flags the app as unrecognized.
            </div>
          </div>
          {/* Windows Instructions */}
          <div className="mt-8 max-w-2xl mx-auto bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-left">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
              <LayoutGrid className="text-blue-400" />
              How to Install on Windows PC
            </h3>
            <ol className="space-y-4 text-zinc-400 relative border-l border-zinc-800 ml-3 pl-8">
              <li className="relative">
                <span className="absolute -left-[41px] w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white">1</span>
                <strong className="text-white block mb-1">Download the installer</strong>
                Click <strong className="text-blue-400">Download for PC</strong> above, or grab it directly from{' '}
                <a href="https://github.com/FatherSonOne/Pulse-1/releases/tag/v25.1.3" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">GitHub Releases</a>.
                Choose <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-blue-400 text-xs">Pulse.Setup.25.1.3.exe</code> (installer) or <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-blue-400 text-xs">Pulse.25.1.3.exe</code> (portable, no install needed).
              </li>
              <li className="relative">
                <span className="absolute -left-[41px] w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white">2</span>
                <strong className="text-white block mb-1">Run the installer</strong>
                Double-click the downloaded file. If Windows SmartScreen appears, click <em>More info → Run anyway</em>. The app is safe. It's just unsigned during early access.
              </li>
              <li className="relative">
                <span className="absolute -left-[41px] w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white">3</span>
                <strong className="text-white block mb-1">Choose install location & finish</strong>
                Pick your preferred folder, click Install, then Launch. Pulse adds a shortcut to your Start Menu and Desktop automatically.
              </li>
              <li className="relative">
                <span className="absolute -left-[41px] w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white">4</span>
                <strong className="text-white block mb-1">Log in with your Pulse account</strong>
                Sign in with the same credentials you use on web or mobile. Everything syncs automatically.
              </li>
            </ol>
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-200">
              <Info className="mr-2" />
              Requires Windows 10 or later (64-bit). Pulse runs in the system tray. Closing the window keeps it running in the background.
            </div>
          </div>
          <p className="mt-8 text-sm text-zinc-500">* macOS and Linux builds coming soon.</p>
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
              <i className="fa-solid fa-tag" aria-hidden="true"></i> Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Pricing that starts with you.</h2>
            <p className="text-zinc-400 text-base max-w-xl mx-auto">
              Start solo. Add your team when you're ready. $15 per seat, nothing wasted.
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
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-rose-500/10 flex flex-col">
              <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-500" aria-hidden="true" />
              <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border-x border-b border-zinc-700/60 rounded-b-2xl p-8 sm:p-10 space-y-6 flex-1 flex flex-col">
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
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40 flex flex-col">
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

                <ul className="space-y-3 pt-2 flex-1">
                  {PULSE_TEAM_FEATURES.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm text-zinc-200">
                      <Check size={18} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={onGetStarted}
                  className="w-full py-3.5 rounded-xl bg-transparent border border-rose-500/40 hover:border-rose-500 hover:bg-rose-500/10 text-rose-300 hover:text-rose-200 font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
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
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40 flex flex-col">
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
                  {PULSE_GROWTH_FEATURES.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm text-zinc-200">
                      <Check size={18} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={onGetStarted}
                  className="w-full py-3.5 rounded-xl bg-transparent border border-rose-500/40 hover:border-rose-500 hover:bg-rose-500/10 text-rose-300 hover:text-rose-200 font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                >
                  <Rocket size={16} aria-hidden="true" />
                  Start with Growth
                </button>
              </div>
            </div>
          </div>

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
                  <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-300 shrink-0 ${openFaq === i ? 'rotate-180 text-rose-400' : 'text-zinc-600'}`} aria-hidden="true"></i>
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

      {/* ── Mobile preview — last content block, before footer ── */}
      <section className={`py-24 sm:py-28 px-6 relative overflow-hidden${isDarkMode ? '' : ' bg-stone-50'}`}>
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
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px]" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", letterSpacing: '0.2em' }}>
                <span className={`uppercase font-semibold${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>Android</span>
                <span className={`uppercase font-semibold${isDarkMode ? ' text-zinc-500' : ' text-zinc-500'}`}>PWA</span>
                <span className={`inline-flex items-center gap-2 uppercase font-semibold${isDarkMode ? ' text-rose-400' : ' text-rose-600'}`}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Live now
                </span>
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
                  src="/screens/pulse-mobile-memory.png"
                  alt="Pulse on iPhone: Memory tab showing recent Voice, Notes, and Live conversations"
                  className="block w-[260px] sm:w-[300px] lg:w-[340px] h-auto rounded-[44px]"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      </main>{/* /#main-content */}

      {/* ── Footer ── */}
      <footer className="bg-zinc-950 border-t border-zinc-800 pt-16 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="lp-footer-mark w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center border border-zinc-800" data-reveal>
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
                <QntmEcosIcon size={24} />
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
                  <a href="https://play.google.com/apps/internaltest/4701381285127016770" target="_blank" rel="noopener noreferrer" className="hover:text-rose-500 transition">Android App</a>
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
