
import { GoogleGenAI, Type } from "@google/genai";
import { DraftAnalysis, ThreadContext, CatchUpSummary, AsyncSuggestion, Task, TeamHealth, Nudge, HandoffSummary, VoiceAnalysis, ChannelArtifact } from "../types";
import { googleCalendarService } from "./googleCalendarService";
import { withFormattedOutput, getContextualFormattingHints, FormattingContext } from "./aiFormattingService";
import { rateLimitService } from "./rateLimitService";
import { retryService } from "./retryService";
import { sanitizationService } from "./sanitizationService";
import { apiProxyService } from "./apiProxyService";

// Cache for calendar context to avoid too many API calls
let calendarContextCache: { context: string; timestamp: number } | null = null;
const CALENDAR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Get calendar context for AI awareness
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

export const generateSearchResponse = async (apiKey: string, query: string) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: { tools: [{ googleSearch: {} }] },
    });
    const text = response.text || "No response generated.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return { text, groundingChunks };
  } catch (error) {
    console.error("Search Error:", error);
    throw error;
  }
};

export const generateMapsResponse = async (apiKey: string, query: string) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: { tools: [{ googleMaps: {} }] },
    });
    const text = response.text || "No location data found.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return { text, groundingChunks };
  } catch (error) {
    console.error("Maps Error:", error);
    return { text: "Error retrieving map data.", groundingChunks: [] };
  }
};

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

export const generateJournalInsight = async (apiKey: string, text: string) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
     const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash-lite',
       contents: withFormattedOutput(
         `Analyze this journal entry and provide a very brief, empathetic insight or advice (max 2 sentences). Entry: "${text}"`,
         'journal'
       ),
     });
     return response.text;
  } catch (e) {
    return "Could not analyze at this moment.";
  }
};

export const generateSmartReply = async (apiKey: string, history: {role: string, text: string}[]) => {
  const ai = new GoogleGenAI({ apiKey });
  const conversation = history.map(h => `${h.role}: ${h.text}`).join('\n');

  // Get calendar context for scheduling-related replies
  let calendarContext = '';
  try {
    calendarContext = await getCalendarContextForAI();
  } catch (e) {
    // Ignore calendar errors
  }

  const systemPrompt = calendarContext
    ? `You are a helpful communication assistant with access to the user's calendar:\n\n${calendarContext}\n\nIf the conversation involves scheduling or availability, use the calendar context to inform your response.`
    : 'You are a helpful communication assistant.';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: withFormattedOutput(
        `${systemPrompt}\n\nRead the following conversation and draft a professional, concise, and friendly reply for the user. Do not include quotes. Just the reply text.\n\nConversation:\n${conversation}`,
        'chat'
      ),
    });
    return response.text;
  } catch (e) {
    return null;
  }
};

export const generateSummary = async (apiKey: string, text: string) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: withFormattedOutput(
        `Summarize the following text or conversation into 3 key bullet points:\n\n${text}`,
        'summary'
      ),
    });
    return response.text;
  } catch (e) {
    return null;
  }
};

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
  } catch (e) {
    return null;
  }
};

