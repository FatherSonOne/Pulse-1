# Quick Email Setup (5 Minutes)

The fastest way to get security alert emails working.

## 1. Sign Up for Resend (2 min)

1. Go to https://resend.com
2. Click "Start Building"
3. Sign up with GitHub or email

## 2. Get API Key (1 min)

1. In Resend Dashboard → **API Keys**
2. Click **Create API Key**
3. Copy the key (starts with `re_...`)

## 3. Deploy & Configure (2 min)

```bash
# Deploy the email function
supabase functions deploy send-security-alert

# Set your API key
supabase secrets set RESEND_API_KEY=re_your_key_here
```

## 4. Test It

```bash
# Replace with your email
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/send-security-alert \
  -H "Authorization: Bearer <YOUR_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "alert_id": "test",
    "user_email": "YOUR_EMAIL@example.com",
    "alert_title": "Test Alert",
    "alert_message": "Testing email delivery",
    "alert_level": "high",
    "alert_type": "test"
  }'
```

## Done! 🎉

Check your inbox. You should receive a security alert email.

---

## For Production

Before going live:

1. **Verify your domain** in Resend (for better deliverability)
2. **Update email template** in `supabase/functions/send-security-alert/index.ts`:
   - Change `security@yourdomain.com` to your domain
   - Update app URLs to your actual domain
3. **Enable automatic emails** by running `add_email_tracking_to_alerts.sql`

**Full setup guide:** [EMAIL_NOTIFICATIONS_SETUP.md](./EMAIL_NOTIFICATIONS_SETUP.md)
