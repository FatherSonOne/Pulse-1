/**
 * PULSE MCP Server
 *
 * This creates an MCP (Model Context Protocol) server that exposes
 * PULSE's capabilities to AI agents. Think of it as a "menu" that
 * tells AI assistants what actions they can take in your app.
 *
 * MCP allows AI agents to:
 * - Call tools (perform actions like sending messages, creating tasks)
 * - Access resources (read data like contacts, messages, calendar)
 * - Use prompts (pre-defined conversation templates)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v4';

// Create the MCP server with metadata about your app
const server = new McpServer({
  name: 'pulse-mcp-server',
  version: '1.0.0',
});

/**
 * TOOLS - Actions that AI can perform
 *
 * Tools are like functions that AI can call. Each tool has:
 * - A name (what to call it)
 * - A description (what it does)
 * - Parameters (what inputs it needs)
 * - A handler (the code that runs)
 */

// Tool 1: Send a message
server.tool(
  'send_message',
  'Send a message to a channel or user in PULSE',
  {
    channel: z.string().describe('The channel or user ID to send to'),
    message: z.string().describe('The message content to send'),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional()
      .describe('Message priority level'),
  },
  async ({ channel, message, priority }) => {
    // In a real implementation, this would call your messageService
    console.log(`Sending message to ${channel}: ${message} (priority: ${priority || 'normal'})`);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Message sent successfully to ${channel}`,
        },
      ],
    };
  }
);

// Tool 2: Create a task
server.tool(
  'create_task',
  'Create a new task in PULSE task management',
  {
    title: z.string().describe('Task title'),
    description: z.string().optional().describe('Task description'),
    assignee: z.string().optional().describe('User ID to assign the task to'),
    dueDate: z.string().optional().describe('Due date in ISO format'),
    priority: z.enum(['low', 'medium', 'high']).optional(),
  },
  async ({ title, assignee, dueDate, priority }) => {
    // In a real implementation, this would call your taskService
    const taskId = `task_${Date.now()}`;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            taskId,
            title,
            assignee,
            dueDate,
            priority: priority || 'medium',
          }),
        },
      ],
    };
  }
);

// Tool 3: Search messages
server.tool(
  'search_messages',
  'Search through messages in PULSE',
  {
    query: z.string().describe('Search query'),
    channel: z.string().optional().describe('Limit search to specific channel'),
    limit: z.number().optional().describe('Maximum results to return'),
  },
  async ({ query, channel }) => {
    // In a real implementation, this would search your message store
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            results: [],
            query,
            channel,
            message: `Search for "${query}" completed`,
          }),
        },
      ],
    };
  }
);

// Tool 4: Get AI summary
server.tool(
  'get_ai_summary',
  'Get an AI-generated summary of a conversation or channel',
  {
    channelId: z.string().describe('Channel ID to summarize'),
    timeframe: z.enum(['today', 'week', 'month']).optional()
      .describe('Time period to summarize'),
  },
  async ({ channelId, timeframe }) => {
    // This would integrate with your Gemini service
    return {
      content: [
        {
          type: 'text' as const,
          text: `Summary for channel ${channelId} (${timeframe || 'today'}): [AI summary would appear here]`,
        },
      ],
    };
  }
);

/**
 * RESOURCES - Read-only data that AI can access
 *
 * Resources are like files or databases that AI can read.
 * They have URIs (like web addresses) that identify them.
 */

// Resource: List of channels
server.resource(
  'channels',
  'pulse://channels',
  async () => {
    // In a real implementation, fetch from your channel store
    return {
      contents: [
        {
          uri: 'pulse://channels',
          mimeType: 'application/json',
          text: JSON.stringify([
            { id: 'general', name: 'General', type: 'public' },
            { id: 'team', name: 'Team', type: 'private' },
            { id: 'announcements', name: 'Announcements', type: 'public' },
          ]),
        },
      ],
    };
  }
);

// Resource: Current user info
server.resource(
  'current-user',
  'pulse://user/current',
  async () => {
    return {
      contents: [
        {
          uri: 'pulse://user/current',
          mimeType: 'application/json',
          text: JSON.stringify({
            id: 'user_1',
            name: 'PULSE User',
            email: 'user@pulse.app',
            role: 'admin',
          }),
        },
      ],
    };
  }
);

/**
 * PROMPTS - Pre-defined conversation templates
 *
 * Prompts help AI assistants have consistent interactions.
 * They're like templates that structure conversations.
 */

server.prompt(
  'daily_standup',
  'Generate a daily standup summary prompt',
  {
    teamName: z.string().describe('Name of the team'),
  },
  async ({ teamName }) => {
    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Please provide a daily standup summary for the ${teamName} team. Include:
1. What was accomplished yesterday
2. What's planned for today
3. Any blockers or concerns

Format the response in a clear, concise manner suitable for a team meeting.`,
          },
        },
      ],
    };
  }
);

server.prompt(
  'message_summary',
  'Summarize recent messages in a channel',
  {
    channelName: z.string().describe('Name of the channel to summarize'),
    timeframe: z.string().optional().describe('Time period (today, week, month)'),
  },
  async ({ channelName, timeframe }) => {
    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Summarize the key discussions and decisions from the ${channelName} channel over the ${timeframe || 'past week'}. Highlight:
- Important decisions made
- Action items assigned
- Key topics discussed
- Any unresolved questions`,
          },
        },
      ],
    };
  }
);

/**
 * Start the server
 *
 * This uses "stdio" transport which means it communicates through
 * standard input/output. This is the simplest way to connect to AI clients.
 */
export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PULSE MCP Server is running...');
}

// Export for testing
export { server };
