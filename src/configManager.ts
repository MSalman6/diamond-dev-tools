
import Web3 from 'web3';
import fs from 'fs';

import { generateAddressesFromSeed } from './utils';
import { ContinuousTransactionsSender } from './continuousTransactionsSender';
import { Account, AddedAccount } from 'web3-core';
import { parse } from 'ts-command-line-args';


export interface NodeArgs {
    Footprint: {
        cache_size: number;
    }
}

export interface NetworkBuilderArgs {
    initialValidatorsCount: number,
    nodesCount: number,
    networkID?: number
    p2pPortBase?: number,
    rpcPortBase?: number,
    rpcWSPortBase?: number,
    metricsPortBase?: number,
    txQueuePerSender?: number,
    hbbftArgs?: {},
    contractArgs?: {},
    nodeArgs?: NodeArgs,
}

// "name": "local",
// "rpc": "http://127.0.0.1:8540",
// "blockscout": "http://127.0.0.1:8540",
// "db" : "http://127.0.0.1:5432"
export interface Network {
    name: string,
    rpc: string,
    blockscout: string,
    db: string,
    nodesDir: string,
    installDir: string,
    /// ssh name of the rpc server
    rpcSSH: string,
    /// local install dir of the rpc server
    rpcLocalInstallDir: string,
    claimingPotAddress: string,
    /// the screen name on the remote server.
    screenName: string,
    nodeRepoAlias: string | undefined,
    nodeRepoUrl: string | undefined,
    nodeRepoBranch: string | undefined,
    nodeBuildScript: string | undefined,
    rustVersion: string | undefined,
    openEthereumDeadlockDetection: boolean,
    builder: NetworkBuilderArgs | undefined
}

export interface TestConfig {

    network: string,
    networkGitRepo: string,
    networkGitRepoBranch: string,
    nodeRepoUrl: string,
    nodeProfile: string,
    nodeBranch: string,
    nodeBuildScript: string | undefined,
    blockscoutInstance: string,
    continuousSenderIntervalMin: number,
    continuousSenderIntervalMax: number,
    testDurationMs: number,
    mnemonic: string,
    mnemonicAccountIndex: number,
    calcNonceEveryTurn: boolean,
    trackPerformance: boolean,
    logToTerminal: boolean | undefined,
    logToFile: boolean | undefined,
    maximumPoolSize: number | undefined
    networks: Array<Network>,
    bonusScoreSystemAddress?: string,
    bonusScoreSystemABI?: any[]
}


interface IArgs {
    network?: string;
}

let config = require('config') as TestConfig;
//console.log('config: ', config);


const args = parse<IArgs>({
    network: { type: String,  optional: true, description: `network as configured in config/default.json`},
  },
    {
      stopAtFirstUnknown: true,
    }, false, false);


// CLI args overwrite the network config from the config file.
if (args.network) {
    console.log('overwriting network from CLI args: ', args.network);
    config.network = args.network;
}


export class ConfigManager {
    static getBuildFromSourceScript() {

      
        return ConfigManager.getNetworkConfig().nodeBuildScript ?? ConfigManager.getConfig().nodeBuildScript ?? "build-from-source.sh";
        
    }


    static getChainName() {
        let builderArgs = ConfigManager.getNetworkConfig();
        return builderArgs.name.startsWith("nodes-") ? builderArgs.name.substring("nodes-".length) : builderArgs.name;
    }

    static getRustVersion() {
        return ConfigManager.getNetworkConfig().rustVersion;
    }

    static network : string = "";

    static setNetwork(network: string) {

        ConfigManager.network = network; 
        // throw new Error('Method not implemented.');
    }

    static getOpenEthereumDeadlockDetection() : boolean {
      
        return this.getNetworkConfig().openEthereumDeadlockDetection;
    }

    static getNetworkRepo() : string {
        let config = ConfigManager.getConfig();
        return config.networkGitRepo;
    }

    static getNetworkBranch() : string {
        let config = ConfigManager.getConfig();
        return config.networkGitRepoBranch;
    }

    static getNodeRepoAlias() : string {
        const config = ConfigManager.getNetworkConfig()
        const alias = config.nodeRepoAlias;

        if (alias) {
            return alias;
        }

        return "origin";
    }

    static getNodeRepoUrl() : string {
        const config = ConfigManager.getNetworkConfig()
        const url = config.nodeRepoUrl;

        if (url) {
            return url;
        }

        const globalConfig = ConfigManager.getConfig();
        return globalConfig.nodeRepoUrl;
    }

