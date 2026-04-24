export type ProfileVisibility = "private" | "discoverable";

/** The shareable output combining the cleaned video and formatted CV document. */
export interface Profile {
  id: string; // UUID
  sessionId: string; // UUID FK → Session
  userId: string; // UUID FK → User
  /** Public URL token (UUID-based slug) */
  slug: string;
  cvPdfUrl: string | null;
  videoUrl: string | null;
  visibility: ProfileVisibility;
  /** ISO 8601 — created_at + 90 days */
  expiresAt: string;
  deletedAt: string | null;
}

/** Document stored in the Elasticsearch Profile_Directory index. */
export interface ProfileSearchDocument {
  profileId: string;
  name: string;
  jobTitle: string;
  skills: string[];
  location: string | null;
  profileUrl: string;
}
