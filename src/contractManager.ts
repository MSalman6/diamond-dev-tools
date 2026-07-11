import Web3 from 'web3';
import BigNumber from 'bignumber.js';

import { ConfigManager } from './configManager';

import { ValidatorSetHbbft } from './abi/contracts/ValidatorSetHbbft';
import JsonValidatorSetHbbft from './abi/json/ValidatorSetHbbft.json';

import { StakingHbbft } from './abi/contracts/StakingHbbft';
import JsonStakingHbbft from './abi/json/StakingHbbft.json';

import { KeyGenHistory } from './abi/contracts/KeyGenHistory';
import JsonKeyGenHistory from './abi/json/KeyGenHistory.json';

import { BlockRewardHbbft } from './abi/contracts/BlockRewardHbbft';
import JsonBlockRewardHbbft from './abi/json/BlockRewardHbbft.json';

import { RandomHbbft } from './abi/contracts/RandomHbbft';
import JsonRandomHbbft from './abi/json/RandomHbbft.json';

import { ConnectivityTrackerHbbft } from './abi/contracts/ConnectivityTrackerHbbft';
import JsonConnectivityTrackerHbbft from './abi/json/ConnectivityTrackerHbbft.json';

import JsonBonusScoreSystem from './abi/json/BonusScoreSystem.json';

import { DMDRegistrarController } from './abi/contracts/DMDRegistrarController';
import JsonDMDRegistrarController from './abi/json/DMDRegistrarController.json';

import { DMDNames } from './abi/contracts/DMDNames';
import JsonDMDNames from './abi/json/DMDNames.json';

import { BlockType } from './abi/contracts/types';


import { BlockTransactionString } from 'web3-eth';
import {
  AvailabilityEvent,
  ClaimedOrderedWithdrawalEvent,
  DmdNameTransferEvent,
  GatherAbandonedStakesEvent,
  MovedStakeEvent,
  NameActivatedEvent,
  NameBlockedSetEvent,
  NameDeactivatedEvent,
  NameRegisteredEvent,
  NameRenewedEvent,
  OrderedWithdrawalEvent,
  StakeChangedEvent
} from './eventsVisitor';
import { BonusScoreSystem, TxPermissionHbbft } from './abi/contracts';

import JsonTxPermissionHbbft from './abi/json/TxPermissionHbbft.json';
import { parseEther } from './utils/ether';
import { h2bn, h2n, toNumber } from './utils/numberUtils';
import { blockTimeAsUTC } from './utils/dateUtils';
import { deepEqual } from 'assert';

export enum KeyGenMode {
  NotAPendingValidator = 0,
  WritePart,
  WaitForOtherParts,
  WriteAck,
  WaitForOtherAcks,
  AllKeysDone
}

export interface ContractAddresses {
  validatorSetAddress: string,
  permissionContractAddress: string;
  bonusScoreSystem: string;
}

export type ContractEvent = AvailabilityEvent
  | MovedStakeEvent
  | StakeChangedEvent
  | OrderedWithdrawalEvent
  | ClaimedOrderedWithdrawalEvent
  | GatherAbandonedStakesEvent
  | NameRegisteredEvent
  | NameActivatedEvent
  | NameDeactivatedEvent
  | NameRenewedEvent
  | NameBlockedSetEvent
  | DmdNameTransferEvent;


export class DelegateRewardData {
  public constructor(
    public poolAddress: string,
    public epoch: number,
    public delegatorAddress: string,
    public isClaimed: boolean,
    public amount?: BigNumber
  ) { }
}

export interface RestakeRewardEvent {
  poolStakingAddress: string;
  stakingEpoch: number;
  validatorReward: BigNumber;
  delegatorsReward: BigNumber;
}

/// a IP Address with Port, but without the public key.
export class NetworkAddress {

  constructor(public ip: number[], public port: number) {

    // this is super dirty to manage the IP as string...
    // but for current use its good enough.
  }

  public asFormatedIP(): string {


    const getIPFragment = (index: number) => {
      return index < this.ip.length ? this.ip[index] : 0;
    }

    return `${getIPFragment(3)}.${getIPFragment(2)}.${getIPFragment(1)}.${getIPFragment(0)}`;
  }

  public toEnode(publicKey: string) {
    return `enode://${publicKey}@${this.asFormatedIP()}:${this.port}`;
  }

  public toString(): string {
    return `${this.asFormatedIP()}:${this.port}`;
  }
}

export class ContractManager {

  private cachedValidatorSetHbbft?: ValidatorSetHbbft;
  private cachedStakingHbbft?: StakingHbbft;
  private cachedKeyGenHistory?: KeyGenHistory;
  private cachedRewardContract?: BlockRewardHbbft;
  private cachedPermission?: TxPermissionHbbft;
  private cachedBonusScoreSystem?: BonusScoreSystem;
  private cachedConnectivityTrackerHbbft?: ConnectivityTrackerHbbft;
  private cachedDmdRegistrarController?: DMDRegistrarController;
  private cachedDmdNames?: DMDNames;
  private cachedValidatorMinRewardPercent: Map<number, number> = new Map();
  
  private apyStakeFraction: BigNumber;

  public constructor(public web3: Web3) {
    this.apyStakeFraction = parseEther(this.web3.utils.toWei('10000', 'ether'));
  }

  /**
   * retrieves a ContractManager with the web3 context from current configuration.
  */
  public static get(): ContractManager {
    const web3 = ConfigManager.getWeb3();
    const contractManager = new ContractManager(web3);
    return contractManager;
  }

  public static getForNetwork(networkName: string): ContractManager {
    const web3 = ConfigManager.getWeb3()
    const contractManager = new ContractManager(web3);
    return contractManager;
  }

