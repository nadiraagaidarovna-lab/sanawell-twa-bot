-- Run explicitly after 20261009_onboarding_reached_step.sql using psql -v ON_ERROR_STOP=1 -f <this file>.
-- Never called by initSchema or app startup.
-- One row per woman per day (Almaty date): an optional topic chosen for today only (the main
-- priority in users.focus_priority is never changed here) and her own mark for today's material:
-- 'tried' (Попробовала) or 'not_yet' (Пока нет). Opening a material is not recorded as done.
-- Rollback: revert application code and leave the table and its rows in place.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE IF NOT EXISTS daily_actions (
  telegram_id  TEXT NOT NULL REFERENCES users(telegram_id),
  action_date  TEXT NOT NULL CHECK (action_date ~ '^\d{4}-\d{2}-\d{2}$'),
  today_topic  TEXT CHECK (today_topic IN ('nutrition', 'movement', 'sleep', 'menopause360', 'emotions')),
  material_id  TEXT CHECK (length(material_id) BETWEEN 1 AND 64),
  status       TEXT CHECK (status IN ('tried', 'not_yet')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (telegram_id, action_date)
);
COMMIT;
