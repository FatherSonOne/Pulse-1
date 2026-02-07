// Supabase Edge Function: Send Security Alert Email
// Uses Resend API for email delivery

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface SecurityAlertPayload {
  alert_id: string
  user_email: string  // Can be email address or user ID
  alert_title: string
  alert_message: string
  alert_level: 'info' | 'low' | 'medium' | 'high' | 'critical'
  alert_type: string
  metadata?: Record<string, any>
}

serve(async (req) => {
  try {
    const payload: SecurityAlertPayload = await req.json()

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get user details - handle both email and UUID
    let user
    let userEmail = payload.user_email

    // Check if it's a UUID or email address
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.user_email)

    if (isUUID) {
      // It's a user ID, fetch the user
      const { data, error } = await supabase.auth.admin.getUserById(payload.user_email)
      if (error || !data.user) {
        throw new Error('User not found')
      }
      user = data.user
      userEmail = user.email || payload.user_email
    } else {
      // It's an email address, use it directly
      userEmail = payload.user_email
    }

    // Determine email urgency styling based on alert level
    const levelColors = {
      info: '#3B82F6',
      low: '#10B981',
      medium: '#F59E0B',
      high: '#EF4444',
      critical: '#DC2626'
    }

    const levelLabels = {
      info: 'ℹ️ Information',
      low: '🟢 Low Priority',
      medium: '🟡 Medium Priority',
      high: '🔴 High Priority',
      critical: '🚨 CRITICAL'
    }

    const color = levelColors[payload.alert_level] || '#6B7280'
    const label = levelLabels[payload.alert_level] || 'Alert'

    // Send email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Pulse Security <onboarding@resend.dev>', // Using Resend test email - change to your domain for production
        to: [userEmail],
        subject: `🔔 Security Alert: ${payload.alert_title}`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                🔒 Pulse Security Alert
              </h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">
                Unusual activity detected on your account
              </p>
            </td>
          </tr>

          <!-- Alert Level Badge -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <div style="display: inline-block; background-color: ${color}; color: #ffffff; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                ${label}
              </div>
            </td>
          </tr>

          <!-- Alert Content -->
          <tr>
            <td style="padding: 24px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">
                ${payload.alert_title}
              </h2>
              <p style="margin: 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${payload.alert_message}
              </p>
            </td>
          </tr>

          <!-- Alert Details -->
          ${payload.metadata ? `
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <div style="background-color: #f9fafb; border-left: 4px solid ${color}; padding: 16px; border-radius: 6px;">
                <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  Alert Details
                </h3>
                <table width="100%" cellpadding="4" cellspacing="0">
                  ${Object.entries(payload.metadata).map(([key, value]) => `
                    <tr>
                      <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">
                        <strong>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong>
                      </td>
                      <td style="color: #111827; font-size: 14px; padding: 4px 0;">
                        ${value}
                      </td>
                    </tr>
                  `).join('')}
                </table>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Action Buttons -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${SUPABASE_URL.replace('supabase.co', 'yourdomain.com')}/app"
                       style="display: inline-block; background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                      Review Security Activity
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <a href="${SUPABASE_URL.replace('supabase.co', 'yourdomain.com')}/app/settings/security"
                       style="color: #6b7280; text-decoration: underline; font-size: 14px;">
                      Update Security Settings
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security Tips -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 14px; font-weight: 600;">
                🛡️ Security Tips
              </h3>
              <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                <li>If this was you, no action is needed</li>
                <li>If you don't recognize this activity, change your password immediately</li>
                <li>Enable two-factor authentication for extra security</li>
                <li>Review your active sessions and sign out of unknown devices</li>
              </ul>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #111827; text-align: center;">
              <p style="margin: 0 0 8px 0; color: rgba(255, 255, 255, 0.7); font-size: 12px;">
                This is an automated security alert from Pulse
              </p>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.5); font-size: 12px;">
                If you have questions, contact us at security@yourdomain.com
              </p>
              <p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.4); font-size: 11px;">
                © ${new Date().getFullYear()} Pulse. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      })
    })

    const emailResult = await response.json()

    if (!response.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(emailResult)}`)
    }

    // Mark alert as emailed
    await supabase
      .from('security_alerts')
      .update({
        emailed_at: new Date().toISOString(),
        email_status: 'sent'
      })
      .eq('id', payload.alert_id)

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailResult.id,
        message: 'Security alert email sent successfully'
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error sending security alert email:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
