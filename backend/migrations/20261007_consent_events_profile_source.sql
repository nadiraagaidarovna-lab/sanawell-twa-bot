-- Run explicitly after 20261006_consent_events.sql using psql -v ON_ERROR_STOP=1 -f <this file>.
-- Never called by initSchema or app startup. Adds 'profile' as a source so a withdrawal made
-- from the cabinet is recorded as such. Existing rows are not touched.
-- Rollback: revert application code; the wider constraint can stay.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE consent_events DROP CONSTRAINT IF EXISTS consent_events_source_check;
ALTER TABLE consent_events ADD CONSTRAINT consent_events_source_check
  CHECK (source IN ('onboarding_v2', 'legacy_consent_screen', 'reconsent', 'profile'));
COMMIT;
