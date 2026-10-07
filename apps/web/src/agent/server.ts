import { MarketplaceAgentRepository } from '../../../../packages/persistence/src/marketplace-agent.js';
import { MarketplaceAgentDiscoveryService } from '../../../../packages/application/src/marketplace-agent.js';
import { MarketplaceAgentPlanner } from '../../../../packages/application/src/marketplace-agent-planner.js';
import { AgentPurchaseAuthorizationService } from
  '../../../../packages/application/src/agent-purchase-authorization.js';
import { getMarketplaceService } from '../marketplace/server.js';
import { createPlatformInferenceRouter } from './inference-server.js';
import { MarketplaceAgentTools } from '../../../../packages/application/src/marketplace-agent-tools.js';
import { PlatformInferenceError } from
  '../../../../packages/infrastructure/contracts/src/platform-inference-ports.js';
import { PostgresPlatformInferenceUsage } from
  '../../../../packages/persistence/src/platform-inference-usage.js';

let shared:ReturnType<typeof construct>|undefined;
function construct(){
  const marketplace=getMarketplaceService();
  const repository=new MarketplaceAgentRepository(marketplace.pool);
  const usage=new PostgresPlatformInferenceUsage(marketplace.pool);
  let inference:ReturnType<typeof createPlatformInferenceRouter>=null;
  let configurationError=false;
  try{inference=createPlatformInferenceRouter();}
  catch(error){
    if(!(error instanceof PlatformInferenceError)||error.code!=='CONFIGURATION_ERROR')
      throw error;
    configurationError=true;
  }
  const discovery=new MarketplaceAgentDiscoveryService(marketplace.catalog,repository,
    marketplace.getBuyer,inference);
  const planner=new MarketplaceAgentPlanner(marketplace.catalog,marketplace.availability,
    marketplace.getBuyer,repository,inference);
  const agentTools=new MarketplaceAgentTools(marketplace.catalog,marketplace.availability,
    marketplace.getBuyer,repository,discovery,planner);
  discovery.installTools(agentTools);
  let authorizer:AgentPurchaseAuthorizationService|undefined;
  const getAuthorizer=()=>authorizer??=new AgentPurchaseAuthorizationService(
    marketplace.pool,repository,marketplace.catalog,marketplace.availability,
    marketplace.getBuyer());
  return {repository,usage,inference,configurationError,discovery,planner,agentTools,getAuthorizer,
    getBuyer:marketplace.getBuyer};
}
export function getMarketplaceAgentService(){return shared??=construct();}
