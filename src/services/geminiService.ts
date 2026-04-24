
import { GoogleGenAI, Type } from "@google/genai";
import { DraftAnalysis, ThreadContext, CatchUpSummary, AsyncSuggestion, Task, TeamHealth, Nudge, HandoffSummary, VoiceAnalysis, ChannelArtifact } from "../types";
import { googleCalendarService } from "./googleCalendarService";
import { withFormattedOutput } from "./aiFormattingService";
import { rateLimitService } from "./rateLimitService";
import { retryService } from "./retryService";
import { sanitizationService } from "./sanitizationService";
import { usageTracker } from "./usageTracker";
import { invokeAI, invokeAIPrompt, invokeAIJson } from "./ai/aiService";
import { getCurrentWorkspaceId } from "./ai/getWorkspaceId";
import {
  AIRouterError,
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from "./ai/errors";

// ─── Router error handling ────────────────────────────────────────────────────
// These errors must bubble up so the UI can render the right upgrade prompts.
// Everything else falls through to the legacy `return null` behavior for
// backward compatibility with the 25+ downstream callers.
function isRouterHardError(err: unknown): err is AIRouterError {
  return (
    err instanceof AICapExceededError ||
    err instanceof AITrialExpiredError ||
    err instanceof AIProviderUnavailableError
  );
}

// Cache for calendar context to avoid too many API calls
let calendarContextCache: { context: string; timestamp: number } | null = null;
const CALENDAR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Get calendar context for AI awareness
// UNCHANGED — pure context fetcher (no LLM involved)
export const getCalendarContextForAI = async (): Promise<string> => {
  // Return cached context if still valid
  if (calendarContextCache && Date.now() - calendarContextCache.timestamp < CALENDAR_CACHE_TTL) {
    return calendarContextCache.context;
  }

  try {
    const context = await googleCalendarService.getCalendarContextForAI();
    calendarContextCache = { context, timestamp: Date.now() };
    return context;
  } catch (error) {
    console.error('Failed to get calendar context:', error);
    return '';
  }
};

// ─── Search / Maps (migrated — text only; grounding no longer returned) ──────
// NOTE: The router does not expose Gemini googleSearch/googleMaps grounding tools,
// so groundingChunks will always be empty. Callers should handle empty arrays.
// `apiKey` parameter is ignored (router uses server-side keys).

// Web-grounded search via the ai-router's 'web_search' task, which auto-enables
// Gemini's googleSearch tool. Cheaper, one vendor, real citations via groundingChunks.
export const generateSearchResponse = async (apiKey: string, query: string) => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return { text: "No response generated.", groundingChunks: [] };
    const formattedQuery = `${query}

Format your response in clean GitHub-flavored markdown so it's easy to scan:
- Open with a 1-2 sentence summary, then break the rest into short sections.
- Use ## subheadings for distinct topics, **bold** for key terms, and bullet lists for facts, features, or steps.
- Keep paragraphs short (max 2-3 sentences). Never return one large block of text.
- Do not include a heading for the summary itself, and do not list sources at the end (they are rendered separately).`;
    const result = await invokeAI(
      'web_search',
      { messages: [{ role: 'user', content: formattedQuery }] },
      { workspaceId },
    );
    return {
      text: result.text || "No response generated.",
      // Re-wrap into the legacy { web: { uri, title } } shape that existing
      // callers (search UI, result cards) already know how to render.
      groundingChunks: (result.groundingChunks || []).map(c => ({
        web: { uri: c.uri, title: c.title },
      })),
    };
  } catch (error) {
    if (isRouterHardError(error)) throw error;
    console.error("Search Error:", error);
    throw error;
  }
};

export const generateMapsResponse = async (apiKey: string, query: string) => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return { text: "Error retrieving map data.", groundingChunks: [] };
    const result = await invokeAI(
      'web_search',
      { messages: [{ role: 'user', content: query }] },
      { workspaceId },
    );
    return {
      text: result.text || "No location data found.",
      groundingChunks: (result.groundingChunks || []).map(c => ({
        web: { uri: c.uri, title: c.title },
      })),
    };
  } catch (error) {
    if (isRouterHardError(error)) throw error;
    console.error("Maps Error:", error);
    return { text: "Error retrieving map data.", groundingChunks: [] };
  }
};

// ─── Image generation — KEPT on direct SDK ───────────────────────────────────
// Uses gemini-2.5-flash-image / gemini-3-pro-image-preview — specialized image
// models that are not routed through ai-router.

export const generateImage = async (apiKey: string, prompt: string) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
    });
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};

