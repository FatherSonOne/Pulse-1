import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getAllToolActions, getToolOverlayType, saveRecentTool } from '../../services/toolRegistry';
import type { ToolAction } from '../../services/toolRegistry';
import { CATEGORIES } from '../ToolsPanel/toolsData';
import './InlineToolsMenu.css';

import { LayoutGrid, X } from 'lucide-react';

interface InlineToolsMenuProps {
  onClose: () => void;
  setActiveToolOverlay?: (overlayType: 'analytics' | 'collaboration' | 'productivity' | 'intelligence' | 'proactive' | 'communication' | 'personalization' | 'security' | 'mediaHub') => void;
}

export const InlineToolsMenu: React.FC<InlineToolsMenuProps> = ({ onClose, setActiveToolOverlay }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const allTools = getAllToolActions(() => { /* launches dispatched below */ });

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
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleToolClick = (toolId: string) => {
    const overlayType = getToolOverlayType(toolId);
    if (overlayType && setActiveToolOverlay) {
      setActiveToolOverlay(overlayType);
    }
    saveRecentTool(toolId);
    onClose();
  };

  // Group the 11 message tools by their canonical category (WRITE /
  // ANALYZE / COACH). The list is short enough that we don't drill in
  // and out of subscreens — everything renders on one surface with mono
  // section labels.
  const sections = CATEGORIES.map(category => ({
    id: category.id,
    name: category.name,
    tools: allTools.filter(tool => tool.category === category.id),
  })).filter(section => section.tools.length > 0);

  return (
    <motion.div
      ref={menuRef}
      className="inline-tools-menu"
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="inline-tools-header">
        <div className="header-content">
          <LayoutGrid />
          <span>Message tools</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-400 dark:text-zinc-500 tabular-nums">
            · {allTools.length}
          </span>
        </div>
        <button
          type="button"
          className="close-button"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X />
        </button>
      </div>

      {/* Flat list, sectioned by WRITE / ANALYZE / COACH */}
      <div className="inline-tools-content">
        {sections.map(section => (
          <div key={section.id} className="tools-section">
            <div className="tools-section-label">{section.name} · {section.tools.length}</div>
            <div className="tools-list">
              {section.tools.map((tool: ToolAction) => (
                <button
                  key={tool.id}
                  type="button"
                  className="tool-item"
                  onClick={() => handleToolClick(tool.id)}
                >
                  <div className="tool-icon">
                    <i className={`fa-solid ${tool.icon} text-rose-500`} />
                  </div>
                  <div className="tool-info">
                    <div className="tool-name">{tool.name}</div>
                    <div className="tool-desc">{tool.description}</div>
                  </div>
                  {tool.shortcut && <kbd className="tool-shortcut">{tool.shortcut}</kbd>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default InlineToolsMenu;
