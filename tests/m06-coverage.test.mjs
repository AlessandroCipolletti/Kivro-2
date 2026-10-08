import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

test('all 106 M06 requirements remain traceable as evidence closes their gates', () => {
  const requirements = readFileSync(new URL('../spec/REQUIREMENTS.md', import.meta.url), 'utf8');
  const coverage = readFileSync(new URL('../spec/COVERAGE.md', import.meta.url), 'utf8');
  const backlog = readFileSync(new URL('../docs/verification-backlog.md', import.meta.url), 'utf8');
  const ids = [...requirements.matchAll(/^### ([A-Z]+-\d+) --- [^\n]+\n(?:(?!^### )[\s\S])*?\*\*Source:\*\* MASTER-SPEC\.md §(\d+)/gm)]
    .filter((match) => Number(match[2]) >= 237 && Number(match[2]) <= 277)
    .map((match) => match[1]);
  assert.equal(ids.length, 106);
  for (const id of ids) {
    const line = coverage.split('\n').find((item) =>
      item.trimStart().startsWith(`\`${id}\` `));
    assert.ok(line,`missing coverage row: ${id}`);
    const status=/`(VERIFIED|DEFERRED_VERIFICATION|OPEN_IMPLEMENTATION|TESTED)`/.exec(line)?.[1];
    assert.ok(status,`unexplained status: ${id}`);
    const hasBacklog=backlog.includes(`| \`${id}\` (§`);
    assert.equal(hasBacklog,status!=='VERIFIED',
      `backlog must match current evidence status: ${id}`);
  }
});
