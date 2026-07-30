-- The resources catalogue. This is the listing that /resources renders —
-- the workbooks themselves stay as authored HTML in guides/.
--
-- href and file_path are alternatives: href points at an existing page
-- (guides/breathing.html) or an external URL; file_path points at something
-- uploaded through the admin. Exactly one is expected to be set.

CREATE TABLE IF NOT EXISTS resources (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(120) NOT NULL,
  kind        VARCHAR(60)  NOT NULL DEFAULT 'guide',
  title       VARCHAR(200) NOT NULL,
  blurb       TEXT         NULL,
  href        VARCHAR(500) NULL,
  file_path   VARCHAR(500) NULL,
  printable   TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order  INT          NOT NULL DEFAULT 0,
  published   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_resources_slug (slug),
  KEY idx_resources_listing (published, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the five guides that already exist as files, so switching the page
-- from static to database-backed doesn't briefly empty it. printable=1 marks
-- the ones that support the ?print black-and-white view.
INSERT INTO resources (slug, kind, title, blurb, href, printable, sort_order, published) VALUES
 ('breathing', 'breathing', 'breathe',
  'Three ways to talk your nervous system down in under two minutes: box breathing, the long exhale, and the double sigh.',
  'guides/breathing.html', 1, 10, 1),
 ('meditation', 'meditation', 'sit',
  'Five minutes, no cushion, no clearing your mind. Including what to do when your mind wanders — which it will, and which is the point.',
  'guides/meditation.html', 1, 20, 1),
 ('catastrophic-thinking', 'cbt workbook', 'the spiral',
  'The long one. Catch the thought that''s running you, name its shape, test it against the evidence, and write down a truer one.',
  'guides/catastrophic-thinking.html', 1, 30, 1),
 ('new-job', 'cbt workbook', 'new job nerves',
  'For the week before you start, or the first week in. What exactly are you afraid of, how likely is it, and what would a <em>fine</em> first week look like?',
  'guides/new-job.html', 1, 40, 1),
 ('breakup', 'cbt workbook', 'after a breakup',
  'For the part where your brain won''t stop going over it. Separating fact from story, and working out what you actually miss.',
  'guides/breakup.html', 1, 50, 1)
ON DUPLICATE KEY UPDATE slug = slug;
