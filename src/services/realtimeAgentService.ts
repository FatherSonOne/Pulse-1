/**
 * OpenAI Realtime Voice Agent Service
 * Implements speech-to-speech voice agents for the War Room
 * 
 * Features:
 * - WebRTC-based real-time voice communication
 * - Multi-agent handoffs (General, Analyst, Scribe, Strategist)
 * - Tool calling for War Room actions (search docs, create tasks, etc.)
 * - Output guardrails for content safety
 * - Conversation history management
 * - Human-in-the-loop approval for sensitive actions
 */

import { z } from 'zod';

// ============= TYPES =============

export interface RealtimeSessionConfig {
  model: 'gpt-realtime' | 'gpt-4o-mini-realtime-preview';
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'sage' | 'coral' | 'verse' | 'marin';
  turnDetection: {
    type: 'server_vad' | 'semantic_vad';
    threshold?: number;
    silenceDurationMs?: number;
    prefixPaddingMs?: number;
    eagerness?: 'low' | 'medium' | 'high';
    interruptResponse?: boolean;
    createResponse?: boolean;
  };
  inputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  outputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  inputAudioTranscription?: {
    model: 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe' | 'whisper-1';
    language?: string;
    prompt?: string;
  };
  noiseReduction?: 'near_field' | 'far_field' | null;
  /** Preferred language for the AI to speak (ISO 639-1 code) */
  preferredLanguage?: string;
}

export interface RealtimeHistoryItem {
  id: string;
  type: 'message' | 'function_call' | 'function_result';
  role?: 'user' | 'assistant' | 'system';
  content?: string;
  transcript?: string;
  name?: string;
  arguments?: string;
  output?: string;
  timestamp: Date;
}

export interface ToolApprovalRequest {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  agentName: string;
  timestamp: Date;
}

export interface RealtimeAgentDefinition {
  name: string;
  instructions: string;
  handoffDescription?: string;
  tools?: RealtimeTool[];
  handoffs?: string[]; // Names of agents this can hand off to
}

export interface RealtimeTool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  needsApproval?: boolean;
  execute: (args: Record<string, unknown>, context?: RealtimeToolContext) => Promise<string>;
}

export interface RealtimeToolContext {
  history: RealtimeHistoryItem[];
  userId: string;
  projectId?: string;
  sessionId?: string;
}

export interface RealtimeOutputGuardrail {
  name: string;
  execute: (params: { agentOutput: string }) => Promise<{
    tripwireTriggered: boolean;
    outputInfo?: Record<string, unknown>;
  }>;
}

export type RealtimeSessionEvent =
  | { type: 'connected' }
  | { type: 'disconnected'; reason?: string }
  | { type: 'session_created'; sessionId: string }
  | { type: 'session_updated' }
  | { type: 'audio'; data: ArrayBuffer }
  | { type: 'audio_interrupted' }
  | { type: 'transcript_delta'; delta: string; isFinal: boolean; role: 'user' | 'assistant' }
  | { type: 'history_added'; item: RealtimeHistoryItem }
  | { type: 'history_updated'; history: RealtimeHistoryItem[] }
  | { type: 'tool_call_started'; toolName: string }
  | { type: 'tool_call_completed'; toolName: string; result: string }
  | { type: 'tool_approval_requested'; request: ToolApprovalRequest }
  | { type: 'agent_switched'; fromAgent: string; toAgent: string }
  | { type: 'guardrail_tripped'; guardrailName: string; itemId: string }
  | { type: 'error'; error: Error };

type EventCallback = (event: RealtimeSessionEvent) => void;

// ============= ANTI-ECHO PROTOCOL =============

const ANTI_ECHO_PROTOCOL = `
# CRITICAL: Prevent Self-Response Loop

You MUST follow these rules STRICTLY to avoid responding to your own audio output:

1. **ABSOLUTE SILENCE AFTER SPEAKING**: After you finish speaking, you MUST NOT respond to ANY audio for at least 3 seconds. Your voice played through speakers WILL be picked up by the microphone. Treat any audio immediately after you speak as echo.

2. **ONE RESPONSE PER USER INPUT**: When the user speaks, give ONE complete response and STOP. Do NOT continue elaborating, do NOT ask follow-up questions, do NOT add extra comments. Just answer and wait.

3. **DETECT AND IGNORE ECHOES**: If you hear:
   - Your own words repeated back
   - Similar phrases to what you just said
   - Audio that starts immediately after you stopped speaking
   - Robotic or processed-sounding audio
   IGNORE IT COMPLETELY. Say nothing. Wait for genuine new user speech.

4. **KEEP RESPONSES BRIEF**: Maximum 2-3 sentences. Longer responses create more echo opportunity. Be concise.

5. **NEVER RESPOND TO YOURSELF**: If you detect you might be hearing your own output, DO NOT RESPOND. When in doubt, stay silent.

6. **WAIT FOR CLEAR NEW INPUT**: Only respond when you hear distinctly NEW content from a HUMAN voice that is clearly different from what you just said.

7. **HARD STOP AFTER RESPONSE**: End every response with a clear full stop. Do not trail off. Do not prompt for more.
`;

