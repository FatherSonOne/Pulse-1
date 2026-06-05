// Permission Request Modal — Coral Cockpit pass
// DESIGN.md-faithful: tinted-neutral surfaces (no glassmorphism, no zinc),
// JetBrains Mono labels, coral reserved as the single signal (primary CTA,
// active progress, required badge, focus ring). Per-permission rainbow
// removed — the icon glyph carries differentiation, not color.
// Retains: ARIA + focus trap, denied-state recovery, array-driven steps.
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

// ─── Token style objects (consume --pulse-* per DESIGN.md, theme-aware) ─────────

const cardStyle: React.CSSProperties = {
  background: 'var(--pulse-surface)',
  border: '1px solid var(--pulse-border)',
  // Modal-grade elevation (DESIGN.md §4). Glass only reads in dark, where
  // --pulse-surface is translucent; light surface is opaque paper.
  boxShadow: '0 24px 48px -12px rgba(0,0,0,0.22)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
};

const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--pulse-font-mono)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const iconTileStyle: React.CSSProperties = {
  background: 'var(--pulse-canvas-soft)',
  border: '1px solid var(--pulse-border)',
};

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

// ─── Status chip (granted / skipped) — status vocabulary, never coral ──────────

const StatusChip: React.FC<{ name: string; title: string; granted: boolean; size?: 'sm' | 'md' }> = ({
  name, title, granted, size = 'sm',
}) => {
  const dims = size === 'md' ? 'px-3 py-1.5 text-sm gap-2' : 'px-2 py-1 text-xs gap-1.5';
  const iconSize = size === 'md' ? 12 : 10;
  const style: React.CSSProperties = granted
    ? {
        background: 'var(--pulse-tone-positive-soft)',
        color: 'var(--pulse-tone-positive)',
        border: '1px solid transparent',
      }
    : {
        background: 'var(--pulse-canvas-soft)',
        color: 'var(--pulse-ink-3)',
        border: '1px solid var(--pulse-border)',
        textDecoration: 'line-through',
      };
  return (
    <div className={`flex items-center rounded-full ${dims}`} style={style}>
      <span className="flex items-center">{permIcon(name, iconSize)}</span>
      <span>{title}</span>
      {granted ? <Check size={iconSize} /> : <Minus size={iconSize} />}
    </div>
  );
};

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
  const deniedBlockRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
  // Some steps can't surface an OS dialog on the current platform (e.g. the web
  // Contact Picker is Chrome-Android only). Showing them renders a dead "Allow"
  // button that does nothing, so we both hide them here AND auto-mark them
  // completed below — otherwise the hook's getPermissionsToRequest keeps them
  // pending and re-opens this modal on every launch.
  const canRequestOnThisPlatform = useCallback((name: PermissionName): boolean => {
    if (name === 'contacts') {
      return isNativePlatform || 'contacts' in navigator;
    }
    return true;
  }, [isNativePlatform]);

  const permissionsToShow = useMemo(
    () => ALL_PERMISSIONS.filter(
      p => !completedPermissions.has(p.name) && canRequestOnThisPlatform(p.name),
    ),
    [completedPermissions, canRequestOnThisPlatform],
  );

  // Auto-resolve platform-incapable steps so they don't keep the modal returning.
  useEffect(() => {
    ALL_PERMISSIONS.forEach((p) => {
      if (!canRequestOnThisPlatform(p.name) && !completedPermissions.has(p.name)) {
        markPermissionCompleted(p.name);
      }
    });
  }, [canRequestOnThisPlatform, completedPermissions, markPermissionCompleted]);

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

  // ── Skip handler (no OS dialog) ──────────────────────────────────────────
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
  // Single guarded path so the two triggers (all steps done / nothing to ask)
  // can't double-fire markSetupComplete + onComplete, and so a pending
  // onComplete timer is cleared if the modal unmounts first.
  useEffect(() => {
    if (completedRef.current) return;
    if (!allComplete && permissionsToShow.length !== 0) return;
    completedRef.current = true;
    const recapDelay = permissionsToShow.length === 0 ? 0 : 800;
    markSetupComplete().then(() => {
      completeTimerRef.current = setTimeout(onComplete, recapDelay);
    });
  }, [allComplete, permissionsToShow.length, markSetupComplete, onComplete]);

  // Clear a pending completion timer only on unmount (not on benign re-renders).
  useEffect(() => () => {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
  }, []);

  // Move focus into the denied-recovery block when it appears, so keyboard / SR
  // users land on the actionable controls instead of the now-hidden Allow button.
  useEffect(() => {
    if (deniedInStep) {
      deniedBlockRef.current?.querySelector<HTMLElement>('button')?.focus();
    }
  }, [deniedInStep]);

  if (permissionsToShow.length === 0) return null;

  // Shared surface card — solid paper (light) / translucent (dark), no glass tells.
  const cardCls = 'w-full max-w-md rounded-[20px] max-h-[90dvh] overflow-y-auto';

  const overlayClickHandler = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onSkip?.();
  };

  // ─── Completion screen ──────────────────────────────────────────────────
  if (allComplete) {
    return (
      <div
        className="pulse-modal-scrim fixed inset-0 z-[100] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="perm-complete-title"
      >
        <div className={`${cardCls} p-8 text-center animate-perm-enter`} style={cardStyle}>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'var(--pulse-rose-soft)', border: '1px solid var(--pulse-rose-soft)' }}
          >
            <ShieldCheck size={40} style={{ color: 'var(--pulse-rose)' }} />
          </div>

          <h2
            id="perm-complete-title"
            className="text-2xl font-semibold mb-3"
            style={{ color: 'var(--pulse-ink)', letterSpacing: '-0.025em' }}
          >
            You're all set
          </h2>
          <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--pulse-ink-2)' }}>
            Pulse is ready. You can change permissions anytime in Settings.
          </p>

          {/* Granted / skipped status recap */}
          <div className="flex flex-wrap justify-center gap-3">
            {permissionsToShow.map((perm) => (
              <StatusChip
                key={perm.name}
                name={perm.name}
                title={perm.title}
                granted={!!permissions[perm.name]?.granted}
                size="md"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Step wizard ─────────────────────────────────────────────────────────
  const totalSteps = permissionsToShow.length;

  return (
    <div
      className="pulse-modal-scrim fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={overlayClickHandler}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="perm-modal-title"
        className={`${cardCls} overflow-hidden animate-perm-enter`}
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar: mono title + step counter */}
        <div className="px-6 pt-6 flex items-center justify-between">
          <span className="text-[11px] font-medium" style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>
            Set Up Pulse
          </span>
          <span
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{
              fontFamily: 'var(--pulse-font-mono)',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--pulse-ink-2)',
              background: 'var(--pulse-canvas-soft)',
              border: '1px solid var(--pulse-border)',
            }}
          >
            {currentStep + 1} / {totalSteps}
          </span>
        </div>

        {/* Segmented progress — coral is the only fill (signal) */}
        <div className="px-6 pt-4">
          <div className="flex gap-1.5">
            {permissionsToShow.map((_, i) => {
              const done   = i < currentStep;
              const active = i === currentStep;
              return (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${active ? 'animate-pulse' : ''}`}
                  style={{
                    background: done || active ? 'var(--pulse-rose)' : 'var(--pulse-border)',
                    opacity: active ? 0.7 : 1,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Step content — key change triggers perm-step-enter animation */}
        {currentPermission && (
          <div key={stepKey} className="p-6 perm-step-enter">

            {/* Hero icon — neutral tile, glyph carries the differentiation */}
            <div className="flex justify-center mb-5">
              <div
                className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center"
                style={iconTileStyle}
              >
                <span style={{ color: 'var(--pulse-ink-2)' }}>
                  {permIcon(currentPermission.name, 30)}
                </span>
              </div>
            </div>

            {/* Title + Required badge */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3
                id="perm-modal-title"
                className="text-xl font-semibold"
                style={{ color: 'var(--pulse-ink)', letterSpacing: '-0.02em' }}
              >
                {currentPermission.title}
              </h3>
              {currentPermission.required ? (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    ...monoLabel,
                    color: 'var(--pulse-rose-text)',
                    background: 'var(--pulse-rose-soft)',
                  }}
                >
                  Required
                </span>
              ) : (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    ...monoLabel,
                    color: 'var(--pulse-ink-3)',
                    background: 'var(--pulse-canvas-soft)',
                    border: '1px solid var(--pulse-border)',
                  }}
                >
                  Optional
                </span>
              )}
            </div>

            <p
              className="text-sm text-center leading-relaxed mb-6 mx-auto"
              style={{ color: 'var(--pulse-ink-2)', maxWidth: '34ch' }}
            >
              {currentPermission.description}
            </p>

            {/* Denied recovery block — overdue status vocabulary */}
            {deniedInStep && (
              <div
                ref={deniedBlockRef}
                className="rounded-xl p-3 mb-5"
                style={{
                  background: 'var(--pulse-tone-overdue-soft)',
                  border: '1px solid var(--pulse-tone-overdue-soft)',
                }}
              >
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--pulse-tone-overdue)' }}>
                  Permission blocked
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--pulse-ink-2)' }}>
                  {currentPermission.title} was denied. Open your device Settings to enable it.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {isNativePlatform && (
                    <button
                      type="button"
                      onClick={handleOpenSettings}
                      className="perm-focus flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ background: 'var(--pulse-tone-overdue-soft)', color: 'var(--pulse-tone-overdue)' }}
                    >
                      <Settings size={12} />
                      Open Settings
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={advance}
                    className="perm-focus px-3 py-1.5 rounded-lg text-xs transition-colors"
                    style={{ color: 'var(--pulse-ink-3)' }}
                  >
                    Continue anyway
                  </button>
                </div>
              </div>
            )}

            {/* Previously handled permissions */}
            {currentStep > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {permissionsToShow.slice(0, currentStep).map(perm => (
                  <StatusChip
                    key={perm.name}
                    name={perm.name}
                    title={perm.title}
                    granted={!!permissions[perm.name]?.granted}
                  />
                ))}
              </div>
            )}

            {/* Screen-reader status — announces the requesting / blocked states */}
            <p className="sr-only" role="status" aria-live="polite">
              {isRequesting
                ? `Requesting ${currentPermission.title} permission…`
                : deniedInStep
                  ? `${currentPermission.title} permission was blocked. Open device settings to enable it.`
                  : ''}
            </p>

            {/* Action buttons — stacked on mobile, row on sm+ */}
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              {!currentPermission.required && !deniedInStep && (
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={isRequesting}
                  className="perm-focus flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-150 disabled:opacity-50"
                  style={{
                    background: 'transparent',
                    color: 'var(--pulse-ink-2)',
                    border: '1px solid var(--pulse-border)',
                  }}
                >
                  Skip
                </button>
              )}
              {!deniedInStep && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  disabled={isRequesting}
                  className="perm-focus flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98]"
                  style={{ background: 'var(--pulse-rose)', color: '#ffffff' }}
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
              className="perm-focus w-full text-center text-xs rounded-lg py-1 transition-colors"
              style={{ color: 'var(--pulse-ink-3)' }}
            >
              Skip for now. Set these later in Settings.
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionRequestModal;
