// Provider adapters — Gemini 2.0 Flash and Claude (Haiku/Sonnet)
// Both return a normalized AIResponse so the router is provider-agnostic.
// Claude provider implements prompt caching (90% cost reduction on repeated system prompts).

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIInvokeInput {
  systemPrompt?: string;
  messages: AIMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  model: string;
  /** When true, wraps systemPrompt in Claude cache_control. Ignored by Gemini. */
  cacheSystemPrompt?: boolean;
  /** Force JSON output (Gemini supports natively; Claude uses prompt instruction). */
  jsonMode?: boolean;
  /** When true, enables Gemini Google Search grounding. Ignored by Claude (no equivalent). */
  webSearch?: boolean;
}

export interface GroundingChunk {
  uri: string;
  title: string;
}

export interface AIResponse {
  text: string;
  provider: 'gemini' | 'claude';
  model: string;
  tokens: { input: number; output: number; cached: number };
  /** Web sources cited by Gemini when webSearch=true. Empty otherwise. */
  groundingChunks?: GroundingChunk[];
  /** Queries Gemini actually ran against Google Search when webSearch=true. */
  searchQueries?: string[];
}

// ──────────────────────────────────────────────────────────────────
// Gemini
// ──────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

export async function invokeGemini(input: AIInvokeInput): Promise<AIResponse> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent?key=${GEMINI_API_KEY}`;

  const contents = input.messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // Gemini rejects jsonMode + tools in the same request. webSearch wins — when
  // the caller wants grounded answers, we give up the structured-output guarantee.
  const useJson = input.jsonMode && !input.webSearch;

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: input.temperature ?? 0.7,
      maxOutputTokens: input.maxOutputTokens ?? 2048,
      ...(useJson ? { responseMimeType: 'application/json' } : {}),
    },
  };

  if (input.systemPrompt) {
    body.systemInstruction = { parts: [{ text: input.systemPrompt }] };
  }

  if (input.webSearch) {
    // Google Search grounding — model issues its own queries, cites sources.
    // Supported on gemini-2.5-flash, gemini-2.5-pro. Free for the first 1,500
    // grounded requests/day then metered; included in standard Gemini pricing.
    body.tools = [{ googleSearch: {} }];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text');

  // Extract grounding metadata when webSearch was enabled
  let groundingChunks: GroundingChunk[] | undefined;
  let searchQueries: string[] | undefined;
  if (input.webSearch && candidate?.groundingMetadata) {
    const gm = candidate.groundingMetadata;
    if (Array.isArray(gm.groundingChunks)) {
      groundingChunks = gm.groundingChunks
        .map((c: { web?: { uri?: string; title?: string } }) => c.web)
        .filter((w: unknown): w is { uri: string; title: string } =>
          !!w && typeof (w as { uri?: unknown }).uri === 'string',
        )
        .map((w: { uri: string; title?: string }) => ({
          uri: w.uri,
          title: w.title || w.uri,
        }));
    }
    if (Array.isArray(gm.webSearchQueries)) {
      searchQueries = gm.webSearchQueries;
    }
  }

  const usage = data.usageMetadata || {};
  return {
    text,
    provider: 'gemini',
    model: input.model,
    tokens: {
      input: usage.promptTokenCount ?? 0,
      output: usage.candidatesTokenCount ?? 0,
      cached: 0,
    },
    ...(groundingChunks ? { groundingChunks } : {}),
    ...(searchQueries ? { searchQueries } : {}),
  };
}

// ──────────────────────────────────────────────────────────────────
// Claude (with prompt caching)
// ──────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export async function invokeClaude(input: AIInvokeInput): Promise<AIResponse> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  // System prompt can be a string OR an array with cache_control for prompt caching.
  // Cache ephemeral: ~5-min TTL, 90% cost reduction on cached reads.
  let system: unknown;
  if (input.systemPrompt) {
    system = input.cacheSystemPrompt
      ? [{ type: 'text', text: input.systemPrompt, cache_control: { type: 'ephemeral' } }]
      : input.systemPrompt;
  }

  const messages = input.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  // JSON mode for Claude: append instruction to last user message
  if (input.jsonMode && messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last.role === 'user') {
      last.content += '\n\nRespond with valid JSON only. No markdown fences, no commentary.';
    }
  }

  const body: Record<string, unknown> = {
    model: input.model,
    max_tokens: input.maxOutputTokens ?? 2048,
    temperature: input.temperature ?? 0.7,
    messages,
  };
  if (system) body.system = system;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Claude returned no text');

  const usage = data.usage || {};
  return {
    text,
    provider: 'claude',
    model: input.model,
    tokens: {
      input: usage.input_tokens ?? 0,
      output: usage.output_tokens ?? 0,
      cached: (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
    },
  };
}
