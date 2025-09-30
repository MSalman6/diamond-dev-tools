import { ContractManager } from "../contractManager";
import { DbManager } from "./database";
import { BonusScoreChangeEvent } from "../bonusScoreChangeEvent";
import { BonusScoreReasonDetector } from "../bonusScoreReasonDetector";

/**
 * Bonus Score Processor
 */
export class BonusScoreProcessor {
    
    private reasonDetector: BonusScoreReasonDetector;
    private scoreChangeEvents: BonusScoreChangeEvent[] = [];
    
    // Current bonus scores cache
    currentBonusScores: { [nodeId: string]: number } = {};
    
    // StandByFactor tracking for inline monitoring
    private lastKnownStandByFactor: number | null = null;
    
    // Performance optimization settings
    private readonly BATCH_SIZE = 50;
    private contractDataCache: {
        validators: { [blockNumber: number]: string[] };
        epochs: { [blockNumber: number]: number };
        availableValidators: { [validator: string]: { [blockNumber: number]: boolean } };
    } = {
        validators: {},
        epochs: {},
        availableValidators: {}
    };

    public constructor(
        public contractManager: ContractManager,
        public dbManager: DbManager
    ) {
        this.reasonDetector = new BonusScoreReasonDetector(contractManager);
    }

    /**
     * Initialize the processor with optimized data loading
     */
    public async init(blockNumber: number) {
        const allPools = await this.contractManager.getAllPools(blockNumber);

        // Initialize standByFactor tracking
        try {
            const bonusScoreContract = this.contractManager.getBonusScoreSystem();
            const initialFactor = await bonusScoreContract.methods.standByFactor().call({}, blockNumber);
            this.lastKnownStandByFactor = parseInt(initialFactor);
            console.log(`🔍 Initialized standByFactor tracking with value: ${this.lastKnownStandByFactor}`);
        } catch (error) {
            console.error('❌ Failed to initialize standByFactor:', error);
            this.lastKnownStandByFactor = null;
        }

        // Load bonus scores with batching for performance
        if (allPools.length > this.BATCH_SIZE) {
            await this.batchLoadBonusScores(allPools, blockNumber);
        } else {
            // Simple loading for small sets
            for (const pool of allPools) {
                const mining = await this.contractManager.getAddressMiningByStaking(pool, blockNumber);
                const bonusScore = await this.contractManager.getBonusScore(mining, blockNumber);
                this.currentBonusScores[pool.toLowerCase()] = bonusScore;
            }
        }
    }

    /**
     * Register new node with initial bonus score
     */
    public async registerNewNode(pool: string, mining: string, blockNumber: number) {
        const currentScore = await this.contractManager.getBonusScore(mining, blockNumber);
        await this.dbManager.writeInitialBonusScore(pool, blockNumber, currentScore);
        this.currentBonusScores[pool.toLowerCase()] = currentScore;
    }

    /**
     * Check if standByFactor has changed for the current block
     */
    private async checkStandByFactorChange(blockNumber: number): Promise<{
        changed: boolean;
        newFactor: number;
        previousFactor: number | null;
    }> {
        try {
            const bonusScoreContract = this.contractManager.getBonusScoreSystem();
            const currentFactor = await bonusScoreContract.methods.standByFactor().call({}, blockNumber);
            const factorValue = parseInt(currentFactor);
            
            const changed = this.lastKnownStandByFactor !== null && factorValue !== this.lastKnownStandByFactor;
            
            if (changed) {
                console.log(`📈 StandBy Factor changed at block ${blockNumber}: ${this.lastKnownStandByFactor} → ${factorValue} (${factorValue > this.lastKnownStandByFactor! ? 'INCREASE' : 'DECREASE'})`);
            }
            
            const result = {
                changed,
                newFactor: factorValue,
                previousFactor: this.lastKnownStandByFactor
            };
            
            // Update our tracked value
            this.lastKnownStandByFactor = factorValue;
            
            return result;
        } catch (error) {
            console.error(`❌ Error checking standByFactor at block ${blockNumber}:`, error);
            return {
                changed: false,
                newFactor: this.lastKnownStandByFactor || 0,
                previousFactor: this.lastKnownStandByFactor
            };
        }
    }

    /**
     * Process bonus scores reasons
     */
    public async processBonusScore(blockNumber: number, allPools: string[]) {
        console.log(`🔄 Processing bonus scores for ${allPools.length} pools at block ${blockNumber}...`);
        const startTime = Date.now();
        
        // Check for standByFactor changes before processing scores
        const standByFactorChange = await this.checkStandByFactorChange(blockNumber);
        
        // Clear previous events
        this.scoreChangeEvents = [];
        
        // Track changes for reason detection
        const changedPools: { pool: string; mining: string; previousScore: number; newScore: number }[] = [];
        
        // Process pools in batches for large sets, sequentially for small sets
        if (allPools.length > this.BATCH_SIZE) {
            for (let i = 0; i < allPools.length; i += this.BATCH_SIZE) {
                const batch = allPools.slice(i, i + this.BATCH_SIZE);
                const batchChanges = await this.processBatch(batch, blockNumber);
                changedPools.push(...batchChanges);
            }
        } else {
            const changes = await this.processBatch(allPools, blockNumber);
            changedPools.push(...changes);
        }
        
        // Process reason detection for changed pools
        if (changedPools.length > 0) {
            console.log(`🔍 Processing ${changedPools.length} bonus score changes...`);
            await this.processReasonDetection(changedPools, blockNumber, standByFactorChange);
        }
        
        // Log standByFactor change even if no score changes occurred
        if (standByFactorChange.changed && changedPools.length === 0) {
            console.log(`📝 StandBy factor changed but no immediate score changes detected at block ${blockNumber}`);
        }
        
        const endTime = Date.now();
        console.log(`✅ Bonus score processing completed in ${endTime - startTime}ms (${changedPools.length} changes)`);
        
        return {
            processedPools: allPools.length,
            changedPools: changedPools.length,
            processingTime: endTime - startTime
        };
    }

