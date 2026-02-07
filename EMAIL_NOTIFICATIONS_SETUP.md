# Email Notifications Setup Guide

Complete guide to setting up security alert emails for Pulse.

## Overview

Pulse can send email notifications for:
- 🚨 Security alerts (login from new device, unusual activity, etc.)
- 🔐 Two-factor authentication codes
- 📊 Data export ready notifications
- ⚠️ Account deletion confirmations

---

## Option 1: Resend (Recommended) ⭐

**Why Resend?**
- ✅ Officially recommended by Supabase
- ✅ Free tier: 3,000 emails/month, 100 emails/day
- ✅ Simple API, no complex SMTP setup
- ✅ Excellent deliverability
- ✅ Beautiful email templates

### Step 1: Sign Up for Resend

1. Go to https://resend.com
2. Sign up with GitHub or email
3. Verify your email address

### Step 2: Add Your Domain (Optional but Recommended)

**For Production:**
1. In Resend Dashboard → **Domains** → **Add Domain**
2. Enter your domain (e.g., `yourdomain.com`)
3. Add the DNS records shown (MX, TXT, CNAME)
4. Wait for verification (usually 5-10 minutes)

**For Testing:**
You can use Resend's test mode without a domain, but emails only go to your account email.

### Step 3: Get Your API Key

1. Go to Resend Dashboard → **API Keys**
2. Click **Create API Key**
3. Name it "Pulse Production" or "Pulse Development"
4. Copy the key (starts with `re_...`)

### Step 4: Deploy the Edge Function

```bash
# Navigate to your project
cd f:\pulse1

# Deploy the email function
supabase functions deploy send-security-alert

# Set the Resend API key as a secret
supabase secrets set RESEND_API_KEY=re_your_api_key_here
```

### Step 5: Update the Email Function

Open `supabase/functions/send-security-alert/index.ts` and update:
- Line 45: Change `security@yourdomain.com` to your verified domain email
- Lines 94-95: Update the app URLs to your actual domain

### Step 6: Enable Email Triggers (Optional)

Run the migration to automatically send emails for high/critical alerts:

```sql
-- In Supabase SQL Editor
\i supabase/migrations/add_email_tracking_to_alerts.sql
```

Then enable pg_net:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Set your Supabase URL and anon key
ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET app.supabase_anon_key = 'your-anon-key-here';
```

### Step 7: Test the Email Function

```bash
# Test with curl
curl -X POST https://your-project.supabase.co/functions/v1/send-security-alert \
  -H "Authorization: Bearer <YOUR_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "alert_id": "test-123",
    "user_email": "youremail@example.com",
    "alert_title": "Test Security Alert",
    "alert_message": "This is a test notification to verify email delivery.",
    "alert_level": "high",
    "alert_type": "test_alert",
    "metadata": {
      "device": "Chrome on Windows",
      "location": "San Francisco, CA",
      "ip": "192.168.1.1"
    }
  }'
```

---

## Option 2: SendGrid (Alternative)

**Free Tier:** 100 emails/day forever

### Setup:
1. Sign up at https://sendgrid.com
2. Verify your email
3. Go to **Settings** → **API Keys** → Create API Key
4. Store the key:
   ```bash
   supabase secrets set SENDGRID_API_KEY=SG.your_key_here
   ```

5. Update the Edge Function to use SendGrid API instead of Resend:
   ```typescript
   const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${SENDGRID_API_KEY}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       personalizations: [{
         to: [{ email: payload.user_email }]
       }],
       from: { email: 'security@yourdomain.com' },
       subject: `🔔 Security Alert: ${payload.alert_title}`,
       content: [{
         type: 'text/html',
         value: htmlContent
       }]
     })
   })
   ```

---

## Option 3: Supabase Auth Emails (For Auth-Related Only)

Supabase has built-in email templates for authentication:
- Email confirmation
- Password reset
- Magic link login

### Setup:
1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Customize the templates
3. Configure SMTP (or use Supabase's default)

**Note:** This only works for auth emails, not custom notifications like security alerts.

---

## Testing Your Setup

### Test Security Alert Email

```typescript
// In your browser console or test file
import { securityAlertsService } from './services/securityAlertsService';

const alert = await securityAlertsService.createAlert({
  alertType: 'login_new_device',
  title: 'Test: Login from New Device',
  description: 'This is a test security alert',
  alertLevel: 'high',
  metadata: {
    device: 'Chrome on Windows',
    location: 'Test Location'
  }
});

