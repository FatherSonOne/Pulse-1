// src/types/messages.ts
export interface MessageChannel {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  unread_count?: number;
  last_message?: string;
  last_message_at?: string;
  members?: ChannelMember[];
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'voice';
  attachments?: MessageAttachment[];
  thread_id?: string;
  thread_count?: number;
  edited_at?: string;
  created_at: string;
  is_pinned: boolean;
  reactions?: { [emoji: string]: string[] };
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'file' | 'voice' | 'video';
  url: string;
  name: string;
  size?: number;
  mime_type?: string;
  thumbnail_url?: string;
}

export interface MessageDraft {
  id: string;
  user_id: string;
  channel_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface MessageReaction {
  emoji: string;
  users: string[];
  count: number;
}

export interface ThreadMessage extends ChannelMessage {
  parent_id: string;
  replies?: ChannelMessage[];
}

// =====================================================
// ECOSYSTEM BRIDGE — Bot Message Types
// =====================================================

export type BotMessageType = 'text' | 'meeting_recap' | 'action_items' | 'alert' | 'card';

export interface BotAction {
  label: string;
  action: 'open_meeting' | 'view_task' | 'approve' | 'sync_crm' | 'custom';
  url?: string;
}

export interface BotMessageMetadata {
  meetingId?: string;
  actionItemIds?: string[];
  automationId?: string;
  sourceUrl?: string;
  actionItems?: Array<{
    id?: string;
    description: string;
    assignee?: string;
    priority?: string;
    dueDate?: string;
  }>;
  keyDecisions?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  agentActionId?: string;
  taskId?: string;
  [key: string]: any;
}

/** Bot message — extends ChannelMessage with bot-specific fields */
export interface BotChannelMessage extends ChannelMessage {
  is_bot_message: true;
  bot_content: string;         // Plaintext content (not E2EE)
  bot_app: string;             // 'entomate' | 'logos_vision'
  bot_message_type: BotMessageType;
  bot_metadata: BotMessageMetadata;
  bot_actions: BotAction[];
}

/** Union type for message list rendering */
export type AnyChannelMessage = ChannelMessage | BotChannelMessage;

export function isBotMessage(msg: AnyChannelMessage): msg is BotChannelMessage {
  return (msg as BotChannelMessage).is_bot_message === true;
}

// =====================================================
// ECOSYSTEM CONFIG TYPES
// =====================================================

export interface EcosystemConfig {
  id: string;
  app_name: 'entomate' | 'logos_vision' | 'pulse';
  api_url: string;
  service_token: string;
  inbound_token: string;
  enabled: boolean;
  features: Record<string, boolean>;
  last_heartbeat?: string;
  created_at: string;
  updated_at: string;
}

export interface EcosystemEvent {
  id: string;
  event_id: string;
  source: string;
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  direction: 'inbound' | 'outbound';
  status: 'received' | 'processed' | 'failed' | 'ignored';
  payload?: Record<string, any>;
  error_message?: string;
  processing_time_ms?: number;
  created_at: string;
}

export interface EcosystemBotChannel {
  id: string;
  workspace_id: string;
  bot_app: string;
  channel_id: string;
  channel_purpose: string;
  created_at: string;
}
