import React, { useState, useEffect, lazy, Suspense } from 'react';
import './LandingPage.css';

import { Apple, ArrowDown, Battery, Bell, Book, BookOpen, Bot, Check, ChevronUp, Download, ExternalLink, Eye, Gavel, Heart, HeartPulse, HelpCircle, Info, Keyboard, Layers, LayoutGrid, Mic, Network, Play, Rocket, Search, ShieldHalf, Signal, Smartphone, Wand2, Wifi, X } from 'lucide-react';

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

const STATS = [
  { value: '8', label: 'Unified Platforms' },
  { value: '7', label: 'Voxer Modes' },
  { value: '4', label: 'AI Providers' },
  { value: '4', label: 'CRM Integrations' },
  { value: '12', label: 'War Room Modes' },
  { value: '90+', label: 'Languages' },
  { value: '167+', label: 'Services' },
];

const VOX_MODES = [
  { icon: 'fa-solid fa-wave-square', name: 'Classic Voxer', desc: 'Push-to-talk voice with waveform visualization and playback controls' },
  { icon: 'fa-solid fa-bolt', name: 'Quick Vox', desc: 'One-tap record and send — the fastest way to drop a voice note' },
  { icon: 'fa-solid fa-users', name: 'Team Vox', desc: 'Channel-based voice threads with @mentions and group transcription' },
  { icon: 'fa-solid fa-clock', name: 'Vox Drop', desc: 'Schedule voice messages to deliver at the perfect moment' },
  { icon: 'fa-solid fa-note-sticky', name: 'Vox Notes', desc: 'Personal voice journaling with AI summary and keyword extraction' },
  { icon: 'fa-solid fa-video', name: 'Video Vox', desc: 'Async video messages with face-cam and screen recording' },
  { icon: 'fa-solid fa-radio', name: 'Pulse Radio', desc: 'Live broadcast mode — stream to your entire team simultaneously' },
];

const CRM_PLATFORMS = [
  { name: 'HubSpot', color: '#f97316', icon: 'fa-brands fa-hubspot', desc: 'Bi-directional sync: tasks, deals, calls, contacts' },
  { name: 'Salesforce', color: '#00a1e0', icon: 'fa-solid fa-cloud', desc: 'SOQL queries, opportunities, activities, leads' },
  { name: 'Pipedrive', color: '#28a745', icon: 'fa-solid fa-filter', desc: 'Activities, deals, persons, organization tracking' },
  { name: 'Zoho CRM', color: '#e42527', icon: 'fa-solid fa-database', desc: 'Full CRUD: tasks, deals, contacts, calls' },
];

const PLATFORMS = [
  { name: 'Slack', icon: 'fa-brands fa-slack', color: '#E01E5A' },
  { name: 'Gmail', icon: 'fa-brands fa-google', color: '#EA4335' },
  { name: 'Discord', icon: 'fa-brands fa-discord', color: '#5865F2' },
  { name: 'Teams', icon: 'fa-brands fa-microsoft', color: '#6264A7' },
  { name: 'Figma', icon: 'fa-brands fa-figma', color: '#A259FF' },
  { name: 'Jira', icon: 'fa-brands fa-jira', color: '#0052CC' },
  { name: 'Outlook', icon: 'fa-brands fa-microsoft', color: '#0078D4' },
  { name: 'Zoom', icon: 'fa-solid fa-video', color: '#2D8CFF' },
  { name: 'HubSpot', icon: 'fa-brands fa-hubspot', color: '#f97316' },
  { name: 'Salesforce', icon: 'fa-solid fa-cloud', color: '#00a1e0' },
  { name: 'Pipedrive', icon: 'fa-solid fa-filter', color: '#28a745' },
  { name: 'Zoho', icon: 'fa-solid fa-database', color: '#e42527' },
  { name: 'G Meet', icon: 'fa-brands fa-google', color: '#00897B' },
  { name: 'SMS', icon: 'fa-solid fa-comment-sms', color: '#22c55e' },
];

const FAQ_DATA = [
  { q: "Messages aren't loading — what do I do?", a: "Try a hard refresh (Ctrl+Shift+R), then log out and back in. If it persists, clear your browser cache or switch to Chrome." },
  { q: "My email isn't syncing", a: "Go to Settings → Connected Accounts → Email. If the status shows Error or Disconnected, click Reconnect and re-authenticate with Google or Microsoft." },
  { q: "I'm not receiving notifications", a: "Check Settings → Notifications. Also verify your browser allows Pulse to send notifications: address bar → Site settings → Notifications → Allow." },
  { q: "Can't hear or record Voxer messages", a: "Check browser microphone permissions: address bar → Site settings → Microphone → Allow. Chrome is recommended for best audio support." },
  { q: "Calendar events aren't showing", a: "Go to Settings → Connected Accounts → Calendar and click Sync Now. Check that you haven't hidden any calendars in the view filter." },
  { q: "A contact appears twice", a: "Go to Contacts → Tools → Find Duplicates, select the pair, and click Merge. All data from both records is fully preserved." },
  { q: "Is my data encrypted?", a: "Yes. Pulse stores all data with AES-256 encryption at rest and TLS in transit. Support staff cannot read your message content — only metadata, with your explicit written consent." },
  { q: "How do I delete my account?", a: "Export your data first via Settings → Data Management → Export My Data. Then go to Settings → Data Management → Delete Account and type DELETE to confirm." },
];

