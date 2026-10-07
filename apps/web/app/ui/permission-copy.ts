import type { PublicPermissionManifest } from '../../../../packages/contracts/src/permission-policy.js';

type Entry = PublicPermissionManifest['entries'][number];

const categories:Record<Entry['category'],string>={
  AI_INFERENCE:'Seller model',
  PUBLIC_INTERNET:'Public Internet',
  BROWSER:'Browser',
  PROPRIETARY_DATABASE:'Seller database',
  PRIVATE_API:'Private API',
  LOCAL_FILES:'Selected seller files',
  LOCAL_DIRECTORIES:'Selected directories',
  LOCAL_SOFTWARE:'Local software',
  SHELL:'Shell commands',
  EXTERNAL_SIDE_EFFECTS:'External changes',
  BUYER_FILE_ACCESS:'Buyer files',
};
const states:Record<Entry['state'],string>={
  NOT_USED:'Not used',
  USED:'Used',
  READ_ONLY:'Read only',
  LIMITED:'Limited',
  SELECTED_ONLY:'Selected only',
  DECLARED_DOMAINS_ONLY:'Approved domains only',
  PUBLIC_RESEARCH_ONLY:'Public research only',
};
export function permissionCategoryLabel(category:Entry['category']){return categories[category];}
export function permissionStateLabel(state:Entry['state']){return states[state];}
