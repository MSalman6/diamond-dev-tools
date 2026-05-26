import { QueryTypes } from 'sequelize';
import { posdao_epoch_node } from '../models/init-models';

// GET /staker/:address/rewards
//
// Returns all delegate_reward rows for a delegator, joined with epoch timing.
// Supports filtering by epoch range or unix timestamp range, with pagination.
const listDelegatorRewards = async (req: any, res: any) => {
    const { address } = req.params;
    const {
        from_epoch,
        to_epoch,
        from_time,
        to_time,
        limit = '200',
        offset = '0',
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 200, 1000);
    const offsetNum = parseInt(offset as string) || 0;

    try {
        const conditions: string[] = [
            `'0x' || encode(dr.id_delegator, 'hex') = lower($1)`
        ];
        const bind: any[] = [address];
        let paramIdx = 2;

        if (from_epoch) {
            conditions.push(`pe.id >= $${paramIdx++}`);
            bind.push(parseInt(from_epoch as string));
        }
        if (to_epoch) {
            conditions.push(`pe.id <= $${paramIdx++}`);
            bind.push(parseInt(to_epoch as string));
        }
        if (from_time) {
            conditions.push(`h.block_time >= $${paramIdx++}`);
            bind.push(parseInt(from_time as string));
        }
        if (to_time) {
            conditions.push(`h.block_time <= $${paramIdx++}`);
            bind.push(parseInt(to_time as string));
        }

        const where = conditions.join(' AND ');

        const countResult: any[] = await posdao_epoch_node.sequelize!.query(
            `SELECT COUNT(*) as total
             FROM delegate_reward dr
             JOIN posdao_epoch pe ON pe.id = dr.id_posdao_epoch
             LEFT JOIN headers h  ON h.block_number = pe.block_end
             WHERE ${where}`,
            { bind, type: QueryTypes.SELECT }
        );
        const total = parseInt(countResult[0].total);

        const rows: any[] = await posdao_epoch_node.sequelize!.query(
            `SELECT
                '0x' || encode(dr.id_node, 'hex') AS pool_address,
                dr.id_posdao_epoch                 AS epoch,
                dr.reward_amount,
                dr.is_claimed,
                pe.block_start,
                pe.block_end,
                h.block_time                       AS epoch_end_time
             FROM delegate_reward dr
             JOIN posdao_epoch pe ON pe.id = dr.id_posdao_epoch
             LEFT JOIN headers h  ON h.block_number = pe.block_end
             WHERE ${where}
             ORDER BY pe.id DESC
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            { bind: [...bind, limitNum, offsetNum], type: QueryTypes.SELECT }
        );

        res.json({
            data: rows,
            count: total,
            limit: limitNum,
            offset: offsetNum,
        });
    } catch (error) {
        console.error('Error fetching delegator rewards:', error);
        res.status(500).json({ error: 'Failed to fetch delegator rewards' });
    }
};

// GET /node/:address/epoch-rewards
//
// Returns the per-epoch reward breakdown for a validator — owner_reward, pool totals,
// fixed vs delegator split, node operator fee, stake snapshot and epoch timing.
const listValidatorEpochRewards = async (req: any, res: any) => {
    const { address } = req.params;
    const {
        from_epoch,
        to_epoch,
        limit = '200',
        offset = '0',
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 200, 1000);
    const offsetNum = parseInt(offset as string) || 0;

    try {
        const conditions: string[] = [
            `'0x' || encode(pen.id_node, 'hex') = lower($1)`
        ];
        const bind: any[] = [address];
        let paramIdx = 2;

        if (from_epoch) {
            conditions.push(`pe.id >= $${paramIdx++}`);
            bind.push(parseInt(from_epoch as string));
        }
        if (to_epoch) {
            conditions.push(`pe.id <= $${paramIdx++}`);
            bind.push(parseInt(to_epoch as string));
        }

        const where = conditions.join(' AND ');

        const countResult: any[] = await posdao_epoch_node.sequelize!.query(
            `SELECT COUNT(*) as total
             FROM posdao_epoch_node pen
             JOIN posdao_epoch pe ON pe.id = pen.id_posdao_epoch
             WHERE ${where}`,
            { bind, type: QueryTypes.SELECT }
        );
        const total = parseInt(countResult[0].total);

        const rows: any[] = await posdao_epoch_node.sequelize!.query(
            `SELECT
                pen.id_posdao_epoch          AS epoch,
                pen.owner_reward,
                pen.validator_fixed_reward,
                pen.node_operator_reward,
                pen.delegators_total_reward,
                pen.total_pool_reward,
                pen.total_staked_snapshot,
                pen.epoch_apy,
                pen.is_claimed,
                pe.block_start,
                pe.block_end,
                h.block_time                 AS epoch_end_time
             FROM posdao_epoch_node pen
             JOIN posdao_epoch pe   ON pe.id = pen.id_posdao_epoch
             LEFT JOIN headers h    ON h.block_number = pe.block_end
             WHERE ${where}
             ORDER BY pe.id DESC
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            { bind: [...bind, limitNum, offsetNum], type: QueryTypes.SELECT }
        );

        res.json({
            data: rows,
            count: total,
            limit: limitNum,
            offset: offsetNum,
        });
    } catch (error) {
        console.error('Error fetching validator epoch rewards:', error);
        res.status(500).json({ error: 'Failed to fetch validator epoch rewards' });
    }
};

