import BigNumber from "bignumber.js";

import { DbManager, pgNumericToBn } from "./db/database";
import { addressToBuffer, parseEther } from "./utils/ether";
import { hexToBuffer, tokenIdToLabelHash } from "./utils/hex";


interface BaseEvent {
    eventName: string;
    blockNumber: number;
    blockTimestamp: number;
    logIndex?: number;

    accept(visitor: BaseVisitor): Promise<void>;
}

interface BaseVisitor {
    visitAvailabilityEvents(event: AvailabilityEvent): Promise<void>;

    visitOrderedWithdrawalEvent(event: OrderedWithdrawalEvent): Promise<void>;

    visitClaimedOrderedWithdrawalEvent(event: ClaimedOrderedWithdrawalEvent): Promise<void>;

    visitStakeChangedEvent(event: StakeChangedEvent): Promise<void>;

    visitMovedStakeEvent(event: MovedStakeEvent): Promise<void>;

    visitGatherAbandonedStakesEvent(event: GatherAbandonedStakesEvent): Promise<void>;

    visitNameRegisteredEvent(event: NameRegisteredEvent): Promise<void>;

    visitNameActivatedEvent(event: NameActivatedEvent): Promise<void>;

    visitNameDeactivatedEvent(event: NameDeactivatedEvent): Promise<void>;

    visitNameRenewedEvent(event: NameRenewedEvent): Promise<void>;

    visitNameBlockedSetEvent(event: NameBlockedSetEvent): Promise<void>;

    visitDmdNameTransferEvent(event: DmdNameTransferEvent): Promise<void>;
}

export class StakeChangedEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public poolAddress: string,
        public stakerAddress: string,
        public epoch: number,
        public amount: string
    ) { }

    public async accept(visitor: BaseVisitor): Promise<void> {
        await visitor.visitStakeChangedEvent(this)
    }

    public isDelegatorStake(): boolean {
        return this.poolAddress != this.stakerAddress;
    }

    public isPlaceStakeEvent(): boolean {
        return this.eventName == 'PlacedStake';
    }

    public getStakeChangeAmount(): BigNumber {
        const bnAmount = parseEther(this.amount);

        return this.eventName == 'WithdrewStake' ? bnAmount.negated() : bnAmount;
    }
}

export class MovedStakeEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public fromPoolAddress: string,
        public toPoolAddress: string,
        public stakerAddress: string,
        public epoch: number,
        public amount: string
    ) { }

    public async accept(visitor: BaseVisitor): Promise<void> {
        await visitor.visitMovedStakeEvent(this)
    }
}

export class OrderedWithdrawalEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public poolAddress: string,
        public stakerAddress: string,
        public epoch: number,
        public amount: string
    ) { }

    public async accept(visitor: BaseVisitor): Promise<void> {
        await visitor.visitOrderedWithdrawalEvent(this);
    }
}

export class ClaimedOrderedWithdrawalEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public poolAddress: string,
        public stakerAddress: string,
        public epoch: number,
        public amount: string
    ) { }

    public async accept(visitor: BaseVisitor): Promise<void> {
        await visitor.visitClaimedOrderedWithdrawalEvent(this);
    }
}

export class GatherAbandonedStakesEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public caller: string,
        public poolAddress: string,
        public amount: string
    ) {}

    public async accept(visitor: BaseVisitor): Promise<void> {
        await visitor.visitGatherAbandonedStakesEvent(this);
    }
}

export class AvailabilityEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public poolAddress: string,
        public available: boolean
    ) { }

    public async accept(visitor: BaseVisitor): Promise<void> {
        await visitor.visitAvailabilityEvents(this)
    }
}

export class NameRegisteredEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public logIndex: number,
        public owner: string,
        public labelHash: string,
        public name: string,
        public expiration: string,
        public txHash: string
    ) { }

    public async accept(visitor: BaseVisitor): Promise<void> {
        await visitor.visitNameRegisteredEvent(this);
    }
}

export class NameActivatedEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public logIndex: number,
        public owner: string,
        public labelHash: string,
        public name: string,
        public txHash: string
    ) { }

    public async accept(visitor: BaseVisitor): Promise<void> {
        await visitor.visitNameActivatedEvent(this);
    }
}

export class NameDeactivatedEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public logIndex: number,
        public owner: string,
        public labelHash: string,
        public name: string,
        public txHash: string
    ) { }

    public async accept(visitor: BaseVisitor): Promise<void> {
        await visitor.visitNameDeactivatedEvent(this);
    }
}

