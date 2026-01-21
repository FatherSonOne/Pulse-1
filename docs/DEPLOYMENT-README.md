# Pulse Deployment Infrastructure

**Status:** ✅ Production Ready
**Version:** 28.0.0+
**Last Updated:** 2026-01-20

---

## Quick Start

### Prerequisites

1. **Required Accounts:**
   - GitHub account with repository access
   - Vercel or Netlify account
   - Supabase project
   - Sentry account (for error tracking)
   - Google Analytics account (optional)

2. **Required Tools:**
   ```bash
   node --version  # v18 or higher
   npm --version   # v9 or higher
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   npm install @sentry/react @sentry/tracing web-vitals
   ```

### Deploy to Staging

```bash
# 1. Create feature branch
git checkout -b feature/your-feature

# 2. Make changes and commit
git add .
git commit -m "feat: your feature description"

# 3. Push to GitHub (triggers automatic staging deployment)
git push origin feature/your-feature

# 4. Create Pull Request to main
# GitHub Actions will automatically deploy to staging and comment with URL
```

### Deploy to Production

```bash
# 1. Merge PR to main branch
# This automatically triggers production deployment via GitHub Actions

# 2. Monitor deployment
# Watch GitHub Actions workflow
# Check deployment in Vercel/Netlify dashboard

# 3. Verify deployment
./scripts/smoke-test.sh https://pulse.yourdomain.com

# 4. Monitor for 24 hours
# Check Sentry, Analytics, and performance metrics
```

---

## Infrastructure Overview

### Deployment Architecture

```
Developer → GitHub → CI/CD → Staging → Review → Production → Monitoring
```

### Files & Directories

```
pulse/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Continuous Integration
│       ├── deploy-staging.yml        # Staging Deployment
│       ├── deploy-production.yml     # Production Deployment
│       ├── lighthouse.yml            # Performance Audits
│       └── security-scan.yml         # Security Scanning
├── docs/
│   ├── PHASE-10-DEPLOYMENT-GUIDE.md      # Complete deployment guide
│   ├── PRODUCTION-READINESS-REPORT.md    # Readiness assessment
│   ├── PHASE-10-COMPLETION.md            # Phase completion report
│   ├── checklists/
│   │   ├── PRE-DEPLOYMENT.md             # Pre-deployment checklist
│   │   └── POST-DEPLOYMENT.md            # Post-deployment checklist
│   ├── migrations/
│   │   └── MIGRATION-EXECUTION-PLAN.md   # Database migration guide
│   └── monitoring/
│       └── (monitoring dashboards - TBD)
├── scripts/
│   └── smoke-test.sh                 # Automated smoke tests
├── src/
│   └── utils/
│       ├── errorTracking.ts          # Sentry integration
│       ├── analytics.ts              # Google Analytics
│       ├── performanceMonitoring.ts  # Web Vitals tracking
│       └── logger.ts                 # Structured logging
├── Dockerfile                        # Production container
├── docker-compose.yml                # Local development
├── docker-compose.prod.yml           # Production stack
├── nginx.conf                        # Web server config
├── vercel.json                       # Vercel deployment config
├── netlify.toml                      # Netlify deployment config
├── lighthouse-budget.json            # Performance budgets
├── .env.development                  # Dev environment vars
└── .env.production.example           # Production template
```

---

## CI/CD Workflows

### 1. Continuous Integration (ci.yml)

**Triggered by:** Push to any branch, PR to main/develop

**Jobs:**
- Lint code (ESLint + TypeScript)
- Run tests
- Build application
- Check bundle size
- Security audit
- Accessibility audit

**Duration:** ~5-10 minutes

### 2. Staging Deployment (deploy-staging.yml)

**Triggered by:** PR to main branch

**Jobs:**
- Build with staging environment
- Deploy to Vercel/Netlify staging
- Run smoke tests
- Comment PR with deployment URL
- Run Lighthouse CI

**Duration:** ~10-15 minutes