// GET /node/:address/reward-stats
//
// 30-day aggregated metrics for a validator: VOS30, RpT30, AEP30, EstimatedAPY.
// Runs two queries — one for the validator's active-epoch aggregates, one for the
// total epoch count in the window (used as the AEP30 denominator).
const getValidatorRewardStats = async (req: any, res: any) => {
    const { address } = req.params;
    const windowStart = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    try {
        const activeRows: any[] = await posdao_epoch_node.sequelize!.query(
            `SELECT
                SUM(pen.validator_fixed_reward - pen.node_operator_reward) AS vos30,
                SUM(pen.delegators_total_reward)                           AS delegators_total_30d,
                AVG(pen.total_staked_snapshot)                             AS avg_total_stake_30d,
                COUNT(*)                                                   AS active_epoch_count
             FROM posdao_epoch_node pen
             JOIN posdao_epoch pe ON pe.id = pen.id_posdao_epoch
             JOIN headers h       ON h.block_number = pe.block_end
             WHERE '0x' || encode(pen.id_node, 'hex') = lower($1)
               AND h.block_time >= $2`,
            { bind: [address, windowStart], type: QueryTypes.SELECT }
        );

        const totalRows: any[] = await posdao_epoch_node.sequelize!.query(
            `SELECT COUNT(*) AS total_epochs
             FROM posdao_epoch pe
             JOIN headers h ON h.block_number = pe.block_end
             WHERE h.block_time >= $1`,
            { bind: [windowStart], type: QueryTypes.SELECT }
        );

        const r = activeRows[0];
        const totalEpochs = parseInt(totalRows[0].total_epochs) || 0;
        const activeEpochCount = parseInt(r.active_epoch_count) || 0;
        const delegatorsTotal30d = parseFloat(r.delegators_total_30d) || 0;
        const avgTotalStake30d = parseFloat(r.avg_total_stake_30d) || 0;
        const vos30 = parseFloat(r.vos30) || 0;

        const rpt30 = avgTotalStake30d > 0 ? (delegatorsTotal30d / avgTotalStake30d) * 1000 : 0;
        const aep30 = totalEpochs > 0 ? activeEpochCount / totalEpochs : 0;
        const estimatedAPY = (rpt30 / 1000) * 12 * 100;

        res.json({
            vos30,
            rpt30,
            aep30,
            estimated_apy: estimatedAPY,
            active_epoch_count: activeEpochCount,
            total_epochs_in_window: totalEpochs,
        });
    } catch (error) {
        console.error('Error fetching validator reward stats:', error);
        res.status(500).json({ error: 'Failed to fetch validator reward stats' });
    }
};

// GET /staker/:address/reward-stats
//
// 30-day totals for a delegator across all pools: sum of reward_amount and count
// of distinct pools that paid out at least once in the window.
const getDelegatorRewardStats = async (req: any, res: any) => {
    const { address } = req.params;
    const windowStart = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    try {
        const rows: any[] = await posdao_epoch_node.sequelize!.query(
            `SELECT
                SUM(dr.reward_amount)          AS total_rewards_30d,
                COUNT(DISTINCT dr.id_node)     AS active_pool_count
             FROM delegate_reward dr
             JOIN posdao_epoch pe ON pe.id = dr.id_posdao_epoch
             JOIN headers h       ON h.block_number = pe.block_end
             WHERE '0x' || encode(dr.id_delegator, 'hex') = lower($1)
               AND h.block_time >= $2`,
            { bind: [address, windowStart], type: QueryTypes.SELECT }
        );

        const r = rows[0];
        res.json({
            total_rewards_30d: parseFloat(r.total_rewards_30d) || 0,
            active_pool_count: parseInt(r.active_pool_count) || 0,
        });
    } catch (error) {
        console.error('Error fetching delegator reward stats:', error);
        res.status(500).json({ error: 'Failed to fetch delegator reward stats' });
    }
};

export default {
    listDelegatorRewards,
    listValidatorEpochRewards,
    getValidatorRewardStats,
    getDelegatorRewardStats,
};
