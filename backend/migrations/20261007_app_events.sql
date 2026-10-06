-- Run explicitly against the intended database using psql -v ON_ERROR_STOP=1 -f <this file>.
-- Never called by initSchema or app startup.
-- First-party interaction analytics. Only fixed columns with closed value sets: there is no
-- free-form field, so answers, symptoms, texts or field values cannot be stored here.
-- `pseudonym` is a pseudonymous identifier (HMAC-SHA256 of the Telegram ID with a server
-- secret), not anonymous data: whoever holds the secret can link it back to a Telegram ID.
-- No retention period is set yet: it needs a separate decision.
-- Rollback: revert application code and leave the table and its rows in place.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE IF NOT EXISTS app_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pseudonym   TEXT NOT NULL CHECK (pseudonym ~ '^[0-9a-f]{64}$'),
  event       TEXT NOT NULL CHECK (event IN ('onboarding_step_view', 'onboarding_step_done',
                'onboarding_error', 'onboarding_completed', 'section_open', 'section_active_time',
                'legal_doc_open')),
  step        SMALLINT CHECK (step BETWEEN 1 AND 6),
  section     TEXT CHECK (section ~ '^[a-z][a-z-]{1,39}$'),
  error_kind  TEXT CHECK (error_kind IN ('network', 'server', 'consent', 'validation')),
  doc         TEXT CHECK (doc IN ('terms', 'privacy', 'dataConsent')),
  seconds     INTEGER CHECK (seconds BETWEEN 1 AND 3600),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_events_event_time ON app_events (event, created_at);
CREATE INDEX IF NOT EXISTS idx_app_events_pseudonym ON app_events (pseudonym, created_at);
COMMIT;
