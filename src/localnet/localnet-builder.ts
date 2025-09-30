
import * as fs from 'fs';
import * as path from 'path';
import { cmd } from '../remoteCommand';
import { ConfigManager, Network, NetworkBuilderArgs, NodeArgs } from '../configManager';

export class LocalnetBuilder {


    private exportTargetDirectory: string = "";



    public constructor(public name: string, public numInitialValidators: number, public numNodes: number, public useContractProxies = true, public metricsPortBase: number = 48700, public txQueuePerSender: number = Number.NaN, public portBase: number = Number.NaN, public portBaseRPC: number = Number.NaN, public portBaseWS: number = Number.NaN, public networkID: number = 777012, public hbbftArgs: { [index: string]: any } = {}, public contractArgs: { [index: string]: any } = {}, public nodeArgs: NodeArgs | undefined = undefined) {

    }


    static fromBuilderArgs(networkName: string, builderArgs: NetworkBuilderArgs): LocalnetBuilder {

        return new LocalnetBuilder(networkName, builderArgs.initialValidatorsCount, builderArgs.nodesCount, true, builderArgs.metricsPortBase, builderArgs.txQueuePerSender, builderArgs.p2pPortBase, builderArgs.rpcPortBase, builderArgs.rpcWSPortBase, builderArgs.networkID, builderArgs.hbbftArgs ?? {}, builderArgs.contractArgs ?? {}, builderArgs.nodeArgs);
    }
    //#region relative Directories

    public getExportedTargetDirectory() {
        return this.exportTargetDirectory;
    }

    private getPosdaoContractsDirRelative() {
        return '../../../diamond-contracts-core';
    }

    private getDaoContractsDirRelative() {
        return '../../../diamond-contracts-dao';
    }

    private getViewsContractsDirRelative() {
        return '../../../diamond-contracts-views';
    }

    private getDiamondNodesDirRelative() {
        return '../../../diamond-node';
    }

    private getGeneratedAssetsDirectory() {
        let generatedAssetsDirectoryRelative = 'crates/ethcore/src/engines/hbbft/hbbft_config_generator/';
        return path.join(__dirname, this.getDiamondNodesDirRelative(), generatedAssetsDirectoryRelative);
    }

    private getDAOContractsDir() {
        return path.join(__dirname, this.getDaoContractsDirRelative());
    }

    private getViewsContractsDir() {
        return path.join(__dirname, this.getViewsContractsDirRelative());
    }

    private getPosdaoContractsDir() {
        return path.join(__dirname, this.getPosdaoContractsDirRelative());
    }

    private getPosdaoContractsOutputSpecFile() {
        return path.join(this.getPosdaoContractsDir(), 'spec_hbbft.json');
    }

    private getViewsContractsOutputFile() {
        return path.join(this.getViewsContractsDir(), 'out/spec_aggregator.json');
    }

    private getDaoContractsOutput() {
        return path.join(this.getDAOContractsDir(), "out/spec_dao.json")
    }

    //#endregion



    public async build(targetDirectory: string) {
        console.log("start building in:", __dirname);
        await this.buildNodeFiles();
        // maybe we can parallise build steps for performance ?
        // but complexity not worth it ?!
        await this.buildContracts();
        await this.buildContractsDao();
        await this.buildContractsViews();
        await this.integrateDaoToChainSpec();
        await this.applyChainSpecManipulations();
        await this.copyNodeFilesToTargetDirectory(targetDirectory);

        this.applyTomlManipulations();
    }

    private writeEnv(envName: string, envDefaultValue: string): void {

        const value = process.env[envName];
        if (value !== undefined) {
            // process.env[envName] = envDefaultValue;
            return;
        }

        if (this.contractArgs[envName] !== undefined) {
            process.env[envName] = this.contractArgs[envName];
        } else {
            process.env[envName] = envDefaultValue;
        }
    }

    // private readEnv(envName: string): string {
    //     const value = process.env[envName];
    //     if (value === undefined) {
    //         throw new Error(`Environment variable ${envName} is not set`);
    //     }
    //     return value;
    // }

    private copyFile(src: string, dest: string) {
        console.log(`Copying ${src} to ${dest}`);
        fs.copyFileSync(src, dest);
    };



