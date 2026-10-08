import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {ProductHeader} from '../../ui/product-header';
import {getAuthService} from '../../../src/auth/server.js';
import InputContractBuilder from './input-contract-builder';

export const dynamic='force-dynamic';
export default async function SellerInputContracts(){
  const auth=getAuthService();
  const session=await auth.auth.api.getSession({headers:await headers()});
  if(!session)redirect('/sign-in?callbackURL=/seller/input-contracts');
  return <main className="site-shell">
    <ProductHeader signedIn/>
    <div className="seller-layout">
      <header className="seller-heading">
        <p className="eyebrow">Seller workspace · input contract</p>
        <h1>Define what buyers provide.</h1>
        <p>Build a typed buyer form, save the private draft, and use the exported
          contract in your Worker package. The Worker tests the exact package
          before you approve publication.</p>
      </header>
      <InputContractBuilder/>
    </div>
  </main>;
}
