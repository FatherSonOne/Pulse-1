# DecisionTaskHub Navigation Fix - Test Plan

## Issue Fixed
Critical navigation layout issue where tabs shift position when switching between Decisions and Tasks views due to dynamic content (insights/nudges panels) changing height.

## Solution Implemented
Made the tab bar sticky with consistent positioning using:
- `position: sticky` with `top: 0`
- `z-index: 10` for layering above content
- `background: var(--hub-card-bg)` to prevent content showing through
- `box-shadow` for visual depth when scrolling
- Proper padding adjustment for seamless integration

## Test Cases

### 1. Tab Position Consistency
- [ ] Click "Decisions" tab
- [ ] Click "Tasks" tab
- [ ] Repeat multiple times
- **Expected**: Tabs remain at the same vertical position, no shifting

### 2. Insights Panel Interaction
- [ ] With Insights expanded, switch between tabs
- [ ] Click collapse button on Insights panel
- [ ] Switch between tabs with Insights collapsed
- [ ] Expand Insights again and switch tabs
- **Expected**: Tab position remains fixed regardless of insights state

### 3. Nudges Panel Interaction
- [ ] With nudges present, switch between tabs
- [ ] Dismiss individual nudges
- [ ] Switch tabs after dismissing nudges
- [ ] Dismiss all nudges
- **Expected**: Tab position unaffected by nudges visibility

### 4. Sticky Behavior on Scroll
- [ ] Scroll down the page with many decisions/tasks
- [ ] Verify tabs stick to top of viewport
- [ ] Switch tabs while scrolled
- [ ] Scroll back up
- **Expected**: Tabs remain accessible and fixed at top during scroll

### 5. Visual Consistency
- [ ] Check tab bar has proper background (no transparency issues)
- [ ] Verify shadow appears when content scrolls beneath
- [ ] Test in light mode
- [ ] Test in dark mode
- **Expected**: Clean visual appearance, no content bleeding through

### 6. Responsive Design
- [ ] Test on desktop (>1024px)
- [ ] Test on tablet (768px-1024px)
- [ ] Test on mobile (<768px)
- **Expected**: Sticky behavior works on all screen sizes

### 7. Performance
- [ ] Monitor for layout shifts in browser DevTools
- [ ] Check for any visual jank when switching tabs
- [ ] Test with large datasets (many decisions/tasks)
- **Expected**: Smooth transitions, no performance degradation

### 8. Accessibility
- [ ] Tab navigation with keyboard (Tab key)
- [ ] Screen reader announces tab changes correctly
- [ ] Focus indicators remain visible
- **Expected**: Full keyboard and screen reader support maintained

## CSS Changes Made

### f:\pulse1\src\components\decisions\DecisionTaskHub.css

#### .hub-tabs (lines 444-451)
```css
.hub-tabs {
  position: sticky;           /* NEW: Makes tabs stick to viewport */
  top: 0;                     /* NEW: Stick to top of viewport */
  z-index: 10;                /* NEW: Layer above content */
  display: flex;
  gap: 0.5rem;
  padding: 1rem 0;            /* NEW: Vertical padding for spacing */
  margin-bottom: 1rem;
  background: var(--hub-card-bg); /* NEW: Solid background */
  border-bottom: 2px solid var(--hub-border);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); /* NEW: Subtle shadow */
}
```

#### .tab-button (line 465)
```css
margin-bottom: -1rem;       /* CHANGED: Adjusted from -2px to align with new padding */
```

## Verification Steps

1. Start development server
2. Navigate to Decisions & Tasks hub
3. Execute all test cases above
4. Verify no console errors
5. Check browser DevTools for layout shift metrics
6. Test cross-browser (Chrome, Firefox, Safari, Edge)

## Success Criteria

- ✅ Tabs maintain consistent vertical position across all states
- ✅ No layout shift when insights/nudges panels change
- ✅ Smooth scrolling behavior with sticky positioning
- ✅ Visual appearance is clean in both light/dark modes
- ✅ Responsive design works on all screen sizes
- ✅ No accessibility regressions
- ✅ No performance issues or visual jank

## Rollback Plan

If issues are found, revert to original CSS:
```css
.hub-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid var(--hub-border);
}

.tab-button {
  margin-bottom: -2px;
}
```
