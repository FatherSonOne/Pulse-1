# ToolsPanel Component

A reorganized, feature-rich tools panel with 4 categories, contextual suggestions, and quick access functionality.

## Features

### 1. Four-Category Organization

Tools are organized into intuitive categories:

- **AI Tools** (Purple): AI Coach, Smart Compose, Sentiment Analysis, Brainstorm Assistant, etc.
- **Content Creation** (Blue): Templates, Voice Recorder, Draft Manager, File Attachments, etc.
- **Analysis** (Green): Engagement Scoring, Response Time Tracker, Sentiment Timeline, etc.
- **Utilities** (Amber): Search & Filter, Message Pinning, Keyboard Shortcuts, Settings, etc.

### 2. Smart Search

- Fuzzy search across tool names, descriptions, and keywords
- Keyboard shortcut: `Cmd/Ctrl + K` to focus search
- Real-time results count
- Clear button for quick reset

### 3. Contextual Suggestions

Intelligent tool suggestions based on:
- Time of day (morning productivity, afternoon analysis, evening planning)
- Recently used tools (suggests related tools from same category)
- Usage patterns

### 4. Quick Access Bar

- Floating bar with up to 3 most recent/pinned tools
- Persists across sessions (localStorage)
- Desktop: Bottom-right floating bar
- Mobile: Bottom-right compact bar

### 5. Usage Statistics

Tracks and displays:
- Usage count per tool
- Last used timestamp
- Most frequently used tools
- Recent tools history (last 3)

### 6. Pin Favorite Tools

- Pin frequently used tools for quick access
- Pinned tools appear in Quick Access Bar
- Pin indicator on tool cards
- Persists in localStorage

### 7. Mobile Responsive

- Bottom sheet design for mobile (70vh height)
- Drag handle for easy dismissal
- Touch-optimized buttons (44px minimum)
- Swipe-friendly interface
- Responsive grid layout

### 8. Accessibility (WCAG 2.1 AA)

- Full keyboard navigation
- ARIA labels and roles
- Focus indicators
- Screen reader support
- High contrast mode support
- Reduced motion support

## Usage

### Basic Usage

```tsx
import { ToolsPanel } from '@/components/ToolsPanel';

function MyComponent() {
  const handleToolSelect = (toolId: string) => {
    console.log('Tool selected:', toolId);
    // Handle tool activation
  };

  return (
    <ToolsPanel
      onToolSelect={handleToolSelect}
      onClose={() => console.log('Panel closed')}
    />
  );
}
```

### Mobile Usage

```tsx
<ToolsPanel
  onToolSelect={handleToolSelect}
  isMobile={true}
/>
```

### Standalone Components

```tsx
import {
  CategoryTabs,
  SearchBox,
  ToolCard,
  QuickAccessBar
} from '@/components/ToolsPanel';

// Use individual components as needed
<CategoryTabs
  activeCategory="ai"
  onCategoryChange={setCategory}
  toolCounts={{ ai: 8, content: 11, analysis: 10, utilities: 10 }}
/>
```

## Component Structure

```
ToolsPanel/
├── ToolsPanel.tsx              # Main container component
├── CategoryTabs.tsx            # Category navigation tabs
├── ToolCard.tsx                # Individual tool card
├── SearchBox.tsx               # Search input with fuzzy matching
├── ContextualSuggestions.tsx   # Smart tool suggestions
├── QuickAccessBar.tsx          # Floating quick access bar
├── useToolsStorage.ts          # localStorage hook for persistence
├── toolsData.ts                # Tool definitions and utilities
├── types.ts                    # TypeScript type definitions
├── index.ts                    # Module exports
└── README.md                   # This file
```

## Data Structure

### Tool Definition

```typescript
interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string; // Font Awesome class
  category: 'ai' | 'content' | 'analysis' | 'utilities';
  keywords?: string[]; // For search
  isNew?: boolean;
  isPro?: boolean;
  requiresApiKey?: boolean;
  apiKeyName?: string;
}
```

### Adding a New Tool