  public static getContractAddresses(): ContractAddresses {
    //todo: query other addresses ?!
    // more intelligent contract manager that queries lazy ?
    return { validatorSetAddress: '0x1000000000000000000000000000000000000001', permissionContractAddress: `0x4000000000000000000000000000000000000001`, bonusScoreSystem: '0x1300000000000000000000000000000000000001' };
  }

  public getValidatorSetHbbft(): ValidatorSetHbbft {
    if (this.cachedValidatorSetHbbft) {
      return this.cachedValidatorSetHbbft;
    }

    const contractAddresses = ContractManager.getContractAddresses();

    const abi: any = JsonValidatorSetHbbft.abi;
    const validatorSetContract: any = new this.web3.eth.Contract(abi, contractAddresses.validatorSetAddress);
    this.cachedValidatorSetHbbft = validatorSetContract;

    return validatorSetContract;
  }


  public getContractPermission(): TxPermissionHbbft {
    if (this.cachedPermission) {
      return this.cachedPermission;
    }
    const contractAddresses = ContractManager.getContractAddresses();
    const abi: any = JsonTxPermissionHbbft.abi;
    const permissionContract: any = new this.web3.eth.Contract(abi, contractAddresses.permissionContractAddress);
    this.cachedPermission = permissionContract;
    return permissionContract;

  }

  public getBonusScoreSystem(): BonusScoreSystem {
    if (this.cachedBonusScoreSystem) {
      return this.cachedBonusScoreSystem;
    }

    const contractAddresses = ContractManager.getContractAddresses();

    const abi: any = JsonBonusScoreSystem.abi;
    const bonusScoreSystemContract: any = new this.web3.eth.Contract(abi, contractAddresses.bonusScoreSystem);
    this.cachedBonusScoreSystem = bonusScoreSystemContract;

    return bonusScoreSystemContract;

  }


  public async getPoolOperatorAddress(pool: string, blockNumber: BlockType = 'latest'): Promise<string> {
    let stakingContract = await this.getStakingHbbft();
    let operator = await stakingContract.methods.poolNodeOperator(pool).call({}, blockNumber);
    return operator;
  }

  public async getBonusScore(miningAddress: string, blockNumber: BlockType): Promise<number> {

    const bonusScore = toNumber(await this.getBonusScoreSystem().methods.getValidatorScore(miningAddress).call({}, blockNumber));
    return bonusScore;
  }


  public async getContractConnectivityTrackerHbbft(): Promise<ConnectivityTrackerHbbft> {

    //throw new Error("no available");

    if (this.cachedConnectivityTrackerHbbft) {
      return this.cachedConnectivityTrackerHbbft;
    }

    let permission = this.getContractPermission();
    let connectivityTrackerAddress = await permission.methods.connectivityTracker().call();

    const abi: any = JsonConnectivityTrackerHbbft.abi;
    let result: any = new this.web3.eth.Contract(abi, connectivityTrackerAddress);

    this.cachedConnectivityTrackerHbbft = result;

    return result;
  }


  public async getRewardContractAddress() {
    return await this.getValidatorSetHbbft().methods.blockRewardContract().call();
  }

  public async getRewardHbbft(): Promise<BlockRewardHbbft> {
    if (this.cachedRewardContract) {
      return this.cachedRewardContract;
    }

    const contractAddress = await this.getRewardContractAddress();

    const abi: any = JsonBlockRewardHbbft.abi;
    const result: any = new this.web3.eth.Contract(abi, contractAddress);
    this.cachedRewardContract = result;

    return this.cachedRewardContract!;
  }

  public async getStakingHbbft(): Promise<StakingHbbft> {
    if (this.cachedStakingHbbft) {
      return this.cachedStakingHbbft;
    }

    const contractAddress = await this.getValidatorSetHbbft().methods.stakingContract().call();

    const abi: any = JsonStakingHbbft.abi;
    const stakingContract: any = new this.web3.eth.Contract(abi, contractAddress);
    this.cachedStakingHbbft = stakingContract;

    return stakingContract;
  }

  public async getKeyGenHistory(): Promise<KeyGenHistory> {
    if (this.cachedKeyGenHistory) {
      return this.cachedKeyGenHistory;
    }

    const contractAddress = await this.getValidatorSetHbbft().methods.keyGenHistoryContract().call();
    console.log('KeyGenHistory address: ', contractAddress);

    const abi: any = JsonKeyGenHistory.abi;
    const contract: any = new this.web3.eth.Contract(abi, contractAddress);
    this.cachedKeyGenHistory = contract;

    return contract;
  }

  public getRandomHbbftFromAddress(contractAddress: string): RandomHbbft {
    const abi: any = JsonRandomHbbft.abi;
    const contract: any = new this.web3.eth.Contract(abi, contractAddress);

    return contract;
  }

  public async getRandomHbbft(): Promise<RandomHbbft> {
    let contractAddress = await this.getValidatorSetHbbft().methods.randomContract().call();

    const abi: any = JsonRandomHbbft.abi;
    const contract: any = new this.web3.eth.Contract(abi, contractAddress);

    return contract;
  }

  public async getGovernancePotAddress(): Promise<string> {
    const blockReward = await this.getRewardHbbft();

    return await blockReward.methods.getGovernanceAddress().call();
  }

  public async getClaimingPotAddress(): Promise<string> {

    const chainID = await this.web3.eth.getChainId();
    // we have som problems with configured network and getting the correct chainid
    if (chainID ===  17771)  {
      return "0xf3bf614C0EA1D14D998BcDb49Ad1F8f57332Bb42";
    } else if (chainID === 37373) {
      return "0xCB9605E908679e7596cd67632CaffC980b5Bf895";
    }

    const networkConfig = ConfigManager.getNetworkConfig();
    return networkConfig.claimingPotAddress;
  }

