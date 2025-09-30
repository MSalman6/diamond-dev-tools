import { ConfigManager } from '../configManager';
import { cmd, cmdR } from '../remoteCommand';

// var exec = require('child_process').exec, child;
import { getNodesFromCliArgs } from './remotenetArgs';

async function run() {
  const config = ConfigManager.getConfig();
  const installDir = ConfigManager.getRemoteInstallDir();
  const { networkGitRepoBranch, networkGitRepo } = config;

  const nodes = await getNodesFromCliArgs();

  const dir = `~/${installDir}`;

  for (const n of nodes) {
    console.log('Executing on Node: ', n.sshNodeName());

    const alreadyExists = false;

    const lsResult = cmdR(n.sshNodeName(), 'ls');

    if (lsResult.includes(installDir)) {
      console.log('Directory already exists! no further actions on node', n.sshNodeName());
      continue;
    }

    console.log('Cloning git repo');

    const cloneResult = cmdR(n.sshNodeName(), `git clone ${networkGitRepo} ${installDir} --branch ${networkGitRepoBranch}`);

    console.log(cloneResult);

    cmdR(n.sshNodeName(), `cd ${dir} && ./setup-build-from-source.sh`);
  }
}

run();
