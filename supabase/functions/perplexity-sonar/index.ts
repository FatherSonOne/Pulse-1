// Supabase Edge Function for Perplexity Sonar API
// Provides secure, server-side access to Perplexity's web-grounded AI search

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// Available Sonar models
const SONAR_MODELS = {
  'sonar': 'sonar',              // Fast, web-grounded (default)
  'sonar-pro': 'sonar-pro',      // More capable, web-grounded
  'sonar-reasoning': 'sonar-reasoning', // Most capable with reasoning
} as const;

interface SonarRequest {
  query: string;
  model?: keyof typeof SONAR_MODELS;
  systemPrompt?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  searchRecencyFilter?: 'day' | 'week' | 'month' | 'year';
  returnImages?: boolean;
  returnRelatedQuestions?: boolean;
  searchDomainFilter?: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: SonarRequest = await req.json();

    // Get API key from environment (secure server-side storage)
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');

    if (!perplexityApiKey) {
      return new Response(
        JSON.stringify({ error: 'Perplexity API key not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build request parameters
    const {
      query,
      model = 'sonar',
      systemPrompt = 'You are a helpful research assistant. Provide accurate, well-cited answers based on current web information. Be concise but thorough.',
      conversationHistory = [],
      temperature = 0.2,
      maxTokens = 1024,
      searchRecencyFilter = 'month',
      returnImages = false,
      returnRelatedQuestions = true,
      searchDomainFilter = [],
    } = body;

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: query }
    ];

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: SONAR_MODELS[model] || 'sonar',
      messages,
      temperature,
      max_tokens: maxTokens,
      return_citations: true,
      return_related_questions: returnRelatedQuestions,
      search_recency_filter: searchRecencyFilter,
    };

    // Add optional parameters
    if (returnImages) {
      requestBody.return_images = true;
    }

    if (searchDomainFilter.length > 0) {
      requestBody.search_domain_filter = searchDomainFilter;
    }

    console.log(`Sonar request: model=${model}, query length=${query.length}`);

    // Call Perplexity API
    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);

      let errorMessage = `Perplexity API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.detail || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // Extract response components
    const answer = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    const relatedQuestions = data.related_questions || [];
    const images = data.images || [];
    const usage = data.usage || {};

    console.log(`Sonar response: ${citations.length} citations, ${relatedQuestions.length} related questions`);

    return new Response(
      JSON.stringify({
        answer,
        citations,
        relatedQuestions,
        images,
        usage,
        model: data.model,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