console.log('Test alert created:', alert);
// Check your email inbox
```

### Verify Email Delivery

1. Check Resend Dashboard → **Emails** tab
2. You should see:
   - ✅ Email status: Delivered
   - 📧 Recipient
   - 🕐 Timestamp
   - 📝 Email content preview

---

## Customizing Email Templates

The email template is in `supabase/functions/send-security-alert/index.ts`.

### Colors and Styling

```typescript
const levelColors = {
  info: '#3B82F6',     // Blue
  low: '#10B981',      // Green
  medium: '#F59E0B',   // Orange
  high: '#EF4444',     // Red
  critical: '#DC2626'  // Dark Red
}
```

### Email Content

Update the HTML template around line 65:
```html
<h1 style="...">
  🔒 Your App Name Security Alert
</h1>
```

### Branding

1. Add your logo:
   ```html
   <img src="https://yourdomain.com/logo.png" alt="Logo" style="height: 40px;">
   ```

2. Update colors to match your brand:
   ```css
   background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);
   ```

---

## Email Notification Settings

Users can control email notifications in the Privacy Dashboard:

```typescript
// Check if user has email alerts enabled
const settings = await securityAlertsService.getSecuritySettings();
console.log(settings.alerts_enabled); // true or false
```

Users can toggle this in: **Privacy Dashboard → Security Tab → Security Alerts**

---

## Monitoring and Debugging

### Check Email Logs in Supabase

```sql
-- See which alerts have been emailed
SELECT
  id,
  title,
  alert_level,
  email_status,
  emailed_at,
  created_at
FROM public.security_alerts
ORDER BY created_at DESC
LIMIT 20;
```

### Check Failed Emails

```sql
SELECT *
FROM public.security_alerts
WHERE email_status = 'failed'
ORDER BY created_at DESC;
```

### View Edge Function Logs

```bash
# View recent logs
supabase functions logs send-security-alert

# Follow logs in real-time
supabase functions logs send-security-alert --follow
```

---

## Troubleshooting

### Emails Not Sending

1. **Check Edge Function logs:**
   ```bash
   supabase functions logs send-security-alert
   ```

2. **Verify Resend API key:**
   ```bash
   supabase secrets list
   ```

3. **Test the function manually:**
   Use the curl command from Step 7 above

### Emails Going to Spam

1. **Add DNS records** (SPF, DKIM, DMARC) in Resend
2. **Verify your domain** instead of using test mode
3. **Warm up your domain** (send to yourself first)
4. **Add unsubscribe link** to comply with regulations

### Rate Limiting

**Resend Free Tier Limits:**
- 100 emails/day
- 3,000 emails/month

If you exceed limits:
- Upgrade to paid plan ($20/month for 50k emails)
- Or throttle notifications:
  ```sql
  -- Only send 1 alert per hour per user
  WHERE NOT EXISTS (
    SELECT 1 FROM security_alerts
    WHERE user_id = NEW.user_id
    AND emailed_at > NOW() - INTERVAL '1 hour'
  )
  ```

---

## Production Checklist

- [ ] Domain verified in Resend
- [ ] DNS records configured (SPF, DKIM, DMARC)
- [ ] Edge Function deployed
- [ ] RESEND_API_KEY secret set
- [ ] Email template customized with your branding
- [ ] Test email sent and received
- [ ] Email tracking migration applied
- [ ] pg_net extension enabled (for automatic sending)
- [ ] Unsubscribe link added (for compliance)
- [ ] Rate limiting configured
- [ ] Monitoring set up (check failed emails daily)

---

## Cost Comparison

| Service | Free Tier | Paid Plans | Deliverability |
|---------|-----------|------------|----------------|
| **Resend** | 3,000/month | $20/mo (50k) | ⭐⭐⭐⭐⭐ |
| **SendGrid** | 100/day | $15/mo (40k) | ⭐⭐⭐⭐ |
| **Postmark** | None | $10/mo (10k) | ⭐⭐⭐⭐⭐ |
| **AWS SES** | 62k/month | $0.10/1k | ⭐⭐⭐⭐ |

**Recommendation:** Start with Resend free tier, upgrade if needed.

---

## Next Steps

After setting up emails:
1. Test all email types (security alerts, 2FA, exports)
2. Monitor deliverability in Resend Dashboard
3. Add email preferences to user settings
4. Set up email analytics (open rates, click rates)
5. Create additional email templates for other notifications

---

## Support

- **Resend Docs:** https://resend.com/docs
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **Questions?** Open an issue or contact support
