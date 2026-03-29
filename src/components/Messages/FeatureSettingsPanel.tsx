/**
 * FeatureSettingsPanel - Settings UI for Progressive Disclosure
 * Phase 3: Feature Refinements - Task 4
 * Dark mode optimized
 *
 * Features:
 * - Categorized feature toggles
 * - Search/filter features
 * - Bulk enable/disable by category
 * - Reset to defaults
 * - Visual feedback for changes
 * - Full dark/light mode support
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Search, Sliders, X } from 'lucide-react';
import {
  useFeatures,
  FEATURE_CATEGORIES,
  FEATURE_NAMES,
  type FeatureFlags
} from '../../contexts/FeatureContext';

interface FeatureSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Detect dark mode from <html class="dark"> set by App.tsx */
function useIsDark() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export const FeatureSettingsPanel: React.FC<FeatureSettingsPanelProps> = ({
  isOpen,
  onClose
}) => {
  const {
    features,
    toggleFeature,
    resetFeatures,
    advancedMode,
    setAdvancedMode
  } = useFeatures();

  const isDark = useIsDark();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['priority', 'advanced'])
  );

  // ── Theme palette ──
  const t = useMemo(() => {
    if (isDark) {
      return {
        // Panel
        panelBg: '#09090b',
        panelShadow: '-4px 0 32px rgba(0, 0, 0, 0.6)',
        // Header
        headerBg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(236, 72, 153, 0.08) 100%)',
        headerBorder: 'rgba(244, 63, 94, 0.25)',
        // Text
        textPrimary: '#fafafa',
        textSecondary: '#a1a1aa',
        textMuted: '#71717a',
        // Surfaces
        surface: 'rgba(255, 255, 255, 0.04)',
        surfaceBorder: 'rgba(255, 255, 255, 0.08)',
        surfaceHover: 'rgba(255, 255, 255, 0.06)',
        // Input
        inputBg: 'rgba(255, 255, 255, 0.05)',
        inputBorder: 'rgba(244, 63, 94, 0.25)',
        inputText: '#fafafa',
        inputPlaceholder: '#71717a',
        // Category
        categoryBg: 'rgba(244, 63, 94, 0.08)',
        categoryBorder: 'rgba(244, 63, 94, 0.2)',
        categoryText: '#fafafa',
        // Feature row
        featureBg: 'rgba(255, 255, 255, 0.03)',
        featureBorder: 'rgba(255, 255, 255, 0.07)',
        featureText: '#e4e4e7',
        // Toggle
        toggleOff: '#3f3f46',
        toggleKnob: '#fafafa',
        // Footer
        footerBg: 'rgba(244, 63, 94, 0.06)',
        footerBorder: 'rgba(255, 255, 255, 0.06)',
        resetBtnBg: 'rgba(255, 255, 255, 0.04)',
        resetBtnBorder: 'rgba(244, 63, 94, 0.3)',
        // Buttons
        enableBtnBg: 'rgba(244, 63, 94, 0.12)',
        enableBtnBorder: 'rgba(244, 63, 94, 0.25)',
        disableBtnBg: 'rgba(255, 255, 255, 0.04)',
        disableBtnBorder: 'rgba(255, 255, 255, 0.08)',
        disableBtnText: '#a1a1aa',
        // Scrollbar
        scrollThumb: 'rgba(255, 255, 255, 0.08)',
        scrollThumbHover: 'rgba(244, 63, 94, 0.3)',
      };
    }
    return {
      panelBg: '#ffffff',
      panelShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
      headerBg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)',
      headerBorder: 'rgba(244, 63, 94, 0.2)',
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
      toggleKnob: '#ffffff',
      footerBg: 'rgba(244, 63, 94, 0.05)',
      footerBorder: 'rgba(0, 0, 0, 0.1)',
      resetBtnBg: '#ffffff',
      resetBtnBorder: 'rgba(244, 63, 94, 0.3)',
      enableBtnBg: 'rgba(244, 63, 94, 0.1)',
      enableBtnBorder: 'rgba(244, 63, 94, 0.2)',
      disableBtnBg: 'rgba(0, 0, 0, 0.05)',
      disableBtnBorder: 'rgba(0, 0, 0, 0.1)',
      disableBtnText: '#71717a',
      scrollThumb: 'rgba(0, 0, 0, 0.08)',
      scrollThumbHover: 'rgba(244, 63, 94, 0.3)',
    };
  }, [isDark]);

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Enable all features in a category
  const enableCategory = (categoryId: string) => {
    const category = FEATURE_CATEGORIES[categoryId as keyof typeof FEATURE_CATEGORIES];
    category.features.forEach(featureId => {
      toggleFeature(featureId as keyof FeatureFlags, true);
    });
  };

  // Disable all features in a category
  const disableCategory = (categoryId: string) => {
    const category = FEATURE_CATEGORIES[categoryId as keyof typeof FEATURE_CATEGORIES];
    category.features.forEach(featureId => {
      toggleFeature(featureId as keyof FeatureFlags, false);
    });
  };

  // Filter features by search query
  const matchesSearch = (featureId: keyof FeatureFlags) => {
    if (!searchQuery) return true;
    const name = FEATURE_NAMES[featureId].toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  };

  // Close on escape
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
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
              backdropFilter: 'blur(4px)'
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
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
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '24px',
                borderBottom: `2px solid ${t.headerBorder}`,
                background: t.headerBg
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: t.textPrimary, margin: 0, display: 'flex', alignItems: 'center' }}>
                  <Sliders style={{ marginRight: '12px', color: '#f43f5e' }} />
                  Feature Settings
                </h2>
                <button
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
                    transition: 'all 0.2s'
                  }}
                  aria-label="Close settings"
                >
                  <X />
                </button>
              </div>

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: t.textMuted }} />
                <input
                  type="text"
                  placeholder="Search features..."
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
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: t.textPrimary }}>
                    Advanced Mode
                  </div>
                  <div style={{ fontSize: '12px', color: t.textMuted }}>
                    Show all features and settings
                  </div>
                </div>
                <button
                  onClick={() => setAdvancedMode(!advancedMode)}
                  style={{
                    width: '52px',
                    height: '28px',
                    borderRadius: '14px',
                    border: 'none',
                    background: advancedMode ? '#f43f5e' : t.toggleOff,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s'
                  }}
                  aria-label="Toggle advanced mode"
                >
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: t.toggleKnob,
                      position: 'absolute',
                      top: '3px',
                      left: advancedMode ? '27px' : '3px',
                      transition: 'left 0.2s',
                      boxShadow: isDark
                        ? '0 2px 6px rgba(0, 0, 0, 0.5)'
                        : '0 2px 4px rgba(0, 0, 0, 0.2)'
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Content */}
            <div
              className="feature-settings-scroll"
              style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}
            >
              {Object.entries(FEATURE_CATEGORIES).map(([categoryId, category]) => {
                const isExpanded = expandedCategories.has(categoryId);
                const filteredFeatures = category.features.filter(matchesSearch);
                const isPriority = categoryId === 'priority';

                if (filteredFeatures.length === 0 && searchQuery) {
                  return null;
                }

                const enabledCount = category.features.filter(
                  f => features[f as keyof FeatureFlags]
                ).length;

                return (
                  <div key={categoryId} style={{ marginBottom: '16px' }}>
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(categoryId)}
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
                        <div style={{ fontSize: '15px', fontWeight: '600', color: t.categoryText }}>
                          {category.name}
                        </div>
                        <div style={{ fontSize: '12px', color: t.textMuted }}>
                          {category.description}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: '#f43f5e', fontWeight: '600' }}>
                          {enabledCount}/{category.features.length}
                        </span>
                        <i
                          className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}
                          style={{ color: '#f43f5e', fontSize: '14px' }}
                        />
                      </div>
                    </button>

                    {/* Category Features */}
                    {isExpanded && (
                      <div style={{ marginTop: '8px', marginLeft: '8px' }}>
                        {filteredFeatures.map(featureId => {
                          const isEnabled = features[featureId as keyof FeatureFlags];

                          return (
                            <div
                              key={featureId}
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
                                <div style={{ fontSize: '14px', fontWeight: '500', color: t.featureText }}>
                                  {FEATURE_NAMES[featureId as keyof FeatureFlags]}
                                  {isPriority && (
                                    <span
                                      style={{
                                        marginLeft: '8px',
                                        fontSize: '10px',
                                        padding: '2px 6px',
                                        background: '#f43f5e',
                                        color: 'white',
                                        borderRadius: '4px',
                                        fontWeight: '600'
                                      }}
                                    >
                                      PRIORITY
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => toggleFeature(featureId as keyof FeatureFlags)}
                                disabled={isPriority}
                                style={{
                                  width: '44px',
                                  height: '24px',
                                  borderRadius: '12px',
                                  border: 'none',
                                  background: isEnabled ? '#f43f5e' : t.toggleOff,
                                  cursor: isPriority ? 'not-allowed' : 'pointer',
                                  position: 'relative',
                                  transition: 'background 0.2s',
                                  opacity: isPriority ? 0.5 : 1,
                                  flexShrink: 0,
                                }}
                                aria-label={`Toggle ${FEATURE_NAMES[featureId as keyof FeatureFlags]}`}
                              >
                                <div
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: t.toggleKnob,
                                    position: 'absolute',
                                    top: '3px',
                                    left: isEnabled ? '23px' : '3px',
                                    transition: 'left 0.2s',
                                    boxShadow: isDark
                                      ? '0 2px 6px rgba(0, 0, 0, 0.5)'
                                      : '0 2px 4px rgba(0, 0, 0, 0.2)'
                                  }}
                                />
                              </button>
                            </div>
                          );
                        })}

                        {/* Category Actions */}
                        {!isPriority && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                              onClick={() => enableCategory(categoryId)}
                              style={{
                                flex: 1,
                                padding: '8px',
                                background: t.enableBtnBg,
                                border: `1px solid ${t.enableBtnBorder}`,
                                borderRadius: '8px',
                                color: '#f43f5e',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background 0.15s ease',
                              }}
                            >
                              Enable All
                            </button>
                            <button
                              onClick={() => disableCategory(categoryId)}
                              style={{
                                flex: 1,
                                padding: '8px',
                                background: t.disableBtnBg,
                                border: `1px solid ${t.disableBtnBorder}`,
                                borderRadius: '8px',
                                color: t.disableBtnText,
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background 0.15s ease',
                              }}
                            >
                              Disable All
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: `1px solid ${t.footerBorder}`,
                background: t.footerBg
              }}
            >
              <button
                onClick={() => {
                  if (confirm('Reset all features to default settings?')) {
                    resetFeatures();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: t.resetBtnBg,
                  border: `2px solid ${t.resetBtnBorder}`,
                  borderRadius: '12px',
                  color: '#f43f5e',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.15s ease',
                }}
              >
                <RotateCcw size={16} />
                Reset to Defaults
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FeatureSettingsPanel;
