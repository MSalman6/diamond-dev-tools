import Web3 from "web3";
import { LocalnetScriptRunnerBase, LocalnetScriptRunnerResult } from "./localnetBootstrapper";


class EarlyEpochEndRunner extends LocalnetScriptRunnerBase {


    constructor() 
    : LocalnetScriptRunnerBase() 
    {

    }

    async runImplementation(web3: Web3): Promise<LocalnetScriptRunnerResult> {
          
    }


} 