export const editImage = async (apiKey: string, imageBase64: string, prompt: string, mimeType: string = 'image/png') => {
  const ai = new GoogleGenAI({ apiKey });
  const cleanMime = mimeType.split(';')[0].trim();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType: cleanMime } },
          { text: prompt },
        ],
      },
    });
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) {
    console.error("Image Edit Error:", error);
    throw error;
  }
};

export const generateProImage = async (apiKey: string, prompt: string, aspectRatio: string = "1:1", size: string = "1K") => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: aspectRatio, imageSize: size } }
    });
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) {
    console.error("Pro Image Gen Error:", error);
    throw error;
  }
};

// ─── Text generation — migrated to router ────────────────────────────────────

export const generateJournalInsight = async (apiKey: string, text: string) => {
  void apiKey;
  const prompt = `Analyze this journal entry and provide a very brief, empathetic insight or advice (max 2 sentences). Entry: "${text}"`;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const result = await invokeAIPrompt('sentiment_analysis', withFormattedOutput(prompt, 'journal'), { workspaceId });
    return result ?? null;
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:generateJournalInsight] Primary call failed', err);
    return null;
  }
};

export const generateSmartReply = async (apiKey: string, history: {role: string, text: string}[]) => {
  void apiKey;
  const conversation = history.map(h => `${h.role}: ${h.text}`).join('\n');

  // Get calendar context for scheduling-related replies
  let calendarContext = '';
  try {
    calendarContext = await getCalendarContextForAI();
  } catch {
    // Ignore calendar errors
  }

  const systemPrompt = calendarContext
    ? `You are a helpful communication assistant with access to the user's calendar:\n\n${calendarContext}\n\nIf the conversation involves scheduling or availability, use the calendar context to inform your response.`
    : 'You are a helpful communication assistant.';

  const userPrompt = `Read the following conversation and draft a professional, concise, and friendly reply for the user. Do not include quotes. Just the reply text.\n\nConversation:\n${conversation}`;

  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const result = await invokeAIPrompt('quick_reply_suggestions', withFormattedOutput(userPrompt, 'chat'), {
      workspaceId,
      systemPrompt,
    });
    return result ?? null;
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:generateSmartReply] Primary call failed', err);
    return null;
  }
};

export const generateSummary = async (apiKey: string, text: string) => {
  void apiKey;
  const prompt = `Summarize the following text or conversation into 3 key bullet points:\n\n${text}`;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const result = await invokeAIPrompt('message_summary', withFormattedOutput(prompt, 'summary'), { workspaceId });
    return result ?? null;
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:generateSummary] Primary call failed', err);
    return null;
  }
};

// ─── Audio transcription — KEPT on direct SDK ────────────────────────────────
// Uses gemini-2.5-flash with audio inlineData (base64). The router does not
// yet accept audio/video binary payloads — that's Phase 4 territory.

export const transcribeMedia = async (apiKey: string, mediaBase64: string, mimeType: string = 'audio/webm') => {
  const ai = new GoogleGenAI({ apiKey });
  const cleanMime = mimeType.split(';')[0].trim();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: cleanMime, data: mediaBase64 } },
          { text: "Transcribe the speech in this media exactly as spoken. Do not add any commentary." }
        ]
      },
    });
    return response.text;
  } catch (e) {
    console.error("Transcription Error Full Details:", e);
    return null;
  }
};

export const generateMeetingNote = async (apiKey: string, audioBase64: string, mimeType: string = 'audio/webm') => {
  const ai = new GoogleGenAI({ apiKey });
  const cleanMime = mimeType.split(';')[0].trim();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: cleanMime, data: audioBase64 } },
          { text: withFormattedOutput(
            "You are an AI meeting scribe. Listen to this short audio segment of a meeting. Extract any key facts, action items, decisions, or important updates into a single concise sentence. If the audio is silence or irrelevant, return empty string.",
            'meeting-notes'
          ) }
        ]
      },
    });
    return response.text;
  } catch {
    return null;
  }
};

// ─── Daily briefing (migrated, JSON mode) ────────────────────────────────────

