import { ContractManager } from "../../contractManager";
import { NodeManager } from "../../net/nodeManager";
import { sleep } from "../../utils/time";
import Web3 from "web3";
import { createBlock } from "./testUtils";
import { Watchdog } from "../../watchdog";
import { stakeOnValidators } from "../../net/stakeOnValidators";


async function runEarlyEpochTestNetwork() {

    console.log(`Early epoch test network. designed to run on network nodes-local-test-early-epoch-end. create with 'npm run testnet-fresh-test-early-epoch-end'.`);

    //NodeManager.setNetwork();
    let nodesManager = NodeManager.get("nodes-local-test-early-epoch-end");

    if (nodesManager.nodeStates.length != 17) {
        console.log(`ABORTING: expected 17 nodes to run this test`);
        return;
    }   
    
    console.log(`starting rpc`);
    nodesManager.rpcNode?.start();
    
    console.log(`Starting up the network. Total nodes: ${nodesManager.nodeStates.length}`);

    for (let node of nodesManager.nodeStates) {
        node.start();
    }

    console.log(`all normal nodes started.`);

    // todo: check if rpc is ready.

    await nodesManager.awaitRpcReady();
   // await sleep(10000);

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

    await stakeOnValidators(16);

    console.log(`Epoch number at start: ${current_epoch} block:  ${last_checked_block}`);
    await createBlockAndRefresh();
    console.log("block creation confirmed.");
    console.log(`waiting for next epoch switch and upscaling to 16 validator nodes.`);

    // let lastEpoch = current_epoch;
    while(currentValidators.length < 16) {
        await sleep(1000);
        await refreshBlock();
    }

    console.log(`epoch switch did happen.`);

    console.log(`current Validators count: ${currentValidators.length}`);
    console.log(currentValidators);

    let stopNode = async (n: number) => { 
        console.log(`stopping node ${n}`);
        await nodesManager.getNode(n).stop();
        console.log(`node ${n} stopped`);
    };


    let startNode = async (n: number) => { 
        console.log(`starting node ${n}`);
        await nodesManager.getNode(n).start();
        console.log(`node ${n} started`);
    };

    // on an F = 5, N = 16 network, we can tolerate 3 nodes failing.

    let epochAtStart = current_epoch;

    await stopNode(1);
    
    console.log('node 1 stopped, creating block should work, because of fault tolerance.');

    await stopNode(2);
    await createBlockAndRefresh();
    console.log('node 2 stopped, creating block should work, because of fault tolerance.');

    await stopNode(3);
    await createBlockAndRefresh();
    console.log('node 3 stopped, creating block should work, because of fault tolerance.');

    await stopNode(4);
    await createBlockAndRefresh();
    console.log('node 4 stopped, creating block should work, because of fault tolerance. but above early epoch end tolerance');

    let maxTriesForEpochSwitch = 5000;

    // await stopNode(5);
    // await createBlockAndRefresh();
    // console.log('node 5 stopped, creating block should work, because of fault tolerance. but above early epoch end tolerance');


    console.log('waiting for epoch switch to happen.');


    for (let trial = 0; trial < maxTriesForEpochSwitch; trial++) {

        await sleep(1000);
        await refreshBlock();

        // todo: check if the early epoch end switch really did happen,
        // or just enough time passed, so a regular epoch switch did happen.

        if (current_epoch > epochAtStart) {

            console.log("SUCCESS: Epoch switch did happen.");
            console.log("Count of validators:", await (await contractManager.getValidators()).length);
            nodesManager.stopAllNodes();
            nodesManager.stopRpcNode();
            return;
        }
    }

    console.log(`FAILURE: Epoch switch did not happen within the expected time of seconds: `, maxTriesForEpochSwitch);
    
    await watchdog.stopWatching();
    nodesManager.stopAllNodes();
    nodesManager.stopRpcNode();

}

runEarlyEpochTestNetwork();
