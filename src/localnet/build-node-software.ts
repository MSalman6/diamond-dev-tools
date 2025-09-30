import { ConfigManager } from '../configManager';
import { cmd } from '../remoteCommand';

async function run() {
  const config = ConfigManager.getConfig();

  let profile = config.nodeProfile;

  if (profile.length === 0) {
    profile = 'release';
  }

  let profileString = `--profile ${profile}`;

  if (profile === 'debug') {
    profileString = '';
  }

  cmd(`export RUSTFLAGS='-C target-cpu=native' && cargo build --manifest-path ../diamond-node/Cargo.toml ${profileString}`);
}

run();