const SHORTCUT_GROUPS = [
  { label: 'Global', icon: 'fa-solid fa-globe', shortcuts: [
    { keys: ['Ctrl', 'K'], desc: 'Unified search' },
    { keys: ['Ctrl', '/'], desc: 'Pulse AI Assistant' },
    { keys: ['Ctrl', 'Shift', 'P'], desc: 'Command palette' },
    { keys: ['Esc'], desc: 'Close modal / panel' },
    { keys: ['?'], desc: 'Contextual help' },
  ]},
  { label: 'Navigate', icon: 'fa-solid fa-compass', shortcuts: [
    { keys: ['G', 'D'], desc: 'Dashboard' },
    { keys: ['G', 'M'], desc: 'Messages' },
    { keys: ['G', 'E'], desc: 'Email' },
    { keys: ['G', 'V'], desc: 'Voxer' },
    { keys: ['G', 'C'], desc: 'Calendar' },
    { keys: ['G', 'T'], desc: 'Contacts' },
  ]},
  { label: 'Voxer', icon: 'fa-solid fa-microphone', shortcuts: [
    { keys: ['Space'], desc: 'Toggle recording' },
    { keys: ['1–8'], desc: 'Switch Vox mode' },
    { keys: ['Ctrl', 'S'], desc: 'AI summarize' },
    { keys: ['Esc'], desc: 'Cancel recording' },
  ]},
  { label: 'Email', icon: 'fa-solid fa-envelope', shortcuts: [
    { keys: ['C'], desc: 'Compose new' },
    { keys: ['R'], desc: 'Reply' },
    { keys: ['F'], desc: 'Forward' },
    { keys: ['E'], desc: 'Archive' },
    { keys: ['Ctrl', 'Enter'], desc: 'Send' },
  ]},
  { label: 'Messaging', icon: 'fa-solid fa-comment', shortcuts: [
    { keys: ['Enter'], desc: 'Send message' },
    { keys: ['Shift', 'Enter'], desc: 'New line' },
    { keys: ['@'], desc: '@mention picker' },
    { keys: ['#'], desc: 'Topic picker' },
    { keys: ['Ctrl', 'B'], desc: 'Bold' },
  ]},
  { label: 'Calendar', icon: 'fa-solid fa-calendar', shortcuts: [
    { keys: ['T'], desc: 'Jump to today' },
    { keys: ['N'], desc: 'New event' },
    { keys: ['D'], desc: 'Day view' },
    { keys: ['W'], desc: 'Week view' },
    { keys: ['M'], desc: 'Month view' },
  ]},
];

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionDivider = () => (
  <div className="relative h-10 pointer-events-none overflow-hidden" aria-hidden="true">
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

  // ── Live transcription typewriter ──────────────────────────────────
  const liveTranscriptPhrases = [
    "I'll loop in the design team on the mockups",
    "Can we move the standup to Thursday morning?",
    "Pushing the release to next sprint — let's align",
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

  // Scroll-triggered section backgrounds — fade in/out as user scrolls through each section
  useEffect(() => {
    const ids = ['section-voxer', 'section-decisions', 'section-crm'];
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

  // Scroll progress bar + back-to-top visibility
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      setScrollProgress(scrollHeight > 0 ? scrollTop / scrollHeight : 0);
      setShowBackToTop(scrollTop > 500);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll + close on Escape when guide drawer is open
  useEffect(() => {
    document.body.style.overflow = isGuideOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isGuideOpen]);

  useEffect(() => {
    if (!isGuideOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsGuideOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isGuideOpen]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogoClick = () => {
    window.location.href = '/?signin';
  };

  // ── Animated SVG icons for Voxer mode cards ────────────────────────────────
  const voxSvg = (idx: number): React.ReactNode => {
    const icons: React.ReactNode[] = [
      // 0 — Classic Voxer: 5-bar waveform equaliser
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
            className="absolute inset-0 bg-black/70 backdrop-blur-sm overlay-in cursor-pointer"
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
        .text-gradient-rose {
          background: linear-gradient(to right, #fb7185, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
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
        @keyframes bounce-up {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-5px); }
        }
        .bounce-up { animation: bounce-up 1.8s ease-in-out infinite; }

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
        /* Resting — subtle, always playing */
        .lp-icon-bob   { animation: icon-bob       3s   ease-in-out infinite; }
        .lp-icon-spin  { animation: icon-spin-slow  9s   linear     infinite; }
        .lp-icon-throb { animation: icon-throb      2.8s ease-in-out infinite; }
        .lp-icon-zap   { animation: icon-zap        4s   ease-in-out infinite; }
        .lp-icon-tilt  { animation: icon-tilt       3.2s ease-in-out infinite; }
        .lp-icon-stamp { animation: icon-stamp      3s   ease-in-out infinite; }
        /* Hover — bold, fast, glowing */
        .group:hover .lp-icon-bob   { animation-duration: 0.55s; filter: brightness(2.5) drop-shadow(0 0 10px currentColor); }
        .group:hover .lp-icon-spin  { animation-duration: 0.7s;  filter: brightness(2.5) drop-shadow(0 0 12px currentColor); }
        .group:hover .lp-icon-throb { animation-duration: 0.55s; filter: brightness(3)   drop-shadow(0 0 14px currentColor); }
        .group:hover .lp-icon-zap   { animation-duration: 0.38s; filter: brightness(4)   drop-shadow(0 0 18px currentColor); }
        .group:hover .lp-icon-tilt  { animation-duration: 0.5s;  filter: brightness(2.5) drop-shadow(0 0 10px currentColor); }
        .group:hover .lp-icon-stamp { animation-duration: 0.45s; filter: brightness(2.5) drop-shadow(0 0 10px currentColor); }
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
      <nav aria-label="Main navigation" className="fixed top-0 left-0 right-0 z-[100] bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

          {/* Left: Pulse logo + QntmEcos badge */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleLogoClick}
              className="flex items-center gap-3 cursor-pointer group bg-transparent border-0 p-0"
              aria-label="Pulse — return to sign in"
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
              <span className="text-xl font-bold bg-gradient-to-r from-rose-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">Pulse</span>
            </button>

            {/* QntmEcos badge */}
            <a
              href="https://qntmecos.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-700/60 bg-zinc-900/60 hover:border-rose-500/40 hover:bg-zinc-800/60 transition-all duration-200 group"
              title="Quantum Ecosystems — the studio behind Pulse"
              aria-label="QntmEcos — Quantum Ecosystems, the studio behind Pulse (opens in new tab)"
            >
              <QntmEcosIcon size={16} />
              <span className="text-[11px] font-medium text-zinc-400 group-hover:text-rose-400 transition-colors">QntmEcos</span>
            </a>
          </div>

          <div className="flex items-center gap-6 text-sm font-medium text-zinc-400">
            {/* Primary nav */}
            <button type="button" onClick={() => scrollToSection('features')} className="hover:text-white transition">Features</button>
            <button type="button" onClick={() => scrollToSection('ecosystem')} className="hover:text-white transition">Ecosystem</button>
            <button type="button" onClick={() => scrollToSection('scenarios')} className="hover:text-white transition">Scenarios</button>

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
                    href="https://github.com/FatherSonOne/Pulse-1/releases/download/v25.1.2/Pulse.Setup.25.1.2.exe"
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
                      <div className="text-[11px] text-zinc-600">App Store — coming soon</div>
                    </div>
                  </div>

                  {/* F-Droid — Coming soon */}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-45 cursor-not-allowed">
                    <span className="w-8 h-8 rounded-lg bg-zinc-700/40 flex items-center justify-center flex-shrink-0">
                      <Bot className="text-zinc-400 text-sm" />
                    </span>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-zinc-400">F-Droid</div>
                      <div className="text-[11px] text-zinc-600">Open source — coming soon</div>
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
            <span className="w-px h-4 bg-zinc-800" aria-hidden="true" />
            {/* Docs & legal */}
            <a href="/docs" className="flex items-center gap-1.5 hover:text-white transition">
              <Book className="text-[11px]" />
              Docs
            </a>
            <a href="/privacy" className="flex items-center gap-1.5 hover:text-white transition">
              <ShieldHalf className="text-[11px]" />
              Privacy
            </a>
          </div>

          <div className="flex items-center gap-3">
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
            <button
              onClick={onGetStarted}
              type="button"
              className="px-5 py-2.5 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700/80 hover:border-rose-500/50 text-zinc-100 hover:text-white rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-zinc-700/90 hover:shadow-lg hover:shadow-rose-500/10"
            >
              Log In
            </button>
            <button
              onClick={onGetStarted}
              type="button"
              className="hidden sm:block px-5 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 rounded-lg text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-rose-500/50"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main content landmark (ADA) ── */}
      <main id="main-content">

      {/* ── Hero Section ── */}
      <section className={`relative pt-40 pb-20 px-6 min-h-[92vh] flex items-center justify-center overflow-visible${isDarkMode ? '' : ' bg-stone-200'}`}>

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
          <div className="particle absolute top-[20%] left-[10%] w-2 h-2 bg-rose-500/40 rounded-full blur-sm" style={{ animationDelay: '0s' }}></div>
          <div className="particle absolute top-[60%] left-[15%] w-3 h-3 bg-pink-500/25 rounded-full blur-sm" style={{ animationDelay: '2s' }}></div>
          <div className="particle absolute top-[40%] right-[20%] w-2 h-2 bg-purple-500/35 rounded-full blur-sm" style={{ animationDelay: '4s' }}></div>
          <div className="particle absolute top-[70%] right-[10%] w-3 h-3 bg-rose-500/25 rounded-full blur-sm" style={{ animationDelay: '6s' }}></div>
          <div className="particle absolute top-[30%] left-[50%] w-2 h-2 bg-pink-500/35 rounded-full blur-sm" style={{ animationDelay: '8s' }}></div>
          <div className="particle absolute top-[80%] left-[30%] w-2 h-2 bg-purple-500/25 rounded-full blur-sm" style={{ animationDelay: '10s' }}></div>
          <div className="particle absolute top-[50%] right-[40%] w-3 h-3 bg-rose-500/30 rounded-full blur-sm" style={{ animationDelay: '12s' }}></div>
        </div>

        {/* Background gradients — dark mode only */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" style={{ opacity: isDarkMode ? 1 : 0 }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1400px] h-[800px] bg-gradient-to-br from-rose-500/45 via-pink-500/30 to-transparent rounded-full blur-[160px] opacity-75 mix-blend-screen"></div>
          <div className="absolute bottom-0 right-0 w-[1000px] h-[800px] bg-gradient-to-tl from-purple-500/30 via-pink-600/20 to-transparent rounded-full blur-[140px] opacity-55 mix-blend-screen"></div>
          <div className="absolute top-40 left-0 w-[700px] h-[700px] bg-gradient-to-br from-rose-600/20 via-pink-700/10 to-transparent rounded-full blur-[120px] opacity-50 mix-blend-screen"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[1100px] bg-gradient-radial from-rose-500/15 via-pink-600/8 to-transparent rounded-full blur-3xl opacity-70"></div>

          {/* Grid pattern */}
          <div className="absolute inset-0 z-[1]" style={{
            backgroundImage: isDarkMode
              ? `linear-gradient(rgba(244,63,94,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(236,72,153,0.18) 1px, transparent 1px), linear-gradient(rgba(168,85,247,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(244,63,94,0.12) 1px, transparent 1px)`
              : `linear-gradient(rgba(244,63,94,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(236,72,153,0.07) 1px, transparent 1px), linear-gradient(rgba(168,85,247,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(244,63,94,0.05) 1px, transparent 1px)`,
            backgroundSize: '64px 64px, 64px 64px, 32px 32px, 32px 32px',
            maskImage: 'radial-gradient(ellipse at center, black 50%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 50%, transparent 100%)',
            opacity: isDarkMode ? 0.9 : 0.7,
          }}></div>
        </div>

        {/* ECG cardiogram — draws across screen then fades, loops */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none z-[1]"
          style={{ height: '200px' }}
        >
          <svg
            viewBox="0 0 1200 200"
            style={{ width: '100%', height: '200px', display: 'block' }}
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="ecg-glow" x="-10%" y="-80%" width="120%" height="260%">
                <feGaussianBlur stdDeviation="5" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Soft glow trail — wide blurred stroke */}
            <path
              className="ecg-glow-trail"
              d="M0 110 L310 110 L335 92 L358 110 L395 110 L412 8 L422 192 L438 110 L480 110 L500 94 L532 72 L562 110 L1200 110"
              stroke="#f43f5e"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#ecg-glow)"
              pathLength="1"
              style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
            />

            {/* Main bright ECG line */}
            <path
              className="ecg-draw"
              d="M0 110 L310 110 L335 92 L358 110 L395 110 L412 8 L422 192 L438 110 L480 110 L500 94 L532 72 L562 110 L1200 110"
              stroke="#fb7185"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
            />
          </svg>
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10 pt-8 pb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/80 backdrop-blur-md rounded-full text-sm font-medium text-rose-300 mb-8 border border-rose-500/25 shadow-lg shadow-rose-900/30 animate-fade-in animation-delay-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            The Central Nervous System for High-Performance Teams
          </div>

          {/* Pulsing glow */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[1100px] h-[650px] pointer-events-none z-[2]">
            <div className="absolute inset-0 bg-gradient-to-r from-rose-500/40 via-pink-500/35 to-purple-500/30 rounded-full blur-[160px] animate-pulse-glow-slow"></div>
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold mb-8 leading-[1.15] tracking-tight relative z-10 pb-4">
            <span className="block text-white animate-fade-in animation-delay-200">Every Signal. Every Voice.</span>
            <span className="block mt-2 mb-2 text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-500 to-purple-500 animate-fade-in animation-delay-300">
              Every Decision.
            </span>
            <span className="block text-zinc-300 text-4xl sm:text-5xl font-semibold animate-fade-in animation-delay-400">Unified in Pulse.</span>
          </h1>

          <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in animation-delay-500">
            7 voice messaging modes. 8 unified platforms. 4 AI providers. Real-time transcription, CRM sync, and decision tracking — all in one living interface built for teams that move fast.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in animation-delay-500">
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-8 py-4 bg-white text-zinc-950 rounded-xl text-lg font-bold hover:bg-zinc-200 transition shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              type="button"
            >
              Launch Pulse
              <Rocket />
            </button>
          </div>
        </div>

      </section>

      {/* ── Stats Strip ── */}
      <div className="bg-zinc-900/80 border-y border-rose-500/15 py-5">
        <div className="w-full px-6 grid grid-cols-4 sm:grid-cols-8">
          {STATS.map((stat, i) => (
            <div key={stat.label} className="flex flex-col items-center py-1 relative">
              {i > 0 && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-10 bg-rose-500/20" />}
              <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-500 leading-none">{stat.value}</span>
              <span className="text-xs text-zinc-500 mt-1 whitespace-nowrap tracking-wide uppercase font-medium">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── I: Platform Badge Ticker ── hidden for now */}

      {/* ── Feature Showcase ── */}
      <div id="features">

        {/* Section A — Voice-First Communication */}
        <section id="section-voxer" className={`py-24 px-6 relative overflow-hidden${isDarkMode ? '' : ' bg-stone-50'}`}>
          {/* Voxer "Sonic Pulse" themed bg — indigo + pink, fades in with scroll */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-700"
            style={{ opacity: isDarkMode ? Math.min(sectionVis['section-voxer'] ?? 0, 1) : 0 }}
          >
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 15% 50%, rgba(99,102,241,0.18) 0%, transparent 55%), radial-gradient(ellipse at 85% 30%, rgba(236,72,153,0.13) 0%, transparent 50%), radial-gradient(ellipse at 50% 90%, rgba(139,92,246,0.10) 0%, transparent 45%)',
            }}></div>
            {/* Sonic rings — concentric indigo arcs like Voxer's waveform visualizer */}
            <div className="absolute left-[-80px] top-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-indigo-500/10" style={{ boxShadow: 'inset 0 0 60px rgba(99,102,241,0.06)' }}></div>
            <div className="absolute left-[-40px] top-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full border border-indigo-400/8"></div>
            <div className="absolute left-[20px] top-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full border border-pink-500/8"></div>
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-14 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-bold uppercase tracking-widest mb-4">
                <Mic /> Voxer
              </div>
              <h2 className="text-4xl sm:text-6xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-100 to-pink-200">
                7 Ways to Speak
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl">
                Voice messaging reimagined. From async voice drops to live team broadcasts — Voxer gives your voice the power it deserves, with AI transcription on every message.
              </p>
            </div>

            {/* ── Desktop: radial orbital layout ── */}
            <div className="relative flex items-center justify-center overflow-visible" style={{ height: '960px' }}>
              {/* Orbital ring decorations — centered via inset-0 m-auto */}
              <div className="absolute inset-0 m-auto rounded-full border border-rose-500/10 pointer-events-none" style={{ width: '860px', height: '860px' }} />
              <div className="absolute inset-0 m-auto rounded-full border border-indigo-500/10 pointer-events-none" style={{ width: '560px', height: '560px' }} />
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
                    <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Live Recording — Real-Time Transcription</span>
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
                {VOX_MODES.map((mode, i) => {
                  const angleDeg = (360 / 7) * i - 90;
                  const angleRad = angleDeg * (Math.PI / 180);
                  const orbitR = 410;
                  const cx = Math.round(Math.cos(angleRad) * orbitR);
                  const cy = Math.round(Math.sin(angleRad) * orbitR);
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

          </div>
        </section>

        <SectionDivider />

        {/* Section C — Decisions and Execution */}
        <section id="section-decisions" className={`py-24 px-6 relative${isDarkMode ? '' : ' bg-stone-50'}`}>
          {/* Decision hub themed bg — rose radial glow + pure dark, from DecisionTaskHub.css */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-700"
            style={{ opacity: isDarkMode ? Math.min(sectionVis['section-decisions'] ?? 0, 1) : 0 }}
          >
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 50% 40%, rgba(244,63,94,0.16) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(20,184,166,0.12) 0%, transparent 45%), radial-gradient(ellipse at 80% 70%, rgba(168,85,247,0.09) 0%, transparent 40%)',
            }}></div>
            {/* Rose pulse ring — central glow radiating from center like the decision health score */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-rose-500/8" style={{ boxShadow: '0 0 120px rgba(244,63,94,0.06) inset' }}></div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-rose-500/6"></div>
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-14 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-400 text-xs font-bold uppercase tracking-widest mb-4">
                <Gavel /> Decisions and Tasks
              </div>
              <h2 className="text-4xl sm:text-6xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-100 to-cyan-200">
                From Signal to Action
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl">
                Turn conversations into accountable decisions. Track tasks with AI priority scoring. Monitor team health before burnout strikes.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: 'fa-solid fa-chess-board',
                  title: 'Decision Kanban',
                  desc: 'Formalize discussions into tracked decisions with voting, reasoning logs, and outcome monitoring.',
                  tags: ['Voting', 'Audit Trail', 'Templates'],
                },
                {
                  icon: 'fa-solid fa-list-check',
                  title: 'AI Task Prioritizer',
                  desc: 'AI intelligently scores and reorders your task list based on urgency, dependencies, and team capacity.',
                  tags: ['Priority Score', 'Dependencies', 'Deadlines'],
                },
                {
                  icon: 'fa-solid fa-heart-pulse',
                  title: 'Team Health Dashboard',
                  desc: 'Real-time 0 to 100 health score tracking risk indicators, burnout signals, and load distribution.',
                  tags: ['Burnout Detection', 'Load Balance', '0-100 Score'],
                },
                {
                  icon: 'fa-solid fa-file-audio',
                  title: 'Meeting Intelligence',
                  desc: 'Every meeting transcribed, summarized, and mined for action items. Decisions auto-logged.',
                  tags: ['Transcription', 'Action Items', 'Decision Log'],
                },
              ].map((item, i) => (
                <div
                  key={item.title}
                  className="group p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-teal-500/40 transition-all duration-300 hover:-translate-y-2 animate-fade-in"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="lp-icon-wrap-teal w-11 h-11 rounded-xl bg-teal-500/10 flex items-center justify-center mb-4 group-hover:bg-teal-500/20 transition-all duration-300">
                    <span className="text-teal-400">
                      {[
                        // 0 — Decision Kanban: 2×2 kanban columns, one highlighted card
                        <svg viewBox="0 0 20 20" width={18} height={18} fill="currentColor" aria-hidden="true">
                          <rect x="2"  y="2" width="6.5" height="8"  rx="1.5" opacity={0.35} />
                          <rect x="2"  y="12" width="6.5" height="6" rx="1.5" opacity={0.35} />
                          <rect x="11" y="2" width="7"   height="5"  rx="1.5" opacity={0.35} />
                          <rect x="11" y="9" width="7"   height="9"  rx="1.5" className="lp-throb-sm" />
                        </svg>,
                        // 1 — AI Task Prioritizer: checklist with animated stroke-draw tick
                        <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3,5 4.5,7 7,3" className="lp-check-draw" fill="none" />
                          <line x1="9" y1="5" x2="17" y2="5" opacity={0.85} />
                          <line x1="3" y1="10" x2="17" y2="10" opacity={0.45} />
                          <line x1="3" y1="15" x2="14" y2="15" opacity={0.3} />
                        </svg>,
                        // 2 — Team Health Dashboard: pulsing heart + ECG line
                        <svg viewBox="0 0 20 20" width={18} height={18} fill="none" aria-hidden="true">
                          <path d="M10 16S3 11.5 3 6.5A3.5 3.5 0 019.5 4L10 4.4l.5-.4A3.5 3.5 0 0117 6.5C17 11.5 10 16 10 16z" fill="currentColor" fillOpacity={0.2} stroke="currentColor" strokeWidth={1.2} className="lp-throb-sm" />
                          <polyline points="1,10 4,10 6,7 8,13 10,10 13,10 15,7.5 17,10" stroke="currentColor" strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" className="lp-ecg-line" />
                        </svg>,
                        // 3 — Meeting Intelligence: file with animated waveform bars
                        <svg viewBox="0 0 20 20" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" aria-hidden="true">
                          <path d="M4 3h9l3 3v11a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" />
                          <path d="M13 3v3h3" />
                          <rect x="5.5"  y="12"   width="1.5" height="3.5" rx=".75" fill="currentColor" stroke="none" className="lp-bar-a" />
                          <rect x="8"    y="10"   width="1.5" height="5.5" rx=".75" fill="currentColor" stroke="none" className="lp-bar-b" />
                          <rect x="10.5" y="11"   width="1.5" height="4.5" rx=".75" fill="currentColor" stroke="none" className="lp-bar-c" />
                          <rect x="13"   y="13"   width="1.5" height="2.5" rx=".75" fill="currentColor" stroke="none" className="lp-bar-d" />
                        </svg>,
                      ][i]}
                    </span>
                  </div>
                  <h3 className="font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed mb-4">{item.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-teal-500/8 border border-teal-500/20 rounded text-[10px] text-teal-400 font-medium">{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* Section D — Relationship Intelligence */}
        <section id="section-crm" className={`py-24 px-6 border-y relative${isDarkMode ? ' bg-zinc-900/30 border-zinc-800/40' : ' bg-stone-100 border-stone-200/60'}`}>
          {/* Living Network themed bg — indigo constellation + cyan, from Contacts.css */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-700"
            style={{ opacity: isDarkMode ? Math.min(sectionVis['section-crm'] ?? 0, 1) : 0 }}
          >
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 10% 25%, rgba(99,102,241,0.18) 0%, transparent 50%), radial-gradient(ellipse at 90% 75%, rgba(6,182,212,0.15) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.08) 0%, transparent 70%)',
            }}></div>
            {/* Constellation dots — network node pattern like Contacts bubble visualization */}
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.22) 1.5px, transparent 1.5px)',
              backgroundSize: '55px 55px',
              maskImage: 'radial-gradient(ellipse at 15% 30%, black 25%, transparent 65%)',
              WebkitMaskImage: 'radial-gradient(ellipse at 15% 30%, black 25%, transparent 65%)',
            }}></div>
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-14 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-bold uppercase tracking-widest mb-4">
                <Network /> Relationships and CRM
              </div>
              <h2 className="text-4xl sm:text-6xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-100 to-pink-200">
                Know Your Network
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl">
                Deep relationship intelligence with 0–100 health scoring, contact circles, and bidirectional sync with Logos Vision — so every conversation in Pulse keeps your case records current.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 mb-8">
              {/* Relationship features */}
              <div className="space-y-4">
                {[
                  {
                    icon: 'fa-solid fa-heart',
                    title: 'Relationship Health Score',
                    desc: '0 to 100 score computed from interaction frequency, sentiment, and response time. Get alerts before relationships go cold.',
                  },
                  {
                    icon: 'fa-solid fa-circle-dot',
                    title: 'Contact Circles',
                    desc: 'Bubble-chart visualization showing your network by proximity, value, and engagement depth.',
                  },
                  {
                    icon: 'fa-solid fa-chart-simple',
                    title: 'Network Analytics',
                    desc: 'Communication pattern analysis, interaction heatmaps, and predictive engagement recommendations.',
                  },
                ].map((item, i) => (
                  <div key={item.title} className="flex gap-4 p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 hover:border-rose-500/30 transition-all duration-300 group">
                    <div className="lp-icon-wrap-rose w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0 group-hover:bg-rose-500/20 transition-all duration-300">
                      <span className="text-rose-400">
                        {[
                          // 0 — Relationship Health Score: pulsing heart
                          <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor" aria-hidden="true">
                            <path d="M10 17S3 12 3 7a3.5 3.5 0 017-1.3A3.5 3.5 0 0117 7c0 5-7 10-7 10z" className="lp-throb-sm" />
                          </svg>,
                          // 1 — Contact Circles: orbiting dot around central circle
                          <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor" aria-hidden="true">
                            <circle cx="10" cy="10" r="3" />
                            <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.4} />
                            <g className="lp-orbit-g">
                              <circle cx="10" cy="3" r="1.5" />
                            </g>
                          </svg>,
                          // 2 — Network Analytics: animated 4-bar chart
                          <svg viewBox="0 0 20 20" width={16} height={16} fill="currentColor" aria-hidden="true">
                            <rect x="1.5"  y="14" width="3" height="4"  rx="1" className="lp-bar-a" />
                            <rect x="6.5"  y="10" width="3" height="8"  rx="1" className="lp-bar-b" />
                            <rect x="11.5" y="6"  width="3" height="12" rx="1" className="lp-bar-c" />
                            <rect x="16.5" y="8"  width="2" height="10" rx="1" className="lp-bar-d" />
                          </svg>,
                        ][i]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white mb-1 text-sm">{item.title}</h3>
                      <p className="text-zinc-500 text-xs leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Logos Vision Sync */}
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
                    <Eye className="text-white text-sm" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Logos Vision</h3>
                    <span className="text-xs text-indigo-400">Bidirectional sync — live</span>
                  </div>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Connected
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      icon: 'fa-solid fa-comments',
                      color: '#6366f1',
                      label: 'Conversation → Case Log',
                      desc: 'Meet a client and send a Voxer message or reply in Pulse — a case log entry is automatically created in Logos Vision.',
                    },
                    {
                      icon: 'fa-solid fa-bolt',
                      color: '#a855f7',
                      label: 'Activity Feed Sync',
                      desc: 'Every touchpoint in Pulse — calls, messages, notes — surfaces instantly in the client\'s Logos Vision activity timeline.',
                    },
                    {
                      icon: 'fa-solid fa-wand-magic-sparkles',
                      color: '#ec4899',
                      label: 'AI Field Population',
                      desc: 'Pulse pools data from your conversations to auto-fill contact fields, case details, and relationship context in Logos Vision.',
                    },
                    {
                      icon: 'fa-solid fa-rotate',
                      color: '#06b6d4',
                      label: 'Records Flow Back',
                      desc: 'Case outcomes, notes, and status updates in Logos Vision surface in your Pulse relationship feed and contact health score.',
                    },
                  ].map((item, i) => (
                    <div key={item.label} className="flex gap-3 p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-indigo-500/30 transition-all duration-300 group">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${item.color}20`, border: `1px solid ${item.color}40` }}>
                        <span style={{ color: item.color }}>
                          {[
                            // 0 — Conversation → Case Log: two chat bubbles
                            <svg viewBox="0 0 20 20" width={14} height={14} fill="currentColor" aria-hidden="true">
                              <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v5a2 2 0 01-2 2H8L5 14v-3H4a2 2 0 01-2-2V4z" />
                              <path d="M8 8a2 2 0 012-2h5a2 2 0 012 2v3a2 2 0 01-2 2h-1v2l-2-2h-2a2 2 0 01-2-2" opacity={0.5} />
                            </svg>,
                            // 1 — Activity Feed Sync: flashing bolt
                            <svg viewBox="0 0 20 20" width={14} height={14} fill="currentColor" aria-hidden="true">
                              <path d="M11 2L4 12h6l-1 6 7-10h-6z" className="lp-flash" />
                            </svg>,
                            // 2 — AI Field Population: wand with sparkle points
                            <svg viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
                              <line x1="4" y1="16" x2="13" y2="7" />
                              <path d="M13 3l2 2-7 7-2-2z" fill="currentColor" fillOpacity={0.35} strokeWidth={1} />
                              <circle cx="16" cy="4" r="1" fill="currentColor" stroke="none" className="lp-rec-dot" />
                              <line x1="16" y1="1"   x2="16" y2="2.5" />
                              <line x1="16" y1="5.5" x2="16" y2="7" />
                              <line x1="18.5" y1="4" x2="17" y2="4" />
                              <line x1="15"   y1="4" x2="13.5" y2="4" />
                            </svg>,
                            // 3 — Records Flow Back: rotating circular arrow
                            <svg viewBox="0 0 20 20" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M17 10a7 7 0 11-7-7" className="lp-flash" />
                              <polyline points="13,3 17,3 17,7" />
                            </svg>,
                          ][i]}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white mb-0.5">{item.label}</p>
                        <p className="text-zinc-500 text-xs leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── B: Integration Logo Wall — hidden until integrations ship ── */}
      {/* TODO: Re-enable this section once platform integrations are live */}
      {/* <section className="py-20 px-6 bg-zinc-900/20 border-y border-zinc-800/30 relative overflow-hidden">
        ...
      </section> */}

      {/* ── G + F: Mobile Preview + Keyboard Shortcuts ── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 50%, rgba(99,102,241,0.08) 0%, transparent 55%)' }} />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* G: Mobile App Preview */}
            <div className="flex flex-col items-center">
              <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 text-xs font-bold uppercase tracking-widest mb-4">
                  <Smartphone className="text-green-400" /> Mobile App
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Pulse in Your Pocket</h2>
                <p className="text-zinc-400 text-base max-w-sm mx-auto">Full-featured Android app. Everything from the web — voice messages, inbox, decisions, CRM — all native.</p>
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
                      { name: 'HubSpot', msg: 'Deal stage updated: Proposal Sent', time: '1h', dot: '#f97316', icon: 'fa-brands fa-hubspot' },
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
            <h2 className="text-3xl sm:text-5xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-100 to-zinc-300">The Trinity of Productivity</h2>
            <p className="text-zinc-400 text-lg max-w-3xl mx-auto">
              Three powerful systems working in perfect harmony to handle every aspect of your business operations.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Pulse Card */}
            <div className="relative group animate-fade-in animation-delay-200">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/30 to-pink-500/25 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              <div className="relative h-full bg-zinc-950/90 backdrop-blur-sm border border-zinc-800 rounded-3xl p-8 hover:border-rose-500/60 transition-all duration-300 flex flex-col hover:-translate-y-2 card-elevated-rose">
                <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800 group-hover:border-rose-500/50 group-hover:scale-110 transition duration-300">
                  <HeartPulse className="text-2xl text-rose-500" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Pulse</h3>
                <div className="text-sm font-bold text-rose-500 tracking-wider uppercase mb-4">Communication and Intelligence</div>
                <p className="text-zinc-400 mb-6 flex-grow">The voice and ears of your organization. Real-time messaging, 7 voice modes, and AI transcription that turns every word into action.</p>
                <ul className="space-y-3 text-zinc-300 text-sm">
                  <li className="flex items-center gap-2"><Check className="text-rose-500" /> 7 Voxer Modes</li>
                  <li className="flex items-center gap-2"><Check className="text-rose-500" /> 8-Platform Unified Inbox</li>
                  <li className="flex items-center gap-2"><Check className="text-rose-500" /> AI Transcription + Action Items</li>
                </ul>
              </div>
            </div>

            {/* Logos Vision Card */}
            <div className="relative group animate-fade-in animation-delay-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-cyan-500/25 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              <div className="relative h-full bg-zinc-950/90 backdrop-blur-sm border border-zinc-800 rounded-3xl p-8 hover:border-blue-500/60 transition-all duration-300 flex flex-col hover:-translate-y-2 card-elevated">
                <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800 group-hover:border-blue-500/50 group-hover:scale-110 transition duration-300">
                  <Eye className="text-2xl text-blue-500" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Logos Vision</h3>
                <div className="text-sm font-bold text-blue-500 tracking-wider uppercase mb-4">CRM and Relationships</div>
                <p className="text-zinc-400 mb-6 flex-grow">The memory of your organization. Deep relationship intelligence with health scoring and 4 native CRM integrations that auto-sync every interaction.</p>
                <ul className="space-y-3 text-zinc-300 text-sm">
                  <li className="flex items-center gap-2"><Check className="text-blue-500" /> 0-100 Relationship Scoring</li>
                  <li className="flex items-center gap-2"><Check className="text-blue-500" /> 4 CRM Integrations</li>
                  <li className="flex items-center gap-2"><Check className="text-blue-500" /> Network Visualization</li>
                </ul>
              </div>
            </div>

            {/* Entomate Card */}
            <div className="relative group animate-fade-in animation-delay-400">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/30 to-teal-500/25 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              <div className="relative h-full bg-zinc-950/90 backdrop-blur-sm border border-zinc-800 rounded-3xl p-8 hover:border-emerald-500/60 transition-all duration-300 flex flex-col hover:-translate-y-2 card-elevated">
                <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800 group-hover:border-emerald-500/50 group-hover:scale-110 transition duration-300">
                  <Bot className="text-2xl text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Entomate</h3>
                <div className="text-sm font-bold text-emerald-500 tracking-wider uppercase mb-4">Automation and Workflow</div>
                <p className="text-zinc-400 mb-6 flex-grow">The hands of your organization. Intelligent agents that execute tasks, move data between systems, and automate complex multi-step workflows.</p>
                <ul className="space-y-3 text-zinc-300 text-sm">
                  <li className="flex items-center gap-2"><Check className="text-emerald-500" /> Workflow Builders</li>
                  <li className="flex items-center gap-2"><Check className="text-emerald-500" /> Auto-Task Execution</li>
                  <li className="flex items-center gap-2"><Check className="text-emerald-500" /> Cross-Platform Actions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Use-Case Scenarios ── */}
      <section id="scenarios" className="py-24 px-6 bg-gradient-to-b from-zinc-900/20 to-zinc-950 border-b border-zinc-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-3xl sm:text-5xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-300">See It In Action</h2>
            <p className="text-zinc-400 text-lg mb-8">Real-world workflows powered by the Pulse ecosystem.</p>

            {/* Scenario toggle */}
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
          </div>

          {activeScenario === 'enterprise' ? (
            <div className="relative">
              <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-rose-500/50 to-transparent -translate-y-1/2 z-0"></div>
              <div className="grid lg:grid-cols-4 gap-6 relative z-10">
                {[
                  { num: '1', system: 'PULSE', badgeClass: 'from-rose-500 to-pink-500', labelClass: 'text-gradient-rose', borderClass: 'hover:border-rose-500/40', title: 'The Signal', body: 'A high-priority email from a key client lands. Pulse flags it "Urgent", extracts requirements, and routes it to the grants channel with an AI summary.' },
                  { num: '2', system: 'LOGOS VISION', badgeClass: 'from-blue-500 to-cyan-500', labelClass: 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent', borderClass: 'hover:border-blue-500/40', title: 'The Context', body: 'The system links the message to the Client Record — pulling past grant history, success rates, and the assigned relationship manager automatically.' },
                  { num: '3', system: 'ENTOMATE', badgeClass: 'from-emerald-500 to-teal-500', labelClass: 'bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent', borderClass: 'hover:border-emerald-500/40', title: 'The Action', body: 'An Apply workflow fires. A task is created for the Grant Writer, a kickoff meeting is scheduled based on availability, and an acknowledgment email is drafted.' },
                  { num: '4', system: 'WAR ROOM', badgeClass: 'from-purple-500 to-violet-500', labelClass: 'bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent', borderClass: 'hover:border-purple-500/40', title: 'The Intelligence', body: 'War Room activates in Strategist Mode. The AI swarm researches grant requirements, compares past applications, and outputs a polished grant proposal draft in minutes.' },
                ].map((step) => (
                  <div key={step.num} className={`bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 p-7 rounded-2xl relative hover:-translate-y-2 transition-all duration-300 card-elevated ${step.borderClass} group animate-fade-in`}>
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
                  { num: '1', system: 'VOX DROP', badgeClass: 'from-rose-500 to-pink-500', labelClass: 'text-gradient-rose', borderClass: 'hover:border-rose-500/40', title: 'Drop and Go', body: "You're driving. One tap and you're recording a Vox Drop — a scheduled voice message queued to deliver when your recipient is most active." },
                  { num: '2', system: 'AI TRANSCRIPTION', badgeClass: 'from-blue-500 to-cyan-500', labelClass: 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent', borderClass: 'hover:border-blue-500/40', title: 'Instant Intelligence', body: 'On delivery, Pulse transcribes the message, generates a summary, extracts action items, and scores sentiment — all before the recipient presses play.' },
                  { num: '3', system: 'SMART REPLY', badgeClass: 'from-emerald-500 to-teal-500', labelClass: 'bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent', borderClass: 'hover:border-emerald-500/40', title: 'One-Tap Response', body: 'The recipient sees the transcript and summary, picks a smart reply suggestion, and responds with their own 10-second voice note. Full async conversation, zero context lost.' },
                ].map((step) => (
                  <div key={step.num} className={`bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 p-8 rounded-2xl relative hover:-translate-y-2 transition-all duration-300 card-elevated ${step.borderClass} group animate-fade-in`}>
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
          <h2 className="text-3xl sm:text-5xl font-bold mb-8 animate-fade-in text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-300">Available Everywhere</h2>
          <p className="text-zinc-400 text-lg mb-12 animate-fade-in animation-delay-200">
            Seamlessly sync your team across all devices. Download the app for your preferred platform.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <DownloadButton icon="fa-brands fa-windows" platform="Windows PC" subtext="Desktop Installer · x64" active={true} href="https://github.com/FatherSonOne/Pulse-1/releases/download/v25.1.2/Pulse.Setup.25.1.2.exe" />
            <DownloadButton icon="fa-brands fa-apple" platform="macOS / iOS" subtext="Universal" active={false} />

            {/* Android Card */}
            <div className="group p-6 rounded-2xl border bg-zinc-800 border-zinc-700 hover:border-rose-500/50 transition duration-300 flex flex-col items-center justify-center gap-4 w-full">
              <Smartphone className="text-4xl text-zinc-300 group-hover:text-white transition" />
              <div className="text-center">
                <div className="font-bold text-white group-hover:text-rose-400 transition">Android</div>
                <div className="text-xs text-zinc-500">Play Store and APK</div>
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

            <DownloadButton icon="fa-solid fa-robot" platform="F-Droid" subtext="Open Source" active={false} />
          </div>

          {/* Android Instructions */}
          <div id="android-instructions" className="mt-16 max-w-2xl mx-auto bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-left">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
              <Smartphone className="text-rose-500" />
              How to Install on Android
            </h3>
            <div className="mb-8 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
              <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                <Play className="text-green-500" /> Recommended: Play Store
              </h4>
              <p className="text-sm text-zinc-400 mb-3">The easiest way to install Pulse. Automatic updates and security checks included.</p>
              <a href="https://play.google.com/apps/internaltest/4701381285127016770" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300 font-medium">
                Go to Play Store <ExternalLink className="text-xs" />
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
                <a href="https://github.com/FatherSonOne/Pulse-1/releases/tag/v25.1.2" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">GitHub Releases</a>.
                Choose <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-blue-400 text-xs">Pulse.Setup.25.1.2.exe</code> (installer) or <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-blue-400 text-xs">Pulse.25.1.2.exe</code> (portable, no install needed).
              </li>
              <li className="relative">
                <span className="absolute -left-[41px] w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white">2</span>
                <strong className="text-white block mb-1">Run the installer</strong>
                Double-click the downloaded file. If Windows SmartScreen appears, click <em>More info → Run anyway</em>. The app is safe — it's just unsigned during early access.
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
              Requires Windows 10 or later (64-bit). Pulse runs in the system tray — closing the window keeps it running in the background.
            </div>
          </div>
          <p className="mt-8 text-sm text-zinc-500">* macOS and Linux builds coming soon.</p>
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
            <p className="text-zinc-500 text-base">Quick answers — full guide available via the Guide button in the nav.</p>
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

      </main>{/* /#main-content */}

      {/* ── Footer ── */}
      <footer className="bg-zinc-950 border-t border-zinc-800 pt-16 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center border border-zinc-800">
                  <svg viewBox="0 0 64 64" className="w-5 h-5">
                    <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad-nav)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
                <span className="text-xl font-bold text-white">Pulse</span>
              </div>
              <p className="text-zinc-400 max-w-sm mb-6">
                AI-driven communication, deep relationship intelligence, and automated workflows — all in one living interface for high-performance teams.
              </p>
              <div className="flex gap-4 mb-8">
                <SocialIcon icon="fa-brands fa-twitter" label="Follow Pulse on X (Twitter)" />
                <SocialIcon icon="fa-brands fa-github" label="Pulse on GitHub" />
                <SocialIcon icon="fa-brands fa-discord" label="Join the Pulse Discord" />
                <SocialIcon icon="fa-brands fa-linkedin" label="Pulse on LinkedIn" />
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
                  <a href="/docs/SECURITY-AUDIT-REPORT.md" target="_blank" rel="noopener noreferrer" className="hover:text-rose-500 transition flex items-center gap-1">
                    Security Audit <ExternalLink className="text-[10px]" />
                  </a>
                </li>
                <li><a href="#" className="hover:text-rose-500 transition">Compliance</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">
              &copy; {new Date().getFullYear()} Quantum Ecosystems (QntmEcos) · Logos Vision LLC. All rights reserved.
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
      aria-label={inactive ? `${platform} — coming soon` : platform}
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

const SocialIcon = ({ icon, label }: { icon: string; label: string }) => (
  <a href="#" aria-label={label} className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:bg-rose-500 hover:text-white transition duration-300">
    <i className={icon} aria-hidden="true"></i>
  </a>
);


export default LandingPage;
