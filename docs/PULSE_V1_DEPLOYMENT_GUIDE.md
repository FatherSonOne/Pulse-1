# Pulse v1.0 Deployment Guide

Complete step-by-step instructions for deploying Pulse as a PWA at pulse.logosvision.org

---

## Overview

This guide covers:
1. Google OAuth Setup (for authentication)
2. Resend Email Setup (for team invitations)
3. IONOS DNS Configuration
4. Vercel Deployment
5. Environment Variables
6. Testing Your Deployment

---

## 1. Google OAuth Setup

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name: `Pulse` → Click **Create**

### Step 2: Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** → Click **Create**
3. Fill in:
   - App name: `Pulse`
   - User support email: Your email
   - Developer contact email: Your email
4. Click **Save and Continue**
5. **Scopes**: Click **Add or Remove Scopes**
   - Select: `email`, `profile`, `openid`
   - Click **Update** → **Save and Continue**
6. **Test users**: Add your email and team emails for testing
7. Click **Save and Continue** → **Back to Dashboard**

### Step 3: Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Pulse Web Client`
5. **Authorized JavaScript origins**:
   ```
   https://pulse.logosvision.org
   http://localhost:5173
   ```
6. **Authorized redirect URIs**:
   ```
   https://pulse.logosvision.org
   https://pulse.logosvision.org/auth/callback
   https://[YOUR-SUPABASE-PROJECT].supabase.co/auth/v1/callback
   http://localhost:5173
   http://localhost:5173/auth/callback
   ```
7. Click **Create**
8. **Save your Client ID and Client Secret** - you'll need these!

### Step 4: Add Google to Supabase
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your Pulse project
3. Go to **Authentication** → **Providers**
4. Find **Google** and click to expand
5. Toggle **Enable Sign in with Google** ON
6. Enter:
   - Client ID: (from step 3)
   - Client Secret: (from step 3)
7. Copy the **Callback URL** shown - add this to Google OAuth redirect URIs
8. Click **Save**

---

## 2. Resend Email Setup (For Team Invitations)

