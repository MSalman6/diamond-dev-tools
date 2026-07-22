-- Create API keys table for authentication and rate limiting
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key_hash VARCHAR(128) NOT NULL UNIQUE,
    label VARCHAR(255) NOT NULL,
    key_type VARCHAR(20) NOT NULL CHECK (key_type IN ('internal', 'external')),
    allowed_origins TEXT, -- JSON array of allowed origins for internal keys
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    CONSTRAINT valid_rate_limits CHECK (
        rate_limit_per_minute > 0 AND rate_limit_per_day > 0
    )
);

-- Create index for faster key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_enabled ON api_keys(enabled);
CREATE INDEX IF NOT EXISTS idx_api_keys_type ON api_keys(key_type);

-- Add comment for documentation
COMMENT ON TABLE api_keys IS 'Stores API keys for authentication and rate limiting. Keys are hashed for security.';
COMMENT ON COLUMN api_keys.key_type IS 'Type of key: internal (for UI with origin whitelist) or external (for third-party users)';
COMMENT ON COLUMN api_keys.allowed_origins IS 'JSON array of allowed origins for internal keys (e.g., ["https://example.com"])';
COMMENT ON COLUMN api_keys.rate_limit_per_minute IS 'Maximum requests per minute for this key';
COMMENT ON COLUMN api_keys.rate_limit_per_day IS 'Maximum requests per day for this key';