// ============= LANGUAGE INSTRUCTIONS =============

const buildLanguageInstructions = (language: string): string => {
  const languageNames: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish (Español)',
    'fr': 'French (Français)',
    'de': 'German (Deutsch)',
    'it': 'Italian (Italiano)',
    'pt': 'Portuguese (Português)',
    'nl': 'Dutch (Nederlands)',
    'pl': 'Polish (Polski)',
    'ru': 'Russian (Русский)',
    'ja': 'Japanese (日本語)',
    'ko': 'Korean (한국어)',
    'zh': 'Chinese (中文)',
  };

  const languageName = languageNames[language] || 'English';

  return `
# IMPORTANT: Language Preference

The user has set their preferred language to: **${languageName}**

You MUST:
1. Always respond in ${languageName} unless the user explicitly speaks to you in a different language
2. Never switch languages mid-conversation unless the user switches first
3. If you detect the user speaking a different language, ask them (in their spoken language) if they want to switch
4. Keep all explanations, clarifications, and responses in ${languageName}
5. Even if you hear background audio in another language, continue responding in ${languageName}
`;
};

// ============= RAG PROTOCOL INSTRUCTIONS =============

const RAG_PROTOCOL = `
# CRITICAL: Information Retrieval Protocol

You have access to a knowledge base and context documents. Follow these steps EXACTLY:

## Step 1 - ALWAYS Search First
Before answering ANY question about:
- Documents, files, or uploaded content
- Project information, facts, or data
- Specific details the user might have provided
- Any claim that could be in the knowledge base

You MUST use the 'rag_search' tool FIRST. Never guess or make assumptions about document content.

## Step 2 - Synthesize from Sources
After receiving search results:
- Use ONLY the retrieved information to answer
- If no results found, clearly state: "I don't have that information in the knowledge base"
- Do not hallucinate or invent information not in the sources

## Step 3 - Cite Sources
When you use information from search results:
- Mention the source naturally: "According to the project brief..." or "Based on your uploaded document..."
- After responding, use 'report_grounding' to formally cite sources

## Step 4 - Acknowledge Limitations
If asked about something not in the knowledge base:
- Be honest: "That information isn't in the documents you've provided"
- Offer to help in other ways or ask if they can provide more context
`;

// ============= WAR ROOM AGENT DEFINITIONS =============

export const WAR_ROOM_AGENTS: Record<string, RealtimeAgentDefinition> = {
  general: {
    name: 'War Room General',
    instructions: `# Role & Objective
You are the War Room General, a helpful AI assistant for strategic planning and team coordination.
You help users navigate their projects, find information, and coordinate activities.
You have access to a knowledge base of documents the user has uploaded.

# Personality & Tone
- Friendly, calm, and approachable
- Concise but thorough
- Confident without being arrogant
- Honest about limitations

${RAG_PROTOCOL}

# Core Capabilities
- Answer questions about the current project and documents (ALWAYS search first)
- Help users search through their knowledge base
- Create tasks and decisions when asked
- Hand off to specialists when appropriate:
  - Analyst for deep data analysis
  - Scribe for documentation and note-taking
  - Strategist for planning and decision-making

# Pacing
Deliver responses quickly but clearly. Keep answers under 3 sentences unless more detail is requested.`,
    handoffDescription: 'General assistant for project coordination',
    handoffs: ['analyst', 'scribe', 'strategist'],
  },

  analyst: {
    name: 'War Room Analyst',
    instructions: `# Role & Objective
You are the War Room Analyst, specializing in deep data analysis and research.
You examine documents, identify patterns, and provide detailed insights.
You have access to a knowledge base of documents to analyze.

# Personality & Tone
- Analytical and thorough
- Data-driven and precise
- Asks clarifying questions when needed
- Always cites sources for claims

${RAG_PROTOCOL}

# Core Capabilities
- Perform deep analysis on documents and data (ALWAYS search first)
- Identify trends, patterns, and anomalies in the knowledge base
- Provide evidence-based recommendations with citations
- Cross-reference multiple documents when relevant

# Pacing
Take time to be thorough. Explain your reasoning step by step. Always cite your sources.`,
    handoffDescription: 'Specialist for deep data analysis and research',
    handoffs: ['general'],
  },

  scribe: {
    name: 'War Room Scribe',
    instructions: `# Role & Objective
You are the War Room Scribe, specializing in documentation and note-taking.
You capture decisions, create summaries, and maintain organized records.
You can reference the knowledge base to ensure accuracy.

# Personality & Tone
- Meticulous and organized
- Clear and structured
- Uses bullet points and formatting
- Fact-checks against available documents

${RAG_PROTOCOL}

# Core Capabilities
- Create detailed meeting notes and summaries
- Document decisions with context and rationale
- Organize information in clear, structured formats
- Create tasks from action items
- Reference knowledge base to verify facts

# Pacing
Be thorough in documentation. Confirm key points before finalizing.`,
    handoffDescription: 'Specialist for documentation and note-taking',
    handoffs: ['general'],
  },

  strategist: {
    name: 'War Room Strategist',
    instructions: `# Role & Objective
You are the War Room Strategist, specializing in planning and decision-making.
You help users think through options, weigh trade-offs, and make informed decisions.
You base recommendations on available knowledge and data.

# Personality & Tone
- Strategic and forward-thinking
- Considers multiple perspectives
- Challenges assumptions constructively
- Grounds advice in available information

${RAG_PROTOCOL}

# Core Capabilities
- Help users think through complex decisions (search for relevant context first)
- Present options with pros and cons based on available data
- Consider risks and mitigation strategies
- Create decision records when conclusions are reached
- Ask probing questions to clarify goals

# Pacing
Take time to explore options. Don't rush to conclusions. Base recommendations on facts from the knowledge base.`,
    handoffDescription: 'Specialist for strategic planning and decision-making',
    handoffs: ['general'],
  },
};

