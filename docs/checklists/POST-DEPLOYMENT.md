# Post-Deployment Checklist

**Deployment Date:** _______________
**Deployed By:** _______________
**Release Version:** _______________
**Deployment Time:** _______________

## Immediate Verification (0-5 minutes)

- [ ] Deployment completed successfully
- [ ] Application is accessible at production URL
- [ ] Health check endpoint responding (`/health`)
- [ ] No critical errors in deployment logs
- [ ] CI/CD pipeline completed successfully
- [ ] DNS resolving correctly
- [ ] SSL certificate valid

## Automated Tests (5-10 minutes)

- [ ] Smoke tests passed (`./scripts/smoke-test.sh`)
- [ ] Critical API endpoints responding
  - [ ] Homepage loads (200 OK)
  - [ ] Dashboard loads (200 OK)
  - [ ] Messages page loads (200 OK)
  - [ ] Auth endpoints working
- [ ] Static assets loading correctly
- [ ] CDN cache working (if applicable)

## Authentication & Authorization (10-15 minutes)

- [ ] User login working
  - [ ] Email/password login
  - [ ] Google OAuth login
  - [ ] Microsoft OAuth login (if applicable)
- [ ] User registration working
- [ ] Password reset working
- [ ] Session management working
- [ ] JWT tokens generated correctly
- [ ] User logout working
- [ ] Protected routes requiring authentication

## Core Features Testing (15-30 minutes)

- [ ] Dashboard displays correctly
- [ ] Daily briefing generation working
- [ ] Message sending/receiving working
- [ ] Decision creation working
- [ ] Task management working
- [ ] Search functionality working
- [ ] Sidebar navigation working
- [ ] User profile page working
- [ ] Settings page working

## Database Verification (10-15 minutes)

- [ ] Database connections healthy
- [ ] Read operations working
- [ ] Write operations working
- [ ] Migrations applied successfully
- [ ] Data integrity verified
- [ ] Indexes performing correctly
- [ ] No connection pool exhaustion
- [ ] Backup system operational

## Performance Verification (10-20 minutes)

- [ ] Lighthouse audit completed
  - [ ] Performance score: _____ / 100 (target: > 90)
  - [ ] Accessibility score: _____ / 100 (target: > 95)
  - [ ] Best Practices score: _____ / 100 (target: > 90)
  - [ ] SEO score: _____ / 100 (target: > 90)
- [ ] Page load time < 3 seconds
- [ ] API response times < 200ms (p95)
- [ ] No memory leaks detected
- [ ] CPU usage normal (< 50%)
- [ ] Memory usage normal (< 70%)

## Monitoring & Alerting (10-15 minutes)

- [ ] Sentry receiving events
- [ ] Google Analytics tracking pageviews
- [ ] Performance monitoring active
- [ ] Log aggregation working
- [ ] Alerts configured and firing correctly
- [ ] Error tracking showing recent deployment
- [ ] Real-time monitoring dashboard accessible
- [ ] On-call alerts configured

## Security Verification (10-15 minutes)

- [ ] HTTPS enforced (no HTTP access)
- [ ] Security headers present
  - [ ] Content-Security-Policy
  - [ ] X-Frame-Options
  - [ ] X-Content-Type-Options
  - [ ] Strict-Transport-Security
  - [ ] Referrer-Policy
- [ ] CORS configured correctly
- [ ] API keys not exposed in client bundle
- [ ] Rate limiting working
- [ ] Input validation working
- [ ] No XSS vulnerabilities
- [ ] No SQL injection vulnerabilities

## Cross-Browser Testing (15-20 minutes)

- [ ] Chrome - Latest version
  - [ ] Desktop: _____________
  - [ ] Mobile: _____________
- [ ] Firefox - Latest version
  - [ ] Desktop: _____________
- [ ] Safari - Latest version
  - [ ] Desktop: _____________
  - [ ] iOS: _____________
- [ ] Edge - Latest version
  - [ ] Desktop: _____________

## Mobile Responsiveness (10-15 minutes)

- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] Tablet (iPad/Android)
- [ ] Touch interactions working
- [ ] Responsive layout correct
- [ ] Mobile navigation working

## Integration Testing (15-20 minutes)

- [ ] Supabase integration working
- [ ] Gemini AI API working
- [ ] OAuth providers working
- [ ] Email service working (if applicable)
- [ ] Third-party APIs responding
- [ ] Webhooks configured (if applicable)

## Error Handling (10-15 minutes)

- [ ] 404 page displays correctly
- [ ] Error boundaries catching errors
- [ ] Graceful degradation working
- [ ] Offline behavior acceptable
- [ ] Network error handling working
- [ ] API error responses handled
- [ ] User-friendly error messages

