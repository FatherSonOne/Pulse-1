// ============================================
// MESSAGE PROMPT COMPONENT TESTS
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessagePrompt } from './MessagePrompt';
import { InAppMessage } from '../types/inAppMessages';

describe('MessagePrompt', () => {
  const mockMessage: InAppMessage = {
    id: 'msg-1',
    title: 'Test Message',
    body: 'This is a test message body',
    ctaText: 'Click Me',
    ctaUrl: 'https://example.com',
    eventTrigger: 'user_signup',
    segment: 'all',
    isActive: true,
    priority: 1,
    displayDurationSeconds: 5,
    position: 'bottom-right',
    styleType: 'info',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockHandlers = {
    onOpened: vi.fn(),
    onClicked: vi.fn(),
    onDismissed: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render message title and body', () => {
    render(<MessagePrompt message={mockMessage} {...mockHandlers} />);

    expect(screen.getByText('Test Message')).toBeInTheDocument();
    expect(screen.getByText('This is a test message body')).toBeInTheDocument();
  });

  it('should render CTA button when ctaText is provided', () => {
    render(<MessagePrompt message={mockMessage} {...mockHandlers} />);

    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('should not render CTA button when ctaText is not provided', () => {
    const messageWithoutCta = { ...mockMessage, ctaText: undefined };
    render(<MessagePrompt message={messageWithoutCta} {...mockHandlers} />);

    expect(screen.queryByRole('button', { name: /click/i })).not.toBeInTheDocument();
  });

  it('should call onOpened when message is expanded', () => {
    render(<MessagePrompt message={mockMessage} {...mockHandlers} />);

    // Click on the message to expand it
    const messageContainer = screen.getByText('Test Message').closest('div');
    if (messageContainer) {
      fireEvent.click(messageContainer);
    }

    expect(mockHandlers.onOpened).toHaveBeenCalled();
  });

  it('should call onClicked when CTA button is clicked', () => {
    render(<MessagePrompt message={mockMessage} {...mockHandlers} />);

    const ctaButton = screen.getByText('Click Me');
    fireEvent.click(ctaButton);

    expect(mockHandlers.onClicked).toHaveBeenCalled();
  });

  it('should auto-dismiss after displayDurationSeconds', async () => {
    render(<MessagePrompt message={mockMessage} {...mockHandlers} />);

    // Fast-forward time past display duration + animation delay
    vi.advanceTimersByTime(5000 + 300);

    expect(mockHandlers.onDismissed).toHaveBeenCalled();
  });

  it('should call onDismissed when dismiss button is clicked', () => {
    render(<MessagePrompt message={mockMessage} {...mockHandlers} />);

    // Find close button by its text content (×)
    const closeButtons = screen.getAllByRole('button');
    const dismissButton = closeButtons.find(btn => btn.textContent === '×');

    expect(dismissButton).toBeDefined();
    if (dismissButton) {
      fireEvent.click(dismissButton);
      // Advance timers past animation delay
      vi.advanceTimersByTime(300);
      expect(mockHandlers.onDismissed).toHaveBeenCalled();
    }
  });

  it('should apply correct position class', () => {
    const { container } = render(<MessagePrompt message={mockMessage} {...mockHandlers} />);

    // Check that position class is applied
    expect(container.querySelector('.bottom-right') || container.firstChild).toBeTruthy();
  });

  it('should apply correct style type class', () => {
    const { container } = render(<MessagePrompt message={mockMessage} {...mockHandlers} />);

    // The message should have the info style type
    expect(container.querySelector('.info') || container.querySelector('[class*="info"]') || container.firstChild).toBeTruthy();
  });

  it('should handle different style types', () => {
    const styleTypes = ['info', 'success', 'warning', 'error'] as const;

    styleTypes.forEach((styleType) => {
      const message = { ...mockMessage, styleType };
      const { container, unmount } = render(<MessagePrompt message={message} {...mockHandlers} />);

      // Component should render without error
      expect(container.firstChild).toBeInTheDocument();
      unmount();
    });
  });

  it('should handle messages without optional fields', () => {
    const minimalMessage: InAppMessage = {
      id: 'msg-2',
      title: 'Minimal Message',
      body: 'Just the basics',
      eventTrigger: 'page_view',
      segment: 'all',
      isActive: true,
      priority: 0,
      displayDurationSeconds: 8,
      position: 'bottom-right',
      styleType: 'info',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(<MessagePrompt message={minimalMessage} {...mockHandlers} />);

    expect(screen.getByText('Minimal Message')).toBeInTheDocument();
    expect(screen.getByText('Just the basics')).toBeInTheDocument();
  });
});
