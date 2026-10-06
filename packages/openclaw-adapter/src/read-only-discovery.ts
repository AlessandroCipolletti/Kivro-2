import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, delimiter, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import process from 'node:process';
import JSON5 from 'json5';
import { parseDocument } from 'yaml';

const validName = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/;
const maxConfigBytes = 1024 * 1024;
const maxSkillBytes = 64 * 1024;
const maxRoots = 32;
const maxEntries = 2048;
const maxDepth = 6;

export type DiscoveryIssue =
  | 'CONFIG_MISSING' | 'CONFIG_UNREADABLE' | 'CONFIG_INVALID' | 'CONFIG_INCLUDE_UNRESOLVED'
  | 'CONFIG_SHAPE_UNSUPPORTED' | 'ROOT_OUTSIDE_HOME' | 'ROOT_UNREADABLE' | 'ROOT_SYMLINK'
  | 'SKILL_UNREADABLE' | 'SKILL_INVALID' | 'SKILL_NAME_INVALID' | 'SKILL_COLLISION'
  | 'SCAN_LIMIT' | 'INSTALL_ROOT_UNVERIFIED';

export interface DiscoveredSkillCandidate {
  readonly name: string;
  readonly source: 'workspace' | 'project' | 'personal' | 'managed' | 'extra' | 'bundled' | 'custodian';
  readonly metadata: 'parsed' | 'incomplete';
  readonly readiness: 'unknown';
  readonly visibility: 'unknown';
  readonly consent: 'not-granted';
  readonly ambiguous: boolean;
  readonly declaredResources: {
    readonly binaries: readonly string[];
    /** OpenClaw anyBins means one alternative may suffice; never treat all as required. */
    readonly anyBinaries: readonly string[];
    readonly environmentKeys: readonly string[];
    readonly configKeys: readonly string[];
    readonly status: 'declared' | 'not-declared' | 'unparsed';
  };
}

export interface DiscoveredReference {
  readonly name: string;
  readonly status: 'configured-reference';
  readonly readiness: 'unknown';
  readonly consent: 'not-granted';
}

export interface LocalOpenClawDiscovery {
  readonly status: 'scanned' | 'partial' | 'unavailable';
  readonly config: 'parsed' | 'missing' | 'invalid' | 'unavailable';
  readonly agents: readonly DiscoveredReference[];
  readonly skills: readonly DiscoveredSkillCandidate[];
  readonly tools: readonly DiscoveredReference[];
  readonly plugins: readonly DiscoveredReference[];
  readonly models: readonly DiscoveredReference[];
  readonly issues: readonly DiscoveryIssue[];
  readonly completeness: 'file-backed-metadata-only';
}

export interface ReadOnlyDiscoverySource { scan(): Promise<LocalOpenClawDiscovery>; }

export interface DiscoveryPaths {
  readonly homeDir: string;
  readonly stateDir: string;
  readonly configPath: string;
  readonly workspaceDir: string;
  /** Resolved package root of the installed OpenClaw executable, when known. */
  readonly installRoot?: string | undefined;
}

interface ScanRoot {
  readonly path: string;
  readonly source: DiscoveredSkillCandidate['source'];
  readonly required: boolean;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function safeName(value: unknown): string | undefined {
  return typeof value === 'string' && validName.test(value) && !value.includes('..') ? value : undefined;
}

function names(value: unknown): string[] {
  return Array.isArray(value) ? value.map(safeName).filter((item): item is string => item !== undefined) : [];
}

function references(values: Iterable<string>): DiscoveredReference[] {
  return [...new Set(values)].sort().map((item) => ({
    name: item, status: 'configured-reference', readiness: 'unknown', consent: 'not-granted',
  }));
}

function configuredPath(value: unknown, homeDir: string): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) return undefined;
  if (value === '~') return homeDir;
  if (value.startsWith('~/')) return resolve(homeDir, value.slice(2));
  return isAbsolute(value) ? resolve(value) : undefined;
}

function withinHome(path: string, homeDir: string): boolean {
  return path === homeDir || path.startsWith(`${homeDir}${sep}`);
}

