import {handleWorkerDiscovery} from '../../../src/worker/discovery-handler.js';

export const dynamic='force-dynamic';
export function GET(request:Request):Response{return handleWorkerDiscovery(request);}
