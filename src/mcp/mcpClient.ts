/**
 * PULSE MCP Client
 *
 * This is the "client" side of MCP - it connects to MCP servers
 * (like our PULSE server or external services) and allows your
 * app to use their tools and resources.
 *
 * Think of it like a remote control that can operate multiple
 * AI-powered services from one place.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * MCPClientManager - Manages connections to MCP servers
 *
 * Use this to connect to external AI services or your own
 * MCP servers and call their tools.
 */
export class MCPClientManager {
  private clients: Map<string, Client> = new Map();

  /**
   * Connect to an MCP server
   *
   * @param name - A friendly name for this connection
   * @param command - The command to start the server
   * @param args - Arguments to pass to the command
   */
  async connect(
    name: string,
    command: string,
    args: string[] = []
  ): Promise<Client> {
    // Create transport to communicate with the server
    const transport = new StdioClientTransport({
      command,
      args,
    });

    // Create and initialize the client
    const client = new Client(
      {
        name: 'pulse-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
    this.clients.set(name, client);

    console.log(`Connected to MCP server: ${name}`);
    return client;
  }

  /**
   * Get a connected client by name
   */
  getClient(name: string): Client | undefined {
    return this.clients.get(name);
  }

  /**
   * List available tools from a server
   */
  async listTools(serverName: string): Promise<string[]> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server "${serverName}" not connected`);
    }

    const result = await client.listTools();
    return result.tools.map((tool) => tool.name);
  }

  /**
   * Call a tool on a connected server
   *
   * @param serverName - Which server to call
   * @param toolName - Name of the tool to call
   * @param args - Arguments to pass to the tool
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server "${serverName}" not connected`);
    }

    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    return result.content;
  }

  /**
   * Read a resource from a server
   */
  async readResource(serverName: string, uri: string): Promise<unknown> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server "${serverName}" not connected`);
    }

    const result = await client.readResource({ uri });
    return result.contents;
  }

  /**
   * Disconnect from a server
   */
  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.close();
      this.clients.delete(name);
      console.log(`Disconnected from: ${name}`);
    }
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    for (const name of this.clients.keys()) {
      await this.disconnect(name);
    }
  }
}

// Create a singleton instance for easy use
export const mcpClient = new MCPClientManager();

/**
 * Example usage in your React app:
 *
 * ```typescript
 * import { mcpClient } from './mcp/mcpClient';
 *
 * // Connect to a server (could be your own or external)
 * await mcpClient.connect('pulse', 'node', ['dist/mcp/mcpServer.js']);
 *
 * // List available tools
 * const tools = await mcpClient.listTools('pulse');
 * console.log('Available tools:', tools);
 *
 * // Call a tool
 * const result = await mcpClient.callTool('pulse', 'send_message', {
 *   channel: 'general',
 *   message: 'Hello from MCP!',
 *   priority: 'normal'
 * });
 * ```
 */
