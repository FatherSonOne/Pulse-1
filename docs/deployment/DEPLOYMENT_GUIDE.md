# Deployment Guide

## Overview

Complete deployment guide for Pulse Messages covering staging and production environments.

---

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (unit, integration, e2e)
- [ ] Code review approved
- [ ] TypeScript type check passes
- [ ] Linting passes with no warnings
- [ ] No security vulnerabilities (npm audit)

### Database
- [ ] Migrations tested in staging
- [ ] Backup created (pre-deployment)
- [ ] Rollback script prepared
- [ ] Data integrity verified

### Configuration
- [ ] Environment variables configured
- [ ] Feature flags set appropriately
- [ ] API keys valid and tested
- [ ] Rate limits configured

### Monitoring
- [ ] Sentry DSN configured
- [ ] PostHog tracking active
- [ ] Error alerts configured
- [ ] Performance monitoring enabled

### Documentation
- [ ] CHANGELOG.md updated
- [ ] API documentation current
- [ ] Deployment notes prepared
- [ ] Rollback procedure reviewed

---

## Deployment Environments

### Development
- **URL**: http://localhost:5173
- **Database**: Local PostgreSQL or Supabase dev
- **Purpose**: Local development and testing
- **Deploy**: Manual (`npm run dev`)

### Staging
- **URL**: https://staging.pulsemessages.com
- **Database**: Supabase staging project
- **Purpose**: Pre-production testing and QA
- **Deploy**: Automatic on push to `develop` branch

### Production
- **URL**: https://app.pulsemessages.com
- **Database**: Supabase production project
- **Purpose**: Live user environment
- **Deploy**: Automatic on push to `main` branch (with approval)

---

## Deployment Methods

### Method 1: Automated GitHub Actions (Recommended)

```bash
# Step 1: Ensure all tests pass locally
npm run test:run
npm run test:e2e

# Step 2: Commit and push to main
git add .
git commit -m "feat: Add new feature with comprehensive tests"
git push origin main

# Step 3: Monitor GitHub Actions
# Visit: https://github.com/[org]/pulse-messages/actions

# Step 4: Approve deployment (if required)
# Production deployments require manual approval

# Step 5: Verify deployment
curl https://app.pulsemessages.com/health
```

### Method 2: Manual Vercel Deployment

```bash
# Step 1: Install Vercel CLI
npm install -g vercel

# Step 2: Login to Vercel
vercel login

# Step 3: Deploy to production
vercel --prod

# Step 4: Verify deployment
vercel inspect [deployment-url]
```

### Method 3: Emergency Hotfix Deployment

```bash
# For critical production bugs requiring immediate fix

# Step 1: Create hotfix branch
git checkout -b hotfix/critical-bug-fix main

# Step 2: Make minimal fix
# Edit only necessary files

# Step 3: Test fix locally
npm run test:run
npm run build

# Step 4: Commit and push
git commit -m "hotfix: Fix critical production bug"
git push origin hotfix/critical-bug-fix

# Step 5: Create pull request
gh pr create --base main --title "Hotfix: Critical Bug"

# Step 6: Fast-track review and merge
# Notify team for immediate review

# Step 7: Deploy automatically on merge to main
```

---

## Deployment Workflow

### 1. Pre-Deployment Phase (30 minutes before)

```bash
# Create pre-deployment backup
npm run backup:create

# Verify staging environment
npm run test:staging

# Notify team
npm run deploy:notify --env production --time "14:00 UTC"

# Review deployment plan
cat docs/deployment/DEPLOYMENT_PLAN.md
```

### 2. Deployment Phase (10-15 minutes)

```bash
# Merge to main (triggers GitHub Actions)
git checkout main
git merge --no-ff develop
git push origin main

# Monitor deployment
# Dashboard: https://github.com/[org]/pulse-messages/actions

# Watch real-time logs
vercel logs [deployment-url] --follow
```

### 3. Verification Phase (15-30 minutes)

