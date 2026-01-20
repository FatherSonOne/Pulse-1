# Pulse Messages - Testing Guide

**Version**: 1.0
**Last Updated**: 2026-01-19

---

## Table of Contents

1. [Overview](#overview)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [E2E Testing](#e2e-testing)
5. [Test Coverage](#test-coverage)
6. [Best Practices](#best-practices)

---

## Overview

### Testing Stack

- **Framework**: Jest
- **React Testing**: React Testing Library
- **E2E**: Cypress (optional)
- **Mocking**: Jest mocks
- **Coverage**: Jest coverage reports

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm run test:coverage

# Run specific test file
npm test -- MessagesSplitView.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="should send message"
```

---

## Unit Testing

### Component Tests

**Example: Testing a Message Component**

```typescript
// Message.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Message } from './Message';

describe('Message Component', () => {
  const mockMessage = {
    id: 'msg-1',
    content: 'Hello World',
    sender_id: 'user-1',
    sender_name: 'John Doe',
    created_at: '2026-01-19T10:00:00Z',
    reactions: []
  };

  it('should render message content', () => {
    render(
      <Message
        message={mockMessage}
        currentUserId="user-2"
        onReact={jest.fn()}
      />
    );

    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should show reaction button on hover', () => {
    render(
      <Message
        message={mockMessage}
        currentUserId="user-2"
        onReact={jest.fn()}
      />
    );

    const messageEl = screen.getByText('Hello World');
    fireEvent.mouseEnter(messageEl);

    expect(screen.getByLabelText('Add reaction')).toBeInTheDocument();
  });

  it('should call onReact when reaction added', () => {
    const onReact = jest.fn();
    render(
      <Message
        message={mockMessage}
        currentUserId="user-2"
        onReact={onReact}
      />
    );

    fireEvent.mouseEnter(screen.getByText('Hello World'));
    fireEvent.click(screen.getByLabelText('React with 👍'));

    expect(onReact).toHaveBeenCalledWith('msg-1', '👍');
  });
});
```

### Hook Tests

**Example: Testing Custom Hook**

```typescript
// useToolsStorage.test.ts
import { renderHook, act } from '@testing-library/react';
import { useToolsStorage } from './useToolsStorage';

describe('useToolsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should track tool usage', () => {
    const { result } = renderHook(() => useToolsStorage());

    act(() => {
      result.current.trackToolUsage('ai-coach');
    });

    expect(result.current.recentTools).toContain('ai-coach');
    expect(result.current.getToolUsageCount('ai-coach')).toBe(1);
  });

  it('should toggle pin tool', () => {
    const { result } = renderHook(() => useToolsStorage());

    act(() => {
      result.current.togglePinTool('smart-compose');
    });

    expect(result.current.isToolPinned('smart-compose')).toBe(true);

    act(() => {
      result.current.togglePinTool('smart-compose');
    });

    expect(result.current.isToolPinned('smart-compose')).toBe(false);
  });
});
```

### Service Tests

**Example: Testing Service Layer**

```typescript
// messageChannelService.test.ts
import { messageChannelService } from './messageChannelService';
import { supabase } from './supabaseClient';

jest.mock('./supabaseClient');

describe('messageChannelService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockMessage = {
        id: 'msg-1',
        channel_id: 'channel-1',
        sender_id: 'user-1',
        content: 'Test message'
      };

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [mockMessage],
            error: null
          })
        })
      });

      const result = await messageChannelService.sendMessage({
        channelId: 'channel-1',
        senderId: 'user-1',
        senderName: 'Test User',
        content: 'Test message'
      });

      expect(result).toEqual(mockMessage);
      expect(supabase.from).toHaveBeenCalledWith('channel_messages');
    });

    it('should throw error on failure', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        })
      });

      await expect(
        messageChannelService.sendMessage({
          channelId: 'channel-1',
          senderId: 'user-1',
          senderName: 'Test User',
          content: 'Test message'
        })
      ).rejects.toThrow('Failed to send message');
    });
  });
});
```

---

## Integration Testing

### Context Provider Tests

**Example: Testing Context Integration**

```typescript
// MessagesContext.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { MessagesProvider, useMessages } from './MessagesContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MessagesProvider>{children}</MessagesProvider>
);

describe('MessagesContext', () => {
  it('should load threads on mount', async () => {
    const { result } = renderHook(() => useMessages(), { wrapper });

    await waitFor(() => {
      expect(result.current.threads.length).toBeGreaterThan(0);
    });
  });

  it('should send message and update state', async () => {
    const { result } = renderHook(() => useMessages(), { wrapper });

    await act(async () => {
      await result.current.sendPulseMessage('channel-1', 'Hello');
    });

    await waitFor(() => {
      const messages = result.current.pulseConversations.find(
        c => c.id === 'channel-1'
      )?.messages;
      expect(messages).toContainEqual(
        expect.objectContaining({ content: 'Hello' })
      );
    });
  });
});
```

### Component Integration Tests

**Example: Testing Message Flow**

```typescript
// MessageFlow.test.tsx
import { render, screen, waitFor, userEvent } from '@testing-library/react';
import { MessagesSplitView } from './MessagesSplitView';
import { TestProviders } from './test-utils';

