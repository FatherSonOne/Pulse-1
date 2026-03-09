import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ToolSubMenuProps } from './types';

import { ChevronRight, Inbox, X } from 'lucide-react';

export const ToolSubMenu: React.FC<ToolSubMenuProps> = ({
  category,
  tools,
  onToolClick,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Scroll to top when category changes
  useEffect(() => {
    if (menuRef.current) {
      menuRef.current.scrollTop = 0;
    }
  }, [category.id]);

  // Animation variants
  const submenuVariants = {
    hidden: { scale: 0.8, opacity: 0, y: 20 },
    visible: {
      scale: 1,
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
      },
    },
    exit: {
      scale: 0.8,
      opacity: 0,
      y: 20,
      transition: { duration: 0.15 },
    },
  };

  const itemVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: (i: number) => ({
      x: 0,
      opacity: 1,
      transition: {
        delay: i * 0.03,
        type: 'spring',
        stiffness: 300,
        damping: 25,
      },
    }),
  };

  return (
    <motion.div
      ref={menuRef}
      className="ftb-submenu"
      variants={submenuVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Header */}
      <div className="ftb-submenu-header" style={{ background: category.color }}>
        <div className="ftb-submenu-header-content">
          <i className={`fa-solid ${category.icon}`} />
          <div className="ftb-submenu-title">
            <div className="ftb-submenu-category-name">{category.name}</div>
            <div className="ftb-submenu-category-desc">{category.description}</div>
          </div>
        </div>
        <button
          className="ftb-submenu-close"
          onClick={onClose}
          aria-label="Close submenu"
        >
          <X />
        </button>
      </div>

      {/* Tools List */}
      <div className="ftb-submenu-tools">
        {tools.length === 0 ? (
          <div className="ftb-submenu-empty">
            <Inbox className="text-zinc-400 mb-2" />
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              No tools in this category
            </div>
          </div>
        ) : (
          tools.map((tool, index) => (
            <motion.button
              key={tool.id}
              className="ftb-tool-item"
              onClick={() => onToolClick(tool.id)}
              variants={itemVariants}
              custom={index}
              whileHover={{ x: 4, backgroundColor: 'rgba(244, 63, 94, 0.1)' }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Tool Icon */}
              <div className="ftb-tool-icon">
                <i className={`fa-solid ${tool.icon} text-rose-500`} />
              </div>

              {/* Tool Info */}
              <div className="ftb-tool-info">
                <div className="ftb-tool-name">{tool.name}</div>
                <div className="ftb-tool-desc">{tool.description}</div>
              </div>

              {/* Keyboard Shortcut */}
              {tool.shortcut && (
                <kbd className="ftb-tool-shortcut">{tool.shortcut}</kbd>
              )}

              {/* Arrow Icon */}
              <div className="ftb-tool-arrow">
                <ChevronRight />
              </div>
            </motion.button>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default ToolSubMenu;
