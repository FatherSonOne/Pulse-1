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
