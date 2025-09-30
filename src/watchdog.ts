import Web3 from "web3";

import { BlockHeader } from "web3-eth";
import { Subscription } from 'web3-core-subscriptions';
import { ContractManager } from "./contractManager";
import { NodeManager, NodeState } from "./net/nodeManager";
import { Dictionary } from "underscore";
import BigNumber from "bignumber.js";
import deepEqual from "deep-equal";
import { ConnectivityTrackerWatchdogPlugin } from "./watchdog-connectivity-tracker";



/**
 * Watches for state changes for the POSDAO Contracts
 * Also has a memory.
 */
export class Watchdog {

  //time multiplyer. 2 means it triggers at reaching 2 times the expected epoch length
  public epochLengthTolerancePercentage: number = 3;

  public currentValidators: Array<string> = [];
  public pendingValidators: Array<string> = [];

  public flaggedValidators: Array<string> = [];

  public numberOfAcksWritten: number = 0;
  public numberOfPartsWritten: number = 0;

  public latestKnownBlock: number = 0;

  public subscription?: Subscription<BlockHeader>;

  // tracks the time of the latest pool restart.
  // after a restart, the candidate node software should announce it's availability again.
  // after announcing the availability, the last restart entry get's deleted again.
  public latestpoolRestarts: Dictionary<number> = {};
  public latestpoolRestartBlockNumber:  Dictionary<number> = {};
  private lastEpochSwitchTime: number = 0;
  private epochLengthSetting: number = 0;
  private timestampLastHardResync: number = 0;
  private latestKnownEpochNumber: number = 0;
  private latestEarlyEpochEndFlag: boolean = false;

  /**
   * should the MOC (first node) be shutdown after other first nodes took over ?
   */
  //private mocShutdown: boolean = true;

  private rebootLocal = false;

  private validatorRebootTimeout: NodeJS.Timeout | undefined;
  

  public mocNode: NodeState | undefined;

  private stopSignal = false;

  public onEpochSwitch: (newEpochNumber: number, blockNumber: number) => void = (newEpochNumber, blockNumber) => { };
  

  public notifyNodeChanged(blockNumber: number, currentNodes: ArrayLike<string>) {
    if (blockNumber == 0 && currentNodes.length == 1) {
      this.mocNode = this.manager.nodeStates.filter(x => x.nodeID == 1)[0];
    } else {
      if (this.mocNode && currentNodes.length == 1 && currentNodes[0] != this.mocNode.address) {
        // we have switched from a MOC to another Node.
        // we can shutdown and deactivate the MOC.
        this.mocNode.deactivate();
      }
    }
  }

  public constructor(public contractManager: ContractManager, public manager: NodeManager, public orderManageNodes: boolean = true, public clearDataOnRestart: boolean = true) {
    BigNumber.config({ EXPONENTIAL_AT: 1000 })
    this.timestampLastHardResync = (Date.now() / 1000);
    this.lastEpochSwitchTime = (Date.now() / 1000);
    
  }

