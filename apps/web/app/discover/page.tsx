import { headers } from 'next/headers';
import Link from 'next/link';
import { getAuthService } from '../../src/auth/server.js';
import { getMarketplaceService } from '../../src/marketplace/server.js';
import { MarketplaceSearchSchema } from '../../../../packages/contracts/src/marketplace.js';
import { MarketplaceHeader,Card,EmptyMarket } from './marketplace-ui';

export const dynamic='force-dynamic';
type Params=Record<string,string|string[]|undefined>;
function one(value:string|string[]|undefined):string|undefined{return typeof value==='string'?value:undefined;}
export default async function DiscoverPage({searchParams}:{searchParams:Promise<Params>}){
  const p=await searchParams;
  const page=Math.max(1,Math.min(41_667,Number.parseInt(one(p.page)??'1',10)||1));
  const session=await getAuthService().auth.api.getSession({headers:await headers()});
  const options=MarketplaceSearchSchema.safeParse({query:one(p.q)??'',
    ...(one(p.category)?{category:one(p.category)}:{}),
    ...(one(p.sort)?{sort:one(p.sort)}:{}),
    ...(one(p.minimumPrice)?{minimumPriceMinor:Math.round(Number(one(p.minimumPrice))*100)}:{}),
    ...(one(p.maximumPrice)?{maximumPriceMinor:Math.round(Number(one(p.maximumPrice))*100)}:{}),
    ...(one(p.minimumRating)?{minimumRating:Number(one(p.minimumRating))}:{}),
    ...(one(p.outputType)?{outputType:one(p.outputType)}:{}),
    ...(one(p.maximumRuntimeSeconds)?{maximumRuntimeSeconds:Number(one(p.maximumRuntimeSeconds))}:{}),
    onlineNow:one(p.onlineNow)==='true',offset:(page-1)*24});
  const search=options.success?options.data:MarketplaceSearchSchema.parse({});
  const service=getMarketplaceService();
  const [items,categories]=await Promise.all([service.catalog.search(search,session?.user.id??null),
    service.catalog.categories()]);
  const hasMore=items.length===search.limit&&
    (await service.catalog.search({...search,limit:1,offset:search.offset+search.limit},
      session?.user.id??null)).length>0;
  const pageHref=(target:number)=>{
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries({q:search.query,category:search.category,
      sort:search.sort,minimumPrice:search.minimumPriceMinor===undefined?undefined:
        (search.minimumPriceMinor/100).toFixed(2),
      maximumPrice:search.maximumPriceMinor===undefined?undefined:
        (search.maximumPriceMinor/100).toFixed(2),minimumRating:search.minimumRating,
      outputType:search.outputType,maximumRuntimeSeconds:search.maximumRuntimeSeconds,
      onlineNow:search.onlineNow?'true':undefined,page:target})){
      if(value!==undefined&&value!=='')params.set(key,String(value));
    }
    return `/discover?${params.toString()}`;
  };
  return <main className="site-shell market-shell"><MarketplaceHeader signedIn={!!session}/>
    <section className="market-intro"><div><p className="eyebrow"><span className="status-dot"/> Discover Kivro</p>
      <h1>Find the right <em>specialist.</em></h1><p>Focused capabilities from independent sellers. A clear price, a defined result, and work you can return to later.</p></div>
      <div className="market-intro-stat"><span>MARKETPLACE</span><strong>{categories.reduce((sum,category)=>sum+category.count,0)}</strong><small>published capabilities</small></div></section>
    <div className="market-content"><aside id="categories" className="market-sidebar" aria-label="Marketplace filters"><div className="market-sidebar-title">Explore <span>↗</span></div>
      <Link href="/discover" className={!search.category?'selected':''}>All capabilities</Link>
      {categories.map((category)=><Link key={category.category} href={`/discover?category=${category.category}`} className={search.category===category.category?'selected':''}>{category.category.replaceAll('_',' ')} <small>{category.count}</small></Link>)}
      <div className="market-sidebar-note">Every capability shows its current published terms. Price and availability are confirmed again before purchase.</div></aside>
      <section className="market-results"><form className="market-search" action="/discover" method="GET" role="search">
        <label className="sr-only" htmlFor="market-q">Search capabilities</label><input id="market-q" type="search" name="q" placeholder="Search capabilities, skills or outcomes" defaultValue={search.query}/>{search.minimumPriceMinor!==undefined&&<input type="hidden" name="minimumPrice" value={(search.minimumPriceMinor/100).toFixed(2)}/ >}{search.maximumPriceMinor!==undefined&&<input type="hidden" name="maximumPrice" value={(search.maximumPriceMinor/100).toFixed(2)}/ >}{search.minimumRating!==undefined&&<input type="hidden" name="minimumRating" value={search.minimumRating}/ >}{search.outputType&&<input type="hidden" name="outputType" value={search.outputType}/ >}{search.maximumRuntimeSeconds!==undefined&&<input type="hidden" name="maximumRuntimeSeconds" value={search.maximumRuntimeSeconds}/ >}{search.onlineNow&&<input type="hidden" name="onlineNow" value="true"/ >}
        <label className="sr-only" htmlFor="market-category">Category</label><select id="market-category" name="category" defaultValue={search.category??''}><option value="">All categories</option>{categories.map((category)=><option key={category.category} value={category.category}>{category.category.replaceAll('_',' ')}</option>)}</select>
        <label className="sr-only" htmlFor="market-sort">Sort</label><select id="market-sort" name="sort" defaultValue={search.sort}><option value="RELEVANCE">Relevant</option><option value="RATING">Top rated</option><option value="MOST_USED">Most used</option><option value="PRICE_ASC">Price: low to high</option><option value="PRICE_DESC">Price: high to low</option><option value="FASTEST">Fastest</option></select>
        <button type="submit">Search ↗</button></form>
        <details className="market-more-filters"><summary>More filters</summary><form action="/discover" method="GET"><input type="hidden" name="q" value={search.query}/><input type="hidden" name="category" value={search.category??''}/><input type="hidden" name="sort" value={search.sort}/><label>Min price ($)<input name="minimumPrice" type="number" min="0" step="0.01" defaultValue={search.minimumPriceMinor===undefined?'':(search.minimumPriceMinor/100).toFixed(2)}/></label><label>Max price ($)<input name="maximumPrice" type="number" min="0" step="0.01" defaultValue={search.maximumPriceMinor===undefined?'':(search.maximumPriceMinor/100).toFixed(2)}/></label><label>Minimum rating<select name="minimumRating" defaultValue={search.minimumRating??''}><option value="">Any</option><option value="4">4+ stars</option><option value="4.5">4.5+ stars</option></select></label><label>Output<select name="outputType" defaultValue={search.outputType??''}><option value="">Any</option>{['TEXT','STRUCTURED','FILE','IMAGE','PDF','AUDIO','VIDEO'].map((type)=><option key={type}>{type}</option>)}</select></label><label>Max typical runtime (seconds)<input name="maximumRuntimeSeconds" type="number" min="1" defaultValue={search.maximumRuntimeSeconds??''}/></label><label className="market-check"><input type="checkbox" name="onlineNow" value="true" defaultChecked={search.onlineNow}/> Available now</label><button type="submit">Apply filters</button></form></details>
        <div className="market-results-heading"><div><p className="form-eyebrow">CURATED BY CLEAR TERMS</p><h2>{search.query?`Results for “${search.query}”`:search.category?search.category.replaceAll('_',' '):'Explore capabilities'}</h2></div><span>{items.length} shown</span></div>
        {items.length?<div className="market-grid">{items.map((item)=><Card key={item.id} item={item}/>)}</div>:<EmptyMarket title="No capabilities match yet" description="Try another search or filter. New sellers can publish capabilities as they complete readiness checks."/>}
        <nav className="buyer-history-pages" aria-label="Search result pages">{page>1&&<Link href={pageHref(page-1)}>← Previous</Link>}<span>Page {page}</span>{hasMore&&<Link href={pageHref(page+1)}>Next →</Link>}</nav>
      </section></div><footer className="site-footer"><span>© 2026 Kivro</span><span>Clear terms for useful work.</span></footer></main>;
}
