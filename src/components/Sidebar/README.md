# Sidebar Tabs Component

Modern, accessible sidebar navigation system for Pulse Messages with support for Messages, Tools, CRM, and Analytics tabs.

## Quick Start

```typescript
import { SidebarTabs } from '@/components/Sidebar';

function App() {
  return (
    <div className="flex h-screen">
      <SidebarTabs
        defaultTab="messages"
        onTabChange={(tab) => console.log('Active tab:', tab)}
        onToolSelect={(toolId) => handleToolSelection(toolId)}
      />
      <main className="flex-1">
        {/* Your content here */}
      </main>
    </div>
  );
}
```

## Features

- Four main tabs: Messages, Tools, CRM, Analytics
- Keyboard shortcuts: `Cmd+B` (toggle), `Cmd+1-4` (switch tabs)
- LocalStorage persistence for last active tab
- Smooth animations with Framer Motion
- Mobile-responsive with bottom tab bar
- WCAG 2.1 AA accessibility compliant
- Lazy loading for better performance
- Dark mode support

## Props

### SidebarTabs

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultTab` | `'messages' \| 'tools' \| 'crm' \| 'analytics'` | `'messages'` | Initial active tab |
| `onTabChange` | `(tab: SidebarTabType) => void` | - | Callback when tab changes |
| `onToolSelect` | `(toolId: string) => void` | - | Callback when tool is selected from Tools tab |
| `className` | `string` | `''` | Additional CSS classes |
| `isMobile` | `boolean` | `false` | Enable mobile layout |

## Keyboard Shortcuts

- `Cmd+B` / `Ctrl+B` - Toggle sidebar collapse/expand
- `Cmd+1` - Switch to Messages tab
- `Cmd+2` - Switch to Tools tab
- `Cmd+3` - Switch to CRM tab
- `Cmd+4` - Switch to Analytics tab

## Styling

The component uses Tailwind CSS and includes:
- Dark mode support via `dark:` variants
- Responsive breakpoints
- Custom animations
- Accessibility features (reduced motion, high contrast)

Import the CSS in your main file:

```typescript
import './components/Sidebar/sidebarTabs.css';
```

## Mobile Layout

On screens < 768px, the sidebar automatically switches to a bottom tab bar layout. The component supports touch gestures:
- Swipe left: Collapse sidebar
- Swipe right: Expand sidebar

## LocalStorage

The component automatically persists the last active tab to `localStorage` under the key `pulse-sidebar-last-tab`. This preference is restored on next visit.

## Accessibility

- Full keyboard navigation
- ARIA labels and roles
- Screen reader support
- Visible focus indicators
- Respects `prefers-reduced-motion`
- WCAG 2.1 AA compliant

## Examples

### With Custom Tab Handler

```typescript
<SidebarTabs
  defaultTab="tools"
  onTabChange={(tab) => {
    // Track analytics
    analytics.track('sidebar_tab_switch', { tab });

    // Update app state
    updateActiveTab(tab);
  }}
/>
```

### With Tool Selection Handler

```typescript
<SidebarTabs
  onToolSelect={(toolId) => {
    // Map tool IDs to actions
    switch (toolId) {
      case 'handoff-summary':
        openHandoffDialog();
        break;
      case 'export-messages':
        exportMessages();
        break;
      default:
        console.log('Unknown tool:', toolId);
    }
  }}
/>
```

### Mobile-Specific Rendering

```typescript
import { useState, useEffect } from 'react';

function ResponsiveLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return <SidebarTabs isMobile={isMobile} />;
}
```

## Integration with ToolsPanel

The Tools tab automatically integrates with the existing ToolsPanel component. All 39 tools are accessible with:
- Search functionality
- Category filtering
- Contextual suggestions
- Usage tracking
- Recent and pinned tools

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 10+)

## Performance

- Initial bundle: ~17KB gzipped
- Tab switch: < 50ms
- Lazy loading for CRM and Analytics tabs
- GPU-accelerated animations
- Optimized re-renders with React.memo

## Troubleshooting

### Sidebar not visible
Ensure parent container has height set:
```css
.app-container {
  height: 100vh;
  display: flex;
}
```

### Keyboard shortcuts not working
Check that no other components are preventing event propagation:
```typescript
// In your keyboard handler
e.stopPropagation(); // Remove this if present
```

### LocalStorage not persisting
Verify localStorage is available:
```typescript
if (typeof window !== 'undefined' && window.localStorage) {
  // LocalStorage is available
}
```

## Contributing

When adding new tabs:

1. Update `TABS` configuration in `SidebarTabs.tsx`
2. Add content component in `SidebarContent.tsx`
3. Update TypeScript types in `SidebarTab.tsx`
4. Add corresponding styles in `sidebarTabs.css`
5. Update documentation

## License

Part of Pulse Messages platform. See main project license.
