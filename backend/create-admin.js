'use strict';

// Creates or updates an admin account.
//
//   node create-admin.js her@email.com "Wisteria"
//
// The password is prompted for, never taken as an argument — arguments end up
// in shell history and in `ps` output for every user on the box. Input is
// masked, and only the bcrypt hash is ever written.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const readline = require('readline');
const { pool } = require('./db');

function prompt(question, { mask = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (mask) {
      const onData = (char) => {
        // Redraw the prompt without echoing what was typed.
        if (['\n', '\r', ''].includes(String(char))) {
          process.stdin.removeListener('data', onData);
          return;
        }
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(question);
      };
      process.stdin.on('data', onData);
    }
    rl.question(question, (answer) => {
      rl.close();
      if (mask) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

(async () => {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  const displayName = process.argv[3] || null;

  if (!email || !email.includes('@')) {
    console.error('Usage: node create-admin.js <email> ["Display Name"]');
    process.exit(1);
  }

  const pw = await prompt(`Password for ${email}: `, { mask: true });
  if (pw.length < 12) {
    console.error('Password must be at least 12 characters. Nothing was written.');
    process.exit(1);
  }
  const again = await prompt('Confirm password: ', { mask: true });
  if (pw !== again) {
    console.error('Passwords did not match. Nothing was written.');
    process.exit(1);
  }

  // Cost 12: comfortably slow for an attacker, ~250ms here, and this runs
  // once per login rather than per request.
  const hash = await bcrypt.hash(pw, 12);

  await pool.query(
    `INSERT INTO admin_users (email, password_hash, display_name)
     VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash),
                             display_name  = VALUES(display_name)`,
    [email, hash, displayName]
  );

  console.log(`Admin account ready: ${email}`);
  await pool.end();
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
