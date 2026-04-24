// Supabase Edge Function helper: billing-webhook/emails.ts
// Transactional email templates + send helper for Pulse billing lifecycle events.
//
// Uses Resend (https://resend.com/docs/api-reference/emails/send-email).
// Requires `RESEND_API_KEY` as a Supabase secret.
//
// NOTE on sender: we default to `onboarding@resend.dev` because Resend requires a
// verified domain before you can send `from: noreply@pulse.app`. Once the Pulse
// project verifies `pulse.app` (or `pulse.logosvision.org`) in the Resend
// dashboard, swap FROM_ADDRESS to `Pulse <noreply@pulse.app>`.
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// TODO: swap to `Pulse <noreply@pulse.app>` after verifying the domain in Resend.
const FROM_ADDRESS = 'Pulse <onboarding@resend.dev>';

const APP_URL = 'https://pulse.logosvision.org';
const BILLING_URL = APP_URL + '/settings?tab=billing';
const UNSUBSCRIBE_URL = APP_URL + '/settings?tab=notifications';

// ── Core sender ─────────────────────────────────────────────────────────────
// Never throws — email failures must not fail webhook processing.

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    console.warn('[billing-webhook/emails] RESEND_API_KEY not configured — skipping email');
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[billing-webhook/emails] Resend error:', res.status, body);
      return { ok: false, error: 'Resend ' + res.status + ': ' + JSON.stringify(body) };
    }

    return { ok: true, id: body?.id };
  } catch (err) {
    console.error('[billing-webhook/emails] sendEmail threw:', err);
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}

// ── Shared layout ───────────────────────────────────────────────────────────

