// AI router errors — specific types so UI can render the right upgrade prompt.

export class AIRouterError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AIRouterError';
  }
}

export class AICapExceededError extends AIRouterError {
  constructor(
    public readonly usage: number,
    public readonly limit: number,
    public readonly resetAt: string,
  ) {
    super(
      `AI message limit reached (${usage}/${limit}). Resets on ${resetAt}.`,
      'cap_exceeded',
    );
    this.name = 'AICapExceededError';
  }
}

export class AITrialExpiredError extends AIRouterError {
  constructor() {
    super('Trial has expired. Upgrade to continue using AI features.', 'trial_expired');
    this.name = 'AITrialExpiredError';
  }
}

export class AIProviderUnavailableError extends AIRouterError {
  constructor(detail: string) {
    super(`AI provider unavailable: ${detail}`, 'provider_unavailable');
    this.name = 'AIProviderUnavailableError';
  }
}

/** Thrown when invokeAIJson can't parse the model response after fence-stripping
 *  and structural extraction. Carries the raw text for debugging. */
export class AIJsonParseError extends AIRouterError {
  constructor(public readonly rawText: string, public readonly parseError: Error) {
    super(`AI returned unparseable JSON: ${parseError.message}`, 'json_parse_failed');
    this.name = 'AIJsonParseError';
  }
}
