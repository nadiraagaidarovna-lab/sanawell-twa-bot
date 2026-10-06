// Single source of legal document addresses and version (legal-documents.json is also read
// by backend/src/consent.js). A new document version is published in a new folder under
// public/legal/ and gets a new "version" here; old files stay so earlier links keep working.
import legal from './legal-documents.json';

export type LegalDocumentKey = keyof typeof legal.documents;

export const LEGAL_DOCUMENTS_VERSION: string = legal.version;

// Documents a user confirms with the two onboarding checkboxes (backend REQUIRED_DOCUMENTS).
export const REQUIRED_CONSENT_DOCUMENTS = ['terms', 'privacy_data_consent'] as const;

export function legalDocumentUrl(key: LegalDocumentKey): string {
  return `${import.meta.env.BASE_URL}${legal.documents[key].path}`;
}

export function legalDocumentTitle(key: LegalDocumentKey): string {
  return legal.documents[key].title;
}
