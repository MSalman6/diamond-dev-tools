import { ContractManager } from "./contractManager";
import { BonusScoreChangeReason, ReasonDetectionContext } from "./bonusScoreChangeEvent";

export class BonusScoreReasonDetector {
    
    public constructor(
        private contractManager: ContractManager
    ) {}

    public async detectReason(context: ReasonDetectionContext): Promise<BonusScoreChangeReason> {
        try {
            // If score increased, likely a StandByBonus
            if (context.scoreChange > 0) {
                return await this.detectPositiveScoreReason(context);
            }
            
            // If score decreased, detect penalty type
            if (context.scoreChange < 0) {
                return await this.detectNegativeScoreReason(context);
            }
            
            // No change - unlikely
            return BonusScoreChangeReason.Unknown;
            
        } catch (error) {
            console.warn(`Error detecting bonus score reason for validator ${context.validator}:`, error);
            return BonusScoreChangeReason.Unknown;
        }
    }

    /**
     * Detect reason for positive score changes (bonuses)
     */
    private async detectPositiveScoreReason(context: ReasonDetectionContext): Promise<BonusScoreChangeReason> {
        // StandByBonus criteria (updated based on actual behavior):
        // - Validator is connected and available (primary condition)
        // - May or may not be in current active validator set
        // - The bonus score system appears to reward availability/connectivity
        
        const isInValidatorSet = await this.isValidatorInActiveSet(context);
        const isConnected = await this.isValidatorConnected(context);
        
        console.log(`🔍 Bonus reason detection for ${context.validator.substring(0, 8)}...:`);
        console.log(`   - In validator set: ${isInValidatorSet}`);
        console.log(`   - Is connected: ${isConnected}`);
        console.log(`   - Score change: ${context.scoreChange}`);
        
        // If validator is connected, this is likely a StandByBonus
        if (isConnected) {
            console.log(`   → Detected as StandByBonus (connected validator)`);
            return BonusScoreChangeReason.StandByBonus;
        }
        
        // If disconnected but score increased, this is unexpected - likely contract call failure
        if (!isConnected && context.scoreChange > 0) {
            console.log(`   → Unexpected: disconnected validator got bonus`);
        }
        
        console.log(`   → Couldn't detect reason for bonus`);
        return BonusScoreChangeReason.Unknown;
    }

    /**
     * Detect reason for negative score changes
     */
    private async detectNegativeScoreReason(context: ReasonDetectionContext): Promise<BonusScoreChangeReason> {
        console.log(`🔍 Penalty reason detection for ${context.validator.substring(0, 8)}...:`);
        console.log(`   - Score change: ${context.scoreChange}`);
        
        // 1. NoStandByPenalty - validator missing or disconnected
        const isInValidatorSet = await this.isValidatorInActiveSet(context);
        const isConnected = await this.isValidatorConnected(context);
        
        console.log(`   - In validator set: ${isInValidatorSet}`);
        console.log(`   - Is connected: ${isConnected}`);
        
        if (!isInValidatorSet || !isConnected) {
            console.log(`   → Detected as NoStandByPenalty`);
            return BonusScoreChangeReason.NoStandByPenalty;
        }
        
        // 2. NoKeyWritePenalty - failed key submission
        const hasSubmittedKeys = await this.hasValidatorSubmittedRequiredKeys(context);
        console.log(`   - Has submitted keys: ${hasSubmittedKeys}`);
        if (!hasSubmittedKeys) {
            console.log(`   → Detected as NoKeyWritePenalty`);
            return BonusScoreChangeReason.NoKeyWritePenalty;
        }
        
        // 3. BadPerformancePenalty - poor block production
        const hasGoodPerformance = await this.hasValidatorGoodPerformance(context);
        console.log(`   - Has good performance: ${hasGoodPerformance}`);
        if (!hasGoodPerformance) {
            console.log(`   → Detected as BadPerformancePenalty`);
            return BonusScoreChangeReason.BadPerformancePenalty;
        }
        
        console.log(`   → Detected as Unknown penalty`);
        return BonusScoreChangeReason.Unknown;
    }

    /**
     * Check if validator is in active validator set
     */
    private async isValidatorInActiveSet(context: ReasonDetectionContext): Promise<boolean> {
        try {
            const validators = await this.contractManager.getValidators(context.blockNumber);
            return validators.includes(context.validator.toLowerCase());
        } catch (error) {
            console.warn(`Error checking validator set for ${context.validator}:`, error);
            return false;
        }
    }

    /**
     * Check if validator is connected (not flagged as disconnected)
     */
    private async isValidatorConnected(context: ReasonDetectionContext): Promise<boolean> {
        try {
            const isAvailable = await this.contractManager.isValidatorAvailable(context.validator, context.blockNumber);
            return isAvailable;
        } catch (error) {
            console.warn(`Error checking validator connectivity for ${context.validator}:`, error);
            return true; // Default to connected if we can't determine
        }
    }

    private async validatorAvailableSince(context: ReasonDetectionContext): Promise<number | undefined> {
        try {
            const availableSince = await this.contractManager.getValidatorAvailableSince(context.validator);
            return availableSince;
        } catch (error) {
            console.warn(`Error fetching availableSince for ${context.validator}:`, error);
            return undefined;
        }
    }

    /**
     * Check if validator submitted required keys
     */
    private async hasValidatorSubmittedRequiredKeys(context: ReasonDetectionContext): Promise<boolean> {
        try {
            const acksLength = await this.contractManager.getKeyACKSNumber(context.validator, context.blockNumber);
            return acksLength > 0;
        } catch (error) {
            console.warn(`Error checking key submission for ${context.validator}:`, error);
            return true; // Default to submitted if we can't determine
        }
    }

    /**
     * Check if validator has good performance (block production)
     * Source: Block production statistics
     */
    private async hasValidatorGoodPerformance(context: ReasonDetectionContext): Promise<boolean> {
        try {
            // This would require detailed block production analysis
            // For now, we'll just return fasle
            // as this is the last check for penalties
            return false;
        } catch (error) {
            console.warn(`Error checking validator performance for ${context.validator}:`, error);
            return true; // Default to good performance if we can't determine
        }
    }

    /**
     * Gather additional context for reason detection
     */
    public async gatherDetectionContext(
        validator: string,
        poolAddress: string, 
        blockNumber: number,
        epoch: number,
        previousScore: number,
        newScore: number
    ): Promise<ReasonDetectionContext> {
        const scoreChange = newScore - previousScore;
        
        const context: ReasonDetectionContext = {
            validator,
            poolAddress,
            blockNumber,
            epoch,
            previousScore,
            newScore,
            scoreChange
        };

        try {
            // Gather additional context data for more accurate detection
            context.isValidatorInSet = await this.isValidatorInActiveSet(context);
            context.isValidatorConnected = await this.isValidatorConnected(context);
            context.validatorAvailableSince = await this.validatorAvailableSince(context);
        } catch (error) {
            console.warn(`Error gathering detection context for ${validator}:`, error);
        }

        return context;
    }
}