export const generateDailyBriefing = async (apiKey: string, context: string) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: withFormattedOutput(
        `You are a top-tier executive assistant for Pulse, a comprehensive personal productivity and communication platform.

Analyze the following comprehensive daily context which includes data from:
- Calendar events and meetings
- Tasks (urgent, pending, overdue)
- Messages from various channels (Pulse, Slack, email)
- Voice messages (Voxes)
- Active projects and outcomes
- Recent journal entries and decisions
- Contacts and communications

Generate a highly personalized and actionable daily briefing that:
1. Acknowledges the time of day appropriately
2. Highlights the most critical items needing attention
3. Provides specific, actionable suggestions with clear reasoning
4. Prioritizes urgent matters but also surfaces important non-urgent items
5. References specific data from the context (names, times, tasks, etc.)

Context:
${context}`,
        'briefing'
      ),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            greeting: { type: Type.STRING, description: "A personalized greeting acknowledging the time of day" },
            summary: { type: Type.STRING, description: "A 2-3 sentence executive summary of the day ahead, highlighting key priorities and any concerns" },
            highlights: {
              type: Type.ARRAY,
              description: "Key items that need attention, pulled from the context data",
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING, enum: ["calendar", "task", "message", "email", "vox", "contact", "project"] },
                  title: { type: Type.STRING, description: "Brief title of the highlight" },
                  detail: { type: Type.STRING, description: "Specific detail from the context" },
                  priority: { type: Type.STRING, enum: ["urgent", "high", "medium", "low"] }
                },
                required: ["category", "title", "detail", "priority"]
              }
            },
            suggestions: {
              type: Type.ARRAY,
              description: "Specific actionable suggestions based on the context",
              items: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING, description: "What the user should do" },
                  reason: { type: Type.STRING, description: "Why this action is recommended based on the context" },
                  type: { type: Type.STRING, enum: ["message", "event", "task", "email", "vox", "contact"] },
                  priority: { type: Type.STRING, enum: ["urgent", "high", "medium", "low"] }
                },
                required: ["action", "reason", "type", "priority"]
              }
            },
            focusRecommendation: { type: Type.STRING, description: "A single sentence recommendation for what to focus on first" }
          },
          required: ["greeting", "summary", "highlights", "suggestions", "focusRecommendation"]
        }
      }
    });
    let jsonStr = response.text || '{}';
    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e: any) {
    // Check for leaked API key error specifically
    const errorMessage = e?.message || e?.error?.message || String(e);
    const isLeakedKeyError = 
      e?.status === 403 || 
      e?.code === 403 || 
      (e?.error?.code === 403 && errorMessage?.toLowerCase().includes('leaked'));
    
    if (isLeakedKeyError) {
      console.error('Gemini API Key Error: Your API key has been reported as leaked and needs to be replaced. Please get a new API key from https://aistudio.google.com/apikey and update it in Settings.');
    } else {
      console.error('Briefing generation error:', e);
    }
    
    return {
      greeting: "Welcome back.",
      summary: isLeakedKeyError 
        ? "Your Gemini API key needs to be updated. Please go to Settings to configure a new API key from Google AI Studio."
        : "Your dashboard is ready. Connect your accounts to get personalized insights.",
      highlights: [],
      suggestions: [],
      focusRecommendation: isLeakedKeyError
        ? "Update your Gemini API key in Settings to restore AI features."
        : "Start by reviewing your tasks and calendar for today."
    };
  }
};

export const generateThinkingResponse = async (apiKey: string, prompt: string) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 32768 } }
    });
    return response.text;
  } catch (e) {
    throw e;
  }
};

export const generateCode = async (apiKey: string, prompt: string) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: withFormattedOutput(
        `You are an expert software engineer. Write clean code for: ${prompt}. Return ONLY code with brief explanatory comments.`,
        'code'
      ),
    });
    return response.text;
  } catch (e) {
    throw e;
  }
};

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
  } catch (e) {
    return null;
  }
};

export const chatWithBot = async (apiKey: string, history: {role: string, text: string}[], newMessage: string, includeCalendarContext: boolean = true) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
      // Get calendar context for AI awareness
      let systemContext = '';
      if (includeCalendarContext) {
        const calendarContext = await getCalendarContextForAI();
        if (calendarContext) {
          systemContext = `You are a helpful AI assistant with access to the user's calendar. Here is their current schedule context:\n\n${calendarContext}\n\nUse this calendar information to provide contextually aware responses. For example, if the user mentions a meeting, you can reference their schedule. If they ask about availability, check their calendar.\n\n`;
        }
      }

      const chat = ai.chats.create({
          model: 'gemini-3-pro-preview',
          systemInstruction: withFormattedOutput(
            systemContext || 'You are a helpful AI assistant.',
            'chat'
          ),
          history: history.map(h => ({
              role: h.role === 'me' ? 'user' : 'model',
              parts: [{ text: h.text }]
          }))
      });
      const result = await chat.sendMessage({ message: newMessage });
      return result.text;
  } catch (e) {
      return "I'm having trouble connecting right now.";
  }
};

// --- Context Aware Functions ---

