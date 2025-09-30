// the RPC Nodes holds the data, 
// all other nodes get deleted the caches.

import { ContractManager } from "../contractManager";
import { toDate, toNumber } from "../utils/numberUtils";
import { NodeManager } from "./nodeManager";

export async function printState(nodeManager: NodeManager, contractManager: ContractManager) {


  const web3 = contractManager.web3;
  const validatorSet = contractManager.getValidatorSetHbbft();
  const staking = await contractManager.getStakingHbbft();
  const keyGenHistory = await contractManager.getKeyGenHistory();

  // const connectivityTracker = await contractManager.getContractConnectivityTrackerHbbft();

  const epochStartTime = new Date(Number.parseInt(await staking.methods.stakingEpochStartTime().call()) * 1000);
  const phaseTransition = new Date(Number.parseInt(await staking.methods.startTimeOfNextPhaseTransition().call()) * 1000);
  const epochEndTime = new Date(Number.parseInt(await staking.methods.stakingFixedEpochEndTime().call()) * 1000);

  const latestBlock = (await web3.eth.getBlock("latest"));

  const latestBlockTime = toDate(latestBlock.timestamp);

  console.log(`last Block UTC: ${latestBlockTime.toUTCString()}`);
  console.log(`epoch start time UTC: ${epochStartTime.toUTCString()}`);
  console.log(`next Phase Transition UTC: ${phaseTransition.toUTCString()}`);
  console.log(`Epoch End Time: UTC: ${epochEndTime.toUTCString()}`);


  const pendingValidators = await validatorSet.methods.getPendingValidators().call()
  console.log(`pending validators:`, pendingValidators);


  for (let i = 0; i < pendingValidators.length; i++) {
    const pendingValidator = pendingValidators[i];
    const currentKeyGenMode = await validatorSet.methods.getPendingValidatorKeyGenerationMode(pendingValidator).call();
    console.log(`pending validator ${await nodeManager.formatNodeName(pendingValidator)} key gen mode: `, currentKeyGenMode);
  }

  if (pendingValidators.length > 0) {

    const numberOfKeyFragmentsWritten = await keyGenHistory.methods.getNumberOfKeyFragmentsWritten().call();
    console.log(`number of key fragments written: Parts: ${numberOfKeyFragmentsWritten[0]} Acks ${numberOfKeyFragmentsWritten[1]}`);
  }

  const validators = await contractManager.getValidators();
  console.log("validators:");
  console.table(validators);

  for (const v of validators) {
     let part = await keyGenHistory.methods.parts(v).call();
     let numOfAcks = await keyGenHistory.methods.getAcksLength(v).call();
     
     let partByteLength = part === null ? 0 : contractManager.web3.utils.hexToBytes(part).length;

     console.log(`valdidator: ${v} # acks: ${numOfAcks} part: ${partByteLength}`);
  }


//   console.log("Availability:");

//   for (const v of validators) {

//     connectivityTracker.methods.
//     let part = await keyGenHistory.methods.parts(v).call();
//     let numOfAcks = await keyGenHistory.methods.getAcksLength(v).call();
    
//     let partByteLength = part === null ? 0 : contractManager.web3.utils.hexToBytes(part).length;

//     console.log(`valdidator: ${v} # acks: ${numOfAcks} part: ${partByteLength}`);
//  }



  //
  //contractManager.getKeyGenHistory();
  //validatorSetContract.getPendingValidatorKeyGenerationMode(_sender)

  console.log(`likehilihood:`, await staking.methods.getPoolsLikelihood().call());

  nodeManager.nodeStates.forEach(async (s) => {
    if (s.address) {
      // const stakingAddress =  await validatorSet.methods.stakingByMiningAddress(s.address).call();
      // const encodedABI = validatorSet.methods.validatorAvailableSince(stakingAddress).encodeABI();
      // console.log(`call Encoded for ${s.address}:`, encodedABI);
      const callResult = await validatorSet.methods.validatorAvailableSince(s.address).call();
      console.log(`${s.address} available since: ${callResult} ${new Date(Number.parseInt(callResult) * 1000).toUTCString()}`);
      //s.address
    }
  });



}