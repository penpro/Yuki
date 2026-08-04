'use strict';

// Email sending and templating.
//
// ── Why this is SMTP-relay only ────────────────────────────────────────────
// EC2 blocks outbound port 25 by default, and mail sent straight from a fresh
// cloud IP is treated as spam by essentially every major provider — no SPF,
// no DKIM, no sending reputation. So there is deliberately no "just send it"
// path here: everything goes through a configured relay (SES, Brevo, Mailgun,
// Postmark, even Gmail app-password for tiny volumes).
//
// If SMTP is not configured, isConfigured() returns false and the admin
// refuses to send rather than silently dropping mail on the floor.

const nodemailer = require('nodemailer');

const {
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE,
  MAIL_FROM_NAME, MAIL_FROM_ADDRESS, MAIL_REPLY_TO,
  MAIL_POSTAL_ADDRESS, APP_BASE_URL,
} = process.env;

const BASE = (APP_BASE_URL || 'https://yukispace.duckdns.org').replace(/\/+$/, '');

function isConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && MAIL_FROM_ADDRESS);
}

let transport = null;
function getTransport() {
  if (!isConfigured()) return null;
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === 'true',
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    // Small pool: this is a ~hundreds-of-recipients list, and hammering a
    // relay with parallel connections is a fast way to get rate limited.
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
  });
  return transport;
}

async function verifyTransport() {
  const t = getTransport();
  if (!t) throw new Error('SMTP is not configured');
  await t.verify();
  return true;
}

/* ── templating ─────────────────────────────────────────────────────────── */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Body is authored as plain text with blank lines between paragraphs. Keeping
// it plain means she can't accidentally paste markup that breaks the layout in
// Outlook, and the text alternative is free.
function paragraphs(body) {
  return String(body || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Branded HTML email.
 *
 * Table-based with inline styles throughout, because Outlook still uses the
 * Word rendering engine and will ignore a stylesheet, flexbox and grid.
 */
function renderHtml({ subject, preheader, body, ctaLabel, ctaUrl, unsubUrl }) {
  const paras = paragraphs(body)
    .map((p) => `<p style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.7;color:#C6B6B0;">${esc(p)}</p>`)
    .join('\n');

  const cta = (ctaLabel && ctaUrl) ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
                <tr><td style="background:#D4A94A;">
                  <a href="${esc(ctaUrl)}" style="display:inline-block;padding:14px 30px;font-family:Helvetica,Arial,sans-serif;font-size:14px;letter-spacing:1px;color:#160E04;text-decoration:none;">${esc(ctaLabel)}</a>
                </td></tr>
              </table>` : '';

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0F0B0E;">

<!-- preheader: shown as the grey preview line, hidden in the body itself -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader || '')}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0F0B0E;">
  <tr><td align="center" style="padding:32px 16px;">

    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#191317;border:1px solid rgba(212,169,74,0.2);">

      <tr><td align="center" style="padding:36px 32px 26px;border-bottom:1px solid rgba(233,222,216,0.11);">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:23px;letter-spacing:1px;color:#EFE6E0;">Y&#363;ki&rsquo;s Sacred Space</div>
        <div style="margin-top:9px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#D4A94A;">spirit guide &middot; reiki master &middot; death doula</div>
      </td></tr>

      <tr><td style="padding:34px 32px 10px;">
        <h1 style="margin:0 0 22px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;line-height:1.25;color:#EFE6E0;">${esc(subject)}</h1>
        ${paras}
        ${cta}
      </td></tr>

      <tr><td style="padding:26px 32px 32px;border-top:1px solid rgba(233,222,216,0.11);">
        <p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#9A8781;">
          You're getting this because you asked for it at
          <a href="${BASE}" style="color:#D4A94A;">yukispace.duckdns.org</a>.
        </p>
        <p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#9A8781;">
          <a href="${esc(unsubUrl)}" style="color:#9A8781;text-decoration:underline;">Unsubscribe</a>
          &nbsp;&middot;&nbsp; one click, no questions, takes effect immediately.
        </p>
        <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#6F615D;">
          ${esc(MAIL_POSTAL_ADDRESS || 'ADDRESS NOT SET — required by law on commercial email')}
        </p>
        <p style="margin:14px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#6F615D;">
          Energy work is not medical care. Please keep seeing your doctor and your therapist.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

function renderText({ subject, body, ctaLabel, ctaUrl, unsubUrl }) {
  const parts = [subject, '', ...paragraphs(body)];
  if (ctaLabel && ctaUrl) parts.push('', `${ctaLabel}: ${ctaUrl}`);
  parts.push('', '—', `Unsubscribe: ${unsubUrl}`,
    MAIL_POSTAL_ADDRESS || 'ADDRESS NOT SET',
    'Energy work is not medical care. Please keep seeing your doctor and your therapist.');
  return parts.join('\n');
}

function unsubUrlFor(token) { return `${BASE}/unsubscribe?t=${encodeURIComponent(token)}`; }
function confirmUrlFor(token) { return `${BASE}/confirm?t=${encodeURIComponent(token)}`; }

/* ── sending ────────────────────────────────────────────────────────────── */

async function sendMail({ to, subject, html, text, unsubUrl }) {
  const t = getTransport();
  if (!t) throw new Error('SMTP is not configured');

  return t.sendMail({
    from: `"${MAIL_FROM_NAME || "Yuki's Sacred Space"}" <${MAIL_FROM_ADDRESS}>`,
    replyTo: MAIL_REPLY_TO || MAIL_FROM_ADDRESS,
    to,
    subject,
    html,
    text,
    headers: unsubUrl ? {
      // Gmail and Outlook surface a native "unsubscribe" button from these.
      // Having it measurably reduces spam complaints, because the easy way
      // out stops being the "mark as spam" button.
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    } : undefined,
  });
}

async function sendCampaignTo(subscriber, campaign) {
  const unsubUrl = unsubUrlFor(subscriber.unsub_token);
  const payload = {
    subject: campaign.subject,
    preheader: campaign.preheader,
    body: campaign.body,
    ctaLabel: campaign.cta_label,
    ctaUrl: campaign.cta_url,
    unsubUrl,
  };
  return sendMail({
    to: subscriber.email,
    subject: campaign.subject,
    html: renderHtml(payload),
    text: renderText(payload),
    unsubUrl,
  });
}

async function sendConfirmation(subscriber) {
  const url = confirmUrlFor(subscriber.confirm_token);
  const payload = {
    subject: 'confirm your email',
    preheader: 'one click and you’re on the list',
    body: 'you (or someone using this address) asked to hear from me.\n\n'
        + 'click the button below to confirm and you’re on the list. '
        + 'if this wasn’t you, just ignore this — nothing happens unless you click.',
    ctaLabel: 'confirm my email',
    ctaUrl: url,
    unsubUrl: unsubUrlFor(subscriber.unsub_token),
  };
  return sendMail({
    to: subscriber.email,
    subject: 'confirm your email',
    html: renderHtml(payload),
    text: renderText(payload),
    unsubUrl: payload.unsubUrl,
  });
}

module.exports = {
  isConfigured, verifyTransport, sendMail, sendCampaignTo, sendConfirmation,
  renderHtml, renderText, unsubUrlFor, confirmUrlFor,
};
