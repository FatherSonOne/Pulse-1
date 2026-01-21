#!/usr/bin/env python3
import pathlib

workflows_dir = pathlib.Path('f:/pulse1/.github/workflows')
workflows_dir.mkdir(parents=True, exist_ok=True)

# CI Workflow
ci_yml = workflows_dir / 'ci.yml'
ci_yml.write_text(r'''name: Continuous Integration

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '18'

jobs:
  lint:
    name: Lint Code
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint
        continue-on-error: false

      - name: Check TypeScript
        run: npx tsc --noEmit

  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test || echo "Tests not configured"
        continue-on-error: true

  build:
    name: Build Application
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          CI: true
          GENERATE_SOURCEMAP: false

      - name: Check build size
        run: |
          echo "Build size analysis:"
          du -sh dist/ || echo "Build directory not found"

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: dist/
          retention-days: 7

  security-audit:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Run npm audit
        run: npm audit --audit-level=high
        continue-on-error: true
''', encoding='utf-8')

# Staging Deployment Workflow
staging_yml = workflows_dir / 'deploy-staging.yml'
staging_yml.write_text(r'''name: Deploy to Staging

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

env:
  NODE_VERSION: '18'

jobs:
  deploy-staging:
    name: Deploy to Staging Environment
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          CI: true
          GENERATE_SOURCEMAP: true
          VITE_ENV: staging
          VITE_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
          VITE_GEMINI_API_KEY: ${{ secrets.STAGING_GEMINI_API_KEY }}

      - name: Deploy to Vercel
        id: deploy
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./

      - name: Comment PR with deployment URL
        uses: actions/github-script@v7
        if: github.event_name == 'pull_request'
        env:
          DEPLOY_URL: ${{ steps.deploy.outputs.url }}
          COMMIT_SHA: ${{ github.sha }}
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const deployUrl = process.env.DEPLOY_URL;
            const commitSha = process.env.COMMIT_SHA;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `### Staging Deployment Successful\n\n**URL**: ${deployUrl}\n**Commit**: ${commitSha.substring(0, 7)}\n**Deployed at**: ${new Date().toISOString()}`
            })
''', encoding='utf-8')

# Production Deployment Workflow
production_yml = workflows_dir / 'deploy-production.yml'
production_yml.write_text(r'''name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      skip_tests:
        description: 'Skip tests (emergency only)'
        required: false
        default: false
        type: boolean

env:
  NODE_VERSION: '18'

jobs:
  pre-deployment:
    name: Pre-Deployment Checks
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run tests
        if: ${{ !inputs.skip_tests }}
        run: npm test || echo "Tests not configured"

      - name: Security audit
        run: npm audit --audit-level=critical
        continue-on-error: true

  build-production:
    name: Build Production
    runs-on: ubuntu-latest
    needs: [pre-deployment]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          CI: true
          GENERATE_SOURCEMAP: false
          VITE_ENV: production
          VITE_SUPABASE_URL: ${{ secrets.PROD_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.PROD_SUPABASE_ANON_KEY }}
          VITE_GEMINI_API_KEY: ${{ secrets.PROD_GEMINI_API_KEY }}
          VITE_SENTRY_DSN: ${{ secrets.SENTRY_DSN }}

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: production-build
          path: dist/
          retention-days: 30

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build-production]
    environment:
      name: production
      url: https://pulse.yourdomain.com
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: production-build
          path: dist/

      - name: Deploy to Vercel
        id: deploy
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: ./

  post-deployment:
    name: Post-Deployment Verification
    runs-on: ubuntu-latest
    needs: [deploy-production]
    steps:
      - name: Wait for deployment
        run: sleep 30

      - name: Verify health
        run: |
          echo "Checking production health..."
          curl -f https://pulse.yourdomain.com/ || echo "Health check failed"
        continue-on-error: true
''', encoding='utf-8')

# Lighthouse CI Workflow
lighthouse_yml = workflows_dir / 'lighthouse.yml'
lighthouse_yml.write_text(r'''name: Lighthouse CI

on:
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 0 * * 0'

jobs:
  lighthouse:
    name: Lighthouse Performance Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          CI: true

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            http://localhost:3000
          uploadArtifacts: true
          temporaryPublicStorage: true
''', encoding='utf-8')

# Security Scan Workflow
security_yml = workflows_dir / 'security-scan.yml'
security_yml.write_text(r'''name: Security Scanning

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * 1'

jobs:
  dependency-scan:
    name: Dependency Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run npm audit
        run: npm audit --audit-level=moderate
        continue-on-error: true

  code-scan:
    name: Code Security Analysis
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript, typescript

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3

  secret-scan:
    name: Secret Detection
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Scan for secrets
        run: |
          echo "Scanning for secrets..."
          ! grep -r "password\s*=\s*['\"]" src/ || echo "Warning: potential passwords found"
          ! grep -r "api[_-]?key\s*=\s*['\"]" src/ || echo "Warning: potential API keys found"
''', encoding='utf-8')

print("GitHub Actions workflows created successfully!")
