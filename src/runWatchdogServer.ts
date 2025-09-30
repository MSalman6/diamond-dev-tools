import { ConfigManager } from "./configManager";
import { ContractManager } from "./contractManager";
import { NodeManager } from "./net/nodeManager";
import { LogToHtmlAdapter } from "./server/LogToHtmlAdapter";
import { Watchdog } from "./watchdog";
import express from 'express';

async function startWatchdogServer() {

    console.log( `inistializing watchdog server`);

    const log = console.log;
    // console.log = (...args: any[]) => {
    //     const message = args.join(' ');
    //     logs.push(message);
    //   };


    const web3 = ConfigManager.getWeb3();
    const nodeManager = NodeManager.get();
    const contractManager = new ContractManager(web3);
    const watchdog = new Watchdog(contractManager, nodeManager);
    
    //log("starting watchdog");

    const logAdapter = new LogToHtmlAdapter();
    logAdapter.inject();
    watchdog.startWatching(true);

    const app = express();


    app.get('/', (req, res) => {
        // res.json(logs);
        //res.write(logs.join("\n"));
        //log(logs);
        
        
        let doc = logAdapter.getLogsAsHTMLDocument(1000);
        res.send(doc);
      });



    app.get('/full', (req, res) => {
        // res.json(logs);
        //res.write(logs.join("\n"));    
        res.send(logAdapter.getLogsAsHTMLDocument(undefined));
    });
    
    const port = 8080;
    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`); 
    });

    log("Server started, waiting for requests...");
}



startWatchdogServer();

