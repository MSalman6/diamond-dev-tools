import { ContractManager } from "../contractManager"
import { NodeManager } from "../net/nodeManager";
import { toDate, toNumber } from "../utils/numberUtils";




export async function printContractDetails(contractManager: ContractManager, nodeManager: NodeManager, logOptions = { logBaseData: true, logKeyGen: true, logEpochData: true, logPools: true }) {


    const validatorSet = contractManager.getValidatorSetHbbft();
    // const rewardContract = await contractManager.getRewardHbbft();
    const web3 = contractManager.web3;


    // const logBaseData = false;

    // ValidatorSetHbbft

    // maxValidators
    // banDuration
    // keyGenHistoryContract
    // stakingContract
    // randomContract
    // blockRewardContract 

    const latestBlock = await web3.eth.getBlock("latest");
    const latestBlockDate = toDate(latestBlock.timestamp);
    console.log("latest block:", latestBlock.number);
    console.log("timestamp:", latestBlockDate.toUTCString());
    console.log("gas limit:", latestBlock.gasLimit);

    const permission = contractManager.getContractPermission();

    if (logOptions.logBaseData) {
        console.log("maxValidators:", await validatorSet.methods.maxValidators().call());
        // console.log("banDuration:", await validatorSet.methods.banDuration().call());
        console.log("keyGenHistoryContract:", await validatorSet.methods.keyGenHistoryContract().call());
        console.log("stakingContract:", await validatorSet.methods.stakingContract().call());
        console.log("randomContract:", await validatorSet.methods.randomContract().call());
        console.log("blockRewardContract:", await validatorSet.methods.blockRewardContract().call());
        console.log("validatorInactivityThreshold", await validatorSet.methods.validatorInactivityThreshold().call());
        // console.log("blockRewardContract:", await validatorSet.methods.perm blockRewardContract().call());

        const minGasPrice = await permission.methods.minimumGasPrice().call();
        console.log("minGasPrice: ", minGasPrice);

        const blockGasLimit = await permission.methods.blockGasLimit().call();
        console.log("blockGasLimit: ", blockGasLimit);
    }

    const keyGenHistoryContract = await contractManager.getKeyGenHistory();

    //let latestBlock = contractManager.web3.eth.getBlock("latest");

    const stakingContract = await contractManager.getStakingHbbft();

    const stakingEpochNum = await stakingContract.methods.stakingEpoch().call();

    if (logOptions.logEpochData) {

        const epochStartTime = new Date(Number.parseInt(await stakingContract.methods.stakingEpochStartTime().call()) * 1000);
        const phaseTransition = new Date(Number.parseInt(await stakingContract.methods.startTimeOfNextPhaseTransition().call()) * 1000);
        const epochEndTime = new Date(Number.parseInt(await stakingContract.methods.stakingFixedEpochEndTime().call()) * 1000);
        const currentKeyGenExtraTimeWindow = Number.parseInt(await stakingContract.methods.currentKeyGenExtraTimeWindow().call());
        console.log(`epoch start time UTC: ${epochStartTime.toUTCString()}`);
        console.log(`next Phase Transition UTC: ${phaseTransition.toUTCString()}`);

        const overdue = latestBlockDate.valueOf() - epochEndTime.valueOf();
        // const overdue = latestBlockDate - epochEndTime
        console.log(`Epoch End Time: UTC: ${epochEndTime.toUTCString()} ${overdue > 0 ? "Overdue: " + overdue / 1000 + " seconds" : ""}`);
        console.log(`currentKeyGenExtraTimeWindow in seconds: ${currentKeyGenExtraTimeWindow}`);

    }


    const currentValidators = await contractManager.getValidators();
    console.log(`current validators:`, currentValidators);

    if (logOptions.logKeyGen) {
        const keyGenRound = await contractManager.getKeyGenRound();
        console.log("keyGenRound:", keyGenRound);


        const pendingValidators = await validatorSet.methods.getPendingValidators().call()
        console.log(`pending validators:`, pendingValidators);


        for (let i = 0; i < pendingValidators.length; i++) {
            const pendingValidator = pendingValidators[i];
            const currentKeyGenMode = await contractManager.getPendingValidatorStateFormatted(pendingValidator);

            console.log(`pending validator ${await nodeManager.formatNodeName(pendingValidator)} key gen mode: `, currentKeyGenMode);
        }

        if (pendingValidators.length > 0) {

            const numberOfKeyFragmentsWritten = await keyGenHistoryContract.methods.getNumberOfKeyFragmentsWritten().call();
            console.log(`number of key fragments written:`, numberOfKeyFragmentsWritten);
        }

        console.log(`Key state:`);
        for (const validator of currentValidators) {
            const partByteLength = await contractManager.getKeyPARTBytesLength(validator);
            const acks = await contractManager.getKeyACKSNumber(validator);
            console.log(`${await nodeManager.formatNodeName(validator)} partByteLength: ${partByteLength} acks: ${acks}`);
        }
    }

    if (logOptions.logPools) {
        const likehilihood = await stakingContract.methods.getPoolsLikelihood().call();
        console.log(`likehilihood total:`, likehilihood.sum);
        const pools = await stakingContract.methods.getPools().call();

        for (const pool of pools) {
            let miningAddress = await contractManager.getAddressMiningByStaking(pool);
            const callResult = await validatorSet.methods.validatorAvailableSince(miningAddress).call();
            let miningAddressText = await nodeManager.formatNodeName(miningAddress);
            let ipAddress = await contractManager.getIPAddress(pool);
            console.log(`validator candidate ${pool} (node address:${miningAddressText}) IP: ${ipAddress} available since: ${callResult} ${new Date(Number.parseInt(callResult) * 1000).toUTCString()}`);
        }
    }

    let timeframeLength = await stakingContract.methods.stakingTransitionTimeframeLength().call();
    console.log("transition timeframeLength: ", timeframeLength);


    let connectivityTracker = await contractManager.getContractConnectivityTrackerHbbft();
    console.log("early epoch treshold: ", await connectivityTracker.methods.earlyEpochEndThreshold().call());

    let earlyEpochEnd = await connectivityTracker.methods.isEarlyEpochEnd(stakingEpochNum).call();
    console.log("connectivity tracker: isEarlyEpochEnd", earlyEpochEnd);


    let flaggedValidators = await connectivityTracker.methods.getFlaggedValidators().call();
    console.log("flagged validators:", flaggedValidators.length);

    for (let validator of currentValidators) {

        const validatorName = await nodeManager.formatNodeName(validator);
        let score = await connectivityTracker.methods.getValidatorConnectivityScore(stakingEpochNum, validator).call();
        const flaggedInfo = flaggedValidators.find((v) => v === validator) ? " (flagged)" : "";
        console.log("validator:", validatorName, "connectivity score:", score, flaggedInfo);
    }

    let faultyValidatorsCount = toNumber(await connectivityTracker.methods.countFaultyValidators(stakingEpochNum).call());
    console.log("faultyValidatorsCount:", faultyValidatorsCount);
}
