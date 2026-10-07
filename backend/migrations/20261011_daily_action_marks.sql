-- Run explicitly after 20261010_daily_actions.sql using psql -v ON_ERROR_STOP=1 -f <this file>.
-- Never called by initSchema or app startup.
-- Her own marks for today's materials, kept per day AND per material, separately from the topic
-- chosen for today (daily_actions.today_topic). Choosing another topic never erases a mark: if she
-- returns to the earlier material the same day, its mark is still there. Opening a material is
-- not recorded. daily_actions.material_id/status are no longer written or read by the app; they
-- stay in place (nullable, unused) so rolling the code back needs no schema change.
-- Rollback: revert application code and leave the table and its rows in place.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE IF NOT EXISTS daily_action_marks (
  telegram_id  TEXT NOT NULL REFERENCES users(telegram_id),
  action_date  TEXT NOT NULL CHECK (action_date ~ '^\d{4}-\d{2}-\d{2}$'),
  material_id  TEXT NOT NULL CHECK (length(material_id) BETWEEN 1 AND 64),
  status       TEXT NOT NULL CHECK (status IN ('tried', 'not_yet')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (telegram_id, action_date, material_id)
);
COMMIT;
