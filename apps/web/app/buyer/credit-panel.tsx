'use client';
import { useEffect,useState } from 'react';
import Script from 'next/script';
import { money } from '../discover/marketplace-ui';

type StripeElements={create(type:'payment'): {mount(selector:string):void;destroy():void}};
type StripeClient={elements(options:{clientSecret:string}):StripeElements;
  confirmPayment(options:{elements:StripeElements;confirmParams:{return_url:string}}):
    Promise<{error?:{message?:string}}>};
declare global {interface Window {Stripe?:(key:string)=>StripeClient}}
async function api<T>(path:string,body?:unknown):Promise<T>{
  const response=await fetch(`/api/marketplace/${path}`,body===undefined?{}:{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json() as T&{code?:string};
  if(!response.ok)throw new Error(data.code??'REQUEST_FAILED');
  return data;
}
export function CreditPanel({balance,purchases}:{balance:number;purchases:readonly {id:string;
  amountMinor:number;state:string;createdAt:string}[]}){
  const [amount,setAmount]=useState(20);
  const [purchaseId,setPurchaseId]=useState<string|null>(null);
  const [secret,setSecret]=useState('');
  const [key,setKey]=useState('');
  const [stripe,setStripe]=useState<StripeClient|null>(null);
  const [payableMinor,setPayableMinor]=useState(0);
  const [ready,setReady]=useState(false);
  const [elements,setElements]=useState<StripeElements|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{if(!secret||!key||!ready||!window.Stripe)return;
    const client=window.Stripe(key);setStripe(client);
    const current=client.elements({clientSecret:secret});
    const payment=current.create('payment');payment.mount('#kivro-payment-element');
    setElements(current);
    return ()=>{payment.destroy();setElements(null);setStripe(null);};
  },[secret,key,ready]);
  const resume=async(id:string)=>{
    setBusy(true);setError('');setSecret('');setPurchaseId(id);
    setPayableMinor(purchases.find((item)=>item.id===id)?.amountMinor??Math.round(amount*100));
    try{
      const config=await api<{publishableKey:string}>('stripe-config');
      setKey(config.publishableKey);
      let value='';
      for(let attempt=0;attempt<12;attempt++){
        try{value=(await api<{clientSecret:string}>(`credit-secret/${id}`)).clientSecret;break;}
        catch{await new Promise((resolve)=>setTimeout(resolve,1500));}
      }
      if(!value)throw new Error('Payment is being prepared. Return to Credits to resume.');
      setSecret(value);
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to prepare payment');}
    finally{setBusy(false);}
  };
  const begin=async()=>{
    const id=crypto.randomUUID();
    setBusy(true);setError('');
    try{await api('credit-purchase',{purchaseId:id,amountMinor:Math.round(amount*100)});
      await resume(id);
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not start credit purchase');}
    finally{setBusy(false);}
  };
  const pay=async()=>{
    if(!elements||!stripe)return;
    setBusy(true);setError('');
    try{const result=await stripe.confirmPayment({elements,
      confirmParams:{return_url:`${window.location.origin}/buyer?view=credits`}});
      if(result.error)throw new Error(result.error.message??'Payment failed');
    }catch(cause){setError(cause instanceof Error?cause.message:'Payment failed');setBusy(false);}
  };
  return <section className="buyer-section credit-layout"><Script src="https://js.stripe.com/v3/" strategy="afterInteractive" onReady={()=>setReady(true)}/><div><p className="form-eyebrow">BUYER FUNDING</p><h2>Kivro Credits</h2><p>Available balance: <strong>{money(balance)}</strong>. Credits are held before paid execution and only settled after Kivro validates the result. Taxes, if applicable, are separate from capability pricing.</p><div className="credit-options"><label>Purchase amount (USD)<select value={amount} onChange={(e)=>setAmount(Number(e.target.value))}>{[10,20,50,100,200].map((value)=><option key={value} value={value}>${value}</option>)}</select></label><button type="button" className="primary-button" disabled={busy} onClick={begin}>Add credits →</button></div>
      {secret&&<div className="credit-payment"><p className="form-eyebrow">SECURE PAYMENT</p><div id="kivro-payment-element"/><button type="button" className="primary-button" onClick={pay} disabled={busy||!elements}>Pay {money(payableMinor)} →</button><small>Payment confirmation and credit balance are recorded by the server after Stripe verification.</small></div>}
      {error&&<p className="notice error" role="alert">{error}</p>}
      {purchaseId&&busy&&<p className="notice">Preparing secure payment for purchase {purchaseId.slice(0,8)}…</p>}</div>
      <div className="credit-history"><h3>Recent credit purchases</h3>{purchases.length?purchases.map((purchase)=><div key={purchase.id}><span>{money(purchase.amountMinor)} · {new Date(purchase.createdAt).toLocaleDateString()}</span><strong>{purchase.state.replaceAll('_',' ')}</strong>{['REQUESTED','PROCESSING'].includes(purchase.state)&&<button type="button" onClick={()=>resume(purchase.id)}>Resume payment</button>}</div>):<p>No credit purchases yet.</p>}</div></section>;
}
