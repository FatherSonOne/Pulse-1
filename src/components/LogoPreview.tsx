import React, { useState } from 'react';

interface LogoOption {
  id: string;
  name: string;
  description: string;
  palette: string;
  svg: string;
  faviconSvg: string;
}

const logoOptions: LogoOption[] = [
  {
    id: 'heartbeat-coral',
    name: 'Heartbeat Coral',
    description: 'Classic heartbeat line with warm coral gradient',
    palette: 'Coral Pink to Rose',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" fill="none">
      <defs>
        <linearGradient id="coral-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#f43f5e"/>
          <stop offset="100%" style="stop-color:#ec4899"/>
        </linearGradient>
      </defs>
      <rect width="200" height="60" rx="12" fill="#0f172a"/>
      <path d="M15 30 L35 30 L42 15 L50 45 L58 20 L66 40 L74 30 L90 30" stroke="url(#coral-grad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <text x="100" y="38" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700">Pulse</text>
    </svg>`,
    faviconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="coral-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f43f5e"/>
          <stop offset="100%" style="stop-color:#ec4899"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0f172a"/>
      <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#coral-grad)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`
  },
  {
    id: 'heartbeat-cyan',
    name: 'Heartbeat Cyan',
    description: 'Medical-style pulse with electric cyan (matches Logos Vision)',
    palette: 'Electric Cyan to Blue',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" fill="none">
      <defs>
        <linearGradient id="cyan-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#22d3ee"/>
          <stop offset="100%" style="stop-color:#3b82f6"/>
        </linearGradient>
      </defs>
      <rect width="200" height="60" rx="12" fill="#020617"/>
      <path d="M15 30 L35 30 L42 15 L50 45 L58 20 L66 40 L74 30 L90 30" stroke="url(#cyan-grad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <text x="100" y="38" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700">Pulse</text>
    </svg>`,
    faviconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="cyan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#22d3ee"/>
          <stop offset="100%" style="stop-color:#3b82f6"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#020617"/>
      <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#cyan-grad)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`
  },
  {
    id: 'heartbeat-emerald',
    name: 'Heartbeat Emerald',
    description: 'Vitality pulse with green gradient (matches Entomate/Agentica)',
    palette: 'Emerald to Teal',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" fill="none">
      <defs>
        <linearGradient id="emerald-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#10b981"/>
          <stop offset="100%" style="stop-color:#14b8a6"/>
        </linearGradient>
      </defs>
      <rect width="200" height="60" rx="12" fill="#0f172a"/>
      <path d="M15 30 L35 30 L42 15 L50 45 L58 20 L66 40 L74 30 L90 30" stroke="url(#emerald-grad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <text x="100" y="38" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700">Pulse</text>
    </svg>`,
    faviconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="emerald-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#10b981"/>
          <stop offset="100%" style="stop-color:#14b8a6"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0f172a"/>
      <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#emerald-grad)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`
  },
  {
    id: 'heart-pulse-red',
    name: 'Heart Pulse',
    description: 'Stylized heart with pulse wave, classic red',
    palette: 'Red to Rose',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" fill="none">
      <defs>
        <linearGradient id="red-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ef4444"/>
          <stop offset="100%" style="stop-color:#f43f5e"/>
        </linearGradient>
      </defs>
      <rect width="200" height="60" rx="12" fill="#18181b"/>
      <path d="M35 20 C25 20 20 30 20 35 C20 50 35 55 45 45 C55 55 70 50 70 35 C70 30 65 20 55 20 C50 20 47 23 45 27 C43 23 40 20 35 20" fill="url(#red-grad)" opacity="0.9"/>
      <path d="M28 35 L38 35 L42 25 L48 45 L52 30 L58 35 L62 35" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <text x="85" y="38" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700">Pulse</text>
    </svg>`,
    faviconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="red-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ef4444"/>
          <stop offset="100%" style="stop-color:#f43f5e"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#18181b"/>
      <path d="M25 18 C17 18 12 26 12 30 C12 44 25 52 32 42 C39 52 52 44 52 30 C52 26 47 18 39 18 C34 18 33 21 32 24 C31 21 30 18 25 18" fill="url(#red-grad)"/>
      <path d="M18 32 L26 32 L29 22 L35 42 L39 28 L44 32 L50 32" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`
  },
  {
    id: 'circle-pulse-violet',
    name: 'Circle Pulse Violet',
    description: 'Circular badge with animated pulse rings',
    palette: 'Violet to Purple',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" fill="none">
      <defs>
        <linearGradient id="violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#8b5cf6"/>
          <stop offset="100%" style="stop-color:#a855f7"/>
        </linearGradient>
      </defs>
      <rect width="200" height="60" rx="12" fill="#0c0a1d"/>
      <circle cx="45" cy="30" r="20" stroke="url(#violet-grad)" stroke-width="3" fill="none" opacity="0.3"/>
      <circle cx="45" cy="30" r="14" stroke="url(#violet-grad)" stroke-width="2.5" fill="none" opacity="0.6"/>
      <circle cx="45" cy="30" r="8" fill="url(#violet-grad)"/>
      <path d="M25 30 L35 30 L40 20 L45 40 L50 25 L55 30 L65 30" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
      <text x="80" y="38" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700">Pulse</text>
    </svg>`,
    faviconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#8b5cf6"/>
          <stop offset="100%" style="stop-color:#a855f7"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0c0a1d"/>
      <circle cx="32" cy="32" r="24" stroke="url(#violet-grad)" stroke-width="3" fill="none" opacity="0.3"/>
      <circle cx="32" cy="32" r="16" stroke="url(#violet-grad)" stroke-width="2.5" fill="none" opacity="0.6"/>
      <circle cx="32" cy="32" r="8" fill="url(#violet-grad)"/>
      <path d="M12 32 L22 32 L27 18 L32 46 L37 26 L42 32 L52 32" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    </svg>`
  },
  {
    id: 'wave-orange',
    name: 'Signal Wave Orange',
    description: 'Communication signal wave with warm orange',
    palette: 'Orange to Amber',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" fill="none">
      <defs>
        <linearGradient id="orange-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#f97316"/>
          <stop offset="100%" style="stop-color:#f59e0b"/>
        </linearGradient>
      </defs>
      <rect width="200" height="60" rx="12" fill="#1c1917"/>
      <circle cx="30" cy="30" r="6" fill="url(#orange-grad)"/>
      <path d="M40 30 C45 20 50 40 55 30 C60 20 65 40 70 30 C75 20 80 40 85 30" stroke="url(#orange-grad)" stroke-width="3" stroke-linecap="round" fill="none"/>
      <text x="95" y="38" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700">Pulse</text>
    </svg>`,
    faviconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="orange-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#f97316"/>
          <stop offset="100%" style="stop-color:#f59e0b"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#1c1917"/>
      <circle cx="18" cy="32" r="8" fill="url(#orange-grad)"/>
      <path d="M28 32 C33 18 38 46 43 32 C48 18 53 46 58 32" stroke="url(#orange-grad)" stroke-width="4" stroke-linecap="round" fill="none"/>
    </svg>`
  },
  {
    id: 'modern-p-blue',
    name: 'Modern P Blue',
    description: 'Stylized P lettermark with pulse line',
    palette: 'Blue to Indigo',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" fill="none">
      <defs>
        <linearGradient id="blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6"/>
          <stop offset="100%" style="stop-color:#6366f1"/>
        </linearGradient>
      </defs>
      <rect width="200" height="60" rx="12" fill="#0f172a"/>
      <text x="20" y="45" fill="url(#blue-grad)" font-family="system-ui, -apple-system, sans-serif" font-size="40" font-weight="800">P</text>
      <path d="M50 30 L60 30 L65 18 L72 42 L78 25 L84 30 L95 30" stroke="url(#blue-grad)" stroke-width="3" stroke-linecap="round" fill="none"/>
      <text x="100" y="38" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600">ulse</text>
    </svg>`,
    faviconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6"/>
          <stop offset="100%" style="stop-color:#6366f1"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0f172a"/>
      <text x="8" y="48" fill="url(#blue-grad)" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="800">P</text>
      <path d="M32 32 L38 32 L42 20 L48 44 L52 28 L56 32" stroke="url(#blue-grad)" stroke-width="3" stroke-linecap="round" fill="none"/>
    </svg>`
  },
  {
    id: 'neon-pink',
    name: 'Neon Pink',
    description: 'Cyberpunk-style neon glow effect',
    palette: 'Hot Pink to Magenta',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" fill="none">
      <defs>
        <linearGradient id="pink-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#ec4899"/>
          <stop offset="100%" style="stop-color:#d946ef"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="200" height="60" rx="12" fill="#09090b"/>
      <path d="M15 30 L30 30 L38 12 L48 48 L58 18 L68 42 L78 30 L90 30" stroke="url(#pink-grad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" filter="url(#glow)"/>
      <text x="98" y="39" fill="url(#pink-grad)" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="700" filter="url(#glow)">Pulse</text>
    </svg>`,
    faviconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="pink-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ec4899"/>
          <stop offset="100%" style="stop-color:#d946ef"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="64" height="64" rx="14" fill="#09090b"/>
      <path d="M8 32 L16 32 L22 14 L32 50 L42 20 L50 44 L56 32" stroke="url(#pink-grad)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" filter="url(#glow)"/>
    </svg>`
  }
];

