import { ConfigManager } from "../configManager";
import { LocalnetBuilder } from "./localnet-builder";
import fs from "fs";


function printHelp(): void {
    console.log('help:');
    console.log('requires 1 or 2 arguments:');
    console.log('1: number of initial validator nodes to create');
    console.log('2: (optional): number of total nodes to create. Must be bigger than or equal to argument 1');
}

async function run() {

    console.log('args:', process.argv);

    let targetNetworkLocation = ConfigManager.getLocalTargetNetworkFSDir();

    if (fs.existsSync(targetNetworkLocation)) {
        let files = fs.readdirSync(targetNetworkLocation);
        console.log(files);
        console.log('ERROR: target network already exists.', targetNetworkLocation);
        console.log('aborting.');
        process.exit(1);
    }

    let builderArgs = ConfigManager.getNetworkConfig();
    //console.log('builderArgs:', builderArgs);
    
    let initialValidatorsCount = builderArgs.builder?.initialValidatorsCount || 1; 
    let nodesCount = builderArgs.builder?.nodesCount || 4;

    if (initialValidatorsCount > nodesCount) {
        console.log('ERROR: initialValidatorsCount must be smaller than or equal to nodesCount');
        process.exit(1);
    }

    let testnetName = ConfigManager.getChainName();
    let localnetBuilder = builderArgs.builder ? LocalnetBuilder.fromBuilderArgs(testnetName , builderArgs.builder) : new LocalnetBuilder(testnetName, initialValidatorsCount, nodesCount);
    localnetBuilder.build(`${targetNetworkLocation}`);

    
    // if (process.argv.length === 2) {
    //     printHelp();
    //     process.exit(1);
    // }

    // if (process.argv.length > 4) {
    //     printHelp();
    //     process.exit(1);
    // }

    // const numInitialValidators = parseInt(process.argv[2], 10);
    // let numNodes = numInitialValidators;

    // if (process.argv.length === 4) {
    //     numNodes = parseInt(process.argv[3], 10);
    // }

}

run().catch((reason) => {

    console.log("An Error Occured:");
    console.log(reason);
    printHelp();
});

