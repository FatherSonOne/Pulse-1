# Comet Browser Cache Fix Guide

## Problem
Comet Browser is showing the old dark-themed UI instead of the new polished UI due to aggressive PWA service worker caching.

## Solution Steps

### Option 1: Use the Automated Cache Cleaner (Recommended)

1. **Open the cache cleaner utility in Comet Browser:**
   ```
   http://localhost:5173/clear-cache.html
   ```

2. **Click "Clear All Cache"** - This will:
   - Unregister all service workers
   - Delete all cache storage
   - Clear localStorage and sessionStorage
   - Delete IndexedDB databases
   - Clear cookies
   - Clear browser cache

3. **Click "Reload Pulse"** when the process completes

4. **Navigate to:**
   ```
   http://localhost:5173/?v=28.1.0
   ```

### Option 2: Manual Cache Clearing in Comet Browser

If the automated tool doesn't work, try these manual steps:

1. **Open Comet Browser Developer Tools:**
   - Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
   - Press `Cmd+Option+I` (Mac)

2. **Go to the Application/Storage tab**

3. **Clear Service Workers:**
   - Click "Service Workers" in the left sidebar
   - Click "Unregister" for all service workers

4. **Clear Cache Storage:**
   - Click "Cache Storage" in the left sidebar
   - Right-click each cache and select "Delete"

5. **Clear Storage:**
   - Click "Clear site data" button at the top
   - Check all boxes (Local storage, Session storage, IndexedDB, Cookies)
   - Click "Clear site data"

6. **Hard Reload:**
   - Press `Ctrl+Shift+R` (Windows/Linux)
   - Press `Cmd+Shift+R` (Mac)
   - Or click the reload button while holding Shift

### Option 3: Rebuild and Force Fresh Assets

1. **Stop the dev server** (if running)

2. **Clear node_modules cache and rebuild:**
   ```bash
   npm run build
   npm run dev
   ```

3. **Open in Comet Browser with cache-busting parameter:**
   ```
   http://localhost:5173/?cache_bust=1737482400000
   ```

## What Changed

### Version Bump
- Updated app version from `28.0.0` → `28.1.0` in [package.json](package.json#L4)
- Updated PWA start_url to include version parameter in [vite.config.ts](vite.config.ts#L150)

### Cache Cleaner Utility
- Created [public/clear-cache.html](public/clear-cache.html) - A comprehensive cache clearing utility

## Verification

After clearing cache, you should see:
- ✅ Light/white background instead of dark theme
- ✅ Polished UI with modern design
- ✅ Updated components matching the second screenshot

## Why This Happened

The PWA service worker in [vite.config.ts](vite.config.ts#L138-L252) uses aggressive `CacheFirst` strategies:
- Google Fonts: 1 year cache
- Static assets: Long-term caching
- Supabase API/Storage: 24 hours to 7 days cache

This is great for performance but can cause issues during development when the UI changes significantly.

## Prevention for Future

1. **During development:** Use Chrome/Firefox with DevTools open and "Disable cache" checked
2. **For testing:** Use incognito/private browsing mode
3. **Version bumps:** Always increment version in package.json for major UI changes
4. **Service worker:** The `registerType: 'autoUpdate'` should auto-update, but browsers may need manual intervention

## Troubleshooting

### Still seeing old UI?
1. Try the automated cache cleaner at `localhost:5173/clear-cache.html`
2. Completely close Comet Browser and restart it
3. Check if Comet has its own cache clearing mechanism in settings
4. Try accessing via incognito mode first to verify the new UI is loading

### Dev server not starting?
```bash
# Kill any existing processes on port 5173
# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Then restart:
npm run dev
```

### Build errors?
```bash
# Clean install
rm -rf node_modules
rm package-lock.json
npm install
npm run build
npm run dev
```

## Contact
If issues persist, check:
- Comet Browser documentation for cache management
- Comet Browser settings for "Clear browsing data" option
- Comet Browser about PWA/service worker handling
