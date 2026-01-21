# 🚨 SECURITY INCIDENT: Exposed Supabase Keys on GitHub

## Incident Summary
**Date**: January 20, 2026
**Severity**: CRITICAL
**Status**: In Progress

### What Happened
Supabase service role keys and anon keys were committed to GitHub in:
- `.env.production`
- `.env.staging`

These files were NOT in `.gitignore` and were pushed to the public repository.

### Exposed Credentials
The following secrets were exposed:
- ✅ Supabase Project URL (not sensitive, but exposed)
- ❌ **Supabase Anon Key** (public key, limited access via RLS)
- ❌ **Supabase Service Role Key** (CRITICAL - full database access)

## Immediate Actions Required

### 1. Rotate Supabase Service Role Key ⚠️ CRITICAL

**You must do this IMMEDIATELY in Supabase Dashboard:**

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `ucaeuszgoihoyrvhewxk`
3. Navigate to: **Settings** → **API**
4. Under **Project API keys**, find **service_role key**
5. Click **Reset service_role key**
6. Copy the new service role key
7. Update it in Vercel (see step 4 below)

**Old key (COMPROMISED - DO NOT USE):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYWV1c3pnb2lob3lydmhld3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTIyODk4NiwiZXhwIjoyMDgwODA0OTg2fQ._eSKtliUcjpbEXLqVqF2RIgwJehiQR5wJqYK0xKcSU0
```

### 2. Review Database Access Logs

Check if the exposed key was used maliciously:

1. In Supabase Dashboard: **Database** → **Logs**
2. Filter by date range: Last 24 hours
3. Look for suspicious queries or access patterns
4. Check for unexpected database modifications

### 3. Remove Secrets from Git History

The secrets are in Git history and need to be removed:

**Option A: Use BFG Repo-Cleaner (Recommended)**
```bash
# Download BFG: https://rtyley.github.io/bfg-repo-cleaner/
# Replace the exposed keys in history
bfg --replace-text secrets.txt pulse1.git

# Force push to overwrite history
cd pulse1
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all
```

**Option B: Manual Git Filter-Branch**
```bash
# Remove .env.production and .env.staging from all commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.production .env.staging" \
  --prune-empty --tag-name-filter cat -- --all

# Force push
git push origin --force --all
```

**⚠️ WARNING**: Force pushing rewrites history. Coordinate with your team.

### 4. Update Environment Variables in Vercel

After rotating the service role key:

1. Go to Vercel Dashboard: https://vercel.com/fathersonones-projects/pulse1
2. Navigate to: **Settings** → **Environment Variables**
3. Find `SUPABASE_SERVICE_KEY`
4. Click **Edit** and paste the NEW service role key
5. Save changes
6. Trigger a new deployment (it will use the new key)

### 5. Update Local Environment Files

After rotating keys, update your local files (they're now in .gitignore):

```bash
# .env.production (local only - DO NOT COMMIT)
SUPABASE_SERVICE_KEY=<NEW_SERVICE_ROLE_KEY_HERE>

# .env.staging (local only - DO NOT COMMIT)
SUPABASE_SERVICE_KEY=<NEW_SERVICE_ROLE_KEY_HERE>
```

### 6. Consider Rotating Anon Key (Optional)

The anon key is less critical (protected by RLS), but you may want to rotate it too:

1. In Supabase Dashboard: **Settings** → **API**
2. Find **anon public** key
3. Click **Reset anon key**
4. Update in Vercel and local environment files

## Prevention Measures Implemented

### ✅ Updated .gitignore
Added comprehensive patterns to prevent future commits:
```gitignore
# Environment files - NEVER commit these!
.env
.env.*
.env.production
.env.staging
```

### ✅ Created Template Files
Safe template files for reference (no actual secrets):
- `.env.production.template` - Safe to commit
- `.env.staging.template` - Safe to commit

### 🔄 Pending: Remove from Git History
Need to run BFG or filter-branch to remove from history.

## Security Best Practices Going Forward

### 1. Never Commit Environment Files
- Only commit `.env.example` or `.env.template` files
- Actual environment files should ALWAYS be in `.gitignore`

### 2. Use Environment Variables in CI/CD
- Store secrets in Vercel dashboard (Settings → Environment Variables)
- Use GitHub Secrets for GitHub Actions
- Never hardcode secrets in code or config files

### 3. Rotate Keys Regularly
- Rotate service role keys every 90 days
- Rotate anon keys if you suspect exposure
- Keep audit log of key rotations

### 4. Use Least Privilege
- Only use service role key server-side (never in client)
- Client code should only use anon key (protected by RLS)
- Implement Row Level Security (RLS) policies

### 5. Enable Secret Scanning
- GitHub Advanced Security (if available)
- GitGuardian or similar tools
- Pre-commit hooks to detect secrets

## Verification Checklist

After completing all steps:

- [ ] Service role key rotated in Supabase
- [ ] Database access logs reviewed (no suspicious activity)
- [ ] Secrets removed from Git history (BFG or filter-branch)
- [ ] Force pushed to GitHub (history rewritten)
- [ ] Vercel environment variables updated with new key
- [ ] Local `.env.production` and `.env.staging` updated
- [ ] New deployment triggered with new keys
- [ ] `.gitignore` updated to prevent future commits
- [ ] Team notified of key rotation
- [ ] Monitoring enabled for unusual activity

## Timeline

1. **Immediate** (0-15 minutes):
   - ✅ Update .gitignore
   - ⏳ Rotate service role key in Supabase
   - ⏳ Update Vercel environment variables

2. **Short-term** (15-60 minutes):
   - ⏳ Review database logs for suspicious activity
   - ⏳ Remove secrets from Git history
   - ⏳ Force push cleaned history

3. **Follow-up** (1-24 hours):
   - ⏳ Monitor database for unusual activity
   - ⏳ Consider rotating anon key
   - ⏳ Implement secret scanning tools

## Contact & Resources

### Supabase Support
- Documentation: https://supabase.com/docs/guides/api/managing-api-keys
- Support: https://supabase.com/dashboard/support

### GitHub Support
- Removing sensitive data: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
- Secret scanning: https://docs.github.com/en/code-security/secret-scanning

### Tools
- BFG Repo-Cleaner: https://rtyley.github.io/bfg-repo-cleaner/
- git-filter-repo: https://github.com/newren/git-filter-repo
- GitGuardian: https://www.gitguardian.com/

## Lessons Learned

1. **Template files only**: `.env.production` and `.env.staging` should only exist as `.template` versions in the repo
2. **Pre-commit validation**: Consider adding pre-commit hooks to prevent secret commits
3. **Secret scanning**: Enable automated secret detection
4. **Documentation**: Clearly document which files should never be committed

## Status Updates

**Current Status**: 🟡 In Progress
- .gitignore updated ✅
- Service role key rotation: ⏳ PENDING (USER ACTION REQUIRED)
- Git history cleanup: ⏳ PENDING
- Vercel update: ⏳ PENDING

---

**Incident Opened**: January 20, 2026
**Incident Owner**: Development Team
**Priority**: P0 - Critical
