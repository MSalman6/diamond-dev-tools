import express from 'express';
import supply from '../controllers/supply';
import { publicRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

/**
 * Supply endpoints for CoinMarketCap compatibility
 * All endpoints return plain text (single numerical value)
 */
router.use(publicRateLimiter);

router.get('/supply/maxcoins', supply.getMaxCoins);
router.get('/supply/circulating', supply.getCirculating);
router.get('/supply/delta', supply.getDeltaPot);
router.get('/supply/reinsert', supply.getReinsertPot);
router.get('/supply/claiming', supply.getClaimingPot);
router.get('/supply/dao', supply.getDaoPot);
router.get('/supply/staking', supply.getStakingPot);
router.get('/supply/rewards', supply.getRewardsPot);

export default router;
