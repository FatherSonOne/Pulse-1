# Phase 10: Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying Pulse to production. Follow these procedures carefully to ensure a successful, secure, and reliable deployment.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [CI/CD Configuration](#cicd-configuration)
4. [Deployment Methods](#deployment-methods)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before deploying to production, ensure all items are completed:

### Code Quality
- [ ] All tests passing (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] TypeScript compilation successful (`npx tsc --noEmit`)
- [ ] Code reviewed and approved
- [ ] No console.log statements in production code
- [ ] All TODO comments addressed or documented

### Security
- [ ] Security scan passed (`npm audit`)
- [ ] No secrets in code or environment variables with VITE_ prefix
- [ ] API keys rotated for production
- [ ] Environment variables configured in hosting platform
- [ ] HTTPS enabled and enforced
- [ ] Security headers configured
- [ ] Content Security Policy (CSP) configured

### Performance
- [ ] Build size optimized (< 5MB total)
- [ ] Images optimized and compressed
- [ ] Lighthouse score > 90 for all metrics
- [ ] No memory leaks detected
- [ ] API response times < 200ms (p95)

### Documentation
- [ ] README updated with deployment instructions
- [ ] API documentation current
- [ ] Environment variables documented
- [ ] Runbook created for operations team
- [ ] Changelog updated

### Monitoring
- [ ] Error tracking configured (Sentry)
- [ ] Analytics configured (Google Analytics)
- [ ] Performance monitoring enabled
- [ ] Log aggregation configured
- [ ] Alerts configured for critical metrics

---

## Environment Setup

### 1. Configure Production Environment Variables

Create `.env.production` from the template:

```bash
cp .env.production.example .env.production
```

Required variables:

```env
# Application
VITE_ENV=production
VITE_APP_URL=https://pulse.yourdomain.com

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key

# API Keys (Backend Only - NO VITE_ PREFIX)
GEMINI_API_KEY=your-production-gemini-key

# OAuth
VITE_GOOGLE_CLIENT_ID=your-production-google-client-id
VITE_OAUTH_REDIRECT_URI=https://pulse.yourdomain.com/auth/callback

# Monitoring
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_ANALYTICS_ID=G-XXXXXXXXXX
VITE_ENABLE_ERROR_TRACKING=true
VITE_ENABLE_ANALYTICS=true
```

### 2. Configure Hosting Platform

#### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
vercel link

# Set environment variables
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
# ... add all other variables
```

#### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Link project
netlify link

# Set environment variables
netlify env:set VITE_SUPABASE_URL "your-value" --context production
netlify env:set VITE_SUPABASE_ANON_KEY "your-value" --context production
# ... add all other variables
```

### 3. Configure DNS

Point your domain to the hosting platform:

**Vercel:**
- Add CNAME record: `pulse.yourdomain.com` → `cname.vercel-dns.com`

**Netlify:**
- Add CNAME record: `pulse.yourdomain.com` → `your-site.netlify.app`

---

## CI/CD Configuration

### GitHub Actions

The project includes automated CI/CD workflows:

1. **ci.yml** - Runs on every push and PR
   - Linting and type checking
   - Unit and integration tests
   - Build verification
   - Security audit

2. **deploy-staging.yml** - Runs on PR to main
   - Deploys to staging environment
   - Runs smoke tests
   - Comments deployment URL on PR

3. **deploy-production.yml** - Runs on merge to main
   - Pre-deployment checks
   - Production build
   - Deployment to production
   - Post-deployment verification
   - Automated rollback on failure

### Required GitHub Secrets

Configure these secrets in GitHub repository settings:

```
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
STAGING_SUPABASE_URL
STAGING_SUPABASE_ANON_KEY
STAGING_GEMINI_API_KEY
PROD_SUPABASE_URL
PROD_SUPABASE_ANON_KEY
PROD_GEMINI_API_KEY
SENTRY_DSN
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
ANALYTICS_ID
SLACK_WEBHOOK_URL (optional)
```

---

## Deployment Methods

### Method 1: Automated Deployment (Recommended)

**Staging Deployment:**

1. Create PR to main branch
2. CI/CD automatically deploys to staging
3. Review staging deployment
4. Run manual tests if needed

**Production Deployment:**

1. Merge PR to main branch
2. CI/CD automatically:
   - Runs all tests
   - Builds production bundle
   - Deploys to production
   - Runs smoke tests
   - Notifies team

### Method 2: Manual Deployment

**Using Vercel CLI:**

```bash
# Build
npm run build

# Deploy to production
vercel --prod

# Or deploy specific directory
vercel --prod dist/
```

**Using Netlify CLI:**

```bash
# Build
npm run build

# Deploy to production
netlify deploy --prod --dir=dist
```

### Method 3: Docker Deployment

```bash
# Build Docker image
docker build -t pulse:latest .

# Run locally for testing
docker run -p 8080:8080 pulse:latest

# Tag for registry
docker tag pulse:latest registry.yourdomain.com/pulse:latest

# Push to registry
docker push registry.yourdomain.com/pulse:latest

# Deploy to production (varies by platform)
# Example: Kubernetes
kubectl apply -f k8s/deployment.yml
```

---

## Post-Deployment Verification

### 1. Run Smoke Tests

```bash
# Run automated smoke tests
./scripts/smoke-test.sh https://pulse.yourdomain.com

# Check specific endpoints
curl https://pulse.yourdomain.com/health
curl https://pulse.yourdomain.com/
```

### 2. Verify Monitoring

1. **Sentry** - Check error tracking is receiving events
   - Visit: https://sentry.io/organizations/your-org/projects/pulse/
   - Create test error to verify

2. **Analytics** - Verify analytics is tracking
   - Visit: https://analytics.google.com
   - Check real-time users

3. **Performance** - Check Web Vitals
   - Use Chrome DevTools Lighthouse
   - Verify all scores > 90

### 3. Manual Testing

Test critical user journeys:

1. **Authentication Flow**
   - [ ] Sign up with email
   - [ ] Sign up with Google OAuth
   - [ ] Login with existing account
   - [ ] Logout

2. **Core Features**
   - [ ] View dashboard
   - [ ] Generate daily briefing
   - [ ] Send/receive messages
   - [ ] Create decision/task
   - [ ] Search functionality

3. **Edge Cases**
   - [ ] Offline behavior
   - [ ] Network errors
   - [ ] Session expiry
   - [ ] Large datasets

### 4. Performance Verification

```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://pulse.yourdomain.com/

# Check bundle sizes
curl -I https://pulse.yourdomain.com/assets/index.js
```

### 5. Security Verification

```bash
# Check security headers
curl -I https://pulse.yourdomain.com/ | grep -i "x-frame-options\|content-security-policy\|strict-transport"

# Verify HTTPS
curl -I https://pulse.yourdomain.com/ | grep -i "HTTP/2\|HTTP/3"

# Check SSL certificate
openssl s_client -connect pulse.yourdomain.com:443 -servername pulse.yourdomain.com < /dev/null
```

---

## Rollback Procedures

### Automated Rollback (Vercel/Netlify)

Both platforms keep deployment history:

**Vercel:**
```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback <deployment-url>
```

**Netlify:**
```bash
# List deployments
netlify deploys

# Rollback to specific deployment
netlify rollback <deployment-id>
```

### Manual Rollback

1. **Revert Git Commit:**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Redeploy Previous Version:**
   ```bash
   git checkout <previous-tag>
   npm run build
   vercel --prod
   ```

### Database Rollback

If database migrations were included:

```bash
# Rollback database migration
./scripts/rollback-database.sh

# Verify data integrity
./scripts/verify-migration.sh
```

---

## Troubleshooting

### Build Failures

**Issue:** Build fails during deployment

**Solution:**
```bash
# Check build locally
npm run build

# Check for environment variable issues
npm run validate:env

# Check for dependency issues
npm ci
npm run build
```

### Runtime Errors

**Issue:** Application loads but crashes

**Solution:**
1. Check Sentry for error details
2. Check browser console for errors
3. Verify environment variables are set
4. Check API endpoints are accessible

### Performance Issues

**Issue:** Slow page load times

**Solution:**
1. Check bundle size: `npm run analyze`
2. Check Lighthouse scores
3. Review network tab in DevTools
4. Check CDN caching
5. Verify image optimization

### Authentication Issues

**Issue:** OAuth or login not working

**Solution:**
1. Verify OAuth redirect URI matches
2. Check Supabase project settings
3. Verify API keys are correct
4. Check browser console for CORS errors
5. Test in incognito mode

### Database Connection Issues

**Issue:** Unable to connect to Supabase

**Solution:**
1. Verify Supabase URL and keys
2. Check Supabase project status
3. Verify network connectivity
4. Check CORS configuration
5. Review Supabase logs

---

## Emergency Procedures

### Critical Production Issue

1. **Immediate Actions:**
   - Initiate rollback to last known good version
   - Notify team via Slack/email
   - Create incident ticket

2. **Assess Impact:**
   - Check error rates in Sentry
   - Check user reports
   - Review metrics dashboards

3. **Communication:**
   - Update status page
   - Notify affected users if necessary
   - Post in company channels

4. **Resolution:**
   - Fix issue in separate branch
   - Test thoroughly
   - Deploy fix with expedited process
   - Verify fix in production

### Data Loss Prevention

If you suspect data loss:
1. **Do not** redeploy immediately
2. Contact database administrator
3. Restore from backup if necessary
4. Document incident
5. Review backup procedures

---

## Post-Deployment Tasks

After successful deployment:

1. [ ] Update version number
2. [ ] Tag release in Git
3. [ ] Update changelog
4. [ ] Notify stakeholders
5. [ ] Monitor for 24 hours
6. [ ] Create deployment report
7. [ ] Schedule post-mortem if issues occurred
8. [ ] Update runbook with learnings

---

## Support & Escalation

**For deployment issues:**
- DevOps Team: devops@yourdomain.com
- On-call Engineer: +1-XXX-XXX-XXXX
- Slack Channel: #pulse-deployments

**For critical production issues:**
1. Page on-call engineer
2. Create P0 incident ticket
3. Notify CTO if impact is severe
4. Follow incident response procedures

---

## Additional Resources

- [Production Runbook](./PRODUCTION-RUNBOOK.md)
- [Operations Manual](./OPERATIONS-MANUAL.md)
- [Migration Guide](./migrations/MIGRATION-EXECUTION-PLAN.md)
- [Security Implementation](./security-implementation-summary.md)
- [API Documentation](./backend-api-endpoints.md)

---

**Last Updated:** 2026-01-20
**Maintained By:** DevOps Team
**Version:** 1.0.0