**Result:** Preview URL commented on PR

### 3. Production Deployment (deploy-production.yml)

**Triggered by:** Merge to main branch

**Jobs:**
1. **Pre-deployment checks:**
   - Lint and tests
   - Security audit
   - Breaking change detection

2. **Build production:**
   - Optimized production build
   - Source maps disabled
   - Upload artifacts

3. **Deploy to production:**
   - Deploy to Vercel/Netlify production
   - Create Sentry release
   - Tag deployment

4. **Post-deployment verification:**
   - Health checks
   - Smoke tests
   - Web Vitals check
   - Team notification

5. **Auto-rollback (on failure):**
   - Detect failures
   - Revert to previous version
   - Alert team

**Duration:** ~10-20 minutes

### 4. Lighthouse CI (lighthouse.yml)

**Triggered by:** PR to main/develop, Weekly schedule

**Jobs:**
- Build application
- Run Lighthouse audits
- Check against performance budgets
- Comment results on PR

**Performance Budgets:**
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 90
- SEO: > 90

### 5. Security Scanning (security-scan.yml)

**Triggered by:** Push to main/develop, PR, Weekly schedule

**Jobs:**
- Dependency vulnerability scan (npm audit)
- Code security analysis (CodeQL)
- Secret detection (pattern matching)
- Container scanning (Trivy)
- SAST scanning
- License compliance check

**Duration:** ~15-20 minutes

---

## Monitoring & Observability

### Error Tracking (Sentry)

**Setup:**
1. Create Sentry project at https://sentry.io
2. Get DSN from project settings
3. Add to environment variables:
   ```env
   VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   VITE_ENABLE_ERROR_TRACKING=true
   ```

**Features:**
- Exception tracking
- Performance monitoring (10% sample rate)
- Session replay (10% sessions, 100% on errors)
- User context tracking
- Release tracking

**Usage in code:**
```typescript
import errorTracking from '@/utils/errorTracking';

// Initialize (done in App.tsx)
errorTracking.initialize();

// Capture exception
try {
  // your code
} catch (error) {
  errorTracking.captureException(error, { context: 'user_action' });
}

// Add breadcrumb
errorTracking.addBreadcrumb('User clicked button', 'user_action');
```

### Analytics (Google Analytics)

**Setup:**
1. Create GA4 property at https://analytics.google.com
2. Get Measurement ID (G-XXXXXXXXXX)
3. Add to environment variables:
   ```env
   VITE_ANALYTICS_ID=G-XXXXXXXXXX
   VITE_ENABLE_ANALYTICS=true
   ```

**Features:**
- Page view tracking
- Custom event tracking
- User properties
- Conversion tracking
- Privacy-compliant (Do-Not-Track respect)

**Usage in code:**
```typescript
import analytics from '@/utils/analytics';

// Initialize (done in App.tsx)
analytics.initialize({
  enabled: true,
  trackingId: 'G-XXXXXXXXXX',
});

// Track event
import { trackUserLogin, trackFeatureUsed } from '@/utils/analytics';

trackUserLogin('google');
trackFeatureUsed('daily_briefing');
```

### Performance Monitoring

**Setup:**
Automatically enabled when installed:
```bash
npm install web-vitals
```

**Features:**
- Core Web Vitals (CLS, FID, FCP, LCP, TTFB)
- Navigation timing
- Resource timing
- Custom performance metrics
- API latency tracking

**Usage in code:**
```typescript
import performanceMonitoring from '@/utils/performanceMonitoring';

// Initialize (done in App.tsx)
performanceMonitoring.initialize({
  enabled: true,
  sampleRate: 1.0,
});

// Track async function
const data = await performanceMonitoring.measureAsync(
  'fetch_messages',
  () => fetchMessages()
);

// Track API call
performanceMonitoring.trackApiCall(url, duration, statusCode);
```

### Structured Logging

**Setup:**
Automatically initialized in App.tsx

