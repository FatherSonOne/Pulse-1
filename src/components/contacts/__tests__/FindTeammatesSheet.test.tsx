// ============================================
// Unit tests — FindTeammatesSheet
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindTeammatesSheet } from '../FindTeammatesSheet';
import type { DiscoveredPulseUser } from '../../../services/pulseUserDiscoveryService';

// ------------------------------------------------------------------
// Mock pulseUserDiscoveryService — isolate component from network/RPC
// ------------------------------------------------------------------
const mockDiscoverPulseUsers = vi.fn();
vi.mock('../../../services/pulseUserDiscoveryService', () => ({
  discoverPulseUsers: (...args: unknown[]) => mockDiscoverPulseUsers(...args),
  PulseUserDiscoveryError: class PulseUserDiscoveryError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = 'PulseUserDiscoveryError';
      this.code = code;
    }
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

const DEFAULT_PROPS = {
  isOpen: true,
  onClose: vi.fn(),
  workspaceId: 'ws-abc',
  onAdd: vi.fn(),
};

function renderSheet(props: Partial<typeof DEFAULT_PROPS> = {}) {
  const merged = { ...DEFAULT_PROPS, ...props };
  return render(<FindTeammatesSheet {...merged} />);
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('FindTeammatesSheet', () => {
  beforeEach(() => {
    mockDiscoverPulseUsers.mockReset();
    DEFAULT_PROPS.onClose.mockReset();
    DEFAULT_PROPS.onAdd.mockReset();
  });

  // Case 1 — renders nothing when isOpen={false}
  it('renders nothing when isOpen is false', () => {
    // Service should not be called because the effect bails early when !isOpen
    mockDiscoverPulseUsers.mockResolvedValue({ users: [], nextCursor: null });

    const { container } = renderSheet({ isOpen: false });

    expect(container).toBeEmptyDOMElement();
    expect(mockDiscoverPulseUsers).not.toHaveBeenCalled();
  });

  // Case 2 — loading state: skeleton rows render while the service is pending
  it('renders skeleton rows while data is loading', async () => {
    // Never resolve so the component stays in loading state during the assertion
    mockDiscoverPulseUsers.mockReturnValue(new Promise(() => {}));

    renderSheet();

    // The loading list has aria-busy="true"
    const loadingList = await screen.findByRole('list', { hidden: false });
    expect(loadingList).toHaveAttribute('aria-busy', 'true');

    // Exactly 3 skeleton items (SKELETON_COUNT = 3)
    const skeletonItems = loadingList.querySelectorAll('li');
    expect(skeletonItems).toHaveLength(3);
  });

  // Case 3 — loaded with results: user rows with display_name visible
  it('renders user rows with display_name when service returns users', async () => {
    const users = [
      makeUser({ user_id: 'u-1', display_name: 'Alice Tester' }),
      makeUser({ user_id: 'u-2', display_name: 'Bob Builder' }),
      makeUser({ user_id: 'u-3', display_name: 'Carol Dancer' }),
    ];
    mockDiscoverPulseUsers.mockResolvedValue({ users, nextCursor: null });

    renderSheet();

    await screen.findByText('Alice Tester');
    expect(screen.getByText('Bob Builder')).toBeInTheDocument();
    expect(screen.getByText('Carol Dancer')).toBeInTheDocument();
  });

  // Case 4 — empty results: "Invite a teammate" CTA renders
  it('renders "Invite a teammate" CTA when service returns zero users', async () => {
    mockDiscoverPulseUsers.mockResolvedValue({ users: [], nextCursor: null });

    renderSheet();

    const cta = await screen.findByRole('button', { name: /invite a teammate/i });
    expect(cta).toBeInTheDocument();
  });

  // Case 5 — error state: error message + retry button render
  describe('error state', () => {
    it('renders error message and "Try again" button when service throws unexpected error', async () => {
      mockDiscoverPulseUsers.mockRejectedValue(new Error('Server exploded'));

      renderSheet();

      await screen.findByText(/something went wrong/i);
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('renders forbidden message (no retry button) when service throws with code "forbidden"', async () => {
      const { PulseUserDiscoveryError } = await import('../../../services/pulseUserDiscoveryService');
      mockDiscoverPulseUsers.mockRejectedValue(new PulseUserDiscoveryError('forbidden', 'forbidden'));

      renderSheet();

      await screen.findByText(/don't have access/i);
      // Forbidden state has no retry button — just a static message
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('renders network error message and "Try again" button when service throws with code "network"', async () => {
      // The component maps unauthenticated/network/unexpected → forbidden/network/unexpected in state
      // A plain Error (not PulseUserDiscoveryError) maps to code: 'unexpected'
      // which shows the "Something went wrong" screen with "Try again"
      mockDiscoverPulseUsers.mockRejectedValue(new Error('Network timeout'));

      renderSheet();

      await screen.findByText(/something went wrong/i);
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  // Case 6 — onAdd callback: click "Add" button calls onAdd(user)
  it('calls onAdd with the correct user when the Add button is clicked', async () => {
    const user = makeUser({ user_id: 'u-1', display_name: 'Alice Tester' });
    mockDiscoverPulseUsers.mockResolvedValue({ users: [user], nextCursor: null });
    DEFAULT_PROPS.onAdd.mockResolvedValue(undefined);

    renderSheet();

    const addButton = await screen.findByRole('button', { name: /add alice tester/i });
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(DEFAULT_PROPS.onAdd).toHaveBeenCalledOnce();
      expect(DEFAULT_PROPS.onAdd).toHaveBeenCalledWith(user);
    });
  });

  it('marks user as added after onAdd resolves (shows "Added" text, not button)', async () => {
    const user = makeUser({ user_id: 'u-1', display_name: 'Alice Tester' });
    mockDiscoverPulseUsers.mockResolvedValue({ users: [user], nextCursor: null });
    DEFAULT_PROPS.onAdd.mockResolvedValue(undefined);

    renderSheet();

    const addButton = await screen.findByRole('button', { name: /add alice tester/i });
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /add alice tester/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText('Added')).toBeInTheDocument();
  });

  // Case 7 — onClose callback: pressing Escape calls onClose
  it('calls onClose when Escape key is pressed', async () => {
    mockDiscoverPulseUsers.mockResolvedValue({ users: [], nextCursor: null });

    renderSheet();

    // Wait for the sheet to mount (any element rendered)
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(DEFAULT_PROPS.onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop (presentation layer) is clicked', async () => {
    mockDiscoverPulseUsers.mockResolvedValue({ users: [], nextCursor: null });

    renderSheet();

    await screen.findByRole('dialog');

    // The presentation div is the outer backdrop
    const backdrop = document.querySelector('[role="presentation"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(DEFAULT_PROPS.onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the close (X) button is clicked', async () => {
    mockDiscoverPulseUsers.mockResolvedValue({ users: [], nextCursor: null });

    renderSheet();

    const closeButton = await screen.findByRole('button', { name: /close/i });
    await userEvent.click(closeButton);

    expect(DEFAULT_PROPS.onClose).toHaveBeenCalled();
  });
});
