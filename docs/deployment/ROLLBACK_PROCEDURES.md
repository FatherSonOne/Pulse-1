# Rollback Procedures

## Overview

This document outlines the procedures for rolling back deployments in case of critical issues, errors, or performance degradation.

## Quick Rollback Checklist

- [ ] Confirm rollback is necessary
- [ ] Notify team via Slack
- [ ] Execute rollback procedure
- [ ] Verify rollback success
- [ ] Monitor for 15 minutes
- [ ] Document incident

## Automated Rollback Triggers

The deployment system will automatically trigger a rollback if:

### Critical Error Thresholds
- **Error rate > 5%** for 5 consecutive minutes
- **Performance degradation > 50%** (P95 response time)
- **User-reported critical bugs > 10** in 1 hour
- **Health check failures > 3** in 5 minutes
- **Database connection failures**
- **Authentication service failures**

### Monitoring Alerts
All automated rollback triggers will:
1. Send urgent alerts to on-call engineer
2. Post to #incidents Slack channel
3. Create incident ticket automatically
4. Execute rollback procedure
5. Notify stakeholders

## Manual Rollback Procedures

### Option 1: Feature Flag Rollback (Fastest - 30 seconds)

For feature-specific issues, disable the problematic feature via feature flags:

```bash
# Disable specific feature
curl -X PATCH https://api.pulsemessages.com/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "splitViewLayout": {"enabled": false},
    "aiSummarization": {"enabled": false}
  }'

# Or use the admin dashboard
# Navigate to: https://app.pulsemessages.com/admin/feature-flags
# Toggle off the problematic feature
```

**Recovery Time**: ~30 seconds
**Impact**: Only affects specific feature
**Best for**: Feature-specific bugs

---

### Option 2: Vercel Instant Rollback (Medium - 2-3 minutes)

Rollback to previous deployment using Vercel dashboard:

```bash
# Via Vercel CLI
vercel rollback

# Or via Vercel Dashboard:
# 1. Go to https://vercel.com/[team]/pulse-messages
# 2. Navigate to "Deployments"
# 3. Find last known good deployment
# 4. Click "..." menu → "Promote to Production"
```

**Recovery Time**: ~2-3 minutes
**Impact**: Full application rollback
**Best for**: Widespread issues

---

### Option 3: Git Revert Deployment (Slower - 5-10 minutes)

Revert the problematic commit and trigger new deployment:

```bash
# Step 1: Identify problematic commit
git log --oneline -10

# Step 2: Revert the commit
git revert [commit-hash]

# Step 3: Push to trigger deployment
git push origin main

# Step 4: Monitor deployment
# Deployment will trigger automatically via GitHub Actions
```

**Recovery Time**: ~5-10 minutes
**Impact**: Full application rollback with new deployment
**Best for**: Code-level issues requiring permanent fix

---

### Option 4: Database Rollback (Critical - 10-30 minutes)

For database schema changes causing issues:

```bash
# Step 1: Connect to database
psql $DATABASE_URL

# Step 2: Check migration status
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;

# Step 3: Rollback migration
npm run migrate:rollback

# Or manually:
psql $DATABASE_URL -f sql-scripts/rollback/[migration-name].sql

# Step 4: Verify data integrity
npm run db:verify

# Step 5: Clear application cache
npm run cache:clear
```

**Recovery Time**: ~10-30 minutes
**Impact**: Database schema revert
**Best for**: Database migration issues

---

## Blue-Green Deployment Rollback

Our deployment uses blue-green strategy for zero-downtime rollback:

```bash
# Current setup:
# Blue (Production): v1.2.3 serving 100% traffic
# Green (Staging): v1.2.4 receiving 0% traffic

# If v1.2.4 has issues after promotion:

# Step 1: Switch traffic back to Blue
vercel alias set [blue-deployment-url] app.pulsemessages.com

# Step 2: Verify health
curl https://app.pulsemessages.com/health

# Step 3: Monitor metrics
# Check Sentry, PostHog, and Lighthouse CI

# Step 4: Keep Green online for investigation
# Can route test traffic to Green for debugging
```

**Recovery Time**: ~30 seconds
**Impact**: Instant traffic switch
**Best for**: Zero-downtime rollback

---

## Rollback Verification

After executing rollback, verify success:

### 1. Health Checks
```bash
# Application health
curl https://app.pulsemessages.com/health

# API health
curl https://api.pulsemessages.com/health

# Database connectivity
npm run db:ping
```

