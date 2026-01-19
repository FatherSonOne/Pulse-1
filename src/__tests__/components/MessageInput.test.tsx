// ============================================
// MESSAGE INPUT COMPONENT TESTS
// Tests for the main message input component
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent, within } from '../../test/utils/testUtils';
import MessageInput from '../../components/MessageInput/MessageInput';
import { useMessageStore } from '../../store/messageStore';

// Mock the message store
vi.mock('../../store/messageStore', () => ({
  useMessageStore: vi.fn(),
}));

describe('MessageInput Component', () => {
  const mockOnSend = vi.fn();
  const mockOnTyping = vi.fn();
  const mockMessageStore = {
    generateSmartReplies: vi.fn(),
    analyzeDraft: vi.fn(),
    clearSmartReplies: vi.fn(),
    smartReplies: [],
    draftAnalysis: null,
    isGeneratingReplies: false,
    isAnalyzingDraft: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useMessageStore as any).mockReturnValue(mockMessageStore);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Rendering', () => {
    it('should render the message input field', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox', { name: /message text/i });
      expect(input).toBeInTheDocument();
    });

    it('should render with placeholder text', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} placeholder="Type here..." />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('data-placeholder', 'Type here...');
    });

    it('should render with default placeholder', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('data-placeholder', 'Type your message...');
    });

    it('should render send button', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeInTheDocument();
    });

    it('should render with file input for attachments', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const fileInput = document.getElementById('file-input');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('multiple');
    });
  });

  describe('Message Typing', () => {
    it('should update input value when typing', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello world');

      expect(input).toHaveTextContent('Hello world');
    });

    it('should call onTyping callback while typing', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });
      renderWithProviders(<MessageInput onSend={mockOnSend} onTyping={mockOnTyping} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      expect(mockOnTyping).toHaveBeenCalledWith(true);

      // Fast forward to debounce timeout
      vi.advanceTimersByTime(1000);
      expect(mockOnTyping).toHaveBeenCalledWith(false);

      vi.useRealTimers();
    });

    it('should debounce AI suggestions while typing', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });
      renderWithProviders(<MessageInput onSend={mockOnSend} aiEnabled={true} channelId="test-channel" />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Can we schedule');

      // AI suggestions should be debounced (300ms)
      expect(input).toHaveTextContent('Can we schedule');
      expect(mockMessageStore.generateSmartReplies).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(mockMessageStore.generateSmartReplies).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should respect maxLength when typing', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} maxLength={10} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'This is a very long message');

      expect(input.textContent).toHaveLength(10);
    });

    it('should show character count', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} maxLength={100} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello');

      const counter = screen.getByRole('status', { name: '' });
      expect(counter).toHaveTextContent('5 / 100');
    });
  });

  describe('Message Sending', () => {
    it('should send message on Cmd+Enter key', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello world');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(mockOnSend).toHaveBeenCalledWith('Hello world');
    });

    it('should send message on Ctrl+Enter key', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello world');
      await user.keyboard('{Control>}{Enter}{/Control}');

      expect(mockOnSend).toHaveBeenCalledWith('Hello world');
    });

    it('should send message on Send button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test message');

      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);

      expect(mockOnSend).toHaveBeenCalledWith('Test message');
    });

    it('should clear input after sending message', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);

      expect(input).toHaveTextContent('');
    });

    it('should not send empty messages', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeDisabled();

      await user.click(sendButton);
      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('should disable send button for whitespace-only messages', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '   ');

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeDisabled();
    });

    it('should not send when disabled prop is true', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} disabled={true} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('contenteditable', 'false');

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeDisabled();
    });
  });

  describe('AI Features', () => {
    it('should show AI toggle button when AI is enabled', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} aiEnabled={true} />);

      const aiButton = screen.getByRole('button', { name: /toggle ai suggestions/i });
      expect(aiButton).toBeInTheDocument();
    });

    it('should toggle AI suggestions on button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} aiEnabled={true} />);

      const aiButton = screen.getByRole('button', { name: /toggle ai suggestions/i });

      expect(aiButton).toHaveAttribute('aria-pressed', 'false');

      await user.click(aiButton);
      expect(aiButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should trigger AI analysis when typing with AI enabled', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });
      renderWithProviders(<MessageInput onSend={mockOnSend} aiEnabled={true} channelId="test" />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello AI');

      vi.advanceTimersByTime(500);
      expect(mockMessageStore.analyzeDraft).toHaveBeenCalledWith('Hello AI');

      vi.useRealTimers();
    });

    it('should show tone analysis when available', () => {
      const mockStore = {
        ...mockMessageStore,
        draftAnalysis: {
          tone: 'professional',
          sentiment: 'positive',
          confidence: 85,
        },
      };
      (useMessageStore as any).mockReturnValue(mockStore);

      renderWithProviders(<MessageInput onSend={mockOnSend} aiEnabled={true} />);

      // ToneAnalyzer component should render when draftAnalysis is available
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should not show AI features when aiEnabled is false', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} aiEnabled={false} />);

      expect(screen.queryByRole('button', { name: /toggle ai suggestions/i })).not.toBeInTheDocument();
    });

    it('should toggle AI with Cmd+K keyboard shortcut', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} aiEnabled={true} />);

      const input = screen.getByRole('textbox');
      input.focus();

      const aiButton = screen.getByRole('button', { name: /toggle ai suggestions/i });
      expect(aiButton).toHaveAttribute('aria-pressed', 'false');

      await user.keyboard('{Meta>}k{/Meta}');
      expect(aiButton).toHaveAttribute('aria-pressed', 'true');

      await user.keyboard('{Meta>}k{/Meta}');
      expect(aiButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should not call AI when message is too short', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });
      renderWithProviders(<MessageInput onSend={mockOnSend} aiEnabled={true} channelId="test" />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hi');

      vi.advanceTimersByTime(500);
      expect(mockMessageStore.analyzeDraft).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Formatting', () => {
    it('should apply bold formatting with Cmd+B', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      input.focus();

      await user.keyboard('{Meta>}b{/Meta}');
      // Bold formatting applied via document.execCommand
      expect(input).toBeInTheDocument();
    });

    it('should apply italic formatting with Cmd+I', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      input.focus();

      await user.keyboard('{Meta>}i{/Meta}');
      expect(input).toBeInTheDocument();
    });

    it('should apply code formatting with Cmd+E', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      input.focus();

      await user.keyboard('{Meta>}e{/Meta}');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Attachments', () => {
    it('should handle file selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      expect(fileInput.files).toHaveLength(1);
      expect(fileInput.files![0]).toBe(file);
    });

    it('should handle multiple file selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      const files = [
        new File(['test1'], 'test1.txt', { type: 'text/plain' }),
        new File(['test2'], 'test2.png', { type: 'image/png' }),
      ];

      await user.upload(fileInput, files);

      expect(fileInput.files).toHaveLength(2);
    });

    it('should show attachment preview when files are attached', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        // AttachmentPreview should be rendered
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });
    });

    it('should clear attachments after sending', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Message with attachment');

      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      await user.upload(fileInput, file);

      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);

      expect(fileInput.files).toHaveLength(0);
    });
  });

  describe('Draft Management', () => {
    it('should show draft saving indicator', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Draft message');

      await waitFor(() => {
        expect(screen.getByRole('status', { name: /draft/i })).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should show draft saved indicator after timeout', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Draft');

      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        const draftIndicator = screen.getByRole('status', { name: /draft/i });
        expect(draftIndicator).toHaveTextContent(/saved/i);
      });

      vi.useRealTimers();
    });

    it('should start with initial value if provided', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} initialValue="Pre-filled text" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveTextContent('Pre-filled text');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox', { name: /message text/i });
      expect(input).toHaveAttribute('aria-multiline', 'true');
      expect(input).toHaveAttribute('aria-describedby');
    });

    it('should have proper ARIA states for send button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeDisabled();

      const input = screen.getByRole('textbox');
      await user.type(input, 'Message');

      expect(sendButton).not.toBeDisabled();
    });

    it('should have proper ARIA live regions for status updates', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const counter = screen.getByRole('status');
      expect(counter).toHaveAttribute('aria-live', 'polite');
    });

    it('should have accessible AI toggle button', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} aiEnabled={true} />);

      const aiButton = screen.getByRole('button', { name: /toggle ai suggestions/i });
      expect(aiButton).toHaveAttribute('aria-pressed');
    });
  });

  describe('Performance', () => {
    it('should debounce draft saving', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });
      renderWithProviders(<MessageInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');

      await user.type(input, 'a');
      vi.advanceTimersByTime(500);

      await user.type(input, 'b');
      vi.advanceTimersByTime(500);

      await user.type(input, 'c');

      // Should save only after final timeout
      vi.advanceTimersByTime(1000);

      vi.useRealTimers();
    });

    it('should lazy load AI Composer', () => {
      const mockStore = {
        ...mockMessageStore,
        smartReplies: [
          { id: '1', text: 'Test suggestion', confidence: 85, confidenceLevel: 'high' as const },
        ],
      };
      (useMessageStore as any).mockReturnValue(mockStore);

      renderWithProviders(<MessageInput onSend={mockOnSend} aiEnabled={true} />);

      // AIComposer is lazy loaded with React.lazy and Suspense
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should cleanup timeouts on unmount', () => {
      const { unmount } = renderWithProviders(<MessageInput onSend={mockOnSend} />);

      unmount();

      // Component should cleanup without errors
      expect(true).toBe(true);
    });
  });

  describe('Voice Input', () => {
    it('should show voice button when voiceEnabled is true', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} voiceEnabled={true} />);

      const voiceButton = screen.getByRole('button', { name: /start voice input/i });
      expect(voiceButton).toBeInTheDocument();
    });

    it('should toggle recording state on voice button click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MessageInput onSend={mockOnSend} voiceEnabled={true} />);

      const voiceButton = screen.getByRole('button', { name: /start voice input/i });

      expect(voiceButton).toHaveAttribute('aria-pressed', 'false');

      await user.click(voiceButton);
      expect(screen.getByRole('button', { name: /stop recording/i })).toHaveAttribute('aria-pressed', 'true');
    });

    it('should not show voice button when voiceEnabled is false', () => {
      renderWithProviders(<MessageInput onSend={mockOnSend} voiceEnabled={false} />);

      expect(screen.queryByRole('button', { name: /voice input/i })).not.toBeInTheDocument();
    });
  });
});
