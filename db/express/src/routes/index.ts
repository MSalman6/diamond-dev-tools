import express from 'express'
import node from "./node";
import supply from "./supply";
import stakeTransactions from "./stakeTransactions";
import rewards from "./rewards";

const router = express.Router()

router.use(node);
router.use(supply);
router.use(stakeTransactions);
router.use(rewards);

export default router
