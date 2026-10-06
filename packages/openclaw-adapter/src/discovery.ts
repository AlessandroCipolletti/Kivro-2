import type { OpenClawCommandRunner } from './command-runner.js';
import { ReadOnlyOpenClawDiscovery, type LocalOpenClawDiscovery, type ReadOnlyDiscoverySource } from './read-only-discovery.js';

const versionPattern = /(?:^|\n)OpenClaw\s+(\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?)(?:\s|$)/;

export type OpenClawDetection =
  | { readonly status: 'detected'; readonly version: string; readonly compatibility: 'unverified' }
  | { readonly status: 'unavailable' };

export interface OpenClawInspection {
  readonly detection: OpenClawDetection;
  readonly local: LocalOpenClawDiscovery;
}

/** Discovery is advisory seller-local metadata. It grants no capability permissions. */
export class OpenClawDiscoveryAdapter {
  constructor(
    private readonly runner: OpenClawCommandRunner,
    private readonly source: ReadOnlyDiscoverySource = new ReadOnlyOpenClawDiscovery(),
  ) {}

  async inspect(): Promise<OpenClawInspection> {
    const [detection, local] = await Promise.all([this.detect(), this.source.scan()]);
    return { detection, local };
  }

  async detect(): Promise<OpenClawDetection> {
    try {
      const result = await this.runner.run(['--version']);
      if (result.exitCode !== 0) return { status: 'unavailable' };
      const version = versionPattern.exec(result.stdout)?.[1];
      if (!version) return { status: 'unavailable' };
      return { status: 'detected', version, compatibility: 'unverified' };
    } catch {
      return { status: 'unavailable' };
    }
  }
}
