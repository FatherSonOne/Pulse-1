import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, X } from 'lucide-react';
import { getAllToolActions, getToolOverlayType, saveRecentTool } from '../../services/toolRegistry';
import type { ToolAction } from '../../services/toolRegistry';
import { CATEGORIES } from '../ToolsPanel/toolsData';
import type { FloatingToolsButtonProps } from './types';
import './FloatingToolsButton.css';

// Flat popup variant of the floating action button. With only 11
// message tools, the previous 4-segment radial menu + per-category
// drill-down was overkill (and pointed at deleted tool ids). The FAB
// now opens a vertical list sectioned by WRITE / ANALYZE / COACH.

export const FloatingToolsButton: React.FC<FloatingToolsButtonProps> = ({ setActiveToolOverlay }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allTools = getAllToolActions(() => { /* launch dispatched in handleToolClick */ });

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleToolClick = (toolId: string) => {
    const overlay = getToolOverlayType(toolId);
    if (overlay && setActiveToolOverlay) setActiveToolOverlay(overlay);
    saveRecentTool(toolId);
    setIsOpen(false);
  };

  const sections = CATEGORIES.map(category => ({
    id: category.id,
    name: category.name,
    tools: allTools.filter(tool => tool.category === category.id),
  })).filter(section => section.tools.length > 0);

  return createPortal(
    <div ref={containerRef} className="ftb-container">
      {/* Backdrop scrim — modal-style attention without blanking the chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="ftb-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* FAB toggle */}
      <button
        type="button"
        className={`ftb-fab ${isOpen ? 'ftb-fab--open' : ''}`}
        onClick={() => setIsOpen(v => !v)}
        aria-label={isOpen ? 'Close tools menu' : 'Open tools menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={18} /> : <LayoutGrid size={18} />}
      </button>

      {/* Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="ftb-popup"
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="ftb-popup-header">
              <span className="ftb-popup-title">
                <LayoutGrid size={14} />
                Message tools
                <span className="ftb-popup-count">· {allTools.length}</span>
              </span>
              <button
                type="button"
                className="ftb-popup-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </header>

            <div className="ftb-popup-body">
              {sections.map(section => (
                <section key={section.id} className="ftb-section">
                  <div className="ftb-section-label">{section.name} · {section.tools.length}</div>
                  <div className="ftb-tool-list">
                    {section.tools.map((tool: ToolAction) => (
                      <button
                        key={tool.id}
                        type="button"
                        className="ftb-tool"
                        onClick={() => handleToolClick(tool.id)}
                        role="menuitem"
                      >
                        <span className="ftb-tool-icon">
                          <i className={`fa-solid ${tool.icon}`} />
                        </span>
                        <span className="ftb-tool-info">
                          <span className="ftb-tool-name">{tool.name}</span>
                          <span className="ftb-tool-desc">{tool.description}</span>
                        </span>
                        {tool.shortcut && <kbd className="ftb-tool-shortcut">{tool.shortcut}</kbd>}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
};

export default FloatingToolsButton;