    private applyChainSpecManipulations() {
        // todo: that could be an external functions.

        let specFilePOS = this.getPosdaoContractsOutputSpecFile();
        let spec = JSON.parse(fs.readFileSync(specFilePOS, { encoding: "utf-8" }));
        spec.name = this.name;
        spec.params.networkID = this.networkID.toString();
        // spec.params.minGasLimit = "300000000";

        // spec.engine.hbbft.params.minimumBlockTime = this.hbbftArgs["minimumBlockTime"];
        // spec.engine.hbbft.params.maximumBlockTime = this.contractArgs.maximumBlockTime;
        console.log("setting hbbft params: ", this.hbbftArgs);

        const entries = Object.entries(this.hbbftArgs);
        for (const i in entries) {
        
            const entry = entries[i];
            const key = entry[0];
            const value = entry[1];
            console.log("setting param: ", key, value);
            
            spec.engine.hbbft.params[key] = value;
        }
        //spec.engine.hbbft.params


        // since the DAO could decide very low gas limits, we should not sit on our initial minimum gas limit
        // therefore we put an extremly low value here (10 MGas). 
        spec.params.minGasLimit = "10000000";
        // spec.genesis.gasLimit = this.gasLimit;

        fs.writeFileSync(specFilePOS, JSON.stringify(spec, null, 4));
    }

    private applyTomlManipulation(i: number) {
        let tomlLocation = this.getTargetNodeTomlFile(i);
        let toml = fs.readFileSync(tomlLocation, { encoding: "utf-8" });

        if (this.nodeArgs) {

            toml += `\n[footprint]\ncache_size = ${this.nodeArgs.Footprint.cache_size}\n`;

            // todo: be more flexible here, so we dont need to support all config sections.
            // maybe we should consider here a full overlay of all settings.
            // this would allow for example target log levels.

            console.log("setting Footprint and co:", tomlLocation);

        }

        const tomlLines = toml.split('\n');

        // const loggingLineIndex = tomlLines.findIndex((line) => line.startsWith("logging") );
        // if (loggingLineIndex > -1) {
        //     tomlLines[loggingLineIndex] = `logging = "txqueue=trace,consensus=debug,engine=debug,tx_own=trace"`;
        // } else {
        //     console.error(tomlLines);
        //     console.error(loggingLineIndex);
        //     throw new Error("could not find logging line in toml file.");
        // }

        toml = tomlLines.join('\n');

        fs.writeFileSync(tomlLocation, toml, { encoding: "utf-8" });
    }

    private applyTomlManipulations() {
        for (let i = 1; i <= this.numNodes; i++) {
            this.applyTomlManipulation(i);
        }

    }

    private integrateDaoToChainSpec() {

        let specFilePOS = this.getPosdaoContractsOutputSpecFile();
        let spec = JSON.parse(fs.readFileSync(specFilePOS, { encoding: "utf-8" }));

        const specFileDAO = this.getDaoContractsOutput();
        const specDao = JSON.parse(fs.readFileSync(specFileDAO, { encoding: "utf-8" }));

        for (const daoAccount in specDao) {
            spec.accounts[daoAccount] = specDao[daoAccount];
        }

        const specViews = JSON.parse(fs.readFileSync(this.getViewsContractsOutputFile(), { encoding: "utf-8" }));

        console.warn("adding spec views accounts: ");
        //console.log("specViews:", specViews);
        // at moment of coding, theres only one view contract in there,
        // for forward compatibility, we still add all contracts here.
        for (const viewContractAccount in specViews) {
            console.warn("adding account: ", viewContractAccount);
            spec.accounts[viewContractAccount] = specViews[viewContractAccount];
        }

        fs.writeFileSync(specFilePOS, JSON.stringify(spec, null, 4));
    }

    private getTargetNodeDir(nodeID: number) {
        return path.join(this.exportTargetDirectory, `node${nodeID}`);
    }

    private getTargetNodeTomlFile(nodeID: number): string {
        return path.join(this.getTargetNodeDir(nodeID), nodeID == 0 ? `node.toml` : `validator_node.toml`);
    }

