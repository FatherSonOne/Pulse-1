# Hover Reaction System - Quick Start Guide

**5-Minute Integration Guide**

---

## Installation

No installation needed - all files are already in the codebase.

---

## Basic Usage

### Step 1: Import Components

```tsx
import {
  HoverReactionTrigger,
  QuickReactionBar,
  AnimatedReactions
} from './MessageEnhancements/HoverReactionSystemExports';
```

### Step 2: Wrap Your Message

```tsx
function Message({ message, currentUser, onReact }) {
  const isMe = message.sender === currentUser.id;

  return (
    <HoverReactionTrigger
      messageId={message.id}
      isMe={isMe}
      onReact={onReact}
      renderReactionBar={({ onReact, onShowMore, position }) => (
        <QuickReactionBar
          onReact={onReact}
          onShowMore={onShowMore}
          position={position}
        />
      )}
    >
      <div className="message-bubble">
        {message.content}
      </div>
    </HoverReactionTrigger>
  );
}
```

### Step 3: Handle Reactions

```tsx
const handleReaction = async (messageId: string, emoji: string) => {
  // Update local state (optimistic)
  updateMessage(messageId, emoji);

  // Send to backend
  await api.toggleReaction(messageId, emoji);
};
```

### Step 4: Display Reactions

```tsx
{message.reactions?.length > 0 && (
  <AnimatedReactions
    reactions={message.reactions}
    onReact={(emoji) => handleReaction(message.id, emoji)}
    isMe={isMe}
  />
)}
```

---

## Features Out of the Box

- ✅ **300ms hover delay** (prevents accidental triggers)
- ✅ **500ms mobile long-press** (with haptic feedback)
- ✅ **Smart positioning** (above/below based on space)
- ✅ **Keyboard accessible** (Tab, Enter, Space, Escape)
- ✅ **Cancels on scroll** (prevents floating bars)
- ✅ **Smooth animations** (entrance/exit transitions)

---

## Desktop Behavior

1. Hover over message → Wait 300ms → Reaction bar appears
2. Click emoji → Reaction added → Bar disappears
3. Move mouse away before 300ms → Cancelled

**Keyboard**: Tab to focus → Enter to show → Tab through emojis → Enter to select

---

## Mobile Behavior

1. Long-press message → Wait 500ms → Haptic vibration → Reaction bar appears
2. Tap emoji → Reaction added → Release to dismiss
3. Move finger >10px → Cancelled

---

## Configuration Options

### Custom Hover Delay

```tsx
<HoverReactionTrigger
  hoverDelay={200}  // Faster trigger (default: 300ms)
  {...props}
/>
```

### Disable Mobile Long-Press

```tsx
<HoverReactionTrigger
  enableMobileLongPress={false}  // Desktop only
  {...props}
/>
```

### Custom Position

```tsx
renderReactionBar={({ onReact, onShowMore }) => (
  <QuickReactionBar
    position={{ bottom: 60, left: 0 }}  // Override auto-position
    {...props}
  />
)}
```

---

## Common Patterns

### With State Management

```tsx
function MessageWithReactions({ message }) {
  const [reactions, setReactions] = useState(message.reactions);

  const handleReact = (messageId, emoji) => {
    setReactions(prev => {
      const existing = prev.find(r => r.emoji === emoji);
      if (existing?.me) {
        // Remove reaction
        return prev
          .map(r => r.emoji === emoji ? { ...r, count: r.count - 1, me: false } : r)
          .filter(r => r.count > 0);
      } else {
        // Add reaction
        return existing
          ? prev.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, me: true } : r)
          : [...prev, { emoji, count: 1, me: true }];
      }
    });
  };

  return (
    <HoverReactionTrigger messageId={message.id} onReact={handleReact}>
      <div>{message.content}</div>
    </HoverReactionTrigger>
  );
}
```

### With Emoji Picker

