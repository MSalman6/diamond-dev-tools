import { ConfigManager } from './configManager';
import { LogFileManager } from './logFileManager';
import BigNumber from 'bignumber.js';

const web3 = ConfigManager.getWeb3();
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;


export interface BlockInfo {
  blockNumber: number,
  numberOfTransactions: number,
  gasUsed: number,
  timestamp: number,
  size: number
}

function timestampToNumber(value: number | string) : number {
  if (typeof value === 'number') {
    const result: number = value as number;
    return result;
  } else if (typeof value === 'string') {
    const result: number =  parseInt(value);
    return result;
  }
  throw new Error(`Unkown value type: ${typeof value}`);
}

async function doLoggings() {
  const latestBlockNumber = await web3.eth.getBlockNumber();
  let numberOfBlocksToLog = 1000;

  if ( numberOfBlocksToLog > latestBlockNumber ){
    numberOfBlocksToLog = latestBlockNumber;
  }

  const blockInfos = new Array<BlockInfo>();



  for(let blockNumber = latestBlockNumber - numberOfBlocksToLog; blockNumber <= latestBlockNumber; blockNumber++) {
    const block = await web3.eth.getBlock(blockNumber);
    //console.log('block: ', block);
    // block.timestamp
    blockInfos.push({
      blockNumber: block.number,
      numberOfTransactions: block.transactions.length,
      gasUsed: block.gasUsed,
      timestamp: timestampToNumber(block.timestamp),
      size: block.size,
    });
   

  }

  const csvStringifier = createCsvStringifier({
    alwaysQuote: true,
    header: ['blockNumber', 'numberOfTransactions', 'gasUsed','timestamp', 'size']
  });

  let headerString = csvStringifier.header.join(',') + '\n';


  const contentToExport = headerString + csvStringifier.stringifyRecords(blockInfos);
  LogFileManager.writeBlockchainOutput(contentToExport);
}

doLoggings().then(() => {
  process.exit(0);
});
