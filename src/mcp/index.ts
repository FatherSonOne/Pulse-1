/**
 * PULSE MCP Module
 *
 * This module provides Model Context Protocol (MCP) capabilities
 * for AI agent orchestration in PULSE.
 *
 * What is MCP?
 * MCP is like a "universal adapter" that lets AI assistants (like Claude,
 * GPT, etc.) communicate with your app in a standardized way. Instead of
 * building custom integrations for each AI, you build one MCP interface
 * and any AI that speaks MCP can use it.
 *
 * How it helps PULSE:
 * 1. AI agents can send messages on your behalf
 * 2. AI can search and summarize conversations
 * 3. AI can create tasks and manage workflows
 * 4. External AI tools can integrate with PULSE
 * 5. You can orchestrate multiple AI services together
 */

export { server, startMcpServer } from './mcpServer';
export { MCPClientManager, mcpClient } from './mcpClient';

/**
 * MCP Quick Reference
 *
 * TOOLS (Actions AI can perform):
 * - send_message: Send a message to a channel
 * - create_task: Create a new task
 * - search_messages: Search through messages
 * - get_ai_summary: Get AI-generated summaries
 *
 * RESOURCES (Data AI can read):
 * - pulse://channels: List of all channels
 * - pulse://user/current: Current user info
 *
 * PROMPTS (Conversation templates):
 * - daily_standup: Generate standup summary
 * - message_summary: Summarize channel activity
 */
