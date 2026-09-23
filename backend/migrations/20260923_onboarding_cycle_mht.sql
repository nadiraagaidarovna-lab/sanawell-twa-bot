-- Run explicitly against the intended database using psql -v ON_ERROR_STOP=1 -f <this file>.
-- Requires the existing users schema. Never called by initSchema or app startup.
-- Self-reported answers only; NULL means unanswered. No defaults or backfill.
-- Rollback: revert application code and leave these nullable columns/data in place.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE users ADD COLUMN IF NOT EXISTS cycle_situation TEXT
  CONSTRAINT users_cycle_situation_check CHECK (cycle_situation IN
    ('regular', 'changing', 'no_period_12m', 'post_surgery', 'treatment_affected', 'other', 'unsure'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS mht_status TEXT
  CONSTRAINT users_mht_status_check CHECK (mht_status IN
    ('current', 'no', 'considering', 'previous', 'prefer_not_to_say'));
COMMIT;
