// ============================================
// MESSAGE PROMPT COMPONENT (Display UI)
// ============================================

import React, { useState, useEffect } from 'react';
import { InAppMessage } from '../types/inAppMessages';

interface MessagePromptProps {
  message: InAppMessage;
  onOpened: () => void;
  onClicked: () => void;
  onDismissed: () => void;
}

export const MessagePrompt: React.FC<MessagePromptProps> = ({
  message,
  onOpened,
  onClicked,
  onDismissed,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Auto-dismiss after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, message.displayDurationSeconds * 1000);

    return () => clearTimeout(timer);
  }, [message.displayDurationSeconds]);

  const handleExpand = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      onOpened();
    }
  };

  const handleCTAClick = () => {
    onClicked();
    if (message.ctaUrl) {
      window.open(message.ctaUrl, '_blank');
    }
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismissed(), 300); // Wait for fade-out animation
  };

  if (!isVisible) return null;

  const positionStyles = getPositionStyles(message.position);
  const styleColors = getStyleColors(message.styleType);

  return (
    <div
      className="message-prompt-container"
      style={{
        ...positionStyles,
        ...styleColors,
        animation: 'slideIn 0.3s ease-out',
        transition: 'all 0.3s ease',
        opacity: isVisible ? 1 : 0,
      }}
      onClick={handleExpand}
    >
      {/* Close Button */}
      <button
        className="message-close-btn"
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'transparent',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer',
          color: '#666',
        }}
      >
        ×
      </button>

      {/* Title */}
      <h3
        style={{
          margin: '0 0 8px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1a1a1a',
        }}
      >
        {message.title}
      </h3>

      {/* Body */}
      <p
        style={{
          margin: '0 0 12px 0',
          fontSize: '14px',
          color: '#4a4a4a',
          lineHeight: '1.5',
        }}
      >
        {message.body}
      </p>

      {/* CTA Button */}
      {message.ctaText && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCTAClick();
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: styleColors.ctaBackground,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {message.ctaText}
        </button>
      )}
    </div>
  );
};

// ==================== HELPER FUNCTIONS ====================

function getPositionStyles(position: string): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    maxWidth: '380px',
    padding: '16px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    backgroundColor: 'white',
    cursor: 'pointer',
  };

  switch (position) {
    case 'bottom-right':
      return { ...base, bottom: '20px', right: '20px' };
    case 'bottom-left':
      return { ...base, bottom: '20px', left: '20px' };
    case 'top-right':
      return { ...base, top: '20px', right: '20px' };
    case 'top-left':
      return { ...base, top: '20px', left: '20px' };
    case 'center':
      return {
        ...base,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    default:
      return { ...base, bottom: '20px', right: '20px' };
  }
}

function getStyleColors(styleType: string): {
  borderLeft: string;
  ctaBackground: string;
} {
  switch (styleType) {
    case 'success':
      return {
        borderLeft: '4px solid #4caf50',
        ctaBackground: '#4caf50',
      };
    case 'warning':
      return {
        borderLeft: '4px solid #ff9800',
        ctaBackground: '#ff9800',
      };
    case 'tip':
      return {
        borderLeft: '4px solid #9c27b0',
        ctaBackground: '#9c27b0',
      };
    case 'info':
    default:
      return {
        borderLeft: '4px solid #007bff',
        ctaBackground: '#007bff',
      };
  }
}

// ==================== ANIMATIONS (add to your global CSS) ====================
/*
@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
*/
