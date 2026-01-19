import React, { createContext, useContext, useEffect, useState } from 'react';
import { encryptionService, KeyPair } from '../services/encryption';
import { supabaseService } from '../services/supabase';
import { useChatStore } from '../store/chatstore';
import { v4 as uuidv4 } from 'uuid';

interface ChatContextType {
  // Workspace
  workspaceId: string | null;
  createWorkspace: (durationMinutes: number) => Promise<void | (() => void)>;
  
  // User
  userId: string | null;
  userKeys: KeyPair | null;
  initializeUser: () => Promise<void>;
  
  // Messages
  messages: Array<{
    id: string;
    senderId: string;
    content: string;
    timestamp: Date;
  }>;
  sendMessage: (content: string) => Promise<void>;
  
  // Status
  isLoading: boolean;
  error: string | null;
  isWorkspaceActive: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userKeys, setUserKeys] = useState<KeyPair | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWorkspaceActive, setIsWorkspaceActive] = useState(true);

  // Initialize user with encryption keys
  const initializeUser = async () => {
    try {
      setIsLoading(true);
      const newUserId = `user_${uuidv4()}`;
      const keys = await encryptionService.generateKeyPair();
      
      setUserId(newUserId);
      setUserKeys(keys);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize user');
    } finally {
      setIsLoading(false);
    }
  };

  // Create ephemeral workspace
  const createWorkspace = async (durationMinutes: number) => {
    try {
      setIsLoading(true);
      if (!userId) throw new Error('User not initialized');

      const workspace = await supabaseService.createWorkspace(durationMinutes);
      setWorkspaceId(workspace.id);
      setError(null);

      // Set up real-time listener
      const subscription = supabaseService.subscribeToMessages(
        workspace.id,
        handleNewMessage
      );

      return () => subscription.unsubscribe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle new messages (real-time)
  const handleNewMessage = async (encryptedMsg: any) => {
    try {
      if (!userKeys) return;

      // Decrypt message
      const decrypted = await encryptionService.decryptMessage(
        {
          ciphertext: encryptedMsg.encrypted_content,
          nonce: encryptedMsg.nonce,
          senderPublicKey: encryptedMsg.sender_id,
        },
        encryptedMsg.sender_id,
        userKeys.secretKey
      );

      setMessages((prev) => [
        ...prev,
        {
          id: encryptedMsg.id,
          senderId: encryptedMsg.sender_id,
          content: decrypted,
          timestamp: new Date(encryptedMsg.created_at),
        },
      ]);
    } catch (err) {
      console.error('Failed to decrypt message:', err);
    }
  };

  // Send encrypted message
  const sendMessage = async (content: string) => {
    try {
      if (!workspaceId || !userId || !userKeys) {
        throw new Error('Workspace or user not initialized');
      }

      setIsLoading(true);

      // Encrypt message (for now, encrypt for self)
      const encrypted = await encryptionService.encryptMessage(
        content,
        userKeys.publicKey,
        userKeys.secretKey
      );

      // Store in Supabase
      const message = await supabaseService.storeMessage(
        workspaceId,
        userId,
        encrypted.ciphertext,
        encrypted.nonce
      );

      // Add to local state
      setMessages((prev) => [
        ...prev,
        {
          id: message.id,
          senderId: userId,
          content: content,
          timestamp: new Date(message.created_at),
        },
      ]);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  // Check workspace activity
  useEffect(() => {
    if (!workspaceId) return;

    const checkInterval = setInterval(async () => {
      const isActive = await supabaseService.isWorkspaceActive(workspaceId);
      setIsWorkspaceActive(isActive);
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkInterval);
  }, [workspaceId]);

  const value: ChatContextType = {
    workspaceId,
    createWorkspace,
    userId,
    userKeys,
    initializeUser,
    messages,
    sendMessage,
    isLoading,
    error,
    isWorkspaceActive,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
};
