/**
 * FeatureSettingsPanel — Slide-out "Message Settings" panel.
 *
 * Repurposed 2026-06-01 from a generic feature-flag panel into a message-scoped
 * settings surface (see docs/MESSAGE_SETTINGS_HANDOFF_2026-06-01.md). It now
 * surfaces only the genuinely message-scoped, still-LIVE flags (curated locally,
 * NOT the global FEATURE_CATEGORIES — see MESSAGE_SETTINGS_CATEGORIES below).
 * Audio device selection and additional message toggles land in follow-up steps.
 * The component/export name is kept so the MessagesEndModals render site and the
 * header button wiring stay intact.
 *
 * Shell features (preserved): search/filter, bulk enable/disable per category,
 * reset-to-defaults with in-panel confirmation, advanced-mode master toggle,
 * focus trap, scroll lock, full keyboard a11y.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, RotateCcw, Search, Sliders, X } from 'lucide-react';
import {
  useFeatures,
  FEATURE_NAMES,
  type FeatureFlags,
} from '../../contexts/FeatureContext';
import { useAudioInputDevice } from '../../hooks/useAudioInputDevice';
import { useMessageSettings } from '../../hooks/useMessageSettings';

interface FeatureSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Panel-local curation (2026-06-01 — Message Settings repurpose).
 *
 * This panel deliberately does NOT iterate the global `FEATURE_CATEGORIES`
 * any more. That list is shared with the global Features Labs surface
 * (`FeaturesLabsSettings.tsx`) and still carries flags that are vestigial on
 * the Pulse-DM path (`voiceInput`/`aiComposer`/`toneAnalysis` gate the retired
 * legacy composer; `draftManager` has no consumer; `smartReplies` is Relay-only).
 * Surfacing those here would be dead/confusing toggles in a "Message Settings"
 * context. Instead we curate the genuinely message-scoped, still-LIVE flags.
 * The flag *definitions* are untouched — they remain in Features Labs.
 */
const MESSAGE_SETTINGS_CATEGORIES = {
  message: {
    name: 'Message Features',
    description: 'Toggle features that show up in the message stream.',
    features: ['moodBadges', 'scheduledMessages'] as (keyof FeatureFlags)[],
  },
} as const;

type CategoryId = keyof typeof MESSAGE_SETTINGS_CATEGORIES;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DEFAULT_EXPANDED: ReadonlySet<string> = new Set(['message']);

function useIsDark(active: boolean) {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const el = document.documentElement;
    setDark(el.classList.contains('dark'));
    const observer = new MutationObserver(() => setDark(el.classList.contains('dark')));
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [active]);
  return dark;
}

