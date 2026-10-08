import { z } from 'zod';
import { CapabilityIOContractSchema } from './capability-io.js';
import { DependencyGraphSchema } from './dependency-graph.js';
import { InternalPermissionPolicySchema } from './permission-policy.js';
import { PriceTierSchema } from './pricing.js';
import { WorkerManifestSchema } from './worker-manifest.js';
import { PauseSupportSchema } from './job-control.js';
import { SelectedLocalBindingSchema } from './selected-local-file.js';

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);

/** Full Worker-local draft. Cloud and buyer views receive only its hash and sanitized projections. */
export const LocalCapabilityPackageSchema = z.strictObject({
  packageVersion: z.literal(1),
  capabilityVersionId: z.uuid(),
  capabilityId: z.uuid(),
  workerDeviceId: z.uuid(),
  workerManifest: WorkerManifestSchema,
  dependencyGraph: DependencyGraphSchema,
  permissionPolicy: InternalPermissionPolicySchema,
  sellerInstructions: z.string().max(100_000).optional(),
  sellerInferenceConfigHash: digest.nullable(),
  ioContract: CapabilityIOContractSchema,
  priceTier: PriceTierSchema,
  dependencySnapshot: z.array(z.strictObject({
    id: z.string().min(1).max(160), version: z.string().min(1).max(120), contentHash: digest,
  })).max(128),
  selectedLocalBindings: z.array(SelectedLocalBindingSchema).max(64).optional(),
  concurrencyLimit: z.number().int().positive().max(64),
  pauseSupport: PauseSupportSchema,
  exampleRefs: z.array(z.uuid()).max(32),
  testRefs: z.array(z.uuid()).max(32),
}).superRefine((value, context) => {
  if (value.workerManifest.capabilityVersionId !== value.capabilityVersionId) {
    context.addIssue({ code: 'custom', message: 'Package and Worker manifest version differ' });
  }
  if ((value.permissionPolicy.aiInference === 'SELLER') !== (value.sellerInferenceConfigHash !== null)) {
    context.addIssue({ code: 'custom', message: 'Seller inference configuration mismatch' });
  }
  const inference=value.dependencyGraph.inference;
  if(inference?.mode==='LOCAL'&&
    (!value.permissionPolicy.localInference||value.permissionPolicy.providerBudget||
      value.permissionPolicy.localInference.providerId!==inference.provider||
      value.permissionPolicy.localInference.modelId!==inference.model||
      value.permissionPolicy.localInference.endpointRef!==inference.endpointRef)){
    context.addIssue({code:'custom',message:'Local inference policy mismatch'});
  }
  if(inference?.mode==='REMOTE_PROVIDER'&&value.permissionPolicy.localInference){
    context.addIssue({code:'custom',message:'Remote inference cannot carry local policy'});
  }
  if (value.permissionPolicy.publicInternet !== 'DENY' && !value.permissionPolicy.internet) {
    context.addIssue({ code: 'custom', message: 'Networked capability requires detailed Internet policy' });
  }
  if (value.permissionPolicy.proprietaryDatabase !== 'NONE' && !value.permissionPolicy.localResources?.length) {
    context.addIssue({ code: 'custom', message: 'Database access requires named local broker operations' });
  }
  const resources = new Map(value.workerManifest.resources.map((resource) => [resource.id, resource]));
  if(resources.size!==value.workerManifest.resources.length){
    context.addIssue({code:'custom',message:'Duplicate Worker resource ID'});
  }
  const selected=new Map(value.dependencyGraph.nodes.filter((node)=>node.selected)
    .map((node)=>[node.id,node]));
  const databaseIds=new Set((value.permissionPolicy.localResources??[])
    .map((resource)=>resource.resourceId));
  const apiPolicy=value.permissionPolicy.declaredApiPolicy??value.permissionPolicy.internet;
  const apiIds=new Set(apiPolicy?.mode==='DECLARED_API_ACCESS'?
    apiPolicy.connectors.map((connector)=>connector.id):[]);
  const fileIds=new Set(value.permissionPolicy.selectedFileResourceIds);
  const directoryIds=new Set(value.permissionPolicy.selectedDirectoryResourceIds);
  const bindings=value.selectedLocalBindings??[];
  if (bindings.length!==fileIds.size+directoryIds.size ||
    new Set(bindings.map((binding)=>binding.resourceId)).size!==bindings.length ||
    bindings.some((binding)=>binding.kind==='FILE'?!fileIds.has(binding.resourceId):
      !directoryIds.has(binding.resourceId)) ||
    bindings.some((binding)=>selected.get(binding.resourceId)?.type!==
      (binding.kind==='FILE'?'LOCAL_FILE':'LOCAL_DIRECTORY') ||
      resources.get(binding.resourceId)?.type!=='selected-file' ||
      !resources.get(binding.resourceId)?.permissions.includes('READ')) ||
    (bindings.length>0)!==value.workerManifest.tools.allow.includes('kivro_selected_file_read')) {
    context.addIssue({code:'custom',message:'Selected local file binding and policy disagree'});
  }
  for(const resource of value.workerManifest.resources){
    if(resource.type==='local-resource-broker'&&
      (!databaseIds.has(resource.id)||selected.get(resource.id)?.type!=='DATABASE'||
        !resource.credentialRef))
      context.addIssue({code:'custom',message:'Undeclared local resource'});
    if(resource.type==='declared-api'&&
      (!apiIds.has(resource.id)||selected.get(resource.id)?.type!=='PRIVATE_API'))
      context.addIssue({code:'custom',message:'Undeclared API resource'});
    if(resource.type==='selected-file'&&
      (!fileIds.has(resource.id)&&!directoryIds.has(resource.id) ||
        resource.credentialRef || resource.permissions.length!==1 ||
        resource.permissions[0]!=='READ'))
      context.addIssue({code:'custom',message:'Undeclared selected file resource'});
    if(resource.credentialRef&&
      !value.permissionPolicy.sellerCredentialRefs.includes(resource.credentialRef))
      context.addIssue({code:'custom',message:'Resource credential was not selected'});
  }
  if((databaseIds.size>0)!==value.workerManifest.tools.allow.includes('kivro_resource_read')||
    (apiIds.size>0)!==value.workerManifest.tools.allow.includes('kivro_declared_api')||
    (databaseIds.size>0)!==(value.permissionPolicy.proprietaryDatabase!=='NONE')||
    (apiIds.size>0)!==(value.permissionPolicy.privateApi!=='NONE')){
    context.addIssue({code:'custom',message:'Broker tool and resource permissions disagree'});
  }
  for (const policy of value.permissionPolicy.localResources ?? []) {
    const resource = resources.get(policy.resourceId);
    if (resource?.type !== 'local-resource-broker' ||
      policy.operations.some((operation) => !resource.permissions.includes(operation.id))) {
      context.addIssue({ code: 'custom', message: 'Local resource policy is not selected in Worker manifest' });
    }
  }
  if (apiPolicy?.mode === 'DECLARED_API_ACCESS') {
    for (const connector of apiPolicy.connectors) {
      if (resources.get(connector.id)?.type !== 'declared-api') {
        context.addIssue({ code: 'custom', message: 'Declared API connector is not selected in Worker manifest' });
      }
    }
  }
  if (value.permissionPolicy.providerBudget &&
    !value.permissionPolicy.sellerCredentialRefs.includes(value.permissionPolicy.providerBudget.credentialRef)) {
    context.addIssue({ code: 'custom', message: 'Provider credential was not selected by seller' });
  }
});

export type LocalCapabilityPackage = z.infer<typeof LocalCapabilityPackageSchema>;
