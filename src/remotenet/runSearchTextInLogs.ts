
import { ConfigManager } from '../configManager';
import { cmdR, cmdRemoteAsync } from '../remoteCommand';
import { getNodesFromCliArgs } from './remotenetArgs';

async function doSearch() {

  const nodes = await getNodesFromCliArgs();

  const results: { [name: number]: string } = {};

  const installDir = ConfigManager.getNetworkConfig().installDir;

  let promis : Promise<void>[] = [];

  let limitOutput = false;

  let grepLimit = limitOutput ? " -m 10" : "";
  //let tailLimit = limitOutput ? " -n 100000" : "";

  let gatherCommand = limitOutput ? `tail -n 100000` : `cat`;

  nodes.forEach(async(x) => {
    const filename = `~/${installDir}/diamond-node.log`;
    //const searchterm = 'Initiating Shutdown: Honey Badger Consensus detected that this Node has been flagged as unavailable, while it should be available.';
    const searchterm = 'deadlock(s) detected';
    const promise = cmdRemoteAsync(x.sshNodeName(), `${gatherCommand} ${filename} | grep ${grepLimit} '${searchterm}'  | cat`).then((result) => { 
      results[x.nodeID] = result;
    });

    promis.push(promise);
  });


  // await Promise.all(nodes.map(x => {
  //   return new Promise(async () => {

  //     const filename = `~/${installDir}/parity.log`;
  //     //const searchterm = 'Initiating Shutdown: Honey Badger Consensus detected that this Node has been flagged as unavailable, while it should be available.';
  //     const searchterm = 'shutdown-on-missing-block-import';

  //     try {
  //       const result = await cmdRemoteAsync(x.sshNodeName(), `grep '${searchterm}' ${filename} | cat`);
  //       results[x.nodeID] = result;
  //     } catch (e: any) {
  //       results[x.nodeID] = e.toString();
  //     }

  //   })
  // }));

  await Promise.all(promis);

  for (let nodeName in results) {


    const result = results[nodeName];
    console.log(nodeName);
    console.log("--------------");
    console.log(result);
    console.log("--------------");
  }

  // executeOnRemotesFromCliArgs("grep '0xe9d5ea9355c245af3950c0052b38beeb208ca29507983c1b5c8b3c3ab4435b87' ~/dmdv4-testnet/parity.log");
}


doSearch();