export const FeatureSettingsPanel: React.FC<FeatureSettingsPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { t: tr } = useTranslation();
  const {
    features,
    toggleFeature,
    resetFeatures,
    advancedMode,
    setAdvancedMode,
  } = useFeatures();

  const isDark = useIsDark(isOpen);

  const { settings: msgSettings, setSetting: setMsgSetting } = useMessageSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(DEFAULT_EXPANDED),
  );
  const [confirmingReset, setConfirmingReset] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const t = useMemo(() => {
    if (isDark) {
      return {
        panelBg: '#000000',
        panelShadow: '-4px 0 32px rgba(0, 0, 0, 0.6)',
        headerBg: 'transparent',
        headerBorder: 'rgba(255, 255, 255, 0.06)',
        textPrimary: '#fafafa',
        textSecondary: '#a1a1aa',
        textMuted: '#71717a',
        surface: 'rgba(255, 255, 255, 0.04)',
        surfaceBorder: 'rgba(255, 255, 255, 0.08)',
        surfaceHover: 'rgba(255, 255, 255, 0.06)',
        inputBg: 'rgba(255, 255, 255, 0.05)',
        inputBorder: 'rgba(255, 255, 255, 0.08)',
        inputText: '#fafafa',
        inputPlaceholder: '#71717a',
        categoryBg: 'rgba(255, 255, 255, 0.03)',
        categoryBorder: 'rgba(255, 255, 255, 0.06)',
        categoryText: '#fafafa',
        featureBg: 'rgba(255, 255, 255, 0.03)',
        featureBorder: 'rgba(255, 255, 255, 0.07)',
        featureText: '#e4e4e7',
        toggleOff: '#3f3f46',
        toggleKnob: '#fafafa',
        footerBg: 'transparent',
        footerBorder: 'rgba(255, 255, 255, 0.06)',
        resetBtnBg: 'rgba(255, 255, 255, 0.04)',
        resetBtnBorder: 'rgba(244, 63, 94, 0.3)',
        resetConfirmBg: 'rgba(239, 68, 68, 0.12)',
        resetConfirmBorder: 'rgba(239, 68, 68, 0.4)',
        resetCancelBg: 'rgba(255, 255, 255, 0.04)',
        resetCancelBorder: 'rgba(255, 255, 255, 0.1)',
        resetCancelText: '#a1a1aa',
        enableBtnBg: 'rgba(255, 255, 255, 0.04)',
        enableBtnBorder: 'rgba(255, 255, 255, 0.08)',
        disableBtnBg: 'rgba(255, 255, 255, 0.04)',
        disableBtnBorder: 'rgba(255, 255, 255, 0.08)',
        disableBtnText: '#a1a1aa',
        emptyText: '#a1a1aa',
      };
    }
    return {
      panelBg: '#ffffff',
      panelShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
      headerBg: 'transparent',
      headerBorder: 'rgba(0, 0, 0, 0.08)',
      textPrimary: '#18181b',
      textSecondary: '#52525b',
      textMuted: '#71717a',
      surface: '#ffffff',
      surfaceBorder: 'rgba(0, 0, 0, 0.08)',
      surfaceHover: 'rgba(0, 0, 0, 0.03)',
      inputBg: '#ffffff',
      inputBorder: 'rgba(0, 0, 0, 0.08)',
      inputText: '#18181b',
      inputPlaceholder: '#a1a1aa',
      categoryBg: 'rgba(0, 0, 0, 0.02)',
      categoryBorder: 'rgba(0, 0, 0, 0.06)',
      categoryText: '#18181b',
      featureBg: '#ffffff',
      featureBorder: 'rgba(0, 0, 0, 0.1)',
      featureText: '#18181b',
      toggleOff: '#e4e4e7',
      toggleKnob: '#fafafa',
      footerBg: 'transparent',
      footerBorder: 'rgba(0, 0, 0, 0.1)',
      resetBtnBg: '#ffffff',
      resetBtnBorder: 'rgba(244, 63, 94, 0.3)',
      resetConfirmBg: 'rgba(239, 68, 68, 0.08)',
      resetConfirmBorder: 'rgba(239, 68, 68, 0.35)',
      resetCancelBg: '#ffffff',
      resetCancelBorder: 'rgba(0, 0, 0, 0.1)',
      resetCancelText: '#52525b',
      enableBtnBg: 'rgba(0, 0, 0, 0.04)',
      enableBtnBorder: 'rgba(0, 0, 0, 0.08)',
      disableBtnBg: 'rgba(0, 0, 0, 0.04)',
      disableBtnBorder: 'rgba(0, 0, 0, 0.08)',
      disableBtnText: '#71717a',
      emptyText: '#71717a',
    };
  }, [isDark]);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }, []);

  const enableCategory = useCallback(
    (categoryId: string) => {
      const category = MESSAGE_SETTINGS_CATEGORIES[categoryId as CategoryId];
      if (!category) return;
      category.features.forEach((featureId) => {
        toggleFeature(featureId as keyof FeatureFlags, true);
      });
    },
    [toggleFeature],
  );

  const disableCategory = useCallback(
    (categoryId: string) => {
      const category = MESSAGE_SETTINGS_CATEGORIES[categoryId as CategoryId];
      if (!category) return;
      category.features.forEach((featureId) => {
        toggleFeature(featureId as keyof FeatureFlags, false);
      });
    },
    [toggleFeature],
  );

  const matchesSearch = useCallback(
    (featureId: keyof FeatureFlags) => {
      if (!searchQuery) return true;
      const name = (FEATURE_NAMES[featureId] || '').toLowerCase();
      return name.includes(searchQuery.toLowerCase());
    },
    [searchQuery],
  );

  // Render-pass derived data
  const totalMatches = useMemo(() => {
    if (!searchQuery) return null;
    let count = 0;
    for (const category of Object.values(MESSAGE_SETTINGS_CATEGORIES)) {
      for (const featureId of category.features) {
        if (matchesSearch(featureId as keyof FeatureFlags)) count++;
      }
    }
    return count;
  }, [matchesSearch, searchQuery]);

  // The Audio section is matched by its own keywords so search hides it when
  // irrelevant but still surfaces it for "mic"/"audio"/"device" queries.
  const audioMatchesSearch = useMemo(() => {
    if (!searchQuery) return true;
    return 'audio microphone mic input device speaker sound voice'.includes(
      searchQuery.toLowerCase(),
    );
  }, [searchQuery]);

  // --- Composing / behavior prefs (real, wired via useMessageSettings) ---
  const prefRows = useMemo<SettingRowSpec[]>(
    () => [
      {
        id: 'enterToSend',
        name: tr('messages.messageSettings.enterToSend', 'Press Enter to send'),
        description: tr(
          'messages.messageSettings.enterToSendDesc',
          'Enter sends; Shift+Enter starts a new line. Off: Cmd/Ctrl+Enter sends.',
        ),
        enabled: msgSettings.enterToSend,
        onToggle: () => setMsgSetting('enterToSend', !msgSettings.enterToSend),
      },
      {
        id: 'sendTypingIndicators',
        name: tr('messages.messageSettings.typingIndicators', 'Send typing indicators'),
        description: tr(
          'messages.messageSettings.typingIndicatorsDesc',
          'Let the other person see when you are typing.',
        ),
        enabled: msgSettings.sendTypingIndicators,
        onToggle: () =>
          setMsgSetting('sendTypingIndicators', !msgSettings.sendTypingIndicators),
      },
    ],
    [tr, msgSettings, setMsgSetting],
  );

  // --- Not-yet-wired (shown disabled with a "Soon" badge, never persisted) ---
  const comingSoonRows = useMemo<SettingRowSpec[]>(
    () => [
      {
        id: 'readReceipts',
        name: tr('messages.messageSettings.readReceipts', 'Read receipts'),
        description: tr(
          'messages.messageSettings.readReceiptsDesc',
          "Control whether others see when you've read their messages.",
        ),
        enabled: false,
        comingSoon: true,
      },
      {
        id: 'notifSound',
        name: tr('messages.messageSettings.notifSound', 'Notification sound'),
        description: tr(
          'messages.messageSettings.notifSoundDesc',
          'Play a sound when a new message arrives.',
        ),
        enabled: false,
        comingSoon: true,
      },
      {
        id: 'notifPreview',
        name: tr('messages.messageSettings.notifPreview', 'Message preview in notifications'),
        description: tr(
          'messages.messageSettings.notifPreviewDesc',
          'Show message text in notifications instead of just the sender.',
        ),
        enabled: false,
        comingSoon: true,
      },
    ],
    [tr],
  );

  const rowMatchesQuery = useCallback(
    (row: SettingRowSpec) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) || row.description.toLowerCase().includes(q)
      );
    },
    [searchQuery],
  );

  const visiblePrefRows = useMemo(
    () => prefRows.filter(rowMatchesQuery),
    [prefRows, rowMatchesQuery],
  );
  const visibleComingSoonRows = useMemo(
    () => comingSoonRows.filter(rowMatchesQuery),
    [comingSoonRows, rowMatchesQuery],
  );

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmingReset) {
          setConfirmingReset(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, confirmingReset]);

  // Scroll-lock the body while the panel is open.
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Focus trap: capture last-focused element, focus search input on open,
  // wrap Tab inside the panel, restore focus on close.
  useEffect(() => {
    if (!isOpen) return;

    lastFocusedRef.current =
      typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

    const focusFirst = () => {
      searchInputRef.current?.focus();
    };
    const id = window.setTimeout(focusFirst, 50);

    const onTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onTrap);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', onTrap);
      lastFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  const handleResetClick = useCallback(() => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    resetFeatures();
    setConfirmingReset(false);
  }, [confirmingReset, resetFeatures]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
              backdropFilter: 'blur(4px)',
            }}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feature-settings-title"
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(480px, 100vw)',
              background: t.panelBg,
              boxShadow: t.panelShadow,
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '24px',
                borderBottom: `1px solid ${t.headerBorder}`,
                background: t.headerBg,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <h2
                  id="feature-settings-title"
                  style={{
                    fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
                    fontSize: '11px',
                    fontWeight: 500,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: t.textSecondary || '#71717a',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Sliders size={12} style={{ color: t.textMuted }} aria-hidden="true" />
                  {tr('messages.messageSettings.title', 'Message Settings')}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    color: t.textSecondary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.color = '#f43f5e';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = t.textSecondary;
                  }}
                  aria-label={tr('messages.featureSettings.close', 'Close settings')}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '16px',
                    height: '16px',
                    color: t.textMuted,
                    pointerEvents: 'none',
                  }}
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={tr('messages.featureSettings.search', 'Search features...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 40px',
                    border: `1px solid ${t.inputBorder}`,
                    borderRadius: '12px',
                    fontSize: '14px',
                    background: t.inputBg,
                    color: t.inputText,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  aria-label={tr('messages.featureSettings.searchAriaLabel', 'Search features')}
                />
              </div>

              {/* Advanced Mode Toggle */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: t.surface,
                  borderRadius: '12px',
                  border: `1px solid ${t.inputBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: t.textPrimary }}>
                    {tr('messages.featureSettings.advancedMode', 'Advanced Mode')}
                  </div>
                  <div style={{ fontSize: '12px', color: t.textMuted }}>
                    {tr('messages.featureSettings.advancedModeDesc', 'Show all features and settings')}
                  </div>
                </div>
                <ToggleSwitch
                  checked={advancedMode}
                  onChange={() => setAdvancedMode(!advancedMode)}
                  ariaLabel={tr('messages.featureSettings.toggleAdvancedMode', 'Toggle advanced mode')}
                  isDark={isDark}
                  toggleOff={t.toggleOff}
                  toggleKnob={t.toggleKnob}
                  size="lg"
                />
              </div>
            </div>

            {/* Content */}
            <div
              className="feature-settings-scroll"
              style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}
            >
              {audioMatchesSearch && <AudioSection theme={t} />}

              {/* Composing / behavior preferences (wired) */}
              {visiblePrefRows.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <SectionHeading
                    label={tr('messages.messageSettings.composingHeading', 'Composing')}
                    color={t.textMuted}
                  />
                  {visiblePrefRows.map((row) => (
                    <SettingRow key={row.id} row={row} isDark={isDark} theme={t} />
                  ))}
                </div>
              )}

              {totalMatches === 0 &&
                !audioMatchesSearch &&
                visiblePrefRows.length === 0 &&
                visibleComingSoonRows.length === 0 && (
                  <div
                    role="status"
                    style={{
                      padding: '32px 16px',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: t.emptyText,
                    }}
                  >
                    {tr('messages.featureSettings.noResults', {
                      query: searchQuery,
                      defaultValue: 'No settings match “{{query}}”.',
                    })}
                  </div>
                )}

              {(Object.entries(MESSAGE_SETTINGS_CATEGORIES) as [string, typeof MESSAGE_SETTINGS_CATEGORIES[CategoryId]][]).map(
                ([categoryId, category]) => {
                  const filteredFeatures = category.features.filter((f) =>
                    matchesSearch(f as keyof FeatureFlags),
                  );
                  if (filteredFeatures.length === 0 && searchQuery) return null;

                  return (
                    <CategoryRow
                      key={categoryId}
                      categoryId={categoryId}
                      categoryName={category.name}
                      categoryDescription={category.description}
                      allFeatures={category.features as (keyof FeatureFlags)[]}
                      filteredFeatures={filteredFeatures as (keyof FeatureFlags)[]}
                      features={features}
                      isExpanded={expandedCategories.has(categoryId)}
                      isPriority={categoryId === 'priority'}
                      isDark={isDark}
                      theme={t}
                      onToggleCategory={toggleCategory}
                      onToggleFeature={toggleFeature}
                      onEnableCategory={enableCategory}
                      onDisableCategory={disableCategory}
                    />
                  );
                },
              )}

              {/* Not-yet-wired settings — visible but disabled with a "Soon" badge */}
              {visibleComingSoonRows.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <SectionHeading
                    label={tr('messages.messageSettings.comingSoonHeading', 'Coming soon')}
                    color={t.textMuted}
                  />
                  {visibleComingSoonRows.map((row) => (
                    <SettingRow key={row.id} row={row} isDark={isDark} theme={t} />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: `1px solid ${t.footerBorder}`,
                background: t.footerBg,
              }}
            >
              {!confirmingReset ? (
                <button
                  type="button"
                  onClick={handleResetClick}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: t.resetBtnBg,
                    border: `1px solid ${t.resetBtnBorder}`,
                    borderRadius: '12px',
                    color: '#f43f5e',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <RotateCcw size={16} />
                  {tr('messages.featureSettings.reset', 'Reset to Defaults')}
                </button>
              ) : (
                <div
                  role="alertdialog"
                  aria-label={tr('messages.featureSettings.resetConfirmTitle', 'Confirm reset')}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      color: t.textPrimary,
                      marginBottom: '10px',
                      lineHeight: 1.4,
                    }}
                  >
                    {tr(
                      'messages.featureSettings.resetConfirmBody',
                      "Reset all features to defaults? This can't be undone.",
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setConfirmingReset(false)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: t.resetCancelBg,
                        border: `1px solid ${t.resetCancelBorder}`,
                        borderRadius: '10px',
                        color: t.resetCancelText,
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {tr('messages.featureSettings.resetCancel', 'Cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetClick}
                      autoFocus
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: t.resetConfirmBg,
                        border: `1px solid ${t.resetConfirmBorder}`,
                        borderRadius: '10px',
                        color: '#ef4444',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {tr('messages.featureSettings.resetConfirm', 'Yes, reset')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/* ── Audio section (input device picker) ── */

interface AudioThemeShape {
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  surface: string;
  surfaceBorder: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  featureBg: string;
  featureBorder: string;
}

const AudioSection: React.FC<{ theme: AudioThemeShape }> = ({ theme: t }) => {
  const { t: tr } = useTranslation();
  const {
    supported,
    devices,
    selectedDeviceId,
    selectDevice,
    permissionState,
    requestPermission,
  } = useAudioInputDevice(true);

  // Before a permission grant the browser hides device labels, so we only
  // have generic "Microphone N" fallbacks — prompt the user to grant access.
  const labelsHidden =
    permissionState !== 'granted' &&
    devices.length > 0 &&
    devices.every((d) => /^Microphone \d+$/.test(d.label));

  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: t.textMuted,
          marginBottom: '10px',
        }}
      >
        {tr('messages.messageSettings.audioHeading', 'Audio')}
      </div>

      <div
        style={{
          padding: '14px',
          background: t.surface,
          border: `1px solid ${t.surfaceBorder}`,
          borderRadius: '12px',
        }}
      >
        <label
          htmlFor="msg-audio-input"
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 600,
            color: t.textPrimary,
            marginBottom: '2px',
          }}
        >
          {tr('messages.messageSettings.microphone', 'Microphone')}
        </label>
        <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '10px' }}>
          {tr(
            'messages.messageSettings.microphoneDesc',
            'Choose which input device records your voice messages.',
          )}
        </div>

        {supported ? (
          <select
            id="msg-audio-input"
            value={selectedDeviceId}
            onChange={(e) => selectDevice(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: `1px solid ${t.inputBorder}`,
              borderRadius: '10px',
              fontSize: '14px',
              background: t.inputBg,
              color: t.inputText,
              outline: 'none',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            <option value="">
              {tr('messages.messageSettings.systemDefault', 'System default')}
            </option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        ) : (
          <div style={{ fontSize: '13px', color: t.textMuted }}>
            {tr(
              'messages.messageSettings.deviceUnsupported',
              "This browser doesn't support microphone selection.",
            )}
          </div>
        )}

        {supported && labelsHidden && (
          <button
            type="button"
            onClick={() => void requestPermission()}
            style={{
              marginTop: '10px',
              width: '100%',
              padding: '9px',
              background: t.featureBg,
              border: `1px solid ${t.featureBorder}`,
              borderRadius: '10px',
              color: t.textSecondary,
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {tr(
              'messages.messageSettings.grantMic',
              'Allow microphone access to see device names',
            )}
          </button>
        )}

        {permissionState === 'denied' && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#f59e0b' }}>
            {tr(
              'messages.messageSettings.micDenied',
              'Microphone access was blocked. Enable it in your browser settings to pick a device.',
            )}
          </div>
        )}

        {/* Hard limitation, surfaced per handoff §4.1 */}
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: `1px solid ${t.surfaceBorder}`,
            fontSize: '11px',
            lineHeight: 1.5,
            color: t.textMuted,
          }}
        >
          {tr(
            'messages.messageSettings.webSpeechNote',
            'Device selection applies to AI (OpenAI) transcription. Browser-native voice input always uses your system default microphone.',
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Message-settings rows (prefs + coming-soon) ── */

interface SettingRowSpec {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  /** Toggle handler. Omitted for coming-soon rows. */
  onToggle?: () => void;
  /** Render disabled with a "Soon" badge (not yet wired to a real behavior). */
  comingSoon?: boolean;
}

const SectionHeading: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <div
    style={{
      fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
      fontSize: '11px',
      fontWeight: 500,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color,
      marginBottom: '10px',
    }}
  >
    {label}
  </div>
);

const SettingRow: React.FC<{
  row: SettingRowSpec;
  isDark: boolean;
  theme: ThemeShape;
}> = ({ row, isDark, theme: t }) => {
  const { t: tr } = useTranslation();
  return (
    <div
      style={{
        padding: '12px 14px',
        background: t.featureBg,
        border: `1px solid ${t.featureBorder}`,
        borderRadius: '10px',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        opacity: row.comingSoon ? 0.65 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: t.featureText,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {row.name}
          {row.comingSoon && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
                fontSize: '9px',
                letterSpacing: '0.1em',
                padding: '2px 6px',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                color: t.textMuted,
                borderRadius: '4px',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {tr('messages.messageSettings.soonBadge', 'Soon')}
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '2px' }}>
          {row.description}
        </div>
      </div>
      <ToggleSwitch
        checked={row.enabled}
        onChange={row.onToggle ?? (() => {})}
        disabled={row.comingSoon || !row.onToggle}
        ariaLabel={tr('messages.featureSettings.toggleFeature', {
          name: row.name,
          defaultValue: 'Toggle {{name}}',
        })}
        isDark={isDark}
        toggleOff={t.toggleOff}
        toggleKnob={t.toggleKnob}
      />
    </div>
  );
};

/* ── Memoized rows ── */

interface ThemeShape {
  textPrimary: string;
  textMuted: string;
  categoryBg: string;
  categoryBorder: string;
  categoryText: string;
  featureBg: string;
  featureBorder: string;
  featureText: string;
  toggleOff: string;
  toggleKnob: string;
  enableBtnBg: string;
  enableBtnBorder: string;
  disableBtnBg: string;
  disableBtnBorder: string;
  disableBtnText: string;
}

interface CategoryRowProps {
  categoryId: string;
  categoryName: string;
  categoryDescription: string;
  allFeatures: (keyof FeatureFlags)[];
  filteredFeatures: (keyof FeatureFlags)[];
  features: FeatureFlags;
  isExpanded: boolean;
  isPriority: boolean;
  isDark: boolean;
  theme: ThemeShape;
  onToggleCategory: (id: string) => void;
  onToggleFeature: (id: keyof FeatureFlags, enabled?: boolean) => void;
  onEnableCategory: (id: string) => void;
  onDisableCategory: (id: string) => void;
}

const CategoryRow: React.FC<CategoryRowProps> = React.memo(function CategoryRow({
  categoryId,
  categoryName,
  categoryDescription,
  allFeatures,
  filteredFeatures,
  features,
  isExpanded,
  isPriority,
  isDark,
  theme: t,
  onToggleCategory,
  onToggleFeature,
  onEnableCategory,
  onDisableCategory,
}) {
  const { t: tr } = useTranslation();
  const enabledCount = useMemo(
    () => allFeatures.reduce((n, f) => (features[f] ? n + 1 : n), 0),
    [allFeatures, features],
  );
  const panelId = `feature-cat-panel-${categoryId}`;

  return (
    <div style={{ marginBottom: '16px' }}>
      <button
        type="button"
        onClick={() => onToggleCategory(categoryId)}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        style={{
          width: '100%',
          padding: '14px',
          background: t.categoryBg,
          border: `1px solid ${t.categoryBorder}`,
          borderRadius: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isExpanded ? '8px' : '0',
          transition: 'background 0.15s ease',
        }}
      >
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: t.categoryText }}>
            {categoryName}
          </div>
          <div style={{ fontSize: '12px', color: t.textMuted }}>{categoryDescription}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.05em',
              color: '#f43f5e',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {enabledCount}/{allFeatures.length}
          </span>
          {isExpanded ? (
            <ChevronUp size={14} style={{ color: t.textMuted }} aria-hidden="true" />
          ) : (
            <ChevronDown size={14} style={{ color: t.textMuted }} aria-hidden="true" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div id={panelId} style={{ marginTop: '8px', marginLeft: '8px' }}>
          {filteredFeatures.map((featureId) => (
            <FeatureRow
              key={featureId}
              featureId={featureId}
              featureName={FEATURE_NAMES[featureId]}
              isEnabled={!!features[featureId]}
              isPriority={isPriority}
              isDark={isDark}
              theme={t}
              onToggle={onToggleFeature}
            />
          ))}

          {!isPriority && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => onEnableCategory(categoryId)}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: t.enableBtnBg,
                  border: `1px solid ${t.enableBtnBorder}`,
                  borderRadius: '8px',
                  color: t.disableBtnText,
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#f43f5e';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = t.disableBtnText;
                }}
              >
                {tr('messages.featureSettings.enableAll', 'Enable All')}
              </button>
              <button
                type="button"
                onClick={() => onDisableCategory(categoryId)}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: t.disableBtnBg,
                  border: `1px solid ${t.disableBtnBorder}`,
                  borderRadius: '8px',
                  color: t.disableBtnText,
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#f43f5e';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = t.disableBtnText;
                }}
              >
                {tr('messages.featureSettings.disableAll', 'Disable All')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

interface FeatureRowProps {
  featureId: keyof FeatureFlags;
  featureName: string;
  isEnabled: boolean;
  isPriority: boolean;
  isDark: boolean;
  theme: ThemeShape;
  onToggle: (id: keyof FeatureFlags, enabled?: boolean) => void;
}

const FeatureRow: React.FC<FeatureRowProps> = React.memo(function FeatureRow({
  featureId,
  featureName,
  isEnabled,
  isPriority,
  isDark,
  theme: t,
  onToggle,
}) {
  const { t: tr } = useTranslation();
  const handleToggle = useCallback(() => onToggle(featureId), [featureId, onToggle]);

  return (
    <div
      style={{
        padding: '12px',
        background: t.featureBg,
        border: `1px solid ${t.featureBorder}`,
        borderRadius: '8px',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: t.featureText }}>
          {featureName}
          {isPriority && (
            <span
              style={{
                marginLeft: '8px',
                fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
                fontSize: '10px',
                letterSpacing: '0.1em',
                padding: '2px 6px',
                background: '#f43f5e',
                color: '#fafafa',
                borderRadius: '4px',
                fontWeight: 500,
              }}
            >
              {tr('messages.featureSettings.priorityBadge', 'PRIORITY')}
            </span>
          )}
        </div>
      </div>
      <ToggleSwitch
        checked={isEnabled}
        onChange={handleToggle}
        disabled={isPriority}
        ariaLabel={tr('messages.featureSettings.toggleFeature', {
          name: featureName,
          defaultValue: 'Toggle {{name}}',
        })}
        isDark={isDark}
        toggleOff={t.toggleOff}
        toggleKnob={t.toggleKnob}
      />
    </div>
  );
});

/* ── Toggle (role=switch) ── */

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
  disabled?: boolean;
  isDark: boolean;
  toggleOff: string;
  toggleKnob: string;
  size?: 'md' | 'lg';
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  ariaLabel,
  disabled,
  isDark,
  toggleOff,
  toggleKnob,
  size = 'md',
}) => {
  const W = size === 'lg' ? 52 : 44;
  const H = size === 'lg' ? 28 : 24;
  const KNOB = size === 'lg' ? 22 : 18;
  const offset = 3;
  const knobLeft = checked ? W - KNOB - offset : offset;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      style={{
        width: `${W}px`,
        height: `${H}px`,
        borderRadius: `${H / 2}px`,
        border: 'none',
        background: checked ? '#f43f5e' : toggleOff,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: `${KNOB}px`,
          height: `${KNOB}px`,
          borderRadius: '50%',
          background: toggleKnob,
          position: 'absolute',
          top: `${offset}px`,
          left: `${knobLeft}px`,
          transition: 'left 0.2s',
          boxShadow: isDark
            ? '0 2px 6px rgba(0, 0, 0, 0.5)'
            : '0 2px 4px rgba(0, 0, 0, 0.2)',
          display: 'block',
        }}
      />
    </button>
  );
};

export default FeatureSettingsPanel;
