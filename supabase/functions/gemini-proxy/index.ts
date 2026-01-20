// Supabase Edge Function: Gemini API Proxy
// Securely proxies requests to Google Gemini API with rate limiting and authentication

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ==================== Configuration ====================

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 20; // Per user
const MAX_REQUESTS_PER_MINUTE_ANONYMOUS = 5; // For unauthenticated users

// Request size limits
const MAX_PROMPT_LENGTH = 10000; // characters
const MAX_HISTORY_MESSAGES = 50;

// ==================== Types ====================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface GeminiRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  history?: Array<{ role: string; text: string }>;
  operation?: 'smartReply' | 'draftAnalysis' | 'summarization' | 'sentiment' | 'translation';
}

interface ErrorResponse {
  error: string;
  code: string;
  details?: string;
}

// ==================== Rate Limiting ====================

const rateLimitStore = new Map<string, RateLimitEntry>();

function getRateLimitKey(userId: string): string {
  return `ratelimit:${userId}`;
}

function checkRateLimit(userId: string, isAnonymous: boolean): boolean {
  const key = getRateLimitKey(userId);
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up expired entries
  if (entry && now > entry.resetAt) {
    rateLimitStore.delete(key);
  }

  const currentEntry = rateLimitStore.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  const limit = isAnonymous ? MAX_REQUESTS_PER_MINUTE_ANONYMOUS : MAX_REQUESTS_PER_MINUTE;

  if (currentEntry.count >= limit) {
    return false;
  }

  currentEntry.count++;
  rateLimitStore.set(key, currentEntry);
  return true;
}

function getRateLimitInfo(userId: string, isAnonymous: boolean): { remaining: number; resetAt: number } {
  const key = getRateLimitKey(userId);
  const entry = rateLimitStore.get(key);
  const limit = isAnonymous ? MAX_REQUESTS_PER_MINUTE_ANONYMOUS : MAX_REQUESTS_PER_MINUTE;

  if (!entry) {
    return { remaining: limit, resetAt: Date.now() + RATE_LIMIT_WINDOW };
  }

  return {
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

// ==================== Input Validation ====================

function validateRequest(body: GeminiRequest): { valid: boolean; error?: string } {
  if (!body.prompt || typeof body.prompt !== 'string') {
    return { valid: false, error: 'Prompt is required and must be a string' };
  }

  if (body.prompt.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters` };
  }

  if (body.history && Array.isArray(body.history)) {
    if (body.history.length > MAX_HISTORY_MESSAGES) {
      return { valid: false, error: `History exceeds maximum of ${MAX_HISTORY_MESSAGES} messages` };
    }

    for (const msg of body.history) {
      if (!msg.role || !msg.text) {
        return { valid: false, error: 'Each history message must have role and text' };
      }
    }
  }

  return { valid: true };
}

function sanitizeInput(input: string): string {
  // Remove potential injection attempts
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

// ==================== Gemini API ====================

async function callGeminiAPI(request: GeminiRequest): Promise<string> {
  const model = request.model || 'gemini-1.5-flash';
  const temperature = request.temperature !== undefined ? request.temperature : 0.7;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  // Build the request payload
  const contents = [];

  // Add history if provided
  if (request.history && Array.isArray(request.history)) {
    for (const msg of request.history) {
      contents.push({
        role: msg.role === 'me' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      });
    }
  }

  // Add current prompt
  contents.push({
    role: 'user',
    parts: [{ text: sanitizeInput(request.prompt) }],
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini API Error:', error);
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid response from Gemini API');
  }

  return data.candidates[0].content.parts[0].text;
}

// ==================== Logging ====================

async function logRequest(
  supabase: any,
  userId: string,
  operation: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from('api_request_logs').insert({
      user_id: userId,
      endpoint: 'gemini-proxy',
      operation,
      success,
      error_message: errorMessage,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log request:', error);
  }
}

// ==================== Main Handler ====================

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // ==================== Authentication ====================

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const isAnonymous = !user.email;

    // ==================== Rate Limiting ====================

    if (!checkRateLimit(userId, isAnonymous)) {
      const rateLimitInfo = getRateLimitInfo(userId, isAnonymous);

      await logRequest(supabase, userId, 'rate_limited', false, 'Rate limit exceeded');

      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          details: `Please try again after ${new Date(rateLimitInfo.resetAt).toISOString()}`,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
            'X-RateLimit-Reset': rateLimitInfo.resetAt.toString(),
          },
        }
      );
    }

    // ==================== Request Parsing ====================

    let body: GeminiRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== Input Validation ====================

    const validation = validateRequest(body);
    if (!validation.valid) {
      await logRequest(supabase, userId, body.operation || 'unknown', false, validation.error);

      return new Response(
        JSON.stringify({ error: validation.error, code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== API Key Check ====================

    if (!GEMINI_API_KEY) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Service configuration error', code: 'SERVER_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== Call Gemini API ====================

    const result = await callGeminiAPI(body);

    await logRequest(supabase, userId, body.operation || 'generate', true);

    // ==================== Return Response ====================

    const rateLimitInfo = getRateLimitInfo(userId, isAnonymous);

    return new Response(
      JSON.stringify({
        result,
        usage: {
          promptLength: body.prompt.length,
          historyMessages: body.history?.length || 0,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
          'X-RateLimit-Reset': rateLimitInfo.resetAt.toString(),
        },
      }
    );

  } catch (error: any) {
    console.error('Error processing request:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        code: 'SERVER_ERROR',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
