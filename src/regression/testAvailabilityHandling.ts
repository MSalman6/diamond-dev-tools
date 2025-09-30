

import { NodeManager, NodeState } from '../net/nodeManager';
import { awaitEpochSwitch } from '../awaitEpochSwitch';
import { ContractManager } from '../contractManager';
import { ConfigManager } from '../configManager';
import { stakeOnValidators } from '../net/stakeOnValidators';
import { Watchdog } from '../watchdog';



function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}


function assertEQ(value1: any, value2: any, topic: string) {
  if (value1 !== value2) {
    throw new Error(`expected that ${value1} === ${value2}. ${topic}`);
  }
}

async function run() {

  // todo:  | tee testnet/nodes/testAvailabilityHandling.log
  const manager = NodeManager.get();
  manager.initFromTestnetManifest();
  console.log('Got node manager.');



  const nodes = manager.nodeStates;

  let nodeMoc = nodes[0];

  manager.startAllNodes();

  manager.startRpcNode();

  console.log(`started all ${nodes.length} nodes`);
  console.log('waiting 10 seconds for starting up RPC node.');
  await sleep(10000);


  console.log('getting web3');
  const web3 = ConfigManager.getWeb3();
  console.log('getting contract manager');

  const contractManager = new ContractManager(web3);

  const watchdog = new Watchdog(contractManager, manager);
  watchdog.startWatching();

  //manager.getNode();
  console.log('got contract manager, getting');
  const validatorSet = contractManager.getValidatorSetHbbft();

  console.log(`got validatorSet at ${validatorSet.options.address}`);
  let currentValidators = await validatorSet.methods.getValidators().call();

  console.log('initial validators: ', currentValidators);


  assertEQ(currentValidators.length, 1, 'expected to start with 1 MOC');
  assertEQ(currentValidators[0].toLowerCase(), nodes[0].address?.toLowerCase(), 'expected MOC to be node1');

  console.log('waiting for epoch switch 1');
  await awaitEpochSwitch();

  const node2 = nodes[1];
  const node3 = nodes[2];
  const node4 = nodes[3];
  const node5 = nodes[4];



  //const isValidator = await validatorSet.methods.isValidator('').call();
  console.log('staking on node 2');
  await stakeOnValidators(1, [node2.address!]);
  //await stakeOnValidators(1);

  console.log('staking on node 3');
  await stakeOnValidators(1, [node3.address!]);

  console.log('staking on node 4');
  await stakeOnValidators(1, [node4.address!]);

  console.log('staking on node 5');
  await stakeOnValidators(1, [node5.address!]);

  console.log('staking completed. waiting for epoch switch 2.');
  await awaitEpochSwitch();

  //console.log('verify that node 2 and 3 are now part of the validator sets.');
  currentValidators = await validatorSet.methods.getValidators().call();
  console.log('current validators:', currentValidators);

  assertEQ(currentValidators.length, 4, 'expected that all 4 are validators now.');
  // assertEQ(currentValidators[0].toLowerCase(), node2.address?.toLowerCase(), 'node2');
  // assertEQ(currentValidators[1].toLowerCase(), node3.address?.toLowerCase(), 'node3');

  console.log('awaiting another epoch switch 3.');
  await awaitEpochSwitch();

  console.log('stopping node 2')

  await node2.stop();


  currentValidators = await validatorSet.methods.getValidators().call();
  console.log('current validators:', currentValidators);

  // even a node does not run anymore, it is still part of the validator set.
  assertEQ(currentValidators.length, 4, 'number of validators immediatly after stop should be 4');

  console.log('awaiting another epoch switch 4.');

  // in this epoch switch, the node 2 should get kicked out because of unavailibility.
  await awaitEpochSwitch();


  currentValidators = await validatorSet.methods.getValidators().call();
  console.log('current validators:', currentValidators);

  assertEQ(currentValidators.length, 3, 'number of validators after epoch switch after stop should be 3.');

  console.log('starting node 2 again.');
  node2.start();


  console.log('awaiting another epoch switch 5.');
  await awaitEpochSwitch();

  currentValidators = await validatorSet.methods.getValidators().call();
  console.log('current validators:', currentValidators);

  assertEQ(currentValidators.length, 4, 'number of validators after restart should be 4');



  const node6 = nodes[5];
  const node7 = nodes[6];


  console.log('awaiting another epoch switch 5.');
  await awaitEpochSwitch();



  //const isValidator = await validatorSet.methods.isValidator('').call();
  console.log('staking on node 6');
  await stakeOnValidators(1, [node6.address!]);

  console.log('staking on node 7');
  await stakeOnValidators(1, [node7.address!]);



  console.log('awaiting another epoch switch 6.');
  await awaitEpochSwitch();

  console.log('Test success!!');
  console.log('stopping nodes...');
  // await node1.stop();
  // await node2.stop();
  // await node3.stop();

  await watchdog.stopWatching();

  manager.stopRpcNode();
  manager.stopAllNodes();

  console.log('stop signal send!');
}


run();