**Features:**
- Log levels (debug, info, warn, error, fatal)
- Environment-specific logging
- Remote log aggregation support
- Structured JSON logs

**Usage in code:**
```typescript
import logger, { createLogger } from '@/utils/logger';

// Module-specific logger
const log = createLogger('messages');

log.info('Fetching messages', { userId: user.id });
log.error('Failed to fetch messages', error, { userId: user.id });
```

---

## Environment Configuration

### Required Environment Variables

**Production (.env.production):**

```env
# Application
VITE_ENV=production
VITE_APP_URL=https://pulse.yourdomain.com

# Supabase (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key

# API Keys (Backend Only - NO VITE_ PREFIX)
GEMINI_API_KEY=your-production-gemini-key

# OAuth (Required)
VITE_GOOGLE_CLIENT_ID=your-production-google-client-id
VITE_OAUTH_REDIRECT_URI=https://pulse.yourdomain.com/auth/callback

# Monitoring (Recommended)
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_ANALYTICS_ID=G-XXXXXXXXXX
VITE_ENABLE_ERROR_TRACKING=true
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_PERFORMANCE_MONITORING=true

# Optional
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1.0
```

### Security Warning

**CRITICAL:** Never expose sensitive API keys with `VITE_` prefix!

```bash
# ❌ WRONG - Exposes key in browser
VITE_GEMINI_API_KEY=your-key

# ✅ CORRECT - Server-side only
GEMINI_API_KEY=your-key
```

Run validation:
```bash
npm run validate:env
```

---

## Deployment Checklist

### Before Deployment

Complete: [`docs/checklists/PRE-DEPLOYMENT.md`](./docs/checklists/PRE-DEPLOYMENT.md)

**Quick checklist:**
- [ ] All tests passing
- [ ] No security vulnerabilities
- [ ] Environment variables configured
- [ ] Staging deployment successful
- [ ] Team notified
- [ ] Approvals obtained

### After Deployment

Complete: [`docs/checklists/POST-DEPLOYMENT.md`](./docs/checklists/POST-DEPLOYMENT.md)

**Quick checklist:**
- [ ] Smoke tests passed
- [ ] Monitoring operational
- [ ] No critical errors
- [ ] Performance acceptable
- [ ] Team notified

---

## Rollback Procedures

### Automatic Rollback

CI/CD automatically rolls back on:
- Post-deployment smoke test failures
- Critical errors detected
- Health check failures

### Manual Rollback

**Via Vercel:**
```bash
# List deployments
vercel ls

# Rollback to previous
vercel rollback <deployment-url>
```

**Via Netlify:**
```bash
# List deployments
netlify deploys

# Rollback to previous
netlify rollback <deployment-id>
```

**Via Git:**
```bash
# Revert last commit
git revert HEAD
git push origin main
```

### Database Rollback

See: [`docs/migrations/MIGRATION-EXECUTION-PLAN.md`](./docs/migrations/MIGRATION-EXECUTION-PLAN.md)

---

## Troubleshooting

### Build Failures

**Issue:** Build fails in CI/CD

**Solution:**
```bash
# Test locally
npm run build

# Check for errors
npm run lint
npx tsc --noEmit

# Check environment
npm run validate:env
```

### Deployment Failures

**Issue:** Deployment succeeds but app doesn't work

**Solution:**
1. Check environment variables in hosting platform
2. Check Sentry for errors
3. Run smoke tests manually
4. Check browser console
5. Verify API endpoints

### Performance Issues

**Issue:** Slow page loads

**Solution:**
1. Run Lighthouse audit
2. Check bundle size: `npm run analyze`
3. Check Network tab in DevTools
4. Verify CDN caching
5. Check database query performance

### Monitoring Not Working

**Issue:** Sentry/Analytics not receiving data

**Solution:**
1. Verify API keys in environment
2. Check browser console for errors
3. Test in production mode locally
4. Verify domain allowlists in monitoring platforms

---

## Useful Commands

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Type check
npx tsc --noEmit

# Build for production
npm run build

