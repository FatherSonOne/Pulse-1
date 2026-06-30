import React, { useEffect, useRef, useState } from 'react';
import { Mic, Wand2, MapPin, Search } from 'lucide-react';
import { type JourneyFeature } from '../landingData';

// ── Original section visuals, hosted in the gallery ─────────────────────────
// The /features redesign keeps each feature's ORIGINAL signature visual (the rich
// mocks built in LandingPage.tsx before the gallery refactor) rather than abstract
// placeholders. Each visual's JSX is reproduced verbatim from the pre-gallery
// section so it looks identical; the `lp-*` animation classes it relies on are
// already loaded globally via LandingPage.css.
//
// The journey is always dark on /features, so `isDarkMode` is fixed true here.
// Relay uses an enlarged, enhanced version of the original live-recording panel
// (waveform + mic + real-time transcription) rather than the full 960px orbital.

const isDarkMode = true;

// Live-transcription typewriter (ported from LandingPage) — drives the Relay +
// other "transcription" mocks.
function useLiveTranscript(): string {
  const phrases = [
    "I'll loop in the design team on the mockups",
    "Can we move the standup to Thursday morning?",
    "Pushing the release to next sprint, let's align",
    "Quick heads-up: client approved the proposal",
    "Flag this for review before EOD please",
  ];
  const [text, setText] = useState('');
  const [phrase, setPhrase] = useState(0);
  useEffect(() => {
    const p = phrases[phrase];
    let charIdx = 0;
    let timer: ReturnType<typeof setTimeout>;
    const typeNext = () => {
      charIdx++;
      setText(p.slice(0, charIdx));
      if (charIdx < p.length) {
        timer = setTimeout(typeNext, 42 + Math.random() * 28);
      } else {
        timer = setTimeout(() => { setText(''); setPhrase(i => (i + 1) % phrases.length); }, 2800);
      }
    };
    timer = setTimeout(typeNext, 42);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrase]);
  return text;
}


// ── Relay — 960px orbital (desktop) + stacked peers (mobile) ──
const RelayOriginalVisual: React.FC = () => {
  const liveTranscriptText = useLiveTranscript();
  const tags = [
    ['Noise Reduction', '#f43f5e'],
    ['AI Analysis', '#8b5cf6'],
    ['90+ Languages', '#22c55e'],
  ] as const;
  return (
    <div className="fj-orig fj-orig-relay">
      <div className="fj-rec">
        <div className="fj-rec-hd">
          <span className="fj-ping" />
          <span className="fj-rec-hd-label">Live Recording · Real-Time Transcription</span>
          <span className="fj-rec-time">00:34</span>
        </div>
        <div className="fj-rec-body">
          <div className="fj-rec-glow" aria-hidden="true" />
          <div className="fj-rec-wave" aria-hidden="true">
            {Array.from({ length: 44 }, (_, i) => (
              <b key={i} style={{ animationDelay: `${(i * 0.045).toFixed(3)}s` }} />
            ))}
          </div>
          <div className="fj-rec-tx">
            <div className="fj-rec-tx-label">Transcription</div>
            <p>{liveTranscriptText}<span className="fj-cursor" /></p>
          </div>
          <div className="fj-rec-controls">
            <button type="button" className="fj-rec-btn" tabIndex={-1} aria-hidden="true">
              <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor"><rect x="5" y="4" width="3" height="12" rx="1" /><rect x="12" y="4" width="3" height="12" rx="1" /></svg>
            </button>
            <button type="button" className="fj-rec-mic" tabIndex={-1} aria-hidden="true">
              <Mic className="w-7 h-7" />
            </button>
            <button type="button" className="fj-rec-btn fj-rec-ai" tabIndex={-1} aria-hidden="true">
              <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor"><path d="M11 2L4 12h6l-1 6 7-10h-6z" /></svg>
            </button>
          </div>
          <div className="fj-rec-tags">
            {tags.map(([label, color]) => (
              <span key={label} style={{ color, borderColor: `${color}55`, background: `${color}14` }}>{label} ✓</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── CRM — animated relationship-mesh canvas ──
function useCrmMesh(crmCanvasRef: React.RefObject<HTMLCanvasElement>) {
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
}

// ── Glimpse — async video player mock ──
const GlimpseOriginalVisual: React.FC = () => (
  <div className="fj-orig fj-orig-wide">
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
);

// ── Messaging — channel mock ──
const MessagingOriginalVisual: React.FC = () => (
  <div className="fj-orig fj-orig-wide">
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
);

// ── War Room — terminal mock ──
const WarRoomOriginalVisual: React.FC = () => (
  <div className="fj-orig fj-orig-wide">
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
);

// ── Decisions & Tasks — kanban mock ──
const DecisionsOriginalVisual: React.FC = () => (
  <div className="fj-orig fj-orig-wide">
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
);

// ── Analytics — hero chart card ──
const AnalyticsOriginalVisual: React.FC = () => (
  <div className="fj-orig fj-orig-wide">
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
);

// ── CRM — relationship mesh + contact cards ──
const CrmOriginalVisual: React.FC = () => {
  const crmCanvasRef = useRef<HTMLCanvasElement>(null);
  useCrmMesh(crmCanvasRef);
  return (
    <div className="fj-orig fj-orig-wide">
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
    </div>
  );
};

// ── Calendar — agenda strip ──
const CalendarOriginalVisual: React.FC = () => (
  <div className="fj-orig fj-orig-wide">
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
);

// ── Maps — field-ops map mock ──
const MapsOriginalVisual: React.FC = () => (
  <div className="fj-orig fj-orig-wide">
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
);

// Ids whose original visual is ported. FeaturePanel renders <OriginalVisual> for
// these and keeps the abstract visual for the rest (Workspaces keeps its abstract
// grid — it had no distinct visual in the original section).
export const ORIGINAL_VISUAL_IDS = new Set<string>([
  'section-relay', 'section-glimpse', 'section-messaging', 'section-warroom',
  'section-decisions', 'section-analytics', 'section-crm', 'section-calendar', 'section-maps',
]);

// Dispatcher — returns the original visual for a feature id.
const OriginalVisual: React.FC<{ feature: JourneyFeature }> = ({ feature }) => {
  switch (feature.id) {
    case 'section-relay': return <RelayOriginalVisual />;
    case 'section-glimpse': return <GlimpseOriginalVisual />;
    case 'section-messaging': return <MessagingOriginalVisual />;
    case 'section-warroom': return <WarRoomOriginalVisual />;
    case 'section-decisions': return <DecisionsOriginalVisual />;
    case 'section-analytics': return <AnalyticsOriginalVisual />;
    case 'section-crm': return <CrmOriginalVisual />;
    case 'section-calendar': return <CalendarOriginalVisual />;
    case 'section-maps': return <MapsOriginalVisual />;
    default: return null;
  }
};

export default OriginalVisual;
