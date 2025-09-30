import { ConfigManager } from '../configManager';




export function getBuildFromSourceCmd(checkout: boolean = false, copy: boolean = true) {
  const config = ConfigManager.getConfig();
  const installDir = ConfigManager.getNetworkConfig().installDir;
  const diamondNodeBranch = ConfigManager.getNodeBranch();

  //const x = ConfigManager.getNetworkConfig().
  const profile = config.nodeProfile;

  const deadlockDetection = ConfigManager.getOpenEthereumDeadlockDetection();
  const dir = `~/${installDir}/diamond-node-git/`;

  let checkoutCMD = checkout ? `&& git checkout ${diamondNodeBranch} ` : '';
  let copyCMD = copy ? `&& cp target/${profile}/diamond-node ../diamond-node` : '';

  //let singleThreadOption = '-j 1 ';
  let singleThreadOption = '';
  let features = deadlockDetection ? ' --features deadlock_detection' : '';
  return `cd ${dir} && rm -f target/${profile}/libparity_version.rlib ${checkoutCMD} && git pull  && export RUSTFLAGS='-C target-cpu=native' &&  ~/.cargo/bin/cargo build ${features} --profile=${profile} --all ${singleThreadOption} ${copyCMD}`;
}
