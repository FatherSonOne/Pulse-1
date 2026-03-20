// Permission Request Modal — P0 Redesign
// Per-permission accent system, glassmorphism, ARIA + focus trap,
// denied-state recovery, Location step, Lucide icons, step animations.
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { usePermissions, PermissionName } from '../hooks/usePermissions';
import {
  Mic, Video, Bell, BookUser, MapPin,
  Check, Loader2, Minus, ShieldCheck, Settings,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PermissionItem {
  name: PermissionName;
  title: string;
  description: string;
  required: boolean;
}

interface AccentConfig {
  /** Full gradient class string for header strip and CTA button */
  gradient: string;
  /** Icon container background */
  iconBg: string;
  /** Icon container border */
  iconBorder: string;
  /** Icon / text color */
  iconText: string;
  /** Granted chip background */
  chipBg: string;
  /** Granted chip text */
  chipText: string;
  /** Active progress segment color */
  progressActive: string;
  /** "Required" badge classes */
  requiredBadge: string;
}

// ─── Per-Permission Accent Map ────────────────────────────────────────────────
// Full Tailwind class strings are kept as literals so the content scanner
// includes them — no dynamic class construction that could be purged.

const ACCENT_MAP: Record<string, AccentConfig> = {
  microphone: {
    gradient:      'bg-gradient-to-r from-rose-500 to-pink-600',
    iconBg:        'bg-rose-500/15',
    iconBorder:    'border-rose-500/30',
    iconText:      'text-rose-400',
    chipBg:        'bg-rose-500/15',
    chipText:      'text-rose-400',
    progressActive:'bg-rose-400',
    requiredBadge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  },
  camera: {
    gradient:      'bg-gradient-to-r from-violet-500 to-purple-600',
    iconBg:        'bg-violet-500/15',
    iconBorder:    'border-violet-500/30',
    iconText:      'text-violet-400',
    chipBg:        'bg-violet-500/15',
    chipText:      'text-violet-400',
    progressActive:'bg-violet-400',
    requiredBadge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  },
  notifications: {
    gradient:      'bg-gradient-to-r from-amber-500 to-orange-500',
    iconBg:        'bg-amber-500/15',
    iconBorder:    'border-amber-500/30',
    iconText:      'text-amber-400',
    chipBg:        'bg-amber-500/15',
    chipText:      'text-amber-400',
    progressActive:'bg-amber-400',
    requiredBadge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  },
  contacts: {
    gradient:      'bg-gradient-to-r from-sky-500 to-blue-600',
    iconBg:        'bg-sky-500/15',
    iconBorder:    'border-sky-500/30',
    iconText:      'text-sky-400',
    chipBg:        'bg-sky-500/15',
    chipText:      'text-sky-400',
    progressActive:'bg-sky-400',
    requiredBadge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  },
  location: {
    gradient:      'bg-gradient-to-r from-teal-500 to-emerald-600',
    iconBg:        'bg-teal-500/15',
    iconBorder:    'border-teal-500/30',
    iconText:      'text-teal-400',
    chipBg:        'bg-teal-500/15',
    chipText:      'text-teal-400',
    progressActive:'bg-teal-400',
    requiredBadge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  },
};

const DEFAULT_ACCENT: AccentConfig = {
  gradient:      'bg-gradient-to-r from-zinc-600 to-zinc-700',
  iconBg:        'bg-zinc-500/15',
  iconBorder:    'border-zinc-500/30',
  iconText:      'text-zinc-400',
  chipBg:        'bg-zinc-500/15',
  chipText:      'text-zinc-400',
  progressActive:'bg-zinc-400',
  requiredBadge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
};

const getAccent = (name: string): AccentConfig => ACCENT_MAP[name] ?? DEFAULT_ACCENT;

// ─── Icon Registry ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, (size: number) => React.ReactNode> = {
  microphone:    (s) => <Mic size={s} />,
  camera:        (s) => <Video size={s} />,
  notifications: (s) => <Bell size={s} />,
  contacts:      (s) => <BookUser size={s} />,
  location:      (s) => <MapPin size={s} />,
};

const permIcon = (name: string, size: number): React.ReactNode =>
  ICON_MAP[name]?.(size) ?? <ShieldCheck size={size} />;

// ─── Permission Definitions ───────────────────────────────────────────────────
// Array-driven: adding entries here auto-adjusts step count.

