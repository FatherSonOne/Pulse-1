// Task Registry — single source of truth for AI model routing
// Change these lines to re-route a task to a different provider/model.
// Each task maps to: primary provider + model, and optional fallback for outages.

export type AIProvider = 'gemini' | 'claude';

export type AITask =
  | 'pulse_assistant_chat'       // User chat (UX-critical) → Haiku
  | 'rag_query'                  // Studio/War Room RAG → Sonnet
  | 'email_draft'                // Email composition → Haiku
  | 'email_reply'                // Email reply generation → Haiku
  | 'email_analysis'             // Inbox triage/categorization → Gemini Flash
  | 'meeting_summary'            // Meeting notes (value driver) → Sonnet
  | 'message_summary'            // Thread/channel summary → Gemini Flash
  | 'thread_digest'              // Daily/catch-up digest → Gemini Flash
  | 'auto_tag'                   // Classification → Gemini Flash
  | 'voxer_transcript_summary'   // Voice transcript summary → Gemini Flash
  | 'voxer_smart_reply'          // Voxer reply suggestions → Gemini Flash
  | 'quick_reply_suggestions'    // Inline quick replies → Gemini Flash
  | 'smart_search_rewrite'       // Query rewriting → Gemini Flash
  | 'contact_enrichment'         // Extraction tasks → Gemini Flash
  | 'decision_risk_analysis'     // Decision risk scoring → Haiku
  | 'task_prioritization'        // Task priority scoring → Gemini Flash
  | 'proactive_nudge'            // Nudge generation → Gemini Flash
  | 'calendar_prep'              // Meeting prep briefing → Haiku
  | 'brainstorm_cluster'         // Idea clustering → Gemini Flash
  | 'brainstorm_synthesis'       // Gap analysis / synthesis → Sonnet
  | 'document_compare'           // Document comparison → Sonnet
  | 'knowledge_graph_extract'    // Entity extraction → Gemini Flash
  | 'sentiment_analysis'         // Message sentiment → Gemini Flash
  | 'conflict_detection'         // Conflict analysis → Haiku
  | 'content_generation'         // FAQ/podcast/study guide → Sonnet
  | 'voice_command_parse'        // Parse voice commands → Gemini Flash
  | 'web_search'                 // Web-grounded search with citations → Gemini Flash + googleSearch
  | 'translation';               // Text translation → Gemini Flash

interface TaskConfig {
  provider: AIProvider;
  model: string;
  fallback: { provider: AIProvider; model: string } | null;
  /** Max output tokens — defaults to 2048 if not set. */
  maxOutputTokens?: number;
  /** Whether this task uses a cacheable system prompt (Claude only). */
  cacheSystemPrompt?: boolean;
}

// Canonical model identifiers
// gemini-2.5-flash: current Gemini Flash (2.0 was deprecated April 2026 for new users)
const GEMINI_FLASH = 'gemini-2.5-flash';
const CLAUDE_HAIKU = 'claude-haiku-4-5-20251001';
const CLAUDE_SONNET = 'claude-sonnet-4-6';

