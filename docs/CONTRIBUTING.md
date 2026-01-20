# Contributing to Pulse Messages

**Version**: 1.0
**Last Updated**: 2026-01-19

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Process](#development-process)
3. [Code Standards](#code-standards)
4. [Pull Request Process](#pull-request-process)
5. [Testing Requirements](#testing-requirements)
6. [Documentation](#documentation)

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Git 2.40+
- Code editor (VS Code recommended)
- Supabase account
- Google Cloud account (for Gemini API)

### Fork and Clone

```bash
# Fork repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/pulse-messages.git
cd pulse-messages

# Add upstream remote
git remote add upstream https://github.com/pulse/pulse-messages.git
```

### Install Dependencies

```bash
npm install
```

### Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### Run Development Server

```bash
npm run dev
# Open http://localhost:5173
```

---

## Development Process

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

**Branch Naming**:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Test additions

### 2. Make Changes

- Follow code standards (see below)
- Write tests for new features
- Update documentation
- Keep commits focused and atomic

### 3. Commit Changes

```bash
git add .
git commit -m "feat: add hover reactions system"
```

**Commit Message Format**:
```
<type>: <subject>

<body>

<footer>
```

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code restructuring
- `test` - Tests
- `chore` - Maintenance

**Example**:
```
feat: add hover reaction trigger

Implement HoverReactionTrigger component with:
- 300ms hover delay
- 500ms long-press for mobile
- Smart positioning above/below
- Haptic feedback support

Closes #123
```

### 4. Push to Fork

```bash
git push origin feature/your-feature-name
```

### 5. Create Pull Request

1. Go to GitHub repository
2. Click "New Pull Request"
3. Select your branch
4. Fill out PR template
5. Request review

---

## Code Standards

### TypeScript

```typescript
// ✅ Good
interface UserProps {
  name: string;
  age: number;
  onUpdate: (user: User) => void;
}

const MyComponent: React.FC<UserProps> = ({ name, age, onUpdate }) => {
  return <div>{name}, {age}</div>;
};

// ❌ Bad
const MyComponent = (props: any) => {
  return <div>{props.name}, {props.age}</div>;
};
```

### React Components

```typescript
// ✅ Good - Functional component with TypeScript
import React, { useState, useCallback } from 'react';

interface MessageProps {
  content: string;
  onReact: (emoji: string) => void;
}

export const Message: React.FC<MessageProps> = React.memo(({ content, onReact }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleReact = useCallback((emoji: string) => {
    onReact(emoji);
  }, [onReact]);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {content}
      {isHovered && <button onClick={() => handleReact('👍')}>👍</button>}
    </div>
  );
});

Message.displayName = 'Message';
```

### Naming Conventions

- **Components**: PascalCase (e.g., `MessageBubble.tsx`)
- **Files**: camelCase (e.g., `messageService.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_MESSAGE_LENGTH`)
- **Variables**: camelCase (e.g., `currentUser`)
- **Types/Interfaces**: PascalCase (e.g., `MessageChannel`)

### File Organization

```
src/
├── components/
│   └── Feature/
│       ├── Component.tsx
│       ├── Component.test.tsx
│       ├── Component.css (if needed)
│       ├── types.ts
│       └── index.ts
├── hooks/
│   └── useFeature.ts
├── services/
│   ├── featureService.ts
│   └── featureService.test.ts
├── contexts/
│   └── FeatureContext.tsx
└── types/
    └── feature.ts
```

### Code Quality

**ESLint**: Fix all linting errors before committing
```bash
npm run lint
npm run lint:fix
```

**Prettier**: Format code automatically
```bash
npm run format
```

**Type Checking**: Ensure no TypeScript errors
```bash
npm run type-check
```

---

## Pull Request Process

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally

## Screenshots (if applicable)
Add screenshots here

## Related Issues
Closes #123
```

### Review Process

1. **Automated Checks**: CI must pass
2. **Code Review**: At least 1 approval required
3. **Testing**: All tests must pass
4. **Documentation**: Docs must be updated

### Merge Requirements

- ✅ All CI checks passing
- ✅ 1+ approving review
- ✅ No merge conflicts
- ✅ Branch up to date with main
- ✅ All conversations resolved

---

## Testing Requirements

### Unit Tests

```typescript
// Component.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Message } from './Message';

describe('Message', () => {
  it('should render message content', () => {
    render(<Message content="Hello" onReact={jest.fn()} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should show reaction button on hover', async () => {
    render(<Message content="Hello" onReact={jest.fn()} />);

    const message = screen.getByText('Hello');
    fireEvent.mouseEnter(message);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should call onReact when reaction clicked', () => {
    const onReact = jest.fn();
    render(<Message content="Hello" onReact={onReact} />);

    fireEvent.mouseEnter(screen.getByText('Hello'));
    fireEvent.click(screen.getByRole('button'));

    expect(onReact).toHaveBeenCalledWith('👍');
  });
});
```

### Integration Tests

```typescript
// messageFlow.test.ts
describe('Message Flow', () => {
  it('should send message and add reaction', async () => {
    const { user } = setup();

    // Send message
    await user.type(screen.getByPlaceholderText('Type message'), 'Hello');
    await user.click(screen.getByText('Send'));

    // Verify message appears
    expect(await screen.findByText('Hello')).toBeInTheDocument();

    // Add reaction
    await user.hover(screen.getByText('Hello'));
    await user.click(screen.getByLabelText('React with 👍'));

    // Verify reaction added
    expect(await screen.findByText('👍 1')).toBeInTheDocument();
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- Message.test.tsx

# Watch mode
npm test -- --watch
```

### Coverage Requirements

- **Minimum**: 70% overall
- **New Features**: 80% coverage required
- **Critical Paths**: 90% coverage required

---

## Documentation

### Code Comments

```typescript
/**
 * Generates smart reply suggestions using AI
 *
 * @param messageContent - The message to generate replies for
 * @param context - Previous conversation messages for context
 * @returns Promise resolving to array of 3 suggested replies
 * @throws {APIError} If API call fails or rate limited
 *
 * @example
 * ```typescript
 * const replies = await generateSmartReplies(
 *   'What time works for you?',
 *   ['Let\'s meet tomorrow']
 * );
 * // Returns: ['2pm works', '3pm would be great', 'Morning preferred']
 * ```
 */
async function generateSmartReplies(
  messageContent: string,
  context: string[]
): Promise<string[]> {
  // Implementation
}
```

### Component Documentation

```typescript
/**
 * HoverReactionTrigger - Wrapper that adds hover/long-press reactions
 *
 * Desktop: Shows reaction bar after 300ms hover
 * Mobile: Shows reaction bar after 500ms long-press
 *
 * @example
 * ```tsx
 * <HoverReactionTrigger
 *   messageId="msg-123"
 *   isMe={false}
 *   onReact={handleReaction}
 * >
 *   <MessageBubble message={message} />
 * </HoverReactionTrigger>
 * ```
 */
```

### README Updates

When adding features, update:
- Feature list in main README
- Setup instructions if needed
- Usage examples
- API documentation

---

## Code of Conduct

### Our Standards

- **Be respectful**: Treat everyone with respect
- **Be collaborative**: Work together constructively
- **Be professional**: Focus on what's best for the project
- **Be patient**: Help others learn and grow

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or inflammatory comments
- Personal attacks
- Spam or off-topic discussions

### Reporting

Report issues to: conduct@pulse.example.com

---

## Getting Help

### Resources

- **Documentation**: See `/docs` folder
- **Examples**: See `/examples` folder
- **Issues**: Check existing issues on GitHub
- **Discussions**: Join GitHub Discussions

### Contact

- **Questions**: discussions.pulse.example.com
- **Bugs**: github.com/pulse/pulse-messages/issues
- **Security**: security@pulse.example.com

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (Proprietary).

---

**Thank you for contributing to Pulse Messages!**

**Document Version**: 1.0
**Last Updated**: 2026-01-19
