import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PulseAIMark } from '../brand/PulseAIMark';
import './PulseAssistantButton.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
const shortcutLabel = isMac ? '⌘/' : 'Ctrl+/';

interface PulseAssistantButtonProps {
  onClick: () => void;
  isOpen: boolean;
  hasProactiveSuggestion?: boolean;
  collapsed: boolean;
}

export const PulseAssistantButton: React.FC<PulseAssistantButtonProps> = ({
  onClick,
  isOpen,
  hasProactiveSuggestion = false,
  collapsed,
}) => {
  const reduceMotion = useReducedMotion();
  return (
    <button
      type="button"
      className={`pa-sidebar-btn ${isOpen ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
      onClick={onClick}
      title={collapsed ? `Pulse AI (${shortcutLabel})` : undefined}
      aria-label="Toggle Pulse AI assistant"
      aria-expanded={isOpen}
    >
      {/* Icon container */}
      <motion.div
        className="pa-btn-icon"
        whileHover={reduceMotion
          ? { boxShadow: '0 6px 20px rgba(244, 63, 94, 0.55)' }
          : { y: -2, boxShadow: '0 6px 20px rgba(244, 63, 94, 0.55)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <PulseAIMark size={24} frame={false} className="pa-ecg-svg" />

        {/* Proactive suggestion badge */}
        {hasProactiveSuggestion && (
          <span className="pa-btn-badge" aria-hidden="true" />
        )}
      </motion.div>

      {!collapsed && (
        <>
          <span className="pa-btn-label">Pulse AI</span>
          <span className="pa-btn-shortcut">{shortcutLabel}</span>
        </>
      )}
    </button>
  );
};
