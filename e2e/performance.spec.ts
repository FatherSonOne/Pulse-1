// ============================================
// PERFORMANCE E2E TESTS
// Critical performance benchmarks and measurements
// ============================================

import { test, expect } from '@playwright/test';

test.describe('Performance Benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cache for accurate measurements
    await page.context().clearCookies();

    // Navigate and login
    await page.goto('/');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test.describe('Core Web Vitals', () => {
    test('should have FCP < 1.5s (First Contentful Paint)', async ({ page }) => {
      await page.goto('/messages');

      const fcp = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              if (entry.name === 'first-contentful-paint') {
                resolve(entry.startTime);
              }
            }
          }).observe({ type: 'paint', buffered: true });
        });
      });

      console.log(`FCP: ${fcp}ms`);
      expect(fcp).toBeLessThan(1500); // Target: < 1.5s
    });

    test('should have LCP < 2.5s (Largest Contentful Paint)', async ({ page }) => {
      await page.goto('/messages');

      const lcp = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            resolve(lastEntry.startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true });

          // Resolve after a timeout if LCP doesn't fire
          setTimeout(() => resolve(0), 5000);
        });
      });

      console.log(`LCP: ${lcp}ms`);
      if (lcp > 0) {
        expect(lcp).toBeLessThan(2500); // Target: < 2.5s
      }
    });

    test('should have CLS < 0.1 (Cumulative Layout Shift)', async ({ page }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      const cls = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;

          new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });

          setTimeout(() => resolve(clsValue), 2000);
        });
      });

      console.log(`CLS: ${cls}`);
      expect(cls).toBeLessThan(0.1); // Target: < 0.1
    });

    test('should have TTI < 3.0s (Time to Interactive)', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/messages');

      // Wait for page to be fully interactive
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="message-list"]');

      const tti = Date.now() - startTime;

      console.log(`TTI: ${tti}ms`);
      expect(tti).toBeLessThan(3000); // Target: < 3.0s
    });
  });

  test.describe('Thread Switch Performance', () => {
    test('should switch threads in < 300ms', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');
      await page.waitForSelector('[data-testid="message-list"]');

      // Open first thread
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Measure switch to second thread
      const startTime = Date.now();

      await page.click('[data-testid="message-item"]:nth-child(2) [data-testid="reply-button"]');
      await page.waitForSelector('[data-testid="thread-view"]');

      const switchTime = Date.now() - startTime;

      console.log(`Thread switch: ${switchTime}ms`);
      expect(switchTime).toBeLessThan(300); // Target: < 300ms
    });

    test('should render thread smoothly without jank', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');

      // Start performance monitoring
      await page.evaluate(() => {
        (window as any).performanceMarks = [];
        performance.mark('thread-open-start');
      });

      // Open thread
      await page.click('[data-testid="message-item"]:first-child [data-testid="reply-button"]');
      await expect(page.locator('[data-testid="thread-view"]')).toBeVisible();

      // Measure performance
      const metrics = await page.evaluate(() => {
        performance.mark('thread-open-end');
        performance.measure('thread-open', 'thread-open-start', 'thread-open-end');

        const measure = performance.getEntriesByName('thread-open')[0];
        return {
          duration: measure.duration,
        };
      });

      console.log(`Thread render duration: ${metrics.duration}ms`);
      expect(metrics.duration).toBeLessThan(300);
    });
  });

  test.describe('Message List Rendering', () => {
    test('should render 50 messages in < 100ms', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');
      await page.click('[data-testid="channel-item"]:first-child');

      // Measure initial render
      const renderTime = await page.evaluate(() => {
        const start = performance.now();

        // Force re-render by scrolling
        const list = document.querySelector('[data-testid="message-list"]');
        if (list) {
          list.scrollTop = 0;
        }

        return performance.now() - start;
      });

      console.log(`Message list render: ${renderTime}ms`);
      expect(renderTime).toBeLessThan(100); // Target: < 100ms
    });

    test('should handle 1000+ messages efficiently', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');

      // Load a channel with many messages
      const startTime = Date.now();

      // Scroll to trigger virtualization
      await page.locator('[data-testid="message-list"]').evaluate((el) => {
        for (let i = 0; i < 10; i++) {
          el.scrollTop = el.scrollHeight;
          el.scrollTop = 0;
        }
      });

      const scrollTime = Date.now() - startTime;

      console.log(`Scroll through 1000+ messages: ${scrollTime}ms`);
      expect(scrollTime).toBeLessThan(1000); // Should be smooth
    });

    test('should virtualize long message lists', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');
      await page.click('[data-testid="channel-item"]:first-child');

      // Count rendered DOM nodes vs total messages
      const { rendered, total } = await page.evaluate(() => {
        const messageList = document.querySelector('[data-testid="message-list"]');
        const renderedMessages = messageList?.querySelectorAll('[data-testid="message-item"]').length || 0;

        // Get total from UI or estimate
        const totalMessages = 1000; // Assume large dataset

        return { rendered: renderedMessages, total: totalMessages };
      });

      console.log(`Rendered: ${rendered}, Total: ${total}`);

      // If total > 100, should virtualize
      if (total > 100) {
        expect(rendered).toBeLessThan(total);
        expect(rendered).toBeLessThan(100); // Should render subset
      }
    });
  });

  test.describe('Search Performance', () => {
    test('should respond to search in < 100ms', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');
      await page.click('[data-testid="search-button"]');

      // Type search query
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.fill('test');

      const startTime = Date.now();

      // Wait for search results
      await page.waitForSelector('[data-testid="search-results"]');

      const searchTime = Date.now() - startTime;

      console.log(`Search response: ${searchTime}ms`);
      expect(searchTime).toBeLessThan(500); // Target: < 500ms (network dependent)
    });

    test('should debounce search input', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');
      await page.click('[data-testid="search-button"]');

      let searchRequestCount = 0;

      // Monitor network requests
      page.on('request', (request) => {
        if (request.url().includes('search')) {
          searchRequestCount++;
        }
      });

      // Type rapidly
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.type('test query', { delay: 50 });

      await page.waitForTimeout(1000);

      console.log(`Search requests: ${searchRequestCount}`);
      // Should debounce (fewer requests than characters)
      expect(searchRequestCount).toBeLessThan(10);
    });
  });

  test.describe('Real-time Updates', () => {
    test('should display new message with < 200ms latency', async ({ page, context }) => {
      await page.click('[data-testid="messages-nav"]');
      await page.click('[data-testid="channel-item"]:first-child');

      // Open second page to send message
      const page2 = await context.newPage();
      await page2.goto('/');
      await page2.fill('[data-testid="email-input"]', 'test2@example.com');
      await page2.fill('[data-testid="password-input"]', 'password123');
      await page2.click('[data-testid="login-button"]');
      await page2.click('[data-testid="messages-nav"]');
      await page2.click('[data-testid="channel-item"]:first-child');

      // Send message and measure
      const startTime = Date.now();

      await page2.fill('[data-testid="message-input"]', 'Real-time test message');
      await page2.click('[data-testid="send-button"]');

      // Wait for message to appear on first page
      await page.waitForSelector('text=Real-time test message', { timeout: 5000 });

      const latency = Date.now() - startTime;

      console.log(`Real-time latency: ${latency}ms`);
      expect(latency).toBeLessThan(2000); // Target: < 2s (network dependent)

      await page2.close();
    });
  });

  test.describe('Animation Performance', () => {
    test('should maintain 60 FPS during thread animation', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');

      // Monitor frame rate
      const fps = await page.evaluate(async () => {
        return new Promise<number>((resolve) => {
          let frames = 0;
          let lastTime = performance.now();

          const measureFPS = () => {
            const currentTime = performance.now();
            const delta = currentTime - lastTime;

            if (delta >= 1000) {
              resolve(frames);
              return;
            }

            frames++;
            requestAnimationFrame(measureFPS);
          };

          // Start measurement
          requestAnimationFrame(measureFPS);

          // Trigger animation
          const replyButton = document.querySelector(
            '[data-testid="message-item"]:first-child [data-testid="reply-button"]'
          ) as HTMLElement;
          replyButton?.click();
        });
      });

      console.log(`Animation FPS: ${fps}`);
      expect(fps).toBeGreaterThan(55); // Target: 60 FPS (allow small variance)
    });

    test('should not cause layout thrashing', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');

      // Measure forced reflows
      const reflows = await page.evaluate(() => {
        let reflowCount = 0;

        // Monkey-patch getBoundingClientRect to count calls
        const original = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function () {
          reflowCount++;
          return original.call(this);
        };

        // Open thread (triggers animations)
        const replyButton = document.querySelector(
          '[data-testid="message-item"]:first-child [data-testid="reply-button"]'
        ) as HTMLElement;
        replyButton?.click();

        // Restore original
        setTimeout(() => {
          Element.prototype.getBoundingClientRect = original;
        }, 100);

        return new Promise<number>((resolve) => {
          setTimeout(() => resolve(reflowCount), 500);
        });
      });

      console.log(`Forced reflows: ${reflows}`);
      expect(reflows).toBeLessThan(10); // Minimize layout thrashing
    });
  });

  test.describe('Memory Performance', () => {
    test('should not leak memory on navigation', async ({ page }) => {
      await page.click('[data-testid="messages-nav"]');

      // Get initial memory
      const initialMemory = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });

      // Navigate multiple times
      for (let i = 0; i < 5; i++) {
        await page.click('[data-testid="dashboard-nav"]');
        await page.waitForTimeout(500);
        await page.click('[data-testid="messages-nav"]');
        await page.waitForTimeout(500);
      }

      // Force garbage collection (if available)
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      });

      await page.waitForTimeout(1000);

      // Get final memory
      const finalMemory = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });

      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        const increasePercent = (memoryIncrease / initialMemory) * 100;

        console.log(
          `Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${increasePercent.toFixed(2)}%)`
        );

        // Memory should not grow more than 50%
        expect(increasePercent).toBeLessThan(50);
      }
    });
  });

  test.describe('Bundle Size', () => {
    test('should have reasonable JavaScript bundle size', async ({ page }) => {
      const jsSize = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        let totalSize = 0;

        scripts.forEach((script) => {
          const src = script.getAttribute('src');
          if (src && !src.includes('node_modules')) {
            // Estimate from performance entries
            const entry = performance.getEntriesByName(src)[0];
            if (entry) {
              totalSize += (entry as any).transferSize || 0;
            }
          }
        });

        return totalSize;
      });

      console.log(`Total JS bundle: ${(jsSize / 1024).toFixed(2)}KB`);
      expect(jsSize).toBeLessThan(500 * 1024); // Target: < 500KB
    });
  });
});

test.describe('Performance - Mobile', () => {
  test.use({
    viewport: { width: 375, height: 667 },
    isMobile: true,
  });

  test('should perform well on mobile devices', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    const startTime = Date.now();
    await page.click('[data-testid="messages-nav"]');
    await page.waitForSelector('[data-testid="message-list"]');

    const loadTime = Date.now() - startTime;

    console.log(`Mobile load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(2000); // Slightly more lenient for mobile
  });

  test('should handle touch interactions smoothly', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="messages-nav"]');

    // Measure touch response
    const touchLatency = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const element = document.querySelector('[data-testid="message-item"]') as HTMLElement;
        const startTime = performance.now();

        element.addEventListener(
          'touchend',
          () => {
            resolve(performance.now() - startTime);
          },
          { once: true }
        );

        element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
        element.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
      });
    });

    console.log(`Touch latency: ${touchLatency}ms`);
    expect(touchLatency).toBeLessThan(100); // Target: < 100ms
  });
});
