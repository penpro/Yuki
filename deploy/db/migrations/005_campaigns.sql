-- Newsletter campaigns and per-recipient send tracking.
--
-- source_type / source_id link a campaign back to the thing that prompted it
-- (a testimonial, a resource, a Medium post). That link is what stops the
-- admin suggesting "write a newsletter about this" for something she has
-- already mailed about.

CREATE TABLE IF NOT EXISTS campaigns (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  subject         VARCHAR(200) NOT NULL,
  preheader       VARCHAR(200) NULL,          -- the grey preview line in inboxes
  body            MEDIUMTEXT   NOT NULL,      -- plain text with blank-line paragraphs
  cta_label       VARCHAR(80)  NULL,
  cta_url         VARCHAR(500) NULL,
  source_type     VARCHAR(40)  NULL,          -- testimonial | resource | post | manual
  source_id       VARCHAR(191) NULL,          -- id, or a URL for Medium posts
  status          ENUM('draft','sending','sent','failed') NOT NULL DEFAULT 'draft',
  recipient_count INT UNSIGNED NOT NULL DEFAULT 0,
  sent_count      INT UNSIGNED NOT NULL DEFAULT 0,
  failed_count    INT UNSIGNED NOT NULL DEFAULT 0,
  last_error      VARCHAR(500) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at         TIMESTAMP    NULL DEFAULT NULL,
  KEY idx_campaigns_status (status, created_at),
  KEY idx_campaigns_source (source_type, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per recipient per campaign. Exists so a send that dies halfway can
-- resume without mailing anyone twice — the unique key is the guard.
CREATE TABLE IF NOT EXISTS campaign_sends (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT UNSIGNED NOT NULL,
  subscriber_id INT UNSIGNED NOT NULL,
  status        ENUM('sent','failed') NOT NULL,
  error         VARCHAR(500) NULL,
  sent_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_campaign_recipient (campaign_id, subscriber_id),
  KEY idx_sends_campaign (campaign_id, status),
  CONSTRAINT fk_sends_campaign   FOREIGN KEY (campaign_id)   REFERENCES campaigns(id)   ON DELETE CASCADE,
  CONSTRAINT fk_sends_subscriber FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
