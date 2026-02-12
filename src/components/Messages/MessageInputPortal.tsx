import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface MessageInputPortalProps {
  children: React.ReactNode;
  sidebarWidth: number;
  isActive: boolean;
}

/**
 * MessageInputPortal - Renders message input fixed to viewport bottom using React Portal
 *
 * This component breaks the input out of the scroll container hierarchy by rendering
 * directly to document.body, allowing true viewport-fixed positioning like Discord/Slack.
 *
 * @param children - The message input component to render
 * @param sidebarWidth - Width of the sidebar in pixels (for desktop split-view offset)
 * @param isActive - Whether this input should be visible (e.g., when a thread is selected)
 */
const MessageInputPortal: React.FC<MessageInputPortalProps> = ({
  children,
  sidebarWidth,
  isActive
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  if (!isMounted || !isActive) {
    return null;
  }

  // Calculate left offset for desktop split-view
  // On mobile (< 768px), CSS will override to left: 0
  const leftOffset = sidebarWidth > 0 ? `${sidebarWidth}px` : '30%';

  return createPortal(
    <div
      className="message-input-portal-container"
      style={{
        left: leftOffset
      }}
    >
      {children}
    </div>,
    document.body
  );
};

export default MessageInputPortal;
