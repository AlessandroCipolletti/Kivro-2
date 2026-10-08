/** The cloud must not treat an omitted or partial signed heartbeat as proof
 * that the device can safely receive paid execution. */
const REQUIRED_EXECUTION_CHECKS = [
  'DEVICE_IDENTITY', 'DOCKER_DAEMON', 'APPROVED_SANDBOX_IMAGE',
  'SANDBOX_SELF_TEST',
] as const;

export function hasRequiredExecutionHealth(checks: readonly {
  code: string; state: string;
}[] | null | undefined): boolean {
  return REQUIRED_EXECUTION_CHECKS.every((code) => {
    const reported=checks?.filter((check)=>check.code===code);
    return reported?.length===1&&reported[0]?.state==='HEALTHY';
  });
}
