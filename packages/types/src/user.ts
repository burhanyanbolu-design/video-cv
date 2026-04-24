/** Represents a registered job seeker account. */
export interface User {
  id: string; // UUID
  email: string;
  createdAt: string; // ISO 8601
  deletedAt: string | null;
  /** ISO 8601 timestamp when the user granted consent */
  consentTimestamp: string;
  /** Version of the privacy policy accepted at registration */
  privacyPolicyVersion: string;
}
