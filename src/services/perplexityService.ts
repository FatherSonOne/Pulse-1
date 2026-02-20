import { withFormattedOutput, FormattingContext, getContextualFormattingHints } from './aiFormattingService';

// ─── Fallback helpers ────────────────────────────────────────────────────────

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
// sonar is the fast general-purpose online model
const FALLBACK_MODEL = 'sonar';

function getPerplexityApiKey(): string {
  return import.meta.env.VITE_PERPLEXITY_API_KEY || '';
}

export function isPerplexityAvailable(): boolean {
  return Boolean(getPerplexityApiKey());
}

/**
 * Core text generation via Perplexity's OpenAI-compatible API.
 * Used as a fallback when Gemini is unavailable.
 */
export async function perplexityGenerateText(
  prompt: string,
  systemPrompt?: string,
  model: string = FALLBACK_MODEL
): Promise<string> {
  const apiKey = getPerplexityApiKey();
  if (!apiKey) throw new Error('Perplexity API key not configured (VITE_PERPLEXITY_API_KEY)');

  const messages: { role: 'system' | 'user'; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Perplexity API error (${response.status}): ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Perplexity returned empty response');
  return text;
}

/**
 * Run primaryFn; on failure automatically retry via Perplexity text generation.
 * Only use for functions whose output is plain text (not images/audio/video/embeddings).
 *
 * @param primaryFn       The Gemini-based async function to try first.
 * @param fallbackPrompt  The prompt to send to Perplexity if the primary fails.
 * @param fallbackSystem  Optional system prompt for the Perplexity call.
 * @param label           Short label used in console warnings for debugging.
 */
export async function withPerplexityFallback<T>(
  primaryFn: () => Promise<T>,
  fallbackPrompt: string,
  fallbackSystem?: string,
  label = 'gemini'
): Promise<T | string | null> {
  try {
    return await primaryFn();
  } catch (primaryError) {
    console.warn(`[${label}] Primary AI call failed — trying Perplexity fallback:`, primaryError);

    if (!isPerplexityAvailable()) {
      console.error(`[${label}] Perplexity fallback unavailable (no API key).`);
      return null;
    }

    try {
      const result = await perplexityGenerateText(fallbackPrompt, fallbackSystem);
      console.info(`[${label}] Perplexity fallback succeeded.`);
      return result;
    } catch (fallbackError) {
      console.error(`[${label}] Perplexity fallback also failed:`, fallbackError);
      return null;
    }
  }
}

// ─── Original search function ─────────────────────────────────────────────────

export const searchPerplexity = async (
  apiKey: string,
  query: string,
  formattingContext: FormattingContext = 'research'
) => {
  // Apply research formatting by default for Perplexity searches
  const formattedQuery = withFormattedOutput(query, formattingContext);

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: `You are a helpful research assistant. Provide accurate, cited answers.

${getContextualFormattingHints(formattingContext)}

**CRITICAL**: Format your response with emojis, bold text, and clear structure for easy reading.`
          },
          { role: 'user', content: formattedQuery }
        ],
        return_citations: true
      })
    });

    if (!response.ok) {
        throw new Error(`Perplexity API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
        text: data.choices[0].message.content,
        citations: data.citations || []
    };
  } catch (error) {
    console.error("Perplexity Error:", error);
    throw error;
  }
};
