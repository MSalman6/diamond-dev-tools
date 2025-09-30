

import request from "request";
import { Dictionary } from "underscore";
import Web3 from "web3";
import { Account, SignedTransaction } from "web3-core";
import { TransactionConfig } from "web3-eth";
import { ConfigManager } from "../configManager";
import { awaitTransactions } from "./awaitTransactions";
import axios from "axios";
import { sleep } from "../utils/time";



// a fast tx sender that can work in 3 stages to patch work transactions
// signing and sending are different steps to be able to make "fast send" performance tests.
// sending is done by the direct JSON RPC Interface instead of the slow Web3 Interface.
// 1. signing
// 2. sending
// 3. waiting for receipt
export class FastTxSender {

  rawTransactions: string[] = [];
  transactionHashes: string[] = [];
  transactionSentState: boolean[] = [];

  // holds the latest nonces for each used account.
  nonces: Dictionary<number> = {};

  accounts_is_initialized = false;
  accounts: Dictionary<Account> = {};

  blockBeforeSent: number = Number.NaN;

  rpcJsonHttpEndpoint: string = 'http://localhost:8540';

  maxPRCTransactionDispatchAtOnce = 80;

  currentDispatchedTransactions = 0;

  public constructor(public web3: Web3) {

    // get rpcJsonHttpEndpoint from web3
    // if (web3.currentProvider && web3.currentProvider['host'] {
    //   this.rpcJsonHttpEndpoint = web3.currentProvider.host;
    // }

    this.rpcJsonHttpEndpoint = ConfigManager.getNetworkConfig().rpc;
  }

  private ensureAccountsIsInitialized() {

    // 
    if (!this.accounts_is_initialized) {

      this.accounts = {};
      for (let i = 0; i < this.web3.eth.accounts.wallet.length; i++) {
        let wallet = this.web3.eth.accounts.wallet[i];
        this.accounts[wallet.address] = wallet;
      }

      this.accounts_is_initialized = true;
    }
  }

  // adds transaction to the pool of transactions being sent.
  // first call will initialize the account pool and might be slow for large wallets.
  /// @returns transaction hash - there is a known issue with the transaction hash being different from the one reported by the network in some cases.
  public async addTransaction(txConfig: TransactionConfig): Promise<string> {

    let signedTransaction = await this.signTransaction(txConfig);
    if (!signedTransaction.transactionHash) {
      throw Error("No transaction hash.");
    }
    // this.transactionHashes.push(signedTransaction.transactionHash!.toLocaleLowerCase());
    this.rawTransactions.push(signedTransaction.rawTransaction!);
    this.transactionSentState.push(false);

    this.transactionHashes.push(signedTransaction.transactionHash);

    return signedTransaction.transactionHash!;
  }



  private async signTransaction(txConfig: TransactionConfig): Promise<SignedTransaction> {

    if (!txConfig.from) {
      throw Error('txConfig.from is not set');
    }

    this.ensureAccountsIsInitialized();

    if (!this.accounts[txConfig.from]) {

      this.accounts_is_initialized = false;
      // reinitialize accounts - this takes place if a wallet was added after the last Accounts initialization.
      this.ensureAccountsIsInitialized();

      if (!this.accounts[txConfig.from]) {
        throw Error(`txConfig.from is not in the wallet: ${txConfig.from}`);
      }
    }

    if (typeof txConfig.from === 'number') {
      throw Error('number as from address not supported.');
    }

    let account = this.accounts[txConfig.from];

    let nextNonce = Number.NaN;

    if (txConfig.from in this.nonces) {
      // if we have a nonce stored in nonces, we continue from there.
      nextNonce = this.nonces[txConfig.from] + 1;
    }
    else {
      // if we don't have a nonce, we get it from the network.
      nextNonce = await this.web3.eth.getTransactionCount(txConfig.from);
    }

    this.nonces[txConfig.from] = nextNonce;

    txConfig.nonce = nextNonce;
    let signedTransaction = await account.signTransaction(txConfig);

    if (!signedTransaction.rawTransaction) {
      throw Error("rawTransaction not received.");
    }

    if (!signedTransaction.transactionHash) {
      throw Error("No transaction hash.");
    }

    return signedTransaction;
  }

  public async sendSingleTx(txConfig: TransactionConfig) {

    await this.addTransaction(txConfig);


    let last_index = this.transactionHashes.length - 1;
    
    //await this.sendTx();

    if (Number.isNaN(this.blockBeforeSent)) {
      this.blockBeforeSent = await this.web3.eth.getBlockNumber();
    }

    await this.sendSingleTxRaw(last_index);
  }