export class NameRenewedEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public logIndex: number,
        public owner: string,
        public labelHash: string,
        public name: string,
        public expiration: string,
        public txHash: string
    ) { }

    public async accept(visitor: BaseVisitor): Promise<void> {
        await visitor.visitNameRenewedEvent(this);
    }
}

export class NameBlockedSetEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public logIndex: number,
        public labelHash: string,
        public name: string,
        public blocked: boolean,
        public txHash: string
    ) { }

    public async accept(visitor: BaseVisitor): Promise<void> {
        await visitor.visitNameBlockedSetEvent(this);
    }
}

export class DmdNameTransferEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public logIndex: number,
        public from: string,
        public to: string,
        public tokenId: string,
        public txHash: string
    ) { }

    public async accept(visitor: BaseVisitor): Promise<void> {
        await visitor.visitDmdNameTransferEvent(this);
    }

    public isMint(): boolean {
        return BigInt(this.from) === BigInt(0);
    }
}


/**
 * @TODO extract same ports to separate method from visit functions
 */
export class EventVisitor implements BaseVisitor {
    public constructor(
        public dbManager: DbManager
    ) { }

    public async visitAvailabilityEvents(event: AvailabilityEvent): Promise<void> {
        await this.dbManager.insertAvailabilityEvent({
            became_available: event.available,
            block: event.blockNumber,
            node: addressToBuffer(event.poolAddress)
        });
    }

    public async visitOrderedWithdrawalEvent(event: OrderedWithdrawalEvent): Promise<void> {
        // Record individual transaction
        await this.dbManager.insertStakeTransaction({
            block_number: event.blockNumber,
            block_timestamp: event.blockTimestamp,
            action_type: 'OrderedWithdrawal',
            pool_address: event.poolAddress,
            staker_address: event.stakerAddress,
            amount: event.amount,
            staking_epoch: event.epoch,
            is_delegator_stake: event.poolAddress !== event.stakerAddress
        });

        const existingOrder = await this.dbManager.getOrderWithdrawalEvent({
            from_pool_stakingAddress: addressToBuffer(event.poolAddress),
            staker: addressToBuffer(event.stakerAddress),
            claimed_on_block: null
        });

        const eventAmount = parseEther(event.amount);

        if (existingOrder == null) {
            await this.dbManager.insertOrderWithdrawalEvent({
                block_number: event.blockNumber,
                from_pool_stakingAddress: addressToBuffer(event.poolAddress),
                staker: addressToBuffer(event.stakerAddress),
                staking_epoch: event.epoch,
                amount: eventAmount.toString()
            });

            return;
        }

        const previousAmount = new BigNumber(existingOrder.amount);
        const newAmount = previousAmount.plus(eventAmount);

        await this.dbManager.updateOrderWithdrawalEvent(
            { id: existingOrder.id },
            {
                staking_epoch: event.epoch,
                block_number: event.blockNumber,
                amount: newAmount.toString()
            }
        );
    }

    public async visitClaimedOrderedWithdrawalEvent(event: ClaimedOrderedWithdrawalEvent): Promise<void> {
        // Record individual transaction
        await this.dbManager.insertStakeTransaction({
            block_number: event.blockNumber,
            block_timestamp: event.blockTimestamp,
            action_type: 'ClaimedOrderedWithdrawal',
            pool_address: event.poolAddress,
            staker_address: event.stakerAddress,
            amount: event.amount,
            staking_epoch: event.epoch,
            is_delegator_stake: event.poolAddress !== event.stakerAddress
        });

        const existingOrder = await this.dbManager.getOrderWithdrawalEvent({
            from_pool_stakingAddress: addressToBuffer(event.poolAddress),
            staker: addressToBuffer(event.stakerAddress),
            claimed_on_block: null
        });

        const stakeRecord = await this.dbManager.getLastStakeHistoryRecord(event.poolAddress);

        if (existingOrder == null || stakeRecord == null) {
            console.log(
                `Found unmatched ClaimedOrderedWithdrawalEvent at block
                ${event.blockNumber} from ${event.stakerAddress} for pool ${event.poolAddress}`
            );

            return;
        }

        await this.dbManager.updateOrderWithdrawalEvent(
            { id: existingOrder.id },
            { claimed_on_block: event.blockNumber }
        );

        const currentStake = pgNumericToBn(stakeRecord.stake_amount);
        const changeAmount = parseEther(event.amount);
        const newAmount = currentStake.minus(changeAmount);

        await this.dbManager.updateStakeHistory({
            from_block: stakeRecord.from_block,
            to_block: stakeRecord.to_block,
            node: stakeRecord.node
        }, {
            to_block: event.blockNumber - 1,
        });

        await this.dbManager.insertStakeHistoryRecord({
            from_block: event.blockNumber,
            to_block: event.blockNumber,
            node: stakeRecord.node,
            stake_amount: newAmount.toString()
        });
    }

