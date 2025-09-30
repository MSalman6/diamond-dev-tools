import { NodeState } from "../net/nodeManager";
import { cmd, cmdR } from "../remoteCommand";
import { getNodesFromCliArgs } from "./remotenetArgs";
import fs from 'fs';
import { ConfigManager } from "../configManager";

async function run() {

  //todo: work on configurability.
  //const date = '2021-09-03';
  const installDir = ConfigManager.getNetworkConfig().installDir;
  
  const outputFileRemote = 'analyze_missmatch_network.log';
  const outputDirectory = 'testnet/testnet-analysis/log-slices/missmatch_network';
  const remoteDirectory = `~/${installDir}/`;

  //console.log(`creating filtered log file for ${date}`);
  console.log('ensuring output directory: ', outputDirectory);

  cmd('mkdir -p ' + outputDirectory);

  // const cmd_boring_connections = 'INFO parity_ws::io  Accepted a new tcp connection from';

  const tx = 'could not be processed due to missing/mismatching network info';

  //console.log(`creating filtered log file for tx ${date}`);
  const command = `grep '${tx}' ${remoteDirectory}parity.log | sed '/Accepted a new tcp connection from/d' > ${remoteDirectory}${outputFileRemote}`;

  const nodes = await getNodesFromCliArgs();

  async function workNodeAsync(node: NodeState) {

    const sshName = node.sshNodeName();
    const remoteFileFullPath = remoteDirectory + outputFileRemote;
    const targetFileFullPath = `${outputDirectory}/${sshName}.log`;

    if (fs.existsSync(targetFileFullPath)) {
      console.log(`target file already found. skipping node ${sshName} - delete file if you want to execute operation again.`);
      return;
    }

    console.log(`${sshName} creating on ${outputFileRemote}`);
    console.log(`${sshName} deleting current file if available:  ${outputFileRemote}`);

    try {
      cmdR(sshName, `rm ${remoteFileFullPath}`);
    } catch {
      //just ignore file not found.
    }

    console.log(`${sshName} creating log file....`);
    cmdR(sshName, command);
    console.log(`${sshName} downloading created file log slice.`);

    cmd(`scp -C ${sshName}:${remoteFileFullPath} ${outputDirectory}/${sshName}.log`);
  }

  //async.each(nodes, workNodeAsync);


  const promisses = new Array<Promise<any>>();

  console.log(`working all ${nodes.length} in parallel.`);

  nodes.forEach(async (node) => {
    const promise = new Promise(() => workNodeAsync(node));
    promisses.push(promise);
  });

  console.log(`awaiting work.`);
  for (const promise of promisses) {
    await promise;
  }
  console.log(`work finished.`);



}

run();