```bash
# Health checks
curl https://app.pulsemessages.com/health

# Smoke tests
npm run test:smoke:production

# Monitor error rates (Sentry)
# Check: https://sentry.io/organizations/pulse/issues/

# Monitor performance (Lighthouse CI)
npm run lighthouse:production

# Monitor analytics (PostHog)
# Check: https://app.posthog.com/project/[id]/dashboard
```

### 4. Post-Deployment Phase (1 hour)

```bash
# Monitor continuously for 1 hour
watch -n 60 'curl -s https://app.pulsemessages.com/health'

# Check error rates every 5 minutes
# Target: < 0.1% error rate

# Verify feature flags
curl https://api.pulsemessages.com/admin/feature-flags

# Update status page
echo "Deployment successful" > status.txt

# Send completion notification
npm run deploy:notify --status success
```

---

## Blue-Green Deployment Strategy

### Overview
Zero-downtime deployments using blue-green strategy:

- **Blue**: Current production (v1.2.3)
- **Green**: New version (v1.2.4)

### Process

```bash
# Step 1: Deploy Green environment
vercel --prod # Deploys to green environment

# Step 2: Run smoke tests on Green
npm run test:smoke --url [green-deployment-url]

# Step 3: Gradually shift traffic (canary)
# 5% → 10% → 25% → 50% → 100%
vercel alias set [green-url] app.pulsemessages.com --weight 5

# Step 4: Monitor metrics for 10 minutes
# Error rate, latency, user feedback

# Step 5: Increase traffic gradually
vercel alias set [green-url] app.pulsemessages.com --weight 100

# Step 6: Keep Blue online for 24 hours (rollback capability)

# Step 7: Decommission Blue after success
# After 24 hours with no issues
```

### Rollback Process

```bash
# If Green has issues, instantly rollback to Blue
vercel alias set [blue-url] app.pulsemessages.com

# Recovery time: ~30 seconds
```

---

## Feature Flag Deployment

### Gradual Rollout Strategy

```typescript
// Week 1: Internal testing (10%)
{
  "newFeature": {
    "enabled": true,
    "rolloutPercentage": 10,
    "targetUsers": ["internal"]
  }
}

// Week 2: Beta testers (25%)
{
  "newFeature": {
    "enabled": true,
    "rolloutPercentage": 25,
    "targetUsers": ["beta-testers", "internal"]
  }
}

// Week 3: Early adopters (50%)
{
  "newFeature": {
    "enabled": true,
    "rolloutPercentage": 50,
    "targetUsers": ["early-adopters", "beta-testers", "internal"]
  }
}

// Week 4: General availability (100%)
{
  "newFeature": {
    "enabled": true,
    "rolloutPercentage": 100,
    "targetUsers": ["all"]
  }
}
```

### Feature Flag Management

```bash
# Enable feature for specific user group
curl -X PATCH https://api.pulsemessages.com/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "aiSummarization": {
      "enabled": true,
      "rolloutPercentage": 25,
      "targetUsers": ["beta-testers"]
    }
  }'

# Disable feature immediately (emergency)
curl -X PATCH https://api.pulsemessages.com/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "problematicFeature": {
      "enabled": false
    }
  }'
```

---

## Database Migrations

### Migration Deployment

```bash
# Step 1: Test migration in staging
npm run migrate:staging

# Step 2: Verify data integrity
npm run db:verify:staging

# Step 3: Create backup before production migration
npm run backup:create --tag "pre-migration-$(date +%Y%m%d)"

# Step 4: Run production migration
npm run migrate:production

# Step 5: Verify migration success
npm run db:verify:production

# Step 6: Test application with new schema
npm run test:smoke:production
```

### Migration Rollback

```bash
# If migration fails or causes issues

# Step 1: Rollback migration
npm run migrate:rollback:production

# Step 2: Restore database from backup
npm run backup:restore --backup "pre-migration-20250119"

# Step 3: Verify data integrity
npm run db:verify:production

# Step 4: Investigate issue
npm run logs --since "1 hour ago"
```

---

## Monitoring During Deployment

### Key Metrics to Watch

