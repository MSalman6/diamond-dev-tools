import { NodeState } from "../net/nodeManager";
import { cmd, cmdR } from "../remoteCommand";
import { getNodesFromCliArgs } from "./remotenetArgs";
import fs from 'fs';
import { nowFormatted } from "../utils/dateUtils";
import { ConfigManager } from "../configManager";

async function run() {

  const date = nowFormatted();
  const installDir = ConfigManager.getNetworkConfig().installDir;

  const outputFileRemote = 'log_4_download.log';
  const outputDirectory = `testnet/testnet-analysis/logs/${date}/`;
  const remoteDirectory = `~/${installDir}/`;

  console.log(`creating filtered log file`);
  console.log('ensuring output directory: ', outputDirectory);

  cmd('mkdir -p ' + outputDirectory);

  // const cmd_boring_connections = 'INFO parity_ws::io  Accepted a new tcp connection from';



  const command = `tail ${remoteDirectory}parity.log -n 1000000 | sed '/Rejecting recently rejected/d' | sed '/Rejected tx already in the blockchain/d' | sed '/Accepted a new tcp connection from/d' > ${remoteDirectory}${outputFileRemote}`;
  const nodes = await getNodesFromCliArgs();



  async function workNodeAsync(node: NodeState) {

    const sshName = node.sshNodeName();
    const remoteFileFullPath = remoteDirectory + outputFileRemote;
    const targetFileFullPath = `${outputDirectory}${sshName}.log`;

    if (fs.existsSync(targetFileFullPath)) {
      console.log(`target file already found. skipping node ${sshName} - delete file if you want to execute operation again.`);
      return;
    }


    try {
      cmdR(sshName, `rm ${remoteFileFullPath}`);
    } catch {
      //just ignore file not found.
      console.log(`could not remove old file to download`);
    }

    console.log(`${sshName} creating on ${outputFileRemote}`);
    console.log(`${sshName} deleting current file if available:  ${outputFileRemote}`);


    console.log(`${sshName} creating log file....`);
    cmdR(sshName, command);
    console.log(`${sshName} downloading created file log slice.`);

    cmd(`scp -C ${sshName}:${remoteFileFullPath} ${outputDirectory}${sshName}.log`);



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