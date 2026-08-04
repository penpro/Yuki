'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const rateLimit = require('express-rate-limit');

const { pool, ping } = require('./db');
const { verifyCredentials, requireAuthPage, login, logout } = require('./auth');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const newsletterRoutes = require('./routes/newsletter');
const mailRoutes = require('./routes/mail');
const mailer = require('./mailer');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const COOKIE_SECURE = String(process.env.COOKIE_SECURE).toLowerCase() === 'true';

// nginx terminates TLS and proxies here, so req.secure and the client IP are
// only correct if express trusts the proxy. Without this, secure cookies are
// never set and every rate limit sees a single IP (nginx's).
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

/* ── sessions ─────────────────────────────────────────────────────────── */

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true,
  // Sessions live in MySQL rather than memory so a PM2 restart doesn't sign
  // everyone out, and so it still works if this ever runs more than one node.
});

app.use(session({
  name: 'yuki.sid',
  secret: process.env.SESSION_SECRET || 'insecure-dev-secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,           // JS can't read it, so XSS can't steal it
    sameSite: 'lax',          // blocks the cross-site POST shape of CSRF
    secure: COOKIE_SECURE,    // true once HTTPS is on — see .env.example
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

/* ── rate limiting ────────────────────────────────────────────────────── */

// Login is the one endpoint worth brute-forcing, so it gets its own limit.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait fifteen minutes and try again.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ── public ───────────────────────────────────────────────────────────── */

app.use(publicRoutes);
app.use(newsletterRoutes);

/* ── admin ────────────────────────────────────────────────────────────── */

const ADMIN_UI = path.join(__dirname, 'public', 'admin');

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/admin');
  res.sendFile(path.join(ADMIN_UI, 'login.html'));
});

app.post('/admin/login', loginLimiter, async (req, res) => {
  try {
    const user = await verifyCredentials(req.body.email, req.body.password);
    if (!user) {
      // One message for both failure modes — see the note in auth.js.
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }
    await login(req, user);
    res.json({ ok: true });
  } catch (err) {
    console.error('login failed:', err.message);
    res.status(500).json({ error: 'Something went wrong signing in' });
  }
});

app.post('/admin/logout', async (req, res) => {
  await logout(req);
  res.clearCookie('yuki.sid');
  res.json({ ok: true });
});

app.get('/admin/me', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'Not signed in' });
  res.json(req.session.user);
});

app.get('/admin', requireAuthPage, (req, res) => {
  res.sendFile(path.join(ADMIN_UI, 'index.html'));
});

app.use('/admin/assets', express.static(path.join(ADMIN_UI, 'assets'), { maxAge: '1h' }));
app.use('/api/admin', apiLimiter, adminRoutes);
app.use('/api/admin', apiLimiter, mailRoutes);

/* ── errors ───────────────────────────────────────────────────────────── */

app.use((err, req, res, next) => {
  // Log the detail, return none of it. Stack traces and SQL errors handed to
  // a client are a map of the system.
  console.error('[error]', req.method, req.originalUrl, '-', err.message);
  if (res.headersSent) return next(err);
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  res.status(status).json({
    error: status === 413 ? 'That file is too large (8MB max)' : 'Something went wrong',
  });
});

/* ── start ────────────────────────────────────────────────────────────── */

(async () => {
  try {
    await ping();
    console.log('database ok');
  } catch (err) {
    console.error('CANNOT REACH DATABASE:', err.message);
    process.exit(1);   // fail loudly at boot rather than 500 on every request
  }

  if (!COOKIE_SECURE) {
    console.warn('WARNING: COOKIE_SECURE=false — session cookies will be sent over plain HTTP.');
    console.warn('         Set it to true in .env once certbot has run.');
  }
  if (!process.env.SESSION_SECRET) {
    console.warn('WARNING: SESSION_SECRET is not set. Sessions are not securely signed.');
  }
  if (!mailer.isConfigured()) {
    console.warn('NOTE: SMTP is not configured. Signups are still recorded, but no');
    console.warn('      confirmation emails go out and newsletters cannot send.');
    console.warn('      Set SMTP_HOST / SMTP_PORT / MAIL_FROM_ADDRESS in .env.');
  } else if (!process.env.MAIL_POSTAL_ADDRESS) {
    console.warn('WARNING: MAIL_POSTAL_ADDRESS is not set. US commercial email is');
    console.warn('         legally required to carry a physical mailing address.');
  }

  // Bind to loopback only. nginx proxies to it; the port is never reachable
  // from the internet even if a security group rule is opened by mistake.
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`yuki-backend listening on 127.0.0.1:${PORT}`);
  });
})();