export const generateDailyBriefing = async (apiKey: string, context: string) => {
  void apiKey;

  const briefingPrompt = `You are a top-tier executive assistant for Pulse, a comprehensive personal productivity and communication platform.

Analyze the following comprehensive daily context which includes data from:
- Calendar events and meetings
- Tasks (urgent, pending, overdue)
- Messages from various channels (Pulse, Slack, email)
- Voice messages (Voxes)
- Active projects and outcomes
- Recent journal entries and decisions
- Contacts and communications
- AI-powered task intelligence and recommendations

Generate a highly personalized and actionable daily briefing that:
1. Acknowledges the time of day appropriately
2. Highlights the most critical items needing attention
3. Provides specific, actionable suggestions with clear reasoning
4. Prioritizes urgent matters but also surfaces important non-urgent items
5. References specific data from the context (names, times, tasks, etc.)
6. Suggests AI features that could help (e.g., "Break down 'Build dashboard' into subtasks with AI")
7. Identifies workload imbalances and recommends redistributing tasks
8. Warns about complex tasks without deadlines

Return JSON with these fields:
- greeting: personalized greeting acknowledging the time of day
- summary: 2-3 sentence executive summary of the day ahead, highlighting key priorities and any concerns
- highlights: array of {category, title, detail, priority} items needing attention
    - category: one of calendar, task, message, email, vox, contact, project
    - priority: one of urgent, high, medium, low
- suggestions: array of {action, reason, type, priority, aiFeature?} actionable suggestions
    - type: one of message, event, task, email, vox, contact, ai_assist
    - priority: one of urgent, high, medium, low
- focusRecommendation: single sentence on what to focus on first

Context:
${context}

Return ONLY valid JSON.`;

  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      return {
        greeting: "Welcome back.",
        summary: "Your dashboard is ready. Connect your accounts to get personalized insights.",
        highlights: [],
        suggestions: [],
        focusRecommendation: "Start by reviewing your tasks and calendar for today."
      };
    }
    return await invokeAIJson('thread_digest', withFormattedOutput(briefingPrompt, 'briefing'), { workspaceId });
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    console.error('Briefing generation error:', e);
    return {
      greeting: "Welcome back.",
      summary: "Your dashboard is ready. Connect your accounts to get personalized insights.",
      highlights: [],
      suggestions: [],
      focusRecommendation: "Start by reviewing your tasks and calendar for today."
    };
  }
};

export const generateThinkingResponse = async (apiKey: string, prompt: string) => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const result = await invokeAIPrompt('rag_query', prompt, {
      workspaceId,
      systemPrompt: 'You are a thoughtful AI assistant. Think carefully and provide a detailed, reasoned response.',
    });
    return result ?? null;
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:generateThinkingResponse] Primary call failed', err);
    return null;
  }
};

export const generateCode = async (apiKey: string, prompt: string) => {
  void apiKey;
  const codePrompt = `Write clean code for: ${prompt}. Return ONLY code with brief explanatory comments.`;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const result = await invokeAIPrompt(
      'content_generation',
      withFormattedOutput(`You are an expert software engineer. ${codePrompt}`, 'code'),
      {
        workspaceId,
        systemPrompt: 'You are an expert software engineer. Return ONLY code with brief explanatory comments.',
      }
    );
    return result ?? null;
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:generateCode] Primary call failed', err);
    return null;
  }
};

// ─── Video — KEPT on direct SDK ──────────────────────────────────────────────
// Uses veo-3.1-fast-generate-preview (video gen) and gemini-3-pro-preview with
// video inlineData for analysis — specialized models not in router.

export const analyzeVideo = async (apiKey: string, videoBase64: string, mimeType: string, prompt: string) => {
  const ai = new GoogleGenAI({ apiKey });
  const cleanMime = mimeType.split(';')[0].trim();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: cleanMime, data: videoBase64 } },
          { text: prompt }
        ]
      },
    });
    return response.text;
  } catch (e) {
    throw e;
  }
};

export const generateVideo = async (apiKey: string, prompt: string, imageBase64?: string, imageMime?: string) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    let operation;
    const config = { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' };
    if (imageBase64 && imageMime) {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            image: { imageBytes: imageBase64, mimeType: imageMime.split(';')[0].trim() },
            config: config
        });
    } else {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: config
        });
    }
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({operation: operation});
    }
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (downloadLink) {
        const res = await fetch(`${downloadLink}&key=${apiKey}`);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// ─── Speech (TTS) — KEPT on direct SDK ───────────────────────────────────────
// Uses gemini-2.5-flash-preview-tts — specialized TTS model not in router.

export const generateSpeech = async (apiKey: string, text: string) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: text }] },
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch {
    return null;
  }
};

// ─── Chat (migrated, multi-turn via router) ──────────────────────────────────

export const chatWithBot = async (apiKey: string, history: {role: string, text: string}[], newMessage: string, includeCalendarContext: boolean = true) => {
  void apiKey;

  // Get calendar context for AI awareness
  let systemContext = '';
  if (includeCalendarContext) {
    try {
      const calendarContext = await getCalendarContextForAI();
      if (calendarContext) {
        systemContext = `You are a helpful AI assistant with access to the user's calendar. Here is their current schedule context:\n\n${calendarContext}\n\nUse this calendar information to provide contextually aware responses. For example, if the user mentions a meeting, you can reference their schedule. If they ask about availability, check their calendar.\n\n`;
      }
    } catch {
      // Ignore calendar errors
    }
  }

  const systemPrompt = withFormattedOutput(
    systemContext || 'You are a helpful AI assistant.',
    'chat'
  );

  let result: string | null = null;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (workspaceId) {
      // Convert history to the router's message format.
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = history.map(h => ({
        role: h.role === 'me' ? 'user' as const : 'assistant' as const,
        content: h.text,
      }));
      // Append the current user turn — router contract requires user turn at end.
      messages.push({ role: 'user', content: newMessage });

      const aiResult = await invokeAI(
        'pulse_assistant_chat',
        {
          messages,
          systemPrompt,
        },
        { workspaceId }
      );
      result = aiResult.text ?? null;
    }
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:chatWithBot] Primary call failed', err);
  }

  return result ?? "I'm having trouble connecting right now.";
};

