import { param, query } from 'express-validator';
import express from 'express';
import Params from '../middleware/params';
import { authenticate } from '../middleware/authenticate';
import { rateLimiter } from '../middleware/rateLimiter';
import names from '../controllers/names';

const router = express.Router();

//
// GET /name/:label/history
//
// Username History: creator, creation timestamp, current owner, current status, full event
// timeline (created/activated/deactivated/ownership-transferred/renewed) and transfer history
// for a single .dmd name.
//
router.get(
    '/name/:label/history',
    [
        authenticate,
        rateLimiter,
        param('label').isString().trim().isLength({ min: 1, max: 255 }),
        Params.validate,
    ],
    names.getNameHistory
);

//
// GET /owner/:address/names
//
// Names owned by a wallet.
//
// Query params:
//   limit  – max rows to return (default 200, max 1000)
//   offset – pagination offset (default 0)
//
router.get(
    '/owner/:address/names',
    [
        authenticate,
        rateLimiter,
        param('address').isHexadecimal().isLength({ min: 42, max: 42 }),
        query('limit').optional().isInt({ min: 1, max: 1000 }),
        query('offset').optional().isInt({ min: 0 }),
        Params.validate,
    ],
    names.listOwnedNames
);

//
// GET /names/blacklisted
//
// Every currently-blocked name (moderation status).
//
// Query params:
//   limit  – max rows to return (default 50, max 500)
//   offset – pagination offset (default 0)
//
router.get(
    '/names/blacklisted',
    [
        authenticate,
        rateLimiter,
        query('limit').optional().isInt({ min: 1, max: 500 }),
        query('offset').optional().isInt({ min: 0 }),
        Params.validate,
    ],
    names.listBlacklistedNames
);

//
// GET /names
//
// Public directory of all registered names: searchable/paginated, with filters and sort.
//
// Query params:
//   search        – matches name (substring) or owner address (exact)
//   status        – active | inactive | expired | blocked
//   created_from  – unix seconds or ISO8601 date, inclusive lower bound on creation time
//   created_to    – unix seconds or ISO8601 date, inclusive upper bound on creation time
//   expires_from  – unix seconds or ISO8601 date, inclusive lower bound on expiration time
//   expires_to    – unix seconds or ISO8601 date, inclusive upper bound on expiration time
//   sort          – name | owner | created_at | expires_at (default created_at)
//   order         – asc | desc (default desc)
//   limit         – max rows to return (default 50, max 500)
//   offset        – pagination offset (default 0)
//
router.get(
    '/names',
    [
        authenticate,
        rateLimiter,
        query('search').optional().isString().trim().isLength({ max: 255 }),
        query('status').optional().isIn(['active', 'inactive', 'expired', 'blocked']),
        query('created_from').optional().isString(),
        query('created_to').optional().isString(),
        query('expires_from').optional().isString(),
        query('expires_to').optional().isString(),
        query('sort').optional().isIn(['name', 'owner', 'created_at', 'expires_at']),
        query('order').optional().isIn(['asc', 'desc']),
        query('limit').optional().isInt({ min: 1, max: 500 }),
        query('offset').optional().isInt({ min: 0 }),
        Params.validate,
    ],
    names.listNames
);

export default router;
