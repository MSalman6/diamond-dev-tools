import * as child from 'child_process';
import { sleep } from './utils/time';

//executes a command on a remote Node.
export function cmdR(hostSSH: string, command: string, logOutput: boolean = true, ignoreErrors: boolean = false) : string {
  
  //console.log(command);
  //todo: proper escaping for the shell of command here.
  const remoteCommand = `ssh -t -o LogLevel=QUIET ${hostSSH} "${command}"`;
  //console.log(remoteCommand);
  console.log(`executing on ${hostSSH} : ${remoteCommand}`);
  try {

    const result = child.execSync(remoteCommand, {  });
    const txt = result.toString();
    if (logOutput) {
      console.log(txt);
    }
    
    return txt;
  } catch (error: any) {
    console.log(`cmdR Error: ${hostSSH} : ${command}`);
    //console.log(error);
    // if (error.output) {

    //   console.log(error.out);
    //   //let buffer : Buffer = error.output;
    //   //let error = buffer.toString("utf8");
    // }
    //return "";
    if (ignoreErrors) {
      throw "";
    }

    return "";
  }
  
}

/// be aware, it still doesn't print out stdout on the fly.
export async function cmdRemoteAsync(hostSSH: string, command: string) : Promise<string> {
  
  //console.log(command);
  //todo: proper escaping for the shell of command here.
  const remoteCommand = `ssh -t -o LogLevel=QUIET ${hostSSH} "${command}"`;
  //console.log(remoteCommand);
  console.log(`executing on ${hostSSH} : ${remoteCommand}`);

  let result = '';
  

  // const solidityFile = "Some.sol";
  // const promise1 = child.spawn('mythril', [solidityFile]);

  
  let isClosed = false;
  let promise = child.spawn('ssh', ['-t',  '-o', 'LogLevel=QUIET', hostSSH, command ])
  //let promise = child.spawn(re5moteCommand)
    .on("message", (message, send_hanlde) => {
      if (message) {
        let m = message.toString();
        result += m;
        console.log(m);
      }
    })
    .on("close", (code, signal) => {
      console.log("Closed ", hostSSH);
      console.log(code);
      isClosed = true;
      // let s : NodeJS.Signals = signal;
      // console.log(signal);
    })
    .on("error", (error) => {

      console.log("error:");
      console.log(error);
      //throw error;
    })
    

    let data_reader = promise.stdout.addListener("data", (chunk) => {

      if (chunk instanceof Buffer) {

        let buffer = chunk as Buffer;
        console.log("text from data reader (listener):", hostSSH);
        // convert the chunk to a UTF-8 string.
        let text = chunk.toString("utf8");
        console.log(text);
        result += text;
      } else {
        console.log("text from data reader (listener: not a buffer:):", hostSSH);
        console.log(chunk);
      }
    });

    // promise.stdout.addListener("readable", () => {

    //   console.log(chunk);
    // });
    let data = data_reader.read();
    while (data) {
      console.log("text from data reader. reader:", hostSSH);
      console.log(data);
    }


  // console.log("ssh spawned, waiting...");

  await promise;

  while (!isClosed) { 
    await sleep(50);
  }


  // const txt = result.toString();
  // console.log(txt);
  return result;
  
}


export function cmd(command: string) : { success: boolean, output: string} {
  console.log(command);
  let result = Buffer.alloc(0);

  let success = true;
  try {
    result = child.execSync(command);
  } catch (e: any) {
    console.log('catched error in cmd:', e);
    success = false;
    result = e.stderr;
  }
  const txt = result.toString();
  console.log(txt);
  return { success, output: txt };
}

export async function cmdAsync(command: string) : Promise<string> {

  let result = "";
  await child.exec(command, (error, stdout) => {
    if (stdout) {
      result += stdout;
    }
    if (error) {
      result += error;
    }
  });

  return result;
}