    static getLocalTargetNetworkFSDir() : string { 
        return `testnet/${this.getNetworkConfig().nodesDir}`;
    }

    static getTargetNetwork() : string {

        return this.getConfig().network;
    }


    static getNodeBranch() {

      const { nodeRepoBranch: nodeBranch } = this.getNetworkConfig();
      if (nodeBranch) {
        return nodeBranch;
      }
      return config.nodeBranch;
    }

    static getRemoteScreenName() {
        return this.getChainName();
    }
    static getNodesDir(): string {
      
        const network = this.getNetworkConfig();
        return network.nodesDir;
    }

    static getRemoteInstallDir(): string {

        const network = this.getNetworkConfig();
        return network.installDir;
    }

    static getRpcSSH(): string { 
        const network = this.getNetworkConfig();
        return network.rpcSSH;
    }

    static getRpcLocalInstallDir(): string {
        const network = this.getNetworkConfig();
        return network.rpcLocalInstallDir;
    }


    public static getNetworkConfig(): Network 
    {   
        let config = ConfigManager.getConfig();

        

        for (let network of config.networks) { 
            // console.log('network: ', network);
            if (network.name == config.network) {
                //console.log('network found!!: ', network);
                
                if (process.env["RPC_URL"]) {
                    network.rpc = process.env["RPC_URL"];
                }


                if (process.env["POSTGRES_INSTANCE"]) {
                    network.db = process.env["POSTGRES_INSTANCE"];
                }
                
                return network;

                
            }
        }

        throw new Error(`Network ${config.network} not found in config file.`);

    }


    public static getConfig(): TestConfig {
        
        const result = config;

        let mnemonic = config.mnemonic;

        // verifyExists(config.installDir);

        if (!mnemonic) {
            // no mnemonic configured in config.
            // read mnemonic from .mnemonic file.
            const mnemonicFilename = '.mnemonic';

            if (!fs.existsSync(mnemonicFilename)) {
                console.log('WARNING: No mnemonic in config file found. No .mnemonic file found.');
                return result;
            }

            const fileContent = fs.readFileSync(mnemonicFilename)
            result.mnemonic = fileContent.toString('utf8');
        }

        
        if ( ConfigManager.network != "") {
            result.network = ConfigManager.network;   
        }

        return result;
    }

    public static getWeb3(): Web3 {

        const web3Config = this.getConfig();
        const networkConfig = this.getNetworkConfig();

        //let rpcUrl = networkConfig.rpc;
        

        const result = new Web3(networkConfig.rpc);
        result.eth.transactionConfirmationBlocks = 0;
        const addressPairs = generateAddressesFromSeed(web3Config.mnemonic, web3Config.mnemonicAccountIndex + 1);
        const addAddress = {
            address: addressPairs[config.mnemonicAccountIndex].address,
            privateKey: addressPairs[config.mnemonicAccountIndex].privateKey
        }

        const addedWalletAccount = result.eth.accounts.wallet.add(addAddress);
        result.eth.defaultAccount = addedWalletAccount.address;
        result.defaultAccount = addedWalletAccount.address;

        // console.log('default account: ', addedWalletAccount.address);

        return result;
    }

    public static insertWallets(web3: Web3, count = 30) : Array<AddedAccount> {

        const addressPairs = generateAddressesFromSeed(config.mnemonic, count);
        let result = Array<AddedAccount>();

        console.log('calculated pairs: ', addressPairs.length);
        // web3.eth.accounts.wallet.add
        // web3.eth.accounts.wallet.add(addAddress);

        let wallets: Account[] = [];
        for (let i = 0; i < web3.eth.accounts.wallet.length; i++) {
            wallets.push(web3.eth.accounts.wallet[i]);
        }

        console.log("wallets:", wallets.length);

        for (let i = 0; i < count; i++) {

            console.log('inserting wallet: ', i);
            const pair = addressPairs[i];
            

            if (wallets.map(x => x.address).indexOf(pair.address) >= 0) {
                console.log('already found: ', pair.address);
                continue;
            }

            const addedWalletAccount = web3.eth.accounts.wallet.add(pair);
            result.push(addedWalletAccount);
            console.log(`added wallet: `, addedWalletAccount.address);

        }

        return result;
    }
}