// --- Context Aware Functions ---

export const analyzeDraftIntent = async (apiKey: string, draft: string): Promise<DraftAnalysis | null> => {
  void apiKey;
  if (!draft || draft.length < 5) return null;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    return await invokeAIJson<DraftAnalysis>(
      'email_analysis',
      `Analyze intent: "${draft}". Return JSON with fields: intent (one of: decision, fyi, request, brainstorm, social), suggestion (string), improvedText (string), confidence (number 0-1).`,
      { workspaceId }
    );
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    return null;
  }
};

export const generateThreadContext = async (apiKey: string, history: string): Promise<ThreadContext | null> => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    return await invokeAIJson<ThreadContext>(
      'thread_digest',
      `Analyze history. Extract decisions, topics, related docs.\nHistory:\n${history}\n\nReturn JSON with fields: decisions (string array), keyTopics (string array), relatedDocs (array of {name, type: pdf|doc|sheet|image, url}).`,
      { workspaceId }
    );
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    return null;
  }
};

export const generateCatchUpSummary = async (apiKey: string, history: string): Promise<CatchUpSummary | null> => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    return await invokeAIJson<CatchUpSummary>(
      'thread_digest',
      withFormattedOutput(
        `Create catch up summary. Focus on changes, decisions, blockers.\nHistory:\n${history}\n\nReturn JSON with fields: summary (string), decisionsMade (string array), blockers (string array), actionItems (string array).`,
        'summary'
      ),
      { workspaceId }
    );
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    return null;
  }
};

// --- Attention Intelligence Functions ---

export const detectMeetingIntent = async (apiKey: string, text: string): Promise<AsyncSuggestion | null> => {
  void apiKey;
  if (!text || text.length < 5) return null;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const result = await invokeAIJson<AsyncSuggestion>(
      'meeting_summary',
      `Meeting intent detection for: "${text}". If yes, suggest async alternative. Return JSON with fields: detected (boolean), type (one of: poll, video, doc), reason (string), template (string).`,
      { workspaceId }
    );
    if (!result?.detected) return null;
    return result;
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    return null;
  }
};

export const analyzeMessageUrgency = async (apiKey: string, senderRole: string, message: string): Promise<'high' | 'medium' | 'low'> => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return 'medium';
    const result = await invokeAIJson<{ priority?: 'high' | 'medium' | 'low' }>(
      'auto_tag',
      `Analyze urgency. Sender: ${senderRole}. Msg: ${message}. Return JSON {priority: "high" | "medium" | "low"}.`,
      { workspaceId }
    );
    return result.priority || 'medium';
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    return 'medium';
  }
};

// --- Task Workflow Functions ---

export const extractTaskFromMessage = async (apiKey: string, message: string, contactList: string[]): Promise<(Partial<Task> & { assigneeName?: string }) | null> => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const data = await invokeAIJson<{ title?: string; assigneeName?: string; dueDate?: string }>(
      'task_prioritization',
      `Extract action item from message: "${message}".
Available contacts: ${contactList.join(', ')}.
Return JSON with fields:
- title (string, required)
- assigneeName (string, closest name match or 'Unassigned')
- dueDate (YYYY-MM-DD if explicit, otherwise null or omitted)`,
      { workspaceId }
    );
    if (!data.title) return null;
    return {
      title: data.title,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      assigneeName: data.assigneeName,
    };
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    console.error("Task Extraction Error", e);
    return null;
  }
};

