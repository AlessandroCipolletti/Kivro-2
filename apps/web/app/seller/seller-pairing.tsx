'use client';

import { useState } from 'react';

type PairingCode = { code: string; expiresAt: string };

/** A code is shown once and is never placed in browser storage. */
export default function SellerPairing({ cloudUrl }: { cloudUrl: string }) {
  const [pairing,setPairing]=useState<PairingCode|null>(null);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const localHttp=cloudUrl.startsWith('http://localhost:')||
    cloudUrl.startsWith('http://127.0.0.1:');

  const issue=async()=>{
    setPending(true);setError(null);setPairing(null);
    try{
      const response=await fetch('/api/seller/pairing/issue',{method:'POST',
        headers:{'content-type':'application/json'},body:'{}',cache:'no-store'});
      const result=await response.json() as PairingCode&{code?:string};
      if(!response.ok)throw new Error(result.code??'Could not create a pairing code');
      setPairing(result);
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not create a pairing code');}
    finally{setPending(false);}
  };
  return <div className="seller-pairing">
    <p>Run Kivro Worker on the computer that will execute jobs. Its device key stays on that computer.</p>
    <button className="primary-button" type="button" disabled={pending} onClick={()=>void issue()}>
      {pending?'Creating code…':'Create one-time pairing code'}</button>
    {error&&<p role="alert" className="ops-error">{error}</p>}
    {pairing&&<div role="status" className="seller-pairing-code">
      <p><strong>Pairing code</strong> · Expires {new Intl.DateTimeFormat(undefined,
        {dateStyle:'medium',timeStyle:'short'}).format(new Date(pairing.expiresAt))}</p>
      <code>{pairing.code}</code>
      <p>On your Worker computer, run:</p>
      <pre><code>{localHttp?'KIVRO_ALLOW_LOCAL_HTTP=true ':''}KIVRO_CLOUD_URL={cloudUrl}{' '}pnpm worker pair {pairing.code}</code></pre>
      <p>This only pairs the device. Discovery and each capability permission still require your review.</p>
    </div>}
  </div>;
}
