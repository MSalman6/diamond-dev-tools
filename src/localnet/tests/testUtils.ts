import Web3 from "web3";
import { sleep } from "../../utils/time";

export async function createBlock(web3: Web3,last_checked_block: number = Number.NaN) {
    
    if (Number.isNaN(last_checked_block)) {
        last_checked_block = await web3.eth.getBlockNumber();
    }
    let current_block =  await web3.eth.getBlockNumber();
    let defaultAccount = web3.eth.defaultAccount!;

    let balance = web3.utils.toBN(await web3.eth.getBalance(defaultAccount));

    if (balance.lt(web3.utils.toBN(1000000000000000000))) {
        console.warn("Not enough balance to send transaction to trigger block creation: missconfiguration ??");
    }

    console.log("sending transaction to trigger block creation, main account balance:", balance.toString());
    // this should be enugh for trigger, but we don't rely on block production.

    let tx = web3.eth.sendTransaction({from: defaultAccount, to: web3.eth.defaultAccount!, gas: "21000", gasPrice:"1000000000"});  
    let transaction_was_confirmed = false;
    tx.on("confirmation", (p) => { 
        console.log("transaction confirmed");
        transaction_was_confirmed = true;
    });
    
    console.log("transaction sent");
    
    //whilst()
    while (!transaction_was_confirmed)  {
        await sleep(250);
        // current_block =  await web3.eth.getBlockNumber();
    }  

    console.log('block created.')
}
