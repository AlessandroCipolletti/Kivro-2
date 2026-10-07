import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat,open } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const path=resolve('.env.local');
const info=await lstat(path);
if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077)!==0)
  throw new Error('LOCAL_ENV_MUST_BE_PRIVATE_REGULAR_FILE');
const file=await open(path,constants.O_RDWR|constants.O_APPEND|constants.O_NOFOLLOW);
try{
  const contents=await file.readFile('utf8');
  const required=[
    ['KIVRO_WEBHOOK_ENCRYPTION_KEY',()=>randomBytes(32).toString('hex'),
      (value)=>/^[a-f0-9]{64}$/.test(value)],
    ['KIVRO_WEBHOOK_CRON_SECRET',()=>randomBytes(32).toString('hex'),
      (value)=>value.length>=32],
    ['KIVRO_WEBHOOK_BLOCKED_HOSTS',()=> 'localhost,127.0.0.1',
      (value)=>value.length>0],
  ];
  const additions=[];
  for(const [name,generate,valid] of required){
    const matches=contents.split(/\r?\n/).filter((line)=>line.startsWith(`${name}=`));
    if(matches.length>1)throw new Error(`DUPLICATE_${name}`);
    if(matches.length===1){if(!valid(matches[0].slice(name.length+1)))
      throw new Error(`INVALID_${name}`);}
    else additions.push(`${name}=${generate()}`);
  }
  if(additions.length){await file.write(`\n# Private local buyer-webhook delivery keys.\n${additions.join('\n')}\n`,
    undefined,'utf8');process.stdout.write('Added missing webhook keys to .env.local.\n');}
  else process.stdout.write('Existing private webhook keys kept unchanged.\n');
}finally{await file.close();}
