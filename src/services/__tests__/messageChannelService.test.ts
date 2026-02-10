// src/services/__tests__/messageChannelService.test.ts
// Comprehensive unit tests for Message Channel Service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messageChannelService } from '../messageChannelService';
import type { ChannelMessage, MessageChannel, ChannelMember } from '../../types/messages';
import { createMockQueryBuilder } from './helpers/supabaseMock';

// Mock dependencies
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      limit: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
  },
}));

vi.mock('../geminiService', () => ({
  generateSmartReply: vi.fn(),
  analyzeDraftIntent: vi.fn(),
}));

describe('MessageChannelService - Channel Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChannels', () => {
    it('should fetch all channels for a workspace', async () => {
      const { supabase } = await import('../supabase');
      const mockChannels: MessageChannel[] = [
        {
          id: 'channel-1',
          workspace_id: 'workspace-1',
          name: 'General',
          description: 'General discussion',
          is_group: false,
          is_public: true,
          created_at: new Date().toISOString(),
          created_by: 'user-1',
        },
        {
          id: 'channel-2',
          workspace_id: 'workspace-1',
          name: 'Engineering',
          description: 'Engineering team',
          is_group: true,
          is_public: false,
          created_at: new Date().toISOString(),
          created_by: 'user-1',
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder({ data: mockChannels, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      const result = await messageChannelService.getChannels('workspace-1');

      expect(result).toEqual(mockChannels);
      expect(supabase.from).toHaveBeenCalledWith('message_channels');
    });

    it('should throw error if fetch fails', async () => {
      const { supabase } = await import('../supabase');
      const mockError = new Error('Database error');

      const mockQueryBuilder = createMockQueryBuilder({ data: null, error: mockError });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      await expect(messageChannelService.getChannels('workspace-1')).rejects.toThrow('Database error');
    });

    it('should order channels by created_at ascending', async () => {
      const { supabase } = await import('../supabase');

      const mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      await messageChannelService.getChannels('workspace-1');

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    });
  });

  describe('getChannel', () => {
    it('should fetch a single channel by ID', async () => {
      const { supabase } = await import('../supabase');
      const mockChannel: MessageChannel = {
        id: 'channel-1',
        workspace_id: 'workspace-1',
        name: 'General',
        description: 'General discussion',
        is_group: false,
        is_public: true,
        created_at: new Date().toISOString(),
        created_by: 'user-1',
      };

      const mockQueryBuilder = createMockQueryBuilder({ data: mockChannel, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      const result = await messageChannelService.getChannel('channel-1');

      expect(result).toEqual(mockChannel);
    });

    it('should return null if channel not found', async () => {
      const { supabase } = await import('../supabase');

      const mockQueryBuilder = createMockQueryBuilder({ data: null, error: new Error('Not found') });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      const result = await messageChannelService.getChannel('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createChannel', () => {
    it('should create a new channel with all fields', async () => {
      const { supabase } = await import('../supabase');
      const mockChannel: MessageChannel = {
        id: 'channel-new',
        workspace_id: 'workspace-1',
        name: 'New Channel',
        description: 'A new channel',
        is_group: false,
        is_public: true,
        created_at: new Date().toISOString(),
        created_by: 'user-1',
      };

      const mockQueryBuilder = createMockQueryBuilder({ data: mockChannel, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      const result = await messageChannelService.createChannel(
        'workspace-1',
        'New Channel',
        'A new channel',
        false,
        'user-1'
      );

      expect(result).toEqual(mockChannel);
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it('should create a private group channel', async () => {
      const { supabase } = await import('../supabase');
      const mockChannel: MessageChannel = {
        id: 'channel-private',
        workspace_id: 'workspace-1',
        name: 'Private Group',
        description: 'Private discussion',
        is_group: true,
        is_public: false,
        created_at: new Date().toISOString(),
        created_by: 'user-1',
      };

      const mockQueryBuilder = createMockQueryBuilder({ data: mockChannel, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      const result = await messageChannelService.createChannel(
        'workspace-1',
        'Private Group',
        'Private discussion',
        true,
        'user-1'
      );

      expect(result.is_group).toBe(true);
      expect(result.is_public).toBe(false);
    });

    it('should throw error if creation fails', async () => {
      const { supabase } = await import('../supabase');
      const mockError = new Error('Creation failed');

      const mockQueryBuilder = createMockQueryBuilder({ data: null, error: mockError });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      await expect(
        messageChannelService.createChannel('workspace-1', 'Fail Channel')
      ).rejects.toThrow('Creation failed');
    });
  });

  describe('updateChannel', () => {
    it('should update channel with partial data', async () => {
      const { supabase } = await import('../supabase');
      const mockChannel: MessageChannel = {
        id: 'channel-1',
        workspace_id: 'workspace-1',
        name: 'Updated Name',
        description: 'Updated description',
        is_group: false,
        is_public: true,
        created_at: new Date().toISOString(),
        created_by: 'user-1',
      };

      const mockQueryBuilder = createMockQueryBuilder({ data: mockChannel, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      const result = await messageChannelService.updateChannel('channel-1', {
        name: 'Updated Name',
        description: 'Updated description',
      });

      expect(result.name).toBe('Updated Name');
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });

    it('should include updated_at timestamp', async () => {
      const { supabase } = await import('../supabase');
      const mockChannel: MessageChannel = {
        id: 'channel-1',
        workspace_id: 'workspace-1',
        name: 'Test',
        description: 'Test',
        is_group: false,
        is_public: true,
        created_at: new Date().toISOString(),
        created_by: 'user-1',
        updated_at: new Date().toISOString(),
      };

      const mockQueryBuilder = createMockQueryBuilder({ data: mockChannel, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      await messageChannelService.updateChannel('channel-1', { name: 'Test' });

      expect(mockQueryBuilder.update).toHaveBeenCalled();
      const updateCall = mockQueryBuilder.update.mock.calls[0][0];
      expect(updateCall).toHaveProperty('updated_at');
    });
  });

  describe('deleteChannel', () => {
    it('should delete a channel by ID', async () => {
      const { supabase } = await import('../supabase');

      const mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      await messageChannelService.deleteChannel('channel-1');

      expect(supabase.from).toHaveBeenCalledWith('message_channels');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it('should throw error if deletion fails', async () => {
      const { supabase } = await import('../supabase');
      const mockError = new Error('Deletion failed');

      const mockQueryBuilder = createMockQueryBuilder({ data: null, error: mockError });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      await expect(messageChannelService.deleteChannel('channel-1')).rejects.toThrow('Deletion failed');
    });
  });
});

describe('MessageChannelService - Member Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChannelMembers', () => {
    it('should fetch all members for a channel', async () => {
      const { supabase } = await import('../supabase');
      const mockMembers: ChannelMember[] = [
        {
          id: 'member-1',
          channel_id: 'channel-1',
          user_id: 'user-1',
          role: 'admin',
          joined_at: new Date().toISOString(),
        },
        {
          id: 'member-2',
          channel_id: 'channel-1',
          user_id: 'user-2',
          role: 'member',
          joined_at: new Date().toISOString(),
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder({ data: mockMembers, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      const result = await messageChannelService.getChannelMembers('channel-1');

      expect(result).toEqual(mockMembers);
      expect(supabase.from).toHaveBeenCalledWith('channel_members');
    });
  });

  describe('addChannelMember', () => {
    it('should add a member with default role', async () => {
      const { supabase } = await import('../supabase');
      const mockMember: ChannelMember = {
        id: 'member-new',
        channel_id: 'channel-1',
        user_id: 'user-3',
        role: 'member',
        joined_at: new Date().toISOString(),
      };

      const mockQueryBuilder = createMockQueryBuilder({ data: mockMember, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      const result = await messageChannelService.addChannelMember('channel-1', 'user-3');

      expect(result.role).toBe('member');
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it('should add a member with admin role', async () => {
      const { supabase } = await import('../supabase');
      const mockMember: ChannelMember = {
        id: 'member-new',
        channel_id: 'channel-1',
        user_id: 'user-3',
        role: 'admin',
        joined_at: new Date().toISOString(),
      };

      const mockQueryBuilder = createMockQueryBuilder({ data: mockMember, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      const result = await messageChannelService.addChannelMember('channel-1', 'user-3', 'admin');

      expect(result.role).toBe('admin');
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role to admin', async () => {
      const { supabase } = await import('../supabase');

      const mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      await messageChannelService.updateMemberRole('channel-1', 'user-2', 'admin');

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ role: 'admin' });
    });
  });
});

// Simplified message operations tests
describe('MessageChannelService - Message Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMessages', () => {
    it('should fetch messages for a channel with default limit', async () => {
      const { supabase } = await import('../supabase');
      const mockMessages: ChannelMessage[] = [
        {
          id: 'msg-1',
          channel_id: 'channel-1',
          sender_id: 'user-1',
          sender_name: 'Alice',
          content: 'Hello',
          message_type: 'text',
          created_at: new Date().toISOString(),
          is_pinned: false,
          reactions: {},
        },
      ];

      const mockQueryBuilder = createMockQueryBuilder({ data: mockMessages.reverse(), error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      const result = await messageChannelService.getMessages('channel-1');

      expect(Array.isArray(result)).toBe(true);
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('sendMessage', () => {
    it('should send a text message', async () => {
      const { supabase } = await import('../supabase');
      const mockMessage: ChannelMessage = {
        id: 'msg-new',
        channel_id: 'channel-1',
        sender_id: 'user-1',
        sender_name: 'Alice',
        content: 'New message',
        message_type: 'text',
        created_at: new Date().toISOString(),
        is_pinned: false,
        reactions: {},
      };

      const mockQueryBuilder = createMockQueryBuilder({ data: mockMessage, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

      const result = await messageChannelService.sendMessage(
        'channel-1',
        'user-1',
        'Alice',
        'New message'
      );

      expect(result.content).toBe('New message');
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });
  });
});

describe('MessageChannelService - Error Handling', () => {
  it('should handle network errors gracefully', async () => {
    const { supabase } = await import('../supabase');
    const mockError = new Error('Network error');

    const mockQueryBuilder = createMockQueryBuilder({ data: null, error: mockError });
    vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

    await expect(messageChannelService.getMessages('channel-1')).rejects.toThrow();
  });

  it('should handle database constraint errors', async () => {
    const { supabase } = await import('../supabase');
    const mockError = new Error('Duplicate key');

    const mockQueryBuilder = createMockQueryBuilder({ data: null, error: mockError });
    vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

    await expect(
      messageChannelService.createChannel('workspace-1', 'Duplicate')
    ).rejects.toThrow('Duplicate key');
  });
});

describe('MessageChannelService - Performance', () => {
  it('should handle large message lists efficiently', async () => {
    const { supabase } = await import('../supabase');
    const largeMessageList = Array.from({ length: 1000 }, (_, i) => ({
      id: `msg-${i}`,
      channel_id: 'channel-1',
      sender_id: 'user-1',
      sender_name: 'User',
      content: `Message ${i}`,
      message_type: 'text' as const,
      created_at: new Date().toISOString(),
      is_pinned: false,
      reactions: {},
    }));

    const mockQueryBuilder = createMockQueryBuilder({ data: largeMessageList, error: null });
    vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder);

    const start = Date.now();
    const result = await messageChannelService.getMessages('channel-1');
    const duration = Date.now() - start;

    expect(Array.isArray(result)).toBe(true);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});
