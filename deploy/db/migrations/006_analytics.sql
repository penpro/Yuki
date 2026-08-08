-- Privacy-first analytics.
--
-- No cookies, no third party, and no IP address is ever stored. visitor_key
-- is sha256(SESSION_SECRET + date + ip + user-agent), truncated. That makes
-- it:
--   * irreversible — you cannot get an IP back out of it
--   * useful for counting unique visitors within a single day
--   * useless for following someone across days, because the date is part of
--     the input, so the same person hashes differently tomorrow
--
-- This is the same approach Plausible and Fathom use, and it's why no cookie
-- banner is required: nothing is stored on the visitor's device and nothing
-- retained here identifies a person.

CREATE TABLE IF NOT EXISTS page_views (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  day         DATE         NOT NULL,
  path        VARCHAR(300) NOT NULL,
  ref_host    VARCHAR(191) NULL,        -- host only, never the full URL
  device      ENUM('mobile','tablet','desktop','other') NOT NULL DEFAULT 'other',
  visitor_key CHAR(32)     NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_views_day (day),
  KEY idx_views_path (day, path),
  KEY idx_views_ref (day, ref_host),
  KEY idx_views_visitor (day, visitor_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Things people did, not just pages they loaded. This is the half that
-- actually answers "is the site working" — 200 visits with no book clicks
-- means something quite different from 40 visits with 6.
CREATE TABLE IF NOT EXISTS events (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  day         DATE         NOT NULL,
  name        VARCHAR(60)  NOT NULL,    -- book_click | signup | guide_open | print_view
  detail      VARCHAR(300) NULL,
  visitor_key CHAR(32)     NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_events_day (day, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