    private copyNodeFilesToTargetDirectory(targetDirectory: string) {

        this.exportTargetDirectory = targetDirectory;

        let generatedAssetsDirectory = this.getGeneratedAssetsDirectory();
        let specFile = this.getPosdaoContractsOutputSpecFile();

        let init_data_file = generatedAssetsDirectory + 'keygen_history.json'
        let nodes_info_file = generatedAssetsDirectory + 'nodes_info.json'

        for (let i = 1; i <= this.numNodes; i++) {

            console.log(`Setting up config for node `, i);
            let nodeDir = this.getTargetNodeDir(i);

            fs.mkdirSync(nodeDir, { recursive: true });
            fs.mkdirSync(path.join(nodeDir, `data/network`), { recursive: true });
            fs.mkdirSync(path.join(nodeDir, `data/keys`), { recursive: true });
            fs.mkdirSync(path.join(nodeDir, `data/keys/DPoSChain`), { recursive: true });


            this.copyFile(path.join(generatedAssetsDirectory, `hbbft_validator_${i}.toml`), this.getTargetNodeTomlFile(i));
            this.copyFile(path.join(generatedAssetsDirectory, `hbbft_validator_key_${i}`), path.join(nodeDir, 'data/network/key'));
            this.copyFile(path.join(generatedAssetsDirectory, `hbbft_validator_address_${i}.txt`), path.join(nodeDir, 'address.txt'));
            this.copyFile(path.join(generatedAssetsDirectory, `hbbft_validator_public_${i}.txt`), path.join(nodeDir, 'public_key.txt'));
            this.copyFile(path.join(generatedAssetsDirectory, `reserved-peers`), path.join(nodeDir, 'reserved-peers'));
            this.copyFile(specFile, path.join(nodeDir, 'spec.json'));
            this.copyFile(path.join(generatedAssetsDirectory, 'password.txt'), path.join(nodeDir, 'password.txt'));
            this.copyFile(path.join(generatedAssetsDirectory, `hbbft_validator_key_${i}.json`), path.join(nodeDir, 'data/keys/DPoSChain/hbbft_validator_key.json'));
            let chainName = ConfigManager.getChainName();
            let chainDir = path.join(nodeDir, `data/keys/${chainName}`);
            fs.mkdirSync(chainDir)
            this.copyFile(path.join(generatedAssetsDirectory, `hbbft_validator_key_${i}.json`), path.join(chainDir, `hbbft_validator_key.json`));
        }

        console.log('Set up Rpc node');

        fs.mkdirSync(path.join(targetDirectory, `rpc_node`), { recursive: true });

        this.copyFile(path.join(generatedAssetsDirectory, `rpc_node.toml`), path.join(targetDirectory, 'rpc_node/node.toml'));
        this.copyFile(path.join(generatedAssetsDirectory, `reserved-peers`), path.join(targetDirectory, 'rpc_node/reserved-peers'));
        this.copyFile(specFile, path.join(targetDirectory, 'rpc_node/spec.json'));
        this.copyFile(nodes_info_file, path.join(targetDirectory, 'nodes_info.json'));
    }

    public buildContracts() {

        let networkName = ConfigManager.getChainName();

        this.writeEnv("NETWORK_NAME", networkName);
        this.writeEnv("NETWORK_ID", "777012");
        this.writeEnv("OWNER", "0xDA0da0da0Da0Da0Da0DA00DA0da0da0DA0DA0dA0");
        this.writeEnv("STAKING_EPOCH_DURATION", "3600");
        this.writeEnv("STAKE_WITHDRAW_DISALLOW_PERIOD", "1");
        this.writeEnv("STAKING_TRANSITION_WINDOW_LENGTH", "600");
        this.writeEnv("STAKING_MIN_STAKE_FOR_VALIDATOR", "10000");
        this.writeEnv("STAKING_MIN_STAKE_FOR_DELEGATOR", "100");


        let posdaoContractsDir = this.getPosdaoContractsDir();

        let result = cmd(`cd ${posdaoContractsDir} && npx hardhat compile`);

        if (!result.success) {
            console.error(result.output);
            console.error("failed to compile contracts, aborting.");
            throw new Error('Failed to compile contracts');
        }

        let generatedAssetsDirectory = this.getGeneratedAssetsDirectory();

        let init_data_file = generatedAssetsDirectory + 'keygen_history.json';

        let useProxy = this.useContractProxies ? '--use-upgrade-proxy' : '';

        let web3 = ConfigManager.getWeb3();


        let makeSpectResult = cmd(`cd ${posdaoContractsDir} && npx hardhat make_spec_hbbft --init-contracts initial-contracts.json --initial-fund-address ${web3.eth.defaultAccount} ${useProxy} ${init_data_file}`);

        if (!makeSpectResult.success) {
            console.error(makeSpectResult.output);
            console.error("failed to generate chain spec, aborting.");
            throw new Error('Failed to generate chain spec');
        }


        // # adding the option required for a full sophisticated rpc node.

        // rpc_node_toml = open('nodes/rpc_node/node.toml', 'a')
        // rpc_node_toml.write('\n')
        // rpc_node_toml.write('[footprint]\n')
        // rpc_node_toml.write('fat_db = "on"\n')
        // rpc_node_toml.write('tracing = "on"\n')
        // rpc_node_toml.write('db_compaction = "ssd"\n')
        // rpc_node_toml.write('pruning = "archive"\n')
        // rpc_node_toml.write('cache_size = 4960\n')

        // rpc_node_toml.close()
    }

