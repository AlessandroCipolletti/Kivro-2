import process from 'node:process';
import { OpenClawDiscoveryAdapter } from '../dist/packages/openclaw-adapter/src/discovery.js';
import { LocalOpenClawCommandRunner } from '../dist/packages/openclaw-adapter/src/command-runner.js';

const inspection = await new OpenClawDiscoveryAdapter(new LocalOpenClawCommandRunner()).inspect();
process.stdout.write(`${JSON.stringify({
  runtime: inspection.detection,
  config: inspection.local.config,
  discovery: inspection.local.status,
  completeness: inspection.local.completeness,
  skillCount: inspection.local.skills.length,
  toolReferenceCount: inspection.local.tools.length,
  pluginReferenceCount: inspection.local.plugins.length,
  issues: inspection.local.issues,
})}\n`);
