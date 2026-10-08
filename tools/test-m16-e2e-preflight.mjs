#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import process from 'node:process';

/** Reports only prerequisite names, never environment values or credentials.
 * This is not the full E2E acceptance command or release evidence. */
export function inspectE2ePrerequisites(env,checkDocker=()=>true){
  const missing=[];
  const required=['DATABASE_URL','STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET','WORKER_DISCOVERY_URL',
    'KIVRO_OPENCLAW_APPROVED_IMAGE','KIVRO_OUTPUT_COLLECTOR_IMAGE',
    'KIVRO_OPENCLAW_APPROVAL_RECORD',
    'KIVRO_OPENCLAW_RUNTIME_ROOT','KIVRO_STORAGE_ORIGIN',
    'KIVRO_CONTROL_PLANE_ID'];
  for(const name of required)if(!env[name]||/replace.me|example\.invalid/i.test(env[name]))
    missing.push(name);
  if(env.KIVRO_STRIPE_MODE!=='test')missing.push('KIVRO_STRIPE_MODE=test');
  if(env.KIVRO_CONTROL_PLANE_STATE!=='ACTIVE')
    missing.push('KIVRO_CONTROL_PLANE_STATE=ACTIVE');
  if(env.STRIPE_SECRET_KEY&&(!env.STRIPE_SECRET_KEY.startsWith('sk_test_')||
    env.STRIPE_SECRET_KEY==='sk_test_replace_me'))missing.push('STRIPE_SECRET_KEY test mode');
  if(env.STRIPE_PUBLISHABLE_KEY&&(!env.STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_')||
    env.STRIPE_PUBLISHABLE_KEY==='pk_test_replace_me'))
    missing.push('STRIPE_PUBLISHABLE_KEY test mode');
  if(env.STRIPE_WEBHOOK_SECRET&&(!env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')||
    env.STRIPE_WEBHOOK_SECRET==='whsec_replace_me'))
    missing.push('STRIPE_WEBHOOK_SECRET test mode');
  if(env.KIVRO_OPENCLAW_APPROVED_IMAGE&&
    !/^\S+@sha256:[a-f0-9]{64}$/.test(env.KIVRO_OPENCLAW_APPROVED_IMAGE))
    missing.push('KIVRO_OPENCLAW_APPROVED_IMAGE digest');
  if(env.KIVRO_OUTPUT_COLLECTOR_IMAGE&&
    env.KIVRO_OUTPUT_COLLECTOR_IMAGE!==env.KIVRO_OPENCLAW_APPROVED_IMAGE)
    missing.push('KIVRO_OUTPUT_COLLECTOR_IMAGE approved digest');
  if(env.NODE_ENV==='production')missing.push('non-production test environment');
  if(!checkDocker())missing.push('Docker Engine');
  return [...new Set(missing)].sort();
}

if(process.argv[1]&&import.meta.filename===process.argv[1]){
  const missing=inspectE2ePrerequisites(process.env,()=>{
    const result=spawnSync('docker',['info','--format','{{.ServerVersion}}'],
      {stdio:['ignore','ignore','ignore'],timeout:5_000});
    return result.status===0;
  });
  if(missing.length){
    process.stderr.write(`M16 authentic local E2E prerequisites unavailable: ${
      missing.join(', ')}\n`);
    process.exitCode=2;
  }else process.stdout.write('M16 external prerequisites are present; this preflight does not run or prove the full E2E path.\n');
}
