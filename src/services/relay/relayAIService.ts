// Relay AI Service - Phase 5 Enhancements
// Provides AI-powered features: summarization, smart replies, meeting notes, auto-chapters
//
// All LLM calls route through the centralized ai-router edge function via
// src/services/ai/aiService.ts. The router handles provider selection, metering,
// hard caps, and prompt caching automatically.

import { invokeAIJson } from '../ai/aiService';
import { getCurrentWorkspaceId } from '../ai/getWorkspaceId';

export interface VoxMessage {
  id: string;
  transcription: string;
  sender: 'me' | 'other';
  senderName?: string;
  timestamp: Date;
  duration: number;
}

export interface ConversationSummary {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  participants: string[];
  duration: string;
  messageCount: number;
}

export interface SmartReply {
  text: string;
  tone: 'professional' | 'casual' | 'friendly';
  length: 'short' | 'medium';
}

export interface MeetingNotes {
  title: string;
  date: string;
  participants: string[];
  summary: string;
  keyDecisions: string[];
  actionItems: Array<{
    task: string;
    assignee?: string;
    dueDate?: string;
  }>;
  nextSteps: string[];
}

export interface Chapter {
  startTime: number;
  endTime: number;
  title: string;
  summary: string;
}

/**
 * Single longer-form reply draft (Glimpse "Draft" affordance).
 * Distinct from SmartReply which returns three quick options.
 */
export interface ReplyDraft {
  text: string;
  tone: 'professional' | 'casual' | 'friendly' | 'warm' | 'direct';
  suggestedAction?: string;
}

/**
 * Optional relationship context used to tune the draft tone. Comes from
 * the existing relationship profile system; all fields optional so the
 * feature degrades gracefully when no profile exists.
 */
export interface RelationshipContext {
  contactName?: string;
  category?: string;
  closeness?: 'close' | 'familiar' | 'professional' | 'distant';
  preferredTone?: string;
  recentTopics?: string[];
}

// ─── Internal raw-response shapes from the model ─────────────────────────

interface RawConversationSummary {
  overview?: string;
  keyPoints?: string[];
  actionItems?: string[];
  topics?: string[];
}

interface RawSmartReplyResponse {
  replies?: SmartReply[];
}

interface RawMeetingNotes {
  title?: string;
  summary?: string;
  keyDecisions?: string[];
  actionItems?: Array<{ task: string; assignee?: string; dueDate?: string }>;
  nextSteps?: string[];
}

interface RawChapter {
  title?: string;
  summary?: string;
  startPercentage: number;
}

interface RawChapterResponse {
  chapters?: RawChapter[];
}

interface RawReplyDraft {
  text?: string;
  tone?: ReplyDraft['tone'];
  suggestedAction?: string;
}

/**
 * Summarize a conversation from multiple voice messages.
 *
 * @param apiKey DEPRECATED — unused. Router handles keys server-side.
 * @param messages The voice messages to summarize.
 * @param workspaceId Optional workspace override; defaults to the active workspace.
 */
export async function summarizeConversation(
  apiKey: string | undefined,
  messages: VoxMessage[],
  workspaceId?: string,
): Promise<ConversationSummary | null> {
  if (messages.length === 0) return null;

  const wsId = workspaceId ?? getCurrentWorkspaceId();
  if (!wsId) throw new Error('No active workspace — AI unavailable');

  // Build conversation transcript
  const transcript = messages
    .map((msg) => {
      const time = msg.timestamp.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
      const sender = msg.sender === 'me' ? 'You' : (msg.senderName || 'Contact');
      return `[${time}] ${sender}: ${msg.transcription}`;
    })
    .join('\n\n');

  const totalDuration = messages.reduce((sum, msg) => sum + msg.duration, 0);
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const participants = Array.from(
    new Set(messages.map(m => m.sender === 'me' ? 'You' : (m.senderName || 'Contact')))
  );

  const prompt = `Analyze this voice conversation and provide a structured summary:

CONVERSATION TRANSCRIPT:
${transcript}

Please provide:
1. A concise overview (2-3 sentences) of what was discussed
2. 3-5 key points from the conversation
3. Any action items or tasks mentioned
4. The main topics covered

Format your response as JSON with this structure:
{
  "overview": "Brief summary of the conversation",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "actionItems": ["Action 1", "Action 2"],
  "topics": ["Topic 1", "Topic 2"]
}`;

  const parsed = await invokeAIJson<RawConversationSummary>(
    'voxer_transcript_summary',
    prompt,
    { workspaceId: wsId, temperature: 0.3 },
  );

  return {
    overview: parsed.overview || 'No summary available',
    keyPoints: parsed.keyPoints || [],
    actionItems: parsed.actionItems || [],
    participants,
    duration: formatDuration(totalDuration),
    messageCount: messages.length,
  };
}

