import { ConfigManager } from "./configManager";
import { ContractManager } from "./contractManager";
import { NodeManager } from "./net/nodeManager";
import { Watchdog } from "./watchdog";

import { parse } from 'ts-command-line-args';

interface IRunWatchdogArguments{
  boot: boolean;
  nodes: number[];
}

async function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function runWatchdog() : Promise<Watchdog> {

  const args = parse<IRunWatchdogArguments>({
    boot: { type: Boolean, alias: 'b'},
    nodes: { type: Number, multiple: true, defaultValue: [] }
    }, {partial: true });

  console.log(`starting watchdog`);
  console.log(`parsed cli arguments: `, args);

  console.log('getting web3');
  const web3 = ConfigManager.getWeb3();
  const nodeManager = NodeManager.get();
  const contractManager = new ContractManager(web3);
  const watchdog = new Watchdog(contractManager, nodeManager);

  if (args.boot) {
    // no node specification means that we start all nodes.
    if (args.nodes.length === 0) {
      await nodeManager.startRpcNode();
      await nodeManager.startAllNodes();
      // todo: implement spin wait here until RPC ius reachable as alternative.
      console.log('waiting 10 seconds for booting network.');
      await sleep(10000);
      watchdog.startWatching();

    } else {

      for(const nodeNumber of args.nodes) {
        console.log(`starting node ${nodeNumber}`);
        await nodeManager.startNode(nodeNumber);
      }
      watchdog.startWatching();
    }
  } else {
    watchdog.startWatching();
  }
  
  return watchdog;
}

runWatchdog();