const ALL_PERMISSIONS: PermissionItem[] = [
  {
    name: 'microphone',
    title: 'Microphone',
    description: 'Required for Vox voice messaging, voice commands, and voice notes.',
    required: true,
  },
  {
    name: 'camera',
    title: 'Camera',
    description: 'Used for video calls in Pulse Meetings and video messages.',
    required: false,
  },
  {
    name: 'notifications',
    title: 'Notifications',
    description: 'Get notified about new messages, reminders, and important updates.',
    required: true,
  },
  {
    name: 'contacts',
    title: 'Contacts',
    description: 'Find friends on Pulse and sync your address book.',
    required: false,
  },
  {
    name: 'location',
    title: 'Location',
    description: 'Find nearby Pulse users and enable location-based reminders.',
    required: false,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface PermissionRequestModalProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const PermissionRequestModal: React.FC<PermissionRequestModalProps> = ({ onComplete, onSkip }) => {
  const {
    permissions,
    isRequesting,
    requestPermission,
    markPermissionCompleted,
    completedPermissions,
    markSetupComplete,
    isNativePlatform,
  } = usePermissions();

  const [currentStep, setCurrentStep]   = useState(0);
  const [deniedInStep, setDeniedInStep] = useState(false);
  const [stepKey,      setStepKey]      = useState(0); // key-change triggers enter animation
  const dialogRef = useRef<HTMLDivElement>(null);

  // ── Focus trap ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!nodes.length) return;
      const first = nodes[0];
      const last  = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    (el.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [currentStep]);

  // ── Filter permissions that still need handling ──────────────────────────
  const permissionsToShow = useMemo(
    () => ALL_PERMISSIONS.filter(p => !completedPermissions.has(p.name)),
    [completedPermissions],
  );

  const currentPermission = permissionsToShow[currentStep];
  const allComplete       = currentStep >= permissionsToShow.length;

  const advance = useCallback(() => {
    setDeniedInStep(false);
    setStepKey(k => k + 1);
    setCurrentStep(prev => prev + 1);
  }, []);

  // ── Request handler ──────────────────────────────────────────────────────
  const handleRequestPermission = async () => {
    if (!currentPermission) return;
    setDeniedInStep(false);
    const result = await requestPermission(currentPermission.name);
    if (result.denied) {
      setDeniedInStep(true);
      return; // Stay on step — show recovery block
    }
    advance();
  };

  // ── Skip handler (P0.6 fix — no OS dialog) ──────────────────────────────
  const handleSkip = async () => {
    if (!currentPermission) return;
    await markPermissionCompleted(currentPermission.name);
    advance();
  };

  const handleOpenSettings = () => {
    if (isNativePlatform) {
      console.log('[Permissions] Open device settings');
      // Native: import { App } from '@capacitor/app'; App.openUrl({ url: 'app-settings:' });
    }
  };

  // ── Completion ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (allComplete) {
      markSetupComplete().then(() => setTimeout(onComplete, 800));
    }
  }, [allComplete, onComplete, markSetupComplete]);

  useEffect(() => {
    if (permissionsToShow.length === 0) {
      markSetupComplete().then(onComplete);
    }
  }, [permissionsToShow.length, markSetupComplete, onComplete]);

  if (permissionsToShow.length === 0) return null;

  // ── Glass card class shared across both render paths ─────────────────────
  const cardCls = [
    'bg-white/90 dark:bg-zinc-900/85',
    'backdrop-blur-xl',
    'border border-black/[0.06] dark:border-white/[0.07]',
    'shadow-2xl shadow-black/20 dark:shadow-black/50',
    'rounded-2xl w-full max-w-md',
    'max-h-[90dvh] overflow-y-auto',
  ].join(' ');

  const overlayClickHandler = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onSkip?.();
  };

  // ─── Completion screen ──────────────────────────────────────────────────
  if (allComplete) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="perm-complete-title"
      >
        <div className={`${cardCls} p-8 text-center animate-perm-enter`}>
          <div className="w-20 h-20 bg-rose-500/15 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={40} className="text-rose-400" />
          </div>

          <h2
            id="perm-complete-title"
            className="text-2xl font-bold text-zinc-900 dark:text-white mb-3"
          >
            You're All Set!
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6">
            Pulse is ready to use. You can always change permissions in Settings.
          </p>

          {/* Staggered chip reveal — chips are from permissionsToShow not ALL_PERMISSIONS */}
          <div className="flex flex-wrap justify-center gap-3">
            {permissionsToShow.map((perm, i) => {
              const a       = getAccent(perm.name);
              const granted = permissions[perm.name]?.granted;
              return (
                <div
                  key={perm.name}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-all ${
                    granted
                      ? `${a.chipBg} ${a.chipText} ${a.iconBorder}`
                      : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700/50 line-through'
                  }`}

                >
                  <span className={granted ? a.iconText : 'text-zinc-400 dark:text-zinc-600'}>
                    {permIcon(perm.name, 12)}
                  </span>
                  <span>{perm.title}</span>
                  {granted && <Check size={12} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── Step wizard ─────────────────────────────────────────────────────────
  const accent     = getAccent(currentPermission?.name ?? '');
  const totalSteps = permissionsToShow.length;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      onClick={overlayClickHandler}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="perm-modal-title"
        className={`${cardCls} overflow-hidden animate-perm-enter`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Per-permission accent strip */}
        <div className={`h-1 w-full ${accent.gradient}`} />

        {/* Top bar: title + step counter */}
        <div className="px-6 pt-5 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Set Up Pulse
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 px-2 py-0.5 rounded-full tabular-nums">
            {currentStep + 1} / {totalSteps}
          </span>
        </div>

        {/* Segmented progress dots */}
        <div className="px-6 pt-3">
          <div className="flex gap-1.5">
            {permissionsToShow.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i < currentStep
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500'
                    : i === currentStep
                    ? `${accent.progressActive} animate-pulse`
                    : 'bg-zinc-200 dark:bg-zinc-700/60'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step content — key change triggers perm-step-enter animation */}
        {currentPermission && (
          <div key={stepKey} className="p-6 perm-step-enter">

            {/* Hero icon — 72×72 with per-permission accent gradient bg */}
            <div className="flex justify-center mb-5">
              <div
                className={`w-[72px] h-[72px] rounded-2xl flex items-center justify-center border ${accent.iconBg} ${accent.iconBorder}`}
              >
                <span className={accent.iconText}>
                  {permIcon(currentPermission.name, 30)}
                </span>
              </div>
            </div>

            {/* Title + Required badge */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3
                id="perm-modal-title"
                className="text-xl font-bold text-zinc-900 dark:text-white"
              >
                {currentPermission.title}
              </h3>
              {currentPermission.required && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${accent.requiredBadge}`}>
                  Required
                </span>
              )}
            </div>

            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center leading-relaxed mb-6">
              {currentPermission.description}
            </p>

            {/* Denied recovery block */}
            {deniedInStep && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-5">
                <p className="text-red-400 text-sm font-semibold mb-1">Permission blocked</p>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-3">
                  {currentPermission.title} was denied. Open your device Settings to enable it.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {isNativePlatform && (
                    <button
                      type="button"
                      onClick={handleOpenSettings}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium transition-colors"
                    >
                      <Settings size={12} />
                      Open Settings
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={advance}
                    className="px-3 py-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-xs transition-colors"
                  >
                    Continue anyway
                  </button>
                </div>
              </div>
            )}

            {/* Previous permissions status chips */}
            {currentStep > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {permissionsToShow.slice(0, currentStep).map(perm => {
                  const a       = getAccent(perm.name);
                  const granted = permissions[perm.name]?.granted;
                  return (
                    <div
                      key={perm.name}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${
                        granted
                          ? `${a.chipBg} ${a.chipText} ${a.iconBorder}`
                          : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700/50 line-through'
                      }`}
                    >
                      <span className={granted ? a.iconText : 'text-zinc-400 dark:text-zinc-600'}>
                        {permIcon(perm.name, 10)}
                      </span>
                      <span>{perm.title}</span>
                      {granted ? <Check size={10} /> : <Minus size={10} />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action buttons — stacked on mobile, row on sm+ */}
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              {!currentPermission.required && !deniedInStep && (
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={isRequesting}
                  className="flex-1 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700/60 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-600 font-medium transition-all duration-150 disabled:opacity-50"
                >
                  Skip
                </button>
              )}
              {!deniedInStep && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  disabled={isRequesting}
                  className={`flex-1 py-3 px-4 rounded-xl text-white font-medium transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] shadow-md ${accent.gradient}`}
                >
                  {isRequesting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Requesting…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      Allow {currentPermission.title}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Skip-all link — only at step 0 */}
        {onSkip && currentStep === 0 && (
          <div className="px-6 pb-5">
            <button
              type="button"
              onClick={onSkip}
              className="w-full text-center text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              Skip for now — set these later in Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionRequestModal;
