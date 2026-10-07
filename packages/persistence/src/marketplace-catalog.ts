import type { Pool } from 'pg';
import { z } from 'zod';
import { PublishedCapabilityVersionSchema } from '../../contracts/src/capability-version.js';
import { CapabilityCardSchema, CapabilityDetailSchema, CapabilityDiscoveryDocumentSchema,
  MarketplaceSearchSchema,type CapabilityCard, type CapabilityDetail,
  type CapabilityDiscoveryDocument } from
  '../../contracts/src/marketplace.js';
import type { PostgresAvailabilityRepository } from './availability.js';

type CatalogRow = { id: string; slug: string; name: string; description: string;
  seller_id: string; seller_name: string; seller_member_since: Date;
  category: string | null; short_description: string | null; tags: string[] | null;
  strengths: string[] | null; limitations: string[] | null; version_snapshot: unknown;
  average_rating: string | null; rating_count: number; rating_1: number; rating_2: number;
  rating_3: number; rating_4: number; rating_5: number; completed_jobs: number;
  typical_runtime_seconds: string | null; favorite: boolean; relevance: number };

// Only the public contract/marketplace projection enters search. The rest of
// the version snapshot, Worker manifest, seller config and secrets stay out.
const publicSearchText=`c.name||' '||c.description||' '||coalesce(m.category,'')||' '||
  coalesce(m.short_description,'')||' '||
  array_to_string(coalesce(m.tags,'{}'::text[]),' ')||' '||
  array_to_string(coalesce(m.strengths,'{}'::text[]),' ')||' '||
  array_to_string(coalesce(m.limitations,'{}'::text[]),' ')||' '||
  coalesce((v.version_snapshot->'ioContract'->'input'->'fields')::text,'')||' '||
  coalesce((v.version_snapshot->'ioContract'->'output'->'fields')::text,'')||' '||
  coalesce((SELECT string_agg(e.title||' '||e.description,' ') FROM capability_examples e
    WHERE e.capability_id=c.id AND e.capability_version_id=v.id
      AND e.publication_state='PUBLISHED'),'')`;

const baseSql = `SELECT c.id,c.slug,c.name,c.description,s.id AS seller_id,
  s.display_name AS seller_name,s.created_at AS seller_member_since,
  m.category,m.short_description,m.tags,m.strengths,m.limitations,v.version_snapshot,
  r.average_rating,r.rating_count,r.rating_1,r.rating_2,r.rating_3,r.rating_4,r.rating_5,
  usage.completed_jobs,usage.typical_runtime_seconds,
  EXISTS(SELECT 1 FROM buyer_favorites f WHERE f.capability_id=c.id
    AND f.buyer_account_id=$1::uuid) AS favorite,
  CASE WHEN $2::text='' THEN 0 ELSE ts_rank(
    to_tsvector('english',${publicSearchText}),
    websearch_to_tsquery('english',$2)) END AS relevance
  FROM capabilities c
  JOIN seller_profiles s ON s.id=c.seller_profile_id
  JOIN capability_versions v ON v.id=c.current_version_id AND v.publication_state='PUBLISHED'
  LEFT JOIN capability_marketplace_metadata m ON m.capability_id=c.id
  CROSS JOIN LATERAL (SELECT count(*)::int AS rating_count,
    avg(rating)::text AS average_rating,
    count(*) FILTER (WHERE rating=1)::int AS rating_1,
    count(*) FILTER (WHERE rating=2)::int AS rating_2,
    count(*) FILTER (WHERE rating=3)::int AS rating_3,
    count(*) FILTER (WHERE rating=4)::int AS rating_4,
    count(*) FILTER (WHERE rating=5)::int AS rating_5
    FROM capability_reviews WHERE capability_id=c.id) r
  CROSS JOIN LATERAL (SELECT count(*)::int AS completed_jobs,
    CASE WHEN count(*)>=5 THEN
      round(percentile_cont(0.5) WITHIN GROUP
        (ORDER BY extract(epoch FROM j.completed_at-j.started_at))::numeric)::text
      ELSE NULL END AS typical_runtime_seconds
    FROM jobs j JOIN capability_versions pv ON pv.id=j.capability_version_id
    WHERE pv.capability_id=c.id AND j.status='COMPLETED' AND j.started_at IS NOT NULL
      AND j.completed_at IS NOT NULL) usage`;

