export type WorkerVersionStatus='SUPPORTED'|'UPDATE_RECOMMENDED'|'SECURITY_UPDATE_REQUIRED'|'UNKNOWN';

function numbers(value:string):readonly number[]|null{
  const match=/^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if(!match)return null;
  const parts=match.slice(1).map(Number);
  return parts.every((part)=>Number.isSafeInteger(part)&&part>=0)?parts:null;
}
function compare(left:readonly number[],right:readonly number[]):number{
  for(let i=0;i<3;i++)if(left[i]!==right[i])return (left[i]??0)-(right[i]??0);
  return 0;
}

/** Version policy is server-owned. Unknown/malformed releases never satisfy a production minimum. */
export function workerVersionStatus(installed:string,minimum:string|null,
  latest:string|null):WorkerVersionStatus{
  const have=numbers(installed),min=minimum?numbers(minimum):null,
    current=latest?numbers(latest):null;
  if(!have||!min)return 'UNKNOWN';
  if(compare(have,min)<0)return 'SECURITY_UPDATE_REQUIRED';
  if(current&&compare(have,current)<0)return 'UPDATE_RECOMMENDED';
  return 'SUPPORTED';
}
