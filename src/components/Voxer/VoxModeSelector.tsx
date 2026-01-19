// Vox Mode Selector - CMF Nothing x Glassmorphism Avant-Garde Design
// Premium industrial aesthetic with frosted glass, exposed elements, bold typography

import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  MessageSquare,
  Users,
  FileText,
  Zap,
  Clock,
  ChevronRight,
  Phone,
  Waves,
  Settings,
  Video,
  X,
} from 'lucide-react';
import { VOX_MODES, VoxMode, VoxModeInfo } from '../../services/voxer/voxModeTypes';
import VoxerSettings from './VoxerSettings';

interface VoxModeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: VoxMode | null) => void;
  currentMode?: VoxMode | null;
  isDarkMode?: boolean;
  onOpenSettings?: () => void;
}

// Classic Voxer mode info (not in VOX_MODES, shown separately)
const CLASSIC_VOXER_INFO = {
  id: null,
  name: 'Classic Voxer',
  tagline: 'Direct Contact Messaging',
  description: 'The original Voxer experience - send voice messages directly to your contacts with all the classic features: real-time transcription, AI analysis, threaded replies, and more.',
  workflow: [
    'Select a contact from your list',
    'Hold or tap to record a voice message',
    'Preview and send your recording',
    'View transcription and AI analysis',
    'Track delivery and playback status'
  ],
  icon: '📱',
  color: '#F97316',
  gradient: 'from-orange-500 to-red-600',
  features: [
    'Direct contact messaging',
    'Real-time transcription',
    'AI voice analysis',
    'Delivery tracking',
    'Message reactions'
  ],
  bestFor: [
    'Direct communication',
    'Personal messages',
    'Quick voice replies',
    'One-on-one conversations'
  ]
};

const MODE_ICONS: Record<VoxMode, React.ReactNode> = {
  pulse_radio: <Radio className="w-5 h-5" />,
  voice_threads: <MessageSquare className="w-5 h-5" />,
  team_vox: <Users className="w-5 h-5" />,
  vox_notes: <FileText className="w-5 h-5" />,
  quick_vox: <Zap className="w-5 h-5" />,
  vox_drop: <Clock className="w-5 h-5" />,
  video_vox: <Video className="w-5 h-5" />,
};

const MODE_COLORS: Record<string, string> = {
  classic: '#F97316',
  pulse_radio: '#8B5CF6',
  voice_threads: '#10B981',
  team_vox: '#F59E0B',
  vox_notes: '#EC4899',
  quick_vox: '#3B82F6',
  vox_drop: '#EF4444',
  video_vox: '#8B5CF6',
};

// Industrial dot matrix pattern for CMF Nothing aesthetic
const DotMatrix: React.FC<{ color: string; isDarkMode: boolean }> = ({ color, isDarkMode }) => {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-[0.03] pointer-events-none">
      <svg width="100%" height="100%">
        <defs>
          <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill={isDarkMode ? '#ffffff' : '#000000'} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>
    </div>
  );
};

