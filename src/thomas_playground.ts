// sends transactions from a single account in a loop, waiting for the nonce to increment at the RPC node

"use strict";

import Web3 from 'web3';
import {PromiEvent, TransactionConfig, TransactionReceipt} from "web3-core";
import { BigNumber } from 'bignumber.js';
import {KeyPair, generateAddressesFromSeed } from './utils'


//just a dummy adress to approve that the values get there
const addrTarget = '0x1000000000000000000000000000000000000001';

const privKey = '0xab174fabad1b7290816cbebf3f235af9145f0ee482b0775992dcb04d5e9ad77d';
const addr = '0x0102ac5315c1bd986a1da4f1fe1b4bca36fa4667';

// const privKey = '0x888D0470DB4671F092B366537F5D0BBD137BC34D4CA6DFECA88A8C54A4C45B36';
// const addr = '0x074110Dd9220DbeD96F71795De4513bb06d23b28';

const mnemonic = "easy stone plastic alley faith duty away notice provide sponsor amount excuse grain scheme symbol"; // 12 word mnemonic

var myArgs = process.argv.slice(2);

console.log('args: ', myArgs);

//const web3 = new Web3('http://185.244.194.53:8541');


const web3 = new Web3('https://rpc.tau1.artis.network');

//
//const web3 = new Web3('http://127.0.0.1:8545');

const countOfRecipients = 10;
//on new network you might want to "feed" all the accounts.
const transactionValue = '0';


async function printBalances(addresses: Array<KeyPair>){
  for(let i = 0; i < addresses.length; i++) {
    const a = addresses[i].address;
    const balance = await web3.eth.getBalance(a);
    console.log(a + ' : ' + balance);
  }
};

async function DoSomeStuff() {

  const addresses = generateAddressesFromSeed(mnemonic, countOfRecipients);

  console.log('Balances before run:');
  await printBalances(addresses);

  //return;

  //web3.eth.transactionConfirmationBlocks = 0;
  const currentBlockNumber = await web3.eth.getBlockNumber();

  console.log('currentBlockNumber from  185.244.194.53:8541 = ', currentBlockNumber);

  //const web3Local = new Web3('http://127.0.0.1:8540');

  //console.log('currentBlockNumber from  local = ', await web3Local.eth.getBlockNumber());

  let nonceBase = await web3.eth.getTransactionCount(addr);

  //going to cache the number of transactions,
  // so the signing process does not


  const rawTransactions : Array<string> = new Array<string>(countOfRecipients);

  for(let i = 0; i < countOfRecipients; i++) {

    //console.log(`next nonce: ${nonce}`);
    const txObj : TransactionConfig = {
      from: addr,
      to: addresses[i].address,
      gas: 21000,
      gasPrice: '100000000000',
      value: '1000000000000000000',
      nonce: nonceBase + i,
    };

    console.log(`preparing TX: `, txObj);

    const signedTx = await web3.eth.accounts.signTransaction(txObj, privKey);
    console.log('got signed Transaction: ', signedTx.rawTransaction);

    rawTransactions[i] = signedTx.rawTransaction!;
  }

  console.log(`all Transaction Signatures created`, rawTransactions);


  const startDate = Date.now();

  let transactionsConfirmed = 0;

  const confirmationsPromises = new Array<PromiEvent<TransactionReceipt>>(countOfRecipients);

  for(let i = 0; i < countOfRecipients; i++) {
    const signedTx = rawTransactions[i];

    console.log(`sending: ${i}`, signedTx);
    const sendResult = web3.eth.sendSignedTransaction(signedTx)
        .once('error', (error: Error) => {
          console.error('Error While Sending!', error);
        })
        .once('confirmation', (confNumber: number, receipt: TransactionReceipt) => {
          console.log(`Received Tx on Blockchain: blockNumber: ${receipt.blockNumber}, transactionHash: ${receipt.transactionHash}`);
          transactionsConfirmed++;
        })
        .once('transactionHash', (receipt: string) => {
          console.log(`TransactionHash : ${receipt}`);
        });

    confirmationsPromises[i] = sendResult;
  }



  console.log(`All Transactions send to the blockchain.`);

  nonceBase = nonceBase + countOfRecipients;

  //sending dummy Transaction
  /*web3.eth.sendTransaction({
    from: addr,
    to: addr,
    gas: 21000,
    gasPrice: '100000000000',
    nonce: nonceBase + 1
  })*/

  for(let i = 0; i < countOfRecipients; i++) {
    const promiEvent = confirmationsPromises[i];
    await promiEvent;
    console.log(`Confirmed Transaction ${i}`);
  }

  console.log(`Confirmed all Transactions`);

  //console.log('send Result: ', sendResult);
  //const newTargetAddressBalance = await web3.eth.getBalance(addr);
  //console.log('new target address Balance: ', newTargetAddressBalance);
}

DoSomeStuff().then((value) => {
  console.log('Job Done!!', value);
}, (error) => {
  console.error('got some Error', error);
  console.log('');
});
