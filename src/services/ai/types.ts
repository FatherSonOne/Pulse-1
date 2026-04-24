// Shared AI types — mirror the ai-router edge function contract.
// Keep in sync with supabase/functions/ai-router/tasks.ts and providers.ts.

export type AITask =
  | 'pulse_assistant_chat'
  | 'rag_query'
  | 'email_draft'
  | 'email_reply'
  | 'email_analysis'
  | 'meeting_summary'
  | 'message_summary'
  | 'thread_digest'
  | 'auto_tag'
  | 'voxer_transcript_summary'
  | 'voxer_smart_reply'
  | 'quick_reply_suggestions'
  | 'smart_search_rewrite'
  | 'contact_enrichment'
  | 'decision_risk_analysis'
  | 'task_prioritization'
  | 'proactive_nudge'
  | 'calendar_prep'
  | 'brainstorm_cluster'
  | 'brainstorm_synthesis'
  | 'document_compare'
  | 'knowledge_graph_extract'
  | 'sentiment_analysis'
  | 'conflict_detection'
  | 'content_generation'
  | 'voice_command_parse'
  | 'web_search';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIInvokeParams {
  messages: AIMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Force JSON output. Gemini native; Claude via instruction. Ignored when webSearch=true. */
  jsonMode?: boolean;
  /** Override task-default caching (Claude only). */
  cacheSystemPrompt?: boolean;
  /** Enable Gemini Google Search grounding. Auto-true for task='web_search'. */
  webSearch?: boolean;
}

export interface GroundingChunk {
  uri: string;
  title: string;
}

export interface AIResult {
  text: string;
  provider: 'gemini' | 'claude';
  model: string;
  tokens: { input: number; output: number; cached: number };
  task: AITask;
  usedFallback: boolean;
  usage: { current: number; limit: number | null };
  /** Web sources cited by Gemini when webSearch was enabled. */
  groundingChunks?: GroundingChunk[];
  /** Queries Gemini actually ran against Google Search. */
  searchQueries?: string[];
}
