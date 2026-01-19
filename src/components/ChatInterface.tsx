import React, { useEffect, useRef, useState } from 'react';
import { useChatContext } from '../context/ChatContext';
import './ChatInterface.css';

export const ChatInterface: React.FC = () => {
  const {
    workspaceId,
    userId,
    userKeys,
    messages,
    sendMessage,
    isLoading,
    error,
    isWorkspaceActive,
    createWorkspace,
    initializeUser,
  } = useChatContext();

  const [messageText, setMessageText] = useState('');
  const [workspaceDuration, setWorkspaceDuration] = useState(60);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize on mount
  useEffect(() => {
    initializeUser();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateWorkspace = async () => {
    await createWorkspace(workspaceDuration);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    await sendMessage(messageText);
    setMessageText('');
  };

  return (
    <div className="chat-interface">
      {/* Header */}
      <div className="chat-header">
        <h1>🔐 Pulse E2EE Chat</h1>
        {workspaceId && (
          <div className="workspace-info">
            <span className={`status ${isWorkspaceActive ? 'active' : 'inactive'}`}>
              {isWorkspaceActive ? '🟢 Active' : '🔴 Expired'}
            </span>
            <code className="workspace-id">ID: {workspaceId.substring(0, 8)}...</code>
          </div>
        )}
      </div>

      {/* User Info */}
      {userId && userKeys && (
        <div className="user-info">
          <p><strong>User ID:</strong> {userId.substring(0, 16)}...</p>
          <p><strong>Encryption:</strong> ✅ Enabled (libsodium.js)</p>
        </div>
      )}

      {/* Workspace Setup */}
      {!workspaceId ? (
        <div className="workspace-setup">
          <h2>Create Ephemeral Workspace</h2>
          <div className="setup-form">
            <label>
              Duration (minutes):
              <input
                type="number"
                min="1"
                max="1440"
                value={workspaceDuration}
                onChange={(e) => setWorkspaceDuration(parseInt(e.target.value))}
              />
            </label>
            <button
              onClick={handleCreateWorkspace}
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Messages Display */}
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-state">
                <p>📭 No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message ${msg.senderId === userId ? 'sent' : 'received'}`}
                >
                  <div className="message-header">
                    <span className="sender-id">
                      {msg.senderId.substring(0, 12)}...
                    </span>
                    <span className="timestamp">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="message-input-form">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your encrypted message..."
              disabled={isLoading || !isWorkspaceActive}
              className="message-input"
            />
            <button
              type="submit"
              disabled={isLoading || !isWorkspaceActive || !messageText.trim()}
              className="btn-send"
            >
              {isLoading ? '⏳' : '🔒 Send'}
            </button>
          </form>

          {!isWorkspaceActive && (
            <div className="alert alert-warning">
              ⚠️ This workspace has expired. No new messages can be sent.
            </div>
          )}
        </>
      )}

      {/* Error Display */}
      {error && (
        <div className="alert alert-error">
          ❌ {error}
        </div>
      )}
    </div>
  );
};
