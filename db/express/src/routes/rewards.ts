import { param, query } from 'express-validator';
import express from 'express';
import Params from '../middleware/params';
import { authenticate } from '../middleware/authenticate';
import { rateLimiter } from '../middleware/rateLimiter';
import rewards from '../controllers/rewards';

const router = express.Router();

//
// GET /staker/:address/rewards
//
// All delegate_reward rows for this delegator
//
// Query params:
//   from_epoch  – inclusive lower epoch bound
//   to_epoch    – inclusive upper epoch bound
//   from_time   – inclusive lower epoch_end_time bound (unix seconds)
//   to_time     – inclusive upper epoch_end_time bound (unix seconds)
//   limit       – max rows to return (default 200, max 1000)
//   offset      – pagination offset (default 0)
//
router.get(
    '/staker/:address/rewards',
    [
        authenticate,
        rateLimiter,
        param('address').isHexadecimal().isLength({ min: 42, max: 42 }),
        query('from_epoch').optional().isInt({ min: 0 }),
        query('to_epoch').optional().isInt({ min: 0 }),
        query('from_time').optional().isInt({ min: 0 }),
        query('to_time').optional().isInt({ min: 0 }),
        query('limit').optional().isInt({ min: 1, max: 1000 }),
        query('offset').optional().isInt({ min: 0 }),
        Params.validate,
    ],
    rewards.listDelegatorRewards
);

//
// GET /staker/:address/reward-stats
//
// Aggregated 30-day reward stats for a delegator:
//   total_rewards_30d, active_pool_count.
//
router.get(
    '/staker/:address/reward-stats',
    [
        authenticate,
        rateLimiter,
        param('address').isHexadecimal().isLength({ min: 42, max: 42 }),
        Params.validate,
    ],
    rewards.getDelegatorRewardStats
);

//
// GET /node/:address/epoch-rewards
//
// Per-epoch reward breakdown for a validator
//
// Query params:
//   from_epoch  – inclusive lower epoch bound
//   to_epoch    – inclusive upper epoch bound
//   limit       – max rows to return (default 200, max 1000)
//   offset      – pagination offset (default 0)
//
router.get(
    '/node/:address/epoch-rewards',
    [
        authenticate,
        rateLimiter,
        param('address').isHexadecimal().isLength({ min: 42, max: 42 }),
        query('from_epoch').optional().isInt({ min: 0 }),
        query('to_epoch').optional().isInt({ min: 0 }),
        query('limit').optional().isInt({ min: 1, max: 1000 }),
        query('offset').optional().isInt({ min: 0 }),
        Params.validate,
    ],
    rewards.listValidatorEpochRewards
);

//
// GET /node/:address/reward-stats
//
// Aggregated 30-day reward metrics for a validator:
//   VOS30, RpT30, AEP30, EstimatedAPY.
//
router.get(
    '/node/:address/reward-stats',
    [
        authenticate,
        rateLimiter,
        param('address').isHexadecimal().isLength({ min: 42, max: 42 }),
        Params.validate,
    ],
    rewards.getValidatorRewardStats
);

export default router;