/**
 * Generate smart reply suggestions based on the last message.
 *
 * @param apiKey DEPRECATED — unused. Router handles keys server-side.
 * @param lastMessage The message to generate replies for.
 * @param conversationContext Optional recent messages for context.
 * @param workspaceId Optional workspace override; defaults to the active workspace.
 */
export async function generateSmartReplies(
  apiKey: string | undefined,
  lastMessage: VoxMessage,
  conversationContext?: VoxMessage[],
  workspaceId?: string,
): Promise<SmartReply[]> {
  const wsId = workspaceId ?? getCurrentWorkspaceId();
  if (!wsId) throw new Error('No active workspace — AI unavailable');

  // Build context if available
  let context = '';
  if (conversationContext && conversationContext.length > 0) {
    const recentMessages = conversationContext.slice(-3);
    context = recentMessages
      .map(msg => {
        const sender = msg.sender === 'me' ? 'You' : (msg.senderName || 'Contact');
        return `${sender}: ${msg.transcription}`;
      })
      .join('\n');
  }

  const prompt = `Generate 3 smart reply suggestions for this voice message.

${context ? `CONVERSATION CONTEXT:\n${context}\n\n` : ''}LAST MESSAGE:
${lastMessage.senderName || 'Contact'}: ${lastMessage.transcription}

Generate 3 different reply options:
1. A professional/formal response
2. A casual/friendly response
3. A brief/short response

Format as JSON:
{
  "replies": [
    { "text": "Reply text here", "tone": "professional", "length": "medium" },
    { "text": "Reply text here", "tone": "casual", "length": "medium" },
    { "text": "Reply text here", "tone": "friendly", "length": "short" }
  ]
}`;

  const parsed = await invokeAIJson<RawSmartReplyResponse>(
    'voxer_smart_reply',
    prompt,
    { workspaceId: wsId, temperature: 0.7 },
  );

  return parsed.replies || [];
}

/**
 * Generate meeting notes from a voice conversation.
 *
 * @param apiKey DEPRECATED — unused. Router handles keys server-side.
 * @param messages The voice messages that make up the meeting.
 * @param meetingTitle Optional custom title for the meeting notes.
 * @param workspaceId Optional workspace override; defaults to the active workspace.
 */
export async function generateMeetingNotes(
  apiKey: string | undefined,
  messages: VoxMessage[],
  meetingTitle?: string,
  workspaceId?: string,
): Promise<MeetingNotes | null> {
  if (messages.length === 0) return null;

  const wsId = workspaceId ?? getCurrentWorkspaceId();
  if (!wsId) throw new Error('No active workspace — AI unavailable');

  const transcript = messages
    .map(msg => {
      const time = msg.timestamp.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
      const sender = msg.sender === 'me' ? 'You' : (msg.senderName || 'Contact');
      return `[${time}] ${sender}: ${msg.transcription}`;
    })
    .join('\n\n');

  const participants = Array.from(
    new Set(messages.map(m => m.sender === 'me' ? 'You' : (m.senderName || 'Contact')))
  );

  const date = messages[0].timestamp.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const prompt = `Generate structured meeting notes from this voice conversation:

MEETING TRANSCRIPT:
${transcript}

Extract and format:
1. Meeting title (or use: "${meetingTitle || 'Voice Meeting'}")
2. Brief summary (2-3 sentences)
3. Key decisions made
4. Action items with assignees if mentioned
5. Next steps

Format as JSON:
{
  "title": "Meeting title",
  "summary": "Brief meeting summary",
  "keyDecisions": ["Decision 1", "Decision 2"],
  "actionItems": [
    { "task": "Task description", "assignee": "Person name or null", "dueDate": "Date or null" }
  ],
  "nextSteps": ["Step 1", "Step 2"]
}`;

  const parsed = await invokeAIJson<RawMeetingNotes>(
    'meeting_summary',
    prompt,
    { workspaceId: wsId, temperature: 0.3 },
  );

  return {
    title: parsed.title || meetingTitle || 'Voice Meeting',
    date,
    participants,
    summary: parsed.summary || '',
    keyDecisions: parsed.keyDecisions || [],
    actionItems: parsed.actionItems || [],
    nextSteps: parsed.nextSteps || [],
  };
}

/**
 * Generate a single longer-form reply draft for the Glimpse "Draft" affordance.
 * Distinct from generateSmartReplies (which returns 3 quick options) — this
 * is one considered draft tuned to the relationship context, intended to be
 * read, edited, and either copied to clipboard or used as the caption for a
 * Glimpse reply.
 *
 * @param messages       Recent conversation messages (last ~5). The most recent
 *                       incoming message is treated as the message being replied to.
 * @param relationship   Optional relationship context to tune tone. Feature
 *                       degrades gracefully when not provided.
 * @param workspaceId    Optional workspace override; defaults to the active workspace.
 */
