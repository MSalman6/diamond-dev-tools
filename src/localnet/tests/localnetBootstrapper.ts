import { whilst } from "async";
import { ContractManager } from "../../contractManager";
import { NodeManager } from "../../net/nodeManager";
import { sleep } from "../../utils/time";
import Web3 from "web3";
import { create } from "underscore";
import { createBlock } from "./testUtils";
import { stakeOnValidators } from "../../net/stakeOnValidators";
import { Watchdog } from "../../watchdog";
import { LogFileManager } from "../../logFileManager";
import { ConfigManager } from "../../configManager";



export interface LocalnetScriptRunnerResult {

    success: boolean, 

}


/// runs a programm on a localnet definition, spins up this localnet,
/// and executes the asynchronous function `runTestImplementation` with the web3 instance of the localnet. 
export abstract class LocalnetScriptRunnerBase {

    currentNodeManager: NodeManager;
    lastCheckedBlock: number = 0;
    web3: Web3 | undefined;

    constructor(public networkName: string, public networkOperation: string, public expectedValidators_: number | undefined = undefined) {

        this.currentNodeManager = NodeManager.get(networkName);
        
        //this.web3 = this.currentNodeManager.


    }


    /// runs a programm on a localnet definition, spins up this localnet,
    /// and executes the asynchronous function `runTestImplementation` with the web3 instance of the localnet.


    protected async stopNode(n: number) {
        console.log(`stopping node ${n}`);
        await this.currentNodeManager?.getNode(n).stop();
        console.log(`node ${n} stopped`);
    };


    protected async startNode(n: number) {
        console.log(`starting node ${n}`);
        await this.currentNodeManager?.getNode(n).start();
        console.log(`node ${n} started`);
    };


    protected async refreshBlock() {
        this.lastCheckedBlock = await this.web3.eth.getBlockNumber();
    };

    public async start(networkName: string, networkOperation: string, expectedValidators_: number | undefined = undefined) {

        let nodesManager = NodeManager.get(networkName);

        if (!nodesManager) {
            throw new Error(`Network ${networkName} not found. Please create it with 'npm run testnet-fresh-${networkName}'`);
        }

        //let expectedValidators = 4;
        let expectedValidators = expectedValidators_ || nodesManager.nodeStates.length; // default to 4 validators if not specified
        let expectedNodes = expectedValidators + 1; // + MoC
        if (nodesManager.nodeStates.length != expectedNodes) {
            console.log(`ABORTING: expected ${expectedNodes} nodes to run this test, got `, nodesManager.nodeStates.length);
            return;
        }


        console.log(`starting rpc`);
        nodesManager.rpcNode?.start();

        console.log(`Starting up the network. Total nodes: ${nodesManager.nodeStates.length}`);

        for (let node of nodesManager.nodeStates) {
            node.start();
        }

        console.log(`all normal nodes started.`);

        await nodesManager.awaitRpcReady();

        let contractManager = ContractManager.getForNetwork(this.networkName);

        const watchdog = new Watchdog(contractManager, nodesManager);
        watchdog.startWatching(true);

        await stakeOnValidators(expectedValidators);

        console.log(`waiting until ${expectedValidators} validators took over the ownership of the network.`);



        let currentValidators = await contractManager.getValidators();
        while (currentValidators.length < expectedValidators) {
            await sleep(1000);
            currentValidators = await contractManager.getValidators();
        }


        console.log(`we are running now on a ${expectedValidators} validator testnetwork. starting with phoenix test.`);

        let web3 = contractManager.web3;

        let start_block = await web3.eth.getBlockNumber();
        console.log('current block:', start_block);

        this.lastCheckedBlock = start_block;



        this.runImplementation():

        /// console.assert(last_checked_block > blockBeforeNewTransaction);

        await watchdog.stopWatching();

        console.log('Success: Block created after tolerance reached was achieved again.:');

        // write operation result.

        // LogFileManager.writeNetworkOperationOutput(networkName, networkOperation)

        nodesManager.stopAllNodes();
        nodesManager.stopRpcNode();

        // todo: add a condition to stop this test.
        // maybe phoenix managed a recovery 3 times ?
        // while(true) {
        //     // verify that network is running.
        //     // by sending a transaction and waiting for a new block.





        // }

    }


    abstract runImplementation(web3: Web3) : Promise<LocalnetScriptRunnerResult>;

}


