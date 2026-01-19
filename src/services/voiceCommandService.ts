/**
 * Voice Command Service
 * Parses transcribed speech into actionable commands and executes them
 *
 * Supports commands like:
 * - "Send email to John about the meeting"
 * - "Create task: Review the proposal by Friday"
 * - "Search for messages from Sarah"
 * - "Open calendar"
 * - "Navigate to settings"
 * - "Read my latest emails"
 * - "Schedule meeting with team tomorrow at 3pm"
 */

import { geminiService } from './geminiService';

// ============= TYPES =============

export type VoiceCommandType =
  | 'navigate'
  | 'open_conversation'
  | 'open_contact'
  | 'send_email'
  | 'send_sms'
  | 'create_task'
  | 'create_decision'
  | 'search'
  | 'schedule_meeting'
  | 'read_messages'
  | 'set_reminder'
  | 'add_note'
  | 'open_project'
  | 'toggle_theme'
  | 'open_notifications'
  | 'open_tasks'
  | 'open_add_contact'
  | 'toggle_sidebar'
  | 'dictate'
  | 'help'
  | 'unknown';

export interface VoiceCommand {
  type: VoiceCommandType;
  confidence: number;
  rawTranscript: string;
  parameters: Record<string, any>;
  suggestedAction?: string;
}

export interface VoiceCommandResult {
  success: boolean;
  command: VoiceCommand;
  message: string;
  data?: any;
}

export interface VoiceCommandPattern {
  type: VoiceCommandType;
  patterns: RegExp[];
  extractParams: (match: RegExpMatchArray, transcript: string) => Record<string, any>;
  description: string;
  examples: string[];
}

// ============= COMMAND PATTERNS =============