describe('Message Flow Integration', () => {
  it('should send message and receive real-time update', async () => {
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MessagesSplitView
          channels={mockChannels}
          messages={mockMessages}
          currentUserId="user-1"
          onSendMessage={mockSendMessage}
        />
      </TestProviders>
    );

    // Select channel
    await user.click(screen.getByText('General'));

    // Type message
    const input = screen.getByPlaceholderText('Type a message...');
    await user.type(input, 'Hello everyone');

    // Send message
    await user.click(screen.getByText('Send'));

    // Verify message appears
    await waitFor(() => {
      expect(screen.getByText('Hello everyone')).toBeInTheDocument();
    });

    // Verify optimistic update
    expect(mockSendMessage).toHaveBeenCalledWith('channel-1', 'Hello everyone');
  });
});
```

---

## E2E Testing

### Cypress Setup

```bash
npm install --save-dev cypress
```

**cypress.config.ts**:
```typescript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
  },
});
```

### E2E Test Example

```typescript
// cypress/e2e/messaging.cy.ts
describe('Messaging Flow', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.login('user@example.com', 'password');
  });

  it('should send and receive message', () => {
    // Navigate to channel
    cy.get('[data-testid="thread-list"]')
      .contains('General')
      .click();

    // Type message
    cy.get('[data-testid="message-input"]')
      .type('Hello from Cypress!');

    // Send message
    cy.get('[data-testid="send-button"]').click();

    // Verify message appears
    cy.get('[data-testid="message-list"]')
      .should('contain', 'Hello from Cypress!');
  });

  it('should add reaction to message', () => {
    cy.get('[data-testid="message-item"]').first().as('message');

    // Hover over message
    cy.get('@message').trigger('mouseenter');

    // Click reaction
    cy.get('[data-testid="reaction-bar"]')
      .find('[data-emoji="👍"]')
      .click();

    // Verify reaction added
    cy.get('@message')
      .find('[data-testid="reactions"]')
      .should('contain', '👍 1');
  });
});
```

---

## Test Coverage

### Viewing Coverage

```bash
npm run test:coverage
```

**Output**:
```
--------------------------|---------|----------|---------|---------|
File                      | % Stmts | % Branch | % Funcs | % Lines |
--------------------------|---------|----------|---------|---------|
All files                 |   82.45 |    75.32 |   80.12 |   82.45 |
 components/Messages      |   85.23 |    78.45 |   82.34 |   85.23 |
  MessagesSplitView.tsx   |   90.12 |    85.34 |   88.45 |   90.12 |
  ThreadListPanel.tsx     |   88.45 |    80.23 |   85.12 |   88.45 |
  ConversationPanel.tsx   |   82.34 |    75.45 |   80.23 |   82.34 |
 services                 |   78.34 |    70.23 |   75.45 |   78.34 |
  messageChannelService.ts|   80.45 |    72.34 |   78.23 |   80.45 |
--------------------------|---------|----------|---------|---------|
```

### Coverage Requirements

- **Minimum Overall**: 70%
- **New Features**: 80%
- **Critical Paths**: 90%
- **Services**: 85%
- **Components**: 75%

### Improving Coverage

```bash
# Generate detailed coverage report
npm run test:coverage -- --verbose

# View HTML report
open coverage/lcov-report/index.html
```

---

## Best Practices

### 1. Test Naming

```typescript
// ✅ Good - Descriptive test names
it('should send message when Enter key is pressed');
it('should show error when message is empty');
it('should add reaction on hover and click');

// ❌ Bad - Vague test names
it('test 1');
it('works correctly');
it('handles input');
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should toggle focus mode', () => {
  // Arrange
  const { result } = renderHook(() => useFocusMode());

  // Act
  act(() => {
    result.current.startFocusMode('thread-1');
  });

  // Assert
  expect(result.current.isActive).toBe(true);
  expect(result.current.threadId).toBe('thread-1');
});
```

### 3. Clean Up After Tests

```typescript
afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  cleanup(); // React Testing Library cleanup
});
```

### 4. Test User Interactions

```typescript
// Use userEvent for realistic interactions
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');
await user.hover(element);
```

### 5. Avoid Implementation Details

```typescript
// ✅ Good - Test behavior
expect(screen.getByText('Hello')).toBeInTheDocument();

// ❌ Bad - Test implementation
expect(component.state.message).toBe('Hello');
```

### 6. Mock External Dependencies

```typescript
jest.mock('./supabaseClient');
jest.mock('./geminiService');

// Mock timers for time-dependent tests
jest.useFakeTimers();
act(() => {
  jest.advanceTimersByTime(300);
});
```

---

## Debugging Tests

### Debug Single Test

```bash
npm test -- --testNamePattern="should send message" --watch
```

### Debug with VS Code

`.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Jest Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test", "--", "--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Use screen.debug()

```typescript
import { screen } from '@testing-library/react';

it('should render correctly', () => {
  render(<Component />);
  screen.debug(); // Prints DOM to console
});
```

---

**See Also**:
- [Contributing Guide](./CONTRIBUTING.md)
- [Development Setup](./DEVELOPMENT_SETUP.md)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-19
