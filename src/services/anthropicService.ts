import Anthropic from '@anthropic-ai/sdk';
import { withFormattedOutput, FormattingContext, AI_FORMATTING_INSTRUCTIONS } from './aiFormattingService';

export const generateClaudeResponse = async (
  apiKey: string,
  prompt: string,
  model: string = 'claude-3-5-sonnet-20241022',
  formattingContext?: FormattingContext
) => {
  const anthropic = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Required for client-side usage
  });

  // Apply formatting if context is provided
  const formattedPrompt = formattingContext
    ? withFormattedOutput(prompt, formattingContext)
    : prompt;

  try {
    const message = await anthropic.messages.create({
      model: model,
      max_tokens: 1024,
      system: formattingContext
        ? AI_FORMATTING_INSTRUCTIONS
        : undefined,
      messages: [{ role: "user", content: formattedPrompt }]
    });

    if (message.content[0].type === 'text') {
        return message.content[0].text;
    }
    return "No text response generated.";
  } catch (error) {
    console.error("Anthropic Error:", error);
    throw error;
  }
};

/**
 * Generate a formatted Claude response with specific context
 */
export const generateFormattedClaudeResponse = async (
  apiKey: string,
  prompt: string,
  context: FormattingContext,
  model: string = 'claude-3-5-sonnet-20241022'
) => {
  return generateClaudeResponse(apiKey, prompt, model, context);
};