### 2. Smoke Tests
```bash
# Run automated smoke tests
npm run test:smoke

# Critical user flows:
# - User login
# - Send message
# - View messages
# - Thread view
# - Search functionality
```

### 3. Monitoring Dashboards
- **Sentry**: Error rate should drop to normal levels
- **PostHog**: User activity metrics should stabilize
- **Lighthouse CI**: Performance scores should return to baseline
- **Vercel Analytics**: Response times should normalize

### 4. User Verification
- Monitor #support channel for user reports
- Check Twitter/social media for mentions
- Review in-app feedback submissions

---

## Post-Rollback Actions

### Immediate (0-15 minutes)
1. **Monitor continuously** for 15 minutes
2. **Update status page** (https://status.pulsemessages.com)
3. **Notify users** via email/in-app notification
4. **Create incident ticket** with details

### Short-term (15-60 minutes)
1. **Root cause analysis** - Identify what went wrong
2. **Fix preparation** - Develop hotfix if needed
3. **Testing** - Test fix in staging environment
4. **Documentation** - Update runbooks with lessons learned

### Long-term (1-24 hours)
1. **Post-mortem meeting** with engineering team
2. **Prevention measures** - Add tests, monitoring, alerts
3. **Update deployment checklist** with new checks
4. **Communicate learnings** to broader team

---

## Communication Templates

### Slack Incident Notification
```
🚨 INCIDENT: Rollback Required

Severity: [P0/P1/P2]
Affected: [Feature/System]
Reason: [Brief description]
Action: Initiating rollback to v[version]
ETA: [time]

Status updates will be posted every 5 minutes.
Incident Lead: @[name]
```

### User Notification Email
```
Subject: Brief Service Interruption - Resolved

Hi there,

We experienced a brief technical issue that required us to rollback
a recent update. The issue has been resolved and all systems are
operating normally.

No data was lost and no action is required on your part.

We apologize for any inconvenience.

- The Pulse Messages Team
```

### Post-Mortem Template
See: `docs/deployment/POST_MORTEM_TEMPLATE.md`

---

## Rollback Metrics to Track

### Success Metrics
- **Time to Detection**: < 5 minutes
- **Time to Decision**: < 2 minutes
- **Time to Rollback**: < 5 minutes
- **Total Incident Duration**: < 15 minutes

### Quality Metrics
- **False Positives**: Should be < 5%
- **Successful Rollbacks**: Should be > 95%
- **Data Loss**: Should be 0%
- **User Impact**: Minimize affected users

---

## Rollback Decision Matrix

| Issue Severity | User Impact | Response Time | Rollback Type |
|---------------|-------------|---------------|---------------|
| P0 - Critical | > 50% users | Immediate | Blue-Green Switch |
| P1 - High | 10-50% users | < 5 min | Feature Flag |
| P2 - Medium | < 10% users | < 15 min | Feature Flag |
| P3 - Low | < 1% users | < 1 hour | Scheduled Fix |

---

## Emergency Contacts

### On-Call Rotation
- **Primary**: [Name] - [Phone] - [Email]
- **Secondary**: [Name] - [Phone] - [Email]
- **Manager**: [Name] - [Phone] - [Email]

### Escalation Path
1. On-call Engineer (5 min)
2. Engineering Manager (10 min)
3. CTO (15 min)
4. CEO (20 min)

### External Vendors
- **Vercel Support**: support@vercel.com
- **Supabase Support**: support@supabase.io
- **Sentry Support**: support@sentry.io

---

## Practice Drills

### Monthly Rollback Drill
Conduct rollback drills on the first Friday of each month:

1. Simulate production issue in staging
2. Execute rollback procedure
3. Time all steps
4. Document improvements
5. Update procedures

### Quarterly Chaos Engineering
- Random feature flag toggles
- Simulated database failures
- Network latency injection
- Load testing under stress

---

## Additional Resources

- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Incident Response Playbook](./INCIDENT_RESPONSE.md)
- [Database Backup Strategy](./DATABASE_BACKUP.md)
- [Monitoring Dashboard](https://app.pulsemessages.com/admin/monitoring)
- [Status Page](https://status.pulsemessages.com)

---

**Last Updated**: 2025-01-19
**Document Owner**: DevOps Team
**Review Frequency**: Monthly
