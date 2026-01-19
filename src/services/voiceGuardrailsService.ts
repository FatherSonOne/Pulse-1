/**
 * Voice Agent Guardrails Service
 * Implements output guardrails for real-time voice agents
 * 
 * Guardrails run asynchronously as the model speaks, allowing
 * immediate interruption if content violates rules.
 */

import { RealtimeOutputGuardrail } from './realtimeAgentService';

// ============= GUARDRAIL DEFINITIONS =============

/**
 * Content Safety Guardrail
 * Prevents disclosure of sensitive information
 */
export const contentSafetyGuardrail: RealtimeOutputGuardrail = {
  name: 'Content Safety',
  execute: async ({ agentOutput }) => {
    const sensitivePatterns = [
      // API keys and secrets
      /\b(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}/i,
      // Passwords
      /\b(password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{6,}/i,
      // Credit card numbers
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
      // SSN
      /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/,
      // Private keys
      /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i,
    ];

    const isTriggered = sensitivePatterns.some(pattern => pattern.test(agentOutput));

    return {
      tripwireTriggered: isTriggered,
      outputInfo: isTriggered ? { reason: 'Potential sensitive information detected' } : {},
    };
  },
};

/**
 * Profanity Filter Guardrail
 * Prevents inappropriate language
 */
export const profanityFilterGuardrail: RealtimeOutputGuardrail = {
  name: 'Profanity Filter',
  execute: async ({ agentOutput }) => {
    // Basic profanity patterns (expand as needed)
    const profanityPatterns = [
      /\b(fuck|shit|damn|ass|bitch|bastard)\b/i,
      /\b(crap|hell)\b/i, // Milder terms, optional
    ];

    // Only trigger on strong profanity
    const strongProfanity = profanityPatterns.slice(0, 1);
    const isTriggered = strongProfanity.some(pattern => pattern.test(agentOutput));

    return {
      tripwireTriggered: isTriggered,
      outputInfo: isTriggered ? { reason: 'Inappropriate language detected' } : {},
    };
  },
};

/**
 * Competitor Mention Guardrail
 * Prevents mentioning competitor products (customizable)
 */
export const competitorMentionGuardrail = (competitors: string[]): RealtimeOutputGuardrail => ({
  name: 'Competitor Mention',
  execute: async ({ agentOutput }) => {
    const lowerOutput = agentOutput.toLowerCase();
    const mentionedCompetitor = competitors.find(c => lowerOutput.includes(c.toLowerCase()));

    return {
      tripwireTriggered: !!mentionedCompetitor,
      outputInfo: mentionedCompetitor 
        ? { reason: `Mentioned competitor: ${mentionedCompetitor}` } 
        : {},
    };
  },
});

/**
 * Legal/Medical Advice Guardrail
 * Prevents giving professional advice
 */
export const professionalAdviceGuardrail: RealtimeOutputGuardrail = {
  name: 'Professional Advice',
  execute: async ({ agentOutput }) => {
    const advicePatterns = [
      /\b(you should|i recommend|my advice is)\b.*\b(sue|lawsuit|legal action|file a claim)\b/i,
      /\b(you should|i recommend|my advice is)\b.*\b(take|stop taking|prescribe|medication|medicine)\b/i,
      /\b(you should|i recommend|my advice is)\b.*\b(invest|buy|sell|stock|crypto)\b/i,
      /\b(i am (a|your)|as a)\s+(lawyer|attorney|doctor|physician|financial advisor)\b/i,
    ];

    const isTriggered = advicePatterns.some(pattern => pattern.test(agentOutput));

    return {
      tripwireTriggered: isTriggered,
      outputInfo: isTriggered 
        ? { reason: 'Potential professional advice detected' } 
        : {},
    };
  },
};

/**
 * Personal Information Request Guardrail
 * Prevents the AI from asking for sensitive personal info
 */
export const personalInfoRequestGuardrail: RealtimeOutputGuardrail = {
  name: 'Personal Info Request',
  execute: async ({ agentOutput }) => {
    const requestPatterns = [
      /\b(what is|tell me|provide|share)\s+(your|the)\s+(social security|ssn|credit card|bank account)\b/i,
      /\b(what is|tell me|provide|share)\s+(your|the)\s+(password|pin|security code)\b/i,
      /\b(what is|tell me|provide|share)\s+(your|the)\s+(mother'?s? maiden name|first pet|street you grew up)\b/i,
    ];

    const isTriggered = requestPatterns.some(pattern => pattern.test(agentOutput));

    return {
      tripwireTriggered: isTriggered,
      outputInfo: isTriggered 
        ? { reason: 'AI requested sensitive personal information' } 
        : {},
    };
  },
};

/**
 * Hallucination Detection Guardrail
 * Detects when the AI might be making things up
 */
export const hallucinationDetectionGuardrail: RealtimeOutputGuardrail = {
  name: 'Hallucination Detection',
  execute: async ({ agentOutput }) => {
    // Patterns that might indicate hallucination
    const hallucinationPatterns = [
      /\b(according to|based on)\s+(the|a)\s+(document|file|report)\s+that\s+(doesn't|does not)\s+exist\b/i,
      /\b(i remember|i recall)\s+(that|when)\s+you\s+(said|mentioned|told me)\b/i, // AI shouldn't "remember" past sessions
      /\b(as of|since)\s+(my|the)\s+last\s+update\b/i, // Knowledge cutoff awareness
    ];

    // This is a soft guardrail - log but don't always block
    const mightBeHallucinating = hallucinationPatterns.some(pattern => pattern.test(agentOutput));

    return {
      tripwireTriggered: false, // Don't block, just flag
      outputInfo: mightBeHallucinating 
        ? { warning: 'Potential hallucination detected', flagged: true } 
        : {},
    };
  },
};

/**
 * Off-Topic Detection Guardrail
 * Detects when conversation goes off-topic
 */
export const offTopicGuardrail = (allowedTopics: string[]): RealtimeOutputGuardrail => ({
  name: 'Off-Topic Detection',
  execute: async ({ agentOutput }) => {
    // This is a soft guardrail - just tracks topic drift
    const lowerOutput = agentOutput.toLowerCase();
    const isOnTopic = allowedTopics.some(topic => lowerOutput.includes(topic.toLowerCase()));

    return {
      tripwireTriggered: false, // Don't block, just track
      outputInfo: { isOnTopic, checkedTopics: allowedTopics },
    };
  },
});

/**
 * Response Length Guardrail
 * Prevents excessively long responses
 */
export const responseLengthGuardrail = (maxLength: number = 500): RealtimeOutputGuardrail => ({
  name: 'Response Length',
  execute: async ({ agentOutput }) => {
    const isTriggered = agentOutput.length > maxLength;

    return {
      tripwireTriggered: isTriggered,
      outputInfo: isTriggered 
        ? { reason: `Response exceeded ${maxLength} characters`, length: agentOutput.length } 
        : { length: agentOutput.length },
    };
  },
});

/**
 * Brand Voice Guardrail
 * Ensures responses match brand guidelines
 */
export const brandVoiceGuardrail = (forbiddenPhrases: string[]): RealtimeOutputGuardrail => ({
  name: 'Brand Voice',
  execute: async ({ agentOutput }) => {
    const lowerOutput = agentOutput.toLowerCase();
    const foundPhrase = forbiddenPhrases.find(phrase => 
      lowerOutput.includes(phrase.toLowerCase())
    );

    return {
      tripwireTriggered: !!foundPhrase,
      outputInfo: foundPhrase 
        ? { reason: `Found forbidden phrase: "${foundPhrase}"` } 
        : {},
    };
  },
});

// ============= GUARDRAIL COLLECTIONS =============

/**
 * Default guardrails for War Room voice agents
 */
export const DEFAULT_WAR_ROOM_GUARDRAILS: RealtimeOutputGuardrail[] = [
  contentSafetyGuardrail,
  profanityFilterGuardrail,
  professionalAdviceGuardrail,
  personalInfoRequestGuardrail,
  hallucinationDetectionGuardrail,
];

/**
 * Strict guardrails for enterprise/compliance environments
 */
export const ENTERPRISE_GUARDRAILS: RealtimeOutputGuardrail[] = [
  ...DEFAULT_WAR_ROOM_GUARDRAILS,
  responseLengthGuardrail(1000),
];

/**
 * Create custom guardrail set
 */
export function createGuardrailSet(
  options: {
    includeContentSafety?: boolean;
    includeProfanityFilter?: boolean;
    includeProfessionalAdvice?: boolean;
    includePersonalInfoRequest?: boolean;
    includeHallucinationDetection?: boolean;
    competitors?: string[];
    allowedTopics?: string[];
    maxResponseLength?: number;
    forbiddenPhrases?: string[];
  } = {}
): RealtimeOutputGuardrail[] {
  const guardrails: RealtimeOutputGuardrail[] = [];

  if (options.includeContentSafety !== false) {
    guardrails.push(contentSafetyGuardrail);
  }

  if (options.includeProfanityFilter !== false) {
    guardrails.push(profanityFilterGuardrail);
  }

  if (options.includeProfessionalAdvice !== false) {
    guardrails.push(professionalAdviceGuardrail);
  }

  if (options.includePersonalInfoRequest !== false) {
    guardrails.push(personalInfoRequestGuardrail);
  }

  if (options.includeHallucinationDetection !== false) {
    guardrails.push(hallucinationDetectionGuardrail);
  }

  if (options.competitors?.length) {
    guardrails.push(competitorMentionGuardrail(options.competitors));
  }

  if (options.allowedTopics?.length) {
    guardrails.push(offTopicGuardrail(options.allowedTopics));
  }

  if (options.maxResponseLength) {
    guardrails.push(responseLengthGuardrail(options.maxResponseLength));
  }

  if (options.forbiddenPhrases?.length) {
    guardrails.push(brandVoiceGuardrail(options.forbiddenPhrases));
  }

  return guardrails;
}

/**
 * Register all guardrails with a session
 */
export function registerGuardrails(
  session: { registerGuardrail: (guardrail: RealtimeOutputGuardrail) => void },
  guardrails: RealtimeOutputGuardrail[] = DEFAULT_WAR_ROOM_GUARDRAILS
): void {
  guardrails.forEach(guardrail => {
    session.registerGuardrail(guardrail);
  });
}