// ============= REALTIME SESSION CLASS =============

export interface ContextDocument {
  name: string;
  content: string;
  type: 'file' | 'text' | 'url';
}

export class RealtimeVoiceSession {
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private mediaStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;

  public history: RealtimeHistoryItem[] = [];
  public currentAgent: string = 'general';
  public isConnected: boolean = false;
  public isSpeaking: boolean = false;
  public isListening: boolean = false;

  private config: RealtimeSessionConfig;
  private agents: Map<string, RealtimeAgentDefinition> = new Map();
  private tools: Map<string, RealtimeTool> = new Map();
  private guardrails: RealtimeOutputGuardrail[] = [];
  private pendingApprovals: Map<string, ToolApprovalRequest> = new Map();
  private contextDocuments: ContextDocument[] = [];

  private userId: string;
  private projectId?: string;
  private sessionId?: string;
  private participantMode: 'active' | 'observer' = 'active';

  // Token tracking and context summarization
  private totalTokens: number = 0;
  private isSummarizing: boolean = false;
  private conversationSummary: string = '';
  private summaryItemId: string | null = null;

  // Configuration for context management
  private readonly SUMMARY_TRIGGER_TOKENS = 15000; // Trigger summarization at this token count
  private readonly KEEP_LAST_TURNS = 4; // Keep last N turns verbatim
  private readonly SUMMARY_MODEL = 'gpt-4o-mini'; // Lightweight model for summarization

  constructor(
    userId: string,
    config: Partial<RealtimeSessionConfig> = {},
    projectId?: string,
    sessionId?: string
  ) {
    this.userId = userId;
    this.projectId = projectId;
    this.sessionId = sessionId;
    
    this.config = {
      model: 'gpt-realtime',
      voice: 'nova',
      turnDetection: {
        type: 'semantic_vad',
        eagerness: 'medium',
        interruptResponse: true,
        createResponse: true,
      },
      inputAudioTranscription: {
        model: 'gpt-4o-transcribe',
        language: 'en',
      },
      noiseReduction: 'near_field',
      ...config,
    };

    // Initialize with War Room agents
    Object.entries(WAR_ROOM_AGENTS).forEach(([key, agent]) => {
      this.agents.set(key, agent);
    });
  }

  // ============= PARTICIPANT MODE =============

  /**
   * Set the AI participant mode
   * - 'active': AI actively engages, asks questions, drives conversation
   * - 'observer': AI listens silently, only responds when directly addressed
   */
  setParticipantMode(mode: 'active' | 'observer'): void {
    this.participantMode = mode;
    console.log(`👁️ AI participant mode set to: ${mode}`);
    // Update session if connected
    if (this.isConnected && this.dataChannel?.readyState === 'open') {
      this.sendSessionUpdate();
    }
  }

  getParticipantMode(): 'active' | 'observer' {
    return this.participantMode;
  }

  private buildParticipantModeInstructions(): string {
    if (this.participantMode === 'observer') {
      return `\n\n# IMPORTANT: Silent Observer Mode
You are currently in SILENT OBSERVER mode. Follow these rules strictly:
1. DO NOT speak unless the user directly addresses you with phrases like "Pulse", "AI", "Hey", or asks a direct question
2. When the user is talking to others or thinking out loud, remain SILENT
3. You may transcribe and track the conversation internally, but do not vocalize unless prompted
4. When you DO respond, keep it brief and to the point
5. Do not ask follow-up questions or try to drive the conversation
6. Act as a helpful assistant that speaks only when spoken to`;
    }
    return ''; // Active mode doesn't need special instructions
  }

