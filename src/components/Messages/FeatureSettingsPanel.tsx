/**
 * FeatureSettingsPanel — Slide-out panel for per-Messages feature toggles.
 *
 * Features: categorized toggles, search/filter, bulk enable/disable per category,
 * reset-to-defaults with in-panel confirmation, advanced-mode master toggle,
 * focus trap, scroll lock, full keyboard a11y.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, RotateCcw, Search, Sliders, X } from 'lucide-react';
import {
  useFeatures,
  FEATURE_CATEGORIES,
  FEATURE_NAMES,
  type FeatureFlags,
} from '../../contexts/FeatureContext';

interface FeatureSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type CategoryId = keyof typeof FEATURE_CATEGORIES;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DEFAULT_EXPANDED: ReadonlySet<string> = new Set(['priority', 'advanced']);

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
        inputBorder: 'rgba(244, 63, 94, 0.25)',
        inputText: '#fafafa',
        inputPlaceholder: '#71717a',
        categoryBg: 'rgba(244, 63, 94, 0.08)',
        categoryBorder: 'rgba(244, 63, 94, 0.2)',
        categoryText: '#fafafa',
        featureBg: 'rgba(255, 255, 255, 0.03)',
        featureBorder: 'rgba(255, 255, 255, 0.07)',
        featureText: '#e4e4e7',
        toggleOff: '#3f3f46',
        toggleKnob: '#fafafa',
        footerBg: 'rgba(244, 63, 94, 0.06)',
        footerBorder: 'rgba(255, 255, 255, 0.06)',
        resetBtnBg: 'rgba(255, 255, 255, 0.04)',
        resetBtnBorder: 'rgba(244, 63, 94, 0.3)',
        resetConfirmBg: 'rgba(239, 68, 68, 0.12)',
        resetConfirmBorder: 'rgba(239, 68, 68, 0.4)',
        resetCancelBg: 'rgba(255, 255, 255, 0.04)',
        resetCancelBorder: 'rgba(255, 255, 255, 0.1)',
        resetCancelText: '#a1a1aa',
        enableBtnBg: 'rgba(244, 63, 94, 0.12)',
        enableBtnBorder: 'rgba(244, 63, 94, 0.25)',
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
      inputBorder: 'rgba(244, 63, 94, 0.2)',
      inputText: '#18181b',
      inputPlaceholder: '#a1a1aa',
      categoryBg: 'rgba(244, 63, 94, 0.05)',
      categoryBorder: 'rgba(244, 63, 94, 0.2)',
      categoryText: '#18181b',
      featureBg: '#ffffff',
      featureBorder: 'rgba(0, 0, 0, 0.1)',
      featureText: '#18181b',
      toggleOff: '#e4e4e7',
      toggleKnob: '#fafafa',
      footerBg: 'rgba(244, 63, 94, 0.05)',
      footerBorder: 'rgba(0, 0, 0, 0.1)',
      resetBtnBg: '#ffffff',
      resetBtnBorder: 'rgba(244, 63, 94, 0.3)',
      resetConfirmBg: 'rgba(239, 68, 68, 0.08)',
      resetConfirmBorder: 'rgba(239, 68, 68, 0.35)',
      resetCancelBg: '#ffffff',
      resetCancelBorder: 'rgba(0, 0, 0, 0.1)',
      resetCancelText: '#52525b',
      enableBtnBg: 'rgba(244, 63, 94, 0.1)',
      enableBtnBorder: 'rgba(244, 63, 94, 0.2)',
      disableBtnBg: 'rgba(0, 0, 0, 0.05)',
      disableBtnBorder: 'rgba(0, 0, 0, 0.1)',
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
      const category = FEATURE_CATEGORIES[categoryId as CategoryId];
      if (!category) return;
      category.features.forEach((featureId) => {
        toggleFeature(featureId as keyof FeatureFlags, true);
      });
    },
    [toggleFeature],
  );

  const disableCategory = useCallback(
    (categoryId: string) => {
      const category = FEATURE_CATEGORIES[categoryId as CategoryId];
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
    for (const category of Object.values(FEATURE_CATEGORIES)) {
      for (const featureId of category.features) {
        if (matchesSearch(featureId as keyof FeatureFlags)) count++;
      }
    }
    return count;
  }, [matchesSearch, searchQuery]);

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
                  <Sliders size={12} style={{ color: '#f43f5e' }} aria-hidden="true" />
                  {tr('messages.featureSettings.title', 'Feature Settings')}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: 'none',
                    background: isDark ? 'rgba(244, 63, 94, 0.15)' : 'rgba(244, 63, 94, 0.1)',
                    color: '#f43f5e',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    transition: 'background 0.2s',
                  }}
                  aria-label={tr('messages.featureSettings.close', 'Close settings')}
                >
                  <X />
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
                    border: `2px solid ${t.inputBorder}`,
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
                  border: `2px solid ${t.inputBorder}`,
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
              {totalMatches === 0 && (
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
                    defaultValue: 'No features match “{{query}}”.',
                  })}
                </div>
              )}

              {(Object.entries(FEATURE_CATEGORIES) as [string, typeof FEATURE_CATEGORIES[CategoryId]][]).map(
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
                    border: `2px solid ${t.resetBtnBorder}`,
                    borderRadius: '12px',
                    color: '#f43f5e',
                    fontSize: '14px',
                    fontWeight: 600,
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
          <span style={{ fontSize: '12px', color: '#f43f5e', fontWeight: 600 }}>
            {enabledCount}/{allFeatures.length}
          </span>
          {isExpanded ? (
            <ChevronUp size={14} style={{ color: '#f43f5e' }} aria-hidden="true" />
          ) : (
            <ChevronDown size={14} style={{ color: '#f43f5e' }} aria-hidden="true" />
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
                  color: '#f43f5e',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
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
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
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