const VoxModeSelector: React.FC<VoxModeSelectorProps> = ({
  isOpen,
  onClose,
  onSelectMode,
  currentMode,
  isDarkMode = false,
}) => {
  const [hoveredMode, setHoveredMode] = useState<VoxMode | 'classic' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHoveredMode(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const displayMode = hoveredMode;
  const activeModeInfo = displayMode === 'classic'
    ? CLASSIC_VOXER_INFO
    : displayMode
      ? VOX_MODES[displayMode]
      : null;

  const handleModeSelect = (mode: VoxMode | 'classic') => {
    onSelectMode(mode === 'classic' ? null : mode);
    onClose();
  };

  const getModeColor = (modeKey: string) => MODE_COLORS[modeKey] || '#6366f1';
  const activeColor = getModeColor(displayMode || 'classic');

  const allModes: Array<{ key: VoxMode | 'classic'; info: typeof CLASSIC_VOXER_INFO }> = [
    { key: 'classic', info: CLASSIC_VOXER_INFO },
    ...Object.keys(VOX_MODES).map(key => ({
      key: key as VoxMode,
      info: VOX_MODES[key as VoxMode] as unknown as typeof CLASSIC_VOXER_INFO
    }))
  ];

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex flex-col overflow-hidden ${isDarkMode ? 'vox-selector-dark' : 'vox-selector-light'}`}
      style={{
        background: isDarkMode
          ? 'linear-gradient(180deg, #0c0c0c 0%, #111111 50%, #0a0a0a 100%)'
          : 'linear-gradient(180deg, #fafafa 0%, #f5f5f5 50%, #ffffff 100%)',
        fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* Industrial Dot Matrix Background */}
      <DotMatrix color={activeColor} isDarkMode={isDarkMode} />

      {/* Accent glow orb - CMF Nothing style */}
      <div
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[120px] opacity-20 transition-all duration-1000"
        style={{ backgroundColor: activeColor }}
      />
      <div
        className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-[100px] opacity-10 transition-all duration-1000"
        style={{ backgroundColor: activeColor }}
      />

      {/* Header - Industrial minimal */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Exposed mechanical icon container */}
          <div
            className="relative w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden"
            style={{
              background: isDarkMode
                ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
                : 'linear-gradient(135deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.01) 100%)',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              boxShadow: `0 4px 24px ${activeColor}15`,
            }}
          >
            {/* Corner notch - CMF Nothing detail */}
            <div
              className="absolute top-0 right-0 w-3 h-3"
              style={{
                background: activeColor,
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
              }}
            />
            <Waves className="w-5 h-5" style={{ color: activeColor }} />
          </div>
          <div>
            <h1
              className="text-xl font-semibold tracking-tight"
              style={{
                color: isDarkMode ? '#ffffff' : '#0a0a0a',
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 600,
              }}
            >
              Vox Mode
            </h1>
            <p
              className="text-xs tracking-wide"
              style={{
                color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Select Experience
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Settings Button - Industrial circle */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
            title="Voxer Settings"
          >
            <Settings
              className="w-4 h-4 transition-colors"
              style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}
            />
          </button>

          {/* Industrial sound level indicator */}
          <div className="hidden md:flex items-end gap-[3px] h-6 px-2">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full transition-all duration-300"
                style={{
                  height: `${40 + Math.sin(i * 0.8) * 30 + i * 8}%`,
                  background: `linear-gradient(to top, ${activeColor}, ${activeColor}60)`,
                  opacity: 0.4 + (i * 0.08),
                  animation: `vox-eq-bar 1.2s ease-in-out ${i * 0.1}s infinite alternate`,
                }}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Main Content - Split layout */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row overflow-hidden px-4 md:px-6 pb-4 gap-5">

        {/* Left Side - Mode List with glassmorphism cards */}
        <div className="lg:w-[360px] xl:w-[400px] flex-shrink-0 overflow-y-auto pr-1 vox-custom-scrollbar">
          <div className="space-y-2 py-1">
            {allModes.map(({ key, info }, index) => {
              const isHovered = hoveredMode === key;
              const isCurrent = (key === 'classic' && currentMode === null) || currentMode === key;
              const modeColor = getModeColor(key);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleModeSelect(key)}
                  onMouseEnter={() => setHoveredMode(key)}
                  onMouseLeave={() => setHoveredMode(null)}
                  className="relative w-full text-left rounded-2xl p-4 cursor-pointer group overflow-hidden"
                  style={{
                    background: isDarkMode
                      ? isHovered
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(255,255,255,0.02)'
                      : isHovered
                        ? 'rgba(255,255,255,0.95)'
                        : 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: isHovered
                      ? `1px solid ${modeColor}40`
                      : `1px solid ${isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                    boxShadow: isHovered
                      ? `0 8px 32px ${modeColor}15, inset 0 1px 0 ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)'}`
                      : `0 2px 8px rgba(0,0,0,${isDarkMode ? '0.2' : '0.03'})`,
                    transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  {/* Hover accent line - left edge */}
                  <div
                    className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full transition-all duration-300"
                    style={{
                      background: modeColor,
                      opacity: isHovered ? 1 : 0,
                      transform: isHovered ? 'scaleY(1)' : 'scaleY(0.3)',
                    }}
                  />

                  <div className="flex items-center gap-4">
                    {/* Icon - Industrial exposed style */}
                    <div
                      className="relative w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-400"
                      style={{
                        background: isHovered
                          ? `linear-gradient(135deg, ${modeColor}20, ${modeColor}08)`
                          : isDarkMode
                            ? 'rgba(255,255,255,0.04)'
                            : 'rgba(0,0,0,0.03)',
                        border: `1px solid ${isHovered ? `${modeColor}30` : isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                      }}
                    >
                      {/* Technical corner indicator */}
                      <div
                        className="absolute -top-px -right-px w-2 h-2 rounded-br transition-all duration-300"
                        style={{
                          background: isHovered ? modeColor : 'transparent',
                          clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
                        }}
                      />
                      <span
                        style={{
                          color: isHovered ? modeColor : isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                          transition: 'color 0.3s ease',
                        }}
                      >
                        {key === 'classic' ? <Phone className="w-5 h-5" /> : MODE_ICONS[key as VoxMode]}
                      </span>
                    </div>

                    {/* Mode Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{info.icon}</span>
                        <h3
                          className="text-[15px] font-semibold tracking-tight"
                          style={{
                            color: isDarkMode ? '#ffffff' : '#0a0a0a',
                            fontFamily: "'Outfit', sans-serif",
                          }}
                        >
                          {info.name}
                        </h3>
                        {isCurrent && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                            style={{
                              background: `${modeColor}15`,
                              color: modeColor,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                      <p
                        className="text-[13px] leading-relaxed"
                        style={{
                          color: isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                          fontFamily: "'Outfit', sans-serif",
                        }}
                      >
                        {info.tagline}
                      </p>
                    </div>

                    {/* Arrow - Minimal industrial */}
                    <ChevronRight
                      className="w-4 h-4 flex-shrink-0 transition-all duration-300"
                      style={{
                        transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
                        opacity: isHovered ? 0.8 : 0.3,
                        color: isHovered ? modeColor : isDarkMode ? '#ffffff' : '#000000',
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side - Details Panel with glassmorphism */}
        <div className="flex-1 overflow-hidden">
          {activeModeInfo ? (
            <div
              className="h-full rounded-2xl overflow-y-auto vox-custom-scrollbar"
              style={{
                background: isDarkMode
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                boxShadow: isDarkMode
                  ? `0 0 60px ${activeColor}08, inset 0 1px 0 rgba(255,255,255,0.03)`
                  : '0 8px 40px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)',
              }}
            >
              <div className="p-6 h-full flex flex-col">
                {/* Header with large icon */}
                <div className="flex flex-col md:flex-row md:items-start gap-5 mb-6">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${activeColor}15, ${activeColor}05)`,
                      border: `1px solid ${activeColor}20`,
                    }}
                  >
                    {/* Corner accent */}
                    <div
                      className="absolute top-0 left-0 w-4 h-4"
                      style={{
                        background: activeColor,
                        clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                        opacity: 0.6,
                      }}
                    />
                    <span className="text-5xl">{activeModeInfo.icon}</span>
                  </div>
                  <div className="flex-1">
                    <h2
                      className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight"
                      style={{
                        color: activeColor,
                        fontFamily: "'Outfit', sans-serif",
                      }}
                    >
                      {activeModeInfo.name}
                    </h2>
                    <p
                      className="text-sm mb-3"
                      style={{
                        color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                        fontFamily: "'Outfit', sans-serif",
                      }}
                    >
                      {activeModeInfo.tagline}
                    </p>
                    <p
                      className="text-sm leading-relaxed"
                      style={{
                        color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)',
                        fontFamily: "'Outfit', sans-serif",
                        maxHeight: '4.5em',
                        overflow: 'hidden',
                      }}
                    >
                      {activeModeInfo.description}
                    </p>
                  </div>
                </div>

                {/* Workflow Steps - Industrial numbered list */}
                <div className="mb-6 flex-1 min-h-0 overflow-hidden">
                  <h3
                    className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-4 flex items-center gap-2"
                    style={{
                      color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <span
                      className="w-4 h-[1px]"
                      style={{ background: activeColor }}
                    />
                    Workflow
                  </h3>
                  <div className="space-y-2 overflow-y-auto max-h-[200px] vox-custom-scrollbar pr-2">
                    {activeModeInfo.workflow.map((step, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-xl transition-all duration-200"
                        style={{
                          background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                          style={{
                            background: `${activeColor}12`,
                            color: activeColor,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {index + 1}
                        </div>
                        <p
                          className="text-sm pt-0.5"
                          style={{
                            color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                            fontFamily: "'Outfit', sans-serif",
                          }}
                        >
                          {step}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Features & Best For - Two column grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
                  {/* Features */}
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <h4
                      className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-3"
                      style={{
                        color: activeColor,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      Features
                    </h4>
                    <div className="space-y-2">
                      {activeModeInfo.features.slice(0, 4).map((feature, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-[13px]"
                          style={{
                            color: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
                            fontFamily: "'Outfit', sans-serif",
                          }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: activeColor }}
                          />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Best For */}
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <h4
                      className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-3"
                      style={{
                        color: activeColor,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      Best For
                    </h4>
                    <div className="space-y-2">
                      {activeModeInfo.bestFor.slice(0, 4).map((use, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-[13px]"
                          style={{
                            color: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
                            fontFamily: "'Outfit', sans-serif",
                          }}
                        >
                          <span style={{ color: activeColor }}>→</span>
                          {use}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Launch Button - Bold industrial */}
                {hoveredMode && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => handleModeSelect(hoveredMode)}
                      className="px-8 py-4 rounded-xl font-semibold text-white text-sm flex items-center gap-3 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: `linear-gradient(135deg, ${activeColor}, ${activeColor}dd)`,
                        boxShadow: `0 8px 32px ${activeColor}35`,
                        fontFamily: "'Outfit', sans-serif",
                      }}
                    >
                      <span>Launch {activeModeInfo.name}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Empty State - Minimal industrial */
            <div
              className="h-full rounded-2xl flex items-center justify-center"
              style={{
                background: isDarkMode
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
              }}
            >
              <div className="text-center p-8">
                <div
                  className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                  style={{
                    background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                  }}
                >
                  <Waves
                    className="w-8 h-8"
                    style={{ color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }}
                  />
                </div>
                <h3
                  className="text-lg font-semibold mb-2"
                  style={{
                    color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  Select a Mode
                </h3>
                <p
                  className="text-sm"
                  style={{
                    color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  Hover to preview details
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer - Minimal with version info */}
      <footer
        className="relative z-10 px-6 py-3 flex-shrink-0 flex items-center justify-between"
        style={{
          borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        }}
      >
        <p
          className="text-[10px] tracking-wider"
          style={{
            color: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: 'uppercase',
          }}
        >
          Click to launch
        </p>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200"
          style={{
            color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          Cancel
        </button>
      </footer>

      {/* CSS Animations */}
      <style>{`
        @keyframes vox-eq-bar {
          0% { transform: scaleY(0.5); }
          100% { transform: scaleY(1); }
        }

        .vox-custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .vox-custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .vox-custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          border-radius: 2px;
        }
        .vox-custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
        }
      `}</style>

      {/* Voxer Settings Modal */}
      <VoxerSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default VoxModeSelector;
