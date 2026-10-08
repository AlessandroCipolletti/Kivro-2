/** Signed operational health required before the Cloud may offer paid work. */
export const healthyWorkerChecks = Object.freeze([
  { code: 'DEVICE_IDENTITY', state: 'HEALTHY' },
  { code: 'DOCKER_DAEMON', state: 'HEALTHY' },
  { code: 'APPROVED_SANDBOX_IMAGE', state: 'HEALTHY' },
  { code: 'SANDBOX_SELF_TEST', state: 'HEALTHY' },
]);