### Step 1: Create Resend Account
1. Go to [resend.com](https://resend.com)
2. Click **Get Started** and create account
3. Verify your email

### Step 2: Add Your Domain
1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter: `logosvision.org`
4. You'll receive DNS records to add

### Step 3: Configure DNS for Resend
Add these records in IONOS DNS (see Section 3 for how):

| Type  | Name                         | Value                                |
|-------|------------------------------|--------------------------------------|
| TXT   | resend._domainkey           | (copy from Resend dashboard)         |
| TXT   | @                            | v=spf1 include:resend.com ~all      |

### Step 4: Get API Key
1. In Resend, go to **API Keys**
2. Click **Create API Key**
3. Name: `Pulse Production`
4. Permission: **Full Access**
5. Click **Create**
6. **Copy and save the API key immediately** - it won't be shown again!

---

## 3. IONOS DNS Configuration

### Step 1: Access DNS Settings
1. Log in to [IONOS](https://my.ionos.com)
2. Go to **Domains & SSL** → **Your Domains**
3. Find `logosvision.org` → Click **DNS**

### Step 2: Add CNAME for Pulse Subdomain
Add this record to point pulse.logosvision.org to Vercel:

| Type  | Name   | Value                | TTL    |
|-------|--------|----------------------|--------|
| CNAME | pulse  | cname.vercel-dns.com | 1 Hour |

### Step 3: Add Resend DNS Records
Add the TXT records from Resend (Section 2, Step 3)

### Step 4: Wait for Propagation
DNS changes can take up to 48 hours, but usually complete within 1-4 hours.

Check propagation: [whatsmydns.net](https://www.whatsmydns.net/) - search for `pulse.logosvision.org`

---

## 4. Vercel Deployment

### Step 1: Install Vercel CLI (Optional)
```bash
npm install -g vercel
```

### Step 2: Deploy via GitHub (Recommended)
1. Push your Pulse code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click **Add New** → **Project**
4. Import your GitHub repository
5. Configure:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Click **Deploy**

### Step 3: Add Custom Domain
1. In Vercel project dashboard, go to **Settings** → **Domains**
2. Enter: `pulse.logosvision.org`
3. Click **Add**
4. Vercel will verify DNS (should work if CNAME is set correctly)

### Step 4: Configure Environment Variables
In Vercel dashboard → **Settings** → **Environment Variables**, add:

| Name                    | Value                                      |
|-------------------------|--------------------------------------------|
| VITE_SUPABASE_URL       | https://[your-project].supabase.co        |
| VITE_SUPABASE_ANON_KEY  | (your Supabase anon key)                  |
| VITE_APP_URL            | https://pulse.logosvision.org             |
| VITE_RESEND_API_KEY     | re_xxxxxxxxx (from Resend)                |
| GEMINI_API_KEY          | (your Gemini API key for AI features)     |

Click **Save** and redeploy.

---

## 5. Environment Variables Reference

### Local Development (.env file)
Create `.env` in your project root:

```env
# Supabase
VITE_SUPABASE_URL=https://[your-project].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# App
VITE_APP_URL=http://localhost:5173
VITE_PORT=5173

# Email (optional for local dev)
VITE_RESEND_API_KEY=re_xxxxxxxxx

# AI Features
GEMINI_API_KEY=AIza...
```

### Production (Vercel)
Same variables but with production values:
- `VITE_APP_URL=https://pulse.logosvision.org`

---

## 6. Testing Your Deployment

### Test Checklist

- [ ] **PWA Install**: Visit site on Chrome/Edge, look for install button in address bar
- [ ] **Google Sign-In**: Click "Continue with Google" and complete OAuth flow
- [ ] **Team Invites**: Send test invitation from Messages panel
- [ ] **Offline Mode**: Turn off internet, app should still load cached pages
- [ ] **Mobile Install**: On iPhone/Android, "Add to Home Screen" should work

### PWA Testing Tools
- Chrome DevTools → Application → Service Workers
- Chrome DevTools → Application → Manifest
- [PWA Builder](https://www.pwabuilder.com/) - validates your PWA

### Troubleshooting

**Google OAuth not working?**
- Check redirect URIs match exactly (including trailing slashes)
- Ensure Supabase Google provider is enabled
- Check browser console for errors

**Invitations not sending?**
- Verify Resend API key is correct
- Check Resend dashboard for email logs
- Verify domain DNS is properly configured

**PWA not installing?**
- Must be served over HTTPS
- Check manifest.json exists at /manifest.webmanifest
- Service worker must be registered

---

## 7. Inviting Your Team

Once deployed, you can invite team members:

1. Open Pulse at https://pulse.logosvision.org
2. Sign in with Google
3. Go to **Messages** panel
4. Click the **person+ icon** (Invite Team)
5. Enter team member's email
6. Click **Send Invitation**

Team members will receive an email with:
- Invitation to join Pulse
- Link to create their account
- Instructions to install the PWA

---

## 8. Post-Launch Checklist

- [ ] Add all team member emails to Google OAuth test users (if still in testing mode)
- [ ] Publish Google OAuth app for production (removes test user limit)
- [ ] Set up monitoring (Vercel Analytics, Sentry, etc.)
- [ ] Configure Supabase database backups
- [ ] Create team onboarding documentation

---

## Quick Reference

| Service | Dashboard URL |
|---------|---------------|
| Google Cloud | console.cloud.google.com |
| Supabase | supabase.com/dashboard |
| Resend | resend.com/emails |
| Vercel | vercel.com/dashboard |
| IONOS | my.ionos.com |

---

## Support

If you encounter issues:
1. Check browser console for errors (F12 → Console)
2. Check Vercel deployment logs
3. Check Supabase logs (Dashboard → Logs)
4. Check Resend email logs

---

*Guide generated for Pulse v1.0 deployment*