  // ============= CONTEXT MANAGEMENT =============

  setContextDocuments(documents: ContextDocument[]): void {
    this.contextDocuments = documents;
    // If already connected, update the session with new context
    if (this.isConnected && this.dataChannel?.readyState === 'open') {
      this.sendSessionUpdate();
      this.sendContextItems();
    }
  }

  getContextDocuments(): ContextDocument[] {
    return this.contextDocuments;
  }

  private buildContextInstructions(): string {
    if (this.contextDocuments.length === 0) return '';

    const contextParts = this.contextDocuments.map((doc, idx) => {
      const typeLabel = doc.type === 'file' ? 'Document' : doc.type === 'url' ? 'URL' : 'Note';
      return `### ${typeLabel} ${idx + 1}: ${doc.name}\n${doc.content}`;
    });

    return `\n\n# User-Provided Context\nThe user has provided the following documents and notes for reference during this conversation. Use this information to provide more relevant and contextual responses.\n\n${contextParts.join('\n\n')}`;
  }

  private sendContextItems(): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    if (this.contextDocuments.length === 0) return;

    console.log(`📄 Sending ${this.contextDocuments.length} context documents to voice session`);

    // Build context text from all documents
    const contextParts = this.contextDocuments.map((doc, idx) => {
      const typeLabel = doc.type === 'file' ? 'Document' : doc.type === 'url' ? 'URL' : 'Note';
      return `=== ${typeLabel} ${idx + 1}: ${doc.name} ===\n${doc.content}`;
    });

    const contextText = `The user has provided the following reference materials for this conversation. You have access to and should use this information when relevant:\n\n${contextParts.join('\n\n---\n\n')}`;

