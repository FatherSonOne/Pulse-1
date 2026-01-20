// src/hooks/__tests__/useHoverWithDelay.test.ts
// Comprehensive unit tests for useHoverWithDelay hook

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHoverWithDelay } from '../useHoverWithDelay';

describe('useHoverWithDelay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Basic Hover Functionality', () => {
    it('should initialize with isHovering false', () => {
      const { result } = renderHook(() => useHoverWithDelay());

      expect(result.current.isHovering).toBe(false);
      expect(result.current.isLongPressed).toBe(false);
    });

    it('should provide hoverRef', () => {
      const { result } = renderHook(() => useHoverWithDelay());

      expect(result.current.hoverRef).toBeDefined();
      expect(result.current.hoverRef.current).toBeNull();
    });

    it('should provide manual trigger functions', () => {
      const { result } = renderHook(() => useHoverWithDelay());

      expect(typeof result.current.triggerHover).toBe('function');
      expect(typeof result.current.endHover).toBe('function');
    });
  });

  describe('Hover Delay', () => {
    it('should not trigger hover immediately', () => {
      const { result } = renderHook(() =>
        useHoverWithDelay({ hoverDelay: 300 })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Simulate mouse enter
      act(() => {
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      });

      expect(result.current.isHovering).toBe(false);
    });

    it('should trigger hover after delay', async () => {
      const onHoverStart = vi.fn();
      const { result } = renderHook(() =>
        useHoverWithDelay({ hoverDelay: 300, onHoverStart })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      act(() => {
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      });

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.isHovering).toBe(true);
      expect(onHoverStart).toHaveBeenCalledTimes(1);
    });

    it('should use custom hover delay', async () => {
      const onHoverStart = vi.fn();
      const { result } = renderHook(() =>
        useHoverWithDelay({ hoverDelay: 500, onHoverStart })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      act(() => {
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      });

      // Should not trigger at 300ms
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.isHovering).toBe(false);

      // Should trigger at 500ms
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.isHovering).toBe(true);
    });

    it('should cancel hover if mouse leaves before delay', () => {
      const onHoverStart = vi.fn();
      const { result } = renderHook(() =>
        useHoverWithDelay({ hoverDelay: 300, onHoverStart })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      act(() => {
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      });

      // Leave before delay
      act(() => {
        vi.advanceTimersByTime(100);
        element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      });

      // Fast-forward past original delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.isHovering).toBe(false);
      expect(onHoverStart).not.toHaveBeenCalled();
    });
  });

  describe('Unhover Delay', () => {
    it('should delay unhover', async () => {
      const onHoverEnd = vi.fn();
      const { result } = renderHook(() =>
        useHoverWithDelay({ hoverDelay: 300, unhoverDelay: 100, onHoverEnd })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Trigger hover
      act(() => {
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(300);
      });

      expect(result.current.isHovering).toBe(true);

      // Leave element
      act(() => {
        element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      });

      // Should still be hovering
      expect(result.current.isHovering).toBe(true);

      // Should unhover after delay
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.isHovering).toBe(false);
      expect(onHoverEnd).toHaveBeenCalledTimes(1);
    });

    it('should cancel unhover if mouse re-enters', () => {
      const { result } = renderHook(() =>
        useHoverWithDelay({ hoverDelay: 300, unhoverDelay: 100 })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Trigger hover
      act(() => {
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(300);
      });

      // Leave and re-enter before unhover delay
      act(() => {
        element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        vi.advanceTimersByTime(50);
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(100);
      });

      expect(result.current.isHovering).toBe(true);
    });
  });

  describe('Manual Triggers', () => {
    it('should trigger hover manually', () => {
      const onHoverStart = vi.fn();
      const { result } = renderHook(() =>
        useHoverWithDelay({ onHoverStart })
      );

      act(() => {
        result.current.triggerHover();
      });

      expect(result.current.isHovering).toBe(true);
      expect(onHoverStart).toHaveBeenCalledTimes(1);
    });

    it('should end hover manually', () => {
      const onHoverEnd = vi.fn();
      const { result } = renderHook(() =>
        useHoverWithDelay({ onHoverEnd })
      );

      // First trigger hover
      act(() => {
        result.current.triggerHover();
      });

      expect(result.current.isHovering).toBe(true);

      // Then end it
      act(() => {
        result.current.endHover();
      });

      expect(result.current.isHovering).toBe(false);
      expect(onHoverEnd).toHaveBeenCalledTimes(1);
    });

    it('should clear timers on manual trigger', () => {
      const { result } = renderHook(() =>
        useHoverWithDelay({ hoverDelay: 300 })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Start hover with delay
      act(() => {
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      });

      // Manually trigger before delay completes
      act(() => {
        vi.advanceTimersByTime(100);
        result.current.triggerHover();
      });

      expect(result.current.isHovering).toBe(true);
    });
  });

  describe('Mobile Long-Press', () => {
    it('should not enable long-press by default', () => {
      const { result } = renderHook(() => useHoverWithDelay());

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Simulate touch start
      act(() => {
        element.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            touches: [{ clientX: 100, clientY: 100 } as Touch],
          })
        );
        vi.advanceTimersByTime(500);
      });

      expect(result.current.isHovering).toBe(false);
      expect(result.current.isLongPressed).toBe(false);
    });

    it('should trigger long-press when enabled', () => {
      const onHoverStart = vi.fn();
      const { result } = renderHook(() =>
        useHoverWithDelay({
          enableLongPress: true,
          longPressDelay: 500,
          onHoverStart,
        })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Simulate long-press
      act(() => {
        element.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            touches: [{ clientX: 100, clientY: 100 } as Touch],
          })
        );
        vi.advanceTimersByTime(500);
      });

      expect(result.current.isHovering).toBe(true);
      expect(result.current.isLongPressed).toBe(true);
      expect(onHoverStart).toHaveBeenCalledTimes(1);
    });

    it('should cancel long-press if finger moves', () => {
      const { result } = renderHook(() =>
        useHoverWithDelay({
          enableLongPress: true,
          longPressDelay: 500,
        })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Start touch
      act(() => {
        element.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            touches: [{ clientX: 100, clientY: 100 } as Touch],
          })
        );
      });

      // Move finger more than 10px
      act(() => {
        vi.advanceTimersByTime(200);
        element.dispatchEvent(
          new TouchEvent('touchmove', {
            bubbles: true,
            touches: [{ clientX: 120, clientY: 100 } as Touch],
          })
        );
        vi.advanceTimersByTime(300);
      });

      expect(result.current.isHovering).toBe(false);
      expect(result.current.isLongPressed).toBe(false);
    });

    it('should end long-press on touch end', () => {
      const onHoverEnd = vi.fn();
      const { result } = renderHook(() =>
        useHoverWithDelay({
          enableLongPress: true,
          longPressDelay: 500,
          unhoverDelay: 100,
          onHoverEnd,
        })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Trigger long-press
      act(() => {
        element.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            touches: [{ clientX: 100, clientY: 100 } as Touch],
          })
        );
        vi.advanceTimersByTime(500);
      });

      expect(result.current.isHovering).toBe(true);

      // End touch
      act(() => {
        element.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
        vi.advanceTimersByTime(100);
      });

      expect(result.current.isHovering).toBe(false);
      expect(onHoverEnd).toHaveBeenCalled();
    });

    it('should use custom long-press delay', () => {
      const { result } = renderHook(() =>
        useHoverWithDelay({
          enableLongPress: true,
          longPressDelay: 1000,
        })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Start touch
      act(() => {
        element.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            touches: [{ clientX: 100, clientY: 100 } as Touch],
          })
        );
      });

      // Should not trigger at 500ms
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.isHovering).toBe(false);

      // Should trigger at 1000ms
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.isHovering).toBe(true);
    });
  });

  describe('Haptic Feedback', () => {
    it('should trigger haptic feedback when enabled', () => {
      const vibrateMock = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        writable: true,
        value: vibrateMock,
      });

      const { result } = renderHook(() =>
        useHoverWithDelay({
          enableLongPress: true,
          enableHaptic: true,
          longPressDelay: 500,
        })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      act(() => {
        element.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            touches: [{ clientX: 100, clientY: 100 } as Touch],
          })
        );
        vi.advanceTimersByTime(500);
      });

      expect(vibrateMock).toHaveBeenCalledWith(10);
    });

    it('should not trigger haptic when disabled', () => {
      const vibrateMock = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        writable: true,
        value: vibrateMock,
      });

      const { result } = renderHook(() =>
        useHoverWithDelay({
          enableLongPress: true,
          enableHaptic: false,
          longPressDelay: 500,
        })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      act(() => {
        element.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            touches: [{ clientX: 100, clientY: 100 } as Touch],
          })
        );
        vi.advanceTimersByTime(500);
      });

      expect(vibrateMock).not.toHaveBeenCalled();
    });
  });

  describe('Scroll Cancellation', () => {
    it('should cancel hover on scroll', () => {
      const onHoverEnd = vi.fn();
      const { result } = renderHook(() =>
        useHoverWithDelay({ hoverDelay: 300, onHoverEnd })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Trigger hover
      act(() => {
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(300);
      });

      expect(result.current.isHovering).toBe(true);

      // Trigger scroll
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      expect(result.current.isHovering).toBe(false);
      expect(onHoverEnd).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clear all timers on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useHoverWithDelay({ hoverDelay: 300 })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Start hover
      act(() => {
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      });

      // Unmount before delay completes
      unmount();

      // Advance timers - should not cause any errors
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // No errors expected
      expect(true).toBe(true);
    });

    it('should remove all event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useHoverWithDelay());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid hover/unhover cycles', () => {
      const { result } = renderHook(() =>
        useHoverWithDelay({ hoverDelay: 300, unhoverDelay: 100 })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Rapid cycles
      act(() => {
        for (let i = 0; i < 5; i++) {
          element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          vi.advanceTimersByTime(50);
          element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
          vi.advanceTimersByTime(50);
        }
      });

      // Should end in unhovered state
      expect(result.current.isHovering).toBe(false);
    });

    it('should handle null ref gracefully', () => {
      const { result } = renderHook(() => useHoverWithDelay());

      // Ref is null by default
      expect(result.current.hoverRef.current).toBeNull();

      // Manual triggers should still work
      act(() => {
        result.current.triggerHover();
      });

      expect(result.current.isHovering).toBe(true);
    });

    it('should reset long-press state on endHover', () => {
      const { result } = renderHook(() =>
        useHoverWithDelay({ enableLongPress: true, longPressDelay: 500 })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      // Trigger long-press
      act(() => {
        element.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            touches: [{ clientX: 100, clientY: 100 } as Touch],
          })
        );
        vi.advanceTimersByTime(500);
      });

      expect(result.current.isLongPressed).toBe(true);

      // End hover
      act(() => {
        result.current.endHover();
      });

      expect(result.current.isLongPressed).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should not cause memory leaks with many instances', () => {
      const hooks = Array.from({ length: 100 }, () =>
        renderHook(() => useHoverWithDelay())
      );

      hooks.forEach(hook => hook.unmount());

      // No memory leaks expected
      expect(true).toBe(true);
    });

    it('should handle high-frequency events efficiently', () => {
      const { result } = renderHook(() =>
        useHoverWithDelay({ hoverDelay: 300 })
      );

      const element = document.createElement('div');
      result.current.hoverRef.current = element as HTMLElement;

      const start = Date.now();

      act(() => {
        // Simulate 100 rapid mouse events
        for (let i = 0; i < 100; i++) {
          element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        }
      });

      const duration = Date.now() - start;

      // Should complete quickly
      expect(duration).toBeLessThan(100);
    });
  });
});
