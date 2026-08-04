'use strict';

// Public mailing-list endpoints: subscribe, confirm, unsubscribe.
//
// Unsubscribe is intentionally the least protected route on the whole site —
// no login, no confirmation step, works from a single click in any mail
// client. Making opting out harder than opting in is how a sender ends up
// reported as spam, which poisons deliverability for everyone on the list.

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const mailer = require('../mailer');

const router = express.Router();
const token = () => crypto.randomBytes(24).toString('hex');

// Deliberately generous per-window but low per-burst: real humans subscribe
// once, bots hammer.
const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signups from this address. Try again later.' },
});

// Good enough to catch typos and obvious junk. Deliberately not one of the
// famous RFC-5322 monster regexes — those reject valid addresses and still
// let junk through. The confirmation email is the real validator.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ── subscribe ──────────────────────────────────────────────────────────── */

router.post('/api/subscribe', subscribeLimiter, async (req, res) => {
  try {
    // Honeypot. A hidden field no human ever fills in; bots fill everything.
    if (req.body.website) return res.json({ ok: true });

    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim().slice(0, 120) || null;
    const source = String(req.body.source || 'website').slice(0, 60);

    if (!EMAIL_RE.test(email) || email.length > 191) {
      return res.status(400).json({ error: 'That doesn’t look like an email address' });
    }

    const [existing] = await pool.query(
      'SELECT id, status, confirm_token, unsub_token FROM subscribers WHERE email = ? LIMIT 1',
      [email]
    );

    let row = existing[0];

    if (row && row.status === 'confirmed') {
      // Already on the list. Say the same thing either way — see below.
      return res.json({ ok: true, alreadySubscribed: true });
    }

    if (row) {
      // Covers pending (re-send) and unsubscribed (they've asked again, which
      // is fresh consent — but they go back through confirmation).
      const ct = token();
      await pool.query(
        `UPDATE subscribers SET status='pending', confirm_token=?, name=COALESCE(?,name),
                source=?, unsubscribed_at=NULL WHERE id=?`,
        [ct, name, source, row.id]
      );
      row = { ...row, confirm_token: ct };
    } else {
      const ct = token();
      const ut = token();
      const [ins] = await pool.query(
        'INSERT INTO subscribers (email, name, status, source, confirm_token, unsub_token) VALUES (?,?,?,?,?,?)',
        [email, name, 'pending', source, ct, ut]
      );
      row = { id: ins.insertId, confirm_token: ct, unsub_token: ut };
    }

    if (mailer.isConfigured()) {
      try {
        await mailer.sendConfirmation({
          email,
          confirm_token: row.confirm_token,
          unsub_token: row.unsub_token,
        });
      } catch (err) {
        // The row is saved either way. A relay outage shouldn't lose a signup.
        console.error('confirmation email failed for', email, '-', err.message);
      }
    }

    // Same response whether or not the address was already known. Differing
    // responses turn this into a free "is this person subscribed?" oracle.
    res.json({ ok: true, pending: true, mailConfigured: mailer.isConfigured() });
  } catch (err) {
    console.error('[subscribe]', err.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

/* ── confirm / unsubscribe pages ────────────────────────────────────────── */

function page(title, heading, message) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — Yūki's Sacred Space</title>
<link rel="stylesheet" href="/assets/styles.css">
</head><body>
<main class="wrap" style="max-width:34rem;padding-top:22vh;text-align:center">
  <h1 style="font-family:var(--display);font-weight:400;color:var(--bone);font-size:clamp(1.9rem,5vw,2.8rem);line-height:1.15;margin:0 0 1.2rem">${heading}</h1>
  <p style="color:var(--bone-2);font-size:1.1rem;line-height:1.7">${message}</p>
  <p style="margin-top:2.5rem"><a class="btn btn--ghost" href="/">back to the site</a></p>
</main>
</body></html>`;
}

router.get('/confirm', async (req, res) => {
  const t = String(req.query.t || '');
  if (!t) return res.status(400).send(page('Confirm', 'that link looks wrong', 'the confirmation link was incomplete. try clicking it again from your email.'));

  const [rows] = await pool.query('SELECT id, status FROM subscribers WHERE confirm_token = ? LIMIT 1', [t]);
  if (!rows[0]) {
    return res.status(404).send(page('Confirm', 'that link has expired',
      'it may already have been used. if you’re still not getting emails, just sign up again.'));
  }

  await pool.query(
    "UPDATE subscribers SET status='confirmed', confirmed_at=NOW(), confirm_token=NULL WHERE id=?",
    [rows[0].id]
  );

  res.send(page('Confirmed', 'you’re on the list 🖤',
    'that’s it — nothing else to do. you’ll hear from me when there’s something worth saying, and never otherwise.'));
});

// GET for the link in the email body, POST for the one-click header button
// that Gmail and Outlook render. Both must work.
async function doUnsubscribe(req, res) {
  const t = String(req.query.t || req.body.t || '');
  if (!t) return res.status(400).send(page('Unsubscribe', 'that link looks wrong', 'the unsubscribe link was incomplete.'));

  const [rows] = await pool.query('SELECT id FROM subscribers WHERE unsub_token = ? LIMIT 1', [t]);
  if (!rows[0]) {
    return res.status(404).send(page('Unsubscribe', 'already done',
      'we couldn’t find that address on the list, which probably means you’re already off it.'));
  }

  await pool.query(
    "UPDATE subscribers SET status='unsubscribed', unsubscribed_at=NOW() WHERE id=?",
    [rows[0].id]
  );

  res.send(page('Unsubscribed', 'you’re unsubscribed',
    'done, immediately, no hard feelings. you won’t get anything else from this list.'));
}

router.get('/unsubscribe', doUnsubscribe);
router.post('/unsubscribe', express.urlencoded({ extended: false }), doUnsubscribe);

module.exports = router;
