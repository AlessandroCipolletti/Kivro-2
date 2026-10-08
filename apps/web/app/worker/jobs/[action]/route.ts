import { handleWorkerJobRpc,type WorkerJobRpcKind } from '../../../../src/worker/control-handler.js';

export const runtime='nodejs';
const actions:Readonly<Record<string,WorkerJobRpcKind>>={
  accept:'ACCEPT','accepted-input':'ACCEPTED_INPUT',transition:'TRANSITION',
  'renew-lease':'RENEW_LEASE','prepare-result-asset':'PREPARE_RESULT_ASSET',
  'finalize-result':'FINALIZE_RESULT',
  'research-search':'RESEARCH_SEARCH','research-fetch':'RESEARCH_FETCH',
  'research-download':'RESEARCH_DOWNLOAD',
  'private-resource-read':'PRIVATE_RESOURCE_READ'};

export async function POST(request:Request,context:{params:Promise<{action:string}>}):Promise<Response>{
  const {action}=await context.params;
  const kind=actions[action];
  return kind?handleWorkerJobRpc(request,kind):Response.json({code:'NOT_FOUND'},{status:404});
}
