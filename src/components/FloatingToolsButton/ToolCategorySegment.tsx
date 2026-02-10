import React from 'react';
import { motion } from 'framer-motion';
import type { ToolCategorySegmentProps } from './types';

export const ToolCategorySegment: React.FC<ToolCategorySegmentProps> = ({
  category,
  isSelected,
  onClick,
  position,
}) => {
  // Animation variant
  const categoryVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 260,
        damping: 20,
      },
    },
  };

  return (
    <motion.button
      className={`ftb-category ftb-category-${position} ${isSelected ? 'selected' : ''}`}
      variants={categoryVariants}
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`${category.name} - ${category.description}`}
      aria-pressed={isSelected}
    >
      {/* Category Icon */}
      <div
        className="ftb-category-icon"
        style={{
          background: `linear-gradient(135deg, ${category.color}, ${category.color}dd)`,
        }}
      >
        <i className={`fa-solid ${category.icon}`} />
      </div>

      {/* Category Name */}
      <div className="ftb-category-name">{category.name}</div>

      {/* Tool Count Badge */}
      <div className="ftb-category-badge">{category.tools.length}</div>
    </motion.button>
  );
};

export default ToolCategorySegment;
