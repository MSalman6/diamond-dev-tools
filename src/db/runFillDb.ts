import { Node } from "./schema";
import { DbManager } from "./database-persistent";

import { ContractManager, DelegateRewardData } from "../contractManager";
import { EventProcessor } from "../eventProcessor";
import { EventVisitor } from "../eventsVisitor";
import { truncate0x } from "../utils/hex";
import { sleep } from "../utils/time";
import { ValidatorObserver } from "./validatorObserver";
import { bufferToAddress, parseEther } from "../utils/ether";
import { BonusScoreProcessor } from "./bonusScoreProcessor";


async function run() {


    const logDebug = (process.env.DEV_TOOLS_LOG_DEBUG)?.toLocaleLowerCase() === `true`;

    const log = logDebug ?
        (s: any, ...args: any[]) => {
            console.log(s, ...args);
        } :
        (s: any) => {
        };


    // we start from head of the chain to the tail.
    // we process each block.

    let contractManager = ContractManager.get();
    let web3 = contractManager.web3;
    let dbManager = new DbManager();

    // autostop defines a block number after which the process will stop.
    // this is usefull during the development process,
    // so you need only to sync to the first occurence of a situation you are developing on.
    let autostop = Number.MAX_VALUE;

    const fillStartBlock = process.env.DB_FILL_START_BLOCK
        ? parseInt(process.env.DB_FILL_START_BLOCK, 10)
        : undefined;
    const fillStopBlock = process.env.DB_FILL_STOP_BLOCK
        ? parseInt(process.env.DB_FILL_STOP_BLOCK, 10)
        : undefined;
    if (fillStopBlock !== undefined) {
        autostop = fillStopBlock + 1;
    }

    // this sync process is not designed to continue after a stop,
    // so we delete all data from the known tables to always make a fresh sync.
    // await dbManager.deleteCurrentData();

    let validatorObserver = await ValidatorObserver.build(contractManager, dbManager);

    let eventVisitor = new EventVisitor(dbManager);
    let eventProcessor = new EventProcessor(contractManager, eventVisitor);

    let bonusScoreProcessor = new BonusScoreProcessor(contractManager, dbManager);

    // let currentBlock = await dbManager.getLastProcessedBlock();
    // console.log(`currentBlock: ${currentBlock}`);

    let latest_known_block = await web3.eth.getBlockNumber();
    if (fillStopBlock !== undefined) {
        latest_known_block = Math.min(latest_known_block, fillStopBlock);
    }
    //let latest_known_block = 910;

    let lastProcessedEpochRow = await dbManager.getLastProcessedEpoch();

    let lastInsertedPosdaoEpoch = lastProcessedEpochRow ? lastProcessedEpochRow.id : - 1;

    let knownNodes: { [name: string]: Node } = {};
    let knownNodesByMining: { [name: string]: Node } = {};
    let knownNodesStakingByMining: { [name: string]: string } = {};
    let allPools: string[] = [];
    let allValidators: string[] = [];

    let nodesFromDB = await dbManager.getNodes();


    for (let nodeFromDB of nodesFromDB) {
        //nodeFromDB.pool_address
        let ethAddress = bufferToAddress(nodeFromDB.pool_address);
        knownNodes[ethAddress.toLowerCase()] = nodeFromDB;

        let miningAddress = bufferToAddress(nodeFromDB.mining_address);
        knownNodesByMining[miningAddress.toLowerCase()] = nodeFromDB;
        knownNodesStakingByMining[miningAddress.toLowerCase()] = ethAddress;
    }

    let lastProcessedBlock = await dbManager.getLastProcessedBlock();
    let currentBlockNumber = lastProcessedBlock ? lastProcessedBlock.block_number + 1 : 0;

    const insertHeaderForBlock = async (blockNum: number, beforeTimestamp: number): Promise<number> => {
        const blockHeader = await web3.eth.getBlock(blockNum);
        const { timeStamp, duration, transaction_count, txs_per_sec, posdaoEpoch } =
            await contractManager.getBlockInfos(blockHeader, beforeTimestamp);
        const delta = parseEther(await contractManager.getRewardDeltaPot(blockHeader.number));
        const reinsert = parseEther(await contractManager.getRewardReinsertPot(blockHeader.number));
        const rewardContractTotal = parseEther(await contractManager.getRewardContractTotal(blockHeader.number));
        const governanceBalance = parseEther(await contractManager.getGovernancePot(blockHeader.number));
        const claimingPotContractAddress = await contractManager.getClaimingPotAddress();
        const unclaimed = parseEther(await web3.eth.getBalance(claimingPotContractAddress));
        await dbManager.insertHeader(
            blockHeader.number,
            truncate0x(blockHeader.hash),
            duration,
            new Date(timeStamp * 1000),
            truncate0x(blockHeader.extraData),
            transaction_count,
            posdaoEpoch,
            txs_per_sec,
            reinsert.toString(),
            delta.toString(),
            governanceBalance.toString(),
            rewardContractTotal.toString(),
            unclaimed.toString()
        );
        return timeStamp;
    };

    let insertNode = async (poolAddress: string, blockNumber: number) => {

        let miningAddress = await contractManager.getAddressMiningByStaking(poolAddress, blockNumber);
        let publicKey = await contractManager.getPublicKey(poolAddress, blockNumber);

        const bonusScore = await contractManager.getBonusScore(miningAddress, blockNumber);
        let newNode = await dbManager.insertNode(poolAddress, miningAddress, publicKey, blockNumber, bonusScore);

        await bonusScoreProcessor.registerNewNode(poolAddress, miningAddress, blockNumber);

        knownNodes[poolAddress.toLowerCase()] = newNode;
        knownNodesByMining[miningAddress.toLowerCase()] = newNode;
        knownNodesStakingByMining[miningAddress.toLowerCase()] = poolAddress;
        allPools.push(poolAddress);
        allValidators.push(miningAddress);
    };

    const bootstrapAtBlock = async (startBlock: number) => {
        console.log(`Bootstrapping chain state at block ${startBlock}...`);
        const epoch = await contractManager.getEpoch(startBlock);
        const epochStartBlock = await contractManager.getEpochStartBlock(startBlock);

        if (startBlock > 0) {
            const prior = await web3.eth.getBlock(startBlock - 1);
            const priorBeforeTs = startBlock > 1
                ? Number((await web3.eth.getBlock(startBlock - 2)).timestamp)
                : Number(prior.timestamp);
            await insertHeaderForBlock(startBlock - 1, priorBeforeTs);
            const startBeforeTs = Number(prior.timestamp);
            await insertHeaderForBlock(startBlock, startBeforeTs);
        }

        // posdao_epoch.block_start has FK to headers — seed the epoch start block if we began mid-epoch
        if (epochStartBlock !== startBlock - 1 && epochStartBlock > 0) {
            const beforeEpochStart = epochStartBlock > 1
                ? Number((await web3.eth.getBlock(epochStartBlock - 2)).timestamp)
                : Number((await web3.eth.getBlock(0)).timestamp);
            await insertHeaderForBlock(epochStartBlock, beforeEpochStart);
        }

        const existingEpoch = await dbManager.getLastProcessedEpoch();
        if (!existingEpoch) {
            await dbManager.insertStakingEpoch(epoch, epochStartBlock);
        }
        lastInsertedPosdaoEpoch = epoch;

        const pools = await contractManager.getAllPools(startBlock);
        for (const pool of pools) {
            if (!knownNodes[pool.toLowerCase()]) {
                await insertNode(pool, startBlock);
            }
        }

        const validators = await contractManager.getValidators(startBlock);
        for (const validator of validators) {
            const node = knownNodesByMining[validator.toLowerCase()];
            if (!node) {
                continue;
            }
            const poolAddress = bufferToAddress(node.pool_address);
            await dbManager.insertEpochNode(epoch, poolAddress);
        }

        await bonusScoreProcessor.init(startBlock);
        console.log(`Bootstrap done: epoch=${epoch}, pools=${pools.length}, validators=${validators.length}`);
    };

    if (fillStartBlock !== undefined) {
        const needsBootstrap =
            !lastProcessedBlock ||
            lastProcessedBlock.block_number < fillStartBlock - 1 ||
            !lastProcessedEpochRow ||
            nodesFromDB.length === 0;
        if (needsBootstrap) {
            await bootstrapAtBlock(fillStartBlock);
            lastProcessedBlock = await dbManager.getLastProcessedBlock();
            lastProcessedEpochRow = await dbManager.getLastProcessedEpoch();
            lastInsertedPosdaoEpoch = lastProcessedEpochRow ? lastProcessedEpochRow.id : -1;
            nodesFromDB = await dbManager.getNodes();
            knownNodes = {};
            knownNodesByMining = {};
            knownNodesStakingByMining = {};
            for (let nodeFromDB of nodesFromDB) {
                let ethAddress = bufferToAddress(nodeFromDB.pool_address);
                knownNodes[ethAddress.toLowerCase()] = nodeFromDB;
                let miningAddress = bufferToAddress(nodeFromDB.mining_address);
                knownNodesByMining[miningAddress.toLowerCase()] = nodeFromDB;
                knownNodesStakingByMining[miningAddress.toLowerCase()] = ethAddress;
            }
        }
        currentBlockNumber = fillStartBlock;
    }

    //if currentBlockNumber < latest_known_block

    await bonusScoreProcessor.init(currentBlockNumber);

    let blockBeforeTimestamp = lastProcessedBlock
        ? Math.floor(lastProcessedBlock.block_time.getTime() / 1000)
        : 0;

    console.log(`importing blocks from ${currentBlockNumber} to ${latest_known_block}`);

    while (currentBlockNumber <= latest_known_block) {

        if (currentBlockNumber >= autostop) {
            console.log("autostop treshold reached.");
            return;
        }
        console.log(`\n📦 Processing block ${currentBlockNumber}`);

        try {
            const epochAtBlockStart = lastInsertedPosdaoEpoch;
            let posdaoEpochAfterBlock = epochAtBlockStart;
            let blockTimestampAfter = blockBeforeTimestamp;

            // All operations for this block are wrapped in a transaction
            // If any operation fails, the entire block processing is rolled back, preventing
            // partial data in the database.
            await dbManager.executeInTransaction(currentBlockNumber, async (tx) => {

                let blockHeader = await web3.eth.getBlock(currentBlockNumber);
                const { timeStamp, duration, transaction_count, txs_per_sec, posdaoEpoch } = await contractManager.getBlockInfos(blockHeader, blockBeforeTimestamp);
                posdaoEpochAfterBlock = posdaoEpoch;
                blockTimestampAfter = timeStamp;
                //console.log(`"${blockHeader.number}","${blockHeader.hash}","${blockHeader.extraData}","${blockHeader.timestamp}","${new Date(timeStamp * 1000).toISOString()}","${duration}","${num_of_validators}","${transaction_count}","${txs_per_sec.toFixed(4)}"`);
                // console.log( `${blockHeader.number} ${blockHeader.hash} ${blockHeader.extraData} ${blockHeader.timestamp} ${new Date(thisTimeStamp * 1000).toUTCString()} ${lastTimeStamp - thisTimeStamp}`);
                let delta = parseEther(await contractManager.getRewardDeltaPot(blockHeader.number));
                let reinsert = parseEther(await contractManager.getRewardReinsertPot(blockHeader.number));
                let rewardContractTotal = parseEther(await contractManager.getRewardContractTotal(blockHeader.number));
                let governanceBalance = parseEther(await contractManager.getGovernancePot(blockHeader.number));
                let claimingPotContractAddress = await contractManager.getClaimingPotAddress();

                let unclaimed = parseEther(await web3.eth.getBalance(claimingPotContractAddress));

                //lastTimeStamp = thisTimeStamp;
                //blockHeader = blockBefore;

                // Insert header record (parent table for foreign key relationships)
                await dbManager.insertHeader(
                    blockHeader.number,
                    truncate0x(blockHeader.hash),
                    duration,
                    new Date(timeStamp * 1000),
                    truncate0x(blockHeader.extraData),
                    transaction_count,
                    posdaoEpoch,
                    txs_per_sec,
                    reinsert.toString(),
                    delta.toString(),
                    governanceBalance.toString(),
                    rewardContractTotal.toString(),
                    unclaimed.toString()
                );

                // Process initial pools for block 0
                if (currentBlockNumber == 0) {

                    const allPoolsCurrently: string[] = await contractManager.getAllPools(blockHeader.number);
                    for (const pool of allPoolsCurrently) {
                        console.log("pool", pool);
                        if (!Object.keys(knownNodes).includes(pool.toLowerCase())) {
                            await insertNode(pool, currentBlockNumber);
                        }
                    }
                }

                // Fetch and process events
                await eventProcessor.fetchBlockEvents(currentBlockNumber);

                const poolsSet = eventProcessor.getPoolsSet();

                // Insert new nodes discovered from events
                for (const pool of poolsSet) {

                    if (Object.keys(knownNodes).includes(pool.toLowerCase())) {
                        continue;
                    }

                    await insertNode(pool, currentBlockNumber);
                }

                const delegatorsSet = eventProcessor.getDelegatorsSet();

                // Insert delegate stakers
                await dbManager.insertDelegateStaker(Array.from(delegatorsSet));

                // Handle epoch transitions
                // insert the posdao information
                if (posdaoEpoch > epochAtBlockStart) {
                    // we insert the posdao information for the epoch.
                    //let posdaoEpoch = await contractManager.getPosdaoEpoch(posdaoEpoch);
                    if (epochAtBlockStart >= 0) {
                        await dbManager.endStakingEpoch(epochAtBlockStart, blockHeader.number - 1);

                        const epochSnapshotBlock = blockHeader.number - 1;
                        // epochPoolNativeReward is written on the first block of the new epoch, not the last block of the old one
                        const epochRewardBlock = blockHeader.number;

                        let delegatedRewards = new Array<DelegateRewardData>();

                        // RestakeReward is never emitted
                        const epochPools = await contractManager.getAllPools(epochSnapshotBlock);
                        const validatorMinPct = await contractManager.getValidatorMinRewardPercent(
                            epochAtBlockStart,
                            epochRewardBlock
                        );

                        console.log(`Processing delegator rewards for epoch ${epochAtBlockStart} via epochPoolNativeReward (${epochPools.length} pools, validatorMinPct=${validatorMinPct}%)`);

                        for (const pool of epochPools) {
                            const miningAddress = await contractManager.getAddressMiningByStaking(pool, epochSnapshotBlock);

                            const totalPoolReward = await contractManager.getEpochPoolNativeReward(
                                epochAtBlockStart,
                                miningAddress,
                                epochRewardBlock
                            );

                            if (totalPoolReward.isZero()) {
                                continue;
                            }

                            const validatorReward = totalPoolReward.times(validatorMinPct).div(100);
                            const delegatorsReward = totalPoolReward.minus(validatorReward);

                            const { apy, rewards, totalPoolReward: tpr, validatorFixed, nodeOperatorReward, delegatorsTotal, totalStake }
                                = await contractManager.getDelegateRewards(
                                    pool,
                                    miningAddress,
                                    epochAtBlockStart,
                                    epochSnapshotBlock,
                                    validatorReward,
                                    delegatorsReward
                                );

                            delegatedRewards.push(...rewards);

                            await dbManager.updateValidatorReward(
                                pool,
                                epochAtBlockStart,
                                validatorReward,
                                apy,
                                tpr,
                                validatorFixed,
                                nodeOperatorReward,
                                delegatorsTotal,
                                totalStake
                            );
                        }

                        if (delegatedRewards.length > 0) {
                            const delegatorAddresses = [...new Set(delegatedRewards.map(r => r.delegatorAddress))];
                            await dbManager.insertDelegateStaker(delegatorAddresses);
                            await dbManager.insertDelegateRewardsBulk(delegatedRewards);
                        }
                    }

                    await dbManager.insertStakingEpoch(posdaoEpoch, blockHeader.number);

                    // get the validator infos.
                    let validators = await contractManager.getValidators(currentBlockNumber);

                    for (let validator of validators) {
                        let node = knownNodesByMining[validator.toLowerCase()];
                        if (!node) {
                            const pool = await contractManager.getAddressStakingByMining(validator, currentBlockNumber);
                            if (!knownNodes[pool.toLowerCase()]) {
                                await insertNode(pool, currentBlockNumber);
                            }
                            node = knownNodesByMining[validator.toLowerCase()];
                        }
                        if (!node) {
                            continue;
                        }
                        let poolAddress = bufferToAddress(node.pool_address);
                        await dbManager.insertEpochNode(posdaoEpoch, poolAddress);
                    }
                }

                // fill db with events
                await eventProcessor.processEvents();

                // Update validator states
                await validatorObserver.updateValidators(currentBlockNumber, posdaoEpoch);

                // Process bonus scores
                // Get pools for current block only
                const currentAllPools = await contractManager.getAllPools(currentBlockNumber);
                await bonusScoreProcessor.processBonusScore(currentBlockNumber, currentAllPools);
            });

            blockBeforeTimestamp = blockTimestampAfter;
            if (posdaoEpochAfterBlock > lastInsertedPosdaoEpoch) {
                lastInsertedPosdaoEpoch = posdaoEpochAfterBlock;
            }

            // if there is still no change, sleep 1s
            while (currentBlockNumber == latest_known_block) {

                // do something to make further processing possible.
                latest_known_block = await web3.eth.getBlockNumber();

                if (latest_known_block > currentBlockNumber) {
                    await eventProcessor.fetchBlockEvents(currentBlockNumber);
                } else {
                    await sleep(1000);
                }
            }

            currentBlockNumber += 1;


        } catch (err: any) {
            const errorMessage = err?.message || String(err);
            const isConnectionError =
                errorMessage.includes('Connection terminated unexpectedly') ||
                errorMessage.includes('password authentication failed') ||
                errorMessage.includes('connect ECONNREFUSED') ||
                errorMessage.includes('Client has encountered a connection error');

            console.log(`error processing block ${currentBlockNumber}`);
            console.error(err);

            if (isConnectionError) {
                console.error('❌ Database connection error detected');
                console.log('⏳ Waiting 10 seconds before continuing to next block...');
                await sleep(10000);
            } else {
                console.log('⏳ Non-connection error - waiting 5 seconds before retrying...');
                await sleep(5000);
            }
        }
    }

    // we managed to read the last block.
    // press q to quit.
    // this way it can be ran as a server that keeps importing new blocks.


}

run().catch((err) => {
    console.log("error!!:");
    console.log(err);
    process.exit(1);
});
