'use strict';

// Admin mailing-list API: subscribers, campaigns, sending, suggestions.
// Mounted under /api/admin, so everything here is already behind auth.

const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const mailer = require('../mailer');

const router = express.Router();

const str = (v, max) => {
  const s = String(v == null ? '' : v).trim();
  return s.length > max ? s.slice(0, max) : s;
};

/* ── subscriber filtering ───────────────────────────────────────────────── */

// Builds a parameterised WHERE from the query string. Every value goes in the
// params array — nothing from the client is ever concatenated into the SQL.
function subscriberFilter(q) {
  const where = [];
  const params = [];

  if (q.status && ['pending', 'confirmed', 'unsubscribed', 'bounced'].includes(q.status)) {
    where.push('status = ?');
    params.push(q.status);
  }
  if (q.source) {
    where.push('source = ?');
    params.push(str(q.source, 60));
  }
  if (q.q) {
    where.push('(email LIKE ? OR name LIKE ? OR notes LIKE ?)');
    const like = '%' + str(q.q, 100) + '%';
    params.push(like, like, like);
  }
  if (q.from) { where.push('created_at >= ?'); params.push(str(q.from, 32)); }
  if (q.to)   { where.push('created_at <= ?'); params.push(str(q.to, 32) + ' 23:59:59'); }
  if (q.mailable === '1') { where.push("status = 'confirmed'"); }

  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

const SORTS = {
  newest: 'created_at DESC',
  oldest: 'created_at ASC',
  email: 'email ASC',
  status: 'status ASC, created_at DESC',
  active: 'last_sent_at DESC',
};

router.get('/subscribers', async (req, res, next) => {
  try {
    const f = subscriberFilter(req.query);
    const order = SORTS[req.query.sort] || SORTS.newest;
    const limit = Math.min(Number(req.query.limit) || 200, 1000);

    const [rows] = await pool.query(
      `SELECT id,email,name,status,source,notes,confirmed_at,unsubscribed_at,
              last_sent_at,send_count,created_at
         FROM subscribers ${f.sql} ORDER BY ${order} LIMIT ?`,
      [...f.params, limit]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM subscribers ${f.sql}`, f.params
    );
    res.json({ rows, total, returned: rows.length });
  } catch (e) { next(e); }
});

// Just the addresses matching the current filter, newline separated, so she
// can paste the list straight into any other mail tool.
router.get('/subscribers/copy', async (req, res, next) => {
  try {
    const f = subscriberFilter(req.query);
    const [rows] = await pool.query(
      `SELECT email FROM subscribers ${f.sql} ORDER BY created_at DESC`, f.params
    );
    res.type('text/plain').send(rows.map((r) => r.email).join('\n'));
  } catch (e) { next(e); }
});

router.get('/subscribers/export', async (req, res, next) => {
  try {
    const f = subscriberFilter(req.query);
    const [rows] = await pool.query(
      `SELECT email,name,status,source,notes,confirmed_at,created_at
         FROM subscribers ${f.sql} ORDER BY created_at DESC`, f.params
    );
    // Prefix any leading =,+,-,@ so a spreadsheet treats it as text rather
    // than a formula. CSV injection is a real thing when the data is
    // user-supplied and the output opens in Excel.
    const cell = (v) => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const head = 'email,name,status,source,notes,confirmed_at,created_at';
    const body = rows.map((r) => [r.email, r.name, r.status, r.source, r.notes,
      r.confirmed_at, r.created_at].map(cell).join(',')).join('\n');
    res.type('text/csv')
       .set('Content-Disposition', 'attachment; filename="subscribers.csv"')
       .send(head + '\n' + body);
  } catch (e) { next(e); }
});

router.get('/subscribers/stats', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT status, COUNT(*) AS n FROM subscribers GROUP BY status'
    );
    const [sources] = await pool.query(
      'SELECT source, COUNT(*) AS n FROM subscribers GROUP BY source ORDER BY n DESC'
    );
    const stats = { pending: 0, confirmed: 0, unsubscribed: 0, bounced: 0 };
    rows.forEach((r) => { stats[r.status] = r.n; });
    res.json({ stats, sources, mailConfigured: mailer.isConfigured() });
  } catch (e) { next(e); }
});

router.post('/subscribers', async (req, res, next) => {
  try {
    const email = str(req.body.email, 191).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'That doesn’t look like an email address' });
    }
    // Added by hand means she has consent from somewhere else, so it skips
    // the confirmation step and goes straight in as confirmed.
    await pool.query(
      `INSERT INTO subscribers (email,name,status,source,notes,unsub_token,confirmed_at)
       VALUES (?,?,'confirmed',?,?,?,NOW())
       ON DUPLICATE KEY UPDATE name=VALUES(name), notes=VALUES(notes)`,
      [email, str(req.body.name, 120) || null, str(req.body.source, 60) || 'manual',
       str(req.body.notes, 500) || null, crypto.randomBytes(24).toString('hex')]
    );
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/subscribers/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
    const status = ['pending', 'confirmed', 'unsubscribed', 'bounced']
      .includes(req.body.status) ? req.body.status : 'pending';
    await pool.query(
      'UPDATE subscribers SET name=?, status=?, source=?, notes=? WHERE id=?',
      [str(req.body.name, 120) || null, status, str(req.body.source, 60) || 'website',
       str(req.body.notes, 500) || null, id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/subscribers/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
    await pool.query('DELETE FROM subscribers WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── campaigns ──────────────────────────────────────────────────────────── */

router.get('/campaigns', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
  } catch (e) { next(e); }
});

function campaignFields(b) {
  return [
    str(b.subject, 200),
    str(b.preheader, 200) || null,
    str(b.body, 60000),
    str(b.cta_label, 80) || null,
    str(b.cta_url, 500) || null,
    str(b.source_type, 40) || 'manual',
    str(b.source_id, 191) || null,
  ];
}

router.post('/campaigns', async (req, res, next) => {
  try {
    const f = campaignFields(req.body);
    if (!f[0] || !f[2]) return res.status(400).json({ error: 'Subject and body are both required' });
    const [r] = await pool.query(
      `INSERT INTO campaigns (subject,preheader,body,cta_label,cta_url,source_type,source_id)
       VALUES (?,?,?,?,?,?,?)`, f
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/campaigns/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [[c]] = await pool.query('SELECT status FROM campaigns WHERE id=?', [id]);
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (c.status === 'sent' || c.status === 'sending') {
      return res.status(409).json({ error: 'That newsletter has already been sent — make a copy instead' });
    }
    const f = campaignFields(req.body);
    if (!f[0] || !f[2]) return res.status(400).json({ error: 'Subject and body are both required' });
    await pool.query(
      `UPDATE campaigns SET subject=?,preheader=?,body=?,cta_label=?,cta_url=?,
              source_type=?,source_id=? WHERE id=?`, [...f, id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/campaigns/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM campaigns WHERE id=?', [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Rendered HTML for the preview pane, using a dummy unsubscribe link.
router.get('/campaigns/:id/preview', async (req, res, next) => {
  try {
    const [[c]] = await pool.query('SELECT * FROM campaigns WHERE id=?', [Number(req.params.id)]);
    if (!c) return res.status(404).send('Not found');
    res.type('html').send(mailer.renderHtml({
      subject: c.subject, preheader: c.preheader, body: c.body,
      ctaLabel: c.cta_label, ctaUrl: c.cta_url,
      unsubUrl: mailer.unsubUrlFor('preview-token-not-real'),
    }));
  } catch (e) { next(e); }
});

router.post('/campaigns/:id/test', async (req, res, next) => {
  try {
    if (!mailer.isConfigured()) return res.status(400).json({ error: 'SMTP is not configured yet' });
    const to = str(req.body.to, 191).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
      return res.status(400).json({ error: 'Enter a valid address to test with' });
    }
    const [[c]] = await pool.query('SELECT * FROM campaigns WHERE id=?', [Number(req.params.id)]);
    if (!c) return res.status(404).json({ error: 'Not found' });

    await mailer.sendCampaignTo({ email: to, unsub_token: 'test-token-not-real' }, c);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Test send failed: ' + e.message });
  }
});

/* ── sending ────────────────────────────────────────────────────────────── */

// Runs detached from the request. A few hundred sends at a deliberate pace
// takes longer than nginx's proxy timeout, so the request returns straight
// away and the admin polls the campaign row for progress.
async function runSend(campaignId) {
  try {
    const [[c]] = await pool.query('SELECT * FROM campaigns WHERE id=?', [campaignId]);
    if (!c) return;

    const [subs] = await pool.query(
      `SELECT s.id, s.email, s.unsub_token FROM subscribers s
        WHERE s.status='confirmed'
          AND NOT EXISTS (SELECT 1 FROM campaign_sends cs
                           WHERE cs.campaign_id=? AND cs.subscriber_id=s.id)`,
      [campaignId]
    );

    let sent = 0, failed = 0, lastError = null;

    for (const sub of subs) {
      try {
        await mailer.sendCampaignTo(sub, c);
        await pool.query(
          "INSERT IGNORE INTO campaign_sends (campaign_id,subscriber_id,status) VALUES (?,?,'sent')",
          [campaignId, sub.id]
        );
        await pool.query(
          'UPDATE subscribers SET last_sent_at=NOW(), send_count=send_count+1 WHERE id=?', [sub.id]
        );
        sent++;
      } catch (err) {
        failed++;
        lastError = err.message;
        await pool.query(
          "INSERT IGNORE INTO campaign_sends (campaign_id,subscriber_id,status,error) VALUES (?,?,'failed',?)",
          [campaignId, sub.id, String(err.message).slice(0, 500)]
        );
      }
      await pool.query(
        'UPDATE campaigns SET sent_count=?, failed_count=?, last_error=? WHERE id=?',
        [sent, failed, lastError, campaignId]
      );
      // Pace it. Relays rate limit, and a burst from a new sending domain is
      // exactly the pattern that gets flagged.
      await new Promise((r) => setTimeout(r, 400));
    }

    await pool.query(
      "UPDATE campaigns SET status=?, sent_at=NOW() WHERE id=?",
      [failed && !sent ? 'failed' : 'sent', campaignId]
    );
  } catch (err) {
    console.error('[campaign send]', err.message);
    await pool.query("UPDATE campaigns SET status='failed', last_error=? WHERE id=?",
      [String(err.message).slice(0, 500), campaignId]).catch(() => {});
  }
}

router.post('/campaigns/:id/send', async (req, res, next) => {
  try {
    if (!mailer.isConfigured()) {
      return res.status(400).json({ error: 'SMTP is not configured — nothing can send yet' });
    }
    const id = Number(req.params.id);
    const [[c]] = await pool.query('SELECT * FROM campaigns WHERE id=?', [id]);
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (c.status === 'sending') return res.status(409).json({ error: 'Already sending' });
    if (c.status === 'sent') return res.status(409).json({ error: 'Already sent' });

    const [[{ n }]] = await pool.query(
      "SELECT COUNT(*) AS n FROM subscribers WHERE status='confirmed'"
    );
    if (!n) return res.status(400).json({ error: 'Nobody on the list has confirmed yet' });

    await pool.query(
      "UPDATE campaigns SET status='sending', recipient_count=?, sent_count=0, failed_count=0 WHERE id=?",
      [n, id]
    );
    setImmediate(() => runSend(id));
    res.json({ ok: true, recipients: n });
  } catch (e) { next(e); }
});

/* ── suggestions ────────────────────────────────────────────────────────── */

// Cache the Medium feed. Refetching it on every admin page load would be rude
// to Medium and slow for her.
let feedCache = { at: 0, items: [] };

async function mediumPosts() {
  if (Date.now() - feedCache.at < 15 * 60 * 1000) return feedCache.items;
  try {
    const r = await fetch('https://medium.com/feed/@wistyuki', { signal: AbortSignal.timeout(8000) });
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
      const block = m[1];
      const pick = (tag) => {
        const g = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
        return g ? g[1].trim() : '';
      };
      return { title: pick('title'), link: pick('link').split('?')[0], pub: pick('pubDate') };
    }).filter((x) => x.title && x.link);
    feedCache = { at: Date.now(), items };
  } catch (err) {
    console.error('medium feed fetch failed:', err.message);
  }
  return feedCache.items;
}

// Everything published that hasn't had a newsletter written about it yet.
router.get('/suggestions', async (req, res, next) => {
  try {
    const [used] = await pool.query(
      'SELECT source_type, source_id FROM campaigns WHERE source_id IS NOT NULL'
    );
    const taken = new Set(used.map((u) => `${u.source_type}:${u.source_id}`));
    const out = [];

    const [testimonials] = await pool.query(
      'SELECT id,author,body,context,created_at FROM testimonials WHERE published=1 ORDER BY created_at DESC LIMIT 20'
    );
    testimonials.forEach((t) => {
      if (taken.has(`testimonial:${t.id}`)) return;
      out.push({
        type: 'testimonial', id: String(t.id), title: `New words from ${t.author}`,
        detail: t.body.slice(0, 140) + (t.body.length > 140 ? '…' : ''),
        subject: `what ${t.author} said`,
        body: `someone said something about our work together that i wanted to share.\n\n"${t.body}"\n\n— ${t.author}${t.context ? `, ${t.context}` : ''}\n\nif that sounds like something you need, i have space this month.`,
        cta_label: 'book a session',
        cta_url: 'https://yukisacredspace.square.site/s/appointments',
      });
    });

    const [resources] = await pool.query(
      'SELECT id,title,blurb,href,kind FROM resources WHERE published=1 ORDER BY created_at DESC LIMIT 20'
    );
    resources.forEach((r) => {
      if (taken.has(`resource:${r.id}`)) return;
      out.push({
        type: 'resource', id: String(r.id), title: `New guide: ${r.title}`,
        detail: (r.blurb || '').replace(/<[^>]+>/g, '').slice(0, 140),
        subject: `a new free guide: ${r.title}`,
        body: `i made something new and it's free.\n\n${(r.blurb || '').replace(/<[^>]+>/g, '')}\n\nit's yours to read on screen or print out and write on. no signup, no catch.`,
        cta_label: 'read it',
        cta_url: `https://yukispace.duckdns.org/${String(r.href || '').replace(/^\/+/, '')}`,
      });
    });

    (await mediumPosts()).forEach((p) => {
      if (taken.has(`post:${p.link}`)) return;
      out.push({
        type: 'post', id: p.link, title: `New writing: ${p.title}`,
        detail: p.pub,
        subject: p.title,
        body: `i wrote something new.\n\n${p.title}\n\nit's up on medium now if you want to read it.`,
        cta_label: 'read the post',
        cta_url: p.link,
      });
    });

    res.json(out);
  } catch (e) { next(e); }
});

module.exports = router;