function layout(opts: {
  preheader: string;
  headline: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  showUnsubscribe?: boolean;
}): string {
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `
      <tr>
        <td align="center" style="padding: 8px 32px 32px 32px;">
          <a href="${opts.ctaUrl}"
             style="display:inline-block; background: linear-gradient(135deg,#f43f5e 0%,#ec4899 100%); color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:8px; font-weight:600; font-size:16px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            ${opts.ctaLabel}
          </a>
        </td>
      </tr>`
    : '';

  const unsubscribe = opts.showUnsubscribe
    ? `
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.5); font-size: 11px;">
        You're receiving this because you have an active Pulse workspace.
        <a href="${UNSUBSCRIBE_URL}" style="color: rgba(255,255,255,0.7); text-decoration: underline;">
          Manage notifications
        </a>
      </p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.headline}</title>
</head>
<body style="margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; background-color:#f3f4f6;">
  <!-- Preheader (hidden in body, shown in email preview) -->
  <div style="display:none; max-height:0; overflow:hidden;">${opts.preheader}</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg,#f43f5e 0%,#ec4899 100%); padding:32px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:-0.01em;">
                Pulse
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px 0; color:#111827; font-size:22px; font-weight:700;">
                ${opts.headline}
              </h2>
              <div style="color:#4b5563; font-size:16px; line-height:1.6;">
                ${opts.bodyHtml}
              </div>
            </td>
          </tr>

          ${cta}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; background-color:#111827; text-align:center;">
              <p style="margin:0 0 4px 0; color:rgba(255,255,255,0.7); font-size:12px;">
                Pulse by Logos Vision
              </p>
              <p style="margin:0; color:rgba(255,255,255,0.5); font-size:11px;">
                &copy; ${new Date().getFullYear()} Pulse. All rights reserved.
              </p>
              ${unsubscribe}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function plainFooter(): string {
  return '\n\n—\nPulse by Logos Vision\n' + APP_URL;
}

// ── Template: Trial ends in 3 days ──────────────────────────────────────────

export function trialWillEndEmail(ctx: {
  workspaceName?: string | null;
  trialEndsAt?: string | null;
}): { subject: string; html: string; text: string } {
  const name = ctx.workspaceName || 'your workspace';
  const endDate = ctx.trialEndsAt
    ? new Date(ctx.trialEndsAt).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : 'in 3 days';

  const subject = 'Your Pulse trial ends in 3 days';

  const html = layout({
    preheader: 'Add a payment method to keep Pulse active for ' + name + '.',
    headline: 'Your Pulse trial ends in 3 days',
    bodyHtml: `
      <p>Hey there,</p>
      <p>This is a friendly heads-up that your Pulse Team trial for <strong>${name}</strong> ends on <strong>${endDate}</strong>.</p>
      <p>To keep your team, AI assistant, Voxer, and Studio features running without interruption, add a payment method before the trial closes. It takes about 30 seconds.</p>
    `,
    ctaLabel: 'Add payment method',
    ctaUrl: BILLING_URL,
    showUnsubscribe: true,
  });

  const text = [
    'Your Pulse trial ends in 3 days',
    '',
    'Your Pulse Team trial for ' + name + ' ends on ' + endDate + '.',
    'Add a payment method to keep Pulse active: ' + BILLING_URL,
    plainFooter(),
  ].join('\n');

  return { subject, html, text };
}

// ── Template: Subscription canceled ─────────────────────────────────────────

export function subscriptionCanceledEmail(ctx: {
  workspaceName?: string | null;
}): { subject: string; html: string; text: string } {
  const name = ctx.workspaceName || 'your workspace';

  const subject = 'Your Pulse subscription was canceled';

  const html = layout({
    preheader: 'Your Pulse subscription for ' + name + ' has ended.',
    headline: 'Your subscription was canceled',
    bodyHtml: `
      <p>Your Pulse subscription for <strong>${name}</strong> has been canceled and your workspace has been returned to the free tier.</p>
      <p>Your data is safe — nothing has been deleted. You can resubscribe any time to restore full access to Pulse Team features.</p>
      <p>If this was unexpected, or you cancelled by mistake, reactivating is one click.</p>
    `,
    ctaLabel: 'Reactivate subscription',
    ctaUrl: BILLING_URL,
  });

  const text = [
    'Your Pulse subscription was canceled',
    '',
    'Your Pulse subscription for ' + name + ' has been canceled.',
    'Your data is safe. Reactivate any time: ' + BILLING_URL,
    plainFooter(),
  ].join('\n');

  return { subject, html, text };
}

// ── Template: Invoice paid (receipt) ────────────────────────────────────────

export function invoicePaidEmail(ctx: {
  workspaceName?: string | null;
  amountPaid: number; // cents
  currency: string;
  invoiceUrl?: string | null;
  invoicePdf?: string | null;
  periodEnd?: string | null;
}): { subject: string; html: string; text: string } {
  const name = ctx.workspaceName || 'your workspace';
  const amount = (ctx.amountPaid / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: (ctx.currency || 'usd').toUpperCase(),
  });
  const nextBill = ctx.periodEnd
    ? new Date(ctx.periodEnd).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const subject = 'Payment received — ' + amount + ' to Pulse';

  const invoiceLinks = [
    ctx.invoiceUrl
      ? `<a href="${ctx.invoiceUrl}" style="color:#ec4899; text-decoration:underline;">View invoice</a>`
      : '',
    ctx.invoicePdf
      ? `<a href="${ctx.invoicePdf}" style="color:#ec4899; text-decoration:underline;">Download PDF</a>`
      : '',
  ]
    .filter(Boolean)
    .join(' &middot; ');

  const html = layout({
    preheader: 'Thanks for your payment of ' + amount + '.',
    headline: 'Payment received',
    bodyHtml: `
      <p>Thanks for keeping <strong>${name}</strong> running on Pulse.</p>
      <p style="background:#fdf2f8; border-left:4px solid #ec4899; padding:16px; border-radius:6px; margin:16px 0;">
        <strong style="color:#111827; font-size:18px;">${amount}</strong> &middot; charged successfully
        ${nextBill ? `<br><span style="color:#6b7280; font-size:14px;">Next billing date: ${nextBill}</span>` : ''}
      </p>
      ${invoiceLinks ? `<p style="font-size:14px; color:#6b7280;">${invoiceLinks}</p>` : ''}
      <p>You can manage your subscription, download invoices, and update your payment method any time from your billing portal.</p>
    `,
    ctaLabel: 'Open billing portal',
    ctaUrl: BILLING_URL,
  });

  const text = [
    'Payment received — ' + amount,
    '',
    'Thanks for keeping ' + name + ' running on Pulse.',
    'Amount: ' + amount,
    nextBill ? 'Next billing date: ' + nextBill : '',
    ctx.invoiceUrl ? 'Invoice: ' + ctx.invoiceUrl : '',
    ctx.invoicePdf ? 'PDF: ' + ctx.invoicePdf : '',
    'Billing portal: ' + BILLING_URL,
    plainFooter(),
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

// ── Template: Payment failed (dunning) ──────────────────────────────────────

export function paymentFailedEmail(ctx: {
  workspaceName?: string | null;
  amountDue: number;
  currency: string;
  invoiceUrl?: string | null;
}): { subject: string; html: string; text: string } {
  const name = ctx.workspaceName || 'your workspace';
  const amount = (ctx.amountDue / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: (ctx.currency || 'usd').toUpperCase(),
  });

  const subject = 'Action needed: payment failed for Pulse';

  const html = layout({
    preheader: 'We could not charge your card for ' + amount + '. Please update your payment method.',
    headline: 'Your payment did not go through',
    bodyHtml: `
      <p>We tried to charge <strong>${amount}</strong> for <strong>${name}</strong> today, but your card was declined.</p>
      <p style="background:#fef2f2; border-left:4px solid #f43f5e; padding:16px; border-radius:6px; margin:16px 0; color:#991b1b;">
        <strong>Don't worry — your workspace is still active.</strong><br>
        We'll retry over the next few days. To avoid any interruption, please update your payment method now.
      </p>
      <p>Common reasons for a failed charge: expired card, insufficient funds, or your bank flagged the transaction.</p>
      ${ctx.invoiceUrl ? `<p style="font-size:14px;"><a href="${ctx.invoiceUrl}" style="color:#ec4899; text-decoration:underline;">View the invoice</a></p>` : ''}
    `,
    ctaLabel: 'Update payment method',
    ctaUrl: BILLING_URL,
  });

  const text = [
    'Action needed: payment failed for Pulse',
    '',
    'We tried to charge ' + amount + ' for ' + name + ' but your card was declined.',
    'Your workspace is still active — please update your payment method to avoid interruption.',
    'Update now: ' + BILLING_URL,
    ctx.invoiceUrl ? 'Invoice: ' + ctx.invoiceUrl : '',
    plainFooter(),
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
