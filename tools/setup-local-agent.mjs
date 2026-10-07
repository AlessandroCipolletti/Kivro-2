import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const path=resolve('.env.local');
const info=await lstat(path);
if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077)!==0)
  throw new Error('LOCAL_ENV_MUST_BE_PRIVATE_REGULAR_FILE');
const file=await open(path,constants.O_RDWR|constants.O_APPEND|constants.O_NOFOLLOW);
try{
  const contents=await file.readFile('utf8');
  const lines=contents.split(/\r?\n/).filter((line)=>/^AGENT_CRON_SECRET=/.test(line));
  if(lines.length>1)throw new Error('DUPLICATE_AGENT_CRON_SECRET');
  if(lines.length===1){
    if(lines[0].slice('AGENT_CRON_SECRET='.length).length<32)
      throw new Error('INVALID_AGENT_CRON_SECRET');
    process.stdout.write('Existing private Agent reconcile token kept unchanged.\n');
  }else{
    await file.write(`\n# Local Web/API Agent reconciliation token; do not commit.\nAGENT_CRON_SECRET=${randomBytes(32).toString('hex')}\n`,
      undefined,'utf8');
    process.stdout.write('Added a private Agent reconcile token to .env.local.\n');
  }
}finally{await file.close();}
