import process from 'node:process';
import { OpenClawDiscoveryAdapter } from '../dist/packages/openclaw-adapter/src/discovery.js';
import { LocalOpenClawCommandRunner } from '../dist/packages/openclaw-adapter/src/command-runner.js';

const inspection = await new OpenClawDiscoveryAdapter(new LocalOpenClawCommandRunner()).inspect();
process.stdout.write(`${JSON.stringify({
  runtime: inspection.detection,
  config: inspection.config,
  skills: inspection.skills.status,
  skillCount: inspection.skills.suggestions.length,
})}\n`);
