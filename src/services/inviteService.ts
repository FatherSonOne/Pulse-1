// Team Invitation Service for Pulse
// Uses Resend API for sending invitation emails

import { supabase } from './supabase';

export interface TeamInvite {
  id: string;
  email: string;
  invitedBy: string;
  invitedByName: string;
  workspaceId: string;
  workspaceName: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

export interface InviteResult {
  success: boolean;
  message: string;
  inviteId?: string;
}

// Generate a unique invite token
const generateInviteToken = (): string => {
  return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
};

// Create and store an invitation
export const createInvitation = async (
  email: string,
  invitedByUserId: string,
  invitedByName: string,
  workspaceName: string = 'Pulse Team'
): Promise<InviteResult> => {
  try {
    const inviteToken = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    // Store invitation in Supabase
    const { data, error } = await supabase
      .from('team_invites')
      .insert({
        id: inviteToken,
        email: email.toLowerCase().trim(),
        invited_by: invitedByUserId,
        invited_by_name: invitedByName,
        workspace_name: workspaceName,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create invitation:', error);
      // If table doesn't exist, still allow sending email
      if (error.code === '42P01') {
        console.log('team_invites table not found, proceeding without database storage');
      } else {
        throw error;
      }
    }

    return {
      success: true,
      message: 'Invitation created successfully',
      inviteId: inviteToken
    };
  } catch (error: any) {
    console.error('Create invitation error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create invitation'
    };
  }
};

// Send invitation email via Resend API
export const sendInvitationEmail = async (
  recipientEmail: string,
  inviterName: string,
  inviteToken: string,
  workspaceName: string = 'Pulse Team'
): Promise<InviteResult> => {
  const resendApiKey = import.meta.env.VITE_RESEND_API_KEY;
  const appUrl = import.meta.env.VITE_APP_URL || 'https://pulse.logosvision.org';

  // If no Resend API key, fall back to mailto link
  if (!resendApiKey) {
    console.log('No Resend API key found, using fallback mailto');
    return {
      success: true,
      message: 'fallback_mailto',
      inviteId: inviteToken
    };
  }

  try {
    const inviteUrl = `${appUrl}/invite/${inviteToken}`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Pulse <invites@logosvision.org>',
        to: [recipientEmail],
        subject: `${inviterName} invited you to join ${workspaceName} on Pulse`,
        html: generateInviteEmailHtml(inviterName, workspaceName, inviteUrl),
        text: generateInviteEmailText(inviterName, workspaceName, inviteUrl)
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send email');
    }

    const data = await response.json();

    return {
      success: true,
      message: 'Invitation email sent successfully',
      inviteId: inviteToken
    };
  } catch (error: any) {
    console.error('Send invitation email error:', error);
    return {
      success: false,
      message: error.message || 'Failed to send invitation email'
    };
  }
};

// Generate invite email HTML
const generateInviteEmailHtml = (inviterName: string, workspaceName: string, inviteUrl: string): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to Pulse</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #09090b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #09090b; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; background: linear-gradient(135deg, #18181b 0%, #27272a 100%); border-radius: 16px; border: 1px solid #3f3f46; overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 28px; color: white; font-weight: bold;">P</span>
              </div>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 8px 0;">You're invited to Pulse</h1>
              <p style="color: #a1a1aa; font-size: 14px; margin: 0;">The AI-native communication dashboard</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 20px 40px 30px 40px;">
              <p style="color: #e4e4e7; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                <strong style="color: #ffffff;">${inviterName}</strong> has invited you to join <strong style="color: #ffffff;">${workspaceName}</strong> on Pulse.
              </p>
              <p style="color: #a1a1aa; font-size: 14px; line-height: 22px; margin: 0 0 30px 0;">
                Pulse is an AI-powered communication platform that helps teams collaborate more effectively with smart messaging, automated meeting notes, and integrated workflows.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%); color: #ffffff; font-weight: 600; font-size: 16px; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(244, 63, 94, 0.4);">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Features -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #27272a; border-radius: 12px; padding: 20px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0;">What you'll get</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; color: #e4e4e7; font-size: 14px;">
                          <span style="color: #f43f5e; margin-right: 8px;">&#10003;</span> AI-powered messaging with smart replies
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #e4e4e7; font-size: 14px;">
                          <span style="color: #f43f5e; margin-right: 8px;">&#10003;</span> Automated meeting notes & transcription
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #e4e4e7; font-size: 14px;">
                          <span style="color: #f43f5e; margin-right: 8px;">&#10003;</span> Contact management & CRM features
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #e4e4e7; font-size: 14px;">
                          <span style="color: #f43f5e; margin-right: 8px;">&#10003;</span> Calendar integration & scheduling
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 30px 40px; border-top: 1px solid #3f3f46;">
              <p style="color: #71717a; font-size: 12px; line-height: 18px; margin: 0; text-align: center;">
                This invitation will expire in 7 days.<br>
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>

        <!-- Bottom Text -->
        <p style="color: #52525b; font-size: 12px; margin-top: 20px; text-align: center;">
          Powered by Pulse &bull; <a href="https://logosvision.org" style="color: #52525b;">logosvision.org</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

