-- Migration 002: Create sessions table
-- Requirements: 8.1, 8.2, 8.3

-- Pipeline status enum
CREATE TYPE session_status AS ENUM (
    'pending',
    'transcribing',
    'cleaning',
    'extracting',
    'building',
    'processing',
    'complete',
    'error'
);

CREATE TABLE IF NOT EXISTS sessions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status          session_status  NOT NULL DEFAULT 'pending',
    raw_video_url   TEXT            NULL,
    clean_video_url TEXT            NULL,
    transcript      JSONB           NULL,  -- array of {word, start_ms, end_ms}
    cv_data         JSONB           NULL,
    profile_id      UUID            NULL,  -- FK added after profiles table exists (see 003)
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- Index for listing a user's sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

-- Index for pipeline workers querying by status
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);
