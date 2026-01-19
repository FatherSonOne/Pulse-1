import OpenAI from 'openai';
import { withFormattedOutput, FormattingContext, AI_FORMATTING_INSTRUCTIONS } from './aiFormattingService';

export const generateOpenAIResponse = async (
  apiKey: string,
  prompt: string,
  model: string = 'gpt-4o',
  formattingContext?: FormattingContext
) => {
  const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });

  // Apply formatting if context is provided
  const formattedPrompt = formattingContext
    ? withFormattedOutput(prompt, formattingContext)
    : prompt;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: formattingContext
            ? AI_FORMATTING_INSTRUCTIONS
            : "You are a helpful assistant."
        },
        { role: "user", content: formattedPrompt }
      ],
      model: model,
    });

    return completion.choices[0].message.content || "No response.";
  } catch (error) {
    console.error("OpenAI Error:", error);
    throw error;
  }
};

/**
 * Generate a formatted OpenAI response with specific context
 */
export const generateFormattedOpenAIResponse = async (
  apiKey: string,
  prompt: string,
  context: FormattingContext,
  model: string = 'gpt-4o'
) => {
  return generateOpenAIResponse(apiKey, prompt, model, context);
};
