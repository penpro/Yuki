'use strict';

// MySQL connection pool.
//
// connectionLimit is deliberately small. The server has ~900MB of RAM and
// mysqld is capped at max_connections=30 by the low-memory tuning in
// deploy/provision-stack.sh; a pool that tries to open more than the server
// allows fails at the worst possible moment rather than at startup.

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  charset: 'utf8mb4',
  // Never let a caller interpolate multiple statements into one query.
  multipleStatements: false,
});

async function ping() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}

module.exports = { pool, ping };
