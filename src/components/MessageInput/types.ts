// src/components/MessageInput/types.ts
// Type definitions for MessageInput components

export interface MessageInputProps {
  onSend: (text: string, attachments?: AttachmentFile[]) => void;
  onTyping?: (isTyping: boolean) => void;
  placeholder?: string;
  aiEnabled?: boolean;
  voiceEnabled?: boolean;
  maxLength?: number;
  /** Max attachment size in bytes; defaults to 25 MB. */
  maxAttachmentBytes?: number;
  channelId?: string;
  /** API key for AI features (smart replies / tone analysis). When absent, AI features are inert. */
  apiKey?: string | null;
  disabled?: boolean;
  initialValue?: string;
  setActiveToolOverlay?: (overlayType: 'analytics' | 'collaboration' | 'productivity' | 'intelligence' | 'proactive' | 'communication' | 'personalization' | 'security' | 'mediaHub') => void;
  /**
   * Slash-command launcher for tools that toggle an inline composer
   * panel (Smart Compose, AI Coach, AI Mediator, Voice Note, Schedule,
   * Smart Reply, Proposal Mode). When provided, the slash dispatcher
   * routes inline-panel tool IDs here instead of (or before) the
   * overlay map. See `INLINE_PANEL_TOOLS` in services/toolRegistry.ts.
   */
  onInlinePanelLaunch?: (toolId: string) => void;
}

export interface AISuggestion {
  id: string;
  text: string;
  confidence: number; // 0-100
  confidenceLevel: 'high' | 'medium' | 'low';
  reasoning?: string;
}

export interface ToneAnalysis {
  tone: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentiment: number; // -1 to 1
  confidence: number; // 0-1
  metrics?: {
    formality: number;
    emotionality: number;
    urgency: number;
  };
}

export interface FormattingAction {
  type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'link' | 'list' | 'quote';
  shortcut?: string;
}

export interface AttachmentFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'video' | 'audio' | 'document';
  size: number;
  name: string;
}

export interface DraftState {
  text: string;
  lastSaved: Date;
  status: 'idle' | 'saving' | 'saved' | 'error';
}

export interface AIComposerProps {
  suggestions: AISuggestion[];
  isLoading: boolean;
  onAcceptSuggestion: (suggestion: AISuggestion) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onClose: () => void;
}

export interface ToneAnalyzerProps {
  analysis: ToneAnalysis | null;
  isAnalyzing: boolean;
  onClick?: () => void;
}

export interface FormattingToolbarProps {
  onFormat: (action: FormattingAction) => void;
  activeFormats: Set<string>;
  onEmojiClick: () => void;
  onAttachmentClick: () => void;
  onAIAssist: () => void;
  aiEnabled: boolean;
}

export interface AttachmentPreviewProps {
  attachments: AttachmentFile[];
  onRemove: (id: string) => void;
  maxFileSize?: number;
}

export interface KeyboardShortcut {
  key: string;
  modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[];
  action: () => void;
  description: string;
}
