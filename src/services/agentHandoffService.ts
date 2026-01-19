/**
 * Agent Handoff Service
 *
 * Manages multi-agent orchestration and intelligent routing between
 * specialized agent personas in the Pulse War Room.
 */

import { RealtimeHistoryItem, getActiveSession } from './realtimeAgentService';

// Core agent modes matching WAR_ROOM_AGENTS
export type AgentMode = 'general' | 'analyst' | 'scribe' | 'strategist';

// Extended specialist types
export type SpecialistType =
  | 'technical_support'
  | 'creative_strategist'
  | 'data_analyst'
  | 'project_manager'
  | 'research_specialist';

export interface AgentProfile {
  type: AgentMode | SpecialistType;
  name: string;
  description: string;
  keywords: string[];
  handoffDescription: string;
  capabilities: string[];
}

export interface HandoffContext {
  fromAgent: string;
  toAgent: string;
  reason: string;
  preserveHistory: boolean;
  conversationSummary?: string;
}

export interface HandoffResult {
  success: boolean;
  newAgent: AgentProfile;
  context: HandoffContext;
  error?: string;
}

// Define all available agents
const AGENT_PROFILES: Record<AgentMode | SpecialistType, AgentProfile> = {
  // Core personas (matching WAR_ROOM_AGENTS from realtimeAgentService)
  general: {
    type: 'general',
    name: 'War Room General',
    description: 'Helpful AI assistant for strategic planning and team coordination',
    keywords: ['help', 'question', 'how to', 'what is', 'explain', 'general', 'coordinate'],
    handoffDescription: 'General assistant for project coordination',
    capabilities: ['answering questions', 'providing information', 'basic assistance', 'coordination']
  },
  analyst: {
    type: 'analyst',
    name: 'War Room Analyst',
    description: 'Analytical expert for deep data analysis and research',
    keywords: ['data', 'analyze', 'statistics', 'metrics', 'trend', 'report', 'research', 'pattern'],
    handoffDescription: 'Specialist for deep data analysis and research',
    capabilities: ['data analysis', 'pattern recognition', 'research', 'evidence-based recommendations']
  },
  scribe: {
    type: 'scribe',
    name: 'War Room Scribe',
    description: 'Documentation specialist for notes and record-keeping',
    keywords: ['document', 'note', 'summary', 'record', 'write', 'capture', 'decision'],
    handoffDescription: 'Specialist for documentation and note-taking',
    capabilities: ['documentation', 'meeting notes', 'summaries', 'decision records']
  },
  strategist: {
    type: 'strategist',
    name: 'War Room Strategist',
    description: 'Strategic thinker for planning and decision-making',
    keywords: ['strategy', 'plan', 'decision', 'option', 'risk', 'trade-off', 'think'],
    handoffDescription: 'Specialist for strategic planning and decision-making',
    capabilities: ['strategic planning', 'decision analysis', 'risk assessment', 'option evaluation']
  },

  // Specialist agents
  technical_support: {
    type: 'technical_support',
    name: 'Technical Support Specialist',
    description: 'Dedicated support for complex technical issues',
    keywords: ['fix', 'broken', 'not working', 'issue', 'problem', 'crash', '404', '500'],
    handoffDescription: 'Technical support specialist for troubleshooting',
    capabilities: ['issue diagnosis', 'step-by-step troubleshooting', 'error resolution']
  },
  creative_strategist: {
    type: 'creative_strategist',
    name: 'Creative Strategy Lead',
    description: 'Lead strategist for comprehensive creative direction',
    keywords: ['strategy', 'campaign', 'brand', 'marketing', 'vision', 'direction'],
    handoffDescription: 'Creative strategy lead for comprehensive planning',
    capabilities: ['strategy development', 'campaign planning', 'brand direction']
  },
  data_analyst: {
    type: 'data_analyst',
    name: 'Senior Data Analyst',
    description: 'Senior analyst for complex data interpretation',
    keywords: ['complex', 'analysis', 'deep dive', 'correlation', 'prediction', 'model'],
    handoffDescription: 'Senior data analyst for complex analysis',
    capabilities: ['advanced analytics', 'predictive modeling', 'complex queries']
  },
  project_manager: {
    type: 'project_manager',
    name: 'Project Manager',
    description: 'Project coordination and task management',
    keywords: ['project', 'task', 'deadline', 'timeline', 'milestone', 'team', 'coordinate'],
    handoffDescription: 'Project manager for coordination and planning',
    capabilities: ['project planning', 'task management', 'coordination', 'scheduling']
  },
  research_specialist: {
    type: 'research_specialist',
    name: 'Research Specialist',
    description: 'In-depth research and documentation',
    keywords: ['research', 'find', 'look up', 'document', 'source', 'reference', 'study'],
    handoffDescription: 'Research specialist for in-depth investigation',
    capabilities: ['research', 'documentation', 'fact-checking', 'source analysis']
  }
};

