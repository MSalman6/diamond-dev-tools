import express from 'express'
import node from "./node";
import supply from "./supply";
import stakeTransactions from "./stakeTransactions";
import rewards from "./rewards";
import names from "./names";

const router = express.Router()

router.use(node);
router.use(supply);
router.use(stakeTransactions);
router.use(rewards);
router.use(names);

export default router
