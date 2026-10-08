#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import process from 'node:process';

/** A real Stripe test purchase is optional for local development but required
 * for final payment acceptance. This runner never falls back to test credits. */
export function inspectStripeE2ePrerequisites(env,checkDocker=()=>true){
  const missing=[];
  if(env.NODE_ENV==='production')missing.push('non-production test environment');
  if(env.KIVRO_STRIPE_MODE!=='test')missing.push('KIVRO_STRIPE_MODE=test');
  if(!/^sk_test_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY??'')||
    env.STRIPE_SECRET_KEY==='sk_test_replace_me')missing.push('STRIPE_SECRET_KEY test mode');
  if(!/^pk_test_[A-Za-z0-9]+$/.test(env.STRIPE_PUBLISHABLE_KEY??'')||
    env.STRIPE_PUBLISHABLE_KEY==='pk_test_replace_me')
    missing.push('STRIPE_PUBLISHABLE_KEY test mode');
  if(!/^whsec_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET??'')||
    env.STRIPE_WEBHOOK_SECRET==='whsec_replace_me')
    missing.push('STRIPE_WEBHOOK_SECRET');
  if(!/^acct_[A-Za-z0-9]+$/.test(env.KIVRO_M16_STRIPE_CONNECT_ACCOUNT_ID??''))
    missing.push('KIVRO_M16_STRIPE_CONNECT_ACCOUNT_ID');
  if(!checkDocker())missing.push('Docker Engine');
  return missing;
}

if(process.argv[1]&&import.meta.filename===process.argv[1]){
  const missing=inspectStripeE2ePrerequisites(process.env,()=>
    spawnSync('docker',['info','--format','{{.ServerVersion}}'],{
      stdio:'ignore',timeout:5_000}).status===0);
  if(missing.length){
    process.stderr.write(`M16 Stripe test E2E prerequisites unavailable: ${
      missing.join(', ')}\n`);
    process.exitCode=2;
  }else{
    const result=spawnSync('pnpm',['test:core-worker:m16'],{
      stdio:'inherit',env:{...process.env,M16_INSTALLED_WORKER:'1',
        M16_PAYMENT_MODE:'stripe'}});
    process.exitCode=result.status??1;
  }
}
