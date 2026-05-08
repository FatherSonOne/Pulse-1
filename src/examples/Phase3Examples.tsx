/**
 * Phase 3 Component Usage Examples
 *
 * This file demonstrates how to integrate and use the new Phase 3 components:
 * - RadialMenu for reactions
 * - ContextMenu for message actions
 * - Progressive Disclosure system
 *
 * These examples are for reference only and should be adapted for your use case.
 */

import React, { useState } from 'react';
import { RadialMenu, useRadialMenu, useLongPress } from '../components/Messages/RadialMenu';
import {
  ContextMenu,
  useContextMenu,
  useRightClick,
  useLongPressMenu,
  type ContextMenuItem
} from '../components/Messages/ContextMenu';
import { FeatureSettingsPanel } from '../components/Messages/FeatureSettingsPanel';
import { useFeatures } from '../contexts/FeatureContext';

import { Mic, Send, Sliders, Wand2 } from 'lucide-react';

/**
 * Example 1: Message with RadialMenu for reactions
 */
export const MessageWithReactions: React.FC<{ message: any }> = ({ message }) => {
  const radialMenu = useRadialMenu();

  // Define reaction items
  const reactionItems = [
    {
      id: 'like',
      emoji: '👍',
      label: 'Like',
      onClick: () => {
        console.log('Liked message:', message.id);
        // TODO: Call reaction API
      }
    },
    {
      id: 'love',
      emoji: '❤️',
      label: 'Love',
      onClick: () => {
        console.log('Loved message:', message.id);
      }
    },
    {
      id: 'laugh',
      emoji: '😂',
      label: 'Laugh',
      onClick: () => {
        console.log('Laughed at message:', message.id);
      }
    },
    {
      id: 'wow',
      emoji: '😮',
      label: 'Wow',
      onClick: () => {
        console.log('Wowed at message:', message.id);
      }
    },
    {
      id: 'sad',
      emoji: '😢',
      label: 'Sad',
      onClick: () => {
        console.log('Sad about message:', message.id);
      }
    },
    {
      id: 'fire',
      emoji: '🔥',
      label: 'Fire',
      onClick: () => {
        console.log('Fire reaction:', message.id);
      }
    }
  ];

  // Hover trigger for desktop
  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    radialMenu.open(rect.right - 40, rect.top + 20);
  };

  // Long-press trigger for mobile
  const longPress = useLongPress((x, y) => {
    radialMenu.open(x, y);
  }, 500);

  return (
    <>
      <div
        className="message-container"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={radialMenu.close}
        {...longPress}
      >
        {/* Your message content */}
        <div className="message-content">
          {message.content}
        </div>

        {/* Show existing reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="message-reactions">
            {message.reactions.map((reaction: any) => (
              <span key={reaction.id} className="reaction-badge">
                {reaction.emoji} {reaction.count}
              </span>
            ))}
          </div>
        )}
      </div>

      <RadialMenu
        items={reactionItems}
        isOpen={radialMenu.isOpen}
        onClose={radialMenu.close}
        centerX={radialMenu.position.x}
        centerY={radialMenu.position.y}
      />
    </>
  );
};

/**
 * Example 2: Message with ContextMenu for actions
 */
export const MessageWithContextMenu: React.FC<{ message: any }> = ({ message }) => {
  const contextMenu = useContextMenu();
  const { isFeatureEnabled } = useFeatures();

  // Define menu items
  const menuItems: ContextMenuItem[] = [
    {
      id: 'reply',
      label: 'Reply',
      icon: 'fa-reply',
      onClick: () => {
        console.log('Reply to message:', message.id);
        // TODO: Open reply input
      }
    },
    {
      id: 'react',
      label: 'Add Reaction',
      icon: 'fa-face-smile',
      onClick: () => {
        console.log('Open reaction menu');
        // TODO: Open radial menu
      }
    },
    {
      id: 'forward',
      label: 'Forward',
      icon: 'fa-share',
      onClick: () => {
        console.log('Forward message:', message.id);
      },
      divider: true // Divider after this item
    },
    {
      id: 'copy',
      label: 'Copy Text',
      icon: 'fa-copy',
      onClick: () => {
        navigator.clipboard.writeText(message.content);
        console.log('Copied to clipboard');
      }
    },
    {
      id: 'pin',
      label: message.pinned ? 'Unpin' : 'Pin Message',
      icon: 'fa-thumbtack',
      onClick: () => {
        console.log('Toggle pin:', message.id);
      },
      disabled: false
    },
    {
      id: 'edit',
      label: 'Edit Message',
      icon: 'fa-pencil',
      onClick: () => {
        console.log('Edit message:', message.id);
      },
      disabled: message.userId !== 'current-user-id', // Only allow editing own messages
      divider: true
    },
    {
      id: 'delete',
      label: 'Delete Message',
      icon: 'fa-trash',
      onClick: () => {
        if (confirm('Delete this message?')) {
          console.log('Delete message:', message.id);
          // TODO: Call delete API
        }
      },
      destructive: true // Red styling
    }
  ];

  // Right-click handler for desktop
  const rightClick = useRightClick((x, y) => {
    contextMenu.open(x, y);
  });

  // Long-press handler for mobile
  const longPress = useLongPressMenu((x, y) => {
    contextMenu.open(x, y);
  }, 500);

  return (
    <>
      <div
        className="message-container"
        {...rightClick}
        {...longPress}
      >
        {/* Your message content */}
        <div className="message-content">
          {message.content}
        </div>
      </div>

      <ContextMenu
        items={menuItems}
        isOpen={contextMenu.isOpen}
        onClose={contextMenu.close}
        x={contextMenu.position.x}
        y={contextMenu.position.y}
      />
    </>
  );
};

/**
 * Example 3: Message with both RadialMenu and ContextMenu
 */
export const MessageWithBothMenus: React.FC<{ message: any }> = ({ message }) => {
  const radialMenu = useRadialMenu();
  const contextMenu = useContextMenu();

  // Reaction items
  const reactionItems = [
    { id: 'like', emoji: '👍', label: 'Like', onClick: () => console.log('Like') },
    { id: 'love', emoji: '❤️', label: 'Love', onClick: () => console.log('Love') },
    { id: 'laugh', emoji: '😂', label: 'Laugh', onClick: () => console.log('Laugh') },
    { id: 'wow', emoji: '😮', label: 'Wow', onClick: () => console.log('Wow') }
  ];

  // Context menu items
  const menuItems: ContextMenuItem[] = [
    {
      id: 'react',
      label: 'Add Reaction',
      icon: 'fa-face-smile',
      onClick: () => {
        contextMenu.close();
        // Open radial menu at same position
        radialMenu.open(contextMenu.position.x, contextMenu.position.y);
      }
    },
    {
      id: 'reply',
      label: 'Reply',
      icon: 'fa-reply',
      onClick: () => console.log('Reply')
    },
    {
      id: 'copy',
      label: 'Copy',
      icon: 'fa-copy',
      onClick: () => navigator.clipboard.writeText(message.content)
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'fa-trash',
      onClick: () => console.log('Delete'),
      destructive: true
    }
  ];

  // Hover for reactions (desktop only)
  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    radialMenu.open(rect.right - 40, rect.top + 20);
  };

  // Right-click for context menu
  const rightClick = useRightClick((x, y) => {
    contextMenu.open(x, y);
  });

  // Long-press for context menu (mobile)
  const longPress = useLongPressMenu((x, y) => {
    contextMenu.open(x, y);
  }, 500);

  return (
    <>
      <div
        className="message-container"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={radialMenu.close}
        {...rightClick}
        {...longPress}
      >
        <div className="message-content">
          {message.content}
        </div>
      </div>

      {/* RadialMenu for quick reactions */}
      <RadialMenu
        items={reactionItems}
        isOpen={radialMenu.isOpen}
        onClose={radialMenu.close}
        centerX={radialMenu.position.x}
        centerY={radialMenu.position.y}
      />

      {/* ContextMenu for all actions */}
      <ContextMenu
        items={menuItems}
        isOpen={contextMenu.isOpen}
        onClose={contextMenu.close}
        x={contextMenu.position.x}
        y={contextMenu.position.y}
      />
    </>
  );
};

/**
 * Example 4: Settings Panel Integration
 */
export const MessagesWithSettings: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const { features, isFeatureEnabled } = useFeatures();

  return (
    <div className="messages-container">
      {/* Header with settings button */}
      <div className="messages-header">
        <h2>Messages</h2>

        <button
          onClick={() => setShowSettings(true)}
          className="settings-button"
          aria-label="Feature settings"
        >
          <Sliders />
          Settings
        </button>
      </div>

      {/* Messages list */}
      <div className="messages-list">
        {/* Your messages here */}
      </div>

      {/* Input with conditional features */}
      <div className="message-input">
        <textarea placeholder="Type a message..." />

        <div className="input-actions">
          {/* Always visible: Priority features */}
          {isFeatureEnabled('voiceInput') && (
            <button aria-label="Voice input">
              <Mic />
            </button>
          )}

          {/* Progressive disclosure: Advanced features */}
          {isFeatureEnabled('aiComposer') && (
            <button aria-label="AI Composer">
              <Wand2 />
            </button>
          )}

          <button aria-label="Send message">
            <Send />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <FeatureSettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

/**
 * Example 5: Feature-gated Component
 */
export const FeatureGatedComponent: React.FC = () => {
  const { isFeatureEnabled, advancedMode } = useFeatures();

  // Early return if feature not enabled
  if (!isFeatureEnabled('smartReplies')) {
    return null;
  }

  return (
    <div className="smart-replies-panel">
      <h3>Smart Replies</h3>

      {/* Basic smart replies */}
      <div className="quick-replies">
        <button>Thanks!</button>
        <button>Got it</button>
        <button>Will do</button>
      </div>

      {/* Advanced features only in advanced mode */}
      {advancedMode && (
        <div className="advanced-replies">
          <h4>AI-Generated Replies</h4>
          {/* AI-generated suggestions */}
        </div>
      )}
    </div>
  );
};

/**
 * Example 6: Custom Radial Menu (Extended)
 */
export const CustomRadialMenu: React.FC = () => {
  const radialMenu = useRadialMenu();

  // Custom items with more options
  const customItems = [
    { id: '1', emoji: '👍', label: 'Agree', onClick: () => {} },
    { id: '2', emoji: '❤️', label: 'Love', onClick: () => {} },
    { id: '3', emoji: '😂', label: 'Funny', onClick: () => {} },
    { id: '4', emoji: '😮', label: 'Surprise', onClick: () => {} },
    { id: '5', emoji: '😢', label: 'Sad', onClick: () => {} },
    { id: '6', emoji: '😡', label: 'Angry', onClick: () => {} },
    { id: '7', emoji: '🔥', label: 'Hot take', onClick: () => {} },
    { id: '8', emoji: '💯', label: 'Perfect', onClick: () => {} },
    { id: '9', emoji: '🎉', label: 'Celebrate', onClick: () => {} },
    { id: '10', emoji: '🤔', label: 'Thinking', onClick: () => {} }
  ];

  return (
    <>
      <button onClick={(e) => radialMenu.open(e.clientX, e.clientY)}>
        Open Custom Menu
      </button>

      <RadialMenu
        items={customItems}
        isOpen={radialMenu.isOpen}
        onClose={radialMenu.close}
        centerX={radialMenu.position.x}
        centerY={radialMenu.position.y}
        radius={120} // Larger radius for more items
      />
    </>
  );
};

/**
 * Example 7: Keyboard Shortcut Integration
 */
export const MessageWithKeyboardShortcuts: React.FC<{ message: any }> = ({ message }) => {
  const contextMenu = useContextMenu();

  // Listen for keyboard shortcuts
  React.useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + M = Open context menu
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'm') {
        e.preventDefault();
        // Open at center of message element
        const element = document.querySelector(`[data-message-id="${message.id}"]`);
        if (element) {
          const rect = element.getBoundingClientRect();
          contextMenu.open(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, [message.id, contextMenu]);

  const menuItems: ContextMenuItem[] = [
    { id: 'reply', label: 'Reply (R)', icon: 'fa-reply', onClick: () => {} },
    { id: 'copy', label: 'Copy (C)', icon: 'fa-copy', onClick: () => {} },
    { id: 'delete', label: 'Delete (Del)', icon: 'fa-trash', onClick: () => {}, destructive: true }
  ];

  return (
    <>
      <div data-message-id={message.id} className="message-container">
        {message.content}
      </div>

      <ContextMenu
        items={menuItems}
        isOpen={contextMenu.isOpen}
        onClose={contextMenu.close}
        x={contextMenu.position.x}
        y={contextMenu.position.y}
      />
    </>
  );
};

export default {
  MessageWithReactions,
  MessageWithContextMenu,
  MessageWithBothMenus,
  MessagesWithSettings,
  FeatureGatedComponent,
  CustomRadialMenu,
  MessageWithKeyboardShortcuts
};
