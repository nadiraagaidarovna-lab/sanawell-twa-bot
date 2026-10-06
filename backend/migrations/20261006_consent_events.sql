-- Run explicitly against the intended database using psql -v ON_ERROR_STOP=1 -f <this file>.
-- Requires the existing users schema. Never called by initSchema or app startup.
-- Append-only consent journal: one row per document per confirmation or withdrawal,
-- with the document version the user saw. Legacy *_consent_at columns are left as-is.
-- UPDATE is rejected; DELETE stays possible for a future account-deletion procedure.
-- Rollback: revert application code and leave the table and its rows in place.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE IF NOT EXISTS consent_events (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  telegram_id      TEXT NOT NULL REFERENCES users(telegram_id),
  document         TEXT NOT NULL CHECK (document IN ('terms', 'privacy_data_consent')),
  document_version TEXT NOT NULL CHECK (length(document_version) BETWEEN 1 AND 64),
  action           TEXT NOT NULL CHECK (action IN ('granted', 'withdrawn')),
  source           TEXT NOT NULL CHECK (source IN ('onboarding_v2', 'legacy_consent_screen', 'reconsent')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_events_user_document ON consent_events (telegram_id, document, id DESC);
CREATE OR REPLACE FUNCTION consent_events_reject_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'consent_events is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS consent_events_no_update ON consent_events;
CREATE TRIGGER consent_events_no_update BEFORE UPDATE ON consent_events
  FOR EACH ROW EXECUTE FUNCTION consent_events_reject_update();
COMMIT;
