'use strict';

// Public, unauthenticated routes.
//
// /resources is rendered server-side from the database. The page chrome is
// NOT duplicated here: build-pages.py writes resources.html containing a
// placeholder comment, and this route reads that file and injects the cards.
// One source of truth for nav, footer and background layers.

const path = require('path');
const fs = require('fs');
const express = require('express');
const { pool } = require('../db');

const router = express.Router();

const START = '<!--RESOURCE_CARDS_START-->';
const END = '<!--RESOURCE_CARDS_END-->';
const SITE_ROOT = process.env.SITE_ROOT || '/var/www/yuki';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Blurbs are authored by her and may contain deliberate <em>. Allow that and
// nothing else — everything is escaped first, then the one safe tag is
// restored. An allowlist beats trying to strip the dangerous cases.
function blurbHtml(s) {
  return esc(s).replace(/&lt;(\/?)em&gt;/g, '<$1em>');
}

function cardHtml(r) {
  const href = r.file_path
    ? '/uploads/' + encodeURIComponent(path.basename(r.file_path))
    : String(r.href || '#');
  const printBtn = (r.printable && !r.file_path)
    ? `\n          <a class="btn btn--sm btn--ghost" href="${esc(href)}?print">printer friendly</a>`
    : '';
  return `      <article class="rescard reveal">
        <span class="rescard__kind">${esc(r.kind)}</span>
        <h2 class="rescard__title">${esc(r.title)}</h2>
        <p class="rescard__body">${blurbHtml(r.blurb)}</p>
        <div class="rescard__foot">
          <a class="btn btn--sm btn--gold" href="${esc(href)}">open</a>${printBtn}
        </div>
      </article>`;
}

router.get(['/resources', '/resources.html'], async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT kind, title, blurb, href, file_path, printable FROM resources ' +
      'WHERE published = 1 ORDER BY sort_order ASC, id ASC'
    );

    const tpl = fs.readFileSync(path.join(SITE_ROOT, 'resources.html'), 'utf8');
    const a = tpl.indexOf(START);
    const b = tpl.indexOf(END);

    // If the markers are missing the template has drifted from the build
    // script. Serve the file untouched rather than a mangled page.
    if (a === -1 || b === -1 || b < a) {
      console.error('resources.html is missing the card markers — serving it as-is');
      return res.type('html').send(tpl);
    }

    const cards = rows.length
      ? rows.map(cardHtml).join('\n\n')
      : '      <p class="shead__sub">nothing here yet — check back soon.</p>';

    res.set('Cache-Control', 'no-cache, must-revalidate');
    res.type('html').send(tpl.slice(0, a + START.length) + '\n' + cards + '\n' + tpl.slice(b));
  } catch (err) {
    next(err);
  }
});

// Consumed by assets/testimonials.js on the static home page.
router.get('/api/testimonials', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT author, body, context FROM testimonials ' +
      'WHERE published = 1 ORDER BY sort_order ASC, id ASC LIMIT 24'
    );
    res.set('Cache-Control', 'public, max-age=120');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
