-- Migration 001: Create users table
-- Requirements: 8.1, 8.2, 9.3, 9.5

CREATE TABLE IF NOT EXISTS users (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email                   TEXT        UNIQUE NOT NULL,
    password                TEXT        NOT NULL,  -- bcrypt hash
    consent_at              TIMESTAMP   NOT NULL,  -- when the user accepted the privacy policy
    privacy_policy_version  TEXT        NOT NULL,  -- version of the policy accepted (e.g. "1.0")
    created_at              TIMESTAMP   NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMP   NULL       -- soft delete; hard purge after 24h
);

-- Index for email lookups (login, uniqueness checks)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Index for finding soft-deleted users pending hard purge
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at)
    WHERE deleted_at IS NOT NULL;
