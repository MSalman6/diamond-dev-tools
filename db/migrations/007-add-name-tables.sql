-- Current-state directory for DMD Naming System (.dmd) names.
-- One row per name (keyed by its labelHash, which is also the DMDNames ERC-721 tokenId).
CREATE TABLE IF NOT EXISTS dmd_names (
    -- keccak256(lowercase label) - same value as the DMDNames token id.
    label_hash BYTEA PRIMARY KEY,

    -- Human-readable label (without the .dmd suffix), e.g. "alice".
    label VARCHAR(255),

    -- Current ERC-721 owner.
    owner BYTEA,

    -- Original minter (from == address(0) on the first Transfer). Set once, never overwritten.
    creator BYTEA,

    created_block INTEGER,
    created_timestamp INTEGER,

    -- Unix seconds; NULL until a NameRegistered/NameRenewed event has been seen.
    expiration NUMERIC,

    -- Whether this is currently the owner's activated/primary name.
    active BOOLEAN,

    -- Moderation flag set via the registrar's NameBlockedSet event.
    blocked BOOLEAN,

    -- Most recent event type/block affecting this name, for quick "last action" lookups.
    last_action_type VARCHAR(30),
    last_action_block INTEGER,
    last_action_timestamp INTEGER,

    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dmd_names_label_lower ON dmd_names (LOWER(label));
CREATE INDEX IF NOT EXISTS idx_dmd_names_owner ON dmd_names (owner);
CREATE INDEX IF NOT EXISTS idx_dmd_names_expiration ON dmd_names (expiration);
CREATE INDEX IF NOT EXISTS idx_dmd_names_created_timestamp ON dmd_names (created_timestamp);
CREATE INDEX IF NOT EXISTS idx_dmd_names_blocked ON dmd_names (blocked);
CREATE INDEX IF NOT EXISTS idx_dmd_names_active ON dmd_names (active);

-- Append-only event log behind the "Username History" timeline and transfer-history table.
CREATE TABLE IF NOT EXISTS dmd_name_events (
    id SERIAL PRIMARY KEY,

    label_hash BYTEA NOT NULL REFERENCES dmd_names(label_hash),
    label VARCHAR(255),

    -- Registered, Activated, Deactivated, Renewed, BlockedSet, Transfer
    event_type VARCHAR(30) NOT NULL,

    -- Primary actor for registrar-originated events (owner/caller); NULL for BlockedSet
    -- (moderator address isn't part of the on-chain event) and for Transfer (see from/to).
    actor_address BYTEA,

    -- Only set for Transfer events.
    from_address BYTEA,
    to_address BYTEA,

    -- Only set for Registered/Renewed events.
    expiration NUMERIC,

    -- Only set for BlockedSet events.
    blocked BOOLEAN,

    block_number INTEGER NOT NULL,
    block_timestamp INTEGER NOT NULL,
    tx_hash BYTEA,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dmd_name_events_label_hash ON dmd_name_events (label_hash, block_number, id);
CREATE INDEX IF NOT EXISTS idx_dmd_name_events_event_type ON dmd_name_events (event_type);
CREATE INDEX IF NOT EXISTS idx_dmd_name_events_block_number ON dmd_name_events (block_number, id);
CREATE INDEX IF NOT EXISTS idx_dmd_name_events_from_address ON dmd_name_events (from_address);
CREATE INDEX IF NOT EXISTS idx_dmd_name_events_to_address ON dmd_name_events (to_address);
CREATE INDEX IF NOT EXISTS idx_dmd_name_events_actor_address ON dmd_name_events (actor_address);

-- grant read access on the new tables to the diamond_api role
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'diamond_api') THEN
    GRANT SELECT ON dmd_names TO diamond_api;
    GRANT SELECT ON dmd_name_events TO diamond_api;
    GRANT USAGE, SELECT ON dmd_name_events_id_seq TO diamond_api;
  END IF;
END
$$;
