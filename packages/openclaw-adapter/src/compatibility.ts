/** The isolated image is separately approved by digest; a detected ambient binary is never executable. */
export const openClawCompatibilityMatrix = [
  { workerRelease: '0.0.0-dev', openClawVersion: '2026.8.2',
    configSyntaxChecked: true, executionConformanceChecked: true },
] as const;

export interface OpenClawCompatibilityReport {
  readonly status: 'CANDIDATE' | 'UNSUPPORTED' | 'UNAVAILABLE';
  readonly detectedVersion: string | null;
  readonly candidateVersion: string;
  readonly executionAllowed: false;
  readonly reason: string;
}

export function checkOpenClawCompatibility(version: string | null): OpenClawCompatibilityReport {
  const candidateVersion = openClawCompatibilityMatrix[0].openClawVersion;
  if (version === null) return {
    status: 'UNAVAILABLE', detectedVersion: null, candidateVersion, executionAllowed: false,
    reason: 'OpenClaw was not detected',
  };
  const candidate = openClawCompatibilityMatrix.find((entry) => entry.openClawVersion === version);
  if (!candidate) return {
    status: 'UNSUPPORTED', detectedVersion: version, candidateVersion, executionAllowed: false,
    reason: 'Version has no pinned adapter validation',
  };
  return {
    status: 'CANDIDATE', detectedVersion: version, candidateVersion, executionAllowed: false,
    reason: 'Ambient OpenClaw is discovery-only; execution requires a separately approved image digest',
  };
}
