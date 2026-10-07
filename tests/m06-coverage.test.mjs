import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

test('all 106 M06 requirements remain traceable and open until their real closing evidence exists', () => {
  const requirements = readFileSync(new URL('../spec/REQUIREMENTS.md', import.meta.url), 'utf8');
  const coverage = readFileSync(new URL('../spec/COVERAGE.md', import.meta.url), 'utf8');
  const backlog = readFileSync(new URL('../docs/verification-backlog.md', import.meta.url), 'utf8');
  const ids = [...requirements.matchAll(/^### ([A-Z]+-\d+) --- [^\n]+\n(?:(?!^### )[\s\S])*?\*\*Source:\*\* MASTER-SPEC\.md §(\d+)/gm)]
    .filter((match) => Number(match[2]) >= 237 && Number(match[2]) <= 277)
    .map((match) => match[1]);
  assert.equal(ids.length, 106);
  for (const id of ids) {
    const line = coverage.split('\n').find((item) => item.includes(`\`${id}\``));
    assert.ok(line && /`(?:DEFERRED_VERIFICATION|OPEN_IMPLEMENTATION)`/.test(line), id);
    assert.ok(backlog.includes(`| \`${id}\` (§`), `missing per-ID closing gate: ${id}`);
  }
});
