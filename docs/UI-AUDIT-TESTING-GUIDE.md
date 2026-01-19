# 🧪 UI Audit Fixes - Testing Guide

## Quick Test Checklist

Use this guide to verify all audit fixes are working correctly.

---

## 🔴 Critical Issues - Testing

### 1. War Room Canvas Text Contrast ✅

**Location**: War Room > Any Active Session > Canvas/Document Display Area

**Test Steps**:
1. Navigate to War Room
2. Create or open an existing session
3. Observe AI responses in the canvas area
4. **Expected**: Text should be dark gray/black (light mode) or near-white (dark mode)
5. **Verify**: No light gray text on light backgrounds

**Toggle Dark/Light Mode**:
- Light Mode: Text should be `rgb(24, 24, 27)` (zinc-900)
- Dark Mode: Text should be `rgb(250, 250, 250)` (zinc-50)

**Pass Criteria**: ✅ Content is easily readable without eye strain

---

## 🟠 High Priority Issues - Testing

### 2. War Room Section Headers (Dark Mode) ✅

**Location**: War Room Sidebar

**Test Steps**:
1. Switch to Dark Mode (top-right toggle)
2. Navigate to War Room
3. Look at sidebar headers:
   - "WAR ROOMS"
   - "SESSIONS"
   - "CONTEXT & SOURCES"
4. **Expected**: Headers should be visible with gray color and bold font
5. **Verify**: Can distinguish section headers from background

**Inspect Element**:
- Color: `rgb(161, 161, 170)` (zinc-400)
- Font Weight: 600

**Pass Criteria**: ✅ All section headers clearly visible

---

### 3. Dashboard Daily Overview (Light Mode) ✅

**Location**: Dashboard > Daily Overview Section

**Test Steps**:
1. Switch to Light Mode
2. Navigate to Dashboard
3. Locate "Daily Overview" section
4. Refresh page and observe loading state
5. **Expected**: Content should have good contrast throughout loading
6. **Verify**: No gray-on-gray states

**Inspect Element**:
- Text Color: `rgb(39, 39, 42)` (zinc-800)
- Background: `rgb(255, 255, 255)` (white)

**Pass Criteria**: ✅ All content readable during all states

---

## 🟡 Medium Priority Issues - Testing

### 4. Messages Contact Profile Error ⚠️

**Location**: Messages > Contact Details

**Test Steps**:
1. Navigate to Messages
2. Open a conversation with "Frankie Messana" (or any Pulse user)
3. Click on their avatar/profile picture
4. **Expected**: Contact details panel slides in from right
5. **If Error Occurs**:
   - Check browser console for debug logs (prefixed with `[UserContactCard]` and `[userContactService]`)
   - Look for specific error message
   - Note the user ID that failed
   - Click "Retry" button to attempt reload
6. **Expected (Fallback)**: Even if enriched profile fails, basic profile should load

**Console Debug Logs to Check**:
```
[userContactService] getEnrichedProfile called for: [user-id]
[userContactService] Requesting user: [your-id]
[userContactService] Target user: [target-id]
[userContactService] RPC returned data: [data or null]
```

**Pass Criteria**: 
- ✅ Profile loads successfully
- OR ✅ Clear error message with retry option
- OR ✅ Fallback to basic profile succeeds

**If Still Failing**:
1. Open Supabase dashboard
2. Check `user_profiles` table for the problematic user
3. Verify RLS policies allow reading profiles
4. Test `get_enriched_user_profile` RPC function manually

---

### 5. War Room Suggested Prompts Bar ✅

**Location**: War Room > Bottom of screen

**Test Steps**:
1. Navigate to War Room
2. Scroll to bottom of page
3. Locate "SUGGESTED PROMPTS" section
4. **Expected**: Dark gray/zinc background (not red/maroon)
5. **Verify**: Visual consistency with rest of interface

**Inspect Element**:
- Background: `rgb(39, 39, 42)` (zinc-800)
- Border: `rgb(63, 63, 70)` (zinc-700)
- Text: `rgb(250, 250, 250)` (white)

**Pass Criteria**: ✅ Prompts bar matches interface theme

---

## 🟢 Low Priority Issues - Testing

### 6. Navigation Notification Dots ✅

**Location**: Global sidebar navigation

**Test Steps**:
1. Look for pink/red notification dots on sidebar items
2. Toggle between light and dark modes
3. **Expected**: Dots have visible ring/outline
4. **Verify**: Dots stand out against background in both modes

**Pass Criteria**: ✅ Notification dots always visible

---

### 7. Calendar Day Numbers ✅

**Location**: Calendar view

**Test Steps**:
1. Navigate to Calendar
2. Locate current day (should have blue highlight)
3. Look at other day numbers
4. **Expected**: 
   - Current day: Bold with blue background
   - Other days: Clear contrast with background
5. Toggle dark/light modes

**Pass Criteria**: ✅ All days readable, current day emphasized

---

### 8. Voxer Mode Selection ✅

**Location**: Voxer > Mode Selection Screen

**Test Steps**:
1. Navigate to Voxer
2. Look for "Hover over a mode to see details" text
3. **Expected**: Text should be visible (not too dim)
4. Toggle dark/light modes

