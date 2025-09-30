import { createOptionsSection } from "ts-command-line-args";
import { Account, PromiEvent, TransactionReceipt } from "web3-core";
import { ConfigManager } from "../configManager";
import { FastTxSender } from "../tools/FastTxSender";
import { isErrorWithMessage, toErrorWithMessage } from "../utils/error";
import { sleep } from "../utils/time";



async function runPerformanceTests() {

  const web3 = ConfigManager.getWeb3();
  const { toWei, toBN } = web3.utils;
  const sendAccounts : Array<Account> = [];

  //const minBalance = toBN(toWei('1', 'ether'));
  // min gas price delivers wrong information from rpc.

  const minGasPrice = '1000000000';
  const actualMinGasPrice = await web3.eth.getGasPrice();

  const dataSize = 0; // 16 * 1024;

  if (minGasPrice != actualMinGasPrice) {
    console.warn(`WARNING: minGasPrice (${minGasPrice}) is not equal to actualMinGasPrice (${actualMinGasPrice})`);
  }


  //let maxTransactionsAtOnce = 80;
  //let maxAccounts = 100;

  let maxTransactionsPerAccount = 80;
  let maxAccounts = 500;

  // gas usage calculation.
  const costPerByte = 16;
  const baseGasCost = 21000;
  const dataGasCost = costPerByte * dataSize;
  const totalGasCostPerTransaction = baseGasCost + dataGasCost;

  const minBalance = toBN(minGasPrice).mul(toBN(totalGasCostPerTransaction)).muln(maxTransactionsPerAccount);
  console.log("Min gase Price:", minGasPrice);
  console.log("required min balance per account:", minBalance.toString(10));
  // const fundingPromises : Array<PromiEvent<TransactionReceipt>> = [];
  // let nonce = await web3.eth.getTransactionCount(web3.eth.defaultAccount!);
  
  let fastTxSender = new FastTxSender(web3);
  console.log('Creating accounts for wallet, using funding address: ', web3.eth.defaultAccount);


  for(let i = 1; i <= maxAccounts; i++) {

    
    const account = web3.eth.accounts.create(`test${i}` );
    web3.eth.accounts.wallet.add(account);
    sendAccounts.push(account);
    
    const balance = web3.utils.toBN(await web3.eth.getBalance(account.address));

    if (balance.lt(minBalance)) {
      console.log(`Funding: `, account.address);
      const tx = { from: web3.eth.defaultAccount!, to: account.address, value: minBalance, gas: 21000, gasPrice: minGasPrice };
      await fastTxSender.addTransaction(tx);
    }

    if (fastTxSender.rawTransactions.length >= maxTransactionsPerAccount) { 
      console.log('sending funding transactions...');
      await fastTxSender.sendTxs();
      console.log('waiting for transactions to be mined...');
      await fastTxSender.awaitTxs();
      console.log('funding transactions mined, continuing...');
      fastTxSender = new FastTxSender(web3);
    }

    // nonce ++;
  }

  if (fastTxSender.rawTransactions.length > 0) {
    console.log('sending Fund accounts transactions...');
    await fastTxSender.sendTxs();

    console.log('waiting for transactions to be mined...');
    await fastTxSender.awaitTxs();
  }

  fastTxSender = new FastTxSender(web3);

  
  console.log("All funding transactions confirmed.");
  console.log("starting preparation of Test transactions.");
  const timerIDPreparing = "preparingTransactions";
  console.time(timerIDPreparing);
  

  // dummy payload data shipped with the transaction.
  const payloadData = '0x' + 'D4'.repeat(dataSize);
  
  for (const account of sendAccounts) {
    console.log(`preparing transactions for account ${account.address}.`);
    // let startNonce = await web3.eth.getTransactionCount(account.address);
    for (let i = 0; i < maxTransactionsPerAccount; i++) {

      await fastTxSender.addTransaction({ from: account.address, to: account.address, value: 0, data: payloadData,gas: totalGasCostPerTransaction, gasPrice: minGasPrice });
    }
  }

  console.log("finished preparing transactions");
  console.timeEnd(timerIDPreparing);

  const expectedTransactions = maxTransactionsPerAccount * sendAccounts.length;

  console.log(`all Txs prepared - starting sending ${maxTransactionsPerAccount} transactions with ${sendAccounts.length} unique accounts. (${expectedTransactions} transactions in total)`);
  const sent = await fastTxSender.sendTxs();

  if (sent !== expectedTransactions) { 
    console.error(`sent ${sent} transactions, expected ${expectedTransactions}`);
  }

  console.log('all Txs Sent - awaiting confirmations');

  const timerIDConfirmingTransactions = "confirmingTransactions";
  console.time(timerIDConfirmingTransactions); 
  await fastTxSender.awaitTxs();
  console.log(`all ${sent} txs confirmed.`);
  console.timeEnd(timerIDConfirmingTransactions);
}

runPerformanceTests();

