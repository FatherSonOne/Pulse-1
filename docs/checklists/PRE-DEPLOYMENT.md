# Pre-Deployment Checklist

**Deployment Date:** _______________
**Deployed By:** _______________
**Release Version:** _______________

## Code Quality

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] No linting errors (`npm run lint`)
- [ ] TypeScript compilation successful (`npx tsc --noEmit`)
- [ ] Code reviewed and approved by at least 2 engineers
- [ ] Branch is up to date with main
- [ ] No merge conflicts
- [ ] All TODO comments addressed or tracked
- [ ] No console.log statements in production code
- [ ] All debugging code removed

## Security

- [ ] Security scan passed (`npm audit --audit-level=high`)
- [ ] No vulnerabilities in dependencies
- [ ] No secrets in codebase
- [ ] Environment variables validated (`npm run validate:env`)
- [ ] API keys rotated for production environment
- [ ] HTTPS enforced on all endpoints
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Input validation implemented
- [ ] XSS protection enabled
- [ ] SQL injection protection verified
- [ ] Authentication flows tested
- [ ] Authorization rules verified

## Performance

- [ ] Build size checked (< 5MB total bundle)
- [ ] Lighthouse score > 90 for all metrics
  - [ ] Performance > 90
  - [ ] Accessibility > 95
  - [ ] Best Practices > 90
  - [ ] SEO > 90
- [ ] Images optimized and compressed
- [ ] Code splitting implemented
- [ ] Lazy loading configured
- [ ] No memory leaks detected
- [ ] API response times < 200ms (p95)
- [ ] Database queries optimized
- [ ] Caching strategy implemented

## Testing

- [ ] Smoke tests prepared (`scripts/smoke-test.sh`)
- [ ] Critical user journeys tested manually
  - [ ] User registration
  - [ ] User login
  - [ ] Core features (messaging, briefings, etc.)
  - [ ] User logout
- [ ] Cross-browser testing completed
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge
- [ ] Mobile responsiveness verified
- [ ] Error handling tested
- [ ] Edge cases covered
- [ ] Load testing completed (if major changes)

## Database

- [ ] Database migrations prepared
- [ ] Migration tested on staging
- [ ] Rollback scripts ready
- [ ] Backup created and verified
- [ ] Data integrity checks passed
- [ ] Index optimization reviewed
- [ ] Query performance verified

## Environment Configuration

- [ ] Production environment variables configured
- [ ] All required secrets set in hosting platform
- [ ] OAuth redirect URIs updated
- [ ] API endpoints configured correctly
- [ ] Feature flags set appropriately
- [ ] CDN configured (if applicable)
- [ ] DNS records verified

## Monitoring & Observability

- [ ] Error tracking configured (Sentry)
- [ ] Analytics configured (Google Analytics)
- [ ] Performance monitoring enabled
- [ ] Log aggregation configured
- [ ] Alerts configured for critical metrics
  - [ ] Error rate > 5%
  - [ ] Response time > 1s (p95)
  - [ ] CPU usage > 80%
  - [ ] Memory usage > 80%
  - [ ] Database connections > 80%
- [ ] Monitoring dashboards prepared
- [ ] On-call rotation updated

## Documentation

- [ ] README updated
- [ ] Changelog updated
- [ ] API documentation current
- [ ] Environment variables documented
- [ ] Deployment guide reviewed
- [ ] Runbook updated
- [ ] Architecture diagrams current
- [ ] Known issues documented

## Deployment Plan

- [ ] Deployment method chosen
  - [ ] Automated (CI/CD)
  - [ ] Manual
  - [ ] Blue-green
  - [ ] Canary
- [ ] Deployment window scheduled
- [ ] Team notified of deployment
- [ ] Stakeholders notified
- [ ] Maintenance window scheduled (if needed)
- [ ] Rollback plan prepared
- [ ] Communication plan ready

## Rollback Preparation

- [ ] Rollback procedure documented
- [ ] Rollback tested on staging
- [ ] Previous version tagged in Git
- [ ] Database rollback scripts prepared
- [ ] Feature flags configured for quick rollback
- [ ] Team trained on rollback procedure

## Communication

- [ ] Team notified in Slack/Teams
- [ ] Stakeholders notified via email
- [ ] Status page prepared (if applicable)
- [ ] Support team briefed
- [ ] Customer success team notified
- [ ] Post-deployment communication template ready

## Infrastructure

- [ ] Hosting platform capacity verified
- [ ] CDN cache invalidation plan ready
- [ ] SSL certificates valid
- [ ] Domain DNS propagation verified
- [ ] Load balancer configured
- [ ] Auto-scaling rules reviewed
- [ ] Backup systems verified

## Compliance

- [ ] GDPR compliance verified
- [ ] Privacy policy updated
- [ ] Terms of service current
- [ ] Data retention policies enforced
- [ ] Audit logs enabled
- [ ] Security audit passed (if required)

## Final Checks

- [ ] Staging deployment successful
- [ ] Staging smoke tests passed
- [ ] Staging performance acceptable
- [ ] All checklist items completed
- [ ] Deployment approval obtained
- [ ] Emergency contacts updated
- [ ] War room/incident channel ready

## Approvals

**Engineering Lead:** _______________ Date: _______________

**Product Manager:** _______________ Date: _______________

**Security Lead:** _______________ Date: _______________

**CTO (if required):** _______________ Date: _______________

---

**Notes:**

_Use this space to document any special considerations or risks for this deployment_

---

## Deployment Command (When all checks pass)

```bash
# Verify one last time
npm run lint && npm test && npm run build

# Deploy via CI/CD (recommended)
git push origin main

# OR manual deployment
vercel --prod

# OR Docker deployment
docker build -t pulse:v{VERSION} .
docker push registry.yourdomain.com/pulse:v{VERSION}
```

---

**Post this checklist:** After deployment, proceed to [POST-DEPLOYMENT.md](./POST-DEPLOYMENT.md)

---

**Last Updated:** 2026-01-20
**Version:** 1.0.0