    public async visitStakeChangedEvent(event: StakeChangedEvent): Promise<void> {
        // Record individual transaction (PlacedStake or WithdrewStake)
        await this.dbManager.insertStakeTransaction({
            block_number: event.blockNumber,
            block_timestamp: event.blockTimestamp,
            action_type: event.eventName,
            pool_address: event.poolAddress,
            staker_address: event.stakerAddress,
            amount: event.amount,
            staking_epoch: event.epoch,
            is_delegator_stake: event.isDelegatorStake()
        });

        let changeAmount = event.getStakeChangeAmount();

        if (event.isDelegatorStake()) {
            await this.dbManager.insertDelegateStaker([event.stakerAddress]);
            await this.saveDelegatedStake(event.poolAddress, event.stakerAddress, changeAmount);
        }

        const record = await this.dbManager.getLastStakeHistoryRecord(event.poolAddress);

        if (record == null) {
            await this.dbManager.insertStakeHistoryRecord({
                from_block: event.blockNumber,
                to_block: event.blockNumber,
                stake_amount: parseEther(event.amount).toString(),
                node: addressToBuffer(event.poolAddress)
            });

            return;
        }

        const currentStake = pgNumericToBn(record.stake_amount);
        const newAmount = currentStake.plus(changeAmount)

        await this.dbManager.updateStakeHistory({
            from_block: record.from_block,
            to_block: record.to_block,
            node: record.node
        }, {
            to_block: event.blockNumber - 1,
        });

        await this.dbManager.insertStakeHistoryRecord({
            from_block: event.blockNumber,
            to_block: event.blockNumber,
            node: record.node,
            stake_amount: newAmount.toString()
        });
    }

    public async visitMovedStakeEvent(event: MovedStakeEvent): Promise<void> {
        // Record individual transaction
        await this.dbManager.insertStakeTransaction({
            block_number: event.blockNumber,
            block_timestamp: event.blockTimestamp,
            action_type: 'MovedStake',
            pool_address: event.fromPoolAddress,
            staker_address: event.stakerAddress,
            to_pool_address: event.toPoolAddress,
            amount: event.amount,
            staking_epoch: event.epoch,
            is_delegator_stake: event.fromPoolAddress !== event.stakerAddress
        });

        const fromPoolRecord = await this.dbManager.getLastStakeHistoryRecord(event.fromPoolAddress);

        if (fromPoolRecord == null) {
            console.log(
                `Found unmatched MoveStake event at block
                ${event.blockNumber} from ${event.stakerAddress} for pool ${event.fromPoolAddress}`
            );
            return;
        }

        const movedAmount = parseEther(event.amount);
        const fromPoolUpdatedStake = pgNumericToBn(fromPoolRecord.stake_amount).minus(movedAmount)

        // close previous time frame of fromPoolAddress
        await this.dbManager.updateStakeHistory({
            from_block: fromPoolRecord.from_block,
            to_block: fromPoolRecord.to_block,
            node: fromPoolRecord.node
        }, {
            to_block: event.blockNumber - 1,
        });

        // create new record for fromPoolAddress
        await this.dbManager.insertStakeHistoryRecord({
            from_block: event.blockNumber,
            to_block: event.blockNumber,
            stake_amount: fromPoolUpdatedStake.toString(),
            node: fromPoolRecord.node
        });

        const toPoolRecord = await this.dbManager.getLastStakeHistoryRecord(event.toPoolAddress);
        let toPoolUpdatedStake = BigNumber(0);

        // if record for new pool already exists, close previous time frame
        if (toPoolRecord != null) {
            await this.dbManager.updateStakeHistory({
                from_block: toPoolRecord.from_block,
                to_block: toPoolRecord.to_block,
                node: toPoolRecord.node
            }, {
                to_block: event.blockNumber - 1,
            });

            toPoolUpdatedStake = pgNumericToBn(toPoolRecord.stake_amount);
        }

        toPoolUpdatedStake = toPoolUpdatedStake.plus(movedAmount);

        // insert new time frame
        await this.dbManager.insertStakeHistoryRecord({
            from_block: event.blockNumber,
            to_block: event.blockNumber,
            node: addressToBuffer(event.toPoolAddress),
            stake_amount: toPoolUpdatedStake.toString()
        });

        if (event.fromPoolAddress != event.stakerAddress) {
            // If moving out delegated stake, db table delegator record stake must be reduced
            await this.saveDelegatedStake(event.fromPoolAddress, event.stakerAddress, movedAmount.negated());
        }

        if (event.toPoolAddress != event.stakerAddress) {
            // Save delegated stake info if it was moved
            await this.saveDelegatedStake(event.toPoolAddress, event.stakerAddress, movedAmount);
        }
    }

