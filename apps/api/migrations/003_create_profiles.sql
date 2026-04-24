-- Migration 003: Create profiles table and wire FK back to sessions
-- Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 7.8, 8.2

-- Profile visibility enum
CREATE TYPE profile_visibility AS ENUM (
    'private',
    'discoverable'
);

CREATE TABLE IF NOT EXISTS profiles (
    id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID                NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    user_id     UUID                NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    slug        TEXT                UNIQUE NOT NULL,  -- public URL token (UUID-based)
    cv_pdf_url  TEXT                NULL,
    video_url   TEXT                NULL,
    visibility  profile_visibility  NOT NULL DEFAULT 'private',
    expires_at  TIMESTAMP           NOT NULL,         -- created_at + 90 days
    deleted_at  TIMESTAMP           NULL              -- soft delete
);

-- Index for public slug lookups (GET /profiles/:slug)
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles (slug);

-- Index for user's profile list
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);

-- Index for Elasticsearch sync job (find discoverable / recently changed profiles)
CREATE INDEX IF NOT EXISTS idx_profiles_visibility ON profiles (visibility);

-- Index for expiry cleanup job
CREATE INDEX IF NOT EXISTS idx_profiles_expires_at ON profiles (expires_at)
    WHERE deleted_at IS NULL;

-- Now that profiles exists, add the FK from sessions.profile_id
ALTER TABLE sessions
    ADD CONSTRAINT fk_sessions_profile_id
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE SET NULL;