    /**
     * Batch load bonus scores for performance
     */
    private async batchLoadBonusScores(pools: string[], blockNumber: number) {
        console.log(`🚀 Batch loading bonus scores for ${pools.length} pools...`);
        
        for (let i = 0; i < pools.length; i += this.BATCH_SIZE) {
            const batch = pools.slice(i, i + this.BATCH_SIZE);
            await this.loadBonusScoresBatch(batch, blockNumber);
        }
        
        console.log(`✅ Batch loading completed`);
    }

    /**
     * Load bonus scores for a batch of pools
     */
    private async loadBonusScoresBatch(pools: string[], blockNumber: number) {
        const promises = pools.map(async (pool) => {
            try {
                const mining = await this.contractManager.getAddressMiningByStaking(pool, blockNumber);
                const bonusScore = await this.contractManager.getBonusScore(mining, blockNumber);
                this.currentBonusScores[pool.toLowerCase()] = bonusScore;
            } catch (error) {
                console.warn(`Error loading bonus score for pool ${pool}:`, error);
            }
        });
        
        await Promise.all(promises);
    }

    /**
     * Process a batch of pools for bonus score changes
     */
    private async processBatch(pools: string[], blockNumber: number): Promise<{
        pool: string; mining: string; previousScore: number; newScore: number
    }[]> {
        const changes: { pool: string; mining: string; previousScore: number; newScore: number }[] = [];
        
        const poolPromises = pools.map(async (pool) => {
            try {
                const mining = await this.contractManager.getAddressMiningByStaking(pool, blockNumber);
                const currentScore = await this.contractManager.getBonusScore(mining, blockNumber);
                const existingScore = this.currentBonusScores[pool.toLowerCase()];

                if (currentScore !== existingScore) {
                    // Update database with new bonus score
                    await this.dbManager.updateBonusScore(pool, currentScore, blockNumber);
                    
                    // Track the change for reason detection
                    changes.push({
                        pool,
                        mining,
                        previousScore: existingScore || 0,
                        newScore: currentScore
                    });
                    
                    // Update cache
                    this.currentBonusScores[pool.toLowerCase()] = currentScore;
                }
            } catch (error) {
                console.warn(`Error processing bonus score for pool ${pool}:`, error);
            }
        });
        
        await Promise.all(poolPromises);
        return changes;
    }

    /**
     * Process reason detection for bonus score changes with standByFactor context
     */
    private async processReasonDetection(
        changedPools: { pool: string; mining: string; previousScore: number; newScore: number }[], 
        blockNumber: number,
        standByFactorChange?: { changed: boolean; newFactor: number; previousFactor: number | null }
    ) {
        // Get epoch information for reason detection
        const epochData = await this.dbManager.getEpochByBlock(blockNumber);
        
        for (const change of changedPools) {
            try {
                // Create reason detection context with standByFactor information
                const context = {
                    validator: change.mining,
                    poolAddress: change.pool,
                    blockNumber: blockNumber,
                    epoch: epochData?.id || 0,
                    previousScore: change.previousScore,
                    newScore: change.newScore,
                    scoreChange: change.newScore - change.previousScore,
                    // Add standByFactor context for reason detection
                    standByFactorChanged: standByFactorChange?.changed || false,
                    standByFactorIncrease: standByFactorChange?.changed && 
                        standByFactorChange.newFactor > (standByFactorChange.previousFactor || 0),
                    currentStandByFactor: standByFactorChange?.newFactor
                };
                
                // Detect the reason for the bonus score change
                const reason = await this.reasonDetector.detectReason(context);
                
                // Create change event
                const event = new BonusScoreChangeEvent(
                    "BonusScoreChangeEvent",
                    blockNumber,
                    0, // blockTimestamp - will be filled by event processor
                    change.mining,
                    change.pool,
                    epochData?.id || 0,
                    change.previousScore,
                    change.newScore,
                    change.newScore - change.previousScore,
                    reason,
                    {}  // Empty reason data for now
                );
                
                this.scoreChangeEvents.push(event);
                
                // Store reason in database
                await this.dbManager.insertBonusScoreChangeReason(
                    change.pool,
                    blockNumber,
                    epochData?.id || 0,
                    change.newScore - change.previousScore,
                    change.previousScore,
                    change.newScore,
                    reason,
                    {}  // Empty reason_data for now
                );
                
            } catch (error) {
                console.warn(`Error detecting reason for pool ${change.pool}:`, error);
            }
        }
    }

    /**
     * Get bonus score change events for current processing cycle
     */
    public getScoreChangeEvents(): BonusScoreChangeEvent[] {
        return [...this.scoreChangeEvents];
    }
}
