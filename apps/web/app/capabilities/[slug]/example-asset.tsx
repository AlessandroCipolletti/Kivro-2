import type { CapabilityDetail } from '../../../../../packages/contracts/src/marketplace.js';
import { safeExampleFileName } from '../../../../../packages/contracts/src/file-types.js';

type ExampleAsset = CapabilityDetail['examples'][number]['inputAssets'][number];

export function ExampleAsset({asset,direction,label}:{asset:ExampleAsset;
  direction:'input'|'output';label:string}){
  const path=`/api/marketplace/example-asset/${asset.assetId}`;
  const preview=`${path}?preview=1`;
  const name=safeExampleFileName(asset.fieldKey,asset.mimeType);
  const media=asset.mimeType;
  return <div className="example-media">
    <strong>{label}:</strong>
    <p>{name} · {media} · {(asset.sizeBytes/1024).toFixed(1)} KB</p>
    {media.startsWith('image/')&&<img alt={`${label} ${direction} example`} src={preview}/>}
    {media.startsWith('video/')&&<video controls preload="metadata" aria-label={`${label} ${direction} example`} src={preview}/>}
    {media.startsWith('audio/')&&<audio controls preload="metadata" aria-label={`${label} ${direction} example`} src={preview}/>}
    {media==='application/pdf'&&<iframe sandbox="" title={`${label} ${direction} PDF example`} src={preview}/>}
    <a href={path} download={name}>Download {label}</a>
  </div>;
}
