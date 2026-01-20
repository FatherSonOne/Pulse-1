# Pulse Messages - Deployment Guide

**Version**: 1.0
**Last Updated**: 2026-01-19

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Vercel Deployment](#vercel-deployment)
4. [Alternative Platforms](#alternative-platforms)
5. [Environment Configuration](#environment-configuration)
6. [Database Migration](#database-migration)
7. [Post-Deployment](#post-deployment)
8. [Rollback Procedure](#rollback-procedure)

---

## Overview

Pulse Messages is a React + Vite application optimized for deployment on Vercel with Supabase as the backend.

### Deployment Architecture

```
┌─────────────────┐
│   Vercel CDN    │ → Static assets (JS, CSS, images)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vercel Edge    │ → Application hosting
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Supabase     │ → Database + Real-time + Auth + Storage
└─────────────────┘
```

---

## Pre-Deployment Checklist

### 1. Code Quality

```bash
# Run all tests
npm test

# Check TypeScript
npm run type-check

# Run linter
npm run lint

# Check build
npm run build
```

All checks must pass before deployment.

### 2. Environment Variables

Verify all required environment variables:

```env
# Required
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Optional (for full features)
VITE_GEMINI_API_KEY=
VITE_HUBSPOT_CLIENT_ID=
VITE_HUBSPOT_CLIENT_SECRET=
VITE_SALESFORCE_CLIENT_ID=
VITE_SALESFORCE_CLIENT_SECRET=
```

### 3. Database Migrations

Ensure all database migrations are applied:

```bash
# Check current migration status
# Run in Supabase SQL Editor
SELECT * FROM _migrations ORDER BY version DESC LIMIT 10;

# Apply pending migrations if any
```

### 4. Dependencies

```bash
# Update dependencies
npm update

# Check for security vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

---

## Vercel Deployment

### Method 1: GitHub Integration (Recommended)

#### 1. Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import Git Repository
4. Select your Pulse Messages repository
5. Click "Import"

#### 2. Configure Project

**Framework Preset**: Vite
**Root Directory**: `./`
**Build Command**: `npm run build`
**Output Directory**: `dist`
**Install Command**: `npm install`

#### 3. Environment Variables

Add all environment variables from your `.env` file:

1. Go to Project Settings > Environment Variables
2. Add each variable:
   - Name: `VITE_SUPABASE_URL`
   - Value: `https://your-project.supabase.co`
   - Environment: Production, Preview, Development
3. Click "Add"

Repeat for all variables.

#### 4. Deploy

1. Click "Deploy"
2. Wait for build to complete (~2-3 minutes)
3. Get deployment URL: `https://pulse-messages.vercel.app`

### Method 2: Vercel CLI

#### 1. Install Vercel CLI

```bash
npm install -g vercel
```

#### 2. Login

```bash
vercel login
```

#### 3. Deploy

```bash
# First deployment
vercel

# Production deployment
vercel --prod
```

#### 4. Configure

Follow prompts:
- Set up and deploy? `Y`
- Which scope? Select your account
- Link to existing project? `N` (first time) or `Y` (subsequent)
- What's your project's name? `pulse-messages`
- In which directory is your code located? `./`

---

## Alternative Platforms

### Netlify

#### 1. Build Settings

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### 2. Deploy

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

### AWS Amplify

#### 1. amplify.yml

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

#### 2. Deploy

1. Go to AWS Amplify Console
2. Connect repository
3. Configure build settings
4. Deploy

### Docker Deployment

#### Dockerfile

```dockerfile
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Build and Deploy

```bash
# Build image
docker build -t pulse-messages .

# Run container
docker run -p 80:80 pulse-messages

# Deploy to registry
docker tag pulse-messages your-registry/pulse-messages
docker push your-registry/pulse-messages
```

---

## Environment Configuration

### Production Environment Variables

```env
# Supabase (Production)
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=prod-anon-key

# Google Gemini (Production)
VITE_GEMINI_API_KEY=prod-gemini-key

# CRM (Production OAuth apps)
VITE_HUBSPOT_CLIENT_ID=prod-hubspot-client-id
VITE_HUBSPOT_CLIENT_SECRET=prod-hubspot-secret
VITE_SALESFORCE_CLIENT_ID=prod-salesforce-client-id
VITE_SALESFORCE_CLIENT_SECRET=prod-salesforce-secret

# Feature Flags (optional)
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_CRM_INTEGRATION=true
VITE_ENABLE_ANALYTICS=true

# Monitoring (optional)
VITE_SENTRY_DSN=
VITE_ANALYTICS_ID=
```

### Staging Environment

Create separate Supabase project for staging:

```env
VITE_SUPABASE_URL=https://staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=staging-anon-key
```

---

## Database Migration

### 1. Backup Production Database

```sql
-- In Supabase SQL Editor
-- Export data (Supabase Dashboard > Database > Backups)
```

Or use pg_dump:

```bash
pg_dump -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  -f backup.sql
```

### 2. Apply Migrations

```sql
-- Run in production Supabase SQL Editor
-- Copy contents from migration files
-- Execute in order
```

### 3. Verify Migration

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Check data integrity
SELECT COUNT(*) FROM message_channels;
SELECT COUNT(*) FROM channel_messages;
```

---

## Post-Deployment

### 1. Smoke Tests

**Critical Paths**:
- [ ] Application loads
- [ ] User can log in
- [ ] Messages send/receive
- [ ] Reactions work
- [ ] Search functions
- [ ] AI tools respond
- [ ] Real-time updates work

### 2. Monitor Logs

**Vercel Dashboard**:
- Go to Deployments > Latest Deployment
- Click "View Function Logs"
- Check for errors

**Supabase Dashboard**:
- Go to Logs
- Filter by error level
- Check API logs

### 3. Performance Check

```bash
# Run Lighthouse audit
npx lighthouse https://pulse-messages.vercel.app \
  --view \
  --preset=desktop
```

**Target Scores**:
- Performance: 90+
- Accessibility: 95+
- Best Practices: 90+
- SEO: 90+

### 4. Enable Monitoring

**Sentry** (Error Tracking):
```bash
npm install @sentry/react @sentry/tracing
```

**Google Analytics** (Usage Tracking):
```typescript
// Add to index.html
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID"></script>
```

---

## Rollback Procedure

### Instant Rollback (Vercel)

1. Go to Vercel Dashboard
2. Click "Deployments"
3. Find last working deployment
4. Click three dots > "Promote to Production"
5. Confirm

**Timeline**: ~30 seconds

### Manual Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push --force origin main
```

### Database Rollback

```bash
# Restore from backup
psql -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  -f backup.sql
```

---

## CI/CD Pipeline

### GitHub Actions

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Run linter
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Security Checklist

- [ ] All secrets in environment variables (not in code)
- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] RLS policies enabled on Supabase
- [ ] API keys rotated regularly
- [ ] Dependencies updated
- [ ] Security headers configured
- [ ] Rate limiting enabled

---

## Support

**Deployment Issues**: devops@pulse.example.com
**Vercel Support**: https://vercel.com/support
**Supabase Support**: https://supabase.com/support

---

**Document Version**: 1.0
**Last Updated**: 2026-01-19