    public buildContractsDao() {

        let daoContractsDir = this.getDAOContractsDir();
        let makeSpecResult = cmd(`cd ${daoContractsDir} && npx hardhat compile && npx hardhat run scripts/deployForChainSpec.ts`);

        if (!makeSpecResult.success) {
            console.error(makeSpecResult.output);
            console.error("failed to generate DAO spec, aborting.");
            throw new Error('Failed to generate DAO spec');
        };
    }


    public buildContractsViews() {

        let viewsContractsDir = this.getViewsContractsDir();
        let makeSpecResult = cmd(`cd ${viewsContractsDir} && npx hardhat compile && npx hardhat run scripts/deployForChainSpec.ts`);

        if (!makeSpecResult.success) {
            console.error(makeSpecResult.output);
            console.error("failed to generate views spec, aborting.");
            throw new Error('Failed to generate views spec');
        };
    }

    public async buildNodeFiles() {

        console.log("creating files for new HBBFT Nodes...");

        // cmd = ['cargo', 'run', str(num_initialValidators), str(num_nodes), 'Docker', '--tx_queue_per_sender=100000', '--metrics_port_base=48700', '--metrics_interface=all']

        let args: Array<string> = ['run', this.numInitialValidators.toString(), this.numNodes.toString(), 'Docker'];

        if (Number.isInteger(this.txQueuePerSender)) {
            args.push(`--tx_queue_per_sender=${this.txQueuePerSender}`);
        }

        if (Number.isInteger(this.metricsPortBase)) {
            args.push(`--metrics_port_base==${this.metricsPortBase}`);
            args.push(`--metrics_interface=all`);
        }

        if (Number.isInteger(this.portBase)) {
            args.push(`--port_base=${this.portBase}`);
        }

        if (Number.isInteger(this.portBaseRPC)) {
            args.push(`--port_base_rpc=${this.portBaseRPC}`);
        }

        if (Number.isInteger(this.portBaseWS)) {
            args.push(`--port_base_ws=${this.portBaseWS}`);
        }

        const generatorDirRelative = '../../../diamond-node/crates/ethcore/src/engines/hbbft/hbbft_config_generator';
        const generatorDir = path.join(__dirname, generatorDirRelative);

        console.log('generator dir: ', generatorDir);

        let output = cmd(`cd ${generatorDir} && cargo ${args.join(' ')}`);

        if (!output.success) {
            console.error(output.output);
            throw new Error('Failed to create node files');
        }

        // let spawnedProcess = child_process.spawn('cargo', args, {cwd: generatorDir, shell: true, stdio: 'pipe'});



        // process.stdout.on('data', (data) => {
        //     console.log(data)
        // })

        // process.stderr.on('data', (data) => {
        //     console.log(data)
        // })

        // let processExitCode : number | null = null;
        // spawnedProcess.once('exit', (code) => {
        //     console.log('cargo exit.', code);
        //     processExitCode = code;

        // });


        // console.log("waiting for cargo process to generate files...");
        // while (processExitCode == null) {
        //     // wait
        //     await sleep(1000);  
        // }

        // if (processExitCode == 101) {
        //     throw new Error('Failed to create node files');
        // }

        console.log("finished waiting.");
    }
}
