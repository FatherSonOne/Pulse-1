import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllToolActions, getToolOverlayType, saveRecentTool } from '../../services/toolRegistry';
import type { ToolAction } from '../../services/toolRegistry';
import './InlineToolsMenu.css';

import { ArrowLeft, ChevronRight, LayoutGrid, X } from 'lucide-react';

interface ToolCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  tools: string[];
}

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'ai',
    name: 'AI Tools',
    icon: 'fa-brain',
    color: '#f43f5e',
    tools: ['deep-reasoner', 'ai-coach', 'ai-mediator', 'conversation-intelligence', 'brainstorm-assistant', 'ai-assistant', 'deep-search'],
  },
  {
    id: 'content',
    name: 'Content',
    icon: 'fa-pen-fancy',
    color: '#ec4899',
    tools: ['code-studio', 'smart-compose', 'templates', 'quick-phrases', 'draft-manager', 'message-formatting'],
  },
  {
    id: 'analysis',
    name: 'Analysis',
    icon: 'fa-chart-line',
    color: '#fb7185',
    tools: ['video-analyst', 'sentiment-analysis', 'engagement-scoring', 'response-time-tracker', 'conversation-flow', 'sentiment-timeline', 'meeting-intel', 'message-impact'],
  },
  {
    id: 'utilities',
    name: 'Utilities',
    icon: 'fa-toolbox',
    color: '#be123c',
    tools: ['vision-lab', 'video-studio', 'voice-studio', 'translation', 'route-planner', 'keyboard-shortcuts', 'settings', 'backup-sync'],
  },
];

interface InlineToolsMenuProps {
  onClose: () => void;
  setActiveToolOverlay?: (overlayType: 'analytics' | 'collaboration' | 'productivity' | 'intelligence' | 'proactive' | 'communication' | 'personalization' | 'security' | 'mediaHub') => void;
}

export const InlineToolsMenu: React.FC<InlineToolsMenuProps> = ({ onClose, setActiveToolOverlay }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const allTools = getAllToolActions(() => {});

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedCategory) {
          setSelectedCategory(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedCategory, onClose]);

  const handleToolClick = (toolId: string) => {
    const overlayType = getToolOverlayType(toolId);
    if (overlayType && setActiveToolOverlay) {
      setActiveToolOverlay(overlayType);
    }
    saveRecentTool(toolId);
    onClose();
  };

  const getToolsByCategory = (categoryId: string): ToolAction[] => {
    const category = TOOL_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return [];
    return allTools.filter(tool => category.tools.includes(tool.id));
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
      },
    },
    exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.15 } },
  };

  const categoryVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: (i: number) => ({
      x: 0,
      opacity: 1,
      transition: {
        delay: i * 0.05,
        type: 'spring',
        stiffness: 300,
        damping: 25,
      },
    }),
  };

  const toolVariants = {
    hidden: { x: -15, opacity: 0 },
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
      className="inline-tools-menu"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Header */}
      <div className="inline-tools-header">
        {selectedCategory ? (
          <>
            <button
              className="back-button"
              onClick={() => setSelectedCategory(null)}
              aria-label="Back to categories"
            >
              <ArrowLeft />
            </button>
            <div className="header-content">
              <i className={`fa-solid ${TOOL_CATEGORIES.find(c => c.id === selectedCategory)?.icon}`} />
              <span>{TOOL_CATEGORIES.find(c => c.id === selectedCategory)?.name}</span>
            </div>
          </>
        ) : (
          <>
            <div className="header-content">
              <LayoutGrid />
              <span>AI Tools</span>
            </div>
            <button className="close-button" onClick={onClose} aria-label="Close menu">
              <X />
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="inline-tools-content">
        {!selectedCategory ? (
          /* Categories Grid */
          <div className="categories-grid">
            {TOOL_CATEGORIES.map((category, index) => (
              <motion.button
                key={category.id}
                className="category-card"
                onClick={() => setSelectedCategory(category.id)}
                variants={categoryVariants}
                custom={index}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div
                  className="category-icon"
                  style={{ background: `linear-gradient(135deg, ${category.color}, ${category.color}dd)` }}
                >
                  <i className={`fa-solid ${category.icon}`} />
                </div>
                <div className="category-info">
                  <div className="category-name">{category.name}</div>
                  <div className="category-count">{category.tools.length} tools</div>
                </div>
                <ChevronRight className="category-arrow" />
              </motion.button>
            ))}
          </div>
        ) : (
          /* Tools List */
          <div className="tools-list">
            {getToolsByCategory(selectedCategory).map((tool, index) => (
              <motion.button
                key={tool.id}
                className="tool-item"
                onClick={() => handleToolClick(tool.id)}
                variants={toolVariants}
                custom={index}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="tool-icon">
                  <i className={`fa-solid ${tool.icon} text-rose-500`} />
                </div>
                <div className="tool-info">
                  <div className="tool-name">{tool.name}</div>
                  <div className="tool-desc">{tool.description}</div>
                </div>
                {tool.shortcut && (
                  <kbd className="tool-shortcut">{tool.shortcut}</kbd>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default InlineToolsMenu;