# Preview production build
npm run preview
```

### Deployment

```bash
# Deploy to staging (via PR)
git push origin feature-branch

# Deploy to production (via merge)
git push origin main

# Manual deploy to Vercel
vercel --prod

# Manual deploy to Netlify
netlify deploy --prod --dir=dist
```

### Testing

```bash
# Run smoke tests
./scripts/smoke-test.sh https://pulse.yourdomain.com

# Run Lighthouse locally
npx lighthouse https://pulse.yourdomain.com --view

# Check bundle size
npm run build
du -sh dist/
```

### Monitoring

```bash
# View Sentry errors
open https://sentry.io/organizations/your-org/projects/pulse/

# View Analytics
open https://analytics.google.com

# Check deployment logs
vercel logs
# or
netlify logs
```

---

## Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Rotate API keys** - Regular rotation schedule
3. **Use VITE_ prefix carefully** - Only for public data
4. **Keep dependencies updated** - Weekly security scans
5. **Monitor for vulnerabilities** - Automated scanning
6. **Implement rate limiting** - Protect APIs
7. **Use security headers** - Already configured
8. **Enable HTTPS** - Enforced by hosting platform

---

## Performance Best Practices

1. **Code splitting** - Already implemented
2. **Lazy loading** - Use for routes and heavy components
3. **Image optimization** - Use next-gen formats
4. **CDN caching** - Configured for static assets
5. **Bundle size monitoring** - Enforce limits in CI/CD
6. **Web Vitals tracking** - Monitor continuously
7. **Database optimization** - Index frequently queried fields
8. **API caching** - Implement where appropriate

---

## Support & Resources

### Documentation

- **Complete Deployment Guide:** [`docs/PHASE-10-DEPLOYMENT-GUIDE.md`](./docs/PHASE-10-DEPLOYMENT-GUIDE.md)
- **Production Readiness:** [`docs/PRODUCTION-READINESS-REPORT.md`](./docs/PRODUCTION-READINESS-REPORT.md)
- **Pre-Deployment Checklist:** [`docs/checklists/PRE-DEPLOYMENT.md`](./docs/checklists/PRE-DEPLOYMENT.md)
- **Post-Deployment Checklist:** [`docs/checklists/POST-DEPLOYMENT.md`](./docs/checklists/POST-DEPLOYMENT.md)
- **Migration Guide:** [`docs/migrations/MIGRATION-EXECUTION-PLAN.md`](./docs/migrations/MIGRATION-EXECUTION-PLAN.md)

### External Resources

- **Vercel Documentation:** https://vercel.com/docs
- **Netlify Documentation:** https://docs.netlify.com
- **Sentry Documentation:** https://docs.sentry.io
- **Google Analytics:** https://support.google.com/analytics
- **Web Vitals:** https://web.dev/vitals/

### Getting Help

- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions
- **Team:** Internal Slack #pulse-support

---

## Next Steps

### Before First Production Deployment

1. **Install monitoring dependencies:**
   ```bash
   npm install @sentry/react @sentry/tracing web-vitals
   ```

2. **Configure GitHub secrets:**
   - Go to repository Settings → Secrets
   - Add all required secrets (see deployment guide)

3. **Setup monitoring accounts:**
   - Create Sentry project
   - Setup Google Analytics property
   - Configure alert rules

4. **Configure environment variables:**
   - Copy `.env.production.example` to `.env.production`
   - Fill in all production values
   - Add to Vercel/Netlify dashboard

5. **Deploy to staging:**
   - Create PR to main
   - Wait for automatic deployment
   - Run full smoke tests
   - Verify all features

6. **Deploy to production:**
   - Merge PR to main
   - Monitor deployment
   - Complete post-deployment checklist
   - Monitor for 24 hours

---

**Status:** ✅ **Ready for Production Deployment**

Follow the deployment guide and checklists for a successful launch!

---

**Last Updated:** 2026-01-20
**Maintained By:** DevOps Team
**Version:** 1.0.0