function outputTypes(version: ReturnType<typeof PublishedCapabilityVersionSchema.parse>): string[] {
  return [...new Set(version.ioContract.output.fields.map((field) => {
    if (field.type !== 'FILE' && field.type !== 'FILES') {
      return field.type === 'JSON' ? 'STRUCTURED' : 'TEXT';
    }
    const mime = field.constraints.allowedMimeTypes;
    if (mime.includes('application/pdf')) return 'PDF';
    if (mime.some((item) => item.startsWith('image/'))) return 'IMAGE';
    if (mime.some((item) => item.startsWith('video/'))) return 'VIDEO';
    if (mime.some((item) => item.startsWith('audio/'))) return 'AUDIO';
    return 'FILE';
  }))];
}
function inputTypes(version: ReturnType<typeof PublishedCapabilityVersionSchema.parse>): string[] {
  return [...new Set(version.ioContract.input.fields.map((field)=>{
    if(field.type==='FILE'||field.type==='FILES')return field.constraints.allowedExtensions
      .slice(0,2).join(' / ');
    if(field.type==='JSON')return 'STRUCTURED';
    if(field.type==='INTEGER'||field.type==='NUMBER')return 'NUMBER';
    if(field.type==='BOOLEAN')return 'BOOLEAN';
    return 'TEXT';
  }))];
}

function rating(row: CatalogRow) {
  return { average: row.rating_count ? Number(Number(row.average_rating).toFixed(1)) : null,
    count: row.rating_count,
    distribution: [row.rating_1,row.rating_2,row.rating_3,row.rating_4,row.rating_5] as
      [number,number,number,number,number] };
}

export class MarketplaceCatalog {
  constructor(private readonly pool: Pool, private readonly availability: PostgresAvailabilityRepository) {}

  async detailByIdentifier(identifier:string,buyerId:string|null=null):Promise<CapabilityDetail|null>{
    if(z.uuid().safeParse(identifier).success){
      const row=await this.pool.query<{slug:string}>('SELECT slug FROM capabilities WHERE id=$1',
        [identifier]);
      return row.rows[0]?this.detail(row.rows[0].slug,buyerId):null;
    }
    return this.detail(identifier,buyerId);
  }

  private async card(row: CatalogRow, buyerId: string | null): Promise<CapabilityCard> {
    const version=PublishedCapabilityVersionSchema.parse(row.version_snapshot);
    const status=await this.availability.publicStatus(row.id,buyerId);
    return CapabilityCardSchema.parse({ id:row.id,slug:row.slug,name:row.name,
      shortDescription:row.short_description||row.description.slice(0,320),
      category:row.category??'OTHER',tags:row.tags??[],sellerId:row.seller_id,
      sellerName:row.seller_name,versionId:version.id,versionNumber:version.versionNumber,
      price:version.price,rating:rating(row),completedJobs:row.completed_jobs,
      typicalRuntimeSeconds:row.typical_runtime_seconds===null?null:
        Number(row.typical_runtime_seconds),availability:status,outputTypes:outputTypes(version),
      inputTypes:inputTypes(version),favorite:buyerId!==null&&row.favorite });
  }

