import { ContractManager } from "../../contractManager";



let call = "0x911cee74000000000000000000000000dd064d46e8393fafed023242a7a7cde16a4249d500000000000000000000000000000000000000000000000000000000000000181465031c9c81fe2c99a82ea7de30db66d183165b669c84aa855beb9e9d4076c2"


async function exec() {

    let permission = ContractManager.get().getContractPermission();

    let sender = "0x42567d3b701016548d9f8aa4b268a6db1925cac1";
    let to = "0x1200000000000000000000000000000000000001";
    let result = await permission.methods.allowedTxTypes(sender, to, 0, 0, call).call();

    console.log(result);
}

exec();

