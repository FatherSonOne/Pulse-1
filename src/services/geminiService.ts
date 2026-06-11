// ─── Phase D migration note ──────────────────────────────────────────────────
// AI routing in this module is server-side via Supabase edge functions
// (ai-router, gemini-audio, gemini-video, gemini-image, gemini-speech,
// gemini-embed). No browser-side Gemini API key is read or threaded through
// these exports — workspace JWT auth + workspace_id are used instead.
//
// The ONE exception is `generateVideo` (Veo long-poll), which still uses the
// browser-side key per Phase C decision 5B until that long-polling surface is
// migrated to its own async edge function.

import { GoogleGenAI } from "@google/genai";
import { DraftAnalysis, ThreadContext, CatchUpSummary, AsyncSuggestion, Task, TeamHealth, Nudge, HandoffSummary, VoiceAnalysis, ChannelArtifact } from "../types";
import { googleCalendarService } from "./googleCalendarService";
import { withFormattedOutput } from "./aiFormattingService";
import { rateLimitService } from "./rateLimitService";
import { retryService } from "./retryService";
import { sanitizationService } from "./sanitizationService";
import { usageTracker } from "./usageTracker";
import { invokeAI, invokeAIPrompt, invokeAIJson } from "./ai/aiService";
import { getCurrentWorkspaceId } from "./ai/getWorkspaceId";
import { supabase } from "./supabase";
import {
  AIRouterError,
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
  AIJsonParseError,
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
export const generateSearchResponse = async (query: string) => {
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

export const generateMapsResponse = async (query: string) => {
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

// ─── Image generation — migrated to gemini-image edge function ───────────────
// Server-side wrapper holds GEMINI_API_KEY and enforces workspace/cap.
// `apiKey` parameter is ignored (kept for backward compatibility — drop in Phase D).

async function invokeGeminiImage(
  action: 'generate' | 'edit' | 'pro_generate',
  body: Record<string, unknown>,
): Promise<string | null> {
  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) return null;
  const { data, error } = await supabase.functions.invoke('gemini-image', {
    body: { action, workspace_id: workspaceId, ...body },
  });
  if (error) {
    console.error(`[gemini-image:${action}] invoke error:`, error);
    throw error;
  }
  return (data as { image?: string } | null)?.image ?? null;
}

export const generateImage = async (prompt: string) => {
  try {
    return await invokeGeminiImage('generate', { prompt });
  } catch (error) {
    console.error('Image Gen Error:', error);
    throw error;
  }
};

export const editImage = async (imageBase64: string, prompt: string, mimeType: string = 'image/png') => {
  try {
    return await invokeGeminiImage('edit', {
      prompt,
      image_base64: imageBase64,
      mime_type: mimeType,
    });
  } catch (error) {
    console.error('Image Edit Error:', error);
    throw error;
  }
};

export const generateProImage = async (prompt: string, aspectRatio: string = '1:1', size: string = '1K') => {
  try {
    return await invokeGeminiImage('pro_generate', {
      prompt,
      aspect_ratio: aspectRatio,
      image_size: size,
    });
  } catch (error) {
    console.error('Pro Image Gen Error:', error);
    throw error;
  }
};

// ─── Text generation — migrated to router ────────────────────────────────────

export const generateJournalInsight = async (text: string) => {
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

export const generateSmartReply = async (history: {role: string, text: string}[]) => {
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

export const generateSummary = async (text: string) => {
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

/** Structured shape returned by {@link generateMeetingSummary}. Mirrors the
 *  daily-webhook recording.ready summarizer (supabase/functions/daily-webhook)
 *  so the Leave path and the recording path emit an identical object. */
export interface StructuredMeetingSummary {
  aiSummary: string;
  keyPoints: string[];
  actionItems: { text: string; owner?: string; priority?: 'high' | 'medium' | 'low' }[];
  decisions: string[];
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'mixed' | 'tense';
}

/**
 * Structured meeting summary for the Pulse video Leave path. Returns a JSON
 * STRING (the stringified {@link StructuredMeetingSummary}), so it persists into
 * `pulse_video_rooms.summary` in the exact shape every downstream consumer was
 * written to parse — the summary view (keyPoints / actionItems / decisions),
 * `fetchMeetingAnalytics` (sentiment / topics / decisions), and
 * `getMeetingRecordings` (aiSummary). The prior Leave path used the plain
 * 3-bullet `generateSummary`, which those parsers could not read, leaving every
 * structured field empty. Returns null on empty transcript, missing workspace,
 * or a soft failure (callers fall back to the raw transcript). Gemini stays
 * server-side via the ai-router (invokeAIJson handles JSON repair).
 */
export const generateMeetingSummary = async (
  transcript: string,
  title = 'Meeting',
): Promise<string | null> => {
  if (!transcript || !transcript.trim()) return null;
  const prompt = `You are an expert meeting summarizer. Analyze this meeting transcript and return a JSON object.

Meeting title: "${title}"

Transcript:
${transcript.slice(0, 8000)}

Return ONLY valid JSON with this exact structure:
{
  "aiSummary": "2-3 sentence executive summary of the meeting",
  "keyPoints": ["key point 1", "key point 2"],
  "actionItems": [{ "text": "action description", "owner": "person name or empty string", "priority": "high|medium|low" }],
  "decisions": ["decision 1", "decision 2"],
  "topics": ["topic 1", "topic 2"],
  "sentiment": "positive|neutral|mixed|tense"
}`;
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const structured = await invokeAIJson<StructuredMeetingSummary>('meeting_summary', prompt, { workspaceId });
    return JSON.stringify(structured);
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:generateMeetingSummary] failed', err);
    return null;
  }
};

// ─── Audio transcription — migrated to gemini-audio edge function ────────────
// Server-side wrapper holds GEMINI_API_KEY and enforces workspace/cap.
// `apiKey` parameter is ignored (kept for backward compatibility with callers
// that still pass localStorage'd keys — drop those reads in Phase D cleanup).

async function invokeGeminiAudio<T extends 'transcribe' | 'meeting_note' | 'analyze_memo'>(
  action: T,
  audio_base64: string,
  mime_type: string,
  extra: Record<string, unknown> = {},
): Promise<{ text?: string; data?: unknown } | null> {
  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) return null;
  const { data, error } = await supabase.functions.invoke('gemini-audio', {
    body: { action, audio_base64, mime_type, workspace_id: workspaceId, ...extra },
  });
  if (error) {
    console.error(`[gemini-audio:${action}] invoke error:`, error);
    return null;
  }
  return data as { text?: string; data?: unknown };
}

export const transcribeMedia = async (mediaBase64: string, mimeType: string = 'audio/webm') => {
  try {
    const result = await invokeGeminiAudio('transcribe', mediaBase64, mimeType, {
      punctuation: false,
    });
    return result?.text ?? null;
  } catch (e) {
    console.error('Transcription Error Full Details:', e);
    return null;
  }
};

export const generateMeetingNote = async (audioBase64: string, mimeType: string = 'audio/webm') => {
  try {
    const result = await invokeGeminiAudio('meeting_note', audioBase64, mimeType);
    return result?.text ?? null;
  } catch {
    return null;
  }
};

// ─── Daily briefing (migrated, JSON mode) ────────────────────────────────────

export const generateDailyBriefing = async (context: string) => {

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
    if (e instanceof AIJsonParseError) {
      // Model returned malformed/truncated JSON — fell through every repair
      // tier (strict / fence-strip / balanced-extract / trailing-comma). Log
      // the underlying parser message + length + both ends so the failure mode
      // is classifiable: "end of JSON input" => truncation (server output cap),
      // "Unexpected token" => stray garbage, "control character" => unescaped
      // newline in a string field. Head-only logging couldn't tell these apart.
      const raw = e.rawText ?? '';
      console.warn(
        '[briefing] model returned unparseable JSON; using fallback.',
        {
          parseError: e.parseError?.message,
          length: raw.length,
          head: raw.slice(0, 200),
          tail: raw.slice(-200),
        },
      );
    } else {
      console.error('Briefing generation error:', e);
    }
    return {
      greeting: "Welcome back.",
      summary: "Your dashboard is ready. Connect your accounts to get personalized insights.",
      highlights: [],
      suggestions: [],
      focusRecommendation: "Start by reviewing your tasks and calendar for today."
    };
  }
};

export const generateThinkingResponse = async (prompt: string) => {
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

export const generateCode = async (prompt: string) => {
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

export const analyzeVideo = async (videoBase64: string, mimeType: string, prompt: string) => {
  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) return null;
  const { data, error } = await supabase.functions.invoke('gemini-video', {
    body: {
      action: 'analyze',
      video_base64: videoBase64,
      mime_type: mimeType,
      prompt,
      model: 'gemini-3-pro-preview',
      workspace_id: workspaceId,
    },
  });
  if (error) {
    console.error('[gemini-video:analyzeVideo] invoke error:', error);
    throw error;
  }
  return (data as { text?: string } | null)?.text ?? null;
};

// TODO(Phase-C, decision-5B): Veo `generateVideo` is NOT migrated to a server-
// side edge function. The 1-6 minute long-poll would double the gemini-video
// surface (sync poll endpoint + client polling loop) for negligible value —
// the only caller is Tools.tsx (internal dev tool). When/if Veo gets a real
// user-facing surface, build a gemini-video-async function with operation_id
// polling. For now this still uses the browser-side API key.
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

// ─── Speech (TTS) — migrated to gemini-speech edge function ──────────────────
// Returns raw base64 PCM string (no data-URL prefix) to preserve the legacy
// contract expected by audioService.decodeAudioData.

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    const { data, error } = await supabase.functions.invoke('gemini-speech', {
      body: { text, workspace_id: workspaceId },
    });
    if (error) {
      console.error('[gemini-speech] invoke error:', error);
      return null;
    }
    return (data as { audio?: string } | null)?.audio ?? null;
  } catch {
    return null;
  }
};

