'use strict';

// Authentication: bcrypt password checks, login/logout, route guards.
//
// Deliberate choices worth keeping:
//
//   * Login failures return one generic message. Distinguishing "no such
//     account" from "wrong password" hands an attacker a free account
//     enumeration oracle.
//   * A dummy bcrypt compare runs when the account doesn't exist, so a
//     missing account takes about as long as a wrong password. Without it,
//     response timing leaks which emails are real.
//   * The session ID is regenerated on login to prevent session fixation.

const bcrypt = require('bcryptjs');
const { pool } = require('./db');

// Cost of a bcrypt hash of a throwaway value, used to burn equivalent time
// on the "no such user" path.
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.7yA4pS5N2Wp0Wq4hM4A1r1CkGZ0j6vG';

async function verifyCredentials(email, password) {
  const [rows] = await pool.query(
    'SELECT id, email, password_hash, display_name FROM admin_users WHERE email = ? LIMIT 1',
    [String(email || '').trim().toLowerCase()]
  );

  const user = rows[0];
  if (!user) {
    await bcrypt.compare(String(password || ''), DUMMY_HASH); // equalise timing
    return null;
  }

  const ok = await bcrypt.compare(String(password || ''), user.password_hash);
  if (!ok) return null;

  pool.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?', [user.id])
    .catch(() => { /* a failed timestamp update must not fail the login */ });

  return { id: user.id, email: user.email, displayName: user.display_name };
}

// Guard for pages: bounce to the login screen.
function requireAuthPage(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/admin/login');
}

// Guard for JSON endpoints: 401 rather than a redirect, so fetch() callers
// get something they can actually branch on.
function requireAuthApi(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Not signed in' });
}

function login(req, user) {
  return new Promise((resolve, reject) => {
    // Regenerate before storing anything — defeats session fixation, where an
    // attacker plants a known session ID and waits for it to be elevated.
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = user;
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

function logout(req) {
  return new Promise((resolve) => {
    if (!req.session) return resolve();
    req.session.destroy(() => resolve());
  });
}

module.exports = { verifyCredentials, requireAuthPage, requireAuthApi, login, logout };
