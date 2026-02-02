# Pulse Deployment - Quick Fix Checklist

Apply these 5 fixes in order to match Logos Vision CRM's successful deployment.

---

## ✅ Fix 1: React Downgrade (if using React 19)

```bash
npm install react@18.2.0 react-dom@18.2.0
rm -rf node_modules package-lock.json
npm install
```

**File:** `package.json`
- Change React from 19.x → 18.2.0

---

## ✅ Fix 2: Tailwind CDN → Build-Time

### Install:
```bash
npm install -D tailwindcss@^3.4.19 autoprefixer@^10.4.24
```

### Create `postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### Create `tailwind.config.js`:
```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: { extend: { /* Add Pulse's custom colors/animations here */ } },
  plugins: [],
}
```

### Modify `index.css` (add at top):
```css
@import './src/styles/design-tokens.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Modify `index.html` (remove):
```html
<!-- DELETE: <script src="https://cdn.tailwindcss.com"></script> -->
<!-- Tailwind CSS is now compiled via PostCSS build process -->
```

---

## ✅ Fix 3: Build Configuration

### Create `.nvmrc`:
```
20.11.0
```

### Modify `vite.config.ts`:

**Update optimizeDeps:**
```typescript
optimizeDeps: {
  exclude: ['lucide-react'],
},
```

**Update manualChunks:**
```typescript
manualChunks: (id) => {
  if (id.includes('node_modules')) {
    if (id.includes('/react-dom/') || id.includes('/react/') ||
        id.includes('scheduler') || id.match(/\/react\/[^\/]*\.js$/)) {
      return 'react-vendor';
    }
    if (id.includes('lucide-react')) {
      return 'lucide-icons';
    }
    if (id.includes('react-router')) return 'router';
    return 'vendor';
  }
}
```

**Update minify:**
```typescript
minify: 'esbuild',
esbuild: {
  drop: ['console', 'debugger'],
  keepNames: false,
},
```

---

## ✅ Fix 4: Suspense for Lazy Routes

### Find page rendering (usually `App.tsx`):

**Wrap in Suspense:**
```typescript
<main>
  <div key={currentPage}>
    <Suspense fallback={<LoadingState message="Loading page..." />}>
      {renderContent()}
    </Suspense>
  </div>
</main>
```

**Import:**
```typescript
import { Suspense } from 'react';
```

---

## ✅ Fix 5: Realtime Auth Guard

### For each component with `supabase.channel()`:

**Add prop:**
```typescript
interface Props {
  // ... existing props
  isAuthenticated?: boolean;
}
```

**Guard subscription:**
```typescript
useEffect(() => {
  if (!isAuthenticated) return;

  const subscription = supabase.channel('...').subscribe();
  return () => subscription.unsubscribe();
}, [isAuthenticated]);
```

**Pass from parent:**
```typescript
<TaskView isAuthenticated={isAuthenticated} />
```

---

## 🚀 Deploy

```bash
git add .
git commit -m "fix: apply all Vercel deployment fixes"
git push origin main
```

Monitor Vercel deployment → Test production URL → Verify clean console

---

## 📊 Success Indicators

✅ Build completes in ~10-16s
✅ No circular chunk warnings
✅ lucide-icons-[hash].js exists separately
✅ Pages load without blank screens
✅ Navigation works
✅ Clean browser console
✅ Realtime works after login

---

**Total Time:** ~15-20 minutes
**Files Created:** 3 (`.nvmrc`, `postcss.config.js`, `tailwind.config.js`)
**Files Modified:** ~7