  public async getDmdRegistrarControllerAddress(): Promise<string | undefined> {
    if (process.env.DMD_REGISTRAR_CONTROLLER_ADDRESS) {
      return process.env.DMD_REGISTRAR_CONTROLLER_ADDRESS;
    }

    const chainID = await this.web3.eth.getChainId();
    if (chainID === 17771) {
      return '0x26EeECc60964C219bFBeA25aBb86aB8b4590467B';
    }

    return undefined;
  }

  public async getDmdNamesAddress(): Promise<string | undefined> {
    if (process.env.DMD_NAMES_ADDRESS) {
      return process.env.DMD_NAMES_ADDRESS;
    }

    const chainID = await this.web3.eth.getChainId();
    if (chainID === 17771) {
      return '0x857C95B69b5dD7EFE4e5591B2e0C0a79aeBE9899';
    }

    return undefined;
  }

  public async getDmdRegistrarController(): Promise<DMDRegistrarController | undefined> {
    if (this.cachedDmdRegistrarController) {
      return this.cachedDmdRegistrarController;
    }

    const contractAddress = await this.getDmdRegistrarControllerAddress();
    if (!contractAddress) {
      return undefined;
    }

    const abi: any = JsonDMDRegistrarController;
    const contract: any = new this.web3.eth.Contract(abi, contractAddress);
    this.cachedDmdRegistrarController = contract;

    return contract;
  }

  public async getDmdNames(): Promise<DMDNames | undefined> {
    if (this.cachedDmdNames) {
      return this.cachedDmdNames;
    }

    const contractAddress = await this.getDmdNamesAddress();
    if (!contractAddress) {
      return undefined;
    }

    const abi: any = JsonDMDNames;
    const contract: any = new this.web3.eth.Contract(abi, contractAddress);
    this.cachedDmdNames = contract;

    return contract;
  }

  public async getNameRegisteredEvents(fromBlockNumber: number, toBlockNumber: number): Promise<NameRegisteredEvent[]> {
    const registrar = await this.getDmdRegistrarController();
    if (!registrar) {
      return [];
    }

    const events = await registrar.getPastEvents('NameRegistered', { fromBlock: fromBlockNumber, toBlock: toBlockNumber });
    const result = new Array<NameRegisteredEvent>();

    for (const event of events) {
      const values = event.returnValues;
      const blockTimestamp = (await this.web3.eth.getBlock(event.blockNumber)).timestamp;

      result.push(new NameRegisteredEvent(
        'NameRegistered',
        event.blockNumber,
        Number(blockTimestamp),
        Number(event.logIndex),
        values.node,
        values.labelHash,
        values.name,
        values.expiration,
        event.transactionHash
      ));
    }

    return result;
  }

  public async getNameActivatedEvents(fromBlockNumber: number, toBlockNumber: number): Promise<NameActivatedEvent[]> {
    const registrar = await this.getDmdRegistrarController();
    if (!registrar) {
      return [];
    }

    const events = await registrar.getPastEvents('NameActivated', { fromBlock: fromBlockNumber, toBlock: toBlockNumber });
    const result = new Array<NameActivatedEvent>();

    for (const event of events) {
      const values = event.returnValues;
      const blockTimestamp = (await this.web3.eth.getBlock(event.blockNumber)).timestamp;

      result.push(new NameActivatedEvent(
        'NameActivated',
        event.blockNumber,
        Number(blockTimestamp),
        Number(event.logIndex),
        values.owner,
        values.labelHash,
        values.name,
        event.transactionHash
      ));
    }

    return result;
  }

  public async getNameDeactivatedEvents(fromBlockNumber: number, toBlockNumber: number): Promise<NameDeactivatedEvent[]> {
    const registrar = await this.getDmdRegistrarController();
    if (!registrar) {
      return [];
    }

    const events = await registrar.getPastEvents('NameDeactivated', { fromBlock: fromBlockNumber, toBlock: toBlockNumber });
    const result = new Array<NameDeactivatedEvent>();

    for (const event of events) {
      const values = event.returnValues;
      const blockTimestamp = (await this.web3.eth.getBlock(event.blockNumber)).timestamp;

      result.push(new NameDeactivatedEvent(
        'NameDeactivated',
        event.blockNumber,
        Number(blockTimestamp),
        Number(event.logIndex),
        values.owner,
        values.labelHash,
        values.name,
        event.transactionHash
      ));
    }

    return result;
  }

  public async getNameRenewedEvents(fromBlockNumber: number, toBlockNumber: number): Promise<NameRenewedEvent[]> {
    const registrar = await this.getDmdRegistrarController();
    if (!registrar) {
      return [];
    }

    const events = await registrar.getPastEvents('NameRenewed', { fromBlock: fromBlockNumber, toBlock: toBlockNumber });
    const result = new Array<NameRenewedEvent>();

    for (const event of events) {
      const values = event.returnValues;
      const blockTimestamp = (await this.web3.eth.getBlock(event.blockNumber)).timestamp;

      result.push(new NameRenewedEvent(
        'NameRenewed',
        event.blockNumber,
        Number(blockTimestamp),
        Number(event.logIndex),
        values.owner,
        values.labelHash,
        values.name,
        values.expiration,
        event.transactionHash
      ));
    }

    return result;
  }

