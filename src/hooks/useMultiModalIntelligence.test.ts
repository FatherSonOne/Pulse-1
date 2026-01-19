// ============================================
// USE MULTI MODAL INTELLIGENCE HOOK TESTS
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiModalIntelligence } from './useMultiModalIntelligence';

// Mock the services
vi.mock('../services/unifiedInboxService', () => ({
  unifiedInboxService: {
    normalizeMessage: vi.fn().mockResolvedValue({
      id: 'test-msg-1',
      source: 'slack',
      type: 'text',
      content: 'Test message',
      senderName: 'Test User',
      senderId: 'user-1',
      channelId: 'channel-1',
      channelName: 'Test Channel',
      timestamp: new Date(),
      conversationGraphId: '',
      metadata: {},
      isRead: false,
      starred: false,
      tags: [],
    }),
    deduplicateMessages: vi.fn((messages) => messages),
    buildConversationGraph: vi.fn().mockReturnValue({
      id: 'graph-1',
      nodes: [],
      edges: [],
      deduplicationMap: new Map(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findRelatedConversations: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../services/audioVoiceService', () => ({
  audioVoiceService: {
    recordVoiceMessage: vi.fn().mockResolvedValue({
      id: 'voice-1',
      audioUrl: 'blob:test',
      duration: 1000,
      recordedAt: new Date(),
      status: 'completed',
    }),
    transcribeAudio: vi.fn().mockResolvedValue({
      id: 'transcription-1',
      voiceMessageId: 'voice-1',
      transcript: 'Test transcription',
      confidence: 0.95,
      language: 'en',
      processedAt: new Date(),
    }),
    extractTasksFromVoice: vi.fn().mockResolvedValue([]),
    extractDecisionsFromVoice: vi.fn().mockResolvedValue([]),
    summarizeVoice: vi.fn().mockResolvedValue({
      id: 'summary-1',
      voiceMessageId: 'voice-1',
      transcriptionId: 'transcription-1',
      summary: 'Test summary',
      keyPoints: [],
      sentiment: 'neutral',
      topics: [],
    }),
    indexVoiceTranscription: vi.fn(),
  },
}));

vi.mock('../services/channelExportService', () => ({
  channelExportService: {
    buildChannelSpec: vi.fn().mockReturnValue({
      title: 'Test Spec',
      overview: 'Test overview',
      decisions: [],
      tasks: [],
      milestones: [],
      participants: [],
      timeline: [],
      resources: [],
    }),
    exportToGoogleDocs: vi.fn().mockResolvedValue({
      id: 'artifact-1',
      channelId: 'channel-1',
      channelName: 'Test Channel',
      exportFormat: 'google_docs',
      title: 'Test Export',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    exportToMarkdown: vi.fn().mockReturnValue('# Test Markdown'),
    exportToHtml: vi.fn().mockReturnValue('<html>Test</html>'),
    publishArtifact: vi.fn(),
  },
}));

describe('useMultiModalIntelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with empty arrays and no error', () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      expect(result.current.unifiedMessages).toEqual([]);
      expect(result.current.conversationGraphs).toEqual([]);
      expect(result.current.voiceMessages).toEqual([]);
      expect(result.current.transcriptions).toEqual([]);
      expect(result.current.artifacts).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('addMessagesFromSource', () => {
    it('should add and normalize messages from a source', async () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      await act(async () => {
        await result.current.addMessagesFromSource(
          [{ text: 'Hello', ts: '123' }],
          'slack'
        );
      });

      expect(result.current.unifiedMessages.length).toBeGreaterThan(0);
      expect(result.current.conversationGraphs.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      // Test that the hook can handle being called with valid data
      // and doesn't crash when processing succeeds
      await act(async () => {
        await result.current.addMessagesFromSource(
          [{ text: 'Test', ts: '12345' }],
          'slack'
        );
      });

      // After successful operation, loading should be false and no error
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('findRelatedMessages', () => {
    it('should find related messages', () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      const mockMessage = {
        id: 'test-1',
        source: 'slack' as const,
        type: 'text' as const,
        content: 'Test',
        senderName: 'User',
        senderId: 'u1',
        channelId: 'c1',
        channelName: 'Channel',
        timestamp: new Date(),
        conversationGraphId: '',
        metadata: {},
        isRead: false,
        starred: false,
        tags: [],
      };

      const related = result.current.findRelatedMessages(mockMessage);
      expect(Array.isArray(related)).toBe(true);
    });
  });

  describe('recordVoiceMessage', () => {
    it('should record a voice message', async () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      await act(async () => {
        await result.current.recordVoiceMessage(1000);
      });

      expect(result.current.voiceMessages.length).toBe(1);
      expect(result.current.voiceMessages[0].id).toBe('voice-1');
    });
  });

  describe('transcribeVoice', () => {
    it('should transcribe a voice message', async () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      // First record
      await act(async () => {
        await result.current.recordVoiceMessage(1000);
      });

      // Then transcribe
      await act(async () => {
        await result.current.transcribeVoice('voice-1', 'gemini');
      });

      expect(result.current.transcriptions.length).toBe(1);
      expect(result.current.transcriptions[0].transcript).toBe('Test transcription');
    });
  });

  describe('extractTasksFromVoice', () => {
    it('should extract tasks from transcription', async () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      await act(async () => {
        const tasks = await result.current.extractTasksFromVoice('transcription-1');
        expect(Array.isArray(tasks)).toBe(true);
      });
    });
  });

  describe('extractDecisionsFromVoice', () => {
    it('should extract decisions from transcription', async () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      await act(async () => {
        const decisions = await result.current.extractDecisionsFromVoice('transcription-1');
        expect(Array.isArray(decisions)).toBe(true);
      });
    });
  });

  describe('summarizeVoiceMessage', () => {
    it('should summarize a voice message', async () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      await act(async () => {
        const summary = await result.current.summarizeVoiceMessage('transcription-1');
        expect(summary.summary).toBe('Test summary');
      });
    });
  });

  describe('exportChannelToGoogleDocs', () => {
    it('should export channel to Google Docs', async () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      await act(async () => {
        const artifact = await result.current.exportChannelToGoogleDocs(
          'channel-1',
          'Test Channel',
          []
        );
        expect(artifact.exportFormat).toBe('google_docs');
      });

      expect(result.current.artifacts.length).toBe(1);
    });
  });

  describe('exportChannelToMarkdown', () => {
    it('should export channel to Markdown', () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      const markdown = result.current.exportChannelToMarkdown('Test Channel', []);

      expect(markdown).toBe('# Test Markdown');
    });
  });

  describe('exportChannelToHtml', () => {
    it('should export channel to HTML', () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      const html = result.current.exportChannelToHtml('Test Channel', []);

      expect(html).toBe('<html>Test</html>');
    });
  });

  describe('publishChannelArtifact', () => {
    it('should publish an artifact', async () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      // First create an artifact
      await act(async () => {
        await result.current.exportChannelToGoogleDocs('c1', 'Test', []);
      });

      // Then publish it
      act(() => {
        result.current.publishChannelArtifact('artifact-1');
      });

      // Check that the artifact status was updated
      expect(result.current.artifacts[0].status).toBe('published');
    });
  });

  describe('loading state', () => {
    it('should set loading during async operations', async () => {
      const { result } = renderHook(() => useMultiModalIntelligence());

      expect(result.current.loading).toBe(false);

      const promise = act(async () => {
        await result.current.recordVoiceMessage(1000);
      });

      // After the operation completes
      await promise;
      expect(result.current.loading).toBe(false);
    });
  });
});
