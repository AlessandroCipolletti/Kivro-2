export function makeToolBudget(loadPolicy) {
  let calls = 0;
  return async () => {
    const policy = await loadPolicy();
    if (!Number.isSafeInteger(policy?.maxToolCalls) || policy.maxToolCalls < 1 ||
      policy.maxToolCalls > 10_000) throw new Error('KIVRO_TOOL_POLICY_INVALID');
    if (calls >= policy.maxToolCalls) throw new Error('KIVRO_TOOL_LIMIT');
    calls += 1;
  };
}