// Generate invite email plain text
const generateInviteEmailText = (inviterName: string, workspaceName: string, inviteUrl: string): string => {
  return `
You're invited to Pulse!

${inviterName} has invited you to join ${workspaceName} on Pulse.

Pulse is an AI-powered communication platform that helps teams collaborate more effectively.

Accept your invitation here: ${inviteUrl}

What you'll get:
- AI-powered messaging with smart replies
- Automated meeting notes & transcription
- Contact management & CRM features
- Calendar integration & scheduling

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

---
Powered by Pulse | logosvision.org
`;
};

// Get pending invitations sent by a user
export const getSentInvitations = async (userId: string): Promise<TeamInvite[]> => {
  try {
    const { data, error } = await supabase
      .from('team_invites')
      .select('*')
      .eq('invited_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(inv => ({
      id: inv.id,
      email: inv.email,
      invitedBy: inv.invited_by,
      invitedByName: inv.invited_by_name,
      workspaceId: inv.workspace_id || '',
      workspaceName: inv.workspace_name,
      status: inv.status,
      createdAt: new Date(inv.created_at),
      expiresAt: new Date(inv.expires_at)
    }));
  } catch (error) {
    console.error('Get sent invitations error:', error);
    return [];
  }
};

// Accept an invitation
export const acceptInvitation = async (inviteToken: string, userId: string): Promise<InviteResult> => {
  try {
    const { data, error } = await supabase
      .from('team_invites')
      .update({ status: 'accepted', accepted_by: userId, accepted_at: new Date().toISOString() })
      .eq('id', inviteToken)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: 'Invitation accepted successfully'
    };
  } catch (error: any) {
    console.error('Accept invitation error:', error);
    return {
      success: false,
      message: error.message || 'Failed to accept invitation'
    };
  }
};

// Generate a mailto link as fallback when Resend is not configured
export const generateMailtoLink = (
  recipientEmail: string,
  inviterName: string,
  appUrl: string = 'https://pulse.logosvision.org'
): string => {
  const subject = encodeURIComponent(`${inviterName} invited you to join Pulse`);
  const body = encodeURIComponent(`Hi there!

${inviterName} has invited you to join their team on Pulse - an AI-powered communication platform.

To get started:
1. Visit ${appUrl}
2. Click "Continue with Google" to sign in
3. You'll be automatically added to the team!

What is Pulse?
Pulse is an AI-native communication dashboard that helps teams collaborate more effectively with:
- Smart messaging with AI-powered replies
- Automated meeting notes & transcription
- Contact management & CRM features
- Calendar integration & scheduling

Get started now: ${appUrl}

See you there!
${inviterName}`);

  return `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
};

// Generate an early access invite mailto link with premium messaging
export const generateEarlyAccessInvite = (
  recipientEmail: string,
  inviterName: string,
  recipientName?: string,
  appUrl: string = 'https://pulse.logosvision.org'
): string => {
  const subject = encodeURIComponent(`🚀 ${inviterName} is inviting you to Pulse - Early Access`);

  const greeting = recipientName ? `Hey ${recipientName}!` : 'Hey there!';

  const body = encodeURIComponent(`${greeting}

I've been using something incredible and had to share it with you.

It's called Pulse — a next-generation AI-native communication platform that's changing how I manage messages, meetings, and my entire workflow. Think of it as your personal command center for everything communication.

🎯 Why I think you'll love it:

✨ AI-Powered Smart Replies — It learns your tone and suggests responses
📅 Unified Calendar — All your events in one beautiful interface
🎙️ Meeting Notes That Write Themselves — AI transcription & summaries
👥 Team Messaging — Built-in @handles for direct communication
🔒 Privacy-First — Your data stays yours, always

I'm part of the early access program and can get you in.

👉 Join here: ${appUrl}

Just sign up with Google and you're in. Takes 30 seconds.

The future of communication is here. Don't miss it.

— ${inviterName}

P.S. This is the real deal. Once you try it, you won't go back to juggling 10 different apps.`);

  return `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
};

// Generate a shareable invite link for social/copy-paste
export const generateShareableInviteText = (
  inviterName: string,
  appUrl: string = 'https://pulse.logosvision.org'
): string => {
  return `🚀 I've been using Pulse — an AI-native communication platform that's incredible.

It combines messaging, calendar, meetings, and AI assistance into one seamless experience.

${inviterName} is giving you early access:
👉 ${appUrl}

Sign up with Google. Takes 30 seconds. Trust me on this one.`;
};
