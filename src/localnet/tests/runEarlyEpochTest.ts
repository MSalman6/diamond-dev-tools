import Web3 from "web3";
import { LocalnetScriptRunnerBase, LocalnetScriptRunnerResult } from "./localnetBootstrapper";


class EarlyEpochEndRunner extends LocalnetScriptRunnerBase {


    async runImplementation(web3: Web3): Promise<LocalnetScriptRunnerResult> {
                
        await startNode(2);
        await sleep(5000);
        await stopNode(2);

        // console.log("alternating between stopping and starting nodes 2, 3 and 4 - in a way always only 2 Nodes are available in any given moment.");
        //await stopNode(4);
        //console.log("starting node 3");

        await stopNode(4);

        await startNode(3);
        await sleep(5000);
        await stopNode(3);

        await startNode(4);


        console.log("starting all stopped nodes to test the recovery from missed hbbft messages.");

        await refreshBlock();
        await startNode(2);
        await startNode(3);


        console.log('waiting for nodes...');

        await sleep(3000);

        await refreshBlock();

        console.log('waiting for block inclusion...:');

        await sleep(15000);
        await refreshBlock();
    }


} 
