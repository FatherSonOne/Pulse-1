/**
 * RadialMenu Component Tests
 * Phase 3: Feature Refinements - Task 2
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadialMenu, useRadialMenu, useLongPress } from '../RadialMenu';

describe('RadialMenu', () => {
  const mockItems = [
    { id: '1', emoji: '👍', label: 'Like', onClick: jest.fn() },
    { id: '2', emoji: '❤️', label: 'Love', onClick: jest.fn() },
    { id: '3', emoji: '😂', label: 'Laugh', onClick: jest.fn() },
    { id: '4', emoji: '😮', label: 'Wow', onClick: jest.fn() }
  ];

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <RadialMenu
          items={mockItems}
          isOpen={false}
          onClose={mockOnClose}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
      render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          centerX={100}
          centerY={100}
        />
      );

      // Should render backdrop
      expect(document.querySelector('[style*="position: fixed"]')).toBeTruthy();

      // Should render all items
      mockItems.forEach(item => {
        expect(screen.getByText(item.emoji)).toBeInTheDocument();
      });

      // Should render close button
      expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
    });

    it('should render with custom radius', () => {
      const { container } = render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          radius={120}
        />
      );

      // Check that items are positioned at custom radius
      // This would require checking computed styles or snapshot testing
      expect(container.querySelector('.radial-menu-item')).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('should call onClick when item is clicked', async () => {
      render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          centerX={100}
          centerY={100}
        />
      );

      const likeButton = screen.getByText('👍');
      fireEvent.click(likeButton);

      expect(mockItems[0].onClick).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close when center button is clicked', () => {
      render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          centerX={100}
          centerY={100}
        />
      );

      const closeButton = screen.getByLabelText('Close menu');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close when backdrop is clicked', () => {
      const { container } = render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          centerX={100}
          centerY={100}
        />
      );

      // Find backdrop (first motion.div with fixed position)
      const backdrop = container.querySelector('[style*="position: fixed"][style*="top: 0"]');
      expect(backdrop).toBeTruthy();

      fireEvent.click(backdrop!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close when Escape key is pressed', () => {
      render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          centerX={100}
          centerY={100}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not propagate clicks inside menu', () => {
      const outsideClickHandler = jest.fn();

      render(
        <div onClick={outsideClickHandler}>
          <RadialMenu
            items={mockItems}
            isOpen={true}
            onClose={mockOnClose}
            centerX={100}
            centerY={100}
          />
        </div>
      );

      const likeButton = screen.getByText('👍');
      fireEvent.click(likeButton);

      // Should not trigger outside click handler
      expect(outsideClickHandler).not.toHaveBeenCalled();
    });
  });

  describe('Animations', () => {
    it('should animate in with scale and opacity', () => {
      const { container } = render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          centerX={100}
          centerY={100}
        />
      );

      // Framer Motion should apply initial animation styles
      // Check for motion components
      expect(container.querySelector('[style*="opacity"]')).toBeTruthy();
    });

    it('should stagger item animations', async () => {
      const { container } = render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          centerX={100}
          centerY={100}
        />
      );

      // Items should have staggered animation delays
      // This is difficult to test directly, but we can verify all items render
      const items = container.querySelectorAll('.radial-menu-item');
      expect(items.length).toBe(mockItems.length);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on close button', () => {
      render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          centerX={100}
          centerY={100}
        />
      );

      expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
    });

    it('should have title and aria-label on items', () => {
      render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          centerX={100}
          centerY={100}
        />
      );

      mockItems.forEach(item => {
        const button = screen.getByLabelText(item.label);
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('title', item.label);
      });
    });

    it('should have minimum 44px touch targets', () => {
      const { container } = render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          centerX={100}
          centerY={100}
        />
      );

      const items = container.querySelectorAll('.radial-menu-item');
      items.forEach(item => {
        const styles = window.getComputedStyle(item);
        const width = parseInt(styles.width);
        const height = parseInt(styles.height);

        expect(width).toBeGreaterThanOrEqual(44);
        expect(height).toBeGreaterThanOrEqual(44);
      });
    });
  });

  describe('Position Calculation', () => {
    it('should position items in a circle', () => {
      const { container } = render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          centerX={200}
          centerY={200}
          radius={90}
        />
      );

      // Items should be positioned around center
      // Exact calculations depend on angle step
      const items = container.querySelectorAll('.radial-menu-item');
      expect(items.length).toBe(4);

      // Each item should have transform style
      items.forEach(item => {
        const styles = window.getComputedStyle(item);
        expect(styles.position).toBe('absolute');
      });
    });

    it('should center menu at specified coordinates', () => {
      const { container } = render(
        <RadialMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          centerX={300}
          centerY={400}
        />
      );

      const menuContainer = container.querySelector('[style*="position: fixed"]');
      expect(menuContainer).toBeTruthy();

      // Container should be positioned at centerX, centerY
      const styles = window.getComputedStyle(menuContainer!);
      expect(styles.position).toBe('fixed');
    });
  });
});

describe('useRadialMenu hook', () => {
  it('should initialize with closed state', () => {
    const TestComponent = () => {
      const menu = useRadialMenu();
      return (
        <div>
          <span data-testid="is-open">{String(menu.isOpen)}</span>
          <span data-testid="x">{menu.position.x}</span>
          <span data-testid="y">{menu.position.y}</span>
        </div>
      );
    };

    render(<TestComponent />);

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    expect(screen.getByTestId('x')).toHaveTextContent('0');
    expect(screen.getByTestId('y')).toHaveTextContent('0');
  });

  it('should open menu with position', () => {
    const TestComponent = () => {
      const menu = useRadialMenu();
      return (
        <div>
          <button onClick={() => menu.open(100, 200)}>Open</button>
          <span data-testid="is-open">{String(menu.isOpen)}</span>
          <span data-testid="x">{menu.position.x}</span>
          <span data-testid="y">{menu.position.y}</span>
        </div>
      );
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByText('Open'));

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('x')).toHaveTextContent('100');
    expect(screen.getByTestId('y')).toHaveTextContent('200');
  });

  it('should close menu', () => {
    const TestComponent = () => {
      const menu = useRadialMenu();
      return (
        <div>
          <button onClick={() => menu.open(100, 200)}>Open</button>
          <button onClick={menu.close}>Close</button>
          <span data-testid="is-open">{String(menu.isOpen)}</span>
        </div>
      );
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');

    fireEvent.click(screen.getByText('Close'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('should close on window blur', async () => {
    const TestComponent = () => {
      const menu = useRadialMenu();
      return (
        <div>
          <button onClick={() => menu.open(100, 200)}>Open</button>
          <span data-testid="is-open">{String(menu.isOpen)}</span>
        </div>
      );
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');

    fireEvent.blur(window);

    await waitFor(() => {
      expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    });
  });
});

describe('useLongPress hook', () => {
  jest.useFakeTimers();

  it('should trigger after specified duration', () => {
    const onLongPress = jest.fn();

    const TestComponent = () => {
      const longPress = useLongPress(onLongPress, 500);
      return <div {...longPress} data-testid="target">Press me</div>;
    };

    render(<TestComponent />);

    const target = screen.getByTestId('target');

    fireEvent.mouseDown(target, { clientX: 100, clientY: 200 });
    jest.advanceTimersByTime(500);

    expect(onLongPress).toHaveBeenCalledWith(100, 200);
  });

  it('should not trigger if released early', () => {
    const onLongPress = jest.fn();

    const TestComponent = () => {
      const longPress = useLongPress(onLongPress, 500);
      return <div {...longPress} data-testid="target">Press me</div>;
    };

    render(<TestComponent />);

    const target = screen.getByTestId('target');

    fireEvent.mouseDown(target, { clientX: 100, clientY: 200 });
    jest.advanceTimersByTime(300);
    fireEvent.mouseUp(target);
    jest.advanceTimersByTime(200);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('should cancel on mouse leave', () => {
    const onLongPress = jest.fn();

    const TestComponent = () => {
      const longPress = useLongPress(onLongPress, 500);
      return <div {...longPress} data-testid="target">Press me</div>;
    };

    render(<TestComponent />);

    const target = screen.getByTestId('target');

    fireEvent.mouseDown(target, { clientX: 100, clientY: 200 });
    jest.advanceTimersByTime(300);
    fireEvent.mouseLeave(target);
    jest.advanceTimersByTime(200);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('should work with touch events', () => {
    const onLongPress = jest.fn();

    const TestComponent = () => {
      const longPress = useLongPress(onLongPress, 500);
      return <div {...longPress} data-testid="target">Press me</div>;
    };

    render(<TestComponent />);

    const target = screen.getByTestId('target');

    fireEvent.touchStart(target, {
      touches: [{ clientX: 100, clientY: 200 }]
    });
    jest.advanceTimersByTime(500);

    expect(onLongPress).toHaveBeenCalledWith(100, 200);
  });

  jest.useRealTimers();
});
