// consent.js — versioned consent status and the server-side gate for writes of user data.
// The current document version comes from the same file the Mini App uses for its links
// (mini-app/src/lib/legal-documents.json), so links and recorded versions cannot diverge.
const legal = require('../../mini-app/src/lib/legal-documents.json');

const CURRENT_VERSION = legal.version;
// The two onboarding checkboxes: Terms of use; Privacy policy + data processing consent.
const REQUIRED_DOCUMENTS = ['terms', 'privacy_data_consent'];
const SOURCES = ['onboarding_v2', 'legacy_consent_screen', 'reconsent'];

// Missing explicit migration (backend/migrations/20261006_consent_events.sql).
const UNDEFINED_TABLE = '42P01';

function statusFromEvents(events) {
  const latest = Object.fromEntries(events.map((row) => [row.document, row]));
  const granted = (document) =>
    latest[document]?.action === 'granted' && latest[document]?.document_version === CURRENT_VERSION;
  return {
    version: CURRENT_VERSION,
    terms: granted('terms'),
    privacyDataConsent: granted('privacy_data_consent'),
    current: REQUIRED_DOCUMENTS.every(granted),
  };
}

async function getConsentStatus(db, telegramId) {
  return statusFromEvents(await db.getLatestConsentEvents(telegramId));
}

// Fails closed: without a confirmed current-version consent (or without the journal table)
// the write is rejected, never let through.
function requireConsent(db) {
  return async (req, res, next) => {
    try {
      const status = await getConsentStatus(db, req.telegramId);
      if (!status.current) {
        return res.status(403).json({ error: 'consent_required', reason: 'consent_required' });
      }
      next();
    } catch (error) {
      if (error.code === UNDEFINED_TABLE) {
        return res.status(503).json({ error: 'consent_storage_unavailable', reason: 'consent_storage_unavailable' });
      }
      next(error);
    }
  };
}

module.exports = {
  CURRENT_VERSION,
  REQUIRED_DOCUMENTS,
  SOURCES,
  UNDEFINED_TABLE,
  getConsentStatus,
  requireConsent,
  statusFromEvents,
};