const COMMAND_PATTERNS: VoiceCommandPattern[] = [
  // Navigation commands
  {
    type: 'navigate',
    patterns: [
      /^(go to|open|show|navigate to|take me to)\s+(.+)$/i,
      /^(open|show)\s+(the\s+)?(.+)$/i,
    ],
    extractParams: (match, transcript) => {
      const destination = match[2] || match[3] || '';
      return { destination: destination.toLowerCase().trim() };
    },
    description: 'Navigate to a section of the app',
    examples: ['Go to settings', 'Open calendar', 'Show messages', 'Navigate to contacts'],
  },

  // Open a conversation with a contact
  {
    type: 'open_conversation',
    patterns: [
      /^(open\s+)?(chat|conversation|thread)\s+(with|to)\s+(.+)$/i,
      /^(message|text|dm)\s+(.+)$/i,
    ],
    extractParams: (match) => {
      const name = (match[4] || match[2] || '').trim();
      return { name };
    },
    description: 'Open a conversation with a specific contact',
    examples: ['Open chat with Sarah', 'Conversation with John', 'Message Alex'],
  },

  // Open a contact profile
  {
    type: 'open_contact',
    patterns: [
      /^(open|show|view)\s+(contact|person)\s+(.+)$/i,
      /^(contact|person)\s+(.+)$/i,
    ],
    extractParams: (match) => {
      const name = (match[3] || match[2] || '').trim();
      return { name };
    },
    description: 'Open a contact in Contacts',
    examples: ['Open contact Sarah', 'Show person John'],
  },

  // Email commands
  {
    type: 'send_email',
    patterns: [
      /^(send|compose|write|draft)\s+(an?\s+)?email\s+(to\s+)?(.+?)(\s+about\s+(.+))?$/i,
      /^email\s+(.+?)(\s+about\s+(.+))?$/i,
    ],
    extractParams: (match, transcript) => {
      const recipient = match[4] || match[1] || '';
      const subject = match[6] || match[3] || '';
      return {
        recipient: recipient.trim(),
        subject: subject.trim(),
        body: '',
      };
    },
    description: 'Compose and send an email',
    examples: ['Send email to John about the meeting', 'Email Sarah about the project update'],
  },

  // SMS commands
  {
    type: 'send_sms',
    patterns: [
      /^(send|text|message)\s+(a\s+)?(text|sms|message)\s+(to\s+)?(.+?)(\s+saying\s+(.+))?$/i,
      /^text\s+(.+?)(\s+saying\s+(.+))?$/i,
    ],
    extractParams: (match, transcript) => {
      const recipient = match[5] || match[1] || '';
      const message = match[7] || match[3] || '';
      return {
        recipient: recipient.trim(),
        message: message.trim(),
      };
    },
    description: 'Send a text message',
    examples: ['Text John saying I\'ll be late', 'Send message to Sarah'],
  },

  // Task commands
  {
    type: 'create_task',
    patterns: [
      /^(create|add|new)\s+(a\s+)?task[:\s]+(.+)$/i,
      /^remind me to\s+(.+)$/i,
      /^(todo|to-do|to do)[:\s]+(.+)$/i,
      /^i need to\s+(.+)$/i,
    ],
    extractParams: (match, transcript) => {
      const title = match[3] || match[1] || match[2] || '';
      // Extract due date if mentioned
      const dueDateMatch = title.match(/\b(by|before|due|until)\s+(\w+(\s+\w+)?)/i);
      const dueDate = dueDateMatch ? dueDateMatch[2] : null;
      // Extract priority
      const priority = /urgent|asap|important|high priority/i.test(title) ? 'high' :
                       /low priority|whenever|someday/i.test(title) ? 'low' : 'medium';
      return {
        title: title.replace(dueDateMatch?.[0] || '', '').trim(),
        dueDate,
        priority,
      };
    },
    description: 'Create a new task',
    examples: ['Create task: Review proposal by Friday', 'Remind me to call John', 'Todo: Buy groceries'],
  },

  // Decision commands
  {
    type: 'create_decision',
    patterns: [
      /^(create|add|new|log)\s+(a\s+)?decision[:\s]+(.+)$/i,
      /^we decided\s+(.+)$/i,
      /^decision[:\s]+(.+)$/i,
    ],
    extractParams: (match, transcript) => ({
      decision: (match[3] || match[1] || '').trim(),
      context: transcript,
    }),
    description: 'Log a decision',
    examples: ['Create decision: Use React for the frontend', 'We decided to postpone the launch'],
  },

  // Search commands
  {
    type: 'search',
    patterns: [
      /^(search|find|look for|look up)\s+(for\s+)?(.+)$/i,
      /^(where is|where are|show me)\s+(.+)$/i,
    ],
    extractParams: (match, transcript) => ({
      query: (match[3] || match[2] || '').trim(),
      scope: 'all',
    }),
    description: 'Search for messages or content',
    examples: ['Search for messages from John', 'Find emails about the project', 'Look up meeting notes'],
  },

  // Toggle theme (dark/light)
  {
    type: 'toggle_theme',
    patterns: [
      /^toggle\s+(dark|light)\s+mode$/i,
      /^(enable|turn on)\s+dark\s+mode$/i,
      /^(disable|turn off)\s+dark\s+mode$/i,
      /^(enable|turn on)\s+light\s+mode$/i,
      /^(disable|turn off)\s+light\s+mode$/i,
      /^toggle\s+theme$/i,
    ],
    extractParams: (_match, transcript) => {
      const t = transcript.toLowerCase();
      const explicit =
        t.includes('dark mode') ? (t.includes('disable') || t.includes('turn off') ? 'light' : 'dark') :
        t.includes('light mode') ? (t.includes('disable') || t.includes('turn off') ? 'dark' : 'light') :
        null;
      return { mode: explicit };
    },
    description: 'Toggle dark/light mode',
    examples: ['Toggle dark mode', 'Enable dark mode', 'Turn off dark mode', 'Toggle theme'],
  },

  // Notifications center
  {
    type: 'open_notifications',
    patterns: [
      /^(open|show)\s+(my\s+)?notifications?$/i,
      /^(open|show)\s+notification\s+center$/i,
    ],
    extractParams: () => ({}),
    description: 'Open the notification center',
    examples: ['Show notifications', 'Open notification center'],
  },

  // Tasks (Calendar task panel)
  {
    type: 'open_tasks',
    patterns: [
      /^(open|show)\s+(my\s+)?tasks$/i,
      /^(open|show)\s+task\s+panel$/i,
      /^task\s+list$/i,
    ],
    extractParams: () => ({}),
    description: 'Open tasks (Calendar task panel)',
    examples: ['Open tasks', 'Show task panel', 'Task list'],
  },

  // Add contact
  {
    type: 'open_add_contact',
    patterns: [
      /^(add|create|new)\s+(a\s+)?contact$/i,
      /^add\s+someone$/i,
    ],
    extractParams: () => ({}),
    description: 'Open Add Contact in Contacts',
    examples: ['Add contact', 'New contact', 'Add someone'],
  },

  // Sidebar collapse/expand
  {
    type: 'toggle_sidebar',
    patterns: [
      /^(collapse|minimize)\s+(the\s+)?sidebar$/i,
      /^(expand|open)\s+(the\s+)?sidebar$/i,
      /^toggle\s+sidebar$/i,
    ],
    extractParams: (_match, transcript) => {
      const t = transcript.toLowerCase();
      const action =
        t.includes('collapse') || t.includes('minimize') ? 'collapse' :
        t.includes('expand') || t.includes('open') ? 'expand' :
        'toggle';
      return { action };
    },
    description: 'Collapse/expand the sidebar',
    examples: ['Collapse sidebar', 'Expand sidebar', 'Toggle sidebar'],
  },

  // Schedule meeting
  {
    type: 'schedule_meeting',
    patterns: [
      /^(schedule|create|set up|book)\s+(a\s+)?meeting\s+(with\s+)?(.+?)(\s+(at|for|on)\s+(.+))?$/i,
      /^meeting\s+(with\s+)?(.+?)(\s+(at|for|on)\s+(.+))?$/i,
    ],
    extractParams: (match, transcript) => {
      const participants = match[4] || match[2] || '';
      const timeInfo = match[7] || match[5] || '';
      return {
        participants: participants.split(/,|and/).map((p: string) => p.trim()),
        time: timeInfo.trim(),
        title: `Meeting with ${participants}`,
      };
    },
    description: 'Schedule a calendar meeting',
    examples: ['Schedule meeting with John tomorrow at 3pm', 'Book meeting with the team for Friday'],
  },

  // Read messages
  {
    type: 'read_messages',
    patterns: [
      /^read\s+(my\s+)?(latest|new|unread|recent)\s+(emails?|messages?|texts?)$/i,
      /^(what are|show me)\s+(my\s+)?(latest|new|unread)\s+(emails?|messages?)$/i,
      /^(check|show)\s+(my\s+)?(inbox|messages?|emails?)$/i,
    ],
    extractParams: (match, transcript) => {
      const type = /email/i.test(transcript) ? 'email' :
                   /text|sms/i.test(transcript) ? 'sms' : 'all';
      const filter = /unread/i.test(transcript) ? 'unread' :
                     /latest|recent|new/i.test(transcript) ? 'latest' : 'all';
      return { type, filter, limit: 5 };
    },
    description: 'Read recent messages aloud',
    examples: ['Read my latest emails', 'Check my inbox', 'Show me new messages'],
  },

  // Set reminder
  {
    type: 'set_reminder',
    patterns: [
      /^(set|create)\s+(a\s+)?reminder\s+(for\s+|to\s+)?(.+?)(\s+(at|in|on)\s+(.+))?$/i,
      /^remind me\s+(about\s+)?(.+?)(\s+(at|in|on)\s+(.+))?$/i,
    ],
    extractParams: (match, transcript) => ({
      reminder: (match[4] || match[2] || '').trim(),
      time: (match[7] || match[5] || '').trim(),
    }),
    description: 'Set a reminder',
    examples: ['Set reminder for the meeting at 2pm', 'Remind me about the call in 30 minutes'],
  },

  // Add note
  {
    type: 'add_note',
    patterns: [
      /^(add|create|new)\s+(a\s+)?note[:\s]+(.+)$/i,
      /^note[:\s]+(.+)$/i,
      /^take note[:\s]+(.+)$/i,
    ],
    extractParams: (match, transcript) => ({
      content: (match[3] || match[1] || '').trim(),
    }),
    description: 'Add a quick note',
    examples: ['Add note: Important meeting insights', 'Note: Follow up with client'],
  },

  // Open project
  {
    type: 'open_project',
    patterns: [
      /^(open|show|go to)\s+(project\s+)?["']?(.+?)["']?(\s+project)?$/i,
      /^project\s+["']?(.+?)["']?$/i,
    ],
    extractParams: (match, transcript) => ({
      projectName: (match[3] || match[1] || '').trim(),
    }),
    description: 'Open a War Room project',
    examples: ['Open project Marketing Campaign', 'Go to Research project'],
  },

  // Dictation mode
  {
    type: 'dictate',
    patterns: [
      /^(start\s+)?dictation$/i,
      /^dictate$/i,
      /^start dictating$/i,
    ],
    extractParams: () => ({ mode: 'continuous' }),
    description: 'Start continuous dictation mode',
    examples: ['Start dictation', 'Dictate'],
  },

  // Help
  {
    type: 'help',
    patterns: [
      /^help$/i,
      /^what can (you|i)\s+(do|say)$/i,
      /^(show\s+)?voice commands?$/i,
    ],
    extractParams: () => ({}),
    description: 'Show available voice commands',
    examples: ['Help', 'What can I say', 'Show voice commands'],
  },
];

// ============= NAVIGATION MAPPING =============

const NAVIGATION_MAP: Record<string, string> = {
  'dashboard': 'DASHBOARD',
  'home': 'DASHBOARD',
  'messages': 'MESSAGES',
  'email': 'EMAIL',
  'emails': 'EMAIL',
  'inbox': 'EMAIL',
  'sms': 'SMS',
  'text': 'SMS',
  'texts': 'SMS',
  'calendar': 'CALENDAR',
  'meetings': 'MEETINGS',
  'contacts': 'CONTACTS',
  'people': 'CONTACTS',
  'war room': 'LIVE_AI',
  'warroom': 'LIVE_AI',
  'projects': 'LIVE_AI',
  'ai': 'LIVE_AI',
  'pulse chat': 'LIVE',
  'chat': 'LIVE',
  'search': 'MULTI_MODAL',
  'ai lab': 'TOOLS',
  'tools': 'TOOLS',
  'lab': 'TOOLS',
  'archives': 'ARCHIVES',
  'archive': 'ARCHIVES',
  'settings': 'SETTINGS',
  'preferences': 'SETTINGS',
  'analytics': 'ANALYTICS',
  'stats': 'ANALYTICS',
  'statistics': 'ANALYTICS',
  'voxer': 'VOXER',
  'tasks': 'CALENDAR',
  'task panel': 'CALENDAR',
  'notifications': 'DASHBOARD',
  'notification center': 'DASHBOARD',
  'admin': 'MESSAGE_ADMIN',
  'message admin': 'MESSAGE_ADMIN',
  'message analytics': 'MESSAGE_ANALYTICS',
};

// ============= SERVICE CLASS =============

class VoiceCommandService {
  private commandHistory: VoiceCommand[] = [];
  private listeners: Map<string, ((result: VoiceCommandResult) => void)[]> = new Map();

  /**
   * Parse transcript into a command
   */
  parseCommand(transcript: string): VoiceCommand {
    const cleanTranscript = transcript.trim();

    // Try each pattern
    for (const pattern of COMMAND_PATTERNS) {
      for (const regex of pattern.patterns) {
        const match = cleanTranscript.match(regex);
        if (match) {
          const params = pattern.extractParams(match, cleanTranscript);
          const command: VoiceCommand = {
            type: pattern.type,
            confidence: 0.9,
            rawTranscript: cleanTranscript,
            parameters: params,
            suggestedAction: this.getSuggestedAction(pattern.type, params),
          };
          this.commandHistory.push(command);
          return command;
        }
      }
    }

    // No pattern matched - return unknown
    return {
      type: 'unknown',
      confidence: 0.3,
      rawTranscript: cleanTranscript,
      parameters: { text: cleanTranscript },
      suggestedAction: 'Could not understand command. Try saying "help" for available commands.',
    };
  }

  /**
   * Parse command using AI for more natural language understanding
   */
  async parseCommandWithAI(transcript: string, openaiApiKey?: string): Promise<VoiceCommand> {
    // First try rule-based parsing
    const ruleBasedCommand = this.parseCommand(transcript);
    if (ruleBasedCommand.type !== 'unknown' && ruleBasedCommand.confidence > 0.8) {
      return ruleBasedCommand;
    }

    const prompt = `Parse this voice command and extract the intent and parameters.

Voice command: "${transcript}"

Available command types:
- navigate: Go to a section (dashboard, messages, email, calendar, etc.)
- open_conversation: Open messages with a contact (needs name)
- open_contact: Open a contact in Contacts (needs name)
- send_email: Compose an email (needs recipient, optionally subject)
- send_sms: Send a text message (needs recipient, optionally message)
- create_task: Create a task/todo (needs title, optionally due date, priority)
- create_decision: Log a decision
- search: Search for content
- schedule_meeting: Schedule a calendar meeting
- read_messages: Read recent messages
- set_reminder: Set a reminder
- add_note: Add a note
- open_project: Open a War Room project
- toggle_theme: Toggle dark/light mode
- open_notifications: Open notification center
- open_tasks: Open tasks panel
- open_add_contact: Open add-contact flow
- toggle_sidebar: Collapse/expand sidebar
- dictate: Start dictation mode
- help: Show help

Return JSON with this structure:
{
  "type": "command_type",
  "confidence": 0.0-1.0,
  "parameters": { ... relevant parameters ... },
  "suggestedAction": "Human-readable description of what will happen"
}

If unclear, use type "unknown" with low confidence.`;

    // Try OpenAI first if key is available
    if (openaiApiKey) {
      try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a voice command parser. Return only valid JSON.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 200,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          const jsonMatch = content?.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              type: parsed.type || 'unknown',
              confidence: parsed.confidence || 0.5,
              rawTranscript: transcript,
              parameters: parsed.parameters || {},
              suggestedAction: parsed.suggestedAction,
            };
          }
        }
      } catch (error) {
        console.warn('OpenAI command parsing failed, using rule-based:', error);
        // Skip Gemini fallback to prevent further delays - use rule-based directly
        return ruleBasedCommand;
      }
    }

    // Fall back to Gemini
    try {
      const response = await geminiService.chat(prompt, { temperature: 0.1 });

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: parsed.type || 'unknown',
          confidence: parsed.confidence || 0.5,
          rawTranscript: transcript,
          parameters: parsed.parameters || {},
          suggestedAction: parsed.suggestedAction,
        };
      }
    } catch (error) {
      console.warn('Gemini command parsing failed, using rule-based:', error);
    }

    // Return rule-based result if all AI fails
    return ruleBasedCommand;
  }

  /**
   * Execute a parsed command
   */
  async executeCommand(command: VoiceCommand): Promise<VoiceCommandResult> {
    const handlers = this.listeners.get(command.type) || [];
    const globalHandlers = this.listeners.get('*') || [];

    const result: VoiceCommandResult = {
      success: false,
      command,
      message: '',
    };

    // Special handling for some commands
    switch (command.type) {
      case 'navigate':
        const destinationRaw = String(command.parameters.destination || '');
        const destination = destinationRaw
          .toLowerCase()
          .replace(/^the\s+/, '')
          .replace(/^my\s+/, '')
          .trim();

        // Direct match, then fuzzy match (contains)
        let appView = NAVIGATION_MAP[destination];
        if (!appView) {
          const key = Object.keys(NAVIGATION_MAP).find(k => destination.includes(k));
          if (key) appView = NAVIGATION_MAP[key];
        }
        if (appView) {
          result.success = true;
          result.message = `Navigating to ${destination}`;
          result.data = { view: appView };
        } else {
          result.message = `Unknown destination: ${destination}`;
        }
        break;

      case 'search':
        result.success = true;
        result.message = `Searching for "${command.parameters.query || ''}"`;
        result.data = { view: 'MULTI_MODAL', query: command.parameters.query || '' };
        break;

      case 'open_notifications':
        result.success = true;
        result.message = 'Opening notifications';
        result.data = { action: { type: 'open_notifications' } };
        break;

      case 'toggle_theme':
        result.success = true;
        result.message = 'Toggling theme';
        result.data = { action: { type: 'toggle_theme', mode: command.parameters.mode || null } };
        break;

      case 'open_tasks':
        result.success = true;
        result.message = 'Opening tasks';
        result.data = { action: { type: 'open_tasks' } };
        break;

      case 'open_add_contact':
        result.success = true;
        result.message = 'Opening add contact';
        result.data = { action: { type: 'open_add_contact' } };
        break;

      case 'toggle_sidebar':
        result.success = true;
        result.message = 'Updating sidebar';
        result.data = { action: { type: 'toggle_sidebar', action: command.parameters.action || 'toggle' } };
        break;

      case 'open_conversation':
        result.success = true;
        result.message = `Opening conversation with ${command.parameters.name || 'contact'}`;
        result.data = { action: { type: 'open_conversation', name: command.parameters.name || '' } };
        break;

      case 'open_contact':
        result.success = true;
        result.message = `Opening contact ${command.parameters.name || ''}`;
        result.data = { action: { type: 'open_contact', name: command.parameters.name || '' } };
        break;

      case 'help':
        result.success = true;
        result.message = 'Here are the available voice commands';
        result.data = { commands: this.getAvailableCommands() };
        break;

      default:
        // Let registered handlers process the command
        if (handlers.length > 0 || globalHandlers.length > 0) {
          result.success = true;
          result.message = command.suggestedAction || `Executing ${command.type} command`;
        } else {
          result.message = `No handler registered for ${command.type} command`;
        }
    }

    // Notify all handlers
    [...handlers, ...globalHandlers].forEach(handler => {
      try {
        handler(result);
      } catch (error) {
        console.error('Command handler error:', error);
      }
    });

    return result;
  }

  /**
   * Register a command handler
   */
  onCommand(
    type: VoiceCommandType | '*',
    handler: (result: VoiceCommandResult) => void
  ): () => void {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);

    // Return unsubscribe function
    return () => {
      const current = this.listeners.get(type) || [];
      this.listeners.set(type, current.filter(h => h !== handler));
    };
  }

  /**
   * Get suggested action text for a command
   */
  private getSuggestedAction(type: VoiceCommandType, params: Record<string, any>): string {
    switch (type) {
      case 'navigate':
        return `Navigate to ${params.destination}`;
      case 'open_conversation':
        return `Open conversation with ${params.name}`;
      case 'open_contact':
        return `Open contact ${params.name}`;
      case 'send_email':
        return `Compose email to ${params.recipient}${params.subject ? ` about ${params.subject}` : ''}`;
      case 'send_sms':
        return `Send text to ${params.recipient}`;
      case 'create_task':
        return `Create task: ${params.title}`;
      case 'create_decision':
        return `Log decision: ${params.decision}`;
      case 'search':
        return `Search for "${params.query}"`;
      case 'schedule_meeting':
        return `Schedule meeting with ${params.participants?.join(', ')}${params.time ? ` at ${params.time}` : ''}`;
      case 'read_messages':
        return `Read ${params.filter} ${params.type} messages`;
      case 'set_reminder':
        return `Set reminder: ${params.reminder}${params.time ? ` at ${params.time}` : ''}`;
      case 'add_note':
        return `Add note: ${params.content}`;
      case 'open_project':
        return `Open project: ${params.projectName}`;
      case 'toggle_theme':
        return params.mode ? `Switch to ${params.mode} mode` : 'Toggle theme';
      case 'open_notifications':
        return 'Open notifications';
      case 'open_tasks':
        return 'Open tasks';
      case 'open_add_contact':
        return 'Add a contact';
      case 'toggle_sidebar':
        return 'Toggle sidebar';
      case 'dictate':
        return 'Start continuous dictation';
      case 'help':
        return 'Show available voice commands';
      default:
        return 'Unknown command';
    }
  }

  /**
   * Get list of available commands with examples
   */
  getAvailableCommands(): Array<{ type: VoiceCommandType; description: string; examples: string[] }> {
    return COMMAND_PATTERNS.map(pattern => ({
      type: pattern.type,
      description: pattern.description,
      examples: pattern.examples,
    }));
  }

  /**
   * Get command history
   */
  getHistory(limit: number = 10): VoiceCommand[] {
    return this.commandHistory.slice(-limit);
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
  }

  /**
   * Speak text using speech synthesis
   */
  speak(text: string, options?: { rate?: number; pitch?: number; voice?: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options?.rate || 1;
      utterance.pitch = options?.pitch || 1;

      if (options?.voice) {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v =>
          v.name.toLowerCase().includes(options.voice!.toLowerCase())
        );
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(event.error));

      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Stop any ongoing speech
   */
  stopSpeaking(): void {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Get available voices
   */
  getVoices(): SpeechSynthesisVoice[] {
    if (!window.speechSynthesis) return [];
    return window.speechSynthesis.getVoices();
  }
}

export const voiceCommandService = new VoiceCommandService();
export default voiceCommandService;