  /** Only public, currently published supply enters discovery. M11 can reuse this typed result. */
  async search(raw: unknown, buyerId: string | null = null): Promise<readonly CapabilityCard[]> {
    const input=MarketplaceSearchSchema.parse(raw);
    if (buyerId) z.uuid().parse(buyerId);
    const rows=await this.pool.query<CatalogRow>(`${baseSql}
      WHERE c.visibility='PUBLIC' AND c.status='PUBLISHED' AND s.status='ACTIVE'
        AND ($2::text='' OR to_tsvector('english',${publicSearchText})
          @@ websearch_to_tsquery('english',$2))
      ORDER BY c.id`,[buyerId,input.query]);
    const candidates: { row:CatalogRow; priceMinor:number;ratingAverage:number|null;
      typicalRuntime:number|null;outputTypes:string[] }[]=[];
    for (const row of rows.rows) {
      if (input.category && (row.category??'OTHER')!==input.category) continue;
      const version=PublishedCapabilityVersionSchema.parse(row.version_snapshot);
      const priceMinor=version.price.buyerAmountMinor;
      const ratingAverage=rating(row).average;
      const typicalRuntime=row.typical_runtime_seconds===null?null:
        Number(row.typical_runtime_seconds);
      const types=outputTypes(version);
      if ((input.minimumPriceMinor!==undefined&&priceMinor<input.minimumPriceMinor)||
        (input.maximumPriceMinor!==undefined&&priceMinor>input.maximumPriceMinor)||
        (input.minimumRating!==undefined&&(ratingAverage??0)<input.minimumRating)||
        (input.maximumRuntimeSeconds!==undefined&&
          (typicalRuntime===null||typicalRuntime>input.maximumRuntimeSeconds))||
        (input.outputType&&!types.includes(input.outputType))) continue;
      candidates.push({row,priceMinor,ratingAverage,typicalRuntime,outputTypes:types});
    }
    const compare=(a:typeof candidates[number],b:typeof candidates[number]):number=>{
      const primary=input.sort==='RATING'?(b.ratingAverage??0)-(a.ratingAverage??0):
        input.sort==='MOST_USED'?b.row.completed_jobs-a.row.completed_jobs:
        input.sort==='PRICE_ASC'?a.priceMinor-b.priceMinor:
        input.sort==='PRICE_DESC'?b.priceMinor-a.priceMinor:
        input.sort==='FASTEST'?(a.typicalRuntime??Infinity)-
          (b.typicalRuntime??Infinity):b.row.relevance-a.row.relevance;
      return primary||a.row.id.localeCompare(b.row.id);
    };
    candidates.sort(compare);
    if(!input.onlineNow)return Promise.all(candidates.slice(input.offset,input.offset+input.limit)
      .map((item)=>this.card(item.row,buyerId)));
    const online:CapabilityCard[]=[];let skipped=0;
    for(const item of candidates){
      const card=await this.card(item.row,buyerId);
      if(card.availability.status!=='ONLINE'||!card.availability.acceptingImmediate)continue;
      if(skipped<input.offset){skipped++;continue;}
      online.push(card);
      if(online.length===input.limit)break;
    }
    return online;
  }

  async detail(slug: string, buyerId: string | null = null): Promise<CapabilityDetail | null> {
    if (!/^[a-z0-9][a-z0-9-]{0,159}$/.test(slug)) return null;
    if (buyerId) z.uuid().parse(buyerId);
    const rows=await this.pool.query<CatalogRow>(`${baseSql}
      WHERE c.slug=$3 AND c.status='PUBLISHED' AND s.status='ACTIVE'
      AND (c.visibility IN ('PUBLIC','UNLISTED') OR
        (c.visibility='PRIVATE' AND EXISTS(SELECT 1 FROM capability_private_grants g
          WHERE g.capability_id=c.id AND g.buyer_account_id=$1::uuid AND g.revoked_at IS NULL)))`,
    [buyerId,'',slug]);
    const row=rows.rows[0];if(!row)return null;
    const version=PublishedCapabilityVersionSchema.parse(row.version_snapshot);
    const card=await this.card(row,buyerId);
    const reviews=await this.pool.query<{id:string;rating:number;review_text:string;
      created_at:Date;updated_at:Date}>(`SELECT id,rating,review_text,created_at,updated_at
      FROM capability_reviews WHERE capability_id=$1 ORDER BY created_at DESC,id DESC LIMIT 30`,[row.id]);
    const examples=await this.pool.query<{id:string;title:string;description:string;source:string;
      input_payload:unknown;output_payload:unknown}>(`SELECT id,title,description,source,input_payload,output_payload
      FROM capability_examples WHERE capability_version_id=$1 AND publication_state='PUBLISHED'
      ORDER BY display_order`,[version.id]);
    const exampleProjection=[];
    for(const example of examples.rows){
      const assets=await this.pool.query<{asset_id:string;direction:string;field_key:string;
        detected_mime_type:string;size_bytes:string}>(`SELECT a.id AS asset_id,ea.direction,ea.field_key,
        a.detected_mime_type,a.size_bytes FROM capability_example_assets ea
        JOIN assets a ON a.id=ea.asset_id WHERE ea.example_id=$1 AND a.state='READY'
          AND a.retain_until>now()`,[example.id]);
      const input=z.strictObject({values:z.record(z.string(),z.unknown()),
        assets:z.record(z.string(),z.array(z.uuid()))}).parse(example.input_payload);
      const output=z.strictObject({values:z.record(z.string(),z.unknown()),
        assets:z.record(z.string(),z.array(z.uuid()))}).parse(example.output_payload);
      const projected=(direction:string)=>assets.rows.filter((asset)=>asset.direction===direction)
        .map((asset)=>({fieldKey:asset.field_key,assetId:asset.asset_id,
          mimeType:asset.detected_mime_type,sizeBytes:Number(asset.size_bytes)}));
      exampleProjection.push({id:example.id,title:example.title,description:example.description,
        source:example.source,inputValues:input.values,outputValues:output.values,
        inputAssets:projected('INPUT'),outputAssets:projected('OUTPUT')});
    }
    return CapabilityDetailSchema.parse({...card,description:row.description,
      strengths:row.strengths??[],limitations:row.limitations??[],
      version:{id:version.id,number:version.versionNumber,ioContract:version.ioContract,
        permissionManifest:version.publicPermissionManifest,
        researchAccess:version.publicResearchPolicy!==null,
        externalProcessors:version.externalProcessors,
        executionModel:'ISOLATED_SELLER_OPENCLAW'},
      sellerMemberSince:row.seller_member_since.toISOString(),
      reviews:reviews.rows.map((r)=>({id:r.id,rating:r.rating,text:r.review_text,
        createdAt:r.created_at.toISOString(),updatedAt:r.updated_at.toISOString()})),
      examples:exampleProjection});
  }

