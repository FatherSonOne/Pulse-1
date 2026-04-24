import { GoogleGenAI, Type } from '@google/genai';
import { VoiceAnalysis, VoiceSummary, TaskFromVoice, DecisionFromVoice } from '../types';
import { withFormattedOutput } from './aiFormattingService';
import { invokeAIJson } from './ai/aiService';
import { getCurrentWorkspaceId } from './ai/getWorkspaceId';

/**
 * Voice Intelligence Service
 *
 * Two categories of calls live here:
 *
 * 1. RAW AUDIO TRANSCRIPTION (stays client-side for now)
 *    `transcribe`, `analyzeVoiceMemo`, `analyzeMeeting`, `generateVoiceSummary`,
 *    `detectVoiceCommand`, `diarizeSpeakers`, `analyzeSentiment`, `textToSpeech`.
 *    These pass base64 audio to Gemini's multimodal audio models. The ai-router
 *    does not currently accept binary audio payloads, so they continue to call
 *    Gemini directly. Realtime/streaming audio is Phase 4.
 *
 * 2. TEXT-ONLY ANALYSIS (routed through ai-router)
 *    `summarizeTranscript`  → `voxer_transcript_summary`  (bulk summarization)
 *    `analyzeMeetingText`   → `meeting_summary`            (structured analysis)
 *    `parseVoiceCommandText`→ `voice_command_parse`        (intent extraction)
 *    `diarizeFromTranscript`→ `voxer_transcript_summary`   (talk-time stats)
 *
 *    These take an already-transcribed string and let the router pick the
 *    right provider (Gemini Flash for bulk, Sonnet for structured extraction).
 */

export interface VoiceTranscription {
  text: string;
  confidence: number;
  language: string;
  words?: { word: string; start: number; end: number; confidence: number }[];
  speakers?: { id: string; segments: { start: number; end: number }[] }[];
}

export interface MeetingAnalysis {
  title: string;
  duration: number;
  participants: string[];
  summary: string;
  keyPoints: string[];
  actionItems: TaskFromVoice[];
  decisions: DecisionFromVoice[];
  topics: { topic: string; duration: number; sentiment: 'positive' | 'neutral' | 'negative' }[];
  followUps: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
}

export interface VoiceCommand {
  command: string;
  confidence: number;
  parameters: Record<string, string>;
  action?: string;
}