export const analyzeDraftIntent = async (apiKey: string, draft: string): Promise<DraftAnalysis | null> => {
  if (!draft || draft.length < 5) return null;
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `Analyze intent: "${draft}". Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
           type: Type.OBJECT,
           properties: {
             intent: { type: Type.STRING, enum: ["decision", "fyi", "request", "brainstorm", "social"] },
             suggestion: { type: Type.STRING },
             improvedText: { type: Type.STRING },
             confidence: { type: Type.NUMBER }
           },
           required: ["intent", "suggestion", "improvedText", "confidence"]
        }
      }
    });
    return JSON.parse(response.text || '{}') as DraftAnalysis;
  } catch (e) {
    return null;
  }
};

export const generateThreadContext = async (apiKey: string, history: string): Promise<ThreadContext | null> => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: `Analyze history. Extract decisions, topics, related docs.\nHistory:\n${history}`,
       config: {
         responseMimeType: "application/json",
         responseSchema: {
           type: Type.OBJECT,
           properties: {
             decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
             keyTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
             relatedDocs: { 
               type: Type.ARRAY, 
               items: { 
                 type: Type.OBJECT,
                 properties: {
                   name: { type: Type.STRING },
                   type: { type: Type.STRING, enum: ["pdf", "doc", "sheet", "image"] },
                   url: { type: Type.STRING }
                 }
               }
             }
           }
         }
       }
    });
    return JSON.parse(response.text || '{}') as ThreadContext;
  } catch (e) {
    return null;
  }
};

export const generateCatchUpSummary = async (apiKey: string, history: string): Promise<CatchUpSummary | null> => {
   const ai = new GoogleGenAI({ apiKey });
   try {
     const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: withFormattedOutput(
         `Create catch up summary. Focus on changes, decisions, blockers.\nHistory:\n${history}`,
         'summary'
       ),
       config: {
         responseMimeType: "application/json",
         responseSchema: {
           type: Type.OBJECT,
           properties: {
             summary: { type: Type.STRING },
             decisionsMade: { type: Type.ARRAY, items: { type: Type.STRING } },
             blockers: { type: Type.ARRAY, items: { type: Type.STRING } },
             actionItems: { type: Type.ARRAY, items: { type: Type.STRING } }
           }
         }
       }
     });
     return JSON.parse(response.text || '{}') as CatchUpSummary;
   } catch (e) {
     return null;
   }
};

// --- Attention Intelligence Functions ---

export const detectMeetingIntent = async (apiKey: string, text: string): Promise<AsyncSuggestion | null> => {
  if (!text || text.length < 5) return null;
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `Meeting intent detection for: "${text}". If yes, suggest async alternative. Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detected: { type: Type.BOOLEAN },
            type: { type: Type.STRING, enum: ['poll', 'video', 'doc'] },
            reason: { type: Type.STRING },
            template: { type: Type.STRING }
          },
          required: ["detected", "type", "reason", "template"]
        }
      }
    });
    const result = JSON.parse(response.text || '{}') as AsyncSuggestion;
    if (!result.detected) return null;
    return result;
  } catch (e) {
    return null;
  }
};