  /** Saved and recently used supply retains buyer-visible unlisted/granted listings. */
  async listedCards(ids:readonly string[],buyerId:string):Promise<readonly CapabilityCard[]> {
    z.uuid().parse(buyerId);
    if(ids.length===0)return [];
    if(ids.length>200)throw new TypeError('Too many capability IDs');
    ids.forEach((id)=>z.uuid().parse(id));
    const rows=await this.pool.query<CatalogRow>(`${baseSql}
      WHERE c.id=ANY($3::uuid[]) AND c.status='PUBLISHED' AND s.status='ACTIVE'
      AND (c.visibility IN ('PUBLIC','UNLISTED') OR
        (c.visibility='PRIVATE' AND EXISTS(SELECT 1 FROM capability_private_grants g
          WHERE g.capability_id=c.id AND g.buyer_account_id=$1::uuid AND g.revoked_at IS NULL)))`,
    [buyerId,'',ids]);
    const byId=new Map(await Promise.all(rows.rows.map(async(row)=>[row.id,
      await this.card(row,buyerId)] as const)));
    return ids.flatMap((id)=>{const card=byId.get(id);return card?[card]:[];});
  }

  async discoveryDocument(capabilityId:string):Promise<CapabilityDiscoveryDocument|null>{
    const row=await this.pool.query<{slug:string}>(`SELECT c.slug FROM capabilities c
      JOIN capability_versions v ON v.id=c.current_version_id AND v.publication_state='PUBLISHED'
      JOIN seller_profiles s ON s.id=c.seller_profile_id AND s.status='ACTIVE'
      WHERE c.id=$1 AND c.visibility='PUBLIC' AND c.status='PUBLISHED'`,
    [z.uuid().parse(capabilityId)]);
    if(!row.rows[0])return null;
    const detail=await this.detail(row.rows[0].slug);
    if(!detail)return null;
    // Detail also serves UNLISTED direct links. Recheck the PUBLIC publication
    // boundary after composing it so a concurrent visibility/version change
    // cannot turn an old discovery request into an unlisted document.
    const current=await this.pool.query<{id:string}>(`SELECT v.id FROM capabilities c
      JOIN capability_versions v ON v.id=c.current_version_id AND v.publication_state='PUBLISHED'
      JOIN seller_profiles s ON s.id=c.seller_profile_id AND s.status='ACTIVE'
      WHERE c.id=$1 AND c.visibility='PUBLIC' AND c.status='PUBLISHED'`,
    [detail.id]);
    if(current.rows[0]?.id!==detail.version.id)return null;
    return CapabilityDiscoveryDocumentSchema.parse({capabilityId:detail.id,
      capabilityVersionId:detail.version.id,slug:detail.slug,sellerId:detail.sellerId,
      name:detail.name,ioContract:detail.version.ioContract,
      permissionManifest:detail.version.permissionManifest,
      description:detail.description,category:detail.category,tags:detail.tags,
      accepts:detail.version.ioContract.input.fields.map((field)=>({key:field.key,
        type:field.type,required:field.required})),
      outputs:detail.version.ioContract.output.fields.map((field)=>({key:field.key,
        type:field.type,required:field.required})),
      strengths:detail.strengths,limitations:detail.limitations,
      priceMinor:detail.price.buyerAmountMinor,currency:'USD',rating:detail.rating,
      completedJobs:detail.completedJobs,typicalRuntimeSeconds:detail.typicalRuntimeSeconds,
      availability:detail.availability,
      exampleSummaries:detail.examples.map((example)=>({title:example.title,
        description:example.description}))});
  }