**Inspect Element**:
- Light Mode: `rgb(113, 113, 122)` (zinc-500)
- Dark Mode: `rgb(161, 161, 170)` (zinc-400)

**Pass Criteria**: ✅ Helper text clearly readable

---

## 🎨 Accessibility Features - Testing

### Focus States

**Test Steps**:
1. Press Tab key to navigate through interface
2. **Expected**: Blue outline appears around focused element
3. **Verify**: Outline is 2px solid blue with 2px offset

**Pass Criteria**: ✅ All interactive elements show focus indicator

---

### Link Visibility

**Test Steps**:
1. Find any links in the interface
2. **Expected**: Links are underlined and blue
3. Hover over link
4. **Expected**: Color darkens on hover

**Pass Criteria**: ✅ Links distinguishable from regular text

---

### High Contrast Mode (Optional)

**Test Steps** (for users who need high contrast):
1. Enable high contrast mode in your OS
2. Reload Pulse
3. **Expected**: Text uses maximum contrast colors (black/white)

**Pass Criteria**: ✅ All content readable in high contrast

---

### Reduced Motion (Optional)

**Test Steps** (for users sensitive to motion):
1. Enable reduced motion in your OS
2. Reload Pulse
3. Navigate through interface
4. **Expected**: Minimal or no animations

**Pass Criteria**: ✅ Interface usable without motion

---

## 🧰 Testing Tools

### Browser DevTools
```javascript
// Check contrast ratio (paste in console)
function getContrastRatio(fg, bg) {
  const getRGB = (color) => {
    const div = document.createElement('div');
    div.style.color = color;
    document.body.appendChild(div);
    const rgb = window.getComputedStyle(div).color;
    document.body.removeChild(div);
    return rgb.match(/\d+/g).map(Number);
  };
  
  const getLuminance = (rgb) => {
    const [r, g, b] = rgb.map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  
  const fgLum = getLuminance(getRGB(fg));
  const bgLum = getLuminance(getRGB(bg));
  const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);
  
  return ratio.toFixed(2);
}

// Example usage:
console.log('Contrast Ratio:', getContrastRatio('#1A1A1E', '#FAFAFA'));
```

### Online Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [axe DevTools](https://www.deque.com/axe/devtools/)

---

## 📊 Expected Results Summary

| Component | Light Mode | Dark Mode | WCAG |
|-----------|------------|-----------|------|
| War Room Canvas | Zinc-900 on White | Zinc-50 on Zinc-900 | AAA ✅ |
| Section Headers | Zinc-600 (bold) | Zinc-400 (bold) | AA ✅ |
| Dashboard | Zinc-800 on White | Zinc-200 on Zinc-900 | AAA ✅ |
| Helper Text | Zinc-500 | Zinc-400 | AA ✅ |
| Links | Blue-600 (underlined) | Blue-400 (underlined) | AAA ✅ |
| Notification Dots | Red-500 + white ring | Red-500 + dark ring | AA ✅ |

---

## 🐛 Bug Reporting Template

If you find any remaining visibility issues:

```markdown
**Component**: [e.g., War Room Canvas]
**Mode**: [Light/Dark]
**Browser**: [Chrome/Firefox/Safari]
**Issue**: [Brief description]
**Screenshot**: [If possible]
**Contrast Ratio**: [Use tool above to measure]
**Expected**: [What should happen]
**Actual**: [What is happening]
```

---

## ✅ Final Verification Checklist

Before marking testing complete:

- [ ] War Room canvas text readable in both modes
- [ ] All section headers visible in dark mode
- [ ] Dashboard overview has good contrast in light mode
- [ ] Contact profile loads OR shows clear error with retry
- [ ] War Room prompts bar matches interface theme
- [ ] Notification dots visible in both modes
- [ ] Calendar days all readable
- [ ] Voxer helper text visible
- [ ] Focus states working (Tab key navigation)
- [ ] Links are underlined and distinguishable
- [ ] No console errors related to CSS
- [ ] No visual regressions in other components
- [ ] Performance is not impacted

---

## 🎯 WCAG Compliance Testing

### Automated Testing
```bash
# Run Lighthouse audit
npm run lighthouse

# Expected Accessibility Score: 95+
```

### Manual Testing
1. **Keyboard Navigation**: Tab through entire interface
2. **Screen Reader**: Test with NVDA/JAWS/VoiceOver
3. **Zoom**: Test at 200% zoom level
4. **Color Blindness**: Use Chrome DevTools to simulate

---

## 📝 Notes for Developers

### CSS File Location
- Primary fixes: `src/styles/audit-fixes.css`
- Import in: `src/index.css` (line 1-2)

### Disabling Fixes (for debugging)
Comment out the import in `src/index.css`:
```css
/* @import './styles/audit-fixes.css'; */
```

### Inspecting Applied Styles
1. Open DevTools
2. Select element
3. Look for styles from `audit-fixes.css`
4. Styles marked with `!important` should override Tailwind

---

**Testing Duration**: ~15-20 minutes for complete verification

**Priority Testing** (5 minutes):
1. War Room canvas (critical)
2. Section headers (high)
3. Dashboard overview (high)
4. Contact profile error (medium)

---

*Last Updated: January 10, 2026*
