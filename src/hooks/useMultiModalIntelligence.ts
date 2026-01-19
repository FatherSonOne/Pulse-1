import { useState, useCallback } from 'react';
import { unifiedInboxService } from '../services/unifiedInboxService';
import { audioVoiceService } from '../services/audioVoiceService';
import { channelExportService } from '../services/channelExportService';
import {
  UnifiedMessage,
  ConversationGraph,
  VoiceMessage,
  TranscriptionResult,
  ChannelArtifact,
  MessageSource,
} from '../types';

/**
 * Main Hook: useMultiModalIntelligence
 * Orchestrates all three major features:
 * 1. Unified Inbox
 * 2. Audio/Voice Processing
 * 3. Channel Export
 */

export const useMultiModalIntelligence = () => {
  // ============= STATE MANAGEMENT =============
  const [unifiedMessages, setUnifiedMessages] = useState<UnifiedMessage[]>([]);
  const [conversationGraphs, setConversationGraphs] = useState<
    ConversationGraph[]
  >([]);
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const [transcriptions, setTranscriptions] = useState<TranscriptionResult[]>(
    []
  );
  const [artifacts, setArtifacts] = useState<ChannelArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============= UNIFIED INBOX FUNCTIONS =============

  const addMessagesFromSource = useCallback(
    async (rawMessages: any[], source: MessageSource) => {
      try {
        setLoading(true);
        setError(null);

        // Normalize messages
        const normalized = await Promise.all(
          rawMessages.map((msg) =>
            unifiedInboxService.normalizeMessage(msg, source)
          )
        );

        // Deduplicate
        const deduplicated = unifiedInboxService.deduplicateMessages(normalized);

        // Add to unified inbox
        const updated = [...unifiedMessages, ...deduplicated];
        setUnifiedMessages(updated);

        // Rebuild conversation graph
        const graphId = `graph-${Date.now()}`;
        const graph = unifiedInboxService.buildConversationGraph(
          updated,
          graphId
        );
        setConversationGraphs([
          ...conversationGraphs,
          graph,
        ]);

        return { messageCount: deduplicated.length, graph };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [unifiedMessages, conversationGraphs]
  );

  const findRelatedMessages = useCallback(
    (message: UnifiedMessage): UnifiedMessage[] => {
      return unifiedInboxService.findRelatedConversations(message);
    },
    []
  );

  // ============= AUDIO/VOICE FUNCTIONS =============

  const recordVoiceMessage = useCallback(async (durationMs: number) => {
    try {
      setLoading(true);
      setError(null);

      const voiceMessage = await audioVoiceService.recordVoiceMessage(
        durationMs
      );
      setVoiceMessages((prev) => [...prev, voiceMessage]);

      return voiceMessage;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const transcribeVoice = useCallback(
    async (voiceMessageId: string, apiProvider: 'gemini' | 'whisper' | 'aws') => {
      try {
        setLoading(true);
        setError(null);

        const transcription = await audioVoiceService.transcribeAudio(
          voiceMessageId,
          apiProvider
        );
        setTranscriptions((prev) => [...prev, transcription]);

        // Make searchable
        audioVoiceService.indexVoiceTranscription(transcription.id);

        return transcription;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const extractTasksFromVoice = useCallback(
    async (transcriptionId: string) => {
      try {
        setLoading(true);
        setError(null);

        const tasks = await audioVoiceService.extractTasksFromVoice(
          transcriptionId,
          'gemini'
        );

        return tasks;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const extractDecisionsFromVoice = useCallback(
    async (transcriptionId: string) => {
      try {
        setLoading(true);
        setError(null);

        const decisions = await audioVoiceService.extractDecisionsFromVoice(
          transcriptionId
        );

        return decisions;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const summarizeVoiceMessage = useCallback(
    async (transcriptionId: string) => {
      try {
        setLoading(true);
        setError(null);

        const summary = await audioVoiceService.summarizeVoice(transcriptionId);

        return summary;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ============= CHANNEL EXPORT FUNCTIONS =============

  const exportChannelToGoogleDocs = useCallback(
    async (
      channelId: string,
      channelName: string,
      messagesInChannel: UnifiedMessage[]
    ) => {
      try {
        setLoading(true);
        setError(null);

        const spec = channelExportService.buildChannelSpec(
          channelName,
          messagesInChannel
        );
        const artifact = await channelExportService.exportToGoogleDocs(
          channelId,
          channelName,
          messagesInChannel,
          spec
        );

        setArtifacts((prev) => [...prev, artifact]);

        return artifact;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const exportChannelToMarkdown = useCallback(
    (channelName: string, messagesInChannel: UnifiedMessage[]): string => {
      try {
        setError(null);

        const spec = channelExportService.buildChannelSpec(
          channelName,
          messagesInChannel
        );
        const markdown = channelExportService.exportToMarkdown(
          channelName,
          spec
        );

        return markdown;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        throw err;
      }
    },
    []
  );

  const exportChannelToHtml = useCallback(
    (channelName: string, messagesInChannel: UnifiedMessage[]): string => {
      try {
        setError(null);

        const spec = channelExportService.buildChannelSpec(
          channelName,
          messagesInChannel
        );
        const html = channelExportService.exportToHtml(channelName, spec);

        return html;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        throw err;
      }
    },
    []
  );

  const publishChannelArtifact = useCallback((artifactId: string) => {
    try {
      setError(null);
      channelExportService.publishArtifact(artifactId);

      // Update local state
      setArtifacts((prev) =>
        prev.map((a) =>
          a.id === artifactId ? { ...a, status: 'published' as const } : a
        )
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      throw err;
    }
  }, []);

  return {
    // State
    unifiedMessages,
    conversationGraphs,
    voiceMessages,
    transcriptions,
    artifacts,
    loading,
    error,

    // Unified Inbox
    addMessagesFromSource,
    findRelatedMessages,

    // Voice/Audio
    recordVoiceMessage,
    transcribeVoice,
    extractTasksFromVoice,
    extractDecisionsFromVoice,
    summarizeVoiceMessage,

    // Channel Export
    exportChannelToGoogleDocs,
    exportChannelToMarkdown,
    exportChannelToHtml,
    publishChannelArtifact,
  };
};
