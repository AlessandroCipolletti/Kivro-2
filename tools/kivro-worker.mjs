import { runWorkerCli } from '../dist/apps/worker/src/cli.js';
import process from 'node:process';

process.exitCode = await runWorkerCli(process.argv.slice(2));