  public static deepEquals(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  public static createDiffgram<T>(before: Array<T>, after: Array<T>): { added: Array<T>, removed: Array<T> } {

    let removed = before.filter(x => !after.includes(x))
    let added = after.filter(x => !before.includes(x));
    return { added, removed };

  }

  public async checkValidaterState(miningAddress: string, callback = async () => { }) {

    //let date = new Date();

    const validatorSet = this.contractManager.getValidatorSetHbbft();
    const poolAddress = await validatorSet.methods.stakingByMiningAddress(miningAddress).call();
    const web3 = this.contractManager.web3;

    
    //only handle nodes that do have a pool associated.
    if (new BigNumber(poolAddress).isZero()) {
      return;
    }

    const now = Date.now();
    //console.log('checking validator state at ', date);

    //are we already in a restart phase ??
    if (this.latestpoolRestarts[poolAddress]) {

      // wait up to a minute for the restart of the node software
      if ((now - this.latestpoolRestarts[poolAddress]) < 60000) {
        console.log(`Pool ${poolAddress} is not going to be restarted, since it has been restarted recently.`);
        return;
      }

      if (this.latestKnownBlock == this.latestpoolRestartBlockNumber[poolAddress]) {
        console.log(`Pool ${poolAddress} is not going to be restarted,
         since there was already a restard within this block number. Looks like transactions can't be processed.`);
        return;
      }
      
    }


    //const func = async () => {

    const staking = await this.contractManager.getStakingHbbft();
    //const isPoolActive = await staking.methods.isPoolActive(poolAddress).call();
    const isPool2BeElected = await staking.methods.isPoolActive(poolAddress).call();

    if (!isPool2BeElected) {
      {

        //console.log(`pool ${poolAddress} is not active.`);
        //should it be active ??
        //console.log(`query stakeAmountTotal for ${poolAddress}`)
        //const currentStake = new BigNumber(await staking.methods.stakeAmountTotal(poolAddress).call());


        const currentStakeRaw = await staking.methods.stakeAmountTotal(poolAddress).call()
        const currentStake = new BigNumber(currentStakeRaw);
        const currentStakeOnMining = new BigNumber(await staking.methods.stakeAmountTotal(miningAddress).call());
        const candidateMinStake = new BigNumber(await staking.methods.candidateMinStake().call());
        console.log(`pool: ${poolAddress} stake: (${currentStakeRaw}) ${currentStake.toNumber()} of minimum: ${candidateMinStake} (Stake on Mining: ${currentStakeOnMining})`);

        //await staking.methods.stake

        if (currentStake.isGreaterThanOrEqualTo(candidateMinStake)) {
          const validatorAvailableSince = new BigNumber(await validatorSet.methods.validatorAvailableSince(miningAddress).call());
          console.log(`pool ${poolAddress} has enough stake, available since: ${validatorAvailableSince.toNumber()} .it should be available....`);


          //const restartCausedByEmptyBlocks = this.contractManager.web3.eth 

          if (validatorAvailableSince.isZero()) {
            console.log(`pool ${poolAddress} mining address ${miningAddress} is not available, has it run into a problem ? let us restart it.`);
            const asyncRestart = async () => {
              this.latestpoolRestarts[poolAddress] = now;
              this.latestpoolRestartBlockNumber[poolAddress] = this.latestKnownBlock;
              console.log(`stopping... starting shutdown of pool ${poolAddress} mining address ${miningAddress}`);

              const nodes = this.manager.nodeStates.filter(x => x.address == miningAddress);
              if (nodes.length === 0) {
                console.error(`could not find a node we can manage for mining address ${miningAddress}`);
                return;
              }

              if (nodes.length > 1) {
                console.error(`could not find a node we can manage for mining address ${miningAddress}`);
                return;
              }

              console.log(`restarting node nr. ${nodes[0].nodeID} ${miningAddress}`);
              await nodes[0].stop();
              console.log(`stopped  ${nodes[0].nodeID} ${miningAddress}`);

              if (this.clearDataOnRestart) {
                await nodes[0].clearDBLocal();
              }

              await nodes[0].start();


            }

            if (this.orderManageNodes) {

              //start the async restart, but do not await it.
              asyncRestart();
            }

          }
        }
      }

      await callback();
    }
  }

  private async checkAllValidaterStates() {

    this.manager.nodeStates.forEach((s) => {
      if (s.address) {
        this.checkValidaterState(s.address);
      }
    });

  }

  public startWatching(logValidatorChanges = true) {

    this.stopSignal = false;
    console.log(`starting watching...`);

    this.contractManager.web3.eth.getBlockNumber().then((blockNumber) => {
      console.log(`current block:`, blockNumber);


      this.contractManager.getValidators(blockNumber).then((validators) => {
        console.log(`validators at startup:`, validators);
      });
    });


    


    //this.subscription =
    //this.contractManager.web3.eth.subscribe('newBlockHeaders',

    const functionCall = async () => {
      // if (error) {
      //   console.log(`error during newBlockHeaders: `, error);
      // }
      // else { //assume blockHeader always set if there is not error.

      if (this.stopSignal) {
        return;
      }

      const currentBlock = await this.contractManager.web3.eth.getBlockNumber();

      if (currentBlock == this.latestKnownBlock) {
        await this.checkEpochLenghtMissed();
        //try again in a few ms.
        setTimeout(functionCall, 100);
        return;
      }

      this.latestKnownBlock = currentBlock;
      
      let earlyEpochEndFlag = await (await this.contractManager.getRewardHbbft()).methods.earlyEpochEnd().call({}, this.latestKnownBlock);

      if (earlyEpochEndFlag != this.latestEarlyEpochEndFlag) { 
        console.log(`Block ${currentBlock} Early Epoch End Flag switched from ${this.latestEarlyEpochEndFlag} to ${earlyEpochEndFlag}`);
        this.latestEarlyEpochEndFlag = earlyEpochEndFlag;
      }

      let block = await this.contractManager.web3.eth.getBlock(currentBlock);
      console.log(`processing block: ${this.latestKnownBlock} txs: `, block.transactions.length);
      

      this.lastEpochSwitchTime = Number.parseInt(await (await this.contractManager.getStakingHbbft()).methods.stakingEpochStartTime().call());
      this.epochLengthSetting = Number.parseInt(await (await this.contractManager.getStakingHbbft()).methods.stakingFixedEpochDuration().call());
      let oldEpochNumber = this.latestKnownEpochNumber;
      let newEpochNumber =  Number.parseInt(await (await this.contractManager.getStakingHbbft()).methods.stakingEpoch().call());

      this.latestKnownEpochNumber = newEpochNumber;
      const pendingValidators = await this.contractManager.getValidatorSetHbbft().methods.getPendingValidators().call();

      if (newEpochNumber > oldEpochNumber) {
        if (newEpochNumber != oldEpochNumber + 1) {
          console.log(`Strange increase of Epoch Number: Epoch number jumped from ${oldEpochNumber} to ${newEpochNumber}`);
        }

        this.onEpochSwitch(newEpochNumber, currentBlock);
      }

      if (!Watchdog.deepEquals(pendingValidators, this.pendingValidators)) {
        if (logValidatorChanges) {
          console.log(`epoch ${this.latestKnownEpochNumber}: switched pending validators from (${this.pendingValidators.length}) - to (${pendingValidators.length})`, this.pendingValidators, pendingValidators);
          console.log(`Difference: `, Watchdog.createDiffgram(this.pendingValidators, pendingValidators));
        }
        this.pendingValidators = pendingValidators;
      }
      
      const currentValidators = await this.contractManager.getValidatorSetHbbft().methods.getValidators().call();
      if (!Watchdog.deepEquals(currentValidators, this.currentValidators)) {
        if (logValidatorChanges) {
          console.log(`epoch ${this.latestKnownEpochNumber}: switched currentValidators  from - to`, this.currentValidators, currentValidators);
        }
        
        //console.log(`Difference: `, Watchdog.createDiffgram(this.currentValidators, currentValidators));
        this.currentValidators = currentValidators;
        this.notifyNodeChanged(currentBlock, currentValidators);
      }

      //    event ReportMissingConnectivity(
    //     address indexed reporter,
    //     address indexed validator,
    //     uint256 indexed blockNumber
    // );

    // event ReportReconnect(
    //     address indexed reporter,
    //     address indexed validator,
    //     uint256 indexed blockNumber
    // );

    try {

    
      let connectivity = await this.contractManager.getContractConnectivityTrackerHbbft();

      let pastReportMissingConnectivityEvents = await connectivity.getPastEvents('ReportMissingConnectivity', { fromBlock: 'latest', toBlock: 'latest' });
      let pastReportReconnectEvents = await connectivity.getPastEvents('ReportReconnect', { fromBlock: 'latest', toBlock: 'latest' });

      let printScoreTable = false;
      if (pastReportMissingConnectivityEvents.length > 0) {
        
        let values = [];
        for (let e of pastReportMissingConnectivityEvents) {
          let info : any = {}; 
          info.blockNumber = e.blockNumber;
          info.reporter = e.returnValues.reporter;
          info.validator = e.returnValues.validator;
          info.transactionHash = e.transactionHash;
          values.push(info);
        }
        console.log("missing");
        console.table(values);
        printScoreTable = true;
      }

      if (pastReportReconnectEvents.length > 0) {
        let values = [];
        for (let e of pastReportReconnectEvents) {
          let info : any = {}; 
          info.blockNumber = e.blockNumber;
          info.reporter = e.returnValues.reporter;
          info.validator = e.returnValues.validator;
          info.transactionHash = e.transactionHash;
          values.push(info);
        }
        console.log("reconnects:");
        console.table(values);
        printScoreTable = true;
      }

      if (printScoreTable) {
        for (let validator of this.flaggedValidators) {
          let score = await connectivity.methods.getValidatorConnectivityScore(this.latestKnownEpochNumber, validator).call();
          console.log("validator:", validator, "score:", score);
        }
      }
    } catch(e) {
      //console.log("Error with connectivity score:", e);
    }

    

      const keyGenHistory = await this.contractManager.getKeyGenHistory();
      const numberOfFragmentsWritten = await keyGenHistory.methods.getNumberOfKeyFragmentsWritten().call();

      const numberOfPartsWritten = Number.parseInt(numberOfFragmentsWritten[0]);
      const numberOfAcksWritten = Number.parseInt(numberOfFragmentsWritten[1]);

      if (this.numberOfPartsWritten != numberOfPartsWritten) {
        console.log(`Number of Parts written changed from ${this.numberOfPartsWritten} to ${numberOfPartsWritten}`);

        this.numberOfPartsWritten = numberOfPartsWritten;
      }


      if (this.numberOfAcksWritten != numberOfAcksWritten) {
        console.log(`Number of ACKS written changed from ${this.numberOfAcksWritten} to ${numberOfAcksWritten}`);
        this.numberOfAcksWritten = numberOfAcksWritten;
      }




      // const currentValidators = await this.contractManager.getStakingHbbft() getValidatorSetHbbft().methods.getValidators().call();
      // if (!Watchdog.deepEquals(currentValidators, this.currentValidators)) {
      //   console.log(`switched currentValidators  from - to`, this.currentValidators, currentValidators);
      //   this.currentValidators = currentValidators;
      // }

      // await this.checkValidaterState()

      const connectivityWatcher = new ConnectivityTrackerWatchdogPlugin();
      connectivityWatcher.contractManager = this.contractManager;
      await connectivityWatcher.processBlock(currentBlock);

      let connectivityTracker = await this.contractManager.getContractConnectivityTrackerHbbft();
      let currentFlaggedValidators = await connectivityTracker.methods.getFlaggedValidators().call();
      
      if (!deepEqual(this.flaggedValidators, currentFlaggedValidators)) {
        console.log("switched flagged validators from - to", this.flaggedValidators, currentFlaggedValidators);
        this.flaggedValidators = currentFlaggedValidators;
      }


      setTimeout(functionCall, 100);
    }

    functionCall();

    if (this.rebootLocal) {
      //periodic checks every second:
      const timeout = setInterval(async () => {
        console.log(`checking validator nodes reboot...`, this.manager.nodeStates.length);
        await this.checkAllValidaterStates();

      }, 10000);


      this.validatorRebootTimeout = timeout;

    }


  }

  public async stopWatching() {

    this.stopSignal = true;
    if (this.subscription) {
      await this.subscription.unsubscribe();
    }

    if (this.validatorRebootTimeout) {
      this.validatorRebootTimeout.unref();
    }
  }

  private async checkEpochLenghtMissed() {

    const currentTime = Date.now() / 1000;

    //don't reboot the nodes all over again.
    if (currentTime < this.timestampLastHardResync + 20 * this.epochLengthTolerancePercentage * this.epochLengthSetting) {
      //doing nothing, because we just rebooted
      return;
    }

    if (this.latestKnownEpochNumber == 0) {
      //console.log(`skipping reboot since we are still in epoch 0`);
      return;
    }

    const maxToleratedTime = this.lastEpochSwitchTime + (this.epochLengthTolerancePercentage * this.epochLengthSetting);

    // if (currentTime > maxToleratedTime) {
    //   console.log(`detected possible problem with nodes. Rebooting All - RPC should be able to sync all nodes again.`);
    //   this.timestampLastHardResync = currentTime;
    //   await this.manager.stopAllNodes(true);
    //   this.manager.nodeStates.forEach((n) => { n.clearDB() });
    //   await this.manager.startAllNodes();
    // }
  }

}


