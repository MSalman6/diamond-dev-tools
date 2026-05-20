-- Alter posdao_epoch_node to include reward-related columns
ALTER TABLE posdao_epoch_node
    ADD COLUMN IF NOT EXISTS total_pool_reward       NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS validator_fixed_reward  NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS node_operator_reward    NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delegators_total_reward NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_staked_snapshot   NUMERIC NOT NULL DEFAULT 0;

-- Index for per-delegator reward queries.
CREATE INDEX IF NOT EXISTS idx_delegate_reward_delegator
    ON delegate_reward (id_delegator);
