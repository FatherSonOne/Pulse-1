// ============================================
// AUDIO VOICE SERVICE TESTS
// ============================================

import { describe, it, expect, beforeEach } from 'vitest';
import { AudioVoiceService } from './audioVoiceService';

describe('AudioVoiceService', () => {
  let service: AudioVoiceService;

  beforeEach(() => {
    service = new AudioVoiceService();
  });

  describe('transcribeAudio', () => {
    it('should throw error for non-existent voice message', async () => {
      await expect(
        service.transcribeAudio('non-existent-id', 'gemini')
      ).rejects.toThrow('Voice message not found: non-existent-id');
    });
  });

  describe('extractTasksFromVoice', () => {
    it('should throw error for non-existent transcription', async () => {
      await expect(
        service.extractTasksFromVoice('non-existent-id', 'gemini')
      ).rejects.toThrow('Transcription not found: non-existent-id');
    });
  });

  describe('extractDecisionsFromVoice', () => {
    it('should throw error for non-existent transcription', async () => {
      await expect(
        service.extractDecisionsFromVoice('non-existent-id')
      ).rejects.toThrow('Transcription not found: non-existent-id');
    });
  });

  describe('summarizeVoice', () => {
    it('should throw error for non-existent transcription', async () => {
      await expect(
        service.summarizeVoice('non-existent-id')
      ).rejects.toThrow('Transcription not found: non-existent-id');
    });
  });

  describe('indexVoiceTranscription', () => {
    it('should throw error for non-existent transcription', () => {
      expect(() => service.indexVoiceTranscription('non-existent-id')).toThrow(
        'Transcription not found: non-existent-id'
      );
    });
  });

  describe('getVoiceMessage', () => {
    it('should return undefined for non-existent voice message', () => {
      const result = service.getVoiceMessage('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('getTranscription', () => {
    it('should return undefined for non-existent transcription', () => {
      const result = service.getTranscription('non-existent-id');
      expect(result).toBeUndefined();
    });
  });
});
