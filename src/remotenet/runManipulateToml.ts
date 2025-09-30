import { findSeries } from 'async';
import fs from 'fs';
import { ConfigManager } from '../configManager';
import { cmd, cmdR } from '../remoteCommand';
import { getNodesFromCliArgs } from './remotenetArgs';

async function runAdd() {
  const nodes = await getNodesFromCliArgs();

  const config = ConfigManager.getNetworkConfig();

  for (const n of nodes) {
    const pathToToml = `~/${config.installDir}/validator_node.toml`;
    const result = cmdR(n.sshNodeName(), `cat ${pathToToml}`, false);
    // console.log(result);

    const valueToAdd = 'tx_queue_per_sender = 2000';
    const addAfter = 'reseal_on_txs = "none"';

    if (result.includes(valueToAdd)) {
      console.log(`Skipping ${n.sshNodeName()} value already exists in toml`);
      continue;
    }

    const newResult = result.replace(addAfter, `${addAfter}\n${valueToAdd}`);

    const tempFile = '/tmp/honey-badger-testing-manipulate.toml';
    fs.writeFileSync(tempFile, newResult);

    cmd(`scp ${tempFile} ${n.sshNodeName()}:${pathToToml}`);
  }
}

/// todo: make regex supported version.
async function runReplace(valueOld: string, valueNew: string) {
  const nodes = await getNodesFromCliArgs();

  const config = ConfigManager.getNetworkConfig();

  for (const n of nodes) {
    const pathToToml = `~/${config.installDir}/validator_node.toml`;
    const result = cmdR(n.sshNodeName(), `cat ${pathToToml}`, false);
    // console.log(result);


    if (!result.includes(valueOld)) {
      console.log(`Skipping ${n.sshNodeName()} nothing to do.`);
      continue;
    }

    const newResult = result.replace(valueOld, valueNew);
    const tempFile = '/tmp/honey-badger-testing-manipulate.toml';
    fs.writeFileSync(tempFile, newResult);

    cmd(`scp ${tempFile} ${n.sshNodeName()}:${pathToToml}`);
  }
}



async function runDowngradeLogging() {
  const valueOld = 'logging = "txqueue=trace,consensus=trace,engine=trace"';
  const valueNew = 'logging = "txqueue=info,consensus=info,engine=info"';

  await runReplace(valueOld, valueNew);

}

async function runIncreaseNumOfConnections() {
  const valueOld = 'max_peers = 50';
  const valueNew = 'max_peers = 148';

  await runReplace(valueOld, valueNew);

  // '[misc]'
  
}

async function runDeactivateReservedPeers() {

  const valueOld = 'reserved_peers = "reserved-peers"';
  const valueNew = '#reserved_peers = "reserved-peers"';
  // reserved_peers = "reserved-peers"

  await runReplace(valueOld, valueNew);

}

async function runAdjustPeers() {


  // reserved_peers = "reserved-peers"

  await runReplace("min_peers = 2", "min_peers = 5");
  //await runReplace("max_peers = 5", "max_peers = 30");
  //await runDeactivateReservedPeers();
}

async function runActivateDiamondProtectionLayer() {

  // #reserved_peers = "reserved-peers"

  await runReplace("#reserved_peers = \"reserved-peers\"", "reserved_peers = \"reserved-peers\"");
  await runReplace("#reserved_peers = \"reserved-peers\"", "reserved_peers = \"reserved-peers\"");
  await runReplace("#reserved_peers = \"reserved-peers\"", "reserved_peers = \"reserved-peers\"");
  await runReplace("#reserved_peers = \"reserved-peers\"", "reserved_peers = \"reserved-peers\"");


  await runReplace("reserved_peers = \"reserved-peers\"", "reserved_peers = \"reserved-peers\"\nreserved_only = true\ndiscovery = false");
}


// async function runApplyAdditionConfigs() {

//   const valueOld = 'gas_floor_target = "300000000"\n';
//   const valueNew = 'gas_floor_target = "300000000"\ntx_queue_size = 10240\ntx_queue_mem_limit = 128\ntx_queue_per_sender = 256\ntx_queue_no_early_reject = true\n';

//   await runReplace(valueOld, valueNew);
// }


// # Parity will keep/relay at most 10240 transactions in queue.
// tx_queue_size = 10240
// # Maximum amount of memory that can be used by the transaction queue. Setting this parameter to 0 disables  limiting. (default: 4)
// tx_queue_mem_limit = 128
// # Maximum number of transactions per sender in the queue. By default it's 1% of the entire queue, but not less than 16.
// tx_queue_per_sender = 256
// # Disables transaction queue optimization to early reject transactions below minimal effective gas price. This allows local transactions to always enter the pool, despite it being full, but requires additional ecrecover on every transaction.
// tx_queue_no_early_reject = true
  

// runApplyAdditionConfigs();
// runAdjustPeers() ;

runActivateDiamondProtectionLayer();