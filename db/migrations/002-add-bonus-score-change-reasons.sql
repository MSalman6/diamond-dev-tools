-- Migration: Add bonus_score_change_reasons table
-- Date: September 4, 2025
-- Purpose: Track reasons for bonus score changes while preserving existing data

-- Create the new table for bonus score change reasons
-- This is ADDITIVE ONLY - no existing tables are modified
CREATE TABLE IF NOT EXISTS bonus_score_change_reasons (
    id SERIAL PRIMARY KEY,
    
    -- Foreign key to existing node table (preserves relationship)
    node_pool_address BYTEA NOT NULL,
    
    -- Foreign key to existing headers table (preserves relationship) 
    block_number INTEGER NOT NULL,
    
    -- Epoch information
    epoch INTEGER NOT NULL,
    
    -- Score change details
    score_change INTEGER NOT NULL,
    previous_score INTEGER NOT NULL,
    new_score INTEGER NOT NULL,
    
    -- Reason tracking
    reason VARCHAR(50) NOT NULL,
    reason_data JSONB,
    
    -- Timestamp for record creation
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure one record per node per block
    UNIQUE(node_pool_address, block_number)
);

-- Add foreign key constraints to maintain data integrity
-- These reference existing tables without modifying them
ALTER TABLE bonus_score_change_reasons 
    ADD CONSTRAINT fk_bonus_score_change_node 
    FOREIGN KEY (node_pool_address) 
    REFERENCES node(pool_address) 
    ON DELETE CASCADE;

ALTER TABLE bonus_score_change_reasons 
    ADD CONSTRAINT fk_bonus_score_change_block 
    FOREIGN KEY (block_number) 
    REFERENCES headers(block_number) 
    ON DELETE CASCADE;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_bonus_score_change_node 
    ON bonus_score_change_reasons(node_pool_address);

CREATE INDEX IF NOT EXISTS idx_bonus_score_change_block 
    ON bonus_score_change_reasons(block_number);

CREATE INDEX IF NOT EXISTS idx_bonus_score_change_epoch 
    ON bonus_score_change_reasons(epoch);

CREATE INDEX IF NOT EXISTS idx_bonus_score_change_reason 
    ON bonus_score_change_reasons(reason);

CREATE INDEX IF NOT EXISTS idx_bonus_score_change_timestamp 
    ON bonus_score_change_reasons(created_at);

-- Add a compound index for common queries
CREATE INDEX IF NOT EXISTS idx_bonus_score_change_node_epoch 
    ON bonus_score_change_reasons(node_pool_address, epoch);

-- Verify the table was created successfully
SELECT 'bonus_score_change_reasons table created successfully' AS migration_status;