export interface SpeakerDiarization {
  speakerId: string;
  speakerName?: string;
  segments: { start: number; end: number; text: string }[];
  talkTime: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

const getApiKey = (): string => {
  return localStorage.getItem('gemini_api_key') || '';
};

/**
 * Resolve workspace id for router calls, or throw a descriptive error.
 */
function resolveWorkspaceId(explicit?: string): string {
  const id = explicit ?? getCurrentWorkspaceId();
  if (!id) {
    throw new Error('No active workspace — AI unavailable');
  }
  return id;
}

export const voiceIntelligenceService = {
  // ────────────────────────────────────────────────────────────────────
  // RAW AUDIO PATH — uses Gemini audio models directly (Phase 4 will
  // move this server-side; realtime/streaming stays client-side).
  // ────────────────────────────────────────────────────────────────────

  // Transcribe audio to text with timestamps
  async transcribe(
    audioBase64: string,
    mimeType: string = 'audio/webm',
    options?: {
      detectSpeakers?: boolean;
      detectLanguage?: boolean;
      includeTimestamps?: boolean;
    }
  ): Promise<VoiceTranscription | null> {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error('No Gemini API key configured');
      return null;
    }

    const ai = new GoogleGenAI({ apiKey });
    const cleanMime = mimeType.split(';')[0].trim();

    try {
      const prompt = options?.detectSpeakers
        ? `Transcribe this audio with speaker diarization. For each segment, identify the speaker.
           Return JSON with: text (full transcription), confidence (0-1), language,
           words (array of {word, start, end, confidence}),
           speakers (array of {id, segments: [{start, end}]})`
        : `Transcribe this audio exactly as spoken.
           Return JSON with: text (full transcription), confidence (0-1), language`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: cleanMime, data: audioBase64 } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              language: { type: Type.STRING },
              words: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    start: { type: Type.NUMBER },
                    end: { type: Type.NUMBER },
                    confidence: { type: Type.NUMBER }
                  }
                }
              },
              speakers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    segments: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          start: { type: Type.NUMBER },
                          end: { type: Type.NUMBER }
                        }
                      }
                    }
                  }
                }
              }
            },
            required: ['text', 'confidence', 'language']
          }
        }
      });

      return JSON.parse(response.text || '{}') as VoiceTranscription;
    } catch (error) {
      console.error('Transcription error:', error);
      return null;
    }
  },

  // Analyze voice memo for tasks, decisions, and summary
  async analyzeVoiceMemo(audioBase64: string, mimeType: string = 'audio/webm'): Promise<VoiceAnalysis | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    const cleanMime = mimeType.split(';')[0].trim();

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: cleanMime, data: audioBase64 } },
            { text: withFormattedOutput(
              `Analyze this voice memo comprehensively. Extract:
              1. Full transcription
              2. Concise summary (2-3 sentences)
              3. Action items (tasks mentioned or implied)
              4. Decisions made or proposed
              Return structured JSON.`,
              'voice-analysis'
            ) }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcription: { type: Type.STRING },
              summary: { type: Type.STRING },
              actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
              decisions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['transcription', 'summary', 'actionItems', 'decisions']
          }
        }
      });

      return JSON.parse(response.text || '{}') as VoiceAnalysis;
    } catch (error) {
      console.error('Voice memo analysis error:', error);
      return null;
    }
  },

  // Analyze a meeting recording
  async analyzeMeeting(
    audioBase64: string,
    mimeType: string = 'audio/webm',
    context?: { title?: string; participants?: string[] }
  ): Promise<MeetingAnalysis | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    const cleanMime = mimeType.split(';')[0].trim();

    try {
      const contextInfo = context
        ? `Meeting title: ${context.title || 'Unknown'}. Known participants: ${context.participants?.join(', ') || 'Unknown'}.`
        : '';

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: cleanMime, data: audioBase64 } },
            { text: withFormattedOutput(
              `Analyze this meeting recording. ${contextInfo}

              Extract:
              1. Meeting title (if mentioned or infer from content)
              2. Participants mentioned
              3. Executive summary
              4. Key discussion points
              5. Action items with assignees and due dates if mentioned
              6. Decisions made
              7. Main topics discussed with time spent on each
              8. Follow-up items needed
              9. Overall sentiment

              Return structured JSON.`,
              'meeting-notes'
            ) }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              duration: { type: Type.NUMBER, description: 'Duration in minutes' },
              participants: { type: Type.ARRAY, items: { type: Type.STRING } },
              summary: { type: Type.STRING },
              keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              actionItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    assignee: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] }
                  },
                  required: ['title']
                }
              },
              decisions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    decision: { type: Type.STRING },
                    context: { type: Type.STRING },
                    decidedBy: { type: Type.STRING }
                  },
                  required: ['decision']
                }
              },
              topics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    duration: { type: Type.NUMBER },
                    sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative'] }
                  }
                }
              },
              followUps: { type: Type.ARRAY, items: { type: Type.STRING } },
              sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative', 'mixed'] }
            },
            required: ['title', 'summary', 'keyPoints', 'actionItems', 'decisions']
          }
        }
      });

      const result = JSON.parse(response.text || '{}');

      // Transform to proper types
      return {
        ...result,
        actionItems: result.actionItems?.map((item: any) => ({
          id: `voice-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          voiceMessageId: '',
          transcriptionId: '',
          title: item.title,
          description: item.description || '',
          dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
          priority: item.priority || 'medium',
          assignee: item.assignee,
          tags: []
        })) || [],
        decisions: result.decisions?.map((item: any) => ({
          id: `voice-decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          voiceMessageId: '',
          transcriptionId: '',
          decision: item.decision,
          context: item.context || '',
          decisionDate: new Date(),
          decidedBy: item.decidedBy || 'Unknown',
          affectedTeams: []
        })) || []
      } as MeetingAnalysis;
    } catch (error) {
      console.error('Meeting analysis error:', error);
      return null;
    }
  },

  // Generate a structured summary from voice
  async generateVoiceSummary(
    audioBase64: string,
    mimeType: string = 'audio/webm'
  ): Promise<VoiceSummary | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    const cleanMime = mimeType.split(';')[0].trim();

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: cleanMime, data: audioBase64 } },
            { text: withFormattedOutput(
              `Create a comprehensive summary of this audio. Include:
              1. Main summary (2-3 sentences)
              2. Key points as bullet items
              3. Overall sentiment
              4. Main topics/themes discussed
              Return JSON.`,
              'voice-analysis'
            ) }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative'] },
              topics: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['summary', 'keyPoints', 'sentiment', 'topics']
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      return {
        id: `summary-${Date.now()}`,
        voiceMessageId: '',
        transcriptionId: '',
        ...result
      } as VoiceSummary;
    } catch (error) {
      console.error('Voice summary error:', error);
      return null;
    }
  },

  // Detect voice commands from audio
  async detectVoiceCommand(
    audioBase64: string,
    mimeType: string = 'audio/webm',
    availableCommands: string[]
  ): Promise<VoiceCommand | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    const cleanMime = mimeType.split(';')[0].trim();

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: {
          parts: [
            { inlineData: { mimeType: cleanMime, data: audioBase64 } },
            { text: `Detect if this audio contains a voice command from this list: ${availableCommands.join(', ')}.
              If found, extract the command and any parameters mentioned.
              Return JSON with: command, confidence (0-1), parameters (key-value pairs).
              If no command detected, return { command: "", confidence: 0, parameters: {} }` }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              command: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              parameters: {
                type: Type.OBJECT,
                additionalProperties: { type: Type.STRING }
              }
            },
            required: ['command', 'confidence', 'parameters']
          }
        }
      });

      const result = JSON.parse(response.text || '{}') as VoiceCommand;
      if (result.confidence < 0.5 || !result.command) {
        return null;
      }
      return result;
    } catch (error) {
      console.error('Voice command detection error:', error);
      return null;
    }
  },

  // Perform speaker diarization
  async diarizeSpeakers(
    audioBase64: string,
    mimeType: string = 'audio/webm',
    knownSpeakers?: string[]
  ): Promise<SpeakerDiarization[] | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    const cleanMime = mimeType.split(';')[0].trim();

    try {
      const speakerHint = knownSpeakers
        ? `Known speakers: ${knownSpeakers.join(', ')}. Try to identify which speaker is which.`
        : 'Identify different speakers as Speaker 1, Speaker 2, etc.';

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: cleanMime, data: audioBase64 } },
            { text: `Analyze this audio for speaker diarization. ${speakerHint}

              For each speaker, provide:
              1. Speaker ID or name
              2. Time segments they spoke (start/end in seconds)
              3. What they said in each segment
              4. Total talk time
              5. Overall sentiment

              Return JSON array of speaker objects.` }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                speakerId: { type: Type.STRING },
                speakerName: { type: Type.STRING },
                segments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      start: { type: Type.NUMBER },
                      end: { type: Type.NUMBER },
                      text: { type: Type.STRING }
                    }
                  }
                },
                talkTime: { type: Type.NUMBER, description: 'Total seconds' },
                sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative'] }
              },
              required: ['speakerId', 'segments', 'talkTime', 'sentiment']
            }
          }
        }
      });

      return JSON.parse(response.text || '[]') as SpeakerDiarization[];
    } catch (error) {
      console.error('Speaker diarization error:', error);
      return null;
    }
  },

  // Extract sentiment and emotion from voice
  async analyzeSentiment(
    audioBase64: string,
    mimeType: string = 'audio/webm'
  ): Promise<{
    overall: 'positive' | 'neutral' | 'negative';
    emotions: { emotion: string; confidence: number }[];
    timeline: { timestamp: number; sentiment: string }[];
  } | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    const cleanMime = mimeType.split(';')[0].trim();

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: cleanMime, data: audioBase64 } },
            { text: `Analyze the emotional content and sentiment of this audio.
              Consider tone of voice, word choice, and speaking patterns.

              Return:
              1. Overall sentiment
              2. Emotions detected with confidence levels
              3. Sentiment timeline (how it changes throughout)` }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overall: { type: Type.STRING, enum: ['positive', 'neutral', 'negative'] },
              emotions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    emotion: { type: Type.STRING },
                    confidence: { type: Type.NUMBER }
                  }
                }
              },
              timeline: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timestamp: { type: Type.NUMBER },
                    sentiment: { type: Type.STRING }
                  }
                }
              }
            },
            required: ['overall', 'emotions', 'timeline']
          }
        }
      });

      return JSON.parse(response.text || '{}');
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return null;
    }
  },

  // Convert text to speech using Gemini TTS
  async textToSpeech(
    text: string,
    voice: string = 'Kore'
  ): Promise<string | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: { parts: [{ text }] },
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice }
            }
          }
        }
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        return `data:audio/wav;base64,${audioData}`;
      }
      return null;
    } catch (error) {
      console.error('Text to speech error:', error);
      return null;
    }
  },

  // Real-time transcription simulation (for streaming)
  createRealtimeTranscriber(): {
    start: () => void;
    stop: () => Promise<VoiceTranscription | null>;
    onInterim: (callback: (text: string) => void) => void;
  } {
    let mediaRecorder: MediaRecorder | null = null;
    let audioChunks: Blob[] = [];
    // Interim callback is preserved for API compatibility — realtime partial
    // transcript streaming is not yet implemented (see Phase 4).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let interimCallback: ((text: string) => void) | null = null;

    return {
      start: async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];

          mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
          };

          mediaRecorder.start(1000); // Collect data every second
        } catch (error) {
          console.error('Failed to start recording:', error);
        }
      },

      stop: async (): Promise<VoiceTranscription | null> => {
        return new Promise((resolve) => {
          if (!mediaRecorder) {
            resolve(null);
            return;
          }

          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();

            reader.onloadend = async () => {
              const base64 = (reader.result as string).split(',')[1];
              const result = await voiceIntelligenceService.transcribe(base64, 'audio/webm');
              resolve(result);
            };

            reader.readAsDataURL(audioBlob);
          };

          mediaRecorder.stop();
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
        });
      },

      onInterim: (callback: (text: string) => void) => {
        interimCallback = callback;
      }
    };
  },

  // ────────────────────────────────────────────────────────────────────
  // TEXT-ONLY PATH — routes through ai-router (post-transcription analysis)
  // ────────────────────────────────────────────────────────────────────

  /**
   * Summarize an already-transcribed voice message / voxer transcript.
   * Routes to `voxer_transcript_summary` (bulk task → Gemini Flash).
   *
   * @param apiKey DEPRECATED — unused. Retained for backward compatibility.
   * @param transcript The transcribed text to summarize.
   * @param workspaceId Optional workspace override.
   */
  async summarizeTranscript(
    transcript: string,
    workspaceId?: string
  ): Promise<VoiceSummary | null> {
    if (!transcript?.trim()) return null;

    const wsId = resolveWorkspaceId(workspaceId);

    const prompt = `Create a comprehensive summary of this transcript. Include:
1. Main summary (2-3 sentences)
2. Key points as bullet items
3. Overall sentiment (positive/neutral/negative)
4. Main topics/themes discussed

Transcript:
"""
${transcript}
"""

Return JSON in this exact format:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "sentiment": "positive" | "neutral" | "negative",
  "topics": ["...", "..."]
}`;

    try {
      const result = await invokeAIJson<{
        summary: string;
        keyPoints: string[];
        sentiment: 'positive' | 'neutral' | 'negative';
        topics: string[];
      }>('voxer_transcript_summary', prompt, { workspaceId: wsId, temperature: 0.4 });

      return {
        id: `summary-${Date.now()}`,
        voiceMessageId: '',
        transcriptionId: '',
        ...result
      } as VoiceSummary;
    } catch (error) {
      console.error('Transcript summary error:', error);
      throw error;
    }
  },

  /**
   * Analyze an already-transcribed meeting for summary, action items, and decisions.
   * Routes to `meeting_summary` (value task → Claude Sonnet) for structured extraction.
   *
   * @param transcript The transcribed meeting text.
   * @param context Optional metadata (title, participants).
   * @param workspaceId Optional workspace override.
   */
  async analyzeMeetingText(
    transcript: string,
    context?: { title?: string; participants?: string[] },
    workspaceId?: string
  ): Promise<MeetingAnalysis | null> {
    if (!transcript?.trim()) return null;

    const wsId = resolveWorkspaceId(workspaceId);

    const contextInfo = context
      ? `Meeting title: ${context.title || 'Unknown'}. Known participants: ${context.participants?.join(', ') || 'Unknown'}.`
      : '';

    const prompt = `Analyze this meeting transcript. ${contextInfo}

Extract:
1. Meeting title (if mentioned or infer from content)
2. Participants mentioned
3. Executive summary
4. Key discussion points
5. Action items with assignees and due dates if mentioned (priority: low/medium/high)
6. Decisions made (with context and decidedBy)
7. Main topics discussed with approximate time spent on each and sentiment
8. Follow-up items needed
9. Overall sentiment (positive/neutral/negative/mixed)

Transcript:
"""
${transcript}
"""

Return JSON in this exact format:
{
  "title": "...",
  "duration": 0,
  "participants": ["..."],
  "summary": "...",
  "keyPoints": ["..."],
  "actionItems": [
    { "title": "...", "description": "...", "assignee": "...", "dueDate": "...", "priority": "medium" }
  ],
  "decisions": [
    { "decision": "...", "context": "...", "decidedBy": "..." }
  ],
  "topics": [
    { "topic": "...", "duration": 0, "sentiment": "neutral" }
  ],
  "followUps": ["..."],
  "sentiment": "neutral"
}`;

    try {
      const result = await invokeAIJson<any>(
        'meeting_summary',
        prompt,
        { workspaceId: wsId, temperature: 0.3 }
      );

      return {
        ...result,
        actionItems: result.actionItems?.map((item: any) => ({
          id: `voice-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          voiceMessageId: '',
          transcriptionId: '',
          title: item.title,
          description: item.description || '',
          dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
          priority: item.priority || 'medium',
          assignee: item.assignee,
          tags: []
        })) || [],
        decisions: result.decisions?.map((item: any) => ({
          id: `voice-decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          voiceMessageId: '',
          transcriptionId: '',
          decision: item.decision,
          context: item.context || '',
          decisionDate: new Date(),
          decidedBy: item.decidedBy || 'Unknown',
          affectedTeams: []
        })) || []
      } as MeetingAnalysis;
    } catch (error) {
      console.error('Meeting text analysis error:', error);
      throw error;
    }
  },

  /**
   * Parse a voice command from already-transcribed text.
   * Routes to `voice_command_parse` for low-latency intent extraction.
   *
   * @param transcript The transcribed command text.
   * @param availableCommands The list of valid commands to match against.
   * @param workspaceId Optional workspace override.
   */
  async parseVoiceCommandText(
    transcript: string,
    availableCommands: string[],
    workspaceId?: string
  ): Promise<VoiceCommand | null> {
    if (!transcript?.trim()) return null;

    const wsId = resolveWorkspaceId(workspaceId);

    const prompt = `Detect if the following utterance contains a voice command from this list: ${availableCommands.join(', ')}.
If found, extract the command and any parameters mentioned. If no command detected, return { "command": "", "confidence": 0, "parameters": {} }.

Utterance:
"""
${transcript}
"""

Return JSON in this exact format:
{
  "command": "...",
  "confidence": 0.0,
  "parameters": { "key": "value" }
}`;

    try {
      const result = await invokeAIJson<VoiceCommand>(
        'voice_command_parse',
        prompt,
        { workspaceId: wsId, temperature: 0.1 }
      );

      if (!result || result.confidence < 0.5 || !result.command) {
        return null;
      }
      return result;
    } catch (error) {
      console.error('Voice command parse error:', error);
      throw error;
    }
  },

  /**
   * Build speaker diarization / talk-time stats from an already-transcribed
   * multi-speaker transcript. Routes to `voxer_transcript_summary` (bulk).
   *
   * @param transcript The transcribed text with speaker tags.
   * @param knownSpeakers Optional hint listing expected speaker names.
   * @param workspaceId Optional workspace override.
   */
  async diarizeFromTranscript(
    transcript: string,
    knownSpeakers?: string[],
    workspaceId?: string
  ): Promise<SpeakerDiarization[] | null> {
    if (!transcript?.trim()) return null;

    const wsId = resolveWorkspaceId(workspaceId);

    const speakerHint = knownSpeakers && knownSpeakers.length > 0
      ? `Known speakers: ${knownSpeakers.join(', ')}. Try to identify which speaker is which.`
      : 'Identify different speakers as Speaker 1, Speaker 2, etc.';

    const prompt = `Analyze this transcript for speaker diarization. ${speakerHint}

For each speaker, provide:
1. Speaker ID or name
2. The segments they spoke (start/end in seconds if available, plus the text)
3. Total talk time in seconds (approximate if not explicit)
4. Overall sentiment (positive / neutral / negative)

Transcript:
"""
${transcript}
"""

Return JSON in this exact format:
{
  "speakers": [
    {
      "speakerId": "speaker-1",
      "speakerName": "Alice",
      "segments": [{ "start": 0, "end": 10, "text": "..." }],
      "talkTime": 120,
      "sentiment": "neutral"
    }
  ]
}`;

    try {
      const parsed = await invokeAIJson<{ speakers?: SpeakerDiarization[] }>(
        'voxer_transcript_summary',
        prompt,
        { workspaceId: wsId, temperature: 0.3 }
      );

      return parsed.speakers || [];
    } catch (error) {
      console.error('Transcript diarization error:', error);
      throw error;
    }
  }
};