1. Open `toolsData.ts`
2. Add your tool to the `TOOLS` array:

```typescript
{
  id: 'my-new-tool',
  name: 'My New Tool',
  description: 'Does something awesome',
  icon: 'fa-star',
  category: 'utilities',
  keywords: ['awesome', 'tool', 'new']
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Focus search box |
| `Alt + 1` | Show all tools |
| `Alt + 2` | Show AI tools |
| `Alt + 3` | Show content tools |
| `Alt + 4` | Show analysis tools |
| `Alt + 5` | Show utilities |
| `Escape` | Close panel |
| `Tab` | Navigate between elements |
| `Arrow Keys` | Navigate category tabs |
| `Enter/Space` | Select tool or category |

## localStorage Data

The component stores the following data in localStorage:

```json
{
  "recentTools": ["tool-id-1", "tool-id-2", "tool-id-3"],
  "pinnedTools": ["tool-id-4", "tool-id-5"],
  "usageStats": {
    "tool-id-1": {
      "toolId": "tool-id-1",
      "usageCount": 15,
      "lastUsed": 1642512000000
    }
  }
}
```

Key: `pulse-tools-data`

## Styling

The component uses Tailwind CSS with design tokens from `ai-messaging.css`:

```css
/* Category Colors */
--ai-category-purple: #8B5CF6;
--ai-category-blue: #3B82F6;
--ai-category-green: #10B981;
--ai-category-amber: #F59E0B;

/* Spacing */
--ai-space-1: 0.25rem;
--ai-space-2: 0.5rem;
--ai-space-3: 0.75rem;
--ai-space-4: 1rem;

/* Animation */
--animation-fast: 150ms;
--animation-base: 200ms;
--animation-slow: 300ms;
```

## Performance Optimizations

1. **Memoization**: Tool filtering and categorization are memoized
2. **Lazy Loading**: Icons loaded on-demand
3. **Debounced Search**: 200ms debounce on search input
4. **Virtual Scrolling**: Can be enabled for large tool lists (>50 tools)
5. **localStorage Caching**: Reduces computation on mount

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility Features

- **Keyboard Navigation**: Full keyboard support throughout
- **Screen Readers**: Proper ARIA labels and live regions
- **Focus Management**: Clear focus indicators
- **High Contrast**: Supports prefers-contrast media query
- **Reduced Motion**: Respects prefers-reduced-motion
- **Touch Targets**: Minimum 44x44px on mobile

## Testing

```bash
# Unit tests
npm test src/components/ToolsPanel

# E2E tests
npm run e2e:tools-panel

# Accessibility tests
npm run a11y:tools-panel
```

## Migration Guide

### From Old Tools Component

The new ToolsPanel maintains compatibility with the existing Tools component. To migrate:

1. Import the new component:
```tsx
import { ToolsPanel } from '@/components/ToolsPanel';
```

2. Replace the old component:
```tsx
// Old
<Tools apiKey={apiKey} />

// New
<ToolsPanel onToolSelect={handleToolSelect} />
```

3. Handle tool selection:
```tsx
const handleToolSelect = (toolId: string) => {
  // Map toolId to existing tool handler
  switch (toolId) {
    case 'deep-reasoner':
      setActiveTool('reason');
      break;
    case 'code-studio':
      setActiveTool('code');
      break;
    // ... etc
  }
};
```

## Future Enhancements

- [ ] Tool recommendations based on ML
- [ ] Custom tool categories
- [ ] Tool usage analytics dashboard
- [ ] Collaborative tool sharing
- [ ] Cloud sync for settings
- [ ] Tool marketplace integration
- [ ] Voice command support
- [ ] Gesture controls (mobile)

## Contributing

When adding new tools or features:

1. Follow the existing code structure
2. Add TypeScript types
3. Include accessibility features
4. Add tests
5. Update documentation
6. Follow the design system tokens

## License

Part of the Pulse messaging platform.

---

**Built with**: React, TypeScript, Tailwind CSS
**Design System**: Based on UI_DESIGN_SPECIFICATIONS.md
**Last Updated**: January 19, 2026
