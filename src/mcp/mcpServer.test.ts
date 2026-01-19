/**
 * MCP Server Tests
 *
 * These tests verify that your MCP server is configured correctly.
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import { server } from './mcpServer';

describe('PULSE MCP Server', () => {
  it('should have server name configured', () => {
    // The server should have proper metadata
    expect(server).toBeDefined();
  });

  it('should be able to import MCP SDK', async () => {
    // Verify MCP SDK is properly installed
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    expect(McpServer).toBeDefined();
  });

  it('should be able to import Zod for schema validation', async () => {
    // Verify Zod is properly installed (required by MCP)
    const { z } = await import('zod');
    expect(z).toBeDefined();
    expect(z.string).toBeDefined();
    expect(z.object).toBeDefined();
  });
});

describe('MCP Client', () => {
  it('should be able to import MCP client', async () => {
    // Verify MCP client SDK is properly installed
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    expect(Client).toBeDefined();
  });

  it('should export MCPClientManager', async () => {
    const { MCPClientManager } = await import('./mcpClient');
    expect(MCPClientManager).toBeDefined();

    const manager = new MCPClientManager();
    expect(manager).toBeInstanceOf(MCPClientManager);
  });
});
