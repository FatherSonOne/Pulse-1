import { withFormattedOutput, FormattingContext, getContextualFormattingHints } from './aiFormattingService';

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