```tsx
function MessageWithPicker({ message }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <HoverReactionTrigger
        messageId={message.id}
        onReact={handleReact}
        onShowMore={() => setShowPicker(true)}
        renderReactionBar={(props) => <QuickReactionBar {...props} />}
      >
        <div>{message.content}</div>
      </HoverReactionTrigger>

      {showPicker && (
        <EmojiPicker
          onSelect={(emoji) => {
            handleReact(message.id, emoji);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}
```

---

## Troubleshooting

### Reaction bar not appearing?

1. Check that message element has dimensions (not `display: none`)
2. Verify `hoverRef` is attached (automatic in HoverReactionTrigger)
3. Ensure no `pointer-events: none` on parent elements

### Mobile long-press not working?

1. Set `enableMobileLongPress={true}` (default)
2. Test on actual device (simulator may not support haptic feedback)
3. Check for competing touch event handlers

### Position incorrect?

1. Ensure parent containers don't have CSS transforms
2. Check that `window.innerHeight` returns accurate value
3. Verify `getBoundingClientRect()` works correctly

---

## Performance Tips

### Memoize Components

```tsx
const MemoizedMessage = React.memo(MessageComponent);
```

### Use Callbacks

```tsx
const handleReact = useCallback((id, emoji) => {
  addReaction(id, emoji);
}, []);
```

### Virtualize Long Lists

```tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={messages.length}
  itemSize={80}
>
  {({ index, style }) => (
    <div style={style}>
      <MessageWithReactions message={messages[index]} />
    </div>
  )}
</FixedSizeList>
```

---

## API Reference

### HoverReactionTrigger Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `messageId` | `string` | Required | Unique message identifier |
| `isMe` | `boolean` | `false` | Whether this is current user's message |
| `onReact` | `(id, emoji) => void` | Required | Reaction handler |
| `onShowMore` | `() => void` | Optional | Show full emoji picker |
| `hoverDelay` | `number` | `300` | Hover delay in milliseconds |
| `enableMobileLongPress` | `boolean` | `true` | Enable mobile long-press |
| `disabled` | `boolean` | `false` | Disable hover reactions |
| `renderReactionBar` | `(props) => React.Node` | Required | Render function for bar |

### QuickReactionBar Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onReact` | `(emoji) => void` | Required | Emoji selection handler |
| `onShowMore` | `() => void` | Required | Show more emojis handler |
| `position` | `Position` | Auto | Position override |
| `className` | `string` | `''` | Additional CSS classes |

### AnimatedReactions Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `reactions` | `Reaction[]` | Required | Array of reactions |
| `onReact` | `(emoji) => void` | Required | Toggle reaction handler |
| `isMe` | `boolean` | `false` | Message sender |
| `showPicker` | `boolean` | `false` | Control picker visibility |
| `onPickerToggle` | `() => void` | Optional | Picker toggle handler |

---

## Testing

### Manual Test

1. Hover over message → Reaction bar appears after 300ms ✅
2. Move mouse away quickly → Bar does not appear ✅
3. Scroll while hovering → Bar dismissed ✅
4. Long-press on mobile → Haptic feedback + bar appears ✅
5. Keyboard: Tab → Enter → Tab → Enter → Works ✅

### Automated Test

See `HoverReactionSystem.test.tsx` for 18 test scenarios.

---

## Next Steps

1. ✅ Read this quick start
2. ✅ Copy basic usage code
3. ✅ Integrate into your message component
4. ✅ Test on desktop and mobile
5. 📖 Read full guide: `HOVER_REACTION_INTEGRATION_GUIDE.md`

---

## Support

- **Full Documentation**: `HOVER_REACTION_INTEGRATION_GUIDE.md`
- **Examples**: `HoverReactionExample.tsx`
- **Tests**: `HoverReactionSystem.test.tsx`
- **Summary**: `PHASE_3_IMPLEMENTATION_SUMMARY.md`

---

**Implementation Date**: 2026-01-19
**Status**: Production Ready
**Time to Integrate**: ~15 minutes
