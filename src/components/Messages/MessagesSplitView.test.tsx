/**
 * MessagesSplitView Test Suite
 * Tests keyboard shortcuts, responsive behavior, and accessibility
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MessagesSplitView from './MessagesSplitView';
import { MessageChannel, ChannelMessage } from '../../types/messages';

// Mock data
const mockChannels: MessageChannel[] = [
  {
    id: 'channel-1',
    workspace_id: 'workspace-1',
    name: 'General',
    description: 'General discussion',
    is_public: true,
    is_group: true,
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-19T00:00:00Z',
    unread_count: 2,
    last_message: 'Hello everyone!',
    last_message_at: '2026-01-19T12:00:00Z'
  },
  {
    id: 'channel-2',
    workspace_id: 'workspace-1',
    name: 'Engineering',
    description: 'Engineering team',
    is_public: false,
    is_group: true,
    created_by: 'user-1',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-19T00:00:00Z',
    unread_count: 0,
    last_message: 'Bug fix deployed',
    last_message_at: '2026-01-19T11:00:00Z'
  },
  {
    id: 'channel-3',
    workspace_id: 'workspace-1',
    name: 'Design',
    description: 'Design team',
    is_public: false,
    is_group: true,
    created_by: 'user-1',
    created_at: '2026-01-03T00:00:00Z',
    updated_at: '2026-01-19T00:00:00Z',
    unread_count: 5,
    last_message: 'New mockups ready',
    last_message_at: '2026-01-19T10:00:00Z'
  }
];

const mockMessages: Record<string, ChannelMessage[]> = {
  'channel-1': [
    {
      id: 'msg-1',
      channel_id: 'channel-1',
      sender_id: 'user-2',
      sender_name: 'John Doe',
      content: 'Hello everyone!',
      message_type: 'text',
      created_at: '2026-01-19T12:00:00Z',
      is_pinned: false
    },
    {
      id: 'msg-2',
      channel_id: 'channel-1',
      sender_id: 'user-1',
      sender_name: 'Current User',
      content: 'Hi John!',
      message_type: 'text',
      created_at: '2026-01-19T12:01:00Z',
      is_pinned: false
    }
  ],
  'channel-2': [
    {
      id: 'msg-3',
      channel_id: 'channel-2',
      sender_id: 'user-3',
      sender_name: 'Jane Smith',
      content: 'Bug fix deployed',
      message_type: 'text',
      created_at: '2026-01-19T11:00:00Z',
      is_pinned: false
    }
  ]
};

describe('MessagesSplitView', () => {
  const defaultProps = {
    channels: mockChannels,
    messages: mockMessages,
    currentUserId: 'user-1'
  };

  beforeEach(() => {
    // Reset window size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    });
  });

  describe('Rendering', () => {
    test('renders thread list panel', () => {
      render(<MessagesSplitView {...defaultProps} />);
      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search threads...')).toBeInTheDocument();
    });

    test('renders all channels', () => {
      render(<MessagesSplitView {...defaultProps} />);
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    test('shows unread badges', () => {
      render(<MessagesSplitView {...defaultProps} />);
      expect(screen.getByText('2')).toBeInTheDocument(); // General unread count
      expect(screen.getByText('5')).toBeInTheDocument(); // Design unread count
    });

    test('auto-selects first channel', async () => {
      render(<MessagesSplitView {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
      });
    });
  });

  describe('Thread Selection', () => {
    test('selects thread on click', async () => {
      render(<MessagesSplitView {...defaultProps} />);

      const engineeringThread = screen.getByText('Engineering');
      fireEvent.click(engineeringThread);

      await waitFor(() => {
        expect(screen.getByText('Bug fix deployed')).toBeInTheDocument();
      });
    });

    test('highlights active thread', async () => {
      render(<MessagesSplitView {...defaultProps} />);

      const generalThread = screen.getByText('General').closest('.thread-item');
      await waitFor(() => {
        expect(generalThread).toHaveClass('active');
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    test('Ctrl+] navigates to next thread', async () => {
      render(<MessagesSplitView {...defaultProps} />);

      // Wait for first channel to be selected
      await waitFor(() => {
        expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
      });

      // Press Ctrl+]
      fireEvent.keyDown(document, { key: ']', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByText('Bug fix deployed')).toBeInTheDocument();
      });
    });

    test('Ctrl+[ navigates to previous thread', async () => {
      render(<MessagesSplitView {...defaultProps} />);

      // Wait for first channel to be selected
      await waitFor(() => {
        expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
      });

      // Press Ctrl+] to go to second thread
      fireEvent.keyDown(document, { key: ']', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByText('Bug fix deployed')).toBeInTheDocument();
      });

      // Press Ctrl+[ to go back
      fireEvent.keyDown(document, { key: '[', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
      });
    });

    test('Ctrl+J focuses search input', () => {
      render(<MessagesSplitView {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search threads...') as HTMLInputElement;
      expect(document.activeElement).not.toBe(searchInput);

      // Press Ctrl+J
      fireEvent.keyDown(document, { key: 'j', ctrlKey: true });

      expect(document.activeElement).toBe(searchInput);
    });

    test('Escape clears search', async () => {
      render(<MessagesSplitView {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search threads...') as HTMLInputElement;

      // Type in search
      fireEvent.change(searchInput, { target: { value: 'Engineering' } });
      expect(searchInput.value).toBe('Engineering');

      // Focus the input
      searchInput.focus();

      // Press Escape
      fireEvent.keyDown(searchInput, { key: 'Escape' });

      await waitFor(() => {
        expect(searchInput.value).toBe('');
      });
    });

    test('? toggles keyboard shortcuts help', () => {
      render(<MessagesSplitView {...defaultProps} />);

      expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();

      // Press ?
      fireEvent.keyDown(document, { key: '?' });

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();

      // Press ? again
      fireEvent.keyDown(document, { key: '?' });

      expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    test('filters threads by name', () => {
      render(<MessagesSplitView {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search threads...');
      fireEvent.change(searchInput, { target: { value: 'Engineering' } });

      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.queryByText('General')).not.toBeInTheDocument();
      expect(screen.queryByText('Design')).not.toBeInTheDocument();
    });

    test('filters threads by description', () => {
      render(<MessagesSplitView {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search threads...');
      fireEvent.change(searchInput, { target: { value: 'discussion' } });

      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
    });

    test('shows empty state when no results', () => {
      render(<MessagesSplitView {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search threads...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('No threads found')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    test('shows both panels on desktop', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024
      });

      render(<MessagesSplitView {...defaultProps} />);

      const container = document.querySelector('.messages-split-view');
      expect(container).not.toHaveClass('show-threads');
      expect(container).not.toHaveClass('show-conversation');
    });

    test('shows single panel on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      render(<MessagesSplitView {...defaultProps} />);

      const container = document.querySelector('.messages-split-view');
      expect(container).toHaveClass('show-threads');
    });
  });

  describe('Accessibility', () => {
    test('thread items have proper ARIA attributes', () => {
      render(<MessagesSplitView {...defaultProps} />);

      const threadItem = screen.getByLabelText('Thread: General');
      expect(threadItem).toHaveAttribute('role', 'button');
      expect(threadItem).toHaveAttribute('tabIndex', '0');
    });

    test('search input has ARIA label', () => {
      render(<MessagesSplitView {...defaultProps} />);

      const searchInput = screen.getByLabelText('Search threads');
      expect(searchInput).toBeInTheDocument();
    });

    test('active thread has aria-current', async () => {
      render(<MessagesSplitView {...defaultProps} />);

      await waitFor(() => {
        const activeThread = screen.getByLabelText('Thread: General');
        expect(activeThread).toHaveAttribute('aria-current', 'true');
      });
    });

    test('keyboard navigation works with Enter key', async () => {
      render(<MessagesSplitView {...defaultProps} />);

      const engineeringThread = screen.getByLabelText('Thread: Engineering');
      fireEvent.keyDown(engineeringThread, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Bug fix deployed')).toBeInTheDocument();
      });
    });

    test('keyboard navigation works with Space key', async () => {
      render(<MessagesSplitView {...defaultProps} />);

      const engineeringThread = screen.getByLabelText('Thread: Engineering');
      fireEvent.keyDown(engineeringThread, { key: ' ' });

      await waitFor(() => {
        expect(screen.getByText('Bug fix deployed')).toBeInTheDocument();
      });
    });
  });

  describe('Message Display', () => {
    test('groups messages by date', async () => {
      render(<MessagesSplitView {...defaultProps} />);

      await waitFor(() => {
        const dateLabel = screen.getByText(/January 19, 2026/);
        expect(dateLabel).toBeInTheDocument();
      });
    });

    test('shows sender name for other users', async () => {
      render(<MessagesSplitView {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    test('differentiates own messages from others', async () => {
      render(<MessagesSplitView {...defaultProps} />);

      await waitFor(() => {
        const johnMessage = screen.getByText('Hello everyone!').closest('.message-bubble');
        const ownMessage = screen.getByText('Hi John!').closest('.message-bubble');

        expect(johnMessage).not.toHaveClass('bg-blue-500');
        expect(ownMessage).toHaveClass('bg-blue-500');
      });
    });
  });

  describe('Loading States', () => {
    test('shows loading spinner when loading', () => {
      render(<MessagesSplitView {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Loading messages...')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    test('shows empty state when no channels', () => {
      render(<MessagesSplitView {...defaultProps} channels={[]} />);

      expect(screen.getByText('No threads yet')).toBeInTheDocument();
    });

    test('shows empty state when no messages', () => {
      render(<MessagesSplitView {...defaultProps} messages={{}} />);

      expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });

    test('shows select channel prompt when no channel selected', () => {
      const { rerender } = render(<MessagesSplitView {...defaultProps} />);

      // Force no channel selection by clearing channels temporarily
      rerender(<MessagesSplitView {...defaultProps} channels={[]} />);

      expect(screen.getByText('Select a thread')).toBeInTheDocument();
    });
  });
});

describe('Keyboard Shortcuts Integration', () => {
  test('all shortcuts work together', async () => {
    const { container } = render(
      <MessagesSplitView
        channels={mockChannels}
        messages={mockMessages}
        currentUserId="user-1"
      />
    );

    // 1. Jump to search (Ctrl+J)
    fireEvent.keyDown(document, { key: 'j', ctrlKey: true });
    const searchInput = screen.getByPlaceholderText('Search threads...') as HTMLInputElement;
    expect(document.activeElement).toBe(searchInput);

    // 2. Type search query
    fireEvent.change(searchInput, { target: { value: 'Engineering' } });
    expect(screen.getByText('Engineering')).toBeInTheDocument();

    // 3. Clear search (Escape)
    searchInput.focus();
    fireEvent.keyDown(searchInput, { key: 'Escape' });
    await waitFor(() => {
      expect(searchInput.value).toBe('');
    });

    // 4. Navigate threads (Ctrl+] and Ctrl+[)
    fireEvent.keyDown(document, { key: ']', ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByText('Bug fix deployed')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: '[', ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
    });

    // 5. Show keyboard shortcuts help (?)
    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });
});
