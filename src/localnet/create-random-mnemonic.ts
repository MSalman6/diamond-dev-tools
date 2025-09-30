
//import bip39 from "bip39";
import fs from "fs";
//import Web3 from "web3";
import { generateAddressesFromSeed } from "../utils";
// creates a random mnemonic and writes the first address out to .mainaddress



async function run() {
  
  if (fs.existsSync(".mnemonic")) {
    console.error(".mnemonic file already exists");
    process.exit(1);
  }

  let bip39 = require("bip39");
  
  
  const mnemonic = bip39.generateMnemonic(256);
  let mainAddress = generateAddressesFromSeed(mnemonic, 1)[0].address;
  
  fs.writeFileSync(".mnemonic", mnemonic);
  fs.writeFileSync(".mainaddress", mainAddress);

}

run();
