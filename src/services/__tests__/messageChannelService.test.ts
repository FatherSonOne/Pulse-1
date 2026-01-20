// src/services/__tests__/messageChannelService.test.ts
// Comprehensive unit tests for Message Channel Service

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { messageChannelService } from '../messageChannelService';
import type { ChannelMessage, MessageChannel, ChannelMember } from '../../types/messages';

// Mock dependencies
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
      return mockQuery;
    }),
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

      vi.mocked(supabase.from('message_channels').select as any).mockResolvedValue({
        data: mockChannels,
        error: null,
      });

      const result = await messageChannelService.getChannels('workspace-1');

      expect(result).toEqual(mockChannels);
      expect(supabase.from).toHaveBeenCalledWith('message_channels');
      expect(supabase.from('message_channels').select).toHaveBeenCalledWith('*');
    });

    it('should throw error if fetch fails', async () => {
      const { supabase } = await import('../supabase');
      const mockError = new Error('Database error');

      vi.mocked(supabase.from('message_channels').select as any).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(messageChannelService.getChannels('workspace-1')).rejects.toThrow('Database error');
    });

    it('should order channels by created_at ascending', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('message_channels').select as any).mockResolvedValue({
        data: [],
        error: null,
      });

      await messageChannelService.getChannels('workspace-1');

      expect(supabase.from('message_channels').order).toHaveBeenCalledWith('created_at', { ascending: true });
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

      vi.mocked(supabase.from('message_channels').select().eq().single as any).mockResolvedValue({
        data: mockChannel,
        error: null,
      });

      const result = await messageChannelService.getChannel('channel-1');

      expect(result).toEqual(mockChannel);
    });

    it('should return null if channel not found', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('message_channels').select().eq().single as any).mockResolvedValue({
        data: null,
        error: new Error('Not found'),
      });

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

      vi.mocked(supabase.from('message_channels').insert as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockChannel,
            error: null,
          }),
        }),
      });

      const result = await messageChannelService.createChannel(
        'workspace-1',
        'New Channel',
        'A new channel',
        false,
        'user-1'
      );

      expect(result).toEqual(mockChannel);
      expect(supabase.from('message_channels').insert).toHaveBeenCalledWith([
        {
          workspace_id: 'workspace-1',
          name: 'New Channel',
          description: 'A new channel',
          is_group: false,
          is_public: true,
          created_by: 'user-1',
        },
      ]);
    });

    it('should create a private group channel', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('message_channels').insert as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'channel-1' },
            error: null,
          }),
        }),
      });

      await messageChannelService.createChannel('workspace-1', 'Private Group', undefined, true);

      expect(supabase.from('message_channels').insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            is_group: true,
            is_public: false,
          }),
        ])
      );
    });

    it('should throw error if creation fails', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('message_channels').insert as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Creation failed'),
          }),
        }),
      });

      await expect(
        messageChannelService.createChannel('workspace-1', 'Fail Channel')
      ).rejects.toThrow('Creation failed');
    });
  });

  describe('updateChannel', () => {
    it('should update channel with partial data', async () => {
      const { supabase } = await import('../supabase');
      const mockUpdated: MessageChannel = {
        id: 'channel-1',
        workspace_id: 'workspace-1',
        name: 'Updated Name',
        description: 'Updated description',
        is_group: false,
        is_public: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user-1',
      };

      vi.mocked(supabase.from('message_channels').update as any).mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockUpdated,
              error: null,
            }),
          }),
        }),
      });

      const result = await messageChannelService.updateChannel('channel-1', {
        name: 'Updated Name',
        description: 'Updated description',
      });

      expect(result).toEqual(mockUpdated);
      expect(supabase.from('message_channels').update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          description: 'Updated description',
          updated_at: expect.any(String),
        })
      );
    });

    it('should include updated_at timestamp', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('message_channels').update as any).mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {},
              error: null,
            }),
          }),
        }),
      });

      await messageChannelService.updateChannel('channel-1', { name: 'New Name' });

      const updateCall = vi.mocked(supabase.from('message_channels').update).mock.calls[0][0];
      expect(updateCall).toHaveProperty('updated_at');
      expect(typeof updateCall.updated_at).toBe('string');
    });
  });

  describe('deleteChannel', () => {
    it('should delete a channel by ID', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('message_channels').delete as any).mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      await expect(messageChannelService.deleteChannel('channel-1')).resolves.not.toThrow();

      expect(supabase.from).toHaveBeenCalledWith('message_channels');
      expect(supabase.from('message_channels').delete).toHaveBeenCalled();
    });

    it('should throw error if deletion fails', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('message_channels').delete as any).mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: new Error('Deletion failed'),
        }),
      });

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

      vi.mocked(supabase.from('channel_members').select as any).mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: mockMembers,
          error: null,
        }),
      });

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

      vi.mocked(supabase.from('channel_members').insert as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockMember,
            error: null,
          }),
        }),
      });

      const result = await messageChannelService.addChannelMember('channel-1', 'user-3');

      expect(result).toEqual(mockMember);
      expect(supabase.from('channel_members').insert).toHaveBeenCalledWith([
        {
          channel_id: 'channel-1',
          user_id: 'user-3',
          role: 'member',
        },
      ]);
    });

    it('should add a member with admin role', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('channel_members').insert as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null,
          }),
        }),
      });

      await messageChannelService.addChannelMember('channel-1', 'user-3', 'admin');

      expect(supabase.from('channel_members').insert).toHaveBeenCalledWith([
        expect.objectContaining({ role: 'admin' }),
      ]);
    });
  });

  describe('removeChannelMember', () => {
    it('should remove a member from channel', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('channel_members').delete as any).mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      await expect(
        messageChannelService.removeChannelMember('channel-1', 'user-2')
      ).resolves.not.toThrow();
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role to admin', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('channel_members').update as any).mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      await messageChannelService.updateMemberRole('channel-1', 'user-2', 'admin');

      expect(supabase.from('channel_members').update).toHaveBeenCalledWith({ role: 'admin' });
    });
  });
});

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

      vi.mocked(supabase.from('messages').select as any).mockResolvedValue({
        data: mockMessages,
        error: null,
      });

      const result = await messageChannelService.getMessages('channel-1');

      expect(result).toEqual(mockMessages.reverse());
      expect(supabase.from('messages').limit).toHaveBeenCalledWith(50);
    });

    it('should fetch messages with custom limit', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('messages').select as any).mockResolvedValue({
        data: [],
        error: null,
      });

      await messageChannelService.getMessages('channel-1', 100);

      expect(supabase.from('messages').limit).toHaveBeenCalledWith(100);
    });

    it('should fetch messages before a specific timestamp', async () => {
      const { supabase } = await import('../supabase');
      const beforeDate = new Date().toISOString();

      vi.mocked(supabase.from('messages').select as any).mockResolvedValue({
        data: [],
        error: null,
      });

      await messageChannelService.getMessages('channel-1', 50, beforeDate);

      expect(supabase.from('messages').lt).toHaveBeenCalledWith('created_at', beforeDate);
    });

    it('should only fetch top-level messages (no threads)', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('messages').select as any).mockResolvedValue({
        data: [],
        error: null,
      });

      await messageChannelService.getMessages('channel-1');

      expect(supabase.from('messages').is).toHaveBeenCalledWith('thread_id', null);
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
        content: 'Hello world',
        message_type: 'text',
        created_at: new Date().toISOString(),
        is_pinned: false,
        reactions: {},
      };

      vi.mocked(supabase.from('messages').insert as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockMessage,
            error: null,
          }),
        }),
      });

      const result = await messageChannelService.sendMessage(
        'channel-1',
        'user-1',
        'Hello world'
      );

      expect(result).toEqual(mockMessage);
      expect(supabase.from('messages').insert).toHaveBeenCalledWith([
        {
          channel_id: 'channel-1',
          sender_id: 'user-1',
          content: 'Hello world',
          message_type: 'text',
          attachments: [],
          thread_id: undefined,
        },
      ]);
    });

    it('should send a message with attachments', async () => {
      const { supabase } = await import('../supabase');
      const attachments = [
        { url: 'file1.pdf', type: 'file', name: 'document.pdf' },
      ];

      vi.mocked(supabase.from('messages').insert as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'msg-1' },
            error: null,
          }),
        }),
      });

      await messageChannelService.sendMessage(
        'channel-1',
        'user-1',
        'Check this out',
        'file',
        attachments
      );

      expect(supabase.from('messages').insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            attachments,
            message_type: 'file',
          }),
        ])
      );
    });

    it('should send a threaded reply', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('messages').insert as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'msg-reply' },
            error: null,
          }),
        }),
      });

      await messageChannelService.sendMessage(
        'channel-1',
        'user-1',
        'Reply to thread',
        'text',
        [],
        'thread-1'
      );

      expect(supabase.from('messages').insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            thread_id: 'thread-1',
          }),
        ])
      );
    });
  });

  describe('editMessage', () => {
    it('should edit message content', async () => {
      const { supabase } = await import('../supabase');
      const mockEdited: ChannelMessage = {
        id: 'msg-1',
        channel_id: 'channel-1',
        sender_id: 'user-1',
        sender_name: 'Alice',
        content: 'Edited content',
        message_type: 'text',
        created_at: new Date().toISOString(),
        edited_at: new Date().toISOString(),
        is_pinned: false,
        reactions: {},
      };

      vi.mocked(supabase.from('messages').update as any).mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockEdited,
              error: null,
            }),
          }),
        }),
      });

      const result = await messageChannelService.editMessage('msg-1', 'Edited content');

      expect(result.content).toBe('Edited content');
      expect(result.edited_at).toBeDefined();
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('messages').delete as any).mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      await expect(messageChannelService.deleteMessage('msg-1')).resolves.not.toThrow();
    });
  });

  describe('pinMessage', () => {
    it('should pin a message', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('messages').update as any).mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      await messageChannelService.pinMessage('msg-1', true);

      expect(supabase.from('messages').update).toHaveBeenCalledWith({ is_pinned: true });
    });

    it('should unpin a message', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('messages').update as any).mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      await messageChannelService.pinMessage('msg-1', false);

      expect(supabase.from('messages').update).toHaveBeenCalledWith({ is_pinned: false });
    });
  });

  describe('Reactions', () => {
    it('should add a reaction to a message', async () => {
      const { supabase } = await import('../supabase');

      // Mock getting current reactions
      vi.mocked(supabase.from('messages').select as any).mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { reactions: {} },
            error: null,
          }),
        }),
      });

      // Mock updating reactions
      vi.mocked(supabase.from('messages').update as any).mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      await messageChannelService.addReaction('msg-1', '👍', 'user-1');

      expect(supabase.from('messages').update).toHaveBeenCalledWith(
        expect.objectContaining({
          reactions: expect.objectContaining({
            '👍': expect.arrayContaining(['user-1']),
          }),
        })
      );
    });

    it('should not duplicate user reactions', async () => {
      const { supabase } = await import('../supabase');

      // Mock existing reaction from same user
      vi.mocked(supabase.from('messages').select as any).mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { reactions: { '👍': ['user-1'] } },
            error: null,
          }),
        }),
      });

      vi.mocked(supabase.from('messages').update as any).mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      await messageChannelService.addReaction('msg-1', '👍', 'user-1');

      // Should still only have one reaction from user-1
      const updateCall = vi.mocked(supabase.from('messages').update).mock.calls[0][0];
      expect(updateCall.reactions['👍']).toEqual(['user-1']);
    });
  });
});

describe('MessageChannelService - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle network errors gracefully', async () => {
    const { supabase } = await import('../supabase');

    vi.mocked(supabase.from('messages').select as any).mockRejectedValue(
      new Error('Network error')
    );

    await expect(messageChannelService.getMessages('channel-1')).rejects.toThrow('Network error');
  });

  it('should handle database constraint errors', async () => {
    const { supabase } = await import('../supabase');

    vi.mocked(supabase.from('message_channels').insert as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Duplicate key'),
        }),
      }),
    });

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

    vi.mocked(supabase.from('messages').select as any).mockResolvedValue({
      data: largeMessageList,
      error: null,
    });

    const start = Date.now();
    const result = await messageChannelService.getMessages('channel-1', 1000);
    const duration = Date.now() - start;

    expect(result.length).toBe(1000);
    expect(duration).toBeLessThan(100); // Should complete in under 100ms
  });
});