export const analyzeMessageUrgency = async (apiKey: string, senderRole: string, message: string): Promise<'high' | 'medium' | 'low'> => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `Analyze urgency. Sender: ${senderRole}. Msg: ${message}. Return JSON {priority: high/medium/low}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] } }
        }
      }
    });
    const result = JSON.parse(response.text || '{}');
    return result.priority || 'medium';
  } catch (e) {
    return 'medium';
  }
};

// --- Task Workflow Functions ---

export const extractTaskFromMessage = async (apiKey: string, message: string, contactList: string[]): Promise<(Partial<Task> & { assigneeName?: string }) | null> => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Extract action item from message: "${message}". 
      Available contacts: ${contactList.join(', ')}. 
      Return JSON with title, assignee (closest name match or 'Unassigned'), and dueDate (YYYY-MM-DD if explicit, otherwise null).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            assigneeName: { type: Type.STRING },
            dueDate: { type: Type.STRING } // ISO date string
          },
          required: ["title"]
        }
      }
    });
    const data = JSON.parse(response.text || '{}');
    if (!data.title) return null;
    return {
      title: data.title,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      assigneeName: data.assigneeName,
    };
  } catch (e) {
    console.error("Task Extraction Error", e);
    return null;
  }
};

export const analyzeOutcomeProgress = async (apiKey: string, history: string, goal: string): Promise<{status: string, progress: number, blockers: string[]}> => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze chat history against goal: "${goal}".
      Determine status (on_track, at_risk, completed, blocked), progress (0-100), and list blockers.
      History: ${history}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ['on_track', 'at_risk', 'completed', 'blocked'] },
            progress: { type: Type.NUMBER },
            blockers: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["status", "progress", "blockers"]
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (e) {
    return { status: 'on_track', progress: 0, blockers: [] };
  }
};

// --- Social Health & Relationship Functions ---

export const analyzeTeamHealth = async (apiKey: string, history: string): Promise<TeamHealth | null> => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: withFormattedOutput(
        `Analyze communication health. Look for unanswered questions, uneven participation, tense sentiment.
      History: ${history}`,
        'team-health'
      ),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Health score 0-100" },
            status: { type: Type.STRING, enum: ['healthy', 'at_risk', 'critical'] },
            issues: { type: Type.ARRAY, items: { type: Type.STRING } },
            reliability: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
          },
          required: ["score", "status", "issues", "reliability"]
        }
      }
    });
    return JSON.parse(response.text || '{}') as TeamHealth;
  } catch (e) {
    return null;
  }
};

export const generateNudge = async (apiKey: string, history: string): Promise<Nudge | null> => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: withFormattedOutput(
        `Analyze last messages. Suggest if user should follow up (delay), clarify (confusion), or de-escalate (tension). If all good, return null.
      History: ${history}`,
        'nudge'
      ),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestion: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['follow_up', 'clarify', 'de_escalate', 'praise'] },
                message: { type: Type.STRING, description: "Short private suggestion to user" }
              }
            }
          }
        }
      }
    });
    const result = JSON.parse(response.text || '{}');
    return result.suggestion || null;
  } catch (e) {
    return null;
  }
};

export const generateHandoffSummary = async (apiKey: string, history: string): Promise<HandoffSummary | null> => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: withFormattedOutput(
        `Create handoff summary for new person joining.
      History: ${history}`,
        'summary'
      ),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            context: { type: Type.STRING },
            keyDecisions: { type: Type.ARRAY, items: { type: Type.STRING } },
            pendingActions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["context", "keyDecisions", "pendingActions"]
        }
      }
    });
    return JSON.parse(response.text || '{}') as HandoffSummary;
  } catch (e) {
    return null;
  }
};

// --- Cross-App & Multi-Modal Functions ---

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
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Transform this chat history into a structured Wiki Artifact for project "${title}".
      Return JSON: title, overview (paragraph), spec (Markdown content describing features/requirements derived from chat), decisions (list), milestones (list).
      History: ${history}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            overview: { type: Type.STRING },
            spec: { type: Type.STRING, description: "Markdown formatted spec" },
            decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
            milestones: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "overview", "spec", "decisions", "milestones"]
        }
      }
    });
    return JSON.parse(response.text || '{}') as ChannelArtifact;
  } catch (e) {
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
  if (!apiKey) return null;

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

  const prompt = withFormattedOutput(basePrompt, 'email-draft');

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.error('Email draft generation failed:', e);
    return null;
  }
};

export const improveEmailText = async (
  apiKey: string,
  text: string,
  improvement: 'shorten' | 'elaborate' | 'fix_grammar' | 'make_friendlier' | 'make_formal'
): Promise<string | null> => {
  if (!apiKey || !text) return null;

  const instructions = {
    shorten: 'Make this text more concise while keeping the main points',
    elaborate: 'Expand on this text with more detail and context',
    fix_grammar: 'Fix any grammar, spelling, or punctuation errors',
    make_friendlier: 'Rewrite this in a warmer, more friendly tone',
    make_formal: 'Rewrite this in a more formal, professional tone'
  };

  const prompt = withFormattedOutput(
    `${instructions[improvement]}:\n\n${text}\n\nReturn only the improved text, nothing else.`,
    'email-draft'
  );

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    console.error('Email improvement failed:', e);
    return null;
  }
};

export const generateEmailSuggestions = async (
  apiKey: string,
  emailContext: { from: string; subject: string; body: string }
): Promise<string[] | null> => {
  if (!apiKey) return null;

  const prompt = withFormattedOutput(
    `Given this email:
          From: ${emailContext.from}
          Subject: ${emailContext.subject}
          Body: ${emailContext.body}

          Generate 3 smart reply suggestions (short, 1-2 sentences each).
          Return JSON array: ["suggestion 1", "suggestion 2", "suggestion 3"]`,
    'chat'
  );

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.error('Email suggestions failed:', e);
    return null;
  }
};

// AI Lab Functions
export const summarizeText = async (apiKey: string, text: string): Promise<string | null> => {
  if (!apiKey || !text) return null;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: withFormattedOutput(
              `Summarize the following text concisely, capturing the key points and main ideas:

${text}

Provide a clear, well-structured summary.`,
              'summary'
            )
          }]
        }]
      })
    });

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    console.error('Summarization failed:', e);
    return null;
  }
};

export const analyzeImage = async (apiKey: string, imageBase64: string, prompt: string): Promise<string | null> => {
  if (!apiKey || !imageBase64) return null;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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

export const generateEmbedding = async (apiKey: string, text: string): Promise<number[] | null> => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
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

export const processWithModel = async (apiKey: string, prompt: string, model: string = 'gemini-2.0-flash-exp'): Promise<string | null> => {
  if (!apiKey || !prompt) return null;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: withFormattedOutput(prompt, 'default') }] }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`API Error (${response.status}):`, errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    console.error('AI processing failed:', e);
    return null;
  }
};

// ==================== Security Layer ====================

/**
 * Secure wrapper for Gemini API calls with rate limiting and retry logic
 * This layer should be used for all new implementations
 */
export const secureGeminiService = {
  /**
   * Check if backend API proxy is available
   */
  async isProxyAvailable(): Promise<boolean> {
    try {
      return await apiProxyService.healthCheck();
    } catch {
      return false;
    }
  },

  /**
   * Secure generate content with rate limiting and retry
   */
  async generateContent(
    model: string,
    contents: any,
    config?: any,
    userId: string = 'anonymous'
  ): Promise<any> {
    // Check rate limits
    const rateLimitCheck = await rateLimitService.checkLimit('api_gemini', userId);
    if (!rateLimitCheck.allowed) {
      throw new Error(
        `Rate limit exceeded. Please wait ${Math.ceil(rateLimitCheck.retryAfter / 60000)} minutes before trying again.`
      );
    }

    // Sanitize input
    const sanitizedContents = sanitizationService.sanitizeObject(contents);

    // Try to use API proxy if available
    const useProxy = await this.isProxyAvailable();

    if (useProxy) {
      try {
        const result = await retryService.executeWithRetry(
          async () => await apiProxyService.geminiGenerateContent({
            model,
            contents: sanitizedContents,
            config,
          }),
          3, // max attempts
          2  // backoff multiplier
        );

        // Record rate limit usage
        await rateLimitService.recordRequest('api_gemini', userId);
        return result;
      } catch (error) {
        console.warn('API proxy failed, falling back to direct API call:', error);
        // Fall through to direct API call
      }
    }

    // Fallback to direct API call (legacy behavior)
    // WARNING: This exposes API key on client side
    const apiKey = localStorage.getItem('gemini_api_key') || '';
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please configure the backend API proxy or add an API key in settings.');
    }

    const ai = new GoogleGenAI({ apiKey });
    const result = await retryService.executeWithRetry(
      async () => await ai.models.generateContent({
        model,
        contents: sanitizedContents,
        config,
      }),
      3,
      2
    );

    // Record rate limit usage
    await rateLimitService.recordRequest('api_gemini', userId);
    return result;
  },

  /**
   * Secure chat with rate limiting
   */
  async chat(prompt: string, options?: { temperature?: number; userId?: string }): Promise<string> {
    const userId = options?.userId || 'anonymous';

    // Sanitize prompt
    const sanitizedPrompt = sanitizationService.sanitizeText(prompt, { maxLength: 10000 });

    const result = await this.generateContent(
      'gemini-2.0-flash',
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
// that expect a simple chat interface
// DEPRECATED: Use secureGeminiService instead for new implementations
export const geminiService = {
  async chat(prompt: string, options?: { temperature?: number }): Promise<string> {
    // Get API key from localStorage
    const apiKey = localStorage.getItem('gemini_api_key') || '';
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    try {
      // Sanitize prompt
      const sanitizedPrompt = sanitizationService.sanitizeText(prompt, { maxLength: 10000 });

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: sanitizedPrompt,
        config: {
          temperature: options?.temperature ?? 0.7,
        },
      });
      return response.text || '';
    } catch (error) {
      console.error('Gemini chat error:', error);
      throw error;
    }
  }
};