// Keywords that suggest escalation or specialist need
const ESCALATION_PATTERNS = [
  { pattern: /this is (urgent|critical|important)/i, priority: 'high' },
  { pattern: /need (help|assistance) (immediately|now|asap)/i, priority: 'high' },
  { pattern: /(can't|cannot|unable to) figure out/i, priority: 'medium' },
  { pattern: /been trying for (hours|days)/i, priority: 'medium' },
  { pattern: /previous (agent|assistant) couldn't/i, priority: 'high' }
];

/**
 * AgentHandoffService - Manages agent transitions and routing
 */
class AgentHandoffService {
  private currentAgent: AgentProfile;
  private handoffHistory: HandoffContext[] = [];
  private conversationContext: string[] = [];

  constructor() {
    this.currentAgent = AGENT_PROFILES.general;
  }

  /**
   * Analyze user input and suggest the best agent
   */
  suggestAgent(userInput: string): AgentMode | SpecialistType | null {
    const inputLower = userInput.toLowerCase();

    // Check for explicit handoff requests
    if (inputLower.includes('transfer to') || inputLower.includes('talk to') || inputLower.includes('switch to')) {
      const requestedAgent = this.parseExplicitRequest(inputLower);
      if (requestedAgent) return requestedAgent;
    }

    // Score each agent based on keyword matches
    const scores: { agent: AgentMode | SpecialistType; score: number }[] = [];

    for (const [agentType, profile] of Object.entries(AGENT_PROFILES)) {
      let score = 0;

      for (const keyword of profile.keywords) {
        if (inputLower.includes(keyword)) {
          score += 2; // Direct keyword match
        }
      }

      // Check capability matches
      for (const capability of profile.capabilities) {
        if (inputLower.includes(capability)) {
          score += 1;
        }
      }

      if (score > 0) {
        scores.push({ agent: agentType as AgentMode | SpecialistType, score });
      }
    }

    // Sort by score and return top match
    scores.sort((a, b) => b.score - a.score);

    if (scores.length > 0 && scores[0].score >= 2) {
      return scores[0].agent;
    }

    return null; // No strong match, stay with current agent
  }

  /**
   * Parse explicit agent request from user input
   */
  private parseExplicitRequest(input: string): AgentMode | SpecialistType | null {
    const agentMappings: Record<string, AgentMode | SpecialistType> = {
      // Core agents
      'general': 'general',
      'assistant': 'general',
      'analyst': 'analyst',
      'data': 'analyst',
      'analysis': 'analyst',
      'scribe': 'scribe',
      'notes': 'scribe',
      'document': 'scribe',
      'strategist': 'strategist',
      'strategy': 'strategist',
      'planning': 'strategist',
      // Specialists
      'tech support': 'technical_support',
      'technical support': 'technical_support',
      'creative strategist': 'creative_strategist',
      'data analyst': 'data_analyst',
      'project manager': 'project_manager',
      'pm': 'project_manager',
      'researcher': 'research_specialist',
      'research': 'research_specialist'
    };

    for (const [phrase, agent] of Object.entries(agentMappings)) {
      if (input.includes(phrase)) {
        return agent;
      }
    }

    return null;
  }

  /**
   * Check if escalation is needed based on conversation context
   */
  shouldEscalate(conversationHistory: RealtimeHistoryItem[]): { shouldEscalate: boolean; reason?: string; suggestedAgent?: SpecialistType } {
    // Check recent messages for escalation patterns
    const recentMessages = conversationHistory
      .filter(item => item.type === 'message' && item.role === 'user')
      .slice(-5)
      .map(item => item.content || '');

    for (const message of recentMessages) {
      for (const { pattern, priority } of ESCALATION_PATTERNS) {
        if (pattern.test(message || '')) {
          return {
            shouldEscalate: true,
            reason: `Escalation pattern detected: ${priority} priority`,
            suggestedAgent: this.determineBestSpecialist(recentMessages.join(' '))
          };
        }
      }
    }

    // Check for repeated questions (user asking same thing multiple times)
    if (this.detectRepeatedQuestions(recentMessages)) {
      return {
        shouldEscalate: true,
        reason: 'User appears to be repeating questions - may need specialist help',
        suggestedAgent: 'technical_support'
      };
    }

    return { shouldEscalate: false };
  }

  /**
   * Detect if user is repeating similar questions
   */
  private detectRepeatedQuestions(messages: string[]): boolean {
    if (messages.length < 3) return false;

    const words = new Map<string, number>();
    for (const message of messages) {
      const msgWords = message.toLowerCase().split(/\s+/);
      for (const word of msgWords) {
        if (word.length > 4) { // Ignore short words
          words.set(word, (words.get(word) || 0) + 1);
        }
      }
    }

    // If any significant word appears in 80%+ of messages, user may be repeating
    const threshold = Math.ceil(messages.length * 0.8);
    for (const count of words.values()) {
      if (count >= threshold) return true;
    }

    return false;
  }

  /**
   * Determine the best specialist based on conversation content
   */
  private determineBestSpecialist(conversationContent: string): SpecialistType {
    const specialists: SpecialistType[] = [
      'technical_support',
      'creative_strategist',
      'data_analyst',
      'project_manager',
      'research_specialist'
    ];

    let bestMatch: SpecialistType = 'technical_support';
    let highestScore = 0;

    for (const specialist of specialists) {
      const profile = AGENT_PROFILES[specialist];
      let score = 0;

      for (const keyword of profile.keywords) {
        const regex = new RegExp(keyword, 'gi');
        const matches = conversationContent.match(regex);
        score += matches ? matches.length : 0;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = specialist;
      }
    }

    return bestMatch;
  }

  /**
   * Execute a handoff to a new agent
   */
  async executeHandoff(
    targetAgent: AgentMode | SpecialistType,
    reason: string,
    conversationHistory: RealtimeHistoryItem[]
  ): Promise<HandoffResult> {
    const targetProfile = AGENT_PROFILES[targetAgent];

    if (!targetProfile) {
      return {
        success: false,
        newAgent: this.currentAgent,
        context: {
          fromAgent: this.currentAgent.name,
          toAgent: 'Unknown',
          reason,
          preserveHistory: true
        },
        error: 'Unknown target agent'
      };
    }

    // Create handoff context
    const context: HandoffContext = {
      fromAgent: this.currentAgent.name,
      toAgent: targetProfile.name,
      reason,
      preserveHistory: true,
      conversationSummary: this.summarizeForHandoff(conversationHistory)
    };

    // Store handoff in history
    this.handoffHistory.push(context);

    // Update current agent
    const previousAgent = this.currentAgent;
    this.currentAgent = targetProfile;

    // If it's a core mode (not specialist), update the realtime session
    if (['general', 'analyst', 'scribe', 'strategist'].includes(targetAgent)) {
      try {
        const session = getActiveSession();
        if (session) {
          session.switchAgent(targetAgent);
        }
      } catch (error) {
        console.warn('[AgentHandoff] Could not update realtime session agent:', error);
      }
    }

    return {
      success: true,
      newAgent: targetProfile,
      context
    };
  }

  /**
   * Create a summary of the conversation for handoff
   */
  private summarizeForHandoff(conversationHistory: RealtimeHistoryItem[]): string {
    const messages = conversationHistory
      .filter(item => item.type === 'message')
      .slice(-10); // Last 10 messages

    if (messages.length === 0) {
      return 'New conversation, no prior context.';
    }

    const summary: string[] = [];
    summary.push(`Conversation with ${messages.length} recent messages.`);

    // Extract key topics
    const userMessages = messages
      .filter(m => m.role === 'user')
      .map(m => m.content || '')
      .join(' ');

    const topics = this.extractTopics(userMessages);
    if (topics.length > 0) {
      summary.push(`Key topics: ${topics.join(', ')}`);
    }

    // Last user request
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage?.content) {
      summary.push(`Last request: "${lastUserMessage.content.substring(0, 100)}..."`);
    }

    return summary.join(' ');
  }

  /**
   * Extract key topics from text
   */
  private extractTopics(text: string): string[] {
    const allKeywords = Object.values(AGENT_PROFILES)
      .flatMap(p => p.keywords);

    const found = new Set<string>();
    const textLower = text.toLowerCase();

    for (const keyword of allKeywords) {
      if (textLower.includes(keyword) && keyword.length > 3) {
        found.add(keyword);
      }
    }

    return Array.from(found).slice(0, 5);
  }

  /**
   * Get current agent profile
   */
  getCurrentAgent(): AgentProfile {
    return this.currentAgent;
  }

  /**
   * Get all available agents
   */
  getAvailableAgents(): AgentProfile[] {
    return Object.values(AGENT_PROFILES);
  }

  /**
   * Get handoff history
   */
  getHandoffHistory(): HandoffContext[] {
    return [...this.handoffHistory];
  }

  /**
   * Get agent by type
   */
  getAgent(type: AgentMode | SpecialistType): AgentProfile | undefined {
    return AGENT_PROFILES[type];
  }

  /**
   * Reset to default agent
   */
  reset(): void {
    this.currentAgent = AGENT_PROFILES.general;
    this.handoffHistory = [];
    this.conversationContext = [];
  }
}

// Singleton instance
let serviceInstance: AgentHandoffService | null = null;

export function getAgentHandoffService(): AgentHandoffService {
  if (!serviceInstance) {
    serviceInstance = new AgentHandoffService();
  }
  return serviceInstance;
}

export function resetAgentHandoffService(): void {
  if (serviceInstance) {
    serviceInstance.reset();
    serviceInstance = null;
  }
}

export default AgentHandoffService;
