/**
 * FeatureSettingsPanel - Settings UI for Progressive Disclosure
 * Phase 3: Feature Refinements - Task 4
 *
 * Features:
 * - Categorized feature toggles
 * - Search/filter features
 * - Bulk enable/disable by category
 * - Reset to defaults
 * - Visual feedback for changes
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['priority', 'advanced'])
  );

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
              background: 'rgba(0, 0, 0, 0.5)',
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
              background: 'white',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.2)',
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
                borderBottom: '2px solid rgba(244, 63, 94, 0.2)',
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#18181B', margin: 0 }}>
                  <i className="fa-solid fa-sliders mr-3 text-rose-500" />
                  Feature Settings
                </h2>
                <button
                  onClick={onClose}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(244, 63, 94, 0.1)',
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
                  <i className="fa-solid fa-times" />
                </button>
              </div>

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <i
                  className="fa-solid fa-search"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#71717A',
                    fontSize: '14px'
                  }}
                />
                <input
                  type="text"
                  placeholder="Search features..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 40px',
                    border: '2px solid rgba(244, 63, 94, 0.2)',
                    borderRadius: '12px',
                    fontSize: '14px',
                    background: 'white',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>

              {/* Advanced Mode Toggle */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: 'white',
                  borderRadius: '12px',
                  border: '2px solid rgba(244, 63, 94, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#18181B' }}>
                    Advanced Mode
                  </div>
                  <div style={{ fontSize: '12px', color: '#71717A' }}>
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
                    background: advancedMode ? '#f43f5e' : '#E4E4E7',
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
                      background: 'white',
                      position: 'absolute',
                      top: '3px',
                      left: advancedMode ? '27px' : '3px',
                      transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
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
                        background: 'rgba(244, 63, 94, 0.05)',
                        border: '1px solid rgba(244, 63, 94, 0.2)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: isExpanded ? '8px' : '0'
                      }}
                    >
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: '#18181B' }}>
                          {category.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#71717A' }}>
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
                                background: 'white',
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                borderRadius: '8px',
                                marginBottom: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: '500', color: '#18181B' }}>
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
                                  background: isEnabled ? '#f43f5e' : '#E4E4E7',
                                  cursor: isPriority ? 'not-allowed' : 'pointer',
                                  position: 'relative',
                                  transition: 'background 0.2s',
                                  opacity: isPriority ? 0.5 : 1
                                }}
                                aria-label={`Toggle ${FEATURE_NAMES[featureId as keyof FeatureFlags]}`}
                              >
                                <div
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: 'white',
                                    position: 'absolute',
                                    top: '3px',
                                    left: isEnabled ? '23px' : '3px',
                                    transition: 'left 0.2s',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
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
                                background: 'rgba(244, 63, 94, 0.1)',
                                border: '1px solid rgba(244, 63, 94, 0.2)',
                                borderRadius: '8px',
                                color: '#f43f5e',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              Enable All
                            </button>
                            <button
                              onClick={() => disableCategory(categoryId)}
                              style={{
                                flex: 1,
                                padding: '8px',
                                background: 'rgba(0, 0, 0, 0.05)',
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                borderRadius: '8px',
                                color: '#71717A',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer'
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
                borderTop: '1px solid rgba(0, 0, 0, 0.1)',
                background: 'rgba(244, 63, 94, 0.05)'
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
                  background: 'white',
                  border: '2px solid rgba(244, 63, 94, 0.3)',
                  borderRadius: '12px',
                  color: '#f43f5e',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-rotate-left" />
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
