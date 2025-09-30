# honey-badger-testing

A collection of scripts to test the Honey Badger BFT integration in Parity

the term `localnet` refers to a local testnet.
the term `remotenet` refers to a testnet that is accessable via SSH,
and requires ssh config entries in the sheme `hbbft1, hbbft2, ....hbbft999`,
as well corrisponding files in the testnet nodes directory


# Project setup

parallel to ./diamond-dev-tools
this project requires othe projects as well.

depending on the features you need, this is the bare minimum:
- Rust (cargo)
- NPM




```
git clone https://github.com/DMDcoin/diamond-contracts-core.git
cd diamond-contracts-core && npm ci && cd ..

git clone https://github.com/DMDcoin/diamond-node.git


git clone https://github.com/DMDcoin/diamond-dev-tools.git
cd diamond-dev-tools
npm ci
npm run localnet-create-mnemonic
```

## SSH setup

The projects expects that you have SSH access to the servers where you want to deploy the testnetwork.
The SSH Servers neet to be registered in the ssh config file on linux.
you can have as many testservers as you want.
the SSH servers need to be registered as the following naming scheme:
hbbft1, hbbft2, ...


# creating a localnet
define the parameters of a new localnet in the config and
`npm run localnet-fresh`

# deploying a remote net

A remotenet can be deployed from a localnet.
It is advised to deploy only fresh (never started) localnets,

 
# deployment of a testnet on remote machines

the following examples define all nodes (` -- -a`) as target.
use `-- --help` if you want to specify alternative options.

## preparing a repo and branch with the data

In order to unify the network,
and having all nodes deployed the same way,
we use a repository in between. 

Prepare chain.spec and reservered-peers file on git repo before starting network.


## reserved-peers

Nodes on the Network require communication partners that distribute the enode of other available nodes of the network.
It is advised to have a couple of nodes to spin up this network.

There is room for improvements here, instead of reserved peers, 
we rather should only have boot nodes that do nothing else than distributing this information,
and closing the connection once this is done, so the boot nodes do not have to hold a lot of communication channels open,
and are always able to onboard new nodes in the network.


## deploy the MoC

The MoC is the first node that bootstraps the network.
It does not have a stake on it's own, and the smart contracts pass over the consensus to the first nodes that are going to be staked on.her
It is advised, once this happened, to remove the Signer key from the MoC and run it in another configuration.

The MoC is  known as "hbbft1" in this setup, and the Node can act as reserved peer.


## deploy the network


```
# pulls the network specified in the settings. networkGitRepo and networkGitRepoBranch
npm run remotenet-git-clone-network  -- -a

npm run remotenet-deploy-from-localnet -- -a 

# check local example node if there are any unwanted changes
# npm run remotenet-git-reset -- -a

# run the update from git async first.
npm run remotenet-run-build-from-source-fast -a
# confirm the success by doing the update sync.
npm run remotenet-binary-update-from-git -- -a
```


now we need to generate communication information between the peers.
the following script generates a reserved peers file for the rpc port on the deployed network.

## starting the network.


## staking on validators





# diamond indexer
Diamond indexer is a service that indexes the posdao contracts on a postgres db 


```
git clone https://github.com/DMDcoin/honey-badger-testing.git

```

# Performance Test Scripts

The test scripts are implemented using node.js v10, install and run as usual:

```
npm ci
```

There are following tests available:
- latency1 (1 Transaction all 1-10 Seconds)
- latency2 (1 Transaction all 1-10 Seconds, background baseload 10tx/second)
- throughput1 (~ 70 transactions a second)
- throughput2 (~ 7 * 70 transactions a second, distributed on multiple nodes in the network.)

The Tests are further described in detail here:
https://github.com/artis-eco/wiki/wiki/Honey-Badger-BFT-Hypothesis-Testing

It is possible to run all tests using the `npm run runAllTests` command.


The Tests are configured in the ./config directory.

Starting from a new Testchain requires to feed those testaccounts first: `npm run feedAccounts`


## Test Results

The tests write Testresults into the output directory.
This directory is not mapped by the Git repository.
Testresults, that require to be analysed need to get 
manually transfered to the jupyter/data directory.

## Test Result Analysis

Jupyter Notebooks are used to analyse the testresults.
please refere to the jupyter/README.md

# Testnet Setup Scripts

This repository contains scripts to automatically generate config files to set up a hbbft test network of arbitrary size.

# SSH Setup

The remote-net-system works on the system of named ssh nodes.
Therefore every setup is supported that can be supported by the ssh system.
you can either have a Network infrastructure on localhost, localhost within a (para) VM,
remote VM's, real hardware...

The system expects to have the nodes numerated in the sense of
- hbbft1
- hbbft2
- ...


# Pumba Chaos Testing

We are using Docker to quickly spin up and down a test network of any size.

One desired property of the setup is the ability to replace individual Docker nodes with locally running nodes for the purpose of interactive debugging.

We achieve this property by mapping the nodes' port to the Docker bridge address, and let all nodes communicate through this bridge address. Locally running nodes can bind to that interface as well, allowing for a mix of Docker and local nodes.

## Usage

Requirements:
* The following repositories cloned at the same directory level as this repository
  * diamond-node (git@github.com:dmdcoin/diamond-node.git)
  * diamond-contracts-core (git@github.com:dmdcoin/diamond-contracts-core.git)
* Python >=v3.6
* Docker

To generate the configs for n nodes cd into this repository and execute:
```
cd pumba
./setup_testnet.py n
```
Where "n" has to be replaced by a number >=1 denoting the number of validator node configs to generate.

The script also supports generating configs for nat/extip setups. Simply add the external ip address as argument to the script.
```
./setup_testnet.py n ext_ip
```
Where "ext_ip" has to replaced by the external IP address to use.

## Folder Structure

To be compatible with both local and Docker nodes we have to use an appropriate directory structure.

For the sake of simplicity we choose a single directory containing all configs and data to be mounted into a Docker volume.

Caveat: Filesystem performance inside of a Docker volume may be significantly slower than inside the container. We may re-consider the approach of sharing the "data" folder through a Docker volume for that reason.


## Block Number Tracking

Requires to manually find the first block in the CSV.
We could fix this by memorizing the block number befor we start.
For example by writing it into a file.



# Managing Network


## creating a testnetwork

`npm run testnet-fresh`

## clone whole infrastructure from git
`npm run remotenet-git-clone-network`


## building diamond node fresh

removing existing installation, and getting new one as defined in the repository
```
npm run remotenet-git-delete-node
npm run remotenet-git-setup-build-from-source

```

Building the Node Software
```
npm run remotenet-git-pull-node-and-build
```

or if a lot of nodes have to be build, do it async

```
npm run remotenet-binary-update-from-git-async
```


# tipps for managing nodes.


## example stop a node and build latest from git
```
export NODE_TARGET= -s hbbft10 
npm run remotenet-stop $NODE_TARGET && npm run remotenet-git-pull-and-build $NODE_TARGET         
```