  private sleep(millis: number) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, millis);
  }


  private sendSingleTxRaw(transactionIndex: number) {


    // axios or javascript gets in trouble if we are sending to much.
    // we will do here a dirty loop sleep to wait for the transaction to be sent.


    if (this.transactionSentState[transactionIndex]) {
      console.log("transaction already sent, skipping.", transactionIndex);
      return;
    }
    // let tx_hash = await this.addTransaction(txConfig);
    // await this.sendTx();

    let raw_tx: string = this.rawTransactions[transactionIndex];
    let rpc_cmd =
    {
      method: 'eth_sendRawTransaction',
      params: [raw_tx],
      jsonrpc: "2.0",
      id: 666
    }

    // curl --data '{"method":"eth_sendRawTransaction","params":["0xd46e8dd67c5d32be8d46e8dd67c5d32be8058bb8eb970870f072445675058bb8eb970870f072445675"],"id":1,"jsonrpc":"2.0"}' -H "Content-Type: application/json" -X POST localhost:8545
    var headersOpt = {
      "content-type": "application/json",
    };

    // todo: extend functionaly that it supports others than localhost.
    let sendAddress = this.rpcJsonHttpEndpoint;
    let self = this;

    // while (this.currentDispatchedTransactions >= this.maxPRCTransactionDispatchAtOnce) { 
    //   this.sleep(20);
    // }
    
    this.currentDispatchedTransactions = this.currentDispatchedTransactions + 1;
    let response = axios.post(sendAddress, rpc_cmd, { headers: headersOpt } );

    response.then((r) => {
      // console.log("axios response status: ", r.status);

      this.currentDispatchedTransactions--;
      if (r.status !== 200) {
        console.log("axios response error: ", r.statusText);
        return;
      }

      if (r.data.error) {
        if (r.data.error.code == -32010) {
          // to many transactions in queue.
          // wait, and try again soon. (recursive enter)
          console.log("to many transaction in queue - waiting and retrying.");
          sleep(1).then(() => {
            self.sendSingleTxRaw(transactionIndex);
          });
          return
        }



        console.log("could not send transaction :", r.data.error);
        return;
      }

      //console.log("axios data:", r.data);
      let txHash = r.data.result;

      if (!txHash) {
        console.log("axios response - got no hash: ", r.data);
      }
      // console.log("axios response hash: ", txHash);

      self.transactionHashes[transactionIndex] = txHash;
      self.transactionSentState[transactionIndex] = true;
    }, (reason) => {
      console.log('got error:', reason);
    })

    return response;

    // let resquest = request.post(
    //   sendAddress, // todo: distribute transactions here to different nodes.
    //   data,
    //   function (error, response, body) {
    //     if (error) {
    //       //Trying to close the socket (to prevent socket hang up errors)
    //       //**Doesn't help**
    //       console.log('got error:', error);
    //       return;
    //     }
    //     if (response) {

          
    //       // console.log('got reponse:', response.statusCode);
    //       //console.log('got reponse body:', response.body);

    //       let txHash = response.body.result;
    //       self.transactionHashes.push(txHash);
    //     }
    //   });

  }

  // sends all stored transactions.
  public async sendTxs() {

    if (this.rawTransactions.length === 0) {
      throw Error("addTransaction must be called and awaited in preparation to sendTxs.");
    }

    if (Number.isNaN(this.blockBeforeSent)) {
      this.blockBeforeSent = await this.web3.eth.getBlockNumber();
    }

    let promisses = [];
    console.time('sendTxsRaw');
    
    for (let i = 0; i < this.rawTransactions.length; i++) {
      if (!this.transactionSentState[i]) {

        promisses.push(this.sendSingleTxRaw(i));

        const awaitAllX = 100;
        if (i % awaitAllX === 0) {
          console.log(`sent ${i} transactions so far, awaiting responses for this batch.`);
          //let lastPromisses = promisses.slice(-awaitAllX);
          
          // we just await the last promise, as the worst picked example,
          // other promises are most likely resolved already.
          // and if not, we are await all promisses anyway later.
          
          await promisses[i];
        }
      }
    }

    console.timeEnd('sendTxsRaw');
    
    console.log("sheduled all transactions to be sent, awaiting responses now.", this.rawTransactions.length);
    const awaitTimer = "awaitHashes";
    console.time(awaitTimer);
    await Promise.all(promisses);
    console.log(`all transaction hashes gathered. ${this.transactionHashes.length}/${this.rawTransactions.length}`);
    
    console.timeEnd(awaitTimer);


    return promisses.length;
  }

  // waits for completion for all added transaction. 
  public async awaitTxs() {

    if (Number.isNaN(this.blockBeforeSent)) {
      throw new Error("sendTxs() must be called before awaitTxs() can be called.");
    }

    console.log("awaiting transactions to be mined: ", this.transactionHashes.length);

    await awaitTransactions(this.web3, this.blockBeforeSent, this.transactionHashes);

    // clean up this FastTxSender instance, so it can be reused.
    this.reset();
  }

  public reset(reset_accounts = false) {
    this.rawTransactions = [];
    this.transactionHashes = [];
    this.transactionSentState = [];
    this.blockBeforeSent = Number.NaN;
    // reset nonces as well, it's not that expensive to get them again.
    this.nonces = {};

    // if no accounts get added, we do not need to reset them.
    // that is usually the case.
    if (reset_accounts) {
      this.accounts = {};
      this.accounts_is_initialized = false
    }
  }
}