export const parseNaturalLanguageTask = async (
  apiKey: string,
  input: string,
  workspaceMembers: Array<{ name: string; id: string }> = []
): Promise<{
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: string; // ISO date string
  assigneeName?: string;
  tags?: string[];
  estimatedHours?: number;
  dependencies?: string[];
} | null> => {
  void apiKey;
  const memberNames = workspaceMembers.map(m => m.name).join(', ');

  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const parsed = await invokeAIJson<{
      title?: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      deadline?: string;
      assigneeName?: string;
      tags?: string[];
      estimatedHours?: number;
      dependencies?: string[];
    }>(
      'task_prioritization',
      `You are an expert task parser. Parse the following natural language input into a structured task.

Available team members: ${memberNames || 'None specified'}

Input: "${input}"

Extract and return JSON with these fields:
- title: (string, required) Brief task title (5-10 words max)
- description: (string, optional) Additional details if provided
- priority: (string, required) One of: urgent, high, medium, low
  - urgent: uses words like "ASAP", "urgent", "critical", "emergency"
  - high: uses "important", "soon", "priority"
  - medium: default if no urgency indicated
  - low: uses "when you can", "low priority", "eventually"
- deadline: (string, optional) ISO date (YYYY-MM-DD) if date/time mentioned
  - "today" = today's date
  - "tomorrow" = tomorrow's date
  - "next week" = 7 days from now
  - "Friday" = next Friday
  - Parse any explicit dates
- assigneeName: (string, optional) If @mentioned or "assign to X"
  - Match against available team members
  - Return exact name from the list
- tags: (string array, optional) Any hashtags or categories mentioned
- estimatedHours: (number, optional) If duration/effort mentioned (e.g., "2 hour task")
- dependencies: (string array, optional) If "after X" or "depends on Y" mentioned

Return ONLY valid JSON, no explanations.`,
      { workspaceId }
    );
    if (!parsed.title) return null;
    return {
      title: parsed.title,
      description: parsed.description,
      priority: parsed.priority || 'medium',
      deadline: parsed.deadline,
      assigneeName: parsed.assigneeName,
      tags: parsed.tags,
      estimatedHours: parsed.estimatedHours,
      dependencies: parsed.dependencies,
    };
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    console.error('NL Task Parsing Error:', e);
    return null;
  }
};

export const parseNaturalLanguageTaskWithFallback = async (
  apiKey: string,
  input: string,
  workspaceMembers: Array<{ name: string; id: string }> = []
): Promise<ReturnType<typeof parseNaturalLanguageTask>> => {
  try {
    return await parseNaturalLanguageTask(apiKey, input, workspaceMembers);
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:parseNaturalLanguageTask] Primary call failed', err);
    return null;
  }
};

export const generateSubtasksFromTask = async (
  apiKey: string,
  taskTitle: string,
  taskDescription?: string,
  taskPriority?: string,
  maxSubtasks: number = 8
): Promise<Array<{
  title: string;
  estimatedHours?: number;
  order: number;
}> | null> => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;

    const contextInfo = [
      `Task: ${taskTitle}`,
      taskDescription ? `Description: ${taskDescription}` : '',
      taskPriority ? `Priority: ${taskPriority}` : ''
    ].filter(Boolean).join('\n');

    const parsed = await invokeAIJson<Array<{ title: string; estimatedHours?: number; order: number }>>(
      'task_prioritization',
      `You are an expert project manager helping break down tasks into actionable subtasks.

${contextInfo}

Generate ${maxSubtasks} specific, actionable subtasks for completing this task. Each subtask should:
- Be concrete and actionable (starts with a verb)
- Be completable independently
- Follow logical order (earlier tasks enable later ones)
- Have realistic time estimates

Return JSON array of subtasks with these fields:
- title: (string) Clear, actionable subtask description (e.g., "Set up API endpoints", "Design dashboard layout")
- estimatedHours: (number, optional) Estimated hours to complete (0.5 to 8 hours typical)
- order: (number) Execution order (1 = first, ${maxSubtasks} = last)

Example output:
[
  {"title": "Research dashboard requirements and user needs", "estimatedHours": 2, "order": 1},
  {"title": "Create wireframes for dashboard layout", "estimatedHours": 3, "order": 2},
  {"title": "Set up API endpoints for dashboard data", "estimatedHours": 4, "order": 3}
]

Return ONLY the JSON array, no explanations.`,
      { workspaceId }
    );
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    console.error('Subtask Generation Error:', e);
    return null;
  }
};

export const generateSubtasksFromTaskWithFallback = async (
  apiKey: string,
  taskTitle: string,
  taskDescription?: string,
  taskPriority?: string,
  maxSubtasks: number = 8
): Promise<Array<{
  title: string;
  estimatedHours?: number;
  order: number;
}> | null> => {
  try {
    return await generateSubtasksFromTask(apiKey, taskTitle, taskDescription, taskPriority, maxSubtasks);
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:generateSubtasksFromTask] Primary call failed', err);
    return null;
  }
};

