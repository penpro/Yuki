-- Client testimonials.
--
-- published defaults to 0 on purpose: nothing a client said appears on the
-- public site until she has actively ticked it. Quoting someone by accident
-- is the one mistake here that can't be undone by editing a row.

CREATE TABLE IF NOT EXISTS testimonials (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  author      VARCHAR(120) NOT NULL,
  body        TEXT         NOT NULL,
  context     VARCHAR(160) NULL,          -- e.g. "deep clean, 45 min"
  sort_order  INT          NOT NULL DEFAULT 0,
  published   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_testimonials_listing (published, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
