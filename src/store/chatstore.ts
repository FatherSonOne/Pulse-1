import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  publicKey: string;
  secretKey: string;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  encrypted: boolean;
}

interface ChatStore {
  // User state
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  
  // Workspace state
  workspaceId: string | null;
  setWorkspaceId: (id: string) => void;
  
  // Messages state
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  
  // Settings
  workspaceDuration: number;
  setWorkspaceDuration: (minutes: number) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  // User
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  
  // Workspace
  workspaceId: null,
  setWorkspaceId: (id) => set({ workspaceId: id }),
  
  // Messages
  messages: [],
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  clearMessages: () => set({ messages: [] }),
  
  // Settings
  workspaceDuration: parseInt(import.meta.env.VITE_WORKSPACE_DURATION_MINUTES || '60'),
  setWorkspaceDuration: (minutes) => set({ workspaceDuration: minutes }),
}));
