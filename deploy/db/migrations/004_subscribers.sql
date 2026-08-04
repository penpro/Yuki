-- Mailing list.
--
-- status lifecycle:
--   pending      signed up, confirmation email not yet clicked
--   confirmed    clicked the confirm link — safe to mail
--   unsubscribed opted out, must never be mailed again
--   bounced      hard-bounced, must never be mailed again
--
-- Only 'confirmed' is ever sent to. unsubscribed and bounced rows are KEPT
-- rather than deleted on purpose: deleting them means the same address can
-- re-enter through a later import and start receiving mail again, which is
-- exactly the complaint that gets a sending domain blacklisted.

CREATE TABLE IF NOT EXISTS subscribers (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(191) NOT NULL,
  name            VARCHAR(120) NULL,
  status          ENUM('pending','confirmed','unsubscribed','bounced')
                    NOT NULL DEFAULT 'pending',
  source          VARCHAR(60)  NOT NULL DEFAULT 'website',
  notes           VARCHAR(500) NULL,
  confirm_token   CHAR(48)     NULL,
  unsub_token     CHAR(48)     NOT NULL,
  confirmed_at    TIMESTAMP    NULL DEFAULT NULL,
  unsubscribed_at TIMESTAMP    NULL DEFAULT NULL,
  last_sent_at    TIMESTAMP    NULL DEFAULT NULL,
  send_count      INT UNSIGNED NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subscribers_email (email),
  UNIQUE KEY uq_subscribers_unsub (unsub_token),
  KEY idx_subscribers_status (status, created_at),
  KEY idx_subscribers_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