// ─── Chat (migrated, multi-turn via router) ──────────────────────────────────

export const chatWithBot = async (history: {role: string, text: string}[], newMessage: string, includeCalendarContext: boolean = true) => {

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

export const analyzeDraftIntent = async (draft: string): Promise<DraftAnalysis | null> => {
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

export const generateThreadContext = async (history: string): Promise<ThreadContext | null> => {
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

export const generateCatchUpSummary = async (history: string): Promise<CatchUpSummary | null> => {
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

export const detectMeetingIntent = async (text: string): Promise<AsyncSuggestion | null> => {
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

export const analyzeMessageUrgency = async (senderRole: string, message: string): Promise<'high' | 'medium' | 'low'> => {
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

export const extractTaskFromMessage = async (message: string, contactList: string[]): Promise<(Partial<Task> & { assigneeName?: string }) | null> => {
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
  input: string,
  workspaceMembers: Array<{ name: string; id: string }> = []
): Promise<ReturnType<typeof parseNaturalLanguageTask>> => {
  try {
    return await parseNaturalLanguageTask(input, workspaceMembers);
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:parseNaturalLanguageTask] Primary call failed', err);
    return null;
  }
};

export const generateSubtasksFromTask = async (
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
    return await generateSubtasksFromTask(taskTitle, taskDescription, taskPriority, maxSubtasks);
  } catch (err) {
    if (isRouterHardError(err)) throw err;
    console.error('[gemini:generateSubtasksFromTask] Primary call failed', err);
    return null;
  }
};

export const analyzeOutcomeProgress = async (history: string, goal: string): Promise<{status: string, progress: number, blockers: string[]}> => {
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

export const analyzeTeamHealth = async (history: string): Promise<TeamHealth | null> => {
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

// Per-message sentiment scoring. Returns an array of `{messageId, score
// in [-1, 1], label, emotions}` for each input message in a single
// batched LLM call. Used by the Sentiment tool to populate the timeline
// chart without N round-trips. Returns null on soft failure; callers
// can fall back to heuristic / empty state.
export const scoreMessageSentiments = async (
  messages: Array<{ id: string; text: string; sender: string }>,
): Promise<Array<{
  messageId: string;
  score: number;
  label: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  emotions: string[];
}> | null> => {
  if (!messages.length) return [];
  try {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) return null;
    // Cap the batch so we stay well under context limits.
    const batch = messages.slice(-50);
    const payload = batch.map(m => `[${m.id}] ${m.sender}: ${m.text}`).join('\n');
    const result = await invokeAIJson<{
      scores: Array<{
        messageId: string;
        score: number;
        label: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
        emotions?: string[];
      }>;
    }>(
      'sentiment_analysis',
      withFormattedOutput(
        `Score the sentiment of each message. Return JSON {"scores": [{messageId, score (-1 to 1), label (one of: very_positive, positive, neutral, negative, very_negative), emotions (string array of up to 3 emotion words)}]}.

Messages:
${payload}`,
        'analysis',
      ),
      { workspaceId },
    );
    if (!result?.scores) return null;
    return result.scores.map(s => ({
      messageId: s.messageId,
      score: Math.max(-1, Math.min(1, s.score ?? 0)),
      label: s.label,
      emotions: s.emotions ?? [],
    }));
  } catch (e) {
    if (isRouterHardError(e)) throw e;
    return null;
  }
};

export const generateNudge = async (history: string): Promise<Nudge | null> => {
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

export const generateHandoffSummary = async (history: string): Promise<HandoffSummary | null> => {
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

export const analyzeVoiceMemo = async (audioBase64: string): Promise<VoiceAnalysis | null> => {
  try {
    const result = await invokeGeminiAudio('analyze_memo', audioBase64, 'audio/webm');
    return (result?.data as VoiceAnalysis | undefined) ?? null;
  } catch (e) {
    console.error('Deep Audio Error', e);
    return null;
  }
};

export const generateChannelArtifact = async (history: string, title: string): Promise<ChannelArtifact | null> => {
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
  context: {
    replyTo?: { from: string; subject: string; body: string };
    intent: string;
    tone: EmailTone;
    recipientName?: string;
  }
): Promise<EmailDraft | null> => {

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
  text: string,
  improvement: 'shorten' | 'elaborate' | 'fix_grammar' | 'make_friendlier' | 'make_formal'
): Promise<string | null> => {
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
  emailContext: { from: string; subject: string; body: string }
): Promise<string[] | null> => {

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
export const summarizeText = async (text: string): Promise<string | null> => {
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

// ─── Embeddings — routed through `gemini-embed` edge function ────────────────
// We deliberately do NOT call Google's embedContent endpoint from the browser
// any more: that exposed the Gemini API key in the URL (browser DevTools and
// every error log), couldn't be metered, and used a separate billing project.
// The edge function shares the GEMINI_API_KEY secret with ai-router.
//
// The legacy `apiKey` parameter is kept in the signature for backward
// compatibility with the 8+ downstream callers, but it's ignored — auth is
// handled via the user's Supabase JWT, not a Google key.
//
// Session-level circuit breaker: if the first call fails (e.g., the function
// hasn't been deployed yet or upstream is down), we log once and skip the rest.
// Downstream callers already tolerate `null` — chunks just index without
// vectors, falling back to keyword matching.
let embeddingDisabled = false;
let embeddingDisabledReason = '';

async function callEmbedFunction(payload: { text?: string; texts?: string[] }): Promise<(number[] | null)[]> {
  const { supabase } = await import('./supabase');
  const { data, error } = await supabase.functions.invoke('gemini-embed', { body: payload });

  if (error) {
    const ctx = (error as { context?: { response?: Response } }).context;
    const response = ctx?.response;
    let detail = error.message ?? 'unknown';
    if (response) {
      try {
        const body = await response.clone().json();
        detail = (body?.detail as string) || (body?.error as string) || detail;
      } catch { /* not JSON */ }
    }
    throw new Error(detail);
  }

  return (data?.embeddings ?? []) as (number[] | null)[];
}

export const generateEmbedding = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  text: string,
): Promise<number[] | null> => {
  if (embeddingDisabled) return null;
  if (!text || text.trim().length === 0) return null;

  try {
    const [embedding] = await callEmbedFunction({ text });
    return embedding ?? null;
  } catch (e) {
    embeddingDisabled = true;
    embeddingDisabledReason = e instanceof Error ? e.message : 'unknown error';
    console.warn(
      `[geminiService] Embeddings disabled for this session: ${embeddingDisabledReason}. ` +
      `Documents will index without semantic vectors (keyword search only).`,
    );
    return null;
  }
};

/**
 * Batch variant — embeds up to 100 texts in a single round-trip via
 * Gemini's `batchEmbedContents`. Use for indexing pipelines that would
 * otherwise loop `generateEmbedding`. Returns null entries for any text
 * the upstream couldn't embed; callers should treat null the same way
 * they treat a single-call null (skip semantic vector, keep the chunk).
 */
export const generateEmbeddingsBatch = async (texts: string[]): Promise<(number[] | null)[]> => {
  if (embeddingDisabled || texts.length === 0) return texts.map(() => null);

  try {
    const result = await callEmbedFunction({ texts });
    // Defensive: pad/truncate so output length always matches input length.
    if (result.length !== texts.length) {
      const padded: (number[] | null)[] = [];
      for (let i = 0; i < texts.length; i++) padded.push(result[i] ?? null);
      return padded;
    }
    return result;
  } catch (e) {
    embeddingDisabled = true;
    embeddingDisabledReason = e instanceof Error ? e.message : 'unknown error';
    console.warn(
      `[geminiService] Embeddings disabled for this session: ${embeddingDisabledReason}. ` +
      `Documents will index without semantic vectors (keyword search only).`,
    );
    return texts.map(() => null);
  }
};

// ─── Generic text processing (migrated) ──────────────────────────────────────
// The `model` parameter is IGNORED — the router picks per-task.
// Kept in the signature for backward compatibility with the 25+ downstream callers.

export const processWithModel = async (
  prompt: string,
  model: string = 'gemini-2.5-flash' // IGNORED — router decides per task
): Promise<string | null> => {
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
  const result = await processWithModel(prompt, model);
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
