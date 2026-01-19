import { describe, it, expect, beforeEach, vi } from 'vitest';
import smartComposeService from '../smartComposeService';
import { emailAIService } from '../emailAIService';

vi.mock('../emailAIService', () => ({
  emailAIService: {
    isAvailable: vi.fn(),
    generateDraft: vi.fn(),
  }
}));

describe('SmartComposeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no suggestions when AI is unavailable', async () => {
    vi.mocked(emailAIService.isAvailable).mockReturnValue(false);

    const result = await smartComposeService.getSuggestions({
      partialText: 'Hello',
    });

    expect(result).toEqual([]);
  });

  it('returns a suggestion when AI is available', async () => {
    vi.mocked(emailAIService.isAvailable).mockReturnValue(true);
    vi.mocked(emailAIService.generateDraft).mockResolvedValue('Thanks for your email.');

    const result = await smartComposeService.getSuggestions({
      partialText: 'Hello',
    });

    expect(result.length).toBe(1);
    expect(result[0].text).toContain('Thanks for your email');
  });
});
