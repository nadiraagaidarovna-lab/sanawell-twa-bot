-- Run explicitly after 20261007_app_events.sql using psql -v ON_ERROR_STOP=1 -f <this file>.
-- Never called by initSchema or app startup.
-- New onboarding: chosen wellbeing topics (multi-select) and one main priority or 'unsure'.
-- Self-reported choices only; NULL means not answered. Existing columns and answers
-- (age, cycle_situation, mht_status, goal, ...) are kept as they are.
-- Also widens analytics steps to the 7-screen onboarding.
-- Rollback: revert application code and leave the columns and their data in place.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE users ADD COLUMN IF NOT EXISTS focus_topics TEXT[]
  CONSTRAINT users_focus_topics_check CHECK (
    cardinality(focus_topics) BETWEEN 1 AND 6 AND
    focus_topics <@ ARRAY['nutrition', 'movement', 'sleep', 'menopause360', 'emotions', 'environment']::text[]);
ALTER TABLE users ADD COLUMN IF NOT EXISTS focus_priority TEXT
  CONSTRAINT users_focus_priority_check CHECK (focus_priority IN
    ('nutrition', 'movement', 'sleep', 'menopause360', 'emotions', 'environment', 'unsure'));
ALTER TABLE app_events DROP CONSTRAINT IF EXISTS app_events_step_check;
ALTER TABLE app_events ADD CONSTRAINT app_events_step_check CHECK (step BETWEEN 1 AND 7);
COMMIT;
