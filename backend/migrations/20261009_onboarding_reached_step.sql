-- Run explicitly after 20261008_onboarding_topics.sql using psql -v ON_ERROR_STOP=1 -f <this file>.
-- Never called by initSchema or app startup.
-- Furthest onboarding screen reached (3..7), so reopening resumes there — including after the
-- optional name was skipped, which leaves no answer to infer it from. Only ever increases.
-- Rollback: revert application code and leave the column in place.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_reached_step SMALLINT
  CONSTRAINT users_onboarding_reached_step_check CHECK (onboarding_reached_step BETWEEN 3 AND 7);
COMMIT;
