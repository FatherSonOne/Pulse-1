# Package Installation Guide

## Required Dependencies for Phase 10

### Install Monitoring & Analytics Packages

```bash
# Install production dependencies
npm install posthog-js @sentry/react @sentry/tracing

# Verify installation
npm list posthog-js @sentry/react @sentry/tracing
```

### Expected Package Versions

```json
{
  "dependencies": {
    "posthog-js": "^1.96.1",
    "@sentry/react": "^7.91.0",
    "@sentry/tracing": "^7.91.0"
  }
}
```

### Installation Script

```bash
#!/bin/bash
# install-monitoring.sh

echo "Installing monitoring and analytics dependencies..."

# PostHog for user analytics
npm install posthog-js

# Sentry for error tracking and performance monitoring
npm install @sentry/react @sentry/tracing

echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Configure VITE_SENTRY_DSN in .env.production"
echo "2. Configure VITE_POSTHOG_API_KEY in .env.production"
echo "3. Initialize monitoring in src/main.tsx"
echo ""
echo "See docs/deployment/DEPLOYMENT_GUIDE.md for details"
```

### Make Script Executable

```bash
chmod +x install-monitoring.sh
./install-monitoring.sh
```

---

## Verification

### Check Package Installation

```bash
# Verify PostHog
npm list posthog-js

# Verify Sentry
npm list @sentry/react @sentry/tracing

# Check for vulnerabilities
npm audit

# Update if needed
npm update posthog-js @sentry/react @sentry/tracing
```

### Test Import

Create test file `test-monitoring.ts`:

```typescript
import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

console.log('✅ PostHog imported successfully');
console.log('✅ Sentry imported successfully');
console.log('✅ All monitoring packages working');
```

Run test:
```bash
npx tsx test-monitoring.ts
```

---

## Environment Configuration

### Add to .env.production

```bash
# Sentry Error Tracking
VITE_SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project]

# PostHog Analytics
VITE_POSTHOG_API_KEY=phc_[your-key]
VITE_POSTHOG_HOST=https://app.posthog.com

# App Version (for monitoring)
VITE_APP_VERSION=1.0.0
```

### Get API Keys

**Sentry**:
1. Go to https://sentry.io/
2. Create project: "Pulse Messages"
3. Copy DSN from Project Settings → Client Keys

**PostHog**:
1. Go to https://app.posthog.com/
2. Create project: "Pulse Messages"
3. Copy API key from Project Settings → API Keys

---

## TypeScript Configuration

No additional TypeScript configuration needed. Packages include type definitions:

- `posthog-js` includes built-in types
- `@sentry/react` includes @types
- `@sentry/tracing` includes @types

---

## Build Verification

```bash
# Test production build
npm run build

# Check for errors
echo $?  # Should output 0

# Verify bundle size
du -sh dist/

# Analyze bundle
npm run build:analyze
```

---

## Troubleshooting

### Issue: Module not found

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Type errors

```bash
# Regenerate TypeScript types
npx tsc --noEmit
```

### Issue: Build fails

```bash
# Check for conflicting dependencies
npm ls posthog-js @sentry/react

# Update to compatible versions
npm update
```

---

## Alternative: Install All at Once

```bash
# Single command installation
npm install posthog-js @sentry/react @sentry/tracing --save

# Or using Yarn
yarn add posthog-js @sentry/react @sentry/tracing

# Or using pnpm
pnpm add posthog-js @sentry/react @sentry/tracing
```

---

## Cleanup Old Monitoring Tools

If migrating from other tools:

```bash
# Remove old analytics
npm uninstall mixpanel-browser amplitude-js

# Remove old error tracking
npm uninstall bugsnag rollbar

# Clean up imports in code
# Search and replace old monitoring code
```

---

## Production Checklist

- [ ] PostHog installed and configured
- [ ] Sentry installed and configured
- [ ] Environment variables set
- [ ] Monitoring initialized in app
- [ ] Error boundary added
- [ ] Build succeeds
- [ ] Type checking passes
- [ ] Tests pass with new dependencies

---

**Last Updated**: 2025-01-19
**For integration instructions**: See [PHASE_10_DEPLOYMENT_IMPLEMENTATION.md](../../PHASE_10_DEPLOYMENT_IMPLEMENTATION.md)