export const analyzeOutcomeProgress = async (apiKey: string, history: string, goal: string): Promise<{status: string, progress: number, blockers: string[]}> => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return { status: 'on_track', progress: 0, blockers: [] };
    return await invokeAIJson<{ status: string; progress: number; blockers: string[] }>(
      'rag_query',
      `Analyze chat history against goal: "${goal}".
Determine status (on_track, at_risk, completed, blocked), progress (0-100), and list blockers.
Return JSON with fields: status (one of: on_track, at_risk, completed, blocked), progress (number 0-100), blockers (string array).
History: ${history}`,
      { workspaceId }
    );
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    return { status: 'on_track', progress: 0, blockers: [] };
  }
};

// --- Social Health & Relationship Functions ---

export const analyzeTeamHealth = async (apiKey: string, history: string): Promise<TeamHealth | null> => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    return await invokeAIJson<TeamHealth>(
      'sentiment_analysis',
      withFormattedOutput(
        `Analyze communication health. Look for unanswered questions, uneven participation, tense sentiment.
History: ${history}

Return JSON with fields: score (number 0-100), status (one of: healthy, at_risk, critical), issues (string array), reliability (one of: high, medium, low).`,
        'team-health'
      ),
      { workspaceId }
    );
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    return null;
  }
};

export const generateNudge = async (apiKey: string, history: string): Promise<Nudge | null> => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const result = await invokeAIJson<{ suggestion?: Nudge }>(
      'proactive_nudge',
      withFormattedOutput(
        `Analyze last messages. Suggest if user should follow up (delay), clarify (confusion), or de-escalate (tension). If all good, return {"suggestion": null}.
History: ${history}

Return JSON with field: suggestion — an object with {type: one of "follow_up" | "clarify" | "de_escalate" | "praise", message: "Short private suggestion to user"} or null.`,
        'nudge'
      ),
      { workspaceId }
    );
    return result?.suggestion || null;
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    return null;
  }
};

export const generateHandoffSummary = async (apiKey: string, history: string): Promise<HandoffSummary | null> => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    return await invokeAIJson<HandoffSummary>(
      'thread_digest',
      withFormattedOutput(
        `Create handoff summary for new person joining.
History: ${history}

Return JSON with fields: context (string), keyDecisions (string array), pendingActions (string array).`,
        'summary'
      ),
      { workspaceId }
    );
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    return null;
  }
};

// --- Cross-App & Multi-Modal Functions ---

// ─── Voice memo analysis — KEPT on direct SDK ────────────────────────────────
// Uses gemini-2.5-flash with audio inlineData (base64) — multimodal audio input
// not yet supported by the router.

export const analyzeVoiceMemo = async (apiKey: string, audioBase64: string): Promise<VoiceAnalysis | null> => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
          { text: withFormattedOutput(
            "Listen to this audio. Return JSON with: full transcription, concise summary (1-2 sentences), list of action items (tasks), and list of decisions made.",
            'voice-analysis'
          ) }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: { type: Type.STRING },
            summary: { type: Type.STRING },
            actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
            decisions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["transcription", "summary", "actionItems", "decisions"]
        }
      }
    });
    return JSON.parse(response.text || '{}') as VoiceAnalysis;
  } catch (e) {
    console.error("Deep Audio Error", e);
    return null;
  }
};

export const generateChannelArtifact = async (apiKey: string, history: string, title: string): Promise<ChannelArtifact | null> => {
  void apiKey;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    return await invokeAIJson<ChannelArtifact>(
      'content_generation',
      `Transform this chat history into a structured Wiki Artifact for project "${title}".
Return JSON with fields: title (string), overview (paragraph string), spec (Markdown content describing features/requirements derived from chat), decisions (string array), milestones (string array).
History: ${history}`,
      { workspaceId }
    );
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    return null;
  }
};

// ============================================
// EMAIL AI FUNCTIONS
// ============================================

export type EmailTone = 'professional' | 'friendly' | 'concise' | 'formal';

export interface EmailDraft {
  subject: string;
  body: string;
  suggestions: string[];
}

export const generateEmailDraft = async (
  apiKey: string,
  context: {
    replyTo?: { from: string; subject: string; body: string };
    intent: string;
    tone: EmailTone;
    recipientName?: string;
  }
): Promise<EmailDraft | null> => {
  void apiKey;

  const toneDescriptions = {
    professional: 'professional and business-appropriate',
    friendly: 'warm, friendly, and approachable',
    concise: 'brief, to-the-point, and efficient',
    formal: 'formal and respectful with proper etiquette'
  };

  const basePrompt = context.replyTo
    ? `Generate an email reply with the following details:
       Original email from: ${context.replyTo.from}
       Original subject: ${context.replyTo.subject}
       Original body: ${context.replyTo.body}

       User's intent for reply: ${context.intent}
       Tone: ${toneDescriptions[context.tone]}
       ${context.recipientName ? `Recipient name: ${context.recipientName}` : ''}

       Return JSON: { "subject": "Re: ...", "body": "email body text", "suggestions": ["alternative phrase 1", "alternative phrase 2"] }`
    : `Generate a new email with the following details:
       Purpose: ${context.intent}
       Tone: ${toneDescriptions[context.tone]}
       ${context.recipientName ? `Recipient name: ${context.recipientName}` : ''}

       Return JSON: { "subject": "subject line", "body": "email body text", "suggestions": ["alternative phrase 1", "alternative phrase 2"] }`;

  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    return await invokeAIJson<EmailDraft>(
      'email_draft',
      withFormattedOutput(basePrompt, 'email-draft'),
      { workspaceId }
    );
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:generateEmailDraft] Primary call failed', err);
    return null;
  }
};

