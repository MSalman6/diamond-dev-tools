interface BaseEvent {
    eventName: string;
    blockNumber: number;
    blockTimestamp: number;

    accept(visitor: BaseVisitor): Promise<void>;
}

interface BaseVisitor {
    visitAvailabilityEvents(event: any): Promise<void>;
    visitOrderedWithdrawalEvent(event: any): Promise<void>;
    visitClaimedOrderedWithdrawalEvent(event: any): Promise<void>;
    visitStakeChangedEvent(event: any): Promise<void>;
    visitMovedStakeEvent(event: any): Promise<void>;
    visitGatherAbandonedStakesEvent(event: any): Promise<void>;
}

/**
 * Represents a bonus score change event with reason tracking
 */
export class BonusScoreChangeEvent implements BaseEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockTimestamp: number,
        public validator: string,
        public poolAddress: string,
        public epoch: number,
        public previousScore: number,
        public newScore: number,
        public scoreChange: number,
        public reason: BonusScoreChangeReason,
        public reasonData: any
    ) { }

    public async accept(visitor: BaseVisitor): Promise<void> {
        // If visitor supports bonus score change events, call it
        if ('visitBonusScoreChangeEvent' in visitor) {
            await (visitor as ExtendedBaseVisitor).visitBonusScoreChangeEvent(this);
        }
    }
}

/**
 * Reason categories for bonus score changes
 */
export enum BonusScoreChangeReason {
    StandByBonus = "StandByBonus",
    NoStandByPenalty = "NoStandByPenalty", 
    NoKeyWritePenalty = "NoKeyWritePenalty",
    BadPerformancePenalty = "BadPerformancePenalty",
    Unknown = "Unknown"
}

/**
 * Extended visitor interface for bonus score change events
 */
export interface ExtendedBaseVisitor extends BaseVisitor {
    visitBonusScoreChangeEvent(event: BonusScoreChangeEvent): Promise<void>;
}

/**
 * Reason detection data structure
 */
export interface ReasonDetectionContext {
    validator: string;
    poolAddress: string;
    blockNumber: number;
    epoch: number;
    previousScore: number;
    newScore: number;
    scoreChange: number;
    
    // Data sources for reason detection
    isValidatorInSet?: boolean;
    isValidatorConnected?: boolean;
    hasValidatorSubmittedKeys?: boolean;
    validatorPerformanceRatio?: number;
    validatorAvailableSince?: number;
    
    // Additional context
    epochStartBlock?: number;
    epochEndBlock?: number;
    requiredKeysCount?: number;
    submittedKeysCount?: number;
    producedBlocksCount?: number;
    expectedBlocksCount?: number;
}