## SEO & Metadata (5-10 minutes)

- [ ] Meta tags present
- [ ] Open Graph tags working
- [ ] Twitter Card tags working
- [ ] Sitemap accessible
- [ ] robots.txt configured
- [ ] Canonical URLs correct

## Monitoring Initial Metrics (30-60 minutes)

Monitor the following for the first hour:

### Error Rates
- [ ] Error rate < 1%
- [ ] No critical errors in Sentry
- [ ] No database errors
- [ ] No authentication errors

### Performance Metrics
- [ ] Response time p50: _____ ms (target: < 100ms)
- [ ] Response time p95: _____ ms (target: < 200ms)
- [ ] Response time p99: _____ ms (target: < 500ms)
- [ ] Apdex score: _____ (target: > 0.95)

### User Metrics
- [ ] Active users count normal
- [ ] No unusual user activity
- [ ] Session duration normal
- [ ] Bounce rate normal

### Infrastructure Metrics
- [ ] CPU usage: _____ % (target: < 60%)
- [ ] Memory usage: _____ % (target: < 70%)
- [ ] Database connections: _____ (target: < 50)
- [ ] Request rate normal

## Communication (10-15 minutes)

- [ ] Team notified of successful deployment
- [ ] Stakeholders notified
- [ ] Support team briefed
- [ ] Status page updated (if applicable)
- [ ] Release notes published
- [ ] Changelog updated
- [ ] Social media announcement (if applicable)

## Documentation Updates (10-15 minutes)

- [ ] Deployment log updated
- [ ] Known issues documented
- [ ] Runbook updated with any changes
- [ ] Architecture diagrams updated (if changed)
- [ ] API documentation current

## Rollback Readiness (5-10 minutes)

- [ ] Rollback procedure verified
- [ ] Previous version tagged
- [ ] Database rollback scripts ready
- [ ] Team knows rollback procedure
- [ ] Rollback decision criteria defined

## Extended Monitoring (Next 24 hours)

Schedule checks for:

- [ ] +2 hours: Check error rates and performance
- [ ] +6 hours: Review monitoring dashboards
- [ ] +12 hours: Check overnight metrics
- [ ] +24 hours: Full metrics review

## Known Issues

Document any issues found during deployment:

| Issue | Severity | Status | Owner | Notes |
|-------|----------|--------|-------|-------|
|       |          |        |       |       |
|       |          |        |       |       |

## Metrics Summary

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Deployment Time | < 15 min | _____ | ⬜ |
| Error Rate | < 1% | _____ % | ⬜ |
| Response Time (p95) | < 200ms | _____ ms | ⬜ |
| Lighthouse Performance | > 90 | _____ | ⬜ |
| Lighthouse Accessibility | > 95 | _____ | ⬜ |
| Active Users | Normal | _____ | ⬜ |
| CPU Usage | < 60% | _____ % | ⬜ |
| Memory Usage | < 70% | _____ % | ⬜ |

## Post-Deployment Actions

- [ ] Create deployment report
- [ ] Schedule post-mortem (if issues occurred)
- [ ] Update team documentation
- [ ] Archive deployment artifacts
- [ ] Tag release in Git
- [ ] Update project board
- [ ] Thank the team!

## Sign-off

**Deployed Successfully:** ⬜ Yes  ⬜ No (If no, initiate rollback)

**Verified By:**

- Engineering Lead: _______________ Date/Time: _______________
- Product Manager: _______________ Date/Time: _______________
- QA Lead: _______________ Date/Time: _______________

**Notes:**

_Use this space to document any observations, issues, or improvements for next deployment_

---

## If Issues Detected

If critical issues are found:

1. **Assess Severity**
   - P0 (Critical): Immediate rollback
   - P1 (High): Consider rollback
   - P2 (Medium): Fix forward
   - P3 (Low): Log and schedule fix

2. **Execute Rollback (if needed)**
   ```bash
   # Vercel
   vercel rollback <previous-deployment-url>

   # Or via Git
   git revert <commit-hash>
   git push origin main
   ```

3. **Notify Team**
   - Post in #incidents channel
   - Page on-call engineer (if P0)
   - Create incident ticket

4. **Document Issue**
   - Add to Known Issues table
   - Create post-mortem document
   - Update runbook

---

## Success Criteria

Deployment is considered successful when:

- ✅ All critical tests passing
- ✅ No P0/P1 errors in first hour
- ✅ Performance metrics within targets
- ✅ User activity normal
- ✅ No rollback needed

---

**Deployment Complete!** 🎉

Schedule follow-up review for 24 hours post-deployment.

---

**Last Updated:** 2026-01-20
**Version:** 1.0.0
