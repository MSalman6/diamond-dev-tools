#!/usr/bin/python3

import os
import subprocess
import sys
from shutil import copyfile


def print_help():
    print('help:')
    print('requires 1 or 2 arguments:')
    print('1: number of initial validator nodes to create')
    print('2: (optional): number of total nodes to create. Must be bigger than or equal to argument 1')

def writeEnv(envName, envDefaultValue):
    VALUE = os.getenv(envName)
    if VALUE is None:
        os.environ[envName] = envDefaultValue


if len(sys.argv) == 1:
    print_help()
    exit()


if len(sys.argv) > 3:
    print_help()
    exit()


num_initialValidators = int(sys.argv[1])
num_nodes = num_initialValidators

if len(sys.argv) == 3:
    num_nodes = int(sys.argv[2])

def run_cmd(args, cwd=None):
    p = subprocess.Popen(args, cwd=cwd)
    p.wait()

print('Generating testnet with {num_initialValidators} out of {num_nodes}'.format(num_initialValidators=num_initialValidators, num_nodes=num_nodes))

print('Generating Docker config volume folders for {num_nodes} hbbft validator nodes'.format(num_nodes=num_nodes))

generator_dir = '../../diamond-node/crates/ethcore/src/engines/hbbft/hbbft_config_generator'

writeEnv("NETWORK_NAME", "DPoSChain")
writeEnv("NETWORK_ID", "777012")
writeEnv("OWNER", "0x32c5f14302d4Dd973e0040a5d7Eda97222A928D1")
writeEnv("STAKING_EPOCH_DURATION", "3600")
writeEnv("STAKE_WITHDRAW_DISALLOW_PERIOD", "1")
writeEnv("STAKING_TRANSITION_WINDOW_LENGTH", "600")
writeEnv("STAKING_MIN_STAKE_FOR_VALIDATOR", "10000")
writeEnv("STAKING_MIN_STAKE_FOR_DELEGATOR", "100")

cmd = ['cargo', 'run', str(num_initialValidators), str(num_nodes), 'Docker', '--tx_queue_per_sender=100000', '--metrics_port_base=48700', '--metrics_interface=all']

if len(sys.argv) > 3:
    cmd.extend(sys.argv[3:])

run_cmd(cmd, generator_dir)

# The location of the diamond-contracts-core repository clone.
posdao_contracts_dir = '../../diamond-contracts-core'

generatedAssetsDirectory = '../diamond-node/crates/ethcore/src/engines/hbbft/hbbft_config_generator/'

init_data_file = generatedAssetsDirectory + 'keygen_history.json'
nodes_info_file = generatedAssetsDirectory + 'nodes_info.json'

# using correct node version
# run_cmd('nvm use', posdao_contracts_dir)

# Invoke the hbbft chain spec generation script, bool: useUpgradeProxy
# cmd = ['node', 'scripts/make_spec_hbbft.js', init_data_file, 'true']

run_cmd(['npx', 'hardhat', 'compile'], posdao_contracts_dir)
cmd = ['npx', 'hardhat', 'make_spec_hbbft', '--init-contracts', 'initial-contracts.json', '--use-upgrade-proxy', init_data_file]
run_cmd(cmd, posdao_contracts_dir)

# Output of chain spec generation
spec_file = '../../diamond-contracts-core/spec_hbbft.json'

# Set up validator nodes
for i in range(1, num_nodes + 1):
    print("Setting up config for node {}".format(i))
    os.makedirs("nodes/node{}/data/network".format(i), exist_ok=True)
    os.makedirs("nodes/node{}/data/keys/DPoSChain".format(i), exist_ok=True)
    copyfile(generator_dir + "/hbbft_validator_{}.toml".format(i), "nodes/node{}/node.toml".format(i))
    copyfile(generator_dir + "/hbbft_validator_key_{}".format(i), "nodes/node{}/data/network/key".format(i))
    copyfile(generator_dir + "/hbbft_validator_address_{}.txt".format(i), "nodes/node{}/address.txt".format(i))
    copyfile(generator_dir + "/hbbft_validator_public_{}.txt".format(i), "nodes/node{}/public_key.txt".format(i))
    copyfile(generator_dir + "/reserved-peers", "nodes/node{}/reserved-peers".format(i))
    copyfile(spec_file, "nodes/node{}/spec.json".format(i))
    copyfile(generator_dir + "/password.txt", "nodes/node{}/password.txt".format(i))
    copyfile(generator_dir + "/hbbft_validator_key_{}.json".format(i), "nodes/node{}/data/keys/DPoSChain/hbbft_validator_key.json".format(i))    



# Set up Rpc node
os.makedirs("nodes/rpc_node", exist_ok=True)
copyfile(generator_dir + "/rpc_node.toml", "nodes/rpc_node/node.toml")
copyfile(generator_dir + "/reserved-peers", "nodes/rpc_node/reserved-peers")
copyfile(spec_file, "nodes/rpc_node/spec.json")
copyfile( "../" + nodes_info_file, "nodes/nodes_info.json")


# adding the option required for a full sophisticated rpc node.

rpc_node_toml = open('nodes/rpc_node/node.toml', 'a')
rpc_node_toml.write('\n')
rpc_node_toml.write('[footprint]\n')
rpc_node_toml.write('fat_db = "on"\n')
rpc_node_toml.write('tracing = "on"\n')
rpc_node_toml.write('db_compaction = "ssd"\n')
rpc_node_toml.write('pruning = "archive"\n')
rpc_node_toml.write('cache_size = 4960\n')

rpc_node_toml.close()