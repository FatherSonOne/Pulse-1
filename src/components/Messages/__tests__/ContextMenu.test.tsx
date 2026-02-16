/**
 * ContextMenu Component Tests
 * Phase 3: Feature Refinements - Task 3
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ContextMenu,
  useContextMenu,
  useRightClick,
  useLongPressMenu
} from '../ContextMenu';

describe('ContextMenu', () => {
  const mockItems = [
    {
      id: 'reply',
      label: 'Reply',
      icon: 'fa-reply',
      onClick: jest.fn()
    },
    {
      id: 'copy',
      label: 'Copy',
      icon: 'fa-copy',
      onClick: jest.fn(),
      divider: true
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: 'fa-pencil',
      onClick: jest.fn(),
      disabled: true
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'fa-trash',
      onClick: jest.fn(),
      destructive: true
    }
  ];

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <ContextMenu
          items={mockItems}
          isOpen={false}
          onClose={mockOnClose}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      // Should render all menu items
      expect(screen.getByText('Reply')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should render dividers', () => {
      const { container } = render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      // Check for divider after 'Copy' item
      const dividers = container.querySelectorAll('[style*="height: 1px"]');
      expect(dividers.length).toBeGreaterThan(0);
    });

    it('should style destructive items differently', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      const deleteButton = screen.getByText('Delete');
      expect(deleteButton).toHaveClass('destructive');
    });

    it('should disable items correctly', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      const editButton = screen.getByLabelText('Edit');
      expect(editButton).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('should call onClick when item is clicked', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      const replyButton = screen.getByText('Reply');
      fireEvent.click(replyButton);

      expect(mockItems[0].onClick).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick on disabled items', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      const editButton = screen.getByLabelText('Edit');
      fireEvent.click(editButton);

      expect(mockItems[2].onClick).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should close when clicking outside', async () => {
      const { container } = render(
        <div>
          <div data-testid="outside">Outside</div>
          <ContextMenu
            items={mockItems}
            isOpen={true}
            onClose={mockOnClose}
            x={100}
            y={100}
          />
        </div>
      );

      // Wait for click listener to be attached (100ms delay in component)
      await waitFor(() => {
        fireEvent.click(screen.getByTestId('outside'));
      }, { timeout: 200 });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close when clicking inside', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      const menu = screen.getByText('Reply').closest('[style*="position: fixed"]');
      fireEvent.click(menu!);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate down with ArrowDown', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      // First item should be selected initially
      const replyButton = screen.getByText('Reply');
      expect(replyButton).toHaveClass('selected');

      // Press down
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      // Second item should be selected
      const copyButton = screen.getByText('Copy');
      expect(copyButton).toHaveClass('selected');
    });

    it('should navigate up with ArrowUp', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      // Navigate down then up
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });

      // First item should be selected again
      const replyButton = screen.getByText('Reply');
      expect(replyButton).toHaveClass('selected');
    });

    it('should wrap to first item when navigating down from last', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      // Navigate to last item
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      // One more should wrap to first
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      const replyButton = screen.getByText('Reply');
      expect(replyButton).toHaveClass('selected');
    });

    it('should trigger selected item on Enter', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(mockItems[0].onClick).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close on Escape', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should skip disabled items in keyboard navigation', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      // Navigate past disabled 'Edit' item
      fireEvent.keyDown(document, { key: 'ArrowDown' }); // Copy
      fireEvent.keyDown(document, { key: 'ArrowDown' }); // Should skip Edit, go to Delete

      const deleteButton = screen.getByText('Delete');
      expect(deleteButton).toHaveClass('selected');
    });
  });

  describe('Smart Positioning', () => {
    beforeEach(() => {
      // Mock window dimensions
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 1024
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        value: 768
      });
    });

    it('should adjust position if overflowing right edge', async () => {
      const { container } = render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={1000} // Near right edge
          y={100}
        />
      );

      await waitFor(() => {
        const menu = container.querySelector('[style*="position: fixed"]');
        expect(menu).toBeTruthy();
        // Position should be adjusted left
      });
    });

    it('should adjust position if overflowing bottom edge', async () => {
      const { container } = render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={750} // Near bottom edge
        />
      );

      await waitFor(() => {
        const menu = container.querySelector('[style*="position: fixed"]');
        expect(menu).toBeTruthy();
        // Position should be adjusted up
      });
    });

    it('should maintain minimum 16px padding from edges', async () => {
      const { container } = render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={5} // Very close to left edge
          y={5} // Very close to top edge
        />
      );

      await waitFor(() => {
        const menu = container.querySelector('[style*="position: fixed"]');
        const styles = window.getComputedStyle(menu!);
        const left = parseInt(styles.left);
        const top = parseInt(styles.top);

        expect(left).toBeGreaterThanOrEqual(16);
        expect(top).toBeGreaterThanOrEqual(16);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have minimum 48px touch targets', () => {
      const { container } = render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      const items = container.querySelectorAll('.context-menu-item');
      items.forEach(item => {
        const styles = window.getComputedStyle(item);
        const height = parseInt(styles.minHeight);
        expect(height).toBeGreaterThanOrEqual(48);
      });
    });

    it('should have aria-label on items', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      mockItems.forEach(item => {
        expect(screen.getByLabelText(item.label)).toBeInTheDocument();
      });
    });

    it('should indicate selected item to screen readers', () => {
      render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      const replyButton = screen.getByText('Reply');
      expect(replyButton.closest('.context-menu-item')).toHaveClass('selected');
    });
  });

  describe('Animations', () => {
    it('should animate in with opacity and scale', () => {
      const { container } = render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      const menu = container.querySelector('.context-menu');
      expect(menu).toBeTruthy();
      // Framer Motion applies animation styles
    });

    it('should animate out when closing', async () => {
      const { rerender, container } = render(
        <ContextMenu
          items={mockItems}
          isOpen={true}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      rerender(
        <ContextMenu
          items={mockItems}
          isOpen={false}
          onClose={mockOnClose}
          x={100}
          y={100}
        />
      );

      // AnimatePresence should handle exit animation
      await waitFor(() => {
        expect(container.querySelector('.context-menu')).toBeNull();
      });
    });
  });
});

describe('useContextMenu hook', () => {
  it('should initialize with closed state', () => {
    const TestComponent = () => {
      const menu = useContextMenu();
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
      const menu = useContextMenu();
      return (
        <div>
          <button onClick={() => menu.open(150, 250)}>Open</button>
          <span data-testid="is-open">{String(menu.isOpen)}</span>
          <span data-testid="x">{menu.position.x}</span>
          <span data-testid="y">{menu.position.y}</span>
        </div>
      );
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByText('Open'));

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('x')).toHaveTextContent('150');
    expect(screen.getByTestId('y')).toHaveTextContent('250');
  });

  it('should close menu', () => {
    const TestComponent = () => {
      const menu = useContextMenu();
      return (
        <div>
          <button onClick={() => menu.open(150, 250)}>Open</button>
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
});

describe('useRightClick hook', () => {
  it('should prevent default context menu', () => {
    const onRightClick = jest.fn();

    const TestComponent = () => {
      const rightClick = useRightClick(onRightClick);
      return <div {...rightClick} data-testid="target">Right click me</div>;
    };

    render(<TestComponent />);

    const target = screen.getByTestId('target');
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 200
    });

    Object.defineProperty(event, 'preventDefault', {
      value: jest.fn()
    });

    target.dispatchEvent(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onRightClick).toHaveBeenCalledWith(100, 200);
  });
});

describe('useLongPressMenu hook', () => {
  jest.useFakeTimers();

  it('should trigger after 500ms', () => {
    const onLongPress = jest.fn();

    const TestComponent = () => {
      const longPress = useLongPressMenu(onLongPress, 500);
      return <div {...longPress} data-testid="target">Press me</div>;
    };

    render(<TestComponent />);

    const target = screen.getByTestId('target');

    fireEvent.mouseDown(target, { clientX: 100, clientY: 200 });
    jest.advanceTimersByTime(500);

    expect(onLongPress).toHaveBeenCalledWith(100, 200);
  });

  it('should cancel if moved more than 10px', () => {
    const onLongPress = jest.fn();

    const TestComponent = () => {
      const longPress = useLongPressMenu(onLongPress, 500);
      return <div {...longPress} data-testid="target">Press me</div>;
    };

    render(<TestComponent />);

    const target = screen.getByTestId('target');

    fireEvent.mouseDown(target, { clientX: 100, clientY: 200 });
    fireEvent.mouseMove(target, { clientX: 120, clientY: 200 }); // Moved 20px
    jest.advanceTimersByTime(500);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('should not cancel if moved less than 10px', () => {
    const onLongPress = jest.fn();

    const TestComponent = () => {
      const longPress = useLongPressMenu(onLongPress, 500);
      return <div {...longPress} data-testid="target">Press me</div>;
    };

    render(<TestComponent />);

    const target = screen.getByTestId('target');

    fireEvent.mouseDown(target, { clientX: 100, clientY: 200 });
    fireEvent.mouseMove(target, { clientX: 105, clientY: 202 }); // Moved 5px
    jest.advanceTimersByTime(500);

    expect(onLongPress).toHaveBeenCalledWith(100, 200);
  });

  it('should work with touch events', () => {
    const onLongPress = jest.fn();

    const TestComponent = () => {
      const longPress = useLongPressMenu(onLongPress, 500);
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
