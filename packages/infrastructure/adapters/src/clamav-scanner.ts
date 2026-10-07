import { createConnection, type Socket } from 'node:net';
import type { MalwareScannerPort } from '../../contracts/src/malware-ports.js';

export class MalwareScanError extends Error {
  constructor(readonly code:'UNAVAILABLE'|'INFECTED'|'LIMIT_EXCEEDED'|'INVALID_RESPONSE'){
    super(code);this.name='MalwareScanError';
  }
}

/** clamd INSTREAM over a UNIX socket or strictly local TCP; no buyer bytes enter logs. */
export class ClamAvSocketScanner implements MalwareScannerPort {
  constructor(private readonly socketPath:string,private readonly timeoutMs=30_000){
    const localTcp=/^tcp:\/\/(127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})$/.exec(socketPath);
    if((!socketPath.startsWith('/')&&!localTcp)||socketPath.includes('\0')||timeoutMs<1000||
      (localTcp&&Number(localTcp[2])>65535))
      throw new MalwareScanError('UNAVAILABLE');
  }
  async ping():Promise<void>{
    const localTcp=/^tcp:\/\/(127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})$/.exec(this.socketPath);
    const socket=localTcp?createConnection({host:localTcp[1]==='[::1]'?'::1':localTcp[1]!,
      port:Number(localTcp[2])}):createConnection({path:this.socketPath});
    try{
      socket.setTimeout(Math.min(this.timeoutMs,5000),()=>socket.destroy());
      await new Promise<void>((resolve,reject)=>{
        socket.once('connect',resolve);socket.once('error',reject);
      });
      const answer=new Promise<string>((resolve,reject)=>{
        let response='';
        socket.on('data',(chunk:Buffer)=>{response+=chunk.toString('utf8');
          if(response.length>64)reject(new MalwareScanError('INVALID_RESPONSE'));
          else if(response.includes('\0'))resolve(response.slice(0,response.indexOf('\0')));});
        socket.once('error',reject);socket.once('end',()=>resolve(response.trim()));
      });
      socket.write('zPING\0');
      if(await answer!=='PONG')throw new MalwareScanError('UNAVAILABLE');
    }catch{throw new MalwareScanError('UNAVAILABLE');}
    finally{socket.destroy();}
  }
  async scan(stream:AsyncIterable<Uint8Array>,maxBytes:number):Promise<'CLEAN'>{
    if(!Number.isSafeInteger(maxBytes)||maxBytes<0)throw new MalwareScanError('LIMIT_EXCEEDED');
    let socket:Socket|undefined;
    try{
      const localTcp=/^tcp:\/\/(127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})$/.exec(this.socketPath);
      socket=localTcp?createConnection({host:localTcp[1]==='[::1]'?'::1':localTcp[1]!,
        port:Number(localTcp[2])}):createConnection({path:this.socketPath});
      const active=socket;
      // Large published output limits need bounded extra streaming time.
      const scanTimeout=Math.max(this.timeoutMs,Math.min(600_000,
        30_000+Math.ceil(maxBytes/1_048_576)*500));
      active.setTimeout(scanTimeout,()=>active.destroy(new MalwareScanError('UNAVAILABLE')));
      await new Promise<void>((resolve,reject)=>{
        active.once('connect',resolve);active.once('error',reject);
      });
      let response='';
      const answer=new Promise<string>((resolve,reject)=>{
        active.on('data',(chunk:Buffer)=>{
          response+=chunk.toString('utf8');
          if(response.length>512){reject(new MalwareScanError('INVALID_RESPONSE'));return;}
          if(response.includes('\0'))resolve(response.slice(0,response.indexOf('\0')));
        });
        active.once('end',()=>resolve(response.trim()));
        active.once('error',reject);
      });
      // A stream-limit failure can abort before the reply is awaited.
      void answer.catch(()=>{});
      const write=async(bytes:Buffer)=>{
        if(!active.write(bytes))await new Promise<void>((resolve,reject)=>{
          active.once('drain',resolve);active.once('error',reject);
        });
      };
      await write(Buffer.from('zINSTREAM\0'));
      let size=0;
      for await(const part of stream){
        size+=part.byteLength;
        if(size>maxBytes||part.byteLength>0xffffffff)throw new MalwareScanError('LIMIT_EXCEEDED');
        const length=Buffer.alloc(4);length.writeUInt32BE(part.byteLength);
        await write(length);await write(Buffer.from(part));
      }
      await write(Buffer.alloc(4));
      const result=await answer;
      if(result==='stream: OK')return 'CLEAN';
      if(/^stream: .+ FOUND$/.test(result))throw new MalwareScanError('INFECTED');
      throw new MalwareScanError('INVALID_RESPONSE');
    }catch(error){
      if(error instanceof MalwareScanError)throw error;
      throw new MalwareScanError('UNAVAILABLE');
    }finally{socket?.destroy();}
  }
}
