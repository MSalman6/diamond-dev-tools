import { Node } from "./schema";
import { DbManager } from "./database";

import { ContractManager, DelegateRewardData } from "../contractManager";
import { EventProcessor } from "../eventProcessor";
import { EventVisitor } from "../eventsVisitor";
import { truncate0x } from "../utils/hex";
import { sleep } from "../utils/time";
import { ValidatorObserver } from "./validatorObserver";
import { bufferToAddress, parseEther } from "../utils/ether";
import { BonusScoreProcessor } from "./bonusScoreProcessor";


async function run() {

    // we start from head of the chain to the tail.
    // we process each block.

    let contractManager = ContractManager.get();
    let web3 = contractManager.web3;
    let dbManager = new DbManager();

    // autostop defines a block number after which the process will stop.
    // this is usefull during the development process,
    // so you need only to sync to the first occurence of a situation you are developing on.
    let autostop = Number.MAX_VALUE;

    // this sync process is not designed to continue after a stop,
    // so we delete all data from the known tables to always make a fresh sync.
    await dbManager.deleteCurrentData();

    let validatorObserver = await ValidatorObserver.build(contractManager, dbManager);

    let eventVisitor = new EventVisitor(dbManager);
    let eventProcessor = new EventProcessor(contractManager, eventVisitor);

    let bonusScoreProcessor = new BonusScoreProcessor(contractManager, dbManager);

    // let currentBlock = await dbManager.getLastProcessedBlock();
    // console.log(`currentBlock: ${currentBlock}`);

    let latest_known_block = await web3.eth.getBlockNumber();
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
    //if currentBlockNumber < latest_known_block

    await bonusScoreProcessor.init(currentBlockNumber);

    let blockBeforeTimestamp = lastProcessedBlock
        ? Math.floor(lastProcessedBlock.block_time.getTime() / 1000)
        : 0;

    console.log(`importing blocks from ${currentBlockNumber} to ${latest_known_block}`);

    let insertNode = async (poolAddress: string, blockNumber: number) => {

        let miningAddress = await contractManager.getAddressMiningByStaking(poolAddress, currentBlockNumber);
        //let poolAddress = (await contractManager.getAddressStakingByMining(miningAddress, blockNumber)).toLowerCase();
        let publicKey = await contractManager.getPublicKey(poolAddress, blockNumber);

        const bonusScore = await contractManager.getBonusScore(miningAddress, blockNumber);
        let newNode = await dbManager.insertNode(poolAddress, miningAddress, publicKey, blockNumber, bonusScore);

        await bonusScoreProcessor.registerNewNode(poolAddress, miningAddress, blockNumber);

        knownNodes[poolAddress.toLowerCase()] = newNode;
        knownNodesByMining[miningAddress.toLowerCase()] = newNode;
        knownNodesStakingByMining[miningAddress.toLowerCase()] = poolAddress;
        allPools.push(poolAddress);
        allValidators.push(miningAddress);
    }

    while (currentBlockNumber <= latest_known_block) {

        if (currentBlockNumber >= autostop) {
            console.log("autostop treshold reached.");
            return;
        }
        console.log(`processing block ${currentBlockNumber}`);

        try {

            let blockHeader = await web3.eth.getBlock(currentBlockNumber);
            const { timeStamp, duration, transaction_count, txs_per_sec, posdaoEpoch } = await contractManager.getBlockInfos(blockHeader, blockBeforeTimestamp);
            //console.log(`"${blockHeader.number}","${blockHeader.hash}","${blockHeader.extraData}","${blockHeader.timestamp}","${new Date(timeStamp * 1000).toISOString()}","${duration}","${num_of_validators}","${transaction_count}","${txs_per_sec.toFixed(4)}"`);
            // console.log( `${blockHeader.number} ${blockHeader.hash} ${blockHeader.extraData} ${blockHeader.timestamp} ${new Date(thisTimeStamp * 1000).toUTCString()} ${lastTimeStamp - thisTimeStamp}`);
            blockBeforeTimestamp = timeStamp;

            let delta = parseEther(await contractManager.getRewardDeltaPot(blockHeader.number));
            let reinsert = parseEther(await contractManager.getRewardReinsertPot(blockHeader.number));
            let rewardContractTotal = parseEther(await contractManager.getRewardContractTotal(blockHeader.number));
            let governanceBalance = parseEther(await contractManager.getGovernancePot(blockHeader.number));
            let claimingPotContractAddress = await contractManager.getClaimingPotAddress();

            let unclaimed = parseEther(await web3.eth.getBalance(claimingPotContractAddress));

            //lastTimeStamp = thisTimeStamp;
            //blockHeader = blockBefore;
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

            if (currentBlockNumber == 0) {

                const allPoolsCurrently: string[] = await contractManager.getAllPools(blockHeader.number);
                for (const pool of allPoolsCurrently) {
                    console.log("pool", pool);
                    if (!Object.keys(knownNodes).includes(pool.toLowerCase())) {
                        await insertNode(pool, currentBlockNumber);
                    }
                }
            }

            await eventProcessor.fetchBlockEvents(currentBlockNumber);

            const poolsSet = eventProcessor.getPoolsSet();

            for (const pool of poolsSet) {

                if (Object.keys(knownNodes).includes(pool.toLowerCase())) {
                    continue;
                }

                await insertNode(pool, currentBlockNumber);
            }

            const delegatorsSet = eventProcessor.getDelegatorsSet();
            await dbManager.insertDelegateStaker(Array.from(delegatorsSet));

            // insert the posdao information
            if (posdaoEpoch > lastInsertedPosdaoEpoch) {
                // we insert the posdao information for the epoch.
                //let posdaoEpoch = await contractManager.getPosdaoEpoch(posdaoEpoch);
                if (lastInsertedPosdaoEpoch >= 0) {
                    dbManager.endStakingEpoch(lastInsertedPosdaoEpoch, blockHeader.number - 1);

                    // get the validator infos.
                    let rewardedValidators = await contractManager.getValidators(blockHeader.number - 1);

                    let delegatedRewards = new Array<DelegateRewardData>();

                    console.log(`Processing delegators rewards on ${lastInsertedPosdaoEpoch} epoch`);

                    for (let rewardedValidator of rewardedValidators) {
                        let pool = knownNodesStakingByMining[rewardedValidator.toLowerCase()];

                        if (!pool) {
                            console.log(`Could not find pool for mining address ${rewardedValidator}`);
                            continue;
                        }

                        const { apy, rewards } = await contractManager.getDelegateRewards(
                            pool,
                            lastInsertedPosdaoEpoch,
                            blockHeader.number
                        );

                        delegatedRewards.push.apply(rewards);

                        let validatorReward = parseEther(await contractManager.getReward(
                            pool,
                            pool,
                            lastInsertedPosdaoEpoch,
                            blockHeader.number
                        ));

                        await dbManager.updateValidatorReward(pool, lastInsertedPosdaoEpoch, validatorReward, apy);
                    }

                    await dbManager.insertDelegateRewardsBulk(delegatedRewards);
                }

                await dbManager.insertStakingEpoch(posdaoEpoch, blockHeader.number);
                lastInsertedPosdaoEpoch = posdaoEpoch;

                // get the validator infos.
                let validators = await contractManager.getValidators(currentBlockNumber);

                for (let validator of validators) {
                    let poolAddressBin = knownNodesByMining[validator.toLowerCase()].pool_address;
                    let poolAddress = bufferToAddress(poolAddressBin);
                    await dbManager.insertEpochNode(posdaoEpoch, poolAddress);
                }
            }

            // fill db with events
            await eventProcessor.processEvents();
            await validatorObserver.updateValidators(currentBlockNumber, posdaoEpoch);

            // Get all current pools for bonus score processing
            const currentAllPools = await contractManager.getAllPools(currentBlockNumber);
            await bonusScoreProcessor.processBonusScore(currentBlockNumber, currentAllPools);

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


        } catch (err) {
            console.log(`error processing block ${currentBlockNumber}`);
            console.log(err);
            await sleep(1000);

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
