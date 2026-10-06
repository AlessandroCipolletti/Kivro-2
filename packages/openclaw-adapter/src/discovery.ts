import { z } from 'zod';
import type { OpenClawCommandRunner } from './command-runner.js';

const versionPattern = /(?:^|\n)OpenClaw\s+(\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?)(?:\s|$)/;
const skillName = z.string().min(1).max(160).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
const skillInventory = z.object({
  skills: z.array(z.object({
    name: skillName,
    eligible: z.boolean(),
  })).max(512),
});
const configValidation = z.object({ valid: z.boolean() });

export type OpenClawDetection =
  | { readonly status: 'detected'; readonly version: string; readonly compatibility: 'unverified' }
  | { readonly status: 'unavailable' };

export type ConfigReadiness = 'valid' | 'invalid' | 'unavailable';

export interface SkillSuggestion {
  readonly name: string;
  readonly eligible: boolean;
  readonly consent: 'not-granted';
}

export type SkillDiscovery =
  | { readonly status: 'available'; readonly suggestions: readonly SkillSuggestion[] }
  | { readonly status: 'unavailable'; readonly suggestions: readonly [] };

export interface OpenClawInspection {
  readonly detection: OpenClawDetection;
  readonly config: ConfigReadiness;
  readonly skills: SkillDiscovery;
}

/** This inspects seller-local metadata; it never grants permissions or certifies execution readiness. */
export class OpenClawDiscoveryAdapter {
  constructor(private readonly runner: OpenClawCommandRunner) {}

  async inspect(): Promise<OpenClawInspection> {
    const detection = await this.detect();
    if (detection.status === 'unavailable') {
      return { detection, config: 'unavailable', skills: { status: 'unavailable', suggestions: [] } };
    }
    const [config, skills] = await Promise.all([this.inspectConfig(), this.discoverSkills()]);
    return { detection, config, skills };
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

  async inspectConfig(): Promise<ConfigReadiness> {
    try {
      const result = await this.runner.run(['config', 'validate', '--json']);
      const parsed: unknown = JSON.parse(result.stdout);
      const validation = configValidation.safeParse(parsed);
      if (!validation.success) return 'unavailable';
      return validation.data.valid && result.exitCode === 0 ? 'valid' : 'invalid';
    } catch {
      return 'unavailable';
    }
  }

  async discoverSkills(): Promise<SkillDiscovery> {
    try {
      const result = await this.runner.run(['skills', 'list', '--json']);
      if (result.exitCode !== 0) return { status: 'unavailable', suggestions: [] };
      const parsed: unknown = JSON.parse(result.stdout);
      const inventory = skillInventory.safeParse(parsed);
      if (!inventory.success) return { status: 'unavailable', suggestions: [] };
      const byName = new Map<string, SkillSuggestion>();
      for (const skill of inventory.data.skills) {
        if (byName.has(skill.name)) return { status: 'unavailable', suggestions: [] };
        byName.set(skill.name, { name: skill.name, eligible: skill.eligible, consent: 'not-granted' });
      }
      return {
        status: 'available',
        suggestions: [...byName.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
      };
    } catch {
      return { status: 'unavailable', suggestions: [] };
    }
  }
}