export async function generateReplyDraft(
  messages: VoxMessage[],
  relationship?: RelationshipContext,
  workspaceId?: string,
): Promise<ReplyDraft | null> {
  if (messages.length === 0) return null;

  // The "message being replied to" is the most recent incoming message.
  const incoming = [...messages].reverse().find(m => m.sender === 'other');
  if (!incoming) return null;

  const wsId = workspaceId ?? getCurrentWorkspaceId();
  if (!wsId) throw new Error('No active workspace — AI unavailable');

  const recent = messages.slice(-5);
  const context = recent
    .map(msg => {
      const sender = msg.sender === 'me' ? 'You' : (msg.senderName || 'Contact');
      return `${sender}: ${msg.transcription}`;
    })
    .join('\n');

  const relationshipBlock = relationship
    ? `RELATIONSHIP CONTEXT:
- Contact: ${relationship.contactName || incoming.senderName || 'Contact'}
- Category: ${relationship.category || 'unspecified'}
- Closeness: ${relationship.closeness || 'unspecified'}
${relationship.preferredTone ? `- Preferred tone: ${relationship.preferredTone}` : ''}
${relationship.recentTopics && relationship.recentTopics.length > 0 ? `- Recent topics: ${relationship.recentTopics.join(', ')}` : ''}

`
    : '';

  const prompt = `You are drafting a single, considered reply (not three quick options) for a video message thread.

${relationshipBlock}CONVERSATION:
${context}

MESSAGE BEING REPLIED TO:
${incoming.senderName || 'Contact'}: ${incoming.transcription}

Write one reply draft (50-120 words, longer than a one-liner, not a manifesto). It should:
- Acknowledge what they said specifically (don't be generic)
- Match the tone implied by the relationship context
- Move the conversation forward — answer questions, propose next steps, or close the loop
- Be ready to use as-is OR edit lightly before sending

Format as JSON:
{
  "text": "Draft reply text here.",
  "tone": "professional" | "casual" | "friendly" | "warm" | "direct",
  "suggestedAction": "Optional one-line action like 'Schedule a call' or 'Send a glimpse back', or omit"
}`;

  // Routes through the existing 'voxer_smart_reply' task — same domain (voice
  // messaging reply drafting). A dedicated 'glimpse_draft_reply' task can be
  // added to the AI router enum once this affordance graduates from beta and
  // we want separate metering / model tuning.
  const parsed = await invokeAIJson<RawReplyDraft>(
    'voxer_smart_reply',
    prompt,
    { workspaceId: wsId, temperature: 0.6 },
  );

  if (!parsed.text) return null;

  return {
    text: parsed.text.trim(),
    tone: parsed.tone || 'friendly',
    suggestedAction: parsed.suggestedAction,
  };
}

/**
 * Generate auto-chapters for a long voice message.
 * Breaks down a long transcription into topic-based segments.
 *
 * @param apiKey DEPRECATED — unused. Router handles keys server-side.
 * @param transcription The full voice-message transcription.
 * @param duration Total duration of the message in seconds.
 * @param workspaceId Optional workspace override; defaults to the active workspace.
 */
export async function generateAutoChapters(
  apiKey: string | undefined,
  transcription: string,
  duration: number,
  workspaceId?: string,
): Promise<Chapter[]> {
  // Only generate chapters for messages longer than 2 minutes
  if (duration < 120) return [];

  const wsId = workspaceId ?? getCurrentWorkspaceId();
  if (!wsId) throw new Error('No active workspace — AI unavailable');

  const prompt = `Analyze this voice message transcription and break it into logical chapters/topics.

TRANSCRIPTION (${Math.round(duration)}s duration):
${transcription}

Identify 3-7 distinct topics or sections. For each chapter provide:
- A descriptive title (3-5 words)
- A brief summary (1 sentence)
- Estimated start time (as percentage of total duration)

Format as JSON:
{
  "chapters": [
    { "title": "Chapter title", "summary": "What this section covers", "startPercentage": 0 },
    { "title": "Chapter title", "summary": "What this section covers", "startPercentage": 30 },
    { "title": "Chapter title", "summary": "What this section covers", "startPercentage": 65 }
  ]
}`;

  const parsed = await invokeAIJson<RawChapterResponse>(
    'voxer_transcript_summary',
    prompt,
    { workspaceId: wsId, temperature: 0.3 },
  );

  const rawChapters = parsed.chapters || [];
  const chapters: Chapter[] = rawChapters.map((ch, index, arr) => {
    const startTime = Math.round((ch.startPercentage / 100) * duration);
    const nextStartTime = index < arr.length - 1
      ? Math.round((arr[index + 1].startPercentage / 100) * duration)
      : duration;

    return {
      startTime,
      endTime: nextStartTime,
      title: ch.title || `Chapter ${index + 1}`,
      summary: ch.summary || '',
    };
  });

  return chapters;
}

/**
 * Format duration in MM:SS format
 */
export function formatChapterTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
