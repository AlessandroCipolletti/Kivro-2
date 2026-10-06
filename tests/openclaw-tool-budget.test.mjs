import assert from 'node:assert/strict';
import test from 'node:test';
import { makeToolBudget } from '../runtime/openclaw/plugin/tool-budget.mjs';

test('per-job OpenClaw tool allowance is bounded even under concurrent calls', async () => {
  const requireTool = makeToolBudget(async () => ({ maxToolCalls: 2 }));
  const results = await Promise.allSettled([requireTool(),requireTool(),requireTool()]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length,2);
  assert.match(results.find((result) => result.status === 'rejected').reason.message,
    /KIVRO_TOOL_LIMIT/);
  await assert.rejects(requireTool(),/KIVRO_TOOL_LIMIT/);
  await assert.rejects(makeToolBudget(async () => ({maxToolCalls:0}))(),
    /KIVRO_TOOL_POLICY_INVALID/);
});
