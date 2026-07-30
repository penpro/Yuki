'use strict';

// Authenticated admin API: resources, testimonials, uploads.
//
// Every route below sits behind requireAuthApi. Every write is parameterised
// — no string-built SQL anywhere in this file.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { pool } = require('../db');
const { requireAuthApi } = require('../auth');

const router = express.Router();
router.use(requireAuthApi);

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/www/yuki-uploads';

/* ── uploads ──────────────────────────────────────────────────────────── */

// Allowlist, not a blocklist. Anything not named here is refused, so a new
// dangerous extension doesn't become allowed by omission.
const ALLOWED = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // The original name is never used on disk. It's attacker-controlled and
    // is the usual route to path traversal or an executable extension.
    const ext = ALLOWED.get(file.mimetype) || '';
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new Error('Unsupported file type: ' + file.mimetype));
    }
    cb(null, true);
  },
});

router.post('/uploads', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });
  res.json({
    file_path: req.file.filename,
    url: '/uploads/' + req.file.filename,
    size: req.file.size,
  });
});

/* ── helpers ──────────────────────────────────────────────────────────── */

const bool = (v) => (v === true || v === 1 || v === '1' || v === 'on' || v === 'true' ? 1 : 0);
const str = (v, max) => {
  const s = String(v == null ? '' : v).trim();
  return s.length > max ? s.slice(0, max) : s;
};
const slugify = (s) =>
  str(s, 120).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

/* ── resources ────────────────────────────────────────────────────────── */

router.get('/resources', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM resources ORDER BY sort_order ASC, id ASC');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/resources', async (req, res, next) => {
  try {
    const b = req.body;
    const title = str(b.title, 200);
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const slug = slugify(b.slug || title) || crypto.randomBytes(6).toString('hex');
    const [r] = await pool.query(
      `INSERT INTO resources (slug, kind, title, blurb, href, file_path, printable, sort_order, published)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [slug, str(b.kind, 60) || 'guide', title, str(b.blurb, 4000),
       str(b.href, 500) || null, str(b.file_path, 500) || null,
       bool(b.printable), Number(b.sort_order) || 0, bool(b.published)]
    );
    res.status(201).json({ id: r.insertId, slug });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That slug is already used' });
    }
    next(e);
  }
});

router.put('/resources/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
    const b = req.body;
    const title = str(b.title, 200);
    if (!title) return res.status(400).json({ error: 'Title is required' });

    await pool.query(
      `UPDATE resources SET kind=?, title=?, blurb=?, href=?, file_path=?,
              printable=?, sort_order=?, published=? WHERE id=?`,
      [str(b.kind, 60) || 'guide', title, str(b.blurb, 4000),
       str(b.href, 500) || null, str(b.file_path, 500) || null,
       bool(b.printable), Number(b.sort_order) || 0, bool(b.published), id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/resources/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
    await pool.query('DELETE FROM resources WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ── testimonials ─────────────────────────────────────────────────────── */

router.get('/testimonials', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM testimonials ORDER BY sort_order ASC, id ASC');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/testimonials', async (req, res, next) => {
  try {
    const b = req.body;
    const author = str(b.author, 120);
    const body = str(b.body, 4000);
    if (!author || !body) return res.status(400).json({ error: 'Author and quote are both required' });

    const [r] = await pool.query(
      'INSERT INTO testimonials (author, body, context, sort_order, published) VALUES (?,?,?,?,?)',
      [author, body, str(b.context, 160) || null, Number(b.sort_order) || 0, bool(b.published)]
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) { next(e); }
});

router.put('/testimonials/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
    const b = req.body;
    const author = str(b.author, 120);
    const body = str(b.body, 4000);
    if (!author || !body) return res.status(400).json({ error: 'Author and quote are both required' });

    await pool.query(
      'UPDATE testimonials SET author=?, body=?, context=?, sort_order=?, published=? WHERE id=?',
      [author, body, str(b.context, 160) || null, Number(b.sort_order) || 0, bool(b.published), id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/testimonials/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
    await pool.query('DELETE FROM testimonials WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
