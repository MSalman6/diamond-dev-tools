import { ContractManager } from "../../contractManager";
import { NodeManager } from "../../net/nodeManager";
import { sleep } from "../../utils/time";
import Web3 from "web3";
import { createBlock } from "./testUtils";
import { Watchdog } from "../../watchdog";
import { stakeOnValidators } from "../../net/stakeOnValidators";
import { duration } from "moment";


async function runSmallTestNetwork() {


    const testname = "small-network";


    console.log(`Early epoch test network. designed to run on network ${testname}. create with 'npm run testnet-fresh-${testname}' .`);

    //NodeManager.setNetwork();nodes-test-small-network
    let nodesManager = NodeManager.get(`nodes-local-test-${testname}`);

    if (nodesManager.nodeStates.length != 5) {
        console.log(`ABORTING: expected 5 nodes to run this test`);
        return;
    }
    
    console.log(`starting rpc`);
    nodesManager.rpcNode?.start();
    
    console.log(`Starting up the network. Total nodes: ${nodesManager.nodeStates.length}`);

    for (let node of nodesManager.nodeStates) {
        node.start();
    }

    console.log(`all normal nodes started.`);
    console.log(`waiting for rpc`);

    await nodesManager.awaitRpcReady();

    let contractManager = ContractManager.get();
    let web3 = contractManager.web3;

    console.log("sender address: ", web3.eth.defaultAccount);

    let epochDuration = await contractManager.getEpochDurationFormatted();
    console.log(`Epoch duration: ${epochDuration}`);

    console.log(`initialize Watchdog`);
    let watchdog = new Watchdog(contractManager, nodesManager, false, false);

    watchdog.startWatching();

    const bonusScoreSystem = contractManager.getBonusScoreSystem();

    bonusScoreSystem.events.ValidatorScoreChanged((error, result) => {
        if (error) {
            console.log("ValidatorScoreChanged Error: ", error.name, error.message, error.stack);
        }

        if (result) {
            const v = result.returnValues;
            console.log(`ValidatorScoreChanged # ${result.blockNumber} pool ${result.address}, mining: ${v.miningAddress} factor: ${v.factor} new score: ${v.newScore} `);
        }
    });

    let start_block =  await web3.eth.getBlockNumber();
    console.log('current block:', start_block);

    if (start_block > 10) {
        console.log('ABORTING: expected a fresh chain to run this test');
        return;
    }

    let last_checked_block = start_block;
    let current_epoch = await contractManager.getEpoch("latest");
    let currentValidators = await contractManager.getValidators();
    let refreshBlock = async () => {
        last_checked_block = await web3.eth.getBlockNumber();
        const e = await contractManager.getEpoch("latest");
        if (e !== current_epoch) {
            // we only update the current validators on an epoch switch for performance reasons.
            currentValidators = await contractManager.getValidators();
        }
        current_epoch = e;
    };

    let createBlockAndRefresh = async() => {
        await createBlock(web3, last_checked_block);
        await refreshBlock();
    }

    await stakeOnValidators(4);

    console.log(`Epoch number at start: ${current_epoch} block:  ${last_checked_block}`);
    await createBlockAndRefresh();
    console.log("block creation confirmed.");
    console.log(`waiting for next epoch switch and upscaling to 4 validator nodes.`);

    const maxExpectedTestDuration = duration(3, 'minutes');

    
    const maxExpectedTestEndDate = Date.now() + maxExpectedTestDuration.asMilliseconds();
    let isSuccess = true;
    // let lastEpoch = current_epoch;
    while(currentValidators.length < 4) {
        await sleep(1000);
        await refreshBlock();
        if (Date.now() > maxExpectedTestEndDate) {
            console.log('ABORTING: test took too long. expected to finish in ', maxExpectedTestDuration.asMinutes(), ' minutes');
            isSuccess = false;
            break;
        }
    }

    if (isSuccess) {
        console.log('successfully running the network on 4 validators.');
    }

    await watchdog.stopWatching();
    nodesManager.stopAllNodes();
    nodesManager.stopRpcNode();

    process.exit(isSuccess ? 0 : 1);
}

runSmallTestNetwork();