export const improveEmailText = async (
  apiKey: string,
  text: string,
  improvement: 'shorten' | 'elaborate' | 'fix_grammar' | 'make_friendlier' | 'make_formal'
): Promise<string | null> => {
  void apiKey;
  if (!text) return null;

  const instructions = {
    shorten: 'Make this text more concise while keeping the main points',
    elaborate: 'Expand on this text with more detail and context',
    fix_grammar: 'Fix any grammar, spelling, or punctuation errors',
    make_friendlier: 'Rewrite this in a warmer, more friendly tone',
    make_formal: 'Rewrite this in a more formal, professional tone',
  };

  const rawPrompt = `${instructions[improvement]}:\n\n${text}\n\nReturn only the improved text, nothing else.`;

  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const result = await invokeAIPrompt('email_reply', withFormattedOutput(rawPrompt, 'email-draft'), { workspaceId });
    return result ?? null;
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:improveEmailText] Primary call failed', err);
    return null;
  }
};

export const generateEmailSuggestions = async (
  apiKey: string,
  emailContext: { from: string; subject: string; body: string }
): Promise<string[] | null> => {
  void apiKey;

  const rawPrompt = `Given this email:
From: ${emailContext.from}
Subject: ${emailContext.subject}
Body: ${emailContext.body}

Generate 3 smart reply suggestions (short, 1-2 sentences each).
Return JSON array: ["suggestion 1", "suggestion 2", "suggestion 3"]`;

  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    return await invokeAIJson<string[]>(
      'quick_reply_suggestions',
      withFormattedOutput(rawPrompt, 'chat'),
      { workspaceId }
    );
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:generateEmailSuggestions] Primary call failed', err);
    return null;
  }
};

// AI Lab Functions
export const summarizeText = async (apiKey: string, text: string): Promise<string | null> => {
  void apiKey;
  if (!text) return null;

  const prompt = `Summarize the following text concisely, capturing the key points and main ideas:\n\n${text}\n\nProvide a clear, well-structured summary.`;

  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const result = await invokeAIPrompt('message_summary', withFormattedOutput(prompt, 'summary'), { workspaceId });
    return result ?? null;
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:summarizeText] Primary call failed', err);
    return null;
  }
};

// ─── Image analysis — KEPT on direct SDK ─────────────────────────────────────
// Text output from image input (multimodal). Router does not yet support
// image payloads — that's Phase 4 territory.

export const analyzeImage = async (apiKey: string, imageBase64: string, prompt: string): Promise<string | null> => {
  if (!apiKey || !imageBase64) return null;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/png', data: imageBase64 } },
            { text: withFormattedOutput(prompt, 'image-analysis') }
          ]
        }]
      })
    });

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    console.error('Image analysis failed:', e);
    return null;
  }
};

// ─── Embeddings — KEPT on direct SDK ─────────────────────────────────────────
// Uses text-embedding-005 — not a generative model, not in router.