export const TASK_MODELS: Record<AITask, TaskConfig> = {
  // UX-critical — Claude Haiku
  pulse_assistant_chat: {
    provider: 'claude', model: CLAUDE_HAIKU,
    fallback: { provider: 'gemini', model: GEMINI_FLASH },
    maxOutputTokens: 2048,
    cacheSystemPrompt: true,
  },
  email_draft: {
    provider: 'claude', model: CLAUDE_HAIKU,
    fallback: { provider: 'gemini', model: GEMINI_FLASH },
    maxOutputTokens: 1024,
  },
  email_reply: {
    provider: 'claude', model: CLAUDE_HAIKU,
    fallback: { provider: 'gemini', model: GEMINI_FLASH },
    maxOutputTokens: 1024,
  },
  decision_risk_analysis: {
    provider: 'claude', model: CLAUDE_HAIKU,
    fallback: { provider: 'gemini', model: GEMINI_FLASH },
    maxOutputTokens: 1024,
  },
  calendar_prep: {
    provider: 'claude', model: CLAUDE_HAIKU,
    fallback: { provider: 'gemini', model: GEMINI_FLASH },
    maxOutputTokens: 2048,
  },
  conflict_detection: {
    provider: 'claude', model: CLAUDE_HAIKU,
    fallback: { provider: 'gemini', model: GEMINI_FLASH },
    maxOutputTokens: 1024,
  },

  // High-value reasoning — Claude Sonnet
  rag_query: {
    provider: 'claude', model: CLAUDE_SONNET,
    fallback: { provider: 'claude', model: CLAUDE_HAIKU },
    maxOutputTokens: 4096,
    cacheSystemPrompt: true,
  },
  meeting_summary: {
    provider: 'claude', model: CLAUDE_SONNET,
    fallback: { provider: 'claude', model: CLAUDE_HAIKU },
    maxOutputTokens: 3072,
  },
  brainstorm_synthesis: {
    provider: 'claude', model: CLAUDE_SONNET,
    fallback: { provider: 'claude', model: CLAUDE_HAIKU },
    maxOutputTokens: 3072,
  },
  document_compare: {
    provider: 'claude', model: CLAUDE_SONNET,
    fallback: { provider: 'claude', model: CLAUDE_HAIKU },
    maxOutputTokens: 3072,
  },
  content_generation: {
    provider: 'claude', model: CLAUDE_SONNET,
    fallback: { provider: 'claude', model: CLAUDE_HAIKU },
    maxOutputTokens: 4096,
  },

  // Bulk/cheap tasks — Gemini Flash
  email_analysis: { provider: 'gemini', model: GEMINI_FLASH, fallback: { provider: 'claude', model: CLAUDE_HAIKU } },
  message_summary: { provider: 'gemini', model: GEMINI_FLASH, fallback: { provider: 'claude', model: CLAUDE_HAIKU } },
  thread_digest: { provider: 'gemini', model: GEMINI_FLASH, fallback: { provider: 'claude', model: CLAUDE_HAIKU } },
  auto_tag: { provider: 'gemini', model: GEMINI_FLASH, fallback: null },
  voxer_transcript_summary: { provider: 'gemini', model: GEMINI_FLASH, fallback: { provider: 'claude', model: CLAUDE_HAIKU } },
  voxer_smart_reply: { provider: 'gemini', model: GEMINI_FLASH, fallback: null },
  quick_reply_suggestions: { provider: 'gemini', model: GEMINI_FLASH, fallback: null },
  smart_search_rewrite: { provider: 'gemini', model: GEMINI_FLASH, fallback: null },
  contact_enrichment: { provider: 'gemini', model: GEMINI_FLASH, fallback: null },
  task_prioritization: { provider: 'gemini', model: GEMINI_FLASH, fallback: null },
  proactive_nudge: { provider: 'gemini', model: GEMINI_FLASH, fallback: null },
  brainstorm_cluster: { provider: 'gemini', model: GEMINI_FLASH, fallback: null },
  knowledge_graph_extract: { provider: 'gemini', model: GEMINI_FLASH, fallback: null },
  sentiment_analysis: { provider: 'gemini', model: GEMINI_FLASH, fallback: null },
  voice_command_parse: { provider: 'gemini', model: GEMINI_FLASH, fallback: null },
  // web_search: Gemini with googleSearch grounding. Claude has no equivalent, so no fallback.
  // Caller MUST also pass params.webSearch=true to enable the tool.
  web_search: { provider: 'gemini', model: GEMINI_FLASH, fallback: null },
  translation: {
    provider: 'gemini', model: GEMINI_FLASH,
    fallback: { provider: 'claude', model: CLAUDE_HAIKU },
    maxOutputTokens: 1024,
  },
};

export function isValidTask(task: string): task is AITask {
  return task in TASK_MODELS;
}

// ── Model override allowlist ─────────────────────────────────────────
// Mirror of `src/lib/aiModelCatalog.ts`. Adding a model: append to both.
// The router validates client-supplied model_override against this map so
// callers cannot ask for arbitrary model strings.
//
// Capability flags are enforced too — e.g. `web_search` task requires a model
// that supports webSearch (Gemini only).
export interface AllowedModel {
  provider: AIProvider;
  model: string;
  supports: { webSearch: boolean; promptCaching: boolean };
}

export const MODEL_ALLOWLIST: Record<string, AllowedModel> = {
  'gemini-flash': {
    provider: 'gemini',
    model: GEMINI_FLASH,
    supports: { webSearch: true, promptCaching: false },
  },
  'claude-haiku': {
    provider: 'claude',
    model: CLAUDE_HAIKU,
    supports: { webSearch: false, promptCaching: true },
  },
  'claude-sonnet': {
    provider: 'claude',
    model: CLAUDE_SONNET,
    supports: { webSearch: false, promptCaching: true },
  },
};

export function resolveOverride(id: string): AllowedModel | null {
  return MODEL_ALLOWLIST[id] ?? null;
}
