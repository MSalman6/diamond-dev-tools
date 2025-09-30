import child_process from 'child_process';
import { loadNodeInfosFromTestnetDirectory } from './nodeInfo';
import fs from 'fs';
import path from 'path';
import { ConfigManager } from '../configManager';
import { cmd, cmdR } from '../remoteCommand';
import { startRemoteNode } from '../remotenet/startRemoteNode';
import { stopRemoteNode } from '../remotenet/stopRemoteNode';
import { ContractManager } from '../contractManager';
import axios from 'axios';
import { sleep } from '../utils/time';

export class NodeState {


  public childProcess?: child_process.ChildProcess;
  public isStarted = false;

  isDeactivated: boolean = false;


  public constructor(public nodeID: number, public publicKey: string | undefined, public address: string | undefined) {
  }


  public static getNodeDirRelative(nodeId: number,): string {

    if (nodeId > 0) {
      return `node${nodeId}`;
    } else {
      return `rpc_node`;
    }

  }

  public static getNodeDirAbsolute(nodeId: number,): string {

    const nodesDir = ConfigManager.getNodesDir();

    const cwd = process.cwd();

    let relative = NodeState.getNodeDirRelative(nodeId);
    return `${cwd}/testnet/${nodesDir}/${relative}}`;
  }

  public static startNode(nodeId: number, extraFlags: string[] = []): child_process.ChildProcess {

    return this.startNodeBase(nodeId, extraFlags);
  }

  private static startRpcNode(extraFlags: string[] = [], errorHandling = false): child_process.ChildProcess {
    return NodeState.startNodeBase(0, extraFlags, errorHandling);
  }

  private static startNodeBase(nodeID: number, extraFlags: string[] = [], errorHandling = false): child_process.ChildProcess {

    const cwd = process.cwd();
    const nodesDir = ConfigManager.getNodesDir();
    console.log('nodesDir:', nodesDir);

    const config = ConfigManager.getConfig();
    const openethereumsubdirectory = `../diamond-node/target/${config.nodeProfile}/diamond-node`;

    const resolvedPath = path.resolve(cwd, openethereumsubdirectory).toString();
    // console.log('resolvedPath = ', resolvedPath);
    let nodesNameDir = NodeState.getNodeDirRelative(nodeID);

    let cwdNodes = `${cwd}/testnet/${nodesDir}/${nodesNameDir}`;

    let tomlfilename = nodeID == 0 ? "node.toml" : "validator_node.toml";
    let flags = [`--config=${tomlfilename}`, ...extraFlags];

    if (errorHandling) {
      const execOption: child_process.ExecFileOptions = {
        cwd: NodeState.getNodeDirAbsolute(nodeID),
        maxBuffer: 100 * 1024 * 1024 /** 100 MB */,
      };

      const proc = child_process.execFile(resolvedPath, flags, execOption, (error: any) => {
        console.log(
          `result from RPC Node: \n
          cmd:     ${error?.cmd} \n
          code:    ${error?.code} \n
          killed:  ${error?.killed} \n
          message: ${error?.message} \n
          name:    ${error?.name} \n
        `);
      });
      return proc;
    }

    const spawnOption: child_process.SpawnOptions = {
      cwd: cwdNodes,
      stdio: 'ignore', // pipe ignore      
    };

    console.log(`${nodesNameDir} Path:`, resolvedPath);
    console.log(`${nodesNameDir} Options: `, spawnOption);
    console.log(`${nodesNameDir} flags: `, flags);
    const spawned = child_process.spawn(resolvedPath, flags, spawnOption);

    spawned.once('exit', (code, signal) => {
      console.log(`node ${nodesNameDir} exited with code: ${code} and signal: ${signal}`);
    });

    spawned.once('close', (code, signal) => {
      console.log(`node ${nodesNameDir} closed with code: ${code} and signal: ${signal}`);
    });

    spawned.once(
      'error', (err) => {
        console.log(`node ${nodesNameDir} error: ${err}`);
      }
    );

    spawned.once(
      'message',
      (message) => {
        console.log(`node ${nodesNameDir} message: ${message}`);
      }
    );

    spawned.once("disconnect", () => {
      console.log(`node ${nodesNameDir} disconnected`);

    });


    console.log(`node ${nodesNameDir} spawned!`);

    return spawned;
    // //child_process.spawn()


    // stdOut: ${stdout} \n
    // stdErr: ${stderr}

  }

