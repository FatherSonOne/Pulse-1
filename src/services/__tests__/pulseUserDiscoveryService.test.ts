// ============================================
// Unit tests — pulseUserDiscoveryService
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverPulseUsers, PulseUserDiscoveryError } from '../pulseUserDiscoveryService';
import type { DiscoveredPulseUser } from '../pulseUserDiscoveryService';

// Mock the entire supabase module so validateSupabaseConfig() never fires.
// Use vi.hoisted so the variable is available at the hoisted mock factory call site.
const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));
vi.mock('../supabase', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeUser(overrides: Partial<DiscoveredPulseUser> = {}): DiscoveredPulseUser {
  return {
    user_id: 'user-1',
    display_name: 'Alice Tester',
    handle: 'alice',
    avatar_url: null,
    shared_workspace_id: 'ws-abc',
    shared_workspace_role: 'member',
    online_status: 'online',
    already_in_contacts: false,
    joined_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('discoverPulseUsers', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  // Case 1 — happy path: calls RPC with correct args; maps result
  it('calls supabase.rpc with the correct arguments and returns mapped users + cursor', async () => {
    const fakeUser = makeUser({ joined_at: '2026-03-15T12:00:00Z', user_id: 'user-99' });
    mockRpc.mockResolvedValue({ data: [fakeUser], error: null });

    const result = await discoverPulseUsers({
      workspaceId: 'ws-abc',
      query: 'alice',
      limit: 1,
      cursor: 'some-cursor',
    });

    // Verify RPC was called with the correct parameter names
    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith('discover_pulse_users', {
      p_workspace_id: 'ws-abc',
      p_query: 'alice',
      p_limit: 1,
      p_cursor: 'some-cursor',
    });

    // Verify the user is returned as-is (no transformation expected)
    expect(result.users).toHaveLength(1);
    expect(result.users[0]).toEqual(fakeUser);
  });

  // Case 2 — empty results: returns { users: [], nextCursor: null }
  it('returns empty users array and null nextCursor when RPC returns []', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await discoverPulseUsers({ workspaceId: 'ws-abc' });

    expect(result.users).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  // Case 3 — pagination cursor logic
  describe('pagination cursor', () => {
    it('sets nextCursor when result count equals limit', async () => {
      const limit = 2;
      const users = [
        makeUser({ user_id: 'user-1', joined_at: '2026-01-01T00:00:00Z' }),
        makeUser({ user_id: 'user-2', joined_at: '2026-01-02T00:00:00Z' }),
      ];
      mockRpc.mockResolvedValue({ data: users, error: null });

      const result = await discoverPulseUsers({ workspaceId: 'ws-abc', limit });

      expect(result.nextCursor).not.toBeNull();
      // Cursor must be a base64-encoded JSON containing the last user's joined_at + user_id
      const decoded = JSON.parse(atob(result.nextCursor!));
      expect(decoded).toEqual({
        joined_at: users[users.length - 1].joined_at,
        user_id: users[users.length - 1].user_id,
      });
    });

    it('sets nextCursor to null when result count is less than limit', async () => {
      const limit = 10;
      const users = [makeUser({ user_id: 'user-1' }), makeUser({ user_id: 'user-2' })];
      mockRpc.mockResolvedValue({ data: users, error: null });

      const result = await discoverPulseUsers({ workspaceId: 'ws-abc', limit });

      // 2 results < limit 10 → no next page
      expect(result.nextCursor).toBeNull();
    });
  });

  // Case 4 — RPC errors are thrown as PulseUserDiscoveryError
  describe('error handling', () => {
    it('throws PulseUserDiscoveryError with code "unauthenticated" on auth error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'unauthenticated user', code: 'SOME_CODE' },
      });

      await expect(discoverPulseUsers({ workspaceId: 'ws-abc' })).rejects.toMatchObject({
        name: 'PulseUserDiscoveryError',
        code: 'unauthenticated',
      });
    });

    it('throws PulseUserDiscoveryError with code "unauthenticated" on PGRST301', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'some message', code: 'PGRST301' },
      });

      await expect(discoverPulseUsers({ workspaceId: 'ws-abc' })).rejects.toMatchObject({
        name: 'PulseUserDiscoveryError',
        code: 'unauthenticated',
      });
    });

    it('throws PulseUserDiscoveryError with code "forbidden" on permission denied', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'permission denied for table', code: '42501' },
      });

      await expect(discoverPulseUsers({ workspaceId: 'ws-abc' })).rejects.toMatchObject({
        name: 'PulseUserDiscoveryError',
        code: 'forbidden',
      });
    });

    it('throws PulseUserDiscoveryError with code "unexpected" on generic error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'something exploded', code: '99999' },
      });

      await expect(discoverPulseUsers({ workspaceId: 'ws-abc' })).rejects.toMatchObject({
        name: 'PulseUserDiscoveryError',
        code: 'unexpected',
        message: 'something exploded',
      });
    });

    it('throws an instance of PulseUserDiscoveryError (not a plain Error)', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'boom', code: '500' },
      });

      await expect(discoverPulseUsers({ workspaceId: 'ws-abc' })).rejects.toBeInstanceOf(
        PulseUserDiscoveryError,
      );
    });
  });

  // Case 5 — defaults: calling with only workspaceId produces sensible defaults
  it('uses default query=null, limit=50, cursor=null when only workspaceId is supplied', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await discoverPulseUsers({ workspaceId: 'ws-xyz' });

    expect(mockRpc).toHaveBeenCalledWith('discover_pulse_users', {
      p_workspace_id: 'ws-xyz',
      p_query: null,
      p_limit: 50,
      p_cursor: null,
    });
  });
});