  public async getNameBlockedSetEvents(fromBlockNumber: number, toBlockNumber: number): Promise<NameBlockedSetEvent[]> {
    const registrar = await this.getDmdRegistrarController();
    if (!registrar) {
      return [];
    }

    const events = await registrar.getPastEvents('NameBlockedSet', { fromBlock: fromBlockNumber, toBlock: toBlockNumber });
    const result = new Array<NameBlockedSetEvent>();

    for (const event of events) {
      const values = event.returnValues;
      const blockTimestamp = (await this.web3.eth.getBlock(event.blockNumber)).timestamp;

      result.push(new NameBlockedSetEvent(
        'NameBlockedSet',
        event.blockNumber,
        Number(blockTimestamp),
        Number(event.logIndex),
        values.labelHash,
        values.name,
        Boolean(values.blocked),
        event.transactionHash
      ));
    }

    return result;
  }

  public async getDmdNameTransferEvents(fromBlockNumber: number, toBlockNumber: number): Promise<DmdNameTransferEvent[]> {
    const dmdNames = await this.getDmdNames();
    if (!dmdNames) {
      return [];
    }

    const events = await dmdNames.getPastEvents('Transfer', { fromBlock: fromBlockNumber, toBlock: toBlockNumber });
    const result = new Array<DmdNameTransferEvent>();

    for (const event of events) {
      const values = event.returnValues;
      const blockTimestamp = (await this.web3.eth.getBlock(event.blockNumber)).timestamp;

      result.push(new DmdNameTransferEvent(
        'Transfer',
        event.blockNumber,
        Number(blockTimestamp),
        Number(event.logIndex),
        values.from,
        values.to,
        values.tokenId,
        event.transactionHash
      ));
    }

    return result;
  }

