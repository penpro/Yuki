-- Admin accounts. Passwords are bcrypt hashes only — no plaintext ever
-- reaches this table. Accounts are created with backend/create-admin.js,
-- never by hand and never seeded with a default password (a shipped default
-- that nobody changes is how these things get owned).

CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(120) NULL,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