    public async visitGatherAbandonedStakesEvent(event: GatherAbandonedStakesEvent): Promise<void> {
        // Record individual transaction
        await this.dbManager.insertStakeTransaction({
            block_number: event.blockNumber,
            block_timestamp: event.blockTimestamp,
            action_type: 'GatherAbandonedStakes',
            pool_address: event.poolAddress,
            caller_address: event.caller,
            amount: event.amount,
            is_delegator_stake: false
        });

        const record = await this.dbManager.getLastStakeHistoryRecord(event.poolAddress);

        if (record == null) {
            console.log(`Found unmatched MoveStake event at block ${event.blockNumber} for pool ${event.poolAddress}`);
            return;
        }

        // close previous time frame of fromPoolAddress
        await this.dbManager.updateStakeHistory({
            from_block: record.from_block,
            to_block: record.to_block,
            node: record.node
        }, {
            to_block: event.blockNumber - 1,
        });

        const gatheredAmount = parseEther(event.amount);
        const stakeAmount = pgNumericToBn(record.stake_amount).minus(gatheredAmount);

        // insert new time frame
        await this.dbManager.insertStakeHistoryRecord({
            from_block: event.blockNumber,
            to_block: event.blockNumber,
            node: addressToBuffer(event.poolAddress),
            stake_amount: stakeAmount.toString()
        });
    }

    public async visitNameRegisteredEvent(event: NameRegisteredEvent): Promise<void> {
        const labelHash = hexToBuffer(event.labelHash);

        await this.dbManager.upsertDmdName({
            label_hash: labelHash,
            label: event.name,
            owner: null,
            creator: null,
            created_block: event.blockNumber,
            created_timestamp: event.blockTimestamp,
            expiration: event.expiration,
            active: null,
            blocked: null,
            last_action_type: 'Registered',
            last_action_block: event.blockNumber,
            last_action_timestamp: event.blockTimestamp
        });

        await this.dbManager.insertDmdNameEvent({
            label_hash: labelHash,
            label: event.name,
            event_type: 'Registered',
            actor_address: addressToBuffer(event.owner),
            from_address: null,
            to_address: null,
            expiration: event.expiration,
            blocked: null,
            block_number: event.blockNumber,
            block_timestamp: event.blockTimestamp,
            tx_hash: hexToBuffer(event.txHash)
        });
    }

    public async visitNameActivatedEvent(event: NameActivatedEvent): Promise<void> {
        const labelHash = hexToBuffer(event.labelHash);

        await this.dbManager.upsertDmdName({
            label_hash: labelHash,
            label: event.name,
            owner: null,
            creator: null,
            created_block: null,
            created_timestamp: null,
            expiration: null,
            active: true,
            blocked: null,
            last_action_type: 'Activated',
            last_action_block: event.blockNumber,
            last_action_timestamp: event.blockTimestamp
        });

        await this.dbManager.insertDmdNameEvent({
            label_hash: labelHash,
            label: event.name,
            event_type: 'Activated',
            actor_address: addressToBuffer(event.owner),
            from_address: null,
            to_address: null,
            expiration: null,
            blocked: null,
            block_number: event.blockNumber,
            block_timestamp: event.blockTimestamp,
            tx_hash: hexToBuffer(event.txHash)
        });
    }