function installedPackageRoot(): string | undefined {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!directory) continue;
    try {
      // realpath follows the executable link only; no process is started.
      return dirname(realpathSync(join(directory, 'openclaw')));
    } catch { /* Try the next PATH entry. */ }
  }
  return undefined;
}

/** Reject symlinked ancestors before any read. The file itself is opened with O_NOFOLLOW. */
async function pathSafety(path: string): Promise<'ok' | 'missing' | 'symlink' | 'unreadable'> {
  const parts: string[] = [];
  let current = resolve(path);
  while (current !== dirname(current)) {
    parts.push(current);
    current = dirname(current);
  }
  for (const part of parts.reverse()) {
    try {
      if ((await lstat(part)).isSymbolicLink()) return 'symlink';
    } catch (error) {
      if (record(error)?.code === 'ENOENT') return 'missing';
      return 'unreadable';
    }
  }
  return 'ok';
}

async function readBounded(path: string, limit: number): Promise<string> {
  if (constants.O_NOFOLLOW === undefined || await pathSafety(path) !== 'ok') {
    throw new Error('Unsafe read-only path');
  }
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error('Unsupported metadata file');
    const buffer = Buffer.alloc(limit + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > limit) throw new Error('Metadata file grew beyond limit');
    return buffer.toString('utf8', 0, offset);
  } finally {
    await file.close();
  }
}

function includes(value: unknown, depth = 0): boolean {
  if (depth > 16) return true;
  if (Array.isArray(value)) return value.some((item) => includes(item, depth + 1));
  const fields = record(value);
  return fields ? Object.entries(fields).some(([key, item]) => key === '$include' || includes(item, depth + 1)) : false;
}

interface SkillMetadata {
  name: string | undefined;
  metadata: 'parsed' | 'incomplete';
  declaredResources: DiscoveredSkillCandidate['declaredResources'];
}

const emptyResources: DiscoveredSkillCandidate['declaredResources'] = {
  binaries: [], anyBinaries: [], environmentKeys: [], configKeys: [], status: 'unparsed',
};

function skillMetadata(content: string, folder: string): SkillMetadata {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)?.[1];
  if (frontmatter === undefined) return { name: safeName(folder), metadata: 'incomplete', declaredResources: emptyResources };
  const document = parseDocument(frontmatter, { uniqueKeys: true });
  if (document.errors.length > 0) return { name: undefined, metadata: 'incomplete', declaredResources: emptyResources };
  try {
    const fields = record(document.toJS({ maxAliasCount: 0 }));
    if (!fields) return { name: undefined, metadata: 'incomplete', declaredResources: emptyResources };
    const metadata = record(fields.metadata);
    const openclaw = record(metadata?.openclaw);
    const requires = record(openclaw?.requires);
    const declaredResources: DiscoveredSkillCandidate['declaredResources'] = requires ? {
      binaries: names(requires.bins),
      anyBinaries: names(requires.anyBins),
      environmentKeys: names(requires.env),
      configKeys: names(requires.config),
      status: 'declared',
    } : { binaries: [], anyBinaries: [], environmentKeys: [], configKeys: [], status: 'not-declared' };
    return {
      name: fields.name === undefined || fields.name === null ? safeName(folder) : safeName(fields.name),
      metadata: 'parsed',
      declaredResources,
    };
  } catch {
    return { name: undefined, metadata: 'incomplete', declaredResources: emptyResources };
  }
}

/** Reads allowlisted config fields and SKILL.md frontmatter; never invokes an OpenClaw stateful CLI. */
export class ReadOnlyOpenClawDiscovery implements ReadOnlyDiscoverySource {
  constructor(private readonly paths: DiscoveryPaths = ReadOnlyOpenClawDiscovery.defaultPaths()) {}

