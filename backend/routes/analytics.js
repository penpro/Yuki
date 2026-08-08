'use strict';

// Analytics collection (public) and aggregation (admin).
//
// Nothing here stores an IP address, a user-agent string, or sets a cookie.
// See deploy/db/migrations/006_analytics.sql for why that matters and how
// unique-visitor counting still works without them.

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');

const router = express.Router();

// Obvious automated traffic. Not exhaustive — nothing is — but it keeps the
// numbers honest enough to make decisions from. Uptime pings and search
// crawlers would otherwise look like an audience.
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|curl|wget|python-requests|axios|monitor|pingdom|uptime|facebookexternalhit|whatsapp|telegram|preview/i;

function deviceOf(ua) {
  if (!ua) return 'other';
  if (/ipad|tablet|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/i.test(ua)) return 'mobile';
  if (/mozilla|chrome|safari|firefox|edge/i.test(ua)) return 'desktop';
  return 'other';
}

// Daily-rotating, irreversible. The date is part of the input, so the same
// person produces a different key tomorrow and cannot be followed over time.
function visitorKey(req, day) {
  const salt = process.env.SESSION_SECRET || 'fallback-salt';
  const ip = req.ip || '';
  const ua = req.get('user-agent') || '';
  return crypto.createHash('sha256').update(salt + '|' + day + '|' + ip + '|' + ua)
    .digest('hex').slice(0, 32);
}

function today() { return new Date().toISOString().slice(0, 10); }

// Host only. The full referring URL can carry search terms and private path
// segments; the host answers "where did they come from" without any of that.
function refHost(ref) {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '');
    return h.slice(0, 191) || null;
  } catch (e) { return null; }
}

const hitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: false,
  legacyHeaders: false,
  // A rate-limited beacon should fail silently, not show an error to a visitor.
  handler: (req, res) => res.status(204).end(),
});

/* ── collection ─────────────────────────────────────────────────────────── */

function shouldSkip(req) {
  const ua = req.get('user-agent') || '';
  if (!ua || BOT_RE.test(ua)) return true;
  // Honour Do Not Track and Global Privacy Control. Under-counting a little
  // is a fair price for not measuring people who asked not to be.
  if (req.get('dnt') === '1' || req.get('sec-gpc') === '1') return true;
  return false;
}

router.post('/api/hit', hitLimiter, async (req, res) => {
  res.status(204).end();                       // never make the page wait
  try {
    if (shouldSkip(req)) return;
    const day = today();
    const path = String(req.body.path || '/').slice(0, 300);
    await pool.query(
      'INSERT INTO page_views (day, path, ref_host, device, visitor_key) VALUES (?,?,?,?,?)',
      [day, path, refHost(req.body.ref), deviceOf(req.get('user-agent')), visitorKey(req, day)]
    );
  } catch (err) {
    console.error('[hit]', err.message);       // analytics must never break a page
  }
});

router.post('/api/event', hitLimiter, async (req, res) => {
  res.status(204).end();
  try {
    if (shouldSkip(req)) return;
    const name = String(req.body.name || '').slice(0, 60);
    if (!name) return;
    const day = today();
    await pool.query(
      'INSERT INTO events (day, name, detail, visitor_key) VALUES (?,?,?,?)',
      [day, name, String(req.body.detail || '').slice(0, 300) || null, visitorKey(req, day)]
    );
  } catch (err) {
    console.error('[event]', err.message);
  }
});

/* ── aggregation (admin) ────────────────────────────────────────────────── */

const adminStats = express.Router();

adminStats.get('/stats', async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const since = ['DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days - 1]];

    const [[totals]] = await pool.query(
      `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_key) AS visitors
         FROM page_views WHERE day >= ${since[0]}`, since[1]
    );
    const [[prev]] = await pool.query(
      `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_key) AS visitors
         FROM page_views
        WHERE day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND day <  DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [days * 2 - 1, days - 1]
    );
    const [daily] = await pool.query(
      `SELECT day, COUNT(*) AS views, COUNT(DISTINCT visitor_key) AS visitors
         FROM page_views WHERE day >= ${since[0]}
        GROUP BY day ORDER BY day ASC`, since[1]
    );
    const [pages] = await pool.query(
      `SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_key) AS visitors
         FROM page_views WHERE day >= ${since[0]}
        GROUP BY path ORDER BY views DESC LIMIT 15`, since[1]
    );
    const [refs] = await pool.query(
      `SELECT COALESCE(ref_host,'(direct)') AS ref_host, COUNT(*) AS views
         FROM page_views WHERE day >= ${since[0]}
        GROUP BY ref_host ORDER BY views DESC LIMIT 12`, since[1]
    );
    const [devices] = await pool.query(
      `SELECT device, COUNT(*) AS views FROM page_views
        WHERE day >= ${since[0]} GROUP BY device ORDER BY views DESC`, since[1]
    );
    const [evts] = await pool.query(
      `SELECT name, COUNT(*) AS n, COUNT(DISTINCT visitor_key) AS people
         FROM events WHERE day >= ${since[0]}
        GROUP BY name ORDER BY n DESC`, since[1]
    );
    const [[subs]] = await pool.query(
      `SELECT COUNT(*) AS n FROM subscribers
        WHERE created_at >= ${since[0]}`, since[1]
    );

    res.json({
      days,
      totals: { views: totals.views, visitors: totals.visitors },
      previous: { views: prev.views, visitors: prev.visitors },
      daily, pages, refs, devices, events: evts,
      signups: subs.n,
    });
  } catch (e) { next(e); }
});

module.exports = { publicRoutes: router, adminRoutes: adminStats };
