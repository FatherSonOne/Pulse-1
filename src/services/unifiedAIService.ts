// Unified AI Service - Fallback between OpenAI, Claude, and Gemini
import { generateOpenAIResponse } from './openAiService';
import { generateClaudeResponse } from './anthropicService';
import { GoogleGenAI } from "@google/genai";

export type AIProvider = 'openai' | 'claude' | 'gemini';

export interface AIConfig {
  openaiKey?: string;
  claudeKey?: string;
  geminiKey?: string;
  preferredProvider?: AIProvider;
}

export interface AIResponse {
  text: string;
  provider: AIProvider;
  model: string;
}

const generateGeminiResponse = async (apiKey: string, prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const generateWithFallback = async (
  config: AIConfig,
  prompt: string,
  options?: { maxRetries?: number }
): Promise<AIResponse> => {
  const maxRetries = options?.maxRetries ?? 2;
  
  // Build provider order based on preference and available keys
  const providers: { provider: AIProvider; key: string; model: string }[] = [];
  
  // Add preferred provider first if available
  if (config.preferredProvider === 'openai' && config.openaiKey) {
    providers.push({ provider: 'openai', key: config.openaiKey, model: 'gpt-4o' });
  } else if (config.preferredProvider === 'claude' && config.claudeKey) {
    providers.push({ provider: 'claude', key: config.claudeKey, model: 'claude-3-5-sonnet-20241022' });
  } else if (config.preferredProvider === 'gemini' && config.geminiKey) {
    providers.push({ provider: 'gemini', key: config.geminiKey, model: 'gemini-2.5-flash' });
  }
  
  // Add remaining providers as fallbacks
  if (config.openaiKey && !providers.some(p => p.provider === 'openai')) {
    providers.push({ provider: 'openai', key: config.openaiKey, model: 'gpt-4o' });
  }
  if (config.claudeKey && !providers.some(p => p.provider === 'claude')) {
    providers.push({ provider: 'claude', key: config.claudeKey, model: 'claude-3-5-sonnet-20241022' });
  }
  if (config.geminiKey && !providers.some(p => p.provider === 'gemini')) {
    providers.push({ provider: 'gemini', key: config.geminiKey, model: 'gemini-2.5-flash' });
  }
  
  if (providers.length === 0) {
    throw new Error("No AI API keys configured");
  }
  
  let lastError: Error | null = null;
  
  for (const { provider, key, model } of providers) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        let text: string;
        
        switch (provider) {
          case 'openai':
            text = await generateOpenAIResponse(key, prompt);
            break;
          case 'claude':
            text = await generateClaudeResponse(key, prompt);
            break;
          case 'gemini':
            text = await generateGeminiResponse(key, prompt);
            break;
        }
        
        return { text, provider, model };
      } catch (error) {
        console.warn(`[UnifiedAI] ${provider} attempt ${attempt + 1} failed:`, error);
        lastError = error as Error;
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    console.warn(`[UnifiedAI] ${provider} exhausted all retries, trying next provider...`);
  }
  
  throw lastError || new Error("All AI providers failed");
};

// Convenience function for quick calls with auto-fallback
export const askAI = async (
  prompt: string,
  config: AIConfig
): Promise<string> => {
  const response = await generateWithFallback(config, prompt);
  return response.text;
};
