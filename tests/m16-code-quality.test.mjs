import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import test from 'node:test';

const root=resolve(import.meta.dirname,'..');
function sourceFiles(directory){
  const result=[];
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isDirectory())result.push(...sourceFiles(path));
    else if(entry.isFile()&&path.endsWith('.ts'))result.push(path);
  }
  return result;
}

test('M16 code quality gate: strict TypeScript, no implicit sensitive any and automated checks',()=>{
  const tsconfig=JSON.parse(readFileSync(join(root,'tsconfig.json'),'utf8'));
  assert.equal(tsconfig.compilerOptions.strict,true);
  assert.equal(tsconfig.compilerOptions.noUncheckedIndexedAccess,true);
  assert.equal(tsconfig.compilerOptions.exactOptionalPropertyTypes,true);
  const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
  for(const script of ['typecheck','lint','test','build','test:e2e:local',
    'verification:audit','release:gate'])assert.equal(typeof pkg.scripts[script],'string');
  assert.match(pkg.packageManager,/^pnpm@\d+\.\d+\.\d+$/);
  assert.ok(statSync(join(root,'pnpm-lock.yaml')).size>1000);
  const directories=['apps/worker/src','apps/web/src/worker',
    'packages/application/src','packages/contracts/src','packages/domain/src',
    'packages/persistence/src','packages/policy-engine/src',
    'packages/worker-protocol/src'];
  const loose=[];
  for(const name of directories)for(const file of sourceFiles(join(root,name))){
    const lines=readFileSync(file,'utf8').split('\n');
    lines.forEach((line,index)=>{
      if(/(:\s*any\b|\bas\s+any\b|<\s*any\s*>)/.test(line))
        loose.push(`${file.slice(root.length+1)}:${index+1}`);
    });
  }
  assert.deepEqual(loose,[],'security/payment/protocol code has no unexplained any');
});

test('M16 code quality gate: tracked and new files contain no live key shapes',()=>{
  const tracked=execFileSync('git',['ls-files','--cached','--others',
    '--exclude-standard','-z'],{cwd:root}).toString().split('\0')
    .filter(Boolean);
  assert.ok(tracked.includes('pnpm-lock.yaml'));
  assert.ok(tracked.includes('.env.example'));
  assert.equal(tracked.some((path)=>/^(\.env\.local|\.env\.production|\.env)$/.test(path)),false);
  const patterns=[/sk_live_[A-Za-z0-9]{12,}/,/whsec_[A-Za-z0-9]{20,}/,
    /gh[pousr]_[A-Za-z0-9_]{20,}/,/sk-proj-[A-Za-z0-9_-]{20,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
  const found=[];
  for(const name of tracked){
    const path=join(root,name);
    let contents;
    try{if(statSync(path).size>5_000_000)continue;
      contents=readFileSync(path,'utf8');}catch{continue;}
    if(patterns.some((pattern)=>pattern.test(contents)))found.push(name);
  }
  assert.deepEqual(found,[],'tracked files must not contain a live-key shape');
  const example=readFileSync(join(root,'.env.example'),'utf8');
  assert.match(example,/STRIPE_SECRET_KEY=sk_test_replace_me/);
  assert.doesNotMatch(example,/sk_live_[A-Za-z0-9]{12,}/);
});