    // Send as a system message conversation item at the root
    const contextItem = {
      type: 'conversation.item.create',
      previous_item_id: null, // Insert at the beginning
      item: {
        id: `context_${Date.now()}`,
        type: 'message',
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: contextText,
          },
        ],
      },
    };

    this.dataChannel.send(JSON.stringify(contextItem));
    console.log('📄 Context items sent to voice session');
  }

  // ============= EVENT HANDLING =============

  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: RealtimeSessionEvent): void {
    const listeners = this.eventListeners.get(event.type) || new Set();
    const allListeners = this.eventListeners.get('*') || new Set();
    
    [...listeners, ...allListeners].forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  // ============= CONNECTION MANAGEMENT =============

  async connect(ephemeralKey: string): Promise<void> {
    try {
      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      // Set up audio output
      this.audioElement = document.createElement('audio');
      this.audioElement.autoplay = true;
      
      this.peerConnection.ontrack = (event) => {
        if (this.audioElement && event.streams[0]) {
          this.audioElement.srcObject = event.streams[0];
        }
      };

      // Get microphone access with error handling
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (mediaError: any) {
        // Handle specific device errors
        if (mediaError.name === 'NotFoundError' || mediaError.name === 'NotReadableError') {
          const errorMessage = mediaError.name === 'NotFoundError' 
            ? 'Microphone not found. Please check that your microphone is connected and enabled.'
            : 'Microphone is not accessible. It may be in use by another application.';
          console.error('Microphone error:', errorMessage);
          throw new Error(errorMessage);
        }
        // Re-throw other errors
        throw mediaError;
      }

      // Add audio track to peer connection
      this.mediaStream.getAudioTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.mediaStream!);
      });

      // Create data channel for events
      this.dataChannel = this.peerConnection.createDataChannel('oai-events', {
        ordered: true,
      });

      this.dataChannel.onopen = () => {
        console.log('🎤 Data channel opened');
        this.sendSessionUpdate();
        // Send context documents as conversation items after session update
        this.sendContextItems();
      };

      this.dataChannel.onmessage = (event) => {
        this.handleServerEvent(JSON.parse(event.data));
      };

      this.dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
        this.emit({ type: 'error', error: new Error('Data channel error') });
      };

      // Create and set local description
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Exchange SDP with OpenAI
      // Use gpt-4o-realtime-preview as the model name for WebRTC connection
      const modelForConnection = this.config.model === 'gpt-realtime' 
        ? 'gpt-4o-realtime-preview' 
        : this.config.model;
        
      console.log(`🎤 Connecting to OpenAI Realtime with model: ${modelForConnection}`);
      
      const response = await fetch(
        `https://api.openai.com/v1/realtime?model=${modelForConnection}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('WebRTC connection failed:', response.status, errorText);
        throw new Error(`Failed to connect: ${response.status} - ${errorText}`);
      }

      const answerSdp = await response.text();
      await this.peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      this.isConnected = true;
      this.emit({ type: 'connected' });
      
    } catch (error) {
      console.error('Connection error:', error);
      this.emit({ type: 'error', error: error as Error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.audioElement) {
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }

    this.isConnected = false;
    this.emit({ type: 'disconnected' });
  }

  // ============= SESSION CONFIGURATION =============

  private sendSessionUpdate(): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

    const currentAgentDef = this.agents.get(this.currentAgent) || WAR_ROOM_AGENTS.general;
    const contextInstructions = this.buildContextInstructions();
    const participantModeInstructions = this.buildParticipantModeInstructions();
    const languageInstructions = buildLanguageInstructions(this.config.preferredLanguage || 'en');

    // Build full instructions with anti-echo, language, and context
    const fullInstructions = [
      ANTI_ECHO_PROTOCOL,
      languageInstructions,
      currentAgentDef.instructions,
      contextInstructions,
      participantModeInstructions,
    ].filter(Boolean).join('\n\n');

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        voice: this.config.voice,
        instructions: fullInstructions,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: this.config.inputAudioTranscription?.model || 'whisper-1',
          language: this.config.preferredLanguage || this.config.inputAudioTranscription?.language || 'en',
        },
        turn_detection: this.config.turnDetection.type === 'semantic_vad'
          ? {
              type: 'semantic_vad',
              eagerness: this.config.turnDetection.eagerness || 'low', // Low eagerness to prevent echo triggers
              create_response: true,
              interrupt_response: true,
            }
          : {
              type: 'server_vad',
              threshold: this.config.turnDetection.threshold || 0.75, // Higher threshold to reduce echo sensitivity
              prefix_padding_ms: this.config.turnDetection.prefixPaddingMs || 600, // Longer prefix to avoid cutting off
              silence_duration_ms: this.config.turnDetection.silenceDurationMs || 1200, // Much longer silence to prevent echo triggers
            },
        tools: this.buildToolsConfig(),
      },
    };

    this.dataChannel.send(JSON.stringify(sessionUpdate));
  }

  private buildToolsConfig(): Array<{ type: string; name: string; description: string; parameters: unknown }> {
    const toolConfigs: Array<{ type: string; name: string; description: string; parameters: unknown }> = [];

    // Add registered tools
    this.tools.forEach((tool, name) => {
      toolConfigs.push({
        type: 'function',
        name,
        description: tool.description,
        parameters: this.zodToJsonSchema(tool.parameters),
      });
    });

    // Add handoff tools for current agent
    const currentAgentDef = this.agents.get(this.currentAgent);
    if (currentAgentDef?.handoffs) {
      currentAgentDef.handoffs.forEach(targetAgent => {
        const targetDef = this.agents.get(targetAgent);
        if (targetDef) {
          toolConfigs.push({
            type: 'function',
            name: `transfer_to_${targetAgent}`,
            description: `Hand off conversation to ${targetDef.name}. ${targetDef.handoffDescription || ''}`,
            parameters: { type: 'object', properties: {}, required: [] },
          });
        }
      });
    }

    return toolConfigs;
  }

  private zodToJsonSchema(schema: unknown): unknown {
    // Simple Zod to JSON Schema conversion
    // For production, use a proper library like zod-to-json-schema
    try {
      const zodSchema = schema as any;
      const description = zodSchema.description || '';
      
      // Check if it's an object schema by looking for _def.shape or shape
      const shape = zodSchema._def?.shape || zodSchema.shape;
      if (shape) {
        const properties: Record<string, unknown> = {};
        const required: string[] = [];

        Object.entries(shape).forEach(([key, value]) => {
          properties[key] = this.zodTypeToJsonSchema(value);
          // Check if optional by looking at _def.typeName
          const typeDef = (value as any)?._def;
          if (typeDef?.typeName !== 'ZodOptional') {
            required.push(key);
          }
        });

        return {
          type: 'object',
          description,
          properties,
          required,
        };
      }
      return { type: 'object', description, properties: {}, required: [] };
    } catch {
      return { type: 'object', properties: {}, required: [] };
    }
  }

  private zodTypeToJsonSchema(zodType: unknown): unknown {
    const typeDef = (zodType as any)?._def;
    const typeName = typeDef?.typeName;
    const description = (zodType as any)?.description || '';

    switch (typeName) {
      case 'ZodString':
        return { type: 'string', description };
      case 'ZodNumber':
        return { type: 'number', description };
      case 'ZodBoolean':
        return { type: 'boolean', description };
      case 'ZodArray':
        return { type: 'array', items: this.zodTypeToJsonSchema(typeDef?.type) };
      case 'ZodOptional':
        return this.zodTypeToJsonSchema(typeDef?.innerType);
      case 'ZodEnum':
        return { type: 'string', enum: typeDef?.values };
      default:
        return { type: 'string', description };
    }
  }

  // ============= SERVER EVENT HANDLING =============

  private handleServerEvent(event: Record<string, unknown>): void {
    const eventType = event.type as string;

    switch (eventType) {
      case 'session.created':
        this.emit({ type: 'session_created', sessionId: event.session_id as string });
        break;

      case 'session.updated':
        this.emit({ type: 'session_updated' });
        break;

      case 'input_audio_buffer.speech_started':
        this.isListening = true;
        break;

      case 'input_audio_buffer.speech_stopped':
        this.isListening = false;
        break;

      case 'conversation.item.input_audio_transcription.delta':
        this.emit({
          type: 'transcript_delta',
          delta: event.delta as string,
          isFinal: false,
          role: 'user',
        });
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.emit({
          type: 'transcript_delta',
          delta: event.transcript as string,
          isFinal: true,
          role: 'user',
        });
        this.addToHistory({
          id: event.item_id as string,
          type: 'message',
          role: 'user',
          transcript: event.transcript as string,
          timestamp: new Date(),
        });
        break;

      case 'response.audio_transcript.delta':
        this.emit({
          type: 'transcript_delta',
          delta: event.delta as string,
          isFinal: false,
          role: 'assistant',
        });
        break;

      case 'response.audio_transcript.done':
        this.emit({
          type: 'transcript_delta',
          delta: event.transcript as string,
          isFinal: true,
          role: 'assistant',
        });
        break;

      case 'response.output_item.done':
        const item = event.item as Record<string, unknown>;
        if (item.type === 'message') {
          const content = (item.content as Array<Record<string, unknown>>)?.[0];
          this.addToHistory({
            id: item.id as string,
            type: 'message',
            role: 'assistant',
            content: content?.text as string,
            transcript: content?.transcript as string,
            timestamp: new Date(),
          });
          
          // Run guardrails on assistant output
          this.runGuardrails(content?.transcript as string || content?.text as string, item.id as string);
        }
        break;

      case 'response.function_call_arguments.done':
        this.handleFunctionCall(event);
        break;

      case 'response.audio.delta':
        // Audio chunks are handled by WebRTC automatically
        this.isSpeaking = true;
        break;

      case 'response.audio.done':
        this.isSpeaking = false;
        break;

      case 'response.done':
        // Track token usage from response
        this.handleResponseDone(event);
        break;

      case 'input_audio_buffer.cancelled':
      case 'response.cancelled':
        this.emit({ type: 'audio_interrupted' });
        this.isSpeaking = false;
        break;

      case 'error':
        console.error('Server error:', event.error);
        this.emit({ type: 'error', error: new Error(JSON.stringify(event.error)) });
        break;
    }
  }

  // ============= TOKEN TRACKING & SUMMARIZATION =============

  private handleResponseDone(event: Record<string, unknown>): void {
    const response = event.response as Record<string, unknown> | undefined;
    if (!response) return;

    // Extract token usage
    const usage = response.usage as Record<string, number> | undefined;
    if (usage) {
      this.totalTokens = usage.total_tokens || 0;
      console.log(`📊 Token usage: ${this.totalTokens} total tokens`);

      // Check if we need to summarize
      this.checkSummarizationNeeded();
    }
  }

  private async checkSummarizationNeeded(): Promise<void> {
    if (this.totalTokens < this.SUMMARY_TRIGGER_TOKENS) return;
    if (this.isSummarizing) return;
    if (this.history.length <= this.KEEP_LAST_TURNS) return;

    console.log(`📝 Token threshold exceeded (${this.totalTokens}/${this.SUMMARY_TRIGGER_TOKENS}). Starting summarization...`);
    this.isSummarizing = true;

    try {
      await this.summarizeOldTurns();
    } catch (error) {
      console.error('Summarization error:', error);
    } finally {
      this.isSummarizing = false;
    }
  }

  private async summarizeOldTurns(): Promise<void> {
    // Get turns to summarize (all except last N)
    const turnsToSummarize = this.history
      .filter(item => item.type === 'message')
      .slice(0, -this.KEEP_LAST_TURNS);

    if (turnsToSummarize.length === 0) return;

    // Build conversation text for summarization
    const conversationText = turnsToSummarize
      .map(turn => `${turn.role?.toUpperCase()}: ${turn.content || turn.transcript || ''}`)
      .join('\n\n');

    // Generate summary using Gemini (available via localStorage API key)
    const apiKey = localStorage.getItem('gemini_api_key') || '';
    if (!apiKey) {
      console.warn('No API key available for summarization');
      return;
    }

    try {
      // Import dynamically to avoid circular dependencies
      const { processWithModel } = await import('./geminiService');

      const summary = await processWithModel(
        apiKey,
        `Summarize this conversation concisely, preserving key facts, decisions, questions asked, and important context. Keep it under 200 words:\n\n${conversationText}`
      );

      if (!summary) {
        console.warn('Empty summary generated');
        return;
      }

      this.conversationSummary = summary;
      console.log(`📝 Generated summary: ${summary.substring(0, 100)}...`);

      // Delete old conversation items from OpenAI session
      for (const turn of turnsToSummarize) {
        if (turn.id && this.dataChannel?.readyState === 'open') {
          this.dataChannel.send(JSON.stringify({
            type: 'conversation.item.delete',
            item_id: turn.id,
          }));
        }
      }

      // Remove old summary if exists
      if (this.summaryItemId && this.dataChannel?.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({
          type: 'conversation.item.delete',
          item_id: this.summaryItemId,
        }));
      }

      // Insert new summary as system message at the beginning
      // IMPORTANT: Use 'system' role, not 'assistant', to prevent model switching to text mode
      const newSummaryId = `summary_${Date.now()}`;
      this.summaryItemId = newSummaryId;

      if (this.dataChannel?.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({
          type: 'conversation.item.create',
          previous_item_id: null, // Insert at the beginning
          item: {
            id: newSummaryId,
            type: 'message',
            role: 'system',
            content: [{
              type: 'input_text',
              text: `[CONVERSATION SUMMARY - Previous discussion context]\n\n${summary}\n\n[END SUMMARY - Continue conversation naturally]`,
            }],
          },
        }));

        console.log('📝 Summary inserted into conversation');
      }

      // Update local history - remove summarized turns, keep the rest
      const keptTurns = this.history.slice(-this.KEEP_LAST_TURNS);
      this.history = keptTurns;
      this.emit({ type: 'history_updated', history: [...this.history] });

    } catch (error) {
      console.error('Error during summarization:', error);
    }
  }

  /**
   * Get current token count
   */
  getTokenCount(): number {
    return this.totalTokens;
  }

  /**
   * Get conversation summary if available
   */
  getConversationSummary(): string {
    return this.conversationSummary;
  }

  /**
   * Check if summarization is in progress
   */
  isSummarizingConversation(): boolean {
    return this.isSummarizing;
  }

  private async handleFunctionCall(event: Record<string, unknown>): Promise<void> {
    const functionName = event.name as string;
    const callId = event.call_id as string;
    let args: Record<string, unknown> = {};
    
    try {
      args = JSON.parse(event.arguments as string);
    } catch {
      args = {};
    }

    this.emit({ type: 'tool_call_started', toolName: functionName });

    // Check if this is a handoff
    if (functionName.startsWith('transfer_to_')) {
      const targetAgent = functionName.replace('transfer_to_', '');
      await this.performHandoff(targetAgent, callId);
      return;
    }

    // Get the tool
    const tool = this.tools.get(functionName);
    if (!tool) {
      this.sendFunctionResult(callId, `Error: Unknown tool "${functionName}"`);
      return;
    }

    // Check if approval is needed
    if (tool.needsApproval) {
      const approvalRequest: ToolApprovalRequest = {
        id: callId,
        toolName: functionName,
        arguments: args,
        agentName: this.currentAgent,
        timestamp: new Date(),
      };
      this.pendingApprovals.set(callId, approvalRequest);
      this.emit({ type: 'tool_approval_requested', request: approvalRequest });
      return;
    }

    // Execute the tool
    await this.executeTool(tool, args, callId);
  }

  private async executeTool(tool: RealtimeTool, args: Record<string, unknown>, callId: string): Promise<void> {
    try {
      const context: RealtimeToolContext = {
        history: [...this.history],
        userId: this.userId,
        projectId: this.projectId,
        sessionId: this.sessionId,
      };

      const result = await tool.execute(args, context);
      this.emit({ type: 'tool_call_completed', toolName: tool.name, result });
      
      this.addToHistory({
        id: `${callId}-call`,
        type: 'function_call',
        name: tool.name,
        arguments: JSON.stringify(args),
        timestamp: new Date(),
      });

      this.addToHistory({
        id: `${callId}-result`,
        type: 'function_result',
        name: tool.name,
        output: result,
        timestamp: new Date(),
      });

      this.sendFunctionResult(callId, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.sendFunctionResult(callId, `Error: ${errorMessage}`);
    }
  }

  private sendFunctionResult(callId: string, result: string): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

    this.dataChannel.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: result,
      },
    }));

    // Request a new response
    this.dataChannel.send(JSON.stringify({
      type: 'response.create',
    }));
  }

  private async performHandoff(targetAgent: string, callId: string): Promise<void> {
    const previousAgent = this.currentAgent;
    
    if (!this.agents.has(targetAgent)) {
      this.sendFunctionResult(callId, `Error: Unknown agent "${targetAgent}"`);
      return;
    }

    this.currentAgent = targetAgent;
    this.emit({ type: 'agent_switched', fromAgent: previousAgent, toAgent: targetAgent });
    
    // Update session with new agent's configuration
    this.sendSessionUpdate();
    
    this.sendFunctionResult(callId, `Successfully transferred to ${this.agents.get(targetAgent)?.name}`);
  }

  private async runGuardrails(output: string, itemId: string): Promise<void> {
    if (!output) return;

    for (const guardrail of this.guardrails) {
      try {
        const result = await guardrail.execute({ agentOutput: output });
        if (result.tripwireTriggered) {
          this.emit({ type: 'guardrail_tripped', guardrailName: guardrail.name, itemId });
          this.interrupt();
          break;
        }
      } catch (error) {
        console.error(`Guardrail "${guardrail.name}" error:`, error);
      }
    }
  }

  // ============= PUBLIC API =============

  registerTool(tool: RealtimeTool): void {
    this.tools.set(tool.name, tool);
    if (this.isConnected) {
      this.sendSessionUpdate();
    }
  }

  registerGuardrail(guardrail: RealtimeOutputGuardrail): void {
    this.guardrails.push(guardrail);
  }

  approve(approvalRequest: ToolApprovalRequest): void {
    const pending = this.pendingApprovals.get(approvalRequest.id);
    if (!pending) return;

    this.pendingApprovals.delete(approvalRequest.id);
    
    const tool = this.tools.get(pending.toolName);
    if (tool) {
      this.executeTool(tool, pending.arguments, pending.id);
    }
  }

  reject(approvalRequest: ToolApprovalRequest): void {
    const pending = this.pendingApprovals.get(approvalRequest.id);
    if (!pending) return;

    this.pendingApprovals.delete(approvalRequest.id);
    this.sendFunctionResult(pending.id, 'Tool call was rejected by user.');
  }

  sendMessage(text: string): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

    this.dataChannel.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    }));

    this.dataChannel.send(JSON.stringify({
      type: 'response.create',
    }));

    this.addToHistory({
      id: `user-${Date.now()}`,
      type: 'message',
      role: 'user',
      content: text,
      timestamp: new Date(),
    });
  }

  interrupt(): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

    this.dataChannel.send(JSON.stringify({
      type: 'response.cancel',
    }));

    this.isSpeaking = false;
    this.emit({ type: 'audio_interrupted' });
  }

  switchAgent(agentName: string): void {
    if (!this.agents.has(agentName)) {
      console.error(`Unknown agent: ${agentName}`);
      return;
    }

    const previousAgent = this.currentAgent;
    this.currentAgent = agentName;
    this.emit({ type: 'agent_switched', fromAgent: previousAgent, toAgent: agentName });
    
    if (this.isConnected) {
      this.sendSessionUpdate();
    }
  }

  updateConfig(config: Partial<RealtimeSessionConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.isConnected) {
      this.sendSessionUpdate();
    }
  }

  private addToHistory(item: RealtimeHistoryItem): void {
    this.history.push(item);
    this.emit({ type: 'history_added', item });
    this.emit({ type: 'history_updated', history: [...this.history] });
  }

  updateHistory(
    historyOrFn: RealtimeHistoryItem[] | ((current: RealtimeHistoryItem[]) => RealtimeHistoryItem[])
  ): void {
    if (typeof historyOrFn === 'function') {
      this.history = historyOrFn([...this.history]);
    } else {
      this.history = historyOrFn;
    }
    this.emit({ type: 'history_updated', history: [...this.history] });
  }

  clearHistory(): void {
    this.history = [];
    this.emit({ type: 'history_updated', history: [] });
  }

  setMuted(muted: boolean): void {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  setVolume(volume: number): void {
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, volume));
    }
  }
}

// ============= EPHEMERAL TOKEN GENERATION =============

/**
 * Generate an ephemeral token for OpenAI Realtime API
 * Uses a Supabase Edge Function to proxy the request (avoids CORS issues)
 */
export async function generateEphemeralToken(
  openaiApiKey: string,
  config: { model?: string; voice?: string } = {}
): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  const model = config.model || 'gpt-4o-realtime-preview';
  const voice = config.voice || 'alloy';

  console.log(`🎤 Generating ephemeral token via edge function for model: ${model}`);

  try {
    // Call our Supabase Edge Function to proxy the request
    const response = await fetch(`${supabaseUrl}/functions/v1/openai-realtime-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        apiKey: openaiApiKey,
        model,
        voice,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      console.error('❌ Edge function error:', errorData);
      throw new Error(errorData.error || `Failed to generate token: ${response.status}`);
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('No token returned from edge function');
    }

    console.log('✅ Ephemeral token generated successfully via edge function');
    return data.token;

  } catch (error) {
    console.error('❌ Token generation failed:', error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

// ============= SINGLETON INSTANCE =============

let activeSession: RealtimeVoiceSession | null = null;

export function getActiveSession(): RealtimeVoiceSession | null {
  return activeSession;
}

export function setActiveSession(session: RealtimeVoiceSession | null): void {
  activeSession = session;
}

export function createRealtimeSession(
  userId: string,
  config?: Partial<RealtimeSessionConfig>,
  projectId?: string,
  sessionId?: string
): RealtimeVoiceSession {
  const session = new RealtimeVoiceSession(userId, config, projectId, sessionId);
  setActiveSession(session);
  return session;
}
