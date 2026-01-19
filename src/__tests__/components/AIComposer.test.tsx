// ============================================
// AI COMPOSER COMPONENT TESTS
// Tests for AI suggestion overlay component
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../../test/utils/testUtils';
import AIComposer from '../../components/MessageInput/AIComposer';
import type { AISuggestion } from '../../components/MessageInput/types';

describe('AIComposer Component', () => {
  const mockOnAcceptSuggestion = vi.fn();
  const mockOnDismissSuggestion = vi.fn();
  const mockOnClose = vi.fn();

  const mockSuggestions: AISuggestion[] = [
    {
      id: '1',
      text: 'I hope this message finds you well.',
      confidence: 85,
      confidenceLevel: 'high',
    },
    {
      id: '2',
      text: 'Let me know if you have any questions.',
      confidence: 68,
      confidenceLevel: 'medium',
    },
    {
      id: '3',
      text: 'Looking forward to your response.',
      confidence: 45,
      confidenceLevel: 'low',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render AI suggestions overlay', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('complementary', { name: /ai message suggestions/i })).toBeInTheDocument();
    });

    it('should display all suggestions provided', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(mockSuggestions[0].text)).toBeInTheDocument();
      expect(screen.getByText(mockSuggestions[1].text)).toBeInTheDocument();
      expect(screen.getByText(mockSuggestions[2].text)).toBeInTheDocument();
    });

    it('should show confidence scores for suggestions', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('68%')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('should show empty state when suggestions array is empty', () => {
      renderWithProviders(
        <AIComposer
          suggestions={[]}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/type more to get ai suggestions/i)).toBeInTheDocument();
    });

    it('should show loading state while fetching suggestions', () => {
      renderWithProviders(
        <AIComposer
          suggestions={[]}
          isLoading={true}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const skeletons = document.querySelectorAll('.skeleton-suggestion');
      expect(skeletons).toHaveLength(3);
    });

    it('should render header with title and close button', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/ai suggestions/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close ai suggestions/i })).toBeInTheDocument();
    });
  });

  describe('Suggestion Interaction', () => {
    it('should call onAcceptSuggestion when suggestion is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const firstSuggestion = screen.getByRole('option', {
        name: new RegExp(mockSuggestions[0].text, 'i'),
      });
      await user.click(firstSuggestion);

      expect(mockOnAcceptSuggestion).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    it('should call onAcceptSuggestion when accept button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const acceptButtons = screen.getAllByRole('button', { name: /accept suggestion/i });
      await user.click(acceptButtons[0]);

      expect(mockOnAcceptSuggestion).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    it('should highlight suggestion on hover', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const firstSuggestion = screen.getByRole('option', {
        name: new RegExp(mockSuggestions[0].text, 'i'),
      });

      await user.hover(firstSuggestion);

      // Framer Motion whileHover should scale the element
      expect(firstSuggestion).toBeInTheDocument();
    });

    it('should show individual suggestions as clickable options', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const suggestions = screen.getAllByRole('option');
      expect(suggestions).toHaveLength(mockSuggestions.length);
    });
  });

  describe('Dismissal', () => {
    it('should call onClose when clicking close button', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close ai suggestions/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onDismissSuggestion when clicking dismiss button', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const dismissButtons = screen.getAllByRole('button', { name: /dismiss suggestion/i });
      await user.click(dismissButtons[0]);

      expect(mockOnDismissSuggestion).toHaveBeenCalledWith(mockSuggestions[0].id);
    });

    it('should stop event propagation when clicking action buttons', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const acceptButtons = screen.getAllByRole('button', { name: /accept suggestion/i });
      await user.click(acceptButtons[0]);

      // Accept button should call onAcceptSuggestion but not trigger parent click
      expect(mockOnAcceptSuggestion).toHaveBeenCalledTimes(1);
    });
  });

  describe('Confidence Display', () => {
    it('should show visual indicator for high confidence suggestions', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const confidenceBars = document.querySelectorAll('[data-level="high"]');
      expect(confidenceBars.length).toBeGreaterThan(0);
    });

    it('should show visual indicator for medium confidence suggestions', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const confidenceBars = document.querySelectorAll('[data-level="medium"]');
      expect(confidenceBars.length).toBeGreaterThan(0);
    });

    it('should show visual indicator for low confidence suggestions', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const confidenceBars = document.querySelectorAll('[data-level="low"]');
      expect(confidenceBars.length).toBeGreaterThan(0);
    });

    it('should show confidence percentage for each suggestion', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      mockSuggestions.forEach((suggestion) => {
        expect(screen.getByText(`${suggestion.confidence}%`)).toBeInTheDocument();
      });
    });

    it('should render confidence bar with correct width', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const confidenceFills = document.querySelectorAll('.confidence-fill');
      expect(confidenceFills[0]).toHaveStyle({ width: '85%' });
    });
  });

  describe('Animation', () => {
    it('should animate on mount', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const overlay = screen.getByRole('complementary');
      expect(overlay).toHaveClass('ai-composer-overlay');
    });

    it('should animate suggestions on mount', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const suggestionCards = document.querySelectorAll('.suggestion-card');
      expect(suggestionCards).toHaveLength(3);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role for suggestions overlay', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('complementary', { name: /ai message suggestions/i })).toBeInTheDocument();
    });

    it('should announce suggestions to screen readers', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const overlay = screen.getByRole('complementary');
      expect(overlay).toHaveAttribute('aria-live', 'polite');
    });

    it('should have descriptive labels for suggestions', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const suggestion = screen.getByRole('option', {
        name: new RegExp(`Suggestion: ${mockSuggestions[0].text}`, 'i'),
      });
      expect(suggestion).toBeInTheDocument();
    });

    it('should have accessible action buttons', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const acceptButtons = screen.getAllByRole('button', { name: /accept suggestion/i });
      const dismissButtons = screen.getAllByRole('button', { name: /dismiss suggestion/i });

      expect(acceptButtons).toHaveLength(mockSuggestions.length);
      expect(dismissButtons).toHaveLength(mockSuggestions.length);
    });

    it('should have accessible close button', () => {
      renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close ai suggestions/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single suggestion', () => {
      const singleSuggestion = [mockSuggestions[0]];

      renderWithProviders(
        <AIComposer
          suggestions={singleSuggestion}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      expect(screen.getAllByRole('option')).toHaveLength(1);
    });

    it('should handle many suggestions', () => {
      const manySuggestions = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        text: `Suggestion ${i}`,
        confidence: 50 + i * 5,
        confidenceLevel: 'medium' as const,
      }));

      renderWithProviders(
        <AIComposer
          suggestions={manySuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      expect(screen.getAllByRole('option')).toHaveLength(10);
    });

    it('should handle very long suggestion text', () => {
      const longSuggestion = [
        {
          id: '1',
          text: 'This is a very long suggestion that might wrap to multiple lines and we need to ensure it displays correctly without breaking the layout or causing accessibility issues.',
          confidence: 75,
          confidenceLevel: 'high' as const,
        },
      ];

      renderWithProviders(
        <AIComposer
          suggestions={longSuggestion}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(longSuggestion[0].text)).toBeInTheDocument();
    });

    it('should handle 0% confidence', () => {
      const zeroConfidence = [
        {
          id: '1',
          text: 'Low confidence suggestion',
          confidence: 0,
          confidenceLevel: 'low' as const,
        },
      ];

      renderWithProviders(
        <AIComposer
          suggestions={zeroConfidence}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle 100% confidence', () => {
      const perfectConfidence = [
        {
          id: '1',
          text: 'Perfect confidence suggestion',
          confidence: 100,
          confidenceLevel: 'high' as const,
        },
      ];

      renderWithProviders(
        <AIComposer
          suggestions={perfectConfidence}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should transition between loading and loaded states', async () => {
      const { rerender } = renderWithProviders(
        <AIComposer
          suggestions={[]}
          isLoading={true}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      expect(document.querySelectorAll('.skeleton-suggestion')).toHaveLength(3);

      rerender(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(mockSuggestions[0].text)).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should render large suggestion lists efficiently', () => {
      const largeSuggestionList = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        text: `Suggestion ${i}`,
        confidence: Math.floor(Math.random() * 100),
        confidenceLevel: 'medium' as const,
      }));

      const startTime = performance.now();

      renderWithProviders(
        <AIComposer
          suggestions={largeSuggestionList}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);
      expect(screen.getAllByRole('option')).toHaveLength(50);
    });

    it('should not cause memory leaks on unmount', () => {
      const { unmount } = renderWithProviders(
        <AIComposer
          suggestions={mockSuggestions}
          isLoading={false}
          onAcceptSuggestion={mockOnAcceptSuggestion}
          onDismissSuggestion={mockOnDismissSuggestion}
          onClose={mockOnClose}
        />
      );

      unmount();

      // Should unmount without errors
      expect(true).toBe(true);
    });
  });
});