  async sellerPublicProfile(sellerId: string): Promise<{id:string;name:string;memberSince:string;
    rating:{average:number|null;count:number};completedJobs:number;capabilities:readonly CapabilityCard[]}|null> {
    z.uuid().parse(sellerId);
    const seller=await this.pool.query<{id:string;display_name:string;created_at:Date}>(
      `SELECT id,display_name,created_at FROM seller_profiles WHERE id=$1 AND status='ACTIVE'`,[sellerId]);
    if(!seller.rows[0])return null;
    const listed=await this.pool.query<CatalogRow>(`${baseSql}
      WHERE s.id=$3 AND c.visibility='PUBLIC' AND c.status='PUBLISHED'
      ORDER BY c.name,c.id`,[null,'',sellerId]);
    const cards=await Promise.all(listed.rows.map((row)=>this.card(row,null)));
    const summary=await this.pool.query<{count:number;average:string|null;completed:number}>(`
      SELECT (SELECT count(*)::int FROM capability_reviews r JOIN capabilities c
        ON c.id=r.capability_id WHERE c.seller_profile_id=$1 AND c.visibility='PUBLIC'
        AND c.status='PUBLISHED') AS count,
      (SELECT avg(rating)::text FROM capability_reviews r JOIN capabilities c
        ON c.id=r.capability_id WHERE c.seller_profile_id=$1 AND c.visibility='PUBLIC'
        AND c.status='PUBLISHED') AS average,
      (SELECT count(*)::int FROM jobs j JOIN capability_versions v ON v.id=j.capability_version_id
        JOIN capabilities c ON c.id=v.capability_id WHERE c.seller_profile_id=$1
        AND c.visibility='PUBLIC' AND c.status='PUBLISHED'
        AND j.status='COMPLETED') AS completed`,[sellerId]);
    return {id:sellerId,name:seller.rows[0].display_name,
      memberSince:seller.rows[0].created_at.toISOString(),
      rating:{average:summary.rows[0]?.average?Number(Number(summary.rows[0].average).toFixed(1)):null,
        count:summary.rows[0]?.count??0},completedJobs:summary.rows[0]?.completed??0,
      capabilities:cards};
  }

  async categories():Promise<readonly {category:string;count:number}[]> {
    const rows=await this.pool.query<{category:string;count:number}>(`SELECT coalesce(m.category,'OTHER') AS category,
      count(*)::int AS count FROM capabilities c
      JOIN capability_versions v ON v.id=c.current_version_id AND v.publication_state='PUBLISHED'
      JOIN seller_profiles s ON s.id=c.seller_profile_id AND s.status='ACTIVE'
      LEFT JOIN capability_marketplace_metadata m ON m.capability_id=c.id
      WHERE c.visibility='PUBLIC' AND c.status='PUBLISHED'
      GROUP BY coalesce(m.category,'OTHER') ORDER BY category`);
    return rows.rows;
  }
}