  public start(force = false) {

    if (this.isDeactivated) {
      console.log(`node ${this.address} is deactivated. ignoring start command.`);
      return;
    }

    if (this.isStarted && !force) {
      throw new Error(`Node ${this.nodeID} is already started.`);
    }

    //const extraFlags = '--tx-queue-mem-limit=1000 --no-persistent-txqueue'; //  --tx-queue-size=100000
    const extraFlags = ["--tx-queue-mem-limit=1000", "--no-persistent-txqueue", "--tx-queue-size=100000"];

    if (this.nodeID > 0) {
      this.childProcess = NodeState.startNode(this.nodeID, extraFlags);
    } else {
      this.childProcess = NodeState.startRpcNode(extraFlags);
    }


    this.isStarted = true;
    console.log(`started child process with ID ${this.childProcess.pid}`);
  }


  public startRemote() {
    startRemoteNode(this);
  }

  public stopRemoteNode() {
    stopRemoteNode(this);
  }

  public async stop(force = false) {

    if (!this.isStarted && !force) {
      throw new Error(`Can't stop node ${this.nodeID} that has not been started yet.`);
    }

    if (!this.childProcess) {
      throw new Error(`Can't stop node ${this.nodeID} without having a child process.`);
    }


    let isExited = false;


    this.childProcess.on("close", (x) => {
      console.log("closed!!", x);
      isExited = true;
      this.isStarted = false;
    })

    // this.childProcess.on("exit", (x)=> {
    //   console.log("exited!", x);
    //   isExited = true;
    //   this.isStarted = false;
    // })

    function sleep(milliseconds: number) {
      return new Promise(resolve => setTimeout(resolve, milliseconds));
    }


    //this.childProcess.kill("SIGKILL");
    this.childProcess.kill("SIGTERM");
    //process.kill(this.childProcess.pid, 15); // 15 = nice and gently

    // const killCmd = `kill ${this.childProcess.pid}`;
    // console.log(killCmd);

    // const killer = child_process.exec(killCmd);
    // console.log(`killer: ${killer.pid}`);

    console.log('wait for exit');
    while (isExited === false) {
      //await setTimeout(() =>{}, 1000);
      await sleep(100);
      process.stdout.write('.');
    }
  }

  public deactivate() {
    this.stop();
    this.isDeactivated = true;
  }

  public async restoreDB(backupDir: string) {

    if (this.isStarted) {
      throw new Error(`Can't restore DB while node ${this.nodeID} is running.`);
    }

    const nodesDir = ConfigManager.getNodesDir();

    cmd(`cp -r ${backupDir} testnet/${nodesDir}/node${this.nodeID}/data/chains/`);

  }

  public clearDBRemote() {

    const nodesDir = ConfigManager.getRemoteInstallDir();
    console.log(`=== Clearing DB on ${this.sshNodeName()} ===`);
    let result = cmdR(this.sshNodeName(), `cd ${nodesDir} && ./reset.sh`);

    console.log(result);
    console.log(`=== END Clearing DB on ${this.sshNodeName()} ===`);


  }



  public async clearDBLocal() {

    const baseDir = NodeState.getNodeDirAbsolute(this.nodeID);

    let directoryToDelete = path.join(baseDir, 'data', 'cache');
    console.log('deleting:', directoryToDelete);
    fs.rmdirSync(directoryToDelete, { recursive: true });

    directoryToDelete = path.join(baseDir, 'data', 'chains');
    console.log('deleting:', directoryToDelete);
    fs.rmdirSync(directoryToDelete, { recursive: true });

    console.log('finished clearing DB for Node ', this.nodeID);
  }

  public sshNodeName() {
    return `hbbft${this.nodeID}`;
  }

}

export class NodeManager {

  static s_instance = new NodeManager();


  private constructor() {

  }

  public static setNetwork(network: string) {
    ConfigManager.setNetwork(network);
  }

  /// returns the singleton instance of the NodeManager
  public static get(networkId: string = ''): NodeManager {

    if (NodeManager.s_instance.nodeStates.length === 0) {
      ConfigManager.setNetwork(networkId);
      NodeManager.s_instance.initFromTestnetManifest();
    }

    return NodeManager.s_instance;
  }

  public nodeStates: Array<NodeState> = [];

  public rpcNode: NodeState | undefined;



  public startNode(nodeID: number, force = false): NodeState {

    const result = this.getNode(nodeID);
    result.start(force);
    return result;
  }

