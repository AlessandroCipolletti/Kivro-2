import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getAuthService } from '../../../src/auth/server.js';
import { getMarketplaceService } from '../../../src/marketplace/server.js';
import { MarketplaceHeader,Card,EmptyMarket } from '../../discover/marketplace-ui';
export const dynamic='force-dynamic';
export default async function SellerPublicPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const session=await getAuthService().auth.api.getSession({headers:await headers()});
  const profile=await getMarketplaceService().catalog.sellerPublicProfile(id);
  if(!profile)notFound();
  return <main className="site-shell market-shell"><MarketplaceHeader signedIn={!!session}/>
    <section className="seller-public-hero"><p className="eyebrow"><span className="status-dot"/> Independent seller</p><h1>{profile.name}</h1><div><span>Member since {new Date(profile.memberSince).toLocaleDateString()}</span><span>{profile.completedJobs} completed jobs</span><span>{profile.rating.count?`${profile.rating.average?.toFixed(1)} stars · ${profile.rating.count} verified reviews`:'New seller · no verified reviews yet'}</span></div></section>
    <section className="seller-public-list"><h2>Published capabilities</h2>{profile.capabilities.length?<div className="market-grid">{profile.capabilities.map((item)=><Card key={item.id} item={item}/>)}</div>:<EmptyMarket title="No public capabilities" description="This seller has no public capabilities at the moment."/>}</section>
    <footer className="site-footer"><span>© 2026 Kivro</span><span>Ratings come from completed paid jobs.</span></footer></main>;
}
