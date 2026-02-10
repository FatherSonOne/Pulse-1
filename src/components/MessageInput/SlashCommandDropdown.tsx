import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ToolAction } from '../../services/toolRegistry';
import './SlashCommandDropdown.css';

interface SlashCommandDropdownProps {
  matches: ToolAction[];
  selectedIndex: number;
  query: string;
  onSelect: (tool: ToolAction) => void;
  onClose: () => void;
}

export const SlashCommandDropdown: React.FC<SlashCommandDropdownProps> = ({
  matches,
  selectedIndex,
  query,
  onSelect,
  onClose
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  return (
    <motion.div
      ref={dropdownRef}
      className="slash-command-dropdown"
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {/* Header */}
      <div className="slash-command-header">
        <i className="fa-solid fa-terminal text-rose-500" />
        <span className="slash-command-title">Quick Launch</span>
        {query && (
          <span className="slash-command-query">/{query}</span>
        )}
      </div>

      {/* Tool List */}
      <div className="slash-command-list">
        {matches.length === 0 ? (
          <div className="slash-command-empty">
            <i className="fa-solid fa-magnifying-glass text-zinc-400 mb-2"></i>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              No tools found for "/{query}"
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
              Try a different search term
            </div>
          </div>
        ) : (
          matches.map((tool, index) => (
            <button
              key={tool.id}
              ref={index === selectedIndex ? selectedItemRef : null}
              className={`slash-command-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => onSelect(tool)}
              onMouseEnter={() => {
                // Update parent's selectedIndex when hovering
                // This is handled by the hook, so we don't need to do anything here
              }}
            >
              {/* Tool Icon */}
              <div className="slash-command-item-icon">
                <i className={`fa-solid ${tool.icon} text-rose-500`} />
              </div>

              {/* Tool Info */}
              <div className="slash-command-item-info">
                <div className="slash-command-item-name">{tool.name}</div>
                <div className="slash-command-item-desc">{tool.description}</div>
              </div>

              {/* Keyboard Shortcut Badge */}
              {tool.shortcut && (
                <kbd className="slash-command-shortcut">
                  {tool.shortcut}
                </kbd>
              )}
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="slash-command-footer">
        <div className="slash-command-footer-hints">
          <span className="slash-command-hint">
            <kbd>↑↓</kbd> Navigate
          </span>
          <span className="slash-command-hint">
            <kbd>Enter</kbd> Select
          </span>
          <span className="slash-command-hint">
            <kbd>Esc</kbd> Cancel
          </span>
        </div>
        <div className="slash-command-footer-count">
          <span className="text-rose-500 font-semibold">{matches.length}</span>
          <span className="text-zinc-500"> result{matches.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default SlashCommandDropdown;