  public startRpcNode(force = false) {

    this.rpcNode = new NodeState(0, undefined, undefined);

    this.rpcNode.start(force);
  }

  public async awaitRpcReady() {

    let network = ConfigManager.getNetworkConfig();
    console.log("awaiting rpc to be ready at address:", network.rpc);

    while (true) {

      try {
        let response = await axios.post(network.rpc, {}, { headers: { 'Content-Type': 'application/json' } });
        if (response.status == 200) {
          console.log("RPC is ready!");
          return;
        } else{
          console.log("RPC response state was:", response.status);
          await sleep(100);
        }
      }
      catch (e: any) {

        if (e.code === 'ECONNREFUSED') {
          //console.log("RPC not ready yet. Waiting...");
          await sleep(100);
        } else {
          console.log("Unexpected RPC error:", e);
          console.log("Unexpected RPC error - there might be follow up errors.");
          return;
        }
      }
    }
  }


  public startAllNodes(force = false): NodeState[] {
    this.nodeStates.forEach((n) => {
      n.start(force);
    });
    return this.nodeStates;
  }

  // stop's all validator nodes, but not the RPC Node
  public stopAllNodes(force = false) {
    this.nodeStates.forEach((n) => {
      if (n.isStarted) {
        n.stop(force);
      }
    });
  }

  public stopRpcNode(force = false) {
    if (this.rpcNode) {
      if (this.rpcNode.isStarted) {
        this.rpcNode.stop(force);
      }
    }
  }

  public getNode(nodeID: number): NodeState {

    if (nodeID == 0) {
      throw new Error('nodeIDs are index-1 based');
    }

    this.ensureNodeStates(nodeID);
    const nodeState = this.nodeStates[nodeID - 1];
    console.assert(nodeState.nodeID == nodeID, 'Unexpected NodeID');
    return nodeState;
  }

  private ensureNodeStates(numOfStates: number) {

    if (this.nodeStates.length < numOfStates) {

      const nodeInfos = loadNodeInfosFromTestnetDirectory();

      while (this.nodeStates.length < numOfStates) {
        const publicKey = nodeInfos?.public_keys[this.nodeStates.length];
        const address = nodeInfos?.validators[this.nodeStates.length];
        this.nodeStates.push(new NodeState(this.nodeStates.length + 1, publicKey, address));
      }
    }
  }

  public initFromTestnetManifest() {
    const nodeInfos = loadNodeInfosFromTestnetDirectory();
    if (nodeInfos) {
      this.ensureNodeStates(nodeInfos.public_keys.length);
      this.rpcNode = new NodeState(0, undefined, undefined);
    }
  }

  public getNodeByPublicKey(proposer: string): NodeState | undefined {
    const nodes = this.nodeStates.filter(x => x.publicKey == proposer);

    if (nodes.length > 1) {
      throw Error(`More than one Node with Public Key found: ${proposer}`);
    }

    if (nodes.length === 1) {
      return nodes[0];
    }

    return undefined;
  }

  public getNodeByValidatorAddress(validatorAddress: string): NodeState | undefined {
    const nodes = this.nodeStates.filter(x => x.address?.toLowerCase() == validatorAddress.toLowerCase());

    if (nodes.length > 1) {
      throw Error(`More than one Node with Validator Address found: ${validatorAddress}`);
    }

    if (nodes.length === 1) {
      return nodes[0];
    }

    return undefined;
  }

  public async getNodeByStakingAddress(poolAddress: string): Promise<NodeState | undefined> {


    // TODO: 
    let contractManager = ContractManager.get();
    await contractManager.getAddressMiningByStaking(poolAddress);


    const nodes = this.nodeStates.filter(x => x.address == poolAddress);

    if (nodes.length > 1) {
      throw Error(`More than one Node with Pool Address found: ${poolAddress}`);
    }

    if (nodes.length === 1) {
      return nodes[0];
    }

    return undefined;
  }


  public async formatNodeName(stakingOrValidatorAddress: string) {

    let node = this.getNodeByValidatorAddress(stakingOrValidatorAddress);
    

    if (!node) {
      node = await this.getNodeByStakingAddress(stakingOrValidatorAddress);
    }
    
    if (node) {
      return `${stakingOrValidatorAddress}(${node.sshNodeName()})`;
    }

    return stakingOrValidatorAddress;
  }

}


// async function testIt() {

//   const nodeState = NodeManager.get().startNode(2);
//   await nodeState.stop();
// }


// testIt();

