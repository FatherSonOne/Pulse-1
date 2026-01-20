# Deployment Quick Reference

## Emergency Contacts

**On-Call Engineer**: See internal rotation schedule
**DevOps Lead**: See team directory
**Escalation**: CTO → CEO

---

## Quick Commands

### Deployment

```bash
# Deploy to production (automatic via GitHub Actions)
git push origin main

# Deploy to staging
git push origin develop

# Manual Vercel deployment
vercel --prod

# Rollback to previous version
vercel rollback
```

### Monitoring

```bash
# Health check
curl https://app.pulsemessages.com/health

# View logs
vercel logs [deployment-url] --follow

# Check error rate (Sentry)
open https://sentry.io/organizations/pulse/issues/

# Check analytics (PostHog)
open https://app.posthog.com/project/[id]/dashboard
```

### Feature Flags

```bash
# Disable feature immediately
curl -X PATCH https://api.pulsemessages.com/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"featureName": {"enabled": false}}'

# Check current flags
curl https://api.pulsemessages.com/admin/feature-flags
```

### Database

```bash
# Create backup
npm run backup:create

# Restore backup
npm run backup:restore --backup [backup-name]

# Run migration
npm run migrate:production

# Rollback migration
npm run migrate:rollback:production
```

---

## Rollback Decision Matrix

| Error Rate | Users Affected | Action | ETA |
|-----------|----------------|--------|-----|
| > 5% | > 50% | Immediate rollback | 30s |
| 1-5% | 10-50% | Disable feature flag | 30s |
| < 1% | < 10% | Monitor + hotfix | 1hr |

---

## Alert Severity Levels

| Level | Response Time | Action |
|-------|--------------|--------|
| 🚨 **Critical** | Immediate | Page on-call, rollback if needed |
| ❌ **Error** | < 15 min | Investigate and fix |
| ⚠️ **Warning** | < 1 hour | Review and optimize |
| ℹ️ **Info** | < 24 hours | Track for trends |

---

## Common Issues

### Deployment Failed
```bash
# Check logs
gh run view --log-failed

# Common fixes:
# 1. Fix build errors in code
# 2. Update dependencies
# 3. Check environment variables
```

### High Error Rate
```bash
# Quick rollback
vercel rollback

# Or disable feature
curl -X PATCH [feature-flag-endpoint] -d '{"feature": {"enabled": false}}'
```

### Database Issues
```bash
# Check connection
npm run db:ping

# Restore from backup
npm run backup:restore --latest

# Rollback migration
npm run migrate:rollback:production
```

---

## Monitoring Dashboards

- **Sentry**: https://sentry.io/organizations/pulse/issues/
- **PostHog**: https://app.posthog.com/project/[id]/dashboard
- **Vercel**: https://vercel.com/[team]/pulse-messages
- **Supabase**: https://app.supabase.com/project/[id]
- **Status**: https://status.pulsemessages.com

---

## Deployment Windows

**Best Times**:
- Tue-Thu: 10am-2pm UTC ✅
- After hours: 8-11pm UTC ✅

**Avoid**:
- Monday mornings ❌
- Friday afternoons ❌
- Weekends ❌

---

## Success Criteria

- ✅ Health checks passing
- ✅ Error rate < 0.1%
- ✅ Response time < 300ms
- ✅ All smoke tests pass
- ✅ No user complaints

---

**Last Updated**: 2025-01-19
**For detailed procedures**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
