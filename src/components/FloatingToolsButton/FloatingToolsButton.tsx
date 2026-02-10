import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ToolCategorySegment } from './ToolCategorySegment';
import { ToolSubMenu } from './ToolSubMenu';
import { getToolOverlayType, saveRecentTool } from '../../services/toolRegistry';
import { TOOL_CATEGORIES, getToolsByCategory } from './categories';
import type { FloatingToolsButtonProps } from './types';
import './FloatingToolsButton.css';

export const FloatingToolsButton: React.FC<FloatingToolsButtonProps> = ({ setActiveToolOverlay }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const fabRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectedCategory(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSelectedCategory(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleToolClick = (toolId: string) => {
    const overlayType = getToolOverlayType(toolId);
    if (overlayType && setActiveToolOverlay) {
      setActiveToolOverlay(overlayType);
    }
    saveRecentTool(toolId);
    setIsOpen(false);
    setSelectedCategory(null);
  };

  const handleCategoryClick = (categoryId: string) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryId);
    }
  };

  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.1,
        staggerChildren: 0.05
      }
    },
    exit: { opacity: 0, transition: { duration: 0.15 } }
  };

  return createPortal(
    <div ref={fabRef} className="ftb-container">
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="ftb-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          />
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <motion.button
        className="ftb-fab"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        aria-label={isOpen ? 'Close tools menu' : 'Open tools menu'}
      >
        <i className={`fa-solid ${isOpen ? 'fa-times' : 'fa-magic-wand-sparkles'}`} />
      </motion.button>

      {/* Radial Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="ftb-radial-container"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {TOOL_CATEGORIES.map((category, index) => (
              <ToolCategorySegment
                key={category.id}
                category={category}
                isSelected={selectedCategory === category.id}
                onClick={() => handleCategoryClick(category.id)}
                position={
                  index === 0 ? 'top-right' :
                  index === 1 ? 'top-left' :
                  index === 2 ? 'bottom-left' :
                  'bottom-right'
                }
              />
            ))}

            {/* Tool Submenu */}
            {selectedCategory && (
              <ToolSubMenu
                category={TOOL_CATEGORIES.find(c => c.id === selectedCategory)!}
                tools={getToolsByCategory(selectedCategory)}
                onToolClick={handleToolClick}
                onClose={() => setSelectedCategory(null)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default FloatingToolsButton;