  static defaultPaths(): DiscoveryPaths {
    const homeDir = resolve(process.env.OPENCLAW_HOME ?? homedir());
    const stateDir = resolve(process.env.OPENCLAW_STATE_DIR ?? join(homeDir, '.openclaw'));
    return {
      homeDir,
      stateDir,
      configPath: resolve(process.env.OPENCLAW_CONFIG_PATH ?? join(stateDir, 'openclaw.json')),
      workspaceDir: resolve(process.env.OPENCLAW_WORKSPACE_DIR ?? join(stateDir, 'workspace')),
      installRoot: installedPackageRoot(),
    };
  }

  async scan(): Promise<LocalOpenClawDiscovery> {
    const issues = new Set<DiscoveryIssue>();
    const config = await this.readConfig(issues);
    const parsed = config.value;
    const agents = record(parsed?.agents);
    const skillsConfig = record(parsed?.skills);
    const skillLoad = record(skillsConfig?.load);
    const toolsConfig = record(parsed?.tools);
    const pluginsConfig = record(parsed?.plugins);
    const defaults = record(agents?.defaults);
    const modelConfig = record(defaults?.model);

    const agentIds: string[] = [];
    const agentWorkspaces: string[] = [];
    if (Array.isArray(agents?.list)) {
      for (const item of agents.list) {
        const agent = record(item);
        const id = safeName(agent?.id);
        if (id) agentIds.push(id);
        else issues.add('CONFIG_SHAPE_UNSUPPORTED');
        if (agent?.workspace !== undefined) {
          const path = configuredPath(agent.workspace, this.paths.homeDir);
          if (path) agentWorkspaces.push(path);
          else issues.add('CONFIG_SHAPE_UNSUPPORTED');
        }
      }
    } else if (agents?.list !== undefined) issues.add('CONFIG_SHAPE_UNSUPPORTED');

    const defaultWorkspace = configuredPath(defaults?.workspace, this.paths.homeDir);
    if (defaults?.workspace !== undefined && !defaultWorkspace) issues.add('CONFIG_SHAPE_UNSUPPORTED');
    const workspaces = [defaultWorkspace ?? this.paths.workspaceDir, ...agentWorkspaces];
    const roots: ScanRoot[] = [];
    for (const workspace of workspaces) {
      roots.push({ path: join(workspace, 'skills'), source: 'workspace', required: false });
      roots.push({ path: join(workspace, '.agents', 'skills'), source: 'project', required: false });
    }
    roots.push({ path: join(this.paths.homeDir, '.agents', 'skills'), source: 'personal', required: false });
    roots.push({ path: join(this.paths.stateDir, 'skills'), source: 'managed', required: false });
    if (skillLoad?.extraDirs !== undefined) {
      if (!Array.isArray(skillLoad.extraDirs)) issues.add('CONFIG_SHAPE_UNSUPPORTED');
      else for (const item of skillLoad.extraDirs) {
        const path = configuredPath(item, this.paths.homeDir);
        if (path) roots.push({ path, source: 'extra', required: true });
        else issues.add('CONFIG_SHAPE_UNSUPPORTED');
      }
    }
    if (this.paths.installRoot !== undefined) {
      try {
        const packageJson = record(JSON.parse(await readBounded(join(this.paths.installRoot, 'package.json'), maxConfigBytes)));
        if (packageJson?.name !== 'openclaw' || typeof packageJson.version !== 'string') {
          throw new Error('Unverified OpenClaw package');
        }
        roots.push({ path: join(this.paths.installRoot, 'skills'), source: 'bundled', required: true });
        roots.push({ path: join(this.paths.installRoot, 'custodian-skills'), source: 'custodian', required: false });
      } catch { issues.add('INSTALL_ROOT_UNVERIFIED'); }
    }

    const discovered: DiscoveredSkillCandidate[] = [];
    for (const root of roots.slice(0, maxRoots)) await this.scanRoot(root, discovered, issues);
    if (roots.length > maxRoots) issues.add('SCAN_LIMIT');
    const counts = new Map<string, number>();
    for (const skill of discovered) counts.set(skill.name, (counts.get(skill.name) ?? 0) + 1);
    if ([...counts.values()].some((count) => count > 1)) issues.add('SKILL_COLLISION');
    const skills = discovered.map((skill) => ({ ...skill, ambiguous: (counts.get(skill.name) ?? 0) > 1 }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
    const toolNames = [...names(toolsConfig?.allow), ...names(toolsConfig?.deny)];
    const pluginNames = Object.keys(record(pluginsConfig?.entries) ?? {}).filter((key) => safeName(key) !== undefined);
    const modelNames = [safeName(modelConfig?.primary), ...names(modelConfig?.fallbacks)]
      .filter((item): item is string => item !== undefined);

    return {
      status: config.status === 'unavailable' && skills.length === 0 ? 'unavailable' : issues.size > 0 ? 'partial' : 'scanned',
      config: config.status,
      agents: references(agentIds),
      skills,
      tools: references(toolNames),
      plugins: references(pluginNames),
      models: references(modelNames),
      issues: [...issues].sort(),
      completeness: 'file-backed-metadata-only',
    };
  }

  private async readConfig(issues: Set<DiscoveryIssue>): Promise<{
    status: LocalOpenClawDiscovery['config']; value?: Record<string, unknown>;
  }> {
    try {
      const value = record(JSON5.parse(await readBounded(this.paths.configPath, maxConfigBytes)));
      if (!value) {
        issues.add('CONFIG_INVALID');
        return { status: 'invalid' };
      }
      if (includes(value)) issues.add('CONFIG_INCLUDE_UNRESOLVED');
      return { status: 'parsed', value };
    } catch (error) {
      if (await pathSafety(this.paths.configPath) === 'missing') {
        issues.add('CONFIG_MISSING');
        return { status: 'missing' };
      }
      if (error instanceof SyntaxError) {
        issues.add('CONFIG_INVALID');
        return { status: 'invalid' };
      }
      issues.add('CONFIG_UNREADABLE');
      return { status: 'unavailable' };
    }
  }

  private async scanRoot(root: ScanRoot, output: DiscoveredSkillCandidate[], issues: Set<DiscoveryIssue>): Promise<void> {
    if (root.source !== 'bundled' && root.source !== 'custodian' && !withinHome(root.path, this.paths.homeDir)) {
      issues.add('ROOT_OUTSIDE_HOME');
      return;
    }
    const safety = await pathSafety(root.path);
    if (safety === 'missing') {
      if (root.required) issues.add('ROOT_UNREADABLE');
      return;
    }
    if (safety !== 'ok') {
      issues.add(safety === 'symlink' ? 'ROOT_SYMLINK' : 'ROOT_UNREADABLE');
      return;
    }
    let visited = 0;
    const queue = [{ path: root.path, depth: 0 }];
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const itemSafety = await pathSafety(item.path);
      if (itemSafety !== 'ok') {
        issues.add(itemSafety === 'symlink' ? 'ROOT_SYMLINK' : 'ROOT_UNREADABLE');
        continue;
      }
      let entries;
      try { entries = await readdir(item.path, { withFileTypes: true }); }
      catch { issues.add('ROOT_UNREADABLE'); continue; }
      visited += entries.length;
      if (visited > maxEntries) { issues.add('SCAN_LIMIT'); return; }
      for (const entry of entries) {
        if (entry.isSymbolicLink()) { issues.add('ROOT_SYMLINK'); continue; }
        if (entry.isFile() && entry.name === 'SKILL.md' && item.depth > 0) {
          try {
            const metadata = skillMetadata(await readBounded(join(item.path, entry.name), maxSkillBytes), basename(item.path));
            if (!metadata.name) { issues.add('SKILL_NAME_INVALID'); continue; }
            if (metadata.metadata === 'incomplete') issues.add('SKILL_INVALID');
            output.push({ name: metadata.name, source: root.source, metadata: metadata.metadata,
              readiness: 'unknown', visibility: 'unknown', consent: 'not-granted', ambiguous: false,
              declaredResources: metadata.declaredResources });
          } catch { issues.add('SKILL_UNREADABLE'); }
        } else if (entry.isDirectory() && item.depth < maxDepth) {
          queue.push({ path: join(item.path, entry.name), depth: item.depth + 1 });
        }
      }
    }
  }
}