export const generateEmbedding = async (apiKey: string, text: string): Promise<number[] | null> => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-005:embedContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: {
          parts: [{ text }]
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Embedding API Error (${response.status}):`, errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.embedding?.values || null;
  } catch (e) {
    console.error("Embedding generation failed:", e);
    return null;
  }
};

// ─── Generic text processing (migrated) ──────────────────────────────────────
// The `model` parameter is IGNORED — the router picks per-task.
// Kept in the signature for backward compatibility with the 25+ downstream callers.

export const processWithModel = async (
  apiKey: string,
  prompt: string,
  model: string = 'gemini-2.5-flash' // IGNORED — router decides per task
): Promise<string | null> => {
  void apiKey;
  void model;
  if (!prompt) return null;

  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const result = await invokeAIPrompt(
      'pulse_assistant_chat',
      withFormattedOutput(prompt, 'default'),
      { workspaceId }
    );
    return result ?? null;
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:processWithModel] Primary call failed', err);
    return null;
  }
};

// ==================== Proxy-based Model Processing ====================

/**
 * Historically routed through the `gemini-proxy` edge function; now a thin
 * re-export of `processWithModel`. The router handles keys and proxying,
 * so the separate proxy path is obsolete.
 *
 * NOTE: Signature differs from `processWithModel` — no `apiKey` first arg.
 * Downstream callers must continue to call this with (prompt, model?).
 */
export async function processWithModelViaProxy(
  prompt: string,
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  const result = await processWithModel('', prompt, model);
  return result || '';
}

// ==================== Security Layer ====================

/**
 * Secure wrapper for Gemini API calls with rate limiting and retry logic.
 *
 * Migrated to route through `ai-router` for all text generation. Rate limiting
 * is still applied client-side as a belt-and-braces measure on top of the
 * router's workspace-level hard caps.
 */
export const secureGeminiService = {
  /**
   * Historical health check for the backend API proxy. With router-based
   * routing this is always available (the router handles its own fallbacks),
   * so we return true and keep the method for API compatibility.
   */
  async isProxyAvailable(): Promise<boolean> {
    return true;
  },

  /**
   * Secure generate content — migrated to route through ai-router.
   * `contents` may be a string or a Gemini-style `{ parts: [...] }` / array
   * structure. Non-string inputs are best-effort flattened to text.
   * `config` is accepted for backward compatibility but largely ignored —
   * the router picks the model, temperature, and JSON mode per task.
   */
  async generateContent(
    model: string,
    contents: any,
    config?: any,
    userId: string = 'anonymous'
  ): Promise<any> {
    void model;

    // Check rate limits (client-side belt-and-braces)
    const rateLimitCheck = await rateLimitService.checkLimit('api_gemini', userId);
    if (!rateLimitCheck.allowed) {
      throw new Error(
        `Rate limit exceeded. Please wait ${Math.ceil(rateLimitCheck.retryAfter / 60000)} minutes before trying again.`
      );
    }

    // Sanitize input
    const sanitizedContents = sanitizationService.sanitizeObject(contents);

    // Flatten contents to a plain prompt string.
    let prompt = '';
    if (typeof sanitizedContents === 'string') {
      prompt = sanitizedContents;
    } else if (sanitizedContents?.parts && Array.isArray(sanitizedContents.parts)) {
      prompt = sanitizedContents.parts
        .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('\n');
    } else if (Array.isArray(sanitizedContents)) {
      prompt = sanitizedContents
        .map((c: any) => {
          if (typeof c === 'string') return c;
          if (c?.parts && Array.isArray(c.parts)) {
            return c.parts.map((p: any) => p?.text ?? '').join('\n');
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
    } else {
      prompt = JSON.stringify(sanitizedContents ?? '');
    }

    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      throw new Error('No active workspace — AI unavailable.');
    }

    const text = await retryService.executeWithRetry(
      async () => {
        const aiResult = await invokeAI(
          'pulse_assistant_chat',
          {
            messages: [{ role: 'user', content: prompt }],
            temperature: config?.temperature,
            jsonMode: config?.responseMimeType === 'application/json',
          },
          { workspaceId }
        );
        return aiResult.text;
      },
      3,
      2
    );

    // Record rate limit usage
    await rateLimitService.recordRequest('api_gemini', userId);
    usageTracker.aiMessage();

    // Shape matches the legacy Gemini SDK response so existing callers that
    // read `.text` keep working.
    return { text };
  },

  /**
   * Secure chat with rate limiting
   */
  async chat(prompt: string, options?: { temperature?: number; userId?: string }): Promise<string> {
    const userId = options?.userId || 'anonymous';

    // Sanitize prompt
    const sanitizedPrompt = sanitizationService.sanitizeText(prompt, { maxLength: 10000 });

    const result = await this.generateContent(
      'gemini-2.5-flash',
      sanitizedPrompt,
      {
        temperature: options?.temperature ?? 0.7,
      },
      userId
    );

    return result.text || '';
  },
};

// Convenience wrapper for voice command service and other consumers
// that expect a simple chat interface.
// DEPRECATED: Use secureGeminiService instead for new implementations.
export const geminiService = {
  async chat(prompt: string, options?: { temperature?: number }): Promise<string> {
    const sanitizedPrompt = sanitizationService.sanitizeText(prompt, { maxLength: 10000 });

    try {
      const workspaceId = getCurrentWorkspaceId();
      if (workspaceId) {
        const aiResult = await invokeAI(
          'pulse_assistant_chat',
          {
            messages: [{ role: 'user', content: sanitizedPrompt }],
            temperature: options?.temperature ?? 0.7,
          },
          { workspaceId }
        );
        return aiResult.text || '';
      }
    } catch (error) {
      if (isRouterHardError(error)) throw error;
      console.error('[geminiService.chat] Router call failed:', error);
    }

    throw new Error('AI service unavailable: router call failed or workspace not configured.');
  },
};