```bash
# Error Rate
# Target: < 0.1%
# Alert: > 1%
# Critical: > 5%

# Response Time (P95)
# Target: < 300ms
# Alert: > 500ms
# Critical: > 1000ms

# Success Rate
# Target: > 99.9%
# Alert: < 99%
# Critical: < 95%

# Active Users
# Monitor for unexpected drops
# Alert: > 10% drop in 5 minutes
```

### Monitoring Commands

```bash
# Real-time error monitoring
curl https://sentry.io/api/0/organizations/pulse/issues/ \
  -H "Authorization: Bearer $SENTRY_TOKEN" | jq

# Performance monitoring
lighthouse https://app.pulsemessages.com \
  --chrome-flags="--headless" \
  --output json | jq '.categories.performance.score'

# User activity monitoring (PostHog)
curl https://app.posthog.com/api/projects/[id]/insights/ \
  -H "Authorization: Bearer $POSTHOG_TOKEN"

# Health check
watch -n 10 'curl -s https://app.pulsemessages.com/health | jq'
```

---

## Deployment Schedule

### Recommended Deployment Windows

**Best Times** (Low Traffic):
- **Tuesday - Thursday**: 10:00 AM - 2:00 PM UTC
- **After business hours**: 8:00 PM - 11:00 PM UTC
- **Early morning**: 5:00 AM - 8:00 AM UTC

**Avoid**:
- ❌ **Monday mornings** (high support volume)
- ❌ **Friday afternoons** (limited support coverage)
- ❌ **Weekends** (limited engineering availability)
- ❌ **Holidays** (limited staff)
- ❌ **During sales events** (high traffic)

### Emergency Deployment

Can be performed 24/7 for:
- Critical security vulnerabilities
- Data loss prevention
- System outages
- Regulatory compliance issues

---

## Deployment Notifications

### Stakeholder Communication

```bash
# Pre-deployment (1 hour before)
To: engineering@company.com, support@company.com
Subject: Production Deployment - Today at 14:00 UTC

We will deploy version 1.2.4 today at 14:00 UTC.

Changes:
- New AI summarization feature
- Performance improvements
- Bug fixes

Expected duration: 15 minutes
Status updates: #deployments Slack channel

# During deployment
Slack: #deployments
"🚀 Deployment started - v1.2.4"

# Post-deployment
Slack: #deployments
"✅ Deployment successful - v1.2.4
Error rate: 0.02%
Response time (P95): 245ms
Active users: 1,234"
```

---

## Troubleshooting

### Common Issues

#### Issue: Deployment Fails

```bash
# Check GitHub Actions logs
gh run view --log-failed

# Check Vercel logs
vercel logs [deployment-url]

# Common causes:
# - Build errors
# - Environment variable missing
# - Dependency conflicts
# - Network timeouts
```

#### Issue: High Error Rate After Deployment

```bash
# Immediate rollback
vercel rollback

# Or disable feature flag
curl -X PATCH https://api.pulsemessages.com/admin/feature-flags \
  -d '{"newFeature": {"enabled": false}}'

# Investigate errors
# Sentry: https://sentry.io/organizations/pulse/issues/
```

#### Issue: Performance Degradation

```bash
# Check performance metrics
lighthouse https://app.pulsemessages.com

# Check database queries
npm run db:slow-queries

# Check bundle size
npm run build:analyze

# Consider rollback if critical
```

---

## Deployment Metrics

### Success Criteria
- ✅ Zero downtime
- ✅ Error rate < 0.1%
- ✅ Response time (P95) < 300ms
- ✅ All smoke tests pass
- ✅ No database rollback required

### Track Over Time
- **Deployment frequency**: Target 5-10 per week
- **Deployment duration**: Target < 15 minutes
- **Failed deployments**: Target < 2%
- **Rollback rate**: Target < 1%
- **Mean time to recovery**: Target < 5 minutes

---

## Additional Resources

- [Rollback Procedures](./ROLLBACK_PROCEDURES.md)
- [Database Backup Strategy](./DATABASE_BACKUP.md)
- [Feature Flag System](../../src/lib/featureFlags.ts)
- [Monitoring Dashboard](https://app.pulsemessages.com/admin/monitoring)

---

**Last Updated**: 2025-01-19
**Document Owner**: DevOps Team
**Review Frequency**: Monthly