interface LogoPreviewProps {
  onClose: () => void;
  onSelect: (logo: LogoOption) => void;
}

const LogoPreview: React.FC<LogoPreviewProps> = ({ onClose, onSelect }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('dark');

  const handleSelect = (logo: LogoOption) => {
    setSelectedId(logo.id);
  };

  const handleApply = () => {
    const selected = logoOptions.find(l => l.id === selectedId);
    if (selected) {
      onSelect(selected);
    }
  };

  // Convert SVG to PNG and download
  const downloadPng = (svg: string, filename: string, size: number = 512) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (blob) {
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = filename.replace('.svg', '.png');
          a.click();
          URL.revokeObjectURL(pngUrl);
        }
      }, 'image/png');
    };

    img.src = url;
  };

  // Download full logo as PNG (wider aspect ratio)
  const downloadLogoPng = (svg: string, filename: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, 800, 240);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (blob) {
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = filename.replace('.svg', '.png');
          a.click();
          URL.revokeObjectURL(pngUrl);
        }
      }, 'image/png');
    };

    img.src = url;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center">
                <i className="fa-solid fa-palette text-white"></i>
              </div>
              Pulse Logo Preview
            </h2>
            <p className="text-zinc-500 mt-1">Select a logo style for your app</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition"
          >
            <i className="fa-solid fa-times text-zinc-500"></i>
          </button>
        </div>

        {/* Preview Mode Toggle */}
        <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
          <span className="text-sm text-zinc-500">Preview Background:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPreviewMode('dark')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                previewMode === 'dark'
                  ? 'bg-zinc-800 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setPreviewMode('light')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                previewMode === 'light'
                  ? 'bg-white text-zinc-900 border border-zinc-300'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Light
            </button>
          </div>
        </div>

        {/* Logo Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {logoOptions.map((logo) => (
              <div
                key={logo.id}
                onClick={() => handleSelect(logo)}
                className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                  selectedId === logo.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                }`}
              >
                {/* Logo Preview */}
                <div className={`rounded-xl p-4 mb-3 ${previewMode === 'dark' ? 'bg-zinc-950' : 'bg-zinc-100'}`}>
                  <div className="flex items-center gap-4">
                    {/* Full Logo */}
                    <div
                      className="flex-1 h-16"
                      dangerouslySetInnerHTML={{ __html: logo.svg }}
                      style={{ maxWidth: '200px' }}
                    />
                    {/* Favicon */}
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="w-12 h-12"
                        dangerouslySetInnerHTML={{ __html: logo.faviconSvg }}
                      />
                      <span className="text-[10px] text-zinc-500">Favicon</span>
                    </div>
                  </div>
                </div>

                {/* Logo Info */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white">{logo.name}</h3>
                    <p className="text-sm text-zinc-500 mt-0.5">{logo.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {logo.palette}
                      </span>
                    </div>
                  </div>
                  {selectedId === logo.id && (
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                      <i className="fa-solid fa-check text-white text-xs"></i>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="text-sm text-zinc-500">
            {selectedId ? (
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-check-circle text-emerald-500"></i>
                Selected: {logoOptions.find(l => l.id === selectedId)?.name}
              </span>
            ) : (
              'Click a logo to select it'
            )}
          </div>
          <div className="flex gap-3">
            {selectedId && (
              <>
                <button
                  onClick={() => {
                    const logo = logoOptions.find(l => l.id === selectedId);
                    if (logo) downloadLogoPng(logo.svg, `pulse-logo-${logo.id}.png`);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-download"></i>
                  Download Logo PNG
                </button>
                <button
                  onClick={() => {
                    const logo = logoOptions.find(l => l.id === selectedId);
                    if (logo) downloadPng(logo.faviconSvg, `pulse-favicon-${logo.id}.png`, 512);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-image"></i>
                  Download Favicon PNG
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedId}
              className={`px-4 py-2 rounded-xl font-medium transition flex items-center gap-2 ${
                selectedId
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed'
              }`}
            >
              <i className="fa-solid fa-check"></i>
              Apply Logo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoPreview;
export { logoOptions };
export type { LogoOption };