  public async getDmdNamingEvents(fromBlockNumber: number, toBlockNumber: number): Promise<ContractEvent[]> {
    const nameRegisteredEvents = await this.getNameRegisteredEvents(fromBlockNumber, toBlockNumber);
    const nameActivatedEvents = await this.getNameActivatedEvents(fromBlockNumber, toBlockNumber);
    const nameDeactivatedEvents = await this.getNameDeactivatedEvents(fromBlockNumber, toBlockNumber);
    const nameRenewedEvents = await this.getNameRenewedEvents(fromBlockNumber, toBlockNumber);
    const nameBlockedSetEvents = await this.getNameBlockedSetEvents(fromBlockNumber, toBlockNumber);
    const transferEvents = await this.getDmdNameTransferEvents(fromBlockNumber, toBlockNumber);

    const result: Array<ContractEvent> = [
      ...nameRegisteredEvents,
      ...nameActivatedEvents,
      ...nameDeactivatedEvents,
      ...nameRenewedEvents,
      ...nameBlockedSetEvents,
      ...transferEvents
    ];

    result.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber;
      }
      return ((a as any).logIndex ?? 0) - ((b as any).logIndex ?? 0);
    });

    return result;
  }

  async getActualEpochEndTime() {
    return blockTimeAsUTC(await (await this.getStakingHbbft()).methods.actualEpochEndTime().call());
  }

  public async getGovernancePot(blockNumber: BlockType): Promise<string> {
    const governanceAddress = await this.getGovernancePotAddress();

    return await this.web3.eth.getBalance(governanceAddress, blockNumber);
  }

  public async getEpoch(blockNumber: BlockType = 'latest'): Promise<number> {
    return h2n(await (await this.getStakingHbbft()).methods.stakingEpoch().call({}, blockNumber));
  }

  public async getEpochStartBlock(blockNumber: BlockType = 'latest'): Promise<number> {
    return h2n(await (await this.getStakingHbbft()).methods.stakingEpochStartBlock().call({}, blockNumber));
  }

  public async getPlacedStakeEvents(fromBlockNumber: number, toBlockNumber: number): Promise<StakeChangedEvent[]> {
    let stakingContract = await this.getStakingHbbft();
    let eventsFilterOptions = { fromBlock: fromBlockNumber, toBlock: toBlockNumber }

    let pastEvents = await stakingContract.getPastEvents('PlacedStake', eventsFilterOptions);

    let result = new Array<StakeChangedEvent>();

    for (let event of pastEvents) {
      let blockNumber = event.blockNumber;
      let returnValues = event.returnValues;

      let blockTimestamp = (await this.web3.eth.getBlock(blockNumber)).timestamp;

      let poolAddress: string = returnValues.toPoolStakingAddress;
      let staker: string = returnValues.staker;
      let epoch: number = returnValues.stakingEpoch;
      let amount: BigNumber = returnValues.amount;

      result.push(new StakeChangedEvent(
        'PlacedStake',
        blockNumber,
        Number(blockTimestamp),
        returnValues.toPoolStakingAddress,
        returnValues.staker,
        returnValues.stakingEpoch,
        returnValues.amount
      ));

      console.log(`${amount} stake placed on Block ${blockNumber} during epoch ${epoch} from ${staker} on pool ${poolAddress}`);
    }

    return result;
  }

  public async getEpochDurationFormatted() {

    function formatTime(seconds: number) {
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = Math.round(seconds % 60)
      const t = [h, m > 9 ? m : h ? '0' + m : m || '0', s > 9 ? s : '0' + s]
        .filter(Boolean)
        .join(':')

      return t + `(${seconds} seconds)`;
    }

    return formatTime(await this.getEpochDuration());
  }

  public async getEpochDuration() {

    const staking = await this.getStakingHbbft();
    return this.web3.utils.toBN(await staking.methods.stakingFixedEpochDuration().call()).toNumber();

  }

  public async getWithdrewStakeEvents(fromBlockNumber: number, toBlockNumber: number): Promise<StakeChangedEvent[]> {
    let stakingContract = await this.getStakingHbbft();
    let eventsFilterOptions = { fromBlock: fromBlockNumber, toBlock: toBlockNumber }

    let events = await stakingContract.getPastEvents('WithdrewStake', eventsFilterOptions);

    let result = new Array<StakeChangedEvent>();

    for (let event of events) {
      let values = event.returnValues;
      let blockTimestamp = (await this.web3.eth.getBlock(event.blockNumber)).timestamp;

      result.push(new StakeChangedEvent(
        'WithdrewStake',
        event.blockNumber,
        Number(blockTimestamp),
        values.fromPoolStakingAddress,
        values.staker,
        values.stakingEpoch,
        values.amount
      ));
    }

    return result;
  }

  public async getIPAddress(poolAddress: string): Promise<NetworkAddress> {


    const stakingHbbft = await this.getStakingHbbft();

    const internet_address_raw = await stakingHbbft.methods.getPoolInternetAddress(poolAddress).call();

    const ip_hex = internet_address_raw["0"];
    const ip_BN = this.web3.utils.toBN(ip_hex);
    const ip_array = ip_BN.toArray("le");
    //console.log("Got IP: ", ip_array);

    const port_hex = internet_address_raw["1"];
    const port = this.web3.utils.toBN(port_hex).toNumber();

    return new NetworkAddress(ip_array, port);
  }

  public async getMovedStakeEvents(fromBlockNumber: number, toBlockNumber: number): Promise<MovedStakeEvent[]> {
    let stakingContract = await this.getStakingHbbft();
    let eventsFilterOptions = { fromBlock: fromBlockNumber, toBlock: toBlockNumber }

    let events = await stakingContract.getPastEvents('MovedStake', eventsFilterOptions);

    let result = new Array<MovedStakeEvent>();

    for (let event of events) {
      let values = event.returnValues;
      let blockTimestamp = (await this.web3.eth.getBlock(event.blockNumber)).timestamp;

      result.push(new MovedStakeEvent(
        'MovedStake',
        event.blockNumber,
        Number(blockTimestamp),
        values.fromPoolStakingAddress,
        values.toPoolStakingAddress,
        values.staker,
        values.stakingEpoch,
        values.amount
      ));
    }

    return result;
  }

  public async getWithdrawalOrderEvents(
    fromBlockNumber: number,
    toBlockNumber: number
  ): Promise<(OrderedWithdrawalEvent | ClaimedOrderedWithdrawalEvent)[]> {
    let stakingContract = await this.getStakingHbbft();
    let eventsFilterOptions = { fromBlock: fromBlockNumber, toBlock: toBlockNumber }

    let result = new Array<OrderedWithdrawalEvent | ClaimedOrderedWithdrawalEvent>();

    let orderWithdrawalEvents = await stakingContract.getPastEvents('OrderedWithdrawal', eventsFilterOptions);

    for (let event of orderWithdrawalEvents) {
      let values = event.returnValues;
      let blockTimestamp = (await this.web3.eth.getBlock(event.blockNumber)).timestamp;

      result.push(new OrderedWithdrawalEvent(
        'OrderedWithdrawal',
        event.blockNumber,
        Number(blockTimestamp),
        values.fromPoolStakingAddress,
        values.staker,
        values.stakingEpoch,
        values.amount
      ));
    }

    let claimOrderedWithdrawalEvents = await stakingContract.getPastEvents('ClaimedOrderedWithdrawal', eventsFilterOptions);

    for (let event of claimOrderedWithdrawalEvents) {
      let values = event.returnValues;
      let blockTimestamp = (await this.web3.eth.getBlock(event.blockNumber)).timestamp;

      result.push(new ClaimedOrderedWithdrawalEvent(
        'ClaimedOrderedWithdrawal',
        event.blockNumber,
        Number(blockTimestamp),
        values.fromPoolStakingAddress,
        values.staker,
        values.stakingEpoch,
        values.amount
      ));
    }

    return result;
  }

  public async getAvailabilityEvents(fromBlockNumber: number, toBlockNumber: number): Promise<AvailabilityEvent[]> {
    // event ValidatorAvailable(msg.sender, timestamp)
    // event ValidatorUnavailable(miningAddress, block.timestamp);

    const blocksFilter = { fromBlock: fromBlockNumber, toBlock: toBlockNumber };
    const validatorSetContract = this.getValidatorSetHbbft();

    let result: AvailabilityEvent[] = new Array<AvailabilityEvent>();

    let becameAvailableEvents = await validatorSetContract.getPastEvents('ValidatorAvailable', blocksFilter);
    let becameUnavailableEvents = await validatorSetContract.getPastEvents('ValidatorUnavailable', blocksFilter);

    for (const event of becameAvailableEvents) {
      const blockNumber = event.blockNumber;
      const returnValues = event.returnValues;

      const poolAddress = await this.getAddressStakingByMining(returnValues.validator, blockNumber)

      result.push(new AvailabilityEvent(
        'ValidatorAvailable',
        blockNumber,
        returnValues.timestamp,
        poolAddress,
        true
      ));
    }

    for (const event of becameUnavailableEvents) {
      const blockNumber = event.blockNumber;
      const returnValues = event.returnValues;

      const poolAddress = await this.getAddressStakingByMining(returnValues.validator, blockNumber)

      result.push(new AvailabilityEvent(
        'ValidatorUnavailable',
        blockNumber,
        returnValues.timestamp,
        poolAddress,
        false
      ));
    }

    return result;
  }

  public async getGatherAbandonedStakesEvents(fromBlockNumber: number, toBlockNumber: number): Promise<GatherAbandonedStakesEvent[]> {
    let stakingContract = await this.getStakingHbbft();
    let eventsFilterOptions = { fromBlock: fromBlockNumber, toBlock: toBlockNumber }

    let events = await stakingContract.getPastEvents('GatherAbandonedStakes', eventsFilterOptions);

    let result = new Array<GatherAbandonedStakesEvent>();

    for (let event of events) {
      let values = event.returnValues;
      let blockTimestamp = (await this.web3.eth.getBlock(event.blockNumber)).timestamp;

      result.push(new GatherAbandonedStakesEvent(
        'GatherAbandonedStakes',
        event.blockNumber,
        Number(blockTimestamp),
        values.caller,
        values.stakingAddress,
        values.gatheredFunds
      ));
    }

    return result;
  }

  public async getStakeUpdateEvents(
    blockNumberFrom: number,
    blockNumberTo: number
  ): Promise<ContractEvent[]> {
    const stakeEvents = await this.getPlacedStakeEvents(blockNumberFrom, blockNumberTo);
    const withdrawalEvents = await this.getWithdrewStakeEvents(blockNumberFrom, blockNumberTo);
    const moveStakeEvents = await this.getMovedStakeEvents(blockNumberFrom, blockNumberTo);
    const orderWithdrawalEvents = await this.getWithdrawalOrderEvents(blockNumberFrom, blockNumberTo);
    const abandonedStakesEvents = await this.getGatherAbandonedStakesEvents(blockNumberFrom, blockNumberTo);

    let result: Array<ContractEvent> = [
      ...stakeEvents,
      ...withdrawalEvents,
      ...moveStakeEvents,
      ...orderWithdrawalEvents,
      ...abandonedStakesEvents
    ];

    result.sort((a, b) => a.blockNumber - b.blockNumber);

    return result;
  }

  public async getAllEvents(fromBlockNumber: number, toBlockNumber: number): Promise<ContractEvent[]> {

    const availabilityEvents = await this.getAvailabilityEvents(fromBlockNumber, toBlockNumber);
    const stakeUpdateEvents = await this.getStakeUpdateEvents(fromBlockNumber, toBlockNumber);
    const dmdNamingEvents = await this.getDmdNamingEvents(fromBlockNumber, toBlockNumber);

    let result: Array<ContractEvent> = [
      ...availabilityEvents,
      ...stakeUpdateEvents,
      ...dmdNamingEvents
    ];

    result.sort((a, b) => a.blockNumber - b.blockNumber);

    return result;
  }

  public async getAvailableSince(miningAddress: string) {
    let availableSince = await this.getValidatorSetHbbft().methods.validatorAvailableSince(miningAddress).call();

    return availableSince;
  }

  public async getReward(pool: string, staker: string, posdaoEpoch: number, block: number): Promise<string> {


    // WARNING: this might not be accurate, since one can add stake in the same block as the reward is calculated.



    // we asume here, that 


    let contract = await this.getStakingHbbft();

    const oldStake = BigNumber(await contract.methods.stakeAmount(pool, staker).call({}, block - 1));
    const newStake = BigNumber(await contract.methods.stakeAmount(pool, staker).call({}, block));
    const reward = newStake.minus(oldStake);

    if (reward.isGreaterThan(0)) {
      console.log("Reward: ", pool, pool == staker ? "" : " delegator: " + staker, reward.toFormat(18));
      return reward.toString(10);
    }

    //contract.methods.getPoolValidatorStakeAmount()
    //let result = await contract.methods.getRewardAmount([posdaoEpoch], pool, staker).call({}, block);

    // we need to figure out the startblock of the posdaoEpoch,
    // we need to figure out the balance the block before.

    // console.log("todo: getReward() called. TODO: adept  https://github.com/DMDcoin/diamond-contracts-core/issues/43");
    return "0";
  }

  public async isValidatorAvailable(miningAddress: string, blockNumber: BlockType = 'latest') {
    const validatorAvailableSince = new BigNumber(await (await this.getValidatorSetHbbft()).methods.validatorAvailableSince(miningAddress).call({}, blockNumber));
    return !validatorAvailableSince.isZero();
  }

  public async getTotalStake(address: string, blockNumber: BlockType = 'latest') {
    return h2bn(await (await this.getStakingHbbft()).methods.stakeAmountTotal(address).call({}, blockNumber));
  }

  public async getMinStake(blockNumber: BlockType = 'latest') {
    return h2bn(await (await this.getStakingHbbft()).methods.candidateMinStake().call({}, blockNumber));
  }

  public async getStake(pool: string, delegator: string) {
    return h2bn(await (await this.getStakingHbbft()).methods.stakeAmount(pool, delegator).call())
  }

  public async getOrderedWithdrawalAmount(pool: string, delegator: string) {

    return this.web3.utils.toBN(await (await this.getStakingHbbft()).methods.orderedWithdrawAmount(pool, delegator).call());
  }

  public async withdraw(pool: string, delegator: string, withdrawAmount: BigNumber) {

    const staking = await this.getStakingHbbft();

    console.log(`Withdrawing ${withdrawAmount.toString()} from pool ${pool} for delegator ${delegator}`);

    // let validators = await this.getValidators();


    // let miningAddress = await this.getAddressStakingByMining(delegator);

    const tx = staking.methods.withdraw(pool, withdrawAmount.toString()).send({ from: delegator, gas: 300000 });

    await tx;

    return tx;
  }


  public async orderWithdraw(pool: string, delegator: string, withdrawAmount: BigNumber) {

    const staking = await this.getStakingHbbft();
    console.log(`ordering Withdraw ${withdrawAmount.toString()} from pool ${pool} for delegator ${delegator}`);

    // let validators = await this.getValidators();
    // let miningAddress = await this.getAddressStakingByMining(delegator);

    const tx = staking.methods.orderWithdraw(pool, withdrawAmount.toString()).send({ from: delegator, gas: 300000 });
    await tx;
    return tx;
  }


  public async getValidators(blockNumber: BlockType = 'latest') {
    return await this.getValidatorSetHbbft().methods.getValidators().call({}, blockNumber);
  }

  // public async getValidatorAdded() {
  //   return await (await this.getStakingHbbft()).events.ValidatorAdded().call({});
  // }

  public async getPools(blockNumber: BlockType = 'latest'): Promise<string[]> {
    return await (await this.getStakingHbbft()).methods.getPools().call({}, blockNumber);
  }

  public async getPoolsInactive(blockNumber: BlockType = 'latest'): Promise<string[]> {
    return await (await this.getStakingHbbft()).methods.getPoolsInactive().call({}, blockNumber);
  }

  public async getAllPools(blockNumber: BlockType = 'latest'): Promise<string[]> {
    let pools = await this.getPools(blockNumber);
    let poolsInactive = await this.getPoolsInactive(blockNumber);

    let result = pools.concat(poolsInactive);
    return result;
  }

  public async getPoolDelegators(poolAddress: string, blockNumber: BlockType = 'latest'): Promise<string[]> {
    return await (await this.getStakingHbbft()).methods.poolDelegators(poolAddress).call({}, blockNumber);
  }

  public async getPoolDelegatorsInactive(poolAddress: string, blockNumber: BlockType = 'latest'): Promise<string[]> {
    return await (await this.getStakingHbbft()).methods.poolDelegatorsInactive(poolAddress).call({}, blockNumber);
  }

  public async getAllPoolDelegators(poolAddress: string, blockNumber: BlockType = 'latest'): Promise<string[]> {
    const delegators = await this.getPoolDelegators(poolAddress, blockNumber);
    const delegatorsInactive = await this.getPoolDelegatorsInactive(poolAddress, blockNumber);

    return [
      ...delegators,
      ...delegatorsInactive
    ];
  }

  public async getValidatorCandidates(blockNumber: BlockType = 'latest') {
    // todo: for performance reasons we could need a getValidatorCandidates on contract level,
    // to make it easier for ui's to get active pools only
    const pools = await this.getPools(blockNumber);
    const minStake = await this.getMinStake(blockNumber);

    const result: Array<string> = [];
    for (let p of pools) {
      const poolStake = await this.getTotalStake(p, blockNumber);
      if (poolStake.gte(minStake)) {
        result.push(p);
      }
    }

    return pools;
  }

  public async getPendingValidators(blockNumber: BlockType = 'latest') {
    return await this.getValidatorSetHbbft().methods.getPendingValidators().call({}, blockNumber);
  }

  public async getPreviousValidators(blockNumber: BlockType = 'latest'): Promise<string[]> {
    return await this.getValidatorSetHbbft().methods.getPreviousValidators().call({}, blockNumber);
  }

  public async getPendingValidatorStateFormatted(validator: string, blockNumber: BlockType = 'latest'): Promise<string> {
    const raw = await this.getPendingValidatorState(validator, blockNumber);
    // todo: make this more readable like "Pending (3)"
    return raw.toString();

  }

  public async getPendingValidatorState(validator: string, blockNumber: BlockType = 'latest'): Promise<KeyGenMode> {
    return h2n(await this.getValidatorSetHbbft().methods
      .getPendingValidatorKeyGenerationMode(validator).call({}, blockNumber));
  }

  public async getAddressStakingByMining(miningAddress: string, blockNumber: BlockType = 'latest') {
    return this.getValidatorSetHbbft().methods.stakingByMiningAddress(miningAddress).call({}, blockNumber);
  }

  public async getAddressMiningByStaking(stakingAddress: string, blockNumber: BlockType = 'latest') {
    return this.getValidatorSetHbbft().methods.miningByStakingAddress(stakingAddress).call({}, blockNumber);
  }

  public async getPublicKey(poolAddress: string, blockNumber: BlockType = 'latest') {
    return this.getValidatorSetHbbft().methods.publicKeyByStakingAddress(poolAddress).call({}, blockNumber);
  }

  public async getKeyPARTBytesLength(validator: string, blockNumber: BlockType = 'latest') {
    const part = await this.getKeyPART(validator, blockNumber);
    if (!part) {
      return 0;
    }
    return (part.length - 2) / 2;
  }

  public async getKeyPART(validator: string, blockNumber: BlockType = 'latest'): Promise<string> {
    return await (await this.getKeyGenHistory()).methods.getPart(validator).call({}, blockNumber);
  }

  // retrieves only the number of written Acks (so not that much data has to get transferted.
  public async getKeyACKSNumber(validator: string, blockNumber: BlockType = 'latest'): Promise<number> {
    return h2n(await (await this.getKeyGenHistory()).methods.getAcksLength(validator).call({}, blockNumber));
  }

  // public async getRewardsUnclaimed(blockNumber: number) {

  //   return "0";
  // }

  public async getRewardContractTotal(blockNumber: BlockType) {
    const contractAddress = await this.getValidatorSetHbbft().methods.blockRewardContract().call({}, blockNumber);
    let balance = await this.web3.eth.getBalance(contractAddress, blockNumber);
    return balance;
  }

  public async getRewardReinsertPot(blockNumber: BlockType) {
    let contract = await this.getRewardHbbft();
    return await contract.methods.reinsertPot().call({}, blockNumber);
  }

  public async getRewardDeltaPot(blockNumber: BlockType) {
    let contract = await this.getRewardHbbft();
    return await contract.methods.deltaPot().call({}, blockNumber);
  }

  public async getKeyGenRound(blockNumber: BlockType = 'latest') {
    return h2n(await (await this.getKeyGenHistory()).methods.getCurrentKeyGenRound().call({}, blockNumber));
  }

  public async getBlockInfos(blockHeader: BlockTransactionString, blockBeforeTimestamp: number) {
    const timeStamp = Number.parseInt(String(blockHeader.timestamp));
    const blockBeforeTimeStamp = blockBeforeTimestamp;
    const duration = timeStamp - blockBeforeTimeStamp;
    const transaction_count = blockHeader.transactions.length;
    const txs_per_sec = transaction_count / duration;
    const posdaoEpoch = await this.getEpoch(blockHeader.number);
    return { timeStamp, duration, transaction_count, txs_per_sec, posdaoEpoch };
  }

  public async getEpochPoolNativeReward(
    epoch: number,
    miningAddress: string,
    blockNumber: number
  ): Promise<BigNumber> {
    const rewardContract = await this.getRewardHbbft();
    const result = await rewardContract.methods.epochPoolNativeReward(epoch, miningAddress).call({}, blockNumber);
    return parseEther(result);
  }

  public async getValidatorMinRewardPercent(
    epoch: number,
    blockNumber: number
  ): Promise<number> {
    if (this.cachedValidatorMinRewardPercent.has(epoch)) {
      return this.cachedValidatorMinRewardPercent.get(epoch)!;
    }
    const rewardContract = await this.getRewardHbbft();
    const result = h2n(await rewardContract.methods.validatorMinRewardPercent(epoch).call({}, blockNumber));
    this.cachedValidatorMinRewardPercent.set(epoch, result);
    return result;
  }

  public async getSnapshotPoolTotalStakeAmount(
    epoch: number,
    poolStakingAddress: string
  ): Promise<BigNumber> {
    const staking = await this.getStakingHbbft();
    const result = await staking.methods.snapshotPoolTotalStakeAmount(epoch, poolStakingAddress).call();
    return parseEther(result);
  }

  public async getSnapshotPoolValidatorStakeAmount(
    epoch: number,
    poolStakingAddress: string
  ): Promise<BigNumber> {
    const staking = await this.getStakingHbbft();
    const result = await staking.methods.snapshotPoolValidatorStakeAmount(epoch, poolStakingAddress).call();
    return parseEther(result);
  }

  public async getPoolNodeOperatorShare(
    poolStakingAddress: string,
    blockNumber: number
  ): Promise<number> {
    const staking = await this.getStakingHbbft();
    return h2n(await staking.methods.poolNodeOperatorShare(poolStakingAddress).call({}, blockNumber));
  }

  public async getRestakeRewardEvents(
    fromBlock: number,
    toBlock: number
  ): Promise<RestakeRewardEvent[]> {
    const staking = await this.getStakingHbbft();
    const events = await staking.getPastEvents('RestakeReward', { fromBlock, toBlock });
    return events.map(event => ({
      poolStakingAddress: event.returnValues.poolStakingAddress,
      stakingEpoch: Number(event.returnValues.stakingEpoch),
      validatorReward: parseEther(event.returnValues.validatorReward),
      delegatorsReward: parseEther(event.returnValues.delegatorsReward),
    }));
  }

  public async getDelegateRewards(
    pool: string,
    miningAddress: string,
    epoch: number,
    epochSnapshotBlock: number,
    eventValidatorReward: BigNumber,
    eventDelegatorsReward: BigNumber
  ): Promise<{
    apy: BigNumber;
    rewards: DelegateRewardData[];
    totalPoolReward: BigNumber;
    validatorFixed: BigNumber;
    nodeOperatorReward: BigNumber;
    delegatorsTotal: BigNumber;
    totalStake: BigNumber;
  }> {
    const staking = await this.getStakingHbbft();

    const poolReward = eventValidatorReward.plus(eventDelegatorsReward);
    const validatorFixed = eventValidatorReward;
    const delegatorsTotal = eventDelegatorsReward;
    const operatorSharePct = await this.getPoolNodeOperatorShare(pool, epochSnapshotBlock);
    const nodeOperatorReward = poolReward.times(operatorSharePct).div(10000);
    const totalStake = await this.getSnapshotPoolTotalStakeAmount(epoch, pool);

    const delegators = await this.getAllPoolDelegators(pool, epochSnapshotBlock);
    const result = new Array<DelegateRewardData>();

    for (const delegator of delegators) {
      const delegatorStake = parseEther(
        await staking.methods.stakeAmount(pool, delegator).call({}, epochSnapshotBlock)
      );
      const delegatorReward = totalStake.isZero()
        ? BigNumber(0)
        : delegatorsTotal.times(delegatorStake).div(totalStake);

      result.push({
        poolAddress: pool,
        delegatorAddress: delegator,
        epoch: epoch,
        isClaimed: true, // since auto restake, rewards are considered always as claimed: https://github.com/DMDcoin/diamond-contracts-core/issues/43
        amount: delegatorReward
      });
    }

    // reward amount per 10_000 staked DMD
    const apy = totalStake.isZero()
      ? BigNumber(0)
      : delegatorsTotal.times(this.apyStakeFraction).div(totalStake);

    return { apy, rewards: result, totalPoolReward: poolReward, validatorFixed, nodeOperatorReward, delegatorsTotal, totalStake };
  }


  public async getStakeLastEpoch(pool: string, delegator: string, blockNumber: number): Promise<bigint> {

    console.log("warn: getStakeLastEpoch() called. not implemented since https://github.com/DMDcoin/diamond-contracts-core/issues/43");
    return BigInt(0);
  }

  public async getValidatorAvailableSince(validator: string, blockNumber: BlockType = 'latest'): Promise<number> {
    return toNumber(await this.getValidatorSetHbbft().methods.validatorAvailableSince(validator).call({}, blockNumber));
  }
}