    public async visitNameDeactivatedEvent(event: NameDeactivatedEvent): Promise<void> {
        const labelHash = hexToBuffer(event.labelHash);

        await this.dbManager.upsertDmdName({
            label_hash: labelHash,
            label: event.name,
            owner: null,
            creator: null,
            created_block: null,
            created_timestamp: null,
            expiration: null,
            active: false,
            blocked: null,
            last_action_type: 'Deactivated',
            last_action_block: event.blockNumber,
            last_action_timestamp: event.blockTimestamp
        });

        await this.dbManager.insertDmdNameEvent({
            label_hash: labelHash,
            label: event.name,
            event_type: 'Deactivated',
            actor_address: addressToBuffer(event.owner),
            from_address: null,
            to_address: null,
            expiration: null,
            blocked: null,
            block_number: event.blockNumber,
            block_timestamp: event.blockTimestamp,
            tx_hash: hexToBuffer(event.txHash)
        });
    }

    public async visitNameRenewedEvent(event: NameRenewedEvent): Promise<void> {
        const labelHash = hexToBuffer(event.labelHash);

        await this.dbManager.upsertDmdName({
            label_hash: labelHash,
            label: event.name,
            owner: null,
            creator: null,
            created_block: null,
            created_timestamp: null,
            expiration: event.expiration,
            active: null,
            blocked: null,
            last_action_type: 'Renewed',
            last_action_block: event.blockNumber,
            last_action_timestamp: event.blockTimestamp
        });

        await this.dbManager.insertDmdNameEvent({
            label_hash: labelHash,
            label: event.name,
            event_type: 'Renewed',
            actor_address: addressToBuffer(event.owner),
            from_address: null,
            to_address: null,
            expiration: event.expiration,
            blocked: null,
            block_number: event.blockNumber,
            block_timestamp: event.blockTimestamp,
            tx_hash: hexToBuffer(event.txHash)
        });
    }

    public async visitNameBlockedSetEvent(event: NameBlockedSetEvent): Promise<void> {
        const labelHash = hexToBuffer(event.labelHash);

        await this.dbManager.upsertDmdName({
            label_hash: labelHash,
            label: event.name,
            owner: null,
            creator: null,
            created_block: null,
            created_timestamp: null,
            expiration: null,
            active: null,
            blocked: event.blocked,
            last_action_type: 'BlockedSet',
            last_action_block: event.blockNumber,
            last_action_timestamp: event.blockTimestamp
        });

        await this.dbManager.insertDmdNameEvent({
            label_hash: labelHash,
            label: event.name,
            event_type: 'BlockedSet',
            actor_address: null,
            from_address: null,
            to_address: null,
            expiration: null,
            blocked: event.blocked,
            block_number: event.blockNumber,
            block_timestamp: event.blockTimestamp,
            tx_hash: hexToBuffer(event.txHash)
        });
    }

    public async visitDmdNameTransferEvent(event: DmdNameTransferEvent): Promise<void> {
        const labelHash = hexToBuffer(tokenIdToLabelHash(event.tokenId));
        const isMint = event.isMint();

        await this.dbManager.upsertDmdName({
            label_hash: labelHash,
            label: null,
            owner: addressToBuffer(event.to),
            creator: isMint ? addressToBuffer(event.to) : null,
            created_block: isMint ? event.blockNumber : null,
            created_timestamp: isMint ? event.blockTimestamp : null,
            expiration: null,
            active: isMint ? false : null,
            blocked: null,
            last_action_type: 'Transfer',
            last_action_block: event.blockNumber,
            last_action_timestamp: event.blockTimestamp
        });

        await this.dbManager.insertDmdNameEvent({
            label_hash: labelHash,
            label: null,
            event_type: 'Transfer',
            actor_address: addressToBuffer(event.to),
            from_address: addressToBuffer(event.from),
            to_address: addressToBuffer(event.to),
            expiration: null,
            blocked: null,
            block_number: event.blockNumber,
            block_timestamp: event.blockTimestamp,
            tx_hash: hexToBuffer(event.txHash)
        });
    }

    private async saveDelegatedStake(
        pool: string,
        delegator: string,
        amount: BigNumber
    ): Promise<void> {

        await this.dbManager.ensureDelegateStaker(delegator);

        const delegateRecord = await this.dbManager.getStakeDelegator(pool, delegator);

        if (delegateRecord != null) {
            const newStakeAmount = pgNumericToBn(delegateRecord.total_delegated).plus(amount);

            await this.dbManager.updateStakeDelegator(pool, delegator, newStakeAmount.toString());
        } else {
            await this.dbManager.insertStakeDelegator(pool, delegator, amount.toString());
        }
    }
}
